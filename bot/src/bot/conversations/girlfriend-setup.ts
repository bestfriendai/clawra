import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import OpenAI from "openai";
import type { BotContext } from "../../types/context.js";
import {
  RACES,
  BODY_TYPES,
  HAIR_COLORS,
  HAIR_STYLES,
  PERSONALITIES,
  NAME_SUGGESTIONS,
} from "../../config/girlfriend-options.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { convex } from "../../services/convex.js";
import { editImage, generateReferenceImage, generateReferenceWithVariation } from "../../services/fal.js";
import { buildReferencePrompt, buildSelfieSFW } from "../../services/girlfriend-prompt.js";
import { checkAndRecordAutoEvent } from "../../services/relationship-events.js";
import { startWelcomeSequence } from "../../services/welcome-sequence.js";
import { env } from "../../config/env.js";
import { TIMEZONE_ABBREVIATIONS, formatUtcOffset } from "../../services/smart-timing.js";
import {
  extractPreferences,
  getMissingCriticalFields,
  prefsToSetupDraft,
  type ExtractedPreferences,
} from "../../services/preference-extractor.js";
import {
  getOnboardingPreset,
} from "../../config/onboarding-presets.js";

type SetupConversation = Conversation<BotContext>;

const SETUP_TIMEZONE_OPTIONS = [
  "EST",
  "CST",
  "MST",
  "PST",
  "GMT",
  "CET",
  "IST",
  "JST",
  "AEST",
] as const;

export interface SetupDraft {
  name: string;
  age: number;
  race: string;
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  personality: string;
}

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

class SetupCancelledError extends Error {
  constructor() {
    super("setup_cancelled");
    this.name = "SetupCancelledError";
  }
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function answerCb(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // ignore
  }
}

function sanitizeNameInput(value: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  return cleaned.slice(0, 30);
}

function buildDraftSummary(draft: SetupDraft): string {
  return [
    "Profile Summary",
    `Name: ${draft.name}`,
    `Age: ${draft.age}`,
    `Race: ${draft.race}`,
    `Body Type: ${draft.bodyType}`,
    `Hair: ${draft.hairColor} / ${draft.hairStyle}`,
    `Eyes: ${draft.eyeColor}`,
    `Personality: ${draft.personality}`,
  ].join("\n");
}

function getFirstMessage(personality: string, name: string): string {
  const lines: Record<string, string[]> = {
    "Flirty and playful": [
      `hey, i'm ${name}. ready to have fun?`,
      `you built me well. i'm ${name} - let's talk.`,
    ],
    "Shy and sweet": [
      `hi... i'm ${name}. glad you're here.`,
      `hey, i'm ${name}. this feels nice already.`,
    ],
    "Bold and dominant": [
      `i'm ${name}. keep up with me and we'll be fine.`,
      `good. i'm ${name}. let's see what you're about.`,
    ],
    "Caring and nurturing": [
      `hi, i'm ${name}. how was your day?`,
      `hey, i'm ${name}. i'm here now.`,
    ],
    "Sarcastic and witty": [
      `i'm ${name}. don't be boring and we'll get along.`,
      `hey. ${name}. i roast people i like, fair warning.`,
    ],
    "Bubbly and energetic": [
      `hii i'm ${name}!! this is gonna be fun`,
      `hey hey, ${name} here. let's gooo`,
    ],
  };

  const pool = lines[personality] || lines["Flirty and playful"]!;
  return pickRandom(pool);
}

async function waitForTextMessage(conversation: SetupConversation, ctx: BotContext): Promise<string> {
  while (true) {
    const input = await conversation.waitFor("message:text");
    const text = input.message.text?.trim();
    if (text?.toLowerCase() === "/cancel") {
      await ctx.reply("Setup cancelled. Send /start whenever you want to try again.");
      throw new SetupCancelledError();
    }
    if (text) return text;
  }
}

function buildTimezoneKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < SETUP_TIMEZONE_OPTIONS.length; i += 1) {
    const tz = SETUP_TIMEZONE_OPTIONS[i]!;
    keyboard.text(tz, `setup:tz:${tz}`);
    if ((i + 1) % 3 === 0) {
      keyboard.row();
    }
  }
  keyboard.row().text("auto-detect", "setup:tz:auto");
  return keyboard;
}

