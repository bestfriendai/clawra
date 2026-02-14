import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByPaymentRef = query({
  args: { paymentRef: v.string() },
  handler: async (ctx, { paymentRef }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_paymentRef", (q) => q.eq("paymentRef", paymentRef))
      .first();
  },
});

export const getRecentByUser = query({
  args: { telegramId: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { telegramId, limit }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .order("desc")
      .take(limit ?? 10);
  },
});
