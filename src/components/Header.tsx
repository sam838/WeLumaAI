import React from "react";
import { Sparkles, LogOut, ShieldCheck, User, Menu, Heart, Calendar } from "lucide-react";
import { AuthUserState, NavigationTab } from "../types";

interface HeaderProps {
  user: AuthUserState;
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onSignOut: () => void;
  onToggleMobileMenu?: () => void;
  onOpenCalendarModal?: () => void;
  syncStatus?: "synced" | "saving" | "error";
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onNavigate,
  onSignOut,
  onToggleMobileMenu,
  onOpenCalendarModal,
  syncStatus = "synced",
}) => {
  return (
    <header className="w-full bg-[#211E1B] border-b border-[#38322D] text-[#F3EFE8] px-4 sm:px-6 py-3 transition-colors shrink-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Branding & Mobile Menu Toggle */}
        <div className="flex items-center space-x-3">
          {onToggleMobileMenu && (
            <button
              id="btn-toggle-mobile-menu"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => onNavigate("today")}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shadow-2xs group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-[#C89B3C]/20" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-base sm:text-lg tracking-tight text-[#F3EFE8]">
                  Good Health & Wellbeing
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#171513] text-[#738F85] border border-[#738F85]/40 uppercase tracking-wider">
                  Companion
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-[#B7AFA7]">
                Mindful Reflections • Healthy Habits • Meaningful Living
              </p>
            </div>
          </div>
        </div>

        {/* Right: Sync Status, Security Badge, Profile & Sign Out */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          {/* Security & Firestore Status */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6E9A7B]" />
            <span className="text-[11px] text-[#B7AFA7]">Isolated UID</span>
          </div>

          {/* Real-time Sync Indicator */}
          <div className="flex items-center space-x-1.5 text-xs text-[#B7AFA7] bg-[#171513] px-2.5 py-1 rounded-lg border border-[#38322D]">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === "saving"
                  ? "bg-[#C89B3C] animate-pulse"
                  : syncStatus === "error"
                  ? "bg-[#B86B6B]"
                  : "bg-[#6E9A7B]"
              }`}
            />
            <span className="hidden md:inline text-[11px]">
              {syncStatus === "saving"
                ? "Saving..."
                : syncStatus === "error"
                ? "Sync Warning"
                : "Cloud & Local Synced"}
            </span>
          </div>

          {/* Google Calendar Hub Shortcut */}
          {onOpenCalendarModal && (
            <button
              id="btn-header-calendar"
              onClick={onOpenCalendarModal}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#38322D] hover:border-[#C89B3C]/50 bg-[#171513] hover:bg-[#2c2723] text-xs text-[#C89B3C] transition-all cursor-pointer font-medium"
              title="Open Google Calendar Hub"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          )}

          {/* Profile Shortcut */}
          <button
            id="btn-header-profile"
            onClick={() => onNavigate("profile")}
            className={`flex items-center space-x-2 pl-2 pr-3 py-1 rounded-xl transition-all border cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#2c2723] border-[#C89B3C]/50 text-[#F3EFE8]"
                : "border-[#38322D] hover:bg-[#2c2723] text-[#B7AFA7] hover:text-[#F3EFE8]"
            }`}
            title="Profile & Wellbeing Preferences"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-7 h-7 rounded-full object-cover border border-[#38322D]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#171513] border border-[#38322D] flex items-center justify-center text-[#C89B3C] text-xs font-semibold">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
            )}
            <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate text-[#F3EFE8]">
              {user.displayName?.split(" ")[0] || (user.isAnonymous ? "Guest" : "Explorer")}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            id="btn-header-signout"
            onClick={onSignOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-[#B7AFA7] hover:text-[#F3EFE8] bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] rounded-xl transition-colors cursor-pointer"
            title="Sign out of current session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
