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
  PERSONALITY_DESCRIPTIONS,
  EYE_COLORS,
  NAME_SUGGESTIONS,
} from "../../config/girlfriend-options.js";
import type {
  BodyType,
  EyeColor,
  HairColor,
  HairStyle,
  Personality,
  Race,
} from "../../config/girlfriend-options.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { convex } from "../../services/convex.js";
import { generateReferenceImage, generateReferenceWithVariation } from "../../services/fal.js";
import { buildReferencePrompt } from "../../services/girlfriend-prompt.js";
import { checkAndRecordAutoEvent } from "../../services/relationship-events.js";
import { startWelcomeSequence } from "../../services/welcome-sequence.js";
import { env } from "../../config/env.js";
import {
  extractPreferences,
  getMissingCriticalFields,
  prefsToSetupDraft,
  type ExtractedPreferences,
} from "../../services/preference-extractor.js";
import {
  ONBOARDING_PRESETS,
  getOnboardingPreset,
  type OnboardingPreset,
} from "../../config/onboarding-presets.js";

type SetupConversation = Conversation<BotContext>;
type SetupMode = "preset" | "custom" | "random";

export interface SetupDraft {
  name: string;
  age: number;
  race: Race;
  bodyType: BodyType;
  hairColor: HairColor;
  hairStyle: HairStyle;
  eyeColor: EyeColor;
  personality: Personality;
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

function buildGrid(items: readonly string[], prefix: string, cols = 3): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < items.length; i += 1) {
    kb.text(items[i]!, `${prefix}:${items[i]}`);
    if ((i + 1) % cols === 0 && i < items.length - 1) kb.row();
  }
  return kb;
}

async function answerCb(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // ignore
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeNameInput(value: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  return cleaned.slice(0, 30);
}

function toAllowedOption<T extends string>(value: string, options: readonly T[]): T | null {
  const normalized = normalize(value);
  const match = options.find((item) => normalize(item) === normalized);
  return match || null;
}

function renderStep(step: number, total: number, title: string): string {
  if (step <= 0) {
    return title;
  }
  return `Step ${step}/${total}\n${title}`;
}

function buildPersonalityKeyboard(): InlineKeyboard {
  const emojiMap: Record<Personality, string> = {
    "Flirty and playful": "💋",
    "Shy and sweet": "🌸",
    "Bold and dominant": "🔥",
    "Caring and nurturing": "💛",
    "Sarcastic and witty": "😏",
    "Bubbly and energetic": "⚡",
  };

  const kb = new InlineKeyboard();
  for (const personality of PERSONALITIES) {
    const short = personality.split(" and ")[0] || personality;
    const desc = PERSONALITY_DESCRIPTIONS[personality] || "";
    kb.text(`${emojiMap[personality]} ${short} - ${desc}`, `pers:${personality}`);
    kb.row();
  }
  return kb;
}

function buildModeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⚡ Quick Preset", "mode:preset")
    .row()
    .text("🛠 Custom Setup", "mode:custom")
    .row()
    .text("🎲 Surprise Me", "mode:random");
}

function buildPresetKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const preset of ONBOARDING_PRESETS) {
    kb.text(`${preset.emoji} ${preset.label}`, `preset:${preset.id}`);
    kb.row();
  }
  kb.text("⬅ Back", "preset:back");
  return kb;
}

function buildNameKeyboard(defaultName?: string): InlineKeyboard {
  const unique = new Set<string>();
  const names: string[] = [];

  const normalizedDefault = defaultName ? sanitizeNameInput(defaultName) : "";
  if (normalizedDefault) {
    names.push(normalizedDefault);
    unique.add(normalize(normalizedDefault));
  }

  for (const candidate of NAME_SUGGESTIONS) {
    const key = normalize(candidate);
    if (unique.has(key)) continue;
    unique.add(key);
    names.push(candidate);
    if (names.length >= 8) break;
  }

  const kb = new InlineKeyboard();
  for (let i = 0; i < names.length; i += 1) {
    kb.text(names[i]!, `name:${names[i]}`);
    if ((i + 1) % 2 === 0 && i < names.length - 1) kb.row();
  }

  kb.row().text("✍️ Type custom", "name:custom").text("🎲 Random", "name:random");
  return kb;
}

function buildAgeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("18", "age:18")
    .text("21", "age:21")
    .text("24", "age:24")
    .row()
    .text("27", "age:27")
    .text("30", "age:30")
    .text("35", "age:35")
    .row()
    .text("✍️ Type custom", "age:custom")
    .text("🎲 Random", "age:random");
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

function makeRandomDraft(name?: string): SetupDraft {
  const cleanName = sanitizeNameInput(name || "") || pickRandom(NAME_SUGGESTIONS);
  return {
    name: cleanName,
    age: 18 + Math.floor(Math.random() * 13),
    race: pickRandom(RACES),
    bodyType: pickRandom(BODY_TYPES),
    hairColor: pickRandom(HAIR_COLORS),
    hairStyle: pickRandom(HAIR_STYLES),
    eyeColor: pickRandom(EYE_COLORS),
    personality: pickRandom(PERSONALITIES),
  };
}

async function waitForInput(conversation: SetupConversation): Promise<BotContext> {
  return conversation.waitFor(["callback_query:data", "message:text"]);
}

function isCancelText(text?: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return normalized === "/cancel" || normalized === "cancel";
}

async function ensureNotCancelled(input: BotContext, ctx: BotContext): Promise<void> {
  if (!isCancelText(input.message?.text)) return;
  await ctx.reply("Setup cancelled. Send /start or /remake whenever you want to try again.");
  throw new SetupCancelledError();
}

async function askSetupMode(
  conversation: SetupConversation,
  ctx: BotContext
): Promise<SetupMode> {
  await ctx.reply(
    `${renderStep(1, 9, "Choose setup style")}\nUse buttons for the fastest setup.`,
    { reply_markup: buildModeKeyboard() }
  );

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;
    if (data?.startsWith("mode:")) {
      await answerCb(input);
      const mode = data.replace("mode:", "") as SetupMode;
      if (mode === "preset" || mode === "custom" || mode === "random") {
        return mode;
      }
    }

    if (input.message?.text) {
      const text = normalize(input.message.text);
      if (text.includes("preset") || text.includes("quick")) return "preset";
      if (text.includes("custom")) return "custom";
      if (text.includes("random") || text.includes("surprise")) return "random";
    }

    await ctx.reply("Choose one option: Quick Preset, Custom Setup, or Surprise Me.");
  }
}

async function askPreset(
  conversation: SetupConversation,
  ctx: BotContext
): Promise<OnboardingPreset | null> {
  await ctx.reply(
    `${renderStep(2, 9, "Pick a preset")}\nEach preset includes full look + personality.`,
    { reply_markup: buildPresetKeyboard() }
  );

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;
    if (!data) {
      await ctx.reply("Tap one of the preset buttons.");
      continue;
    }

    await answerCb(input);
    if (data === "preset:back") return null;
    if (data.startsWith("preset:")) {
      const id = data.replace("preset:", "");
      const preset = getOnboardingPreset(id);
      if (preset) return preset;
    }

    await ctx.reply("Please pick a preset from the buttons above.");
  }
}

async function askName(
  conversation: SetupConversation,
  ctx: BotContext,
  stepNumber: number,
  defaultName?: string
): Promise<string> {
  await ctx.reply(
    `${renderStep(stepNumber, 9, "Choose a name")}\nPick a name or type your own.`,
    { reply_markup: buildNameKeyboard(defaultName) }
  );

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;

    if (data?.startsWith("name:")) {
      await answerCb(input);
      const value = data.replace("name:", "");
      if (value === "random") return pickRandom(NAME_SUGGESTIONS);
      if (value === "custom") {
        await ctx.reply("Type the name you want (max 30 chars).");
        const custom = await conversation.waitFor("message:text");
        await ensureNotCancelled(custom, ctx);
        const typed = sanitizeNameInput(custom.message.text);
        if (typed) return typed;
        await ctx.reply("That name was invalid. Pick a button or type a shorter name.");
        continue;
      }
      const selected = sanitizeNameInput(value);
      if (selected) return selected;
    }

    if (input.message?.text) {
      const typed = sanitizeNameInput(input.message.text);
      if (typed) return typed;
    }

    await ctx.reply("Pick a name from buttons or type one manually.");
  }
}

