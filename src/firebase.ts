import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Firestore,
  Unsubscribe,
  getDocFromServer,
  getDoc,
} from "firebase/firestore";
import firebaseAppletConfig from "../firebase-applet-config.json";
import {
  AuthUserState,
  JournalInteraction,
  UserProfile,
  WellbeingRoutine,
  WellbeingActivity,
  DailyCheckInState,
} from "./types";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (firebaseAppletConfig as any)?.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (firebaseAppletConfig as any)?.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (firebaseAppletConfig as any)?.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (firebaseAppletConfig as any)?.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (firebaseAppletConfig as any)?.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (firebaseAppletConfig as any)?.appId || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (firebaseAppletConfig as any)?.measurementId || "",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || (firebaseAppletConfig as any)?.firestoreDatabaseId || undefined,
};

function checkIsConfigValid(cfg: typeof rawConfig): boolean {
  if (!cfg.apiKey || typeof cfg.apiKey !== "string") return false;
  const key = cfg.apiKey.trim();
  if (key === "" || key.startsWith("YOUR_") || key.startsWith("your_") || key === "MY_FIREBASE_API_KEY") {
    return false;
  }
  if (!cfg.projectId || typeof cfg.projectId !== "string" || cfg.projectId.startsWith("YOUR_") || cfg.projectId.startsWith("your-")) {
    return false;
  }
  return true;
}

export const isFirebaseConfigured = checkIsConfigValid(rawConfig);

// Initialize Firebase App safely if valid
let appInstance: ReturnType<typeof initializeApp> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = !getApps().length ? initializeApp(rawConfig) : getApp();
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance, rawConfig.firestoreDatabaseId);
  } catch (err) {
    console.warn("[Firebase] Could not initialize Firebase SDK:", err);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection if configured
async function testFirestoreConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firestore client is offline or initializing.");
    }
  }
}
if (isFirebaseConfigured && db) {
  testFirestoreConnection();
}

/**
 * Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
 */
export function sanitizeFirestorePayload<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  return JSON.parse(
    JSON.stringify(data, (_key, val) => (val === undefined ? null : val))
  );
}

// Local Storage Keys
const LOCAL_STORAGE_ENTRIES = "safeai_journal_entries";
const LOCAL_STORAGE_USER = "safeai_local_user";
const LOCAL_STORAGE_ROUTINES = "safeai_routines";
const LOCAL_STORAGE_ACTIVITIES = "safeai_activities";
const LOCAL_STORAGE_CHECKIN = "safeai_checkin";

export function getLocalUser(): AuthUserState | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalUser(user: AuthUserState | null): void {
  try {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_USER);
    }
  } catch (e) {
    console.warn("Failed to set local user:", e);
  }
}

/* =========================================================================
   AUTH HANDLERS
========================================================================= */

export async function signInWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      "Firebase authentication credentials are not configured. Click 'Start Instant Sandbox Session' below to use the application immediately."
    );
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Sign-In error:", error);
    const code = error?.code || "";
    const msg = error?.message || "";

    if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "current domain";
      throw new Error(
        `Domain not authorized: "${currentHost}" is not in Firebase Authorized Domains. Use the Instant Sandbox Session to use the app immediately!`
      );
    }
    if (code === "auth/operation-not-allowed") {
      throw new Error("Google Sign-In is disabled in Firebase Console. You can use Instant Sandbox Session.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Popup blocked by browser. Please enable popups or use Instant Sandbox Session.");
    }
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in popup was closed. Please click 'Sign in with Google' again.");
    }
    throw new Error(error?.message || "Google sign-in failed. Try Instant Sandbox Session.");
  }
}

export async function signInGuest(): Promise<User | AuthUserState> {
  if (!isFirebaseConfigured || !auth) {
    return createSandboxUser();
  }
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    console.warn("Firebase Anonymous Sign-In error, falling back to sandbox:", error);
    return createSandboxUser();
  }
}

