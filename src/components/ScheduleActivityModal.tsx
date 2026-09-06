import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Sparkles,
  X,
  Check,
  CalendarPlus,
  AlertCircle,
  HelpCircle,
  Loader2,
  MapPin,
  ExternalLink,
  Star,
  Search,
  Navigation,
} from "lucide-react";
import { SuggestedActivityItem, WellbeingDomain, RecommendedPlace } from "../types";
import {
  parseActivityScheduleDateTime,
  formatDateToYYYYMMDD,
  formatTimeToHHMM,
  formatHumanReadable,
} from "../utils/dateParser";
import { authenticatedFetch } from "../api";

interface ScheduleActivityModalProps {
  isOpen: boolean;
  activity: SuggestedActivityItem | null;
  timezone?: string;
  locationName?: string;
  onClose: () => void;
  onConfirmSchedule: (params: {
    title: string;
    description: string;
    domain: WellbeingDomain;
    startDate: Date;
    endDate: Date;
    durationMinutes: number;
    reason?: string;
    location?: string;
  }) => Promise<void>;
  isScheduling: boolean;
}

export const ScheduleActivityModal: React.FC<ScheduleActivityModalProps> = ({
  isOpen,
  activity,
  timezone,
  locationName,
  onClose,
  onConfirmSchedule,
  isScheduling,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("10:00");
  const [duration, setDuration] = useState<number>(45);
  const [customTitle, setCustomTitle] = useState<string>("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Google Maps Places state
  const [placesList, setPlacesList] = useState<RecommendedPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<RecommendedPlace | null>(null);
  const [customLocationText, setCustomLocationText] = useState<string>("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState<boolean>(false);
  const [venueSearchInput, setVenueSearchInput] = useState<string>("");

  // Initialize or recompute parsed date & places when modal opens or activity changes
  useEffect(() => {
    if (activity && isOpen) {
      const parsed = parseActivityScheduleDateTime(activity);
      setSelectedDate(parsed.dateString);
      setSelectedTime(parsed.timeString);
      setDuration(parsed.durationMinutes);
      setCustomTitle(activity.title);
      setErrorNotice(null);

      // Handle places
      const initialPlaces = activity.recommendedPlaces || [];
      // Ensure sorted by distance from nearest to furthest
      const sorted = [...initialPlaces].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      setPlacesList(sorted);

      const defaultPlace = activity.selectedPlace || (sorted.length > 0 ? sorted[0] : null);
      setSelectedPlace(defaultPlace);
      if (defaultPlace) {
        setCustomLocationText(`${defaultPlace.name}, ${defaultPlace.address}`);
      } else {
        setCustomLocationText("");
      }
      setVenueSearchInput(activity.venueQuery || "");
    }
  }, [activity, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !activity) return null;

  // Search nearby places on demand
  const handleSearchPlaces = async () => {
    if (!venueSearchInput.trim()) return;
    if (!locationName?.trim()) {
      setErrorNotice("Add a city in Profile or allow location access before searching nearby places.");
      return;
    }
    setErrorNotice(null);
    setIsSearchingPlaces(true);
    try {
      const res = await authenticatedFetch("/api/maps/places-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: venueSearchInput.trim(),
          location: locationName,
          maxResults: 4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.places)) {
          const sorted = data.places.sort(
            (a: RecommendedPlace, b: RecommendedPlace) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
          );
          setPlacesList(sorted);
          if (sorted.length > 0) {
            setSelectedPlace(sorted[0]);
            setCustomLocationText(`${sorted[0].name}, ${sorted[0].address}`);
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorNotice(data.error || "Nearby places could not be loaded. Please retry.");
      }
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Nearby places could not be loaded. Please retry.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleSelectPlace = (place: RecommendedPlace) => {
    setSelectedPlace(place);
    setCustomLocationText(`${place.name}, ${place.address}`);
  };

  // Compute live start & end dates from current form inputs
  let computedStartDate: Date | null = null;
  let computedEndDate: Date | null = null;
  let computedDateHuman = "";

  if (selectedDate && selectedTime) {
    try {
      const [year, month, day] = selectedDate.split("-").map(Number);
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
      if (!isNaN(start.getTime())) {
        computedStartDate = start;
        computedEndDate = new Date(start.getTime() + duration * 60000);
        computedDateHuman = formatHumanReadable(start, timezone);
      }
    } catch {
      // Fallback
    }
  }

  // Quick preset shortcuts
  const applyPreset = (daysFromToday: number, hour: number, minute: number = 0) => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday, hour, minute);
    setSelectedDate(formatDateToYYYYMMDD(target));
    setSelectedTime(formatTimeToHHMM(target));
  };

  // Find next Sunday
  const applyNextSunday = (hour: number = 10, minute: number = 0) => {
    const now = new Date();
    const currentDay = now.getDay();
    let diff = (0 - currentDay + 7) % 7;
    if (diff === 0) diff = 7;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, hour, minute);
    setSelectedDate(formatDateToYYYYMMDD(target));
    setSelectedTime(formatTimeToHHMM(target));
  };

  const handleConfirm = async () => {
    if (!computedStartDate || !computedEndDate || isNaN(computedStartDate.getTime())) {
      setErrorNotice("Please select a valid date and time.");
      return;
    }

    const finalLocation =
      customLocationText.trim() ||
      (selectedPlace ? `${selectedPlace.name}, ${selectedPlace.address}` : undefined);

    try {
      setErrorNotice(null);
      await onConfirmSchedule({
        title: customTitle.trim() || activity.title,
        description: activity.description,
        domain: activity.domain,
        startDate: computedStartDate,
        endDate: computedEndDate,
        durationMinutes: duration,
        reason: activity.reason,
        location: finalLocation,
      });
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to schedule on Google Calendar.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl bg-[#211E1B] border border-[#38322D] shadow-2xl p-6 space-y-5 animate-scale-up text-[#F3EFE8] my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#38322D]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C89B3C]/15 border border-[#C89B3C]/40 flex items-center justify-center text-[#C89B3C] shrink-0 shadow-xs">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F3EFE8]">
                Schedule with Google Calendar
              </h3>
              <p className="text-xs text-[#B7AFA7]">
                Smart date confirmation, venue discovery & time customization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#7A746E] hover:text-[#F3EFE8] hover:bg-[#171513] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Activity Summary Card */}
        <div className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C89B3C]/20 text-[#C89B3C] border border-[#C89B3C]/30">
              {activity.domain}
            </span>
            {activity.suggestedTiming && (
              <span className="text-[11px] text-[#B7AFA7] font-medium">
                • Suggested for: <strong className="text-[#F3EFE8]">{activity.suggestedTiming}</strong>
              </span>
            )}
          </div>

          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full text-sm font-bold bg-transparent border-b border-transparent focus:border-[#C89B3C] outline-hidden text-[#F3EFE8] py-0.5"
            placeholder="Activity Title"
          />

          <p className="text-xs text-[#B7AFA7] leading-relaxed">
            {activity.description}
          </p>

          {activity.reason && (
            <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-[#C89B3C]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{activity.reason}</span>
            </div>
          )}
        </div>

        {/* Google Maps / Nearest Venues Section */}
        <div className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#C89B3C]" />
              <label className="text-xs font-bold text-[#F3EFE8]">
                Location & Recommended Venues
              </label>
            </div>
            <span className="text-[10px] text-[#B7AFA7] bg-[#211E1B] px-2 py-0.5 rounded-md border border-[#38322D]">
              {locationName ? `Near ${locationName}` : "Location required"}
            </span>
          </div>

          {/* Quick search input to find other places */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A746E]" />
              <input
                type="text"
                value={venueSearchInput}
                onChange={(e) => setVenueSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchPlaces()}
                placeholder="Search swimming pool, badminton court, gym..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#211E1B] border border-[#38322D] text-xs text-[#F3EFE8] placeholder-[#7A746E] focus:border-[#C89B3C] focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchPlaces}
              disabled={isSearchingPlaces || !venueSearchInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] border border-[#C89B3C]/30 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isSearchingPlaces ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Navigation className="w-3 h-3" />
              )}
              <span>Find</span>
            </button>
          </div>

          {/* List of 3-4 nearest places sorted from nearest to furthest */}
          {placesList.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-[#B7AFA7] font-medium flex items-center gap-1">
                <span>Nearest venues (sorted by distance):</span>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {placesList.map((place) => {
                  const isSelected = selectedPlace?.id === place.id;
                  return (
                    <div
                      key={place.id}
                      onClick={() => handleSelectPlace(place)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                        isSelected
                          ? "bg-[#C89B3C]/10 border-[#C89B3C] text-[#F3EFE8] shadow-xs"
                          : "bg-[#211E1B] border-[#38322D] hover:border-[#4E463E] text-[#B7AFA7]"
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#F3EFE8] truncate">
                            {place.name}
                          </span>
                          {place.distanceKm !== undefined && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#2C2723] text-[#C89B3C] border border-[#C89B3C]/30 shrink-0">
                              {place.distanceKm} km away
                            </span>
                          )}
                          {place.rating !== undefined && (
                            <span className="text-[10px] text-[#E6E1D8] flex items-center gap-0.5 shrink-0">
                              <Star className="w-3 h-3 fill-[#C89B3C] text-[#C89B3C]" />
                              <span>{place.rating}</span>
                              {place.userRatingsTotal && (
                                <span className="text-[#7A746E]">({place.userRatingsTotal})</span>
                              )}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#B7AFA7] truncate">
                          {place.address}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {place.googleMapsUrl && (
                          <a
                            href={place.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-[#7A746E] hover:text-[#C89B3C] hover:bg-[#2C2723] transition-colors"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-[#C89B3C] bg-[#C89B3C] text-[#171513]"
                              : "border-[#4E463E] bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location field to save on Google Calendar */}
          <div className="pt-1">
            <label className="block text-[11px] font-semibold text-[#B7AFA7] mb-1">
              Google Calendar Location Field
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#C89B3C]" />
              <input
                type="text"
                value={customLocationText}
                onChange={(e) => {
                  setCustomLocationText(e.target.value);
                  setSelectedPlace(null);
                }}
                placeholder="e.g. Kolam Renang Manyar, Jl. Raya Manyar No. 80, Surabaya"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#211E1B] border border-[#38322D] focus:border-[#C89B3C] text-xs text-[#F3EFE8] outline-hidden"
              />
            </div>
            <p className="text-[10px] text-[#7A746E] mt-1">
              This address will be stored directly inside the Google Calendar event location.
            </p>
          </div>
        </div>

        {/* Interactive Clarification Question / Smart Date Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#F3EFE8] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>What date and time works for you?</span>
            </label>
            <div className="flex items-center gap-2">
              {timezone && (
                <span className="text-[10px] text-[#B7AFA7] bg-[#171513] px-2 py-0.5 rounded-md border border-[#38322D]" title="Detected location & timezone">
                  📍 {locationName ? `${locationName} • ` : ""}{timezone}
                </span>
              )}
              {computedDateHuman && (
                <span className="text-[11px] text-[#6E9A7B] font-semibold">
                  ✓ {computedDateHuman}
                </span>
              )}
            </div>
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyNextSunday(10, 0)}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] border border-[#C89B3C]/30 transition-all cursor-pointer"
            >
              🗓️ This Sunday (10:00 AM)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(1, 9, 0)}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#2C2723] hover:bg-[#38322D] text-[#E6E1D8] border border-[#38322D] transition-all cursor-pointer"
            >
              🌅 Tomorrow Morning (9:00 AM)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(0, 18, 30)}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#2C2723] hover:bg-[#38322D] text-[#E6E1D8] border border-[#38322D] transition-all cursor-pointer"
            >
              🌆 Today Evening (6:30 PM)
            </button>
          </div>

          {/* Date & Time Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-[#B7AFA7] mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171513] border border-[#38322D] focus:border-[#C89B3C] text-sm text-[#F3EFE8] outline-hidden cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#B7AFA7] mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171513] border border-[#38322D] focus:border-[#C89B3C] text-sm text-[#F3EFE8] outline-hidden cursor-pointer"
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-[#B7AFA7] mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>Duration</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    duration === mins
                      ? "bg-[#C89B3C] text-[#171513] font-bold shadow-xs"
                      : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D]"
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {errorNotice && (
          <div className="p-3 rounded-xl bg-[#3B1E1E] border border-[#5E2B2B] text-[#F8B4B4] text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E57373]" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#38322D]">
          <button
            type="button"
            onClick={onClose}
            disabled={isScheduling}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isScheduling || !computedStartDate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isScheduling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scheduling with Google...</span>
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4" />
                <span>Confirm & Add to Calendar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
