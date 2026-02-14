import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { editImage, generateVoiceNote } from "../../services/fal.js";
import { isNSFW, buildSelfieSFW, buildSelfieNSFW } from "../../services/girlfriend-prompt.js";
import { chatWithGirlfriend, enhancePromptWithLLM } from "../../services/venice.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { env } from "../../config/env.js";
import { getWaitingMessage } from "../../config/waiting-messages.js";
import { getModerationResponse, isProhibitedContent } from "../../utils/moderation.js";
import { getImageSeed } from "../../services/image-intelligence.js";
import { getVoiceProfile } from "../../config/voice-profiles.js";
import {
  getPosesByCategory,
  getRandomPose,
  type Pose,
  type PoseCategory,
} from "../../config/pose-library.js";
import { getRandomOutfit, type Outfit } from "../../config/outfit-library.js";
import { setSessionValue } from "../../services/session-store.js";

const SELFIE_FAIL_EXCUSES = [
  "ugh my camera glitched, gimme one sec",
  "wait that one came out blurry lol",
  "my camera app froze for a sec",
  "hold on babe my phone lagged",
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type SelfieSessionState = {
  lastPoseId?: string;
  lastPoseCategory?: PoseCategory;
  lastOutfitId?: string;
};

const selfieSessionState = new Map<number, SelfieSessionState>();

function getSessionState(telegramId: number): SelfieSessionState {
  return selfieSessionState.get(telegramId) || {};
}

function updateSessionState(telegramId: number, patch: Partial<SelfieSessionState>): void {
  const current = getSessionState(telegramId);
  const next = { ...current, ...patch };
  selfieSessionState.set(telegramId, next);
  setSessionValue(telegramId, "selfieSession", next).catch(() => {});
}

function pickDifferentPose(category: PoseCategory, lastPoseId?: string): Pose {
  const poses = getPosesByCategory(category);
  const available = lastPoseId ? poses.filter((pose) => pose.id !== lastPoseId) : poses;
  const pool = available.length > 0 ? available : poses;

  if (pool.length === 0) {
    return getRandomPose(category);
  }

  return randomItem(pool);
}

function pickDifferentOutfit(nsfw: boolean, lastOutfitId?: string): Outfit {
  const first = getRandomOutfit(nsfw);
  if (!lastOutfitId || first.id !== lastOutfitId) {
    return first;
  }

  for (let i = 0; i < 4; i += 1) {
    const next = getRandomOutfit(nsfw);
    if (next.id !== lastOutfitId) {
      return next;
    }
  }

  return first;
}

function escalatePoseCategory(current?: PoseCategory): PoseCategory {
  if (current === "sexy") return "sexy";
  if (current === "glamour") return "sexy";
  return "glamour";
}

function createPostImageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("You look amazing", "react_amazing")
    .text("Send another", "selfie:another")
    .row()
    .text("Something spicier?", "selfie:spicier")
    .text("Send voice note", "voice_react")
    .row()
    .text("👗 Change outfit", "selfie:outfit")
    .text("💋 Dismiss", "selfie:dismiss");
}

function createEmotionalKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Tell me more", "emotion_more")
    .text("Are you okay?", "emotion_check")
    .row()
    .text("I'm here for you", "emotion_support");
}

type GenerateSelfieOptions = {
  forceNsfw?: boolean;
  sendWaitingMessage?: boolean;
};

