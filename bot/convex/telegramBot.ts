"use node";

import { api } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { sendMessage } from "./telegramApi";
import { ConvexSessionAdapter } from "../src/services/convex-session-adapter.js";

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_MODEL = "llama-3.3-70b";
const MISS_YOU_MARKER = "[[MISS_YOU]] ";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type VeniceMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callVenice(
  messages: VeniceMessage[],
  config?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) throw new Error("Missing VENICE_API_KEY");

  const resp = await fetch(VENICE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages,
      max_tokens: config?.maxTokens ?? 500,
      temperature: config?.temperature ?? 0.9,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Venice API error ${resp.status}: ${body}`);
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Venice API returned empty response");
  return content;
}

export const processUpdate = internalAction({
  args: { update: v.any() },
  handler: async (_ctx, { update }) => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      console.error("Missing CONVEX_URL — cannot create session adapter");
      return;
    }

    const storage = new ConvexSessionAdapter(convexUrl);
    // Dynamic import to avoid triggering env.ts validation at Convex module analysis time
    const { createBot } = await import("../src/bot/index.js");
    const bot = createBot({
      storage,
      botInfo: {
        id: 8237744904,
        is_bot: true as const,
        first_name: "PatAndroid_bot",
        username: "PatAndroid_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
      },
    });

    try {
      await bot.handleUpdate(update);
    } catch (err) {
      console.error("grammY handleUpdate failed:", err);

      const chatId =
        (update as any)?.message?.chat?.id ??
        (update as any)?.callback_query?.message?.chat?.id;
      if (chatId) {
        const excuses = [
          "ugh my brain just glitched babe, say that again?",
          "wait what?? my phone froze for a sec",
          "sorry babe something weird happened, try again?",
          "lol my phone is being so dumb rn",
        ];
        const excuse = excuses[Math.floor(Math.random() * excuses.length)];
        try {
          await bot.api.sendMessage(chatId, excuse);
        } catch {
          /* best-effort error reply */
        }
      }
    }
  },
});

export const sendMissYouMessages = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const inactiveUsers = await ctx.runQuery(api.users.getInactive, {
        thresholdMs: SIX_HOURS_MS,
      });

      for (const user of inactiveUsers) {
        try {
          const recentMessages = await ctx.runQuery(api.messages.getRecent, {
            telegramId: user.telegramId,
            limit: 150,
          });

          const now = Date.now();
          const todayMissYouCount = recentMessages.filter(
            (msg) =>
              msg.role === "assistant" &&
              msg.content.startsWith(MISS_YOU_MARKER) &&
              now - msg.createdAt < ONE_DAY_MS
          ).length;

          if (todayMissYouCount >= 2) {
            continue;
          }

          const profile = await ctx.runQuery(api.girlfriendProfiles.get, {
            telegramId: user.telegramId,
          });

          const hoursAgo = Math.max(
            6,
            Math.floor((Date.now() - user.lastActive) / (60 * 60 * 1000))
          );

          const missYouPrompt = profile
            ? `Write one short miss-you Telegram message from ${profile.name} to her boyfriend. Personality: ${profile.personality}. He was last active ${hoursAgo} hours ago. Keep it warm, casual, and under 220 characters. Max 1 emoji.`
            : `Write one short miss-you Telegram message from a loving AI girlfriend. He was last active ${hoursAgo} hours ago. Keep it warm, casual, and under 220 characters. Max 1 emoji.`;

          const missYouMessage = await callVenice(
            [{ role: "user", content: missYouPrompt }],
            { maxTokens: 120, temperature: 1.0 }
          );

          const sendResult = await sendMessage(user.telegramId, missYouMessage);
          if (sendResult.chatBlocked) {
            console.warn(`Skipping miss-you for ${user.telegramId}: chat unreachable`);
            continue;
          }

          await ctx.runMutation(api.messages.addMessage, {
            telegramId: user.telegramId,
            role: "assistant",
            content: `${MISS_YOU_MARKER}${missYouMessage}`,
          });
        } catch (error) {
          console.error(
            `sendMissYouMessages failed for telegramId=${user.telegramId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("sendMissYouMessages job failed:", error);
    }
  },
});
