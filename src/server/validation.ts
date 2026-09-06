import { z } from "zod";

const shortText = z.string().trim().max(200);
const mediumText = z.string().trim().max(2_000);
const longText = z.string().trim().max(10_000);
const stringList = z.array(shortText).max(30);

const locationSchema = z
  .object({
    timezone: shortText.optional(),
    utcOffset: shortText.optional(),
    formattedOffsetHours: z.number().finite().min(-24).max(24).optional(),
    city: shortText.optional(),
    region: shortText.optional(),
    country: shortText.optional(),
    countryCode: shortText.optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    source: z.enum(["gps", "ip", "browser_timezone", "manual"]).optional(),
    detectedAt: z.number().finite().optional(),
  })
  .strict();

const checkInSchema = z
  .object({
    date: shortText.optional(),
    mood: shortText.optional(),
    energy: z.number().finite().min(1).max(5).optional(),
    stress: z.number().finite().min(1).max(5).optional(),
    notes: mediumText.optional(),
    updatedAt: z.number().finite().optional(),
  })
  .strict();

const storedPreferenceSchema = z
  .object({
    id: shortText,
    category: shortText,
    label: shortText,
    value: mediumText,
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    source: z.enum(["explicit_user", "observed_pattern", "ai_hypothesis"]),
    confirmedAt: z.number().finite().optional(),
    createdAt: z.number().finite(),
    updatedAt: z.number().finite().optional(),
  })
  .strict();

const userProfileSchema = z
  .object({
    name: shortText.optional(),
    dob: shortText.optional(),
    nationality: shortText.optional(),
    countryStay: shortText.optional(),
    province: shortText.optional(),
    city: shortText.optional(),
    gender: shortText.optional(),
    photoURL: z.string().trim().max(2_000).optional(),
    religion: shortText.optional(),
    culturalBeliefs: mediumText.optional(),
    timezone: shortText.optional(),
    locationInfo: locationSchema.optional(),
    primaryGoals: stringList.optional(),
    groundingActivities: stringList.optional(),
    activityPreferences: z
      .object({
        preferredTimes: stringList.optional(),
        preferredDays: stringList.optional(),
        socialPreference: z.enum(["solo", "small_group", "community", "any"]).optional(),
        maxDistanceKm: z.number().finite().min(0).max(1_000).optional(),
        budgetPreference: z.enum(["free", "low", "moderate", "flexible"]).optional(),
      })
      .strict()
      .optional(),
    storedPreferences: z.array(storedPreferenceSchema).max(100).optional(),
    latestCheckIn: checkInSchema.optional(),
    dailyReminder: z.record(z.string(), z.unknown()).optional(),
    onboardingCompleted: z.boolean().optional(),
    createdAt: z.number().finite().optional(),
    updatedAt: z.number().finite().optional(),
  })
  .strict();

const historyMessageSchema = z
  .object({
    role: z.enum(["user", "model", "assistant"]),
    text: longText,
  })
  .strict();

const journalEntrySchema = z
  .object({
    createdAt: z.number().finite().optional(),
    date: shortText.optional(),
    title: shortText.optional(),
    mood: shortText.optional(),
    energy: z.number().finite().min(1).max(5).optional(),
    stress: z.number().finite().min(1).max(5).optional(),
    summary: mediumText.optional(),
    rawText: longText.optional(),
    snippet: mediumText.optional(),
    themes: stringList.optional(),
    messages: z.array(historyMessageSchema).max(50).optional(),
  })
  .strict();

export const reflectRequestSchema = z
  .object({
    prompt: longText.min(1),
    mode: shortText.optional(),
    style: shortText.optional(),
    depth: z.enum(["quick", "reflect", "deep"]).optional(),
    history: z.array(historyMessageSchema).max(20).optional(),
    recentHistory: z.array(historyMessageSchema).max(20).optional(),
    pastEntries: z.array(journalEntrySchema).max(20).optional(),
    title: shortText.optional(),
    entryTitle: shortText.optional(),
    userProfile: userProfileSchema.nullable().optional(),
    checkIn: checkInSchema.nullable().optional(),
    clientNow: shortText.optional(),
    clientTimezone: shortText.optional(),
    clientLocation: locationSchema.nullable().optional(),
    location: locationSchema.nullable().optional(),
  })
  .strict();

const calendarEventSchema = z
  .object({
    summary: shortText.optional(),
    start: z
      .object({ dateTime: shortText.optional(), date: shortText.optional() })
      .strict()
      .optional(),
  })
  .strict();

export const recommendActivitiesRequestSchema = z
  .object({
    prompt: mediumText.optional(),
    condition: mediumText.optional(),
    userProfile: userProfileSchema.nullable().optional(),
    weeklyEvents: z.array(calendarEventSchema).max(50).optional(),
    checkIn: checkInSchema.nullable().optional(),
    clientLocation: locationSchema.nullable().optional(),
    clientTimezone: shortText.optional(),
  })
  .strict();

export const inquiryRequestSchema = z
  .object({
    query: mediumText.min(1),
    journalHistory: z.array(journalEntrySchema).max(20).optional(),
    checkIn: checkInSchema.nullable().optional(),
    userProfile: userProfileSchema.nullable().optional(),
    clientTimezone: shortText.optional(),
  })
  .strict();

export const placesSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(150),
    location: z.string().trim().max(150).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    maxResults: z.number().int().min(1).max(10).optional(),
  })
  .strict()
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "Latitude and longitude must be supplied together.",
  });

export const metadataOutputSchema = z
  .object({
    summary: mediumText.optional(),
    themes: stringList.optional(),
    primaryEmotion: shortText.optional(),
    intensity: z.number().finite().min(0).max(10).optional(),
    sentiment: z.enum(["positive", "neutral", "negative", "mixed"]).optional(),
    analysis: z.record(z.string(), z.unknown()).optional(),
    suggestedActivities: z.array(z.record(z.string(), z.unknown())).max(8).optional(),
  })
  .strict();

export const recommendationOutputSchema = z
  .object({
    summaryReasoning: mediumText,
    recommendations: z
      .array(
        z
          .object({
            id: shortText,
            title: shortText,
            domain: z.enum(["mind", "body", "life", "connection"]),
            category: z.enum(["Mindfulness", "Movement", "Nature", "Creativity", "Connection", "Rest"]),
            description: mediumText,
            reason: mediumText,
            energyRequired: z.enum(["low", "medium", "high"]),
            durationMinutes: z.number().int().min(1).max(1_440),
            tags: stringList,
            suggestedTiming: shortText.optional(),
            locationType: z.enum(["home", "outdoors", "venue"]).optional(),
          })
          .strict()
      )
      .min(1)
      .max(4),
  })
  .strict();

/**
 * Firestore and form state may represent an unfilled optional field as null.
 * Omit those object properties before strict validation while preserving null
 * array elements so malformed lists are still rejected by their schemas.
 */
export function normalizeOptionalRequestFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeOptionalRequestFields(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, normalizeOptionalRequestFields(item)])
    );
  }
  return value;
}

export function safePromptData(value: unknown, maxLength = 20_000): string {
  const serialized = JSON.stringify(value ?? null).slice(0, maxLength);
  return serialized.replace(/[<>]/g, (character) => (character === "<" ? "\\u003c" : "\\u003e"));
}
