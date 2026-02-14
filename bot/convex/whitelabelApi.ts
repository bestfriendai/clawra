"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const validateBotToken = internalAction({
  args: { botToken: v.string() },
  handler: async (_ctx, { botToken }): Promise<{
    ok: boolean;
    username?: string;
    firstName?: string;
    error?: string;
  }> => {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const data = await res.json();

      if (!data.ok) {
        return { ok: false, error: data.description ?? "Invalid bot token" };
      }

      return {
        ok: true,
        username: data.result.username,
        firstName: data.result.first_name,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, error: message };
    }
  },
});

export const setupWebhook = internalAction({
  args: {
    botToken: v.string(),
    convexSiteUrl: v.string(),
  },
  handler: async (ctx, { botToken, convexSiteUrl }) => {
    const webhookUrl = `${convexSiteUrl}/api/bots/${botToken}/webhook`;

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );
    const data = await res.json();

    if (!data.ok) {
      throw new Error(`Failed to set webhook: ${data.description}`);
    }

    await ctx.runMutation(internal.botInstances.setWebhookUrl, {
      botToken,
      webhookUrl,
    });

    return { success: true, webhookUrl };
  },
});

type RegisterResult =
  | { success: true; botId: string; botUsername?: string }
  | { success: false; error?: string };

export const registerBot = internalAction({
  args: {
    ownerTelegramId: v.number(),
    botToken: v.string(),
    girlfriendName: v.optional(v.string()),
    girlfriendPersonality: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RegisterResult> => {
    const validation = await ctx.runAction(
      internal.whitelabelApi.validateBotToken,
      { botToken: args.botToken }
    );

    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    try {
      const id: string = await ctx.runMutation(
        internal.botInstances.register,
        {
          ownerTelegramId: args.ownerTelegramId,
          botToken: args.botToken,
          botUsername: validation.username,
          girlfriendName: args.girlfriendName,
          girlfriendPersonality: args.girlfriendPersonality,
        }
      );

      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (convexSiteUrl) {
        await ctx.runAction(internal.whitelabelApi.setupWebhook, {
          botToken: args.botToken,
          convexSiteUrl,
        });
      }

      return {
        success: true,
        botId: id,
        botUsername: validation.username,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Registration failed";
      return { success: false, error: message };
    }
  },
});

// TODO: implement full bot processing logic for white-label bots
export const processWhitelabelUpdate = internalAction({
  args: {
    botToken: v.string(),
    update: v.any(),
  },
  handler: async (ctx, { botToken, update }) => {
    const bot = await ctx.runQuery(internal.botInstances.internalGetByToken, {
      botToken,
    });

    if (!bot || !bot.isActive) {
      console.log(`Ignoring update for inactive/unknown bot: ${botToken.substring(0, 10)}...`);
      return;
    }

    console.log(
      `[WhiteLabel] Bot @${bot.botUsername} received update:`,
      JSON.stringify(update).substring(0, 200)
    );
  },
});
