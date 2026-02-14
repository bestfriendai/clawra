import { InlineKeyboard } from "grammy";
import type { InlineQueryResultArticle } from "grammy/types";
import type { BotContext } from "../../types/context.js";
import { env } from "../../config/env.js";
import { convex } from "../../services/convex.js";
import { generateImage } from "../../services/fal.js";
import { buildSelfieSFW } from "../../services/girlfriend-prompt.js";
import { isProhibitedContent } from "../../utils/moderation.js";
import { sanitizeUserInput } from "../../utils/sanitize.js";

export const INLINE_IMAGE_COST = 3;

const INLINE_TIMEOUT_MS = 25000;

const QUICK_OPTIONS: Array<{ id: string; title: string; prompt: string }> = [
  { id: "selfie", title: "📸 Selfie", prompt: "casual selfie, smiling, looking cute" },
  { id: "smiling", title: "😊 Smiling", prompt: "girlfriend smiling warmly, natural light" },
  { id: "workout", title: "💪 Working out", prompt: "girlfriend at the gym after a workout" },
  { id: "coffee", title: "☕ Coffee date", prompt: "girlfriend at a cozy cafe, coffee date vibe" },
  { id: "beach", title: "🏖️ Beach day", prompt: "girlfriend at the beach on a sunny day" },
  { id: "goodnight", title: "🌙 Goodnight", prompt: "girlfriend in bed saying goodnight, fully clothed, SFW" },
];

const NSFW_TERM_PATTERN =
  /\b(nsfw|nude|naked|sex|sexy|explicit|horny|porn|boob|boobs|tits|ass|pussy|cock|dick|blowjob|handjob|cum|fetish|kink|anal|topless|bottomless|lingerie|thong|strip|undress|spicy)\b/gi;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function sanitizeInlinePrompt(sanitizedInput: string): string {
  const stripped = sanitizedInput
    .replace(NSFW_TERM_PATTERN, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || "casual selfie, smiling, looking cute";
}

function buildSetupResult(): InlineQueryResultArticle {
  return {
    type: "article",
    id: "inline-setup-required",
    title: "Set me up first!",
    description: "Use /start in DMs to create your girlfriend profile.",
    input_message_content: {
      message_text: "Set me up first! Use /start in DMs",
    },
  };
}

function buildBalanceResult(balance: number): InlineQueryResultArticle {
  return {
    type: "article",
    id: "inline-low-balance",
    title: "Not enough credits",
    description: `Need ${INLINE_IMAGE_COST} credits. You have ${balance}.`,
    input_message_content: {
      message_text:
        `You need ${INLINE_IMAGE_COST} credits for an inline image.\n` +
        `Current balance: ${balance} credits\nUse /buy in DM to top up.`,
    },
  };
}

function buildGeneratingResult(dmLink: string): InlineQueryResultArticle {
  return {
    type: "article",
    id: "inline-generating",
    title: "Still generating...",
    description: "This is taking longer than usual. Continue in DM.",
    input_message_content: {
      message_text:
        "Still generating... Open DM and send /selfie to continue instantly.\n" +
        dmLink,
    },
    reply_markup: new InlineKeyboard().url("Open bot DM", dmLink),
  };
}

function buildQuickOptionResults(dmLink: string): InlineQueryResultArticle[] {
  return QUICK_OPTIONS.map((option) => ({
    type: "article",
    id: `inline-option-${option.id}`,
    title: option.title,
    description: option.prompt,
    input_message_content: {
      message_text:
        `${option.title}\n` +
        `Prompt: ${option.prompt}\n\n` +
        `Open DM to generate this in one tap:\n${dmLink}`,
    },
    reply_markup: new InlineKeyboard().url("Generate in DM", dmLink),
  }));
}

function buildModerationResult(): InlineQueryResultArticle {
  return {
    type: "article",
    id: "inline-content-blocked",
    title: "Try a safer prompt",
    description: "Inline mode is SFW-only.",
    input_message_content: {
      message_text: "Inline mode is SFW-only. Try a wholesome prompt.",
    },
  };
}

function buildImageResult(imageUrl: string, userPrompt: string): InlineQueryResultArticle {
  return {
    type: "article",
    id: `inline-image-${Date.now()}`,
    title: "Generated SFW girlfriend image",
    description: userPrompt,
    input_message_content: {
      message_text: `Here she is 💕\n${imageUrl}`,
    },
  };
}

async function getDmLink(ctx: BotContext): Promise<string> {
  const username = ctx.me.username || (await ctx.api.getMe()).username;
  return `https://t.me/${username}?start=inline`;
}

export async function handleInlineQuery(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.answerInlineQuery([], { cache_time: 10, is_personal: true });
    return;
  }

  const dmLink = await getDmLink(ctx);
  const profile = ctx.girlfriend ?? (await convex.getProfile(telegramId));

  if (!profile?.isConfirmed) {
    await ctx.answerInlineQuery([buildSetupResult()], {
      cache_time: 10,
      is_personal: true,
    });
    return;
  }

  const queryText = (ctx.inlineQuery?.query || "").trim();
  if (!queryText) {
    await ctx.answerInlineQuery(buildQuickOptionResults(dmLink), {
      cache_time: 10,
      is_personal: true,
    });
    return;
  }

  const sanitizedInput = sanitizeUserInput(queryText);
  const moderation = isProhibitedContent(sanitizedInput);
  if (moderation.blocked) {
    await ctx.answerInlineQuery([buildModerationResult()], {
      cache_time: 10,
      is_personal: true,
    });
    return;
  }

  const safeText = sanitizeInlinePrompt(sanitizedInput);

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < INLINE_IMAGE_COST) {
      await ctx.answerInlineQuery([buildBalanceResult(balance)], {
        cache_time: 10,
        is_personal: true,
      });
      return;
    }
  }

  const prompt = buildSelfieSFW(profile, safeText);
  const generated = await withTimeout(generateImage(prompt), INLINE_TIMEOUT_MS);

  if (!generated) {
    await ctx.answerInlineQuery([buildGeneratingResult(dmLink)], {
      cache_time: 10,
      is_personal: true,
    });
    return;
  }

  if (!env.FREE_MODE) {
    await convex.spendCredits({
      telegramId,
      amount: INLINE_IMAGE_COST,
      service: "fal.ai",
      model: "generate-inline-sfw",
      falCostUsd: 0.03,
    });
  }

  await convex.logUsage({
    telegramId,
    service: "fal.ai",
    model: "generate-inline-sfw",
    prompt: safeText,
    creditsCharged: env.FREE_MODE ? 0 : INLINE_IMAGE_COST,
    falCostUsd: 0.03,
    status: "success",
    resultUrl: generated.url,
  });

  await ctx.answerInlineQuery([buildImageResult(generated.url, safeText)], {
    cache_time: 10,
    is_personal: true,
  });
}
