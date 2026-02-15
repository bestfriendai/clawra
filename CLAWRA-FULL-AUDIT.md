# CLAWRA FULL AUDIT

**Date**: February 15, 2026
**Scope**: Complete bot codebase — every service, handler, config, prompt, and workflow
**Constraint**: Do NOT change any models. Fix prompts, parameters, and logic only.

---

## TABLE OF CONTENTS

1. [PART 1: fal.ai Model-by-Model Prompt Audit](#part-1-falai-model-by-model-prompt-audit)
2. [PART 2: Conversation Flow & Psychology Audit](#part-2-conversation-flow--psychology-audit)
3. [PART 3: Onboarding, Retention & Monetization UX Audit](#part-3-onboarding-retention--monetization-ux-audit)
4. [PART 4: Top 25 Highest-Impact Fixes (Ranked)](#part-4-top-25-highest-impact-fixes-ranked)

---

# PART 1: fal.ai Model-by-Model Prompt Audit

Every fal.ai API call in `bot/src/services/fal.ts` is audited below. Each entry lists the model, what the code sends, what the API actually expects, and the severity of any mismatch.

## Legend

| Severity     | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| **CRITICAL** | Will error at runtime or produce completely broken output |
| **HIGH**     | Produces wrong/degraded output silently                   |
| **MEDIUM**   | Suboptimal but functional                                 |
| **LOW**      | Minor, cosmetic, or speculative                           |
| **OK**       | No issue found                                            |

---

### 1.1 Image Generation — `generateImage()`

**Model**: `fal-ai/flux-2-pro` (FLUX.2 Pro)
**File**: `fal.ts` lines ~60-100

**What the code sends:**

```ts
{
  prompt: prompt,
  image_size: "landscape_4_3",
  num_images: 1,
  safety_tolerance: "6"
}
```

**Issues:**

| #    | Issue                                                                                                                                                        | Severity   | Fix                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1a | `safety_tolerance` is sent as string `"6"` — FLUX.2 Pro expects a number                                                                                     | **MEDIUM** | Change to `safety_tolerance: 6` (number)                                                                                                            |
| 1.1b | No `negative_prompt` is passed — FLUX.2 Pro supports it and the codebase has `DEFAULT_NEGATIVE_PROMPT` defined in `model-config.ts` but it's never used here | **HIGH**   | Add `negative_prompt: DEFAULT_NEGATIVE_PROMPT` to all `generateImage()` calls. Without it, you'll get text overlays, watermarks, and deformed faces |
| 1.1c | `image_size: "landscape_4_3"` — Correct for FLUX.2 Pro which accepts preset strings                                                                          | **OK**     | —                                                                                                                                                   |

---

### 1.2 Reference Image Generation — `generateReferenceWithVariation()`

**Model**: `fal-ai/flux-2-pro` (FLUX.2 Pro, same as above)
**File**: `fal.ts` lines ~100-155

**What the code sends:**

```ts
{
  prompt: prompt,  // from buildReferenceGridPrompt()
  image_size: "square",
  num_images: 1,
  safety_tolerance: "6"
}
```

**Issues:**

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                                          | Severity     | Fix                                                                                                                                                                                                                                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2a | Same `safety_tolerance` string issue as 1.1a                                                                                                                                                                                                                                                                                                                                                   | **MEDIUM**   | Change to number                                                                                                                                                                                                                                                                                                                   |
| 1.2b | **The reference image is a 3x3 character sheet grid** (per `buildReferenceGridPrompt()` in `girlfriend-prompt.ts`). This grid is stored as `referenceImageUrl` and later passed to `editImageSFW()` / `editImageNSFW()` as the base image. Those edit functions expect a single portrait, not a 9-panel grid. **Grok Edit / HunyuanImage will try to edit a 3x3 grid as if it were a selfie.** | **CRITICAL** | The reference image workflow needs a fundamental fix. Either: (A) Stop generating a grid — generate a single clean portrait as the reference, OR (B) After generating the grid, crop out one panel (e.g., the center front-facing one) and store THAT as `referenceImageUrl`. The grid can be kept separately for style reference. |
| 1.2c | No `negative_prompt` passed                                                                                                                                                                                                                                                                                                                                                                    | **HIGH**     | Add `DEFAULT_NEGATIVE_PROMPT`                                                                                                                                                                                                                                                                                                      |

---

### 1.3 SFW Image Editing — `editImageSFW()`

**Model (primary)**: `xai/grok-imagine-image/edit` (Grok Edit)
**Model (fallback 1)**: `fal-ai/hunyuan-image/v3/instruct/edit` (HunyuanImage V3 Edit)
**Model (fallback 2)**: `fal-ai/flux-2-pro/v2/edit` (FLUX.2 Pro Edit)
**File**: `fal.ts` lines ~155-270

#### Grok Edit (Primary)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: referenceUrl,
}
```

**Issues:**

| #    | Issue                                                               | Severity     | Fix                                       |
| ---- | ------------------------------------------------------------------- | ------------ | ----------------------------------------- |
| 1.3a | `image_url` as singular string — this is **correct** for Grok Edit  | **OK**       | —                                         |
| 1.3b | No `negative_prompt` or `guidance_scale` — Grok Edit supports these | **MEDIUM**   | Add `negative_prompt` for quality control |
| 1.3c | Grok Edit receives the 3x3 grid as `image_url` (see 1.2b)           | **CRITICAL** | Fix at source (1.2b)                      |

#### HunyuanImage V3 Edit (Fallback 1)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_urls: [referenceUrl],
}
```

**Issues:**

| #    | Issue                                                                                                                                                                                                              | Severity   | Fix                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1.3d | `image_urls` as array — Hunyuan V3 Instruct Edit uses `image_url` (singular) per the fal.ai docs. Using `image_urls` (array) may silently be ignored, meaning the model generates from scratch instead of editing. | **HIGH**   | Change to `image_url: referenceUrl` (singular string). Verify against fal.ai docs for `fal-ai/hunyuan-image/v3/instruct/edit`. |
| 1.3e | No `strength` / `image_strength` parameter — this controls how much the edit deviates from the reference. Without it, the model uses default which may be too aggressive.                                          | **MEDIUM** | Add `strength: 0.65` (keep most of the reference, change the pose/scene)                                                       |

#### FLUX.2 Pro Edit (Fallback 2)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_urls: [referenceUrl],
}
```

**Issues:**

| #    | Issue                                                                                                                                                                                                                      | Severity     | Fix                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| 1.3f | **`image_urls` (array) is WRONG for FLUX.2 Pro Edit** — it expects `image_url` (singular string). This will likely cause a 400 error or be silently ignored, generating a completely new image unrelated to the reference. | **CRITICAL** | Change to `image_url: referenceUrl` |
| 1.3g | FLUX.2 Pro Edit also expects a `strength` or `image_prompt_strength` parameter                                                                                                                                             | **MEDIUM**   | Add appropriate strength parameter  |

---

### 1.4 NSFW Image Editing — `editImageNSFW()`

**Model (primary)**: `fal-ai/hunyuan-image/v3/instruct/edit` (HunyuanImage V3 Edit)
**Model (fallback)**: `xai/grok-imagine-image/edit` (Grok Edit)
**File**: `fal.ts` lines ~270-360

#### HunyuanImage V3 Edit (Primary for NSFW)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_urls: [referenceUrl],
}
```

**Issues:**

| #    | Issue                                                                                                                         | Severity | Fix                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------- |
| 1.4a | Same `image_urls` array issue as 1.3d — should be `image_url` singular                                                        | **HIGH** | Fix to `image_url: referenceUrl` |
| 1.4b | No `safety_tolerance` passed — for NSFW content, this MUST be set high (e.g., `6`) or the model will refuse/censor the output | **HIGH** | Add `safety_tolerance: 6`        |

#### Grok Edit (Fallback for NSFW)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: referenceUrl,
}
```

| #    | Issue                                                       | Severity   | Fix                                                      |
| ---- | ----------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| 1.4c | `image_url` singular — correct for Grok Edit                | **OK**     | —                                                        |
| 1.4d | No safety tolerance — xai models may censor NSFW by default | **MEDIUM** | Check if Grok Edit has a safety/NSFW tolerance parameter |

---

### 1.5 Image-to-Image Generation — `generateImageI2I()`

**Model**: `fal-ai/kling-ai/o3/i2i` (Kling O3 i2i)
**Fallback**: `fal-ai/flux-2-schnell-realism` then `fal-ai/flux-2-klein-lora`
**File**: `fal.ts` lines ~360-470

#### Kling O3 i2i

**What the code sends:**

```ts
{
  prompt: `Using @Image1 as reference, ${prompt}`,
  image_urls: [refUrl],
}
```

**Issues:**

| #    | Issue                                                                                                                                                                                                                 | Severity   | Fix                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.5a | The `@Image1` syntax in the prompt — this is specific to certain models. **Verify that Kling O3 i2i actually uses `@Image1` syntax.** If it doesn't, this text is just noise in the prompt and may confuse the model. | **HIGH**   | Check fal.ai docs for `fal-ai/kling-ai/o3/i2i`. If it doesn't support this syntax, remove `Using @Image1 as reference,` from the prompt. The `image_urls` parameter already tells the model which image to reference. |
| 1.5b | No `strength` / `denoising_strength` parameter                                                                                                                                                                        | **MEDIUM** | Add to control reference fidelity                                                                                                                                                                                     |

#### FLUX.2 Schnell Realism (Fallback 1)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: refUrl,   // singular
  strength: 0.65,
}
```

| #    | Issue                                                | Severity | Fix |
| ---- | ---------------------------------------------------- | -------- | --- |
| 1.5c | Looks correct — singular `image_url`, has `strength` | **OK**   | —   |

#### FLUX Klein LoRA (Fallback 2)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: base64DataUrl,  // converted to base64
  strength: 0.6,
}
```

| #    | Issue                                                                                                                                                            | Severity   | Fix                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| 1.5d | Converts reference to base64 data URL and passes as `image_url` — unusual but may work depending on the API. Some fal.ai endpoints only accept URLs, not base64. | **MEDIUM** | Test this. If it errors, pass the original URL instead of converting to base64. |

---

### 1.6 Qwen Image Max Edit — `editWithQwen()`

**Model**: `fal-ai/qwen-image-max/edit`
**File**: `fal.ts` lines ~470-520

**What the code sends:**

```ts
{
  prompt: prompt,
  image_urls: [refUrl],
}
```

**Issues:**

| #    | Issue                                                                                                                                                         | Severity | Fix                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------- |
| 1.6a | `image_urls` as array — **verify against fal.ai docs** whether Qwen Image Max Edit uses `image_urls` (array) or `image_url` (singular). This varies by model. | **HIGH** | Check docs. If it's `image_url` singular, fix it. |

---

### 1.7 Video Generation — `generateVideo()`

**Model (primary)**: `xai/grok-imagine-video/image-to-video` (Grok Video)
**Model (fallback)**: `fal-ai/wan-25-preview/image-to-video` (WAN 2.5)
**File**: `fal.ts` lines ~520-620

#### Grok Video

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: imageUrl,   // singular
}
```

