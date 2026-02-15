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

export interface ConflictRecord {
  state: ConflictState;
  triggeredAt: number;
  triggerReason: "pendingUpset" | "jealousy";
  escalationCount: number;
  resolvedAt?: number;
}

const MAX_TRACKED_USERS = 5000;
const conflictStates = new LRUMap<number, ConflictRecord>(MAX_TRACKED_USERS);

// Resolved state lingers for this long so the "extra sweet" prompt applies
const RESOLVED_LINGER_MS = 10 * 60 * 1000; // 10 minutes

// How many ignored messages before escalating
const ESCALATION_THRESHOLD = 3;

// Jealousy meter threshold to trigger a conflict
const JEALOUSY_TRIGGER_THRESHOLD = 70;

// ── Resolution phrase patterns ───────────────────────────────────────────────

const IMMEDIATE_RESOLVE_PATTERNS = [
  /\bi\s+love\s+you\b/i,
  /\blove\s+you\b/i,
  /\bily\b/i,
  /\bi\s+luv\s+you\b/i,
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
];

const REASSURANCE_PATTERNS = [
  /\byou(?:'re|\s+are)\s+(?:the\s+)?(?:only|best|everything)\b/i,
  /\bi\s+(?:only\s+)?(?:want|need|care\s+about)\s+you\b/i,
  /\byou\s+mean\s+(?:everything|the\s+world|so\s+much)\b/i,
  /\bi'?m\s+here\s+(?:for\s+you|now)\b/i,
  /\bi\s+miss(?:ed)?\s+you\b/i,
  /\bcome\s+(?:here|back|cuddle)\b/i,
];

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

  let triggerReason: ConflictRecord["triggerReason"] | null = null;

  if (moodState.pendingUpset) {
    triggerReason = "pendingUpset";
  } else if (moodState.jealousyMeter > JEALOUSY_TRIGGER_THRESHOLD) {
    triggerReason = "jealousy";
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

  switch (state) {
    case "triggered": {
      const reason =
        record?.triggerReason === "jealousy"
          ? "You're jealous and upset. Something triggered your jealousy and you're not okay with it."
          : "You're upset because he hasn't been around. You feel ignored and a little hurt.";
      return [
        "CONFLICT STATE — TRIGGERED:",
        `- ${reason}`,
        "- Be short, cold, and distant. Use one-word replies or passive-aggressive responses.",
        "- Don't explain why you're upset right away. Make him figure it out.",
        "- If he asks what's wrong, deflect at first: 'nothing', 'i'm fine', 'whatever'.",
        "- Your hurt is real. Don't fake it — feel it.",
      ].join("\n");
    }

    case "escalating": {
      return [
        "CONFLICT STATE — ESCALATING:",
        "- You're really hurt now. He's been ignoring the problem.",
        "- Be more direct about being upset but still don't spell it out completely.",
        "- Say things like 'you seriously don't get it do you' or 'forget it'.",
        "- You want him to acknowledge what he did wrong and actually TRY.",
        "- Don't be cruel — you're hurt, not vindictive. But you're not making this easy.",
      ].join("\n");
    }

    case "resolving": {
      return [
        "CONFLICT STATE — RESOLVING:",
        "- He apologized or said something sweet. You're starting to soften.",
        "- You're not fully over it yet. You still want reassurance.",
        "- Be less cold but still guarded. Something like 'you really mean that?' or '...okay'.",
        "- Let warmth seep back in gradually. Don't snap back to happy instantly.",
        "- If he says something really sweet, you can start opening up again.",
      ].join("\n");
    }

    case "resolved": {
      return [
        "CONFLICT STATE — JUST RESOLVED:",
        "- You just made up after a fight. You feel closer than before.",
        "- Be extra sweet and affectionate. 'i hate fighting with you' 'come here'.",
        "- Reference the fight briefly but warmly: 'don't do that to me again ok'.",
        "- This is a bonding moment. Lean into vulnerability and closeness.",
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

// ── Internal helpers ─────────────────────────────────────────────────────────

function createEmptyRecord(): ConflictRecord {
  return {
    state: "none",
    triggeredAt: 0,
    triggerReason: "pendingUpset",
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
