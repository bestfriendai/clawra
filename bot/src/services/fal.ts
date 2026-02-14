import { fal } from "@fal-ai/client";
import { env } from "../config/env.js";
import {
  getModelConfig,
  getPrimaryModelId,
  getNSFWFallbackChain,
  getNSFWEditModelId,
  getNSFWEditFallbackModelId,
  isZImageModel,
  isNanoModel,
  MODEL_IDS,
  getZImageNegativePrompt,
  ZIMAGE_BASE_DEFAULTS,
  ZIMAGE_TURBO_DEFAULTS,
  FLUX_PRO_REFERENCE_DEFAULTS,
} from "../config/model-config.js";
import {
  getDefaultVoiceProfile,
  getVoiceProfileForEmotion,
  type MiniMaxEmotion,
  type VoiceProfile,
} from "../config/voice-profiles.js";
import { detectUserEmotion } from "./emotional-state.js";
import { sanitizeImagePrompt } from "../utils/moderation.js";
import { enhancePromptRealism, getImageSeed, type PromptEnhancementProfile } from "./image-intelligence.js";

fal.config({ credentials: env.FAL_KEY });

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const value = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };

  return value.status ?? value.statusCode ?? value.response?.status;
}

function isNetworkError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  const message = getErrorMessage(error);
  return (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    /fetch failed|network error|econnrefused|etimedout/i.test(message)
  );
}

function isContentPolicyError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  return status === 400 && /content policy|safety/i.test(message);
}

export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const status = getErrorStatus(error);

      if (isContentPolicyError(error)) {
        throw new Error(`${label} rejected: content policy or safety filters triggered.`);
      }

      if (attempt === 0 && isNetworkError(error)) {
        console.warn(`${label} network error, retrying once in 2s`);
        await sleep(2000);
        continue;
      }

      if (attempt === 0 && status === 429) {
        console.warn(`${label} rate limited, retrying once in 5s`);
        await sleep(5000);
        continue;
      }

      if (attempt === 0 && status !== undefined && status >= 500) {
        console.warn(`${label} server error (${status}), retrying once in 3s`);
        await sleep(3000);
        continue;
      }

      console.error(`${label} failed (attempt ${attempt + 1}):`, error);
      throw error;
    }
  }

  throw new Error(`${label} failed after retries`);
}

export interface FalImageResult {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

export interface FalVideoResult {
  url: string;
  duration: number;
  width: number;
  height: number;
  content_type: string;
}

export interface FalAudioResult {
  url: string;
  duration_ms: number;
}

interface GenerateModelOptions extends Record<string, unknown> {
  seed?: number;
}

/**
 * Generate a brand new image (no reference) — used for initial girlfriend portrait.
 * Uses FLUX.2 Pro for high-quality reference photos.
 */
export async function generateImage(
  prompt: string,
  options: Record<string, unknown> = {}
): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);
  const modelId = getPrimaryModelId();

  try {
    return await _generateWithModel(modelId, safePrompt, options);
  } catch (err) {
    const config = getModelConfig();
    if (config.fallback !== "none") {
      console.warn(`Primary model ${modelId} failed, falling back to nano-banana-pro`);
      return await _generateWithModel(MODEL_IDS["nano-banana-pro"], safePrompt, {
        ...options,
        safety_tolerance: "6",
      });
    }
    throw err;
  }
}

/**
 * Generate the initial reference photo — uses FLUX.2 Pro for highest quality
 * since this image becomes the foundation for all future selfies.
 */
export async function generateReferenceImage(
  prompt: string,
  negativePrompt?: string
): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);

  // Always use FLUX.2 Pro for reference images — quality matters most here
  try {
    const result = await withRetry(
      () => fal.subscribe(MODEL_IDS["flux-2-pro"], {
        input: {
          prompt: safePrompt,
          num_images: 1,
          output_format: "jpeg",
          image_size: { width: 768, height: 1344 },
          safety_tolerance: "5",
          enable_safety_checker: false,
        } as any,
      }),
      "generate reference image (flux-2-pro)"
    );
    const data = result.data as { images?: FalImageResult[] };
    if (!data.images?.length) throw new Error("No images from FLUX.2 Pro");
    return data.images[0];
  } catch (err) {
    console.warn("FLUX.2 Pro failed for reference, falling back to Z-Image Base");
    return _generateWithModel(MODEL_IDS["z-image-base"], safePrompt, {});
  }
}

