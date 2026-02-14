export interface ImageStyle {
  id: string;
  name: string;
  promptSuffix: string;
}

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "phone_selfie",
    name: "Phone Selfie",
    promptSuffix: "phone camera aesthetic, slight grain, casual lighting",
  },
  {
    id: "professional",
    name: "Professional",
    promptSuffix: "studio lighting, clean background, sharp focus",
  },
  {
    id: "polaroid",
    name: "Polaroid",
    promptSuffix: "vintage Polaroid aesthetic, warm tones, slight border",
  },
  {
    id: "golden_hour",
    name: "Golden Hour",
    promptSuffix: "warm golden hour sunlight, lens flare, soft shadows",
  },
  {
    id: "night_out",
    name: "Night Out",
    promptSuffix: "nightclub lighting, neon colors, slight motion blur",
  },
  {
    id: "bedroom",
    name: "Bedroom",
    promptSuffix: "soft warm lamp light, intimate atmosphere, cozy",
  },
  {
    id: "beach",
    name: "Beach",
    promptSuffix: "bright natural sunlight, ocean background, wind-blown hair",
  },
  {
    id: "rain",
    name: "Rain",
    promptSuffix: "wet hair, rain drops, moody lighting",
  },
  {
    id: "morning_light",
    name: "Morning Light",
    promptSuffix: "soft morning sun through window, bedsheets, peaceful",
  },
  {
    id: "noir",
    name: "Noir",
    promptSuffix: "black and white, high contrast, dramatic shadows",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    promptSuffix: "cinematic color grading, shallow depth of field, dynamic framing",
  },
  {
    id: "film",
    name: "Film",
    promptSuffix: "35mm film look, subtle halation, organic grain texture",
  },
];

export function getStyleById(id: string): ImageStyle | undefined {
  return IMAGE_STYLES.find((style) => style.id === id);
}

export function getRandomStyle(): ImageStyle {
  return IMAGE_STYLES[Math.floor(Math.random() * IMAGE_STYLES.length)];
}
