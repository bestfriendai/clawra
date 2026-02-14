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

export const NAME_SUGGESTIONS = ["Luna", "Sakura", "Maria", "Jade", "Aria", "Zara"];

export type Race = (typeof RACES)[number];
export type BodyType = (typeof BODY_TYPES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Personality = (typeof PERSONALITIES)[number];
