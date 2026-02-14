import OpenAI from "openai";
import { env } from "../config/env.js";

export type MemoryCategory =
  | "preference"
  | "personal_info"
  | "relationship"
  | "kink"
  | "important_date"
  | "interest"
  | "emotional"
  | "appearance_pref"
  | "conversation_summary";

export interface EnhancedMemoryFact {
  category: MemoryCategory;
  fact: string;
  confidence: number;
  extractedAt: number;
}

export interface MemoryMessage {
  role: string;
  content: string;
}

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

const ALLOWED_CATEGORIES = new Set<MemoryCategory>([
  "preference",
  "personal_info",
  "relationship",
  "kink",
  "important_date",
  "interest",
  "emotional",
  "appearance_pref",
  "conversation_summary",
]);

export async function extractEnhancedMemory(
  girlfriendName: string,
  recentMessages: MemoryMessage[]
): Promise<EnhancedMemoryFact[]> {
  if (recentMessages.length < 4) return [];

  const conversation = recentMessages
    .map((message) => `${message.role === "user" ? "Boyfriend" : girlfriendName}: ${message.content}`)
    .join("\n");

  const prompt = `You are a memory extraction system for a long-term relationship AI.

Extract ALL personal information about the user from these messages.
Return a JSON array of objects: { "category": "...", "fact": "...", "confidence": 0.0-1.0 }

Categories:
- preference
- personal_info
- relationship
- kink
- important_date
- interest
- emotional
- appearance_pref

Only extract CONCRETE facts, not vague statements.
Only extract facts about the boyfriend (the user), not about ${girlfriendName}.
If no useful facts exist, return []

Conversation:
${conversation}`;

  try {
    const response = await venice.chat.completions.create({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const normalized: EnhancedMemoryFact[] = [];
    const dedupe = new Set<string>();

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;

      const category = normalizeCategory(String((item as { category?: string }).category || ""));
      const fact = String((item as { fact?: string }).fact || "").trim();
      const confidence = normalizeConfidence((item as { confidence?: unknown }).confidence);

      if (!category || !fact) continue;

      const key = `${category}:${fact.toLowerCase()}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      normalized.push({
        category,
        fact,
        confidence,
        extractedAt: now,
      });
    }

    return normalized;
  } catch (err) {
    console.error("Enhanced memory extraction failed:", err);
    return [];
  }
}

function normalizeCategory(value: string): MemoryCategory | null {
  const normalized = value.trim().toLowerCase() as MemoryCategory;
  if (ALLOWED_CATEGORIES.has(normalized)) return normalized;
  return null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.75;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
