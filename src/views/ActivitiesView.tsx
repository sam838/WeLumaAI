import React, { useState, useMemo } from "react";
import {
  Compass,
  Bookmark,
  BookmarkCheck,
  Clock,
  Zap,
  Filter,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Info,
  Sparkles,
  Search,
  Plus,
  Calendar,
} from "lucide-react";
import {
  ActivityFeedbackType,
  AuthUserState,
  DailyCheckInState,
  GoogleCalendarEvent,
  NavigationTab,
  WellbeingActivity,
  WellbeingDomain,
} from "../types";
import { AiCalendarRecommender } from "../components/AiCalendarRecommender";

interface ActivitiesViewProps {
  user: AuthUserState;
  todayCheckIn: DailyCheckInState | null;
  activities: WellbeingActivity[];
  onSaveFeedback: (activity: WellbeingActivity) => Promise<void>;
  onNavigate: (tab: NavigationTab) => void;
  onQuickStartJournalWithActivity?: (activityTitle: string) => void;
  onOpenCalendarModal?: () => void;
}

const DOMAINS: { id: WellbeingDomain | "all"; label: string }[] = [
  { id: "all", label: "All Domains" },
  { id: "mind", label: "Mind" },
  { id: "body", label: "Body" },
  { id: "life", label: "Life" },
  { id: "connection", label: "Connection" },
];

const ENERGY_FILTERS: ("all" | "low" | "medium" | "high")[] = [
  "all",
  "low",
  "medium",
  "high",
];

