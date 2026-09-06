import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Tag,
  ListTodo,
  CalendarDays,
  ShieldCheck,
  Video,
  MapPin,
  BellRing,
  Smile,
  Flame,
  Zap,
  Edit3,
} from "lucide-react";
import {
  GoogleCalendarEvent,
  CalendarReminderInput,
  CalendarSyncState,
  AuthUserState,
  DailyCheckInState,
  MoodType,
  CheckInStats,
} from "../types";
import { computeCheckInStats, getTodayDateString } from "../firebase";
import {
  getStoredToken,
  requestGoogleCalendarAuth,
  clearStoredToken,
  fetchTodayEventsFromApi,
  fetchMonthEventsFromApi,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getLocalReminders,
  saveLocalReminders,
  generateDefaultMindfulSchedule,
} from "../googleCalendar";

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertEventToJournal?: (event: GoogleCalendarEvent) => void;
  initialTab?: "today" | "full" | "create";
  user?: AuthUserState;
  checkInsMap?: Record<string, DailyCheckInState>;
  onSaveCheckIn?: (checkIn: DailyCheckInState) => void;
  onOpenReminderModal?: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MOOD_EMOJIS: Record<MoodType, string> = {
  calm: "🌿",
  joyful: "✨",
  reflective: "🌊",
  grateful: "💛",
  energized: "⚡",
  neutral: "☁️",
  anxious: "🍃",
  drained: "🌙",
  overwhelmed: "🌀",
};

const MOOD_OPTIONS: { id: MoodType; label: string; icon: string }[] = [
  { id: "calm", label: "Calm", icon: "🌿" },
  { id: "joyful", label: "Joyful", icon: "✨" },
  { id: "reflective", label: "Reflective", icon: "🌊" },
  { id: "grateful", label: "Grateful", icon: "💛" },
  { id: "energized", label: "Energized", icon: "⚡" },
  { id: "neutral", label: "Neutral", icon: "☁️" },
  { id: "anxious", label: "Anxious", icon: "🍃" },
  { id: "drained", label: "Drained", icon: "🌙" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "🌀" },
];

