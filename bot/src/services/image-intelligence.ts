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
  "natural window light",
  "harsh overhead light",
  "dim bedside lamp",
  "screen glow",
  "golden hour",
  "streetlamp light",
  "fluorescent ceiling light",
  "uneven ambient light",
  "mixed lighting",
  "soft morning sun",
];

const CAMERA_TERMS = [
  "smartphone",
  "front-facing camera",
  "selfie camera",
  "phone lens",
  "handheld",
  "wide-angle lens",
  "digital noise",
  "lens flare",
  "slight motion blur",
  "depth of field",
  "raw photo",
];

const SKIN_TERMS = [
  "visible pores",
  "skin texture",
  "natural skin translucency",
  "skin grain",
  "slight blemishes",
  "natural skin oils",
];

const COMPOSITION_TERMS = [
  "casual framing",
  "slightly tilted horizon",
  "off-center",
  "arm's-length perspective",
  "portrait orientation",
  "background clutter",
];

const REALISM_TERMS = [
  "unfiltered",
  "raw",
  "candid",
  "unedited",
  "authentic",
  "non-professional",
  "random snap",
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

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface ProfileEnvironmentContext {
  homeDescription: string;
  bedroomDetails: string;
  favoriteLocations: string[];
  currentOutfit?: string;
  currentOutfitDay?: string;
}

export interface ResolvedEnvironmentContext {
  environment: ProfileEnvironmentContext;
  timeOfDay: TimeOfDay;
  dayKey: string;
  didChange: boolean;
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

export function getTimeOfDay(options?: {
  timezoneOffsetMinutes?: number;
  now?: Date;
}): TimeOfDay {
  const now = options?.now ?? new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const shiftedMinutes =
    typeof options?.timezoneOffsetMinutes === "number"
      ? utcMinutes + options.timezoneOffsetMinutes
      : utcMinutes;
  const hour = Math.floor(toPositiveMod(shiftedMinutes, 24 * 60) / 60);

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function getLocalDayKey(options?: {
  timezoneOffsetMinutes?: number;
  now?: Date;
}): string {
  const now = options?.now ?? new Date();
  const shifted =
    typeof options?.timezoneOffsetMinutes === "number"
      ? new Date(now.getTime() + options.timezoneOffsetMinutes * 60 * 1000)
      : now;
  return shifted.toISOString().slice(0, 10);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function chooseDailyOutfit(profile: GirlfriendProfile, timeOfDay: TimeOfDay, dayKey: string): string {
  const personality = profile.personality.toLowerCase();
  const basePool = personality.includes("bold")
    ? [
        "a fitted black crop top with high-waisted jeans",
        "a sleek ribbed dress with simple jewelry",
        "a structured blazer over a soft camisole",
      ]
    : personality.includes("shy")
      ? [
          "an oversized soft hoodie with lounge shorts",
          "a cozy knit sweater with relaxed jeans",
          "a loose tee with comfy pajama shorts",
        ]
      : personality.includes("bubbly")
        ? [
            "a bright fitted tee with a denim skirt",
            "a pastel cardigan with a pleated skirt",
            "a playful crop top with wide-leg jeans",
          ]
        : [
            "a casual tank with high-waisted jeans",
            "a soft cotton tee with relaxed shorts",
            "a simple fitted top with lounge pants",
          ];

  const morningPool = [
    "an oversized sleep shirt with bare legs",
    "a soft pajama set with tousled hair",
    ...basePool,
  ];
  const nightPool = [
    "a cozy camisole with loose shorts",
    "an oversized tee with rumpled sheets around her",
    ...basePool,
  ];

  const pool = timeOfDay === "morning" ? morningPool : timeOfDay === "night" ? nightPool : basePool;
  const key = `${profile.telegramId}:${profile.slotIndex ?? 0}:${dayKey}`;
  return pool[hashString(key) % pool.length];
}

export function resolveEnvironmentContinuity(
  profile: GirlfriendProfile,
  options?: { timezoneOffsetMinutes?: number; now?: Date }
): ResolvedEnvironmentContext {
  const timeOfDay = getTimeOfDay(options);
  const dayKey = getLocalDayKey(options);
  const environment = profile.environment;
  if (!environment) {
    return {
      environment: {
        homeDescription: "small apartment with a plant corner and warm lived-in details",
        bedroomDetails: "fairy lights, slightly messy sheets, soft bedside lamp glow",
        favoriteLocations: ["local coffee shop", "nearby park", "balcony view"],
        currentOutfit: chooseDailyOutfit(profile, timeOfDay, dayKey),
        currentOutfitDay: dayKey,
      },
      timeOfDay,
      dayKey,
      didChange: true,
    };
  }

  const needsOutfitRefresh =
    !environment.currentOutfit ||
    !environment.currentOutfitDay ||
    (timeOfDay === "morning" && environment.currentOutfitDay !== dayKey);

  if (!needsOutfitRefresh) {
    return { environment, timeOfDay, dayKey, didChange: false };
  }

  return {
    environment: {
      ...environment,
      currentOutfit: chooseDailyOutfit(profile, timeOfDay, dayKey),
      currentOutfitDay: dayKey,
    },
    timeOfDay,
    dayKey,
    didChange: true,
  };
}

export function getEnvironmentContext(
  profile: GirlfriendProfile,
  timeOfDay: TimeOfDay
): string {
  const environment = profile.environment;
  if (!environment) return "";

  const favoriteLocations = environment.favoriteLocations.length > 0
    ? environment.favoriteLocations
    : ["nearby cafe", "city park", "balcony"];

  const dayAnchor = hashString(`${profile.telegramId}:${environment.currentOutfitDay ?? ""}`);
  const favoriteLocation = favoriteLocations[dayAnchor % favoriteLocations.length];

  const locationByTime: Record<TimeOfDay, string> = {
    morning: `in her bedroom or kitchen at home (${environment.bedroomDetails})`,
    afternoon: `in the living room or outside at ${favoriteLocation}`,
    evening: `in a cozy living room corner at home (${environment.homeDescription})`,
    night: `in the bedroom with familiar details (${environment.bedroomDetails})`,
  };

  const outfitLine = environment.currentOutfit
    ? `She keeps the same outfit today: ${environment.currentOutfit}.`
    : "";

  return [
    `Environment continuity for ${timeOfDay}: ${locationByTime[timeOfDay]}.`,
    `Home baseline: ${environment.homeDescription}.`,
    `Background anchors stay consistent across today's selfies: ${environment.bedroomDetails}.`,
    outfitLine,
  ].filter(Boolean).join(" ");
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
      "Samsung Galaxy S26 Ultra selfie cam, f/2.2, slight lens distortion",
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