const FEEDBACK_OPTIONS: { id: ActivityFeedbackType; label: string }[] = [
  { id: "interested", label: "Interested" },
  { id: "already_do", label: "Already do this" },
  { id: "not_interested", label: "Not for me" },
  { id: "too_far", label: "Too far / inaccessible" },
  { id: "wrong_time", label: "Wrong time" },
  { id: "dont_recommend_again", label: "Don't recommend again" },
];

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  user,
  todayCheckIn,
  activities,
  onSaveFeedback,
  onNavigate,
  onQuickStartJournalWithActivity,
  onOpenCalendarModal,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<WellbeingDomain | "all">("all");
  const [selectedEnergy, setSelectedEnergy] = useState<"all" | "low" | "medium" | "high">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "saved">("catalog");
  const [feedbackSuccessNotice, setFeedbackSuccessNotice] = useState<string | null>(null);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (activeTab === "saved" && !act.isSaved) return false;
      if (selectedDomain !== "all" && act.domain !== selectedDomain) return false;
      if (selectedEnergy !== "all" && act.energyRequired !== selectedEnergy) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        act.title.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q) ||
        act.category.toLowerCase().includes(q) ||
        act.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activities, activeTab, selectedDomain, selectedEnergy, searchQuery]);

  const handleFeedbackClick = async (
    activity: WellbeingActivity,
    feedbackType: ActivityFeedbackType
  ) => {
    const updated: WellbeingActivity = {
      ...activity,
      feedback: feedbackType,
    };
    await onSaveFeedback(updated);
    setFeedbackSuccessNotice(`Recorded feedback for "${activity.title}".`);
    setTimeout(() => setFeedbackSuccessNotice(null), 3000);
  };

  const handleToggleBookmark = async (activity: WellbeingActivity) => {
    const updated: WellbeingActivity = {
      ...activity,
      isSaved: !activity.isSaved,
    };
    await onSaveFeedback(updated);
    setFeedbackSuccessNotice(
      updated.isSaved
        ? `Saved "${activity.title}" to your grounding practices.`
        : `Removed "${activity.title}" from saved practices.`
    );
    setTimeout(() => setFeedbackSuccessNotice(null), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#171513] text-[#F3EFE8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#211E1B] border border-[#38322D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#6E9A7B] uppercase tracking-wider">
              <Compass className="w-4 h-4" />
              <span>Wellbeing Discovery & Activities</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE8]">
              Wellbeing Practices & Hobbies
            </h1>
            <p className="text-xs sm:text-sm text-[#B7AFA7]">
              Explore explainable wellbeing practices and synthesize custom AI recommendations grounded in your weekly schedule.
            </p>
          </div>

          {/* Action Tools: Full Calendar & Tab Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenCalendarModal && (
              <button
                id="btn-activities-open-calendar"
                onClick={onOpenCalendarModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-[#171513] hover:bg-[#2c2723] border border-[#C89B3C]/50 text-xs font-semibold text-[#C89B3C] transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Google Calendar Hub</span>
              </button>
            )}

            <div className="flex items-center space-x-1 bg-[#171513] p-1.5 rounded-2xl border border-[#38322D] shrink-0 text-xs">
              <button
                id="btn-tab-activities-catalog"
                onClick={() => setActiveTab("catalog")}
                className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === "catalog"
                    ? "bg-[#C89B3C] text-[#171513] shadow-xs"
                    : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                }`}
              >
                All Practices
              </button>
              <button
                id="btn-tab-activities-saved"
                onClick={() => setActiveTab("saved")}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === "saved"
                    ? "bg-[#6E9A7B] text-white shadow-xs"
                    : "text-[#B7AFA7] hover:text-[#F3EFE8]"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved ({activities.filter((a) => a.isSaved).length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Weekly Calendar Aware Recommender Box */}
        <AiCalendarRecommender
          user={user}
          todayCheckIn={todayCheckIn}
          onSaveToActivities={onSaveFeedback}
          onOpenCalendarModal={onOpenCalendarModal}
        />

        {/* Feedback Alert Notice */}
        {feedbackSuccessNotice && (
          <div className="p-3 bg-[#6E9A7B]/15 border border-[#6E9A7B]/40 rounded-2xl text-xs text-[#6E9A7B] flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackSuccessNotice}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-[#211E1B] border border-[#38322D] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          {/* Domain Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                id={`btn-filter-domain-${d.id}`}
                onClick={() => setSelectedDomain(d.id)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedDomain === d.id
                    ? "bg-[#2c2723] text-[#C89B3C] border-[#C89B3C]/50 font-semibold"
                    : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#B7AFA7]" />
            <input
              id="input-search-activities"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search practices, sports..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
            />
          </div>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredActivities.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-[#211E1B] rounded-3xl border border-[#38322D] space-y-2 p-6">
              <Compass className="w-10 h-10 mx-auto text-[#B7AFA7]/40 mb-2" />
              <h3 className="text-sm font-bold text-[#F3EFE8]">
                {activeTab === "saved"
                  ? "No saved grounding practices yet"
                  : "No matching activities found"}
              </h3>
              <p className="text-xs text-[#B7AFA7] max-w-sm mx-auto">
                {activeTab === "saved"
                  ? "Bookmark practices from the catalog to curate your personal grounding rituals."
                  : "Try clearing filters or search queries."}
              </p>
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div
                key={act.id}
                id={`activity-card-${act.id}`}
                className="bg-[#211E1B] border border-[#38322D] hover:border-[#C89B3C]/40 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-md transition-all group"
              >
                <div className="space-y-3">
                  {/* Top line: Category & Bookmark Toggle */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#171513] text-[#C89B3C] border border-[#38322D] font-mono text-[10px] uppercase">
                      {act.category} • {act.domain}
                    </span>
                    <button
                      id={`btn-bookmark-${act.id}`}
                      onClick={() => handleToggleBookmark(act)}
                      className="p-1 text-[#B7AFA7] hover:text-[#C89B3C] transition-colors cursor-pointer"
                      title={act.isSaved ? "Remove from saved" : "Bookmark practice"}
                    >
                      {act.isSaved ? (
                        <BookmarkCheck className="w-4 h-4 text-[#6E9A7B]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold font-serif text-[#F3EFE8] group-hover:text-[#C89B3C] transition-colors">
                      {act.title}
                    </h3>
                    <p className="text-xs text-[#B7AFA7] mt-1 leading-relaxed">
                      {act.description}
                    </p>
                  </div>

                  {/* Explainable Why This Fits Reason (Directive 15) */}
                  <div className="p-2.5 rounded-xl bg-[#171513] border border-[#38322D] space-y-1">
                    <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-[#738F85]">
                      <Sparkles className="w-3 h-3" />
                      <span>Why this fits:</span>
                    </div>
                    <p className="text-[11px] text-[#B7AFA7] leading-relaxed italic">
                      "{act.reason}"
                    </p>
                  </div>
                </div>

                {/* Bottom Meta & Feedback Controls (Directive 16) */}
                <div className="space-y-3 pt-2 border-t border-[#38322D]">
                  <div className="flex items-center justify-between text-[11px] text-[#B7AFA7]">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-[#738F85]" />
                      <span>{act.durationMinutes} min</span>
                    </span>
                    <span className="capitalize text-[#C89B3C]">
                      {act.energyRequired} energy
                    </span>
                  </div>

                  {/* Interactive Feedback Select (Directive 16) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#B7AFA7]">
                      <span>Feedback loop:</span>
                      {act.feedback && (
                        <span className="text-[#6E9A7B] font-semibold capitalize">
                          {act.feedback.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {FEEDBACK_OPTIONS.slice(0, 3).map((fb) => (
                        <button
                          key={fb.id}
                          id={`btn-feedback-${act.id}-${fb.id}`}
                          onClick={() => handleFeedbackClick(act, fb.id)}
                          className={`px-2 py-0.5 rounded-md text-[10px] transition-colors border cursor-pointer ${
                            act.feedback === fb.id
                              ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold"
                              : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                          }`}
                        >
                          {fb.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
