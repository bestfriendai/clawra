import { NextFunction } from "grammy";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "../../config/env.js";
import type { BotContext } from "../../types/context.js";

const DAILY_MESSAGE_CAP = 3000;
const LIMIT_MESSAGE = "babe slow down ur blowing up my phone 😂 wait a sec";

type CommandTier = "chat" | "selfie" | "video" | "voice" | "admin";

type TierLimit = {
  perMinute: number;
  burst: number;
  burstWindowSeconds: number;
};

const TIER_LIMITS: Record<CommandTier, TierLimit> = {
  chat: { perMinute: 120, burst: 25, burstWindowSeconds: 10 },
  selfie: { perMinute: 5, burst: 2, burstWindowSeconds: 10 },
  video: { perMinute: 2, burst: 1, burstWindowSeconds: 20 },
  voice: { perMinute: 5, burst: 2, burstWindowSeconds: 12 },
  admin: { perMinute: 3, burst: 1, burstWindowSeconds: 20 },
};

type UpstashLimiters = {
  minute: Record<CommandTier, Ratelimit>;
  burst: Record<CommandTier, Ratelimit>;
  daily: Ratelimit;
};

let ratelimit: UpstashLimiters | null = null;
const inMemoryBuckets = new Map<string, number[]>();

function now(): number {
  return Date.now();
}

function getDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function createLimiter(redis: Redis, limit: number, window: `${number} s`): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
  });
}

function isCommandText(text: string, command: string): boolean {
  return new RegExp(`^/${command}(?:@\\w+)?(?:\\s|$)`, "i").test(text);
}

function detectTier(ctx: BotContext): CommandTier {
  const text = ctx.message?.text?.trim() || "";
  const callbackData =
    (ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "") || "";

  if (ctx.message?.voice) return "voice";
  if (callbackData.startsWith("selfie:")) return "selfie";
  if (text) {
    if (isCommandText(text, "admin")) return "admin";
    if (isCommandText(text, "selfie")) return "selfie";
    if (isCommandText(text, "video") || /\bvideo\b/i.test(text)) return "video";
  }

  return "chat";
}

function countTowardsDailyCap(ctx: BotContext): boolean {
  return Boolean(ctx.message);
}

function checkInMemorySlidingWindow(key: string, limit: number, windowMs: number): boolean {
  const cutoff = now() - windowMs;
  const entries = (inMemoryBuckets.get(key) || []).filter((timestamp) => timestamp > cutoff);
  if (entries.length >= limit) {
    inMemoryBuckets.set(key, entries);
    return false;
  }

  entries.push(now());
  inMemoryBuckets.set(key, entries);
  return true;
}

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = {
    minute: {
      chat: createLimiter(redis, TIER_LIMITS.chat.perMinute, "60 s"),
      selfie: createLimiter(redis, TIER_LIMITS.selfie.perMinute, "60 s"),
      video: createLimiter(redis, TIER_LIMITS.video.perMinute, "60 s"),
      voice: createLimiter(redis, TIER_LIMITS.voice.perMinute, "60 s"),
      admin: createLimiter(redis, TIER_LIMITS.admin.perMinute, "60 s"),
    },
    burst: {
      chat: createLimiter(redis, TIER_LIMITS.chat.burst, `${TIER_LIMITS.chat.burstWindowSeconds} s`),
      selfie: createLimiter(redis, TIER_LIMITS.selfie.burst, `${TIER_LIMITS.selfie.burstWindowSeconds} s`),
      video: createLimiter(redis, TIER_LIMITS.video.burst, `${TIER_LIMITS.video.burstWindowSeconds} s`),
      voice: createLimiter(redis, TIER_LIMITS.voice.burst, `${TIER_LIMITS.voice.burstWindowSeconds} s`),
      admin: createLimiter(redis, TIER_LIMITS.admin.burst, `${TIER_LIMITS.admin.burstWindowSeconds} s`),
    },
    daily: createLimiter(redis, DAILY_MESSAGE_CAP, "86400 s"),
  };
}

export async function rateLimitMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  if (!ratelimit) {
    await next();
    return;
  }

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await next();
    return;
  }

  const tier = detectTier(ctx);
  const dayKey = getDayKey();

  if (ratelimit) {
    if (countTowardsDailyCap(ctx)) {
      const daily = await ratelimit.daily.limit(`daily:${dayKey}:${telegramId}`);
      if (!daily.success) {
        await ctx.reply(LIMIT_MESSAGE);
        return;
      }
    }

    const minute = await ratelimit.minute[tier].limit(`minute:${tier}:${telegramId}`);
    const burst = await ratelimit.burst[tier].limit(`burst:${tier}:${telegramId}`);

    if (!minute.success || !burst.success) {
      await ctx.reply(LIMIT_MESSAGE);
      return;
    }

    await next();
    return;
  }

  if (countTowardsDailyCap(ctx)) {
    const dailyAllowed = checkInMemorySlidingWindow(
      `daily:${dayKey}:${telegramId}`,
      DAILY_MESSAGE_CAP,
      24 * 60 * 60 * 1000
    );
    if (!dailyAllowed) {
      await ctx.reply(LIMIT_MESSAGE);
      return;
    }
  }

  const limits = TIER_LIMITS[tier];
  const minuteAllowed = checkInMemorySlidingWindow(
    `minute:${tier}:${telegramId}`,
    limits.perMinute,
    60 * 1000
  );
  const burstAllowed = checkInMemorySlidingWindow(
    `burst:${tier}:${telegramId}`,
    limits.burst,
    limits.burstWindowSeconds * 1000
  );

  if (!minuteAllowed || !burstAllowed) {
    await ctx.reply(LIMIT_MESSAGE);
    return;
  }

  await next();
}
