export type WellbeingDomain = "mind" | "body" | "life" | "connection";

export type NavigationTab = "today" | "journal" | "insights" | "activities" | "planner" | "profile";

export type JournalMode = "reflection" | "summary" | "brainstorm" | "chat";

export type ReflectionDepth = "quick" | "reflect" | "deep";

export type MoodType =
  | "calm"
  | "joyful"
  | "reflective"
  | "grateful"
  | "energized"
  | "anxious"
  | "drained"
  | "overwhelmed"
  | "neutral";

export interface EmotionalAnalysis {
  primaryEmotion?: string;
  secondaryEmotion?: string;
  intensity?: number;
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  responseStyle?: string;
  topics?: string[];
}

export interface UsageMetadata {
  reflectionMode?: ReflectionDepth;
  modelTier?: "lite" | "standard" | "reasoning";
  inputTokens?: number;
  outputTokens?: number;
  historicalEntriesUsed?: number;
  fallbackUsed?: boolean;
}

export interface SuggestedActivityItem {
  id?: string;
  title: string;
  description: string;
  durationMinutes: number;
  domain: WellbeingDomain;
  reason?: string;
  suggestedTiming?: string;
  targetDate?: string; // YYYY-MM-DD
  targetTime?: string; // HH:mm (24-hour format)
  targetDateTimeISO?: string;
  needsDateClarification?: boolean;
  scheduledEventId?: string;
}

export interface JournalMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  suggestedActivities?: SuggestedActivityItem[];
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  rawText?: string;
  mode: JournalMode;
  depth?: ReflectionDepth;
  domains?: WellbeingDomain[];
  mood?: MoodType | string;
  energy?: number; // 1-5
  stress?: number; // 1-5
  sleepHours?: number;
  tags?: string[];
  messages: JournalMessage[];
  summary?: string;
  themes?: string[];
  analysis?: EmotionalAnalysis;
  modelUsed?: string;
  usage?: UsageMetadata;
  createdAt: number;
  updatedAt: number;
}

export type PersonalizationConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface StoredPreferenceItem {
  id: string;
  category: "interest" | "grounding" | "schedule" | "social" | "distance" | "pattern" | "hypothesis";
  label: string;
  value: string;
  confidence: PersonalizationConfidence;
  source: "explicit_user" | "observed_pattern" | "ai_hypothesis";
  confirmedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface LocationTimezoneInfo {
  timezone: string; // e.g. "America/Los_Angeles", "Asia/Jakarta", "Europe/London"
  utcOffset: string; // e.g. "UTC-07:00", "UTC+07:00"
  formattedOffsetHours?: number; // e.g. -7 or 7
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  source: "gps" | "ip" | "browser_timezone" | "manual";
  detectedAt?: number;
}

export interface UserProfile {
  name?: string;
  dob?: string;
  nationality?: string;
  countryStay?: string;
  province?: string;
  city?: string;
  gender?: string;
  photoURL?: string;
  religion?: string;
  culturalBeliefs?: string;
  timezone?: string;
  locationInfo?: LocationTimezoneInfo;
  primaryGoals?: string[];
  groundingActivities?: string[];
  activityPreferences?: {
    preferredTimes?: string[];
    preferredDays?: string[];
    socialPreference?: "solo" | "small_group" | "community" | "any";
    maxDistanceKm?: number;
    budgetPreference?: "free" | "low" | "moderate" | "flexible";
  };
  storedPreferences?: StoredPreferenceItem[];
  latestCheckIn?: DailyCheckInState;
  onboardingCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AuthUserState {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  profile?: UserProfile | null;
}

export interface WellbeingRoutine {
  id: string;
  userId: string;
  name: string;
  domain: WellbeingDomain;
  timeOfDay: "morning" | "afternoon" | "evening" | "anytime";
  targetTime?: string; // e.g. "07:30"
  durationMinutes: number;
  recurrence: "daily" | "weekdays" | "weekends" | "custom";
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon ...
  reminderEnabled: boolean;
  location?: string;
  completedToday: boolean;
  lastCompletedDate?: string; // "YYYY-MM-DD"
  createdAt: number;
  updatedAt: number;
}

export type ActivityFeedbackType =
  | "interested"
  | "not_interested"
  | "already_do"
  | "too_far"
  | "wrong_time"
  | "dont_recommend_again";

export interface WellbeingActivity {
  id: string;
  title: string;
  domain: WellbeingDomain;
  category: "Mindfulness" | "Movement" | "Nature" | "Creativity" | "Connection" | "Rest";
  description: string;
  reason: string;
  energyRequired: "low" | "medium" | "high";
  durationMinutes: number;
  tags: string[];
  suggestedTiming?: string;
  locationType?: "home" | "outdoors" | "venue";
  feedback?: ActivityFeedbackType;
  isSaved?: boolean;
  isCustomAiGenerated?: boolean;
  updatedAt?: number;
}

export interface DailyCheckInState {
  date: string; // "YYYY-MM-DD"
  mood: MoodType;
  energy: number; // 1 to 5
  stress: number; // 1 to 5
  notes?: string;
  updatedAt: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  hangoutLink?: string;
  colorId?: string;
  status?: string;
  isTaskReminder?: boolean;
  completed?: boolean;
  created?: string;
  updated?: string;
}

export interface CalendarReminderInput {
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isAllDay?: boolean;
  isReminderTask?: boolean;
  colorId?: string;
}

export interface CalendarSyncState {
  isConnected: boolean;
  isConnecting: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}
