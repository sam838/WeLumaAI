import { LocationTimezoneInfo } from "../types";

const LOCAL_STORAGE_KEY = "gemini_journal_location_info";

/**
 * Curated list of major global timezones and reference cities for quick selection and fallback mapping.
 */
export interface TimezoneOption {
  timezone: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  utcOffset: string;
}

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { timezone: "America/Los_Angeles", city: "Los Angeles", country: "United States", countryCode: "US", region: "California", utcOffset: "UTC-07:00" },
  { timezone: "America/New_York", city: "New York", country: "United States", countryCode: "US", region: "New York", utcOffset: "UTC-04:00" },
  { timezone: "America/Chicago", city: "Chicago", country: "United States", countryCode: "US", region: "Illinois", utcOffset: "UTC-05:00" },
  { timezone: "America/Denver", city: "Denver", country: "United States", countryCode: "US", region: "Colorado", utcOffset: "UTC-06:00" },
  { timezone: "America/Phoenix", city: "Phoenix", country: "United States", countryCode: "US", region: "Arizona", utcOffset: "UTC-07:00" },
  { timezone: "America/Toronto", city: "Toronto", country: "Canada", countryCode: "CA", region: "Ontario", utcOffset: "UTC-04:00" },
  { timezone: "America/Vancouver", city: "Vancouver", country: "Canada", countryCode: "CA", region: "British Columbia", utcOffset: "UTC-07:00" },
  { timezone: "America/Sao_Paulo", city: "São Paulo", country: "Brazil", countryCode: "BR", region: "São Paulo", utcOffset: "UTC-03:00" },
  { timezone: "America/Mexico_City", city: "Mexico City", country: "Mexico", countryCode: "MX", region: "CDMX", utcOffset: "UTC-06:00" },
  { timezone: "Europe/London", city: "London", country: "United Kingdom", countryCode: "GB", region: "England", utcOffset: "UTC+01:00" },
  { timezone: "Europe/Paris", city: "Paris", country: "France", countryCode: "FR", region: "Île-de-France", utcOffset: "UTC+02:00" },
  { timezone: "Europe/Berlin", city: "Berlin", country: "Germany", countryCode: "DE", region: "Berlin", utcOffset: "UTC+02:00" },
  { timezone: "Europe/Amsterdam", city: "Amsterdam", country: "Netherlands", countryCode: "NL", region: "North Holland", utcOffset: "UTC+02:00" },
  { timezone: "Europe/Madrid", city: "Madrid", country: "Spain", countryCode: "ES", region: "Madrid", utcOffset: "UTC+02:00" },
  { timezone: "Europe/Rome", city: "Rome", country: "Italy", countryCode: "IT", region: "Lazio", utcOffset: "UTC+02:00" },
  { timezone: "Europe/Zurich", city: "Zurich", country: "Switzerland", countryCode: "CH", region: "Zurich", utcOffset: "UTC+02:00" },
  { timezone: "Asia/Jakarta", city: "Jakarta", country: "Indonesia", countryCode: "ID", region: "DKI Jakarta", utcOffset: "UTC+07:00" },
  { timezone: "Asia/Makassar", city: "Makassar", country: "Indonesia", countryCode: "ID", region: "South Sulawesi", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Jayapura", city: "Jayapura", country: "Indonesia", countryCode: "ID", region: "Papua", utcOffset: "UTC+09:00" },
  { timezone: "Asia/Singapore", city: "Singapore", country: "Singapore", countryCode: "SG", region: "Singapore", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Kuala_Lumpur", city: "Kuala Lumpur", country: "Malaysia", countryCode: "MY", region: "Federal Territory", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Tokyo", city: "Tokyo", country: "Japan", countryCode: "JP", region: "Kanto", utcOffset: "UTC+09:00" },
  { timezone: "Asia/Seoul", city: "Seoul", country: "South Korea", countryCode: "KR", region: "Seoul", utcOffset: "UTC+09:00" },
  { timezone: "Asia/Bangkok", city: "Bangkok", country: "Thailand", countryCode: "TH", region: "Bangkok", utcOffset: "UTC+07:00" },
  { timezone: "Asia/Hong_Kong", city: "Hong Kong", country: "Hong Kong", countryCode: "HK", region: "Hong Kong", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Taipei", city: "Taipei", country: "Taiwan", countryCode: "TW", region: "Taipei", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Shanghai", city: "Shanghai", country: "China", countryCode: "CN", region: "Shanghai", utcOffset: "UTC+08:00" },
  { timezone: "Asia/Dubai", city: "Dubai", country: "United Arab Emirates", countryCode: "AE", region: "Dubai", utcOffset: "UTC+04:00" },
  { timezone: "Asia/Kolkata", city: "New Delhi / Mumbai", country: "India", countryCode: "IN", region: "Delhi", utcOffset: "UTC+05:30" },
  { timezone: "Asia/Riyadh", city: "Riyadh", country: "Saudi Arabia", countryCode: "SA", region: "Riyadh", utcOffset: "UTC+03:00" },
  { timezone: "Australia/Sydney", city: "Sydney", country: "Australia", countryCode: "AU", region: "New South Wales", utcOffset: "UTC+10:00" },
  { timezone: "Australia/Melbourne", city: "Melbourne", country: "Australia", countryCode: "AU", region: "Victoria", utcOffset: "UTC+10:00" },
  { timezone: "Australia/Perth", city: "Perth", country: "Australia", countryCode: "AU", region: "Western Australia", utcOffset: "UTC+08:00" },
  { timezone: "Pacific/Auckland", city: "Auckland", country: "New Zealand", countryCode: "NZ", region: "Auckland", utcOffset: "UTC+12:00" },
  { timezone: "Africa/Cairo", city: "Cairo", country: "Egypt", countryCode: "EG", region: "Cairo", utcOffset: "UTC+03:00" },
  { timezone: "Africa/Johannesburg", city: "Johannesburg", country: "South Africa", countryCode: "ZA", region: "Gauteng", utcOffset: "UTC+02:00" },
  { timezone: "Africa/Lagos", city: "Lagos", country: "Nigeria", countryCode: "NG", region: "Lagos", utcOffset: "UTC+01:00" },
];

