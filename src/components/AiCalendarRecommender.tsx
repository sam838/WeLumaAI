import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Calendar,
  CalendarPlus,
  RefreshCw,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  Tag,
  Zap,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  AuthUserState,
  DailyCheckInState,
  GoogleCalendarEvent,
  WellbeingActivity,
  WellbeingDomain,
} from "../types";
import {
  getStoredToken,
  fetchWeekEventsFromApi,
  createGoogleCalendarEvent,
  requestGoogleCalendarAuth,
} from "../googleCalendar";
import { authenticatedFetch } from "../api";

interface AiCalendarRecommenderProps {
  user: AuthUserState;
  todayCheckIn: DailyCheckInState | null;
  onSaveToActivities?: (activity: WellbeingActivity) => Promise<void>;
  onScheduleSuccess?: (event: GoogleCalendarEvent) => void;
  onOpenCalendarModal?: () => void;
}

export const AiCalendarRecommender: React.FC<AiCalendarRecommenderProps> = ({
  user,
  todayCheckIn,
  onSaveToActivities,
  onScheduleSuccess,
  onOpenCalendarModal,
}) => {
  // Input parameters for AI Activity Synthesis
  const [customPrompt, setCustomPrompt] = useState("");
  const [currentCondition, setCurrentCondition] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryReasoning, setSummaryReasoning] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<WellbeingActivity[]>([]);

  // Weekly Calendar Events Context state
  const [weeklyEvents, setWeeklyEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isAddingToCalendarId, setIsAddingToCalendarId] = useState<string | null>(null);
  const [scheduledSuccessNotice, setScheduledSuccessNotice] = useState<string | null>(null);
  const [showPreferencesAccordion, setShowPreferencesAccordion] = useState(false);

  // Check Calendar connection & pre-fetch week events
  const loadWeekCalendar = async () => {
    const token = getStoredToken();
    if (!token) {
      setCalendarConnected(false);
      return;
    }
    setIsLoadingCalendar(true);
    try {
      const events = await fetchWeekEventsFromApi(token);
      setWeeklyEvents(events);
      setCalendarConnected(true);
    } catch (err: any) {
      console.warn("Could not load weekly calendar context:", err);
      setCalendarConnected(false);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  useEffect(() => {
    loadWeekCalendar();
  }, []);

  // Connect Google Calendar with popup
  const handleConnectCalendar = async () => {
    try {
      setIsLoadingCalendar(true);
      const auth = await requestGoogleCalendarAuth();
      if (auth.accessToken) {
        setCalendarConnected(true);
        const evts = await fetchWeekEventsFromApi(auth.accessToken);
        setWeeklyEvents(evts);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate with Google Calendar.");
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // Generate AI Recommendations
  const handleGenerateRecommendations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await authenticatedFetch("/api/gemini/recommend-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: customPrompt.trim(),
          condition: currentCondition.trim(),
          userProfile: user.profile || null,
          weeklyEvents: weeklyEvents.slice(0, 15),
          checkIn: todayCheckIn || null,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setSummaryReasoning(data.summaryReasoning || "Personalized activities tailored for you.");
      if (Array.isArray(data.recommendations)) {
        const mapped: WellbeingActivity[] = data.recommendations.map((rec: any, idx: number) => ({
          id: rec.id || `ai_act_${Date.now()}_${idx}`,
          title: rec.title || "Mindful Grounding Activity",
          domain: (rec.domain || "mind") as WellbeingDomain,
          category: rec.category || "Mindfulness",
          description: rec.description || "",
          reason: rec.reason || "Recommended to support balanced focus and wellbeing.",
          energyRequired: rec.energyRequired || "low",
          durationMinutes: Number(rec.durationMinutes) || 15,
          tags: Array.isArray(rec.tags) ? rec.tags : ["AI Suggested", "Mindfulness"],
          suggestedTiming: rec.suggestedTiming,
          locationType: rec.locationType || "home",
          isCustomAiGenerated: true,
          updatedAt: Date.now(),
        }));
        setRecommendations(mapped);
      }
    } catch (err: any) {
      console.error("Failed to generate recommendations:", err);
      setErrorMessage(err.message || "Could not synthesize activity recommendations at this time.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Add Recommended Activity to Google Calendar directly
  const handleAddActivityToCalendar = async (act: WellbeingActivity) => {
    setIsAddingToCalendarId(act.id);
    setScheduledSuccessNotice(null);

    const token = getStoredToken();
    const duration = act.durationMinutes || 20;

    // Suggest start time: today in 30 mins or tomorrow at 9 AM
    const now = new Date();
    const startTime = new Date(now.getTime() + 45 * 60 * 1000); // 45 mins from now
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    try {
      if (token && calendarConnected) {
        const created = await createGoogleCalendarEvent(token, {
          title: `🌿 ${act.title}`,
          description: `${act.description}\n\n• Why this fits: ${act.reason}\n• Energy: ${act.energyRequired}\n• Curated by Good Health Companion`,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isAllDay: false,
          colorId: "2", // Mindfulness green
        });
        setScheduledSuccessNotice(`Scheduled "${act.title}" on your Google Calendar!`);
        if (onScheduleSuccess) onScheduleSuccess(created);
      } else {
        // Fallback notice
        setScheduledSuccessNotice(`Ready to schedule! Connect Google Calendar to sync automatically.`);
      }

      // Also persist to activities if handler provided
      if (onSaveToActivities) {
        await onSaveToActivities({
          ...act,
          isSaved: true,
        });
      }
    } catch (err: any) {
      console.error("Failed to add activity to calendar:", err);
      setErrorMessage(err.message || "Failed to create Google Calendar event.");
    } finally {
      setIsAddingToCalendarId(null);
      setTimeout(() => setScheduledSuccessNotice(null), 4000);
    }
  };

  return (
    <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
      {/* Header with Title & Calendar Sync Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#38322D]">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-serif text-[#F3EFE8] flex items-center gap-2">
              <span>AI Activity Recommender</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C89B3C]/15 border border-[#C89B3C]/30 text-[#C89B3C] font-mono font-normal">
                Weekly Calendar Aware
              </span>
            </h2>
            <p className="text-xs text-[#B7AFA7]">
              Synthesizes tailored wellbeing practices from your weekly load, energy state, and preferences.
            </p>
          </div>
        </div>

        {/* Google Calendar status pill & quick connect */}
        <div className="flex items-center gap-2">
          {calendarConnected ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#171513] border border-[#738F85]/40 text-xs text-[#738F85]">
              <span className="w-2 h-2 rounded-full bg-[#6E9A7B] animate-pulse" />
              <span className="font-mono text-[11px]">
                {weeklyEvents.length} events read this week
              </span>
            </div>
          ) : (
            <button
              id="btn-recommender-connect-calendar"
              type="button"
              onClick={handleConnectCalendar}
              disabled={isLoadingCalendar}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#171513] hover:bg-[#2c2723] border border-[#C89B3C]/40 text-xs text-[#C89B3C] font-semibold transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isLoadingCalendar ? "Syncing..." : "Connect Google Calendar"}</span>
            </button>
          )}

          {onOpenCalendarModal && (
            <button
              id="btn-open-calendar-from-recommender"
              onClick={onOpenCalendarModal}
              className="p-1.5 rounded-xl bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] text-[#B7AFA7] hover:text-[#F3EFE8] cursor-pointer"
              title="Open Full Calendar Viewer"
            >
              <CalendarPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Condition / Prompt Input Form */}
      <form onSubmit={handleGenerateRecommendations} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#B7AFA7] mb-1.5">
              Specific Prompt / Goal (Optional)
            </label>
            <input
              id="input-recommender-prompt"
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Need a light outdoor recharge after long screen meetings"
              className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#B7AFA7] mb-1.5">
              Current Physical / Mental Condition
            </label>
            <input
              id="input-recommender-condition"
              type="text"
              value={currentCondition}
              onChange={(e) => setCurrentCondition(e.target.value)}
              placeholder="e.g. Mild headache, 30-min gap before next call, feeling sluggish"
              className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
            />
          </div>
        </div>

        {/* Quick context summary badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center space-x-2 text-[#B7AFA7] text-[11px]">
            <span>Active Context:</span>
            {todayCheckIn ? (
              <span className="px-2 py-0.5 rounded-md bg-[#171513] border border-[#38322D] text-[#C89B3C]">
                Mood: {todayCheckIn.mood} • Energy: {todayCheckIn.energy}/5 • Stress: {todayCheckIn.stress}/5
              </span>
            ) : (
              <span className="italic">No check-in recorded today (defaults active)</span>
            )}
          </div>

          <button
            id="btn-generate-ai-recommendations"
            type="submit"
            disabled={isGenerating}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing Context...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recommend Activities</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-3 bg-[#B86B6B]/15 border border-[#B86B6B]/40 rounded-2xl text-xs text-[#B86B6B] flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {scheduledSuccessNotice && (
        <div className="p-3 bg-[#6E9A7B]/15 border border-[#6E9A7B]/40 rounded-2xl text-xs text-[#6E9A7B] flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{scheduledSuccessNotice}</span>
        </div>
      )}

      {/* AI Recommendation Output Results */}
      {summaryReasoning && (
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-[#C89B3C]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Contextual Recommendation Summary</span>
            </div>
            <p className="text-[#F3EFE8] leading-relaxed italic text-[11px]">
              "{summaryReasoning}"
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                id={`ai-rec-card-${rec.id}`}
                className="bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/50 rounded-2xl p-4.5 flex flex-col justify-between space-y-3.5 transition-all shadow-md group"
              >
                <div className="space-y-2.5">
                  {/* Category & Suggested Timing */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-[#211E1B] text-[#C89B3C] border border-[#38322D] font-mono text-[10px] uppercase">
                      {rec.category} • {rec.domain}
                    </span>
                    <span className="text-[10px] text-[#738F85] flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>{rec.durationMinutes} min</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold font-serif text-[#F3EFE8] group-hover:text-[#C89B3C] transition-colors">
                    {rec.title}
                  </h3>

                  <p className="text-xs text-[#B7AFA7] leading-relaxed line-clamp-3">
                    {rec.description}
                  </p>

                  {/* Why this fits reason */}
                  <div className="p-2 rounded-xl bg-[#211E1B] border border-[#38322D] text-[11px] space-y-0.5">
                    <span className="text-[10px] font-semibold text-[#6E9A7B] block">
                      Why this fits your schedule:
                    </span>
                    <p className="text-[#B7AFA7] italic">
                      "{rec.reason}"
                    </p>
                  </div>

                  {rec.suggestedTiming && (
                    <div className="text-[10px] text-[#C89B3C]/80 font-mono">
                      💡 Suggested: {rec.suggestedTiming}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-[#38322D] flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1 text-[10px] text-[#B7AFA7]">
                    <Zap className="w-3 h-3 text-[#C89B3C]" />
                    <span className="capitalize">{rec.energyRequired} energy</span>
                  </div>

                  <button
                    id={`btn-schedule-activity-${rec.id}`}
                    onClick={() => handleAddActivityToCalendar(rec)}
                    disabled={isAddingToCalendarId === rec.id}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#2c2723] hover:bg-[#C89B3C] hover:text-[#171513] text-[#F3EFE8] border border-[#38322D] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>
                      {isAddingToCalendarId === rec.id ? "Adding..." : "Add to Calendar"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
