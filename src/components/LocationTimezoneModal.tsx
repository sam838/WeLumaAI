import React, { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  Compass,
  Search,
  Check,
  X,
  RefreshCw,
  Globe,
  Navigation,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { LocationTimezoneInfo } from "../types";
import {
  POPULAR_TIMEZONES,
  detectLocationAndTimezone,
  formatLocalTimeForTimezone,
  saveStoredLocationInfo,
  getUtcOffsetForTimezone,
} from "../services/locationService";

interface LocationTimezoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationTimezoneInfo;
  onUpdateLocation: (newLocation: LocationTimezoneInfo) => void;
}

export const LocationTimezoneModal: React.FC<LocationTimezoneModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onUpdateLocation,
}) => {
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveTime, setLiveTime] = useState(formatLocalTimeForTimezone(currentLocation.timezone));
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Keep live clock running
  useEffect(() => {
    if (!isOpen) return;
    setLiveTime(formatLocalTimeForTimezone(currentLocation.timezone));
    const interval = setInterval(() => {
      setLiveTime(formatLocalTimeForTimezone(currentLocation.timezone));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentLocation.timezone]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDetectGps = async () => {
    setIsDetectingGps(true);
    setStatusMessage(null);
    try {
      const detected = await detectLocationAndTimezone({ enableHighAccuracy: true, timeout: 10000 });
      onUpdateLocation(detected);
      saveStoredLocationInfo(detected);
      setStatusMessage({
        text: detected.source === "gps"
          ? `📍 Accurately detected via GPS: ${detected.city || "Current City"}, ${detected.country || ""}`
          : `🌐 Detected system timezone: ${detected.timezone} (${detected.utcOffset})`,
      });
    } catch (err: any) {
      console.error("GPS detection error:", err);
      setStatusMessage({
        text: "Could not access GPS. Please ensure location permissions are allowed in your browser.",
        isError: true,
      });
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleSelectTimezone = (tzOption: typeof POPULAR_TIMEZONES[0]) => {
    const updated: LocationTimezoneInfo = {
      timezone: tzOption.timezone,
      utcOffset: tzOption.utcOffset || getUtcOffsetForTimezone(tzOption.timezone),
      city: tzOption.city,
      region: tzOption.region,
      country: tzOption.country,
      countryCode: tzOption.countryCode,
      source: "manual",
      detectedAt: Date.now(),
    };
    onUpdateLocation(updated);
    saveStoredLocationInfo(updated);
    setStatusMessage({
      text: `Selected ${tzOption.city}, ${tzOption.country} (${tzOption.utcOffset})`,
    });
  };

  const filteredTimezones = POPULAR_TIMEZONES.filter((tz) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      tz.city.toLowerCase().includes(q) ||
      tz.country.toLowerCase().includes(q) ||
      tz.region.toLowerCase().includes(q) ||
      tz.timezone.toLowerCase().includes(q) ||
      tz.utcOffset.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#211E1B] border border-[#38322D] shadow-2xl p-6 space-y-5 animate-scale-up text-[#F3EFE8] max-h-[90vh] my-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#38322D] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C89B3C]/15 border border-[#C89B3C]/40 flex items-center justify-center text-[#C89B3C] shrink-0 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F3EFE8]">
                Location & Timezone Detector
              </h3>
              <p className="text-xs text-[#B7AFA7]">
                Synchronizes AI reflections, prompts & Calendar planning with your position
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

        {/* Current Active Location Card with Live Clock */}
        <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B7AFA7] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>Current Position & Timezone</span>
            </span>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                currentLocation.source === "gps"
                  ? "bg-[#6E9A7B]/20 text-[#6E9A7B] border border-[#6E9A7B]/40"
                  : currentLocation.source === "manual"
                  ? "bg-[#C89B3C]/20 text-[#C89B3C] border border-[#C89B3C]/40"
                  : "bg-[#7A746E]/20 text-[#B7AFA7] border border-[#38322D]"
              }`}
            >
              {currentLocation.source === "gps"
                ? "🎯 GPS Precise"
                : currentLocation.source === "manual"
                ? "📍 Custom Selected"
                : "🌐 Device Timezone"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div>
              <h4 className="text-base font-bold text-[#F3EFE8]">
                {currentLocation.city || "Detected City"}
                {currentLocation.country ? `, ${currentLocation.country}` : ""}
              </h4>
              <p className="text-xs text-[#B7AFA7] flex items-center gap-1.5 pt-0.5">
                <span>{currentLocation.timezone}</span>
                <span>•</span>
                <span className="text-[#C89B3C] font-semibold">{currentLocation.utcOffset}</span>
                {currentLocation.latitude && currentLocation.longitude && (
                  <>
                    <span>•</span>
                    <span className="text-[10px] text-[#7A746E]">
                      {currentLocation.latitude.toFixed(2)}°, {currentLocation.longitude.toFixed(2)}°
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Live Clock Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#211E1B] border border-[#38322D] shrink-0">
              <Clock className="w-4 h-4 text-[#C89B3C] shrink-0" />
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-[#F3EFE8]">{liveTime.timeStr}</div>
                <div className="text-[10px] text-[#B7AFA7]">{liveTime.dateStr}</div>
              </div>
            </div>
          </div>

          {/* Trigger Auto-Detect Button */}
          <div className="pt-2">
            <button
              id="btn-detect-gps-location"
              type="button"
              onClick={handleDetectGps}
              disabled={isDetectingGps}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isDetectingGps ? "animate-spin" : ""}`} />
              <span>{isDetectingGps ? "Detecting GPS Position & Reverse Geocoding..." : "Detect My Position Automatically (GPS)"}</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in shrink-0 ${
              statusMessage.isError
                ? "bg-[#3B1E1E] border border-[#5E2B2B] text-[#F8B4B4]"
                : "bg-[#1E2E23] border border-[#2B5E38] text-[#B4F8C8]"
            }`}
          >
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#E57373]" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-[#6E9A7B]" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Search / Manual Timezone Picker */}
        <div className="space-y-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#F3EFE8] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>Or Choose a World City & Timezone</span>
            </label>
            <span className="text-[10px] text-[#B7AFA7]">{filteredTimezones.length} locations</span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A746E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, country, or timezone (e.g. Jakarta, Tokyo, London, San Francisco)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#171513] border border-[#38322D] focus:border-[#C89B3C] text-xs text-[#F3EFE8] outline-hidden placeholder:text-[#7A746E]"
            />
          </div>

          {/* Timezone List Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[220px] custom-scrollbar pt-1">
            {filteredTimezones.map((tz) => {
              const isSelected =
                currentLocation.timezone.toLowerCase() === tz.timezone.toLowerCase() ||
                (currentLocation.city && currentLocation.city.toLowerCase() === tz.city.toLowerCase());

              return (
                <button
                  key={tz.timezone + tz.city}
                  type="button"
                  onClick={() => handleSelectTimezone(tz)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#2C2723] border-[#C89B3C] text-[#F3EFE8] shadow-xs"
                      : "bg-[#171513]/70 hover:bg-[#171513] border-[#38322D] text-[#B7AFA7] hover:text-[#F3EFE8]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? "bg-[#C89B3C]" : "bg-[#38322D]"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#F3EFE8] truncate flex items-center gap-1.5">
                        <span>{tz.city}</span>
                        <span className="text-[10px] text-[#B7AFA7] font-normal">• {tz.country}</span>
                      </div>
                      <div className="text-[10px] text-[#7A746E] truncate">{tz.timezone}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono font-medium text-[#C89B3C] px-2 py-0.5 rounded-md bg-[#211E1B] border border-[#38322D]">
                      {tz.utcOffset}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-[#C89B3C]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#38322D] shrink-0">
          <p className="text-[11px] text-[#7A746E]">
            Timezone is automatically applied to all wellbeing reflections & calendar plans.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-xs font-bold text-[#F3EFE8] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