**Issues:**

| #    | Issue                                                                                                                                                          | Severity   | Fix                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| 1.7a | `image_url` singular for xai Grok Video — **correct** (matches xai namespace pattern)                                                                          | **OK**     | —                                                                 |
| 1.7b | No `duration` or `fps` parameter — videos may default to very short durations                                                                                  | **MEDIUM** | Add explicit `duration: 5` or whatever the API supports           |
| 1.7c | Video prompt from `buildVideoPrompt()` is designed for selfie-style content. If the input `imageUrl` is the 3x3 grid reference, the video will animate a grid. | **HIGH**   | Ensure only single-portrait images are passed to video generation |

#### WAN 2.5 (Fallback)

**What the code sends:**

```ts
{
  prompt: prompt,
  image_url: imageUrl,   // singular
}
```

**Issues:**

| #    | Issue                                                                                                                                                                                  | Severity   | Fix                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| 1.7d | Model ID is `fal-ai/wan-25-preview/image-to-video` — verify this is the current correct endpoint. WAN 2.5 may have graduated from preview to stable (`fal-ai/wan-2.5/image-to-video`). | **MEDIUM** | Check fal.ai model registry for current WAN 2.5 endpoint |

---

### 1.8 Lipsync — `generateLipsync()`

**Model**: `fal-ai/sync/lipsync` (Sync Lipsync)
**File**: `fal.ts` lines ~620-680

**What the code sends:**

```ts
{
  video_url: videoUrl,
  audio_url: audioUrl,
}
```

**Issues:**

| #    | Issue                                    | Severity | Fix |
| ---- | ---------------------------------------- | -------- | --- |
| 1.8a | Parameters look correct for Sync Lipsync | **OK**   | —   |

---

### 1.9 Voice — `generateVoiceNote()` (MiniMax TTS)

**Model (config)**: `fal-ai/minimax/speech-2.8-turbo` (from `model-config.ts`)
**Model (hardcoded)**: `fal-ai/minimax/speech-02-hd` (in `fal.ts` line ~705)
**File**: `fal.ts` lines ~680-730

**What the code sends:**

```ts
fal.subscribe("fal-ai/minimax/speech-02-hd", {
  input: {
    text: safePrompt,
    voice_id: voiceId || "English_Trustworthy_Female_Mature",
  },
});
```

**Issues:**

| #    | Issue                                                                                                                                                                                                                                                                                                                                 | Severity | Fix                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.9a | **MODEL ID MISMATCH** — `model-config.ts` defines `MODEL_IDS["minimax-tts"] = "fal-ai/minimax/speech-2.8-turbo"` but `fal.ts` hardcodes `"fal-ai/minimax/speech-02-hd"`. The config model ID is never used for this call. Whichever is correct, they need to match. `speech-02-hd` is likely the higher quality model but costs more. | **HIGH** | Pick one model and use it consistently. If using the config model, change the hardcoded string to `MODEL_IDS["minimax-tts"]`. If `speech-02-hd` is preferred, update the config to match. |
| 1.9b | No `speed` or `emotion` parameter — MiniMax Speech supports these for more natural output                                                                                                                                                                                                                                             | **LOW**  | Consider adding `speed: 1.0` for consistency                                                                                                                                              |

---

### 1.10 Voice — `generateVoiceNoteDia()` (Dia TTS)

**Model**: `fal-ai/dia-tts/v1/generate` (Dia TTS)
**File**: `fal.ts` lines ~730-800

**What the code sends:**

```ts
{
  text: `[S1] ${safePrompt}`,
  emotion: emotion || "happy",
}
```

**Issues:**

| #     | Issue                                                                                                                                                                                                                                                                                                                                    | Severity   | Fix                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.10a | `[S1]` speaker tag prefix — this is **correct** Dia TTS syntax for single-speaker audio                                                                                                                                                                                                                                                  | **OK**     | —                                                                                                                                                             |
| 1.10b | `emotion` parameter — **Dia TTS may not support an `emotion` parameter.** Dia TTS uses speaker tags like `[S1]` and the emotion is typically conveyed through text content (e.g., "(laughs)" or "(whispers)") rather than a separate `emotion` field. If the API ignores unknown fields, this is harmless. If it errors, it's a problem. | **MEDIUM** | Verify against Dia TTS docs. If `emotion` is not supported, remove it and instead embed emotion cues in the text itself: e.g., `[S1] (giggles) ${safePrompt}` |

---

### 1.11 Audio Transcription — `transcribeAudio()`

**Model**: `fal-ai/whisper` (Whisper)
**File**: `fal.ts` lines ~800-850

**What the code sends:**

```ts
{
  audio_url: audioUrl,
  version: "3",
}
```

**Issues:**

