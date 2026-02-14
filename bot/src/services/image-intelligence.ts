import type { GirlfriendProfile } from "../types/context.js";

const SCENE_TYPES = [
  "indoor",
  "outdoor",
  "bedroom",
  "bathroom",
  "gym",
  "kitchen",
  "studio",
  "nature",
] as const;

type SceneType = typeof SCENE_TYPES[number];

const LIGHTING_TERMS = [
  "golden hour",
  "rim light",
  "softbox",
  "lamplight",
  "window light",
  "low-key",
  "backlit",
  "sunset glow",
  "studio lighting",
  "cinematic lighting",
];

const CAMERA_TERMS = [
  "85mm",
  "50mm",
  "35mm",
  "f/1.4",
  "f/1.8",
  "f/2.8",
  "canon",
  "sony",
  "nikon",
  "bokeh",
  "depth of field",
  "raw photo",
];

const SKIN_TERMS = [
  "subsurface scattering",
  "visible pores",
  "skin texture",
  "micro-skin details",
  "natural skin translucency",
  "skin grain",
];

const COMPOSITION_TERMS = [
  "rule of thirds",
  "leading lines",
  "shallow depth of field",
  "off-center composition",
  "portrait orientation",
  "negative space",
];

const REALISM_TERMS = [
  "photorealistic",
  "hyperrealistic",
  "8k",
  "raw photo",
  "unedited",
  "lifelike",
  "realistic",
];

const IMPERFECTION_TERMS = [
  "slight blemish",
  "natural asymmetry",
  "flyaway hair",
  "unretouched",
  "no beauty filter",
  "skin variation",
];

const ENVIRONMENT_TERMS = [
  "bedroom",
  "kitchen",
  "bathroom",
  "studio",
  "balcony",
  "coffee shop",
  "window",
  "curtains",
  "sheets",
  "silk",
  "linen",
  "denim",
  "leather",
  "wool",
  "velvet",
];

export interface SceneVarietyResult {
  recentSceneTypes: SceneType[];
  preferredSceneType: SceneType;
  preferredAngles: string[];
  preferredLighting: string[];
  suggestionSuffix: string;
}

export interface PromptScoreBreakdown {
  total: number;
  lighting: number;
  camera: number;
  skin: number;
  composition: number;
  realism: number;
  imperfections: number;
  environment: number;
}

export interface PromptEnhancementProfile {
  telegramId?: number;
  slotIndex?: number;
  timezoneOffsetMinutes?: number;
  profile?: Partial<Pick<GirlfriendProfile, "name" | "race" | "bodyType" | "hairColor" | "hairStyle">>;
}

function hasAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function getSceneType(prompt: string): SceneType | undefined {
  const lower = prompt.toLowerCase();
  if (/\b(bed|bedroom|sheets|pillow)\b/.test(lower)) return "bedroom";
  if (/\b(shower|bathroom|tub|steam)\b/.test(lower)) return "bathroom";
  if (/\b(gym|workout|fitness|weights)\b/.test(lower)) return "gym";
  if (/\b(kitchen|cook|baking)\b/.test(lower)) return "kitchen";
  if (/\b(studio|softbox|backdrop)\b/.test(lower)) return "studio";
  if (/\b(beach|park|forest|mountain|nature|lake)\b/.test(lower)) return "nature";
  if (/\b(outdoor|street|balcony|sunset|sunrise)\b/.test(lower)) return "outdoor";
  if (/\b(indoor|living room|couch|window)\b/.test(lower)) return "indoor";
  return undefined;
}

function toPositiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function getImageSeed(telegramId: number, profileSlotIndex: number = 0): number {
  const raw = telegramId * 7919 + profileSlotIndex * 1013;
  const seed = toPositiveMod(raw, 2147483647);
  return seed === 0 ? 2147483646 : seed;
}

export function getSceneVariety(telegramId: number, recentPrompts: string[]): SceneVarietyResult {
  const extracted = recentPrompts
    .slice(-5)
    .map((prompt) => getSceneType(prompt))
    .filter((scene): scene is SceneType => Boolean(scene));

  const unused = SCENE_TYPES.filter((scene) => !extracted.includes(scene));
  const seed = getImageSeed(telegramId);
  const preferredPool = unused.length > 0 ? unused : SCENE_TYPES;
  const preferredSceneType = preferredPool[toPositiveMod(seed + extracted.length, preferredPool.length)];

  const angleMap: Record<SceneType, string[]> = {
    indoor: ["waist-level candid angle", "off-center handheld framing"],
    outdoor: ["slightly low-angle perspective", "sun-flare over-shoulder shot"],
    bedroom: ["top-down bedsheet selfie", "mirror edge framing"],
    bathroom: ["fogged mirror selfie", "close side-profile angle"],
    gym: ["full-body mirror stance", "dynamic mid-motion angle"],
    kitchen: ["countertop candid framing", "window-side three-quarter angle"],
    studio: ["clean portrait framing", "editorial close-up angle"],
    nature: ["wide environmental portrait", "foreground foliage framing"],
  };

  const lightingMap: Record<SceneType, string[]> = {
    indoor: ["soft practical room lighting", "window bounce fill"],
    outdoor: ["golden hour rim light", "bright natural daylight"],
    bedroom: ["warm bedside lamp glow", "soft curtain-filtered sunlight"],
    bathroom: ["diffused vanity light", "moody low-light ambience"],
    gym: ["mixed cool overhead lighting", "high-contrast athletic highlights"],
    kitchen: ["clean daylight from window", "warm under-cabinet practicals"],
    studio: ["large softbox key", "controlled rim light"],
    nature: ["backlit sun through trees", "open-shade natural skin tones"],
  };

  const preferredAngles = angleMap[preferredSceneType];
  const preferredLighting = lightingMap[preferredSceneType];

  return {
    recentSceneTypes: extracted,
    preferredSceneType,
    preferredAngles,
    preferredLighting,
    suggestionSuffix: `Scene variety: switch to ${preferredSceneType} setting, use ${preferredAngles[0]}, ${preferredLighting[0]}.`,
  };
}

