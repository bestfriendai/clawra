import assert from "node:assert/strict";
import test from "node:test";
import { buildTieredMemoryBlock, trimConversationHistory } from "./context-manager.js";

test("tiered memory includes core sections and deduplicates repeated facts", () => {
  const block = buildTieredMemoryBlock(
    [
      { fact: "His name is Marcus", category: "personal_info", confidence: 0.95 },
      { fact: "His name is Marcus", category: "personal_info", confidence: 0.95 },
      { fact: "He loves late-night drives", category: "preference", confidence: 0.9 },
      { fact: "He gets anxious before interviews", category: "emotional", confidence: 0.88 },
      { fact: "We call each other babe", category: "relationship", confidence: 0.82 },
    ],
    "i have an interview tomorrow and i am nervous",
    false
  );

  assert.match(block, /## TIERED MEMORY/);
  assert.match(block, /## IDENTITY ANCHORS/);
  assert.match(block, /## EMOTIONAL CONTEXT/);
  assert.match(block, /## RELATIONSHIP THREAD/);
  assert.equal((block.match(/His name is Marcus/g) || []).length, 1);
});

test("tiered memory only includes intimate section in nsfw context", () => {
  const safeBlock = buildTieredMemoryBlock(
    [{ fact: "He likes playful teasing", category: "kink", confidence: 0.9 }],
    "good morning",
    false
  );
  const nsfwBlock = buildTieredMemoryBlock(
    [{ fact: "He likes playful teasing", category: "kink", confidence: 0.9 }],
    "i'm feeling horny",
    true
  );

  assert.doesNotMatch(safeBlock, /INTIMATE CONTEXT/);
  assert.match(nsfwBlock, /INTIMATE CONTEXT/);
});

test("conversation trimming preserves latest turns while reducing token footprint", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message ${index} `.repeat(30),
  }));

  const trimmed = trimConversationHistory(messages, 350);

  assert.ok(trimmed.length < messages.length);
  assert.equal(trimmed[trimmed.length - 1].content.includes("message 19"), true);
});