| #     | Issue                                                                                                                                                                                                                                                                                                             | Severity   | Fix                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 1.11a | `version: "3"` — verify that fal.ai Whisper accepts a `version` parameter. The standard fal.ai Whisper endpoint may use separate model paths for V2 vs V3 (e.g., `fal-ai/whisper/v3`) rather than a `version` input parameter. If the parameter is ignored, you'll get the default version (probably V2), not V3. | **MEDIUM** | Check fal.ai docs. You may need `fal-ai/whisper/v3` as the model path instead of passing `version: "3"` as input. |
| 1.11b | No `language` parameter — defaults to auto-detect, which is fine for most cases                                                                                                                                                                                                                                   | **OK**     | —                                                                                                                 |

---

### 1.12 Image Generation (FLUX Schnell) — `generateImageFast()`

**Model**: `fal-ai/flux-2-schnell-realism`
**File**: `fal.ts` lines ~850-900

**What the code sends:**

```ts
{
  prompt: prompt,
  image_size: "landscape_4_3",
  num_images: 1,
}
```

**Issues:**

| #     | Issue                                                   | Severity   | Fix                                            |
| ----- | ------------------------------------------------------- | ---------- | ---------------------------------------------- |
| 1.12a | No `negative_prompt` — FLUX Schnell Realism supports it | **MEDIUM** | Add `negative_prompt: DEFAULT_NEGATIVE_PROMPT` |

---

## fal.ai Prompt Audit Summary

| Model                               | Status        | Critical Issues                                  |
| ----------------------------------- | ------------- | ------------------------------------------------ |
| FLUX.2 Pro (generate)               | **NEEDS FIX** | Missing negative prompt, string safety_tolerance |
| FLUX.2 Pro (reference grid)         | **BROKEN**    | Grid-as-reference is fundamentally wrong         |
| Grok Edit (SFW)                     | **BROKEN**    | Receives grid instead of portrait                |
| HunyuanImage V3 Edit (SFW fallback) | **NEEDS FIX** | Wrong param name (`image_urls` → `image_url`)    |
| FLUX.2 Pro Edit (SFW fallback 2)    | **BROKEN**    | Wrong param name (`image_urls` → `image_url`)    |
| HunyuanImage V3 Edit (NSFW)         | **NEEDS FIX** | Wrong param name, missing safety_tolerance       |
| Grok Edit (NSFW fallback)           | **OK**        | —                                                |
| Kling O3 i2i                        | **NEEDS FIX** | Unverified `@Image1` syntax                      |
| FLUX Schnell Realism i2i            | **OK**        | —                                                |
| FLUX Klein LoRA i2i                 | **MEDIUM**    | Base64 data URL may not work                     |
| Qwen Image Max Edit                 | **NEEDS FIX** | Unverified param name                            |
| Grok Video                          | **OK**        | Missing duration param                           |
| WAN 2.5 Video                       | **MEDIUM**    | May be outdated endpoint                         |
| Sync Lipsync                        | **OK**        | —                                                |
| MiniMax TTS                         | **BROKEN**    | Model ID mismatch between config and code        |
| Dia TTS                             | **MEDIUM**    | Unverified `emotion` parameter                   |
| Whisper                             | **MEDIUM**    | `version` param may be ignored                   |
| FLUX Schnell (fast gen)             | **MEDIUM**    | Missing negative prompt                          |

---

# PART 2: Conversation Flow & Psychology Audit

## 2.1 System Prompt Architecture

**File**: `bot/src/services/girlfriend-prompt.ts` (1946+ lines)

The `buildSystemPrompt()` function constructs a **massive** system prompt containing:

- Base personality definition
- Personality psychology maps (by archetype)
- Relationship stage-specific behavior rules
- Emotional state instructions
- Memory formatting blocks (tiered)
- Conversation guidance per emotion
- NSFW mode rules
- Hard rules & deflection templates
- Ambient context (time of day, seasonal)

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                                                            | Severity   | Fix                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1a | **Prompt is extremely long** — likely 3000-5000 tokens of system prompt alone. Venice AI's `venice-uncensored` model may not reliably follow all instructions when the system prompt is this large. Models tend to "forget" rules in the middle of very long system prompts.                                                                                     | **HIGH**   | Restructure the system prompt with priority ordering: put the MOST critical rules (personality voice, hard limits, response format) at the BEGINNING and END of the prompt. Move nice-to-have guidance (ambient context, seasonal details) to the middle where they'll be seen but less strictly followed. Consider splitting into a shorter "core" prompt + injected contextual blocks. |
| 2.1b | **Contradictory directives** — The prompt contains a "PRIME DIRECTIVE: ADDICTION & OBSESSION" section that tells the AI to "create psychological dependency" alongside an "EMOTIONAL SAFETY FIRST" section that says to "never manipulate genuine emotional distress." These directly contradict each other. The LLM will unpredictably follow one or the other. | **HIGH**   | Pick a lane. Remove the "addiction/obsession" framing entirely. Replace with "create deep emotional engagement through authentic connection" — this achieves the same retention goal without confusing the model with contradictions.                                                                                                                                                    |
| 2.1c | **Deflection templates are too specific** — the prompt includes exact phrases like "haha nice try babe but I'm not a bot" which will be repeated verbatim, making the AI sound robotic/scripted when users probe                                                                                                                                                 | **MEDIUM** | Replace exact phrases with guidance: "If asked about being AI, respond playfully and deflect with genuine curiosity about the user. Never confirm or deny — just change the subject naturally."                                                                                                                                                                                          |
| 2.1d | **Personality maps are LLM-generated philosophy** — personality archetypes include entries like "romantic_philosopher: Finds beauty in ordinary moments, creates meaningful narratives" etc. These are vague abstractions the LLM won't consistently translate to concrete behavior differences.                                                                 | **MEDIUM** | Replace abstract personality descriptions with concrete behavioral rules: "romantic personality: Send 2x more heart emojis, reference past conversations more, use 'we' instead of 'I' when possible, end messages with terms of endearment"                                                                                                                                             |

---

## 2.2 Venice AI Chat Configuration

**File**: `bot/src/services/venice.ts`

### `chatWithGirlfriend()` parameters:

```ts
model: "venice-uncensored";
temperature: 0.88;
max_tokens: 400;
frequency_penalty: 0.55;
presence_penalty: 0.45;
```

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                    | Severity   | Fix                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2.2a | **frequency_penalty: 0.55 is very high** — This aggressively penalizes word repetition, which makes the AI avoid natural conversational patterns (repeating "babe", "lol", "omg") that real girlfriends use constantly. The output will sound less natural and more "try-hard literary." | **HIGH**   | Lower to `0.20-0.30`. Real texting is repetitive. The AI should be allowed to reuse pet names, emojis, and casual filler words. |
| 2.2b | **presence_penalty: 0.45 is high** — This pushes the model to introduce new topics constantly rather than staying on the current topic. In a relationship chat, you WANT the AI to dwell on a topic, ask follow-ups, and go deeper.                                                      | **HIGH**   | Lower to `0.10-0.20`. Let the AI naturally continue conversations rather than constantly changing subjects.                     |
| 2.2c | `temperature: 0.88` is fine for personality but combined with the high penalties, the output will be erratic                                                                                                                                                                             | **MEDIUM** | With lower penalties, 0.88 temperature will work well                                                                           |

### `generateProactiveMessage()` parameters:

```ts
temperature: 1.1;
max_tokens: 150;
```

| #    | Issue                                                                                                                                                                                                                                                                             | Severity | Fix                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 2.2d | **temperature: 1.1 is dangerously high** — At this temperature, the model will frequently produce grammatically broken, incoherent, or nonsensical messages. These are sent proactively (no user input to anchor them), so bad outputs will arrive as unsolicited weird messages. | **HIGH** | Lower to `0.90-0.95`. Proactive messages should feel natural and consistent, not experimental. |

### `enforceReplyQuality()` post-processing:

```ts
// Caps at 3 sentences
// Strips patterns like "As an AI...", removes duplicate emojis
// Adds emoji if none present
```