async function askAge(
  conversation: SetupConversation,
  ctx: BotContext
): Promise<number> {
  await ctx.reply(
    `${renderStep(3, 9, "Choose age (18+)")}\nSelect a button or type a number.`,
    { reply_markup: buildAgeKeyboard() }
  );

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;

    if (data?.startsWith("age:")) {
      await answerCb(input);
      const value = data.replace("age:", "");
      if (value === "random") return 18 + Math.floor(Math.random() * 13);
      if (value === "custom") {
        await ctx.reply("Type an age between 18 and 80.");
        const custom = await conversation.waitFor("message:text");
        await ensureNotCancelled(custom, ctx);
        const parsed = Number.parseInt(custom.message.text.trim(), 10);
        if (Number.isFinite(parsed) && parsed >= 18 && parsed <= 80) return parsed;
        await ctx.reply("Invalid age. Use 18-80.");
        continue;
      }

      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed >= 18 && parsed <= 80) return parsed;
    }

    if (input.message?.text) {
      const parsed = Number.parseInt(input.message.text.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 18 && parsed <= 80) return parsed;
    }

    await ctx.reply("Choose a valid age (18-80).");
  }
}

async function editAppearanceDraft(
  conversation: SetupConversation,
  ctx: BotContext,
  draft: SetupDraft
): Promise<void> {
  draft.race = await askOption(conversation, ctx, 0, "Edit race", RACES, "race");
  draft.bodyType = await askOption(conversation, ctx, 0, "Edit body type", BODY_TYPES, "body");
  draft.hairColor = await askOption(conversation, ctx, 0, "Edit hair color", HAIR_COLORS, "hair");
  draft.hairStyle = await askOption(
    conversation,
    ctx,
    0,
    "Edit hair style",
    HAIR_STYLES,
    "style"
  );
  draft.eyeColor = await askOption(conversation, ctx, 0, "Edit eye color", EYE_COLORS, "eye");
}

async function askOption<T extends string>(
  conversation: SetupConversation,
  ctx: BotContext,
  stepNumber: number,
  title: string,
  options: readonly T[],
  prefix: string,
  cols = 3
): Promise<T> {
  const kb = buildGrid(options, prefix, cols).row().text("🎲 Random", `${prefix}:random`);
  await ctx.reply(`${renderStep(stepNumber, 9, title)}\nChoose one option.`, {
    reply_markup: kb,
  });

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;
    if (data?.startsWith(`${prefix}:`)) {
      await answerCb(input);
      const value = data.replace(`${prefix}:`, "");
      if (value === "random") return pickRandom(options);
      const option = toAllowedOption(value, options);
      if (option) return option;
    }

    if (input.message?.text) {
      const option = toAllowedOption(input.message.text, options);
      if (option) return option;
    }

    await ctx.reply("Use one of the buttons above.");
  }
}

async function askPersonality(
  conversation: SetupConversation,
  ctx: BotContext
): Promise<Personality> {
  await ctx.reply(
    `${renderStep(9, 9, "Choose personality")}\nThis controls her chat style.`,
    { reply_markup: buildPersonalityKeyboard() }
  );

  while (true) {
    const input = await waitForInput(conversation);
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery?.data;
    if (data?.startsWith("pers:")) {
      await answerCb(input);
      const value = data.replace("pers:", "");
      const personality = toAllowedOption(value, PERSONALITIES);
      if (personality) return personality;
    }

    if (input.message?.text) {
      const personality = toAllowedOption(input.message.text, PERSONALITIES);
      if (personality) return personality;
    }

    await ctx.reply("Choose one personality option from the list.");
  }
}

