import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
  writeBatch,
} from "firebase/firestore";
import {
  AuthUserState,
  JournalInteraction,
  UserProfile,
  WellbeingRoutine,
  WellbeingActivity,
  DailyCheckInState,
  CheckInStats,
} from "./types";
import { sanitizeFirestorePayload } from "./utils/firestorePayload";
export { sanitizeFirestorePayload } from "./utils/firestorePayload";

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
}

// Configuration is resolved exclusively from environment variables (.env via import.meta.env)
const envProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
const rawConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (envProjectId ? `${envProjectId}.firebaseapp.com` : "")).trim(),
  projectId: envProjectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (envProjectId ? `${envProjectId}.firebasestorage.app` : "")).trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "").trim(),
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID || "").trim() || undefined,
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

export function handleFirestoreError(error: unknown, operationType: OperationType, _path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error && "code" in error ? String((error as { code?: unknown }).code || "unknown") : "unknown",
    operationType,
  };
  console.error("Firestore operation failed:", errInfo);
  throw new Error("A cloud data operation failed. Please retry.");
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
function requireVerifiedOwner(userId: string): void {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Cloud sync is unavailable. Please check the Firebase configuration.");
  }
  const current = auth?.currentUser;
  if (!current || current.isAnonymous || current.uid !== userId) {
    throw new Error("Your Firebase session is not ready. Please sign in again.");
  }
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
      "Firebase authentication credentials are not configured in environment variables. Please check your Firebase settings."
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
        `Domain not authorized: "${currentHost}" is not in Firebase Authorized Domains. Please add it to your Firebase Console under Authentication > Settings > Authorized domains.`
      );
    }
    if (code === "auth/operation-not-allowed") {
      throw new Error("Google Sign-In is disabled in Firebase Console. Please enable the Google provider in Firebase Authentication.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Popup blocked by browser. Please allow popups for this site and try signing in again.");
    }
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in popup was closed before completing. Please click 'Sign in with Google Account' again.");
    }
    throw new Error(error?.message || "Google sign-in failed. Please try again.");
  }
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
  const usesGoogle = user?.providerData.some((provider) => provider.providerId === "google.com");
  if (!user || user.isAnonymous || !user.emailVerified || !usesGoogle) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || "Mindful Member",
    email: user.email,
    photoURL: user.photoURL,
    isAnonymous: false,
  };
}

export function subscribeAuthState(callback: (user: AuthUserState | null) => void): Unsubscribe {
  if (!isFirebaseConfigured || !auth) {
    // A cached profile is never proof of authentication. Fail closed when
    // Firebase Auth is unavailable so private local data is not exposed.
    setLocalUser(null);
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
      const mapped = mapFirebaseUser(user);
      if (mapped) {
        setLocalUser(mapped);
        const profile = await getUserProfile(mapped.uid);
        callback({ ...mapped, profile });
      } else {
        setLocalUser(null);
        callback(null);
      }
    } else {
      setLocalUser(null);
      callback(null);
    }
  });
}

/* =========================================================================
   USER PROFILE & PREFERENCES
========================================================================= */

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  requireVerifiedOwner(userId);

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
  if (!userId) throw new Error("Cannot save profile without a user ID.");
  requireVerifiedOwner(userId);

  try {
    localStorage.setItem(`profile_${userId}`, JSON.stringify(profile));
  } catch (e) {
    console.warn("Local profile save notice:", e);
  }

  const sanitized = sanitizeFirestorePayload(profile);
  try {
    await setDoc(doc(db, "users", userId), sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore saveUserProfile error:", err);
    throw err;
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
    await updateProfile(auth.currentUser, {
      displayName: updates.displayName || auth.currentUser.displayName,
      photoURL: updates.photoURL !== undefined ? updates.photoURL : auth.currentUser.photoURL,
    });
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
    email: auth?.currentUser?.email || null,
    photoURL: updates.photoURL !== undefined ? updates.photoURL : (auth?.currentUser?.photoURL ?? null),
    isAnonymous: false,
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
  requireVerifiedOwner(userId);

  saveLocalEntry(userId, interaction);

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
    throw err;
  }
}

