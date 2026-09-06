import React, { useState } from "react";
import { UserProfile, AuthUserState, WellbeingDomain } from "../types";
import { saveUserProfile } from "../firebase";
import { ArrowRight, Heart, Check, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface OnboardingModalProps {
  user: AuthUserState;
  onComplete: (profile: UserProfile) => void;
}

const DOMAIN_OPTIONS: { id: WellbeingDomain; label: string; desc: string }[] = [
  { id: "mind", label: "Mind", desc: "Emotional balance, stress relief, gratitude" },
  { id: "body", label: "Body", desc: "Sleep hygiene, movement, sports, energy" },
  { id: "life", label: "Life", desc: "Sustainable habits, personal growth, goals" },
  { id: "connection", label: "Connection", desc: "Family, friendships, community rituals" },
];

const INITIAL_GOALS = [
  "Inner Peace & Stress Relief",
  "Regular Movement & Energy",
  "Mindful Sleep Routine",
  "Gratitude & Emotional Clarity",
  "Healthy Work-Life Boundaries",
  "Strengthen Social Connection",
];

const INITIAL_GROUNDING = [
  "Mindful Breathwork",
  "Nature Walks",
  "Badminton / Movement",
  "Evening Reading",
  "Journaling & Reflection",
  "Yoga / Stretching",
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  user,
  onComplete,
}) => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    "Inner Peace & Stress Relief",
    "Regular Movement & Energy",
  ]);
  const [selectedGrounding, setSelectedGrounding] = useState<string[]>([
    "Mindful Breathwork",
    "Nature Walks",
  ]);
  const [spiritualBeliefs, setSpiritualBeliefs] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleItem = (
    item: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSaveError(null);
    const defaultProfile: UserProfile = {
      name: user.displayName || "Wellbeing Explorer",
      onboardingCompleted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await saveUserProfile(user.uid, defaultProfile);
      onComplete(defaultProfile);
    } catch {
      setSaveError("Your onboarding choice could not be saved. Check your connection and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const profile: UserProfile = {
        name: user.displayName || "Wellbeing Explorer",
        primaryGoals: selectedGoals,
        groundingActivities: selectedGrounding,
        religion: spiritualBeliefs.trim() || undefined,
        onboardingCompleted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveUserProfile(user.uid, profile);
      onComplete(profile);
    } catch {
      setSaveError("Your preferences could not be saved. Nothing was cleared; please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 py-8"
      onClick={() => void handleSkip()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#211E1B] rounded-3xl shadow-2xl border border-[#38322D] p-6 sm:p-10 text-[#F3EFE8] space-y-6 my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#C89B3C]/15 border border-[#C89B3C]/40 flex items-center justify-center text-[#C89B3C]">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#F3EFE8]">
              Welcome to Your Wellbeing Space
            </h2>
            <p className="text-xs text-[#B7AFA7]">
              Let's tailor your reflection environment (all fields are optional)
            </p>
          </div>
        </div>

        <p className="text-xs text-[#B7AFA7] leading-relaxed">
          Good Health & Wellbeing is a private, non-clinical companion. Your intentions guide your journaling and routine discovery.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {saveError && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-[#B86B6B]/50 bg-[#B86B6B]/15 p-3 text-xs text-[#E7A3A3]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{saveError}</span>
              <button type="submit" disabled={isSubmitting} className="rounded-lg border border-current px-2 py-1 font-semibold">Retry Save</button>
            </div>
          )}
          {/* Primary Intentions & Goals */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#C89B3C]">
              What wellbeing areas do you want to nurture?
            </label>
            <div className="flex flex-wrap gap-2">
              {INITIAL_GOALS.map((goal) => {
                const isSelected = selectedGoals.includes(goal);
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleItem(goal, selectedGoals, setSelectedGoals)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                        : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {goal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grounding Practices */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#738F85]">
              Grounding Activities & Sports you enjoy
            </label>
            <div className="flex flex-wrap gap-2">
              {INITIAL_GROUNDING.map((act) => {
                const isSelected = selectedGrounding.includes(act);
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleItem(act, selectedGrounding, setSelectedGrounding)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-[#738F85] text-[#171513] border-[#738F85] font-semibold shadow-xs"
                        : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {act}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Spiritual or Cultural Values */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#F3EFE8]">
                Worldview, Philosophy or Spiritual Perspective
              </label>
              <span className="text-[11px] text-[#B7AFA7]">Optional</span>
            </div>
            <input
              type="text"
              value={spiritualBeliefs}
              onChange={(e) => setSpiritualBeliefs(e.target.value)}
              placeholder="e.g. Stoicism, Mindfulness, Christian, Buddhist, Humanist, Nature-connected..."
              className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-between border-t border-[#38322D]">
            <button
              id="btn-skip-onboarding"
              type="button"
              onClick={() => void handleSkip()}
              className="text-xs text-[#B7AFA7] hover:text-[#F3EFE8] underline cursor-pointer"
            >
              Skip for now
            </button>
            <button
              id="btn-complete-onboarding"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <span>{isSubmitting ? "Setting Up..." : "Enter Wellbeing Space"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
