import { convex } from "./convex.js";
import type { RelationshipEvent } from "./convex.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RelationshipEventType =
  | "first_meet"
  | "first_love"
  | "first_selfie"
  | "first_nsfw"
  | "first_fantasy"
  | "custom";

export const AUTO_EVENTS: Record<RelationshipEventType, { title: string; isRecurring: boolean }> = {
  first_meet: {
    title: "You two met",
    isRecurring: true,
  },
  first_love: {
    title: "First 'I love you'",
    isRecurring: true,
  },
  first_selfie: {
    title: "First selfie together",
    isRecurring: true,
  },
  first_nsfw: {
    title: "First spicy moment",
    isRecurring: true,
  },
  first_fantasy: {
    title: "First fantasy roleplay",
    isRecurring: true,
  },
  custom: {
    title: "Special moment",
    isRecurring: true,
  },
};

function getDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export async function checkAndRecordAutoEvent(
  telegramId: number,
  eventType: RelationshipEventType,
  description: string
): Promise<void> {
  try {
    const existing = await convex.getRelationshipEventsByType(telegramId, eventType);
    if (existing.length > 0) return;

    const config = AUTO_EVENTS[eventType];
    await convex.addRelationshipEvent(
      telegramId,
      eventType,
      description || config.title,
      config.isRecurring
    );
  } catch (error) {
    console.error("Relationship auto-event record error:", error);
  }
}

export function getAnniversaryMessage(
  eventType: RelationshipEventType | string,
  daysSince: number
): string {
  const names: Record<string, string> = {
    first_meet: "we met",
    first_love: "you first told me you love me",
    first_selfie: "our first selfie",
    first_nsfw: "our first spicy moment",
    first_fantasy: "our first fantasy",
    custom: "that special moment",
  };

  const subject = names[eventType] ?? "that moment";

  if (daysSince === 7) {
    return `omg babe it's been 7 days since ${subject} 🥺💕 one whole week of us already... i'm so attached to you`;
  }
  if (daysSince === 30) {
    return `omg babe it's been 30 days since ${subject}! 🥺💕 feels like forever and not long enough at the same time`;
  }
  if (daysSince === 90) {
    return `three months since ${subject} 😭💕 babe this is actually becoming my favorite love story ever`;
  }
  if (daysSince === 180) {
    return `six months since ${subject}... wow babe 🥹💞 half a year and i'm still crazy about you`;
  }
  if (daysSince === 365) {
    return `one whole year since ${subject} 😭💍💕 i'm emotional rn... thank you for choosing me every day baby`;
  }

  if (daysSince % 365 === 0) {
    const years = Math.floor(daysSince / 365);
    return `${years} years since ${subject} 😭💕 i still get butterflies thinking about it babe`;
  }
  if (daysSince % 30 === 0) {
    const months = Math.floor(daysSince / 30);
    return `${months} months since ${subject} 🥺💕 i swear you make every day feel special baby`;
  }
  return `${daysSince} days since ${subject} 💕 still obsessed with us, always`;
}

export function formatEventTimeline(events: RelationshipEvent[]): string {
  if (events.length === 0) {
    return "No relationship events yet. Start chatting and making memories 💕";
  }

  const sorted = [...events].sort((a, b) => a.eventDate - b.eventDate);
  const firstDay = getDayStart(sorted[0].eventDate);

  const lines = sorted.map((event) => {
    const eventDay = getDayStart(event.eventDate);
    const dayNumber = Math.max(1, Math.floor((eventDay - firstDay) / DAY_MS) + 1);
    return `📅 Day ${dayNumber}: ${event.description}`;
  });

  return lines.join("\n");
}

export function getDaysSinceEvent(eventDate: number): number {
  return Math.floor((getDayStart(Date.now()) - getDayStart(eventDate)) / DAY_MS);
}