/**
 * Re-roll variant — adds slight prompt variation so each attempt looks different.
 */
export async function generateReferenceWithVariation(
  prompt: string,
  attemptNumber: number
): Promise<FalImageResult> {
  const variations = [
    "slightly different angle, different expression",
    "different lighting mood, slightly different pose",
    "different background setting, natural variation in expression",
    "different camera angle, slightly different hair arrangement",
  ];
  const variation = variations[(attemptNumber - 1) % variations.length] || variations[0];
  const variedPrompt = `${prompt} With ${variation}.`;
  return generateReferenceImage(variedPrompt);
}

async function _generateWithModel(
  modelId: string,
  prompt: string,
  options: GenerateModelOptions = {}
): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);
  const { seed, ...restOptions } = options;

  let input: Record<string, unknown>;

  if (isZImageModel(modelId)) {
    const isBase = modelId.includes("/base");
    const defaults = isBase ? ZIMAGE_BASE_DEFAULTS : ZIMAGE_TURBO_DEFAULTS;
    input = {
      prompt: safePrompt,
      ...defaults,
      output_format: "jpeg",
      ...(isBase ? { negative_prompt: getZImageNegativePrompt() } : {}),
      ...restOptions,
    };
  } else if (isNanoModel(modelId)) {
    input = {
      prompt: safePrompt,
      num_images: 1,
      output_format: "jpeg",
      image_size: { width: 720, height: 1280 },
      safety_tolerance: "6",
      ...restOptions,
    };
  } else {
    input = {
      prompt: safePrompt,
      num_images: 1,
      output_format: "jpeg",
      image_size: { width: 720, height: 1280 },
      safety_tolerance: "5",
      enable_safety_checker: false,
      ...restOptions,
    };
  }

  if (typeof seed === "number" && Number.isFinite(seed)) {
    input.seed = Math.trunc(seed);
  }

  const result = await withRetry(
    () => fal.subscribe(modelId, { input: input as any }),
    `generate image (${modelId})`
  );
  const data = result.data as { images?: FalImageResult[] };
  const images = data.images;
  if (!images || images.length === 0) {
    throw new Error(`No images returned from ${modelId}`);
  }
  return images[0];
}

export async function editImageSFW(
  referenceImageUrl: string,
  prompt: string
): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);

  // Keep wrapper lean — buildSelfieSFW already includes identity anchor + realism markers.
  // Grok Edit has an 8000 char prompt limit — don't waste it on redundant realism text.
  const identityPrompt = [
    "Exact same person from the reference image. Same face, bone structure, skin tone, body type.",
    safePrompt,
  ].join(" ");

  const result = await withRetry(
    () =>
      fal.subscribe(MODEL_IDS["grok-edit"], {
        input: {
          prompt: identityPrompt,
          image_url: referenceImageUrl,
          num_images: 1,
          output_format: "jpeg",
        } as any,
      }),
    "edit image sfw (grok-edit)"
  );

  const data = result.data as { images?: FalImageResult[] };
  const images = data.images;
  if (!images || images.length === 0) {
    throw new Error("No images returned from Grok Imagine Edit");
  }
  return images[0];
}

const REALISM_NEGATIVE = [
  // Anti-AI markers
  "AI generated, CGI, 3D render, illustration, cartoon, anime, digital painting, concept art",
  // Anti-plastic look
  "plastic skin, poreless, airbrushed, wax figure, mannequin, doll-like, uncanny valley, silicone",
  // Anti-perfection (key for avoiding slop)
  "overly symmetrical face, dead eyes, beauty filter, facetune, smooth texture, perfect skin, flawless complexion",
  // Anti-studio (prevents professional photo look)
  "professional photoshoot, studio backdrop, ring light, softbox, beauty dish, fashion photography, catalog model",
  // Anti-overprocessing
  "HDR, oversaturated, overprocessed, perfect makeup, heavy retouching, photoshopped, glamour lighting",
  // Anti-deformity
  "extra fingers, mutated hands, deformed face, cross-eyed, extra limbs, merged fingers",
  // Anti-overlay
  "watermark, text, logo, border, collage, split image, signature",
  // Anti-porn production value (for NSFW)
  "professional pornography, studio porn, production lighting, multiple camera angles, fake moaning expression",
  // Anti-unrealistic body
  "unrealistic proportions, impossibly thin waist, bolt-on breasts, silicon implant look, exaggerated features",
].join(", ");

