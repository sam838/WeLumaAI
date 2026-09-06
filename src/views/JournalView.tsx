import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Save,
  Trash2,
  Sparkles,
  Zap,
  Brain,
  Clock,
  Tag,
  Smile,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronRight,
  Filter,
  X,
  Compass,
  Send,
  Loader2,
  Calendar,
  CalendarPlus,
  Copy,
  MessageSquare,
  Sparkle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Flame,
  ExternalLink,
  CalendarCheck,
  MapPin,
  Lightbulb,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  AuthUserState,
  DailyCheckInState,
  JournalInteraction,
  JournalMessage,
  JournalMode,
  MoodType,
  ReflectionDepth,
  SuggestedActivityItem,
  WellbeingDomain,
} from "../types";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { ScheduleActivityModal } from "../components/ScheduleActivityModal";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import {
  parseActivityScheduleDateTime,
  formatHumanReadable,
} from "../utils/dateParser";
import {
  getStoredToken,
  requestGoogleCalendarAuth,
  createGoogleCalendarEvent,
} from "../googleCalendar";

interface JournalViewProps {
  user: AuthUserState;
  todayCheckIn?: DailyCheckInState | null;
  interactions: JournalInteraction[];
  activeInteractionId: string | null;
  onSelectInteraction: (id: string) => void;
  onNewEntry: () => void;
  onSendMessage?: (
    prompt: string,
    mode: JournalMode,
    depth: ReflectionDepth,
    title: string,
    domains: WellbeingDomain[],
    mood: MoodType | string,
    tags: string[]
  ) => Promise<void>;
  onSaveEntry: (entry: JournalInteraction) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onUpdateTitle?: (title: string) => void;
  onUpdateMode?: (mode: JournalMode) => void;
  onUpdateDepth?: (depth: ReflectionDepth) => void;
  onOpenCalendar?: () => void;
  isGenerating?: boolean;
  isSaving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
  initialDraftText?: string;
  initialMood?: MoodType;
}

const DOMAINS: { id: WellbeingDomain; label: string; color: string }[] = [
  { id: "mind", label: "Mind", color: "#C89B3C" },
  { id: "body", label: "Body", color: "#738F85" },
  { id: "life", label: "Life", color: "#6E9A7B" },
  { id: "connection", label: "Connection", color: "#D4A373" },
];

const MOOD_OPTIONS: { id: MoodType; label: string; icon: string }[] = [
  { id: "calm", label: "Calm", icon: "🌿" },
  { id: "joyful", label: "Joyful", icon: "✨" },
  { id: "reflective", label: "Reflective", icon: "🌊" },
  { id: "grateful", label: "Grateful", icon: "💛" },
  { id: "energized", label: "Energized", icon: "⚡" },
  { id: "neutral", label: "Neutral", icon: "☁️" },
  { id: "anxious", label: "Anxious", icon: "🍃" },
  { id: "drained", label: "Drained", icon: "🌙" },
];

export const DEPTH_CONFIG: Record<ReflectionDepth, { label: string; model: string; badge: string; desc: string }> = {
  quick: {
    label: "Quick",
    model: "gemini-3.1-flash-lite",
    badge: "Flash-Lite",
    desc: "Ultra-low latency check-in: 1 concise paragraph, zero forced questions.",
  },
  reflect: {
    label: "Reflect",
    model: "gemini-3.8-flash",
    badge: "Flash",
    desc: "Empathetic cognitive reframing & thoughtful inquiry.",
  },
  deep: {
    label: "Deep",
    model: "gemini-3.7-flash",
    badge: "Reasoning",
    desc: "Multi-factor cognitive synthesis & longitudinal pattern analysis across entries.",
  },
};

const PROMPT_STARTERS = [
  {
    title: "Casual Chat & Free Thought",
    text: "Hey! I just wanted to talk through what's on my mind today without needing any formal schedule or activity plan:",
    tag: "Mind",
  },
  {
    title: "Morning Clarity & Daily Intent",
    text: "Here is what is top of mind for me today, along with my main priority and how I feel:",
    tag: "Mind",
  },
  {
    title: "Activity & Routine Recommendations",
    text: "Based on my current energy and stress levels, can you recommend 2-3 restorative activities or routines I can do today or this week?",
    tag: "Body",
  },
  {
    title: "Brainstorming Ideas & Fresh Perspectives",
    text: "I am feeling a bit stuck on my current schedule and work rhythm. Can you help me brainstorm creative ways to structure my afternoon?",
    tag: "Life",
  },
  {
    title: "Decompression & Gratitude Reflection",
    text: "Reflecting on the challenges and bright moments from earlier today, I want to unpack what gave me energy vs drained me:",
    tag: "Connection",
  },
];

