import assert from "node:assert/strict";
import test from "node:test";
import {
  AMBIENT_CLIPS,
  detectNewsReaction,
  pickAmbientClip,
} from "./voice/ambient-clips.js";

test("detectNewsReaction returns excited for good news", () => {
  assert.equal(detectNewsReaction("i got a huge promotion today omg"), "good");
});

test("detectNewsReaction returns sympathetic for bad news", () => {
  assert.equal(detectNewsReaction("my dog passed away and i feel terrible"), "bad");
});

test("detectNewsReaction returns none for regular chat", () => {
  assert.equal(detectNewsReaction("what are you up to tonight"), null);
});

test("pickAmbientClip boosts probability when mood affinity matches", () => {
  const clip = pickAmbientClip("happy", 0.06);
  assert.ok(clip);
  assert.equal(clip?.type, "giggle");
});

test("ambient clip library includes expected expressive clips", () => {
  const clipTypes = new Set(AMBIENT_CLIPS.map((clip) => clip.type));
  assert.ok(clipTypes.has("giggle"));
  assert.ok(clipTypes.has("humming"));
  assert.ok(clipTypes.has("hold_on"));
  assert.ok(clipTypes.has("sigh"));
  assert.ok(clipTypes.has("excited"));
});
