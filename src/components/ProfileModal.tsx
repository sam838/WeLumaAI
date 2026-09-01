import React, { useState, useRef } from "react";
import { AuthUserState, UserProfile } from "../types";
import { updateUserProfileAndAccount } from "../firebase";
import {
  X,
  User,
  Camera,
  Sparkles,
  Calendar,
  Globe,
  MapPin,
  Check,
  Upload,
  Heart,
  Compass,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ProfileModalProps {
  user: AuthUserState;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: AuthUserState) => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
];

const GOAL_OPTIONS = [
  "Anxiety Relief",
  "Finding Purpose",
  "Inner Peace",
  "Shadow Work",
  "Mindfulness",
  "Gratitude",
  "Overcoming Grief",
  "Mental Clarity",
  "Emotional Balance",
  "Personal Growth"
];

const ACTIVITY_AND_SPORT_OPTIONS = [
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
  "Reading",
  "Pilates"
];

const GENDER_OPTIONS = [
  "Prefer not to say",
  "Female",
  "Male",
  "Non-binary",
  "Self-described"
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<"personal" | "preferences">("personal");

  // Personal Info Form State
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [photoURL, setPhotoURL] = useState(user.photoURL || "");
  const [dob, setDob] = useState(user.profile?.dob || "");
  const [nationality, setNationality] = useState(user.profile?.nationality || "");
  const [countryStay, setCountryStay] = useState(user.profile?.countryStay || "");
  const [province, setProvince] = useState(user.profile?.province || "");
  const [city, setCity] = useState(user.profile?.city || "");
  const [gender, setGender] = useState(user.profile?.gender || "Prefer not to say");
  const [customGender, setCustomGender] = useState("");

  // Preferences Form State
  const [religion, setReligion] = useState(user.profile?.religion || "");
  const [culturalBeliefs, setCulturalBeliefs] = useState(user.profile?.culturalBeliefs || "");
  const [primaryGoals, setPrimaryGoals] = useState<string[]>(user.profile?.primaryGoals || []);
  const [customGoal, setCustomGoal] = useState("");
  const [isOtherGoalOpen, setIsOtherGoalOpen] = useState(false);
  const [groundingActivities, setGroundingActivities] = useState<string[]>(
    user.profile?.groundingActivities || []
  );
  const [customActivity, setCustomActivity] = useState("");
  const [isOtherActivityOpen, setIsOtherActivityOpen] = useState(false);

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (1.5MB max for data URL storage)
    if (file.size > 1.5 * 1024 * 1024) {
      setSaveError("Profile image must be smaller than 1.5 MB.");
      return;
    }

    setSaveError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setPhotoURL(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Merge custom goals
      const mergedGoals = [...primaryGoals];
      if (customGoal.trim()) {
        const parts = customGoal.split(",").map((s) => s.trim()).filter(Boolean);
        parts.forEach((p) => {
          if (!mergedGoals.includes(p)) mergedGoals.push(p);
        });
      }

      // Merge custom activities
      const mergedActivities = [...groundingActivities];
      if (customActivity.trim()) {
        const parts = customActivity.split(",").map((s) => s.trim()).filter(Boolean);
        parts.forEach((p) => {
          if (!mergedActivities.includes(p)) mergedActivities.push(p);
        });
      }

      const effectiveGender = gender === "Self-described" && customGender.trim() 
        ? customGender.trim() 
        : gender;

      const updatedProfile: UserProfile = {
        name: displayName.trim() || undefined,
        dob: dob.trim() || undefined,
        nationality: nationality.trim() || undefined,
        countryStay: countryStay.trim() || undefined,
        province: province.trim() || undefined,
        city: city.trim() || undefined,
        gender: effectiveGender,
        photoURL: photoURL.trim() || undefined,
        religion: religion.trim() || undefined,
        culturalBeliefs: culturalBeliefs.trim() || undefined,
        primaryGoals: mergedGoals.length > 0 ? mergedGoals : undefined,
        groundingActivities: mergedActivities.length > 0 ? mergedActivities : undefined,
        onboardingCompleted: true,
        createdAt: user.profile?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const updatedUserState = await updateUserProfileAndAccount(user.uid, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null,
        profile: updatedProfile,
      });

      onUpdateUser(updatedUserState);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setSaveError(err?.message || "Failed to save profile changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#171513]/85 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-3xl bg-[#211E1B] rounded-3xl shadow-2xl border border-[#38322D] overflow-hidden flex flex-col my-auto"
        >
          {/* Header */}
          <div className="px-6 py-5 sm:px-8 border-b border-[#38322D] flex items-center justify-between bg-[#171513]/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#C89B3C] text-[#171513] flex items-center justify-center font-bold shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-medium text-[#F3EFE8]">
                  Profile & Preferences
                </h2>
                <p className="text-xs text-[#B7AFA7]">
                  Personalize your identity and AI reflection space
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 sm:px-8 pt-4 border-b border-[#38322D] flex space-x-2 bg-[#211E1B]">
            <button
              type="button"
              onClick={() => setActiveTab("personal")}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "personal"
                  ? "border-[#C89B3C] text-[#C89B3C] font-semibold"
                  : "border-transparent text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <User className="w-4 h-4" />
              Personal Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preferences")}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "preferences"
                  ? "border-[#C89B3C] text-[#C89B3C] font-semibold"
                  : "border-transparent text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Reflection Preferences
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === "personal" ? (
                <motion.div
                  key="tab-personal"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  {/* Photo & Avatar Selection */}
                  <div className="p-4 sm:p-5 bg-[#171513] rounded-2xl border border-[#38322D] flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <div className="relative group">
                      {photoURL ? (
                        <img
                          src={photoURL}
                          alt="Profile Avatar"
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-[#38322D] shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-[#2c2723] border-2 border-[#38322D] flex items-center justify-center text-[#C89B3C] font-bold text-2xl shadow-sm">
                          {displayName ? displayName.charAt(0).toUpperCase() : <User className="w-8 h-8 text-[#B7AFA7]" />}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-medium transition-opacity cursor-pointer"
                      >
                        <Camera className="w-5 h-5 mb-0.5" />
                        Change
                      </button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[#F3EFE8]">Profile Photo</h4>
                        <p className="text-xs text-[#B7AFA7]">Upload a picture or choose a minimalist preset avatar</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#211E1B] border border-[#38322D] text-[#F3EFE8] rounded-xl text-xs font-medium hover:bg-[#2c2723] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#C89B3C]" />
                          Upload Photo
                        </button>
                        {photoURL && (
                          <button
                            type="button"
                            onClick={() => setPhotoURL("")}
                            className="px-3 py-1.5 bg-[#211E1B] border border-[#B86B6B]/40 text-[#B86B6B] rounded-xl text-xs font-medium hover:bg-[#B86B6B]/10 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Presets */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-[#B7AFA7] font-medium">Presets:</span>
                        <div className="flex items-center gap-1.5">
                          {PRESET_AVATARS.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPhotoURL(preset)}
                              className={`w-7 h-7 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                photoURL === preset
                                  ? "ring-2 ring-[#C89B3C] border-[#F3EFE8] scale-110"
                                  : "border-[#38322D] hover:opacity-80"
                              }`}
                            >
                              <img
                                src={preset}
                                alt={`Preset ${idx + 1}`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Name and DOB Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="input-profile-name" className="block text-xs font-semibold text-[#F3EFE8]">
                        Full Name / Display Name
                      </label>
                      <div className="relative">
                        <input
                          id="input-profile-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="input-profile-dob" className="block text-xs font-semibold text-[#F3EFE8]">
                        Date of Birth (DOB)
                      </label>
                      <div className="relative">
                        <input
                          id="input-profile-dob"
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gender & Nationality Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="select-profile-gender" className="block text-xs font-semibold text-[#F3EFE8]">
                        Gender
                      </label>
                      <select
                        id="select-profile-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                      >
                        {GENDER_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} className="bg-[#211E1B] text-[#F3EFE8]">
                            {opt}
                          </option>
                        ))}
                      </select>
                      {gender === "Self-described" && (
                        <input
                          type="text"
                          value={customGender}
                          onChange={(e) => setCustomGender(e.target.value)}
                          placeholder="Describe your gender identity..."
                          className="mt-2 w-full px-3.5 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs focus:border-[#C89B3C] outline-none"
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="input-profile-nationality" className="block text-xs font-semibold text-[#F3EFE8]">
                        Nationality
                      </label>
                      <div className="relative">
                        <input
                          id="input-profile-nationality"
                          type="text"
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          placeholder="e.g. Canadian, Indonesian, Japanese..."
                          className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location Details: Country Stay, Province, City */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-1.5 text-[#F3EFE8]">
                      <MapPin className="w-3.5 h-3.5 text-[#C89B3C]" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Current Residence</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="input-profile-country" className="block text-[11px] font-medium text-[#B7AFA7]">
                          Country Stay
                        </label>
                        <input
                          id="input-profile-country"
                          type="text"
                          value={countryStay}
                          onChange={(e) => setCountryStay(e.target.value)}
                          placeholder="e.g. United States"
                          className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] outline-none text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="input-profile-province" className="block text-[11px] font-medium text-[#B7AFA7]">
                          Province / State
                        </label>
                        <input
                          id="input-profile-province"
                          type="text"
                          value={province}
                          onChange={(e) => setProvince(e.target.value)}
                          placeholder="e.g. California / Bali"
                          className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] outline-none text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="input-profile-city" className="block text-[11px] font-medium text-[#B7AFA7]">
                          City
                        </label>
                        <input
                          id="input-profile-city"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. San Francisco / Ubud"
                          className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-medium placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="tab-preferences"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  {/* Spiritual Path / Religion */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="modal-spiritual-path" className="block text-xs font-semibold text-[#F3EFE8]">
                        Spiritual Path, Religion, or Philosophy
                      </label>
                      <span className="text-[11px] text-[#B7AFA7]">Optional</span>
                    </div>
                    <textarea
                      id="modal-spiritual-path"
                      rows={2}
                      value={religion}
                      onChange={(e) => setReligion(e.target.value)}
                      placeholder="e.g. Christian, Buddhist philosophy, Stoicism, Muslim, Hindu, Taoist, Secular Humanist, Agnostic..."
                      className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-xs leading-relaxed"
                    />
                  </div>

                  {/* Cultural Beliefs & Values */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="modal-cultural-beliefs" className="block text-xs font-semibold text-[#F3EFE8]">
                        Cultural Beliefs, Values & Traditions
                      </label>
                      <span className="text-[11px] text-[#B7AFA7]">Optional</span>
                    </div>
                    <textarea
                      id="modal-cultural-beliefs"
                      rows={2}
                      value={culturalBeliefs}
                      onChange={(e) => setCulturalBeliefs(e.target.value)}
                      placeholder="e.g. Deep connection to ancestral traditions, community-first values, mindfulness practices, artistic heritage..."
                      className="w-full px-3.5 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] font-normal placeholder:text-[#B7AFA7]/60 focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C]/40 outline-none transition-all text-xs leading-relaxed"
                    />
                  </div>

                  {/* Primary Goals */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#F3EFE8]">
                        Primary Mental & Spiritual Goals
                      </label>
                      <span className="text-[11px] text-[#B7AFA7]">Select any</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((goal) => {
                        const isSelected = primaryGoals.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => toggleSelection(goal, primaryGoals, setPrimaryGoals)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
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
                          placeholder="Type custom goal(s), separated by commas..."
                          className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs focus:border-[#C89B3C] outline-none"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Grounding Activities & Sports */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#F3EFE8]">
                        Grounding Activities, Sports & Wellness Practices
                      </label>
                      <span className="text-[11px] text-[#B7AFA7]">Select any</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITY_AND_SPORT_OPTIONS.map((activity) => {
                        const isSelected = groundingActivities.includes(activity);
                        return (
                          <button
                            key={activity}
                            type="button"
                            onClick={() =>
                              toggleSelection(activity, groundingActivities, setGroundingActivities)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border cursor-pointer ${
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
                          placeholder="Type custom activities or sports, separated by commas..."
                          className="w-full px-3 py-2 bg-[#171513] border border-[#38322D] rounded-xl text-[#F3EFE8] text-xs focus:border-[#C89B3C] outline-none"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error or Success feedback */}
            {saveError && (
              <div className="p-3 bg-[#B86B6B]/20 border border-[#B86B6B]/50 rounded-xl text-xs text-[#B86B6B] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div className="p-3 bg-[#6E9A7B]/20 border border-[#6E9A7B]/50 rounded-xl text-xs text-[#6E9A7B] flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Profile and preferences updated successfully!</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-[#38322D]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#C89B3C] text-[#171513] text-xs font-semibold rounded-xl hover:bg-[#b98c2d] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Profile & Preferences"}
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