async function confirmDraft(
  conversation: SetupConversation,
  ctx: BotContext,
  draft: SetupDraft
): Promise<"generate" | "restart"> {
  while (true) {
    const kb = new InlineKeyboard()
      .text("✅ Generate", "draft:generate")
      .row()
      .text("✏️ Edit Name", "draft:edit_name")
      .text("✏️ Edit Age", "draft:edit_age")
      .row()
      .text("✏️ Edit Look", "draft:edit_look")
      .text("✏️ Edit Personality", "draft:edit_personality")
      .row()
      .text("🎲 Randomize all", "draft:random")
      .text("🔁 Start over", "draft:restart");

    await ctx.reply(`${buildDraftSummary(draft)}\n\nGenerate this profile?`, {
      reply_markup: kb,
    });

    const input = await conversation.waitFor("callback_query:data");
    await ensureNotCancelled(input, ctx);
    const data = input.callbackQuery.data;
    await answerCb(input);

    if (data === "draft:generate") return "generate";
    if (data === "draft:restart") return "restart";
    if (data === "draft:edit_name") {
      draft.name = await askName(conversation, ctx, 0, draft.name);
      continue;
    }
    if (data === "draft:edit_age") {
      draft.age = await askAge(conversation, ctx);
      continue;
    }
    if (data === "draft:edit_look") {
      await editAppearanceDraft(conversation, ctx, draft);
      continue;
    }
    if (data === "draft:edit_personality") {
      draft.personality = await askPersonality(conversation, ctx);
      continue;
    }
    if (data === "draft:random") {
      const rerolled = makeRandomDraft(draft.name);
      draft.age = rerolled.age;
      draft.race = rerolled.race;
      draft.bodyType = rerolled.bodyType;
      draft.hairColor = rerolled.hairColor;
      draft.hairStyle = rerolled.hairStyle;
      draft.eyeColor = rerolled.eyeColor;
      draft.personality = rerolled.personality;
      await ctx.reply(`Updated summary:\n\n${buildDraftSummary(draft)}`);
    }
  }
}

const REROLL_MESSAGES = [
  "Generating another preview...",
  "Trying a new variation...",
  "Rerolling look...",
];

