import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { convex, type SavedImage } from "../../services/convex.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";

const DEFAULT_LIMIT = 40;
const MEDIA_GROUP_SIZE = 5;

function formatImageDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAlbumViewLabel(filter: string): string {
  if (filter === "favorites") return "favorites";
  if (filter === "nsfw") return "spicy";
  if (filter === "sfw") return "casual";
  if (filter.startsWith("cat:")) return filter.replace("cat:", "");
  return "all photos";
}

async function getImagesForFilter(
  telegramId: number,
  filter: string,
  limit = DEFAULT_LIMIT
): Promise<SavedImage[]> {
  if (filter === "favorites") {
    const favorites = await convex.getUserFavorites(telegramId);
    return favorites.slice(0, limit);
  }
  if (filter === "nsfw") {
    return convex.getUserImages(telegramId, limit, "nsfw");
  }
  if (filter === "sfw") {
    return convex.getUserImages(telegramId, limit, "sfw");
  }
  if (filter.startsWith("cat:")) {
    const category = filter.slice(4);
    return convex.getUserImages(telegramId, limit, category);
  }
  return convex.getUserImages(telegramId, limit);
}

function createFavoriteKeyboard(imageId: string, isFavorite: boolean): InlineKeyboard {
  const icon = isFavorite ? "❤️" : "🤍";
  return new InlineKeyboard().text(`${icon} Favorite`, `fav:${imageId}`);
}

export async function handleAlbum(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;

  try {
    const [allCount, favoritesCount, spicyCount, casualCount, categories] =
      await Promise.all([
        convex.getImageCount(telegramId, "all"),
        convex.getImageCount(telegramId, "favorites"),
        convex.getImageCount(telegramId, "nsfw"),
        convex.getImageCount(telegramId, "sfw"),
        convex.getImageCategories(telegramId),
      ]);

    if (allCount === 0) {
      await sendAsMultipleTexts({
        ctx,
        messages: [
          "your album is empty babe 😢",
          "ask me for a /selfie and I'll start filling it 📸",
        ],
      });
      return;
    }

    const keyboard = new InlineKeyboard()
      .text(`📸 All Photos (${allCount})`, "album:all")
      .row()
      .text(`❤️ Favorites (${favoritesCount})`, "album:favorites")
      .text(`🔥 Spicy (${spicyCount})`, "album:nsfw")
      .row()
      .text(`😊 Casual (${casualCount})`, "album:sfw");

    for (const category of categories.slice(0, 12)) {
      if (["nsfw", "sfw"].includes(category.category)) continue;
      keyboard.row().text(
        `${category.category} (${category.count})`,
        `album:cat:${category.category}`
      );
    }

    await ctx.reply("pick an album view babe 💕", {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Album menu error:", error);
    await sendAsMultipleTexts({
      ctx,
      messages: ["ugh my album app crashed babe 😭 try again?"],
    });
  }
}

export async function handleAlbumCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("album:")) return;

  const telegramId = ctx.from!.id;
  const filter = data.replace("album:", "");

  await ctx.answerCallbackQuery();

  try {
    const images = await getImagesForFilter(telegramId, filter);

    if (images.length === 0) {
      await sendAsMultipleTexts({
        ctx,
        messages: ["nothing there yet babe, try another category 💕"],
      });
      return;
    }

    await sendAsMultipleTexts({
      ctx,
      messages: [`here's your ${getAlbumViewLabel(filter)} (${images.length}) 📸`],
    });

    for (let i = 0; i < images.length; i += MEDIA_GROUP_SIZE) {
      const batch = images.slice(i, i + MEDIA_GROUP_SIZE);

      if (batch.length === 1) {
        const image = batch[0]!;
        await ctx.replyWithPhoto(image.imageUrl, {
          caption: `📅 ${formatImageDate(image.createdAt)}`,
          reply_markup: createFavoriteKeyboard(image._id, image.isFavorite),
        });
        continue;
      }

      const mediaGroup = batch.map((image) => ({
        type: "photo" as const,
        media: image.imageUrl,
        caption: `📅 ${formatImageDate(image.createdAt)}`,
      }));

      await ctx.replyWithMediaGroup(mediaGroup);

      for (const image of batch) {
        await ctx.reply(`📅 ${formatImageDate(image.createdAt)}`, {
          reply_markup: createFavoriteKeyboard(image._id, image.isFavorite),
        });
      }
    }
  } catch (error) {
    console.error("Album callback error:", error);
    await sendAsMultipleTexts({
      ctx,
      messages: ["i couldn't open that album right now babe 😭"],
    });
  }
}

export async function handleFavoriteCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("fav:")) return;

  const imageId = data.replace("fav:", "");

  try {
    const result = await convex.toggleFavorite(imageId);
    if (!result.ok) {
      await ctx.answerCallbackQuery({ text: "image not found" });
      return;
    }

    await ctx.answerCallbackQuery({
      text: result.isFavorite ? "added to favorites ❤️" : "removed from favorites 🤍",
    });
  } catch (error) {
    console.error("Favorite toggle error:", error);
    await ctx.answerCallbackQuery({ text: "favorite failed, try again" });
  }
}