export async function deleteInteractionFromFirestore(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) throw new Error("Cannot delete an incomplete journal entry reference.");
  requireVerifiedOwner(userId);

  const docRef = doc(db, "users", userId, "interactions", interactionId);
  try {
    await deleteDoc(docRef);
    deleteLocalEntry(userId, interactionId);
  } catch (err) {
    console.warn("Firestore deleteDoc notice:", err);
    throw err;
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

  try {
    requireVerifiedOwner(userId);
  } catch (error) {
    onData([]);
    onError?.(error instanceof Error ? error : new Error("Authentication required."));
    return () => {};
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
  requireVerifiedOwner(userId);

  saveLocalRoutine(userId, routine);

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
    throw err;
  }
}

export async function deleteRoutineFromFirestore(
  userId: string,
  routineId: string
): Promise<void> {
  if (!userId || !routineId) throw new Error("Missing userId or routineId");
  requireVerifiedOwner(userId);

  const docRef = doc(db, "users", userId, "routines", routineId);
  try {
    await deleteDoc(docRef);
    deleteLocalRoutine(userId, routineId);
  } catch (err) {
    console.warn("Firestore deleteRoutine note:", err);
    throw err;
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

  try {
    requireVerifiedOwner(userId);
  } catch {
    onData([]);
    return () => {};
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

export function getAllLocalCheckIns(userId: string): Record<string, DailyCheckInState> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_CHECKIN}_${userId}_map`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Notice reading local check-in map:", e);
  }

  // Fallback: scan any keys matching prefix
  const result: Record<string, DailyCheckInState> = {};
  try {
    const prefix = `${LOCAL_STORAGE_CHECKIN}_${userId}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && !key.endsWith("_map")) {
        const itemRaw = localStorage.getItem(key);
        if (itemRaw) {
          const item = JSON.parse(itemRaw) as DailyCheckInState;
          if (item?.date) result[item.date] = item;
        }
      }
    }
  } catch {
    // ignore
  }
  return result;
}