export function scoreImagePrompt(prompt: string): PromptScoreBreakdown {
  const lower = prompt.toLowerCase();
  const lighting = hasAnyTerm(lower, LIGHTING_TERMS) ? 15 : 0;
  const camera = hasAnyTerm(lower, CAMERA_TERMS) ? 15 : 0;
  const skin = hasAnyTerm(lower, SKIN_TERMS) ? 20 : 0;
  const composition = hasAnyTerm(lower, COMPOSITION_TERMS) ? 10 : 0;
  const realism = hasAnyTerm(lower, REALISM_TERMS) ? 15 : 0;
  const imperfections = hasAnyTerm(lower, IMPERFECTION_TERMS) ? 10 : 0;
  const environment = hasAnyTerm(lower, ENVIRONMENT_TERMS) ? 15 : 0;
  const total = lighting + camera + skin + composition + realism + imperfections + environment;

  return {
    total,
    lighting,
    camera,
    skin,
    composition,
    realism,
    imperfections,
    environment,
  };
}

export function getTimeOfDayLighting(options?: {
  timezoneOffsetMinutes?: number;
  now?: Date;
}): string {
  const now = options?.now ?? new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const shiftedMinutes =
    typeof options?.timezoneOffsetMinutes === "number"
      ? utcMinutes + options.timezoneOffsetMinutes
      : utcMinutes;
  const hour = Math.floor(toPositiveMod(shiftedMinutes, 24 * 60) / 60);

  if (hour >= 5 && hour < 8) return "soft golden morning light streaming through sheer curtains";
  if (hour >= 8 && hour < 12) return "bright natural daylight, clean white light";
  if (hour >= 12 && hour < 16) return "warm afternoon sunlight, slight lens flare";
  if (hour >= 16 && hour < 19) return "golden hour sunset glow, warm orange tones";
  if (hour >= 19 && hour < 22) return "warm lamplight, cozy ambient glow, soft shadows";
  return "dim moody lighting, soft bedside lamp, intimate atmosphere";
}

export function getSeasonalContext(now: Date = new Date()): string {
  const month = now.getUTCMonth();
  if (month <= 1 || month === 11) {
    return "winter cozy indoor setting, chunky knit textures, warm drinks, soft blankets";
  }
  if (month >= 2 && month <= 4) {
    return "spring fresh outdoor air, blooming greenery, light layers, clean natural colors";
  }
  if (month >= 5 && month <= 7) {
    return "summer beach or outdoor vibe, sun-kissed skin, breezy fabrics, lively daylight";
  }
  return "autumn golden foliage, soft sweaters, warm tones, crisp evening ambience";
}

export function enhancePromptRealism(prompt: string, profile?: PromptEnhancementProfile): string {
  let enhanced = prompt.trim();
  let score = scoreImagePrompt(enhanced);
  const additions: string[] = [];

  const timeLighting = getTimeOfDayLighting({ timezoneOffsetMinutes: profile?.timezoneOffsetMinutes });
  const seasonalContext = getSeasonalContext();

  if (score.lighting === 0) {
    additions.push(timeLighting);
  }
  if (score.camera === 0) {
    const cameras = [
      "iPhone 17 Pro Max front camera, 48MP, f/1.9, 26mm equivalent, portrait mode",
      "Samsung Galaxy S25 Ultra selfie cam, f/2.2, slight lens distortion",
      "iPhone 17 Pro Max selfie, phone camera quality, casual handheld framing",
      "phone camera selfie, arm's-length perspective, slight wide-angle distortion",
    ];
    additions.push(cameras[Math.floor(Math.random() * cameras.length)]);
  }
  if (score.skin === 0) {
    additions.push("subsurface light scattering, visible pores, micro-skin texture, individual hair strands, natural pore visibility");
  }
  if (score.composition === 0) {
    additions.push("casual amateur composition, slightly off-center, not perfectly framed");
  }
  if (score.realism === 0) {
    additions.push("photorealistic candid photo, unedited raw look, no filters applied");
  }
  if (score.imperfections === 0) {
    additions.push("slight blemish, natural asymmetry, flyaway hair, skin oil sheen, not airbrushed");
  }
  if (score.environment === 0) {
    additions.push(`specific environment detail: ${seasonalContext}`);
  }

  if (additions.length > 0) {
    enhanced = `${enhanced}, ${additions.join(", ")}`;
  }

  score = scoreImagePrompt(enhanced);
  if (score.total < 70) {
    const fallback = [
      "photorealistic candid phone camera quality",
      "natural skin translucency and realistic skin grain",
      "subtle imperfections and authentic texture detail",
      "environmental context with tactile fabric detail",
    ];
    enhanced = `${enhanced}, ${fallback.join(", ")}`;
  }

  return enhanced;
}
