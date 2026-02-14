import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByHash = query({
  args: { txHash: v.string() },
  handler: async (ctx, { txHash }) => {
    return await ctx.db
      .query("processedChainTxs")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .first();
  },
});

export const create = mutation({
  args: {
    txHash: v.string(),
    chain: v.string(),
    telegramId: v.number(),
    amountCrypto: v.number(),
    amountUsd: v.number(),
    creditsCredited: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("processedChainTxs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
