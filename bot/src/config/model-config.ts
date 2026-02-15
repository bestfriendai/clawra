import { env } from "./env.js";

export type ImageQuality = "base" | "turbo" | "flux-pro" | "flux-max";
export type FallbackStrategy = "none" | "full" | "aggressive";

export interface ModelConfig {
  quality: ImageQuality;
  fallback: FallbackStrategy;
  maxRetries: number;
}

// ─── Model Registry ───────────────────────────────────────────────
// PRIMARY: Z-Image (Alibaba Tongyi Lab) — best realism, cheapest
// FALLBACK: FLUX.2 Pro/Max, Nano Banana Pro
// ──────────────────────────────────────────────────────────────────

export const MODEL_IDS = {
  // Z-Image — PRIMARY (Feb 2026, #1 open-source text-to-image)
  "z-image-base": "fal-ai/z-image/base",        // $0.01/MP — best quality, negative_prompt support
  "z-image-turbo": "fal-ai/z-image/turbo",       // $0.005/MP — sub-second generation

  // FLUX — FALLBACK
  "flux-2-pro": "fal-ai/flux-2-pro",             // $0.03/MP
  "flux-2-pro-edit": "fal-ai/flux-2-pro/edit",   // Edit mode with image_urls
  "flux-2-max": "fal-ai/flux-2-max",             // $0.07/MP

  // Nano — LAST RESORT (most permissive NSFW)
  "nano-banana-pro": "fal-ai/nano-banana-pro",   // $0.02/MP — safety_tolerance: 6

  // NSFW Edit — HunyuanImage V3 Instruct Edit (best NSFW editor, $0.09/MP)
  "hunyuan-v3-edit": "fal-ai/hunyuan-image/v3/instruct/edit",

  // SFW Edit
  "grok-edit": "xai/grok-imagine-image/edit",
  "grok-video": "xai/grok-imagine-video/image-to-video",
  "minimax-tts": "fal-ai/minimax/speech-2.8-turbo",
  whisper: "fal-ai/whisper",

  // Consistency
  "kontext-pro": "fal-ai/flux-pro/kontext",
  "kontext-max": "fal-ai/flux-pro/kontext/max",

  // Image-to-Image
  "kling-o3-i2i": "fal-ai/kling-image/o3/image-to-image",
  "kling-v3-i2i": "fal-ai/kling-image/v3/image-to-image",
  "flux-klein": "fal-ai/flux-2/klein/realtime",
  "qwen-image-max": "fal-ai/qwen-image-max/edit",

  // Face Swap
  "easel-face-swap": "easel-ai/advanced-face-swap",

  // Video
  "wan-25-i2v": "fal-ai/wan-25-preview/image-to-video",

  // Lip Sync
  "sync-lipsync": "fal-ai/sync-lipsync",
  "sync-lipsync-v2": "fal-ai/sync-lipsync/v2",

  // TTS
  "dia-tts": "fal-ai/dia-tts",
  "dia-tts-clone": "fal-ai/dia-tts/voice-clone",
  "minimax-voice-clone": "fal-ai/minimax/voice-clone",
  kokoro: "fal-ai/kokoro",

  // Upscale
  "aura-sr": "fal-ai/aura-sr",
} as const;

export const MODEL_COSTS_USD: Record<string, number> = {
  "z-image-base": 0.01,
  "z-image-turbo": 0.005,
  "flux-2-pro": 0.03,
  "flux-2-max": 0.07,
  "nano-banana-pro": 0.02,
  "hunyuan-v3-edit": 0.09,
  "grok-edit": 0.03,
  "grok-video": 0.1,
  "minimax-tts": 0.01,
  whisper: 0.005,
  "kontext-pro": 0.04,
  "kontext-max": 0.08,
  "kling-o3-i2i": 0.05,
  "kling-v3-i2i": 0.05,
  "flux-klein": 0.01,
  "qwen-image-max": 0.03,
  "easel-face-swap": 0.03,
  "wan-25-i2v": 0.05,
  "sync-lipsync": 0.012,
  "sync-lipsync-v2": 0.05,
  "dia-tts": 0.04,
  "dia-tts-clone": 0.04,
  "minimax-voice-clone": 0.02,
  kokoro: 0.02,
  "aura-sr": 0.01,
};

export const QUALITY_CREDIT_COSTS = {
  base: { selfie_sfw: 3, selfie_nsfw: 10 },
  turbo: { selfie_sfw: 2, selfie_nsfw: 7 },
  "flux-pro": { selfie_sfw: 5, selfie_nsfw: 15 },
  "flux-max": { selfie_sfw: 8, selfie_nsfw: 25 },
} as const;

const ZIMAGE_NEGATIVE_BASE =
  "male, man, masculine, muscular man, male body, shirtless man, nude, naked, topless, shirtless, nsfw, lingerie, underwear, bikini, cleavage, exposed skin, exposed chest, bare chest, no shirt, sexually suggestive, AI generated, plastic skin, smooth skin, airbrushed, illustration, cartoon, 3D render, uncanny valley, wax figure, mannequin, doll-like, overly symmetrical face, blurry, distorted hands, extra fingers, deformed, professional photoshoot, studio lighting setup, ring light catchlights, perfectly white teeth, plastic specular highlights, unnatural light bounce, symmetrical perfections";

