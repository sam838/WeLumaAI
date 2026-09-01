import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const PORT = 3000;

// Lazy initialization of GoogleGenAI SDK client
let genAIClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is missing or unconfigured. Please configure it in settings.");
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: apiKey.trim() });
  }
  return genAIClient;
}

// Directive 7: Centralized Model Tier Configuration
export const AI_TIERS = {
  lite: {
    primary: "gemini-3.1-flash-lite",
    fallbackLadder: ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"],
    maxOutputTokens: 250,
  },
  standard: {
    primary: "gemini-3.6-flash",
    fallbackLadder: ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"],
    maxOutputTokens: 700,
  },
  reasoning: {
    primary: "gemini-3.7-flash",
    fallbackLadder: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"],
    maxOutputTokens: 1600,
  },
};

interface GenerateFallbackResult {
  text: string;
  modelUsed: string;
  fallbackUsed: boolean;
}

/**
 * Directive 7.5: Mode-Aware Fallback Helper
 * Executes generation against the tier's model ladder, catching recoverable errors.
 */
async function generateContentForTier(
  ai: GoogleGenAI,
  tierName: "lite" | "standard" | "reasoning",
  options: {
    contents: any;
    systemInstruction?: string;
    maxOutputTokens?: number;
  }
): Promise<GenerateFallbackResult> {
  const tierConfig = AI_TIERS[tierName] || AI_TIERS.standard;
  const ladder = [tierConfig.primary, ...tierConfig.fallbackLadder.filter((m) => m !== tierConfig.primary)];
  const errorsEncountered: string[] = [];
  let fallbackUsed = false;

  for (let i = 0; i < ladder.length; i++) {
    const modelName = ladder[i];
    if (i > 0) fallbackUsed = true;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          maxOutputTokens: options.maxOutputTokens || tierConfig.maxOutputTokens,
        },
      });

      const responseText = response.text || "";
      if (responseText.trim().length > 0) {
        return {
          text: responseText,
          modelUsed: modelName,
          fallbackUsed,
        };
      }
      errorsEncountered.push(`${modelName}: Empty response generated`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const statusCode = err?.status || err?.statusCode || "";
      console.warn(`[Gemini Fallback] Tier '${tierName}' model '${modelName}' failed (${statusCode}): ${errMsg}`);
      errorsEncountered.push(`${modelName} (${statusCode}): ${errMsg}`);

      const isRecoverable =
        /503|429|404|500|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|INTERNAL|fetch failed|rate limit|quota/i.test(
          errMsg + " " + statusCode
        );

      if (!isRecoverable && i === 0) {
        if (/API_KEY_INVALID|invalid api key|forbidden|403/i.test(errMsg)) {
          throw new Error(`Gemini API Authentication error: ${errMsg}`);
        }
      }
    }
  }

  throw new Error(`All models in tier '${tierName}' ladder failed: ${errorsEncountered.join(" | ")}`);
}

