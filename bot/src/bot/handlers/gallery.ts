import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";

interface StoredMessage {
  role?: string;
  imageUrl?: string;
}

export async function handleGallery(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const name = ctx.girlfriend?.name || "your girl";

  try {
    const messages = await convex.getRecentMessages(telegramId, 100);
    const imageMessages = (messages as StoredMessage[])
      .filter((message) => message.imageUrl && message.role === "assistant")
      .slice(0, 20);

    if (imageMessages.length === 0) {
      await sendAsMultipleTexts({
        ctx,
        messages: [
          "we don't have any pics together yet babe! 😅",
          "ask me for a /selfie and let's fix that 📸",
        ],
      });
      return;
    }

    await sendAsMultipleTexts({
      ctx,
      messages: [`here are our memories together babe 📸💕 (${imageMessages.length} pics)`],
    });

    const batches: StoredMessage[][] = [];
    for (let i = 0; i < imageMessages.length; i += 5) {
      batches.push(imageMessages.slice(i, i + 5));
    }

    for (const batch of batches) {
      if (batch.length === 1 && batch[0]?.imageUrl) {
        await ctx.replyWithPhoto(batch[0].imageUrl);
      } else {
        const mediaGroup = batch
          .filter((message): message is StoredMessage & { imageUrl: string } => Boolean(message.imageUrl))
          .map((message, index) => ({
            type: "photo" as const,
            media: message.imageUrl,
            caption: index === 0 ? `from ${name} 💕` : undefined,
          }));

        if (mediaGroup.length > 0) {
          await ctx.replyWithMediaGroup(mediaGroup);
        }
      }
    }
  } catch (error) {
    console.error("Gallery error:", error);
    await sendAsMultipleTexts({
      ctx,
      messages: ["ugh my gallery app crashed babe 😭 try again?"],
    });
  }
}
