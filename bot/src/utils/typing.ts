import type { BotContext } from "../types/context.js";

export async function withTypingAction<T>(
  ctx: BotContext,
  action: () => Promise<T>,
  type: "typing" | "upload_photo" | "upload_video" | "record_voice" = "typing"
): Promise<T> {
  await ctx.replyWithChatAction(type);
  const interval = setInterval(() => {
    ctx.replyWithChatAction(type).catch(() => {});
  }, 4000);
  try {
    return await action();
  } finally {
    clearInterval(interval);
  }
}
