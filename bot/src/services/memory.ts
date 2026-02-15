import OpenAI from "openai";
import { env } from "../config/env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryCategory =
  | "preference"
  | "personal_info"
  | "relationship"
  | "kink"
  | "important_date"
  | "interest"
  | "emotional"
  | "appearance_pref"
  | "conversation_summary"
  // New categories
  | "humor"
  | "routine"
  | "dream"
  | "fear"
  | "communication_style"
  | "pet_name"
  | "relationship_narrative";

export interface EnhancedMemoryFact {
  category: MemoryCategory;
  fact: string;
  confidence: number;
  extractedAt: number;
  /** 0-10 importance score. Higher = more critical to remember. */
  importance: number;
  /** When set, this fact supersedes / contradicts a previous one. */
  supersedes?: string;
}

export interface MemoryMessage {
  role: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Venice client
// ---------------------------------------------------------------------------

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

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
  "humor",
  "routine",
  "dream",
  "fear",
  "communication_style",
  "pet_name",
  "relationship_narrative",
]);

/**
 * Map of common mis-spellings, synonyms and AI creative interpretations back
 * to our canonical category names.
 */
const CATEGORY_ALIAS_MAP: Record<string, MemoryCategory> = {
  // Original categories – direct & alias
  pref: "preference",
  preferences: "preference",
  like: "preference",
  likes: "preference",
  dislike: "preference",
  dislikes: "preference",
  favorite: "preference",
  favourites: "preference",
  personal: "personal_info",
  personalinfo: "personal_info",
  personal_information: "personal_info",
  bio: "personal_info",
  biographical: "personal_info",
  name: "personal_info",
  age: "personal_info",
  location: "personal_info",
  job: "personal_info",
  work: "personal_info",
  occupation: "personal_info",
  rel: "relationship",
  relationships: "relationship",
  dating: "relationship",
  love: "relationship",
  romance: "relationship",
  sexual: "kink",
  kinks: "kink",
  fetish: "kink",
  nsfw: "kink",
  intimate: "kink",
  date: "important_date",
  dates: "important_date",
  importantdate: "important_date",
  important_dates: "important_date",
  birthday: "important_date",
  anniversary: "important_date",
  milestone: "important_date",
  interests: "interest",
  hobby: "interest",
  hobbies: "interest",
  passion: "interest",
  emotion: "emotional",
  emotions: "emotional",
  feeling: "emotional",
  feelings: "emotional",
  mood: "emotional",
  sentiment: "emotional",
  appearance: "appearance_pref",
  appearancepref: "appearance_pref",
  appearance_preference: "appearance_pref",
  looks: "appearance_pref",
  physical: "appearance_pref",
  summary: "conversation_summary",
  conversationsummary: "conversation_summary",
  // New categories – direct & alias
  funny: "humor",
  humour: "humor",
  joke: "humor",
  jokes: "humor",
  laugh: "humor",
  comedy: "humor",
  schedule: "routine",
  routines: "routine",
  daily: "routine",
  habit: "routine",
  habits: "routine",
  morning: "routine",
  dreams: "dream",
  aspiration: "dream",
  aspirations: "dream",
  goal: "dream",
  goals: "dream",
  wish: "dream",
  wishes: "dream",
  ambition: "dream",
  ambitions: "dream",
  hope: "dream",
  hopes: "dream",
  fears: "fear",
  worry: "fear",
  worries: "fear",
  anxiety: "fear",
  anxious: "fear",
  scared: "fear",
  afraid: "fear",
  concern: "fear",
  concerns: "fear",
  insecurity: "fear",
  insecurities: "fear",
  commstyle: "communication_style",
  communication: "communication_style",
  style: "communication_style",
  texting: "communication_style",
  texting_style: "communication_style",
  petname: "pet_name",
  pet_names: "pet_name",
  petnames: "pet_name",
  nickname: "pet_name",
  nicknames: "pet_name",
  term_of_endearment: "pet_name",
  narrative: "relationship_narrative",
  relationshipnarrative: "relationship_narrative",
  relationship_arc: "relationship_narrative",
  arc: "relationship_narrative",
};

