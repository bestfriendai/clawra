import type { BotContext } from "../../types/context.js";
import { transcribeAudio } from "../../services/fal.js";
import { handleChat } from "./chat.js";

const MAX_VOICE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_VOICE_DURATION_SECONDS = 120;
const ALLOWED_VOICE_MIME_TYPES = new Set(["audio/ogg", "audio/mpeg", "audio/mp3"]);

export async function handleVoiceMessage(ctx: BotContext) {
  const voice = ctx.message?.voice;
  if (!voice) return;

  if (voice.file_size && voice.file_size > MAX_VOICE_FILE_SIZE_BYTES) {
    await ctx.reply("that file is too big babe 😂 keep it under 20MB");
    return;
  }

  if (voice.duration > MAX_VOICE_DURATION_SECONDS) {
    await ctx.reply("that voice note is way too long babe 😂 keep it under 2 min");
    return;
  }

  if (voice.mime_type && !ALLOWED_VOICE_MIME_TYPES.has(voice.mime_type.toLowerCase())) {
    await ctx.reply("send me a regular voice note babe, that format is weird 😅");
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");

    const file = await ctx.getFile();
    const filePath = file.file_path;
    if (!filePath) {
      await ctx.reply("couldn't hear that babe, send it again? 🥺");
      return;
    }

    const botToken = ctx.api.token;
    const audioUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    let transcription: string;
    try {
      transcription = await transcribeAudio(audioUrl);
    } catch (err) {
      console.error("Whisper transcription failed:", err);
      await ctx.reply("sorry babe I couldn't hear that clearly, can you type it out? 🙈");
      return;
    }

    if (!transcription || transcription.trim().length === 0) {
      await ctx.reply("i couldn't make out what you said babe 😅 try again?");
      return;
    }

    if (ctx.message) {
      (ctx.message as any).text = transcription;
    }

    await handleChat(ctx);
  } catch (err) {
    console.error("Voice transcription error:", err);
    await ctx.reply("my ears are being weird rn 😭 can you type it out babe?");
  }
}