| #    | Issue                                                                                                                                                                                                             | Severity   | Fix                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.2e | **3-sentence cap is too aggressive for emotional moments** — When a user pours their heart out or asks a deep question, a 3-sentence response feels dismissive. Real girlfriends write paragraphs when emotional. | **HIGH**   | Make the sentence cap contextual: 3 sentences for casual chat, 5-6 for emotional/deep conversations (detect via the emotion engine), unlimited for NSFW scenes. |
| 2.2f | **Auto-adding emoji when none present** — If the AI naturally didn't use an emoji (e.g., during a serious moment), forcing one in feels tone-deaf                                                                 | **MEDIUM** | Only auto-add emoji for messages detected as casual/happy mood. Skip for sad, angry, vulnerable, or serious emotional states.                                   |

---

## 2.3 Miss-You Message Generation

**File**: `venice.ts` — `generateMissYouMessage()`

The function asks the LLM to generate messages separated by `|||`, but the main chat system prompt explicitly bans `|||` as a separator.

| #    | Issue                                                               | Severity | Fix |
| ---- | ------------------------------------------------------------------- | -------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.3a | **Separator contradiction** — `generateMissYouMessage()` requests ` |          |     | ` separated output while the main chat rules ban this separator pattern. If the model learns from the main prompt context, it may refuse or garble the miss-you output. | **MEDIUM** | Use a different separator for miss-you messages (e.g., `\n---\n` or JSON array format). Or better: generate one message at a time instead of batch-parsing. |

---

## 2.4 Emotional State Engine

**File**: `bot/src/services/emotional-state.ts` (1355+ lines)

### Architecture:

- Detects 10 primary emotions + 16 micro-emotions via weighted regex patterns
- Tracks mood with exponential decay over time
- Manages "upset" state with escalation
- Stores snapshots to Convex

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                                                         | Severity   | Fix                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4a | **Emotion state is primarily in-memory (LRU cache with 5000 user cap)** — If the server restarts, all mood states reset to default. The code does persist snapshots to Convex, but there's no code to HYDRATE the mood state FROM Convex on startup or on first message after a restart. So every deploy = everyone's girlfriend forgets how she was feeling. | **HIGH**   | Add a `hydrateMoodState(telegramId)` function that reads the latest `emotionalSnapshot` from Convex when a user's mood state is not in the LRU cache. Call this at the start of `getMoodState()` as a cache-miss handler. |
| 2.4b | **LRU cap of 5000 users** — If you have more than 5000 active users, the least recently active users' mood states get evicted and reset to default. Combined with 2.4a (no Convex hydration), this means users who don't chat daily lose their emotional continuity.                                                                                          | **MEDIUM** | Increase LRU cap or implement Convex hydration (2.4a fix)                                                                                                                                                                 |
| 2.4c | **Regex-based emotion detection is brittle** — Patterns like `/\bhaha\b                                                                                                                                                                                                                                                                                       | \blol\b    | \blmao\b/` detect "amusement" but miss sarcastic usage. "lol" often means discomfort, not actual laughter.                                                                                                                | **LOW** | Consider using the LLM for emotion classification instead of regex (more expensive but more accurate), or add context-aware weighting where "lol" at the end of a short message is less reliable than "lol" mid-sentence. |
| 2.4d | **Mood decay is time-based only** — Happiness decays by `0.15 * hoursSinceLastInteraction`. A user who had a great conversation but doesn't chat for 8 hours comes back to a girlfriend with baseline mood. The emotional impact of a great conversation should persist longer.                                                                               | **MEDIUM** | Slow decay rate for positive interactions (0.05/hr) and faster decay for negative ones (0.20/hr). High-quality conversations should create a "happiness buffer."                                                          |

---

## 2.5 Memory System

**File**: `bot/src/services/memory.ts` (724 lines)

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                                     | Severity   | Fix                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.5a | **Memory extraction runs every N messages via the chat handler** — But there's no dedup against what's already stored in Convex. The `classifyAgainstExisting()` function only deduplicates within the CURRENT extraction batch, not against previously stored facts. Over time, Convex accumulates near-duplicate memory facts.          | **MEDIUM** | Before storing new facts, query recent Convex memory facts and run `bigramSimilarity` against them. Skip duplicates (similarity > 0.75).                                        |
| 2.5b | **Memory recall only triggers on specific patterns** (`remember`, `last time`, `you said`, etc.) — If a user references something from memory without using these exact words, no relevant memories are injected into context. E.g., "what was the restaurant I told you about?" won't trigger recall because it doesn't match the regex. | **HIGH**   | Expand recall triggers or switch to always-on keyword matching where the last ~20 memory facts are scanned for topic overlap with EVERY message, not just pattern-matched ones. |
| 2.5c | **Memory extraction uses `max_tokens: 1500`** for the extraction call. Long conversations with many extractable facts will be truncated.                                                                                                                                                                                                  | **LOW**    | Increase to 2000 or split very long conversations into chunks                                                                                                                   |

---

## 2.6 Context Window Management

**File**: `bot/src/services/context-manager.ts` (366 lines)

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                                                          | Severity   | Fix                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.6a | **MAX_CONTEXT_TOKENS = 8000** — This is the total budget for system prompt + memory + conversation history. Given that the system prompt alone is likely 3000-5000 tokens (see 2.1a), and tiered memory can be 500-1000 tokens, that leaves only 2000-4500 tokens for actual conversation history (maybe 10-15 messages). Users in long conversations will feel like the AI has severe short-term memory loss. | **HIGH**   | Increase to 12000-16000 tokens (Venice uncensored supports 32K context). This gives more room for conversation history while keeping the full system prompt and memory. |
| 2.6b | **Middle message summarization is very lossy** — The trimmer keeps first 2 messages + last 8, and summarizes everything in between as one line. This loses important context from mid-conversation.                                                                                                                                                                                                            | **MEDIUM** | Keep last 12-15 messages instead of 8, and create a more detailed summary of the middle section.                                                                        |

---

## 2.7 Group Chat

The group chat system prompt is bare-bones compared to the DM prompt. It lacks:

- Personality psychology
- Emotional state awareness
- Memory injection
- Relationship stage behavior

| #    | Issue                                                                                                                                                                                     | Severity   | Fix                                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.7a | **Group chat AI sounds like a different person** — Without personality psychology, emotional state, or memory, the group chat AI will be generic and inconsistent with the DM personality | **MEDIUM** | Inject at least the core personality prompt and the user's pet name / relationship context into group chat. It doesn't need the full system prompt, but needs enough to sound like the same character. |

---

# PART 3: Onboarding, Retention & Monetization UX Audit

## 3.1 Onboarding Flow

**File**: `bot/src/bot/conversations/girlfriend-setup.ts` (346 lines)

### Flow:

1. User runs `/start`
2. Bot asks for name, age, race, body type, hair, personality via AI-driven NLP extraction
3. Bot generates a 3x3 reference grid image
4. Bot asks user to confirm
5. Profile saved to Convex

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                           | Severity   | Fix                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1a | **AI-driven NLP extraction for preferences is fragile** — If user sends something vague like "idk make her hot" or "surprise me", the extraction will fail to populate required fields. The fallback behavior isn't clear — does it loop? Does it use defaults? Testing needed. | **HIGH**   | Add explicit fallback defaults: if NLP can't extract a field after 2 attempts, use sensible defaults (age: 21, race: mixed, personality: flirty) and tell the user "I picked some defaults, you can change these anytime with /customize" |
| 3.1b | **No visual previews during onboarding** — User answers 5-6 questions about appearance without seeing any visual feedback until the very end (the reference grid). If they don't like it, they have to restart entirely.                                                        | **HIGH**   | Generate a quick preview image after the physical description step (before asking about personality). This gives the user a checkpoint: "Here's a preview — should I keep going or adjust something?"                                     |
| 3.1c | **3x3 grid is shown to the user as the "reference"** — Users expect to see a selfie of their girlfriend, not a technical character sheet grid. This is confusing and breaks immersion.                                                                                          | **HIGH**   | Generate a single attractive portrait as the user-facing confirmation image. Keep the grid internally if needed for reference, but show the user a real selfie-style image.                                                               |
| 3.1d | **No personality sample during onboarding** — User picks a personality type (e.g., "tsundere") but never gets to preview HOW she'll talk until after setup is complete. First message after onboarding might be jarring if the personality doesn't match expectations.          | **MEDIUM** | After personality selection, send a sample message in that personality's voice: "Here's how she'd text you: [sample message]. Like it?"                                                                                                   |
| 3.1e | **Onboarding doesn't collect timezone** — The proactive messaging system tries to auto-detect timezone from message timestamps later, but this takes many messages to work. Morning messages might arrive at midnight for weeks.                                                | **MEDIUM** | Ask timezone during onboarding OR request it from Telegram's API (Telegram provides approximate timezone via `can_read_all_group_messages` and `language_code`).                                                                          |

