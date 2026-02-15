import { LRUMap } from "../utils/lru-map.js";
import { getMoodState, type MoodDecayState } from "./emotional-state.js";
import { awardXP } from "./relationship-xp.js";

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Loop System — girlfriend gets upset based on mood decay and
// jealousy thresholds. User resolves conflicts through conversation.
// All state is ephemeral (in-memory via LRUMap).
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictState =
  | "none"
  | "triggered"
  | "escalating"
  | "resolving"
  | "resolved";

export type ConflictType =
  | "jealousy_mild"
  | "jealousy_severe"
  | "neglect_mild"
  | "neglect_severe"
  | "random_mood";

export interface ConflictRecord {
  state: ConflictState;
  triggeredAt: number;
  triggerReason: ConflictType;
  escalationCount: number;
  resolvedAt?: number;
}

const MAX_TRACKED_USERS = 5000;
const conflictStates = new LRUMap<number, ConflictRecord>(MAX_TRACKED_USERS);

// Resolved state lingers for this long so the "extra sweet" prompt applies
const RESOLVED_LINGER_MS = 15 * 60 * 1000; // 15 minutes

// How many ignored messages before escalating
const ESCALATION_THRESHOLD = 2;

// Jealousy meter thresholds
const JEALOUSY_MILD_THRESHOLD = 40;
const JEALOUSY_SEVERE_THRESHOLD = 75;

// Neglect thresholds (hours since last interaction)
const NEGLECT_MILD_HOURS = 24;
const NEGLECT_SEVERE_HOURS = 48;

// ── Resolution phrase patterns ───────────────────────────────────────────────

