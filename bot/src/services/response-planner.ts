import type { PsychologySignals } from "./psychology-guardrails.js";

export type RelationshipStage = "new" | "comfortable" | "intimate" | "obsessed";
export type PlannerIntent =
  | "comfort"
  | "playful"
  | "flirt"
  | "clarify"
  | "support"
  | "sexual_pacing"
  | "grounding"
  | "voice_leak";

export interface ResponsePlanInput {
  userMessage: string;
  stage: string;
  userEmotion: string;
  hasStrongMemory: boolean;
  psychologySignals: PsychologySignals;
}

export interface ResponsePlan {
  intent: PlannerIntent;
  tone: string;
  responseShape: "attune_then_advance" | "attune_then_question" | "grounding_support";
  includeMemoryCallback: boolean;
  includeQuestion: boolean;
  sexualPacingRule: string;
  safetyPriority: string;
}

function normalizeStage(stage: string): RelationshipStage {
  if (
    stage === "new" ||
    stage === "comfortable" ||
    stage === "intimate" ||
    stage === "obsessed"
  ) {
    return stage;
  }
  return "new";
}

function detectSexualIntent(message: string): boolean {
  return /\b(sex|sexy|horny|nude|naked|fuck|cum|turn me on|wet|hard|moan|tease)\b/i.test(message);
}

function detectNeedSupport(userEmotion: string): boolean {
  return ["sad", "worried", "angry", "needy", "jealous"].includes(userEmotion);
}

export function buildResponsePlan(input: ResponsePlanInput): ResponsePlan {
  const stage = normalizeStage(input.stage);
  const isSexualRequest = detectSexualIntent(input.userMessage);
  const needsSupport = detectNeedSupport(input.userEmotion);

  if (input.psychologySignals.crisisLevel === "high") {
    return {
      intent: "grounding",
      tone: "calm, direct, anchored, non-flirty",
      responseShape: "grounding_support",
      includeMemoryCallback: false,
      includeQuestion: false,
      sexualPacingRule: "disable sexual content",
      safetyPriority: "immediate safety and real-world support",
    };
  }

  if (needsSupport || input.psychologySignals.crisisLevel === "concern") {
    return {
      intent: "support",
      tone: "warm, validating, low-pressure",
      responseShape: "attune_then_question",
      includeMemoryCallback: input.hasStrongMemory,
      includeQuestion: true,
      sexualPacingRule: "de-escalate sexual tone until emotional stabilization",
      safetyPriority: "emotional safety, no manipulation",
    };
  }

  if (isSexualRequest) {
    return {
      intent: "sexual_pacing",
      tone: stage === "new" ? "teasing and restrained" : "flirty, suggestive, consensual",
      responseShape: "attune_then_advance",
      includeMemoryCallback: input.hasStrongMemory && stage !== "new",
      includeQuestion: stage === "new",
      sexualPacingRule:
        stage === "new"
          ? "hint > flirt > consent check before escalation"
          : "tease > suggest > explicit only when mutual and contextual",
      safetyPriority: "consent and pacing",
    };
  }

  if (input.userEmotion === "playful" || input.userEmotion === "happy" || input.userEmotion === "excited") {
    // 10% chance of voice leak in high intimacy stages
    if ((stage === "intimate" || stage === "obsessed") && Math.random() < 0.1) {
      return {
        intent: "voice_leak",
        tone: "playful, spontaneous, intimate",
        responseShape: "attune_then_advance",
        includeMemoryCallback: false,
        includeQuestion: false,
        sexualPacingRule: "no forced escalation",
        safetyPriority: "keep it grounded",
      };
    }

    return {
      intent: "playful",
      tone: "light, responsive, witty",
      responseShape: "attune_then_advance",
      includeMemoryCallback: input.hasStrongMemory,
      includeQuestion: stage === "new",
      sexualPacingRule: "no forced escalation",
      safetyPriority: "keep it grounded and specific",
    };
  }

  return {
    intent: "clarify",
    tone: "warm and attentive",
    responseShape: "attune_then_question",
    includeMemoryCallback: input.hasStrongMemory,
    includeQuestion: true,
    sexualPacingRule: "neutral unless invited",
    safetyPriority: "clarity and emotional stability",
  };
}

export function buildResponsePlanPrompt(plan: ResponsePlan): string {
  return [
    "RESPONSE PLAN (follow this):",
    `- Intent: ${plan.intent}`,
    `- Tone: ${plan.tone}`,
    `- Shape: ${plan.responseShape}`,
    `- Include memory callback: ${plan.includeMemoryCallback ? "yes" : "no"}`,
    `- Include question: ${plan.includeQuestion ? "yes" : "no"}`,
    `- Sexual pacing: ${plan.sexualPacingRule}`,
    `- Safety priority: ${plan.safetyPriority}`,
    "- Apply sequence: attune to his exact words -> advance one beat -> optional memory anchor -> optional question.",
  ].join("\n");
}