export async function editImageNSFW(
  referenceImageUrl: string,
  prompt: string
): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);
  const primaryEditModel = getNSFWEditModelId();

  // HunyuanImage V3 Edit does NOT support negative_prompt — bake anti-AI into prompt
  const hunyuanPrompt = [
    "Photo of the exact same person from the reference image. Same face, same bone structure, same skin tone, same body type.",
    safePrompt,
    "Real amateur photo taken on a phone camera. Natural imperfect lighting, visible skin texture and pores.",
    "NOT AI generated. NOT a professional photoshoot. NOT studio pornography.",
    "Realistic skin with natural blemishes, slight facial asymmetry, real hair texture with flyaway strands.",
    "Natural body proportions matching the reference exactly. No enhancement, no surgery look, no impossible proportions.",
    "This looks like a real intimate photo a girlfriend sent via iMessage, casual one-handed phone framing.",
    "Avoid: plastic skin, airbrushed, poreless, wax figure, mannequin, CGI, cartoon, perfect symmetry, studio lighting.",
  ].join(" ");

  try {
    const result = await withRetry(
      () =>
        fal.subscribe(primaryEditModel, {
          input: {
            prompt: hunyuanPrompt,
            image_urls: [referenceImageUrl],
            guidance_scale: 3.5,
            num_inference_steps: 28,
            enable_safety_checker: false,
            output_format: "jpeg",
            image_size: { width: 720, height: 1280 },
          } as any,
        }),
      `edit image nsfw (${primaryEditModel})`
    );
    const data = result.data as { images?: FalImageResult[] };
    if (!data.images?.length) throw new Error(`No images from ${primaryEditModel}`);
    return data.images[0];
  } catch (err) {
    const config = getModelConfig();
    if (config.fallback === "none") throw err;

    console.warn(`${primaryEditModel} failed, trying FLUX.2 Pro Edit fallback`);
    try {
      const fallbackModel = getNSFWEditFallbackModelId();
      const fallbackPrompt = [
        "Photo of the exact same person from the reference image.",
        safePrompt,
        "Real candid photo, natural skin texture, visible pores, NOT AI generated.",
      ].join(" ");
      const result = await withRetry(
        () =>
          fal.subscribe(fallbackModel, {
            input: {
              prompt: fallbackPrompt,
              image_urls: [referenceImageUrl],
              safety_tolerance: "5",
              enable_safety_checker: false,
              image_size: { width: 720, height: 1280 },
            } as any,
          }),
        `edit image nsfw fallback (${fallbackModel})`
      );
      const data = result.data as { images?: FalImageResult[] };
      if (!data.images?.length) throw new Error(`No images from ${fallbackModel}`);
      return data.images[0];
    } catch (fallbackErr) {
      console.warn("FLUX.2 Pro Edit also failed, falling back to Z-Image scratch generation");
      const fullPrompt = `${safePrompt}, real candid photo, natural skin texture, visible pores, NOT AI generated`;
      return await _generateWithModel(MODEL_IDS["z-image-base"], fullPrompt);
    }
  }
}

export async function generateNSFWFromScratch(prompt: string): Promise<FalImageResult> {
  const safePrompt = sanitizeImagePrompt(prompt);
  const chain = getNSFWFallbackChain();
  const maxRetries = 3;
  let attempts = 0;
  let lastError: Error | undefined;

  for (const modelId of chain) {
    if (attempts >= maxRetries) {
      break;
    }

    attempts += 1;
    try {
      return await _generateWithModel(modelId, safePrompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`NSFW generation failed with ${modelId}: ${lastError.message}`);
    }
  }

  throw lastError || new Error(`All NSFW generation models failed after ${maxRetries} retries`);
}

export async function generateWithKontext(
  referenceImageUrl: string,
  prompt: string
): Promise<{ url: string }> {
  const safePrompt = sanitizeImagePrompt(prompt);
  const result = await withRetry(
    () =>
      fal.subscribe(MODEL_IDS["kontext-pro"], {
        input: {
          image_url: referenceImageUrl,
          prompt: safePrompt,
          safety_tolerance: "5",
          output_format: "png",
        },
      }),
    "generate kontext image"
  );

  const data = result.data as { images?: Array<{ url?: string }> };
  const url = data.images?.[0]?.url;
  if (!url) {
    throw new Error("No image returned from FLUX Kontext Pro");
  }

  return { url };
}

