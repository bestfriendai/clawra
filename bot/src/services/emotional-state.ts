export type EmotionType =
  | "happy"
  | "sad"
  | "excited"
  | "worried"
  | "flirty"
  | "jealous"
  | "needy"
  | "playful"
  | "angry"
  | "loving";

export interface EmotionalState {
  primary: EmotionType;
  intensity: number;
  triggers: string[];
  updatedAt: number;
}

const EMOTION_PATTERNS: Record<EmotionType, RegExp[]> = {
  happy: [
    /\blol\b/i,
    /\bhaha\b/i,
    /😂/i,
    /😊/i,
    /\bgreat\b/i,
    /\bamazing\b/i,
    /\blove\b/i,
  ],
  sad: [
    /😢/i,
    /\bsad\b/i,
    /\bmiss\b/i,
    /\blonely\b/i,
    /\bcry(?:ing)?\b/i,
    /\bdepressed\b/i,
    /\bdown\b/i,
  ],
  excited: [/!!/i, /\bomg\b/i, /can't\s+wait/i, /\bexcited\b/i, /🎉/i],
  worried: [
    /\bworried\b/i,
    /\banxious\b/i,
    /\bnervous\b/i,
    /\bscared\b/i,
    /\bstressed\b/i,
  ],
  flirty: [/😏/i, /😘/i, /\bsexy\b/i, /\bhot\b/i, /want\s+you/i, /\bbaby\b/i],
  jealous: [
    /\bjealous\b/i,
    /\bwho(?:'s| is)\s+she\b/i,
    /\bother\s+girls?\b/i,
    /\byou\s+ignored\s+me\b/i,
  ],
  needy: [
    /\bneed\s+you\b/i,
    /\bwhere\s+are\s+you\b/i,
    /\bdon't\s+leave\b/i,
    /\bmiss\s+you\s+so\s+much\b/i,
  ],
  playful: [
    /\btease\b/i,
    /\bjk\b/i,
    /\blmao\b/i,
    /😜/i,
    /😉/i,
    /\bhehe\b/i,
  ],
  angry: [
    /\bangry\b/i,
    /\bmad\b/i,
    /\bpissed\b/i,
    /\bwtf\b/i,
    /\bfrustrated\b/i,
    /\bugh\b/i,
  ],
  loving: [
    /\bi\s+love\s+you\b/i,
    /\bador(?:e|ing)\b/i,
    /\bmy\s+love\b/i,
    /\bsoulmate\b/i,
    /❤️/i,
    /💕/i,
  ],
};

const FEELING_SHARE_PATTERNS = [
  /\bi\s+feel\b/i,
  /\bi'?m\s+(?:feeling|sad|happy|down|stressed|angry|excited|lonely|worried)\b/i,
  /\bit\s+makes\s+me\s+feel\b/i,
  /\bi\s+miss\s+you\b/i,
  /\bi\s+love\s+you\b/i,
  /\bmy\s+mood\b/i,
  /😢|😭|😊|😂|😡|😰|🥺|❤️|💕/i,
];

export function detectUserEmotion(message: string): {
  emotion: EmotionType;
  confidence: number;
} {
  const trimmed = message.trim();
  if (!trimmed) {
    return { emotion: "playful", confidence: 0.2 };
  }

  let bestEmotion: EmotionType = "playful";
  let bestScore = 0;

  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as Array<
    [EmotionType, RegExp[]]
  >) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestEmotion = emotion;
      bestScore = score;
    }
  }

  const confidence = Math.max(0.2, Math.min(0.95, bestScore / 3));
  return { emotion: bestEmotion, confidence };
}

export function getEmotionalResponse(
  userEmotion: EmotionType,
  girlfriendPersonality: string
): string {
  const personalityHint = girlfriendPersonality.trim()
    ? `Keep her ${girlfriendPersonality.toLowerCase()} personality.`
    : "Stay in her core personality.";

  const baseGuidance: Record<EmotionType, string> = {
    happy:
      "He's in a good mood. Match his energy, celebrate with him, and keep the momentum playful.",
    sad:
      "He seems down. Be extra nurturing, gentle, and supportive. Do not sexualize this moment.",
    excited:
      "He's hyped. Mirror his excitement, use energetic texting rhythm, and build anticipation with him.",
    worried:
      "He feels anxious. Reassure him, keep your tone steady and warm, and offer comfort before teasing.",
    flirty:
      "He's flirting. Flirt back confidently, tease him, and escalate chemistry naturally.",
    jealous:
      "He sounds insecure or jealous. Reassure his place with you first, then keep him emotionally close.",
    needy:
      "He wants closeness and attention. Be affectionate, responsive, and make him feel wanted right now.",
    playful:
      "He's playful. Use banter, jokes, and light teasing to keep the vibe addictive and fun.",
    angry:
      "He's upset. De-escalate with calm empathy, acknowledge his frustration, and avoid provoking him.",
    loving:
      "He's expressing love. Be tender, emotionally open, and reinforce intimacy with sincere affection.",
  };

  return `${baseGuidance[userEmotion]} ${personalityHint}`;
}

