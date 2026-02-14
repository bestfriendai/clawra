import { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import {
  RACES, BODY_TYPES, HAIR_COLORS, HAIR_STYLES,
  PERSONALITIES, NAME_SUGGESTIONS,
} from "../../config/girlfriend-options.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { convex } from "../../services/convex.js";
import { generateImage, editImageSFW } from "../../services/fal.js";
import { buildReferencePrompt } from "../../services/girlfriend-prompt.js";
import { env } from "../../config/env.js";

type SetupConversation = Conversation<BotContext>;

function buildGrid(items: readonly string[], prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < items.length; i++) {
    kb.text(items[i], `${prefix}:${items[i]}`);
    if ((i + 1) % 3 === 0 && i < items.length - 1) kb.row();
  }
  return kb;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function answerCb(ctx: BotContext): Promise<void> {
  try { await ctx.answerCallbackQuery(); } catch { /* ignore */ }
}

export async function girlfriendSetup(
  conversation: SetupConversation,
  ctx: BotContext
) {
  const telegramId = ctx.from!.id;

  // Step 1: Name
  const nameKb = new InlineKeyboard();
  for (const name of NAME_SUGGESTIONS) {
    nameKb.text(name, `name:${name}`);
  }
  nameKb.row().text("Randomize Everything", "name:random");

  await ctx.reply(
    "Let's create your AI girlfriend!\n\nChoose a name or type one:",
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
    name = nameCtx.message!.text!;
  }

  let age: number;
  let race: string;
  let bodyType: string;
  let hairColor: string;
  let hairStyle: string;
  let personality: string;

  if (isRandom) {
    age = 18 + Math.floor(Math.random() * 13);
    race = pickRandom(RACES);
    bodyType = pickRandom(BODY_TYPES);
    hairColor = pickRandom(HAIR_COLORS);
    hairStyle = pickRandom(HAIR_STYLES);
    personality = pickRandom(PERSONALITIES);

    await ctx.reply(
      `Randomized!\n\n` +
      `Name: ${name}\nAge: ${age}\nAppearance: ${race}\n` +
      `Body: ${bodyType}\nHair: ${hairColor} ${hairStyle}\n` +
      `Personality: ${personality}\n\n` +
      `Generating her first photo...`
    );
  } else {
    // Step 2: Age
    const ageKb = new InlineKeyboard()
      .text("18", "age:18").text("21", "age:21").text("25", "age:25")
      .row()
      .text("28", "age:28").text("30", "age:30").text("35", "age:35");

    await ctx.reply(`Great name! How old is ${name}? (18+)`, {
      reply_markup: ageKb,
    });

    while (true) {
      const ageCtx = await conversation.waitFor(["callback_query:data", "message:text"]);
      if (ageCtx.callbackQuery?.data) {
        age = parseInt(ageCtx.callbackQuery.data.replace("age:", ""));
        await answerCb(ageCtx);
      } else {
        age = parseInt(ageCtx.message!.text!);
      }
      if (!isNaN(age) && age >= 18) break;
      await ctx.reply("Please enter a valid age (18 or older):");
    }

    // Step 3: Race
    await ctx.reply("What's her appearance?", {
      reply_markup: buildGrid(RACES, "race"),
    });
    const raceCtx = await conversation.waitFor("callback_query:data");
    race = raceCtx.callbackQuery.data.replace("race:", "");
    await answerCb(raceCtx);

    // Step 4: Body Type
    await ctx.reply("Body type?", {
      reply_markup: buildGrid(BODY_TYPES, "body"),
    });
    const bodyCtx = await conversation.waitFor("callback_query:data");
    bodyType = bodyCtx.callbackQuery.data.replace("body:", "");
    await answerCb(bodyCtx);

    // Step 5: Hair Color
    await ctx.reply("Hair color?", {
      reply_markup: buildGrid(HAIR_COLORS, "hair"),
    });
    const hairCtx = await conversation.waitFor("callback_query:data");
    hairColor = hairCtx.callbackQuery.data.replace("hair:", "");
    await answerCb(hairCtx);

    // Step 5b: Hair Style
    await ctx.reply("Hair style?", {
      reply_markup: buildGrid(HAIR_STYLES, "style"),
    });
    const styleCtx = await conversation.waitFor("callback_query:data");
    hairStyle = styleCtx.callbackQuery.data.replace("style:", "");
    await answerCb(styleCtx);

    // Step 6: Personality
    await ctx.reply("Her personality?", {
      reply_markup: buildGrid(PERSONALITIES, "pers"),
    });
    const persCtx = await conversation.waitFor("callback_query:data");
    personality = persCtx.callbackQuery.data.replace("pers:", "");
    await answerCb(persCtx);

    await ctx.reply("Generating her first photo...");
  }

  // Save draft profile to Convex
  await convex.createProfile({
    telegramId,
    name,
    age: age!,
    race: race!,
    bodyType: bodyType!,
    hairColor: hairColor!,
    hairStyle: hairStyle!,
    personality: personality!,
  });

  // Generate reference image
  const prompt = buildReferencePrompt({
    age: age!,
    race: race!,
    bodyType: bodyType!,
    hairColor: hairColor!,
    hairStyle: hairStyle!,
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
      "Sorry, image generation failed. Please try again with /remake.\n" +
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`
    );
    return;
  }

  // Send the generated photo
  const confirmKb = new InlineKeyboard()
    .text("She's perfect!", "confirm:yes")
    .row()
    .text(`Re-roll (${CREDIT_COSTS.IMAGE_PRO} credits)`, "confirm:reroll")
    .row()
    .text("Start over", "confirm:restart");

  await ctx.replyWithPhoto(imageUrl, {
    caption: `Meet ${name}!\n\n${age} years old | ${race} | ${bodyType}\n${hairColor} ${hairStyle} hair | ${personality}`,
    reply_markup: confirmKb,
  });

  // Wait for confirmation
  while (true) {
    const confirmCtx = await conversation.waitFor("callback_query:data");
    const action = confirmCtx.callbackQuery.data.replace("confirm:", "");
    await answerCb(confirmCtx);

    if (action === "yes") {
      await convex.confirmProfile(telegramId, imageUrl);
      await ctx.reply(
        `${name} is all set!\n\n` +
        `Just send her a message to start chatting.\n` +
        `Use /selfie to request a selfie.\n` +
        `Use /buy to get more credits.\n\n` +
        `Have fun!`
      );
      return;
    } else if (action === "reroll") {
      if (!env.FREE_MODE) {
        const balance = await convex.getBalance(telegramId);
        if (balance < CREDIT_COSTS.IMAGE_PRO) {
          await ctx.reply(
            `Not enough credits! You need ${CREDIT_COSTS.IMAGE_PRO} credits.\n` +
            `Current balance: ${balance}\n\nUse /buy to get more credits.`
          );
          continue;
        }
      }

      await ctx.reply("Generating a new look...");
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
        const normalized = await editImageSFW(
          result.url,
          `Casual selfie of this exact person. Shot on iPhone, natural lighting, candid casual photo, real camera roll quality.`
        );
        imageUrl = normalized.url;
        await ctx.replyWithPhoto(imageUrl, {
          caption: `How about this?`,
          reply_markup: confirmKb,
        });
      } catch {
        await ctx.reply("Image generation failed. Try again or pick 'She's perfect!'");
      }
    } else if (action === "restart") {
      await ctx.reply("Starting over! Let's try again.");
      return await girlfriendSetup(conversation, ctx);
    }
  }
}