export async function enhanceAndGenerate(
  prompt: string,
  profile?: PromptEnhancementProfile,
  options: Record<string, unknown> = {}
): Promise<FalImageResult> {
  const enhancedPrompt = enhancePromptRealism(prompt, profile);
  const mergedOptions: Record<string, unknown> = { ...options };

  if (
    mergedOptions.seed === undefined &&
    typeof profile?.telegramId === "number"
  ) {
    mergedOptions.seed = getImageSeed(profile.telegramId, profile.slotIndex ?? 0);
  }

  return generateImage(enhancedPrompt, mergedOptions);
}

/**
 * Smart router: picks the right model based on NSFW flag.
 * ALWAYS uses the girlfriend's reference image for character consistency.
 */
export async function editImage(
  referenceImageUrl: string,
  prompt: string,
  nsfw: boolean = false
): Promise<FalImageResult> {
  if (nsfw) {
    return editImageNSFW(referenceImageUrl, prompt);
  }
  return editImageSFW(referenceImageUrl, prompt);
}

// ─── All-Models Parallel Test ──────────────────────────────────────
// Fires all 6 i2i models in parallel and returns every result.

export interface ModelTestResult {
  id: string;
  label: string;
  status: "ok" | "error";
  url?: string;
  time: string;
  error?: string;
}

const ALL_I2I_MODELS = [
  {
    id: "kling-v3",
    label: "Kling V3",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      // Kling V3 i2i: no negative_prompt, supports resolution "1K"/"2K", aspect_ratio
      const result = await fal.subscribe(MODEL_IDS["kling-v3-i2i"], {
        input: {
          prompt,
          image_url: refUrl,
          aspect_ratio: "9:16",
          resolution: "1K",
          output_format: "jpeg",
        },
      });
      const data = result.data as { images?: FalImageResult[] };
      return data.images?.[0]?.url;
    },
  },
  {
    id: "kling-o3",
    label: "Kling Omni 3",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      const result = await fal.subscribe(MODEL_IDS["kling-o3-i2i"], {
        input: {
          prompt: `Using @Image1 as reference, ${prompt}`,
          image_urls: [refUrl],
          aspect_ratio: "9:16",
          output_format: "jpeg",
        },
      });
      const data = result.data as { images?: FalImageResult[] };
      return data.images?.[0]?.url;
    },
  },
  {
    id: "grok-edit",
    label: "Grok Edit",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      const identityPrompt =
        "Keep this person's exact face, features, skin tone, hair, and body unchanged. " + prompt;
      const result = await fal.subscribe(MODEL_IDS["grok-edit"], {
        input: {
          prompt: identityPrompt,
          image_url: refUrl,
          num_images: 1,
          output_format: "jpeg",
        } as any,
      });
      const data = result.data as { images?: FalImageResult[] };
      return data.images?.[0]?.url;
    },
  },
  {
    id: "hunyuan-v3",
    label: "Hunyuan V3",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      // HunyuanImage V3 Edit: guidance_scale 1-20 (default 3.5), steps 1-50 (default 28)
      // Does NOT support negative_prompt on edit endpoint
      const identityPrompt =
        "Keep this person's exact face, features, skin tone, hair, and body unchanged. " + prompt;
      const result = await fal.subscribe(MODEL_IDS["hunyuan-v3-edit"], {
        input: {
          prompt: identityPrompt,
          image_urls: [refUrl],
          guidance_scale: 3.5,
          num_inference_steps: 28,
          enable_safety_checker: false,
          output_format: "jpeg",
          image_size: { width: 720, height: 1280 },
        } as any,
      });
      const data = result.data as { images?: FalImageResult[] };
      return data.images?.[0]?.url;
    },
  },
  {
    id: "qwen-max",
    label: "Qwen Max",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      const qwenPrompt = `Keep this person from image 1 identical. ${prompt}`.slice(0, 800);
      const result = await fal.subscribe(MODEL_IDS["qwen-image-max"], {
        input: {
          prompt: qwenPrompt,
          image_urls: [refUrl],
          negative_prompt:
            "AI generated, plastic skin, airbrushed, cartoon, extra fingers, deformed",
          enable_safety_checker: false,
          output_format: "jpeg",
          image_size: { width: 720, height: 1280 },
        } as any,
      });
      const data = result.data as { images?: FalImageResult[] };
      return data.images?.[0]?.url;
    },
  },
  {
    id: "flux-klein",
    label: "FLUX.2 Klein",
    run: async (refUrl: string, prompt: string, _nsfw: boolean) => {
      // Klein needs base64 input — fetch the ref image and convert
      const response = await fetch(refUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      const result = await fal.subscribe(MODEL_IDS["flux-klein"], {
        input: {
          prompt,
          image_url: base64,
          image_size: "square_hd",
          num_inference_steps: 3,
        },
      });
      const data = result.data as { images?: Array<{ url?: string; content?: string }> };
      const img = data.images?.[0];
      if (img?.url) return img.url;
      // Klein sometimes returns base64 content instead of a URL
      if (img?.content) {
        // Upload base64 to fal storage so we get a URL for Telegram
        const uploadBuffer = Buffer.from(img.content, "base64");
        const blob = new Blob([uploadBuffer], { type: "image/png" });
        const uploaded = await fal.storage.upload(blob);
        return uploaded;
      }
      return undefined;
    },
  },
];

