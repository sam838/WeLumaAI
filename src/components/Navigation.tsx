import React from "react";
import {
  Sun,
  BookOpen,
  Sparkles,
  Compass,
  CalendarCheck,
  User,
  X,
  Heart,
  ChevronRight,
} from "lucide-react";
import { NavigationTab, AuthUserState } from "../types";

interface NavigationProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  user: AuthUserState;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  counts?: {
    journalEntries?: number;
    activeRoutines?: number;
    savedActivities?: number;
  };
}

interface NavItem {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  badge?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onNavigate,
  user,
  mobileMenuOpen,
  onCloseMobileMenu,
  counts,
}) => {
  const NAV_ITEMS: NavItem[] = [
    {
      id: "today",
      label: "Home / Today",
      shortLabel: "Today",
      icon: Sun,
      description: "Daily check-in, habits & mindful intentions",
    },
    {
      id: "journal",
      label: "Journal",
      shortLabel: "Journal",
      icon: BookOpen,
      description: "Capture, reflect & understand experiences",
      badge: counts?.journalEntries,
    },
    {
      id: "insights",
      label: "Insights",
      shortLabel: "Insights",
      icon: Sparkles,
      description: "Patterns, domain balance & mindful inquiries",
    },
    {
      id: "activities",
      label: "Activities",
      shortLabel: "Activities",
      icon: Compass,
      description: "Wellbeing suggestions & grounding practices",
      badge: counts?.savedActivities,
    },
    {
      id: "planner",
      label: "Planner",
      shortLabel: "Planner",
      icon: CalendarCheck,
      description: "Sustainable routines & scheduled habits",
      badge: counts?.activeRoutines,
    },
    {
      id: "profile",
      label: "Profile & Preferences",
      shortLabel: "Profile",
      icon: User,
      description: "Values, preferences & memory controls",
    },
  ];

  return (
    <>
      {/* 1. Desktop Secondary Top Navigation Bar */}
      <nav
        aria-label="Main Navigation"
        className="w-full bg-[#1b1816] border-b border-[#38322D] px-4 sm:px-6 hidden lg:block shrink-0"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-1 py-1.5 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#2c2723] text-[#C89B3C] border border-[#C89B3C]/40 shadow-xs font-semibold"
                      : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#211E1B] border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-[#C89B3C]" : "text-[#B7AFA7]"
                    }`}
                  />
                  <span>{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive
                          ? "bg-[#C89B3C] text-[#171513] font-bold"
                          : "bg-[#171513] text-[#B7AFA7] border border-[#38322D]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-[#B7AFA7]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#738F85]" />
            <span className="italic">Non-clinical mindful companion</span>
          </div>
        </div>
      </nav>

      {/* 2. Mobile Slide-Over Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobileMenu}
          />

          {/* Drawer Container */}
          <div className="relative w-4/5 max-w-xs h-full bg-[#211E1B] border-r border-[#38322D] p-5 flex flex-col justify-between z-10 shadow-2xl">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#38322D] mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#F3EFE8]">
                      Wellbeing App
                    </h3>
                    <p className="text-[10px] text-[#B7AFA7]">Phase 1 Foundation</p>
                  </div>
                </div>
                <button
                  onClick={onCloseMobileMenu}
                  className="p-1.5 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      id={`mobile-nav-${item.id}`}
                      onClick={() => {
                        onNavigate(item.id);
                        if (onCloseMobileMenu) onCloseMobileMenu();
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#2c2723] text-[#C89B3C] border border-[#C89B3C]/40 font-semibold"
                          : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? "text-[#C89B3C]" : "text-[#B7AFA7]"
                          }`}
                        />
                        <div>
                          <p className="text-xs font-medium text-[#F3EFE8]">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-[#B7AFA7]">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Session Mini Profile */}
            <div className="pt-4 border-t border-[#38322D] flex items-center space-x-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-9 h-9 rounded-full object-cover border border-[#38322D]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#171513] border border-[#38322D] flex items-center justify-center text-[#C89B3C] text-xs font-semibold">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-[#F3EFE8] truncate">
                  {user.displayName || "Mindful Member"}
                </p>
                <p className="text-[10px] text-[#B7AFA7] truncate">
                  {user.isAnonymous ? "Guest Session" : user.email || "Private Profile"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#211E1B]/95 backdrop-blur-md border-t border-[#38322D] px-2 py-1.5 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative cursor-pointer ${
                isActive ? "text-[#C89B3C]" : "text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">
                {item.shortLabel}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#C89B3C] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};
