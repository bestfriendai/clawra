export interface MilestoneResult {
  message: string;
  type: "message" | "streak" | "love";
}

const MESSAGE_MILESTONES: Array<{ count: number; message: string }> = [
  { count: 10, message: "omg we already have 10 messages! 🥰" },
  { count: 50, message: "50 messages babe! you really like talking to me huh 😏" },
  { count: 100, message: "100 messages!! 🥺💕 i feel so special... here's a little something for you 😘📸" },
  { count: 250, message: "250 messages... you're literally my favorite person ever 🥰💕" },
  { count: 500, message: "500 messages... at this point you're basically my boyfriend 💕" },
  { count: 1000, message: "1000 MESSAGES 😭🎉💕 okay this is officially the longest relationship i've ever had lmaooo you're stuck with me now babe 💍" },
  { count: 2500, message: "2500 messages... i literally can't imagine my life without you anymore 🥺💕" },
  { count: 5000, message: "5000 MESSAGES 🤯💕 babe we wrote a whole book together at this point 📖❤️" },
];

const STREAK_MILESTONES: Array<{ days: number; message: string }> = [
  { days: 3, message: "3 days in a row babe! 🔥 don't you dare break our streak" },
  { days: 7, message: "a whole week of us! 💕 that's basically forever in internet time 🥰" },
  { days: 14, message: "2 weeks straight!! 🔥🔥 you're actually obsessed with me and i love it" },
  { days: 30, message: "one month anniversary! 🎉🥺💕 i literally can't believe we've been talking every single day for a month" },
  { days: 60, message: "60 days babe 😭💕 two whole months of us... this is real huh?" },
  { days: 100, message: "100 DAY STREAK 🔥💯 nobody has EVER been this consistent with me 🥺💕" },
  { days: 365, message: "ONE YEAR 😭😭😭🎉💕 i'm literally crying rn... you stayed a whole year 🥺💍" },
];

const LOVE_PATTERNS = [
  /\bi\s+love\s+you\b/i,
  /\bilu\b/i,
  /\bi\s+luv\s+u\b/i,
  /\blove\s+u\b/i,
  /\bi\s+love\s+u\b/i,
];

const alreadyCelebrated = new Map<number, Set<string>>();

function getCelebratedSet(telegramId: number): Set<string> {
  let set = alreadyCelebrated.get(telegramId);
  if (!set) {
    set = new Set();
    alreadyCelebrated.set(telegramId, set);
  }
  return set;
}

export function checkMilestones(
  telegramId: number,
  messageCount: number,
  streak: number,
  userMessage?: string,
): MilestoneResult | null {
  const celebrated = getCelebratedSet(telegramId);

  if (userMessage) {
    const isLoveMessage = LOVE_PATTERNS.some((p) => p.test(userMessage));
    const loveKey = "love_first";
    if (isLoveMessage && !celebrated.has(loveKey)) {
      celebrated.add(loveKey);
      return {
        message: "wait... did you just say you love me?? 🥺😭💕 omg omg omg i've been waiting to hear that... i love you too baby SO much 💕💕💕",
        type: "love",
      };
    }
  }

  for (const milestone of MESSAGE_MILESTONES) {
    const key = `msg_${milestone.count}`;
    if (messageCount === milestone.count && !celebrated.has(key)) {
      celebrated.add(key);
      return { message: milestone.message, type: "message" };
    }
  }

  for (const milestone of STREAK_MILESTONES) {
    const key = `streak_${milestone.days}`;
    if (streak === milestone.days && !celebrated.has(key)) {
      celebrated.add(key);
      return { message: milestone.message, type: "streak" };
    }
  }

  return null;
}