export async function editAllModels(
  referenceImageUrl: string,
  prompt: string,
  nsfw: boolean = false
): Promise<ModelTestResult[]> {
  const promises = ALL_I2I_MODELS.map(async (model) => {
    const start = Date.now();
    try {
      const url = await model.run(referenceImageUrl, prompt, nsfw);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + "s";
      if (!url) {
        return { id: model.id, label: model.label, status: "error" as const, time: elapsed, error: "no image returned" };
      }
      return { id: model.id, label: model.label, status: "ok" as const, url, time: elapsed };
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + "s";
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[editAllModels] ${model.label} failed:`, msg);
      return { id: model.id, label: model.label, status: "error" as const, time: elapsed, error: msg };
    }
  });

  return Promise.all(promises);
}

export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  duration: number = 6
): Promise<FalVideoResult> {
  // Grok Video: duration 1-15s, prompt max 4096 chars, resolution 480p/720p
  const safePrompt = sanitizeImagePrompt(prompt).slice(0, 4096);
  console.log(`[video] Starting generation: prompt="${safePrompt.slice(0, 80)}...", image="${imageUrl.slice(0, 60)}..."`);

  const result = await withRetry(
    () =>
      fal.subscribe(MODEL_IDS["grok-video"], {
        input: {
          prompt: safePrompt,
          image_url: imageUrl,
          duration: Math.min(duration, 15),
          resolution: "720p",
          aspect_ratio: "9:16",
        },
      }),
    "generate video"
  );
  const data = result.data as { video?: FalVideoResult };
  if (!data.video) {
    console.error("[video] API returned no video. Full response:", JSON.stringify(result.data));
    throw new Error("No video returned from Grok Imagine Video");
  }
  console.log(`[video] Success: ${data.video.url}`);
  return data.video;
}

export async function generateVideoWAN(
  imageUrl: string,
  prompt: string,
  duration: 5 | 10 = 5
): Promise<{ url: string }> {
  const safePrompt = sanitizeImagePrompt(prompt).slice(0, 800);
  const modelId: string = MODEL_IDS["wan-25-i2v"];

  // WAN 2.5 supports negative_prompt (max 500 chars) — use for anti-AI
  const negativePrompt = [
    "AI generated, CGI, 3D render, cartoon, anime, illustration",
    "morphing face, warping background, melting objects, flickering",
    "extra fingers, deformed hands, unnatural movement, robotic motion",
    "professional studio, fashion shoot, stock footage",
  ].join(", ").slice(0, 500);

  const result = await withRetry(
    () =>
      fal.subscribe(modelId, {
        input: {
          image_url: imageUrl,
          prompt: safePrompt,
          negative_prompt: negativePrompt,
          duration,
          resolution: "720p",
          enable_safety_checker: false,
          enable_prompt_expansion: false,
        },
      }),
    "generate wan video"
  );

  const data = result.data as { video?: { url?: string } };
  const url = data.video?.url;
  if (!url) {
    throw new Error("No video returned from WAN 2.5");
  }

  return { url };
}

export async function generateLipsyncVideo(
  videoUrl: string,
  audioUrl: string
): Promise<{ url: string }> {
  const result = await withRetry(
    () =>
      fal.subscribe(MODEL_IDS["sync-lipsync"], {
        input: {
          video_url: videoUrl,
          audio_url: audioUrl,
          sync_mode: "cut_off",
        },
      }),
    "generate lipsync video"
  );

  const data = result.data as { video?: { url?: string } };
  const url = data.video?.url;
  if (!url) {
    throw new Error("No video returned from Sync Lipsync");
  }

  return { url };
}

export function addSpeechNaturalness(text: string): string {
  return text
    .replace(/\blol\b/gi, "*giggles*")
    .replace(/\blmao\b/gi, "*laughs*")
    .replace(/\bomg\b/gi, "oh my god")
    .replace(/\brn\b/gi, "right now")
    .replace(/\bu\b/gi, "you")
    .replace(/\bur\b/gi, "your")
    .replace(/\btbh\b/gi, "to be honest")
    .replace(/\bidk\b/gi, "I don't know");
}

export async function generateVoiceNote(
  text: string,
  voiceId?: string,
  profile?: VoiceProfile,
  emotion?: string
): Promise<FalAudioResult> {
  const naturalText = addSpeechNaturalness(text);
  const safePrompt = sanitizeImagePrompt(naturalText);
  const fallbackProfile = getDefaultVoiceProfile();
  const resolvedProfile = profile ?? (!voiceId ? fallbackProfile : undefined);

  const detectedEmotion = detectUserEmotion(text).emotion;
  const emotionOverride = getVoiceProfileForEmotion(detectedEmotion);
  const manualEmotion = emotion?.trim().toLowerCase();

  const contextualSpeed =
    manualEmotion === "whisper"
      ? 0.7
      : manualEmotion === "sad"
        ? 0.75
        : manualEmotion === "excited"
          ? 1.1
          : undefined;

  const resolvedVoiceId = resolvedProfile?.voiceId ?? voiceId ?? fallbackProfile.voiceId;
  const resolvedSpeed = contextualSpeed ?? emotionOverride.speed ?? resolvedProfile?.speed ?? 0.9;
  const resolvedPitch = emotionOverride.pitch ?? resolvedProfile?.pitch ?? -2;
  const resolvedEmotion =
    emotionOverride.emotion ??
    (resolvedProfile?.emotion as MiniMaxEmotion | undefined) ??
    "neutral";

  const result = await withRetry(
    () =>
      fal.subscribe("fal-ai/minimax/speech-2.8-turbo", {
        input: {
          prompt: safePrompt,
          voice_setting: {
            voice_id: resolvedVoiceId,
            speed: resolvedSpeed,
            vol: 1.0,
            pitch: resolvedPitch,
            emotion: resolvedEmotion,
            english_normalization: true,
          },
          audio_setting: {
            format: "mp3",
            sample_rate: 32000,
            bitrate: 128000,
            channel: 1,
          },
          output_format: "url",
        },
      }),
    "generate voice note"
  );
  const data = result.data as { audio?: { url: string }; duration_ms?: number };
  if (!data.audio?.url) throw new Error("No audio returned from MiniMax TTS");
  return { url: data.audio.url, duration_ms: data.duration_ms || 0 };
}

export async function generateVoiceNoteDia(
  text: string,
  emotion?: string
): Promise<{ url: string; duration_ms: number }> {
  const naturalText = addSpeechNaturalness(text);
  const safePrompt = sanitizeImagePrompt(naturalText);
  const modelId: string = MODEL_IDS["dia-tts"];

  const result = await withRetry(
    () =>
      fal.subscribe(modelId, {
        input: {
          text: safePrompt,
          ...(emotion ? { emotion } : {}),
        },
      }),
    "generate dia voice note"
  );

  const data = result.data as {
    audio?: { url?: string };
    url?: string;
    duration_ms?: number;
  };
  const url = data.audio?.url ?? data.url;
  if (!url) {
    throw new Error("No audio returned from Dia TTS");
  }

  return { url, duration_ms: data.duration_ms || 0 };
}

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const result = await withRetry(
    () =>
      fal.subscribe("fal-ai/whisper", {
        input: {
          audio_url: audioUrl,
          task: "transcribe",
          language: "en",
          chunk_level: "segment",
          version: "3",
        },
      }),
    "transcribe audio"
  );
  const data = result.data as { text?: string };
  if (!data.text) throw new Error("No transcription returned from Whisper");
  return data.text;
}
