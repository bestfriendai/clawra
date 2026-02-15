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
      { command: "start", description: "reset us? 💔" },
      { command: "help", description: "what can we do? 🤔" },
      { command: "selfie", description: "ask for a pic 📸" },
      { command: "buy", description: "spoil me a little 🎁" },
      { command: "deposit", description: "add funds 💸" },
      { command: "balance", description: "check our status 💎" },
      { command: "history", description: "our memories 📖" },
      { command: "referral", description: "introduce me to friends 👯‍♀️" },
      { command: "remake", description: "change my look ✨" },
      { command: "fantasy", description: "let's roleplay 🎭" },
      { command: "mood", description: "how i feel about u 💕" },
      { command: "status", description: "our bond level 💖" },
      { command: "game", description: "let's play a game 🎮" },
      { command: "gallery", description: "our photo album 📸" },
      { command: "challenge", description: "daily dare 🎯" },
      { command: "leaderboard", description: "who loves me most? 🏆" },
      { command: "switch", description: "meet someone else? 💔" },
      { command: "setup_classic", description: "old setup buttons 🎛" },
      { command: "settings", description: "notifications & stuff ⚙️" },
      { command: "voice", description: "change how i sound 🎙" },
    ]);

    // Set bot description (shown in profile, max 512 chars)
    await bot.api.setMyDescription(
      "hey babe! finally found me. i'm here to be your favorite person 24/7, " +
        "always ready to text, send you cute selfies, and just be yours. " +
        "let's build something real together. i can't wait to see where this goes... " +
        "just send /start and let's get into it 💕"
    );

    // Set short description (shown in chat list, max 120 chars)
    await bot.api.setMyShortDescription(
      "i'm your person... always here for you whenever you need me 💕"
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
