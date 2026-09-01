import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Search,
  BookOpen,
  Heart,
  TrendingUp,
  Brain,
  Sun,
  ShieldCheck,
  Tag,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  JournalInteraction,
  NavigationTab,
  PersonalizationConfidence,
  StoredPreferenceItem,
  WellbeingDomain,
} from "../types";
import { MINDFUL_INQUIRY_PROMPTS } from "../services/wellbeingData";

interface InsightsViewProps {
  interactions: JournalInteraction[];
  storedPreferences: StoredPreferenceItem[];
  onNavigate: (tab: NavigationTab) => void;
  onSelectJournalEntry: (id: string) => void;
  onDeletePreferenceItem?: (id: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  interactions,
  storedPreferences,
  onNavigate,
  onSelectJournalEntry,
  onDeletePreferenceItem,
}) => {
  const [inquiryQuery, setInquiryQuery] = useState("");
  const [selectedInquiryResult, setSelectedInquiryResult] = useState<string | null>(null);

  // Compute Domain Balance
  const domainStats = useMemo(() => {
    const counts: Record<WellbeingDomain, number> = {
      mind: 0,
      body: 0,
      life: 0,
      connection: 0,
    };

    interactions.forEach((item) => {
      if (item.domains && item.domains.length > 0) {
        item.domains.forEach((d) => {
          if (counts[d] !== undefined) counts[d]++;
        });
      } else {
        counts.mind++;
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return {
      mind: { count: counts.mind, percent: Math.round((counts.mind / total) * 100) },
      body: { count: counts.body, percent: Math.round((counts.body / total) * 100) },
      life: { count: counts.life, percent: Math.round((counts.life / total) * 100) },
      connection: { count: counts.connection, percent: Math.round((counts.connection / total) * 100) },
      totalEntries: interactions.length,
    };
  }, [interactions]);

  // Mood counts
  const moodDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    interactions.forEach((it) => {
      const mood = it.mood || "reflective";
      distribution[mood] = (distribution[mood] || 0) + 1;
    });
    return Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  }, [interactions]);

  // Handle "Ask My Journal" query search
  const handleInquirySearch = (promptText: string) => {
    setInquiryQuery(promptText);
    const matching = interactions.filter((item) => {
      const q = promptText.toLowerCase();
      return (
        (item.title || "").toLowerCase().includes(q) ||
        (item.rawText || "").toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    if (matching.length > 0) {
      setSelectedInquiryResult(
        `Found ${matching.length} matching journal reflection${
          matching.length > 1 ? "s" : ""
        } related to "${promptText}". The most recent was titled "${matching[0].title}".`
      );
    } else {
      setSelectedInquiryResult(
        `No direct journal entries matched "${promptText}". As you continue logging entries in the Journal, grounded reflections will emerge here.`
      );
    }
  };

  const getConfidenceBadge = (confidence: PersonalizationConfidence) => {
    switch (confidence) {
      case "HIGH":
        return "bg-[#6E9A7B]/20 text-[#6E9A7B] border-[#6E9A7B]/40";
      case "MEDIUM":
        return "bg-[#C89B3C]/20 text-[#C89B3C] border-[#C89B3C]/40";
      case "LOW":
      default:
        return "bg-[#738F85]/20 text-[#738F85] border-[#738F85]/40";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#171513] text-[#F3EFE8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#211E1B] border border-[#38322D] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#C89B3C] uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Grounded Insights & Patterns</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE8]">
              Personal Wellbeing Insights
            </h1>
            <p className="text-xs sm:text-sm text-[#B7AFA7]">
              Explore trends across Mind, Body, Life, and Connection without clinical labels or artificial scores.
            </p>
          </div>

          <button
            id="btn-insights-write-journal"
            onClick={() => onNavigate("journal")}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#C89B3C] hover:bg-[#b98c2d] text-[#171513] font-semibold text-xs transition-all shadow-sm cursor-pointer shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span>Add Journal Entry</span>
          </button>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Domain Breakdown & Ask My Journal */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Four Wellbeing Domains Balance Card */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-5 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div>
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Wellbeing Domain Distribution
                  </h2>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Distribution across {domainStats.totalEntries} recorded reflection{domainStats.totalEntries === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs font-mono text-[#C89B3C] bg-[#171513] px-2.5 py-1 rounded-lg border border-[#38322D]">
                  {domainStats.totalEntries} Total Entries
                </span>
              </div>

              {/* Progress bars */}
              <div className="space-y-3">
                {/* Mind */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#C89B3C]">Mind</span>
                    <span className="text-[#B7AFA7] font-mono">
                      {domainStats.mind.count} entries ({domainStats.mind.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#171513] overflow-hidden">
                    <div
                      className="h-full bg-[#C89B3C] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(domainStats.mind.percent, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#738F85]">Body</span>
                    <span className="text-[#B7AFA7] font-mono">
                      {domainStats.body.count} entries ({domainStats.body.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#171513] overflow-hidden">
                    <div
                      className="h-full bg-[#738F85] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(domainStats.body.percent, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Life */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#6E9A7B]">Life</span>
                    <span className="text-[#B7AFA7] font-mono">
                      {domainStats.life.count} entries ({domainStats.life.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#171513] overflow-hidden">
                    <div
                      className="h-full bg-[#6E9A7B] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(domainStats.life.percent, 4)}%` }}
                    />
                  </div>
                </div>

                {/* Connection */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[#D4A373]">Connection</span>
                    <span className="text-[#B7AFA7] font-mono">
                      {domainStats.connection.count} entries ({domainStats.connection.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#171513] overflow-hidden">
                    <div
                      className="h-full bg-[#D4A373] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(domainStats.connection.percent, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Ask My Journal (Directive 22) */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-[#38322D]">
                <div className="w-8 h-8 rounded-xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 flex items-center justify-center text-[#C89B3C]">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Ask My Journal
                  </h2>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Conversational inquiry grounded in your private entries
                  </p>
                </div>
              </div>

              {/* Inquiry Input */}
              <div className="relative">
                <input
                  id="input-ask-my-journal"
                  type="text"
                  value={inquiryQuery}
                  onChange={(e) => setInquiryQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inquiryQuery.trim()) {
                      handleInquirySearch(inquiryQuery.trim());
                    }
                  }}
                  placeholder="e.g. When do I feel most energized? What made me grateful?"
                  className="w-full pl-3.5 pr-20 py-2.5 bg-[#171513] border border-[#38322D] rounded-xl text-xs text-[#F3EFE8] placeholder-[#B7AFA7]/50 focus:outline-none focus:border-[#C89B3C]/60"
                />
                <button
                  id="btn-search-inquiry"
                  onClick={() => {
                    if (inquiryQuery.trim()) handleInquirySearch(inquiryQuery.trim());
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#C89B3C] text-[#171513] rounded-lg text-xs font-semibold hover:bg-[#b98c2d] transition-colors cursor-pointer"
                >
                  Ask
                </button>
              </div>

              {/* Sample Inquiries */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#B7AFA7]">
                  Suggested Mindful Questions:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MINDFUL_INQUIRY_PROMPTS.map((q) => (
                    <button
                      key={q.id}
                      id={`btn-inquiry-${q.id}`}
                      onClick={() => handleInquirySearch(q.prompt)}
                      className="px-2.5 py-1 rounded-lg bg-[#171513] border border-[#38322D] hover:border-[#C89B3C]/40 text-[#B7AFA7] hover:text-[#F3EFE8] text-[11px] transition-colors text-left cursor-pointer"
                    >
                      {q.prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inquiry Result Preview Box */}
              {selectedInquiryResult && (
                <div className="p-3.5 rounded-2xl bg-[#171513] border border-[#38322D] space-y-1.5 animate-fade-in">
                  <div className="flex items-center space-x-1.5 text-xs text-[#C89B3C] font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Inquiry Discovery</span>
                  </div>
                  <p className="text-xs text-[#F3EFE8] leading-relaxed">
                    {selectedInquiryResult}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Weekly Reflection Preview & Stored Confidence Inspector */}
          <div className="lg:col-span-5 space-y-6">
            {/* 3. Weekly Reflection Summary Card (Directive 24) */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-md">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-[#38322D]">
                <div className="w-8 h-8 rounded-xl bg-[#738F85]/10 border border-[#738F85]/30 flex items-center justify-center text-[#738F85]">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Weekly Wellbeing Snapshot
                  </h2>
                  <p className="text-[11px] text-[#B7AFA7]">
                    Supportive, non-judgmental synthesis
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#171513] rounded-2xl border border-[#38322D] space-y-2.5">
                <p className="text-xs text-[#F3EFE8] leading-relaxed">
                  {interactions.length > 0
                    ? `You've recorded ${interactions.length} reflection${
                        interactions.length === 1 ? "" : "s"
                      } recently, exploring intentions primarily in ${
                        domainStats.mind.count >= domainStats.body.count ? "Mind" : "Body"
                      } and sustainable habits.`
                    : "Begin logging your experiences to synthesize emotional trends, movement consistency, and restorative habits."}
                </p>

                {moodDistribution.length > 0 && (
                  <div className="pt-2 border-t border-[#38322D] flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-[#B7AFA7]">Top Moods:</span>
                    {moodDistribution.slice(0, 3).map(([m, c]) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md bg-[#211E1B] text-[#C89B3C] border border-[#38322D] text-[10px] capitalize"
                      >
                        {m} ({c})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Observed Patterns & Confidence Inspector (Directive 14 & 26) */}
            <div className="bg-[#211E1B] border border-[#38322D] rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-[#38322D]">
                <div className="flex items-center space-x-2">
                  <Brain className="w-4 h-4 text-[#C89B3C]" />
                  <h2 className="text-sm font-bold text-[#F3EFE8] font-serif">
                    Confidence-Aware Memory
                  </h2>
                </div>
                <span className="text-[10px] text-[#B7AFA7]">
                  Directive 14 / 26
                </span>
              </div>

              <p className="text-[11px] text-[#B7AFA7] leading-relaxed">
                Stored memories and inferred patterns are transparently separated by confidence level. You have full control to inspect, confirm, or delete items.
              </p>

              <div className="space-y-2">
                {storedPreferences.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#171513] border border-[#38322D] text-center text-xs text-[#B7AFA7]">
                    No custom memories or patterns stored yet.
                  </div>
                ) : (
                  storedPreferences.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-[#171513] rounded-2xl border border-[#38322D] space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-[#F3EFE8]">
                          {item.label}
                        </h4>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border ${getConfidenceBadge(
                            item.confidence
                          )}`}
                        >
                          {item.confidence}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#B7AFA7] leading-relaxed">
                        {item.value}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-[#B7AFA7] pt-1">
                        <span className="italic">
                          Source: {item.source.replace("_", " ")}
                        </span>
                        {onDeletePreferenceItem && (
                          <button
                            onClick={() => onDeletePreferenceItem(item.id)}
                            className="text-[#B86B6B] hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
