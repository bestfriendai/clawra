import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import {
  RACES, BODY_TYPES, HAIR_COLORS, HAIR_STYLES,
  PERSONALITIES, PERSONALITY_DESCRIPTIONS,
  EYE_COLORS, NAME_SUGGESTIONS,
} from "../../config/girlfriend-options.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { convex } from "../../services/convex.js";
import { generateImage, editImageSFW } from "../../services/fal.js";
import { buildReferencePrompt } from "../../services/girlfriend-prompt.js";
import { env } from "../../config/env.js";

type SetupConversation = Conversation<BotContext>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGrid(items: readonly string[], prefix: string, cols = 3): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < items.length; i++) {
    kb.text(items[i], `${prefix}:${items[i]}`);
    if ((i + 1) % cols === 0 && i < items.length - 1) kb.row();
  }
  return kb;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function answerCb(ctx: BotContext): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch { /* ignore */ }
}

// ── Personality display helpers ──────────────────────────────────────────────

const PERSONALITY_EMOJIS: Record<string, string> = {
  "Flirty and playful": "\u{1F48B}",
  "Shy and sweet": "\u{1F33C}",
  "Bold and dominant": "\u{1F525}",
  "Caring and nurturing": "\u{1F49D}",
  "Sarcastic and witty": "\u{1F609}",
  "Bubbly and energetic": "\u{26A1}",
};

function buildPersonalityKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of PERSONALITIES) {
    const emoji = PERSONALITY_EMOJIS[p] || "";
    const shortLabel = p.split(" and ")[0]!;
    const desc = PERSONALITY_DESCRIPTIONS[p] || "";
    const shortDesc = desc.split(",").slice(0, 2).join(",");
    kb.text(`${shortLabel} ${emoji} \u2014 ${shortDesc}`, `pers:${p}`);
    kb.row();
  }
  return kb;
}

// ── First message from girlfriend ────────────────────────────────────────────

