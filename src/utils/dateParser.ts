import { SuggestedActivityItem } from "../types";

export interface ParsedScheduleTime {
  startDate: Date;
  endDate: Date;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:mm
  durationMinutes: number;
  isAccurate: boolean;
  explanation: string;
}

/**
 * Intelligent natural language and structured date-time resolver for suggested wellbeing activities.
 * Handles exact YYYY-MM-DD targets, day-of-week phrases ("Sunday 10.00 am", "tomorrow at 4pm", etc.),
 * and provides robust fallbacks with timezone awareness.
 */
export function parseActivityScheduleDateTime(
  act: SuggestedActivityItem,
  referenceNow: Date = new Date()
): ParsedScheduleTime {
  const duration = act.durationMinutes && act.durationMinutes > 0 ? act.durationMinutes : 45;
  const now = new Date(referenceNow);

  // 1. Direct explicit ISO date-time provided by AI
  if (act.targetDateTimeISO) {
    const parsedISO = new Date(act.targetDateTimeISO);
    if (!isNaN(parsedISO.getTime())) {
      const end = new Date(parsedISO.getTime() + duration * 60000);
      return {
        startDate: parsedISO,
        endDate: end,
        dateString: formatDateToYYYYMMDD(parsedISO),
        timeString: formatTimeToHHMM(parsedISO),
        durationMinutes: duration,
        isAccurate: true,
        explanation: `Scheduled for ${formatHumanReadable(parsedISO)}`,
      };
    }
  }

  // 2. Explicit targetDate (YYYY-MM-DD) and targetTime (HH:mm)
  if (act.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(act.targetDate.trim())) {
    const timePart = act.targetTime && /^\d{1,2}:\d{2}$/.test(act.targetTime.trim())
      ? act.targetTime.trim()
      : "10:00";
    const [year, month, day] = act.targetDate.trim().split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);

    const targetDateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (!isNaN(targetDateObj.getTime())) {
      const end = new Date(targetDateObj.getTime() + duration * 60000);
      return {
        startDate: targetDateObj,
        endDate: end,
        dateString: act.targetDate.trim(),
        timeString: timePart.padStart(5, "0"),
        durationMinutes: duration,
        isAccurate: true,
        explanation: `Calculated date: ${formatHumanReadable(targetDateObj)}`,
      };
    }
  }

  // 3. Natural language parsing from suggestedTiming string (e.g. "Sunday 10.00 am", "Tomorrow 7:00 AM")
  const timingText = (act.suggestedTiming || "").toLowerCase().trim();

  let targetDate = new Date(now);
  let resolvedHour = 10;
  let resolvedMinute = 0;
  let hasSpecificDay = false;

  const dayMap: { [key: string]: number } = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  // Check for day of week mention
  for (const [dayName, dayIndex] of Object.entries(dayMap)) {
    const dayRegex = new RegExp(`\\b${dayName}\\b`, "i");
    if (dayRegex.test(timingText)) {
      const currentDay = now.getDay();
      let dayDiff = (dayIndex - currentDay + 7) % 7;
      if (dayDiff === 0 && (timingText.includes("next") || now.getHours() >= 12)) {
        dayDiff = 7;
      } else if (dayDiff === 0 && !timingText.includes("today")) {
        dayDiff = 7;
      }
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayDiff);
      hasSpecificDay = true;
      break;
    }
  }

  // Check for "tomorrow"
  if (/\btomorrow\b/i.test(timingText)) {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    hasSpecificDay = true;
  }

  // Check for "today" or "this evening" / "tonight"
  if (/\btoday\b/i.test(timingText) || /\btonight\b/i.test(timingText)) {
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    hasSpecificDay = true;
  }

  // Check for time: e.g. "10.00 am", "10:00 am", "4:30 pm", "7pm", "14:00"
  const timeMatch = timingText.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let rawHours = parseInt(timeMatch[1], 10);
    const rawMins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (meridian === "pm" && rawHours < 12) {
      rawHours += 12;
    } else if (meridian === "am" && rawHours === 12) {
      rawHours = 0;
    }

    if (rawHours >= 0 && rawHours <= 23) {
      resolvedHour = rawHours;
      resolvedMinute = Math.min(Math.max(rawMins, 0), 59);
    }
  } else {
    // Keyword based time
    if (/\bmorning\b/i.test(timingText)) {
      resolvedHour = 9;
    } else if (/\bafternoon\b/i.test(timingText)) {
      resolvedHour = 14;
    } else if (/\bevening\b/i.test(timingText) || /\bdinner\b/i.test(timingText)) {
      resolvedHour = 18;
    } else if (/\bnight\b/i.test(timingText)) {
      resolvedHour = 20;
    }
  }

  // If no day was specified and now is late in the evening, default to tomorrow morning
  if (!hasSpecificDay) {
    if (now.getHours() >= 19) {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      resolvedHour = 9;
      resolvedMinute = 0;
    } else {
      targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      resolvedHour = Math.min(now.getHours() + 1, 22);
      resolvedMinute = 0;
    }
  }

  targetDate.setHours(resolvedHour, resolvedMinute, 0, 0);
  const endDate = new Date(targetDate.getTime() + duration * 60000);

  return {
    startDate: targetDate,
    endDate,
    dateString: formatDateToYYYYMMDD(targetDate),
    timeString: formatTimeToHHMM(targetDate),
    durationMinutes: duration,
    isAccurate: hasSpecificDay || !!timeMatch,
    explanation: hasSpecificDay
      ? `Scheduled for ${formatHumanReadable(targetDate)}`
      : `Suggested mindful window: ${formatHumanReadable(targetDate)}`,
  };
}

export function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeToHHMM(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatHumanReadable(d: Date, targetTimezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (targetTimezone) {
    try {
      options.timeZone = targetTimezone;
    } catch {
      // Use default timezone if invalid
    }
  }
  return d.toLocaleDateString("en-US", options);
}
