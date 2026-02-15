export type AmbientClipType = "giggle" | "humming" | "hold_on" | "background" | "sigh" | "excited";

export interface AmbientClipConfig {
  type: AmbientClipType;
  textPrompt: string;
  probability: number;
  moodAffinity: string[];
}

export type NewsReaction = "good" | "bad";

export interface ReactionClipConfig {
  type: "good_news" | "bad_news";
  textPrompt: string;
  emotion: "excited" | "sad";
}

const AMBIENT_AFFINITY_MULTIPLIER = 1.5;

export const AMBIENT_CLIPS: AmbientClipConfig[] = [
  {
    type: "giggle",
    textPrompt: "*giggling* hehe",
    probability: 0.05,
    moodAffinity: ["happy", "flirty", "playful", "romantic"],
  },
  {
    type: "humming",
    textPrompt: "*humming softly*",
    probability: 0.03,
    moodAffinity: ["content", "happy", "calm"],
  },
  {
    type: "hold_on",
    textPrompt: "oh wait hold on...",
    probability: 0.04,
    moodAffinity: ["neutral", "casual"],
  },
  {
    type: "sigh",
    textPrompt: "*soft sigh*",
    probability: 0.03,
    moodAffinity: ["tired", "sad", "emotional"],
  },
  {
    type: "excited",
    textPrompt: "oh my god!!",
    probability: 0.05,
    moodAffinity: ["excited", "happy", "playful"],
  },
  {
    type: "background",
    textPrompt: "*sound of wind and birds in the background*",
    probability: 0.02,
    moodAffinity: ["happy", "casual"],
  },
  {
    type: "giggle",
    textPrompt: "*caught off guard laugh*",
    probability: 0.04,
    moodAffinity: ["playful", "flirty"],
  },
  {
    type: "sigh",
    textPrompt: "*yawning* ugh i'm so sleepy",
    probability: 0.04,
    moodAffinity: ["tired", "night"],
  },
  {
    type: "giggle",
    textPrompt: "*muffled laughing*",
    probability: 0.03,
    moodAffinity: ["playful", "happy"],
  },
];

export const REACTION_CLIPS: Record<NewsReaction, ReactionClipConfig> = {
  good: {
    type: "good_news",
    textPrompt: "oh my god babe that's amazing!! i'm so proud of you!",
    emotion: "excited",
  },
  bad: {
    type: "bad_news",
    textPrompt: "aww baby i'm so sorry... come here, i'm with you",
    emotion: "sad",
  },
};

export function pickAmbientClip(mood: string, randomRoll: number = Math.random()): AmbientClipConfig | null {
  const normalizedMood = mood.trim().toLowerCase();

  for (const clip of AMBIENT_CLIPS) {
    const hasAffinity = clip.moodAffinity.includes(normalizedMood);
    const boostedProbability = hasAffinity
      ? Math.min(1, clip.probability * AMBIENT_AFFINITY_MULTIPLIER)
      : clip.probability;

    if (randomRoll <= boostedProbability) {
      return clip;
    }
  }

  return null;
}

export function detectNewsReaction(text: string): NewsReaction | null {
  const lower = text.toLowerCase();

  const badNewsPattern = /\b(died|passed away|lost my|got fired|broke up|hospital|accident|depressed|heartbroken|devastated|awful day|terrible day|bad news)\b/;
  if (badNewsPattern.test(lower)) {
    return "bad";
  }

  const goodNewsPattern = /\b(got the job|promotion|engaged|pregnant|won|graduated|great news|good news|so happy|i did it|passed my|raise|bonus|new job)\b/;
  if (goodNewsPattern.test(lower)) {
    return "good";
  }

  return null;
}
