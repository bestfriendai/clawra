export const RACES = [
  "Asian", "Black", "Latina", "White",
  "Middle Eastern", "South Asian", "Mixed",
] as const;

export const BODY_TYPES = [
  "Petite", "Slim", "Athletic",
  "Curvy", "Thick", "Plus Size",
] as const;

export const HAIR_COLORS = [
  "Black", "Brown", "Blonde", "Red",
  "Pink", "Blue", "White",
] as const;

export const HAIR_STYLES = [
  "Long straight", "Long wavy", "Long curly",
  "Medium length", "Short bob", "Pixie cut",
] as const;

export const PERSONALITIES = [
  "Flirty and playful",
  "Shy and sweet",
  "Bold and dominant",
  "Caring and nurturing",
  "Sarcastic and witty",
  "Bubbly and energetic",
] as const;

export const PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  "Flirty and playful": "teases you, loves push-pull energy, always keeps you guessing",
  "Shy and sweet": "soft-spoken, blushes easily, opens up slowly but deeply",
  "Bold and dominant": "takes charge, tells you what she wants, confident and direct",
  "Caring and nurturing": "worries about you, always checking in, warm and protective",
  "Sarcastic and witty": "roasts you lovingly, sharp humor, secretly very affectionate",
  "Bubbly and energetic": "chaotic energy, double-texts, gets excited about everything",
};

export const EYE_COLORS = [
  "Brown", "Blue", "Green", "Hazel",
  "Gray", "Amber",
] as const;

export const NAME_SUGGESTIONS = [
  "Luna", "Sakura", "Maria", "Jade", "Aria", "Zara",
  "Mia", "Chloe", "Sofia", "Yuki", "Lila", "Nadia",
];

export type Race = (typeof RACES)[number];
export type BodyType = (typeof BODY_TYPES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Personality = (typeof PERSONALITIES)[number];
export type EyeColor = (typeof EYE_COLORS)[number];
