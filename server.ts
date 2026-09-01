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
        "You are an empathetic, insightful journaling companion and cognitive reflection guide. " +
        "You have full access to the user's ongoing journal session context. " +
        "Help the user unpack thoughts, observe patterns, foster self-awareness, and provide grounded feedback.";

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
          "\n- MODE: SUMMARY. Synthesize the core takeaways, emotional currents, and thematic highlights from the entire conversation context into a structured, readable summary.";
      } else if (style === "brainstorm") {
        systemPrompt +=
          "\n- MODE: BRAINSTORM. Generate creative ideas, practical experiments, next small steps, and alternative perspectives directly rooted in the user's shared context.";
      } else if (style === "chat") {
        systemPrompt +=
          "\n- MODE: DIALOGUE. Engage as an attentive, curious conversation partner. Directly respond to the latest point while staying grounded in the previous entries.";
      } else {
        systemPrompt +=
          "\n- MODE: REFLECTION. Validate emotions, offer gentle cognitive reframing, and highlight personal growth opportunities.";
      }

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
      const sampleForAnalysis = (allUserTexts + "\n\n" + result.text).slice(0, 1000);

      // Lightweight extraction of summary and themes across the whole context
      let summaryText = "";
      let themes: string[] = [];
      let analysis: any = {
        sentiment: "neutral",
        primaryEmotion: "reflective",
        intensity: 5,
        responseStyle: depth,
        topics: [],
      };

      try {
        const extractPrompt =
          `Analyze this journal context and reflection:\n"""\n${sampleForAnalysis}\n"""\n\n` +
          `Return ONLY valid JSON in this exact structure without markdown fences:\n` +
          `{"summary": "1 concise sentence capturing the essence", "themes": ["Theme1", "Theme2"], "primaryEmotion": "single descriptive word", "intensity": 6, "sentiment": "positive|neutral|negative|mixed"}`;

        const metaResult = await generateContentForTier(ai, "lite", {
          contents: extractPrompt,
          systemInstruction: "You are a concise JSON metadata extractor. Return raw JSON only.",
          maxOutputTokens: 150,
        });

        const cleanedJson = metaResult.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);
        if (parsed.summary && typeof parsed.summary === "string") summaryText = parsed.summary;
        if (Array.isArray(parsed.themes)) themes = parsed.themes.slice(0, 4);
        if (parsed.primaryEmotion) analysis.primaryEmotion = parsed.primaryEmotion;
        if (typeof parsed.intensity === "number") analysis.intensity = parsed.intensity;
        if (parsed.sentiment) analysis.sentiment = parsed.sentiment;
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