export const JournalView: React.FC<JournalViewProps> = ({
  user,
  todayCheckIn,
  interactions,
  activeInteractionId,
  onSelectInteraction,
  onNewEntry,
  onSendMessage,
  onSaveEntry,
  onDeleteEntry,
  onUpdateTitle,
  onUpdateMode,
  onUpdateDepth,
  onOpenCalendar,
  isGenerating = false,
  isSaving,
  saveError,
  onRetrySave,
  initialDraftText,
  initialMood,
}) => {
  // Current active interaction
  const activeEntry = useMemo(() => {
    if (activeInteractionId) {
      return interactions.find((it) => it.id === activeInteractionId) || null;
    }
    return null;
  }, [activeInteractionId, interactions]);

  // Local Form Editor State
  const [title, setTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<JournalMode>("reflection");
  const [depth, setDepth] = useState<ReflectionDepth>("reflect");
  const [selectedDomains, setSelectedDomains] = useState<WellbeingDomain[]>(["mind"]);
  const [entryMood, setEntryMood] = useState<MoodType | string>("reflective");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState<boolean>(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState<boolean>(false);

  // Scheduling states for direct Google Calendar button inside activity recommendation cards
  const [schedulingActivityId, setSchedulingActivityId] = useState<string | null>(null);
  const [scheduledActivityIds, setScheduledActivityIds] = useState<Record<string, string>>({});
  const [calendarToast, setCalendarToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    isError?: boolean;
  }>({
    show: false,
    title: "",
    message: "",
  });

  // Modal state for smart date confirmation & customization
  const [modalActivityState, setModalActivityState] = useState<{
    isOpen: boolean;
    activity: SuggestedActivityItem | null;
    actKey: string | null;
  }>({
    isOpen: false,
    activity: null,
    actKey: null,
  });

  // Search & Filter State in Sidebar
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDomain, setFilterDomain] = useState<WellbeingDomain | "all">("all");

  // Deletion modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    entryId: string | null;
    entryTitle: string;
  }>({
    isOpen: false,
    entryId: null,
    entryTitle: "",
  });

  const [expandReadingView, setExpandReadingView] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCountRef = useRef(0);

  // Auto-scroll intelligently: when a new AI response arrives, scroll so the user sees the START of the response
  useEffect(() => {
    const currentLength = activeEntry?.messages?.length || 0;
    if (currentLength > 0 && currentLength > prevMsgCountRef.current) {
      const lastMsg = activeEntry?.messages?.[currentLength - 1];
      if (lastMsg?.role === "model" && latestMessageRef.current) {
        latestMessageRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMsgCountRef.current = currentLength;
  }, [activeEntry?.messages?.length, isGenerating]);

  // Sync state when active entry changes
  useEffect(() => {
    if (activeEntry) {
      setTitle(activeEntry.title || "");
      setMode(activeEntry.mode || "reflection");
      setDepth(activeEntry.depth || "reflect");
      setSelectedDomains(activeEntry.domains || ["mind"]);
      setEntryMood(activeEntry.mood || "reflective");
      setTagsInput(activeEntry.tags?.join(", ") || "");
      setInputText("");
    } else {
      setTitle("");
      setInputText(initialDraftText || "");
      setMode("reflection");
      setDepth("reflect");
      setSelectedDomains(["mind"]);
      setEntryMood(initialMood || "reflective");
      setTagsInput("");
    }
  }, [activeEntry, initialDraftText, initialMood]);

  // Filtered interaction history
  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.rawText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.messages?.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDomain =
        filterDomain === "all" || item.domains?.includes(filterDomain);

      return matchesSearch && matchesDomain;
    });
  }, [interactions, searchQuery, filterDomain]);

  // Open Smart Schedule Modal for Date/Time Confirmation & Customization
  const handleOpenScheduleModal = (act: SuggestedActivityItem, actKey: string) => {
    setModalActivityState({
      isOpen: true,
      activity: act,
      actKey,
    });
  };

  // Execute Google Calendar Event Creation with confirmed Start/End dates
  const handleConfirmScheduleFromModal = async (params: {
    title: string;
    description: string;
    domain: WellbeingDomain;
    startDate: Date;
    endDate: Date;
    durationMinutes: number;
    reason?: string;
    location?: string;
  }) => {
    const actKey = modalActivityState.actKey;
    if (!actKey) return;

    setSchedulingActivityId(actKey);
    try {
      let token = getStoredToken();
      if (!token) {
        // Request auth with Google OAuth
        const authRes = await requestGoogleCalendarAuth();
        token = authRes.accessToken;
      }

      if (!token) {
        throw new Error("Google Calendar authorization was not granted.");
      }

      const colorId =
        params.domain === "body"
          ? "10"
          : params.domain === "mind"
          ? "5"
          : params.domain === "connection"
          ? "4"
          : "2";

      const createdEvent = await createGoogleCalendarEvent(token, {
        title: `🌱 ${params.title}`,
        description: `${params.description}\n\n• Why this fits: ${
          params.reason || "Mindful recommendation from your journal"
        }\n• Recommended Duration: ${params.durationMinutes} mins\n• Wellbeing Domain: ${params.domain.toUpperCase()}${
          params.location ? `\n• Location: ${params.location}` : ""
        }`,
        location: params.location,
        startTime: params.startDate.toISOString(),
        endTime: params.endDate.toISOString(),
        colorId,
      });

      setScheduledActivityIds((prev) => ({
        ...prev,
        [actKey]: createdEvent.id,
      }));

      setModalActivityState({
        isOpen: false,
        activity: null,
        actKey: null,
      });

      const dateHuman = formatHumanReadable(params.startDate);
      setCalendarToast({
        show: true,
        title: "Added to Google Calendar! 🗓️",
        message: `"${params.title}" scheduled for ${dateHuman}.`,
        isError: false,
      });
      setTimeout(() => setCalendarToast({ show: false, title: "", message: "" }), 5000);
    } catch (err: any) {
      console.error("Failed to add activity to calendar:", err);
      setCalendarToast({
        show: true,
        title: "Calendar Scheduling Notice",
        message: err?.message || "Could not connect to Google Calendar. Please check permissions.",
        isError: true,
      });
      setTimeout(() => setCalendarToast({ show: false, title: "", message: "" }), 5000);
      throw err;
    } finally {
      setSchedulingActivityId(null);
    }
  };

  // Handle Conversational Send to Gemini
  const handleReflectWithGemini = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || isGenerating) return;

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const activeTitle = title.trim() || (activeEntry ? activeEntry.title : textToSend.slice(0, 40));

    if (onSendMessage) {
      setInputText("");
      await onSendMessage(
        textToSend,
        mode,
        depth,
        activeTitle,
        selectedDomains,
        entryMood,
        parsedTags
      );
    }
  };

  // Handle Save Note Directly (without calling AI)
  const handleSaveDirectly = async () => {
    if (!user?.uid) return;
    const textToSave = inputText.trim();
    if (!textToSave && !title.trim() && (!activeEntry || activeEntry.messages.length === 0)) {
      return;
    }

    const now = Date.now();
    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const finalTitle = title.trim() || (activeEntry?.title ? activeEntry.title : textToSave.slice(0, 40)) || "Personal Note";

    const userMessageList: JournalMessage[] = activeEntry?.messages ? [...activeEntry.messages] : [];
    if (textToSave) {
      userMessageList.push({
        id: `msg_u_${now}`,
        role: "user",
        text: textToSave,
        timestamp: now,
      });
    }

    const entryToSave: JournalInteraction = {
      id: activeEntry?.id || `entry_${now}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user.uid,
      title: finalTitle,
      rawText: activeEntry?.rawText
        ? (textToSave ? `${activeEntry.rawText}\n\n${textToSave}` : activeEntry.rawText)
        : textToSave,
      mode,
      depth,
      domains: selectedDomains,
      mood: entryMood,
      tags: parsedTags,
      messages: userMessageList,
      summary: activeEntry?.summary,
      themes: activeEntry?.themes,
      analysis: activeEntry?.analysis,
      modelUsed: activeEntry?.modelUsed,
      createdAt: activeEntry?.createdAt || now,
      updatedAt: now,
    };

    setInputText("");
    await onSaveEntry(entryToSave);
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to send to Gemini
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleReflectWithGemini();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const toggleDomain = (d: WellbeingDomain) => {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]
    );
  };

  return (
    <div id="journal-view-container" className="flex-1 flex overflow-hidden bg-[#171513] text-[#F3EFE8] relative">
      {/* Toast notification for Calendar Actions */}
      {calendarToast.show && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border shadow-xl flex items-start gap-3 max-w-sm animate-fade-in ${
            calendarToast.isError
              ? "bg-[#3B1E1E] border-[#5E2B2B] text-[#F8B4B4]"
              : "bg-[#211E1B] border-[#C89B3C] text-[#F3EFE8]"
          }`}
        >
          {calendarToast.isError ? (
            <AlertTriangle className="w-5 h-5 text-[#E57373] shrink-0 mt-0.5" />
          ) : (
            <CalendarCheck className="w-5 h-5 text-[#C89B3C] shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold">{calendarToast.title}</h4>
            <p className="text-[11px] text-[#B7AFA7] leading-relaxed">{calendarToast.message}</p>
          </div>
        </div>
      )}

      {/* LEFT: Journal Entries Sidebar (Warm Dark Themed) */}
      <aside
        id="journal-sidebar"
        className={`
          fixed lg:static inset-y-0 left-0 z-40 w-80 sm:w-88 lg:w-80 bg-[#1E1B18] border-r border-[#38322D] flex flex-col transition-transform duration-200 ease-out
          ${mobileHistoryOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#38322D] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F3EFE8] font-serif tracking-tight">Reflections</h2>
              <p className="text-[11px] text-[#B7AFA7]">{interactions.length} entries recorded</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="new-reflection-btn"
              onClick={() => {
                onNewEntry();
                setMobileHistoryOpen(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#C89B3C] text-[#171513] text-xs font-semibold hover:bg-[#b98c2d] transition-colors shadow-sm cursor-pointer"
              title="New Reflection"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              onClick={() => setMobileHistoryOpen(false)}
              className="lg:hidden p-1.5 text-[#B7AFA7] hover:text-[#F3EFE8] rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-3 border-b border-[#38322D] space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A746E]" />
            <input
              id="journal-search-input"
              type="text"
              placeholder="Search reflections, summaries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8] placeholder-[#7A746E] focus:border-[#C89B3C] focus:outline-none transition-all"
            />
          </div>

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setFilterDomain("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filterDomain === "all"
                  ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                  : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D]"
              }`}
            >
              All
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                onClick={() => setFilterDomain(d.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filterDomain === d.id
                    ? "bg-[#6E9A7B] text-white font-semibold shadow-xs"
                    : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entries List */}
        <div id="journal-history-list" className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredInteractions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Compass className="w-8 h-8 mx-auto text-[#484038] stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold text-[#B7AFA7]">No entries found</p>
              <p className="text-[11px] text-[#7A746E] mt-1">
                {searchQuery ? "Try another keyword" : "Start your first reflection"}
              </p>
            </div>
          ) : (
            filteredInteractions.map((entry) => {
              const isActive = entry.id === activeInteractionId;
              const dateStr = new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" }
              );
              const preview =
                entry.summary ||
                entry.messages?.find((m) => m.role === "model")?.text ||
                entry.rawText ||
                "Mindful session";

              return (
                <div
                  key={entry.id}
                  id={`journal-item-${entry.id}`}
                  onClick={() => {
                    onSelectInteraction(entry.id);
                    setMobileHistoryOpen(false);
                  }}
                  className={`group relative p-3 rounded-2xl cursor-pointer border transition-all ${
                    isActive
                      ? "bg-[#C89B3C]/15 border-[#C89B3C] shadow-sm"
                      : "bg-[#211E1B] border-[#38322D] hover:border-[#4E463E] hover:bg-[#26221E]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-xs font-semibold line-clamp-1 ${
                      isActive ? "text-[#F3EFE8] font-bold" : "text-[#E6E1D8]"
                    }`}>
                      {entry.title || "Untitled Reflection"}
                    </h3>
                    <span className="text-[10px] text-[#7A746E] shrink-0">{dateStr}</span>
                  </div>

                  <p className="text-[11px] text-[#B7AFA7] line-clamp-2 mt-1 leading-relaxed">
                    {preview}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-[#38322D]/60">
                    <div className="flex items-center gap-1.5">
                      {entry.domains?.slice(0, 2).map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-[#171513] border border-[#38322D] text-[#C89B3C]"
                        >
                          {d}
                        </span>
                      ))}
                      {entry.mode && (
                        <span className="text-[9px] text-[#7A746E] font-mono capitalize">
                          {entry.mode}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModalState({
                          isOpen: true,
                          entryId: entry.id,
                          entryTitle: entry.title || "Untitled Reflection",
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#7A746E] hover:text-[#E57373] transition-opacity rounded"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {mobileHistoryOpen && (
        <div
          onClick={() => setMobileHistoryOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* RIGHT: Active Conversational Journal Studio (Warm Dark Themed) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#171513]">
        {/* Top Studio Bar (Collapsible) */}
        {isHeaderCollapsed ? (
          <div
            id="collapsed-journal-header"
            className="px-3 sm:px-4 lg:px-6 py-2 bg-[#211E1B] border-b border-[#38322D] flex items-center justify-between gap-2.5 shrink-0 animate-fade-in"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                id="mobile-history-collapsed-btn"
                onClick={() => setMobileHistoryOpen(!mobileHistoryOpen)}
                className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#171513] border border-[#38322D] text-xs font-medium text-[#C89B3C] shadow-xs active:scale-95 cursor-pointer shrink-0"
                title="Toggle journal history"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-[11px]">({interactions.length})</span>
              </button>

              <div
                onClick={() => setIsHeaderCollapsed(false)}
                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                title="Click to expand header controls"
              >
                <span className="text-xs sm:text-sm font-serif font-bold text-[#F3EFE8] truncate group-hover:text-[#C89B3C] transition-colors">
                  {title.trim() || "Untitled Reflection"}
                </span>
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#171513] text-[#C89B3C] border border-[#38322D]">
                    {mode}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#171513] text-[#8C847B] border border-[#38322D]">
                    {depth}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Focus Reading View Toggle */}
              <button
                id="collapsed-toggle-reading-view-btn"
                onClick={() => setExpandReadingView(!expandReadingView)}
                className={`p-1.5 rounded-xl transition-colors border cursor-pointer ${
                  expandReadingView
                    ? "bg-[#C89B3C]/20 text-[#C89B3C] border-[#C89B3C]"
                    : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border-[#38322D]"
                }`}
                title={expandReadingView ? "Exit Focus Reading View" : "Enter Focus Reading View"}
              >
                {expandReadingView ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Expand Header Button */}
              <button
                id="expand-header-btn"
                onClick={() => setIsHeaderCollapsed(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#171513] text-[#C89B3C] hover:bg-[#2A2622] hover:border-[#C89B3C] transition-all border border-[#38322D] text-xs font-semibold cursor-pointer shadow-xs"
                title="Expand Title & Controls Header"
              >
                <span className="hidden sm:inline">Controls</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <header className="px-3 sm:px-4 lg:px-6 py-3 bg-[#211E1B] border-b border-[#38322D] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 flex-1 min-w-[180px]">
              <button
                id="mobile-history-expanded-btn"
                onClick={() => setMobileHistoryOpen(!mobileHistoryOpen)}
                className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#171513] border border-[#38322D] text-xs font-medium text-[#C89B3C] shadow-xs active:scale-95 cursor-pointer shrink-0"
                title="Toggle journal history"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History ({interactions.length})</span>
                <span className="sm:hidden text-[11px]">({interactions.length})</span>
              </button>

              <input
                id="reflection-title-input"
                type="text"
                placeholder="Session Title (e.g., Afternoon Focus & Reset)"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (onUpdateTitle && activeEntry) {
                    onUpdateTitle(e.target.value);
                  }
                }}
                className="text-base lg:text-lg font-serif font-bold text-[#F3EFE8] placeholder-[#7A746E] bg-transparent focus:outline-none w-full border-b border-transparent focus:border-[#C89B3C] transition-colors pb-0.5"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Mode Selector (Reflection, Chat, Brainstorm, Summary) */}
              <div className="flex items-center bg-[#171513] p-1 rounded-xl border border-[#38322D] text-xs overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: "reflection", label: "Reflect", icon: Sparkles },
                    { id: "chat", label: "Chat", icon: MessageSquare },
                    { id: "brainstorm", label: "Brainstorm", icon: Lightbulb },
                    { id: "summary", label: "Summary", icon: FileText },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setMode(id as JournalMode);
                      if (onUpdateMode && activeEntry) onUpdateMode(id as JournalMode);
                    }}
                    title={
                      id === "chat"
                        ? "Natural Conversation: Talk freely without unsolicited activity recommendations"
                        : id === "reflection"
                        ? "Mindful Reflection: Cognitive reframing and emotional listening"
                        : id === "brainstorm"
                        ? "Brainstorming: Ideas, habits & routines"
                        : "Summary: Structured takeaways & synthesis"
                    }
                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer text-xs ${
                      mode === id
                        ? "bg-[#292420] text-[#C89B3C] border border-[#38322D] shadow-xs"
                        : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Depth Selector (Quick, Reflect, Deep) */}
              <div className="flex items-center bg-[#171513] p-1 rounded-xl border border-[#38322D] text-xs">
                {(["quick", "reflect", "deep"] as ReflectionDepth[]).map((d) => {
                  const isSelected = depth === d;
                  const cfg = DEPTH_CONFIG[d];
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDepth(d);
                        if (onUpdateDepth && activeEntry) onUpdateDepth(d);
                      }}
                      title={`${cfg.label} Mode (${cfg.model}): ${cfg.desc}`}
                      className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-[#C89B3C] text-[#171513] shadow-xs"
                          : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                      }`}
                    >
                      <span>{d}</span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded font-normal hidden sm:inline ${
                          isSelected ? "bg-[#171513]/25 text-[#171513]" : "bg-[#2A2622] text-[#8C847B]"
                        }`}
                      >
                        {cfg.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Calendar Shortcut */}
              {onOpenCalendar && (
                <button
                  id="journal-calendar-shortcut-btn"
                  onClick={onOpenCalendar}
                  className="p-2 rounded-xl bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] hover:border-[#C89B3C] transition-colors border border-[#38322D] cursor-pointer"
                  title="Open Schedule & Calendar"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              )}

              {/* Focus Reading View Toggle */}
              <button
                id="toggle-reading-view-btn"
                onClick={() => setExpandReadingView(!expandReadingView)}
                className={`p-2 rounded-xl transition-colors border cursor-pointer ${
                  expandReadingView
                    ? "bg-[#C89B3C]/20 text-[#C89B3C] border-[#C89B3C]"
                    : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border-[#38322D]"
                }`}
                title={expandReadingView ? "Exit Focus Reading View" : "Enter Focus Reading View"}
              >
                {expandReadingView ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Toggle Metadata Panel */}
              <button
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                className={`p-2 rounded-xl transition-colors border cursor-pointer ${
                  showDetailsPanel
                    ? "bg-[#C89B3C]/20 text-[#C89B3C] border-[#C89B3C]"
                    : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border-[#38322D]"
                }`}
                title="Toggle Mood & Tags Context"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Collapse Header Button */}
              <button
                id="collapse-header-btn"
                onClick={() => setIsHeaderCollapsed(true)}
                className="p-2 rounded-xl bg-[#171513] text-[#B7AFA7] hover:text-[#C89B3C] hover:border-[#C89B3C] transition-colors border border-[#38322D] cursor-pointer"
                title="Collapse Header (Hide controls to maximize reading space)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        {/* Active Grounding Indicator (Grounds reflections, insights, and recommendations) */}
        <div className="px-4 lg:px-6 py-2 bg-[#1C1A17] border-b border-[#2C2723] flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[#C89B3C] font-semibold text-[11px] bg-[#C89B3C]/10 border border-[#C89B3C]/20 px-2.5 py-0.5 rounded-full">
              <Sparkle className="w-3 h-3" />
              AI Grounding Active
            </span>
            {todayCheckIn ? (
              <span className="text-[11px] text-[#D8D1C7]">
                Check-in: <strong className="capitalize text-[#F3EFE8]">{todayCheckIn.mood}</strong> (Energy {todayCheckIn.energy}/5, Stress {todayCheckIn.stress}/5)
                {todayCheckIn.notes && <span className="text-[#A69E95] italic"> — "{todayCheckIn.notes.slice(0, 40)}{todayCheckIn.notes.length > 40 ? '...' : ''}"</span>}
              </span>
            ) : (
              <span className="text-[11px] text-[#A69E95]">
                No check-in submitted yet today
              </span>
            )}
            {user.profile?.primaryGoals && user.profile.primaryGoals.length > 0 && (
              <span className="hidden md:inline text-[11px] text-[#8C847B]">
                • Goal: {user.profile.primaryGoals[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#A69E95]">
            <span className="hidden md:inline text-[#7A746E]">
              Grounding:
            </span>
            <span className="font-mono text-[#C89B3C] bg-[#171513] px-2 py-0.5 rounded border border-[#38322D]">
              {DEPTH_CONFIG[depth].label} ({DEPTH_CONFIG[depth].model})
            </span>
          </div>
        </div>

        {/* Save Error Notice */}
        {saveError && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#3B1E1E] border border-[#5E2B2B] text-[#F8B4B4] text-xs flex items-center justify-between gap-3 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E57373] shrink-0" />
              <p className="font-medium">{saveError}</p>
            </div>
            <button
              onClick={onRetrySave}
              className="flex items-center gap-1 px-3 py-1 bg-[#211E1B] border border-[#5E2B2B] rounded-xl text-xs font-bold text-[#F8B4B4] hover:bg-[#3B1E1E] transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Center Scrollable Area: Centered layout with balanced margins like ChatGPT / Gemini */}
        <div className={`flex-1 overflow-y-auto py-6 space-y-6 transition-all w-full mx-auto ${
          expandReadingView ? "max-w-5xl px-4 sm:px-8 lg:px-12" : "max-w-4xl px-4 sm:px-6 lg:px-8"
        }`}>
          {/* Optional Details / Domains / Mood Strip */}
          {showDetailsPanel && (
            <div className="bg-[#211E1B] rounded-3xl p-5 border border-[#38322D] shadow-md space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Domain Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-[#B7AFA7] mr-1">Domains:</span>
                  {DOMAINS.map((d) => {
                    const isSelected = selectedDomains.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDomain(d.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#6E9A7B] text-white shadow-xs"
                            : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D]"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                {/* Mood Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-[#B7AFA7] mr-1">Mood:</span>
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEntryMood(m.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        entryMood === m.id
                          ? "bg-[#C89B3C]/20 border border-[#C89B3C] text-[#F3EFE8] shadow-xs"
                          : "bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D]"
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span className="capitalize">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Input */}
              <div className="flex items-center gap-2 pt-3 border-t border-[#38322D]">
                <Tag className="w-3.5 h-3.5 text-[#C89B3C]" />
                <input
                  type="text"
                  placeholder="Custom tags (comma separated, e.g. sleep, deadlines, nature, exercise)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="text-xs text-[#F3EFE8] bg-transparent placeholder-[#7A746E] focus:outline-none w-full"
                />
              </div>
            </div>
          )}

          {/* Conversation History */}
          <div className="space-y-5">
            {(!activeEntry || activeEntry.messages.length === 0) && (
              <div className="text-center py-8 space-y-4 max-w-xl mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] mx-auto shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#F3EFE8]">
                    Mindful Reflection & Recommendation Studio
                  </h3>
                  <p className="text-xs text-[#B7AFA7] mt-1 max-w-md mx-auto leading-relaxed">
                    Write freely about your state of mind, ask for helpful summaries, brainstorm creative routines, or request activity recommendations you can add directly to your Google Calendar.
                  </p>
                </div>

                {/* Prompt Starters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                  {PROMPT_STARTERS.map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(starter.text + " ")}
                      className="p-3.5 rounded-2xl bg-[#211E1B] border border-[#38322D] hover:border-[#C89B3C] hover:bg-[#282420] transition-all text-left group shadow-xs cursor-pointer"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#C89B3C] block mb-1">
                        {starter.tag} • {starter.title}
                      </span>
                      <p className="text-xs text-[#B7AFA7] line-clamp-2 leading-relaxed group-hover:text-[#F3EFE8]">
                        {starter.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render Existing Message Turns */}
            {activeEntry?.messages?.map((msg, msgIdx) => {
              const isUser = msg.role === "user";
              const isLatestModelMsg = !isUser && msgIdx === (activeEntry.messages.length - 1);
              const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={msg.id}
                  ref={isLatestModelMsg ? latestMessageRef : undefined}
                  className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#C89B3C]/15 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shrink-0 mt-1 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`transition-all relative group ${
                      isUser
                        ? "max-w-2xl ml-auto bg-[#2A2521] border border-[#443D36] text-[#F3EFE8] rounded-3xl rounded-tr-xs px-5 py-3.5 space-y-2 shadow-sm"
                        : "w-full max-w-3xl lg:max-w-4xl bg-[#211E1B] border border-[#38322D] text-[#FAF7F2] rounded-3xl p-5 sm:p-7 space-y-4 shadow-sm"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#38322D]/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${isUser ? "text-[#C89B3C]" : "text-[#E0A93B]"}`}>
                          {isUser
                            ? user.displayName || "You"
                            : mode === "chat"
                            ? "Gemini"
                            : "Gemini Mindful Guide"}
                        </span>
                        {!isUser && (msg.modelUsed || activeEntry?.modelUsed) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[#171513] text-[#C89B3C] border border-[#38322D]">
                              {msg.modelUsed || activeEntry?.modelUsed}
                            </span>
                            {(msg.depth || activeEntry?.depth) && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider bg-[#2C2723] text-[#A69E95] border border-[#38322D]">
                                {msg.depth || activeEntry?.depth}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#7A746E]">
                          {timeStr}
                        </span>
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="p-1.5 rounded-lg hover:bg-[#171513] text-[#B7AFA7] hover:text-[#F3EFE8] transition-colors cursor-pointer"
                          title="Copy text"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-[#6E9A7B]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Text Body: Large, High-Contrast, Legible Typography with Markdown */}
                    {isUser ? (
                      <div className="text-[15px] sm:text-base leading-relaxed text-[#F3EFE8] whitespace-pre-wrap font-normal">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="py-1">
                        <MarkdownRenderer content={msg.text} />
                      </div>
                    )}

                    {/* Assistant Action Bar beneath markdown */}
                    {!isUser && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#38322D]/50 text-xs text-[#8C847B]">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#171513] hover:text-[#F3EFE8] transition-colors cursor-pointer"
                          title="Copy full response"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#6E9A7B]" />
                              <span className="text-[#6E9A7B] text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[11px]">Copy response</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setInputText("Can you elaborate more on this reflection?");
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#171513] hover:text-[#F3EFE8] transition-colors cursor-pointer"
                          title="Ask follow-up question"
                        >
                          <Sparkles className="w-3 h-3 text-[#C89B3C]" />
                          <span className="text-[11px]">Ask follow-up</span>
                        </button>
                      </div>
                    )}

                    {/* Direct Suggested Activities & Calendar Integration Cards */}
                    {msg.suggestedActivities && msg.suggestedActivities.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#38322D] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarPlus className="w-4 h-4 text-[#C89B3C]" />
                            <h4 className="text-xs font-bold text-[#F3EFE8]">
                              Recommended Activities & Calendar Scheduling
                            </h4>
                          </div>
                          <span className="text-[10px] text-[#B7AFA7]">1-Click Sync</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {msg.suggestedActivities.map((act, actIdx) => {
                            const actKey = `${msg.id}_${actIdx}`;
                            const isScheduled = !!scheduledActivityIds[actKey];
                            const isCurrentlyScheduling = schedulingActivityId === actKey;
                            const parsedSchedule = parseActivityScheduleDateTime(act);

                            return (
                              <div
                                key={actIdx}
                                className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] hover:border-[#484038] transition-all space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#C89B3C]/15 text-[#C89B3C] border border-[#C89B3C]/30">
                                        {act.domain}
                                      </span>
                                      <span className="flex items-center gap-1 text-[10px] text-[#B7AFA7]">
                                        <Clock className="w-3 h-3 text-[#C89B3C]" />
                                        <span>{act.durationMinutes} mins</span>
                                      </span>
                                      <span className="flex items-center gap-1 text-[10px] text-[#6E9A7B] font-semibold bg-[#6E9A7B]/10 px-2 py-0.5 rounded-md border border-[#6E9A7B]/20">
                                        <Calendar className="w-3 h-3" />
                                        <span>{parsedSchedule.explanation.replace("Scheduled for ", "")}</span>
                                      </span>
                                    </div>
                                    <h5 className="text-xs font-bold text-[#F3EFE8]">
                                      {act.title}
                                    </h5>
                                  </div>

                                  {/* Direct Add / Configure Google Calendar Action Button */}
                                  <button
                                    id={`btn-schedule-activity-${actKey}`}
                                    onClick={() => handleOpenScheduleModal(act, actKey)}
                                    disabled={isScheduled || isCurrentlyScheduling}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                                      isScheduled
                                        ? "bg-[#6E9A7B]/20 text-[#6E9A7B] border border-[#6E9A7B]/40"
                                        : "bg-[#C89B3C] text-[#171513] hover:bg-[#b98c2d] shadow-sm disabled:opacity-50"
                                    }`}
                                    title={isScheduled ? "Event created on Google Calendar" : "Click to review date & add to Google Calendar"}
                                  >
                                    {isCurrentlyScheduling ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Scheduling...</span>
                                      </>
                                    ) : isScheduled ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>On Calendar</span>
                                      </>
                                    ) : (
                                      <>
                                        <CalendarPlus className="w-3.5 h-3.5" />
                                        <span>Add to Calendar</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                <p className="text-[11px] text-[#B7AFA7] leading-relaxed">
                                  {act.description}
                                </p>

                                {/* Google Maps Recommended Nearby Places Chips */}
                                {act.recommendedPlaces && act.recommendedPlaces.length > 0 && (
                                  <div className="pt-1 space-y-1">
                                    <div className="flex items-center gap-1 text-[10px] text-[#C89B3C] font-semibold">
                                      <MapPin className="w-3 h-3" />
                                      <span>
                                        Nearest {act.venueQuery ? act.venueQuery : "venues"} (sorted by distance):
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {act.recommendedPlaces.slice(0, 4).map((place) => (
                                        <button
                                          key={place.id}
                                          type="button"
                                          onClick={() => handleOpenScheduleModal(act, actKey)}
                                          className="px-2 py-0.5 rounded-lg bg-[#211E1B] hover:bg-[#2C2723] text-[#E6E1D8] border border-[#38322D] hover:border-[#C89B3C]/50 text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                                          title={`Click to schedule at ${place.name} (${place.address})`}
                                        >
                                          <span className="font-medium truncate max-w-[130px]">{place.name}</span>
                                          {place.distanceKm !== undefined && (
                                            <span className="text-[#C89B3C] font-bold">
                                              {place.distanceKm}km
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {act.reason && (
                                  <div className="p-2 rounded-xl bg-[#211E1B] border border-[#38322D] text-[10px] text-[#C89B3C] flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 shrink-0" />
                                    <span>{act.reason}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Cognitive Analysis Card when available */}
            {activeEntry?.analysis && (
              <div className="max-w-2xl bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 shadow-md space-y-3.5 animate-fade-in ml-11">
                <div className="flex items-center justify-between border-b border-[#38322D] pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F3EFE8]">
                    <Brain className="w-4 h-4 text-[#C89B3C]" />
                    <span>Cognitive Synthesis & Emotional Insights</span>
                  </div>
                  {activeEntry.analysis.sentiment && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C89B3C]/15 border border-[#C89B3C]/30 text-[#C89B3C]">
                      {activeEntry.analysis.sentiment}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {activeEntry.analysis.primaryEmotion && (
                    <div className="p-2.5 rounded-2xl bg-[#171513] border border-[#38322D]">
                      <span className="text-[10px] text-[#7A746E] block font-medium">Primary Emotion</span>
                      <span className="font-bold text-[#F3EFE8] capitalize">
                        {activeEntry.analysis.primaryEmotion}
                      </span>
                    </div>
                  )}
                  {activeEntry.analysis.intensity !== undefined && (
                    <div className="p-2.5 rounded-2xl bg-[#171513] border border-[#38322D]">
                      <span className="text-[10px] text-[#7A746E] block font-medium">Intensity</span>
                      <span className="font-bold text-[#F3EFE8]">
                        {activeEntry.analysis.intensity} / 5
                      </span>
                    </div>
                  )}
                  {activeEntry.summary && (
                    <div className="p-2.5 rounded-2xl bg-[#171513] border border-[#38322D] col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-[#7A746E] block font-medium">Core Takeaway</span>
                      <span className="font-semibold text-[#F3EFE8] line-clamp-1">
                        {activeEntry.summary}
                      </span>
                    </div>
                  )}
                </div>

                {activeEntry.themes && activeEntry.themes.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-[#B7AFA7]">Observed Patterns:</span>
                    {activeEntry.themes.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#171513] border border-[#38322D] text-[#6E9A7B]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generating Shimmer Indicator */}
            {isGenerating && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shrink-0 mt-1 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl rounded-bl-xs p-4 shadow-md flex items-center gap-3 text-xs text-[#B7AFA7]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C89B3C]" />
                  <span>Gemini is synthesizing patterns, brainstorming recommendations, and preparing insights...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* BOTTOM: Sleek, Compact Composer & Reflection Triggers */}
        <footer className="px-3 sm:px-6 py-2.5 bg-[#211E1B]/95 backdrop-blur-md border-t border-[#38322D] shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-[#171513] border border-[#38322D] rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 focus-within:border-[#C89B3C] focus-within:ring-2 focus-within:ring-[#C89B3C]/15 transition-all shadow-md">
              <textarea
                id="journal-composer-input"
                rows={1}
                placeholder={
                  mode === "chat"
                    ? "Chat freely with Gemini (no unsolicited activity recommendations)... (⌘+Enter to send)"
                    : mode === "brainstorm"
                    ? "Brainstorm creative routines, ideas, or habits... (⌘+Enter to brainstorm)"
                    : mode === "summary"
                    ? "Request a structured synthesis of key insights... (⌘+Enter to summarize)"
                    : "Reflect on your thoughts, emotions, or day... (⌘+Enter to reflect)"
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="w-full bg-transparent text-sm text-[#F3EFE8] placeholder-[#7A746E] focus:outline-none resize-none px-2 py-1 min-h-[38px] max-h-32 leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#38322D]/60 px-1">
                {/* Left: Quick Inline Mode Switcher */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {(
                    [
                      { id: "reflection", label: "Reflect", icon: Sparkles, hint: "Mindful listening" },
                      { id: "chat", label: "Chat", icon: MessageSquare, hint: "Casual conversation" },
                      { id: "brainstorm", label: "Brainstorm", icon: Lightbulb, hint: "Creative ideas" },
                      { id: "summary", label: "Summary", icon: FileText, hint: "Key takeaways" },
                    ] as const
                  ).map(({ id, label, icon: Icon, hint }) => {
                    const isActive = mode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setMode(id as JournalMode);
                          if (onUpdateMode && activeEntry) onUpdateMode(id as JournalMode);
                        }}
                        title={hint}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#C89B3C]/20 text-[#C89B3C] border border-[#C89B3C]/35 shadow-xs"
                            : "text-[#8C847B] hover:text-[#D8D1C7] hover:bg-[#201C19]"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                  <span className="text-[10px] text-[#5A544E] hidden md:inline ml-1 font-mono">
                    ⌘+Enter
                  </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Direct Save Note Button */}
                  <button
                    id="save-note-direct-btn"
                    type="button"
                    onClick={handleSaveDirectly}
                    disabled={isSaving || isGenerating || (!inputText.trim() && !title.trim())}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#38322D] text-[11px] font-semibold text-[#B7AFA7] hover:bg-[#211E1B] hover:text-[#F3EFE8] transition-colors disabled:opacity-30 cursor-pointer"
                    title="Save note directly without AI generation"
                  >
                    <Save className="w-3 h-3" />
                    <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
                  </button>

                  {/* Reflect/Chat with Gemini Button */}
                  <button
                    id="reflect-with-gemini-btn"
                    type="button"
                    onClick={handleReflectWithGemini}
                    disabled={isGenerating || !inputText.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-[#C89B3C] text-[#171513] text-xs font-bold hover:bg-[#b98c2d] transition-all shadow-xs disabled:opacity-30 active:scale-98 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{mode === "chat" ? "Replying..." : "Thinking..."}</span>
                      </>
                    ) : (
                      <>
                        {mode === "chat" ? (
                          <MessageSquare className="w-3.5 h-3.5" />
                        ) : mode === "brainstorm" ? (
                          <Lightbulb className="w-3.5 h-3.5" />
                        ) : mode === "summary" ? (
                          <FileText className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {mode === "chat"
                            ? "Send"
                            : mode === "brainstorm"
                            ? "Brainstorm"
                            : mode === "summary"
                            ? "Summarize"
                            : "Reflect"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        title="Delete Reflection Entry"
        message={`Are you sure you want to permanently delete "${deleteModalState.entryTitle}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (deleteModalState.entryId) {
            await onDeleteEntry(deleteModalState.entryId);
          }
          setDeleteModalState({ isOpen: false, entryId: null, entryTitle: "" });
        }}
        onCancel={() => setDeleteModalState({ isOpen: false, entryId: null, entryTitle: "" })}
      />

      {/* Smart Google Calendar Activity Scheduling Modal */}
      <ScheduleActivityModal
        isOpen={modalActivityState.isOpen}
        activity={modalActivityState.activity}
        locationName={[user.profile?.city, user.profile?.province, user.profile?.countryStay]
          .filter(Boolean)
          .join(", ")}
        onClose={() =>
          setModalActivityState({
            isOpen: false,
            activity: null,
            actKey: null,
          })
        }
        onConfirmSchedule={handleConfirmScheduleFromModal}
        isScheduling={!!schedulingActivityId}
      />
    </div>
  );
};