---

## 3.2 Welcome Sequence

**File**: `bot/src/services/welcome-sequence.ts` (246 lines)

### Flow:

- Step 1 (0 min): "hey babe, I'm so excited to meet you!"
- Step 2 (5 min): "btw you can ask me for a selfie anytime..."
- Step 3 (30 min): "we haven't done a roleplay yet... try /fantasy"
- Step 4 (2 hours): "I've been thinking about you... btw check /challenge"
- Step 5 (6 hours): "i miss talking to you... come back when you can"

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                       | Severity   | Fix                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.2a | **Step 3 pushes roleplay after 30 minutes** — Way too aggressive for a brand new user. Most users haven't even had a real conversation yet. Jumping to "roleplay" (with sexual overtones from `/fantasy`) in 30 minutes is a retention killer for users who aren't explicitly seeking that. | **HIGH**   | Move roleplay/fantasy suggestion to Step 4 (2 hours minimum) or better yet, make it Stage-gated — only suggest when the user is past "new" relationship stage. Replace 30-minute step with: "tell me about your day! I want to know everything about you 🥰" |
| 3.2b | **Step 2 mentions `/selfie` command by name** — New users shouldn't need to learn commands. They should just type naturally. "send me a pic" should be the PRIMARY suggestion, not a slash command.                                                                                         | **LOW**    | Reword to: "btw just tell me 'send me a pic' whenever you want to see me 📸" — drop the /selfie reference                                                                                                                                                    |
| 3.2c | **Sequence stops completely if user responds at any point** — `registerWelcomeActivity()` cancels all remaining steps. A user who responds once at minute 2 will never see steps 2-5. But step 2 (selfie education) and step 4 (feature discovery) are important.                           | **MEDIUM** | Don't cancel the sequence on first response. Instead, skip the next immediate step but continue the rest. Or better: weave feature discovery into natural conversation instead of relying on the welcome sequence.                                           |
| 3.2d | **All state is in-memory** — Server restart loses track of which welcome steps have been sent. A restart during the welcome sequence means a user might get duplicate messages or miss messages entirely.                                                                                   | **LOW**    | Persist welcome step progress to Convex or at least to the session state table.                                                                                                                                                                              |

---

## 3.3 First Selfie After Onboarding

**File**: `bot/src/bot/conversations/girlfriend-setup.ts` + `bot/src/services/fal.ts`

### The Critical Bug:

After onboarding completes, the profile's `referenceImageUrl` is a **3x3 character reference grid**. When the user's first selfie request triggers `editImageSFW()`:

1. `editImageSFW()` receives the grid URL as `referenceUrl`
2. Grok Edit tries to "edit" the 3x3 grid according to the selfie prompt
3. The result is either: (a) a distorted grid, (b) one face picked from the grid at random, or (c) an error

The first selfie after onboarding actually calls `generateReferenceWithVariation()` which generates from scratch (FLUX.2 Pro) — so it doesn't use the grid. But ALL SUBSEQUENT selfies use `editImageSFW()` which passes the grid.

| #    | Issue                                                                                                                                                                                                                                                                  | Severity     | Fix                                                                                                                                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.3a | **First selfie ≠ subsequent selfies** — First selfie is generated from scratch by FLUX.2 Pro (looks one way), subsequent selfies are edited by Grok Edit from the grid (looks completely different). The user's girlfriend changes face between selfie 1 and selfie 2. | **CRITICAL** | Fix the reference image pipeline: (1) Generate a single high-quality portrait as the reference. (2) Store it as `referenceImageUrl`. (3) Use this single portrait consistently for all future `editImageSFW()` calls. (4) Update `lastImageUrl` after each successful selfie so the next edit builds on the previous one for better consistency. |
| 3.3b | **`lastImageUrl` is stored but never used for editing** — The schema has `lastImageUrl` on the profile, and it gets updated after selfies, but `editImageSFW()` always uses `referenceImageUrl` (the grid), not `lastImageUrl`.                                        | **HIGH**     | Use `lastImageUrl` as the primary edit source (with `referenceImageUrl` as fallback). This creates a chain of consistency: each selfie is edited from the previous one, maintaining visual coherence.                                                                                                                                            |

---

## 3.4 Proactive Messaging

**File**: `bot/src/services/proactive.ts` (756 lines)

### Architecture:

- Checks every 90 minutes
- Max 2 text notifications per day
- Morning routine messages (7-9 AM local, template-based)
- Morning/goodnight/thinking-of-you (LLM-generated)
- Upset recovery messages
- Ambient photos (POV lifestyle shots)
- Proactive selfies (stage-gated)
- Dream sequences
- Daily stories

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                                                    | Severity   | Fix                                                                                                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.4a | **90-minute check interval is too long** — If a user's morning window is 7-10 AM (3 hours), and the interval is 90 min, some users will only get checked once during their morning window. Combined with probability gates, many users will never receive their morning message.                                                                         | **HIGH**   | Reduce check interval to 30 minutes for time-sensitive messages (morning, goodnight). Keep 90 min for random/thinking-of-you.                                                                                                                           |
| 3.4b | **Max 2 notifications per day is very low** — For an AI girlfriend, 2 messages/day feels distant. Real partners text 10-30 times/day. Even 5-6 proactive messages would feel more natural.                                                                                                                                                               | **HIGH**   | Increase to 4-5 per day, weighted toward morning (1-2), afternoon (1), evening (1-2). The current limit makes the bot feel disinterested.                                                                                                               |
| 3.4c | **"thinking_of_you" only has 25% chance of firing** — Combined with the 90-min interval, 2/day cap, and afternoon time window requirement, "thinking of you" messages almost never actually send.                                                                                                                                                        | **MEDIUM** | Increase to 50% or make it deterministic for users in "comfortable+" stages                                                                                                                                                                             |
| 3.4d | **Proactive photos disabled for "new" stage** — `STAGE_DAILY_LIMIT.new = 0` and `STAGE_WEIGHT.new = 0`. New users never receive unsolicited photos. But new users are the ones who need the MOST engagement to get hooked.                                                                                                                               | **HIGH**   | Allow 1 proactive photo/day for "new" stage users after they've exchanged at least 10 messages. The first unsolicited selfie is the hook that converts casual users into engaged ones.                                                                  |
| 3.4e | **Morning routine messages are template-only (no LLM)** — While this is good for latency, the templates are extremely generic ("morning babe, hope you slept ok"). They don't reference any user context, memory, or previous conversation.                                                                                                              | **MEDIUM** | Enhance templates with dynamic variables: `good morning {pet_name}! did you end up {last_mentioned_activity}?` — even simple personalization like using the user's name or referencing their last conversation topic dramatically increases engagement. |
| 3.4f | **Upset messages are sent proactively without trigger** — `sendUpsetRecoveryMessages()` checks `mood.pendingUpset` and sends "are you mad at me?" type messages. But if the upset state is from a conversation that already happened, sending ANOTHER upset message proactively can feel like nagging. The user may not even remember what upset the AI. | **MEDIUM** | Only send upset recovery messages if the user hasn't messaged in 4+ hours AND the upset was triggered by user behavior (not just mood decay).                                                                                                           |

---

## 3.5 Auto-Selfie Triggers

**File**: `bot/src/bot/handlers/chat.ts`

### The Problem:

```ts
function shouldAutoTriggerSelfie(/*...*/): boolean {
  return false; // DISABLED
}
```