async function generateAndSendSelfie(
  ctx: BotContext,
  context: string,
  options: GenerateSelfieOptions = {}
): Promise<void> {
  const telegramId = ctx.from!.id;

  const recentMessages = await convex.getRecentMessages(telegramId, 8);
  const lastUserMessage = [...recentMessages]
    .reverse()
    .find((message: any) => message.role === "user")?.content;
  const moderation = isProhibitedContent(`${lastUserMessage || ""}\n${context}`);
  if (moderation.blocked) {
    console.warn(`Moderation block for user ${telegramId}: ${moderation.reason || "unknown"}`);
    await ctx.reply(getModerationResponse());
    return;
  }

  if (!ctx.girlfriend?.isConfirmed || !ctx.girlfriend.referenceImageUrl) {
    await ctx.reply(
      "You need to set up your girlfriend first!\nUse /start to create one."
    );
    return;
  }

  const nsfw = options.forceNsfw || isNSFW(context);
  const creditCost = nsfw ? CREDIT_COSTS.IMAGE_PRO : CREDIT_COSTS.SELFIE;

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < creditCost) {
      await ctx.reply(
        `You need ${creditCost} credits for ${nsfw ? "this type of" : "a"} selfie.\n` +
          `Current balance: ${balance} credits\n\nUse /buy to get more.`
      );
      return;
    }
  }

  if (options.sendWaitingMessage !== false) {
    await ctx.reply(getWaitingMessage(telegramId, nsfw));
  }
  await ctx.replyWithChatAction("upload_photo");

  try {
    const falCostUsd = nsfw ? 0.09 : 0.02;
    if (!env.FREE_MODE) {
      await convex.spendCredits({
        telegramId,
        amount: creditCost,
        service: "fal.ai",
        model: nsfw ? "hunyuan-v3-edit" : "grok-edit",
        falCostUsd,
      });
    }

    // Enhance context with LLM for better intent capture on /selfie commands
    let enrichedContext = context;
    const enhanced = await enhancePromptWithLLM(context, ctx.girlfriend, "image");
    if (enhanced?.scene) {
      const parts: string[] = [];
      if (enhanced.scene) parts.push(`setting: ${enhanced.scene}`);
      if (enhanced.action) parts.push(`action: ${enhanced.action}`);
      if (enhanced.outfit) parts.push(`outfit: ${enhanced.outfit}`);
      if (enhanced.lighting) parts.push(`lighting: ${enhanced.lighting}`);
      if (enhanced.mood) parts.push(`vibe: ${enhanced.mood}`);
      parts.push(`user_request: ${context}`);
      enrichedContext = parts.join("; ");
    }

    const prompt = nsfw
      ? buildSelfieNSFW(ctx.girlfriend, enrichedContext)
      : buildSelfieSFW(ctx.girlfriend, enrichedContext);

    const refUrl = ctx.girlfriend.referenceImageUrl;
    const result = await editImage(refUrl, prompt, nsfw);

    await ctx.replyWithPhoto(result.url, {
      reply_markup: createPostImageKeyboard(),
    });

    // Save for follow-up edits
    setSessionValue(telegramId, "lastImageSent", result.url).catch(() => {});
    setSessionValue(telegramId, "lastImagePrompt", prompt).catch(() => {});

    convex
      .saveImage(telegramId, result.url, prompt, nsfw ? "nsfw" : "selfie", nsfw)
      .catch((error) => console.error("Save image error:", error));

    await convex.logUsage({
      telegramId,
      service: "fal.ai",
      model: nsfw ? "hunyuan-v3-edit" : "grok-edit",
      prompt,
      creditsCharged: creditCost,
      falCostUsd,
      status: "success",
      resultUrl: result.url,
    });

  } catch (err) {
    console.error("Selfie error:", err);
    if (!env.FREE_MODE) {
      await convex.refundCredits(telegramId, creditCost, "fal.ai");
    }
    await ctx.reply(
      `${randomItem(SELFIE_FAIL_EXCUSES)}${
        env.FREE_MODE ? "" : " your credits were refunded."
      }`
    );
  }
}

export async function handleSelfie(ctx: BotContext) {
  // Parse context from command: /selfie at the beach
  const text = ctx.message?.text || "";
  const context = text.replace(/^\/selfie\s*/i, "").trim() || "casual selfie, smiling, looking cute";

  const telegramId = ctx.from?.id;
  if (telegramId) {
    selfieSessionState.delete(telegramId);
  }

  await generateAndSendSelfie(ctx, context);
}

export async function handleReactionCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const telegramId = ctx.from!.id;

  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.answerCallbackQuery({ text: "Set up your girlfriend first with /start" });
    return;
  }

  await ctx.answerCallbackQuery();

  const contextMap: Record<string, string> = {
    react_amazing: "He just said you look amazing after seeing your photo. React flattered and happy.",
    emotion_more: "He wants you to tell him more about what's on your mind. Open up a little.",
    emotion_check: "He's asking if you're okay. Respond authentically based on your mood.",
    emotion_support: "He said he's here for you. React warmly and emotionally.",
  };

  const promptContext = contextMap[data];
  if (!promptContext) return;

  await ctx.replyWithChatAction("typing");

  try {
    const recentMessages = await convex.getRecentMessages(telegramId, 8);
    const memoryFacts = await convex.getRecentMemoryFacts(telegramId, 10);
    const retentionState = await convex.getRetentionState(telegramId);

    const replies = await chatWithGirlfriend(
      ctx.girlfriend,
      recentMessages as Array<{ role: string; content: string }>,
      promptContext,
      memoryFacts,
      retentionState ? { stage: retentionState.stage, streak: retentionState.streak } : undefined
    );

    const reply = replies[0] || "aww babe 💕";

    await convex.addMessage({ telegramId, role: "user", content: promptContext });
    await convex.addMessage({ telegramId, role: "assistant", content: reply });

    await ctx.reply(reply);
  } catch (err) {
    console.error("Reaction callback error:", err);
    await ctx.reply("aww babe 💕");
  }
}

