import type { BotContext } from "../types/context.js";

export interface SendOptions {
  ctx: BotContext;
  messages: string[];
  imageUrl?: string;
  imageCaption?: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickImageIndex(length: number): number {
  if (length <= 1) return 0;
  const shouldUseLast = Math.random() < 0.55;
  if (shouldUseLast) return length - 1;
  return randomInt(0, length - 2);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateTypingDelay(message: string): number {
  // Humans type at roughly 40-60 wpm, which is ~3-5 characters per second (200-300ms per char)
  // AI should be faster but still realistic. Let's aim for 30-60ms per character.
  const baseMs = message.length * randomInt(35, 55);
  // Add a small "thought" delay for the start of the message
  const thoughtMs = randomInt(500, 1500);
  // Cap at 5 seconds so user isn't waiting forever
  return Math.min(5000, baseMs + thoughtMs);
}

export async function sendAsMultipleTexts(options: SendOptions): Promise<void> {
  const { ctx, imageUrl, imageCaption } = options;
  const messages = options.messages.map((message) => message.trim()).filter(Boolean);

  if (messages.length === 0) {
    return;
  }

  const imageIndex = imageUrl ? pickImageIndex(messages.length) : -1;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]!;

    const delay = calculateTypingDelay(message);
    
    // Show typing action
    try {
      await ctx.replyWithChatAction("typing");
    } catch (e) {
      // Ignore if fail
    }

    // Wait for simulated typing
    await sleep(delay);

    if (i === imageIndex && imageUrl) {
      const caption = imageCaption?.trim() || message;
      await ctx.replyWithPhoto(imageUrl, { caption });
    } else {
      await ctx.reply(message);
    }

    // Small delay between separate text messages (simulating "hit send")
    if (i < messages.length - 1) {
      await sleep(randomInt(400, 1000));
    }
  }
}
