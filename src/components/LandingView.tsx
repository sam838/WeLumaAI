import React, { useState } from "react";
import {
  Heart,
  Shield,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  CalendarCheck,
  Compass,
} from "lucide-react";

interface LandingViewProps {
  onSignInGoogle: () => Promise<void>;
  onSignInGuest: () => Promise<void>;
  onStartSandbox: () => void;
  loading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignInGoogle,
  onSignInGuest,
  onStartSandbox,
  loading,
  errorMessage,
  onClearError,
}) => {
  const [activeAction, setActiveAction] = useState<"google" | "guest" | null>(null);

  const handleGoogleClick = async () => {
    setActiveAction("google");
    try {
      await onSignInGoogle();
    } finally {
      setActiveAction(null);
    }
  };

  const handleGuestClick = async () => {
    setActiveAction("guest");
    try {
      await onSignInGuest();
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#171513] text-[#F3EFE8] flex flex-col justify-between selection:bg-[#C89B3C]/25 selection:text-[#F3EFE8] font-sans">
      {/* Top minimalistic banner */}
      <header className="border-b border-[#38322D] px-6 py-4 bg-[#211E1B]/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-tight text-[#F3EFE8]">
                Good Health & Wellbeing
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-[#B7AFA7]">
            <Shield className="w-3.5 h-3.5 text-[#6E9A7B]" />
            <span className="hidden sm:inline">Owner-Bound Firestore Isolation</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl mx-auto">
          {/* Card Container */}
          <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-sm">
            {/* Header Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mindful Journaling & Wellbeing Companion</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F3EFE8] mb-4 font-serif leading-tight">
              A calm, private space for your wellbeing.
            </h1>

            <p className="text-[#B7AFA7] text-sm sm:text-base leading-relaxed mb-6">
              Capture your experiences, track mindful routines, and nurture inner balance across <strong className="text-[#F3EFE8]">Mind</strong>, <strong className="text-[#F3EFE8]">Body</strong>, <strong className="text-[#F3EFE8]">Life</strong>, and <strong className="text-[#F3EFE8]">Connection</strong>.
            </p>

            {/* Feature Pills */}
            <div className="grid grid-cols-3 gap-2.5 mb-8 text-center text-[11px] text-[#B7AFA7]">
              <div className="p-2.5 rounded-xl bg-[#171513] border border-[#38322D] flex flex-col items-center">
                <BookOpen className="w-4 h-4 text-[#C89B3C] mb-1" />
                <span>Journal First</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#171513] border border-[#38322D] flex flex-col items-center">
                <CalendarCheck className="w-4 h-4 text-[#738F85] mb-1" />
                <span>Daily Routines</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#171513] border border-[#38322D] flex flex-col items-center">
                <Compass className="w-4 h-4 text-[#6E9A7B] mb-1" />
                <span>Self Discovery</span>
              </div>
            </div>

            {/* Error Notification with Sandbox option */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-[#B86B6B]/15 border border-[#B86B6B]/40 text-[#F3EFE8] text-xs flex flex-col space-y-3">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-[#B86B6B] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-[#F3EFE8]">Sign-In Notice</p>
                    <p className="text-[#B7AFA7] mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                  <button
                    onClick={onClearError}
                    className="text-xs text-[#C89B3C] hover:text-[#F3EFE8] font-semibold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="pt-2 border-t border-[#B86B6B]/30 flex justify-end">
                  <button
                    id="btn-error-enter-sandbox"
                    onClick={onStartSandbox}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <span>Start Instant Sandbox Session</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Auth Action Buttons */}
            <div className="space-y-3">
              {/* Primary: Google Sign In */}
              <button
                id="btn-google-signin"
                onClick={handleGoogleClick}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 px-5 py-3.5 rounded-xl bg-[#F3EFE8] hover:bg-white text-[#171513] font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {activeAction === "google" ? (
                  <div className="w-5 h-5 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>

              {/* Instant Sandbox Session */}
              <button
                id="btn-sandbox-signin"
                onClick={onStartSandbox}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-[#C89B3C]/15 hover:bg-[#C89B3C]/25 text-[#F3EFE8] border border-[#C89B3C]/40 font-medium text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#C89B3C]" />
                <span>Instant Sandbox Session (Local / Zero Wait)</span>
              </button>

              {/* Guest / Anonymous Mode */}
              <button
                id="btn-guest-signin"
                onClick={handleGuestClick}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#171513] hover:bg-[#2c2723] text-[#B7AFA7] hover:text-[#F3EFE8] border border-[#38322D] font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {activeAction === "guest" ? (
                  <div className="w-4 h-4 border-2 border-[#B7AFA7] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-[#B7AFA7]" />
                )}
                <span>Continue as Guest</span>
              </button>
            </div>

            {/* Privacy & Non-clinical note */}
            <div className="mt-8 pt-6 border-t border-[#38322D] space-y-2 text-xs text-[#B7AFA7]">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#6E9A7B] shrink-0 mt-0.5" />
                <span>Passwordless federated identity — credentials are never handled or stored locally.</span>
              </div>
              <div className="flex items-start space-x-2">
                <Heart className="w-4 h-4 text-[#C89B3C] shrink-0 mt-0.5" />
                <span>Non-clinical companion supporting personal wellbeing, reflection, and routines.</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#38322D] px-6 py-4 text-center text-xs text-[#B7AFA7] bg-[#211E1B]/30">
        <p>Good Health & Wellbeing Companion • Phase 1 Foundation • Privacy First</p>
      </footer>
    </div>
  );
};
