import React, { useState } from "react";
import {
  CalendarCheck,
  Plus,
  Clock,
  MapPin,
  Bell,
  Trash2,
  Check,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  Sunset,
  X,
  AlertCircle,
} from "lucide-react";
import {
  AuthUserState,
  NavigationTab,
  WellbeingDomain,
  WellbeingRoutine,
} from "../types";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";

interface PlannerViewProps {
  user: AuthUserState;
  routines: WellbeingRoutine[];
  onSaveRoutine: (routine: WellbeingRoutine) => Promise<void>;
  onDeleteRoutine: (routineId: string) => Promise<void>;
  onToggleRoutine: (routineId: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

const DOMAIN_OPTIONS: { id: WellbeingDomain; label: string }[] = [
  { id: "mind", label: "Mind" },
  { id: "body", label: "Body" },
  { id: "life", label: "Life" },
  { id: "connection", label: "Connection" },
];

export const PlannerView: React.FC<PlannerViewProps> = ({
  user,
  routines,
  onSaveRoutine,
  onDeleteRoutine,
  onToggleRoutine,
  onNavigate,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form State for Routine Creator
  const [name, setName] = useState("");
  const [domain, setDomain] = useState<WellbeingDomain>("mind");
  const [timeOfDay, setTimeOfDay] = useState<"morning" | "afternoon" | "evening">("morning");
  const [targetTime, setTargetTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [recurrence, setRecurrence] = useState<"daily" | "weekdays" | "weekends">("daily");
  const [location, setLocation] = useState("Home");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group routines
  const morningRoutines = routines.filter((r) => r.timeOfDay === "morning");
  const afternoonRoutines = routines.filter((r) => r.timeOfDay === "afternoon");
  const eveningRoutines = routines.filter((r) => r.timeOfDay === "evening" || r.timeOfDay === "anytime");

  const handleCreateRoutineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const now = Date.now();
    const newRoutine: WellbeingRoutine = {
      id: `routine_${now}_${Math.random().toString(36).slice(2, 6)}`,
      userId: user.uid,
      name: name.trim(),
      domain,
      timeOfDay,
      targetTime,
      durationMinutes,
      recurrence,
      daysOfWeek: recurrence === "weekdays" ? [1, 2, 3, 4, 5] : recurrence === "weekends" ? [0, 6] : [0, 1, 2, 3, 4, 5, 6],
      reminderEnabled,
      location: location.trim() || undefined,
      completedToday: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await onSaveRoutine(newRoutine);
      setCreateModalOpen(false);
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetDeleteRoutine = routines.find((r) => r.id === deleteTargetId);

  return (
    <div className="flex-1 overflow-y-auto bg-[#171513] text-[#F3EFE8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#211E1B] border border-[#38322D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#738F85] uppercase tracking-wider">
              <CalendarCheck className="w-4 h-4" />
              <span>Routine System • Directive 17</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE8]">
              Mindful Habit & Routine Planner
            </h1>
            <p className="text-xs sm:text-sm text-[#B7AFA7]">
              Build sustainable daily rhythms and manage your wellbeing schedule without overwhelm.
            </p>
          </div>

          <button
            id="btn-open-create-routine"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Routine</span>
          </button>
        </div>

        {/* 2-Column Grid: Left (Time-of-day Routine Schedule) / Right (Connected Calendar Preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Grouped Routines */}
          <div className="lg:col-span-7 space-y-6">
            {/* Morning Section */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <Sun className="w-4 h-4 text-[#C89B3C]" />
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Morning Rhythms
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#B7AFA7]">
                  {morningRoutines.length} items
                </span>
              </div>

              {morningRoutines.length === 0 ? (
                <p className="text-xs text-[#B7AFA7] italic py-2">
                  No morning routines created yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {morningRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-3 group"
                    >
                      <div
                        onClick={() => onToggleRoutine(routine.id)}
                        className="flex items-center space-x-3 cursor-pointer flex-1"
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                            routine.completedToday
                              ? "bg-[#6E9A7B] text-white"
                              : "border border-[#38322D] text-transparent hover:border-[#B7AFA7]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
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
                            <span>{routine.durationMinutes} min</span>
                            {routine.location && (
                              <>
                                <span>•</span>
                                <span>{routine.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {routine.targetTime && (
                          <span className="text-[10px] font-mono text-[#B7AFA7] bg-[#211E1B] px-2 py-0.5 rounded-md border border-[#38322D]">
                            {routine.targetTime}
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteTargetId(routine.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#B7AFA7] hover:text-[#B86B6B] transition-opacity cursor-pointer"
                          title="Delete routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Afternoon Section */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <Sunset className="w-4 h-4 text-[#738F85]" />
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Afternoon Resets
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#B7AFA7]">
                  {afternoonRoutines.length} items
                </span>
              </div>

              {afternoonRoutines.length === 0 ? (
                <p className="text-xs text-[#B7AFA7] italic py-2">
                  No afternoon routines created yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {afternoonRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-3 group"
                    >
                      <div
                        onClick={() => onToggleRoutine(routine.id)}
                        className="flex items-center space-x-3 cursor-pointer flex-1"
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                            routine.completedToday
                              ? "bg-[#6E9A7B] text-white"
                              : "border border-[#38322D] text-transparent hover:border-[#B7AFA7]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
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
                            <span className="capitalize text-[#738F85]">
                              {routine.domain}
                            </span>
                            <span>•</span>
                            <span>{routine.durationMinutes} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {routine.targetTime && (
                          <span className="text-[10px] font-mono text-[#B7AFA7] bg-[#211E1B] px-2 py-0.5 rounded-md border border-[#38322D]">
                            {routine.targetTime}
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteTargetId(routine.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#B7AFA7] hover:text-[#B86B6B] transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evening Section */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2.5">
                  <Moon className="w-4 h-4 text-[#D4A373]" />
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Evening Wind-Down
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#B7AFA7]">
                  {eveningRoutines.length} items
                </span>
              </div>

              {eveningRoutines.length === 0 ? (
                <p className="text-xs text-[#B7AFA7] italic py-2">
                  No evening routines created yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {eveningRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-between gap-3 group"
                    >
                      <div
                        onClick={() => onToggleRoutine(routine.id)}
                        className="flex items-center space-x-3 cursor-pointer flex-1"
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                            routine.completedToday
                              ? "bg-[#6E9A7B] text-white"
                              : "border border-[#38322D] text-transparent hover:border-[#B7AFA7]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
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
                            <span className="capitalize text-[#D4A373]">
                              {routine.domain}
                            </span>
                            <span>•</span>
                            <span>{routine.durationMinutes} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {routine.targetTime && (
                          <span className="text-[10px] font-mono text-[#B7AFA7] bg-[#211E1B] px-2 py-0.5 rounded-md border border-[#38322D]">
                            {routine.targetTime}
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteTargetId(routine.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#B7AFA7] hover:text-[#B86B6B] transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Connected Calendar Status Card */}
          <div className="lg:col-span-5 space-y-6">
            {/* Google Calendar Preview Card (Directive 18 preview) */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-[#38322D]">
                <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Google Calendar Action Layer
                  </h2>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Directive 18 & 19 Planning Preview
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#B7AFA7]">Integration Status:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#211E1B] text-[#738F85] border border-[#738F85]/40 font-mono text-[10px]">
                    Phase 1 Standby
                  </span>
                </div>
                <p className="text-[#B7AFA7] text-[11px] leading-relaxed">
                  Calendar synchronization operates under least-privilege. In future phases, you will be able to preview and confirm upcoming sessions (such as badminton or walking intervals) before any schedule write.
                </p>
                <div className="p-2.5 rounded-xl bg-[#211E1B] border border-[#38322D] text-[11px] text-[#C89B3C] flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Transparent confirmation required for every scheduled event.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Routine Creation Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#211E1B] border border-[#38322D] rounded-3xl p-6 sm:p-8 text-[#F3EFE8] space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#38322D]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold font-serif text-[#F3EFE8]">
                  Create Wellbeing Routine
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoutineSubmit} className="space-y-4 text-xs">
              {/* Routine Name */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#F3EFE8]">
                  Routine Name
                </label>
                <input
                  id="input-routine-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Breathwork, Evening Walk..."
                  className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
                />
              </div>

              {/* Domain & Time Of Day */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Wellbeing Domain
                  </label>
                  <select
                    id="select-routine-domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as WellbeingDomain)}
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Time of Day
                  </label>
                  <select
                    id="select-routine-timeofday"
                    value={timeOfDay}
                    onChange={(e) =>
                      setTimeOfDay(e.target.value as "morning" | "afternoon" | "evening")
                    }
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              </div>

              {/* Target Time & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Target Time
                  </label>
                  <input
                    id="input-routine-targettime"
                    type="time"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Duration (Minutes)
                  </label>
                  <input
                    id="input-routine-duration"
                    type="number"
                    min={1}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  />
                </div>
              </div>

              {/* Recurrence & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Recurrence
                  </label>
                  <select
                    id="select-routine-recurrence"
                    value={recurrence}
                    onChange={(e) =>
                      setRecurrence(e.target.value as "daily" | "weekdays" | "weekends")
                    }
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays (Mon-Fri)</option>
                    <option value="weekends">Weekends (Sat-Sun)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#F3EFE8]">
                    Location / Environment
                  </label>
                  <input
                    id="input-routine-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Home, Park, Gym"
                    className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-[#38322D]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513]"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-create-routine"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Creating..." : "Save Routine"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Routine"
        message="Are you sure you want to remove this routine from your schedule?"
        itemName={targetDeleteRoutine?.name}
        onConfirm={async () => {
          if (deleteTargetId) {
            await onDeleteRoutine(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
