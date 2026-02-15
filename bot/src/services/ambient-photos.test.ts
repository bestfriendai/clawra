import assert from "node:assert/strict";
import test from "node:test";
import {
  AMBIENT_PHOTOS,
  buildAmbientPrompt,
  getEligibleAmbientPhoto,
} from "./ambient-photos.js";

test("buildAmbientPrompt injects girlfriend style", () => {
  const config = AMBIENT_PHOTOS.find((item) => item.type === "morning_coffee");
  assert.ok(config);

  const prompt = buildAmbientPrompt(config, "soft natural candid phone-photo style");

  assert.doesNotMatch(prompt, /\{girlfriend_style\}/);
  assert.match(prompt, /soft natural candid phone-photo style/);
});

test("getEligibleAmbientPhoto returns null outside configured windows", () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;

  try {
    const result = getEligibleAmbientPhoto(3);
    assert.equal(result, null);
  } finally {
    Math.random = originalRandom;
  }
});

test("getEligibleAmbientPhoto picks an eligible option when one exists", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const result = getEligibleAmbientPhoto(9);
    assert.ok(result);
    assert.ok(result.timeWindows.some(([start, end]) => 9 >= start && 9 <= end));
  } finally {
    Math.random = originalRandom;
  }
});