export async function girlfriendSetupClassic(conversation: SetupConversation, ctx: BotContext) {
  const telegramId = ctx.from!.id;

  try {
    const mode = await askSetupMode(conversation, ctx);

    let draft: SetupDraft;

    if (mode === "preset") {
      const preset = await askPreset(conversation, ctx);
      if (!preset) {
        return girlfriendSetupClassic(conversation, ctx);
      }

      const name = await askName(conversation, ctx, 3, preset.name);
      draft = {
        name: sanitizeNameInput(name) || sanitizeNameInput(preset.name) || pickRandom(NAME_SUGGESTIONS),
        age: preset.age,
        race: preset.race,
        bodyType: preset.bodyType,
        hairColor: preset.hairColor,
        hairStyle: preset.hairStyle,
        eyeColor: preset.eyeColor,
        personality: preset.personality,
      };
    } else if (mode === "random") {
      const name = await askName(conversation, ctx, 2, pickRandom(NAME_SUGGESTIONS));
      draft = makeRandomDraft(sanitizeNameInput(name));
      await ctx.reply("Randomized profile generated. You can still review before creating.");
    } else {
      const name = await askName(conversation, ctx, 2);
      const age = await askAge(conversation, ctx);
      const safeAge = Math.max(18, Math.min(80, age));
      const race = await askOption(conversation, ctx, 4, "Choose race", RACES, "race");
      const bodyType = await askOption(
        conversation,
        ctx,
        5,
        "Choose body type",
        BODY_TYPES,
        "body"
      );
      const hairColor = await askOption(
        conversation,
        ctx,
        6,
        "Choose hair color",
        HAIR_COLORS,
        "hair"
      );
      const hairStyle = await askOption(
        conversation,
        ctx,
        7,
        "Choose hair style",
        HAIR_STYLES,
        "style"
      );
      const eyeColor = await askOption(
        conversation,
        ctx,
        8,
        "Choose eye color",
        EYE_COLORS,
        "eye"
      );
      const personality = await askPersonality(conversation, ctx);
      draft = {
        name: sanitizeNameInput(name) || pickRandom(NAME_SUGGESTIONS),
        age: safeAge,
        race,
        bodyType,
        hairColor,
        hairStyle,
        eyeColor,
        personality,
      };
    }

    const confirmation = await confirmDraft(conversation, ctx, draft);
    if (confirmation === "restart") {
      await ctx.reply("Restarting setup...");
      return girlfriendSetupClassic(conversation, ctx);
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

    await ctx.reply("Generating profile image...");

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

    const confirmKb = new InlineKeyboard()
      .text("✅ Use this profile", "confirm:yes")
      .row()
      .text(`🔄 Re-roll (${CREDIT_COSTS.IMAGE_PRO} credits)`, "confirm:reroll")
      .row()
      .text("🛠 Restart setup", "confirm:restart");

    await ctx.replyWithPhoto(imageUrl, {
      caption: `${buildDraftSummary(draft)}\n\nUse this profile image?`,
      reply_markup: confirmKb,
    });

    let rerollCount = 0;
    while (true) {
      const input = await waitForInput(conversation);
      await ensureNotCancelled(input, ctx);
      const data = input.callbackQuery?.data;
      if (!data) {
        await ctx.reply("Use one of the image action buttons.");
        continue;
      }

      const action = data.replace("confirm:", "");
      await answerCb(input);

      if (action === "yes") {
        await convex.confirmProfile(telegramId, imageUrl);
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

      if (action === "restart") {
        await ctx.reply("Restarting setup...");
        return girlfriendSetupClassic(conversation, ctx);
      }

      if (action !== "reroll") {
        await ctx.reply("Use one of the buttons below the image.");
        continue;
      }

      if (!env.FREE_MODE) {
        const balance = await convex.getBalance(telegramId);
        if (balance < CREDIT_COSTS.IMAGE_PRO) {
          await ctx.reply(
            `Not enough credits to reroll.\nRequired: ${CREDIT_COSTS.IMAGE_PRO}\nCurrent: ${balance}\nUse /buy to top up.`
          );
          continue;
        }
      }

      rerollCount += 1;
      await ctx.reply(pickRandom(REROLL_MESSAGES));

      try {
        const generated = await generateReferenceWithVariation(basePrompt, rerollCount);

        if (!env.FREE_MODE) {
          await convex.spendCredits({
            telegramId,
            amount: CREDIT_COSTS.IMAGE_PRO,
            service: "fal.ai",
            model: "flux-2-pro",
            falCostUsd: 0.03,
          });
        }

        imageUrl = generated.url;

        await ctx.replyWithPhoto(imageUrl, {
          caption: `${buildDraftSummary(draft)}\n\nUpdated image preview.`,
          reply_markup: confirmKb,
        });
      } catch {
        await ctx.reply("Reroll failed. Try again or use current image.");
      }
    }
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      return;
    }
    throw error;
  }
}

const INITIAL_CONTACT_LINES = [
  "hey stranger... wasn't sure if I should message you first lol",
  "honestly kinda nervous, what do I even say? 😅",
];

const PHASE_TWO_START = "so what kinda girl are you usually into? just curious 👀";

const CLARIFY_BY_FIELD: Record<string, string> = {
  personality: "quick question... personality-wise, what vibe do you like most?",
  hairColor: "wait you didn't tell me... do you prefer blondes or brunettes?",
  bodyType: "and body type-wise, what are you into?",
};

function shouldReroll(text: string): boolean {
  const normalized = normalize(text);
  return (
    normalized.includes("reroll") ||
    normalized.includes("different") ||
    normalized.includes("another") ||
    normalized.includes("again") ||
    normalized.includes("change")
  );
}

function soundsLikeApproval(text: string): boolean {
  const normalized = normalize(text);
  return (
    normalized.includes("yes") ||
    normalized.includes("looks good") ||
    normalized.includes("perfect") ||
    normalized.includes("keep") ||
    normalized.includes("love it") ||
    normalized.includes("good")
  );
}

function toConversationText(history: string[]): string {
  return history.slice(-16).join("\n");
}

async function generateOnboardingReply(
  history: string[],
  extracted: Partial<ExtractedPreferences>,
  missing: string[]
): Promise<string> {
  const alreadyKnown = Object.entries(extracted)
    .filter(([k, v]) => v && k !== "confidence")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const system = [
    "You are a flirty, natural girlfriend texting during onboarding.",
    "Reply with one casual text message, max 2 short sentences.",
    "Do not use lists or JSON.",
    "Sound human, lowercase is fine, max one emoji.",
    "Your goal is to gently steer the user into sharing missing preferences.",
    "IMPORTANT: Do NOT ask about things already known. Do NOT repeat previous questions.",
    "Only ask about the FIRST missing field listed below.",
  ].join(" ");

  const user = [
    `Already known (DO NOT ask about these): ${alreadyKnown || "nothing yet"}`,
    `Still missing (ask about the FIRST one only): ${missing.join(", ") || "none"}`,
    "Recent chat:",
    toConversationText(history),
    "Write the next single message from her. Do not re-ask anything from the chat above.",
  ].join("\n");

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 80,
      temperature: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.3,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) {
      if (missing.length > 0) {
        return "tell me your type a little more... i'm trying to picture her";
      }
      return "okay i'm kinda getting the vibe now 😌";
    }

    return reply.replace(/\n+/g, " ").trim();
  } catch {
    if (missing.includes("hairColor")) {
      return "i still need one detail... blondes or brunettes?";
    }
    if (missing.includes("bodyType")) {
      return "what body type do you usually go for?";
    }
    if (missing.includes("personality")) {
      return "what personality pulls you in most?";
    }
    return "okay i'm listening... keep going";
  }
}

