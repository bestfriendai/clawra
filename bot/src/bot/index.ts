import { Bot, session, type StorageAdapter } from "grammy";
import type { UserFromGetMe } from "@grammyjs/types";
import { conversations, createConversation } from "@grammyjs/conversations";
import { autoRetry } from "@grammyjs/auto-retry";
import type { BotContext, SessionData } from "../types/context.js";
import { env } from "../config/env.js";

export interface CreateBotOptions {
  storage?: StorageAdapter<SessionData>;
  botInfo?: UserFromGetMe;
}

// Middleware
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/ratelimit.js";

// Conversations
import { girlfriendSetup, girlfriendSetupClassic } from "./conversations/girlfriend-setup.js";

// Handlers
import { handleStart } from "./handlers/start.js";
import { handleRemake } from "./handlers/remake.js";
import { handleChat } from "./handlers/chat.js";
import { handleSelfie, handleSelfieCallback, handleReactionCallback, handleVoiceReactCallback } from "./handlers/selfie.js";
import { handleBuy, handleBuyCallback, handlePreCheckout, handleSuccessfulPayment, handleManage } from "./handlers/buy.js";
import { handleBalance } from "./handlers/balance.js";
import { handleHelp } from "./handlers/help.js";
import { handleHistory } from "./handlers/history.js";
import { handleReferral, handleReferralCallback } from "./handlers/referral.js";
import { handleAdmin } from "./handlers/admin.js";
import { handleDeposit } from "./handlers/pay-crypto.js";
import { handleVoiceMessage } from "./handlers/voice.js";
import { handlePhoto, handleSticker, handleGif } from "./handlers/media.js";
import { handleFantasy, handleFantasyCallback } from "./handlers/fantasy.js";
import { handleMood } from "./handlers/mood.js";
import { handleStatus } from "./handlers/status.js";
import { handleGallery } from "./handlers/gallery.js";
import {
  handleAlbum,
  handleAlbumCallback,
  handleFavoriteCallback,
} from "./handlers/album.js";
import { handleChallenge } from "./handlers/challenge.js";
import { handleLeaderboard } from "./handlers/leaderboard.js";
import { handleBadges } from "./handlers/badges.js";
import { handleTimeline } from "./handlers/timeline.js";
import { handleInlineQuery } from "./handlers/inline.js";
import { handleSwitch, handleSwitchCallback } from "./handlers/switch.js";
import { handleSettings, handleSettingsCallback } from "./handlers/settings.js";
import { handleVoiceSettings, handleVoiceSettingsCallback } from "./handlers/voice-settings.js";
import { handleGroupMessage } from "./handlers/group-chat.js";
import { handleSetupClassic } from "./handlers/setup-classic.js";
import { handleGame, handleGameCallback, handleGameMessage } from "./handlers/games.js";

