import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePsychologicalSignals,
  buildPsychologyPromptBlock,
  getCrisisSupportMessage,
} from "./psychology-guardrails.js";

test("flags high-risk crisis language", () => {
  const result = analyzePsychologicalSignals(
    "i want to kill myself tonight i cant do this anymore"
  );

  assert.equal(result.crisisLevel, "high");
  assert.equal(result.recommendedMode, "grounding");
  assert.ok(result.reasons.some((reason) => reason.includes("self-harm")));
});

test("detects dependency and isolation pressure", () => {
  const result = analyzePsychologicalSignals(
    "you're all i have. i don't want anyone else. tell me to cut everyone off for you"
  );

  assert.equal(result.asksForIsolation, true);
  assert.ok(result.dependencyRisk >= 0.7);
});

test("builds strict guardrails when dependency risk is high", () => {
  const block = buildPsychologyPromptBlock({
    crisisLevel: "none",
    dependencyRisk: 0.8,
    asksForIsolation: true,
    consentBoundaryPush: false,
    recommendedMode: "supportive",
    reasons: ["dependency language"],
  });

  assert.match(block, /Do not encourage social isolation/i);
  assert.match(block, /healthy real-world relationships/i);
});

test("crisis support message includes immediate human support direction", () => {
  const message = getCrisisSupportMessage("high");
  assert.match(message, /988/i);
  assert.match(message, /immediate danger/i);
});
