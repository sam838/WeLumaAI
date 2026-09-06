import { GoogleCalendarEvent, CalendarReminderInput } from "./types";

const googleClientId =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  (import.meta as any).env?.VITE_FIREBASE_OAUTH_CLIENT_ID ||
  "";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token: string;
              expires_in: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const LOCAL_REMINDERS_KEY = "gemini_journal_local_reminders";
let inMemoryAccessToken: string | null = null;
let inMemoryTokenExpiresAt = 0;

export function getStoredToken(): string | null {
  if (inMemoryAccessToken && Date.now() < inMemoryTokenExpiresAt - 60_000) {
    return inMemoryAccessToken;
  }
  clearStoredToken();
  return null;
}

export function saveStoredToken(token: string, expiresInSeconds: number) {
  inMemoryAccessToken = token;
  inMemoryTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearStoredToken() {
  inMemoryAccessToken = null;
  inMemoryTokenExpiresAt = 0;
}

export async function requestGoogleCalendarAuth(
  clientId?: string
): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
      return reject(
        new Error(
          "Google Identity Services (GSI) script is still loading. Please check your internet connection or try again in a few seconds."
        )
      );
    }

    const effectiveClientId = clientId || googleClientId || "";

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: effectiveClientId,
      scope:
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.error) {
          reject(
            new Error(
              response.error_description ||
                `Google OAuth Error: ${response.error}`
            )
          );
          return;
        }
        if (!response.access_token) {
          reject(new Error("No access token returned by Google OAuth."));
          return;
        }
        saveStoredToken(response.access_token, response.expires_in || 3600);
        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in || 3600,
        });
      },
      error_callback: (err) => {
        reject(new Error(err?.message || "Google OAuth client error occurred."));
      },
    });

    client.requestAccessToken({ prompt: "consent" });
  });
}

// 1. Fetch Today's Events & Tasks
export async function fetchTodayEventsFromApi(
  token: string,
  userDate?: Date
): Promise<GoogleCalendarEvent[]> {
  const targetDate = userDate || new Date();
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0
  ).toISOString();
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    startOfDay
  )}&timeMax=${encodeURIComponent(
    endOfDay
  )}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
      throw new Error("Calendar authentication expired. Please reconnect.");
    }
    const errText = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.items || []).map((it: any) => formatApiEvent(it));
}

// 1b. Fetch This Week's Events & Activities
export async function fetchWeekEventsFromApi(
  token: string,
  referenceDate?: Date
): Promise<GoogleCalendarEvent[]> {
  const target = referenceDate || new Date();
  const day = target.getDay();
  // Get start of week (Sunday or Monday, let's do Sunday)
  const startOfWeek = new Date(target);
  startOfWeek.setDate(target.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    startOfWeek.toISOString()
  )}&timeMax=${encodeURIComponent(
    endOfWeek.toISOString()
  )}&singleEvents=true&orderBy=startTime&maxResults=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
      throw new Error("Calendar authentication expired. Please reconnect.");
    }
    const errText = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.items || []).map((it: any) => formatApiEvent(it));
}