async function startServer() {
  const app = express();

  // 1. Top-Level Request Deserialization (Ordering Guarantee)
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      geminiConfigured: hasApiKey,
      tiers: {
        lite: AI_TIERS.lite.primary,
        standard: AI_TIERS.standard.primary,
        reasoning: AI_TIERS.reasoning.primary,
      },
    });
  });

  // 2. Gemini Reflection & Journal Processing Endpoint
  // Implements Directive 7: Adaptive Resource Usage (quick, reflect, deep)
  app.post("/api/gemini/reflect", async (req: Request, res: Response) => {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    const style = typeof payload.mode === "string" ? payload.mode : "reflection"; // reflection, summary, brainstorm, chat
    const depth = (typeof payload.depth === "string" && ["quick", "reflect", "deep"].includes(payload.depth)
      ? payload.depth
      : "reflect") as "quick" | "reflect" | "deep";
    const history = Array.isArray(payload.history) ? payload.history : [];
    const entryTitle = typeof payload.title === "string" ? payload.title.trim() : "";
    const userProfile = payload.userProfile && typeof payload.userProfile === "object" ? payload.userProfile : null;
    const clientNow = typeof payload.clientNow === "string" ? payload.clientNow : new Date().toISOString();
    const clientTimezone = typeof payload.clientTimezone === "string" ? payload.clientTimezone : "UTC";
    const clientLocation = payload.clientLocation && typeof payload.clientLocation === "object" ? payload.clientLocation : null;

    if (!prompt) {
      return res.status(400).json({
        error: "Invalid request payload: 'prompt' must be a non-empty string.",
      });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({
        error: "Prompt exceeds maximum allowed length of 10,000 characters.",
      });
    }

    try {
      const ai = getGeminiClient();

      // Calculate readable client date, day of week, and time
      let clientDateObj = new Date(clientNow);
      if (isNaN(clientDateObj.getTime())) {
        clientDateObj = new Date();
      }

      const dayOfWeek = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: clientTimezone,
      }).format(clientDateObj);

      const fullDateFormatted = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: clientTimezone,
      }).format(clientDateObj);

      const timeFormatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: clientTimezone,
      }).format(clientDateObj);

      const isoDateOnly = clientDateObj.toISOString().split("T")[0];

      // Determine model tier based on reflection depth (Directive 7)
      let tierName: "lite" | "standard" | "reasoning" = "standard";
      if (depth === "quick") {
        tierName = "lite";
      } else if (depth === "deep") {
        tierName = "reasoning";
      } else {
        tierName = "standard";
      }

      // Unified context construction across all modes (reflection, summary, brainstorm, dialogue)
      // Maintains full conversational thread and session context
      const formattedContents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
      const recentHistory = Array.isArray(history) ? history.slice(-20) : [];

      // Consolidate into strictly alternating user/model turns for Gemini SDK
      for (const msg of recentHistory) {
        if (msg && typeof msg.text === "string" && msg.text.trim()) {
          const role: "user" | "model" = msg.role === "model" || msg.role === "assistant" ? "model" : "user";
          const lastTurn = formattedContents[formattedContents.length - 1];

          if (lastTurn && lastTurn.role === role) {
            // Merge consecutive turns of same role to ensure pristine alternating structure
            lastTurn.parts[0].text += `\n\n${msg.text.trim()}`;
          } else {
            formattedContents.push({
              role,
              parts: [{ text: msg.text.trim() }],
            });
          }
        }
      }

      // Format current turn with entry context if provided
      let currentTurnText = prompt;
      if (entryTitle && formattedContents.length === 0) {
        currentTurnText = `[Journal Context Title: "${entryTitle}"]\n\n${prompt}`;
      }

      const lastTurn = formattedContents[formattedContents.length - 1];
      if (lastTurn && lastTurn.role === "user") {
        lastTurn.parts[0].text += `\n\n${currentTurnText}`;
      } else {
        formattedContents.push({
          role: "user",
          parts: [{ text: currentTurnText }],
        });
      }

      // Unified System Instruction with specialized lenses for all modes
      let systemPrompt =
        "You are an empathetic, insightful journaling companion, cognitive reflection guide, and intelligent wellbeing scheduling assistant. " +
        "You have full access to the user's ongoing journal session context. " +
        "Help the user unpack thoughts, observe patterns, foster self-awareness, recommend restorative activities, and assist with scheduling.";

      systemPrompt += `\n\nCURRENT LOCATION, DATE, TIME & SCHEDULING CONTEXT:
- Current Reference Date/Time: Today is ${dayOfWeek}, ${fullDateFormatted} at ${timeFormatted} (Timezone: ${clientTimezone}, ISO: ${isoDateOnly}).
- User Detected Location: ${
  clientLocation?.city
    ? `${clientLocation.city}${clientLocation.region ? `, ${clientLocation.region}` : ""}${
        clientLocation.country ? `, ${clientLocation.country}` : ""
      } (${clientLocation.source === "gps" ? "GPS Accurate Position" : "Device/Timezone Position"}${
        clientLocation.utcOffset ? ` • ${clientLocation.utcOffset}` : ""
      })`
    : `Timezone ${clientTimezone}`
}
- SCHEDULING & DATE UNDERSTANDING RULES:
  1. When the user mentions specific days or times (e.g. "Sunday 10.00 am", "tomorrow at 4pm", "next Friday evening"):
     - Accurately calculate the exact target calendar date relative to today (${fullDateFormatted}) in the user's timezone (${clientTimezone}).
     - For example: if today is Tuesday Sep 1, then "Sunday 10.00 am" refers to the upcoming Sunday Sep 6 at 10:00 AM (NOT today or Tuesday).
  2. DATE CLARIFICATION & INTERACTIVE CONFIRMATION:
     - If the date is ambiguous or the user asks to schedule something without a date (or just says "Sunday" when they could mean a specific upcoming date), politely ask the user to confirm or specify the exact date in your response (e.g. "I've drafted a session for this coming Sunday, September 6 at 10:00 AM. What date works best for you, or shall we lock in September 6th?").
     - Always explicitly state the calculated date, time, and day of the week in your conversational response so the user has complete clarity.`;

      if (userProfile) {
        systemPrompt += "\n\nUser Profile Context (use this to tailor your reflections and metaphors):";
        if (userProfile.name) systemPrompt += `\n- Name: ${userProfile.name}`;
        if (userProfile.religion) systemPrompt += `\n- Religion/Spiritual Path: ${userProfile.religion}`;
        if (userProfile.culturalBeliefs) systemPrompt += `\n- Cultural Beliefs/Philosophies: ${userProfile.culturalBeliefs}`;
        if (userProfile.nationality) systemPrompt += `\n- Nationality: ${userProfile.nationality}`;
        if (userProfile.countryStay || userProfile.city) {
          const loc = [userProfile.city, userProfile.province, userProfile.countryStay].filter(Boolean).join(", ");
          systemPrompt += `\n- Location/Residence: ${loc}`;
        }
        if (Array.isArray(userProfile.primaryGoals) && userProfile.primaryGoals.length > 0) {
          systemPrompt += `\n- Core Goals: ${userProfile.primaryGoals.join(", ")}`;
        }
        if (Array.isArray(userProfile.groundingActivities) && userProfile.groundingActivities.length > 0) {
          systemPrompt += `\n- Grounding Activities & Wellness: ${userProfile.groundingActivities.join(", ")}`;
        }
      }

      // Depth tuning
      if (depth === "quick") {
        systemPrompt +=
          "\n- DEPTH: QUICK. Provide a concise, clear, and direct response (1-2 short paragraphs) with maximum 1 clarifying question.";
      } else if (depth === "deep") {
        systemPrompt +=
          "\n- DEPTH: DEEP. Provide thorough introspection, examine underlying assumptions, explore cognitive patterns, and suggest actionable pathways forward.";
      } else {
        systemPrompt +=
          "\n- DEPTH: REFLECT. Provide balanced, thoughtful reflection with 1-2 probing yet gentle questions.";
      }

      // Mode lens (Reflection, Summary, Brainstorm, Dialogue/Chat)
      if (style === "summary") {
        systemPrompt +=
          "\n- MODE: SUMMARY. Synthesize the core takeaways, emotional currents, decisions, and thematic highlights from the conversation into an elegant, structured summary with key takeaways and actionable reflections.";
      } else if (style === "brainstorm") {
        systemPrompt +=
          "\n- MODE: BRAINSTORM. Generate creative ideas, practical wellbeing experiments, next small steps, and fresh perspectives directly rooted in the user's situation. If the user asks about activities or routines, provide insightful, realistic, grounded suggestions.";
      } else if (style === "chat") {
        systemPrompt +=
          "\n- MODE: DIALOGUE. Engage as an attentive, curious, empathetic conversation partner. Directly respond to the latest point while staying grounded in previous reflections.";
      } else {
        systemPrompt +=
          "\n- MODE: REFLECTION. Validate emotions, offer gentle cognitive reframing, examine root feelings, and highlight personal growth opportunities. If the user asks for recommendations or what to do, provide mindful, empowering activity ideas.";
      }

      systemPrompt +=
        "\n\nACTIVITY RECOMMENDATIONS & CALENDAR SCHEDULING NOTE: If the user asks for activity recommendations, ideas on what to do, habits, workouts, mindfulness, or routines, make sure your response offers clear, inspiring options. Highlight the benefits, realistic duration (e.g. 15-60 mins), and calculated timing.";

      // Execute generation with selected tier and fallback ladder
      const result = await generateContentForTier(ai, tierName, {
        contents: formattedContents,
        systemInstruction: systemPrompt,
        maxOutputTokens: AI_TIERS[tierName].maxOutputTokens,
      });

      // Build consolidated text for metadata analysis from the entire session context
      const allUserTexts = formattedContents
        .filter((c) => c.role === "user")
        .map((c) => c.parts[0].text)
        .join("\n\n");
      const sampleForAnalysis = (allUserTexts + "\n\n" + result.text).slice(0, 1500);

      // Extraction of summary, themes, emotional analysis, and structured suggested activities
      let summaryText = "";
      let themes: string[] = [];
      let suggestedActivities: any[] = [];
      let analysis: any = {
        sentiment: "neutral",
        primaryEmotion: "reflective",
        intensity: 5,
        responseStyle: depth,
        topics: [],
      };

      try {
        const extractPrompt =
          `Analyze this journal conversation and response:\n"""\n${sampleForAnalysis}\n"""\n\n` +
          `Reference Date Context: Today is ${dayOfWeek}, ${fullDateFormatted} (ISO Date: ${isoDateOnly}, Time: ${timeFormatted}, Timezone: ${clientTimezone}).\n\n` +
          `Task 1: Extract a 1-sentence essence summary, 2-4 themes, and emotional tone.\n` +
          `Task 2: If the text includes any recommended activities, brainstormed ideas, habits, or actionable suggestions for the user (e.g. badminton, nature walk, 10-min meditation, journaling, stretching, calling a friend), extract 1 to 3 structured activity objects suitable for Google Calendar scheduling. If none are recommended or relevant, return empty array [].\n` +
          `For each activity, calculate targetDate (YYYY-MM-DD), targetTime (24-hr HH:mm), and targetDateTimeISO relative to today (${fullDateFormatted}). For example: if user mentioned "Sunday 10.00 am" and today is Tuesday 2026-09-01, targetDate is the upcoming Sunday "2026-09-06" and targetTime is "10:00".\n` +
          `If the user's requested date was ambiguous or unspecified, set "needsDateClarification": true.\n\n` +
          `Return ONLY a valid JSON object matching this schema with no markdown formatting:\n` +
          `{\n` +
          `  "summary": "1 concise sentence capturing the essence",\n` +
          `  "themes": ["Theme1", "Theme2"],\n` +
          `  "primaryEmotion": "single descriptive word",\n` +
          `  "intensity": 6,\n` +
          `  "sentiment": "positive|neutral|negative|mixed",\n` +
          `  "suggestedActivities": [\n` +
          `    {\n` +
          `      "title": "Clear Activity Name (e.g. Sunday Morning Badminton)",\n` +
          `      "description": "Short inspiring description of the activity and mindful focus",\n` +
          `      "durationMinutes": 60,\n` +
          `      "domain": "mind|body|life|connection",\n` +
          `      "suggestedTiming": "Sunday, Sep 6 at 10:00 AM",\n` +
          `      "targetDate": "2026-09-06",\n` +
          `      "targetTime": "10:00",\n` +
          `      "targetDateTimeISO": "2026-09-06T10:00:00",\n` +
          `      "reason": "Why this specifically fits their reflection and needs",\n` +
          `      "needsDateClarification": false\n` +
          `    }\n` +
          `  ]\n` +
          `}`;

        const metaResult = await generateContentForTier(ai, "lite", {
          contents: extractPrompt,
          systemInstruction: "You are a precise JSON metadata and activity extractor. Return raw JSON only.",
          maxOutputTokens: 500,
        });

        const cleanedJson = metaResult.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);
        if (parsed.summary && typeof parsed.summary === "string") summaryText = parsed.summary;
        if (Array.isArray(parsed.themes)) themes = parsed.themes.slice(0, 4);
        if (parsed.primaryEmotion) analysis.primaryEmotion = parsed.primaryEmotion;
        if (typeof parsed.intensity === "number") analysis.intensity = parsed.intensity;
        if (parsed.sentiment) analysis.sentiment = parsed.sentiment;
        if (Array.isArray(parsed.suggestedActivities)) {
          suggestedActivities = parsed.suggestedActivities
            .filter((act: any) => act && typeof act.title === "string" && act.title.trim())
            .map((act: any, idx: number) => ({
              id: `sug_${Date.now()}_${idx}`,
              title: act.title.trim(),
              description: typeof act.description === "string" ? act.description.trim() : "",
              durationMinutes: typeof act.durationMinutes === "number" && act.durationMinutes > 0 ? act.durationMinutes : 30,
              domain: ["mind", "body", "life", "connection"].includes(act.domain) ? act.domain : "mind",
              reason: typeof act.reason === "string" ? act.reason : "",
              suggestedTiming: typeof act.suggestedTiming === "string" ? act.suggestedTiming : "Today",
              targetDate: typeof act.targetDate === "string" ? act.targetDate : undefined,
              targetTime: typeof act.targetTime === "string" ? act.targetTime : undefined,
              targetDateTimeISO: typeof act.targetDateTimeISO === "string" ? act.targetDateTimeISO : undefined,
              needsDateClarification: !!act.needsDateClarification,
            }));
        }
      } catch {
        summaryText = prompt.slice(0, 100) + (prompt.length > 100 ? "..." : "");
        themes = [style.charAt(0).toUpperCase() + style.slice(1)];
      }

      // Operational usage metadata (Directive 7.10)
      const approxInputTokens = Math.ceil(prompt.length / 4) + formattedContents.length * 15;
      const approxOutputTokens = Math.ceil(result.text.length / 4);

      return res.json({
        reply: result.text,
        summary: summaryText,
        themes,
        analysis,
        suggestedActivities,
        modelUsed: result.modelUsed,
        usage: {
          reflectionMode: depth,
          modelTier: tierName,
          inputTokens: approxInputTokens,
          outputTokens: approxOutputTokens,
          historicalEntriesUsed: recentHistory.length,
          fallbackUsed: result.fallbackUsed,
        },
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error("[Gemini Reflect API Error]:", error);
      return res.status(500).json({
        error: error?.message || "An unexpected error occurred while communicating with Gemini.",
      });
    }
  });

  // 2b. Gemini Activity Recommendation Engine (Tailored to Calendar, Preferences, Prompts & Conditions)
  app.post("/api/gemini/recommend-activities", async (req: Request, res: Response) => {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const userPrompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    const condition = typeof payload.condition === "string" ? payload.condition.trim() : ""; // e.g., "Feeling drained after meetings", "Weekend free afternoon"
    const userProfile = payload.userProfile && typeof payload.userProfile === "object" ? payload.userProfile : null;
    const weeklyEvents = Array.isArray(payload.weeklyEvents) ? payload.weeklyEvents : [];
    const checkIn = payload.checkIn && typeof payload.checkIn === "object" ? payload.checkIn : null;
    const clientLocation = payload.clientLocation && typeof payload.clientLocation === "object" ? payload.clientLocation : null;
    const clientTimezone = typeof payload.clientTimezone === "string" ? payload.clientTimezone : "UTC";

    try {
      const ai = getGeminiClient();

      // System instruction grounding the recommendation model in wellbeing science & calendar schedule
      const systemInstruction =
        "You are an empathetic, intelligent Wellbeing & Activity Recommendation Specialist. " +
        "Your role is to analyze a user's weekly calendar load, current emotional/energy condition, personal profile preferences, " +
        "and custom prompt, and synthesize 3 to 4 personalized, actionable, realistic wellbeing activity recommendations. " +
        "Each recommendation must clearly articulate why it fits their current schedule, energy, and preferences. " +
        "Return ONLY a valid JSON object in the exact schema requested, with no markdown code blocks or commentary.";

      // Build context prompt
      let contextText = `Analyze the following user situation and recommend 3-4 tailored wellbeing activities:\n\n`;

      if (userPrompt) {
        contextText += `User Prompt / Wish: "${userPrompt}"\n`;
      }
      if (condition) {
        contextText += `Current Condition / State: "${condition}"\n`;
      }
      if (checkIn) {
        contextText += `Today's Check-In: Mood=${checkIn.mood || "unspecified"}, Energy=${checkIn.energy || 3}/5, Stress=${checkIn.stress || 2}/5\n`;
      }
      if (clientLocation || clientTimezone) {
        contextText += `User Location & Timezone: ${
          clientLocation?.city
            ? `${clientLocation.city}${clientLocation.region ? `, ${clientLocation.region}` : ""}${
                clientLocation.country ? `, ${clientLocation.country}` : ""
              } (Timezone: ${clientTimezone}${clientLocation.utcOffset ? `, ${clientLocation.utcOffset}` : ""})`
            : `Timezone: ${clientTimezone}`
        }\n`;
      }

      if (userProfile) {
        contextText += `\nUser Profile & Preferences:\n`;
        if (userProfile.name) contextText += `- Name: ${userProfile.name}\n`;
        if (Array.isArray(userProfile.primaryGoals) && userProfile.primaryGoals.length > 0) {
          contextText += `- Primary Wellbeing Goals: ${userProfile.primaryGoals.join(", ")}\n`;
        }
        if (Array.isArray(userProfile.groundingActivities) && userProfile.groundingActivities.length > 0) {
          contextText += `- Preferred Grounding Practices: ${userProfile.groundingActivities.join(", ")}\n`;
        }
        if (userProfile.activityPreferences) {
          const pref = userProfile.activityPreferences;
          if (pref.preferredTimes) contextText += `- Preferred Times: ${pref.preferredTimes.join(", ")}\n`;
          if (pref.socialPreference) contextText += `- Social Setting: ${pref.socialPreference}\n`;
          if (pref.budgetPreference) contextText += `- Budget: ${pref.budgetPreference}\n`;
        }
      }

      if (weeklyEvents.length > 0) {
        contextText += `\nUser's Weekly Calendar Schedule & Activity Load (${weeklyEvents.length} events logged this week):\n`;
        weeklyEvents.slice(0, 15).forEach((evt: any, i: number) => {
          const title = evt.summary || "Untitled Event";
          const start = evt.start?.dateTime || evt.start?.date || "Unscheduled";
          contextText += `${i + 1}. "${title}" at ${start}\n`;
        });
      } else {
        contextText += `\nCalendar Schedule: No calendar events logged or disconnected (Local fallback schedule assumed).\n`;
      }

      contextText += `\n\nGenerate 3-4 diverse wellbeing activities (Mind, Body, Nature/Creativity, or Connection/Rest) tailored specifically to balance their schedule and condition.`;
      contextText += `\n\nOutput JSON Schema:
{
  "summaryReasoning": "1-2 sentences explaining how these activities fit their weekly calendar pace and condition",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "Clear concise activity name",
      "domain": "mind|body|life|connection",
      "category": "Mindfulness|Movement|Nature|Creativity|Connection|Rest",
      "description": "2-3 sentences explaining what to do and how to do it comfortably.",
      "reason": "Explicit personalized explanation of why this fits their current calendar load and prompt/condition.",
      "energyRequired": "low|medium|high",
      "durationMinutes": 15,
      "tags": ["Tag1", "Tag2"],
      "suggestedTiming": "e.g., Tomorrow morning at 08:30 or Thursday evening",
      "locationType": "home|outdoors|venue"
    }
  ]
}`;

      // Call Gemini standard tier (gemini-3.6-flash with resilient fallback)
      const result = await generateContentForTier(ai, "standard", {
        contents: contextText,
        systemInstruction,
        maxOutputTokens: 900,
      });

      const cleanedJson = result.text.replace(/```json|```/g, "").trim();
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(cleanedJson);
      } catch (parseErr) {
        console.warn("[Gemini Activity Recommender] JSON parse fallback:", parseErr);
        // Clean fallback structure
        parsedResponse = {
          summaryReasoning: "Tailored wellbeing activities balancing your current mental pace and weekly schedule.",
          recommendations: [
            {
              id: `rec_fallback_${Date.now()}_1`,
              title: "🌿 10-Minute Guided Breathwork & Mind Unload",
              domain: "mind",
              category: "Mindfulness",
              description: "Engage in a 4-7-8 rhythmic breathing sequence to reset the vagus nerve and release workday tension.",
              reason: "Designed to relieve stress and fit seamlessly between dense calendar blocks.",
              energyRequired: "low",
              durationMinutes: 10,
              tags: ["Breathing", "Vagus Nerve", "De-stress"],
              suggestedTiming: "Midday or right after heavy meetings",
              locationType: "home",
            },
            {
              id: `rec_fallback_${Date.now()}_2`,
              title: "🚶 Mindful Nature Stroll & Audio Detach",
              domain: "body",
              category: "Nature",
              description: "A gentle 20-minute walk with zero screens or podcasts. Focus on natural sounds, stride rhythm, and horizon gazing.",
              reason: "Restores cognitive attention after periods of continuous screen focus.",
              energyRequired: "medium",
              durationMinutes: 20,
              tags: ["Walking", "Sunlight", "Restoration"],
              suggestedTiming: "Late afternoon golden hour",
              locationType: "outdoors",
            },
          ],
        };
      }

      return res.json({
        summaryReasoning: parsedResponse.summaryReasoning || "Personalized activities for your weekly wellbeing.",
        recommendations: parsedResponse.recommendations || [],
        modelUsed: result.modelUsed,
        fallbackUsed: result.fallbackUsed,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error("[Gemini Recommend Activities Error]:", error);
      return res.status(500).json({
        error: error?.message || "Failed to generate AI activity recommendations.",
      });
    }
  });

  // 3. Vite Middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
