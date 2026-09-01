import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AuthUserState,
  DailyCheckInState,
  JournalInteraction,
  JournalMessage,
  JournalMode,
  MoodType,
  NavigationTab,
  ReflectionDepth,
  StoredPreferenceItem,
  UserProfile,
  WellbeingActivity,
  WellbeingDomain,
  WellbeingRoutine,
} from "./types";
import {
  subscribeAuthState,
  signInWithGoogle,
  signInGuest,
  createSandboxUser,
  signOutUser,
  subscribeUserInteractions,
  saveInteractionToFirestore,
  deleteInteractionFromFirestore,
  subscribeUserRoutines,
  saveRoutineToFirestore,
  deleteRoutineFromFirestore,
  subscribeUserActivities,
  saveActivityFeedback,
  getTodayDateString,
  getLocalCheckIn,
  saveLocalCheckIn,
  saveUserProfile,
} from "./firebase";
import {
  DEFAULT_WELLBEING_ACTIVITIES,
  DEFAULT_ROUTINES_SEED,
  INITIAL_STORED_PREFERENCES_SEED,
} from "./services/wellbeingData";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { LandingView } from "./components/LandingView";
import { OnboardingModal } from "./components/OnboardingModal";
import { TodayView } from "./views/TodayView";
import { JournalView } from "./views/JournalView";
import { InsightsView } from "./views/InsightsView";
import { ActivitiesView } from "./views/ActivitiesView";
import { PlannerView } from "./views/PlannerView";
import { ProfileView } from "./views/ProfileView";
import { CalendarModal } from "./components/CalendarModal";

