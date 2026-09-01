import React from "react";
import { Sparkles, LogOut, ShieldCheck, UserCheck, Menu, Calendar } from "lucide-react";
import { AuthUserState } from "../types";

interface NavbarProps {
  user: AuthUserState;
  onSignOut: () => void;
  onToggleSidebar?: () => void;
  onOpenProfile?: () => void;
  onOpenCalendar?: () => void;
  syncStatus?: "synced" | "saving" | "error";
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onToggleSidebar,
  onOpenProfile,
  onOpenCalendar,
  syncStatus = "synced",
}) => {
  return (
    <header className="w-full bg-[#211E1B] border-b border-[#38322D] text-[#F3EFE8] px-4 sm:px-6 py-3 transition-colors duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Branding & Mobile Toggle */}
        <div className="flex items-center space-x-3">
          {onToggleSidebar && (
            <button
              id="btn-toggle-sidebar"
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723] transition-colors"
              aria-label="Toggle Entry History"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C] shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-base sm:text-lg tracking-tight text-[#F3EFE8] font-sans">
                  Gemini Journal
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#171513] text-[#B7AFA7] border border-[#38322D]">
                  3.6 Flash
                </span>
              </div>
              <p className="hidden md:block text-xs text-[#B7AFA7]">
                Private AI Reflections & Cloud Firestore Storage
              </p>
            </div>
          </div>
        </div>

        {/* Right: Sync Status, Calendar, User Info & Logout */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Calendar & Reminders Navigation Button */}
          {onOpenCalendar && (
            <button
              id="btn-open-calendar"
              onClick={onOpenCalendar}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] hover:border-[#C89B3C]/60 text-[#F3EFE8] rounded-xl text-xs font-medium transition-all group cursor-pointer shadow-2xs"
              title="Open Google Calendar & Daily Reminders"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C89B3C] group-hover:scale-110 transition-transform" />
              <span className="font-medium">Calendar & Reminders</span>
            </button>
          )}

          {/* Security & Firestore Status Indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#171513] border border-[#38322D] text-xs text-[#F3EFE8]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#6E9A7B]" />
            <span>UID Isolated</span>
          </div>

          {/* Sync indicator */}
          <div className="flex items-center space-x-1.5 text-xs text-[#B7AFA7]">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === "saving"
                  ? "bg-[#C89B3C] animate-pulse"
                  : syncStatus === "error"
                  ? "bg-[#B86B6B]"
                  : "bg-[#6E9A7B]"
              }`}
            />
            <span className="hidden sm:inline">
              {syncStatus === "saving"
                ? "Saving..."
                : syncStatus === "error"
                ? "Sync Error"
                : "Cloud Synced"}
            </span>
          </div>

          {/* User Profile Button */}
          <button
            id="btn-user-profile"
            onClick={onOpenProfile}
            className="flex items-center space-x-2.5 pl-2.5 pr-2 py-1 border-l border-[#38322D] hover:bg-[#2c2723] rounded-xl transition-all group text-left cursor-pointer"
            title="Click to edit profile & reflection preferences"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-8 h-8 rounded-full border border-[#38322D] group-hover:border-[#C89B3C]/60 object-cover shadow-2xs transition-colors"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#171513] group-hover:bg-[#2c2723] border border-[#38322D] group-hover:border-[#C89B3C]/60 flex items-center justify-center text-[#B7AFA7] text-xs font-semibold shadow-2xs transition-colors">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-[#F3EFE8] group-hover:text-white truncate max-w-[120px]">
                  {user.displayName || "Explorer"}
                </p>
                <span className="text-[10px] text-[#C89B3C] group-hover:text-[#C89B3C] font-mono">Edit</span>
              </div>
              <p className="text-[10px] text-[#B7AFA7] truncate max-w-[120px]">
                {user.profile?.city && user.profile?.countryStay
                  ? `${user.profile.city}, ${user.profile.countryStay}`
                  : user.isAnonymous
                  ? "Guest Session"
                  : user.email || "Settings"}
              </p>
            </div>
          </button>

          {/* Sign out button */}
          <button
            id="btn-signout"
            onClick={onSignOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-[#F3EFE8] hover:text-white bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] rounded-lg transition-colors cursor-pointer"
            title="Sign out of current session"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B7AFA7]" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
