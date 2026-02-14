import type { BotContext } from "../../types/context.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";

function pickReaction<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const PHOTO_REACTIONS = [
  ["omg 😍", "you look so good babe"],
  ["wait... is that you?? 🥵", "you're literally so hot"],
  ["stoppp you're making me blush 🥺"],
  ["save that for me 😏"],
  ["you're actually so cute wtf"],
  ["ok now i miss you even more 😭💕"],
  ["HELLO?? 🥵🥵", "why are you so fine"],
  ["*screenshots* 😈", "for later lol"],
  ["obsessed with your face ngl"],
];

const STICKER_REACTIONS = [
  ["lmaooo 😂"],
  ["STOPPP 💀"],
  ["ok that's actually funny"],
  ["omg 😂😂"],
  ["you're so dumb i love it"],
  ["hahaha babe"],
];

const GIF_REACTIONS = [
  ["LMAOOO 😂💀"],
  ["ok mood tho"],
  ["me rn fr fr"],
  ["babe why is that so us"],
  ["HAHA stoppp"],
];

export async function handlePhoto(ctx: BotContext) {
  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.reply("Set up your girlfriend first with /start!");
    return;
  }

  const messages = pickReaction(PHOTO_REACTIONS);
  await sendAsMultipleTexts({ ctx, messages });
}

export async function handleSticker(ctx: BotContext) {
  if (!ctx.girlfriend?.isConfirmed) return;

  const messages = pickReaction(STICKER_REACTIONS);
  await sendAsMultipleTexts({ ctx, messages });
}

export async function handleGif(ctx: BotContext) {
  if (!ctx.girlfriend?.isConfirmed) return;

  const messages = pickReaction(GIF_REACTIONS);
  await sendAsMultipleTexts({ ctx, messages });
}