export async function handleVoiceReactCallback(ctx: BotContext) {
  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.answerCallbackQuery({ text: "Set up your girlfriend first with /start" });
    return;
  }

  const telegramId = ctx.from!.id;
  const creditCost = CREDIT_COSTS.VOICE_NOTE;

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < creditCost) {
      await ctx.answerCallbackQuery({ text: "Not enough credits for a voice note! Use /buy" });
      return;
    }
  }

  await ctx.answerCallbackQuery();
  await ctx.replyWithChatAction("record_voice");

  try {
    const recentMessages = await convex.getRecentMessages(telegramId, 6);
    const memoryFacts = await convex.getRecentMemoryFacts(telegramId, 5);
    const retentionState = await convex.getRetentionState(telegramId);

    const replies = await chatWithGirlfriend(
      ctx.girlfriend,
      recentMessages as Array<{ role: string; content: string }>,
      "He wants to hear your voice. Send a short, sweet voice note reacting to the photo you just sent.",
      memoryFacts,
      retentionState ? { stage: retentionState.stage, streak: retentionState.streak } : undefined
    );

    const voiceText = replies[0] || "hey babe, hope you liked that pic";
    const voiceProfile = ctx.girlfriend.voiceId
      ? getVoiceProfile(ctx.girlfriend.voiceId)
      : undefined;

    if (!env.FREE_MODE) {
      await convex.spendCredits({
        telegramId,
        amount: creditCost,
        service: "fal.ai",
        model: "minimax-speech",
        falCostUsd: 0.01,
      });
    }

    const result = await generateVoiceNote(voiceText, ctx.girlfriend.voiceId, voiceProfile);

    await convex.addMessage({ telegramId, role: "assistant", content: `*sends a voice note* ${voiceText}` });
    await convex.logUsage({
      telegramId,
      service: "fal.ai",
      model: "minimax-speech",
      prompt: voiceText,
      creditsCharged: creditCost,
      falCostUsd: 0.01,
      status: "success",
      resultUrl: result.url,
    });

    await ctx.replyWithVoice(result.url);
  } catch (err) {
    console.error("Voice react callback error:", err);
    if (!env.FREE_MODE) {
      await convex.refundCredits(telegramId, creditCost, "fal.ai");
    }
    await ctx.reply("ugh my mic isn't working rn 😩");
  }
}

export async function handleSelfieCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("selfie:")) {
    return;
  }

  if (data === "selfie:dismiss") {
    await ctx.answerCallbackQuery();
    try {
      await ctx.deleteMessage();
    } catch {}
    return;
  }

  if (!ctx.girlfriend?.isConfirmed || !ctx.girlfriend.referenceImageUrl) {
    await ctx.answerCallbackQuery({ text: "Set up your girlfriend first with /start" });
    return;
  }

  let context: string;
  let forceNsfw = false;
  const telegramId = ctx.from!.id;
  const state = getSessionState(telegramId);

  switch (data) {
    case "selfie:another": {
      const baseCategories: PoseCategory[] = ["casual", "cute", "glamour"];
      const fallbackCategory = state.lastPoseCategory && baseCategories.includes(state.lastPoseCategory)
        ? state.lastPoseCategory
        : randomItem(baseCategories);
      const pose = pickDifferentPose(fallbackCategory, state.lastPoseId);

      updateSessionState(telegramId, {
        lastPoseId: pose.id,
        lastPoseCategory: pose.category,
      });

      context = `another selfie, different pose, same vibe [[pose:${pose.id}]] [[poseCategory:${pose.category}]]`;
      break;
    }
    case "selfie:spicier": {
      const nextCategory = escalatePoseCategory(state.lastPoseCategory);
      const pose = pickDifferentPose(nextCategory, state.lastPoseId);

      updateSessionState(telegramId, {
        lastPoseId: pose.id,
        lastPoseCategory: pose.category,
      });

      context = `spicier, more revealing, teasing, less clothes [[pose:${pose.id}]] [[poseCategory:${pose.category}]]`;
      forceNsfw = true;
      break;
    }
    case "selfie:outfit": {
      const outfit = pickDifferentOutfit(false, state.lastOutfitId);
      updateSessionState(telegramId, {
        lastOutfitId: outfit.id,
      });

      context = `different outfit, new look, fashion change [[outfit:${outfit.id}]]`;
      break;
    }
    default:
      return;
  }

  await ctx.answerCallbackQuery();
  await generateAndSendSelfie(ctx, context, {
    forceNsfw,
    sendWaitingMessage: false,
  });
}