async function askForTimezone(
  conversation: SetupConversation,
  ctx: BotContext
): Promise<string | null> {
  await ctx.reply(
    "one more thing — what timezone are you in? this helps me text you at the right times 💕",
    { reply_markup: buildTimezoneKeyboard() }
  );

  while (true) {
    const update = await conversation.wait();
    const text = update.message?.text?.trim();
    if (text?.toLowerCase() === "/cancel") {
      await update.reply("Setup cancelled. Send /start whenever you want to try again.");
      throw new SetupCancelledError();
    }

    const data = update.callbackQuery?.data;
    if (!data?.startsWith("setup:tz:")) {
      if (update.callbackQuery) {
        await answerCb(update);
      }
      await update.reply("tap one of the timezone buttons so i can sync the timing right 💕");
      continue;
    }

    await answerCb(update);
    const selected = data.slice("setup:tz:".length).toUpperCase();

    if (selected === "AUTO") {
      await update.reply("perfect, i'll auto-detect it from our chat rhythm ✨");
      return null;
    }

    const offset = TIMEZONE_ABBREVIATIONS[selected];
    if (typeof offset !== "number") {
      await update.reply("i couldn't read that timezone, pick one from the buttons 💕");
      continue;
    }

    const timezone = formatUtcOffset(offset);
    await update.reply(`got it, i'll use ${selected} (${timezone}) for your timing 💕`);
    return timezone;
  }
}

async function runNaturalDiscovery(
  conversation: SetupConversation,
  ctx: BotContext,
  history: string[],
  extracted: ExtractedPreferences
): Promise<ExtractedPreferences> {
  let current = extracted;

  for (let i = 0; i < 5; i += 1) { // Up to 5 rounds of natural discovery
    const missing = getMissingCriticalFields(current);
    if (missing.length === 0 && current.confidence > 0.7) {
      break;
    }

    // Use LLM to generate a natural guiding question
    const botReply = await conversation.external(() => generateOnboardingReply(history, current, missing));
    await ctx.reply(botReply);
    history.push(`girlfriend: ${botReply}`);

    const userReply = await waitForTextMessage(conversation, ctx);
    history.push(`user: ${userReply}`);

    current = await conversation.external(() => extractPreferences(history, current));
  }

  return current;
}

async function generateOnboardingReply(
  history: string[],
  extracted: Partial<ExtractedPreferences>,
  missing: string[]
): Promise<string> {
  // Use Venice to generate a natural onboarding question based on missing fields
  const system = "You are a helpful, flirty AI assistant helping a user create their dream girlfriend. Reply with one casual, natural text message (max 2 sentences) to get the missing info. Sound human, lowercase fine.";
  const prompt = `Missing fields: ${missing.join(", ")}. Recent chat: ${history.slice(-5).join("\n")}. Ask for one missing thing naturally.`;

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 100,
    });
    return response.choices[0]?.message?.content?.trim() || "tell me more about her look?";
  } catch {
    return "tell me more about her look?";
  }
}