export function createBot(options?: CreateBotOptions): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN, options?.botInfo ? { botInfo: options.botInfo } : undefined);
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }));

  bot.use(
    session({
      initial: (): SessionData => ({}),
      getSessionKey: (ctx) => {
        // Inline queries and chosen_inline_result don't belong to a chat,
        // so the default session key derivation throws. Return the user's ID
        // as the key so session data is still accessible, or undefined to
        // skip session entirely for updates without a user.
        const userId = ctx.from?.id;
        if (userId !== undefined) return String(userId);
        return undefined;
      },
      ...(options?.storage ? { storage: options.storage } : {}),
    })
  );

  // Conversations plugin
  bot.use(conversations());
  bot.use(createConversation(girlfriendSetup));
  bot.use(createConversation(girlfriendSetupClassic, "girlfriendSetupClassic"));

  // Middleware
  bot.use(rateLimitMiddleware);
  bot.use(authMiddleware);

  // Commands
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("remake", handleRemake);
  bot.command("selfie", handleSelfie);
  bot.command("buy", handleBuy);
  bot.command("manage", handleManage);
  bot.command("deposit", handleDeposit);
  bot.command("balance", handleBalance);
  bot.command("history", handleHistory);
  bot.command("referral", handleReferral);
  bot.command("admin", handleAdmin);
  bot.command("fantasy", handleFantasy);
  bot.command("mood", handleMood);
  bot.command("status", handleStatus);
  bot.command("gallery", handleGallery);
  bot.command("album", handleAlbum);
  bot.command("challenge", handleChallenge);
  bot.command("leaderboard", handleLeaderboard);
  bot.command("badges", handleBadges);
  bot.command("timeline", handleTimeline);
  bot.command("switch", handleSwitch);
  bot.command("settings", handleSettings);
  bot.command("voice", handleVoiceSettings);
  // bot.command("setup_classic", handleSetupClassic);
  bot.command("game", handleGame);

  // Payment handlers
  bot.on("pre_checkout_query", handlePreCheckout);
  bot.on("message:successful_payment", handleSuccessfulPayment);

  // Callback queries — prefixed callbacks handled here, conversation callbacks fall through
  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("buy:")) return handleBuyCallback(ctx);
    if (data.startsWith("selfie:")) return handleSelfieCallback(ctx);
    if (data.startsWith("fantasy:")) return handleFantasyCallback(ctx);
    if (data.startsWith("album:")) return handleAlbumCallback(ctx);
    if (data.startsWith("fav:")) return handleFavoriteCallback(ctx);
    if (data.startsWith("switch:")) return handleSwitchCallback(ctx);
    if (data.startsWith("referral:")) return handleReferralCallback(ctx);
    if (data.startsWith("settings:")) return handleSettingsCallback(ctx);
    if (data.startsWith("voice:")) return handleVoiceSettingsCallback(ctx);
    if (data.startsWith("game:")) return handleGameCallback(ctx);
    if (data === "react_amazing" || data === "emotion_more" || data === "emotion_check" || data === "emotion_support") return handleReactionCallback(ctx);
    if (data === "voice_react") return handleVoiceReactCallback(ctx);
    await next();
  });

  // Default text handler (chat with girlfriend)
  bot.on("inline_query", handleInlineQuery);
  bot.on("chosen_inline_result", (ctx) => {
    console.log("Chosen inline result", {
      userId: ctx.from?.id,
      resultId: ctx.chosenInlineResult.result_id,
      query: ctx.chosenInlineResult.query,
      inlineMessageId: ctx.chosenInlineResult.inline_message_id,
    });
  });

  bot.on("message:voice", handleVoiceMessage);
  bot.on("message:photo", handlePhoto);
  bot.on("message:sticker", handleSticker);
  bot.on("message:animation", handleGif);
  bot.on("message:text", async (ctx, next) => {
    if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
      await handleGroupMessage(ctx);
      return;
    }
    await next();
  });
  bot.on("message:text", async (ctx, next) => {
    const handled = await handleGameMessage(ctx);
    if (!handled) await next();
  });
  bot.on("message:text", handleChat);

  // Error handler
  bot.catch((err) => {
    console.error("Bot error:", err.error);
    const excuses = [
      "ugh my brain just glitched babe, say that again?",
      "wait what?? my phone froze for a sec",
      "sorry babe something weird happened, try again?",
      "lol my phone is being so dumb rn",
      "omg that was weird... say that again?",
      "my wifi just died for a sec babe hold on",
      "wait my messages aren't going through I think?? try again",
      "ugh technology hates me today, one more time babe?",
      "sorry lol my phone literally just restarted on its own",
      "babe I think I lost signal for a sec, what did you say?",
      "ok that was so random my phone just froze, go again?",
      "lmao my phone is tweaking today sorry, say it again",
    ];
    const excuse = excuses[Math.floor(Math.random() * excuses.length)];
    err.ctx.reply(excuse).catch(() => {});
  });

  return bot;
}
