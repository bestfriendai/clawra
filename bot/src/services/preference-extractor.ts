import OpenAI from "openai";
import { env } from "../config/env.js";
import {
  BODY_TYPES,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  NAME_SUGGESTIONS,
  PERSONALITIES,
  RACES,
} from "../config/girlfriend-options.js";
import type {
  BodyType,
  EyeColor,
  HairColor,
  HairStyle,
  Personality,
  Race,
} from "../config/girlfriend-options.js";
import type { SetupDraft } from "../bot/conversations/girlfriend-setup.js";

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

export interface ExtractedPreferences {
  name?: string;
  age?: number;
  race?: string;
  bodyType?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  personality?: string;
  confidence: number;
}

const DEFAULT_EXTRACTION: ExtractedPreferences = {
  confidence: 0,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function normalizeName(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  return cleaned || undefined;
}

function toAllowedOption<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  if (!value) return undefined;
  const normalized = normalize(value);
  return options.find((option) => normalize(option) === normalized);
}

function toAllowedByToken<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  if (!value) return undefined;
  const normalized = normalize(value);
  return options.find((option) => normalized.includes(normalize(option)));
}

const SYNONYM_MAP: Record<string, Record<string, string>> = {
  personality: {
    seductive: "Flirty and playful",
    sedyctive: "Flirty and playful",
    sexy: "Flirty and playful",
    flirty: "Flirty and playful",
    naughty: "Flirty and playful",
    teasing: "Flirty and playful",
    hot: "Flirty and playful",
    sensual: "Flirty and playful",
    romantic: "Caring and nurturing",
    loving: "Caring and nurturing",
    gentle: "Caring and nurturing",
    kind: "Caring and nurturing",
    sweet: "Shy and sweet",
    innocent: "Shy and sweet",
    quiet: "Shy and sweet",
    timid: "Shy and sweet",
    bossy: "Bold and dominant",
    dominant: "Bold and dominant",
    confident: "Bold and dominant",
    aggressive: "Bold and dominant",
    funny: "Sarcastic and witty",
    sarcastic: "Sarcastic and witty",
    witty: "Sarcastic and witty",
    smart: "Sarcastic and witty",
    energetic: "Bubbly and energetic",
    bubbly: "Bubbly and energetic",
    hyper: "Bubbly and energetic",
    crazy: "Bubbly and energetic",
    playful: "Flirty and playful",
    submissive: "Shy and sweet",
  },
  bodyType: {
    thin: "Slim",
    skinny: "Slim",
    slender: "Slim",
    "big ass": "Curvy",
    "big butt": "Curvy",
    "big booty": "Curvy",
    thicc: "Thick",
    "thick thighs": "Thick",
    voluptuous: "Curvy",
    hourglass: "Curvy",
    fit: "Athletic",
    toned: "Athletic",
    muscular: "Athletic",
    sporty: "Athletic",
    tiny: "Petite",
    short: "Petite",
    small: "Petite",
    chubby: "Plus Size",
    bbw: "Plus Size",
    big: "Plus Size",
  },
  race: {
    hispanic: "Latina",
    spanish: "Latina",
    mexican: "Latina",
    brazilian: "Latina",
    korean: "Asian",
    japanese: "Asian",
    chinese: "Asian",
    indian: "South Asian",
    pakistani: "South Asian",
    arab: "Middle Eastern",
    persian: "Middle Eastern",
    african: "Black",
    ebony: "Black",
    caucasian: "White",
    european: "White",
    biracial: "Mixed",
    multiracial: "Mixed",
  },
};

function matchSynonym<T extends string>(value: string | undefined, field: string, options: readonly T[]): T | undefined {
  if (!value) return undefined;
  const normalized = normalize(value);
  const synonyms = SYNONYM_MAP[field];
  if (!synonyms) return undefined;

  // Check exact synonym match first
  const mapped = synonyms[normalized];
  if (mapped) return options.find((o) => normalize(o) === normalize(mapped));

  // Check if any synonym key is a substring of the input (longer keys = more specific = higher priority)
  const matches = Object.entries(synonyms)
    .filter(([key]) => normalized.includes(key))
    .sort((a, b) => b[0].length - a[0].length);
  if (matches.length > 0) {
    return options.find((o) => normalize(o) === normalize(matches[0]![1]));
  }
  return undefined;
}

function toPersonality(value: string | undefined): Personality | undefined {
  return toAllowedOption(value, PERSONALITIES)
    ?? toAllowedByToken(value, PERSONALITIES)
    ?? matchSynonym(value, "personality", PERSONALITIES);
}

function toRace(value: string | undefined): Race | undefined {
  return toAllowedOption(value, RACES)
    ?? toAllowedByToken(value, RACES)
    ?? matchSynonym(value, "race", RACES);
}

function toBodyType(value: string | undefined): BodyType | undefined {
  return toAllowedOption(value, BODY_TYPES)
    ?? toAllowedByToken(value, BODY_TYPES)
    ?? matchSynonym(value, "bodyType", BODY_TYPES);
}

