import React, { useState, useEffect } from "react";
import { UserProfile, AuthUserState } from "../types";
import { saveUserProfile } from "../firebase";
import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface OnboardingFormProps {
  user: AuthUserState;
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingForm({ user, onComplete }: OnboardingFormProps) {
  const [religion, setReligion] = useState("");
  const [culturalBeliefs, setCulturalBeliefs] = useState("");
  const [primaryGoals, setPrimaryGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [isOtherGoalOpen, setIsOtherGoalOpen] = useState(false);
  const [groundingActivities, setGroundingActivities] = useState<string[]>([]);
  const [customActivity, setCustomActivity] = useState("");
  const [isOtherActivityOpen, setIsOtherActivityOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goalOptions = [
    "Anxiety Relief",
    "Finding Purpose",
    "Inner Peace",
    "Shadow Work",
    "Mindfulness",
    "Gratitude",
    "Overcoming Grief",
    "Mental Clarity"
  ];

  const activityAndSportOptions = [
    "Meditation",
    "Yoga",
    "Running / Jogging",
    "Gym / Strength Training",
    "Swimming",
    "Nature Walks / Hiking",
    "Cycling",
    "Team Sports",
    "Art / Creation",
    "Music",
    "Prayer",
    "Breathwork",
    "Reading"
  ];

  const toggleSelection = (
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

  const handleSkip = () => {
    const defaultProfile: UserProfile = {
      onboardingCompleted: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Save in background and complete immediately
    saveUserProfile(user.uid, defaultProfile).catch((err) => {
      console.warn("Background profile save note:", err);
    });
    onComplete(defaultProfile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Merge selected goals with custom goal input if provided
      const mergedGoals = [...primaryGoals];
      if (customGoal.trim()) {
        const splitCustom = customGoal
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        splitCustom.forEach((cg) => {
          if (!mergedGoals.includes(cg)) {
            mergedGoals.push(cg);
          }
        });
      }

      // Merge selected activities with custom activity input if provided
      const mergedActivities = [...groundingActivities];
      if (customActivity.trim()) {
        const splitCustom = customActivity
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        splitCustom.forEach((ca) => {
          if (!mergedActivities.includes(ca)) {
            mergedActivities.push(ca);
          }
        });
      }

      const profile: UserProfile = {
        religion: religion.trim() || undefined,
        culturalBeliefs: culturalBeliefs.trim() || undefined,
        primaryGoals: mergedGoals.length > 0 ? mergedGoals : undefined,
        groundingActivities: mergedActivities.length > 0 ? mergedActivities : undefined,
        onboardingCompleted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save profile with a 3-second timeout guarantee so user is never stuck
      const savePromise = saveUserProfile(user.uid, profile);
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
      await Promise.race([savePromise, timeoutPromise]);

      onComplete(profile);
    } catch (error) {
      console.error("Failed to save profile:", error);
      // Fallback: still let the user proceed rather than trapping them
      const fallbackProfile: UserProfile = {
        religion: religion.trim() || undefined,
        culturalBeliefs: culturalBeliefs.trim() || undefined,
        primaryGoals: primaryGoals.length > 0 ? primaryGoals : undefined,
        groundingActivities: groundingActivities.length > 0 ? groundingActivities : undefined,
        onboardingCompleted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onComplete(fallbackProfile);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#171513]/85 backdrop-blur-sm"
      onClick={handleSkip}
    >
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-[#211E1B] rounded-3xl shadow-2xl border border-[#38322D] flex flex-col max-h-[90vh] overflow-y-auto my-auto"
        >
          <div className="p-8 sm:p-12 text-[#F3EFE8]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#171513] border border-[#38322D] rounded-2xl">
                <Sparkles className="w-6 h-6 text-[#C89B3C]" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-medium text-[#F3EFE8]">
                  Welcome, {user.displayName?.split(" ")[0] || "Traveler"}
                </h2>
                <p className="text-xs text-[#B7AFA7] mt-0.5">Personalize your spiritual & mental reflection space (Optional)</p>
              </div>
            </div>
            
            <p className="text-[#B7AFA7] mb-8 text-sm leading-relaxed">
              Help your AI companion understand your worldview, values, and wellness practices. All fields are optional—share as much or as little as feels comfortable.
            </p>

            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Spiritual Path, Religion, or Philosophy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="spiritual-beliefs" className="block text-sm font-semibold text-[#F3EFE8]">
                    Spiritual Path, Religion, or Philosophy
                  </label>
                  <span className="text-xs font-normal text-[#B7AFA7]">Optional</span>
                </div>
                <textarea
                  id="spiritual-beliefs"
                  rows={3}
                  value={religion}
                  onChange={(e) => setReligion(e.target.value)}
                  placeholder="e.g. Christian, Buddhist philosophy, Stoicism, Muslim, Hindu, Taoist, Secular Humanist, Agnostic, or your personal spiritual perspective..."
                  className="w-full px-4 py-3 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all resize-y text-sm leading-relaxed"
                />
              </div>

              {/* Cultural Beliefs & Values */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="cultural-beliefs" className="block text-sm font-semibold text-[#F3EFE8]">
                    Cultural Beliefs, Values & Traditions
                  </label>
                  <span className="text-xs font-normal text-[#B7AFA7]">Optional</span>
                </div>
                <textarea
                  id="cultural-beliefs"
                  rows={2}
                  value={culturalBeliefs}
                  onChange={(e) => setCulturalBeliefs(e.target.value)}
                  placeholder="e.g. Deep connection to ancestral traditions, community-first values, mindfulness practices, artistic heritage..."
                  className="w-full px-4 py-3 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all resize-y text-sm leading-relaxed"
                />
              </div>

              {/* Primary Goals */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#F3EFE8]">
                    Primary Mental & Spiritual Goals
                  </label>
                  <span className="text-xs font-normal text-[#B7AFA7]">Select any</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {goalOptions.map((goal) => {
                    const isSelected = primaryGoals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleSelection(goal, primaryGoals, setPrimaryGoals)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                            : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                        }`}
                      >
                        {goal}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsOtherGoalOpen(!isOtherGoalOpen)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                      isOtherGoalOpen || customGoal.trim()
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                        : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                    }`}
                  >
                    + Other...
                  </button>
                </div>

                {isOtherGoalOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-1.5"
                  >
                    <input
                      type="text"
                      value={customGoal}
                      onChange={(e) => setCustomGoal(e.target.value)}
                      placeholder="Type your custom goal(s), e.g. Overcoming burnout, work-life balance..."
                      className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                    />
                  </motion.div>
                )}
              </div>

              {/* Grounding Activities, Sports & Physical Wellness */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#F3EFE8]">
                    Grounding Activities, Sports & Wellness Practices
                  </label>
                  <span className="text-xs font-normal text-[#B7AFA7]">Select any</span>
                </div>
                <p className="text-xs text-[#B7AFA7]">
                  Physical movement, sports, and daily rituals that help keep your mind and body centered.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activityAndSportOptions.map((activity) => {
                    const isSelected = groundingActivities.includes(activity);
                    return (
                      <button
                        key={activity}
                        type="button"
                        onClick={() => toggleSelection(activity, groundingActivities, setGroundingActivities)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                            : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                        }`}
                      >
                        {activity}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsOtherActivityOpen(!isOtherActivityOpen)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                      isOtherActivityOpen || customActivity.trim()
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                        : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:border-[#B7AFA7] hover:text-[#F3EFE8]"
                    }`}
                  >
                    + Other...
                  </button>
                </div>

                {isOtherActivityOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-1.5"
                  >
                    <input
                      type="text"
                      value={customActivity}
                      onChange={(e) => setCustomActivity(e.target.value)}
                      placeholder="Type custom activity or sport, e.g. Rock climbing, gardening, pottery, martial arts..."
                      className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                    />
                  </motion.div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-[#38322D]">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-xs text-[#B7AFA7] hover:text-[#F3EFE8] underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#C89B3C] text-[#171513] text-sm font-semibold rounded-xl hover:bg-[#b98c2d] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Begin Journaling"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
