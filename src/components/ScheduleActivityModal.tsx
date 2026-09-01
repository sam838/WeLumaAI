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
} from "lucide-react";
import { SuggestedActivityItem, WellbeingDomain } from "../types";
import {
  parseActivityScheduleDateTime,
  formatDateToYYYYMMDD,
  formatTimeToHHMM,
  formatHumanReadable,
} from "../utils/dateParser";

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

  // Initialize or recompute parsed date when modal opens or activity changes
  useEffect(() => {
    if (activity && isOpen) {
      const parsed = parseActivityScheduleDateTime(activity);
      setSelectedDate(parsed.dateString);
      setSelectedTime(parsed.timeString);
      setDuration(parsed.durationMinutes);
      setCustomTitle(activity.title);
      setErrorNotice(null);
    }
  }, [activity, isOpen]);

  if (!isOpen || !activity) return null;

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
      });
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to schedule on Google Calendar.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#211E1B] border border-[#38322D] shadow-2xl p-6 space-y-5 animate-scale-up text-[#F3EFE8]"
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
                Smart date confirmation & time customization
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