// 2. Fetch Full Calendar Month Events
export async function fetchMonthEventsFromApi(
  token: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 11 = Dec)
): Promise<GoogleCalendarEvent[]> {
  // Start of previous week to buffer edge days
  const startDate = new Date(year, month, 1, 0, 0, 0);
  startDate.setDate(startDate.getDate() - 7);

  // End of next week to buffer edge days
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  endDate.setDate(endDate.getDate() + 7);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    startDate.toISOString()
  )}&timeMax=${encodeURIComponent(
    endDate.toISOString()
  )}&singleEvents=true&orderBy=startTime&maxResults=250`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
      throw new Error("Calendar authentication expired. Please reconnect.");
    }
    const errText = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.items || []).map((it: any) => formatApiEvent(it));
}

// 3. Create a New Calendar Event / Reminder Task
export async function createGoogleCalendarEvent(
  token: string,
  input: CalendarReminderInput
): Promise<GoogleCalendarEvent> {
  const payload: any = {
    summary: input.title,
    description: input.description || "",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 10 },
        { method: "popup", minutes: 30 },
      ],
    },
  };

  if (input.colorId) {
    payload.colorId = input.colorId;
  }

  if (input.location) {
    payload.location = input.location;
  }

  if (input.recurrence && input.recurrence.length > 0) {
    payload.recurrence = input.recurrence;
  }

  if (input.isAllDay) {
    payload.start = { date: input.startTime.split("T")[0] };
    payload.end = { date: input.endTime.split("T")[0] };
  } else {
    payload.start = { dateTime: input.startTime };
    payload.end = { dateTime: input.endTime };
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
      throw new Error("Calendar authentication expired. Please reconnect.");
    }
    const errText = await res.text();
    throw new Error(`Failed to create calendar event: ${errText}`);
  }

  const item = await res.json();
  return formatApiEvent(item);
}

// 4. Delete an Event
export async function deleteGoogleCalendarEvent(
  token: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      eventId
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errText = await res.text();
    throw new Error(`Failed to delete calendar event: ${errText}`);
  }
}

function formatApiEvent(it: any): GoogleCalendarEvent {
  const summary = it.summary || "(No Title)";
  const isTaskReminder =
    summary.toLowerCase().includes("reminder") ||
    summary.toLowerCase().includes("reflect") ||
    summary.toLowerCase().includes("journal") ||
    summary.toLowerCase().includes("meditat") ||
    summary.toLowerCase().includes("task") ||
    summary.toLowerCase().includes("check-in");

  return {
    id: it.id,
    summary,
    description: it.description || "",
    location: it.location || "",
    start: it.start || {},
    end: it.end || {},
    htmlLink: it.htmlLink || "",
    hangoutLink: it.hangoutLink || "",
    colorId: it.colorId || "default",
    status: it.status || "confirmed",
    isTaskReminder,
    completed: false,
    created: it.created,
    updated: it.updated,
  };
}

// Local Reminders Store for Offline / Guest fallback
export function getLocalReminders(): GoogleCalendarEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_REMINDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load local reminders:", e);
  }
  return [];
}

export function saveLocalReminders(reminders: GoogleCalendarEvent[]) {
  try {
    localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.error("Failed to save local reminders:", e);
  }
}

export function generateDefaultMindfulSchedule(now: Date = new Date()): GoogleCalendarEvent[] {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return [
    {
      id: "demo-evt-1",
      summary: "🌅 Morning Mindful Reflection & Intention Setting",
      description: "Take 5 minutes to ground yourself, journal three gratitude points, and align today's focus with your core values.",
      start: { dateTime: `${dateStr}T08:30:00.000Z` },
      end: { dateTime: `${dateStr}T08:45:00.000Z` },
      isTaskReminder: true,
      colorId: "2", // Sage
      completed: false,
      status: "confirmed",
    },
    {
      id: "demo-evt-2",
      summary: "🧘 Midday Reset & Deep Breathing",
      description: "Step away from screens, hydrate, and complete a 4-7-8 diaphragmatic breathing circuit.",
      start: { dateTime: `${dateStr}T13:00:00.000Z` },
      end: { dateTime: `${dateStr}T13:15:00.000Z` },
      isTaskReminder: true,
      colorId: "5", // Gold
      completed: false,
      status: "confirmed",
    },
    {
      id: "demo-evt-3",
      summary: "📖 Evening Journal Reflection with Gemini",
      description: "Review today's accomplishments, log challenges, and synthesize cognitive takeaways in your private journal.",
      start: { dateTime: `${dateStr}T20:30:00.000Z` },
      end: { dateTime: `${dateStr}T21:00:00.000Z` },
      isTaskReminder: true,
      colorId: "1", // Lavender
      completed: false,
      status: "confirmed",
    },
  ];
}