export function createSandboxUser(): AuthUserState {
  const existing = getLocalUser();
  if (existing) return existing;
  const newUser: AuthUserState = {
    uid: `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    displayName: "Wellbeing Explorer",
    email: "explorer@wellbeing.local",
    photoURL: null,
    isAnonymous: true,
  };
  setLocalUser(newUser);
  return newUser;
}

export async function signOutUser(): Promise<void> {
  setLocalUser(null);
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut notice:", e);
    }
  }
}

export function mapFirebaseUser(user: User | null): AuthUserState | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || (user.isAnonymous ? "Guest Explorer" : "Mindful Member"),
    email: user.email,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

export function subscribeAuthState(callback: (user: AuthUserState | null) => void): Unsubscribe {
  const localUser = getLocalUser();
  if (localUser) {
    getUserProfile(localUser.uid).then((profile) => {
      callback({ ...localUser, profile });
    });
  }

  if (!isFirebaseConfigured || !auth) {
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const mapped = mapFirebaseUser(user);
      if (mapped) {
        const profile = await getUserProfile(mapped.uid);
        callback({ ...mapped, profile });
      }
    } else {
      const currentLocal = getLocalUser();
      if (currentLocal) {
        const profile = await getUserProfile(currentLocal.uid);
        callback({ ...currentLocal, profile });
      } else {
        callback(null);
      }
    }
  });
}

/* =========================================================================
   USER PROFILE & PREFERENCES
========================================================================= */

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) {
    try {
      const raw = localStorage.getItem(`profile_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn("Profile fetch note, checking local cache:", err);
  }

  try {
    const local = localStorage.getItem(`profile_${userId}`);
    if (local) return JSON.parse(local);
  } catch {}

  return null;
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
  if (!userId) return;

  try {
    localStorage.setItem(`profile_${userId}`, JSON.stringify(profile));
  } catch (e) {
    console.warn("Local profile save notice:", e);
  }

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const sanitized = sanitizeFirestorePayload(profile);
  try {
    await setDoc(doc(db, "users", userId), sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore saveUserProfile error:", err);
  }
}

export async function updateUserProfileAndAccount(
  userId: string,
  updates: {
    displayName?: string;
    photoURL?: string;
    profile: UserProfile;
  }
): Promise<AuthUserState> {
  if (auth?.currentUser && auth.currentUser.uid === userId) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: updates.displayName || auth.currentUser.displayName,
        photoURL: updates.photoURL !== undefined ? updates.photoURL : auth.currentUser.photoURL,
      });
    } catch (e) {
      console.warn("Could not update auth profile:", e);
    }
  }

  const profileWithMeta: UserProfile = {
    ...updates.profile,
    name: updates.displayName || updates.profile.name,
    photoURL: updates.photoURL !== undefined ? updates.photoURL : updates.profile.photoURL,
    updatedAt: Date.now(),
  };
  await saveUserProfile(userId, profileWithMeta);

  const currentLocal = getLocalUser();
  if (currentLocal && currentLocal.uid === userId) {
    const updatedLocal: AuthUserState = {
      ...currentLocal,
      displayName: updates.displayName || currentLocal.displayName,
      photoURL: updates.photoURL !== undefined ? updates.photoURL : currentLocal.photoURL,
      profile: profileWithMeta,
    };
    setLocalUser(updatedLocal);
    return updatedLocal;
  }

  return {
    uid: userId,
    displayName: updates.displayName || (auth?.currentUser?.displayName ?? "Member"),
    email: auth?.currentUser?.email || (userId.startsWith("sandbox_") ? "sandbox@wellbeing.local" : null),
    photoURL: updates.photoURL !== undefined ? updates.photoURL : (auth?.currentUser?.photoURL ?? null),
    isAnonymous: auth?.currentUser?.isAnonymous ?? userId.startsWith("sandbox_"),
    profile: profileWithMeta,
  };
}

/* =========================================================================
   JOURNAL INTERACTIONS
========================================================================= */

export function getLocalEntries(userId: string): JournalInteraction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_ENTRIES}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalEntry(userId: string, entry: JournalInteraction): void {
  try {
    const entries = getLocalEntries(userId);
    const index = entries.findIndex((e) => e.id === entry.id);
    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.unshift(entry);
    }
    localStorage.setItem(`${LOCAL_STORAGE_ENTRIES}_${userId}`, JSON.stringify(entries));
  } catch (e) {
    console.warn("Local entry save error:", e);
  }
}

export function deleteLocalEntry(userId: string, entryId: string): void {
  try {
    const entries = getLocalEntries(userId).filter((e) => e.id !== entryId);
    localStorage.setItem(`${LOCAL_STORAGE_ENTRIES}_${userId}`, JSON.stringify(entries));
  } catch (e) {
    console.warn("Local entry delete error:", e);
  }
}

export async function saveInteractionToFirestore(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId || !interaction.id) {
    throw new Error("Cannot save interaction: missing userId or interaction id.");
  }

  saveLocalEntry(userId, interaction);

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const sanitized = sanitizeFirestorePayload({
    ...interaction,
    userId,
    updatedAt: Date.now(),
  });

  const docRef = doc(db, "users", userId, "interactions", interaction.id);
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore setDoc notice, saved locally:", err);
  }
}

export async function deleteInteractionFromFirestore(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) return;

  deleteLocalEntry(userId, interactionId);

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const docRef = doc(db, "users", userId, "interactions", interactionId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore deleteDoc notice:", err);
  }
}

export function subscribeUserInteractions(
  userId: string,
  onData: (items: JournalInteraction[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) {
    const local = getLocalEntries(userId);
    local.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    onData(local);

    const onStorageChange = () => {
      const updated = getLocalEntries(userId);
      updated.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onData(updated);
    };
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }

  const interactionsRef = collection(db, "users", userId, "interactions");
  let q;
  try {
    q = query(interactionsRef, orderBy("updatedAt", "desc"));
  } catch {
    q = interactionsRef;
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as JournalInteraction;
        items.push({ ...data, id: docSnap.id });
      });
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      onData(items);
    },
    (err) => {
      console.warn("Firestore interactions subscription fallback to local cache:", err);
      const fallback = getLocalEntries(userId);
      onData(fallback);
      if (onError) onError(err);
    }
  );
}