async function waitForTextMessage(conversation: SetupConversation, ctx: BotContext): Promise<string> {
  while (true) {
    const input = await conversation.waitFor("message:text");
    await ensureNotCancelled(input, ctx);
    const text = input.message.text?.trim();
    if (text) return text;
  }
}

async function runNaturalDiscovery(
  conversation: SetupConversation,
  ctx: BotContext,
  history: string[],
  extracted: ExtractedPreferences
): Promise<ExtractedPreferences> {
  await ctx.reply(PHASE_TWO_START);
  history.push(`girlfriend: ${PHASE_TWO_START}`);

  const firstReply = await waitForTextMessage(conversation, ctx);
  history.push(`user: ${firstReply}`);
  let current = await conversation.external(() => extractPreferences(history, extracted));

  for (let i = 0; i < 3; i += 1) {
    const missing = getMissingCriticalFields(current);
    if (missing.length === 0) {
      break;
    }

    const botReply = await conversation.external(() =>
      generateOnboardingReply(history, current, missing)
    );
    await ctx.reply(botReply);
    history.push(`girlfriend: ${botReply}`);

    const userReply = await waitForTextMessage(conversation, ctx);
    history.push(`user: ${userReply}`);

    current = await conversation.external(() => extractPreferences(history, current));
  }

  return current;
}

async function clarifyMissingCritical(
  conversation: SetupConversation,
  ctx: BotContext,
  history: string[],
  extracted: ExtractedPreferences
): Promise<ExtractedPreferences> {
  let current = extracted;
  const missing = getMissingCriticalFields(current);

  for (const field of missing.slice(0, 3)) {
    const question = CLARIFY_BY_FIELD[field] || "wait, tell me a little more about your type";
    await ctx.reply(question);
    history.push(`girlfriend: ${question}`);

    const userReply = await waitForTextMessage(conversation, ctx);
    history.push(`user: ${userReply}`);
    current = await conversation.external(() => extractPreferences(history, current));

    if (getMissingCriticalFields(current).length === 0) {
      break;
    }
  }

  return current;
}

