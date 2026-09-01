import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Lightbulb,
  FileText,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Check,
  Tag,
  Copy,
  Clock,
  Compass,
  Save,
  Zap,
  Brain,
  Smile,
  ShieldCheck,
  Calendar,
  ListTodo
} from "lucide-react";
import { JournalInteraction, JournalMode, ReflectionDepth } from "../types";

interface JournalEditorProps {
  interaction: JournalInteraction | null;
  onSendMessage: (
    prompt: string,
    mode: JournalMode,
    depth: ReflectionDepth,
    title: string
  ) => Promise<void>;
  onSaveEntryOnly: (
    prompt: string,
    mode: JournalMode,
    depth: ReflectionDepth,
    title: string
  ) => Promise<void>;
  onUpdateTitle: (title: string) => void;
  onUpdateMode: (mode: JournalMode) => void;
  onUpdateDepth: (depth: ReflectionDepth) => void;
  onOpenCalendar?: () => void;
  isGenerating: boolean;
  isSaving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
}

const PROMPT_STARTERS = [
  "🗓️ Review today's schedule and plan 3 mindful focus intervals and boundaries.",
  "What is consuming the most cognitive energy in my life right now, and what boundary can I set?",
  "A challenging decision I need to make this week, and the assumptions I am making about it...",
  "What went unexpectedly well recently, and what personal strength did that reveal?",
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  interaction,
  onSendMessage,
  onSaveEntryOnly,
  onUpdateTitle,
  onUpdateMode,
  onUpdateDepth,
  onOpenCalendar,
  isGenerating,
  isSaving,
  saveError,
  onRetrySave,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interaction?.messages, isGenerating]);

  // Adjust textarea height automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220
      )}px`;
    }
  }, [inputText]);

  const currentMode = interaction?.mode || "reflection";
  const currentDepth = interaction?.depth || "reflect";
  const currentTitle = interaction?.title || "";

  // 1. Send reflection message with AI
  const handleReflect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isGenerating || isSaving) return;

    try {
      await onSendMessage(trimmed, currentMode, currentDepth, currentTitle);
      setInputText("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      // Input buffer is strictly preserved so the user loses nothing!
    }
  };

  // 2. Direct save entry without calling AI
  const handleDirectSave = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isGenerating || isSaving) return;

    try {
      await onSaveEntryOnly(trimmed, currentMode, currentDepth, currentTitle);
      setInputText("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      // Input buffer is strictly preserved
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleReflect();
    }
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const messages = interaction?.messages || [];
  const analysis = interaction?.analysis;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#171513] text-[#F3EFE8] overflow-hidden">
      {/* Editor Header: Title, Depth & Mode Tabs & Status */}
      <div className="p-4 sm:px-6 border-b border-[#38322D] bg-[#211E1B]/80 backdrop-blur flex flex-col gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <input
              id="input-entry-title"
              type="text"
              value={interaction?.title || ""}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder="Untitled Journal Reflection..."
              className="w-full bg-transparent font-serif text-lg sm:text-xl font-bold text-[#F3EFE8] placeholder-[#B7AFA7]/60 focus:outline-none border-b border-transparent focus:border-[#C89B3C]/60 transition-colors"
            />
            <div className="flex items-center space-x-3 text-xs text-[#B7AFA7] mt-1">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {interaction?.updatedAt
                    ? new Date(interaction.updatedAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "New session"}
                </span>
              </span>

              {justSaved && (
                <span className="flex items-center space-x-1 text-[#6E9A7B] font-medium text-[11px] animate-fade-in">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Saved to Cloud Firestore & Local Mirror</span>
                </span>
              )}

              {interaction?.modelUsed && (
                <span className="px-1.5 py-0.5 rounded bg-[#171513] text-[#C89B3C] border border-[#38322D] font-mono text-[10px]">
                  {interaction.modelUsed}
                </span>
              )}
            </div>
          </div>

          {/* Depth Selector (Directive 7: Quick, Reflect, Deep) */}
          <div className="flex items-center space-x-1 bg-[#171513] p-1 rounded-xl border border-[#38322D] shrink-0 text-xs">
            <button
              id="btn-depth-quick"
              type="button"
              onClick={() => onUpdateDepth("quick")}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentDepth === "quick"
                  ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-sm"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
              title="Quick Mode: Fast check-in with lite model"
            >
              <Zap className="w-3 h-3" />
              <span>Quick</span>
            </button>

            <button
              id="btn-depth-reflect"
              type="button"
              onClick={() => onUpdateDepth("reflect")}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentDepth === "reflect"
                  ? "bg-[#738F85] text-[#171513] font-semibold shadow-sm"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
              title="Reflect Mode: Balanced default with context analysis"
            >
              <Sparkles className="w-3 h-3" />
              <span>Reflect</span>
            </button>

            <button
              id="btn-depth-deep"
              type="button"
              onClick={() => onUpdateDepth("deep")}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentDepth === "deep"
                  ? "bg-[#C89B3C] text-[#171513] font-semibold shadow-sm"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8]"
              }`}
              title="Deep Mode: Reasoning model with long-term pattern analysis"
            >
              <Brain className="w-3 h-3" />
              <span>Deep</span>
            </button>
          </div>
        </div>

        {/* Reflection Style Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto text-xs pb-0.5 no-scrollbar">
          <span className="text-[11px] text-[#B7AFA7] mr-1.5">Style:</span>
          {(
            [
              { key: "reflection", label: "Reflection", icon: Sparkles },
              { key: "summary", label: "Summary", icon: FileText },
              { key: "brainstorm", label: "Brainstorm", icon: Lightbulb },
              { key: "chat", label: "Dialogue", icon: MessageSquare },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onUpdateMode(key as JournalMode)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                currentMode === key
                  ? "bg-[#36302b] text-[#F3EFE8] font-semibold border border-[#38322D]"
                  : "text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#2c2723]"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error & Retry Banner (Transaction Verification Directive) */}
      {saveError && (
        <div className="bg-[#B86B6B]/20 border-b border-[#B86B6B]/50 px-4 py-3 text-[#F3EFE8] text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#B86B6B] shrink-0" />
            <span>Persistence Alert: {saveError} (Your written draft is preserved in local mirror)</span>
          </div>
          <button
            id="btn-retry-save"
            onClick={onRetrySave}
            className="flex items-center space-x-1 px-3 py-1 bg-[#B86B6B] hover:bg-[#a65d5d] text-white rounded-md font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry Save</span>
          </button>
        </div>
      )}

      {/* Main Conversation & Reflection Flow */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty / Starter Screen */
          <div className="max-w-2xl mx-auto py-8 sm:py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center mx-auto mb-4">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-serif text-[#F3EFE8] mb-2">
              Begin your reflection
            </h3>
            <p className="text-[#B7AFA7] text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Write freely about your ideas, challenges, or daily experiences. You can save your note directly or partner with Gemini to synthesize themes and gain clarity.
            </p>

            {onOpenCalendar && (
              <div className="mb-6 p-3.5 rounded-2xl bg-[#211E1B] border border-[#38322D] hover:border-[#C89B3C]/50 transition-all flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 text-[#C89B3C] flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#F3EFE8]">
                      Google Calendar & Daily Reminders
                    </h4>
                    <p className="text-[11px] text-[#B7AFA7]">
                      Inspect today's tasks or schedule mindful check-in reminders.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenCalendar}
                  className="px-3 py-1.5 bg-[#171513] hover:bg-[#2c2723] border border-[#38322D] text-[#C89B3C] rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  Open Calendar
                </button>
              </div>
            )}

            <div className="text-left space-y-2">
              <p className="text-xs font-semibold text-[#B7AFA7] uppercase tracking-wider pl-1">
                Reflective Inquiries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PROMPT_STARTERS.map((starter, idx) => (
                  <button
                    key={idx}
                    id={`btn-starter-${idx}`}
                    onClick={() => setInputText(starter)}
                    className="p-3 rounded-xl bg-[#211E1B] border border-[#38322D] hover:bg-[#2c2723] hover:border-[#C89B3C]/40 text-[#B7AFA7] hover:text-[#F3EFE8] text-xs text-left transition-all group cursor-pointer"
                  >
                    <span className="line-clamp-2 leading-relaxed">{starter}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Turn Dialogue Sequence */
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id || index}
                  id={`msg-turn-${index}`}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#2c2723] text-[#F3EFE8] border border-[#38322D] shadow-sm"
                        : "bg-[#211E1B] text-[#F3EFE8] border border-[#38322D] shadow-md w-full"
                    }`}
                  >
                    {/* Header line for model */}
                    {!isUser && (
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#38322D] text-xs">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#C89B3C]" />
                          <span className="font-semibold text-[#C89B3C]">Gemini Reflection</span>
                        </div>
                        <button
                          onClick={() => handleCopyText(msg.text, index)}
                          className="flex items-center space-x-1 text-[#B7AFA7] hover:text-[#F3EFE8] transition-colors p-1 cursor-pointer"
                          title="Copy reflection to clipboard"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3 h-3 text-[#6E9A7B]" />
                              <span className="text-[10px] text-[#6E9A7B]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap font-sans text-[#F3EFE8] leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Time footer */}
                    <div
                      className={`text-[10px] text-[#B7AFA7] mt-2 ${
                        isUser ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Emotional Analysis & Synthesis Card (Directive 7) */}
            {(interaction?.summary || (interaction?.themes && interaction.themes.length > 0) || analysis) && (
              <div className="rounded-xl bg-[#C89B3C]/5 border border-[#C89B3C]/25 p-4 max-w-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-[#C89B3C]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cognitive Synthesis & Emotional Context</span>
                  </div>
                  {analysis?.primaryEmotion && (
                    <span className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-[#171513] border border-[#38322D] text-[#F3EFE8] capitalize">
                      <Smile className="w-3 h-3 text-[#C89B3C]" />
                      <span>{analysis.primaryEmotion}</span>
                      {analysis.intensity ? ` (${analysis.intensity}/10)` : ""}
                    </span>
                  )}
                </div>

                {interaction?.summary && (
                  <p className="text-xs text-[#B7AFA7] leading-relaxed italic">
                    "{interaction.summary}"
                  </p>
                )}

                {interaction?.themes && interaction.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {interaction.themes.map((theme, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#171513] border border-[#C89B3C]/30 text-[#C89B3C] text-[11px]"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{theme}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Generation Shimmer */}
            {isGenerating && (
              <div className="flex items-start space-x-3 max-w-2xl p-4 rounded-2xl bg-[#211E1B]/80 border border-[#38322D] animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-[#C89B3C]/20 flex items-center justify-center text-[#C89B3C] shrink-0">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="space-y-2 flex-1 pt-1">
                  <div className="h-3 bg-[#36302b] rounded w-3/4" />
                  <div className="h-3 bg-[#36302b] rounded w-1/2" />
                  <p className="text-xs text-[#B7AFA7] pt-1">
                    Gemini is reflecting on your entry in <strong className="capitalize text-[#C89B3C]">{currentDepth}</strong> mode...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Persistent Composer Input with Direct Save & Reflect */}
      <div className="p-4 border-t border-[#38322D] bg-[#211E1B]/90 backdrop-blur shrink-0">
        <form onSubmit={handleReflect} className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl bg-[#171513] border border-[#38322D] focus-within:border-[#C89B3C]/60 transition-colors p-3 shadow-inner">
            <textarea
              id="input-journal-prompt"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || isSaving}
              rows={2}
              placeholder={
                currentMode === "summary"
                  ? "Paste thoughts to distill into core summaries and themes..."
                  : currentMode === "brainstorm"
                  ? "Describe a problem or goal you want creative ideas and next steps for..."
                  : "Write your thoughts, reflection, or question (Cmd+Enter to reflect)..."
              }
              className="w-full bg-transparent text-sm text-[#F3EFE8] placeholder-[#B7AFA7]/60 focus:outline-none resize-none leading-relaxed pr-12"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#38322D] text-xs text-[#B7AFA7]">
              <div className="flex items-center space-x-3 text-[11px]">
                <span>{inputText.length} chars</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline capitalize">
                  Mode: {currentDepth} ({currentMode})
                </span>
              </div>

              {/* Action Buttons: Direct Save Entry + Reflect with Gemini */}
              <div className="flex items-center space-x-2">
                <button
                  id="btn-direct-save"
                  type="button"
                  onClick={handleDirectSave}
                  disabled={!inputText.trim() || isGenerating || isSaving}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-[#2c2723] hover:bg-[#36302b] disabled:opacity-30 text-[#F3EFE8] font-medium text-xs transition-colors cursor-pointer disabled:cursor-not-allowed border border-[#38322D]"
                  title="Save this entry to your journal history directly"
                >
                  <Save className="w-3.5 h-3.5 text-[#B7AFA7]" />
                  <span>Save Note</span>
                </button>

                <button
                  id="btn-send-reflection"
                  type="submit"
                  disabled={!inputText.trim() || isGenerating || isSaving}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] disabled:opacity-30 disabled:hover:bg-[#C89B3C] text-[#171513] font-semibold text-xs transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#171513] border-t-transparent rounded-full animate-spin" />
                      <span>Reflecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Reflect with Gemini</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
