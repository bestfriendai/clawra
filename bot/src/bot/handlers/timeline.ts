import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import {
  formatEventTimeline,
  getAnniversaryMessage,
  getDaysSinceEvent,
} from "../../services/relationship-events.js";

export async function handleTimeline(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const [events, anniversaries] = await Promise.all([
    convex.getUserRelationshipEvents(telegramId),
    convex.getUpcomingAnniversaries(telegramId),
  ]);

  const girlfriendName = ctx.girlfriend?.name || "her";
  const timeline = formatEventTimeline(events);

  let upcomingLine = "No anniversary today yet... go make a new memory together 💕";
  if (anniversaries.length > 0) {
    const anniversary = anniversaries
      .map((event) => ({ event, daysSince: getDaysSinceEvent(event.eventDate) }))
      .sort((a, b) => b.daysSince - a.daysSince)[0];

    upcomingLine = getAnniversaryMessage(anniversary.event.eventType, anniversary.daysSince);
  }

  await ctx.reply(
    `Your Story with ${girlfriendName} 💕\n\n${timeline}\n\n🎉 Anniversary check: ${upcomingLine}`
  );
}