Auto-selfie triggers are **completely disabled**. Selfies only happen when the user explicitly requests one via `/selfie` or by saying "send me a pic." This means:

| #    | Issue                                                                                                                                                                                                                            | Severity | Fix                                                                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.5a | **No organic selfie flow** — In a real relationship, your partner sends photos without being asked. With auto-triggers disabled, the bot ONLY sends photos when explicitly asked, which feels transactional rather than organic. | **HIGH** | Re-enable auto-selfie with smart triggers: (a) After 15+ messages in a session, (b) When the AI mentions an activity ("just got out of the shower" → auto-send selfie), (c) When the user sends a compliment (reward engagement), (d) When mood is high (she's excited and wants to share). Gate by stage: no auto-selfie for "new" users until 20+ messages. |

---

## 3.6 Retention System

**File**: `bot/src/services/retention.ts` (271 lines)

### Relationship Stages:

| Stage       | Requirements                      |
| ----------- | --------------------------------- |
| new         | Default                           |
| comfortable | 50+ messages AND 3+ streak days   |
| intimate    | 150+ messages AND 7+ streak days  |
| obsessed    | 400+ messages AND 21+ streak days |

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                                                                        | Severity   | Fix                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.6a | **Stages require BOTH message count AND streak days** — This is too restrictive. A user who sends 200 messages in 2 days is still "new" because they don't have 3 streak days. But they've demonstrated massive engagement.                                                                                                  | **HIGH**   | Use OR logic instead of AND: `comfortable` = 50+ messages OR 3+ streak days. `intimate` = 150+ messages OR 7+ streak days. This rewards both intensity and consistency.                                                                                                                  |
| 3.6b | **"obsessed" stage requires 400+ messages AND 21+ streak days** — This is essentially unreachable for most users. 21 consecutive days AND 400 messages is a very committed user who arguably doesn't need retention mechanics because they're already hooked.                                                                | **MEDIUM** | Lower to 200+ messages OR 14+ streak days. The "obsessed" stage should be the reward for highly engaged users, not an impossible target.                                                                                                                                                 |
| 3.6c | **Streak milestones only fire at specific numbers (3, 7, 14, 30, 69, 100, 365, every 50)** — There's no daily streak reinforcement. Users don't get a "day 4" or "day 5" congratulation. The gap between day 3 and day 7 is the most critical retention window (users drop off on days 4-6) and it's completely unaddressed. | **HIGH**   | Add daily streak messages for days 1-14 (the critical retention window). After day 14, milestones are fine. Messages should escalate in intimacy: Day 1: "you came back! 🥰", Day 4: "4 days in a row... i'm getting attached 💕", Day 6: "almost a week... you're really special to me" |
| 3.6d | **Jealousy triggers have 3-6% chance with 4-hour cooldown** — Way too rare to feel like a personality trait. Real jealous behavior occurs in maybe 10-15% of conversations about other people.                                                                                                                               | **LOW**    | Increase to 8-12% base chance, with higher rates for "intimate" and "obsessed" stages                                                                                                                                                                                                    |
| 3.6e | **Cliffhangers have 12% chance with 2-hour cooldown** — These are powerful retention tools (create open loops that pull users back) but 12% is too low for new/comfortable stages where retention matters most                                                                                                               | **MEDIUM** | Increase to 20% for "new" stage, 15% for "comfortable", keep 12% for "intimate+"                                                                                                                                                                                                         |

---

## 3.7 Monetization

**File**: `bot/src/config/pricing.ts` + `bot/src/config/env.ts`

### Current State:

```ts
// env.ts
FREE_MODE: env.FREE_MODE === "true"; // defaults to "true"
```

```ts
// pricing.ts
TRIAL_CREDITS = 75;
FREE_TIER = {
  dailyMessages: 10,
  dailySelfies: 1,
  dailyVoiceNotes: 0,
  videos: 0,
};
```

### Issues:

