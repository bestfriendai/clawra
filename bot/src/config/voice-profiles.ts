export type MiniMaxEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  speed: number;
  pitch: number;
  emotion: string;
  bestFor: string[];
}

export interface VoiceEmotionOverride {
  speed?: number;
  pitch?: number;
  emotion: MiniMaxEmotion;
}

const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "sweet",
    name: "Sweet",
    description: "bright and cheerful girlfriend voice",
    voiceId: "Cute_Girl",
    speed: 1.0,
    pitch: 1,
    emotion: "happy",
    bestFor: ["good morning", "cute check-ins", "light playful chats"],
  },
  {
    id: "seductive",
    name: "Seductive",
    description: "breathy and magnetic",
    voiceId: "Wise_Woman",
    speed: 0.9,
    pitch: -1,
    emotion: "neutral",
    bestFor: ["late-night flirting", "slow teasing", "intimate voice notes"],
  },
  {
    id: "playful",
    name: "Playful",
    description: "high energy and bubbly",
    voiceId: "Cute_Girl",
    speed: 1.05,
    pitch: 2,
    emotion: "happy",
    bestFor: ["teasing", "cheeky banter", "excited moments"],
  },
  {
    id: "mature",
    name: "Mature",
    description: "deep and sultry",
    voiceId: "Mature_Woman",
    speed: 0.9,
    pitch: -3,
    emotion: "neutral",
    bestFor: ["confident reassurance", "slow romance", "after-dark tone"],
  },
  {
    id: "asmr",
    name: "ASMR",
    description: "whisper-like and calming",
    voiceId: "Calm_Woman",
    speed: 0.8,
    pitch: -2,
    emotion: "neutral",
    bestFor: ["comfort", "night-time messages", "soft intimacy"],
  },
  {
    id: "dominant",
    name: "Dominant",
    description: "commanding and intense",
    voiceId: "Strong_Woman",
    speed: 0.95,
    pitch: -4,
    emotion: "neutral",
    bestFor: ["assertive roleplay", "direct confidence", "firm guidance"],
  },
  {
    id: "shy",
    name: "Shy",
    description: "quiet and gentle",
    voiceId: "Soft_Girl",
    speed: 0.9,
    pitch: 0,
    emotion: "neutral",
    bestFor: ["gentle affection", "soft reassurance", "sweet vulnerability"],
  },
  {
    id: "girlfriend-next-door",
    name: "Girlfriend Next Door",
    description: "casual and warm",
    voiceId: "Natural_Woman",
    speed: 1.0,
    pitch: 0,
    emotion: "neutral",
    bestFor: ["daily chats", "natural replies", "relaxed vibe"],
  },
];

const DEFAULT_PROFILE_ID = "sweet";

const EMOTION_OVERRIDES: Record<string, VoiceEmotionOverride> = {
  happy: { emotion: "happy", speed: 1.0 },
  sad: { emotion: "sad", speed: 0.75 },
  flirty: { emotion: "neutral", speed: 0.85 },
  excited: { emotion: "happy", speed: 1.1 },
  angry: { emotion: "angry", speed: 0.95 },
  loving: { emotion: "neutral", pitch: -3, speed: 0.9 },
};

export function getVoiceProfile(profileId?: string): VoiceProfile {
  if (!profileId) {
    return getDefaultVoiceProfile();
  }

  return VOICE_PROFILES.find((profile) => profile.id === profileId) ?? getDefaultVoiceProfile();
}

export function getDefaultVoiceProfile(): VoiceProfile {
  return VOICE_PROFILES.find((profile) => profile.id === DEFAULT_PROFILE_ID) ?? VOICE_PROFILES[0]!;
}

export function getAllVoiceProfiles(): VoiceProfile[] {
  return [...VOICE_PROFILES];
}

export function getVoiceProfileForEmotion(emotion: string): VoiceEmotionOverride {
  return EMOTION_OVERRIDES[emotion] ?? { emotion: "neutral" };
}
