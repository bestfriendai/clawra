export type LightingCategory = "studio" | "natural" | "dramatic" | "intimate" | "artistic";
export type LightingBestFor = "portrait" | "full-body" | "close-up";

export interface LightingPreset {
  id: string;
  name: string;
  category: LightingCategory;
  description: string;
  prompt_keywords: string[];
  best_for: LightingBestFor[];
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: "studio_softbox_classic",
    name: "Classic Softbox Portrait",
    category: "studio",
    description: "Soft front key with controlled shadow falloff.",
    prompt_keywords: ["large softbox key light", "gentle shadow rolloff", "clean studio backdrop"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "studio_beauty_dish",
    name: "Beauty Dish Glow",
    category: "studio",
    description: "Crisp beauty-dish highlights with flattering skin contrast.",
    prompt_keywords: ["beauty dish", "catchlights in eyes", "subtle fill reflector"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "studio_clamshell",
    name: "Clamshell Beauty",
    category: "studio",
    description: "Top and bottom lights for polished facial detail.",
    prompt_keywords: ["clamshell lighting", "reflector under chin", "high skin detail"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "studio_three_point",
    name: "Three-Point Studio",
    category: "studio",
    description: "Balanced key, fill, and rim lights for depth.",
    prompt_keywords: ["three-point lighting", "rim light edge", "controlled fill"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "natural_window_morning",
    name: "Morning Window Light",
    category: "natural",
    description: "Soft morning daylight diffused through curtains.",
    prompt_keywords: ["morning window light", "sheer curtain diffusion", "soft natural shadows"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "natural_overcast_day",
    name: "Overcast Open Shade",
    category: "natural",
    description: "Cloud-filtered light for smooth skin and realistic tones.",
    prompt_keywords: ["overcast daylight", "open shade", "true skin tones"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "natural_afternoon_sun",
    name: "Warm Afternoon Sun",
    category: "natural",
    description: "Directional afternoon sunlight with gentle warmth.",
    prompt_keywords: ["warm afternoon sunlight", "slight lens flare", "sunlit highlights"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "natural_golden_hour",
    name: "Golden Hour Exterior",
    category: "natural",
    description: "Low-angle sunset light with warm orange tones.",
    prompt_keywords: ["golden hour", "sunset glow", "warm orange rim light"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "dramatic_split_light",
    name: "Split Lighting",
    category: "dramatic",
    description: "Strong side key creating cinematic face separation.",
    prompt_keywords: ["split lighting", "hard side key", "deep contrast"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "dramatic_low_key",
    name: "Low-Key Portrait",
    category: "dramatic",
    description: "Dark tonal setup with selective highlights.",
    prompt_keywords: ["low-key lighting", "deep shadows", "moody contrast"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "dramatic_rim_silhouette",
    name: "Rim Silhouette",
    category: "dramatic",
    description: "Back rim lights emphasizing shape and hair edges.",
    prompt_keywords: ["strong rim light", "hair light", "dark foreground"],
    best_for: ["full-body", "portrait"],
  },
  {
    id: "dramatic_noir",
    name: "Noir Window Slashes",
    category: "dramatic",
    description: "Hard window-style shadows with noir mood.",
    prompt_keywords: ["noir lighting", "window blinds shadow", "high contrast black tones"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "intimate_bedside_lamp",
    name: "Bedside Lamp Glow",
    category: "intimate",
    description: "Warm bedside lamp with soft falloff and cozy ambience.",
    prompt_keywords: ["warm lamplight", "cozy ambient glow", "soft bedside shadows"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "intimate_candlelight",
    name: "Candlelit Mood",
    category: "intimate",
    description: "Flickering warm highlights and soft darkness.",
    prompt_keywords: ["candlelight", "warm flicker", "intimate atmosphere"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "intimate_night_window",
    name: "Night Window Blue",
    category: "intimate",
    description: "Cool moonlit window mixed with warm indoor practicals.",
    prompt_keywords: ["cool moonlight", "window blue cast", "warm interior practical light"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "intimate_dim_room",
    name: "Dim Room Ambient",
    category: "intimate",
    description: "Soft low-output room lighting for natural night realism.",
    prompt_keywords: ["dim moody lighting", "soft shadows", "low-light realism"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "artistic_ethereal_pastel",
    name: "Ethereal Pastel",
    category: "artistic",
    description: "Dreamy pastel diffusion with floating highlights.",
    prompt_keywords: ["ethereal soft focus", "pastel color grading", "dreamy glow"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "artistic_fairy_bokeh",
    name: "Fairy Light Bokeh",
    category: "artistic",
    description: "Out-of-focus fairy lights and romantic haze.",
    prompt_keywords: ["fairy lights bokeh", "gauzy haze", "romantic backlight"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "artistic_cinematic_teal_orange",
    name: "Cinematic Teal-Orange",
    category: "artistic",
    description: "Stylized dual-tone cinematic lighting.",
    prompt_keywords: ["cinematic teal and orange", "color contrast lighting", "filmic depth"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "artistic_soft_halo",
    name: "Soft Halo Backlight",
    category: "artistic",
    description: "Backlit halo around hair with gentle diffusion.",
    prompt_keywords: ["soft halo backlight", "glowing hair edges", "dreamlike atmosphere"],
    best_for: ["portrait", "close-up"],
  },
  {
    id: "studio_hard_fashion",
    name: "Hard Fashion Key",
    category: "studio",
    description: "Sharper directional key for editorial structure.",
    prompt_keywords: ["hard key light", "editorial shadows", "crisp facial structure"],
    best_for: ["portrait", "full-body"],
  },
  {
    id: "natural_backlit_park",
    name: "Backlit Park Day",
    category: "natural",
    description: "Outdoor backlight with natural bounce and greenery.",
    prompt_keywords: ["natural backlight", "greenery bounce light", "sun-kissed skin"],
    best_for: ["portrait", "full-body"],
  },
];

export function getLightingPresetsByCategory(category: LightingCategory): LightingPreset[] {
  return LIGHTING_PRESETS.filter((preset) => preset.category === category);
}

export function getRandomLightingPreset(category?: LightingCategory): LightingPreset {
  const pool = category ? getLightingPresetsByCategory(category) : LIGHTING_PRESETS;
  return pool[Math.floor(Math.random() * pool.length)];
}
