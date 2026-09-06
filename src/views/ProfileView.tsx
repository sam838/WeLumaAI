import React, { useState, useEffect } from "react";
import {
  User,
  Sparkles,
  MapPin,
  Heart,
  Shield,
  Download,
  Trash2,
  Check,
  Compass,
  AlertCircle,
  Clock,
  Layers,
  FileJson,
  Key,
  Sun,
  Moon,
} from "lucide-react";
import {
  AuthUserState,
  StoredPreferenceItem,
  UserProfile,
} from "../types";
import { updateUserProfileAndAccount } from "../firebase";
import { useTheme } from "../context/ThemeContext";

interface ProfileViewProps {
  user: AuthUserState;
  onUpdateUser: (updatedUser: AuthUserState) => void;
  onSignOut: () => void;
  onDeletePreferenceItem?: (id: string) => Promise<void>;
  onAddPreferenceItem?: (item: StoredPreferenceItem) => Promise<void>;
}

const GOAL_OPTIONS = [
  "Inner Peace & Stress Relief",
  "Regular Movement & Energy",
  "Mindful Sleep Routine",
  "Gratitude & Emotional Clarity",
  "Healthy Work-Life Boundaries",
  "Deep Personal Growth",
  "Mindful Eating & Hydration",
  "Social Connection",
];

