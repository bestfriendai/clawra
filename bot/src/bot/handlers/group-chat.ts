import type { BotContext, GirlfriendProfile } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { chatInGroup } from "../../services/venice.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { env } from "../../config/env.js";
import { sanitizeForAI } from "../../utils/sanitize.js";
import { getModerationResponse, isProhibitedContent } from "../../utils/moderation.js";
import { LRUMap } from "../../utils/lru-map.js";

const GROUP_RESPONSE_LIMIT = 5;
const GROUP_RESPONSE_WINDOW_MS = 60 * 60 * 1000;

const GROUP_KEYWORDS = ["clawra", "ai girlfriend", "girlfriend bot", "virtual girlfriend"];
const GROUP_NSFW_PATTERN =
  /\b(nsfw|sex|sexy|horny|nude|naked|explicit|fuck|fucking|cum|blowjob|bj|anal|fetish|roleplay|turn me on|moan)\b/i;

const groupResponseTracker = new LRUMap<number, number[]>(1000);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isGroupChat(ctx: BotContext): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function getGroupTriggerType(ctx: BotContext): "mention" | "reply" | "keyword" | null {
  const text = ctx.message?.text || "";
  const meUsername = ctx.me.username;

  if (meUsername) {
    const mentionPattern = new RegExp(`(^|\\s)@${escapeRegex(meUsername)}\\b`, "i");
    if (mentionPattern.test(text)) {
      return "mention";
    }
  }

  if (ctx.message?.reply_to_message?.from?.id === ctx.me.id) {
    return "reply";
  }

  const lower = text.toLowerCase();
  if (GROUP_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "keyword";
  }

  return null;
}

export function isGroupMention(ctx: BotContext): boolean {
  if (!isGroupChat(ctx)) {
    return false;
  }
  return getGroupTriggerType(ctx) !== null;
}

function getRecentGroupResponses(telegramId: number): number[] {
  const now = Date.now();
  const recent = (groupResponseTracker.get(telegramId) || []).filter(
    (timestamp) => now - timestamp < GROUP_RESPONSE_WINDOW_MS
  );
  groupResponseTracker.set(telegramId, recent);
  return recent;
}

function canRespondInGroup(telegramId: number): boolean {
  const recent = getRecentGroupResponses(telegramId);
  return recent.length < GROUP_RESPONSE_LIMIT;
}

function recordGroupResponse(telegramId: number): void {
  const now = Date.now();
  const recent = getRecentGroupResponses(telegramId);
  recent.push(now);
  groupResponseTracker.set(telegramId, recent);
}

export function getGroupPersonality(profile: GirlfriendProfile): string {
  return [
    `Base personality: ${profile.personality}.`,
    "Group mode personality: playful, charming, and flirty-cute.",
    "Never sexual, never explicit, never NSFW.",
    "Keep energy social and light so the whole group can enjoy it.",
  ].join(" ");
}

export function buildGroupSystemPrompt(
  profile: GirlfriendProfile,
  groupContext: { firstName: string; groupTitle?: string; triggerType: "mention" | "reply" | "keyword" }
): string {
  const groupTitle = groupContext.groupTitle ? `Group: ${groupContext.groupTitle}.` : "";
  return [
    `You are ${profile.name}, an AI girlfriend persona in Telegram.`,
    groupTitle,
    `You're in a GROUP CHAT. Keep it PG-13. Be flirty and fun but NEVER explicit. Short responses only. Make other people in the group curious about you.`,
    `Use this toned style: ${getGroupPersonality(profile)}`,
    `Address the user by first name: ${groupContext.firstName}.`,
    "Keep your response to one short message (max 1-2 sentences).",
    "Add a playful social-proof nudge when natural, like: tell your friends about me 💕",
    `Trigger type was: ${groupContext.triggerType}. Respond naturally to that context.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function handleGroupMessage(ctx: BotContext): Promise<void> {
  if (!isGroupChat(ctx)) {
    return;
  }

  const userMessageRaw = ctx.message?.text;
  if (!userMessageRaw) {
    return;
  }

  const triggerType = getGroupTriggerType(ctx);
  if (!triggerType) {
    return;
  }

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    return;
  }

  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.reply("Set up your AI girlfriend in DM first with /start, then mention me here 💕");
    return;
  }

  const moderation = isProhibitedContent(userMessageRaw);
  if (moderation.blocked) {
    await ctx.reply(getModerationResponse());
    return;
  }

  if (GROUP_NSFW_PATTERN.test(userMessageRaw)) {
    await ctx.reply("keeping it cute and PG-13 in group chats only 😇💕");
    return;
  }

  if (!canRespondInGroup(telegramId)) {
    await ctx.reply("you're too popular rn 😘 hit me again in a bit");
    return;
  }

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < CREDIT_COSTS.GROUP_CHAT_MESSAGE) {
      await ctx.reply("you're out of credits babe - DM me with /buy and I'll keep chatting 💕");
      return;
    }
  }

  const userMessage = sanitizeForAI(userMessageRaw);
  if (!userMessage) {
    return;
  }

  const firstName = ctx.from?.first_name || ctx.user?.firstName || "babe";
  const groupPrompt = buildGroupSystemPrompt(ctx.girlfriend, {
    firstName,
    groupTitle: ctx.chat?.title,
    triggerType,
  });

  try {
    const recentMessages = await convex.getRecentMessages(telegramId, 8);
    const history = [
      { role: "system", content: groupPrompt },
      ...recentMessages.map((message: { role: string; content: string }) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await chatInGroup(ctx.girlfriend, history, userMessage);

    if (!env.FREE_MODE) {
      await convex.spendCredits({
        telegramId,
        amount: CREDIT_COSTS.GROUP_CHAT_MESSAGE,
        service: "venice",
        model: "venice-uncensored",
      });
    }

    recordGroupResponse(telegramId);

    await convex.addMessage({
      telegramId,
      role: "user",
      content: `[group:${ctx.chat?.id}] ${userMessageRaw}`,
    });

    await ctx.reply(response);

    await convex.addMessage({
      telegramId,
      role: "assistant",
      content: `[group:${ctx.chat?.id}] ${response}`,
    });
  } catch (error) {
    console.error("Group chat error:", error);
    await ctx.reply("my group-chat brain lagged for a sec 😅 try me again");
  }
}