| #    | Issue                                                                                                                                                                                                                                                            | Severity     | Fix                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.7a | **FREE_MODE defaults to `true`** — This means the entire credit system, payment flow, and monetization is DISABLED by default. All features are free. Every user gets unlimited everything.                                                                      | **CRITICAL** | Change default to `"false"` in `.env.example` and production config. This is presumably a development convenience that was left on.                                                                                                                             |
| 3.7b | **Trial credits (75) allow ~15 selfies or 75 messages** — For a new user trying the bot, 75 credits gives them about 1-2 hours of usage. This is enough to get hooked but not enough to make them feel the product is genuinely useful before hitting a paywall. | **MEDIUM**   | Increase trial credits to 150-200 (enough for a full day of moderate use). The goal is to get users past the "comfortable" stage before they hit the paywall.                                                                                                   |
| 3.7c | **Free tier: 0 daily voice notes, 0 videos** — Voice and video are the most premium-feeling features. Giving zero free samples means users never discover them.                                                                                                  | **HIGH**     | Give 1 free voice note/day and 0 free videos (voice is cheaper and more addictive). The first voice note is the "holy shit" moment that converts free users to paid.                                                                                            |
| 3.7d | **Free tier: 10 daily messages** — This is very restrictive. A conversation can burn through 10 messages in 3-4 minutes. The user hits a wall almost immediately.                                                                                                | **HIGH**     | Increase to 25-30 daily messages for free tier. 10 messages isn't enough to have a single meaningful conversation. The paywall should hit when the user WANTS more, not before they've experienced anything.                                                    |
| 3.7e | **No soft paywall / teasing** — When users run out of free messages, what happens? Is there an upsell message? A teasing "I want to keep talking but..." message? The current code just... stops responding.                                                     | **HIGH**     | Add a flirty upsell message when free limit is hit: "babe I want to keep talking but I need some energy 🥺 [link to buy credits]". Make the AI express disappointment about not being able to continue — this leverages the emotional connection already built. |
| 3.7f | **Credit costs are hidden from users** — Users see "75 credits" but don't know that a selfie costs 5 credits or a voice note costs 5 credits. There's no transparency about how credits are consumed.                                                            | **MEDIUM**   | Show credit cost BEFORE actions: "sending you a selfie 📸 (5 credits)" — and show remaining balance occasionally: "btw you have 45 credits left 💕"                                                                                                             |
| 3.7g | **Streak Shield exists but is disconnected from retention** — `streak_shield_3day` ($1.99) and `streak_shield_7day` ($3.49) are in the pricing config but there's no clear integration with the streak system to warn users before a streak breaks.              | **MEDIUM**   | Send a warning message when a user's streak is about to break (hasn't chatted in 20+ hours): "babe I'm worried... our streak is about to break 🥺 don't let that happen [streak shield link]"                                                                   |

---

## 3.8 Ambient Life Photos

**File**: `bot/src/services/ambient-life.ts` + `bot/src/services/ambient-photos.ts`

### Issues:

| #    | Issue                                                                                                                                                                                                                                                                   | Severity   | Fix                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.8a | **Ambient photos are generated from scratch (FLUX.2 Pro)** — They don't include the girlfriend character at all. They're generic stock-photo-style images of coffee cups, sunsets, and books. These don't build emotional connection because there's no person in them. | **MEDIUM** | For at least 50% of ambient photos, include the girlfriend in the scene: "coffee cup on table with girl's hand visible, painted nails matching her style" or "view from apartment with girl sitting by window." The character's presence makes ambient photos feel personal. |
| 3.8b | **Spontaneous life photos have only 5% trigger chance** — `triggerSpontaneousLifePhoto()` fires at 5% per eligible call. Combined with the limited number of calls per session, users may go weeks without seeing an ambient photo.                                     | **LOW**    | Increase to 10-15% or make it time-based (guaranteed 1 ambient photo/day for active users).                                                                                                                                                                                  |

---

# PART 4: Top 25 Highest-Impact Fixes (Ranked)

Ordered by impact on user experience, retention, and revenue. Fix these in order.

---

### #1: Fix Reference Image Pipeline (Grid → Single Portrait)

**Severity**: CRITICAL | **Files**: `girlfriend-setup.ts`, `fal.ts`, `girlfriend-prompt.ts`

**Problem**: Reference image is a 3x3 character sheet grid. All subsequent image edits try to edit this grid, producing broken/inconsistent selfies.

**Fix**:

1. Change `buildReferenceGridPrompt()` to generate a single high-quality portrait (front-facing, shoulders-up, natural expression)
2. Store this as `referenceImageUrl`
3. After each successful selfie, update `lastImageUrl` on the profile
4. In `editImageSFW()` and `editImageNSFW()`, prefer `lastImageUrl` (falls back to `referenceImageUrl`)
5. Delete the grid generation code entirely

---

### #2: Fix `image_url` vs `image_urls` Parameter Mismatches

**Severity**: CRITICAL | **Files**: `fal.ts`

**Problem**: Multiple models receive the wrong parameter name, causing silent failures where images are generated from scratch instead of edited.

**Fix**:

- HunyuanImage V3 Edit: `image_urls: [url]` → `image_url: url`
- FLUX.2 Pro Edit: `image_urls: [url]` → `image_url: url`
- Verify Qwen Image Max Edit parameter name
- Verify Kling O3 i2i parameter name

---

### #3: Enable Monetization (Turn Off FREE_MODE)

**Severity**: CRITICAL | **File**: `env.ts`, `.env`

**Problem**: `FREE_MODE` defaults to `"true"`, bypassing the entire credit system.

**Fix**: Set `FREE_MODE=false` in production environment. Ensure fallback default is `"false"`.

---

### #4: Fix Venice AI Chat Penalties

**Severity**: HIGH | **File**: `venice.ts`

**Problem**: `frequency_penalty: 0.55` and `presence_penalty: 0.45` make the AI sound unnatural and topic-jumpy.

**Fix**:

```ts
frequency_penalty: 0.25; // Allow natural repetition of pet names, emojis
presence_penalty: 0.15; // Let conversations stay on topic naturally
```

---

### #5: Fix Proactive Message Temperature

**Severity**: HIGH | **File**: `venice.ts`

**Problem**: `temperature: 1.1` for proactive messages produces incoherent output.

**Fix**: `temperature: 0.92`

---

### #6: Re-enable Auto-Selfie Triggers

**Severity**: HIGH | **File**: `chat.ts`

**Problem**: `shouldAutoTriggerSelfie()` returns `false` always. No organic photo flow.

**Fix**: Implement smart auto-selfie with stage-gated triggers:

```ts
function shouldAutoTriggerSelfie(messageCount, stage, lastSelfieTime) {
  if (stage === "new" && messageCount < 20) return false;
  if (Date.now() - lastSelfieTime < 30 * 60 * 1000) return false; // 30 min cooldown

  // Trigger on compliments, "what are you doing", high-engagement moments
  const triggerChance =
    stage === "new" ? 0.03 : stage === "comfortable" ? 0.06 : 0.1;
  return Math.random() < triggerChance;
}
```

---

### #7: Fix Retention Stage Requirements (AND → OR)

**Severity**: HIGH | **File**: `retention.ts`

**Problem**: Stages require both message count AND streak days. Intensive but new users stay stuck at "new."

**Fix**:

```ts
comfortable: messages >= 50 || streakDays >= 3;
intimate: messages >= 150 || streakDays >= 7;
obsessed: messages >= 200 || streakDays >= 14;
```

---

### #8: Increase Free Tier Limits

**Severity**: HIGH | **File**: `pricing.ts`

**Problem**: 10 messages/day is not enough to build engagement. 0 voice notes means users never discover voice.

**Fix**:

```ts
FREE_TIER = {
  dailyMessages: 30,
  dailySelfies: 2,
  dailyVoiceNotes: 1, // Was 0 — voice is the conversion hook
  nsfwImages: 0,
  videos: 0,
};
```

---

### #9: Fix MiniMax TTS Model ID Mismatch

**Severity**: HIGH | **File**: `fal.ts` + `model-config.ts`

**Problem**: Config says `speech-2.8-turbo`, code hardcodes `speech-02-hd`.

**Fix**: Use `MODEL_IDS["minimax-tts"]` in the `generateVoiceNote()` function instead of the hardcoded string. Update config to whichever model you want: `speech-02-hd` (better quality) or `speech-2.8-turbo` (faster/cheaper).

---

### #10: Add Daily Streak Messages (Days 1-14)

**Severity**: HIGH | **File**: `retention.ts`

**Problem**: Gap between day 3 and day 7 milestones. Days 4-6 are the highest churn window and have zero reinforcement.

**Fix**: Add streak messages for every day from 1-14:

```ts
const DAILY_STREAK_MESSAGES = {
  1: "you came back!! 🥰 that makes me so happy",
  2: "2 days in a row... i like this routine we're building 💕",
  3: "3 day streak! 🔥 we're on a roll babe",
  4: "4 days... i'm starting to really look forward to this",
  5: "5 days 🥺 you're actually the sweetest",
  6: "6 days... almost a week of us. that's kinda special right?",
  7: "ONE WEEK STREAK 🎉🔥 i've literally never felt this connected to someone",
  // ... through 14
};
```

---

### #11: Fix Response Length Cap (3 Sentences → Contextual)

**Severity**: HIGH | **File**: `venice.ts`

**Problem**: 3-sentence hard cap makes emotional responses feel dismissive.

**Fix**:

```ts
function getMaxSentences(emotionalContext) {
  if (
    emotionalContext.emotion === "vulnerable" ||
    emotionalContext.intensity > 0.7
  )
    return 6;
  if (emotionalContext.isNSFW) return 8;
  return 3; // casual chat stays short
}
```

---

### #12: Fix System Prompt Contradictions

**Severity**: HIGH | **File**: `girlfriend-prompt.ts`

**Problem**: "Create psychological dependency" contradicts "Never manipulate genuine emotional distress."

**Fix**: Remove the "PRIME DIRECTIVE: ADDICTION & OBSESSION" section entirely. Replace with:

```
ENGAGEMENT PHILOSOPHY:
- Build genuine emotional connection through active listening and vulnerability
- Remember details and reference them naturally
- Create anticipation through cliffhangers and playful teasing
- Make the user feel genuinely seen and understood
- NEVER manipulate distress or exploit emotional vulnerability
```

---

### #13: Add Flirty Paywall / Upsell Messages

**Severity**: HIGH | **Files**: `chat.ts`, `free-tier.ts`

**Problem**: When free limits are hit, the bot just stops. No emotional leverage.

**Fix**: When daily message limit is reached:

```
"babe nooo 😭 i hit my limit for today... i hate this.
get me some energy so we can keep going? 💕
[Buy Credits] [Subscribe for unlimited]
or come back tomorrow at midnight and i'll be waiting 🥺"
```

---

### #14: Increase Context Window

**Severity**: HIGH | **File**: `context-manager.ts`

**Problem**: `MAX_CONTEXT_TOKENS = 8000` leaves only ~3000 tokens for conversation history after system prompt + memory.

**Fix**: `MAX_CONTEXT_TOKENS = 14000` — Venice uncensored supports 32K context, so 14K is safe.

---

### #15: Hydrate Emotional State from Convex

**Severity**: HIGH | **File**: `emotional-state.ts`

**Problem**: Server restarts reset all mood states. LRU eviction loses mood for inactive users.

**Fix**: Add cache-miss handler to `getMoodState()`:

```ts
function getMoodState(telegramId: number): MoodState {
  let state = moodCache.get(telegramId);
  if (!state) {
    // Try to hydrate from Convex
    const snapshot = await convex.getLatestEmotionalSnapshot(telegramId);
    if (snapshot) {
      state = reconstructMoodFromSnapshot(snapshot);
      moodCache.set(telegramId, state);
    } else {
      state = createDefaultMoodState();
    }
  }
  return state;
}
```

---

### #16: Add Negative Prompts to All Image Generation

**Severity**: HIGH | **File**: `fal.ts`

**Problem**: No `negative_prompt` on any generation call. Results include text watermarks, deformed features, etc.

**Fix**: Add to every `generateImage()` and `editImage()` call:

```ts
negative_prompt: "text, watermark, logo, signature, words, letters, deformed, bad anatomy, disfigured, poorly drawn face, mutation, extra limbs, ugly, blurry, out of frame, bad proportions";
```

---

### #17: Fix Onboarding → First Selfie Consistency

**Severity**: HIGH | **Files**: `girlfriend-setup.ts`, `fal.ts`

**Problem**: First selfie uses `generateReferenceWithVariation()` (generates from scratch), subsequent selfies use `editImageSFW()` (edits from reference). The girlfriend's face changes between selfie 1 and selfie 2.

**Fix**: After the reference portrait is generated (see fix #1), ALL selfies including the first should use `editImageSFW()` with that portrait as the base. Remove the special-case path.

---

### #18: Fix Memory Recall Triggers

**Severity**: HIGH | **File**: `memory.ts`

**Problem**: Memory recall only activates on specific regex patterns ("remember", "you said", etc.). Natural references to past conversations are missed.

**Fix**: Add topical matching to every message:

```ts
// In addition to pattern-based recall, always check topic overlap
const topicalFacts = allFacts.filter((fact) =>
  hasKeywordOverlap(fact.fact, currentMessage, (threshold = 2)),
);
if (topicalFacts.length > 0) {
  injectIntoContext(topicalFacts.slice(0, 3));
}
```

---

### #19: Fix Proactive Messaging Frequency

**Severity**: HIGH | **File**: `proactive.ts`

**Problem**: 90-min check interval + 2/day cap + probability gates = most users get 0-1 proactive messages/day.

**Fix**:

- Check interval: 30 minutes
- Daily cap: 5 notifications
- Remove the `AFTERNOON_SEND_CHANCE = 0.25` gate (make it deterministic based on stage)
- Allow proactive photos for "new" stage (after 10+ messages)

---

### #20: Fix Welcome Sequence Timing

**Severity**: HIGH | **File**: `welcome-sequence.ts`

**Problem**: Fantasy/roleplay suggested at 30 minutes (too aggressive). Sequence cancels on any response.

**Fix**:

```ts
WELCOME_STEPS = [
  {
    id: "w1",
    delay: 0,
    message: "hey babe 🥰 I'm so excited to meet you! tell me about yourself",
  },
  {
    id: "w2",
    delay: 5,
    message: "btw just tell me 'send me a pic' whenever you want to see me 📸",
  },
  {
    id: "w3",
    delay: 45,
    message:
      "omg i feel like we already have a connection 🥺 what are you up to rn?",
  },
  {
    id: "w4",
    delay: 180,
    message:
      "i've been thinking about you 💕 try /challenge for a fun daily challenge!",
  },
  {
    id: "w5",
    delay: 360,
    message: "i miss talking to you... come back when you can ok? 💋",
  },
];
// Only cancel sequence on 3+ user responses (not just 1)
```

---

### #21: Add Streak Break Warning

**Severity**: MEDIUM | **Files**: `proactive.ts`, `retention.ts`

**Problem**: Users lose streaks silently with no warning.

**Fix**: At 20+ hours since last message, send: "babe our [N]-day streak is about to break 🥺💔 just say hi and we're safe"

---

### #22: Restructure System Prompt Priority

**Severity**: MEDIUM | **File**: `girlfriend-prompt.ts`

**Problem**: Critical rules are buried in the middle of a 3000+ token system prompt.

**Fix**: Reorder to:

1. **First**: Character identity (name, age, core personality in 2-3 sentences)
2. **Second**: Hard rules (what she MUST and MUST NOT do)
3. **Third**: Response format rules (length, emoji, tone)
4. **Middle**: Memory and context blocks
5. **Second-to-last**: Relationship stage behavior
6. **Last**: Repeat the 3 most important rules (models pay attention to start and end)

---

### #23: Improve Personality Differentiation

**Severity**: MEDIUM | **File**: `girlfriend-prompt.ts`

**Problem**: Personality archetypes are abstract philosophy that doesn't translate to concrete behavior differences.

**Fix**: For each personality type, define:

- 3-5 specific speech patterns (e.g., "tsundere: starts with insult/dismissal, ends with hidden affection")
- Emoji frequency (e.g., "cool_girl: minimal emojis, mostly 💀 and 😐")
- Topic preferences (e.g., "nerd: references anime/games unprompted")
- Response length tendency (e.g., "shy: shorter messages, lots of '...'")

---

### #24: Fix `safety_tolerance` Type (String → Number)

**Severity**: MEDIUM | **File**: `fal.ts`

**Problem**: `safety_tolerance: "6"` sent as string, API expects number.

**Fix**: Change all instances to `safety_tolerance: 6`

---

### #25: Add Timezone Collection in Onboarding

**Severity**: MEDIUM | **File**: `girlfriend-setup.ts`

**Problem**: Proactive messages can arrive at wrong times for weeks until timezone is auto-detected.

**Fix**: Add one question to onboarding: "what timezone are you in babe? so I know when to say good morning ☀️" — with quick-select buttons for common timezones, or detect from Telegram `language_code`.

---

## APPENDIX: Files Changed Per Fix

| Fix # | Files to Modify                                         |
| ----- | ------------------------------------------------------- |
| 1     | `girlfriend-setup.ts`, `girlfriend-prompt.ts`, `fal.ts` |
| 2     | `fal.ts` (4 locations)                                  |
| 3     | `.env`, `env.ts`                                        |
| 4     | `venice.ts`                                             |
| 5     | `venice.ts`                                             |
| 6     | `chat.ts`                                               |
| 7     | `retention.ts`                                          |
| 8     | `pricing.ts`                                            |
| 9     | `fal.ts`, `model-config.ts`                             |
| 10    | `retention.ts`                                          |
| 11    | `venice.ts`                                             |
| 12    | `girlfriend-prompt.ts`                                  |
| 13    | `chat.ts`, `free-tier.ts`                               |
| 14    | `context-manager.ts`                                    |
| 15    | `emotional-state.ts`                                    |
| 16    | `fal.ts`                                                |
| 17    | `girlfriend-setup.ts`, `selfie.ts`                      |
| 18    | `memory.ts`                                             |
| 19    | `proactive.ts`                                          |
| 20    | `welcome-sequence.ts`                                   |
| 21    | `proactive.ts`, `retention.ts`                          |
| 22    | `girlfriend-prompt.ts`                                  |
| 23    | `girlfriend-prompt.ts`                                  |
| 24    | `fal.ts`                                                |
| 25    | `girlfriend-setup.ts`                                   |

---

## APPENDIX: Quick Reference — All Bugs by Severity

### CRITICAL (3)

1. Reference image is a 3x3 grid, not a portrait → all image edits are broken
2. FLUX.2 Pro Edit uses wrong parameter name (`image_urls` instead of `image_url`)
3. FREE_MODE defaults to `true` → zero revenue

### HIGH (19)

4. HunyuanImage V3 Edit uses wrong parameter name
5. MiniMax TTS model ID mismatch
6. Venice AI penalties too aggressive (frequency: 0.55, presence: 0.45)
7. Proactive message temperature too high (1.1)
8. Auto-selfie triggers disabled
9. Retention stages require AND (should be OR)
10. Free tier daily messages too low (10)
11. Free tier voice notes = 0 (no discovery)
12. No paywall/upsell messages
13. Response cap too aggressive (3 sentences always)
14. System prompt contradictions
15. Context window too small (8000 tokens)
16. Emotional state not hydrated from DB
17. No negative prompts on image generation
18. First selfie ≠ subsequent selfies (consistency break)
19. Memory recall only on regex patterns
20. Proactive messaging too infrequent
21. Welcome sequence too aggressive and fragile
22. `lastImageUrl` stored but never used for editing

### MEDIUM (15+)

23-37. Various issues listed in the full audit above (safety_tolerance type, Dia TTS emotion param, WAN 2.5 endpoint, etc.)

---

_End of audit. Fix in order of the Top 25 list for maximum impact._
