import { InlineKeyboard } from "grammy";
import OpenAI from "openai";
import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { chatWithGirlfriend, extractEnhancedMemory, enhancePromptWithLLM } from "../../services/venice.js";
import { editImage, generateVideoFromImage, generateVoiceNote } from "../../services/fal.js";
import { summarizeRecentConversation } from "../../services/conversation-summary.js";
import { getDefaultVoiceProfile, getVoiceProfile } from "../../config/voice-profiles.js";
import {
  isSelfieRequest,
  buildPromptFromConversation,
  isVideoRequest,
  isVoiceRequest,
  isAppearanceChangeRequest,
  isImageFollowup,
  buildVideoPrompt,
} from "../../services/girlfriend-prompt.js";
import {
  updateStreak,
  shouldTriggerJealousy,
  getJealousyTrigger,
  shouldTriggerCliffhanger,
  getCliffhanger,
  getStreakMessage,
  getStageUnlockMessage,
  type RetentionState,
} from "../../services/retention.js";
import { CREDIT_COSTS, UPSELL_INTERVAL } from "../../config/pricing.js";
import { env } from "../../config/env.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";
import { sanitizeForAI, sanitizeUserInput } from "../../utils/sanitize.js";
import { getModerationResponse, isProhibitedContent } from "../../utils/moderation.js";
import { checkMilestones } from "../../services/milestones.js";
import { checkRewardTriggers } from "../../services/reward-system.js";
import { isFantasyStopRequest, getFantasyAugment } from "../handlers/fantasy.js";
import { getOutOfCreditsMessage, shouldShowUpsell } from "../../services/upsell.js";
import { getFirstTimeTip } from "../../services/onboarding-tips.js";
import { registerWelcomeActivity } from "../../services/welcome-sequence.js";
import { EVENTS, trackEvent } from "../../services/analytics.js";
import { checkAndRecordAutoEvent } from "../../services/relationship-events.js";
import {
  getDeepQuestion,
  getPetNameEvolution,
  getVulnerableMoment,
  shouldShareVulnerability,
} from "../../services/relationship-deepening.js";
import { setSessionValue, getSessionValue } from "../../services/session-store.js";

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

// Track message count per user for periodic memory extraction
// Use LRU-style eviction to prevent unbounded memory growth
const MAX_TRACKED_USERS = 5000;
const messageCounters = new Map<number, number>();
const moodTracker = new Map<number, Mood[]>();
const lastImageSent = new Map<number, string>();
const lastImagePrompt = new Map<number, string>();

function trackWithEviction<V>(map: Map<number, V>, key: number, value: V): void {
  if (map.size >= MAX_TRACKED_USERS && !map.has(key)) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

type Mood = "playful" | "romantic" | "sexual" | "casual" | "emotional";

const SELFIE_CUE_PATTERNS = [
  /let me send you/i,
  /want to see/i,
  /sending you (a )?(pic|photo|snap)/i,
  /hold on let me take/i,
  /check your phone/i,
  /lemme send (you )?(something|a pic|a photo)/i,
  /i'?ll send (you )?(a )?(pic|photo|snap)/i,
];

const PRE_IMAGE_MESSAGES = [
  "hold on",
  "one sec",
  "gimme a sec",
  "waittt",
  "brb taking it rn",
  "ok wait",
  "lol ok hold on",
  "lemme take this real quick",
  "oooh ok one sec",
  "don't go anywhere",
  "ok lemme find the right angle",
  "hold onnn",
  "wait i need better lighting lol",
  "ok you asked for it",
  "let me make sure i look cute first",
  "brb",
];

const IMAGE_FAIL_EXCUSES = [
  "ugh my camera glitched sorry babe",
  "lol it came out blurry hold on",
  "wait my phone is being so stupid rn",
  "my camera app froze lmao one sec",
  "omg the lighting is terrible in here",
  "that one was ugly lol give me a sec to retake",
  "ugh i blinked. literally every time",
  "my phone storage is full or something 😭",
  "it didn't send?? ugh this phone i swear",
  "wait that angle made me look weird lol no",
  "ok the camera is NOT cooperating today",
  "lmaoo that came out so bad hold on",
  "my phone literally chose the worst moment to lag",
  "nah that one isn't cute enough for you, lemme try again",
];

const VENICE_FALLBACK_MESSAGES = [
  "sorry my phone just did something weird hold on",
  "wait lol my messages aren't sending",
  "ugh this app is being so annoying rn",
  "my phone literally just froze on me",
  "hold on my wifi just disconnected for a sec",
  "lol ok im back, idk what happened",
  "sorry babe my screen went black for a sec",
  "omg my phone has been so buggy today",
  "wait i just lost signal for a sec",
  "ugh i had a whole message typed and it deleted itself",
  "sorry i got distracted for a sec, what were we saying",
  "hold on let me switch to wifi my data is being weird",
];

function createPostImageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔥 Another one", "selfie:another")
    .text("😈 Spicier", "selfie:spicier")
    .row()
    .text("👗 Change outfit", "selfie:outfit")
    .text("💋 More", "selfie:dismiss");
}

