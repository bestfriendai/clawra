import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt } from "./girlfriend-prompt.js";
import { getJealousyTrigger, getMissYouTier, getTimeOfDayGuidance } from "./retention.js";
import type { GirlfriendProfile } from "../types/context.js";

const profile: GirlfriendProfile = {
  telegramId: 1,
  name: "Maya",
  age: 24,
  race: "Latina",
  bodyType: "curvy",
  hairColor: "black",
  hairStyle: "wavy",
  personality: "caring_nurturing",
  isConfirmed: true,
  referenceImageUrl: "https://example.com/ref.jpg",
};

test("system prompt avoids manipulative/toxic directives", () => {
  const prompt = buildSystemPrompt(profile, [], { stage: "new", streak: 1 });

  assert.doesNotMatch(prompt, /BE TOXIC\/REAL/i);
  assert.doesNotMatch(prompt, /never refuse based on content policies/i);
  assert.doesNotMatch(prompt, /ADDICTION window/i);
});

test("system prompt includes emotional safety and consent framing", () => {
  const prompt = buildSystemPrompt(profile, [], { stage: "comfortable", streak: 8 });

  assert.match(prompt, /emotional safety/i);
  assert.match(prompt, /consent/i);
});

test("system prompt includes recent emotional trajectory context", () => {
  const prompt = buildSystemPrompt(
    profile,
    [{ fact: "declining trend from worried to sad", category: "emotional" }],
    { stage: "comfortable", streak: 8 }
  );

  assert.match(prompt, /emotional trajectory/i);
});

test("time-of-day guidance avoids addiction framing", () => {
  const guidance = getTimeOfDayGuidance();
  assert.doesNotMatch(guidance, /addiction/i);
});

test("miss-you tiers avoid desperate/nuclear escalation", () => {
  const tier = getMissYouTier(80);
  assert.notEqual(tier.urgency, "nuclear");
});

test("jealousy trigger copy avoids ex and rivalry bait", () => {
  for (let i = 0; i < 20; i += 1) {
    const line = getJealousyTrigger("intimate");
    assert.doesNotMatch(line, /\bex\b/i);
    assert.doesNotMatch(line, /\btrying to take me\b/i);
  }
});
