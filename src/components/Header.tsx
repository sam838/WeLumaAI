import React from "react";
import {
  Sparkles,
  LogOut,
  ShieldCheck,
  User,
  Menu,
  Heart,
  Calendar,
  BellRing,
  BellOff,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import { AuthUserState, NavigationTab } from "../types";
import { useTheme } from "../context/ThemeContext";

interface HeaderProps {
  user: AuthUserState;
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onSignOut: () => void;
  onToggleMobileMenu?: () => void;
  onOpenCalendarModal?: () => void;
  onToggleDailyReminder?: () => void;
  onOpenReminderModal?: () => void;
  syncStatus?: "synced" | "saving" | "error";
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onNavigate,
  onSignOut,
  onToggleMobileMenu,
  onOpenCalendarModal,
  onToggleDailyReminder,
  onOpenReminderModal,
  syncStatus = "synced",
}) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const dailyReminder = user.profile?.dailyReminder;
  const isReminderEnabled = Boolean(dailyReminder?.enabled);
  const reminderTime = dailyReminder?.time || "20:00";

  return (
    <header className="w-full bg-[#211E1B] border-b border-[#38322D] text-[#F3EFE8] px-3 sm:px-6 py-2.5 sm:py-3 transition-colors shrink-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Branding & Mobile Menu Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 min-w-0">
          {onToggleMobileMenu && (
            <button
              id="btn-toggle-mobile-menu"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => onNavigate("today")}
            className="flex items-center space-x-2 sm:space-x-2.5 cursor-pointer group min-w-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-[#C89B3C]/20" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-serif font-bold text-sm sm:text-base md:text-lg tracking-tight text-[#F3EFE8] truncate">
                  <span className="inline sm:hidden">Wellbeing</span>
                  <span className="hidden sm:inline">Good Health & Wellbeing</span>
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#171513] text-[#738F85] border border-[#738F85]/40 uppercase tracking-wider">
                  Companion
                </span>
              </div>
              <p className="hidden lg:block text-[11px] text-[#B7AFA7]">
                Mindful Reflections • Healthy Habits • Meaningful Living
              </p>
            </div>
          </div>
        </div>

        {/* Right: Theme Toggle, Reminder, Calendar, Profile & Sign Out */}
        <div className="flex items-center space-x-1 sm:space-x-2.5 shrink-0">
          {/* Security & Firestore Status */}
          <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6E9A7B]" />
            <span className="text-[11px] text-[#B7AFA7]">Isolated UID</span>
          </div>

          {/* Real-time Sync Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-[#B7AFA7] bg-[#171513] px-2 py-1 sm:px-2.5 rounded-lg border border-[#38322D]">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === "saving"
                  ? "bg-[#C89B3C] animate-pulse"
                  : syncStatus === "error"
                  ? "bg-[#B86B6B]"
                  : "bg-[#6E9A7B]"
              }`}
            />
            <span className="hidden lg:inline text-[11px]">
              {syncStatus === "saving"
                ? "Saving..."
                : syncStatus === "error"
                ? "Sync Warning"
                : "Cloud Synced"}
            </span>
          </div>

          {/* Theme Mode Toggle (Dark / Light) */}
          <button
            id="btn-header-theme-toggle"
            onClick={toggleTheme}
            className="flex items-center space-x-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#38322D] hover:border-[#C89B3C]/50 bg-[#171513] hover:bg-[#2c2723] text-xs transition-all cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#C89B3C]" />
            ) : (
              <Moon className="w-4 h-4 text-[#B68428]" />
            )}
            <span className="hidden md:inline font-medium text-xs text-[#F3EFE8]">
              {isDark ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          {/* Daily Check-In Reminder Toggle */}
          <div className="flex items-center space-x-1">
            <button
              id="btn-header-daily-reminder-toggle"
              onClick={onToggleDailyReminder}
              className={`flex items-center space-x-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-medium ${
                isReminderEnabled
                  ? "bg-emerald-950/40 border-emerald-600/50 hover:bg-emerald-900/50 text-emerald-300 shadow-2xs"
                  : "bg-[#171513] border-[#38322D] hover:border-[#C89B3C]/50 hover:bg-[#2c2723] text-[#A69E95] hover:text-[#F3EFE8]"
              }`}
              title={
                isReminderEnabled
                  ? `Daily reminder ON (${reminderTime}). Click to toggle.`
                  : "Daily reminder OFF. Click to toggle."
              }
              aria-label="Toggle daily reminder"
            >
              {isReminderEnabled ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-emerald-400 font-normal">Reminder:</span>
                  <span className="hidden sm:inline font-semibold text-emerald-200">{reminderTime}</span>
                  <span className="hidden sm:inline px-1 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-800/50 text-emerald-300 border border-emerald-600/40">
                    ON
                  </span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-[#A69E95] shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-[#A69E95]">Reminder:</span>
                  <span className="hidden sm:inline font-medium text-[#B7AFA7]">Off</span>
                </>
              )}
            </button>

            {/* Quick Configure Time Button */}
            {onOpenReminderModal && (
              <button
                id="btn-header-reminder-config"
                onClick={onOpenReminderModal}
                className="hidden sm:inline-flex p-1.5 rounded-xl border border-[#38322D] hover:border-[#C89B3C]/50 bg-[#171513] hover:bg-[#2c2723] text-[#A69E95] hover:text-[#C89B3C] transition-all cursor-pointer text-xs"
                title="Configure reminder schedule"
                aria-label="Configure reminder time"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Google Calendar Hub Shortcut */}
          {onOpenCalendarModal && (
            <button
              id="btn-header-calendar"
              onClick={onOpenCalendarModal}
              className="flex items-center space-x-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#38322D] hover:border-[#C89B3C]/50 bg-[#171513] hover:bg-[#2c2723] text-xs text-[#C89B3C] transition-all cursor-pointer font-medium"
              title="Open Google Calendar Hub"
              aria-label="Calendar Hub"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden md:inline">Calendar</span>
            </button>
          )}

          {/* Profile Shortcut */}
          <button
            id="btn-header-profile"
            onClick={() => onNavigate("profile")}
            className={`flex items-center space-x-1.5 p-1 sm:pl-1.5 sm:pr-2.5 sm:py-1 rounded-xl transition-all border cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#2c2723] border-[#C89B3C]/50 text-[#F3EFE8]"
                : "border-[#38322D] hover:bg-[#2c2723] text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
            title="Profile & Wellbeing Preferences"
            aria-label="User Profile"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#38322D]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#171513] border border-[#38322D] flex items-center justify-center text-[#C89B3C] text-xs font-semibold">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
            )}
            <span className="hidden md:inline text-xs font-medium max-w-[80px] truncate text-[#F3EFE8]">
              {user.displayName?.split(" ")[0] || "Profile"}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            id="btn-header-signout"
            onClick={onSignOut}
            className="flex items-center space-x-1.5 p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium text-[#B7AFA7] hover:text-[#F3EFE8] bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] rounded-xl transition-colors cursor-pointer"
            title="Sign out of current session"
            aria-label="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