export function getLocalCheckIn(userId: string, date: string): DailyCheckInState | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_CHECKIN}_${userId}_${date}`);
    if (raw) return JSON.parse(raw);
    const map = getAllLocalCheckIns(userId);
    return map[date] || null;
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
    const map = getAllLocalCheckIns(userId);
    map[checkIn.date] = checkIn;
    localStorage.setItem(
      `${LOCAL_STORAGE_CHECKIN}_${userId}_map`,
      JSON.stringify(map)
    );
  } catch (e) {
    console.warn("Local check-in save error:", e);
  }
}

export async function saveCheckInToFirestore(
  userId: string,
  checkIn: DailyCheckInState
): Promise<void> {
  if (!userId) return;
  // Always update local cache first
  saveLocalCheckIn(userId, checkIn);

  if (!isFirebaseConfigured || !db) {
    throw new Error("Cloud sync is unavailable. Your check-in remains on this device.");
  }

  const verifiedUser = auth?.currentUser;
  if (!verifiedUser || verifiedUser.isAnonymous || verifiedUser.uid !== userId) {
    throw new Error("Your Firebase session is not ready. Please sign in again before saving.");
  }

  const sanitized = sanitizeFirestorePayload(checkIn);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "users", userId, "checkins", checkIn.date), sanitized, { merge: true });
    batch.set(doc(db, "users", userId), { latestCheckIn: sanitized }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn("Firestore saveCheckInToFirestore notice:", err);
    throw err;
  }
}

export async function getCheckInFromFirestore(
  userId: string,
  date: string
): Promise<DailyCheckInState | null> {
  if (!userId) return null;
  const verifiedUser = auth?.currentUser;
  if (!verifiedUser || verifiedUser.isAnonymous || verifiedUser.uid !== userId) {
    return null;
  }

  const local = getLocalCheckIn(userId, date);
  if (!isFirebaseConfigured || !db) return local;

  try {
    const snap = await getDoc(doc(db, "users", userId, "checkins", date));
    if (snap.exists()) {
      const data = snap.data() as DailyCheckInState;
      saveLocalCheckIn(userId, data);
      return data;
    }
  } catch (err) {
    console.warn("Firestore getCheckInFromFirestore notice:", err);
  }
  return local;
}

export function subscribeUserCheckIns(
  userId: string,
  onData: (items: Record<string, DailyCheckInState>) => void
): Unsubscribe {
  if (!userId) {
    onData({});
    return () => {};
  }

  const verifiedUser = auth?.currentUser;
  if (!verifiedUser || verifiedUser.isAnonymous || verifiedUser.uid !== userId) {
    onData({});
    return () => {};
  }

  // Instant render from local cache
  const localMap = getAllLocalCheckIns(userId);
  onData(localMap);

  if (!isFirebaseConfigured || !db) {
    const onStorageChange = () => {
      onData(getAllLocalCheckIns(userId));
    };
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }

  const checkinsRef = collection(db, "users", userId, "checkins");
  return onSnapshot(
    checkinsRef,
    (snapshot) => {
      const map: Record<string, DailyCheckInState> = { ...getAllLocalCheckIns(userId) };
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as DailyCheckInState;
        if (item?.date) {
          map[item.date] = item;
          // Sync to individual key as well
          saveLocalCheckIn(userId, item);
        }
      });
      localStorage.setItem(`${LOCAL_STORAGE_CHECKIN}_${userId}_map`, JSON.stringify(map));
      onData(map);
    },
    (err) => {
      console.warn("Firestore checkins subscription fallback to local cache:", err);
      onData(getAllLocalCheckIns(userId));
    }
  );
}

export function computeCheckInStats(
  checkInsMap: Record<string, DailyCheckInState>,
  referenceDate: Date = new Date()
): CheckInStats {
  const dates = Object.keys(checkInsMap).filter((d) => Boolean(checkInsMap[d])).sort();
  const dateSet = new Set(dates);

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const todayStr = `${refYear}-${String(refMonth + 1).padStart(2, "0")}-${String(referenceDate.getDate()).padStart(2, "0")}`;
  const checkedInToday = dateSet.has(todayStr);

  const monthPrefix = `${refYear}-${String(refMonth + 1).padStart(2, "0")}`;
  const thisMonthCount = dates.filter((d) => d.startsWith(monthPrefix)).length;

  let currentStreak = 0;
  const checkCursor = new Date(referenceDate);

  // If today hasn't been checked in yet, calculate unbroken streak leading up to yesterday
  if (!checkedInToday) {
    checkCursor.setDate(checkCursor.getDate() - 1);
  }

  while (true) {
    const cursorStr = `${checkCursor.getFullYear()}-${String(checkCursor.getMonth() + 1).padStart(2, "0")}-${String(checkCursor.getDate()).padStart(2, "0")}`;
    if (dateSet.has(cursorStr)) {
      currentStreak++;
      checkCursor.setDate(checkCursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0;
  if (dates.length > 0) {
    const sorted = [...dates].sort();
    let run = 1;
    longestStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + "T00:00:00");
      const curr = new Date(sorted[i] + "T00:00:00");
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else if (diffDays > 1) {
        run = 1;
      }
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const monthName = referenceDate.toLocaleDateString("en-US", { month: "long" });

  return {
    currentStreak,
    longestStreak,
    thisMonthCount,
    totalCheckIns: dates.length,
    monthName,
    checkedInToday,
  };
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
  if (!userId || !activity.id) throw new Error("Cannot save incomplete activity feedback.");
  requireVerifiedOwner(userId);
  saveLocalActivity(userId, activity);

  const sanitized = sanitizeFirestorePayload({
    ...activity,
    updatedAt: Date.now(),
  });

  const docRef = doc(db, "users", userId, "activities", activity.id);
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn("Firestore saveActivityFeedback note:", err);
    throw err;
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

  try {
    requireVerifiedOwner(userId);
  } catch {
    onData([]);
    return () => {};
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