const GROUNDING_OPTIONS = [
  "Mindful Breathwork",
  "Nature Walks / Hiking",
  "Badminton / Racket Sports",
  "Gym & Strength Training",
  "Yoga / Pilates",
  "Creative Art / Sketching",
  "Evening Reading",
  "Swimming",
  "Music & Sound",
  "Spiritual Prayer / Meditation",
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUpdateUser,
  onSignOut,
  onDeletePreferenceItem,
  onAddPreferenceItem,
}) => {
  const { theme, setTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"details" | "preferences" | "memories" | "privacy">("details");

  // Form State
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [countryStay, setCountryStay] = useState(user.profile?.countryStay || "");
  const [province, setProvince] = useState(user.profile?.province || "");
  const [city, setCity] = useState(user.profile?.city || "");
  const [religion, setReligion] = useState(user.profile?.religion || "");
  const [culturalBeliefs, setCulturalBeliefs] = useState(user.profile?.culturalBeliefs || "");
  const [primaryGoals, setPrimaryGoals] = useState<string[]>(user.profile?.primaryGoals || []);
  const [groundingActivities, setGroundingActivities] = useState<string[]>(
    user.profile?.groundingActivities || []
  );

  // Activity Preferences
  const [socialPreference, setSocialPreference] = useState<"solo" | "small_group" | "community" | "any">(
    user.profile?.activityPreferences?.socialPreference || "any"
  );
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(
    user.profile?.activityPreferences?.maxDistanceKm || 10
  );
  const [budgetPreference, setBudgetPreference] = useState<"free" | "low" | "moderate" | "flexible">(
    user.profile?.activityPreferences?.budgetPreference || "flexible"
  );

  // New Custom Preference Form State
  const [newPrefCategory, setNewPrefCategory] = useState<string>("interest");
  const [newPrefLabel, setNewPrefLabel] = useState<string>("");
  const [newPrefValue, setNewPrefValue] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Secret Manager runtime status
  const [secretStatus, setSecretStatus] = useState<{
    configured?: boolean;
  } | null>(null);

  const fetchSecretStatus = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setSecretStatus({
          configured: data.geminiConfigured,
        });
      }
    } catch {
      // quiet
    }
  };

  useEffect(() => {
    fetchSecretStatus();
  }, []);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const updatedProfile: UserProfile = {
      name: displayName.trim() || undefined,
      countryStay: countryStay.trim() || undefined,
      province: province.trim() || undefined,
      city: city.trim() || undefined,
      religion: religion.trim() || undefined,
      culturalBeliefs: culturalBeliefs.trim() || undefined,
      primaryGoals: primaryGoals.length > 0 ? primaryGoals : undefined,
      groundingActivities: groundingActivities.length > 0 ? groundingActivities : undefined,
      activityPreferences: {
        socialPreference,
        maxDistanceKm,
        budgetPreference,
      },
      storedPreferences: user.profile?.storedPreferences,
      latestCheckIn: user.profile?.latestCheckIn,
      onboardingCompleted: true,
      createdAt: user.profile?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    try {
      const updated = await updateUserProfileAndAccount(user.uid, {
        displayName: displayName.trim() || null,
        photoURL: user.photoURL || null,
        profile: updatedProfile,
      });
      onUpdateUser(updated);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const exportPayload = {
      user: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
      },
      profile: user.profile,
      exportedAt: new Date().toISOString(),
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wellbeing_profile_${user.uid.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#171513] text-[#F3EFE8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#211E1B] border border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#171513] border border-[#38322D] flex items-center justify-center text-[#C89B3C] text-xl font-bold font-serif shadow-xs">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#F3EFE8]">
                {user.displayName || "Wellbeing Member"}
              </h1>
              <p className="text-xs text-[#B7AFA7]">
                {user.email || "Google Account"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-[#6E9A7B] bg-[#6E9A7B]/10 px-3 py-1 rounded-full border border-[#6E9A7B]/30 font-medium">
              UID Isolated
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 bg-[#211E1B] p-1.5 rounded-2xl border border-[#38322D] text-xs overflow-x-auto no-scrollbar">
          <button
            id="btn-tab-profile-details"
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "details"
                ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                : "text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
          >
            Personal Info
          </button>
          <button
            id="btn-tab-profile-preferences"
            onClick={() => setActiveTab("preferences")}
            className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "preferences"
                ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                : "text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
          >
            Wellbeing Preferences
          </button>
          <button
            id="btn-tab-profile-memories"
            onClick={() => setActiveTab("memories")}
            className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "memories"
                ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                : "text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
          >
            Stored Memories (Directive 14)
          </button>
          <button
            id="btn-tab-profile-privacy"
            onClick={() => setActiveTab("privacy")}
            className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "privacy"
                ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-xs"
                : "text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
          >
            Privacy & Data
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Tab 1: Personal Details */}
          {activeTab === "details" && (
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-6 sm:p-8 space-y-5">
              <h2 className="text-sm font-bold text-[#F3EFE8] font-serif border-b border-[#38322D] pb-2">
                Personal Identity & Worldview
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Display Name
                  </label>
                  <input
                    id="input-profile-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Country Stay / Region
                  </label>
                  <input
                    id="input-profile-country"
                    type="text"
                    value={countryStay}
                    onChange={(e) => setCountryStay(e.target.value)}
                    placeholder="e.g. United States, Indonesia"
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    City
                  </label>
                  <input
                    id="input-profile-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. San Francisco, Ubud"
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Province / State
                  </label>
                  <input
                    id="input-profile-province"
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="e.g. California, Bali"
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]/60"
                  />
                </div>
              </div>

              {/* Spiritual Path / Values */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-semibold text-[#F3EFE8]">
                  Spiritual Path, Religion, or Philosophy
                </label>
                <textarea
                  id="input-profile-religion"
                  rows={2}
                  value={religion}
                  onChange={(e) => setReligion(e.target.value)}
                  placeholder="e.g. Stoicism, Mindfulness, Buddhist philosophy, Christian, Muslim, Secular Humanist, Agnostic..."
                  className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none focus:border-[#C89B3C]/60 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Wellbeing Preferences */}
          {activeTab === "preferences" && (
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-6 sm:p-8 space-y-6">
              <h2 className="text-sm font-bold text-[#F3EFE8] font-serif border-b border-[#38322D] pb-2">
                Wellbeing Intentions & Activity Preferences
              </h2>

              {/* Theme Mode & Appearance Card */}
              <div className="p-4 rounded-2xl bg-[#171513] border border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shrink-0">
                    {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F3EFE8]">Appearance Theme</h3>
                    <p className="text-xs text-[#B7AFA7]">
                      Toggle between calm Dark Mode and radiant Light Mode
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isDark
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                        : "bg-[#211E1B] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      !isDark
                        ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold shadow-xs"
                        : "bg-[#211E1B] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light Mode</span>
                  </button>
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#C89B3C]">
                  Primary Mental & Spiritual Goals
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((g) => {
                    const isSelected = primaryGoals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleSelection(g, primaryGoals, setPrimaryGoals)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#C89B3C] text-[#171513] border-[#C89B3C] font-semibold"
                            : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grounding Activities */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#738F85]">
                  Grounding Activities & Sports
                </label>
                <div className="flex flex-wrap gap-2">
                  {GROUNDING_OPTIONS.map((act) => {
                    const isSelected = groundingActivities.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleSelection(act, groundingActivities, setGroundingActivities)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#738F85] text-[#171513] border-[#738F85] font-semibold"
                            : "bg-[#171513] text-[#B7AFA7] border-[#38322D] hover:text-[#F3EFE8]"
                        }`}
                      >
                        {act}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social Preference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Social Preference
                  </label>
                  <select
                    id="select-social-preference"
                    value={socialPreference}
                    onChange={(e) => setSocialPreference(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  >
                    <option value="any">Flexible / Any</option>
                    <option value="solo">Solo Practice</option>
                    <option value="small_group">Small Group</option>
                    <option value="community">Community Oriented</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#F3EFE8]">
                    Budget Preference
                  </label>
                  <select
                    id="select-budget-preference"
                    value={budgetPreference}
                    onChange={(e) => setBudgetPreference(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                  >
                    <option value="free">Free Only</option>
                    <option value="low">Low Cost</option>
                    <option value="moderate">Moderate</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Stored Memories Inspector (Directive 14 & 26) */}
          {activeTab === "memories" && (
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-6 sm:p-8 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                  Stored Memories & Pattern Inspector
                </h2>
                <p className="text-xs text-[#B7AFA7] mt-0.5">
                  Transparent personal memory management conforming to Directives 14 & 26.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-[#171513] border border-[#38322D] text-xs text-[#B7AFA7] flex items-start space-x-2">
                  <Shield className="w-4 h-4 text-[#6E9A7B] shrink-0 mt-0.5" />
                  <span>
                    No False Memory: AI inferences (LOW confidence) are never promoted to facts without user confirmation. Gemini actively grounds reflections, recommendations, and journal answers on these confirmed preferences.
                  </span>
                </div>

                {/* Add New Preference Item */}
                {onAddPreferenceItem && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newPrefLabel.trim() || !newPrefValue.trim()) return;
                      const item: StoredPreferenceItem = {
                        id: `pref_${Date.now()}`,
                        category: newPrefCategory as any,
                        label: newPrefLabel.trim(),
                        value: newPrefValue.trim(),
                        confidence: "HIGH",
                        source: "explicit_user",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      };
                      setSaveError(null);
                      try {
                        await onAddPreferenceItem(item);
                        setNewPrefLabel("");
                        setNewPrefValue("");
                      } catch (error) {
                        setSaveError(error instanceof Error ? error.message : "Preference could not be saved. Please retry.");
                      }
                    }}
                    className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F3EFE8] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#C89B3C]" />
                        Add Explicit Preference / Memory
                      </span>
                      <span className="text-[10px] text-[#C89B3C] font-mono">
                        HIGH Confidence (Explicit)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[#B7AFA7] mb-1">Category</label>
                        <select
                          id="select-pref-category"
                          value={newPrefCategory}
                          onChange={(e) => setNewPrefCategory(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#211E1B] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none"
                        >
                          <option value="interest">Interest / Passion</option>
                          <option value="grounding">Grounding / Activity</option>
                          <option value="schedule">Schedule / Window</option>
                          <option value="social">Social Preference</option>
                          <option value="distance">Distance / Location</option>
                          <option value="pattern">Routine Pattern</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-[#B7AFA7] mb-1">Label</label>
                        <input
                          id="input-pref-label"
                          type="text"
                          placeholder="e.g., Favorite Sport, Morning Window, Sleep Habit"
                          value={newPrefLabel}
                          onChange={(e) => setNewPrefLabel(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#211E1B] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none placeholder-[#7A746E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#B7AFA7] mb-1">Preference Details / Value</label>
                      <input
                        id="input-pref-value"
                        type="text"
                        placeholder="e.g., I love playing badminton every Sunday morning; keep routines under 30 mins"
                        value={newPrefValue}
                        onChange={(e) => setNewPrefValue(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#211E1B] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] outline-none placeholder-[#7A746E]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[10px] text-[#7A746E]">
                        Gemini references this memory for all personalized advice, reflections, and routine recommendations.
                      </p>
                      <button
                        id="btn-add-preference"
                        type="submit"
                        disabled={!newPrefLabel.trim() || !newPrefValue.trim()}
                        className="px-3.5 py-1.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-40 disabled:cursor-not-allowed text-[#171513] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Save Preference
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {user.profile?.storedPreferences && user.profile.storedPreferences.length > 0 ? (
                    user.profile.storedPreferences.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-[#171513] rounded-2xl border border-[#38322D] flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-[#F3EFE8]">
                              {item.label}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#211E1B] border border-[#38322D] text-[#C89B3C]">
                              {item.confidence} Confidence
                            </span>
                          </div>
                          <p className="text-xs text-[#B7AFA7] leading-relaxed">
                            {item.value}
                          </p>
                        </div>
                        {onDeletePreferenceItem && (
                          <button
                            type="button"
                            onClick={() => void onDeletePreferenceItem(item.id).catch((error) => setSaveError(error instanceof Error ? error.message : "Preference could not be deleted. Please retry."))}
                            className="text-[#B86B6B] hover:text-white p-1 text-xs cursor-pointer"
                            title="Delete memory"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-[#B7AFA7] bg-[#171513] rounded-2xl border border-[#38322D]">
                      No custom memory items persisted.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Privacy & Data Controls */}
          {activeTab === "privacy" && (
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-6 sm:p-8 space-y-5">
              <h2 className="text-sm font-bold text-[#F3EFE8] font-serif border-b border-[#38322D] pb-2">
                Privacy, Data Isolation & Session
              </h2>

              <div className="space-y-4 text-xs text-[#B7AFA7]">
                <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] space-y-2">
                  <h3 className="font-semibold text-[#F3EFE8]">
                    Data Isolation Architecture
                  </h3>
                  <p className="leading-relaxed">
                    All journal reflections, routine definitions, and personalization settings are locked to path <code className="text-[#C89B3C]">/users/{user.uid}/*</code> and cannot be accessed by other users.
                  </p>
                </div>

                {/* Google Secret Manager Status */}
                <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Key className="w-4 h-4 text-[#C89B3C]" />
                      <h3 className="font-semibold text-[#F3EFE8]">
                        Google Secret Manager Integration
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        secretStatus?.configured
                          ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                          : "bg-rose-950/60 border-rose-800 text-rose-300"
                      }`}
                    >
                      {secretStatus?.configured ? "AI Service Available" : "AI Service Unavailable"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#B7AFA7]">
                    Operational credentials are handled only by the backend and are never exposed to this browser.
                  </p>
                </div>

                <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#F3EFE8]">
                      Export Your Data (JSON)
                    </h3>
                    <p className="text-[11px] mt-0.5">
                      Download a structured export of your profile and stored wellbeing preferences.
                    </p>
                  </div>
                  <button
                    id="btn-export-profile-json"
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#2c2723] hover:bg-[#38322D] text-[#F3EFE8] rounded-xl text-xs font-semibold border border-[#38322D] transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C89B3C]" />
                    <span>Download JSON</span>
                  </button>
                </div>

                <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#F3EFE8]">
                      Sign Out of Session
                    </h3>
                    <p className="text-[11px] mt-0.5">
                      Securely end the current authentication session on this device.
                    </p>
                  </div>
                  <button
                    id="btn-profile-signout"
                    type="button"
                    onClick={onSignOut}
                    className="px-4 py-2 bg-[#B86B6B]/20 hover:bg-[#B86B6B]/30 text-[#B86B6B] border border-[#B86B6B]/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback & Save Bar */}
          {saveError && (
            <div role="alert" className="p-3 bg-[#B86B6B]/20 border border-[#B86B6B]/50 rounded-2xl text-xs text-[#B86B6B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{saveError}</span>
              <button type="submit" disabled={isSaving} className="rounded-lg border border-current px-2.5 py-1 font-semibold hover:bg-[#B86B6B]/10 disabled:opacity-50">
                Retry Save
              </button>
            </div>
          )}

          {saveSuccessNotice && (
            <div className="p-3 bg-[#6E9A7B]/20 border border-[#6E9A7B]/50 rounded-2xl text-xs text-[#6E9A7B] flex items-center space-x-2 animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>Profile and wellbeing preferences saved successfully!</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              id="btn-save-profile"
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