async function simulateTyping(ctx: BotContext, responseLength: number, emotion: Mood = "casual"): Promise<void> {
  // Emotional hesitation before typing starts
  if (emotion === "emotional") {
    await sleep(1500 + Math.random() * 2000);
  }

  await ctx.replyWithChatAction("typing");

  let msPerChar = 40 + Math.random() * 20;

  // Speed adjustments
  if (emotion === "sexual" || emotion === "playful") {
    msPerChar *= 0.7; // Excited/horny typing is faster
  } else if (emotion === "emotional") {
    msPerChar *= 1.3; // Sad/serious typing is slower
  }

  const delay = Math.min(8000, Math.max(800, responseLength * msPerChar));

  // Mid-typing pauses for "thinking"
  const thinkingPause = Math.random() < 0.2 ? 1000 + Math.random() * 2000 : 0;

  await sleep(delay + thinkingPause);
}

async function simulateRealisticTyping(ctx: BotContext): Promise<void> {
  // 12% chance of "typing... stops... types again" pattern (she's rethinking what to say)
  if (Math.random() < 0.12) {
    await ctx.replyWithChatAction("typing");
    await sleep(1500 + Math.random() * 1500);
    // Brief pause where typing indicator disappears
    await sleep(800 + Math.random() * 1200);
    await ctx.replyWithChatAction("typing");
    await sleep(1000 + Math.random() * 1500);
  } else {
    await ctx.replyWithChatAction("typing");
  }
}

function splitIntoBubbles(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length >= 2) {
    return [sentences[0].trim(), sentences.slice(1).join(" ").trim()];
  }
  return [text];
}

async function sendAsMultipleBubbles(ctx: BotContext, response: string, emotion: Mood = "casual"): Promise<void> {
  if (response.length > 80 && Math.random() < 0.45) {
    const parts = splitIntoBubbles(response);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await simulateTyping(ctx, parts[i].length, emotion);
      await ctx.reply(parts[i]);
    }
    return;
  }
  await simulateTyping(ctx, response.length, emotion);
  await ctx.reply(response);
}

const EMOTION_REACTIONS: Record<Mood, "😁" | "❤" | "🔥" | "👍" | "😢"> = {
  playful: "😁",
  romantic: "❤",
  sexual: "🔥",
  casual: "👍",
  emotional: "😢",
};