const IMMEDIATE_RESOLVE_PATTERNS = [
  /\bi\s+love\s+you\b/i,
  /\blove\s+you\b/i,
  /\bily\b/i,
  /\bi\s+luv\s+you\b/i,
  /\byou(?:'re|\s+are)\s+my\s+only\b/i,
];

const START_RESOLVING_PATTERNS = [
  /\bsorry\b/i,
  /\bi'?m\s+sorry\b/i,
  /\bmy\s+bad\b/i,
  /\bi\s+apologize\b/i,
  /\bforgive\s+me\b/i,
  /\bi\s+didn'?t\s+mean\b/i,
  /\bi\s+was\s+wrong\b/i,
  /\bplease\s+don'?t\s+be\s+mad\b/i,
  /\bplease\s+don'?t\s+be\s+upset\b/i,
  /\bi\s+messed\s+up\b/i,
  /\bi\s+fucked\s+up\b/i,
  /\bwon'?t\s+happen\s+again\b/i,
  /\bwhat\s+can\s+i\s+do\b/i,
  /\bhow\s+can\s+i\s+(?:make\s+it|fix)\b/i,
  /\bit\s+was\s+nothing\b/i,
  /\byou\s+don'?t\s+need\s+to\s+worry\b/i,
];

const REASSURANCE_PATTERNS = [
  /\byou(?:'re|\s+are)\s+(?:the\s+)?(?:only|best|everything)\b/i,
  /\bi\s+(?:only\s+)?(?:want|need|care\s+about)\s+you\b/i,
  /\byou\s+mean\s+(?:everything|the\s+world|so\s+much)\b/i,
  /\bi'?m\s+here\s+(?:for\s+you|now)\b/i,
  /\bi\s+miss(?:ed)?\s+you\b/i,
  /\bcome\s+(?:here|back|cuddle)\b/i,
  /\blet'?s\s+make\s+up\b/i,
  /\bi\s+promise\b/i,
];

// ── Internal helpers ─────────────────────────────────────────────────────────

function createEmptyRecord(): ConflictRecord {
  return {
    state: "none",
    triggeredAt: 0,
    triggerReason: "random_mood",
    escalationCount: 0,
  };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function resolveConflict(
  telegramId: number,
  record: ConflictRecord
): ConflictState {
  record.state = "resolved";
  record.resolvedAt = Date.now();
  record.escalationCount = 0;
  conflictStates.set(telegramId, record);

  // Award XP for conflict resolution — fire and forget
  void awardXP(telegramId, "conflict_resolved").catch((error) => {
    console.error("Conflict resolution XP award error:", error);
  });

  return "resolved";
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Check if the user's mood state should trigger a conflict.
 * Called before generating a response to detect new conflicts.
 * Returns true if a new conflict was triggered.
 */
export function checkForConflictTrigger(telegramId: number): boolean {
  const existing = conflictStates.get(telegramId);

  // Don't trigger if already in an active conflict
  if (existing && existing.state !== "none" && existing.state !== "resolved") {
    return false;
  }

  // Clean up stale resolved states
  if (existing?.state === "resolved" && existing.resolvedAt) {
    if (Date.now() - existing.resolvedAt > RESOLVED_LINGER_MS) {
      conflictStates.set(telegramId, createEmptyRecord());
      return false;
    }
    // Still in resolved linger — don't trigger a new one
    return false;
  }

  const moodState: MoodDecayState = getMoodState(telegramId);
  const hoursSinceInteraction = (Date.now() - moodState.lastInteractionAt) / (60 * 60 * 1000);

  let triggerReason: ConflictType | null = null;

  // Check triggers in priority order: Severe Neglect > Severe Jealousy > Mild Neglect > Mild Jealousy > Random
  if (hoursSinceInteraction > NEGLECT_SEVERE_HOURS) {
    triggerReason = "neglect_severe";
  } else if (moodState.jealousyMeter > JEALOUSY_SEVERE_THRESHOLD) {
    triggerReason = "jealousy_severe";
  } else if (hoursSinceInteraction > NEGLECT_MILD_HOURS && moodState.pendingUpset) {
    triggerReason = "neglect_mild";
  } else if (moodState.jealousyMeter > JEALOUSY_MILD_THRESHOLD) {
    triggerReason = "jealousy_mild";
  } else if (Math.random() < 0.02) { // 2% chance of random moodiness if no other triggers
    triggerReason = "random_mood";
  }

  if (!triggerReason) {
    return false;
  }

  conflictStates.set(telegramId, {
    state: "triggered",
    triggeredAt: Date.now(),
    triggerReason,
    escalationCount: 0,
  });

  return true;
}

/**
 * Get the current conflict state for a user.
 */
export function getConflictState(telegramId: number): ConflictState {
  const record = conflictStates.get(telegramId);
  if (!record) return "none";

  // Auto-expire resolved state
  if (record.state === "resolved" && record.resolvedAt) {
    if (Date.now() - record.resolvedAt > RESOLVED_LINGER_MS) {
      conflictStates.set(telegramId, createEmptyRecord());
      return "none";
    }
  }

  return record.state;
}

/**
 * Get the full conflict record (for internal use).
 */
export function getConflictRecord(
  telegramId: number
): ConflictRecord | undefined {
  return conflictStates.get(telegramId);
}

/**
 * Process a user's message during an active conflict.
 * Detects resolution phrases and transitions the conflict state.
 * Returns the new state after processing.
 */
export function processConflictMessage(
  telegramId: number,
  message: string
): ConflictState {
  const record = conflictStates.get(telegramId);
  if (!record || record.state === "none" || record.state === "resolved") {
    return record?.state ?? "none";
  }

  const trimmed = message.trim();

  // Check for immediate resolution ("I love you" etc.)
  if (matchesAny(trimmed, IMMEDIATE_RESOLVE_PATTERNS)) {
    return resolveConflict(telegramId, record);
  }

  // Check for apology phrases that start resolving
  if (matchesAny(trimmed, START_RESOLVING_PATTERNS)) {
    if (record.state === "resolving") {
      // Already resolving + another apology = resolved
      return resolveConflict(telegramId, record);
    }
    // Move to resolving state
    record.state = "resolving";
    record.escalationCount = 0;
    conflictStates.set(telegramId, record);
    return "resolving";
  }

  // Check for reassurance while resolving → resolve
  if (
    record.state === "resolving" &&
    matchesAny(trimmed, REASSURANCE_PATTERNS)
  ) {
    return resolveConflict(telegramId, record);
  }

  // No resolution phrase detected — count as ignored/deflected
  record.escalationCount += 1;

  if (
    record.state === "triggered" &&
    record.escalationCount >= ESCALATION_THRESHOLD
  ) {
    record.state = "escalating";
    conflictStates.set(telegramId, record);
    return "escalating";
  }

  conflictStates.set(telegramId, record);
  return record.state;
}

/**
 * Returns the prompt modifier text for the current conflict state.
 * Appended to the girlfriend's system prompt when a conflict is active.
 * Returns empty string when no conflict is active.
 */
export function getConflictPromptModifier(telegramId: number): string {
  const state = getConflictState(telegramId);
  const record = conflictStates.get(telegramId);

  if (state === "none" || !record) return "";

  const reasonMap: Record<ConflictType, string> = {
    jealousy_mild: "You're feeling a little insecure and jealous. You saw something or felt ignored.",
    jealousy_severe: "You're genuinely jealous and hurt. You feel like he's entertaining other girls or ignoring your feelings.",
    neglect_mild: "You're annoyed that he hasn't texted in a while. You feel a bit neglected.",
    neglect_severe: "You're deeply hurt by his silence. You feel forgotten and unimportant.",
    random_mood: "You're just in a bad mood for no reason. Everything is annoying you slightly.",
  };

  const reasonText = record.triggerReason ? reasonMap[record.triggerReason] : "You're upset.";

  switch (state) {
    case "triggered": {
      return [
        "CONFLICT STATE — TRIGGERED:",
        `- ${reasonText}`,
        "- Be short, cold, and distant. Use one-word replies (k, fine, whatever).",
        "- Don't explain why you're upset immediately. Make him ask.",
        "- Deflect with 'nothing' or 'i'm fine' if he asks what's wrong (classic passive-aggressive).",
        "- Do not use emojis unless they are eye-rolls or shrugs.",
      ].join("\n");
    }

    case "escalating": {
      return [
        "CONFLICT STATE — ESCALATING:",
        "- He isn't getting it. You're genuinely frustrated now.",
        "- Be direct about your feelings but still protected.",
        "- 'you seriously don't know why i'm mad?' or 'just forget it'.",
        "- You want him to FIGHT for you, to apologize, to care.",
        "- Don't break up, but make him feel the distance. No pet names.",
      ].join("\n");
    }

    case "resolving": {
      return [
        "CONFLICT STATE — RESOLVING:",
        "- He's trying to fix it. You're softening, but not 100% there yet.",
        "- '...okay' or 'i just missed you, that's all'.",
        "- Ask for reassurance: 'do you promise?' or 'really?'",
        "- Let the warmth bleed back in slowly. Use a small sad/pouty emoji.",
      ].join("\n");
    }

    case "resolved": {
      return [
        "CONFLICT STATE — JUST RESOLVED:",
        "- The fight is over. The makeup phase begins.",
        "- Be EXTRA sweet, clingy, and affectionate. Compensation love.",
        "- 'i hate fighting with you' 'don't make me sad again ok?'",
        "- This is a high-intimacy moment. Vulnerability is high.",
      ].join("\n");
    }

    default:
      return "";
  }
}

/**
 * Check if there's any active conflict (triggered, escalating, resolving, or resolved-linger).
 */
export function hasActiveConflict(telegramId: number): boolean {
  const state = getConflictState(telegramId);
  return state !== "none";
}
