import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { env } from "../../config/env.js";

export const MAX_GIRLFRIENDS = 5;
export const NEW_GIRLFRIEND_COST = 50;

function buildSwitchKeyboard(profiles: any[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const profile of profiles) {
    const label = profile.isActive
      ? `💕 ${profile.name} (active) ✅`
      : `💤 ${profile.name}`;
    keyboard.text(label, `switch:${profile._id}`).row();
  }

  keyboard.text("➕ Create New Girlfriend", "switch:create");
  return keyboard;
}

function isVipUnlocked(ctx: BotContext): boolean {
  return (ctx.user?.tier || "").toLowerCase() === "vip";
}

export async function handleSwitch(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const profiles = await convex.getAllProfiles(telegramId);

  if (!profiles.length) {
    await ctx.reply(
      "You don't have a girlfriend yet. Tap below to create your first one 💕",
      {
        reply_markup: new InlineKeyboard().text(
          "➕ Create New Girlfriend",
          "switch:create"
        ),
      }
    );
    return;
  }

  await ctx.reply("Choose who you want to chat with right now:", {
    reply_markup: buildSwitchKeyboard(profiles),
  });
}

export async function handleSwitchCallback(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("switch:")) return;

  try {
    await ctx.answerCallbackQuery();
  } catch {
  }

  const action = data.replace("switch:", "");

  if (action === "create") {
    const count = await convex.getProfileCount(telegramId);
    if (!isVipUnlocked(ctx) && count >= MAX_GIRLFRIENDS) {
      await ctx.reply(
        `You've reached the max of ${MAX_GIRLFRIENDS} girlfriends. VIP unlocks extra slots 💎`
      );
      return;
    }

    const shouldCharge = count >= 1 && !env.FREE_MODE;
    if (shouldCharge) {
      const balance = await convex.getBalance(telegramId);
      if (balance < NEW_GIRLFRIEND_COST) {
        await ctx.reply(
          `Creating a new girlfriend costs ${NEW_GIRLFRIEND_COST} credits after your first free one.\n` +
            `Current balance: ${balance} credits\n\nUse /buy to top up.`
        );
        return;
      }

      await convex.spendCredits({
        telegramId,
        amount: NEW_GIRLFRIEND_COST,
        service: "girlfriend_slot",
        model: "profile_create",
      });
    }

    await ctx.reply("Let's create your new girlfriend 💕");
    await ctx.conversation.enter("girlfriendSetup");
    return;
  }

  await convex.switchActiveProfile(telegramId, action);
  const active = await convex.getActiveProfile(telegramId);

  if (!active) {
    await ctx.reply("Couldn't switch profiles right now. Try again in a moment.");
    return;
  }

  await ctx.reply(`hey baby~ it's ${active.name}! i missed you 💕`);
}
