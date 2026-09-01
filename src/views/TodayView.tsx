import React, { useState } from "react";
import {
  Sun,
  Smile,
  Zap,
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  BookOpen,
  ArrowRight,
  Sparkles,
  Compass,
  Clock,
  Heart,
  CalendarCheck,
  Check,
} from "lucide-react";
import {
  AuthUserState,
  DailyCheckInState,
  MoodType,
  NavigationTab,
  WellbeingRoutine,
  WellbeingActivity,
} from "../types";
import { getTodayDateString } from "../firebase";

interface TodayViewProps {
  user: AuthUserState;
  routines: WellbeingRoutine[];
  activities: WellbeingActivity[];
  todayCheckIn: DailyCheckInState | null;
  onSaveCheckIn: (checkIn: DailyCheckInState) => void;
  onToggleRoutine: (routineId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onQuickStartJournal: (text: string, mood?: MoodType) => void;
}

const MOODS: { id: MoodType; label: string; icon: string }[] = [
  { id: "calm", label: "Calm", icon: "🌿" },
  { id: "joyful", label: "Joyful", icon: "✨" },
  { id: "reflective", label: "Reflective", icon: "🌊" },
  { id: "grateful", label: "Grateful", icon: "💛" },
  { id: "energized", label: "Energized", icon: "⚡" },
  { id: "neutral", label: "Neutral", icon: "☁️" },
  { id: "anxious", label: "Anxious", icon: "🍃" },
  { id: "drained", label: "Drained", icon: "🌙" },
];

export const TodayView: React.FC<TodayViewProps> = ({
  user,
  routines,
  activities,
  todayCheckIn,
  onSaveCheckIn,
  onToggleRoutine,
  onNavigate,
  onQuickStartJournal,
}) => {
  const todayStr = getTodayDateString();
  const [selectedMood, setSelectedMood] = useState<MoodType>(
    todayCheckIn?.mood || "reflective"
  );
  const [energyLevel, setEnergyLevel] = useState<number>(
    todayCheckIn?.energy || 3
  );
  const [stressLevel, setStressLevel] = useState<number>(
    todayCheckIn?.stress || 2
  );
  const [checkInSavedNotice, setCheckInSavedNotice] = useState(false);
  const [quickJournalText, setQuickJournalText] = useState("");

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const checkIn: DailyCheckInState = {
      date: todayStr,
      mood: selectedMood,
      energy: energyLevel,
      stress: stressLevel,
      updatedAt: Date.now(),
    };
    onSaveCheckIn(checkIn);
    setCheckInSavedNotice(true);
    setTimeout(() => setCheckInSavedNotice(false), 2500);
  };

