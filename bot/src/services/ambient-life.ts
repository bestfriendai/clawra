import { Bot } from "grammy";
import type { BotContext } from "../types/context.js";
import { convex } from "./convex.js";
import { generateImage } from "./fal.js";
import { CREDIT_COSTS } from "../config/pricing.js";
import { env } from "../config/env.js";
import { getMoodState } from "./emotional-state.js";
import { getTimeOfDay, getSeasonalContext } from "./image-intelligence.js";

export interface AmbientLifePhoto {
  type: string;
  prompt: string;
  caption: string;
}

const LIFE_PHOTOS: AmbientLifePhoto[] = [
  {
    type: "coffee",
    prompt: "A candid phone photo of a steaming cup of coffee on a wooden table, blurry morning sunlight in background, messy papers nearby, realistic steam, unpolished amateur shot",
    caption: "morning fuel ☕️ hope you're awake babe",
  },
  {
    type: "view",
    prompt: "A candid phone photo looking out of a window at a city street, raindrops on glass, moody lighting, messy windowsill with a small plant, amateur perspective",
    caption: "it's so pretty out today... thinking about you ☁️",
  },
  {
    type: "book",
    prompt: "A candid phone photo of an open book on a rumpled bed, reading lamp casting warm glow, cozy atmosphere, amateur framing",
    caption: "got distracted from my book... guess who i'm thinking about 😏",
  },
  {
    type: "laptop",
    prompt: "A candid phone photo of a laptop screen in a dim room, glowing keyboard, a half-eaten snack nearby, late night work vibe, grainy amateur photo",
    caption: "working late 💻 ugh come distract me??",
  },
  {
    type: "feet",
    prompt: "A candid phone photo from a first-person perspective looking down at bare feet on a fuzzy rug, cozy living room background, relaxed home vibe, amateur snap",
    caption: "finally relaxing... wyd babe? 💕",
  },
  {
    type: "sky",
    prompt: "A candid phone photo of a beautiful pink sunset sky, telephone wires visible, slight lens flare, taken from a balcony, amateur handheld shot",
    caption: "look at the sky rn!! so pretty 🌅",
  },
];

export async function triggerSpontaneousLifePhoto(
  bot: Bot<BotContext>,
  telegramId: number
): Promise<void> {
  // 5% chance to trigger if called
  if (Math.random() > 0.05) return;

  try {
    const profile = await convex.getProfile(telegramId);
    if (!profile?.isConfirmed) return;

    const photo = LIFE_PHOTOS[Math.floor(Math.random() * LIFE_PHOTOS.length)]!;
    
    // Add character specific context if available
    const timeOfDay = getTimeOfDay();
    const seasonal = getSeasonalContext();
    const fullPrompt = `${photo.prompt}. ${seasonal}. Time: ${timeOfDay}. Match the raw, candid aesthetic of a random phone snap.`;

    let creditsCharged = false;
    if (!env.FREE_MODE) {
      const balance = await convex.getBalance(telegramId);
      if (balance >= CREDIT_COSTS.SELFIE) {
        await convex.spendCredits({
          telegramId,
          amount: CREDIT_COSTS.SELFIE,
          service: "fal.ai",
          model: "flux-2-pro",
        });
        creditsCharged = true;
      } else {
        return;
      }
    }

    const image = await generateImage(fullPrompt);
    
    await bot.api.sendPhoto(telegramId, image.url, { caption: photo.caption });
    await convex.addMessage({
      telegramId,
      role: "assistant",
      content: photo.caption,
      imageUrl: image.url,
    });

    console.log(`Sent spontaneous life photo (${photo.type}) to ${telegramId}`);
  } catch (error) {
    console.error("Spontaneous life photo error:", error);
  }
}