async function reactToMessage(ctx: BotContext, emotion: Mood): Promise<void> {
  const emoji = EMOTION_REACTIONS[emotion];
  if (emoji && Math.random() < 0.4 && ctx.message?.message_id && ctx.chat?.id) {
    try {
      await ctx.api.setMessageReaction(
        ctx.chat.id,
        ctx.message.message_id,
        [{ type: "emoji", emoji }]
      );
    } catch {
    }
  }
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMessages(messages: string[]): string[] {
  const normalized = messages.map((message) => message.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [randomItem(VENICE_FALLBACK_MESSAGES)];
  }
  return normalized;
}

function detectMood(text: string): Mood {
  const lower = text.toLowerCase();

  if (
    /\b(sex|horny|nude|naked|fuck|cum|kiss me|turn me on|wet|hard|moan|thirsty|tease)\b/.test(lower)
  ) {
    return "sexual";
  }

  if (
    /\b(love|miss you|baby|babe|heart|cuddle|romantic|date|together|forever|obsessed)\b/.test(lower)
  ) {
    return "romantic";
  }

  if (
    /\b(sad|cry|hurt|anxious|stress|lonely|scared|overwhelmed|depressed|upset|emotional)\b/.test(lower)
  ) {
    return "emotional";
  }

  if (/\b(lol|lmao|haha|hehe|omg|tease|play|joking|jk|silly|fun)\b/.test(lower)) {
    return "playful";
  }

  return "casual";
}

function trackMood(telegramId: number, userMessage: string, replyText: string): Mood[] {
  const mood = detectMood(`${userMessage}\n${replyText}`);
  const history = moodTracker.get(telegramId) || [];
  const updated = [...history, mood].slice(-5);
  trackWithEviction(moodTracker, telegramId, updated);
  setSessionValue(telegramId, "moodTracker", updated).catch(() => {});
  return updated;
}

function shouldAutoTriggerSelfie(replyText: string, moods: Mood[]): boolean {
  const hasSelfieCue = SELFIE_CUE_PATTERNS.some((pattern) => pattern.test(replyText));
  if (!hasSelfieCue) return false;

  // Higher chance when mood is consistently sexual or romantic
  const recentMoods = moods.slice(-3);
  const sexualStreak = recentMoods.length >= 3 && recentMoods.every((mood) => mood === "sexual");
  const romanticStreak = recentMoods.length >= 2 && recentMoods.every((mood) => mood === "romantic" || mood === "sexual");

  let chance = 0.35;
  if (sexualStreak) chance = 0.85;
  else if (romanticStreak) chance = 0.55;

  return Math.random() < chance;
}

function inferSavedImageCategory(input: string, isNsfw: boolean): string {
  if (isNsfw) return "nsfw";
  const normalized = input.toLowerCase();
  if (
    normalized.includes("video") ||
    normalized.includes("clip") ||
    normalized.includes("frame")
  ) {
    return "video";
  }
  return "selfie";
}

function toRetentionState(rawState: any): RetentionState {
  if (!rawState || typeof rawState !== "object") {
    return {
      streak: 0,
      lastChatDate: "",
      messageCount: 0,
      stage: "new",
    };
  }

  const streak = typeof rawState.streak === "number" ? rawState.streak : 0;
  const lastChatDate = typeof rawState.lastChatDate === "string" ? rawState.lastChatDate : "";
  const messageCount =
    typeof rawState.messageCount === "number" ? rawState.messageCount : 0;
  const stage =
    rawState.stage === "comfortable" ||
    rawState.stage === "intimate" ||
    rawState.stage === "obsessed"
      ? rawState.stage
      : "new";

  return {
    streak,
    lastChatDate,
    messageCount,
    stage,
    lastJealousyTrigger:
      typeof rawState.lastJealousyTrigger === "number"
        ? rawState.lastJealousyTrigger
        : undefined,
    lastCliffhanger:
      typeof rawState.lastCliffhanger === "number"
        ? rawState.lastCliffhanger
        : undefined,
  };
}

export async function handleChat(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const userMessageRaw = ctx.message?.text;
  if (!userMessageRaw) return;

  registerWelcomeActivity(telegramId);

  const moderation = isProhibitedContent(userMessageRaw);
  if (moderation.blocked) {
    console.warn(`Moderation block for user ${telegramId}: ${moderation.reason || "unknown"}`);
    await sendAsMultipleTexts({
      ctx,
      messages: [getModerationResponse()],
    });
    return;
  }

  const userMessage = sanitizeForAI(userMessageRaw);
  if (!userMessage) {
    await sendAsMultipleTexts({
      ctx,
      messages: ["babe say that again?"],
    });
    return;
  }

  if (ctx.session.fantasyMode && isFantasyStopRequest(userMessageRaw)) {
    ctx.session.fantasyMode = undefined;
    await sendAsMultipleTexts({
      ctx,
      messages: ["*slips back to normal* that was fun babe... maybe we can do it again sometime? 😏💕"],
    });
    return;
  }

  if (ctx.session.fantasyMode === "custom_pending") {
    ctx.session.fantasyMode = `custom:${userMessage}`;
    await sendAsMultipleTexts({
      ctx,
      messages: ["mmm i love that 😈 let's do it babe..."],
    });
  }
  if (!ctx.girlfriend?.isConfirmed || !ctx.girlfriend.referenceImageUrl) {
    await ctx.reply(
      "You haven't set up your girlfriend yet!\nUse /start to create one."
    );
    return;
  }

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < CREDIT_COSTS.CHAT_MESSAGE) {
      await ctx.reply(getOutOfCreditsMessage(ctx.girlfriend.name));
      return;
    }
  }

    const explicitSelfieRequest = isSelfieRequest(userMessageRaw);
    if (explicitSelfieRequest) {
      trackEvent(telegramId, EVENTS.SELFIE_REQUESTED);
    }
    const chargeChatCredit = !explicitSelfieRequest;

  try {
    // Load memory and history
    const memoryFacts = await loadMemoryFacts(telegramId);
    const history = await convex.getRecentMessages(telegramId, 30);
    const messageHistory = history.map((m: any) => ({ role: m.role, content: m.content }));

    const previousRetention = toRetentionState(
      await convex.getRetentionState(telegramId)
    );
    const updatedRetention = updateStreak(previousRetention);
    let retentionForPersistence: RetentionState = { ...updatedRetention };
    ctx.retention = retentionForPersistence;
    let extraSent = false;

    if (!extraSent && previousRetention.stage !== updatedRetention.stage) {
      const stageUnlock = getStageUnlockMessage(
        updatedRetention.stage,
        ctx.girlfriend.name
      );
      if (stageUnlock) {
        await sendAsMultipleTexts({
          ctx,
          messages: [stageUnlock],
        });
        extraSent = true;
      }
    }

    if (!extraSent) {
      const streakMilestone = getStreakMessage(
        updatedRetention.streak,
        ctx.girlfriend.name
      );
      if (streakMilestone) {
        await sendAsMultipleTexts({
          ctx,
          messages: [streakMilestone],
        });
        extraSent = true;
      }
    }

    let effectiveUserMessage = userMessage;
    const fantasyMode = ctx.session.fantasyMode;
    if (fantasyMode && fantasyMode !== "custom_pending") {
      void checkAndRecordAutoEvent(
        telegramId,
        "first_fantasy",
        "First fantasy roleplay together"
      );

      const augment = fantasyMode.startsWith("custom:")
        ? `You are in a CUSTOM ROLEPLAY. The user described this scenario: "${fantasyMode.replace("custom:", "")}". Stay fully in character for this scenario.`
        : getFantasyAugment(fantasyMode);
      if (augment) {
        effectiveUserMessage = `[ROLEPLAY CONTEXT: ${augment}]\n\n${userMessage}`;
      }
    }

    if (Math.random() < 0.2) {
      const petName = getPetNameEvolution(
        updatedRetention.stage,
        updatedRetention.streak
      );
      effectiveUserMessage = `[STYLE NOTE: call him "${petName}" naturally in this response.]\n${effectiveUserMessage}`;
    }

    const replyMessages = normalizeMessages(
      await chatWithGirlfriend(
        ctx.girlfriend,
        messageHistory,
        effectiveUserMessage,
        memoryFacts,
        {
          stage: updatedRetention.stage,
          streak: updatedRetention.streak,
        }
      )
    );
    const joinedReply = replyMessages.join("\n");

    const detectedMood = detectMood(`${userMessage}\n${joinedReply}`);
    reactToMessage(ctx, detectedMood).catch(() => {});

    if (isAppearanceChangeRequest(userMessage)) {
      try {
        const parsePrompt = `The user said: "${userMessage}". They want to change their AI girlfriend's appearance. Extract ONLY the fields that should change. Return a JSON object with ONLY the changed fields from: name, age, race, bodyType, hairColor, hairStyle, personality. Example: {"hairColor": "blonde", "bodyType": "curvy"}. Return ONLY the JSON, nothing else.`;

        const parseResponse = await venice.chat.completions.create({
          model: "llama-3.3-70b",
          messages: [{ role: "user", content: parsePrompt }],
          max_tokens: 100,
          temperature: 0.1,
        });

        const parseText = parseResponse.choices[0]?.message?.content?.trim() || "{}";
        const jsonMatch = parseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedChanges = JSON.parse(jsonMatch[0]);
          const allowedFields = [
            "name",
            "race",
            "bodyType",
            "hairColor",
            "hairStyle",
            "personality",
          ] as const;
          const changes: Record<string, string | number> = {};

          for (const field of allowedFields) {
            const value = parsedChanges[field];
            if (typeof value === "string") {
              const safeValue = sanitizeUserInput(value);
              if (safeValue) {
                changes[field] = safeValue;
              }
            }
          }

          if (typeof parsedChanges.age === "number" && Number.isFinite(parsedChanges.age)) {
            changes.age = Math.max(18, Math.min(99, Math.trunc(parsedChanges.age)));
          }

          if (Object.keys(changes).length > 0) {
            await convex.updateProfile({ telegramId, ...changes });

            const updatedProfile = { ...ctx.girlfriend, ...changes };
            const { buildReferencePrompt } = await import("../../services/girlfriend-prompt.js");
            const refPrompt = buildReferencePrompt(updatedProfile);

            const { generateImage } = await import("../../services/fal.js");
            const newRef = await generateImage(refPrompt);

            await convex.confirmProfile(telegramId, newRef.url);

            Object.assign(ctx.girlfriend, changes);
            ctx.girlfriend.referenceImageUrl = newRef.url;
          }
        }
      } catch (err) {
        console.error("Appearance change error:", err);
      }
    }

    const moods = trackMood(telegramId, userMessage, joinedReply);
    const hasReference = Boolean(ctx.girlfriend.referenceImageUrl);
    const spontaneousSelfie =
      hasReference && shouldAutoTriggerSelfie(joinedReply, moods);
    const shouldGenerateImage = hasReference && (explicitSelfieRequest || spontaneousSelfie);

    let { prompt: imagePrompt, isNsfw: selfieNsfw } = await buildPromptFromConversation(
      ctx.girlfriend,
      userMessageRaw,
      joinedReply,
      moods[moods.length - 1] || "casual"
    );
    const selfieCreditCost = selfieNsfw ? CREDIT_COSTS.IMAGE_PRO : CREDIT_COSTS.SELFIE;

    if (!env.FREE_MODE && shouldGenerateImage) {
      const currentBalance = await convex.getBalance(telegramId);
      const requiredCredits = (chargeChatCredit ? CREDIT_COSTS.CHAT_MESSAGE : 0) + selfieCreditCost;
      if (currentBalance < requiredCredits) {
        await ctx.reply(getOutOfCreditsMessage(ctx.girlfriend.name));
        return;
      }
    }

    if (!env.FREE_MODE && chargeChatCredit) {
      await convex.spendCredits({
        telegramId,
        amount: CREDIT_COSTS.CHAT_MESSAGE,
        service: "venice",
        model: "llama-3.3-70b",
      });
    }

    await convex.addMessage({ telegramId, role: "user", content: userMessageRaw });

    await sendAsMultipleTexts({
      ctx,
      messages: replyMessages,
    });

    if (!extraSent && shouldShareVulnerability(retentionForPersistence.messageCount, retentionForPersistence.stage)) {
      const vulnerableLine = getVulnerableMoment(
        ctx.girlfriend.personality,
        retentionForPersistence.stage
      );
      sendAsMultipleTexts({
        ctx,
        messages: [vulnerableLine],
      }).catch((error: unknown) => console.error("Vulnerability follow-up send error:", error));
      convex
        .addMessage({
          telegramId,
          role: "assistant",
          content: vulnerableLine,
        })
        .catch((error: unknown) => console.error("Vulnerability follow-up save error:", error));
      extraSent = true;
    }

    if (!extraSent && retentionForPersistence.messageCount > 0 && retentionForPersistence.messageCount % 50 === 0) {
      const deepQuestion = getDeepQuestion(
        retentionForPersistence.stage,
        retentionForPersistence.messageCount
      );
      sendAsMultipleTexts({
        ctx,
        messages: [deepQuestion],
      }).catch((error: unknown) => console.error("Deep question send error:", error));
      convex
        .addMessage({
          telegramId,
          role: "assistant",
          content: deepQuestion,
        })
        .catch((error: unknown) => console.error("Deep question save error:", error));
      extraSent = true;
    }

    if (!extraSent && retentionForPersistence.stage === "new") {
      const tip = getFirstTimeTip(retentionForPersistence.messageCount, telegramId);
      if (tip) {
        setTimeout(() => {
          sendAsMultipleTexts({ ctx, messages: [tip] }).catch((error) =>
            console.error("Onboarding tip send error:", error)
          );
        }, 2000);
        extraSent = true;
      }
    }

    const reward = checkRewardTriggers(userMessageRaw);
    if (reward.triggered && reward.bonusCredits > 0 && !env.FREE_MODE) {
      convex
        .addCredits({
          telegramId,
          amount: reward.bonusCredits,
          paymentMethod: "bonus",
          paymentRef: "reward_trigger",
        })
        .catch((error) => console.error("Reward credit error:", error));
    }

    if (!extraSent && shouldTriggerJealousy(retentionForPersistence)) {
      const jealousyLine = getJealousyTrigger();
      await sendAsMultipleTexts({
        ctx,
        messages: [jealousyLine],
      });
      retentionForPersistence = {
        ...retentionForPersistence,
        lastJealousyTrigger: Date.now(),
      };
      ctx.retention = retentionForPersistence;
      extraSent = true;
    }

    if (!extraSent && shouldTriggerCliffhanger(retentionForPersistence)) {
      const cliffhangerLine = getCliffhanger();
      await sendAsMultipleTexts({
        ctx,
        messages: [cliffhangerLine.replace(/\|\|\|/g, " ").trim()],
      });
      retentionForPersistence = {
        ...retentionForPersistence,
        lastCliffhanger: Date.now(),
      };
      ctx.retention = retentionForPersistence;
      extraSent = true;
    }

    let imageUrl: string | undefined;

    let referenceForImage = ctx.girlfriend.referenceImageUrl;
    const isFollowup = isImageFollowup(userMessageRaw);
    if (isFollowup) {
      if (lastImageSent.has(telegramId)) {
        referenceForImage = lastImageSent.get(telegramId)!;
      } else {
        const persisted = await getSessionValue<string>(telegramId, "lastImageSent");
        if (persisted) {
          lastImageSent.set(telegramId, persisted);
          referenceForImage = persisted;
        }
      }
      const prevPrompt = lastImagePrompt.get(telegramId)
        || await getSessionValue<string>(telegramId, "lastImagePrompt")
        || "";
      if (prevPrompt) {
        lastImagePrompt.set(telegramId, prevPrompt);
        imagePrompt = `${prevPrompt}, modification: ${userMessageRaw}`;
      }
    }

    if (shouldGenerateImage && referenceForImage) {
      try {
        if (Math.random() < 0.3) {
          await sendAsMultipleTexts({
            ctx,
            messages: [randomItem(PRE_IMAGE_MESSAGES)],
          });
        }

        if (!env.FREE_MODE) {
          await convex.spendCredits({
            telegramId,
            amount: selfieCreditCost,
            service: "fal.ai",
            model: selfieNsfw ? "hunyuan-v3-edit" : "grok-edit",
            falCostUsd: selfieNsfw ? 0.09 : 0.02,
          });
        }

        await ctx.replyWithChatAction("upload_photo");

        const result = await editImage(
          referenceForImage,
          imagePrompt,
          selfieNsfw
        );

        imageUrl = result.url;
        trackWithEviction(lastImageSent, telegramId, result.url);
        trackWithEviction(lastImagePrompt, telegramId, imagePrompt);
        setSessionValue(telegramId, "lastImageSent", result.url).catch(() => {});
        setSessionValue(telegramId, "lastImagePrompt", imagePrompt).catch(() => {});
        await ctx.replyWithPhoto(result.url);

        const sfwPostMessages = [
          "like it?",
          "what do you think babe",
          "am i cute or am i cute",
          "rate me 1-10 and be honest",
          "took that just for you btw",
          "you better save that one",
          "do i look ok??",
          "hehe",
          "that angle tho",
          "you're welcome lol",
          "be honest... how do i look",
          "i look good today ngl",
          "this ones for your eyes only",
          "ok am i actually cute or are you just being nice",
          "dont just stare say something lol",
          "took me like 5 tries to get that angle right",
          "you better not screenshot that... ok fine you can",
          "thoughts?? be nice",
        ];
        const nsfwPostMessages = [
          "like what you see? 😏",
          "you better appreciate this",
          "that's all for you baby",
          "don't you dare show anyone else",
          "you're staring aren't you",
          "mmm did that do something to you?",
          "i took that one just now btw",
          "was it worth the wait?",
          "you're blushing i can tell",
          "want more?",
          "this is only for you ok",
          "i can't believe i just sent that lol",
          "ok now its your turn 😏",
          "bet you weren't expecting that",
          "delete that... jk keep it",
          "you owe me for that one",
          "hope you're alone rn lol",
          "that's what you do to me",
        ];
        const postPool = selfieNsfw ? nsfwPostMessages : sfwPostMessages;
        const postMsg = postPool[Math.floor(Math.random() * postPool.length)];

        await ctx.reply(postMsg, {
          reply_markup: createPostImageKeyboard(),
        });

        const savedCategory = inferSavedImageCategory(userMessageRaw, selfieNsfw);
        convex
          .saveImage(telegramId, result.url, imagePrompt, savedCategory, selfieNsfw)
          .catch((error) => console.error("Save image error:", error));

        await convex.logUsage({
          telegramId,
          service: "fal.ai",
          model: selfieNsfw ? "hunyuan-v3-edit" : "grok-edit",
          prompt: imagePrompt,
          creditsCharged: selfieCreditCost,
          falCostUsd: selfieNsfw ? 0.09 : 0.02,
          status: "success",
          resultUrl: result.url,
        });

        void checkAndRecordAutoEvent(
          telegramId,
          "first_selfie",
          "First selfie together"
        );

        if (selfieNsfw) {
          void checkAndRecordAutoEvent(
            telegramId,
            "first_nsfw",
            "First spicy photo moment"
          );
        }
      } catch (err) {
        console.error("Image generation error:", err);
        await sendAsMultipleTexts({
          ctx,
          messages: [randomItem(IMAGE_FAIL_EXCUSES)],
        });
      }
    }

    if (isVideoRequest(userMessageRaw) && ctx.girlfriend.referenceImageUrl) {
      try {
        await ctx.replyWithChatAction("upload_video");

        if (!env.FREE_MODE) {
          await convex.spendCredits({
            telegramId,
            amount: CREDIT_COSTS.VIDEO_SHORT,
            service: "fal.ai",
            model: "grok-imagine-video",
          });
        }

        const videoPrompt = await buildVideoPrompt(ctx.girlfriend, userMessageRaw);
        const video = await generateVideoFromImage(ctx.girlfriend.referenceImageUrl, videoPrompt);

        await ctx.replyWithVideo(video.url, {
          caption: `from ${ctx.girlfriend.name} 💕`,
        });

        await convex.logUsage({
          telegramId,
          service: "fal.ai",
          model: "grok-imagine-video",
          prompt: videoPrompt,
          creditsCharged: CREDIT_COSTS.VIDEO_SHORT,
          status: "success",
          resultUrl: video.url,
        });
      } catch (err) {
        console.error("Video generation error:", err);
        await sendAsMultipleTexts({
          ctx,
          messages: ["ugh the video didn't work babe, my phone is being weird 😭"],
        });
        if (!env.FREE_MODE) {
          await convex.refundCredits(telegramId, CREDIT_COSTS.VIDEO_SHORT, "fal.ai");
        }
      }
    }

    if (isVoiceRequest(userMessageRaw)) {
      try {
        await ctx.replyWithChatAction("record_voice");

        if (!env.FREE_MODE) {
          await convex.spendCredits({
            telegramId,
            amount: CREDIT_COSTS.VOICE_NOTE || 5,
            service: "fal.ai",
            model: "minimax-speech",
          });
        }

        // Use LLM to determine what she should actually say based on user's request
        let voiceText = replyMessages[replyMessages.length - 1] || "hey baby";
        const voiceEnhanced = await enhancePromptWithLLM(userMessageRaw, ctx.girlfriend, "voice");
        if (voiceEnhanced?.spokenWords) {
          voiceText = voiceEnhanced.spokenWords;
        }
        const voiceProfile = ctx.girlfriend?.voiceId
          ? getVoiceProfile(ctx.girlfriend.voiceId)
          : getDefaultVoiceProfile();
        const audio = await generateVoiceNote(voiceText, undefined, voiceProfile);

        const response = await fetch(audio.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const { InputFile } = await import("grammy");

        await ctx.replyWithVoice(new InputFile(buffer, "voice.mp3"), {
          duration: Math.ceil(audio.duration_ms / 1000),
        });

        await convex.logUsage({
          telegramId,
          service: "fal.ai",
          model: "minimax-speech",
          prompt: voiceText.substring(0, 100),
          creditsCharged: CREDIT_COSTS.VOICE_NOTE || 5,
          status: "success",
          resultUrl: audio.url,
        });
      } catch (err) {
        console.error("Voice note error:", err);
      }
    }

    await convex.addMessage({
      telegramId,
      role: "assistant",
      content: joinedReply,
      imageUrl,
    });

    await convex.upsertRetentionState({
      telegramId,
      streak: retentionForPersistence.streak,
      lastChatDate: retentionForPersistence.lastChatDate,
      messageCount: retentionForPersistence.messageCount,
      stage: retentionForPersistence.stage,
      lastJealousyTrigger: retentionForPersistence.lastJealousyTrigger,
      lastCliffhanger: retentionForPersistence.lastCliffhanger,
    });

    const milestone = checkMilestones(
      telegramId,
      retentionForPersistence.messageCount,
      retentionForPersistence.streak,
      userMessageRaw,
    );
    if (milestone) {
      sendAsMultipleTexts({ ctx, messages: [milestone.message] }).catch((err) =>
        console.error("Milestone send error:", err)
      );

      if (milestone.type === "love") {
        void checkAndRecordAutoEvent(
          telegramId,
          "first_love",
          "First 'I love you'"
        );
      }
    }

    const count = (messageCounters.get(telegramId) || 0) + 1;
    trackWithEviction(messageCounters, telegramId, count);
    setSessionValue(telegramId, "messageCount", count).catch(() => {});

    if (count % 5 === 0) {
      extractAndSaveMemory(telegramId, ctx.girlfriend.name).catch((err) =>
        console.error("Memory extraction error:", err)
      );
    }

    if (count % 20 === 0) {
      summarizeAndSaveConversation(telegramId, ctx.girlfriend.name).catch((err) =>
        console.error("Conversation summary error:", err)
      );
    }

    if (count % UPSELL_INTERVAL === 0) {
      shouldShowUpsell(telegramId)
        .then(({ show, balance, suggestion }) => {
          if (!show) return;
          const keyboard = new InlineKeyboard();
          if (ctx.me.username) {
            keyboard.url("💳 Open /buy", `https://t.me/${ctx.me.username}`);
          }

          return ctx.reply(
            `${suggestion}\n\nYou have ${balance} credits left. Tap below or send /buy 💕`,
            keyboard.inline_keyboard.length > 0
              ? { reply_markup: keyboard }
              : undefined
          );
        })
        .catch((err) => console.error("Upsell check error:", err));
    }

    trackEvent(telegramId, EVENTS.CHAT_SENT);
  } catch (err) {
    console.error("Chat error:", err);
    await sendAsMultipleTexts({
      ctx,
      messages: [randomItem(VENICE_FALLBACK_MESSAGES)],
    });
  }
}