/* =========================================================================
   WELLBEING ROUTINES
========================================================================= */

export function getLocalRoutines(userId: string): WellbeingRoutine[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_ROUTINES}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalRoutine(userId: string, routine: WellbeingRoutine): void {
  try {
    const list = getLocalRoutines(userId);
    const idx = list.findIndex((r) => r.id === routine.id);
    if (idx >= 0) {
      list[idx] = routine;
    } else {
      list.push(routine);
    }
    localStorage.setItem(`${LOCAL_STORAGE_ROUTINES}_${userId}`, JSON.stringify(list));
  } catch (e) {
    console.warn("Local routine save error:", e);
  }
}

export function deleteLocalRoutine(userId: string, routineId: string): void {
  try {
    const list = getLocalRoutines(userId).filter((r) => r.id !== routineId);
    localStorage.setItem(`${LOCAL_STORAGE_ROUTINES}_${userId}`, JSON.stringify(list));
  } catch (e) {
    console.warn("Local routine delete error:", e);
  }
}

export async function saveRoutineToFirestore(
  userId: string,
  routine: WellbeingRoutine
): Promise<void> {
  if (!userId || !routine.id) throw new Error("Missing userId or routineId");

  saveLocalRoutine(userId, routine);

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const sanitized = sanitizeFirestorePayload({
    ...routine,
    userId,
    updatedAt: Date.now(),
  });

  const docRef = doc(db, "users", userId, "routines", routine.id);
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore saveRoutine note:", err);
  }
}

export async function deleteRoutineFromFirestore(
  userId: string,
  routineId: string
): Promise<void> {
  if (!userId || !routineId) return;

  deleteLocalRoutine(userId, routineId);

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const docRef = doc(db, "users", userId, "routines", routineId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore deleteRoutine note:", err);
  }
}

export function subscribeUserRoutines(
  userId: string,
  onData: (items: WellbeingRoutine[]) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) {
    const local = getLocalRoutines(userId);
    onData(local);
    const onStorageChange = () => {
      onData(getLocalRoutines(userId));
    };
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }

  const routinesRef = collection(db, "users", userId, "routines");
  return onSnapshot(
    routinesRef,
    (snapshot) => {
      const items: WellbeingRoutine[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as WellbeingRoutine), id: docSnap.id });
      });
      onData(items);
    },
    (err) => {
      console.warn("Firestore routines snapshot fallback to local:", err);
      onData(getLocalRoutines(userId));
    }
  );
}

/* =========================================================================
   DAILY CHECK-IN STATE (Mood / Energy / Stress)
========================================================================= */

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalCheckIn(userId: string, date: string): DailyCheckInState | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_CHECKIN}_${userId}_${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalCheckIn(userId: string, checkIn: DailyCheckInState): void {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_CHECKIN}_${userId}_${checkIn.date}`,
      JSON.stringify(checkIn)
    );
  } catch (e) {
    console.warn("Local check-in save error:", e);
  }
}

/* =========================================================================
   ACTIVITIES & FEEDBACK
========================================================================= */

export function getLocalActivities(userId: string): WellbeingActivity[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_ACTIVITIES}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalActivity(userId: string, activity: WellbeingActivity): void {
  try {
    const list = getLocalActivities(userId);
    const idx = list.findIndex((a) => a.id === activity.id);
    if (idx >= 0) {
      list[idx] = activity;
    } else {
      list.push(activity);
    }
    localStorage.setItem(`${LOCAL_STORAGE_ACTIVITIES}_${userId}`, JSON.stringify(list));
  } catch (e) {
    console.warn("Local activity save error:", e);
  }
}

export async function saveActivityFeedback(
  userId: string,
  activity: WellbeingActivity
): Promise<void> {
  if (!userId) return;
  saveLocalActivity(userId, activity);

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) return;

  const sanitized = sanitizeFirestorePayload({
    ...activity,
    updatedAt: Date.now(),
  });

  const docRef = doc(db, "users", userId, "activities", activity.id);
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore saveActivityFeedback note:", err);
  }
}

export function subscribeUserActivities(
  userId: string,
  onData: (items: WellbeingActivity[]) => void
): Unsubscribe {
  if (!userId) {
    onData([]);
    return () => {};
  }

  if (userId.startsWith("sandbox_") || !isFirebaseConfigured || !db) {
    onData(getLocalActivities(userId));
    const onStorageChange = () => onData(getLocalActivities(userId));
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }

  const actRef = collection(db, "users", userId, "activities");
  return onSnapshot(
    actRef,
    (snapshot) => {
      const items: WellbeingActivity[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as WellbeingActivity), id: docSnap.id });
      });
      onData(items);
    },
    (err) => {
      console.warn("Firestore activities snapshot fallback to local:", err);
      onData(getLocalActivities(userId));
    }
  );
}