/**
 * Calculates current UTC offset string (e.g. "UTC+07:00" or "UTC-07:00") for a given timezone
 */
export function getUtcOffsetForTimezone(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart && offsetPart.value) {
      // e.g. "GMT-7", "GMT+7", "UTC-7"
      const val = offsetPart.value.replace("GMT", "UTC");
      return val.includes(":") ? val : val.replace(/([+-]\d+)/, "$1:00");
    }
  } catch {
    // Fallback calculation
  }

  // Generic timezone offset calculation
  try {
    const targetDateStr = date.toLocaleString("en-US", { timeZone: timezone });
    const localDateStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const targetDate = new Date(targetDateStr);
    const utcDate = new Date(localDateStr);
    const diffHours = (targetDate.getTime() - utcDate.getTime()) / 3600000;
    const sign = diffHours >= 0 ? "+" : "-";
    const absHours = Math.floor(Math.abs(diffHours));
    const mins = Math.round((Math.abs(diffHours) - absHours) * 60);
    return `UTC${sign}${String(absHours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return "UTC+00:00";
  }
}

/**
 * Get stored location from localStorage if present
 */
export function getStoredLocationInfo(): LocationTimezoneInfo | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.timezone === "string") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to read stored location info:", e);
  }
  return null;
}

/**
 * Save location info to localStorage
 */
export function saveStoredLocationInfo(info: LocationTimezoneInfo): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info));
  } catch (e) {
    console.warn("Failed to save location info:", e);
  }
}

/**
 * Fallback resolver to map IANA timezone (e.g. America/Los_Angeles) to a friendly city and country.
 */
export function resolveLocationFromTimezone(timezone: string): Partial<LocationTimezoneInfo> {
  const match = POPULAR_TIMEZONES.find((t) => t.timezone.toLowerCase() === timezone.toLowerCase());
  if (match) {
    return {
      city: match.city,
      country: match.country,
      region: match.region,
      countryCode: match.countryCode,
      timezone: match.timezone,
      utcOffset: match.utcOffset,
    };
  }

  // Parse generic IANA format: Continent/City (e.g., America/Chicago, Asia/Bangkok)
  const parts = timezone.split("/");
  if (parts.length >= 2) {
    const rawCity = parts[parts.length - 1].replace(/_/g, " ");
    const region = parts[0].replace(/_/g, " ");
    return {
      city: rawCity,
      region,
      country: region,
      timezone,
      utcOffset: getUtcOffsetForTimezone(timezone),
    };
  }

  return {
    city: timezone,
    timezone,
    utcOffset: getUtcOffsetForTimezone(timezone),
  };
}

/**
 * Detects current location and accurate timezone using GPS / Geolocation API,
 * with multi-tier fallbacks to browser timezone, reverse geocoding, and default profiles.
 */
export async function detectLocationAndTimezone(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
}): Promise<LocationTimezoneInfo> {
  // 1. Get default browser/system IANA timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const defaultUtcOffset = getUtcOffsetForTimezone(browserTimezone);
  const defaultResolved = resolveLocationFromTimezone(browserTimezone);

  let result: LocationTimezoneInfo = {
    timezone: browserTimezone,
    utcOffset: defaultUtcOffset,
    city: defaultResolved.city || "Current Location",
    region: defaultResolved.region || "",
    country: defaultResolved.country || "",
    countryCode: defaultResolved.countryCode || "",
    source: "browser_timezone",
    detectedAt: Date.now(),
  };

  // 2. Try Browser Geolocation API
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 8000,
            maximumAge: 60000,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      result.latitude = latitude;
      result.longitude = longitude;
      result.source = "gps";

      // 3. Reverse Geocode Coordinates via fast public reverse client
      try {
        const reverseResp = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (reverseResp.ok) {
          const geoData = await reverseResp.json();
          if (geoData) {
            result.city = geoData.city || geoData.locality || geoData.principalSubdivision || result.city;
            result.region = geoData.principalSubdivision || result.region;
            result.country = geoData.countryName || result.country;
            result.countryCode = geoData.countryCode || result.countryCode;

            // If API returned a specific locality timezone, verify/sync it
            if (geoData.localityInfo?.informative) {
              const tzInfo = geoData.localityInfo.informative.find(
                (item: any) => item.description === "time zone" || item.name?.includes("/")
              );
              if (tzInfo && tzInfo.name) {
                result.timezone = tzInfo.name;
                result.utcOffset = getUtcOffsetForTimezone(tzInfo.name);
              }
            }
          }
        }
      } catch (geoErr) {
        console.warn("Reverse geocode lookup warning (using GPS coordinates):", geoErr);
      }
    } catch (gpsError: any) {
      // Permission denied or timed out; fall back to browser IANA timezone
      console.info("GPS geolocation not granted or unavailable, using system timezone:", gpsError?.message);
    }
  }

  // Cache detected location
  saveStoredLocationInfo(result);
  return result;
}

/**
 * Formats a live clock string for the selected timezone
 */
export function formatLocalTimeForTimezone(timezone: string, date: Date = new Date()): {
  timeStr: string;
  dateStr: string;
  dayOfWeek: string;
  fullReadable: string;
} {
  try {
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });

    return {
      timeStr: timeFormatter.format(date),
      dateStr: dateFormatter.format(date),
      dayOfWeek: dayFormatter.format(date),
      fullReadable: `${dateFormatter.format(date)} • ${timeFormatter.format(date)}`,
    };
  } catch {
    return {
      timeStr: date.toLocaleTimeString(),
      dateStr: date.toLocaleDateString(),
      dayOfWeek: "Today",
      fullReadable: date.toLocaleString(),
    };
  }
}