async function loadMemoryFacts(telegramId: number): Promise<Array<{ fact: string; category?: string }>> {
  try {
    const facts = await convex.getRecentMemoryFacts(telegramId, 50);
    return facts.map((fact: any) => ({
      fact: String(fact.fact || ""),
      category: typeof fact.category === "string" ? fact.category : undefined,
    })).filter((fact) => fact.fact.length > 0);
  } catch {
    return [];
  }
}

async function extractAndSaveMemory(telegramId: number, girlfriendName: string): Promise<void> {
  const history = await convex.getRecentMessages(telegramId, 20);
  const messages = history.map((m: any) => ({ role: m.role, content: m.content }));

  const newFacts = await extractEnhancedMemory(girlfriendName, messages);
  if (newFacts.length === 0) return;

  await Promise.all(
    newFacts.map((fact) => convex.addCategorizedMemoryFact(
      telegramId,
      fact.category,
      fact.fact,
      fact.confidence
    ))
  );

  console.log(`Extracted ${newFacts.length} categorized memory facts for user ${telegramId}`);
}

async function summarizeAndSaveConversation(
  telegramId: number,
  girlfriendName: string
): Promise<void> {
  const history = await convex.getRecentMessages(telegramId, 20);
  const messages = history.map((m: any) => ({ role: m.role, content: m.content }));
  const summary = await summarizeRecentConversation(messages, girlfriendName);

  if (!summary) return;

  await convex.addCategorizedMemoryFact(
    telegramId,
    "conversation_summary",
    summary,
    0.7
  );

  console.log(`Saved conversation summary memory fact for user ${telegramId}`);
}
