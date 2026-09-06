import type { NextFunction, Request, RequestHandler, Response } from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Locals {
      auth?: DecodedIdToken;
    }
  }
}

export function resolveFirebaseProjectId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (
    env.FIREBASE_PROJECT_ID ||
    env.VITE_FIREBASE_PROJECT_ID ||
    env.GCP_PROJECT_ID ||
    env.GOOGLE_CLOUD_PROJECT ||
    env.GCLOUD_PROJECT
  );
}

function getAdminAuth() {
  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: resolveFirebaseProjectId(),
    });
  return getAuth(app);
}

export function shouldRetryWithoutRevocationCheck(code: string): boolean {
  return code === "auth/internal-error";
}

async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken> {
  const adminAuth = getAdminAuth();
  try {
    return await adminAuth.verifyIdToken(token, true);
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "auth/verification-failed";
    if (!shouldRetryWithoutRevocationCheck(code)) throw error;

    console.warn("[Firebase Auth] Revocation lookup unavailable; using signed ID-token verification", {
      code,
      projectId: resolveFirebaseProjectId() || "not-configured",
    });
    return adminAuth.verifyIdToken(token, false);
  }
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header || header.length > 10_000) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match?.[1] || null;
}

export const requireFirebaseAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = readBearerToken(req.get("authorization"));
  if (!token) {
    res.status(401).json({ error: "Sign in with Google to continue." });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== "google.com" || decoded.email_verified !== true) {
      res.status(403).json({ error: "A verified Google account is required." });
      return;
    }
    res.locals.auth = decoded;
    next();
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "auth/verification-failed";
    console.warn("[Firebase Auth] ID token verification failed", {
      code,
      projectId: resolveFirebaseProjectId() || "not-configured",
    });

    const configurationFailure =
      code === "auth/invalid-credential" ||
      code === "auth/insufficient-permission" ||
      code === "auth/internal-error";
    res.status(configurationFailure ? 503 : 401).json({
      error: configurationFailure
        ? "Authentication verification is not configured correctly on the server."
        : "Your session is invalid or expired. Please sign in again.",
      code: configurationFailure ? "AUTH_SERVER_CONFIGURATION" : "AUTH_SESSION_INVALID",
    });
  }
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.auth?.admin !== true) {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
};

export function createUserRateLimit(windowMs: number, maxRequests: number): RequestHandler {
  const counters = new Map<string, { count: number; resetAt: number }>();
  return (_req, res, next) => {
    const now = Date.now();
    const uid = res.locals.auth?.uid;
    if (!uid) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }
    const current = counters.get(uid);
    if (!current || current.resetAt <= now) {
      counters.set(uid, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= maxRequests) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests. Please wait and try again." });
      return;
    }
    current.count += 1;
    next();
  };
}
