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
} from "lucide-react";
import {
  AuthUserState,
  JournalInteraction,
  JournalMode,
  MoodType,
  ReflectionDepth,
  WellbeingDomain,
} from "../types";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";

interface JournalViewProps {
  user: AuthUserState;
  interactions: JournalInteraction[];
  activeInteractionId: string | null;
  onSelectInteraction: (id: string) => void;
  onNewEntry: () => void;
  onSaveEntry: (entry: JournalInteraction) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
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

export const JournalView: React.FC<JournalViewProps> = ({
  user,
  interactions,
  activeInteractionId,
  onSelectInteraction,
  onNewEntry,
  onSaveEntry,
  onDeleteEntry,
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
  const [rawText, setRawText] = useState("");
  const [mode, setMode] = useState<JournalMode>("reflection");
  const [depth, setDepth] = useState<ReflectionDepth>("reflect");
  const [selectedDomains, setSelectedDomains] = useState<WellbeingDomain[]>(["mind"]);
  const [entryMood, setEntryMood] = useState<MoodType | string>("reflective");
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [stressLevel, setStressLevel] = useState<number>(2);
  const [tagsInput, setTagsInput] = useState<string>("");
  const [justSavedNotice, setJustSavedNotice] = useState(false);

  // Search & Filter State in Sidebar
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | WellbeingDomain>("all");
  const [depthFilter, setDepthFilter] = useState<"all" | ReflectionDepth>("all");
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Populate editor state when active entry changes or initial text is provided
  useEffect(() => {
    if (activeEntry) {
      setTitle(activeEntry.title || "");
      const messageContent =
        activeEntry.rawText ||
        (activeEntry.messages && activeEntry.messages.length > 0
          ? activeEntry.messages.map((m) => m.text).join("\n\n")
          : "");
      setRawText(messageContent);
      setMode(activeEntry.mode || "reflection");
      setDepth(activeEntry.depth || "reflect");
      setSelectedDomains(activeEntry.domains || ["mind"]);
      setEntryMood(activeEntry.mood || "reflective");
      setEnergyLevel(activeEntry.energy || 3);
      setStressLevel(activeEntry.stress || 2);
      setTagsInput(activeEntry.tags ? activeEntry.tags.join(", ") : "");
    } else {
      // New Draft
      setTitle("");
      setRawText(initialDraftText || "");
      setMode("reflection");
      setDepth("reflect");
      setSelectedDomains(["mind"]);
      setEntryMood(initialMood || "reflective");
      setEnergyLevel(3);
      setStressLevel(2);
      setTagsInput("");
    }
  }, [activeEntry, initialDraftText, initialMood]);

  // Toggle domain
  const toggleDomain = (domain: WellbeingDomain) => {
    if (selectedDomains.includes(domain)) {
      if (selectedDomains.length > 1) {
        setSelectedDomains(selectedDomains.filter((d) => d !== domain));
      }
    } else {
      setSelectedDomains([...selectedDomains, domain]);
    }
  };

  // Filtered interactions list
  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      if (domainFilter !== "all") {
        if (!item.domains || !item.domains.includes(domainFilter)) return false;
      }
      if (depthFilter !== "all") {
        if (item.depth !== depthFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = (item.title || "").toLowerCase().includes(q);
      const textMatch = (item.rawText || "").toLowerCase().includes(q);
      const msgMatch = (item.messages || []).some((m) =>
        m.text.toLowerCase().includes(q)
      );
      const tagMatch = (item.tags || []).some((t) => t.toLowerCase().includes(q));
      return titleMatch || textMatch || msgMatch || tagMatch;
    });
  }, [interactions, domainFilter, depthFilter, searchQuery]);

  // Save handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = rawText.trim();
    if (!content || isSaving) return;

    let finalTitle = title.trim();
    if (!finalTitle) {
      finalTitle = content.slice(0, 45) + (content.length > 45 ? "..." : "");
    }

    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const now = Date.now();
    const interactionId = activeEntry?.id || `entry_${now}_${Math.random().toString(36).slice(2, 7)}`;