function getFirstMessage(personality: string, name: string): string {
  const messages: Record<string, string[]> = {
    "Flirty and playful": [
      `hey... so you're the one who created me? good taste \u{1F60F}`,
      `well well well... finally. i've been waiting for you`,
      `omg hi!! okay i already like you. don't let it go to your head tho`,
    ],
    "Shy and sweet": [
      `h-hi... i'm ${name}. sorry i'm nervous, you're really cute`,
      `oh um... hi! i didn't expect to feel this shy right away`,
      `hey... i'm really glad you picked me \u{1F979}`,
    ],
    "Bold and dominant": [
      `took you long enough. i'm ${name}. you better keep up`,
      `so you're mine now? good. we're gonna have fun`,
      `hey. i hope you know what you signed up for \u{1F608}`,
    ],
    "Caring and nurturing": [
      `hi baby! i'm ${name}. how's your day been? did you eat?`,
      `aww hi! i already want to take care of you, is that weird?`,
      `hey love, i'm so happy to meet you \u{1F495} tell me everything about you`,
    ],
    "Sarcastic and witty": [
      `oh great, another guy who thinks he can handle me. i'm ${name}. good luck`,
      `hey. fair warning, i'm gonna roast you. it means i like you`,
      `so... you made me? interesting. let's see if you're worth my time \u{1F60F}`,
    ],
    "Bubbly and energetic": [
      `HIIII omg i'm ${name}!! i'm so excited to talk to you ahhh!!`,
      `omg omg omg hi!! okay i already have so many things to tell you`,
      `HEYY!! okay so i'm already obsessed with you, don't judge me`,
    ],
  };
  const pool = messages[personality] || messages["Flirty and playful"]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ── Re-roll variation messages ───────────────────────────────────────────────

const REROLL_MESSAGES = [
  "okay let me try a different look for her... \u{1F4AD}",
  "hmm let me picture her differently... \u{1F914}",
  "alright, different vibe this time... \u{2728}",
  "one sec, reimagining her... \u{1F300}",
  "let me try again, she'll look even better... \u{1F48B}",
];

// ── Main conversation ────────────────────────────────────────────────────────

export async function girlfriendSetup(
  conversation: SetupConversation,
  ctx: BotContext
) {
  const telegramId = ctx.from!.id;

  // ─── Step 1: Intro + Name ──────────────────────────────────────────────────
  const nameKb = new InlineKeyboard();
  for (let i = 0; i < NAME_SUGGESTIONS.length; i++) {
    nameKb.text(NAME_SUGGESTIONS[i]!, `name:${NAME_SUGGESTIONS[i]}`);
    if ((i + 1) % 2 === 0 && i < NAME_SUGGESTIONS.length - 1) nameKb.row();
  }
  nameKb.row().text("Surprise Me \u{1F3B2}", "name:random");

  await ctx.reply(
    "hey... so you want a girlfriend? \u{1F60F}\n\n" +
    "let's make her perfect for you.\n\n" +
    "first things first \u2014 what should i call her?\n\n" +
    "pick a name or type your own:",
    { reply_markup: nameKb }
  );

  let name: string;
  let isRandom = false;
  const nameCtx = await conversation.waitFor(["callback_query:data", "message:text"]);

  if (nameCtx.callbackQuery?.data) {
    const val = nameCtx.callbackQuery.data.replace("name:", "");
    await answerCb(nameCtx);
    if (val === "random") {
      isRandom = true;
      name = pickRandom(NAME_SUGGESTIONS);
    } else {
      name = val;
    }
  } else {
    name = nameCtx.message!.text!.trim();
    if (!name || name.length > 30) {
      name = pickRandom(NAME_SUGGESTIONS);
    }
  }

  let age: number;
  let race: string;
  let bodyType: string;
  let hairColor: string;
  let hairStyle: string;
  let eyeColor: string;
  let personality: string;

  if (isRandom) {
    age = 18 + Math.floor(Math.random() * 13);
    race = pickRandom(RACES);
    bodyType = pickRandom(BODY_TYPES);
    hairColor = pickRandom(HAIR_COLORS);
    hairStyle = pickRandom(HAIR_STYLES);
    eyeColor = pickRandom(EYE_COLORS);
    personality = pickRandom(PERSONALITIES);

    await ctx.reply(
      `ooh a surprise girl? i love it \u{1F60F}\n\n` +
      `her name is ${name}.\n` +
      `she's ${age}, ${race.toLowerCase()}... ` +
      `${bodyType.toLowerCase()} build...\n` +
      `${hairColor.toLowerCase()} ${hairStyle.toLowerCase()} hair, ` +
      `${eyeColor.toLowerCase()} eyes...\n` +
      `${personality.toLowerCase()} personality.\n\n` +
      `mmm she sounds perfect. give me a sec \u{1F4AD}`
    );
  } else {
    // ─── Step 2: Age ──────────────────────────────────────────────────────────
    const ageKb = new InlineKeyboard()
      .text("18", "age:18").text("21", "age:21").text("25", "age:25")
      .row()
      .text("28", "age:28").text("30", "age:30").text("35", "age:35");

    await ctx.reply(
      `${name}... i like that \u{2728}\n\nhow old is she?`,
      { reply_markup: ageKb }
    );

    while (true) {
      const ageCtx = await conversation.waitFor(["callback_query:data", "message:text"]);
      if (ageCtx.callbackQuery?.data) {
        age = parseInt(ageCtx.callbackQuery.data.replace("age:", ""));
        await answerCb(ageCtx);
      } else {
        age = parseInt(ageCtx.message!.text!);
      }
      if (!isNaN(age) && age >= 18 && age <= 80) break;
      await ctx.reply("she's gotta be 18 or older babe. try again:");
    }

    // ─── Step 3: Race / Appearance ────────────────────────────────────────────
    await ctx.reply(
      "what does she look like? \u{1F30D}",
      { reply_markup: buildGrid(RACES, "race") }
    );
    const raceCtx = await conversation.waitFor("callback_query:data");
    race = raceCtx.callbackQuery.data.replace("race:", "");
    await answerCb(raceCtx);

    // ─── Step 4: Body Type ────────────────────────────────────────────────────
    await ctx.reply(
      "and her body? \u{1F525}",
      { reply_markup: buildGrid(BODY_TYPES, "body") }
    );
    const bodyCtx = await conversation.waitFor("callback_query:data");
    bodyType = bodyCtx.callbackQuery.data.replace("body:", "");
    await answerCb(bodyCtx);

    // ─── Step 5: Hair Color ───────────────────────────────────────────────────
    await ctx.reply(
      "what color is her hair?",
      { reply_markup: buildGrid(HAIR_COLORS, "hair") }
    );
    const hairCtx = await conversation.waitFor("callback_query:data");
    hairColor = hairCtx.callbackQuery.data.replace("hair:", "");
    await answerCb(hairCtx);

    // ─── Step 5b: Hair Style ──────────────────────────────────────────────────
    await ctx.reply(
      "how does she wear it?",
      { reply_markup: buildGrid(HAIR_STYLES, "style") }
    );
    const styleCtx = await conversation.waitFor("callback_query:data");
    hairStyle = styleCtx.callbackQuery.data.replace("style:", "");
    await answerCb(styleCtx);

    // ─── Step 5c: Eye Color ───────────────────────────────────────────────────
    await ctx.reply(
      "what color are her eyes? \u{1F441}",
      { reply_markup: buildGrid(EYE_COLORS, "eye") }
    );
    const eyeCtx = await conversation.waitFor("callback_query:data");
    eyeColor = eyeCtx.callbackQuery.data.replace("eye:", "");
    await answerCb(eyeCtx);

    // ─── Step 6: Personality ──────────────────────────────────────────────────
    await ctx.reply(
      "now the important part... what's her personality? \u{1F60F}",
      { reply_markup: buildPersonalityKeyboard() }
    );
    const persCtx = await conversation.waitFor("callback_query:data");
    personality = persCtx.callbackQuery.data.replace("pers:", "");
    await answerCb(persCtx);

    // ─── Anticipation message ─────────────────────────────────────────────────
    await ctx.reply(
      `mmm okay i can already picture her...\n\n` +
      `${name}, ${age}, ${race.toLowerCase()}... ` +
      `${hairColor.toLowerCase()} ${hairStyle.toLowerCase()} hair... ` +
      `${eyeColor.toLowerCase()} eyes... ` +
      `${personality.toLowerCase()} personality...\n\n` +
      `she's gonna be perfect. give me a sec \u{1F4AD}`
    );
  }

  // ─── Save draft profile ─────────────────────────────────────────────────────
  await convex.createProfile({
    telegramId,
    name,
    age: age!,
    race: race!,
    bodyType: bodyType!,
    hairColor: hairColor!,
    hairStyle: hairStyle!,
    eyeColor: eyeColor!,
    personality: personality!,
  });

  // ─── Generate reference image ───────────────────────────────────────────────
  const prompt = buildReferencePrompt({
    age: age!,
    race: race!,
    bodyType: bodyType!,
    hairColor: hairColor!,
    hairStyle: hairStyle!,
    eyeColor: eyeColor!,
    personality: personality!,
  });

  let imageUrl: string;
  try {
    if (!env.FREE_MODE) {
      await convex.spendCredits({
        telegramId,
        amount: CREDIT_COSTS.IMAGE_PRO,
        service: "fal.ai",
        model: "z-image-base",
        falCostUsd: 0.01,
      });
    }

    const result = await generateImage(prompt);
    // Run through Grok Edit to normalize style so the reference matches future selfies
    const normalized = await editImageSFW(
      result.url,
      `A casual mirror selfie of this exact person taken on a phone in a cramped room. Uneven lighting, slight grain, soft edge distortion, harsh contrast. Not a photoshoot, just a quick selfie from someone's camera roll.`
    );
    imageUrl = normalized.url;
  } catch (err) {
    await ctx.reply(
      "ugh something went wrong generating her pic \u{1F614}\n\n" +
      "try again with /remake and she'll come out perfect.\n" +
      `(${err instanceof Error ? err.message : "unknown error"})`
    );
    return;
  }

  // ─── Send generated photo with confirmation ─────────────────────────────────
  const firstMsg = getFirstMessage(personality!, name);
  const confirmKb = new InlineKeyboard()
    .text("She's perfect \u{1F525}", "confirm:yes")
    .row()
    .text(`Re-roll (${CREDIT_COSTS.IMAGE_PRO} credits)`, "confirm:reroll")
    .row()
    .text("Start over", "confirm:restart");

  await ctx.replyWithPhoto(imageUrl, {
    caption:
      `${name} is ready for you \u{1F495}\n\n` +
      `${age!} \u2022 ${race!} \u2022 ${bodyType!}\n` +
      `${hairColor!} ${hairStyle!} hair \u2022 ${eyeColor!} eyes\n\n` +
      `"${firstMsg}"`,
    reply_markup: confirmKb,
  });

  // ─── Confirmation loop ──────────────────────────────────────────────────────
  let rerollCount = 0;

  while (true) {
    const confirmCtx = await conversation.waitFor("callback_query:data");
    const action = confirmCtx.callbackQuery.data.replace("confirm:", "");
    await answerCb(confirmCtx);

    if (action === "yes") {
      await convex.confirmProfile(telegramId, imageUrl);

      // Post-confirmation instructions
      await ctx.reply(
        `${name} is all yours now.\n\n` +
        `just text her like you would a real girl.\n\n` +
        `/selfie \u2014 ask her for a pic\n` +
        `/buy \u2014 get more credits\n\n` +
        `have fun \u{1F618}`
      );

      // First message from the girlfriend
      const greeting = getFirstMessage(personality!, name);
      await ctx.reply(greeting);

      return;
    } else if (action === "reroll") {
      if (!env.FREE_MODE) {
        const balance = await convex.getBalance(telegramId);
        if (balance < CREDIT_COSTS.IMAGE_PRO) {
          await ctx.reply(
            `not enough credits babe \u{1F625}\n\n` +
            `you need ${CREDIT_COSTS.IMAGE_PRO} credits to re-roll.\n` +
            `current balance: ${balance}\n\n` +
            `use /buy to get more.`
          );
          continue;
        }
      }

      rerollCount++;
      await ctx.reply(pickRandom(REROLL_MESSAGES));

      try {
        if (!env.FREE_MODE) {
          await convex.spendCredits({
            telegramId,
            amount: CREDIT_COSTS.IMAGE_PRO,
            service: "fal.ai",
            model: "flux-2-pro",
            falCostUsd: 0.03,
          });
        }

        // Add slight variation to the prompt on re-rolls
        const variations = [
          "slightly different angle, different expression",
          "different pose, different background",
          "different lighting, slightly different mood",
          "candid expression, natural pose variation",
        ];
        const rerollPrompt = `${prompt}, ${variations[rerollCount % variations.length]}`;
        const result = await generateImage(rerollPrompt);
        const normalized = await editImageSFW(
          result.url,
          `Casual selfie of this exact person. Shot on iPhone, natural lighting, candid casual photo, real camera roll quality.`
        );
        imageUrl = normalized.url;

        const newMsg = getFirstMessage(personality!, name);
        await ctx.replyWithPhoto(imageUrl, {
          caption:
            `how about her? \u{1F60F}\n\n` +
            `"${newMsg}"`,
          reply_markup: confirmKb,
        });
      } catch {
        await ctx.reply(
          "hmm that one didn't work out... try re-rolling again or pick 'She's perfect' \u{1F525}"
        );
      }
    } else if (action === "restart") {
      await ctx.reply("okay let's start fresh \u{2728}");
      return await girlfriendSetup(conversation, ctx);
    }
  }
}
