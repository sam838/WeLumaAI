import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import http from "http";

export interface SecretRetrievalResult {
  key: string;
  source: "secret_manager" | "env_var";
  secretPath?: string;
  error?: string;
}

export interface SecretStatusInfo {
  configured: boolean;
  source: "secret_manager" | "env_var" | "none";
  secretPath?: string;
  lastChecked: string;
  remediationAdvice?: string;
}

let cachedSecret: string | null = null;
let cachedSource: "secret_manager" | "env_var" | "none" = "none";
let cachedPath: string | undefined = undefined;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

let secretManagerClient: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  return secretManagerClient;
}

/**
 * Fetch project ID from Google Cloud Metadata Server if running in Cloud Run or GCE.
 */
async function getMetadataProjectId(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "metadata.google.internal",
        path: "/computeMetadata/v1/project/project-id",
        headers: { "Metadata-Flavor": "Google" },
        timeout: 1000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200 && data.trim()) {
            resolve(data.trim());
          } else {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

/**
 * Invalidate cached secret to force re-fetch from Secret Manager.
 */
export function invalidateSecretCache(): void {
  cachedSecret = null;
  cachedSource = "none";
  cachedPath = undefined;
  cacheTimestamp = 0;
}

/**
 * Attempt to retrieve Gemini API key from Google Cloud Secret Manager,
 * falling back to process.env.Gemini_Api_Key or process.env.GEMINI_API_KEY.
 */
export async function getGeminiApiKey(): Promise<SecretRetrievalResult> {
  const now = Date.now();
  if (cachedSecret && now - cacheTimestamp < CACHE_TTL_MS) {
    return {
      key: cachedSecret,
      source: cachedSource === "none" ? "env_var" : cachedSource,
      secretPath: cachedPath,
    };
  }

  // 1. Gather candidate project IDs (prioritize user project ID like VITE_FIREBASE_PROJECT_ID or GCP_PROJECT_ID)
  const candidateProjects = new Set<string>();
  if (process.env.GCP_PROJECT_ID) candidateProjects.add(process.env.GCP_PROJECT_ID.trim());
  if (process.env.VITE_FIREBASE_PROJECT_ID) candidateProjects.add(process.env.VITE_FIREBASE_PROJECT_ID.trim());
  if (process.env.GOOGLE_CLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT.startsWith("ais-")) {
    candidateProjects.add(process.env.GOOGLE_CLOUD_PROJECT.trim());
  }
  if (process.env.GCP_PROJECT && !process.env.GCP_PROJECT.startsWith("ais-")) {
    candidateProjects.add(process.env.GCP_PROJECT.trim());
  }

  try {
    const metaProject = await getMetadataProjectId();
    if (metaProject && !metaProject.startsWith("ais-")) {
      candidateProjects.add(metaProject);
    }
  } catch {
    // Ignore metadata probe failure
  }

  // 2. Candidate secret identifiers (respecting User Directive for Gemini_Api_Key)
  const candidateSecretNames = [
    "Gemini_Api_Key",
    "GEMINI_API_KEY",
    "gemini_api_key",
    "gemini-api-key",
  ];

  let secretManagerError: string | null = null;

  // 3. Query Google Cloud Secret Manager if candidate projects exist
  for (const proj of candidateProjects) {
    for (const name of candidateSecretNames) {
      const fullSecretPath = `projects/${proj}/secrets/${name}/versions/latest`;
      try {
        const client = getClient();
        const [version] = await client.accessSecretVersion({ name: fullSecretPath });
        const secretVal = version.payload?.data?.toString("utf8")?.trim();

        if (secretVal && secretVal.length > 0) {
          console.log(`[SecretManager] Successfully retrieved Gemini API key from ${fullSecretPath}`);
          cachedSecret = secretVal;
          cachedSource = "secret_manager";
          cachedPath = fullSecretPath;
          cacheTimestamp = now;
          return {
            key: secretVal,
            source: "secret_manager",
            secretPath: fullSecretPath,
          };
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        secretManagerError = `Path ${fullSecretPath}: ${msg}`;
      }
    }
  }

  // 4. Fallback: Environment Variables (process.env.Gemini_Api_Key or process.env.GEMINI_API_KEY)
  const envKey = (process.env.Gemini_Api_Key || process.env.GEMINI_API_KEY || "").trim();
  if (envKey && envKey !== "MY_GEMINI_API_KEY") {
    cachedSecret = envKey;
    cachedSource = "env_var";
    cachedPath = undefined;
    cacheTimestamp = now;

    if (secretManagerError) {
      console.info(
        `[SecretManager] Notice: Could not access Secret Manager directly (${secretManagerError}). Utilizing active environment variable fallback.`
      );
    }

    return {
      key: envKey,
      source: "env_var",
      error: secretManagerError || undefined,
    };
  }

  // 5. If neither exists, throw an actionable error with gcloud instructions
  const remediation =
    "To use Gemini_Api_Key from Google Secret Manager:\n" +
    "1. Create the secret:\n" +
    "   gcloud secrets create Gemini_Api_Key --replication-policy=\"automatic\"\n" +
    "   echo -n \"YOUR_API_KEY\" | gcloud secrets versions add Gemini_Api_Key --data-file=-\n" +
    "2. Grant the Cloud Run service account access:\n" +
    "   gcloud secrets add-iam-policy-binding Gemini_Api_Key \\\n" +
    "     --member=\"serviceAccount:YOUR_SERVICE_ACCOUNT\" \\\n" +
    "     --role=\"roles/secretmanager.secretAccessor\"";

  throw new Error(
    `Failed to retrieve Gemini API key from Secret Manager or environment variables.\n${remediation}\nLast Secret Manager status: ${
      secretManagerError || "No accessible secrets found"
    }`
  );
}

/**
 * Diagnostic status function for admin/health endpoints.
 */
export function getSecretStatus(): SecretStatusInfo {
  const configured = Boolean(cachedSecret && cachedSecret !== "MY_GEMINI_API_KEY");
  return {
    configured,
    source: cachedSource,
    secretPath: cachedPath,
    lastChecked: new Date(cacheTimestamp || Date.now()).toISOString(),
    remediationAdvice:
      cachedSource === "secret_manager"
        ? "Active: Operational credentials retrieved dynamically from Google Cloud Secret Manager."
        : "Using environment variable fallback. To switch to Secret Manager, ensure 'Gemini_Api_Key' secret exists and grant roles/secretmanager.secretAccessor to your service account.",
  };
}