    const userMessage = {
      id: `msg_${now}`,
      role: "user" as const,
      text: content,
      timestamp: now,
    };

    const entryToSave: JournalInteraction = {
      id: interactionId,
      userId: user.uid,
      title: finalTitle,
      rawText: content,
      mode,
      depth,
      domains: selectedDomains,
      mood: entryMood,
      energy: energyLevel,
      stress: stressLevel,
      tags: tagsArray,
      messages: [userMessage],
      summary: activeEntry?.summary,
      themes: activeEntry?.themes,
      analysis: activeEntry?.analysis,
      createdAt: activeEntry?.createdAt || now,
      updatedAt: now,
    };

    try {
      await onSaveEntry(entryToSave);
      setJustSavedNotice(true);
      setTimeout(() => setJustSavedNotice(false), 3000);
    } catch {
      // Content is preserved in local buffer
    }
  };

  const handleStartNew = () => {
    onNewEntry();
    setTitle("");
    setRawText("");
    setTagsInput("");
  };

  const targetDeleteEntry = useMemo(() => {
    if (!deleteTargetId) return null;
    return interactions.find((it) => it.id === deleteTargetId) || null;
  }, [deleteTargetId, interactions]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#171513] text-[#F3EFE8]">
      {/* 1. History Sidebar */}
      <div
        className={`${
          historySidebarOpen ? "w-80 lg:w-88" : "w-0 hidden md:flex md:w-12"
        } transition-all duration-200 border-r border-[#38322D] bg-[#211E1B] flex flex-col shrink-0 overflow-hidden select-none`}
      >
        {historySidebarOpen ? (
          <div className="flex flex-col h-full">
            {/* Sidebar Top Header */}
            <div className="p-4 border-b border-[#38322D] space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-[#C89B3C]" />
                  <h2 className="font-serif font-bold text-sm text-[#F3EFE8]">
                    Journal Entries
                  </h2>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#171513] text-[#B7AFA7] border border-[#38322D]">
                    {interactions.length}
                  </span>
                </div>

                <button
                  id="btn-sidebar-new-entry"
                  onClick={handleStartNew}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#B7AFA7]" />
                <input
                  id="input-search-journal"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search thoughts, tags..."
                  className="w-full pl-8 pr-7 py-1.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/60 focus:outline-none focus:border-[#C89B3C]/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B7AFA7] hover:text-[#F3EFE8] text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Domain Filter Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-[11px] pb-1">
                <button
                  onClick={() => setDomainFilter("all")}
                  className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    domainFilter === "all"
                      ? "bg-[#C89B3C]/20 border border-[#C89B3C]/50 text-[#C89B3C] font-semibold"
                      : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513]"
                  }`}
                >
                  All
                </button>
                {DOMAINS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDomainFilter(d.id)}
                    className={`px-2 py-0.5 rounded-lg whitespace-nowrap capitalize transition-colors cursor-pointer ${
                      domainFilter === d.id
                        ? "bg-[#36302b] text-[#F3EFE8] border border-[#38322D] font-semibold"
                        : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Entries List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredInteractions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <BookOpen className="w-8 h-8 mx-auto text-[#B7AFA7]/40 mb-2" />
                  <p className="text-xs font-medium text-[#B7AFA7]">
                    {searchQuery || domainFilter !== "all"
                      ? "No matching entries found"
                      : "No reflections recorded yet"}
                  </p>
                  <button
                    onClick={handleStartNew}
                    className="text-xs text-[#C89B3C] hover:underline mt-2 inline-block font-semibold cursor-pointer"
                  >
                    + Write your first reflection
                  </button>
                </div>
              ) : (
                filteredInteractions.map((item) => {
                  const isActive = activeInteractionId === item.id;
                  const preview =
                    item.rawText ||
                    (item.messages && item.messages.length > 0
                      ? item.messages[0].text
                      : "Reflection note");

                  return (
                    <div
                      key={item.id}
                      id={`journal-list-item-${item.id}`}
                      onClick={() => onSelectInteraction(item.id)}
                      className={`group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#2c2723] border-[#C89B3C]/50 shadow-xs"
                          : "bg-[#171513]/60 border-[#38322D] hover:bg-[#2c2723] hover:border-[#38322D]"
                      }`}
                    >
                      <div className="flex items-start justify-between space-x-2 mb-1">
                        <h4
                          className={`text-xs font-semibold truncate flex-1 ${
                            isActive ? "text-[#C89B3C]" : "text-[#F3EFE8] group-hover:text-white"
                          }`}
                        >
                          {item.title || "Untitled Reflection"}
                        </h4>
                        <span className="text-[10px] text-[#B7AFA7] shrink-0 font-mono">
                          {new Date(item.updatedAt || item.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#B7AFA7] line-clamp-2 leading-relaxed mb-2">
                        {preview}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-[#B7AFA7]">
                        <div className="flex items-center space-x-1">
                          {item.domains && item.domains.length > 0 ? (
                            item.domains.map((dom) => (
                              <span
                                key={dom}
                                className="px-1.5 py-0.2 rounded bg-[#171513] text-[#C89B3C] border border-[#38322D] capitalize"
                              >
                                {dom}
                              </span>
                            ))
                          ) : (
                            <span className="capitalize text-[#C89B3C]">mind</span>
                          )}
                          <span className="capitalize text-[#738F85] ml-1">
                            {item.depth || "reflect"}
                          </span>
                        </div>

                        <button
                          id={`btn-delete-entry-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#B7AFA7] hover:text-[#B86B6B] hover:bg-[#B86B6B]/15 rounded transition-all cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 flex flex-col items-center justify-start h-full pt-4 space-y-4">
            <button
              onClick={() => setHistorySidebarOpen(true)}
              className="p-2 rounded-xl text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] cursor-pointer"
              title="Expand History Sidebar"
            >
              <BookOpen className="w-5 h-5 text-[#C89B3C]" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Journal Studio / Editor */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Persistence Error Banner */}
        {saveError && (
          <div className="bg-[#B86B6B]/20 border-b border-[#B86B6B]/50 px-4 py-2.5 text-xs text-[#F3EFE8] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#B86B6B] shrink-0" />
              <span>
                Persistence Note: {saveError} (Draft saved in offline mirror)
              </span>
            </div>
            <button
              onClick={onRetrySave}
              className="flex items-center space-x-1 px-3 py-1 bg-[#B86B6B] hover:bg-[#a65d5d] text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Save</span>
            </button>
          </div>
        )}

        {/* Editor Top Bar: Title, Modes, Domain Selectors */}
        <div className="p-4 sm:px-6 border-b border-[#38322D] bg-[#211E1B] space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Title Input */}
            <div className="flex-1 min-w-0">
              <input
                id="input-journal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Reflection..."
                className="w-full bg-transparent font-serif text-lg sm:text-xl font-bold text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none border-b border-transparent focus:border-[#C89B3C]/60 transition-colors"
              />
              <div className="flex items-center space-x-3 text-[11px] text-[#B7AFA7] mt-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {activeEntry?.updatedAt
                      ? new Date(activeEntry.updatedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "New Draft"}
                  </span>
                </span>

                {justSavedNotice && (
                  <span className="flex items-center space-x-1 text-[#6E9A7B] font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Saved to Cloud Firestore & Local Mirror</span>
                  </span>
                )}
              </div>
            </div>

            {/* Reflection Depth Toggle (Directive 12: Quick, Reflect, Deep) */}
            <div className="flex items-center space-x-1 bg-[#171513] p-1 rounded-xl border border-[#38322D] shrink-0 text-xs">
              <button
                id="btn-journal-depth-quick"
                type="button"
                onClick={() => setDepth("quick")}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  depth === "quick"
                    ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                    : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                }`}
                title="Quick Mode: Fast emotional check-in and low latency note"
              >
                <Zap className="w-3 h-3" />
                <span>Quick</span>
              </button>

              <button
                id="btn-journal-depth-reflect"
                type="button"
                onClick={() => setDepth("reflect")}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  depth === "reflect"
                    ? "bg-[#738F85] text-[#171513] font-semibold shadow-xs"
                    : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                }`}
                title="Reflect Mode: Thoughtful exploration of meaning, feelings and goals"
              >
                <Sparkles className="w-3 h-3" />
                <span>Reflect</span>
              </button>

              <button
                id="btn-journal-depth-deep"
                type="button"
                onClick={() => setDepth("deep")}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  depth === "deep"
                    ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                    : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                }`}
                title="Deep Mode: Deep reasoning across habits, context, and patterns"
              >
                <Brain className="w-3 h-3" />
                <span>Deep</span>
              </button>
            </div>
          </div>

          {/* Metadata Row: Wellbeing Domains & Mood Tag */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
            {/* Wellbeing Domains Selection */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-[#B7AFA7] font-medium mr-1">
                Domain:
              </span>
              {DOMAINS.map((dom) => {
                const isSelected = selectedDomains.includes(dom.id);
                return (
                  <button
                    key={dom.id}
                    id={`btn-domain-${dom.id}`}
                    type="button"
                    onClick={() => toggleDomain(dom.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold"
                        : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                    }`}
                  >
                    {dom.label}
                  </button>
                );
              })}
            </div>

            {/* Mood Picker */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[#B7AFA7]">Mood:</span>
              <select
                id="select-journal-mood"
                value={entryMood}
                onChange={(e) => setEntryMood(e.target.value)}
                className="bg-[#171513] text-[#F3EFE8] border border-[#38322D] rounded-lg px-2 py-1 text-xs outline-none focus:border-[#C89B3C]/60 cursor-pointer"
              >
                {MOOD_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Editor Main Writing Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4">
            <textarea
              id="input-journal-content"
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="What experiences, thoughts, or emotions are on your mind today? Write freely with complete privacy..."
              className="w-full min-h-[340px] bg-transparent text-sm sm:text-base text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none resize-none leading-relaxed font-sans"
            />

            {/* Optional Tags input */}
            <div className="pt-3 border-t border-[#38322D] flex items-center space-x-2 text-xs">
              <Tag className="w-3.5 h-3.5 text-[#B7AFA7]" />
              <input
                id="input-journal-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Optional tags (e.g. sleep, badminton, gratitude, morning)..."
                className="w-full bg-transparent text-[#F3EFE8] placeholder-[#B7AFA7]/40 focus:outline-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Editor Bottom Action Bar */}
        <div className="p-4 border-t border-[#38322D] bg-[#211E1B] shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-[#B7AFA7]">
              <span>{rawText.length} characters</span>
              <span>•</span>
              <span className="capitalize">{depth} reflection mode</span>
            </div>

            <div className="flex items-center space-x-3">
              {activeEntry && (
                <button
                  id="btn-journal-delete-active"
                  type="button"
                  onClick={() => setDeleteTargetId(activeEntry.id)}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs text-[#B86B6B] hover:bg-[#B86B6B]/15 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Entry</span>
                </button>
              )}

              <button
                id="btn-save-journal-entry"
                type="button"
                onClick={() => handleSave()}
                disabled={!rawText.trim() || isSaving}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-40 text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Reflection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Reflection Entry"
        message="Are you sure you want to permanently remove this journal entry? This will delete the entry from both Cloud Firestore and local storage."
        itemName={targetDeleteEntry?.title || "Journal entry"}
        onConfirm={async () => {
          if (deleteTargetId) {
            await onDeleteEntry(deleteTargetId);
            setDeleteTargetId(null);
            handleStartNew();
          }
        }}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
