import React, { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Calendar,
  Sparkles,
  Check,
  X,
  AlertCircle,
  BellRing,
  ExternalLink,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { AuthUserState, CheckInReminderSetting, GoogleCalendarEvent } from "../types";
import { getStoredToken, requestGoogleCalendarAuth, createGoogleCalendarEvent } from "../googleCalendar";
import { saveUserProfile } from "../firebase";

interface DailyReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUserState;
  onUpdateReminder?: (setting: CheckInReminderSetting) => void;
}

const TIME_PRESETS = [
  { time: "07:30", label: "Early Morning", desc: "Start the day with intention", icon: "🌅" },
  { time: "08:30", label: "Morning Clarity", desc: "Before work or studies", icon: "☕" },
  { time: "12:30", label: "Midday Reset", desc: "Mindful pause & breath", icon: "☀️" },
  { time: "20:00", label: "Evening Reflection", desc: "Unwind & record thoughts", icon: "🌙" },
  { time: "21:30", label: "Bedtime Gratitude", desc: "Peaceful close to the day", icon: "✨" },
];

export const DailyReminderModal: React.FC<DailyReminderModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateReminder,
}) => {
  const currentSetting = user.profile?.dailyReminder || {
    enabled: true,
    time: "20:00",
    label: "Daily Mindful Check-in & Journaling",
    notifyBrowser: true,
    syncGoogleCalendar: false,
  };

  const [enabled, setEnabled] = useState<boolean>(currentSetting.enabled);
  const [reminderTime, setReminderTime] = useState<string>(currentSetting.time || "20:00");
  const [notifyBrowser, setNotifyBrowser] = useState<boolean>(currentSetting.notifyBrowser ?? true);
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState<boolean>(
    currentSetting.syncGoogleCalendar ?? false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const setting = user.profile?.dailyReminder || {
        enabled: true,
        time: "20:00",
        label: "Daily Mindful Check-in & Journaling",
        notifyBrowser: true,
        syncGoogleCalendar: false,
      };
      setEnabled(setting.enabled);
      setReminderTime(setting.time || "20:00");
      setNotifyBrowser(setting.notifyBrowser ?? true);
      setSyncGoogleCalendar(setting.syncGoogleCalendar ?? false);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, user.profile?.dailyReminder]);

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

  const handleRequestBrowserPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setErrorMessage("Desktop/Browser notifications are not supported in this environment.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotifyBrowser(true);
        setSuccessMessage("Browser notification permission granted!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage("Browser notification permission was denied or dismissed.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Could not request notification permissions.");
    }
  };

  const handleTestNotification = () => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("🌱 Mindful Check-in & Journaling", {
        body: "Here is your test reminder. Take 2 minutes to pause, check in with your mind & body, and reflect.",
        icon: "/favicon.ico",
      });
      setTestNotice("Test notification sent to your system notification center!");
    } else {
      setTestNotice("Test reminder: '🌱 Time for your daily mindful check-in & reflection.'");
    }
    setTimeout(() => setTestNotice(null), 3500);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user.uid) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let calEventId = currentSetting.googleCalendarEventId;

      // If user enabled Google Calendar sync, attempt to schedule daily recurring event
      if (syncGoogleCalendar && enabled) {
        let token = getStoredToken();
        if (!token) {
          try {
            const authRes = await requestGoogleCalendarAuth();
            token = authRes.accessToken;
          } catch (authErr: any) {
            console.warn("Calendar auth notice:", authErr);
          }
        }

        if (token) {
          try {
            // Build ISO start time for today with selected HH:mm
            const now = new Date();
            const [hours, minutes] = reminderTime.split(":").map(Number);
            const startDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 20, minutes || 0, 0);
            const endDt = new Date(startDt.getTime() + 15 * 60 * 1000); // 15 mins

            const calEvent = await createGoogleCalendarEvent(token, {
              title: "🌱 Daily Mindful Check-in & Journaling",
              description:
                "Take a 10-15 minute mindful pause to check your mood, energy, and record today's reflection in your Good Health & Wellbeing journal.",
              startTime: startDt.toISOString(),
              endTime: endDt.toISOString(),
              recurrence: ["RRULE:FREQ=DAILY"],
              colorId: "2", // Mindfulness green
              isReminderTask: true,
            });
            calEventId = calEvent.id;
          } catch (calErr: any) {
            console.warn("Could not sync to Google Calendar:", calErr);
          }
        }
      }

      const updatedReminder: CheckInReminderSetting = {
        enabled,
        time: reminderTime,
        label: "Daily Mindful Check-in & Journaling",
        notifyBrowser,
        syncGoogleCalendar,
        googleCalendarEventId: calEventId,
        updatedAt: Date.now(),
      };

      if (user.profile) {
        await saveUserProfile(user.uid, {
          ...user.profile,
          dailyReminder: updatedReminder,
        });
      }

      if (onUpdateReminder) {
        onUpdateReminder(updatedReminder);
      }

      setSuccessMessage("Everyday reminder settings saved successfully!");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save reminder settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#110F0E]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-[#1C1A17] border border-[#38322D] shadow-2xl flex flex-col max-h-[90vh] my-auto text-[#F3EFE8] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-[#2C2723] shrink-0 bg-[#1C1A17]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C89B3C]/15 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-[#F3EFE8]">
                Everyday Check-in & Journaling Reminder
              </h3>
              <p className="text-xs text-[#A69E95]">
                Pick your preferred time to be reminded for your daily reflection and wellness check-in.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A69E95] hover:text-[#F3EFE8] hover:bg-[#2C2723] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#171513] border border-[#38322D]">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-[#F3EFE8]">Enable Daily Reminder</span>
              <p className="text-xs text-[#A69E95]">
                Receive an everyday prompt to log your mood, energy, and mindful thoughts.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#2C2723] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C89B3C]"></div>
            </label>
          </div>

        {enabled && (
          <div className="space-y-4">
            {/* Time Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#C89B3C] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Select Everyday Reminder Time
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-[#171513] border border-[#38322D] text-[#F3EFE8] text-base font-semibold focus:border-[#C89B3C] outline-none cursor-pointer"
                />
                <span className="text-xs text-[#A69E95]">
                  Local time ({Intl.DateTimeFormat().resolvedOptions().timeZone || "browser timezone"})
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-[#A69E95]">Recommended times:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TIME_PRESETS.map((preset) => {
                  const isSelected = reminderTime === preset.time;
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setReminderTime(preset.time)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#C89B3C]/15 border-[#C89B3C] text-[#F3EFE8] ring-1 ring-[#C89B3C]"
                          : "bg-[#171513] border-[#38322D] text-[#A69E95] hover:text-[#F3EFE8] hover:border-[#443D36]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-base">{preset.icon}</span>
                        <span className="font-mono text-[11px] text-[#C89B3C]">{preset.time}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#F3EFE8] mt-1">{preset.label}</span>
                      <span className="text-[10px] text-[#8C847B] line-clamp-1">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-2 pt-2 border-t border-[#2C2723]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A69E95]">
                Delivery Channels
              </span>

              {/* Browser / In-App */}
              <div className="p-3 rounded-xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[#C89B3C]" />
                  <div>
                    <span className="text-xs font-semibold text-[#F3EFE8]">Browser & In-App Prompt</span>
                    <p className="text-[11px] text-[#8C847B]">
                      Alerts you while the application is active in your browser.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {typeof window !== "undefined" &&
                    "Notification" in window &&
                    Notification.permission !== "granted" && (
                      <button
                        type="button"
                        onClick={handleRequestBrowserPermission}
                        className="px-2 py-1 rounded-lg bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-[11px] font-semibold border border-[#38322D] cursor-pointer"
                      >
                        Grant
                      </button>
                    )}
                  <input
                    type="checkbox"
                    checked={notifyBrowser}
                    onChange={(e) => setNotifyBrowser(e.target.checked)}
                    className="w-4 h-4 accent-[#C89B3C] cursor-pointer"
                  />
                </div>
              </div>

              {/* Google Calendar Recurring Event */}
              <div className="p-3 rounded-xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#C89B3C]" />
                  <div>
                    <span className="text-xs font-semibold text-[#F3EFE8]">
                      Sync Daily Event to Google Calendar
                    </span>
                    <p className="text-[11px] text-[#8C847B]">
                      Adds a daily recurring reminder event with alerts on your Google Calendar.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncGoogleCalendar}
                  onChange={(e) => setSyncGoogleCalendar(e.target.checked)}
                  className="w-4 h-4 accent-[#C89B3C] cursor-pointer"
                />
              </div>
            </div>

            {/* Test Reminder Button */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleTestNotification}
                className="text-[11px] text-[#C89B3C] hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Send a quick test reminder
              </button>
              {testNotice && <span className="text-[11px] text-[#6E9A7B]">{testNotice}</span>}
            </div>
          </div>
        )}

        {/* Feedback Notices */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        </div>

        {/* Footer Actions - Pinned */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[#2C2723] bg-[#171513]/95 backdrop-blur-xs shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A69E95] hover:text-[#F3EFE8] hover:bg-[#2C2723] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#C89B3C] hover:bg-[#B58A32] text-[#171513] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
};
