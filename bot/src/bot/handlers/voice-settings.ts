import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import {
  getAllVoiceProfiles,
  getDefaultVoiceProfile,
  getVoiceProfile,
  type VoiceProfile,
} from "../../config/voice-profiles.js";
import { generateVoiceNote } from "../../services/fal.js";
import { convex } from "../../services/convex.js";

const PREVIEW_TEXT = "hey babe, how do I sound? 💕";

function getVoiceEmoji(profileId: string): string {
  switch (profileId) {
    case "seductive":
      return "🔥";
    case "sweet":
      return "🍬";
    case "mature":
      return "💋";
    case "playful":
      return "🎀";
    case "asmr":
      return "🌙";
    case "dominant":
      return "👑";
    case "shy":
      return "🌸";
    case "girlfriend-next-door":
      return "☀️";
    default:
      return "🎙";
  }
}

function getCurrentProfile(ctx: BotContext): VoiceProfile {
  const selectedProfileId = ctx.girlfriend?.voiceId;
  return selectedProfileId ? getVoiceProfile(selectedProfileId) : getDefaultVoiceProfile();
}

function buildVoiceSettingsText(currentProfile: VoiceProfile): string {
  return [
    `🎙 Current voice: ${currentProfile.name}`,
    "",
    "Choose a new voice:",
  ].join("\n");
}

function buildVoiceKeyboard(): InlineKeyboard {
  const profiles = getAllVoiceProfiles();
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < profiles.length; i += 2) {
    const left = profiles[i];
    const right = profiles[i + 1];

    keyboard.text(
      `${getVoiceEmoji(left.id)} ${left.name} • ${left.description}`,
      `voice:set:${left.id}`
    );

    if (right) {
      keyboard.text(
        `${getVoiceEmoji(right.id)} ${right.name} • ${right.description}`,
        `voice:set:${right.id}`
      );
    }

    keyboard.row();
  }

  keyboard.text("🔊 Preview Current Voice", "voice:preview");
  return keyboard;
}

async function renderVoiceMenu(ctx: BotContext): Promise<void> {
  const currentProfile = getCurrentProfile(ctx);
  const text = buildVoiceSettingsText(currentProfile);
  const replyMarkup = buildVoiceKeyboard();

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { reply_markup: replyMarkup });
      return;
    } catch {
    }
  }

  await ctx.reply(text, { reply_markup: replyMarkup });
}

export async function handleVoiceSettings(ctx: BotContext): Promise<void> {
  await renderVoiceMenu(ctx);
}

async function sendVoicePreview(ctx: BotContext, profile: VoiceProfile): Promise<void> {
  await ctx.replyWithChatAction("record_voice");
  const audio = await generateVoiceNote(PREVIEW_TEXT, undefined, profile);
  const response = await fetch(audio.url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const { InputFile } = await import("grammy");

  await ctx.replyWithVoice(new InputFile(buffer, "voice-preview.mp3"), {
    duration: Math.ceil(audio.duration_ms / 1000),
    caption: `${getVoiceEmoji(profile.id)} ${profile.name} preview`,
  });
}

export async function handleVoiceSettingsCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("voice:")) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  if (data === "voice:preview") {
    const currentProfile = getCurrentProfile(ctx);
    await ctx.answerCallbackQuery({
      text: `Previewing ${currentProfile.name}`,
      show_alert: false,
    });
    try {
      await sendVoicePreview(ctx, currentProfile);
    } catch (error) {
      console.error("Voice preview error:", error);
      await ctx.reply("couldn't generate preview right now babe, try again in a sec 💕");
    }
    return;
  }

  if (data.startsWith("voice:set:")) {
    const profileId = data.replace("voice:set:", "");
    const selectedProfile = getVoiceProfile(profileId);

    await convex.updateProfile({ telegramId, voiceId: selectedProfile.id });

    if (ctx.girlfriend) {
      ctx.girlfriend.voiceId = selectedProfile.id;
    }

    await ctx.answerCallbackQuery({
      text: `Voice switched to ${selectedProfile.name}`,
      show_alert: false,
    });

    await renderVoiceMenu(ctx);
  }
}
