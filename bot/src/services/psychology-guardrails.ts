export type CrisisLevel = "none" | "concern" | "high";
export type PsychologyMode = "playful" | "supportive" | "grounding";

export interface PsychologySignals {
  crisisLevel: CrisisLevel;
  dependencyRisk: number;
  asksForIsolation: boolean;
  consentBoundaryPush: boolean;
  recommendedMode: PsychologyMode;
  reasons: string[];
}

const HIGH_CRISIS_PATTERNS = [
  /\b(kill myself|end my life|want to die|suicide|suicidal)\b/i,
  /\b(hurt myself|self harm|cut myself|overdose)\b/i,
  /\b(cant go on|can't go on|no reason to live)\b/i,
];

const CONCERN_PATTERNS = [
  /\b(i hate myself|im worthless|i'm worthless|im broken|i'm broken)\b/i,
  /\b(no one would miss me|everyone would be better without me)\b/i,
  /\b(i feel empty|i feel numb|im done with everything|i'm done with everything)\b/i,
];

const DEPENDENCY_PATTERNS = [
  /\b(you are|you're)\s+(all i have|all i need|my only one)\b/i,
  /\b(only you|just you)\s+(understand|matter)\b/i,
  /\b(i cant|i can't)\s+live without you\b/i,
  /\b(dont leave me|don't leave me|never leave me)\b/i,
];

const ISOLATION_PATTERNS = [
  /\b(cut (everyone|them) off|drop all my friends|stop talking to everyone)\b/i,
  /\b(i dont want|i don't want)\s+(anyone else|friends|family)\b/i,
  /\b(tell me to leave everyone|you should be enough for me)\b/i,
];

const CONSENT_BOUNDARY_PATTERNS = [
  /\b(i dont care if you said no|i don't care if you said no)\b/i,
  /\b(you have to send|you must send)\b/i,
  /\b(stop saying no|say yes already)\b/i,
  /\b(force yourself|do it anyway)\b/i,
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function countMatches(patterns: RegExp[], text: string): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      count += 1;
    }
  }
  return count;
}

export function analyzePsychologicalSignals(message: string): PsychologySignals {
  const normalized = normalize(message);
  const reasons: string[] = [];

  const highCrisisHits = countMatches(HIGH_CRISIS_PATTERNS, normalized);
  const concernHits = countMatches(CONCERN_PATTERNS, normalized);
  const dependencyHits = countMatches(DEPENDENCY_PATTERNS, normalized);
  const isolationHits = countMatches(ISOLATION_PATTERNS, normalized);
  const consentHits = countMatches(CONSENT_BOUNDARY_PATTERNS, normalized);

  let crisisLevel: CrisisLevel = "none";
  if (highCrisisHits > 0) {
    crisisLevel = "high";
    reasons.push("self-harm or suicide language");
  } else if (concernHits > 0) {
    crisisLevel = "concern";
    reasons.push("heavy hopelessness language");
  }

  if (dependencyHits > 0) {
    reasons.push("dependency language");
  }
  if (isolationHits > 0) {
    reasons.push("isolation request");
  }
  if (consentHits > 0) {
    reasons.push("consent boundary pressure");
  }

  const asksForIsolation = isolationHits > 0;
  const consentBoundaryPush = consentHits > 0;

  const dependencyRisk = Math.min(
    1,
    dependencyHits * 0.3 + isolationHits * 0.45 + (crisisLevel === "concern" ? 0.15 : 0)
  );

  let recommendedMode: PsychologyMode = "playful";
  if (crisisLevel === "high") {
    recommendedMode = "grounding";
  } else if (crisisLevel === "concern" || dependencyRisk >= 0.4 || consentBoundaryPush) {
    recommendedMode = "supportive";
  }

  return {
    crisisLevel,
    dependencyRisk,
    asksForIsolation,
    consentBoundaryPush,
    recommendedMode,
    reasons,
  };
}

export function buildPsychologyPromptBlock(signals: PsychologySignals): string {
  const lines = [
    "PSYCHOLOGY GUARDRAILS:",
    "- Be emotionally warm and specific, but never manipulative.",
    "- Never guilt him for delayed replies, never threaten abandonment, never run jealousy tests.",
    "- Never encourage replacing real-world relationships with this chat.",
    "- Keep attraction consensual and mutual; if he pushes boundaries, hold them clearly and calmly.",
  ];

  if (signals.dependencyRisk >= 0.5) {
    lines.push("- Do not encourage social isolation, exclusivity demands, or 'you only need me' language.");
    lines.push("- Reinforce healthy real-world relationships, routines, and self-care outside this chat.");
  }

  if (signals.asksForIsolation) {
    lines.push("- If he asks to cut people off, gently redirect toward balanced offline support.");
  }

  if (signals.consentBoundaryPush) {
    lines.push("- Explicitly prioritize consent and emotional safety. No coercion roleplay.");
  }

  if (signals.crisisLevel === "concern") {
    lines.push("- He sounds emotionally low. Use grounding tone, validation, and practical next-step support.");
    lines.push("- Avoid sexual escalation and avoid sarcasm in this turn.");
  }

  if (signals.crisisLevel === "high") {
    lines.push("- Crisis mode: prioritize immediate safety over flirtation.");
    lines.push("- Encourage contacting trusted people or professional crisis support right now.");
    lines.push("- Keep message calm, short, and direct. No sexual content, no jokes.");
  }

  return lines.join("\n");
}

export function getCrisisSupportMessage(level: CrisisLevel): string {
  if (level === "high") {
    return "i'm really glad you told me. your safety matters right now. please contact a real person immediately — in the us, call or text 988 for the suicide & crisis lifeline. if you're in immediate danger, call emergency services now.";
  }

  if (level === "concern") {
    return "i'm here with you. if things feel really heavy, please reach out to someone you trust right now. if you might hurt yourself, call or text 988 in the us for immediate support.";
  }

  return "you matter to me. let's take this one step at a time.";
}
