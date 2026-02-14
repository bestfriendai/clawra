const TIP_BY_MESSAGE_COUNT: Record<number, string> = {
  3: "💡 tip: you can ask me to send you pics anytime! just say 'send a pic' or 'take a selfie'",
  7: "💡 tip: try /fantasy for roleplay mode... it gets spicy 😏",
  12: "💡 tip: I can send voice notes too! say 'send me a voice note'",
  20: "💡 tip: use /mood to see how our relationship is growing 💕",
};

const shownTipsByUser = new Map<number, Set<number>>();

export function getFirstTimeTip(
  messageCount: number,
  telegramId?: number
): string | null {
  if (messageCount === 1) return null;
  if (messageCount > 20) return null;

  const tip = TIP_BY_MESSAGE_COUNT[messageCount];
  if (!tip) return null;

  if (telegramId === undefined) {
    return tip;
  }

  const shown = shownTipsByUser.get(telegramId) ?? new Set<number>();
  if (shown.has(messageCount)) {
    return null;
  }

  shown.add(messageCount);
  shownTipsByUser.set(telegramId, shown);
  return tip;
}
