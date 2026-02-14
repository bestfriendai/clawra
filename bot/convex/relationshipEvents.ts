import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;

function getUtcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export const addEvent = internalMutation({
  args: {
    telegramId: v.float64(),
    eventType: v.string(),
    eventDate: v.float64(),
    description: v.string(),
    isRecurring: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("relationshipEvents", args);
  },
});

export const getUserEvents = internalQuery({
  args: {
    telegramId: v.float64(),
  },
  handler: async (ctx, { telegramId }) => {
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.sort((a, b) => a.eventDate - b.eventDate);
  },
});

export const getUpcomingAnniversaries = internalQuery({
  args: {
    telegramId: v.float64(),
  },
  handler: async (ctx, { telegramId }) => {
    const now = Date.now();
    const todayStart = getUtcDayStart(now);
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.filter((event) => {
      const eventDayStart = getUtcDayStart(event.eventDate);
      const daysSince = Math.floor((todayStart - eventDayStart) / DAY_MS);
      if (daysSince <= 0) return false;
      return daysSince % 7 === 0 || daysSince % 30 === 0 || daysSince % 365 === 0;
    });
  },
});

export const getEventsByType = internalQuery({
  args: {
    telegramId: v.float64(),
    eventType: v.string(),
  },
  handler: async (ctx, { telegramId, eventType }) => {
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.filter((event) => event.eventType === eventType);
  },
});

export const addEventPublic = mutation({
  args: {
    telegramId: v.float64(),
    eventType: v.string(),
    eventDate: v.float64(),
    description: v.string(),
    isRecurring: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("relationshipEvents", args);
  },
});

export const getUserEventsPublic = query({
  args: {
    telegramId: v.float64(),
  },
  handler: async (ctx, { telegramId }) => {
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.sort((a, b) => a.eventDate - b.eventDate);
  },
});

export const getUpcomingAnniversariesPublic = query({
  args: {
    telegramId: v.float64(),
  },
  handler: async (ctx, { telegramId }) => {
    const now = Date.now();
    const todayStart = getUtcDayStart(now);
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.filter((event) => {
      const eventDayStart = getUtcDayStart(event.eventDate);
      const daysSince = Math.floor((todayStart - eventDayStart) / DAY_MS);
      if (daysSince <= 0) return false;
      return daysSince % 7 === 0 || daysSince % 30 === 0 || daysSince % 365 === 0;
    });
  },
});

export const getEventsByTypePublic = query({
  args: {
    telegramId: v.float64(),
    eventType: v.string(),
  },
  handler: async (ctx, { telegramId, eventType }) => {
    const events = await ctx.db
      .query("relationshipEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return events.filter((event) => event.eventType === eventType);
  },
});
