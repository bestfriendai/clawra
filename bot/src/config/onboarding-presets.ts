import type {
  BodyType,
  EyeColor,
  HairColor,
  HairStyle,
  Personality,
  Race,
} from "./girlfriend-options.js";

export interface OnboardingPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  name: string;
  age: number;
  race: Race;
  bodyType: BodyType;
  hairColor: HairColor;
  hairStyle: HairStyle;
  eyeColor: EyeColor;
  personality: Personality;
}

export const ONBOARDING_PRESETS: readonly OnboardingPreset[] = [
  {
    id: "sunset_flirt",
    label: "Sunset Flirt",
    emoji: "💋",
    description: "playful, bold chemistry with a confident vibe",
    name: "Luna",
    age: 21,
    race: "Latina",
    bodyType: "Curvy",
    hairColor: "Brown",
    hairStyle: "Long wavy",
    eyeColor: "Hazel",
    personality: "Flirty and playful",
  },
  {
    id: "sweet_muse",
    label: "Sweet Muse",
    emoji: "🌸",
    description: "soft, romantic, and emotionally warm",
    name: "Yuki",
    age: 22,
    race: "Asian",
    bodyType: "Slim",
    hairColor: "Black",
    hairStyle: "Long straight",
    eyeColor: "Brown",
    personality: "Shy and sweet",
  },
  {
    id: "boss_energy",
    label: "Boss Energy",
    emoji: "🔥",
    description: "direct, intense, and high-confidence energy",
    name: "Zara",
    age: 25,
    race: "White",
    bodyType: "Athletic",
    hairColor: "Blonde",
    hairStyle: "Medium length",
    eyeColor: "Blue",
    personality: "Bold and dominant",
  },
  {
    id: "cozy_caretaker",
    label: "Cozy Caretaker",
    emoji: "💛",
    description: "supportive, nurturing, and deeply attentive",
    name: "Nadia",
    age: 24,
    race: "Middle Eastern",
    bodyType: "Thick",
    hairColor: "Black",
    hairStyle: "Long curly",
    eyeColor: "Green",
    personality: "Caring and nurturing",
  },
] as const;

export function getOnboardingPreset(id: string): OnboardingPreset | undefined {
  return ONBOARDING_PRESETS.find((preset) => preset.id === id);
}