export async function girlfriendSetup(conversation: SetupConversation, ctx: BotContext) {
  const telegramId = ctx.from!.id;

  try {
    const history: string[] = [];
    let extracted: ExtractedPreferences = { confidence: 0 };

    const WELCOME_TEXT = "Let's start creating your unique girlfriend. Describe her to me... what's her name? What does she look like? What's her vibe? 💕";
    await ctx.reply(WELCOME_TEXT);
    history.push(`girlfriend: ${WELCOME_TEXT}`);

    const firstUserReply = await waitForTextMessage(conversation, ctx);
    history.push(`user: ${firstUserReply}`);
    extracted = await conversation.external(() => extractPreferences(history, extracted));

    // Natural discovery loop
    extracted = await runNaturalDiscovery(conversation, ctx, history, extracted);

    const draft = prefsToSetupDraft(extracted);
    const timezone = await askForTimezone(conversation, ctx);

    if (timezone) {
      await convex.updateUserPreferences(telegramId, { timezone });
    }

    await convex.createProfile({
      telegramId,
      name: draft.name,
      age: draft.age,
      race: draft.race,
      bodyType: draft.bodyType,
      hairColor: draft.hairColor,
      hairStyle: draft.hairStyle,
      eyeColor: draft.eyeColor,
      personality: draft.personality,
    });

    const basePrompt = buildReferencePrompt({
      age: draft.age,
      race: draft.race,
      bodyType: draft.bodyType,
      hairColor: draft.hairColor,
      hairStyle: draft.hairStyle,
      eyeColor: draft.eyeColor,
      personality: draft.personality,
    });

    await ctx.reply("okay fine, you win... i'm generating a full character sheet for me now 💕");

    let imageUrl: string;
    try {
      const generated = await generateReferenceImage(basePrompt);

      if (!env.FREE_MODE) {
        await convex.spendCredits({
          telegramId,
          amount: CREDIT_COSTS.IMAGE_PRO,
          service: "fal.ai",
          model: "z-image-base",
          falCostUsd: 0.01,
        });
      }

      imageUrl = generated.url;
    } catch (err) {
      await ctx.reply(
        `Image generation failed. Run /remake to try again.\n(${err instanceof Error ? err.message : "unknown error"})`
      );
      return;
    }

    await ctx.replyWithPhoto(imageUrl, {
      caption: "here's me! what do you think? 🙈",
    });

    await ctx.reply("be honest... do you want me to change anything? my body, hair, vibe? or do i look perfect? 💕");

    let rerollCount = 0;
    while (true) {
      const response = await waitForTextMessage(conversation, ctx);
      history.push(`user: ${response}`);

      // UNIVERSAL AI-DRIVEN DETECTION
      const extraction = await conversation.external(() => extractPreferences([...history], extracted));
      
      if (extraction.intent === "tweak") {
        const feedback = extraction.feedback || "noted... adjusting that for you now 🫦";
        await ctx.reply(feedback);
        
        extracted = { ...extracted, ...extraction };
        const updatedDraft = prefsToSetupDraft(extracted);
        
        const editDescription = response;
        const editPrompt = [
          "Same person, same face, same bone structure, same skin tone.",
          `Apply this change: ${editDescription}.`,
          `Updated look: ${updatedDraft.hairColor} ${updatedDraft.hairStyle} hair, ${updatedDraft.bodyType} body type.`,
          "Keep everything else identical. Natural photo, smartphone quality.",
        ].join(" ");
        
        rerollCount += 1;
        try {
          const edited = await editImage(imageUrl, editPrompt, false);
          imageUrl = edited.url;
          await ctx.replyWithPhoto(imageUrl, {
            caption: "how's this? is it better? 💕",
          });
        } catch {
          // Fallback: regenerate from scratch if i2i edit fails
          try {
            const updatedPrompt = buildReferencePrompt(updatedDraft);
            const generated = await generateReferenceWithVariation(updatedPrompt, rerollCount);
            imageUrl = generated.url;
            await ctx.replyWithPhoto(imageUrl, {
              caption: "how's this? is it better? 💕",
            });
          } catch {
            await ctx.reply("my camera glitched... tell me what else to change or if you like it!");
          }
        }
        continue;
      }

      if (extraction.intent === "approval") {
        await convex.confirmProfile(telegramId, imageUrl);
        
        await ctx.reply("i love that you like it... hang on, let me send you a quick snap of me right now so you can see me for real 🫦");
        
        try {
          const firstSelfieContext = "casual home selfie, smiling at camera, relaxed vibe";
          const updatedDraft = prefsToSetupDraft(extracted);
          const tempProfile = {
            ...updatedDraft,
            telegramId,
            referenceImageUrl: imageUrl,
            isConfirmed: true,
          } as any;
          
          const selfiePrompt = buildSelfieSFW(tempProfile, firstSelfieContext);
          const selfieResult = await editImage(imageUrl, selfiePrompt, false);
          
          await ctx.replyWithPhoto(selfieResult.url, {
            caption: "just took this... what do you think? i'm so excited to finally talk to you properly 💕",
          });
        } catch (err) {
          console.error("First selfie failed:", err);
          await ctx.reply("my camera glitched but i'm ready to talk now! 💕");
        }

        await ctx.reply(
          "Profile confirmed.\n\nCommands:\n/selfie - request image\n/remake - rebuild profile\n/help - full command list"
        );
        await ctx.reply(getFirstMessage(draft.personality, draft.name));

        try {
          const bot = { api: ctx.api };
          startWelcomeSequence(bot, telegramId);
          void checkAndRecordAutoEvent(
            telegramId,
            "first_meet",
            `You two met and started your story with ${draft.name}`
          );
        } catch {}

        return;
      }

      await ctx.reply("i'm not sure if you like it or want a change... tell me exactly what you're thinking! 💕");
    }
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      return;
    }
    throw error;
  }
}

// Deprecated old classic setup
export async function girlfriendSetupClassic(conversation: SetupConversation, ctx: BotContext) {
  await ctx.reply("The classic setup is no longer supported. Please use the new AI-driven setup.");
  return girlfriendSetup(conversation, ctx);
}