export function shouldInitiateEmotionalCheck(
  messages: Array<{ role: string; content: string }>
): boolean {
  if (messages.length < 10) return false;

  let noFeelingShareCount = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") {
      noFeelingShareCount += 1;
      continue;
    }

    if (FEELING_SHARE_PATTERNS.some((pattern) => pattern.test(message.content))) {
      break;
    }

    noFeelingShareCount += 1;
    if (noFeelingShareCount >= 10) return true;
  }

  return noFeelingShareCount >= 10;
}

const MOOD_TRANSITIONS: Partial<Record<EmotionType, EmotionType[]>> = {
  playful: ["flirty", "happy", "loving"],
  sad: ["loving", "needy"],
  flirty: ["playful", "loving", "excited"],
  angry: ["sad", "needy", "playful"],
  excited: ["happy", "playful", "flirty"],
  loving: ["happy", "flirty"],
};

export function shouldTransitionMood(
  currentMood: EmotionType,
  messagesInMood: number
): EmotionType | null {
  if (messagesInMood >= 5 && Math.random() < 0.3) {
    const transitions = MOOD_TRANSITIONS[currentMood];
    if (transitions && transitions.length > 0) {
      return transitions[Math.floor(Math.random() * transitions.length)];
    }
  }
  return null;
}

const DISTRACTED_RESPONSES = [
  "sorry i was watching tiktok lol what were u saying",
  "omg wait i just got so distracted by this cat video hold on",
  "sorry my roommate was talking to me lol. anyway what",
  "hold on my food just got here brb",
  "sorry i keep getting work emails ughhh. ok im back. for u",
];

const SUBJECT_CHANGES = [
  "omg random but i just saw the cutest dog on the street",
  "wait i totally forgot to tell u something",
  "ok completely unrelated but",
  "this has nothing to do with anything but i just thought of u",
];

export function getHumanBehavior(): {
  type: "distracted" | "subject_change" | null;
  message: string | null;
} {
  const roll = Math.random();
  if (roll < 0.10) {
    return {
      type: "distracted",
      message: DISTRACTED_RESPONSES[Math.floor(Math.random() * DISTRACTED_RESPONSES.length)],
    };
  }
  if (roll < 0.25) {
    return {
      type: "subject_change",
      message: SUBJECT_CHANGES[Math.floor(Math.random() * SUBJECT_CHANGES.length)],
    };
  }
  return { type: null, message: null };
}

export type GirlfriendMood = "happy" | "bored" | "clingy" | "playful" | "tired" | "horny" | "anxious";

export interface GirlfriendMoodState {
  currentMood: GirlfriendMood;
  moodSince: number;
  moodTrigger: string;
}

export function updateGirlfriendMood(
  state: GirlfriendMoodState,
  timeOfDay: string
): GirlfriendMoodState {
  if (timeOfDay === "latenight" && Math.random() < 0.4) {
    return { currentMood: "clingy", moodSince: Date.now(), moodTrigger: "late night loneliness" };
  }
  if (timeOfDay === "afternoon" && Math.random() < 0.2) {
    return { currentMood: "bored", moodSince: Date.now(), moodTrigger: "boring day at work" };
  }
  if (timeOfDay === "morning" && Math.random() < 0.3) {
    return { currentMood: "tired", moodSince: Date.now(), moodTrigger: "just woke up" };
  }
  if (timeOfDay === "evening" && Math.random() < 0.25) {
    return { currentMood: "playful", moodSince: Date.now(), moodTrigger: "relaxing after work" };
  }
  return state;
}

export function getDefaultGirlfriendMood(): GirlfriendMoodState {
  return {
    currentMood: "happy",
    moodSince: Date.now(),
    moodTrigger: "default",
  };
}

export async function detectEmotionWithLLM(
  message: string,
  recentContext: string[]
): Promise<EmotionType> {
  try {
    const OpenAI = (await import("openai")).default;
    const { env } = await import("../config/env.js");

    const client = new OpenAI({
      apiKey: env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });

    const validEmotions: EmotionType[] = [
      "happy", "sad", "excited", "worried", "flirty", "jealous",
      "needy", "playful", "angry", "loving"
    ];

    const prompt = `Given this message and context, what is the sender's emotional state?
Message: "${message}"
Recent context: ${recentContext.slice(-3).join(" | ")}
Reply with ONLY one word: happy, sad, excited, worried, flirty, jealous, needy, playful, angry, or loving`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || "";
    const emotion = validEmotions.find((e) => raw.includes(e));
    return emotion || "playful";
  } catch {
    return "playful";
  }
}