const EVENT_COLORS: { [key: string]: { bg: string; text: string; border: string; label: string } } = {
  default: { bg: "bg-[#C89B3C]/15", text: "text-[#C89B3C]", border: "border-[#C89B3C]/40", label: "Gold Accent" },
  "1": { bg: "bg-[#738F85]/20", text: "text-[#8CAEA2]", border: "border-[#738F85]/40", label: "Sage Green" },
  "2": { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", label: "Mindfulness" },
  "5": { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/40", label: "Important" },
  "11": { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/40", label: "Focus / Urgent" },
};

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  onInsertEventToJournal,
  initialTab = "today",
  user,
  checkInsMap = {},
  onSaveCheckIn,
  onOpenReminderModal,
}) => {
  const [activeTab, setActiveTab] = useState<"today" | "full" | "create">("today");
  const [syncState, setSyncState] = useState<CalendarSyncState>({
    isConnected: false,
    isConnecting: false,
    accessToken: null,
    expiresAt: null,
    error: null,
  });

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [eventFilter, setEventFilter] = useState<"all" | "reminders" | "meetings">("all");
  const [completedTaskIds, setCompletedTaskIds] = useState<{ [id: string]: boolean }>({});

  // Check-in tracking & inline check-in form state
  const [isCheckingInDate, setIsCheckingInDate] = useState<string | null>(null);
  const [checkInMood, setCheckInMood] = useState<MoodType>("reflective");
  const [checkInEnergy, setCheckInEnergy] = useState<number>(3);
  const [checkInStress, setCheckInStress] = useState<number>(2);
  const [checkInNotes, setCheckInNotes] = useState<string>("");
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);

  const todayStr = useMemo(() => getTodayDateString(), []);
  const selectedDayStr = useMemo(() => {
    const y = selectedDay.getFullYear();
    const m = String(selectedDay.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDay.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDay]);

  const checkInStats: CheckInStats = useMemo(() => {
    return computeCheckInStats(checkInsMap, currentDate);
  }, [checkInsMap, currentDate]);

  const todayCheckIn = checkInsMap[todayStr];
  const selectedDayCheckIn = checkInsMap[selectedDayStr];

  const handleOpenInlineCheckIn = (dateStr: string) => {
    const existing = checkInsMap[dateStr];
    setIsCheckingInDate(dateStr);
    if (existing) {
      setCheckInMood(existing.mood);
      setCheckInEnergy(existing.energy);
      setCheckInStress(existing.stress);
      setCheckInNotes(existing.notes || "");
    } else {
      setCheckInMood("reflective");
      setCheckInEnergy(3);
      setCheckInStress(2);
      setCheckInNotes("");
    }
  };

  const handleSaveInlineCheckIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isCheckingInDate || !onSaveCheckIn) return;
    const item: DailyCheckInState = {
      date: isCheckingInDate,
      mood: checkInMood,
      energy: checkInEnergy,
      stress: checkInStress,
      notes: checkInNotes.trim() || undefined,
      updatedAt: Date.now(),
    };
    onSaveCheckIn(item);
    setCheckInNotice(`Check-in recorded for ${isCheckingInDate}!`);
    setIsCheckingInDate(null);
    setTimeout(() => setCheckInNotice(null), 3000);
  };

  // New Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newIsAllDay, setNewIsAllDay] = useState(false);
  const [newColorId, setNewColorId] = useState("default");
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Selected event detail modal/popover
  const [viewingEvent, setViewingEvent] = useState<GoogleCalendarEvent | null>(null);

  // Quick reminder preset feedback
  const [quickPresetSuccess, setQuickPresetSuccess] = useState<string | null>(null);

  // 1. Initialize authentication state on load
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    const token = getStoredToken();
    if (token) {
      setSyncState({
        isConnected: true,
        isConnecting: false,
        accessToken: token,
        expiresAt: null,
        error: null,
      });
    } else {
      // Load local sample / stored fallback
      const locals = getLocalReminders();
      if (locals.length > 0) {
        setEvents(locals);
      } else {
        const defaults = generateDefaultMindfulSchedule();
        setEvents(defaults);
        saveLocalReminders(defaults);
      }
    }
  }, [initialTab]);

  // 2. Fetch Events when token or viewing month changes
  const loadEvents = useCallback(async () => {
    const token = syncState.accessToken || getStoredToken();
    if (!token) {
      const locals = getLocalReminders();
      setEvents(locals.length > 0 ? locals : generateDefaultMindfulSchedule());
      return;
    }

    setIsLoadingEvents(true);
    setSyncState((prev) => ({ ...prev, error: null }));
    try {
      if (activeTab === "today") {
        const todayEvts = await fetchTodayEventsFromApi(token, new Date());
        setEvents(todayEvts);
      } else {
        const monthEvts = await fetchMonthEventsFromApi(
          token,
          currentDate.getFullYear(),
          currentDate.getMonth()
        );
        setEvents(monthEvts);
      }
    } catch (err: any) {
      console.error("Error fetching calendar events:", err);
      setSyncState((prev) => ({
        ...prev,
        error: err.message || "Failed to sync with Google Calendar.",
        isConnected: !err.message?.includes("expired"),
      }));
      // Fallback to local
      const locals = getLocalReminders();
      if (locals.length > 0) setEvents(locals);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [syncState.accessToken, activeTab, currentDate]);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen, loadEvents]);

  // Handle Connect to Google Calendar
  const handleConnectCalendar = async () => {
    setSyncState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const authResult = await requestGoogleCalendarAuth();
      setSyncState({
        isConnected: true,
        isConnecting: false,
        accessToken: authResult.accessToken,
        expiresAt: Date.now() + authResult.expiresIn * 1000,
        error: null,
      });
      // Immediately load fresh events from Google Calendar
      setIsLoadingEvents(true);
      const fetched = await fetchTodayEventsFromApi(authResult.accessToken, new Date());
      setEvents(fetched);
    } catch (err: any) {
      console.error("OAuth connection failed:", err);
      setSyncState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Could not connect to Google Calendar. Please allow popups.",
      }));
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredToken();
    setSyncState({
      isConnected: false,
      isConnecting: false,
      accessToken: null,
      expiresAt: null,
      error: null,
    });
    const defaults = generateDefaultMindfulSchedule();
    setEvents(defaults);
  };

  // Handle Create Event / Reminder
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmittingEvent(true);
    setFormSuccessMessage(null);

    const startIso = newIsAllDay
      ? `${newStartDate}T00:00:00.000Z`
      : `${newStartDate}T${newStartTime}:00.000Z`;
    const endIso = newIsAllDay
      ? `${newStartDate}T23:59:59.000Z`
      : `${newStartDate}T${newEndTime}:00.000Z`;

    const input: CalendarReminderInput = {
      title: newTitle.trim(),
      description: newDescription.trim(),
      location: newLocation.trim().slice(0, 500) || undefined,
      startTime: startIso,
      endTime: endIso,
      isAllDay: newIsAllDay,
      colorId: newColorId !== "default" ? newColorId : undefined,
    };

    try {
      const token = syncState.accessToken || getStoredToken();
      if (token && syncState.isConnected) {
        const created = await createGoogleCalendarEvent(token, input);
        setEvents((prev) => [created, ...prev]);
        setFormSuccessMessage("Event added to your Google Calendar!");
      } else {
        // Local creation
        const localEvt: GoogleCalendarEvent = {
          id: `local-evt-${Date.now()}`,
          summary: input.title,
          description: input.description,
          location: input.location,
          start: newIsAllDay ? { date: newStartDate } : { dateTime: startIso },
          end: newIsAllDay ? { date: newStartDate } : { dateTime: endIso },
          isTaskReminder: true,
          colorId: input.colorId || "default",
          status: "confirmed",
        };
        const updated = [localEvt, ...events];
        setEvents(updated);
        saveLocalReminders(updated);
        setFormSuccessMessage("Reminder saved to your daily schedule!");
      }

      // Reset Form
      setNewTitle("");
      setNewDescription("");
      setNewLocation("");
      setTimeout(() => {
        setFormSuccessMessage(null);
        setActiveTab("today");
      }, 1200);
    } catch (err: any) {
      console.error("Failed to create event:", err);
      setSyncState((prev) => ({ ...prev, error: err.message || "Failed to create event." }));
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Quick Preset Add
  const handleAddMindfulPreset = async (presetType: "morning" | "midday" | "evening") => {
    const todayStr = new Date().toISOString().split("T")[0];
    let title = "";
    let desc = "";
    let startTime = "";
    let endTime = "";
    let colorId = "default";

    if (presetType === "morning") {
      title = "🌅 Morning Intention & Gratitude Journaling";
      desc = "Focus on what matters most today, write 3 gratitudes, and center your morning mind.";
      startTime = `${todayStr}T08:30:00.000Z`;
      endTime = `${todayStr}T08:45:00.000Z`;
      colorId = "2";
    } else if (presetType === "midday") {
      title = "🧘 Midday Reset & Grounding Break";
      desc = "Step away from work, breathe mindfully, and reset mental energy.";
      startTime = `${todayStr}T13:00:00.000Z`;
      endTime = `${todayStr}T13:15:00.000Z`;
      colorId = "5";
    } else {
      title = "📖 Evening Deep Journal Reflection with Gemini";
      desc = "Review today's thoughts, emotions, and lessons with AI reflection guidance.";
      startTime = `${todayStr}T20:30:00.000Z`;
      endTime = `${todayStr}T21:00:00.000Z`;
      colorId = "1";
    }

    const input: CalendarReminderInput = {
      title,
      description: desc,
      startTime,
      endTime,
      colorId,
    };

    try {
      const token = syncState.accessToken || getStoredToken();
      if (token && syncState.isConnected) {
        const created = await createGoogleCalendarEvent(token, input);
        setEvents((prev) => [created, ...prev]);
      } else {
        const localEvt: GoogleCalendarEvent = {
          id: `local-evt-${Date.now()}`,
          summary: title,
          description: desc,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          isTaskReminder: true,
          colorId,
          status: "confirmed",
        };
        const updated = [localEvt, ...events];
        setEvents(updated);
        saveLocalReminders(updated);
      }
      setQuickPresetSuccess(`Added: "${title.split(" ")[1]}..."`);
      setTimeout(() => setQuickPresetSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error adding preset reminder:", err);
      setSyncState((prev) => ({ ...prev, error: err.message || "Failed to add preset reminder." }));
    }
  };

  // Handle Delete Event
  const handleDelete = async (eventId: string) => {
    try {
      const token = syncState.accessToken || getStoredToken();
      if (token && syncState.isConnected && !eventId.startsWith("local-") && !eventId.startsWith("demo-")) {
        await deleteGoogleCalendarEvent(token, eventId);
      }
      const updated = events.filter((e) => e.id !== eventId);
      setEvents(updated);
      saveLocalReminders(updated);
      if (viewingEvent?.id === eventId) {
        setViewingEvent(null);
      }
    } catch (err: any) {
      console.error("Error deleting event:", err);
      setSyncState((prev) => ({ ...prev, error: err.message || "Failed to delete event." }));
    }
  };

  const toggleTaskCompletion = (id: string) => {
    setCompletedTaskIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Calendar Day Grid Computation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday

    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Today's events filter
  const todayEvents = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return events.filter((e) => {
      const startStr = e.start.dateTime || e.start.date || "";
      return startStr.startsWith(todayStr) || (startStr === "" && activeTab === "today");
    });
  }, [events, activeTab]);

  // Events on selected day
  const selectedDayEvents = useMemo(() => {
    const selStr = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`;
    return events.filter((e) => {
      const startStr = e.start.dateTime || e.start.date || "";
      return startStr.startsWith(selStr);
    });
  }, [events, selectedDay]);

  // Formatted date string helpers
  const formatEventTime = (evt: GoogleCalendarEvent) => {
    if (evt.start.date) return "All Day";
    if (!evt.start.dateTime) return "Anytime";
    try {
      const d = new Date(evt.start.dateTime);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "Scheduled";
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

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

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#171513]/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#211E1B] rounded-3xl border border-[#38322D] shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-5 sm:px-7 py-4 border-b border-[#38322D] flex items-center justify-between bg-[#171513]/70 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-serif font-bold text-[#F3EFE8]">
                  Google Calendar & Daily Reminders
                </h2>
                {syncState.isConnected ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6E9A7B]/15 text-[#6E9A7B] border border-[#6E9A7B]/30">
                    <ShieldCheck className="w-3 h-3" />
                    <span>OAuth Synced</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#38322D] text-[#B7AFA7]">
                    <span>Local Mode</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#B7AFA7]">
                Track daily tasks, plan reflection sessions, and inspect your full calendar schedule
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Refresh / Reconnect Button */}
            <button
              onClick={loadEvents}
              disabled={isLoadingEvents}
              className="p-2 rounded-xl bg-[#171513] border border-[#38322D] text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
              title="Refresh calendar events"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingEvents ? "animate-spin text-[#C89B3C]" : ""}`} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
              aria-label="Close Calendar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* OAuth Integration Banner */}
        <div className="px-5 sm:px-7 py-2.5 bg-[#171513] border-b border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-[#B7AFA7]">
            {syncState.isConnected ? (
              <span className="flex items-center space-x-1.5 text-[#6E9A7B]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected to Google Calendar</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-[#C89B3C]">
                <BellRing className="w-3.5 h-3.5" />
                <span>Connect your Google Calendar to sync reminders and events live</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {syncState.isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-[11px] text-[#B7AFA7] hover:text-rose-300 underline transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                id="btn-connect-gcal"
                type="button"
                onClick={handleConnectCalendar}
                disabled={syncState.isConnecting}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-50 text-[#171513] font-semibold rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
              >
                {syncState.isConnecting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                    <span>Connecting OAuth...</span>
                  </>
                ) : (
                  <>
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Connect Google Calendar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {syncState.error && (
          <div className="px-5 py-2 bg-[#B86B6B]/20 border-b border-[#B86B6B]/40 text-[#F3EFE8] text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#B86B6B] shrink-0" />
              <span>{syncState.error}</span>
            </div>
            <button
              onClick={() => setSyncState((prev) => ({ ...prev, error: null }))}
              className="text-[#B7AFA7] hover:text-[#F3EFE8]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success toast for preset */}
        {quickPresetSuccess && (
          <div className="px-5 py-2 bg-[#6E9A7B]/20 border-b border-[#6E9A7B]/40 text-[#F3EFE8] text-xs flex items-center space-x-2 animate-fade-in">
            <Check className="w-4 h-4 text-[#6E9A7B]" />
            <span>{quickPresetSuccess}</span>
          </div>
        )}

        {/* Tab Navigation Header */}
        <div className="px-5 sm:px-7 pt-3 border-b border-[#38322D] flex items-center justify-between bg-[#211E1B]">
          <div className="flex space-x-2 sm:space-x-4">
            <button
              id="tab-cal-today"
              onClick={() => setActiveTab("today")}
              className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "today"
                  ? "border-[#C89B3C] text-[#C89B3C] font-semibold"
                  : "border-transparent text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Today's Tasks & Reminders</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#171513] text-[10px] text-[#B7AFA7] border border-[#38322D]">
                {todayEvents.length}
              </span>
            </button>

            <button
              id="tab-cal-full"
              onClick={() => setActiveTab("full")}
              className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "full"
                  ? "border-[#C89B3C] text-[#C89B3C] font-semibold"
                  : "border-transparent text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Full Calendar View</span>
            </button>

            <button
              id="tab-cal-create"
              onClick={() => setActiveTab("create")}
              className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === "create"
                  ? "border-[#C89B3C] text-[#C89B3C] font-semibold"
                  : "border-transparent text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>New Event / Reminder</span>
            </button>
          </div>

          {/* Quick Presets Dropdown / Buttons */}
          <div className="hidden sm:flex items-center space-x-1.5 pb-2">
            <span className="text-[11px] text-[#B7AFA7] mr-1">Quick Add:</span>
            <button
              onClick={() => handleAddMindfulPreset("morning")}
              className="px-2 py-1 rounded-md bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/50 text-[#F3EFE8] text-[11px] font-medium transition-colors cursor-pointer"
              title="Add Morning Intention reminder"
            >
              🌅 Morning
            </button>
            <button
              onClick={() => handleAddMindfulPreset("midday")}
              className="px-2 py-1 rounded-md bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/50 text-[#F3EFE8] text-[11px] font-medium transition-colors cursor-pointer"
              title="Add Midday Reset reminder"
            >
              🧘 Midday
            </button>
            <button
              onClick={() => handleAddMindfulPreset("evening")}
              className="px-2 py-1 rounded-md bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/50 text-[#F3EFE8] text-[11px] font-medium transition-colors cursor-pointer"
              title="Add Evening Reflection reminder"
            >
              📖 Evening
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-[#F3EFE8]">
          {/* TAB 1: TODAY'S TASKS & REMINDERS */}
          {activeTab === "today" && (
            <div className="space-y-6">
              {/* Check-In Consistency & Daily Reminder Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Streak */}
                <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center gap-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-[#A69E95] uppercase tracking-wider block">
                      Check-in Streak
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold font-serif text-[#F3EFE8]">
                        {checkInStats.currentStreak}
                      </span>
                      <span className="text-xs text-[#A69E95]">days</span>
                      {checkInStats.longestStreak > 0 && (
                        <span className="text-[10px] text-[#C89B3C] ml-1">
                          (Best: {checkInStats.longestStreak})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Monthly Count */}
                <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center gap-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-[#A69E95] uppercase tracking-wider block">
                      This Month ({checkInStats.monthName})
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold font-serif text-[#F3EFE8]">
                        {checkInStats.thisMonthCount}
                      </span>
                      <span className="text-xs text-[#A69E95]">check-ins</span>
                    </div>
                  </div>
                </div>

                {/* 3. Daily Reminder */}
                <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-[#A69E95] uppercase tracking-wider block">
                        Everyday Reminder
                      </span>
                      <span className="text-xs font-bold text-[#F3EFE8]">
                        {user?.profile?.dailyReminder?.enabled
                          ? user?.profile?.dailyReminder?.time || "20:00"
                          : "Not scheduled"}
                      </span>
                    </div>
                  </div>
                  {onOpenReminderModal && (
                    <button
                      onClick={onOpenReminderModal}
                      className="px-2.5 py-1 rounded-lg bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer shrink-0"
                    >
                      {user?.profile?.dailyReminder?.enabled ? "Change" : "Set Time"}
                    </button>
                  )}
                </div>
              </div>

              {/* Today's Full Check-In Status & Logger */}
              <div className="p-5 rounded-2xl bg-[#171513] border border-[#38322D] space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#2C2723]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/15 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center shrink-0">
                      <Smile className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F3EFE8] font-serif">
                        Today's Mind & Body Check-In
                      </h4>
                      <span className="text-xs text-[#A69E95]">
                        Daily check-in status and wellness balance
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {todayCheckIn ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Already Checked In Today
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-1 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        Hasn't Checked In Today
                      </span>
                    )}

                    {onSaveCheckIn && (
                      <button
                        onClick={() => handleOpenInlineCheckIn(todayStr)}
                        className="px-3 py-1 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{todayCheckIn ? "Update" : "Check In Now"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {checkInNotice && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{checkInNotice}</span>
                  </div>
                )}

                {todayCheckIn ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-[#211E1B] border border-[#38322D] flex items-center gap-3">
                      <span className="text-2xl">{MOOD_EMOJIS[todayCheckIn.mood] || "🌿"}</span>
                      <div>
                        <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block">Emotional State</span>
                        <span className="text-xs font-bold text-[#F3EFE8] capitalize">{todayCheckIn.mood}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#211E1B] border border-[#38322D] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#C89B3C]/10 text-[#C89B3C] flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block">Energy Level</span>
                        <span className="text-xs font-bold text-[#F3EFE8]">{todayCheckIn.energy} / 5</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#211E1B] border border-[#38322D] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#738F85]/20 text-[#8CAEA2] flex items-center justify-center font-bold text-xs">
                        🍃
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block">Stress Level</span>
                        <span className="text-xs font-bold text-[#F3EFE8]">{todayCheckIn.stress} / 5</span>
                      </div>
                    </div>
                    {todayCheckIn.notes && (
                      <div className="sm:col-span-3 p-3 rounded-xl bg-[#211E1B] border border-[#38322D] text-xs text-[#D8D2C9]">
                        <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block mb-1">Today's Notes</span>
                        <p className="italic">"{todayCheckIn.notes}"</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#211E1B] border border-[#38322D]">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <p className="text-xs font-semibold text-[#F3EFE8]">
                        Take a 60-second pause to record your mood, energy, and stress.
                      </p>
                      <p className="text-[11px] text-[#A69E95]">
                        Checking in daily strengthens your streak and helps Gemini tailor your wellbeing insights.
                      </p>
                    </div>
                    {onSaveCheckIn && (
                      <button
                        onClick={() => handleOpenInlineCheckIn(todayStr)}
                        className="px-4 py-2 rounded-xl bg-[#C89B3C] hover:bg-[#B58A32] text-[#171513] text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-1.5"
                      >
                        <Smile className="w-3.5 h-3.5" />
                        <span>Log Today's Check-In</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Inline Check-In Form (if active for today) */}
                {isCheckingInDate === todayStr && (
                  <form onSubmit={handleSaveInlineCheckIn} className="p-4 rounded-xl bg-[#1C1A17] border border-[#C89B3C]/40 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-[#2C2723]">
                      <span className="text-xs font-bold text-[#C89B3C] uppercase tracking-wider flex items-center gap-1.5">
                        <Smile className="w-3.5 h-3.5" />
                        Record Check-In for Today ({todayStr})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCheckingInDate(null)}
                        className="text-[#A69E95] hover:text-[#F3EFE8] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mood choices */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#A69E95]">Select Mood</label>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {MOOD_OPTIONS.map((m) => {
                          const isSel = checkInMood === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setCheckInMood(m.id)}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                isSel
                                  ? "bg-[#C89B3C]/20 border-[#C89B3C] text-[#F3EFE8]"
                                  : "bg-[#171513] border-[#38322D] text-[#A69E95] hover:text-[#F3EFE8]"
                              }`}
                            >
                              <span className="text-lg block">{m.icon}</span>
                              <span className="text-[10px] font-medium capitalize truncate block">{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Energy & Stress */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-[#171513] border border-[#38322D] space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#A69E95]">Energy Level</span>
                          <span className="font-bold text-[#C89B3C]">{checkInEnergy} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={checkInEnergy}
                          onChange={(e) => setCheckInEnergy(Number(e.target.value))}
                          className="w-full accent-[#C89B3C] cursor-pointer"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-[#171513] border border-[#38322D] space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#A69E95]">Stress Level</span>
                          <span className="font-bold text-[#738F85]">{checkInStress} / 5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={checkInStress}
                          onChange={(e) => setCheckInStress(Number(e.target.value))}
                          className="w-full accent-[#738F85] cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Optional Note */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#A69E95]">Brief Thought or Reflection (Optional)</label>
                      <input
                        type="text"
                        placeholder="How are you feeling right now? What's on your mind?"
                        value={checkInNotes}
                        onChange={(e) => setCheckInNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCheckingInDate(null)}
                        className="px-3 py-1.5 rounded-xl text-xs text-[#A69E95] hover:text-[#F3EFE8] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-[#C89B3C] hover:bg-[#B58A32] text-[#171513] text-xs font-bold cursor-pointer"
                      >
                        Save Check-In
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Daily Overview Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#171513] border border-[#38322D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-[#C89B3C]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#C89B3C]">
                      Today's Schedule & Reminders
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-[#F3EFE8]">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                  <p className="text-xs text-[#B7AFA7]">
                    You have <strong className="text-[#F3EFE8]">{todayEvents.length}</strong> items scheduled today. Check off completed mindfulness habits or reflect on them with Gemini.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => setActiveTab("create")}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task / Reminder</span>
                  </button>
                </div>
              </div>

              {/* Events & Task List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#B7AFA7] px-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Timeline & Reminders</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEventFilter("all")}
                      className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                        eventFilter === "all" ? "bg-[#38322D] text-[#F3EFE8]" : "hover:text-[#F3EFE8]"
                      }`}
                    >
                      All ({todayEvents.length})
                    </button>
                    <button
                      onClick={() => setEventFilter("reminders")}
                      className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                        eventFilter === "reminders" ? "bg-[#38322D] text-[#F3EFE8]" : "hover:text-[#F3EFE8]"
                      }`}
                    >
                      Mindful Reminders
                    </button>
                  </div>
                </div>

                {todayEvents.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-2xl bg-[#171513] border border-[#38322D] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/20 text-[#C89B3C] flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#F3EFE8]">No events scheduled for today</h4>
                    <p className="text-xs text-[#B7AFA7] max-w-sm mx-auto">
                      Your calendar is open today! Add a mindful intention, reflection check-in, or sync with your Google Calendar above.
                    </p>
                    <div className="pt-2 flex justify-center gap-2">
                      <button
                        onClick={() => handleAddMindfulPreset("morning")}
                        className="px-3 py-1.5 bg-[#2c2723] hover:bg-[#36302b] text-[#F3EFE8] rounded-xl text-xs font-medium border border-[#38322D] cursor-pointer"
                      >
                        + Add Morning Intention
                      </button>
                      <button
                        onClick={() => handleAddMindfulPreset("evening")}
                        className="px-3 py-1.5 bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        + Add Evening Reflection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {todayEvents
                      .filter((evt) => {
                        if (eventFilter === "reminders") return evt.isTaskReminder;
                        return true;
                      })
                      .map((evt) => {
                        const isDone = completedTaskIds[evt.id];
                        const colorStyle = EVENT_COLORS[evt.colorId || "default"] || EVENT_COLORS.default;

                        return (
                          <div
                            key={evt.id}
                            className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 bg-[#171513] ${
                              isDone
                                ? "border-[#38322D]/60 opacity-60"
                                : "border-[#38322D] hover:border-[#C89B3C]/50 shadow-xs"
                            }`}
                          >
                            <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                              {/* Checkbox toggle */}
                              <button
                                type="button"
                                onClick={() => toggleTaskCompletion(evt.id)}
                                className="mt-0.5 text-[#B7AFA7] hover:text-[#C89B3C] transition-colors cursor-pointer shrink-0"
                                title={isDone ? "Mark as active" : "Mark as completed"}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#6E9A7B]" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-sm font-semibold ${
                                      isDone ? "line-through text-[#B7AFA7]" : "text-[#F3EFE8]"
                                    }`}
                                  >
                                    {evt.summary}
                                  </span>

                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}
                                  >
                                    {formatEventTime(evt)}
                                  </span>

                                  {evt.isTaskReminder && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-[#38322D] text-[#B7AFA7]">
                                      Reminder
                                    </span>
                                  )}
                                </div>

                                {evt.description && (
                                  <p className="text-xs text-[#B7AFA7] line-clamp-2 leading-relaxed">
                                    {evt.description}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#B7AFA7]">
                                  {evt.location && (
                                    <span className="flex items-center space-x-1">
                                      <MapPin className="w-3 h-3 text-[#C89B3C]" />
                                      <span className="truncate max-w-[160px]">{evt.location}</span>
                                    </span>
                                  )}
                                  {evt.hangoutLink && (
                                    <a
                                      href={evt.hangoutLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center space-x-1 text-[#738F85] hover:underline"
                                    >
                                      <Video className="w-3 h-3" />
                                      <span>Join Video Call</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center space-x-1 shrink-0">
                              {onInsertEventToJournal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onInsertEventToJournal(evt);
                                    onClose();
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#2c2723] hover:bg-[#38322D] text-[#F3EFE8] text-xs font-medium border border-[#38322D] transition-colors flex items-center space-x-1 cursor-pointer"
                                  title="Reflect on this event in Journal Editor"
                                >
                                  <Sparkles className="w-3 h-3 text-[#C89B3C]" />
                                  <span className="hidden sm:inline">Reflect</span>
                                </button>
                              )}

                              {evt.htmlLink && (
                                <a
                                  href={evt.htmlLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors"
                                  title="Open in Google Calendar"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDelete(evt.id)}
                                className="p-1.5 rounded-lg text-[#B7AFA7] hover:text-rose-400 hover:bg-[#2c2723] transition-colors cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FULL CALENDAR VIEW */}
          {activeTab === "full" && (
            <div className="space-y-4">
              {/* Full Calendar Top Consistency & Streak Bar */}
              <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  {/* Streak */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block font-semibold">Streak</span>
                      <span className="text-sm font-bold font-serif text-[#F3EFE8]">
                        {checkInStats.currentStreak} Days
                      </span>
                    </div>
                  </div>

                  {/* Monthly Count */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A69E95] uppercase tracking-wider block font-semibold">
                        This Month ({checkInStats.monthName})
                      </span>
                      <span className="text-sm font-bold font-serif text-[#F3EFE8]">
                        {checkInStats.thisMonthCount} Check-ins
                      </span>
                    </div>
                  </div>

                  {/* Today's Status Badge */}
                  <div className="flex items-center">
                    {checkInStats.checkedInToday ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Today: Already Checked In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/40 border border-amber-800/40 text-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        Today: Hasn't Checked In
                      </span>
                    )}
                  </div>
                </div>

                {/* Everyday Reminder trigger */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#A69E95]">
                    <BellRing className="w-3.5 h-3.5 text-[#C89B3C]" />
                    <span>Everyday Reminder:</span>
                    <strong className="text-[#F3EFE8]">
                      {user?.profile?.dailyReminder?.enabled
                        ? user?.profile?.dailyReminder?.time || "20:00"
                        : "Off"}
                    </strong>
                  </div>
                  {onOpenReminderModal && (
                    <button
                      type="button"
                      onClick={onOpenReminderModal}
                      className="px-3 py-1 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 7 Cols: Monthly Calendar Grid */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Month Navigator */}
                  <div className="flex items-center justify-between bg-[#171513] p-3 rounded-2xl border border-[#38322D]">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-base sm:text-lg font-serif font-bold text-[#F3EFE8]">
                        {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </h3>
                      <button
                        onClick={() => {
                          const now = new Date();
                          setCurrentDate(now);
                          setSelectedDay(now);
                        }}
                        className="px-2 py-0.5 rounded-md bg-[#2c2723] border border-[#38322D] text-[11px] font-medium text-[#B7AFA7] hover:text-[#F3EFE8] cursor-pointer"
                      >
                        Today
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setCurrentDate(
                            new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
                          );
                        }}
                        className="p-1.5 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCurrentDate(
                            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                          );
                        }}
                        className="p-1.5 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Days of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#B7AFA7] py-1">
                    {DAYS_OF_WEEK.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>

                  {/* 35/42 Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dayItem, idx) => {
                      const isSelected = isSameDay(dayItem.date, selectedDay);
                      const isToday = isSameDay(dayItem.date, new Date());

                      // Find events for this cell
                      const dayStr = `${dayItem.date.getFullYear()}-${String(dayItem.date.getMonth() + 1).padStart(2, "0")}-${String(dayItem.date.getDate()).padStart(2, "0")}`;
                      const dayEvts = events.filter((e) => {
                        const start = e.start.dateTime || e.start.date || "";
                        return start.startsWith(dayStr);
                      });

                      const dayCheckIn = checkInsMap[dayStr];
                      const isPastOrToday = dayItem.date <= new Date();

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedDay(dayItem.date)}
                          className={`min-h-[68px] sm:min-h-[82px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#2c2723] border-[#C89B3C] shadow-md ring-1 ring-[#C89B3C]"
                              : dayItem.isCurrentMonth
                              ? "bg-[#171513] border-[#38322D] hover:border-[#B7AFA7]/60"
                              : "bg-[#171513]/40 border-[#38322D]/40 opacity-40 hover:opacity-70"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                                isToday
                                  ? "bg-[#C89B3C] text-[#171513]"
                                  : isSelected
                                  ? "text-[#C89B3C]"
                                  : dayItem.isCurrentMonth
                                  ? "text-[#F3EFE8]"
                                  : "text-[#B7AFA7]"
                              }`}
                            >
                              {dayItem.date.getDate()}
                            </span>

                            {dayEvts.length > 0 && (
                              <span className="text-[9px] px-1 rounded bg-[#38322D] text-[#B7AFA7] font-mono">
                                {dayEvts.length}
                              </span>
                            )}
                          </div>

                          {/* Check-In Status Indicator on Cell */}
                          <div className="w-full">
                            {dayCheckIn ? (
                              <div
                                title={`Checked in: ${dayCheckIn.mood}, Energy: ${dayCheckIn.energy}/5, Stress: ${dayCheckIn.stress}/5`}
                                className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded-md leading-none shadow-xs mt-0.5"
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                <span>{MOOD_EMOJIS[dayCheckIn.mood] || "🌿"}</span>
                                <span className="hidden sm:inline capitalize truncate">{dayCheckIn.mood}</span>
                              </div>
                            ) : isPastOrToday && dayItem.isCurrentMonth ? (
                              <div
                                title="Hasn't checked in yet"
                                className="text-[8px] sm:text-[9px] text-[#7A746E] flex items-center gap-1 px-1 py-0.5 mt-0.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#38322D]"></span>
                                <span className="hidden sm:inline text-[9px]">Unlogged</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Tiny Event Pills */}
                          <div className="w-full space-y-0.5 overflow-hidden">
                            {dayEvts.slice(0, 1).map((ev) => (
                              <div
                                key={ev.id}
                                className="text-[9px] truncate px-1 py-0.5 rounded bg-[#C89B3C]/10 text-[#C89B3C] leading-none"
                              >
                                {ev.summary}
                              </div>
                            ))}
                            {dayEvts.length > 1 && (
                              <div className="text-[8px] text-[#B7AFA7] text-right">
                                +{dayEvts.length - 1} more
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right 5 Cols: Selected Date Detailed Agenda & Check-In Card */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-[#C89B3C] uppercase tracking-wider">
                        Selected Day Agenda
                      </span>
                      <h4 className="text-base font-serif font-bold text-[#F3EFE8]">
                        {selectedDay.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </h4>
                    </div>

                    <button
                      onClick={() => {
                        setNewStartDate(selectedDay.toISOString().split("T")[0]);
                        setActiveTab("create");
                      }}
                      className="p-2 rounded-xl bg-[#2c2723] hover:bg-[#38322D] border border-[#38322D] text-[#C89B3C] transition-colors cursor-pointer"
                      title="Add event on this day"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selected Date Check-In Status Card */}
                  <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#2C2723]">
                      <span className="text-xs font-semibold text-[#C89B3C] uppercase tracking-wider flex items-center gap-1.5">
                        <Smile className="w-3.5 h-3.5" />
                        Check-In for this Date
                      </span>
                      {selectedDayCheckIn ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Already Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A69E95] bg-[#2C2723] px-2.5 py-0.5 rounded-full border border-[#38322D]">
                          <Circle className="w-3 h-3 text-[#7A746E]" />
                          Hasn't Checked In
                        </span>
                      )}
                    </div>

                    {selectedDayCheckIn ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-xl bg-[#211E1B] border border-[#38322D] text-center">
                            <span className="text-xl block">{MOOD_EMOJIS[selectedDayCheckIn.mood] || "🌿"}</span>
                            <span className="text-[10px] text-[#A69E95] uppercase block">Mood</span>
                            <span className="text-xs font-bold text-[#F3EFE8] capitalize truncate block">
                              {selectedDayCheckIn.mood}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-[#211E1B] border border-[#38322D] text-center">
                            <span className="text-base font-bold text-[#C89B3C] block mt-0.5">⚡</span>
                            <span className="text-[10px] text-[#A69E95] uppercase block">Energy</span>
                            <span className="text-xs font-bold text-[#F3EFE8] block">{selectedDayCheckIn.energy} / 5</span>
                          </div>
                          <div className="p-2 rounded-xl bg-[#211E1B] border border-[#38322D] text-center">
                            <span className="text-base font-bold text-[#738F85] block mt-0.5">🍃</span>
                            <span className="text-[10px] text-[#A69E95] uppercase block">Stress</span>
                            <span className="text-xs font-bold text-[#F3EFE8] block">{selectedDayCheckIn.stress} / 5</span>
                          </div>
                        </div>

                        {selectedDayCheckIn.notes && (
                          <p className="text-xs text-[#D8D2C9] italic bg-[#211E1B] p-2.5 rounded-xl border border-[#38322D]">
                            "{selectedDayCheckIn.notes}"
                          </p>
                        )}

                        {onSaveCheckIn && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenInlineCheckIn(selectedDayStr)}
                              className="px-3 py-1 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Check-In</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 py-1">
                        <p className="text-xs text-[#A69E95]">
                          No wellness check-in was recorded for {selectedDayStr}.
                        </p>
                        {onSaveCheckIn && (
                          <button
                            type="button"
                            onClick={() => handleOpenInlineCheckIn(selectedDayStr)}
                            className="w-full py-2 rounded-xl bg-[#2C2723] hover:bg-[#38322D] text-[#C89B3C] text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Smile className="w-3.5 h-3.5" />
                            <span>Record Check-In for this Date</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Form for Selected Day */}
                    {isCheckingInDate === selectedDayStr && (
                      <form onSubmit={handleSaveInlineCheckIn} className="p-3 rounded-xl bg-[#1C1A17] border border-[#C89B3C]/40 space-y-3 animate-fade-in mt-2">
                        <div className="flex items-center justify-between pb-1 border-b border-[#2C2723]">
                          <span className="text-xs font-bold text-[#C89B3C]">
                            Log Check-In ({selectedDayStr})
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsCheckingInDate(null)}
                            className="text-[#A69E95] hover:text-[#F3EFE8] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mood options */}
                        <div className="grid grid-cols-4 gap-1">
                          {MOOD_OPTIONS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setCheckInMood(m.id)}
                              className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                checkInMood === m.id
                                  ? "bg-[#C89B3C]/20 border-[#C89B3C] text-[#F3EFE8]"
                                  : "bg-[#171513] border-[#38322D] text-[#A69E95] hover:text-[#F3EFE8]"
                              }`}
                            >
                              <span className="text-base block">{m.icon}</span>
                              <span className="text-[9px] capitalize block truncate">{m.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Sliders */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[#A69E95] text-[10px]">Energy: {checkInEnergy}/5</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={checkInEnergy}
                              onChange={(e) => setCheckInEnergy(Number(e.target.value))}
                              className="w-full accent-[#C89B3C] cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[#A69E95] text-[10px]">Stress: {checkInStress}/5</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={checkInStress}
                              onChange={(e) => setCheckInStress(Number(e.target.value))}
                              className="w-full accent-[#738F85] cursor-pointer"
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Optional notes or reflection..."
                          value={checkInNotes}
                          onChange={(e) => setCheckInNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8] outline-none"
                        />

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsCheckingInDate(null)}
                            className="px-2.5 py-1 text-xs text-[#A69E95] hover:text-[#F3EFE8] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-lg bg-[#C89B3C] hover:bg-[#B58A32] text-[#171513] text-xs font-bold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                {/* Selected Day Events List */}
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-2xl bg-[#171513] border border-[#38322D] space-y-2">
                      <p className="text-xs text-[#B7AFA7]">No events scheduled for this date.</p>
                      <button
                        onClick={() => {
                          setNewStartDate(selectedDay.toISOString().split("T")[0]);
                          setActiveTab("create");
                        }}
                        className="text-xs text-[#C89B3C] hover:underline font-medium cursor-pointer"
                      >
                        + Create a task or reminder
                      </button>
                    </div>
                  ) : (
                    selectedDayEvents.map((evt) => {
                      const colorStyle = EVENT_COLORS[evt.colorId || "default"] || EVENT_COLORS.default;
                      return (
                        <div
                          key={evt.id}
                          className="p-3.5 rounded-xl bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/40 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-xs sm:text-sm font-semibold text-[#F3EFE8] line-clamp-1">
                              {evt.summary}
                            </h5>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}
                            >
                              {formatEventTime(evt)}
                            </span>
                          </div>

                          {evt.description && (
                            <p className="text-xs text-[#B7AFA7] line-clamp-2 leading-relaxed">
                              {evt.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-[#38322D]/60 text-xs">
                            <span className="text-[11px] text-[#B7AFA7]">
                              {evt.isTaskReminder ? "Mindful Reminder" : "Calendar Event"}
                            </span>
                            <div className="flex items-center space-x-2">
                              {onInsertEventToJournal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onInsertEventToJournal(evt);
                                    onClose();
                                  }}
                                  className="text-[11px] text-[#C89B3C] hover:underline font-medium cursor-pointer flex items-center space-x-1"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Reflect</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(evt.id)}
                                className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

          {/* TAB 3: CREATE NEW EVENT OR REMINDER */}
          {activeTab === "create" && (
            <div className="max-w-2xl mx-auto py-2">
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-serif font-bold text-[#F3EFE8]">
                    Schedule a New Task or Event
                  </h3>
                  <p className="text-xs text-[#B7AFA7]">
                    {syncState.isConnected
                      ? "This will sync directly to your primary Google Calendar with 10-minute and 30-minute reminder notifications."
                      : "Create a local reminder or connect your Google Calendar above to push directly to Google Cloud."}
                  </p>
                </div>

                {formSuccessMessage && (
                  <div className="p-3 rounded-xl bg-[#6E9A7B]/20 border border-[#6E9A7B]/50 text-[#F3EFE8] text-xs flex items-center space-x-2">
                    <Check className="w-4 h-4 text-[#6E9A7B]" />
                    <span>{formSuccessMessage}</span>
                  </div>
                )}

                {/* Event Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Event or Reminder Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 🧘 Midday Mindful Walking & Reflection..."
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none text-sm"
                  />
                </div>

                {/* Optional Location */}
                <div className="space-y-1.5">
                  <label htmlFor="input-calendar-location" className="block text-xs font-semibold text-[#F3EFE8]">
                    Location <span className="font-normal text-[#B7AFA7]">(optional)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C89B3C]" aria-hidden="true" />
                    <input
                      id="input-calendar-location"
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value.slice(0, 500))}
                      maxLength={500}
                      autoComplete="street-address"
                      placeholder="e.g. Kintono Badminton Hall, Surabaya"
                      className="w-full rounded-xl border border-[#38322D] bg-[#171513] py-2.5 pl-10 pr-3.5 text-xs text-[#F3EFE8] outline-none placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40"
                    />
                  </div>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Saved only with this event; it does not change your Profile location.
                  </p>
                </div>

                {/* Date & All Day Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#F3EFE8]">Date</label>
                    <input
                      type="date"
                      required
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs outline-none focus:border-[#C89B3C]"
                    />
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-xs text-[#F3EFE8] cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={newIsAllDay}
                        onChange={(e) => setNewIsAllDay(e.target.checked)}
                        className="rounded bg-[#171513] border-[#38322D] text-[#C89B3C] focus:ring-0"
                      />
                      <span>All Day Event</span>
                    </label>
                  </div>
                </div>

                {/* Times (if not all day) */}
                {!newIsAllDay && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#F3EFE8]">Start Time</label>
                      <input
                        type="time"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs outline-none focus:border-[#C89B3C]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#F3EFE8]">End Time</label>
                      <input
                        type="time"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs outline-none focus:border-[#C89B3C]"
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Description & Reflection Notes
                  </label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Add context, intentions, or things to review during this reminder..."
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs placeholder-[#B7AFA7]/60 outline-none focus:border-[#C89B3C] resize-y leading-relaxed"
                  />
                </div>

                {/* Color Category */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Highlight Category Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(EVENT_COLORS).map(([cid, style]) => (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => setNewColorId(cid)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center space-x-1.5 cursor-pointer ${
                          newColorId === cid
                            ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold"
                            : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7]"
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        <span>{style.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#38322D]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("today")}
                    className="px-4 py-2 text-xs font-medium text-[#B7AFA7] hover:text-[#F3EFE8] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEvent || !newTitle.trim()}
                    className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-50 text-[#171513] font-semibold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    {isSubmittingEvent ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Save to Calendar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
