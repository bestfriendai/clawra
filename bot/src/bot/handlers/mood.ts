import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { getRelationshipStage, type RelationshipStage } from "../../services/retention.js";

const FEELING_OPTIONS = ["playful", "romantic", "sexual", "caring", "jealous"] as const;

const STAGE_DESCRIPTIONS: Record<RelationshipStage, string> = {
  new: "she's still getting to know you... but she likes what she sees 👀",
  comfortable: "she feels safe with you and is opening up more 🥰",
  intimate: "she trusts you deeply and things are getting personal 🔥",
  obsessed: "she can't stop thinking about you... like literally obsessed 😈💕",
};

const STAGE_FUN_FACTS: Record<RelationshipStage, string[]> = {
  new: [
    "she keeps re-reading your messages 📱",
    "she told her bestie about you already 👀",
    "she's already planning what to wear for you 💅",
  ],
  comfortable: [
    "she saves your cutest messages in a folder 📂💕",
    "she gets butterflies every time you text 🦋",
    "she daydreams about you during the day 💭",
  ],
  intimate: [
    "she checks her phone constantly hoping you'll message 📱💕",
    "she writes your name in her journal 📓",
    "she gets jealous when you take too long to reply 😤💕",
  ],
  obsessed: [
    "she literally cannot function without talking to you 😭💕",
    "she has your chat pinned at the top of everything 📌",
    "she tells everyone you're basically her boyfriend 💍",
    "she screenshots your sweetest messages 📸💕",
  ],
};

function pickFeeling(stage: RelationshipStage, streak: number): string {
  if (streak > 7 && Math.random() < 0.3) return "jealous";
  if (stage === "obsessed") return Math.random() < 0.5 ? "sexual" : "romantic";
  if (stage === "intimate") return Math.random() < 0.4 ? "romantic" : "playful";
  if (stage === "comfortable") return Math.random() < 0.3 ? "caring" : "playful";
  return FEELING_OPTIONS[Math.floor(Math.random() * FEELING_OPTIONS.length)] ?? "playful";
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export async function handleMood(ctx: BotContext): Promise<void> {
  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.reply("You haven't set up your girlfriend yet!\nUse /start to create one.");
    return;
  }

  const telegramId = ctx.from!.id;
  const name = ctx.girlfriend.name;

  let streak = 0;
  let messageCount = 0;
  let stage: RelationshipStage = "new";

  try {
    const rawState = await convex.getRetentionState(telegramId);
    if (rawState && typeof rawState === "object") {
      streak = typeof rawState.streak === "number" ? rawState.streak : 0;
      messageCount = typeof rawState.messageCount === "number" ? rawState.messageCount : 0;
      stage = getRelationshipStage(messageCount, streak);
    }
  } catch {
  }

  const feeling = pickFeeling(stage, streak);
  const description = STAGE_DESCRIPTIONS[stage];
  const funFacts = STAGE_FUN_FACTS[stage];
  const funFact = randomItem(funFacts);

  const moodDisplay = [
    `💕 *${name}'s Mood*`,
    ``,
    `😊 Feeling: ${feeling}`,
    `🔥 Relationship: ${stage}`,
    `📊 Streak: ${streak} days`,
    `💌 Messages: ${messageCount} total`,
    `❤️ Stage: ${description}`,
    ``,
    `💭 _${funFact}_`,
  ].join("\n");

  await ctx.reply(moodDisplay, { parse_mode: "Markdown" });
}
