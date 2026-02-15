import assert from "node:assert/strict";
import test from "node:test";
import {
  getLevel,
  getXPForNextLevel,
  LEVELS,
  getLevelUpMessage,
} from "./relationship-xp.js";

test("getLevel returns expected tier boundaries", () => {
  assert.deepEqual(getLevel(0), LEVELS[0]);
  assert.deepEqual(getLevel(100), LEVELS[1]);
  assert.deepEqual(getLevel(499), LEVELS[1]);
  assert.deepEqual(getLevel(500), LEVELS[2]);
  assert.deepEqual(getLevel(50000), LEVELS[6]);
  assert.deepEqual(getLevel(100000), LEVELS[6]);
});

test("getXPForNextLevel returns remaining XP and caps at max level", () => {
  assert.equal(getXPForNextLevel(0), 100);
  assert.equal(getXPForNextLevel(1247), 753);
  assert.equal(getXPForNextLevel(50000), 0);
  assert.equal(getXPForNextLevel(999999), 0);
});

test("getLevelUpMessage includes level name and in-character tone", () => {
  const message = getLevelUpMessage("Dating");
  assert.match(message, /Dating/i);
  assert.match(message, /babe|us|we/i);
});
