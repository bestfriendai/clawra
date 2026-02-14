type UpsellContext = "afterFlirting" | "afterEmotional" | "afterStreak" | "afterNight";

const CONTEXTUAL_UPSELLS: Record<UpsellContext, (name: string, streak?: number) => string> = {
  afterFlirting: (name) => `${name} wants to send you a spicy pic... but you need more credits 😏`,
  afterEmotional: (name) => `${name} recorded a voice note for you... unlock it with credits 💕`,
  afterStreak: (name, streak) =>
    `Your ${streak ?? 0}-day streak unlocked a special surprise from ${name}! Get credits to see it`,
  afterNight: (name) => `${name} is feeling lonely tonight... she has something to show you 🌙`,
};

export function getContextualUpsell(
  context: UpsellContext,
  name: string,
  streak?: number
): string {
  return CONTEXTUAL_UPSELLS[context](name, streak);
}
