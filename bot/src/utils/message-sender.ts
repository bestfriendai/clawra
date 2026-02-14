import type { BotContext } from "../types/context.js";

export interface SendOptions {
  ctx: BotContext;
  messages: string[];
  imageUrl?: string;
  imageCaption?: string;
}

const EMOJI_ONLY_RE =
  /^\s*(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)?\s*){1,3}$/u;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isEmojiOnly(text: string): boolean {
  return EMOJI_ONLY_RE.test(text.trim());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function pickImageIndex(length: number): number {
  if (length <= 1) return 0;
  const shouldUseLast = Math.random() < 0.55;
  if (shouldUseLast) return length - 1;
  return randomInt(0, length - 2);
}

export async function sendAsMultipleTexts(options: SendOptions): Promise<void> {
  const { ctx, imageUrl, imageCaption } = options;
  const messages = options.messages.map((message) => message.trim()).filter(Boolean);

  if (messages.length === 0) {
    return;
  }

  const imageIndex = imageUrl ? pickImageIndex(messages.length) : -1;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];

    if (i === imageIndex && imageUrl) {
      const caption = imageCaption?.trim() || message;
      await ctx.replyWithPhoto(imageUrl, { caption });
      continue;
    }

    await ctx.reply(message);
  }
}
