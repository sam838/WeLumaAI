import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Lightbulb,
  MessageSquare,
  FileText,
  Trash2,
  X,
  Zap,
  Brain,
  Filter,
} from "lucide-react";
import { JournalInteraction, JournalMode, ReflectionDepth } from "../types";

interface HistorySidebarProps {
  interactions: JournalInteraction[];
  activeId: string | null;
  onSelectInteraction: (id: string) => void;
  onNewEntry: () => void;
  onDeleteInteraction: (id: string, e: React.MouseEvent) => void;
  onCloseMobile?: () => void;
  onOpenCalendar?: () => void;
}

const MODE_ICONS: Record<JournalMode, React.ReactNode> = {
  reflection: <Sparkles className="w-3 h-3 text-[#C89B3C]" />,
  summary: <FileText className="w-3 h-3 text-[#738F85]" />,
  brainstorm: <Lightbulb className="w-3 h-3 text-[#6E9A7B]" />,
  chat: <MessageSquare className="w-3 h-3 text-[#C89B3C]" />,
};

const MODE_LABELS: Record<JournalMode, string> = {
  reflection: "Reflection",
  summary: "Summary",
  brainstorm: "Brainstorm",
  chat: "Dialogue",
};

const DEPTH_ICONS: Record<ReflectionDepth, React.ReactNode> = {
  quick: <Zap className="w-2.5 h-2.5 text-[#C89B3C]" />,
  reflect: <Sparkles className="w-2.5 h-2.5 text-[#738F85]" />,
  deep: <Brain className="w-2.5 h-2.5 text-[#C89B3C]" />,
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  interactions,
  activeId,
  onSelectInteraction,
  onNewEntry,
  onDeleteInteraction,
  onCloseMobile,
  onOpenCalendar,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | JournalMode | ReflectionDepth>("all");

  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      if (selectedFilter !== "all") {
        const matchesMode = item.mode === selectedFilter;
        const matchesDepth = item.depth === selectedFilter;
        if (!matchesMode && !matchesDepth) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const titleMatch = (item.title || "").toLowerCase().includes(q);
      const summaryMatch = (item.summary || "").toLowerCase().includes(q);
      const themesMatch = (item.themes || []).some((t) => t.toLowerCase().includes(q));
      const messageMatch = (item.messages || []).some((m) => m.text.toLowerCase().includes(q));

      return titleMatch || summaryMatch || themesMatch || messageMatch;
    });
  }, [interactions, searchQuery, selectedFilter]);

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <aside className="w-full md:w-80 lg:w-88 h-full bg-[#211E1B] border-r border-[#38322D] flex flex-col shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#38322D] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#C89B3C]" />
            <h2 className="font-semibold text-sm text-[#F3EFE8]">Reflections Log</h2>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#171513] text-[#B7AFA7] border border-[#38322D]">
              {interactions.length} entries
            </span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 text-[#B7AFA7] hover:text-[#F3EFE8]"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Action Buttons: New Entry & Google Calendar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            id="btn-new-entry"
            onClick={onNewEntry}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Entry</span>
          </button>

          {onOpenCalendar && (
            <button
              id="btn-sidebar-calendar"
              onClick={onOpenCalendar}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] hover:border-[#C89B3C]/50 text-[#F3EFE8] font-medium text-xs transition-colors cursor-pointer"
              title="View Google Calendar & Today's Reminders"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C89B3C]" />
              <span>Calendar</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#B7AFA7]" />
          <input
            id="input-search-entries"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past entries..."
            className="w-full pl-8 pr-7 py-1.5 bg-[#171513] border border-[#38322D] rounded-lg text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/60 focus:outline-none focus:border-[#C89B3C]/60 transition-colors"
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

        {/* Optional Filter Selector with explicit All button */}
        <div className="flex items-center justify-between text-[11px] text-[#B7AFA7] pt-1">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 no-scrollbar w-full">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === "all"
                  ? "bg-[#C89B3C]/20 border border-[#C89B3C]/50 text-[#C89B3C] font-semibold"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723]"
              }`}
            >
              All ({interactions.length})
            </button>
            <button
              onClick={() => setSelectedFilter("quick")}
              className={`px-2 py-1 rounded-md whitespace-nowrap flex items-center space-x-1 transition-colors cursor-pointer ${
                selectedFilter === "quick"
                  ? "bg-[#36302b] text-[#F3EFE8] border border-[#38322D] font-semibold"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723]"
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-[#C89B3C]" />
              <span>Quick</span>
            </button>
            <button
              onClick={() => setSelectedFilter("reflect")}
              className={`px-2 py-1 rounded-md whitespace-nowrap flex items-center space-x-1 transition-colors cursor-pointer ${
                selectedFilter === "reflect"
                  ? "bg-[#36302b] text-[#F3EFE8] border border-[#38322D] font-semibold"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723]"
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 text-[#738F85]" />
              <span>Reflect</span>
            </button>
            <button
              onClick={() => setSelectedFilter("deep")}
              className={`px-2 py-1 rounded-md whitespace-nowrap flex items-center space-x-1 transition-colors cursor-pointer ${
                selectedFilter === "deep"
                  ? "bg-[#36302b] text-[#F3EFE8] border border-[#38322D] font-semibold"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723]"
              }`}
            >
              <Brain className="w-2.5 h-2.5 text-[#C89B3C]" />
              <span>Deep</span>
            </button>
          </div>
        </div>

        {selectedFilter !== "all" && (
          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#171513] border border-[#38322D] text-[11px] text-[#B7AFA7]">
            <span>
              Filtered by: <strong className="text-[#C89B3C] capitalize">{selectedFilter}</strong> ({filteredInteractions.length})
            </span>
            <button
              onClick={() => setSelectedFilter("all")}
              className="text-[#B7AFA7] hover:text-[#F3EFE8] underline cursor-pointer"
            >
              Show all
            </button>
          </div>
        )}
      </div>

      {/* Interactions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredInteractions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Calendar className="w-8 h-8 mx-auto text-[#B7AFA7]/40 mb-2" />
            <p className="text-xs font-medium text-[#B7AFA7]">
              {searchQuery || selectedFilter !== "all"
                ? "No matching reflections found"
                : "No entries recorded yet"}
            </p>
            <p className="text-[11px] text-[#B7AFA7]/80 mt-1 max-w-[200px] mx-auto">
              {searchQuery || selectedFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedFilter("all");
                  }}
                  className="text-[#C89B3C] hover:underline mt-2 inline-block cursor-pointer"
                >
                  Clear search & filters
                </button>
              ) : (
                "Write your thoughts in the editor to record and reflect."
              )}
            </p>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const isActive = activeId === item.id;
            const previewText =
              item.summary ||
              (item.messages && item.messages.length > 0 ? item.messages[0].text : "Journal draft");

            const depth = item.depth || "reflect";

            return (
              <div
                key={item.id}
                id={`entry-item-${item.id}`}
                onClick={() => onSelectInteraction(item.id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#2c2723] border-[#C89B3C]/50 shadow-sm"
                    : "bg-[#171513]/60 border-[#38322D] hover:bg-[#2c2723] hover:border-[#38322D]"
                }`}
              >
                <div className="flex items-start justify-between space-x-2 mb-1.5">
                  <h3
                    className={`text-xs font-semibold truncate flex-1 ${
                      isActive ? "text-[#C89B3C]" : "text-[#F3EFE8] group-hover:text-white"
                    }`}
                  >
                    {item.title || "Untitled Reflection"}
                  </h3>
                  <span className="text-[10px] text-[#B7AFA7] whitespace-nowrap shrink-0">
                    {formatTimestamp(item.updatedAt || item.createdAt)}
                  </span>
                </div>

                <p className="text-[11px] text-[#B7AFA7] line-clamp-2 leading-relaxed mb-2">
                  {previewText}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#B7AFA7]">
                  <div className="flex items-center space-x-1.5">
                    {/* Depth Badge */}
                    <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#171513] border border-[#38322D] text-[#F3EFE8] capitalize">
                      {DEPTH_ICONS[depth]}
                      <span>{depth}</span>
                    </span>

                    {/* Mode Badge */}
                    {item.mode && (
                      <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#171513] border border-[#38322D] text-[#B7AFA7]">
                        {MODE_ICONS[item.mode]}
                        <span>{MODE_LABELS[item.mode] || item.mode}</span>
                      </span>
                    )}

                    {item.messages && item.messages.length > 0 && (
                      <span className="text-[#B7AFA7]">
                        {item.messages.length} {item.messages.length === 1 ? "turn" : "turns"}
                      </span>
                    )}
                  </div>

                  {/* Delete Entry Button */}
                  <button
                    id={`btn-delete-entry-${item.id}`}
                    onClick={(e) => onDeleteInteraction(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#B7AFA7] hover:text-[#B86B6B] hover:bg-[#B86B6B]/15 rounded transition-all cursor-pointer"
                    title="Delete reflection"
                    aria-label={`Delete entry ${item.title}`}
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
  );
};
