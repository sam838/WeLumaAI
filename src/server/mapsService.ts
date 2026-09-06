import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { RecommendedPlace } from "../types";

// Mandatory Google Maps Platform attribution header
export const GMP_SOLUTION_ID = "gmp_mcp_codeassist_v1_aistudio";

let secretManagerClient: SecretManagerServiceClient | null = null;
let cachedMapsKey: string | null = null;
let cachedKeySource: "env_var" | "secret_manager" | "none" = "none";
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSecretClient(): SecretManagerServiceClient {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  return secretManagerClient;
}

/**
 * Retrieve Google Maps API key from environment or Secret Manager
 */
export async function getMapsApiKey(): Promise<{ key: string | null; source: string }> {
  // 1. Check process.env first
  if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim()) {
    return { key: process.env.GOOGLE_MAPS_API_KEY.trim(), source: "env_var (GOOGLE_MAPS_API_KEY)" };
  }

  // 2. Check cached key
  const now = Date.now();
  if (cachedMapsKey && now - cacheTimestamp < CACHE_TTL_MS) {
    return { key: cachedMapsKey, source: cachedKeySource };
  }

  // 3. Attempt Secret Manager lookup
  const secretNames = ["GOOGLE_MAPS_API_KEY", "Google_Maps_Api_Key", "Maps_Api_Key", "MAPS_API_KEY"];
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    return { key: null, source: "none" };
  }

  try {
    const client = getSecretClient();
    for (const name of secretNames) {
      try {
        const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`,
        });
        const payload = version.payload?.data?.toString();
        if (payload && payload.trim()) {
          cachedMapsKey = payload.trim();
          cachedKeySource = "secret_manager";
          cacheTimestamp = now;
          return { key: cachedMapsKey, source: `secret_manager (${name})` };
        }
      } catch {
        // try next name
      }
    }
  } catch (err: any) {
    // Secret Manager check completed
  }

  return { key: null, source: "none" };
}

/**
 * Haversine distance formula in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Geocode address or city to coordinates
 */
export async function geocodeLocation(
  address: string,
  apiKey: string
): Promise<{ latitude: number; longitude: number; formattedAddress: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}&solution_id=${GMP_SOLUTION_ID}`;

    const res = await fetch(url);
    if (res.ok) {
      const data: any = await res.json();
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const first = data.results[0];
        return {
          latitude: first.geometry.location.lat,
          longitude: first.geometry.location.lng,
          formattedAddress: first.formatted_address,
        };
      }
    }
  } catch (err) {
    console.warn("Geocoding request failed:", err);
  }

  return null;
}

/**
 * Search nearby places using Google Places API (New) - Text Search
 * Returns 3-4 nearest places sorted by distance (nearest to furthest)
 */
export async function searchNearbyPlaces(params: {
  query: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxResults?: number;
}): Promise<{
  places: RecommendedPlace[];
  userLocation: { latitude: number; longitude: number; address: string };
  source: "places_api_new";
  apiStatus: "active";
  guidance?: string;
}> {
  const { query, locationName = "", radiusMeters = 15000, maxResults = 4 } = params;
  const { key } = await getMapsApiKey();

  if (!key) {
    throw new Error("Google Maps is not configured.");
  }

  // Resolve user coordinates
  let userLat = params.latitude;
  let userLng = params.longitude;
  let resolvedAddress = locationName;

  if (userLat === undefined || userLng === undefined) {
    if (!locationName.trim()) {
      throw new Error("Location permission or a location name is required.");
    }
    const geocoded = await geocodeLocation(locationName, key);
    if (geocoded) {
      userLat = geocoded.latitude;
      userLng = geocoded.longitude;
      resolvedAddress = geocoded.formattedAddress;
    }
  }

  if (userLat === undefined || userLng === undefined) {
    throw new Error("The supplied location could not be verified with Google Maps.");
  }

  const userLocation = { latitude: userLat, longitude: userLng, address: resolvedAddress };

  // Call Google Places API (New) Text Search
  try {
    const placesUrl = "https://places.googleapis.com/v1/places:searchText";
    const requestBody: any = {
      textQuery: `${query} in ${resolvedAddress}`,
      locationBias: {
        circle: {
          center: {
            latitude: userLat,
            longitude: userLng,
          },
          radius: radiusMeters,
        },
      },
      maxResultCount: 10,
    };

    const response = await fetch(placesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.currentOpeningHours.openNow",
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data: any = await response.json();
      if (Array.isArray(data.places) && data.places.length > 0) {
        // Calculate distance to each place and sort from nearest to furthest
        const mappedPlaces: RecommendedPlace[] = data.places
          .filter((p: any) => p && p.displayName && p.displayName.text)
          .map((p: any) => {
            const pLat = p.location?.latitude;
            const pLng = p.location?.longitude;
            let distanceKm: number | undefined = undefined;
            let distanceFormatted = "";

            if (typeof pLat === "number" && typeof pLng === "number") {
              distanceKm = calculateDistanceKm(userLat!, userLng!, pLat, pLng);
              distanceFormatted = `${distanceKm} km away`;
            }

            const uri =
              p.googleMapsUri ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                p.displayName.text + " " + (p.formattedAddress || "")
              )}&query_place_id=${p.id || ""}`;

            return {
              id: p.id || `place_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: p.displayName.text,
              formattedAddress: p.formattedAddress || "",
              address: p.formattedAddress || "",
              distanceKm,
              distanceFormatted,
              rating: typeof p.rating === "number" ? p.rating : undefined,
              userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
              userRatingsTotal: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
              latitude: pLat,
              longitude: pLng,
              googleMapsUri: uri,
              googleMapsUrl: uri,
              openNow: p.currentOpeningHours?.openNow,
            };
          });

        // Strict sorting from nearest until furthest
        mappedPlaces.sort((a, b) => {
          if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
            return a.distanceKm - b.distanceKm;
          }
          return 0;
        });

        return {
          places: mappedPlaces.slice(0, maxResults),
          userLocation,
          source: "places_api_new",
          apiStatus: "active",
        };
      }
    } else {
      const errorData: any = await response.json().catch(() => ({}));
      const reason = errorData?.error?.details?.[0]?.reason || errorData?.error?.status || "ERROR";

      console.warn(`[Places API] Request rejected: ${reason}`, errorData?.error?.message);

      throw new Error(`Google Places request failed with status ${reason}.`);
    }
  } catch (error: any) {
    console.error("[Places API] Network/Execution error:", error);
  }

  throw new Error("Unable to reach Google Places API.");
}
