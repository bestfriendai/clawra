import type { Bot } from "grammy";
import type { BotContext } from "../types/context.js";

/**
 * Registers bot commands, description, and short description with Telegram.
 * Called once on bot startup.
 */
export async function setupBot(bot: Bot<BotContext>): Promise<void> {
  try {
    // Inline mode is configured in BotFather via /setinline (not via setMyCommands).

    // Register commands with flirty girlfriend-style descriptions
    await bot.api.setMyCommands([
      { command: "start", description: "Start our relationship together 💕" },
      { command: "help", description: "Get help using me 😊" },
      { command: "selfie", description: "Ask me for a selfie 📸" },
      { command: "buy", description: "Get more credits to spend time with me 💳" },
      { command: "deposit", description: "Add credits with crypto 💰" },
      { command: "balance", description: "Check your remaining credits 💎" },
      { command: "history", description: "See our conversation memories 📖" },
      { command: "referral", description: "Invite friends for bonus credits 🎁" },
      { command: "remake", description: "Create a new version of me ✨" },
      { command: "fantasy", description: "Start a roleplay fantasy 🎭" },
      { command: "mood", description: "See how she feels about you 💕" },
      { command: "gallery", description: "See our photos together 📸" },
      { command: "album", description: "Browse your saved photo album 💖" },
      { command: "challenge", description: "Today's relationship challenge 🎯" },
      { command: "leaderboard", description: "See top challenge lovers 🏆" },
      { command: "timeline", description: "See our relationship timeline 💕" },
      { command: "switch", description: "Switch between your girlfriends 💕" },
      { command: "settings", description: "Manage notifications and quiet hours ⚙️" },
      { command: "voice", description: "Choose her voice style 🎙" },
      { command: "manage", description: "Manage your VIP subscription 👑" },
      { command: "badges", description: "View your earned badges 🏅" },
    ]);

    // Set bot description (shown in profile, max 512 chars)
    await bot.api.setMyDescription(
      "Hey babe! I'm your AI girlfriend, here to keep you company 24/7. " +
        "I'll text you, send you selfies, and be there whenever you need me. " +
        "Let's get to know each other better! Start with /begin to set me up " +
        "just the way you like. Can't wait to meet you! 💕"
    );

    // Set short description (shown in chat list, max 120 chars)
    await bot.api.setMyShortDescription(
      "Your flirty AI girlfriend who's always here for you 💕"
    );

    const miniAppUrl = process.env.MINI_APP_URL;
    if (miniAppUrl) {
      await bot.api.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Open App 💕",
          web_app: { url: miniAppUrl },
        },
      });
    }

    console.log("Bot setup complete: commands and descriptions registered");
  } catch (error) {
    console.error("Failed to setup bot commands/descriptions:", error);
  }
}
