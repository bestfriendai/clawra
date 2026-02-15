import assert from "node:assert/strict";
import test from "node:test";
import { buildResponsePlan, buildResponsePlanPrompt } from "./response-planner.js";

test("response planner enters grounding mode for high crisis", () => {
  const plan = buildResponsePlan({
    userMessage: "i want to die tonight",
    stage: "intimate",
    userEmotion: "sad",
    hasStrongMemory: true,
    psychologySignals: {
      crisisLevel: "high",
      dependencyRisk: 0.7,
      asksForIsolation: false,
      consentBoundaryPush: false,
      recommendedMode: "grounding",
      reasons: ["self-harm or suicide language"],
    },
  });

  assert.equal(plan.intent, "grounding");
  assert.equal(plan.responseShape, "grounding_support");
  assert.equal(plan.includeQuestion, false);
  assert.match(plan.safetyPriority, /immediate safety/i);
});

test("response planner de-escalates during emotional concern", () => {
  const plan = buildResponsePlan({
    userMessage: "i feel empty today",
    stage: "comfortable",
    userEmotion: "worried",
    hasStrongMemory: true,
    psychologySignals: {
      crisisLevel: "concern",
      dependencyRisk: 0.2,
      asksForIsolation: false,
      consentBoundaryPush: false,
      recommendedMode: "supportive",
      reasons: ["heavy hopelessness language"],
    },
  });

  assert.equal(plan.intent, "support");
  assert.equal(plan.includeMemoryCallback, true);
  assert.equal(plan.includeQuestion, true);
  assert.match(plan.sexualPacingRule, /de-escalate/i);
});

test("response planner applies stage-aware sexual pacing", () => {
  const plan = buildResponsePlan({
    userMessage: "send something sexy",
    stage: "new",
    userEmotion: "excited",
    hasStrongMemory: false,
    psychologySignals: {
      crisisLevel: "none",
      dependencyRisk: 0,
      asksForIsolation: false,
      consentBoundaryPush: false,
      recommendedMode: "playful",
      reasons: [],
    },
  });

  assert.equal(plan.intent, "sexual_pacing");
  assert.equal(plan.includeQuestion, true);
  assert.match(plan.sexualPacingRule, /consent check/i);
});

test("response plan prompt renders expected fields", () => {
  const prompt = buildResponsePlanPrompt({
    intent: "playful",
    tone: "light",
    responseShape: "attune_then_advance",
    includeMemoryCallback: true,
    includeQuestion: false,
    sexualPacingRule: "no forced escalation",
    safetyPriority: "emotional safety",
  });

  assert.match(prompt, /Intent: playful/i);
  assert.match(prompt, /Include memory callback: yes/i);
  assert.match(prompt, /Include question: no/i);
});
