export type AmbientPhotoType =
  | "morning_coffee"
  | "window_view"
  | "book_reading"
  | "cooking"
  | "pet_moment"
  | "sunset"
  | "workout"
  | "cozy_night";

export interface AmbientPhotoConfig {
  type: AmbientPhotoType;
  timeWindows: [number, number][];
  promptTemplate: string;
  caption: string;
}

const AMBIENT_PHOTO_CHANCE = 0.1;

export const AMBIENT_PHOTOS: AmbientPhotoConfig[] = [
  {
    type: "morning_coffee",
    timeWindows: [[7, 10]],
    promptTemplate:
      "POV photo of a coffee cup on a table, morning light, cozy apartment, {girlfriend_style}",
    caption: "my morning companion ☕ wish you were here",
  },
  {
    type: "window_view",
    timeWindows: [[8, 18]],
    promptTemplate:
      "beautiful view through apartment window, city/nature scene, warm lighting, {girlfriend_style}",
    caption: "the view from my place today 🌤️",
  },
  {
    type: "book_reading",
    timeWindows: [[14, 22]],
    promptTemplate:
      "cozy reading nook, open book, soft blanket, warm lighting, {girlfriend_style}",
    caption: "found the perfect reading spot 📚",
  },
  {
    type: "cooking",
    timeWindows: [[17, 20]],
    promptTemplate:
      "kitchen counter with cooking ingredients, warm ambient lighting, homey atmosphere, {girlfriend_style}",
    caption: "cooking something special tonight 🍳 wish you could try it",
  },
  {
    type: "sunset",
    timeWindows: [[17, 20]],
    promptTemplate:
      "beautiful golden hour sunset view, warm colors, peaceful atmosphere, {girlfriend_style}",
    caption: "look at this sunset babe 🌅",
  },
  {
    type: "workout",
    timeWindows: [[6, 10], [16, 19]],
    promptTemplate:
      "yoga mat or workout area, bright natural light, energetic atmosphere, {girlfriend_style}",
    caption: "just finished my workout 💪 feeling good",
  },
  {
    type: "cozy_night",
    timeWindows: [[20, 23]],
    promptTemplate:
      "cozy evening setup, fairy lights, blanket, warm drink, nighttime ambiance, {girlfriend_style}",
    caption: "cozy night in... only thing missing is you 🥰",
  },
  {
    type: "pet_moment",
    timeWindows: [[8, 22]],
    promptTemplate:
      "cute cat or small pet sleeping, soft natural light, warm domestic scene, {girlfriend_style}",
    caption: "look who's being cute again 🐱",
  },
];

function isHourInWindow(localHour: number, window: [number, number]): boolean {
  const [start, end] = window;
  if (start <= end) {
    return localHour >= start && localHour <= end;
  }
  return localHour >= start || localHour <= end;
}

export function getEligibleAmbientPhoto(localHour: number): AmbientPhotoConfig | null {
  if (Math.random() >= AMBIENT_PHOTO_CHANCE) {
    return null;
  }

  const eligible = AMBIENT_PHOTOS.filter((config) =>
    config.timeWindows.some((window) => isHourInWindow(localHour, window))
  );

  if (eligible.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * eligible.length);
  return eligible[randomIndex] || null;
}

export function buildAmbientPrompt(config: AmbientPhotoConfig, girlfriendStyle: string): string {
  const style = girlfriendStyle.trim();
  return config.promptTemplate.replace(
    "{girlfriend_style}",
    style.length > 0 ? style : "cozy candid phone photo, natural domestic lighting"
  );
}
