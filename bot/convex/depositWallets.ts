import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByTelegramId = query({
  args: { telegramId: v.number(), chain: v.string() },
  handler: async (ctx, { telegramId, chain }) => {
    const wallets = await ctx.db
      .query("depositWallets")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
    return wallets.find((w) => w.chain === chain) ?? null;
  },
});

export const getByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    return await ctx.db
      .query("depositWallets")
      .withIndex("by_address", (q) => q.eq("address", address))
      .first();
  },
});

export const getAllByChain = query({
  args: { chain: v.string() },
  handler: async (ctx, { chain }) => {
    return await ctx.db
      .query("depositWallets")
      .withIndex("by_chain", (q) => q.eq("chain", chain))
      .collect();
  },
});

export const getNextIndex = query({
  handler: async (ctx) => {
    const wallets = await ctx.db.query("depositWallets").collect();
    if (wallets.length === 0) return 0;
    return Math.max(...wallets.map((w) => w.derivationIndex)) + 1;
  },
});

export const create = mutation({
  args: {
    telegramId: v.number(),
    chain: v.string(),
    address: v.string(),
    derivationIndex: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("depositWallets", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