const ZIMAGE_NEGATIVE_EXTRAS = [
  "watermark, text overlay, logo, signature, copyright",
  "overly posed, magazine cover, professional studio lighting, beauty dish",
  "digital painting, CGI, concept art, anime, Pixar, Unreal Engine",
  "oversaturated, HDR look, overprocessed, heavy editing, orange and teal grading",
  "perfect skin, poreless, beauty filter, FaceTune, retouched, photoshopped",
  "stock photo, generic model pose, catalog image, advertisement, billboard",
  "split lighting, rim light, dramatic shadows, chiaroscuro, Rembrandt lighting",
  "bokeh balls, lens flare, light leak overlay, sun flare effect",
  "unrealistic proportions, bolt-on implants, impossibly thin waist, exaggerated curves",
  "fashion runway, editorial photography, high fashion, glamour shot",
  "unnatural skin sheen, porcelain texture, airbrushed hair, perfectly aligned strands",
  "cgi lighting, raytraced reflections, digital makeup, artificial glow",
];

export const ZIMAGE_NEGATIVE_PROMPT = ZIMAGE_NEGATIVE_BASE;

export function getZImageNegativePrompt(): string {
  const extras = ZIMAGE_NEGATIVE_EXTRAS.sort(() => Math.random() - 0.5).slice(0, 3);
  return `${ZIMAGE_NEGATIVE_BASE}, ${extras.join(", ")}`;
}

// Z-Image Base: steps 1-28 (28=max quality), guidance_scale default 4.0
// acceleration "none" disables distillation for highest quality output
export const ZIMAGE_BASE_DEFAULTS = {
  num_inference_steps: 28,
  guidance_scale: 4.0,
  enable_safety_checker: true,
  num_images: 1,
  image_size: { width: 768, height: 1344 },
  output_format: "jpeg",
  acceleration: "none",
} as const;

// Turbo: negative_prompt and guidance_scale are ignored by the distilled model
export const ZIMAGE_TURBO_DEFAULTS = {
  num_inference_steps: 8,
  enable_safety_checker: true,
  num_images: 1,
  image_size: { width: 720, height: 1280 },
  acceleration: "regular",
} as const;

export const FLUX_PRO_REFERENCE_DEFAULTS = {
  num_images: 1,
  output_format: "jpeg",
  image_size: { width: 768, height: 1344 },
  safety_tolerance: 2,
  enable_safety_checker: true,
} as const;

export function getModelConfig(): ModelConfig {
  const quality = (env.IMAGE_QUALITY || "base") as ImageQuality;
  const fallback = (env.FALLBACK_STRATEGY || "full") as FallbackStrategy;

  const validQualities: ImageQuality[] = ["base", "turbo", "flux-pro", "flux-max"];
  const resolvedQuality = validQualities.includes(quality) ? quality : "base";

  const validFallbacks: FallbackStrategy[] = ["none", "full", "aggressive"];
  const resolvedFallback = validFallbacks.includes(fallback) ? fallback : "full";

  return {
    quality: resolvedQuality,
    fallback: resolvedFallback,
    maxRetries: 2,
  };
}

export function getPrimaryModelId(): string {
  const config = getModelConfig();
  switch (config.quality) {
    case "turbo":
      return MODEL_IDS["z-image-turbo"];
    case "flux-pro":
      return MODEL_IDS["flux-2-pro"];
    case "flux-max":
      return MODEL_IDS["flux-2-max"];
    case "base":
    default:
      return MODEL_IDS["z-image-base"];
  }
}

export function isZImageModel(modelId: string): boolean {
  return modelId.includes("z-image");
}

export function isFluxModel(modelId: string): boolean {
  return modelId.includes("flux-2");
}

export function isNanoModel(modelId: string): boolean {
  return modelId.includes("nano-banana");
}

export function getNSFWEditModelId(): string {
  return MODEL_IDS["hunyuan-v3-edit"];
}

export function getNSFWEditFallbackModelId(): string {
  return MODEL_IDS["flux-2-pro-edit"];
}

/**
 * Full NSFW fallback chain:
 * Z-Image Base → Z-Image Turbo → FLUX.2 Pro → Nano Banana Pro
 */
export function getNSFWFallbackChain(): string[] {
  const config = getModelConfig();
  const chain: string[] = [];

  chain.push(getPrimaryModelId());

  if (config.fallback === "none") return chain;

  const fullChain = [
    MODEL_IDS["z-image-base"],
    MODEL_IDS["z-image-turbo"],
    MODEL_IDS["flux-2-pro"],
    MODEL_IDS["nano-banana-pro"],
  ];

  for (const modelId of fullChain) {
    if (!chain.includes(modelId)) {
      chain.push(modelId);
    }
  }

  return chain;
}

export function getActiveModelName(): string {
  const config = getModelConfig();
  const names: Record<ImageQuality, string> = {
    base: "Z-Image Base",
    turbo: "Z-Image Turbo",
    "flux-pro": "FLUX.2 Pro",
    "flux-max": "FLUX.2 Max",
  };
  const primary = names[config.quality] || "Z-Image Base";
  const fallbackLabel =
    config.fallback === "full"
      ? " + full fallback chain"
      : config.fallback === "aggressive"
        ? " + aggressive fallback"
        : "";
  return `${primary}${fallbackLabel}`;
}