  const handleQuickJournalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickJournalText.trim()) return;
    onQuickStartJournal(quickJournalText.trim(), selectedMood);
  };

  const completedRoutinesCount = routines.filter((r) => r.completedToday).length;
  const recommendedActivities = activities.slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-[#171513] text-[#F3EFE8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Mindful Welcome Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#211E1B] via-[#24201D] to-[#211E1B] border border-[#38322D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#C89B3C] uppercase tracking-wider">
              <Sun className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE8]">
              Welcome, {user.displayName?.split(" ")[0] || "Explorer"}
            </h1>
            <p className="text-xs sm:text-sm text-[#B7AFA7]">
              Today is an opportunity for mindful presence, gentle movement, and authentic reflection.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              id="btn-today-new-journal"
              onClick={() => onNavigate("journal")}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Open Journal</span>
            </button>
          </div>
        </div>

        {/* 2-Column Grid: Left (Daily Check-in & Routines) / Right (Quick Journal & Activities) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Daily Wellbeing Check-In Card */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                      Daily Wellbeing Check-In
                    </h2>
                    <p className="text-[11px] text-[#B7AFA7]">
                      How does your mind and body feel right now?
                    </p>
                  </div>
                </div>

                {checkInSavedNotice && (
                  <span className="flex items-center space-x-1 text-xs text-[#6E9A7B] font-medium bg-[#6E9A7B]/10 px-2.5 py-1 rounded-full border border-[#6E9A7B]/30">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleCheckInSubmit} className="space-y-4">
                {/* Mood Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#B7AFA7] mb-2">
                    Current Emotional State
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {MOODS.map((m) => {
                      const isSelected = selectedMood === m.id;
                      return (
                        <button
                          key={m.id}
                          id={`btn-mood-${m.id}`}
                          type="button"
                          onClick={() => setSelectedMood(m.id)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-[#C89B3C]/20 border-[#C89B3C] text-[#F3EFE8] scale-105 shadow-2xs font-semibold"
                              : "bg-[#171513] border-[#38322D] text-[#B7AFA7] hover:border-[#B7AFA7]"
                          }`}
                        >
                          <span className="text-base mb-0.5">{m.icon}</span>
                          <span className="text-[10px] truncate max-w-[50px]">
                            {m.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Energy & Stress Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Energy */}
                  <div className="p-3 bg-[#171513] rounded-2xl border border-[#38322D] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-[#B7AFA7] font-medium">
                        <Zap className="w-3.5 h-3.5 text-[#C89B3C]" />
                        <span>Energy Level</span>
                      </span>
                      <span className="font-bold text-[#C89B3C]">{energyLevel} / 5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={energyLevel}
                      onChange={(e) => setEnergyLevel(Number(e.target.value))}
                      className="w-full accent-[#C89B3C] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#B7AFA7]">
                      <span>Depleted</span>
                      <span>Balanced</span>
                      <span>Vibrant</span>
                    </div>
                  </div>

                  {/* Stress */}
                  <div className="p-3 bg-[#171513] rounded-2xl border border-[#38322D] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center space-x-1.5 text-[#B7AFA7] font-medium">
                        <Flame className="w-3.5 h-3.5 text-[#738F85]" />
                        <span>Stress Level</span>
                      </span>
                      <span className="font-bold text-[#738F85]">{stressLevel} / 5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={stressLevel}
                      onChange={(e) => setStressLevel(Number(e.target.value))}
                      className="w-full accent-[#738F85] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#B7AFA7]">
                      <span>Serene</span>
                      <span>Moderate</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    id="btn-save-checkin"
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2c2723] hover:bg-[#38322D] text-[#F3EFE8] border border-[#38322D] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-[#C89B3C]" />
                    <span>Record Check-In</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Today's Sustainable Routines */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#738F85]/10 border border-[#738F85]/30 flex items-center justify-center text-[#738F85]">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                      Today's Sustainable Routines
                    </h2>
                    <p className="text-[11px] text-[#B7AFA7]">
                      {completedRoutinesCount} of {routines.length} completed
                    </p>
                  </div>
                </div>

                <button
                  id="btn-today-manage-routines"
                  onClick={() => onNavigate("planner")}
                  className="flex items-center space-x-1 text-xs text-[#C89B3C] hover:text-[#b98c2d] font-semibold cursor-pointer"
                >
                  <span>Manage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {routines.length === 0 ? (
                <div className="p-6 text-center bg-[#171513] rounded-2xl border border-[#38322D] space-y-2">
                  <p className="text-xs text-[#B7AFA7]">
                    No routines created for today yet.
                  </p>
                  <button
                    onClick={() => onNavigate("planner")}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#C89B3C] text-[#171513] rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create a Routine</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {routines.map((routine) => (
                    <div
                      key={routine.id}
                      id={`routine-item-${routine.id}`}
                      onClick={() => onToggleRoutine(routine.id)}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        routine.completedToday
                          ? "bg-[#171513]/40 border-[#38322D] opacity-75"
                          : "bg-[#171513] border-[#38322D] hover:border-[#C89B3C]/50"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                            routine.completedToday
                              ? "bg-[#6E9A7B] text-white"
                              : "border border-[#38322D] text-transparent hover:border-[#B7AFA7]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <p
                            className={`text-xs font-semibold ${
                              routine.completedToday
                                ? "line-through text-[#B7AFA7]"
                                : "text-[#F3EFE8]"
                            }`}
                          >
                            {routine.name}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-[#B7AFA7] mt-0.5">
                            <span className="capitalize text-[#C89B3C]">
                              {routine.domain}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{routine.timeOfDay}</span>
                            <span>•</span>
                            <span>{routine.durationMinutes} min</span>
                          </div>
                        </div>
                      </div>

                      {routine.targetTime && (
                        <span className="text-[11px] font-mono text-[#B7AFA7] bg-[#211E1B] px-2 py-0.5 rounded-md border border-[#38322D]">
                          {routine.targetTime}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 3. Quick Reflection Box */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-md">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-[#38322D]">
                <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Quick Reflection
                  </h2>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Capture an observation or intention
                  </p>
                </div>
              </div>

              <form onSubmit={handleQuickJournalSubmit} className="space-y-3">
                <textarea
                  id="input-quick-journal"
                  rows={3}
                  value={quickJournalText}
                  onChange={(e) => setQuickJournalText(e.target.value)}
                  placeholder="What is present in your mind right now? A realization, grateful moment, or current focus..."
                  className="w-full p-3 bg-[#171513] border border-[#38322D] rounded-2xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60 leading-relaxed resize-none"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#B7AFA7]">
                    Continues into full Journal Studio
                  </span>
                  <button
                    id="btn-submit-quick-journal"
                    type="submit"
                    disabled={!quickJournalText.trim()}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-40 text-[#171513] text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Write & Reflect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* 4. Suggested Grounding Activities */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#6E9A7B]/10 border border-[#6E9A7B]/30 flex items-center justify-center text-[#6E9A7B]">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                      Mindful Practices for Today
                    </h2>
                    <p className="text-[11px] text-[#B7AFA7]">
                      Curated wellbeing suggestions
                    </p>
                  </div>
                </div>

                <button
                  id="btn-today-view-all-activities"
                  onClick={() => onNavigate("activities")}
                  className="text-xs text-[#C89B3C] hover:underline font-semibold cursor-pointer"
                >
                  Explore All
                </button>
              </div>

              <div className="space-y-2.5">
                {recommendedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 bg-[#171513] rounded-2xl border border-[#38322D] hover:border-[#C89B3C]/40 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-[#F3EFE8]">
                        {act.title}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#211E1B] border border-[#38322D] text-[#C89B3C] shrink-0 font-medium capitalize">
                        {act.domain}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#B7AFA7] line-clamp-2 leading-relaxed">
                      {act.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-[#B7AFA7] pt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-[#738F85]" />
                        <span>{act.durationMinutes} min</span>
                      </span>
                      <span className="italic text-[#C89B3C]/80">
                        {act.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Mindful Principle Highlight */}
            <div className="p-4 rounded-2xl bg-[#C89B3C]/5 border border-[#C89B3C]/25 flex items-start space-x-3 text-xs">
              <Sparkles className="w-4 h-4 text-[#C89B3C] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#C89B3C]">
                  Mindful Grounding Focus
                </p>
                <p className="text-[#B7AFA7] leading-relaxed">
                  "Progress in wellbeing isn't measured in rigid perfection, but in returning gently to awareness and sustainable habits."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