export default function App() {
  // 1. Core State
  const [currentUser, setCurrentUser] = useState<AuthUserState | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>("today");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);

  // 2. Data State
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);
  const [routines, setRoutines] = useState<WellbeingRoutine[]>([]);
  const [activities, setActivities] = useState<WellbeingActivity[]>(DEFAULT_WELLBEING_ACTIVITIES);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckInState | null>(null);

  // Quick jump draft buffer
  const [quickDraftText, setQuickDraftText] = useState<string>("");
  const [quickDraftMood, setQuickDraftMood] = useState<MoodType | undefined>(undefined);

  // Status flags
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pending save ref for retry
  const pendingSaveRef = useRef<JournalInteraction | null>(null);

  // A. Subscribe to Firebase Auth State
  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        // Load today's check-in
        const today = getTodayDateString();
        const savedCheckIn = getLocalCheckIn(user.uid, today);
        if (savedCheckIn) setTodayCheckIn(savedCheckIn);
      }
    });
    return () => unsubscribe();
  }, []);

  // B. Subscribe to User's Isolated Firestore Subcollections
  useEffect(() => {
    if (!currentUser?.uid) {
      setInteractions([]);
      setActiveInteractionId(null);
      setRoutines([]);
      return;
    }

    const userId = currentUser.uid;

    // 1. Subscribe to Interactions / Entries
    const unsubInteractions = subscribeUserInteractions(
      userId,
      (items) => {
        setInteractions(items);
        setSaveError(null);
        if (!activeInteractionId && items.length > 0) {
          setActiveInteractionId(items[0].id);
        }
      },
      (err) => {
        console.warn("Interactions sync notice:", err);
      }
    );

    // 2. Subscribe to Routines
    const unsubRoutines = subscribeUserRoutines(userId, (items) => {
      if (items.length === 0) {
        // Seed default initial routines for new users
        DEFAULT_ROUTINES_SEED.forEach((seed, idx) => {
          const routine: WellbeingRoutine = {
            ...seed,
            id: `seed_routine_${idx}_${Date.now()}`,
            userId,
          };
          saveRoutineToFirestore(userId, routine).catch(() => {});
        });
      } else {
        setRoutines(items);
      }
    });

    // 3. Subscribe to Activities feedback & saved
    const unsubActivities = subscribeUserActivities(userId, (items) => {
      if (items.length > 0) {
        // Merge user saved state with defaults
        const merged = DEFAULT_WELLBEING_ACTIVITIES.map((def) => {
          const found = items.find((it) => it.id === def.id);
          return found || def;
        });
        setActivities(merged);
      }
    });

    return () => {
      unsubInteractions();
      unsubRoutines();
      unsubActivities();
    };
  }, [currentUser?.uid]);

  // Seed default stored preferences if user has none
  useEffect(() => {
    if (currentUser?.uid && currentUser.profile && !currentUser.profile.storedPreferences) {
      const updatedProfile: UserProfile = {
        ...currentUser.profile,
        storedPreferences: INITIAL_STORED_PREFERENCES_SEED,
      };
      saveUserProfile(currentUser.uid, updatedProfile).catch(() => {});
    }
  }, [currentUser?.uid, currentUser?.profile]);

  // C. Auth Handlers
  const handleSignInGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in with Google.");
    }
  };

  const handleSignInGuest = async () => {
    setAuthError(null);
    try {
      await signInGuest();
    } catch (err: any) {
      setAuthError(err.message || "Failed to enter as guest.");
    }
  };

  const handleStartSandbox = () => {
    setAuthError(null);
    const sandboxUser = createSandboxUser();
    setCurrentUser(sandboxUser);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setInteractions([]);
      setActiveInteractionId(null);
      setRoutines([]);
    } catch (err) {
      console.warn("Sign out notice:", err);
    }
  };

  // D. Journal Action Handlers
  const handleSendMessage = useCallback(
    async (
      prompt: string,
      mode: JournalMode,
      depth: ReflectionDepth,
      title: string,
      domains: WellbeingDomain[] = ["mind"],
      mood: MoodType | string = "reflective",
      tags: string[] = []
    ) => {
      if (!currentUser?.uid) return;
      setIsGenerating(true);
      setSaveError(null);

      const now = Date.now();
      const currentEntry = interactions.find((it) => it.id === activeInteractionId) || null;
      const entryId = currentEntry?.id || `entry_${now}_${Math.random().toString(36).slice(2, 7)}`;
      let finalTitle = title.trim();
      if (!finalTitle) {
        finalTitle = currentEntry?.title || prompt.slice(0, 45) + (prompt.length > 45 ? "..." : "");
      }

      const userMsg: JournalMessage = {
        id: `msg_u_${now}`,
        role: "user",
        text: prompt,
        timestamp: now,
      };

      const existingMessages = currentEntry?.messages || [];
      const updatedMessages = [...existingMessages, userMsg];

      // Optimistically create/update entry in Firestore so user input is guaranteed saved
      const baseEntry: JournalInteraction = {
        id: entryId,
        userId: currentUser.uid,
        title: finalTitle,
        rawText: currentEntry?.rawText ? `${currentEntry.rawText}\n\n${prompt}` : prompt,
        mode,
        depth,
        domains: domains.length > 0 ? domains : currentEntry?.domains || ["mind"],
        mood: mood || currentEntry?.mood || "reflective",
        energy: currentEntry?.energy || 3,
        stress: currentEntry?.stress || 2,
        tags: tags.length > 0 ? tags : currentEntry?.tags || [],
        messages: updatedMessages,
        summary: currentEntry?.summary,
        themes: currentEntry?.themes,
        analysis: currentEntry?.analysis,
        createdAt: currentEntry?.createdAt || now,
        updatedAt: now,
      };

      pendingSaveRef.current = baseEntry;
      setActiveInteractionId(entryId);
      try {
        await saveInteractionToFirestore(currentUser.uid, baseEntry);
      } catch (err: any) {
        console.warn("Optimistic save warning:", err);
      }

      try {
        // Send request to Gemini Reflect & Converse API
        const response = await fetch("/api/gemini/reflect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            style: mode,
            depth,
            entryTitle: finalTitle,
            recentHistory: existingMessages.slice(-8).map((m) => ({
              role: m.role,
              text: m.text,
            })),
            userProfile: currentUser.profile,
            clientNow: new Date().toISOString(),
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();
        const modelMsg: JournalMessage = {
          id: `msg_m_${Date.now()}`,
          role: "model",
          text: data.reply,
          suggestedActivities: Array.isArray(data.suggestedActivities) && data.suggestedActivities.length > 0
            ? data.suggestedActivities
            : undefined,
          timestamp: data.timestamp || Date.now(),
        };

        const finalizedEntry: JournalInteraction = {
          ...baseEntry,
          messages: [...updatedMessages, modelMsg],
          summary: data.summary || baseEntry.summary,
          themes: Array.isArray(data.themes) ? data.themes : baseEntry.themes,
          analysis: data.analysis || baseEntry.analysis,
          modelUsed: data.modelUsed,
          updatedAt: Date.now(),
        };

        pendingSaveRef.current = finalizedEntry;
        await saveInteractionToFirestore(currentUser.uid, finalizedEntry);
        pendingSaveRef.current = null;
      } catch (err: any) {
        console.error("Gemini conversation error:", err);
        setSaveError(err.message || "Failed to complete Gemini reflection. Your journal entry was safely preserved.");
      } finally {
        setIsGenerating(false);
      }
    },
    [currentUser, activeInteractionId, interactions]
  );

  const handleSaveInteraction = useCallback(
    async (entry: JournalInteraction) => {
      if (!currentUser?.uid) return;
      setIsSaving(true);
      setSaveError(null);
      pendingSaveRef.current = entry;

      try {
        await saveInteractionToFirestore(currentUser.uid, entry);
        setActiveInteractionId(entry.id);
        setQuickDraftText("");
        setQuickDraftMood(undefined);
        pendingSaveRef.current = null;
      } catch (err: any) {
        console.error("Save interaction error:", err);
        setSaveError(err.message || "Failed to save journal note.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [currentUser?.uid]
  );

  const handleUpdateTitle = useCallback(
    (title: string) => {
      if (!currentUser?.uid || !activeInteractionId) return;
      const target = interactions.find((it) => it.id === activeInteractionId);
      if (target) {
        saveInteractionToFirestore(currentUser.uid, { ...target, title, updatedAt: Date.now() });
      }
    },
    [currentUser?.uid, activeInteractionId, interactions]
  );

  const handleUpdateMode = useCallback(
    (mode: JournalMode) => {
      if (!currentUser?.uid || !activeInteractionId) return;
      const target = interactions.find((it) => it.id === activeInteractionId);
      if (target) {
        saveInteractionToFirestore(currentUser.uid, { ...target, mode, updatedAt: Date.now() });
      }
    },
    [currentUser?.uid, activeInteractionId, interactions]
  );

  const handleUpdateDepth = useCallback(
    (depth: ReflectionDepth) => {
      if (!currentUser?.uid || !activeInteractionId) return;
      const target = interactions.find((it) => it.id === activeInteractionId);
      if (target) {
        saveInteractionToFirestore(currentUser.uid, { ...target, depth, updatedAt: Date.now() });
      }
    },
    [currentUser?.uid, activeInteractionId, interactions]
  );

  const handleDeleteInteraction = useCallback(
    async (interactionId: string) => {
      if (!currentUser?.uid) return;
      try {
        await deleteInteractionFromFirestore(currentUser.uid, interactionId);
        if (activeInteractionId === interactionId) {
          const remaining = interactions.filter((it) => it.id !== interactionId);
          setActiveInteractionId(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (err: any) {
        console.error("Delete interaction error:", err);
      }
    },
    [currentUser?.uid, activeInteractionId, interactions]
  );

  const handleRetrySave = useCallback(async () => {
    if (!pendingSaveRef.current || !currentUser?.uid) return;
    setIsSaving(true);
    try {
      await saveInteractionToFirestore(currentUser.uid, pendingSaveRef.current);
      setSaveError(null);
      pendingSaveRef.current = null;
    } catch (err: any) {
      setSaveError(err.message || "Retry save failed.");
    } finally {
      setIsSaving(false);
    }
  }, [currentUser?.uid]);

  // E. Routine Action Handlers
  const handleSaveRoutine = useCallback(
    async (routine: WellbeingRoutine) => {
      if (!currentUser?.uid) return;
      await saveRoutineToFirestore(currentUser.uid, routine);
    },
    [currentUser?.uid]
  );

  const handleDeleteRoutine = useCallback(
    async (routineId: string) => {
      if (!currentUser?.uid) return;
      await deleteRoutineFromFirestore(currentUser.uid, routineId);
    },
    [currentUser?.uid]
  );

  const handleToggleRoutine = useCallback(
    async (routineId: string) => {
      if (!currentUser?.uid) return;
      const target = routines.find((r) => r.id === routineId);
      if (!target) return;

      const updated: WellbeingRoutine = {
        ...target,
        completedToday: !target.completedToday,
        lastCompletedDate: !target.completedToday ? getTodayDateString() : undefined,
        updatedAt: Date.now(),
      };
      await saveRoutineToFirestore(currentUser.uid, updated);
    },
    [currentUser?.uid, routines]
  );

  // F. Activity Feedback Handler
  const handleSaveActivityFeedback = useCallback(
    async (activity: WellbeingActivity) => {
      if (!currentUser?.uid) return;
      await saveActivityFeedback(currentUser.uid, activity);
    },
    [currentUser?.uid]
  );

  // G. Check-In Handler
  const handleSaveCheckIn = useCallback(
    (checkIn: DailyCheckInState) => {
      if (!currentUser?.uid) return;
      setTodayCheckIn(checkIn);
      saveLocalCheckIn(currentUser.uid, checkIn);
    },
    [currentUser?.uid]
  );

  // H. Quick Journal routing from Home / Today
  const handleQuickStartJournal = (text: string, mood?: MoodType) => {
    setQuickDraftText(text);
    setQuickDraftMood(mood);
    setActiveInteractionId(null);
    setActiveTab("journal");
  };

  // I. Stored Preference Deletion
  const handleDeletePreferenceItem = async (itemId: string) => {
    if (!currentUser?.uid || !currentUser.profile) return;
    const currentList = currentUser.profile.storedPreferences || [];
    const updatedList = currentList.filter((item) => item.id !== itemId);
    const updatedProfile: UserProfile = {
      ...currentUser.profile,
      storedPreferences: updatedList,
      updatedAt: Date.now(),
    };
    await saveUserProfile(currentUser.uid, updatedProfile);
    setCurrentUser({
      ...currentUser,
      profile: updatedProfile,
    });
  };

  // 1. Initial Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#171513] flex flex-col items-center justify-center text-[#F3EFE8] font-sans">
        <div className="w-10 h-10 border-3 border-[#C89B3C]/30 border-t-[#C89B3C] rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-[#B7AFA7] tracking-wider uppercase">
          Initializing Wellbeing Space...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated Landing Screen
  if (!currentUser) {
    return (
      <LandingView
        onSignInGoogle={handleSignInGoogle}
        onSignInGuest={handleSignInGuest}
        onStartSandbox={handleStartSandbox}
        loading={authLoading}
        errorMessage={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  // 3. Authenticated App Layout
  const storedPrefs = currentUser.profile?.storedPreferences || INITIAL_STORED_PREFERENCES_SEED;

  return (
    <div className="h-screen flex flex-col bg-[#171513] text-[#F3EFE8] overflow-hidden font-sans select-none">
      {/* Onboarding Dialog for first sign-in */}
      {!currentUser.profile?.onboardingCompleted && (
        <OnboardingModal
          user={currentUser}
          onComplete={(profile) => setCurrentUser({ ...currentUser, profile })}
        />
      )}

      {/* Top Header */}
      <Header
        user={currentUser}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onSignOut={handleSignOut}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onOpenCalendarModal={() => setCalendarModalOpen(true)}
        syncStatus={isSaving ? "saving" : saveError ? "error" : "synced"}
      />

      {/* Responsive Navigation */}
      <Navigation
        activeTab={activeTab}
        onNavigate={setActiveTab}
        user={currentUser}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        counts={{
          journalEntries: interactions.length,
          activeRoutines: routines.length,
          savedActivities: activities.filter((a) => a.isSaved).length,
        }}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 flex overflow-hidden relative pb-14 lg:pb-0">
        {activeTab === "today" && (
          <TodayView
            user={currentUser}
            routines={routines}
            activities={activities}
            todayCheckIn={todayCheckIn}
            onSaveCheckIn={handleSaveCheckIn}
            onToggleRoutine={handleToggleRoutine}
            onNavigate={setActiveTab}
            onQuickStartJournal={handleQuickStartJournal}
          />
        )}

        {activeTab === "journal" && (
          <JournalView
            user={currentUser}
            interactions={interactions}
            activeInteractionId={activeInteractionId}
            onSelectInteraction={(id) => {
              setActiveInteractionId(id);
              setQuickDraftText("");
            }}
            onNewEntry={() => {
              setActiveInteractionId(null);
              setQuickDraftText("");
            }}
            onSendMessage={handleSendMessage}
            onSaveEntry={handleSaveInteraction}
            onDeleteEntry={handleDeleteInteraction}
            onUpdateTitle={handleUpdateTitle}
            onUpdateMode={handleUpdateMode}
            onUpdateDepth={handleUpdateDepth}
            onOpenCalendar={() => setCalendarModalOpen(true)}
            isGenerating={isGenerating}
            isSaving={isSaving}
            saveError={saveError}
            onRetrySave={handleRetrySave}
            initialDraftText={quickDraftText}
            initialMood={quickDraftMood}
          />
        )}

        {activeTab === "insights" && (
          <InsightsView
            interactions={interactions}
            storedPreferences={storedPrefs}
            onNavigate={setActiveTab}
            onSelectJournalEntry={(id) => {
              setActiveInteractionId(id);
              setActiveTab("journal");
            }}
            onDeletePreferenceItem={handleDeletePreferenceItem}
          />
        )}

        {activeTab === "activities" && (
          <ActivitiesView
            user={currentUser}
            todayCheckIn={todayCheckIn}
            activities={activities}
            onSaveFeedback={handleSaveActivityFeedback}
            onNavigate={setActiveTab}
            onOpenCalendarModal={() => setCalendarModalOpen(true)}
            onQuickStartJournalWithActivity={(title) => {
              handleQuickStartJournal(`Reflecting on practice: ${title}`);
            }}
          />
        )}

        {activeTab === "planner" && (
          <PlannerView
            user={currentUser}
            routines={routines}
            onSaveRoutine={handleSaveRoutine}
            onDeleteRoutine={handleDeleteRoutine}
            onToggleRoutine={handleToggleRoutine}
            onNavigate={setActiveTab}
            onOpenCalendarModal={() => setCalendarModalOpen(true)}
          />
        )}

        {activeTab === "profile" && (
          <ProfileView
            user={currentUser}
            onUpdateUser={setCurrentUser}
            onSignOut={handleSignOut}
            onDeletePreferenceItem={handleDeletePreferenceItem}
          />
        )}
      </main>

      {/* Global Google Calendar Hub Modal */}
      <CalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
      />
    </div>
  );
}