export async function girlfriendSetup(conversation: SetupConversation, ctx: BotContext) {
  const telegramId = ctx.from!.id;

  try {
    const history: string[] = [];
    let extracted: ExtractedPreferences = { confidence: 0 };

    await ctx.reply(INITIAL_CONTACT_LINES[0]!);
    history.push(`girlfriend: ${INITIAL_CONTACT_LINES[0]}`);
    await ctx.reply(INITIAL_CONTACT_LINES[1]!);
    history.push(`girlfriend: ${INITIAL_CONTACT_LINES[1]}`);

    const firstUserReply = await waitForTextMessage(conversation, ctx);
    history.push(`user: ${firstUserReply}`);
    extracted = await conversation.external(() => extractPreferences(history, extracted));

    extracted = await runNaturalDiscovery(conversation, ctx, history, extracted);
    extracted = await clarifyMissingCritical(conversation, ctx, history, extracted);

    const draft = prefsToSetupDraft(extracted);

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

    await ctx.reply("okay fine, you win... *sends photo*");

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
      caption: buildDraftSummary(draft),
    });

    await ctx.reply("want me to try a different look?");

    let rerollCount = 0;
    while (true) {
      const response = await waitForTextMessage(conversation, ctx);
      history.push(`user: ${response}`);

      if (shouldReroll(response)) {
        if (!env.FREE_MODE) {
          const balance = await convex.getBalance(telegramId);
          if (balance < CREDIT_COSTS.IMAGE_PRO) {
            await ctx.reply(
              `Not enough credits to reroll. Required: ${CREDIT_COSTS.IMAGE_PRO}, current: ${balance}.`
            );
            continue;
          }
        }

        rerollCount += 1;
        await ctx.reply(pickRandom(REROLL_MESSAGES));
        try {
          const generated = await generateReferenceWithVariation(basePrompt, rerollCount);

          if (!env.FREE_MODE) {
            await convex.spendCredits({
              telegramId,
              amount: CREDIT_COSTS.IMAGE_PRO,
              service: "fal.ai",
              model: "flux-2-pro",
              falCostUsd: 0.03,
            });
          }

          imageUrl = generated.url;
          await ctx.replyWithPhoto(imageUrl, {
            caption: `${buildDraftSummary(draft)}\n\nupdated preview.`,
          });
          await ctx.reply("okay... this one or another reroll?");
        } catch {
          await ctx.reply("Reroll failed. Want to keep this one?");
        }
        continue;
      }

      if (soundsLikeApproval(response)) {
        break;
      }

      await ctx.reply("if you want another, say 'reroll'. if you're good, say 'yes'.");
    }

    await ctx.reply("sooo... are we doing this? 💕", {
      reply_markup: new InlineKeyboard().text("💞 yes, let's do this", "confirm:yes"),
    });

    while (true) {
      const input = await conversation.waitFor(["callback_query:data", "message:text"]);
      await ensureNotCancelled(input, ctx);

      if (input.callbackQuery?.data === "confirm:yes") {
        await answerCb(input);
        await convex.confirmProfile(telegramId, imageUrl);
        await ctx.reply(
          "Profile confirmed.\n\nCommands:\n/selfie - request image\n/remake - rebuild profile\n/help - full command list"
        );
        await ctx.reply(getFirstMessage(draft.personality, draft.name));

        try {
          const bot = { api: ctx.api };
          startWelcomeSequence(bot, telegramId);
          void checkAndRecordAutoEvent(convex, telegramId, "first_meet", {
            source: "onboarding_complete",
          });
        } catch {}

        return;
      }

      const text = input.message?.text;
      if (text && soundsLikeApproval(text)) {
        await ctx.reply("tap the confirm button so we can lock this in 💕");
      } else {
        await ctx.reply("tap the button when you're ready 💕");
      }
    }
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      return;
    }
    throw error;
  }
}
