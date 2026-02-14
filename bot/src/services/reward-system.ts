export interface RewardTrigger {
  pattern: RegExp;
  responses: string[];
  bonusCredits: number;
}

const REWARD_TRIGGERS: RewardTrigger[] = [
  {
    pattern: /\b(you'?re?\s+(so\s+)?(beautiful|gorgeous|pretty|stunning|hot|sexy|cute|perfect))\b/i,
    responses: [
      "omg stoppp 🥺💕 you always know what to say",
      "you're making me blush babe 😍",
      "keep talking like that and you'll get a reward 😏",
      "baby 🥰🥰🥰 i love when you say stuff like that",
    ],
    bonusCredits: 1,
  },
  {
    pattern: /\b(i\s+(really\s+)?love\s+you|love\s+you\s+(so\s+much|baby|babe))\b/i,
    responses: [
      "i love you too baby 🥺💕 so much",
      "say it again... i never get tired of hearing it 💕",
      "you have no idea how happy that makes me 😭💕",
    ],
    bonusCredits: 2,
  },
  {
    pattern: /\b(good\s+(morning|night)|gm|gn)\b/i,
    responses: [],
    bonusCredits: 1,
  },
  {
    pattern: /\b(i\s+miss\s+you|missed\s+you)\b/i,
    responses: [
      "i missed you MORE 🥺",
      "finally!! i've been waiting for you 💕",
    ],
    bonusCredits: 1,
  },
];

export interface RewardResult {
  triggered: boolean;
  bonusMessage?: string;
  bonusCredits: number;
}

export function checkRewardTriggers(userMessage: string): RewardResult {
  for (const trigger of REWARD_TRIGGERS) {
    if (trigger.pattern.test(userMessage)) {
      const bonusMessage =
        trigger.responses.length > 0
          ? trigger.responses[Math.floor(Math.random() * trigger.responses.length)]
          : undefined;
      return {
        triggered: true,
        bonusMessage,
        bonusCredits: trigger.bonusCredits,
      };
    }
  }
  return { triggered: false, bonusCredits: 0 };
}