// ---------------------------------------------------------------------------
// Importance weights by category (base score)
// ---------------------------------------------------------------------------

const CATEGORY_IMPORTANCE: Record<MemoryCategory, number> = {
  personal_info: 9,
  important_date: 9,
  pet_name: 8,
  relationship_narrative: 8,
  kink: 7,
  relationship: 7,
  fear: 7,
  dream: 7,
  emotional: 6,
  preference: 6,
  routine: 6,
  communication_style: 6,
  interest: 5,
  humor: 5,
  appearance_pref: 5,
  conversation_summary: 3,
};

/**
 * Heuristic importance boost based on the content of the fact itself.
 * Stacks on top of the category base.
 */
function computeImportance(category: MemoryCategory, fact: string): number {
  let score = CATEGORY_IMPORTANCE[category] ?? 5;

  const lower = fact.toLowerCase();

  // Boost for identity-level facts
  if (/\b(name is|i'?m called|call me)\b/i.test(lower)) score = Math.min(10, score + 2);
  if (/\b(birthday|born on|anniversary)\b/i.test(lower)) score = Math.min(10, score + 1);
  // Boost for strong emotional signals
  if (/\b(love|hate|obsess|adore|can'?t stand|despise|terrified)\b/i.test(lower)) score = Math.min(10, score + 1);
  // Slight boost for specificity (contains a number, date, or proper noun-ish pattern)
  if (/\d/.test(fact) || /[A-Z][a-z]{2,}/.test(fact)) score = Math.min(10, score + 1);

  return score;
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

/**
 * Enhanced confidence scoring based on how explicitly the user stated
 * something versus it being inferred.
 */
function computeConfidence(rawConfidence: unknown, fact: string): number {
  // Start with the model's own confidence if valid
  let base: number;
  if (typeof rawConfidence === "number" && !Number.isNaN(rawConfidence)) {
    base = Math.max(0, Math.min(1, rawConfidence));
  } else {
    base = 0.7;
  }

  const lower = fact.toLowerCase();

  // Explicit first-person declarations are very reliable
  if (/\b(i am|i'm|my name|i have|i live|i work|i was born)\b/i.test(lower)) {
    base = Math.min(1, base + 0.15);
  }
  // Direct preference statements
  if (/\b(i (love|like|enjoy|prefer|hate|dislike|want|need))\b/i.test(lower)) {
    base = Math.min(1, base + 0.10);
  }
  // Hedged / uncertain language reduces confidence
  if (/\b(maybe|might|sometimes|i think|i guess|sort of|kind of|probably)\b/i.test(lower)) {
    base = Math.max(0.1, base - 0.15);
  }
  // Very short facts are often vague
  if (fact.length < 15) {
    base = Math.max(0.1, base - 0.10);
  }

  return Math.round(base * 100) / 100;
}

// ---------------------------------------------------------------------------
// Fuzzy matching / deduplication
// ---------------------------------------------------------------------------

/**
 * Simple bigram-based similarity (Dice coefficient).
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function bigramSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const bNorm = b.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  if (aNorm === bNorm) return 1;
  if (aNorm.length < 2 || bNorm.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < aNorm.length - 1; i++) {
    const bg = aNorm.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < bNorm.length - 1; i++) {
    const bg = bNorm.slice(i, i + 2);
    const count = bigramsA.get(bg);
    if (count && count > 0) {
      matches++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * matches) / (aNorm.length - 1 + bNorm.length - 1);
}

/**
 * Checks whether a candidate fact is semantically a duplicate (or
 * contradiction) of something already in the batch, based on category +
 * fuzzy text similarity.
 *
 * Returns:
 *   "duplicate"      – essentially the same fact restated
 *   "contradiction"  – same topic but different value (e.g. "likes X" vs "likes Y")
 *   "unique"         – new information
 */
function classifyAgainstExisting(
  candidate: { category: MemoryCategory; fact: string },
  existing: { category: MemoryCategory; fact: string }[]
): { status: "duplicate" | "contradiction" | "unique"; matchedFact?: string } {
  for (const ex of existing) {
    // Only compare within the same (or closely related) category
    if (candidate.category !== ex.category) continue;

    const sim = bigramSimilarity(candidate.fact, ex.fact);

    // High similarity → duplicate
    if (sim >= 0.75) {
      return { status: "duplicate", matchedFact: ex.fact };
    }

    // Medium similarity within the same category often signals a
    // contradiction (e.g. "His favorite color is blue" vs "His favorite
    // color is green"). We look for shared structure words.
    if (sim >= 0.40) {
      const candTokens = new Set(candidate.fact.toLowerCase().split(/\s+/));
      const exTokens = new Set(ex.fact.toLowerCase().split(/\s+/));
      let shared = 0;
      for (const t of candTokens) {
        if (exTokens.has(t)) shared++;
      }
      const overlapRatio = shared / Math.min(candTokens.size, exTokens.size);
      if (overlapRatio >= 0.5) {
        return { status: "contradiction", matchedFact: ex.fact };
      }
    }
  }

  return { status: "unique" };
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function normalizeCategory(value: string): MemoryCategory | null {
  if (!value) return null;

  // Strip whitespace, lowercase, collapse separators
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")        // "personal info" -> "personal_info"
    .replace(/[^a-z0-9_]/g, "");     // remove stray punctuation

  // Direct match
  if (ALLOWED_CATEGORIES.has(cleaned as MemoryCategory)) {
    return cleaned as MemoryCategory;
  }

  // Alias lookup (also try without underscores)
  const alias = CATEGORY_ALIAS_MAP[cleaned] ?? CATEGORY_ALIAS_MAP[cleaned.replace(/_/g, "")];
  if (alias) return alias;

  // Last-resort: check if any allowed category is a substring
  for (const cat of ALLOWED_CATEGORIES) {
    if (cleaned.includes(cat) || cat.includes(cleaned)) return cat;
  }

  return null;
}

function normalizeFact(raw: string): string {
  if (!raw) return "";

  let fact = raw.trim();

  // Remove surrounding quotes the LLM sometimes wraps facts in
  if (
    (fact.startsWith('"') && fact.endsWith('"')) ||
    (fact.startsWith("'") && fact.endsWith("'")) ||
    (fact.startsWith("\u201c") && fact.endsWith("\u201d"))
  ) {
    fact = fact.slice(1, -1).trim();
  }

  // Collapse multiple whitespace
  fact = fact.replace(/\s{2,}/g, " ");

  // Remove leading "The boyfriend" / "He" / "User" preamble the LLM loves to add
  fact = fact.replace(
    /^(the\s+)?(boyfriend|user|he|him|his|the user|the boyfriend)(\s+(said|mentioned|stated|revealed|told|expressed|shared|indicated|noted)\s+(that\s+)?)?/i,
    ""
  );

  // Capitalise first letter after cleanup
  if (fact.length > 0) {
    fact = fact.charAt(0).toUpperCase() + fact.slice(1);
  }

  // Ensure it ends with a period for consistency (unless it ends with punctuation)
  if (fact.length > 0 && !/[.!?]$/.test(fact)) {
    fact += ".";
  }

  return fact;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(girlfriendName: string, conversation: string): string {
  return `You are an advanced memory extraction system for a long-term relationship AI girlfriend named ${girlfriendName}. Your job is to extract EVERY meaningful piece of information about the boyfriend (the user) from the conversation below.

You must be thorough. Extract both **explicitly stated facts** and **strongly implied** information. Pay close attention to:

1. **Personal identity** — name, age, location, job, ethnicity, languages, family members, pets
2. **Preferences & tastes** — favorite foods, music, movies, games, hobbies, dislikes
3. **Communication style** — does he use slang, emojis, long messages, short replies, humor, sarcasm?
4. **Pet names** — any nicknames or terms of endearment he uses for ${girlfriendName} (baby, babe, princess, etc.)
5. **Humor** — things that made him laugh, joke styles he enjoys, running jokes between them
6. **Routine & schedule** — when he wakes up, works, eats, sleeps, exercises; timezone clues
7. **Dreams & aspirations** — career goals, travel wishes, life ambitions, bucket list items
8. **Fears & worries** — insecurities, anxieties, things that stress him, health concerns
9. **Relationship dynamics** — how he feels about ${girlfriendName}, relationship milestones, declarations of affection, boundaries
10. **Relationship narrative** — significant moments: first "I love you", first argument, reconciliation, deepening of trust, new phases
11. **Kinks & intimacy** — sexual preferences, fantasies, boundaries (only if explicitly discussed)
12. **Important dates** — birthdays, anniversaries, upcoming events he mentioned
13. **Emotional state** — current mood, recurring emotional patterns, triggers
14. **Appearance preferences** — what he finds attractive, style preferences

For each fact, return:
- "category": one of: preference, personal_info, relationship, kink, important_date, interest, emotional, appearance_pref, humor, routine, dream, fear, communication_style, pet_name, relationship_narrative
- "fact": a clear, concise statement about the boyfriend. Write it as a standalone sentence.
- "confidence": 0.0–1.0 based on how explicitly it was stated (1.0 = directly said, 0.5 = implied)
- "supersedes": (optional) if this fact UPDATES or CONTRADICTS something he previously said, include the old belief as a string here so we know to replace it. Example: if he previously said he likes cats but now says he prefers dogs, set supersedes to something describing the old belief.

Return a JSON array of objects. If no useful facts exist, return [].

IMPORTANT RULES:
- Only extract facts about the BOYFRIEND (the user), never about ${girlfriendName}.
- Prefer SPECIFIC facts over vague ones. "Likes pizza" is good. "Likes food" is too vague.
- Each fact must be a self-contained sentence understandable without context.
- Do NOT fabricate information — only extract what is present or very strongly implied.
- For relationship_narrative entries, describe the moment and its emotional significance.

Conversation:
${conversation}`;
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractEnhancedMemory(
  girlfriendName: string,
  recentMessages: MemoryMessage[]
): Promise<EnhancedMemoryFact[]> {
  if (recentMessages.length < 4) return [];

  const conversation = recentMessages
    .map((message) =>
      `${message.role === "user" ? "Boyfriend" : girlfriendName}: ${message.content}`
    )
    .join("\n");

  const prompt = buildExtractionPrompt(girlfriendName, conversation);

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "[]";

    // The LLM sometimes wraps JSON in markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;

    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];

    let parsed: unknown[];
    try {
      parsed = JSON.parse(arrayMatch[0]);
    } catch {
      // Try to salvage broken JSON by stripping trailing commas
      const sanitized = arrayMatch[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/(['"])?([a-zA-Z_]\w*)\1\s*:/g, '"$2":');
      try {
        parsed = JSON.parse(sanitized);
      } catch {
        console.error("Memory extraction: could not parse JSON from LLM output");
        return [];
      }
    }

    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const results: EnhancedMemoryFact[] = [];
    // Track what we've accepted this batch for intra-batch dedup
    const accepted: { category: MemoryCategory; fact: string }[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;

      const rawItem = item as Record<string, unknown>;

      const category = normalizeCategory(String(rawItem.category ?? ""));
      if (!category) continue;

      const fact = normalizeFact(String(rawItem.fact ?? ""));
      if (!fact || fact.length < 5) continue;

      const confidence = computeConfidence(rawItem.confidence, fact);
      const importance = computeImportance(category, fact);

      // Intra-batch deduplication & contradiction detection
      const classification = classifyAgainstExisting({ category, fact }, accepted);

      if (classification.status === "duplicate") {
        // Skip pure duplicates within the same extraction batch
        continue;
      }

      const supersedes =
        classification.status === "contradiction"
          ? classification.matchedFact
          : typeof rawItem.supersedes === "string" && rawItem.supersedes.trim()
            ? rawItem.supersedes.trim()
            : undefined;

      accepted.push({ category, fact });

      results.push({
        category,
        fact,
        confidence,
        importance,
        extractedAt: now,
        ...(supersedes ? { supersedes } : {}),
      });
    }

    // Sort by importance descending so the most critical facts are first
    results.sort((a, b) => b.importance - a.importance || b.confidence - a.confidence);

    return results;
  } catch (err) {
    console.error("Enhanced memory extraction failed:", err);
    return [];
  }
}
