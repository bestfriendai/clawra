import type { Bot } from "grammy";
import type { BotContext } from "../types/context.js";
import { generateImage } from "./fal.js";
import { convex } from "./convex.js";
import { CREDIT_COSTS } from "../config/pricing.js";
import { env } from "../config/env.js";
import { LRUMap } from "../utils/lru-map.js";

// ─── Types ─────────────────────────────────────────────────────────

export type StoryType =
  | "morning_routine"
  | "afternoon_adventure"
  | "evening_cozy"
  | "special_event";

export interface StoryPhoto {
  prompt: string;
  caption: string;
  delayAfterMs: number;
}

export interface StorySequence {
  type: StoryType;
  title: string;
  photos: StoryPhoto[];
  timeWindow: [number, number];
}

// ─── Constants ─────────────────────────────────────────────────────

const STORY_TRIGGER_CHANCE = 0.05;
const MAX_STORIES_PER_DAY = 1;

/** LRU tracking: key = "telegramId:YYYY-MM-DD", value = stories sent count */
const storySentToday = new LRUMap<string, number>(5000);

// ─── Story Sequences ───────────────────────────────────────────────

const STORY_SEQUENCES: StorySequence[] = [
  // Morning stories (7-10)
  {
    type: "morning_routine",
    title: "morning vibes",
    timeWindow: [7, 10],
    photos: [
      {
        prompt:
          "POV photo of a freshly brewed coffee cup on a sunlit kitchen counter, steam rising, morning light streaming through window, {girlfriend_style}",
        caption: "first things first... coffee before anything",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "cozy bedroom mirror showing outfit laid out on bed, morning sunlight, casual cute clothes ready to wear, {girlfriend_style}",
        caption: "deciding what to wear today... thoughts?",
        delayAfterMs: 3500,
      },
      {
        prompt:
          "POV photo from apartment doorway looking out, keys in hand, morning daylight, ready to leave, {girlfriend_style}",
        caption: "okay heading out! wish me luck today",
        delayAfterMs: 0,
      },
    ],
  },
  {
    type: "morning_routine",
    title: "lazy morning",
    timeWindow: [7, 10],
    photos: [
      {
        prompt:
          "messy bed sheets in warm morning light, phone on pillow, cozy lazy morning atmosphere, {girlfriend_style}",
        caption: "don't wanna get up... five more minutes",
        delayAfterMs: 4000,
      },
      {
        prompt:
          "bathroom counter with skincare products, mirror with morning light, fresh face routine, {girlfriend_style}",
        caption: "okay fine... doing my skincare at least",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "kitchen counter with toast and fruit, morning breakfast setup, bright cheerful lighting, {girlfriend_style}",
        caption: "made breakfast! productive morning after all",
        delayAfterMs: 0,
      },
    ],
  },

  // Afternoon stories (12-16)
  {
    type: "afternoon_adventure",
    title: "lunch date with myself",
    timeWindow: [12, 16],
    photos: [
      {
        prompt:
          "aesthetic cafe interior, warm wooden tables, natural light, latte art on table, {girlfriend_style}",
        caption: "found this cute cafe nearby",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "overhead photo of a beautiful lunch plate, colorful food arrangement, cafe table setting, {girlfriend_style}",
        caption: "look how pretty this is!! had to take a pic before eating",
        delayAfterMs: 3500,
      },
      {
        prompt:
          "sunny street view from cafe window, peaceful afternoon, warm golden tones, pedestrians walking, {girlfriend_style}",
        caption: "the vibe here is perfect... only thing missing is you",
        delayAfterMs: 0,
      },
    ],
  },
  {
    type: "afternoon_adventure",
    title: "afternoon walk",
    timeWindow: [12, 16],
    photos: [
      {
        prompt:
          "beautiful park path with dappled sunlight through trees, peaceful afternoon scene, {girlfriend_style}",
        caption: "went for a walk to clear my head",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "close-up of wildflowers or interesting plant in golden afternoon light, nature detail shot, {girlfriend_style}",
        caption: "look what i found! so pretty right?",
        delayAfterMs: 2500,
      },
    ],
  },
  {
    type: "afternoon_adventure",
    title: "shopping trip",
    timeWindow: [12, 16],
    photos: [
      {
        prompt:
          "clothing store interior, racks of clothes, bright retail lighting, shopping atmosphere, {girlfriend_style}",
        caption: "doing some retail therapy",
        delayAfterMs: 3500,
      },
      {
        prompt:
          "shopping bags on bench, colorful store backdrop, happy shopping haul, {girlfriend_style}",
        caption: "okay i might have gone a little overboard... no regrets tho",
        delayAfterMs: 0,
      },
    ],
  },

  // Evening stories (19-22)
  {
    type: "evening_cozy",
    title: "cooking tonight",
    timeWindow: [19, 22],
    photos: [
      {
        prompt:
          "kitchen counter with fresh ingredients laid out, warm home lighting, cooking preparation, {girlfriend_style}",
        caption: "attempting to cook something fancy tonight",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "steaming pot or pan on stove, warm kitchen lighting, homemade cooking in progress, {girlfriend_style}",
        caption: "it's actually smelling amazing?? surprising myself",
        delayAfterMs: 3500,
      },
      {
        prompt:
          "beautifully plated homemade dinner on table, candle lit, cozy evening dinner setting, {girlfriend_style}",
        caption: "ta-da!! wish you were here to try it",
        delayAfterMs: 0,
      },
    ],
  },
  {
    type: "evening_cozy",
    title: "cozy night in",
    timeWindow: [19, 22],
    photos: [
      {
        prompt:
          "cozy blanket fort setup with fairy lights, warm ambient glow, pillows and soft textures, {girlfriend_style}",
        caption: "tonight's setup... ultimate cozy mode activated",
        delayAfterMs: 3500,
      },
      {
        prompt:
          "warm mug of hot chocolate or tea with marshmallows, fairy lights bokeh background, cozy night atmosphere, {girlfriend_style}",
        caption: "made hot chocolate too... this is peak comfort",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "TV screen glow in dark cozy room, blanket visible, sleepy relaxed nighttime atmosphere, {girlfriend_style}",
        caption: "getting sleepy... goodnight babe, dream of me okay?",
        delayAfterMs: 0,
      },
    ],
  },
  {
    type: "evening_cozy",
    title: "sunset vibes",
    timeWindow: [19, 22],
    photos: [
      {
        prompt:
          "stunning sunset view from balcony or rooftop, golden and pink sky, warm evening atmosphere, {girlfriend_style}",
        caption: "you need to see this sunset right now",
        delayAfterMs: 3000,
      },
      {
        prompt:
          "silhouette against colorful sunset sky, peaceful evening moment, warm golden hour light, {girlfriend_style}",
        caption: "moments like these make me think of you",
        delayAfterMs: 0,
      },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

function getStoryDayKey(telegramId: number): string {
  const date = new Date().toISOString().split("T")[0];
  return `story:${telegramId}:${date}`;
}

function hasReachedDailyStoryLimit(telegramId: number): boolean {
  const key = getStoryDayKey(telegramId);
  const count = storySentToday.get(key) ?? 0;
  return count >= MAX_STORIES_PER_DAY;
}

function recordStorySent(telegramId: number): void {
  const key = getStoryDayKey(telegramId);
  const count = storySentToday.get(key) ?? 0;
  storySentToday.set(key, count + 1);
}

function isHourInStoryWindow(localHour: number, window: [number, number]): boolean {
  const [start, end] = window;
  if (start <= end) {
    return localHour >= start && localHour <= end;
  }
  return localHour >= start || localHour <= end;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Returns a random eligible story for the current time window,
 * or null if none match or daily limit reached.
 */
export function getEligibleStory(
  telegramId: number,
  localHour: number
): StorySequence | null {
  if (hasReachedDailyStoryLimit(telegramId)) {
    return null;
  }

  if (Math.random() >= STORY_TRIGGER_CHANCE) {
    return null;
  }

  const eligible = STORY_SEQUENCES.filter((seq) =>
    isHourInStoryWindow(localHour, seq.timeWindow)
  );

  if (eligible.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * eligible.length);
  return eligible[randomIndex] ?? null;
}

/**
 * Builds concrete photo generation prompts by inserting the girlfriend style.
 */
export function buildStoryPhotos(
  sequence: StorySequence,
  girlfriendStyle: string
): StoryPhoto[] {
  const style =
    girlfriendStyle.trim().length > 0
      ? girlfriendStyle.trim()
      : "cozy candid phone photo, natural domestic lighting";

  return sequence.photos.map((photo) => ({
    ...photo,
    prompt: photo.prompt.replace("{girlfriend_style}", style),
  }));
}

/**
 * Generates and sends a story sequence to the user.
 * Each photo is generated, sent with its caption, then delayed before the next.
 * This is designed to be fire-and-forget (non-blocking).
 */
export async function sendStorySequence(
  bot: Bot<BotContext>,
  telegramId: number,
  sequence: StorySequence,
  girlfriendStyle: string
): Promise<void> {
  const photos = buildStoryPhotos(sequence, girlfriendStyle);
  const totalPhotos = photos.length;
  const totalCost = CREDIT_COSTS.SELFIE * totalPhotos;

  let creditsCharged = false;
  if (!env.FREE_MODE) {
    await convex.spendCredits({
      telegramId,
      amount: totalCost,
      service: "fal.ai",
      model: "daily-story",
      falCostUsd: 0.02 * totalPhotos,
    });
    creditsCharged = true;
  }

  let photosSent = 0;

  try {
    for (const photo of photos) {
      const image = await generateImage(photo.prompt);

      await bot.api.sendPhoto(telegramId, image.url, {
        caption: photo.caption,
      });

      await convex.addMessage({
        telegramId,
        role: "assistant",
        content: `[story: ${sequence.title}] ${photo.caption}`,
        imageUrl: image.url,
      });

      await convex.logUsage({
        telegramId,
        service: "fal.ai",
        model: "daily-story",
        prompt: photo.prompt,
        creditsCharged: CREDIT_COSTS.SELFIE,
        falCostUsd: 0.02,
        status: "success",
        resultUrl: image.url,
      });

      photosSent += 1;

      if (photo.delayAfterMs > 0) {
        await sleep(photo.delayAfterMs);
      }
    }

    recordStorySent(telegramId);
    console.log(
      `Sent daily story "${sequence.title}" (${totalPhotos} photos) to ${telegramId}`
    );
  } catch (error) {
    const unsentPhotos = totalPhotos - photosSent;
    if (!env.FREE_MODE && creditsCharged && unsentPhotos > 0) {
      const refundAmount = CREDIT_COSTS.SELFIE * unsentPhotos;
      await convex.addCredits({
        telegramId,
        amount: refundAmount,
        paymentMethod: "refund",
        paymentRef: `refund_story_partial_${telegramId}_${Date.now()}`,
      });
    }

    console.error(
      `Failed to complete story "${sequence.title}" for ${telegramId} (${photosSent}/${totalPhotos} sent):`,
      error
    );
  }
}