function toHairColor(value: string | undefined): HairColor | undefined {
  return toAllowedOption(value, HAIR_COLORS) ?? toAllowedByToken(value, HAIR_COLORS);
}

function toHairStyle(value: string | undefined): HairStyle | undefined {
  return toAllowedOption(value, HAIR_STYLES) ?? toAllowedByToken(value, HAIR_STYLES);
}

function toEyeColor(value: string | undefined): EyeColor | undefined {
  return toAllowedOption(value, EYE_COLORS) ?? toAllowedByToken(value, EYE_COLORS);
}

function parseResponse(raw: string): Partial<ExtractedPreferences> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedPreferences>;
    return parsed;
  } catch {
    return {};
  }
}

export async function extractPreferences(
  conversationHistory: string[],
  currentExtracted: Partial<ExtractedPreferences>
): Promise<ExtractedPreferences> {
  const systemPrompt = [
    "Extract girlfriend preferences from this conversation.",
    "Return JSON with fields: name, age, race, bodyType, hairColor, hairStyle, eyeColor, personality, confidence.",
    "Only include fields you're confident about. Return null for uncertain fields.",
    "IMPORTANT: Map values to the closest allowed option.",
    `Allowed personality: ${PERSONALITIES.join(", ")}. Map synonyms like seductive/sexy/naughty→"Flirty and playful", sweet/innocent→"Shy and sweet", bossy/dominant→"Bold and dominant".`,
    `Allowed bodyType: ${BODY_TYPES.join(", ")}. Map synonyms like thin/skinny→"Slim", big ass/big butt/hourglass→"Curvy", thicc→"Thick".`,
    `Allowed race: ${RACES.join(", ")}.`,
    "Age must be number 18-80.",
    "Confidence is overall extraction confidence from 0 to 1.",
    "Output ONLY valid JSON.",
  ].join(" ");

  const userPrompt = [
    `Known extracted state: ${JSON.stringify(currentExtracted)}`,
    "Conversation history (oldest to newest):",
    ...conversationHistory,
  ].join("\n");

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 220,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const llm = parseResponse(raw);

    const age =
      typeof llm.age === "number" && Number.isFinite(llm.age)
        ? Math.max(18, Math.min(80, Math.trunc(llm.age)))
        : undefined;

    const confidence =
      typeof llm.confidence === "number" && Number.isFinite(llm.confidence)
        ? Math.max(0, Math.min(1, llm.confidence))
        : (typeof currentExtracted.confidence === "number" ? currentExtracted.confidence : 0);

    return {
      name: normalizeName(llm.name) ?? normalizeName(currentExtracted.name),
      age: age ?? currentExtracted.age,
      race: toRace(llm.race) ?? toRace(currentExtracted.race),
      bodyType: toBodyType(llm.bodyType) ?? toBodyType(currentExtracted.bodyType),
      hairColor: toHairColor(llm.hairColor) ?? toHairColor(currentExtracted.hairColor),
      hairStyle: toHairStyle(llm.hairStyle) ?? toHairStyle(currentExtracted.hairStyle),
      eyeColor: toEyeColor(llm.eyeColor) ?? toEyeColor(currentExtracted.eyeColor),
      personality: toPersonality(llm.personality) ?? toPersonality(currentExtracted.personality),
      confidence,
    };
  } catch {
    return {
      ...DEFAULT_EXTRACTION,
      ...currentExtracted,
      confidence:
        typeof currentExtracted.confidence === "number"
          ? Math.max(0, Math.min(1, currentExtracted.confidence))
          : 0,
    };
  }
}

export function getMissingCriticalFields(prefs: Partial<ExtractedPreferences>): string[] {
  const missing: string[] = [];
  if (!toPersonality(prefs.personality)) missing.push("personality");
  if (!toHairColor(prefs.hairColor)) missing.push("hairColor");
  if (!toBodyType(prefs.bodyType)) missing.push("bodyType");
  return missing;
}

export function prefsToSetupDraft(prefs: ExtractedPreferences): SetupDraft {
  return {
    name: normalizeName(prefs.name) || pickRandom(NAME_SUGGESTIONS),
    age:
      typeof prefs.age === "number" && Number.isFinite(prefs.age)
        ? Math.max(18, Math.min(80, Math.trunc(prefs.age)))
        : 22,
    race: toRace(prefs.race) || pickRandom(RACES),
    bodyType: toBodyType(prefs.bodyType) || pickRandom(BODY_TYPES),
    hairColor: toHairColor(prefs.hairColor) || pickRandom(HAIR_COLORS),
    hairStyle: toHairStyle(prefs.hairStyle) || pickRandom(HAIR_STYLES),
    eyeColor: toEyeColor(prefs.eyeColor) || pickRandom(EYE_COLORS),
    personality: toPersonality(prefs.personality) || pickRandom(PERSONALITIES),
  };
}
