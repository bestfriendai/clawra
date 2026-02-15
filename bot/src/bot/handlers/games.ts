import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import {
  startGame,
  processGameMessage,
  isInGame,
  endGame,
  getGameLabel,
  type GameType,
} from "../../services/interactive-games.js";

const GAME_TYPES: GameType[] = [
  "truth_or_dare",
  "would_you_rather",
  "20_questions",
  "story_builder",
];

function buildGameMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Truth or Dare 🎲", "game:truth_or_dare")
    .text("Would You Rather 🤔", "game:would_you_rather")
    .row()
    .text("20 Questions 🔮", "game:20_questions")
    .text("Story Builder 📖", "game:story_builder");
}

export async function handleGame(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  if (isInGame(telegramId)) {
    await ctx.reply(
      "babe we're already playing! type 'quit' to stop the current game first 💕"
    );
    return;
  }

  await ctx.reply("ooh what do you wanna play babe? 🎮💕", {
    reply_markup: buildGameMenu(),
  });
}

export async function handleGameCallback(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("game:")) return;

  const gameType = data.replace("game:", "") as string;
  if (!GAME_TYPES.includes(gameType as GameType)) {
    await ctx.answerCallbackQuery({ text: "unknown game type!" });
    return;
  }

  if (isInGame(telegramId)) {
    await ctx.answerCallbackQuery({ text: "you're already in a game!" });
    return;
  }

  const label = getGameLabel(gameType as GameType);
  await ctx.answerCallbackQuery({ text: `starting ${label}!` });

  const openingMessage = startGame(telegramId, gameType as GameType);
  await ctx.reply(openingMessage);
}

export async function handleGameMessage(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isInGame(telegramId)) return false;

  const text = ctx.message?.text;
  if (!text) return false;

  const response = await processGameMessage(telegramId, text);
  await ctx.reply(response.message);
  return true;
}
