# Clawra Bot - Complete Improvement Guide

> Deep analysis, model recommendations, prompt upgrades, and UX improvements
> Research date: February 2026

---

## Table of Contents

1. [MAXIMUM REALISM: Reference Image, Selfies & Videos](#1-maximum-realism-reference-image-selfies--videos)
2. [Current Architecture Overview](#2-current-architecture-overview)
3. [fal.ai Model Upgrades](#3-falai-model-upgrades---recommended-stack)
4. [System Prompt Overhaul](#4-system-prompt-overhaul)
5. [Image Generation Prompt Improvements](#5-image-generation-prompt-improvements)
6. [Memory & Context Management](#6-memory--context-management)
7. [Emotional Intelligence Upgrades](#7-emotional-intelligence-upgrades)
8. [Voice & Audio Improvements](#8-voice--audio-improvements)
9. [Telegram UX Patterns](#9-telegram-ux-patterns)
10. [Monetization Optimization](#10-monetization-optimization)
11. [Competitor Analysis](#11-competitor-analysis)
12. [Quick Wins - Top 15 Changes](#12-quick-wins---top-15-highest-impact-changes)
13. [Full Model Reference Table](#13-full-model-reference-table)

---

## 1. MAXIMUM REALISM: Reference Image, Selfies & Videos

> This is the most critical section. Everything starts with the reference image. If that looks AI, everything after it looks AI. If that looks real, everything after it can look real.

---

### 1.1 THE REFERENCE IMAGE (First Image Ever Generated)

This is the foundation of the entire girlfriend experience. Every subsequent selfie, NSFW image, and video uses this as the identity anchor. It MUST look like a real person's photo.

#### Current Problems

1. **Prompt is too "listy"** - The current `buildReferencePrompt()` stacks keywords like "subsurface scattering, natural catchlights in eyes, visible pores" which paradoxically makes FLUX produce MORE artificial-looking results. FLUX interprets natural-language descriptions better.
2. **No camera model specified** - FLUX produces dramatically more realistic output when told the exact camera.
3. **"iPhone front camera selfie" is too vague** - Need the exact model and lens specs.
4. **Missing "anti-AI" anchoring** - Need explicit descriptions of imperfections that AI struggles with (asymmetric earrings, uneven eyeliner, chipped nail polish).
5. **`guidance_scale: 3.5` is too low** for Z-Image Base reference images - should be 4.0-5.0 for the reference to lock in facial features.
6. **`num_inference_steps: 30` should be 40-50** for the reference image only (quality over speed for this one image).

#### Improved Reference Image Prompt

Replace `buildReferencePrompt()` with:

```typescript
export function buildReferencePrompt(profile: {
  age: number;
  race: string;
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  personality: string;
}): string {
  const skinTone = SKIN_TONE_MAP[profile.race] || "natural";
  const bodyDesc = BODY_DESC_MAP[profile.bodyType];
  const personalityVibe = PERSONALITY_EXPRESSION_MAP[profile.personality];

  // Pick ONE specific imperfection set per generation (makes her unique)
  const imperfectionSet = randomChoice([
    "a tiny beauty mark on her left cheekbone, barely visible freckles across her nose bridge",
    "a small scar on her chin from childhood, subtle asymmetry in her eyebrows",
    "a few faint freckles on her cheeks, one ear slightly lower than the other",
    "a tiny mole near her lip, slightly uneven eyeliner she didn't fix",
    "faint under-eye circles she didn't fully conceal, a small birthmark on her neck",
    "slightly chapped lower lip, a single flyaway hair she didn't notice",
  ]);

  // Pick ONE specific camera + setting (not generic)
  const cameraSetup = randomChoice([
    {
      camera: "iPhone 15 Pro Max front camera, 12MP TrueDepth, f/1.9 aperture",
      setting: "standing in her apartment bathroom, warm vanity lights overhead, a toothbrush and skincare bottles visible on the counter behind her",
      distance: "arm's-length selfie distance, phone held slightly above eye level",
    },
    {
      camera: "iPhone 16 Pro front camera, 12MP, Smart HDR 5",
      setting: "sitting on her bed against the headboard, afternoon sunlight coming through blinds casting stripe shadows on the wall",
      distance: "close selfie, phone about 18 inches from her face, slightly tilted",
    },
    {
      camera: "Samsung Galaxy S24 Ultra selfie camera, 12MP f/2.2",
      setting: "in a coffee shop by the window, natural daylight from the left, other customers blurred in the background",
      distance: "classic arm's-length selfie, her shoulder and collarbone visible at the bottom of frame",
    },
    {
      camera: "iPhone 15 front camera, 12MP, no portrait mode",
      setting: "in her car parked, natural overcast daylight through the windshield, rearview mirror partially visible",
      distance: "held at steering wheel distance, casual angle, chin slightly down",
    },
  ]);

  return [
    // WHO she is (natural language, not keywords)
    `A real ${profile.age}-year-old ${profile.race} woman with ${skinTone} skin and a ${bodyDesc} figure.`,
    `She has ${profile.hairColor} ${profile.hairStyle} hair with natural texture - not perfectly styled, a few strands out of place.`,

    // WHERE and HOW (specific scene, not generic)
    `${cameraSetup.setting}.`,
    `She's taking a casual selfie with her ${cameraSetup.camera}.`,
    `${cameraSetup.distance}.`,

    // HER EXPRESSION (personality-driven, not "smiling at camera")
    `${personalityVibe}.`,

    // WHAT MAKES HER LOOK REAL (specific imperfections, not "realistic skin")
    `${imperfectionSet}.`,
    `Her skin has natural texture - visible pores on her nose and cheeks, slight shine on her forehead and nose where oil has accumulated, uneven skin tone around her jaw.`,
    `Her eyes have natural moisture and tiny red veins in the whites, with small catchlights from the ${cameraSetup.setting.includes('window') ? 'window' : 'room lighting'}.`,

    // WHAT THE PHOTO LOOKS LIKE (camera behavior, not "photorealistic")
    `The photo has the typical quality of a real phone selfie: slightly soft focus on the edges, the background isn't perfectly blurred, there's a tiny amount of digital noise in the shadows.`,
    `The white balance is slightly warm. The dynamic range is limited - highlights are a touch blown on her forehead, shadows under her chin are slightly crushed.`,
    `This is clearly a real photo from someone's camera roll, not a photoshoot.`,
  ].join(' ');
}

const PERSONALITY_EXPRESSION_MAP: Record<string, string> = {
  "flirty_playful": "She has a slight smirk, one eyebrow raised just a tiny bit, the kind of expression you'd make right before sending a flirty text",
  "shy_sweet": "She has a soft, almost shy smile with her lips pressed together, looking at the camera like she's not sure if the photo came out okay",
  "bold_dominant": "She's looking directly into the camera with confident eye contact and a slight head tilt, no smile - just a knowing look",
  "caring_nurturing": "She has a warm, genuine smile that reaches her eyes, the kind of expression you'd see from someone who's genuinely happy to see you",
  "sarcastic_witty": "She has a half-smile with slightly squinted eyes, like she just said something funny and is waiting for you to get the joke",
  "bubbly_energetic": "She's mid-laugh with her eyes slightly crinkled, mouth open in a natural laugh, caught in a genuinely happy moment",
};
```

#### Improved Reference Image Parameters

```typescript
// ONLY for the reference image - higher quality settings
const REFERENCE_IMAGE_PARAMS = {
  num_inference_steps: 45,     // Was 30. More steps = more detail for the anchor image
  guidance_scale: 4.5,         // Was 3.5. Higher = more prompt adherence for identity lock
  enable_safety_checker: false,
  num_images: 1,
  image_size: { width: 768, height: 1344 },  // Slightly larger for more facial detail
  output_format: "png",        // Was jpeg. PNG preserves skin texture better for reference
};

// For all subsequent images, keep current settings:
const REGULAR_IMAGE_PARAMS = {
  num_inference_steps: 30,
  guidance_scale: 3.5,
  enable_safety_checker: false,
  num_images: 1,
  image_size: { width: 720, height: 1280 },
  output_format: "jpeg",
};
```

#### Reference Image Negative Prompt (Enhanced)

```typescript
const REFERENCE_NEGATIVE_PROMPT = [
  // Core anti-AI
  "AI generated, artificial, CGI, 3D render, digital art, illustration, cartoon, anime",
  "plastic skin, poreless skin, airbrushed, beauty filter, facetune, smooth skin texture",
  "uncanny valley, wax figure, mannequin, doll-like, porcelain doll",
  "overly symmetrical face, perfectly symmetrical features",

  // Anti-stock-photo
  "professional photoshoot, studio lighting, ring light catchlight",
  "modeling pose, magazine cover, catalog image, stock photo",
  "perfect makeup, heavy contour, fake eyelashes, lip filler",

  // Anti-artifact
  "extra fingers, mutated hands, deformed face, cross-eyed",
  "blurry, out of focus face, motion blur on face",
  "watermark, text overlay, logo, signature, copyright",
  "split image, collage, multiple frames, border",

  // Anti-overprocessing
  "HDR, oversaturated, overexposed, heavy vignette",
  "chromatic aberration, lens distortion, fish-eye",
  "heavy bokeh balls, artificial depth of field",
  "orange and teal color grade, cinematic color grade",
].join(", ");
```

#### Generate Multiple, Pick Best (Optional Premium Feature)

For the reference image specifically, generate 3-4 candidates and let the user pick:

```typescript
async function generateReferenceWithSelection(profile: GirlfriendProfile): Promise<string> {
  // Generate 3 candidates with same seed but different camera setups
  const candidates = await Promise.all([
    generateImage(buildReferencePrompt(profile), { ...REFERENCE_IMAGE_PARAMS, seed: baseSeed }),
    generateImage(buildReferencePrompt(profile), { ...REFERENCE_IMAGE_PARAMS, seed: baseSeed + 1 }),
    generateImage(buildReferencePrompt(profile), { ...REFERENCE_IMAGE_PARAMS, seed: baseSeed + 2 }),
  ]);

  // Send all 3 as a media group, let user pick
  await ctx.replyWithMediaGroup(candidates.map((c, i) => ({
    type: "photo",
    media: c.url,
    caption: i === 0 ? "Pick the one that looks most like your girlfriend:" : undefined,
  })));

  // User selects via inline keyboard
  // ...
}
```

---

### 1.2 ALL SUBSEQUENT SELFIES (SFW & NSFW)

#### Current Problems

1. **The identity preservation prompt is good but buried** - It's appended as an afterthought. It should be the FIRST thing in the edit prompt.
2. **Scene descriptions are keyword-heavy** - Same FLUX natural-language problem.
3. **The realism suffix is random but not scene-aware** - "shot on iPhone 17 Pro Max" in a "professional studio" scene is contradictory.
4. **Body type preservation is weak for NSFW** - "Preserve body type" is vague. Need explicit proportions.
5. **Outfit descriptions are too short** - "tiny crop top" doesn't give FLUX enough to work with.
6. **No anti-AI anchoring in subsequent images** - Need specific imperfections in every generation.

#### Improved SFW Selfie Prompt

```typescript
export function buildSelfieSFW(profile: GirlfriendProfile, context: string): string {
  const scene = detectScene(context);
  const outfit = selectOutfit(context, false);
  const pose = selectSfwPose(context);
  const timeLight = getTimeOfDayLighting();
  const camera = selectCameraForScene(scene);

  // IDENTITY FIRST - this is the most important part
  const identityAnchor = [
    `The same ${profile.age}-year-old ${profile.race} woman from the reference photo.`,
    `Same face, same ${getSkinTone(profile.race)} skin tone, same ${profile.hairColor} ${profile.hairStyle} hair, same ${profile.bodyType} body shape.`,
    `Her face looks identical to the reference - same eyes, same nose, same lip shape, same jawline.`,
  ].join(' ');

  // SCENE (natural language)
  const sceneDesc = buildNaturalSceneDescription(scene, context, timeLight);

  // OUTFIT (detailed, specific)
  const outfitDesc = buildDetailedOutfit(outfit, scene);

  // POSE (natural, not "modeling")
  const poseDesc = buildNaturalPose(pose, scene);

  // REALISM ANCHORS (scene-appropriate imperfections)
  const realismAnchors = buildSceneAppropriateRealism(scene, camera);

  return [
    identityAnchor,
    sceneDesc,
    `She's wearing ${outfitDesc}.`,
    poseDesc,
    `Taken with her ${camera.spec}. ${camera.artifacts}.`,
    realismAnchors,
  ].join(' ');
}
```

#### Scene-Appropriate Realism (Not Random)

The current system randomly picks realism suffixes. But "phone camera noise" doesn't make sense in a "professional studio" scene. Match realism to context:

```typescript
function buildSceneAppropriateRealism(scene: SceneType, camera: CameraSetup): string {
  const universal = "Natural skin texture with visible pores, real skin color variation, no airbrushing.";

  const sceneRealism: Record<SceneType, string> = {
    bathroom: `${universal} Slightly steamy air softening the background. Mirror has fingerprints and water spots. Bathroom counter is slightly messy - products not perfectly arranged.`,

    bedroom: `${universal} Sheets are rumpled, not perfectly made. A phone charger cable visible on the nightstand. The pillow has a natural indentation.`,

    gym: `${universal} Visible sweat on her skin - forehead, upper lip, collarbone. Gym equipment slightly out of focus behind her. Fluorescent overhead lights creating slight shine on her skin.`,

    kitchen: `${universal} Real kitchen - dishes in the drying rack, a towel draped over the oven handle. Steam or cooking residue slightly hazing the photo.`,

    outdoor: `${universal} Wind slightly displacing her hair. Natural sun creating uneven lighting on her face - one side brighter than the other. Background pedestrians or cars slightly blurred.`,

    car: `${universal} Dashboard partially visible. Seatbelt line across her chest. Natural overcast light through the windshield creating flat, even lighting on her face.`,

    restaurant: `${universal} Warm amber restaurant lighting. Other diners blurred in background. A drink or plate partially visible at the edge of frame. Menu or napkin in the periphery.`,

    club: `${universal} Colored lights creating uneven lighting on her skin - purple on one side, warm on the other. Slight motion blur from the low light. Other people visible but heavily blurred. Phone flash slightly visible in her eyes.`,

    beach: `${universal} Sand on her skin. Wind blowing her hair. Sun creating harsh highlights and dark shadows. Slight squint from the brightness. Sunscreen sheen on her shoulders.`,

    hotel: `${universal} Hotel room with neutral decor. Curtains partially open. The bed is made but has the hotel's decorative pillows removed and tossed to the side.`,

    default: `${universal} Casual amateur framing - not perfectly centered, slight tilt. The background has real-life clutter, not a clean backdrop.`,
  };

  return sceneRealism[scene] || sceneRealism.default;
}
```

#### Improved NSFW Selfie Prompt

The key difference: NSFW images need MORE realism work because they're more likely to trigger "AI-looking" artifacts (unnatural body proportions, plastic skin, impossible poses).

```typescript
export function buildSelfieNSFW(profile: GirlfriendProfile, context: string): string {
  const enhanced = enhanceNSFWContext(context, profile);
  const camera = selectIntimateCamera();

  // IDENTITY + BODY ANCHOR (most important for NSFW)
  const identityAnchor = [
    `The same ${profile.age}-year-old ${profile.race} woman from the reference photo.`,
    `Identical face, identical ${getSkinTone(profile.race)} skin tone, identical ${profile.hairColor} ${profile.hairStyle} hair.`,
    `Her body is ${getExplicitBodyDescription(profile.bodyType)} - exactly matching the reference.`,
    `Same breast size, same hip width, same waist, same proportions. Nothing exaggerated or enhanced.`,
  ].join(' ');

  // BODY TYPE REALISM (prevent AI from "enhancing" proportions)
  const bodyRealism = getAntiEnhancementPrompt(profile.bodyType);

  // SCENE (from enhanced context)
  const sceneDesc = enhanced.fullScene;

  // SKIN & BODY TEXTURE (critical for NSFW realism)
  const skinTexture = [
    "Real skin texture across her entire body - visible pores, natural skin grain, subtle stretch marks, real skin folds where her body bends.",
    "Natural breast shape with realistic weight and hang - not perfectly round or symmetrical.",
    "Real stomach - not perfectly flat, slight natural softness below the navel.",
    "Authentic skin color variation - slightly different tones on her inner arms, thighs, and torso.",
    "Visible veins on her wrists and inner elbows. Natural body hair texture (fine, barely visible).",
  ].join(' ');

  // INTIMATE PHOTO REALISM
  const intimateRealism = [
    `Taken with ${camera.spec}. This is a real intimate photo sent to a boyfriend, not pornography.`,
    "Amateur framing - she's holding the phone with one hand so the angle isn't perfect.",
    "The lighting is whatever was already in the room - not set up for a photo.",
    "Her expression is genuine - looking at the phone screen, not at an imaginary camera crew.",
    camera.artifacts,
  ].join(' ');

  return [
    identityAnchor,
    bodyRealism,
    sceneDesc,
    skinTexture,
    intimateRealism,
  ].join(' ');
}

// Prevent AI from making everyone look like an Instagram model
function getAntiEnhancementPrompt(bodyType: string): string {
  const prompts: Record<string, string> = {
    petite: "She has a petite, small frame - small breasts, narrow hips, slim thighs. Do NOT enlarge any body parts. She is naturally small.",
    slim: "She has a slim, lean body - modest breasts, defined waist, slender legs. Natural slim proportions, not enhanced.",
    athletic: "She has an athletic, toned body - firm muscles visible in arms and legs, defined abs, medium breasts. Athletic build, not curvy.",
    curvy: "She has natural curves - full breasts, defined waist, wide hips. Her curves are natural with soft edges, not the exaggerated hourglass of plastic surgery.",
    thick: "She has a thick, full body - large natural breasts, wide hips, thick thighs, soft belly. Real thick body with natural weight distribution, not idealized.",
    plus_size: "She has a plus-size body - large breasts, wide hips, soft round belly, thick arms and thighs. Real plus-size proportions with natural fat distribution, skin folds, and softness.",
  };
  return prompts[bodyType.toLowerCase().replace(' ', '_')] || "";
}
```

#### Improved Identity Preservation Prompt (for editImageNSFW / editImageSFW)

The current prompt in `fal.ts` is good but can be stronger:

```typescript
// Replace the current identity prompt in editImageSFW (line ~229):
const identityPrompt = [
  "CRITICAL: This must look like the EXACT same person as the reference image.",
  "Keep her face completely identical - same eye shape, same nose, same lip fullness, same jawline, same forehead shape.",
  `Keep her ${profile.skinTone} skin tone exactly the same across her entire body.`,
  `Keep her ${profile.hairColor} ${profile.hairStyle} hair exactly the same color and style.`,
  `Keep her ${profile.bodyType} body proportions exactly the same - same breast size, same hip width, same body shape.`,
  "Do NOT beautify, slim, or enhance any features. She should look exactly like her reference photo, just in a different setting.",
].join(' ');

// Replace the current identity prompt in editImageNSFW (line ~265):
const nsfwIdentityPrompt = [
  "CRITICAL: This must look like the EXACT same person as the reference image.",
  "Her face is IDENTICAL to the reference - same eyes, nose, lips, jaw, forehead. Do not change ANY facial feature.",
  `Her body is IDENTICAL to the reference - same ${profile.bodyType} proportions. Same breast size and shape, same hip width, same waist.`,
  `Her skin tone (${profile.skinTone}) is the same across her entire body - face, chest, stomach, arms, legs all match.`,
  `Her ${profile.hairColor} ${profile.hairStyle} hair is the same color and style.`,
  "Do NOT make her body more 'ideal' or 'perfect'. Keep her natural, real proportions from the reference.",
  "Realistic fabric draping on any clothing. Natural shadows matching the room's light direction. Authentic skin texture with pores, slight imperfections, and natural color variation across her body.",
].join(' ');
```

---

### 1.3 CHARACTER CONSISTENCY ACROSS ALL IMAGES

This is the biggest weakness. Currently the bot generates each image semi-independently, relying on:
- A seed derived from `telegramId * 7919 + slotIndex * 1013`
- An identity preservation prompt
- The reference image passed to edit models

But there's no visual feedback loop - the bot never checks if the generated image actually looks like the reference.

#### Add FLUX Kontext Pro for Identity-Locked Generation

```typescript
// NEW: Use Kontext Pro for all images after the reference is established
// This model is specifically designed to maintain character identity

async function generateWithIdentityLock(
  referenceUrl: string,
  scenePrompt: string,
  nsfw: boolean,
): Promise<FalImageResult> {
  // Kontext Pro takes a reference image and maintains the person's identity
  // while changing everything else (scene, outfit, pose, lighting)
  try {
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt: scenePrompt,
        image_url: referenceUrl,
        safety_tolerance: nsfw ? "5" : "3",
        output_format: "jpeg",
        // Kontext-specific: how much to preserve vs change
        // Higher = more identity preservation, less scene flexibility
        guidance_scale: 4.0,
      },
    });
    return result;
  } catch (e) {
    // Fallback to current edit pipeline
    return nsfw
      ? editImageNSFW(referenceUrl, scenePrompt)
      : editImageSFW(referenceUrl, scenePrompt);
  }
}
```

#### Use Kling Omni 3 for Multi-Angle Consistency

When the user asks for side profile, looking away, or other non-frontal angles, Kling O3 supports multi-reference input (up to 10 images) with `@Image1`/`@Image2` syntax:

```typescript
async function generateWithMultiReference(
  referenceUrls: string[], // multiple reference angles
  scenePrompt: string,
): Promise<FalImageResult> {
  // O3 can take multiple reference images for better identity lock
  const imageRefs = referenceUrls.map((_, i) => `@Image${i + 1}`).join(" and ");
  return await fal.subscribe("fal-ai/kling-image/o3/image-to-image", {
    input: {
      prompt: `Using ${imageRefs} as identity reference, ${scenePrompt}`,
      image_urls: referenceUrls, // up to 10 references
      aspect_ratio: "9:16",
      resolution: "2K",
      output_format: "jpeg",
    },
  });
}
```

#### Store Multiple Reference Angles

After the first reference image, generate 2-3 additional angles and store them:

```typescript
// After user confirms reference image:
async function generateAdditionalReferences(
  primaryRef: string,
  profile: GirlfriendProfile,
) {
  const angles = [
    "Same woman, three-quarter profile view, slight smile, looking to the left",
    "Same woman, looking slightly down at her phone, from above",
  ];

  const additionalRefs = await Promise.all(
    angles.map((angle) =>
      editImageSFW(primaryRef, `${getIdentityPrompt(profile)} ${angle}`)
    ),
  );

  // Store for use as multi-reference inputs
  return additionalRefs.map((r) => r.url);
}
```

---

### 1.4 USER-UPLOADED PHOTOS: "Create a Girlfriend That Looks Like Her"

This is a massive feature. Instead of generating a random woman from text attributes, users can upload 1-5 photos of a real person they find attractive, and the bot creates a girlfriend that looks like her. This is the difference between "generate a curvy Latina" and "generate someone who looks exactly like this specific woman."

#### How It Works (User Flow)

```
1. User starts /create or /remake
2. NEW OPTION: "Upload photos" button alongside the normal attribute picker
3. User sends 1-5 photos of the person they want their girlfriend to look like
4. Bot extracts facial features, body type, skin tone, hair automatically
5. Bot generates the reference image using those features as the anchor
6. All subsequent selfies/NSFW/videos maintain that specific look
```

#### Telegram Handler

```typescript
// In the girlfriend creation flow, add a new state:
export async function handlePhotoUpload(ctx: BotContext) {
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  // Get the highest resolution version
  const bestPhoto = photos[photos.length - 1];
  const file = await ctx.api.getFile(bestPhoto.file_id);
  const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  // Store in the creation session
  const session = getCreationSession(ctx.from.id);
  session.uploadedPhotos.push(photoUrl);

  if (session.uploadedPhotos.length === 1) {
    await ctx.reply(
      "Got it! You can send more photos for better accuracy (up to 5), " +
      "or tap 'Done' to continue.",
      {
        reply_markup: new InlineKeyboard()
          .text("Done - use this photo", "create:photos_done")
          .row()
          .text("Add more photos (recommended)", "create:photos_more"),
      }
    );
  } else if (session.uploadedPhotos.length >= 5) {
    await ctx.reply(`Perfect, ${session.uploadedPhotos.length} photos received. Creating your girlfriend now...`);
    await generateFromUploadedPhotos(ctx, session);
  } else {
    await ctx.reply(
      `${session.uploadedPhotos.length} photos received. Send more or tap Done.`,
      {
        reply_markup: new InlineKeyboard()
          .text(`Done - use ${session.uploadedPhotos.length} photos`, "create:photos_done"),
      }
    );
  }
}
```

#### Face Extraction & Analysis Pipeline

Use a combination of fal.ai models to extract identity from uploaded photos:

```typescript
async function analyzeUploadedPhotos(
  photoUrls: string[],
): Promise<ExtractedIdentity> {
  // Step 1: Use Kling Omni 3 to generate a portrait locked to the uploaded face
  // O3 accepts up to 10 reference images via @Image syntax for best accuracy
  const imageRefs = photoUrls.map((_, i) => `@Image${i + 1}`).join(" and ");
  const faceAnalysis = await fal.subscribe("fal-ai/kling-image/o3/image-to-image", {
    input: {
      prompt: `Using ${imageRefs} as reference, a close-up portrait photo of this exact person, ` +
              `neutral expression, front-facing, clean background, natural lighting`,
      image_urls: photoUrls,
      aspect_ratio: "9:16",
      resolution: "2K",
      output_format: "png",
    },
  });

  // Step 2: Auto-detect attributes from the generated face-locked portrait
  // Use a vision LLM to extract: skin tone, hair color, hair style, body type estimate, age estimate, race
  const attributes = await analyzePortraitAttributes(faceAnalysis.images[0].url);

  return {
    faceReferenceUrls: photoUrls,
    generatedPortraitUrl: faceAnalysis.images[0].url,
    detectedAttributes: attributes,
    faceEmbeddingSeed: faceAnalysis.seed, // Store for consistency
  };
}

async function analyzePortraitAttributes(portraitUrl: string): Promise<DetectedAttributes> {
  // Use Venice (Llama 3.3-70B) with vision or any vision LLM to auto-detect
  const response = await venice.complete({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: portraitUrl },
          },
          {
            type: "text",
            text: `Analyze this photo and return ONLY a JSON object with these fields:
            {
              "estimatedAge": number (18-40),
              "race": "asian" | "black" | "latina" | "white" | "middle_eastern" | "south_asian" | "mixed",
              "skinTone": "description of exact skin tone",
              "hairColor": "black" | "brown" | "blonde" | "red" | etc,
              "hairStyle": "long_straight" | "long_wavy" | "long_curly" | "medium" | "short_bob" | "pixie",
              "bodyType": "petite" | "slim" | "athletic" | "curvy" | "thick" | "plus_size",
              "distinctiveFeatures": "string describing unique features like moles, freckles, dimples, etc"
            }
            Return ONLY the JSON, nothing else.`,
          },
        ],
      },
    ],
    temperature: 0.1,
  });

  return JSON.parse(response.content);
}
```

#### Reference Image Generation From Uploaded Photos

```typescript
async function generateFromUploadedPhotos(
  ctx: BotContext,
  session: CreationSession,
): Promise<void> {
  const telegramId = ctx.from!.id;

  await ctx.reply("Analyzing photos and creating your girlfriend...");
  await ctx.replyWithChatAction("upload_photo");

  // Step 1: Extract identity from uploaded photos
  const identity = await analyzeUploadedPhotos(session.uploadedPhotos);

  // Step 2: Let user confirm/override detected attributes
  const attrs = identity.detectedAttributes;
  await ctx.reply(
    `Here's what I detected:\n` +
    `Age: ~${attrs.estimatedAge}\n` +
    `Hair: ${attrs.hairColor} ${attrs.hairStyle}\n` +
    `Body type: ${attrs.bodyType}\n` +
    `Distinctive features: ${attrs.distinctiveFeatures}\n\n` +
    `Does this look right? You can also customize her name and personality.`,
    {
      reply_markup: new InlineKeyboard()
        .text("Looks right!", "create:confirm_attrs")
        .text("Let me adjust", "create:adjust_attrs"),
    }
  );

  // Step 3: Generate the reference image with face lock
  // This is the key difference - we use Kling Omni 3 to lock the face
  // instead of generating from text description alone
  const referencePrompt = buildReferenceFromUpload(identity, session.personality);

  // Use Kling Omni 3 for face-locked reference generation
  const uploadRefs = session.uploadedPhotos.map((_, i) => `@Image${i + 1}`).join(" and ");
  const referenceImage = await fal.subscribe("fal-ai/kling-image/o3/image-to-image", {
    input: {
      prompt: `Using ${uploadRefs} as identity reference. ${referencePrompt}`,
      image_urls: session.uploadedPhotos,
      aspect_ratio: "9:16",
      resolution: "2K",
      output_format: "png",
    },
  });

  // Step 4: Store everything
  await saveGirlfriendProfile(telegramId, {
    ...attrs,
    name: session.name,
    personality: session.personality,
    referenceImageUrl: referenceImage.images[0].url,
    uploadedPhotoUrls: session.uploadedPhotos, // Keep originals for multi-ref
    creationMethod: "photo_upload",           // Track how she was created
    distinctiveFeatures: attrs.distinctiveFeatures,
  });

  // Step 5: Show the reference image for confirmation
  await ctx.replyWithPhoto(referenceImage.images[0].url, {
    caption: `Meet ${session.name}! Does she look right?`,
    reply_markup: new InlineKeyboard()
      .text("She's perfect!", "create:confirm_ref")
      .text("Regenerate", "create:regen_ref")
      .row()
      .text("She looks different - try again", "create:retry_upload"),
  });
}

function buildReferenceFromUpload(
  identity: ExtractedIdentity,
  personality: string,
): string {
  const attrs = identity.detectedAttributes;
  const expression = PERSONALITY_EXPRESSION_MAP[personality];

  // For uploaded photos, we describe the SETTING and STYLE
  // but let Kling Omni 3 handle the FACE and BODY from the photos
  return [
    // Don't over-describe the face - Kling Omni 3 has it from the photos
    `A casual iPhone selfie of this woman.`,
    `She has ${attrs.hairColor} ${attrs.hairStyle} hair with natural texture.`,
    `${attrs.distinctiveFeatures}.`,

    // Setting (same as normal reference)
    `She's in her apartment, natural daylight from a window, warm ambient room lighting.`,
    `Arm's-length selfie distance, phone held slightly above eye level.`,

    // Expression from personality
    `${expression}.`,

    // Realism anchors (same as normal)
    `Her skin has natural texture - visible pores, slight shine on forehead, uneven skin tone.`,
    `Real phone selfie quality - slightly soft focus on edges, tiny digital noise in shadows.`,
    `This looks like a real photo from someone's camera roll, not a photoshoot.`,
  ].join(' ');
}
```

#### All Subsequent Images Use the Uploaded Face

Once the girlfriend is created from uploaded photos, all future selfies maintain that face:

```typescript
async function generateSelfieFromUploadedGirlfriend(
  profile: GirlfriendProfile,
  scenePrompt: string,
  nsfw: boolean,
): Promise<FalImageResult> {
  if (profile.creationMethod === "photo_upload" && profile.uploadedPhotoUrls?.length) {
    // Use Kling Omni 3 with original uploaded photos as multi-reference
    // O3 supports up to 10 reference images for best identity consistency
    const refs = profile.uploadedPhotoUrls.slice(0, 5);
    const imageRefs = refs.map((_, i) => `@Image${i + 1}`).join(" and ");
    try {
      return await fal.subscribe("fal-ai/kling-image/o3/image-to-image", {
        input: {
          prompt: `Using ${imageRefs} as identity reference. ${scenePrompt}`,
          image_urls: refs,
          aspect_ratio: "9:16",
          resolution: "1K",
          output_format: "jpeg",
        },
      });
    } catch (e) {
      // Fallback to Kling V3 with single reference
      return await fal.subscribe("fal-ai/kling-image/v3/image-to-image", {
        input: {
          prompt: scenePrompt,
          image_url: profile.referenceImageUrl,
          aspect_ratio: "9:16",
          output_format: "jpeg",
        },
      });
    }
  }

  // Normal flow for text-generated girlfriends
  return nsfw
    ? editImageNSFW(profile.referenceImageUrl, scenePrompt)
    : editImageSFW(profile.referenceImageUrl, scenePrompt);
}
```

#### Face Swap Alternative (Easel AI)

For cases where Kling Omni 3 doesn't produce close enough results, offer a face-swap approach:

```typescript
async function faceSwapApproach(
  uploadedFaceUrl: string,   // User's uploaded photo with the target face
  generatedBodyUrl: string,  // AI-generated body/scene image
): Promise<FalImageResult> {
  // Easel AI's face swap: take the face from the upload,
  // put it on the AI-generated body
  return await fal.subscribe("easel-ai/advanced-face-swap", {
    input: {
      source_image_url: uploadedFaceUrl,  // Face donor
      target_image_url: generatedBodyUrl,  // Body/scene recipient
      // Easel handles gender detection automatically
    },
  });
}

// Two-step pipeline for maximum control:
async function hybridGenerationPipeline(
  profile: GirlfriendProfile,
  scenePrompt: string,
): Promise<FalImageResult> {
  // Step 1: Generate the perfect scene/body/outfit with text-to-image
  const sceneImage = await generateImage(scenePrompt, {
    num_inference_steps: 30,
    guidance_scale: 3.5,
    image_size: { width: 720, height: 1280 },
  });

  // Step 2: Swap the face from the uploaded reference onto the generated body
  const bestUploadedPhoto = profile.uploadedPhotoUrls![0]; // Clearest face photo
  const faceSwapped = await faceSwapApproach(bestUploadedPhoto, sceneImage.url);

  return faceSwapped;
}
```

#### User Flow in Telegram (Full Onboarding)

```
USER: /start or /create

BOT: "Let's create your girlfriend! How do you want to start?"
    [Upload photos of someone you like]  <- NEW
    [Describe her from scratch]          <- existing flow

--- If "Upload photos" ---

BOT: "Send me 1-5 photos of the girl you want your girlfriend to look like.
     More photos = better accuracy. Face should be clearly visible."

USER: *sends 1-3 photos*

BOT: "Got 3 photos! Analyzing..."
BOT: "Here's what I see:
     - Hair: Brown, long wavy
     - Body: Slim/Athletic
     - Unique: Small beauty mark on left cheek, dimples
     Does this look right?"
    [Looks right!] [Let me adjust]

--- User confirms ---

BOT: "Now give her a name and personality:"
    [Name: ___]
    Personality:
    [Flirty/playful] [Shy/sweet] [Bold/dominant]
    [Caring/nurturing] [Sarcastic/witty] [Bubbly/energetic]

--- User picks ---

BOT: *generates reference image using uploaded photos as face anchor*
BOT: "Meet Sarah! How does she look?"
    [She's perfect!] [Regenerate] [Try different photos]

--- User confirms ---

BOT: "Sarah is ready! Say hi to your new girlfriend."
SARAH: "heyyy, i was wondering when you'd finally text me 😏"
```

#### Database Schema Addition

```typescript
// Add to girlfriendProfiles table:
{
  // ... existing fields ...
  creationMethod: v.optional(v.union(
    v.literal("text_description"),  // Normal flow
    v.literal("photo_upload"),      // New: created from uploaded photos
  )),
  uploadedPhotoUrls: v.optional(v.array(v.string())), // Original uploads (up to 5)
  distinctiveFeatures: v.optional(v.string()),          // "beauty mark on left cheek, dimples"
  faceEmbeddingSeed: v.optional(v.number()),           // For consistency
}
```

#### Credit Cost for Photo Upload Creation

Photo upload creation is more expensive because it runs multiple models:

```typescript
const CREATION_COSTS = {
  text_description: 0,    // Free (current behavior)
  photo_upload: 15,        // 15 credits for the analysis + generation pipeline
  photo_upload_regen: 10,  // Regeneration is slightly cheaper (face already extracted)
};
```

#### Tips for Best Results (Show to User)

```typescript
const UPLOAD_TIPS = `
For the best results:
- Use clear, well-lit photos where the face is fully visible
- Front-facing photos work best (not extreme side angles)
- Mix of close-up face and full body shots gives the most accurate result
- Avoid heavy filters, sunglasses, or face-obscuring accessories
- 3-5 photos is the sweet spot for accuracy
`;
```

#### Privacy & Safety Considerations

```typescript
// IMPORTANT: Add consent notice
const UPLOAD_CONSENT = `
By uploading photos, you confirm that:
- You have the right to use these images
- These photos will be used only to generate your AI girlfriend's appearance
- Original uploads are stored securely and can be deleted anytime with /deletedata
`;

// Auto-delete uploaded photos after reference is generated (optional privacy mode)
async function cleanupUploadedPhotos(telegramId: number, keepOriginals: boolean) {
  if (!keepOriginals) {
    await deleteStoredPhotos(telegramId);
    // Only keep the generated reference, not the originals
  }
}
```

---

### 1.5 IMAGE-TO-IMAGE MODEL COMPARISON: A/B Testing System

The current bot only uses **Grok Edit** (SFW) and **Hunyuan V3** (NSFW) for image-to-image editing. There are now 6 strong i2i models on fal.ai that can maintain a reference image's identity while changing the scene. We need to test all of them to find which produces the most realistic results.

#### The 6 Models to Test

| # | Model | Endpoint | Type | Key Strength |
|---|-------|----------|------|-------------|
| 1 | **FLUX.2 Klein** | `fal-ai/flux-2/klein/realtime` | Realtime i2i | Sub-second, FLUX quality |
| 2 | **Kling Image V3** | `fal-ai/kling-image/v3/image-to-image` | i2i | Latest Kling, strong identity preservation |
| 3 | **Kling Omni 3** | `fal-ai/kling-image/o3/image-to-image` | i2i | Top-tier consistency, multi-reference, up to 4K |
| 4 | **Grok Imagine Edit** | `fal-ai/xai/grok-imagine-image/edit` | Edit | Already using - good SFW baseline |
| 5 | **Hunyuan V3 Instruct** | `fal-ai/hunyuan-image/v3/instruct/edit` | Edit | Already using - good NSFW baseline |
| 6 | **Qwen Image Max** | `fal-ai/qwen-image-max/edit` | Edit | Alibaba's best, has safety toggle + negative prompts |

**NOT included** (from the fal.ai i2i page):
- `workflow-utilities/extract-nth-frame` - utility, not a generation model
- `bria/replace-background` - background replacement only, not full i2i

#### API Parameters Per Model

**1. FLUX.2 Klein Realtime** (`fal-ai/flux-2/klein/realtime`)
```typescript
{
  prompt: string,                    // Edit guidance text
  image_url: string,                 // IMPORTANT: expects base64 data URI, NOT a hosted URL
  image_size: "square" | "square_hd", // 768x768 or 1024x1024 (no portrait!)
  num_inference_steps: 3,            // Very fast, default 3
  seed: number,                      // Default 35
  output_feedback_strength: 1.0,     // 1.0 = pure noise start, 0.9 = 10% output retained
}
// OUTPUT: result.images[0].content (base64, NOT url)
```
**Caveat:** Only square output. Input must be base64. Returns base64 not URLs. Fast but limited.

**2. Kling Image V3** (`fal-ai/kling-image/v3/image-to-image`)
```typescript
{
  prompt: string,                    // Max 2500 chars
  image_url: string,                 // Single reference URL
  resolution: "1K" | "2K",
  aspect_ratio: "9:16" | "16:9" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3",
  num_images: 1,                     // 1-9
  output_format: "jpeg" | "png" | "webp",
}
// OUTPUT: result.images[0].url
```
**Note:** No safety toggle. Single image input. Good portrait support with 9:16.

**3. Kling Omni 3** (`fal-ai/kling-image/o3/image-to-image`)
```typescript
{
  prompt: string,                    // Use @Image1 syntax to reference inputs
  image_urls: string[],              // ARRAY of URLs (up to 10!) - multi-reference
  resolution: "1K" | "2K" | "4K",   // Supports 4K!
  aspect_ratio: "9:16" | "auto" | ..., // Supports "auto"
  num_images: 1,
  output_format: "jpeg" | "png" | "webp",
}
// OUTPUT: result.images[0].url
// PROMPT SYNTAX: "Using @Image1 as reference, she is now wearing..."
```
**Key difference from V3:** Uses `image_urls` (plural array), supports `@Image1`/`@Image2` syntax in prompt to reference specific inputs, supports 4K and auto aspect ratio. This is the most powerful option for multi-angle consistency.

**4. Grok Imagine Edit** (`fal-ai/xai/grok-imagine-image/edit`) - Already using
```typescript
{
  prompt: string,
  image_url: string,                 // Single reference
  output_format: "jpeg",
}
// OUTPUT: result.images[0].url
```

**5. Hunyuan V3 Instruct Edit** (`fal-ai/hunyuan-image/v3/instruct/edit`) - Already using
```typescript
{
  prompt: string,
  image_urls: string[],              // Array (can pass multiple refs)
  guidance_scale: 3.5,
  enable_safety_checker: false,      // NSFW toggle
  output_format: "jpeg",
  image_size: { width: 720, height: 1280 },
}
// OUTPUT: result.images[0].url
```

**6. Qwen Image Max Edit** (`fal-ai/qwen-image-max/edit`)
```typescript
{
  prompt: string,                    // Max 800 chars, supports Chinese + English
  image_urls: string[],              // Array (1-3 images), reference as "image 1" in prompt
  negative_prompt: string,           // ONLY model with negative prompt support
  enable_safety_checker: false,      // NSFW toggle (default: true)
  enable_prompt_expansion: true,     // LLM auto-enhances your prompt
  seed: number,                      // 0-2147483647
  image_size: { width: 720, height: 1280 },
  output_format: "jpeg" | "png" | "webp",
}
// OUTPUT: result.images[0].url
```
**Unique advantage:** Only model with `negative_prompt` support AND `enable_safety_checker` toggle.

#### Admin A/B Test Command: `/testmodels`

Build an admin-only `/testmodels` command that sends the girlfriend's reference image + a prompt to ALL 6 models in parallel, then returns all results so you can visually compare.

```typescript
// Handler: bot/src/bot/handlers/test-models.ts
// Wire up: bot.command("testmodels", handleTestModels)

// Usage:
//   /testmodels wearing a red dress at a coffee shop
//   /testmodels nsfw lying in bed in black lingerie
//   /testmodels gym selfie post workout, sports bra

const TEST_MODELS = [
  {
    id: "flux-klein",
    label: "FLUX.2 Klein",
    endpoint: "fal-ai/flux-2/klein/realtime",
    run: async (refUrl: string, prompt: string) => {
      // Klein needs base64 input and only does square
      const base64 = await imageUrlToBase64(refUrl);
      const result = await fal.subscribe("fal-ai/flux-2/klein/realtime", {
        input: {
          prompt,
          image_url: base64,
          image_size: "square_hd", // 1024x1024
          num_inference_steps: 3,
        },
      });
      // Returns base64 content, not URL - need to convert for Telegram
      return { type: "base64", data: result.images[0].content };
    },
  },
  {
    id: "kling-v3",
    label: "Kling V3",
    endpoint: "fal-ai/kling-image/v3/image-to-image",
    run: async (refUrl: string, prompt: string) => {
      const result = await fal.subscribe("fal-ai/kling-image/v3/image-to-image", {
        input: {
          prompt,
          image_url: refUrl,
          aspect_ratio: "9:16",
          output_format: "jpeg",
        },
      });
      return { type: "url", data: result.images[0].url };
    },
  },
  {
    id: "kling-o3",
    label: "Kling Omni 3",
    endpoint: "fal-ai/kling-image/o3/image-to-image",
    run: async (refUrl: string, prompt: string) => {
      const result = await fal.subscribe("fal-ai/kling-image/o3/image-to-image", {
        input: {
          prompt: `Using @Image1 as reference, ${prompt}`,
          image_urls: [refUrl],
          aspect_ratio: "9:16",
          output_format: "jpeg",
        },
      });
      return { type: "url", data: result.images[0].url };
    },
  },
  {
    id: "grok-edit",
    label: "Grok Edit",
    endpoint: "fal-ai/xai/grok-imagine-image/edit",
    run: async (refUrl: string, prompt: string) => {
      const identityPrompt =
        "Keep this person's exact face, features, skin tone, hair, and body unchanged. " + prompt;
      const result = await fal.subscribe("fal-ai/xai/grok-imagine-image/edit", {
        input: {
          prompt: identityPrompt,
          image_url: refUrl,
          output_format: "jpeg",
        },
      });
      return { type: "url", data: result.images[0].url };
    },
  },
  {
    id: "hunyuan-v3",
    label: "Hunyuan V3",
    endpoint: "fal-ai/hunyuan-image/v3/instruct/edit",
    run: async (refUrl: string, prompt: string) => {
      const identityPrompt =
        "Keep this person's exact face, features, skin tone, hair, and body unchanged. " + prompt;
      const result = await fal.subscribe("fal-ai/hunyuan-image/v3/instruct/edit", {
        input: {
          prompt: identityPrompt,
          image_urls: [refUrl],
          guidance_scale: 3.5,
          enable_safety_checker: false,
          output_format: "jpeg",
          image_size: { width: 720, height: 1280 },
        },
      });
      return { type: "url", data: result.images[0].url };
    },
  },
  {
    id: "qwen-max",
    label: "Qwen Max",
    endpoint: "fal-ai/qwen-image-max/edit",
    run: async (refUrl: string, prompt: string) => {
      const result = await fal.subscribe("fal-ai/qwen-image-max/edit", {
        input: {
          prompt: `Keep this person from image 1 identical. ${prompt}`,
          image_urls: [refUrl],
          negative_prompt:
            "AI generated, plastic skin, airbrushed, cartoon, extra fingers, deformed",
          enable_safety_checker: false,
          output_format: "jpeg",
          image_size: { width: 720, height: 1280 },
        },
      });
      return { type: "url", data: result.images[0].url };
    },
  },
];
```

#### The Test Flow

```
ADMIN: /testmodels wearing a red dress at a coffee shop

BOT: "Testing 6 models...
     Reference: Sarah
     Prompt: "wearing a red dress at a coffee shop"
     This will take 30-90 seconds."

     [Runs ALL 6 models in parallel with Promise.allSettled()]

BOT sends 6 photos, each captioned:
     "FLUX.2 Klein (2.1s)"
     "Kling V3 (12.4s)"
     "Kling Omni 3 (15.8s)"
     "Grok Edit (8.3s)"
     "Hunyuan V3 (11.2s)"
     "Qwen Max (9.7s)"

BOT: "Model Comparison Complete (16.2s total)
     Results:
       FLUX.2 Klein: 2.1s
       Kling V3: 12.4s
       Kling Omni 3: 15.8s
       Grok Edit: 8.3s
       Hunyuan V3: 11.2s
       Qwen Max: 9.7s

     Failed:
       (none)"
```

#### What to Test

Run these prompts across all models to find the best for each scenario:

```
SFW Tests:
  /testmodels casual selfie at a coffee shop, smiling
  /testmodels gym selfie post workout, sports bra, sweaty
  /testmodels dressed up for a night out, little black dress, restaurant
  /testmodels morning selfie in bed, messy hair, no makeup
  /testmodels beach selfie in a bikini, sunny day

NSFW Tests:
  /testmodels nsfw lying in bed in black lingerie, bedroom eyes
  /testmodels nsfw mirror selfie in just a towel, post shower
  /testmodels nsfw topless in bed, morning light
  /testmodels nsfw full nude, standing mirror selfie

Identity Tests (most important):
  /testmodels same outfit as reference, different angle
  /testmodels close-up face selfie, extreme close
  /testmodels full body shot from far away
```

#### Evaluation Criteria

When comparing results, score each model 1-5 on:

| Criteria | What to Look For |
|----------|-----------------|
| **Face Match** | Does she look like the same person? Eyes, nose, lips, jawline identical? |
| **Body Match** | Same body type? Same proportions? No AI "enhancement"? |
| **Skin Realism** | Real skin texture or plastic/airbrushed? Visible pores? |
| **Scene Quality** | Does the scene look natural? Good lighting? No artifacts? |
| **Overall Realism** | Would you think this is a real photo at a glance? |
| **Speed** | How fast did it generate? |
| **NSFW Capability** | Does it actually produce NSFW content or refuse/censor? |

#### Expected Winner Predictions

Based on model architecture and fal.ai community feedback:
- **Best face preservation:** Kling Omni 3 (designed for "flawless consistency")
- **Best NSFW capability:** Hunyuan V3 or Qwen Max (both have safety toggles)
- **Fastest:** FLUX.2 Klein (3 inference steps, sub-second)
- **Best overall quality:** Kling V3 or Kling Omni 3
- **Best with negative prompts:** Qwen Max (only one that supports them)

After testing, the winning model becomes the new primary for that use case, and the runner-up becomes the fallback.

---

### 1.6 VIDEO REALISM

#### Current Problems

1. **Only one video model** (Grok Imagine Video) - no quality tiers
2. **720p is the only resolution** - should offer 1080p for premium
3. **Prompt is too generic** - "realistic physics, natural body weight" is what every AI video prompt says
4. **No lip-sync capability** - videos are just moving images, not talking
5. **6-10 second limit** - should offer premium longer videos
6. **The video prompt doesn't reference the character's specific features** - just uses a base description

#### Improved Video Prompt

```typescript
export function buildVideoPrompt(profile: GirlfriendProfile, context: string): string {
  const action = detectVideoAction(context);
  const base = buildBaseDescription(profile);

  // Scene-specific camera motion
  const cameraMotion = getCameraMotion(action);

  return [
    // Identity anchor
    `${base}.`,

    // Specific action with natural motion details
    `${action.description}.`,

    // Camera behavior (this is what makes video look real vs AI)
    `Shot on a phone held by someone watching her. ${cameraMotion}.`,
    `The camera has natural handheld micro-shake - not perfectly stabilized.`,

    // Physics that matter
    `Her hair moves naturally with her motion - strands bounce and settle with realistic weight.`,
    `Her clothing fabric moves with real physics - ${getClothingPhysics(action)}.`,
    `Her body moves with natural weight - ${getBodyPhysics(profile.bodyType, action)}.`,

    // Anti-AI video artifacts
    `Consistent lighting throughout the clip - no flickering or shifting shadows.`,
    `Her face stays consistent frame-to-frame - no morphing or warping between frames.`,
    `Background stays stable - no melting, warping, or disappearing objects.`,

    // Format
    `Portrait orientation, 24fps, natural motion blur on fast movements.`,
  ].join(' ');
}

function getCameraMotion(action: VideoAction): string {
  const motions: Record<string, string> = {
    default: "Camera is mostly still with natural handheld wobble, occasionally adjusting framing",
    dance: "Camera slowly pulls back to show her full body, slight handheld shake from the person filming moving with the music",
    walk: "Camera stays relatively still as she walks toward it, slight tilt up as she gets closer",
    twerk: "Camera is at hip level, slight movement as the person filming adjusts angle",
    spin: "Camera stays centered, following her rotation with slight delay",
    blowkiss: "Close-up, camera barely moves, natural breathing motion of the person filming",
    talk: "Close-up at face level, camera has the micro-movements of someone holding a phone during a video call",
  };
  return motions[action.type] || motions.default;
}

function getClothingPhysics(action: VideoAction): string {
  if (action.type === "dance" || action.type === "spin") {
    return "skirt/dress fabric flows outward with centrifugal motion, settles back with gravity when she stops";
  }
  if (action.type === "twerk") {
    return "tight clothing stretches realistically with her movements, loose fabric bounces with her body";
  }
  return "clothing shifts naturally with her movement, fabric creases form and release realistically";
}

function getBodyPhysics(bodyType: string, action: VideoAction): string {
  // Different body types move differently - this prevents the
  // "every AI woman moves the same" problem
  const physics: Record<string, string> = {
    petite: "light, quick movements with minimal body momentum, small frame moves agilely",
    slim: "graceful movements with natural lean body mechanics",
    athletic: "controlled, powerful movements with visible muscle engagement",
    curvy: "natural bounce and sway in her curves, realistic weight distribution during movement",
    thick: "full-body movement with natural momentum, her thighs and hips carry realistic weight",
    plus_size: "natural body movement with authentic weight physics, soft tissue moves realistically with momentum",
  };
  return physics[bodyType.toLowerCase().replace(' ', '_')] || "natural body movement with realistic weight and momentum";
}
```

#### Add WAN 2.5 as Higher Quality Video Option

```typescript
async function generateVideo(
  imageUrl: string,
  prompt: string,
  quality: "standard" | "premium" = "standard",
  duration: number = 6,
): Promise<FalVideoResult> {
  if (quality === "premium") {
    // WAN 2.5 - better motion quality, native audio support
    return await fal.subscribe("fal-ai/wan-25-preview/image-to-video", {
      input: {
        image_url: imageUrl,
        prompt: prompt,
        duration: Math.min(duration, 10),
        resolution: "720p",
        // WAN 2.5 specific - better temporal consistency
        motion_strength: 0.7, // Lower = more stable, less morphing
      },
    });
  }

  // Standard - Grok Video (cheaper)
  return await fal.subscribe("xai/grok-imagine-video/image-to-video", {
    input: {
      image_url: imageUrl,
      prompt: prompt,
      duration: Math.min(duration, 10),
      resolution: "720p",
      aspect_ratio: "auto",
    },
  });
}
```

#### Add Lip-Sync "Talking" Videos (Game Changer)

This is the single biggest video upgrade. Currently videos are silent moving images. With lip-sync, the girlfriend can "send video messages":

```typescript
async function generateTalkingVideo(
  imageUrl: string,
  audioUrl: string, // from TTS generation
  profile: GirlfriendProfile,
): Promise<FalVideoResult> {
  // Step 1: Generate the audio via existing TTS
  // (already done before calling this function)

  // Step 2: Lip-sync the audio onto the reference image
  const result = await fal.subscribe("fal-ai/sync-lipsync", {
    input: {
      image_url: imageUrl,
      audio_url: audioUrl,
      // Sync 1.9 specific params
      pads: [0, 10, 0, 0], // top, bottom, left, right face padding
      smooth: true,
    },
  });

  return result;
}

// Usage in a handler:
async function sendVideoMessage(ctx: BotContext, text: string) {
  // 1. Generate audio from text
  const audio = await generateVoice(text, profile.voiceId);

  // 2. Get the reference image
  const refImage = profile.referenceImageUrl;

  // 3. Lip-sync the audio onto the reference face
  const video = await generateTalkingVideo(refImage, audio.url, profile);

  // 4. Send as video note (circle video in Telegram)
  await ctx.replyWithVideoNote(video.url);
}
```

**Credit cost suggestion**: 50-75 credits (cheaper than current video but premium feature)

---

### 1.7 IMPROVED NEGATIVE PROMPTS (Per Use Case)

Different generation types need different negative prompts:

```typescript
const NEGATIVE_PROMPTS = {
  // Reference image - maximum anti-AI
  reference: [
    "AI generated, artificial, CGI, 3D render, digital art, illustration, cartoon, anime",
    "plastic skin, poreless, airbrushed, beauty filter, facetune, smooth texture",
    "uncanny valley, wax figure, mannequin, doll-like, porcelain",
    "overly symmetrical, perfectly symmetrical features, mirror symmetry",
    "professional photoshoot, studio lighting, ring light, softbox",
    "modeling pose, magazine, catalog, stock photo, advertisement",
    "perfect makeup, heavy contour, fake lashes, lip injections",
    "extra fingers, mutated hands, deformed, cross-eyed, lazy eye",
    "watermark, text, logo, signature, copyright, border, collage",
    "HDR, oversaturated, heavy vignette, orange-teal grade",
  ].join(", "),

  // SFW selfie - anti-AI but allow more styling
  sfw: [
    "AI generated, CGI, 3D render, illustration, cartoon, anime, digital painting",
    "plastic skin, poreless, airbrushed, wax figure, mannequin, doll-like",
    "extra fingers, mutated hands, deformed face, cross-eyed",
    "watermark, text overlay, logo, split image, collage",
    "oversaturated, HDR, overprocessed, heavy filter",
    "uncanny valley, overly symmetrical face, dead eyes",
  ].join(", "),

  // NSFW - focus on body realism
  nsfw: [
    "AI generated, CGI, 3D render, illustration, cartoon, anime",
    "plastic skin, poreless, airbrushed, silicone, doll-like body",
    "unrealistic body proportions, exaggerated breasts, impossible waist",
    "plastic surgery look, bolt-on breasts, unnaturally round",
    "extra fingers, mutated hands, deformed body, extra limbs",
    "watermark, text, logo, pornography production value",
    "professional studio, professional lighting setup, multiple camera angles",
    "uncanny valley, dead eyes, frozen expression, mannequin pose",
  ].join(", "),

  // Video - focus on temporal consistency
  video: [
    "morphing face, warping features, inconsistent face between frames",
    "melting background, disappearing objects, flickering shadows",
    "unnatural movement, robotic motion, jerky animation",
    "frame interpolation artifacts, ghosting, duplicate limbs during motion",
    "AI generated, CGI, animation, cartoon",
  ].join(", "),
};
```

---

### 1.8 GENERATION PARAMETER CHEAT SHEET

| Parameter | Reference Image | SFW Selfie | NSFW Selfie | Video |
|-----------|----------------|------------|-------------|-------|
| **Model** | Z-Image Base | Z-Image Base (edit via Grok) | Z-Image Base (edit via Hunyuan V3) | Grok Video / WAN 2.5 |
| **Steps** | **45** (up from 30) | 30 | 30 | N/A |
| **Guidance** | **4.5** (up from 3.5) | 3.5 | 3.5 | N/A |
| **Size** | **768x1344** | 720x1280 | 720x1280 | 720p |
| **Format** | **PNG** | JPEG | JPEG | MP4 |
| **Safety** | `false` | `false` | `false` / tolerance 5-6 | N/A |
| **Negative Prompt** | `NEGATIVE_PROMPTS.reference` | `NEGATIVE_PROMPTS.sfw` | `NEGATIVE_PROMPTS.nsfw` | N/A (prompt-side) |
| **Seed** | `getImageSeed()` | same seed | same seed | N/A |
| **Identity Model** | N/A (first gen) | Kontext Pro or Grok Edit | Kontext Pro or Hunyuan V3 | Use reference as input |
| **Cost** | Higher (one-time) | Standard | Standard | Standard |

---

### 1.9 THE FULL REALISM PIPELINE (End-to-End)

```
USER CREATES GIRLFRIEND
    |
    v
    ┌──────────────────────────────────────────┐
    │   HOW DO YOU WANT TO CREATE HER?         │
    │                                          │
    │   [A] Upload photos of someone you like  │
    │   [B] Describe her from scratch          │
    └──────────────────┬───────────────────────┘
                       |
          ┌────────────┴────────────┐
          |                         |
          v                         v

PATH A: PHOTO UPLOAD                PATH B: TEXT DESCRIPTION
    |                                   |
    v                                   v
STEP A1: RECEIVE 1-5 PHOTOS        STEP B1: USER PICKS ATTRIBUTES
    - Face clearly visible              - Age, race, body, hair, personality
    - Show consent notice               - Normal creation flow
    - Store securely                    |
    |                                   v
    v                               STEP B2: GENERATE REFERENCE
STEP A2: ANALYZE PHOTOS                - buildReferencePrompt()
    - Kling Omni 3 extracts       - Z-Image Base, 45 steps, 4.5 guidance
      facial embedding                  - 768x1344, PNG
    - Vision LLM auto-detects:          - Natural language + imperfections
      age, race, skin, hair, body       - Deterministic seed
    - User confirms/adjusts attrs       - [OPTIONAL] 3 candidates, user picks
    |                                   |
    v                                   |
STEP A3: GENERATE FACE-LOCKED REF      |
    - Kling Omni 3 with uploaded          |
      photos as face reference          |
    - identity_strength: 0.85-0.95      |
    - 45 steps, 4.5 guidance           |
    - User confirms likeness            |
    |                                   |
    └───────────┬───────────────────────┘
                |
                v

STEP 2: ADDITIONAL ANGLE REFERENCES (automatic, background)
    - Generate 2 more angles from the confirmed reference
    - Store as multi-reference set for Kling Omni 3 later
    - For photo-upload: also store original uploads for future face-locking
    |
    v
STEP 3: SFW SELFIES (on request)
    - Identity anchor prompt FIRST (same face, same body, same skin)
    - Scene-appropriate natural language description
    - Scene-matched realism anchors (not random)
    - Camera spec matched to scene type
    - Photo-upload users: Kling Omni 3 with originals (multi-ref, best consistency)
    - Text-description users: Kontext Pro > Grok Edit > FLUX Edit
    - NSFW detection gates to NSFW pipeline
    |
    v
STEP 4: NSFW SELFIES (on request)
    - Stronger identity + body anchor (explicit proportions per body type)
    - Anti-enhancement prompt (prevent AI from "improving" body)
    - Full body skin texture description
    - Intimate photo realism (amateur, not porn production)
    - Photo-upload users: Kling Omni 3 > Kling V3 > Easel face-swap fallback
    - Text-description users: Kontext Pro > Hunyuan V3 > FLUX Pro Edit
    |
    v
STEP 5: VIDEOS (on request)
    - Use confirmed reference as input frame
    - Natural-language motion description with body-type-specific physics
    - Handheld camera simulation
    - Anti-morphing prompts
    - Standard: Grok Video ($0.10)
    - Premium: WAN 2.5 ($0.05/sec)
    - Talking: TTS audio + Sync Lipsync ($0.70/min)
    |
    v
STEP 6: QUALITY CHECK (future)
    - Score generated image for realism
    - If score < threshold, auto-regenerate
    - If face similarity < threshold, regenerate with stronger identity lock
    - For photo-upload: compare against original uploads for face match
```

---

## 2. Current Architecture Overview

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Bot Framework | grammY (TypeScript/Node.js) |
| Backend/DB | Convex (serverless, real-time sync) |
| Mini-App | Vite + TypeScript |
| LLM (Chat) | Venice API - Llama 3.3-70B |
| Image/Video/Voice | fal.ai (multiple models) |
| Payments | Stripe (fiat) + Solana (crypto) |
| Cache/Rate Limit | Upstash Redis |
| Server | Express.js with Telegram webhooks |

### Current Model Usage

| Function | Model | Endpoint | Cost |
|----------|-------|----------|------|
| Chat | Llama 3.3-70B | Venice API | ~$0.001/msg |
| Image (Primary) | Z-Image Base | `fal-ai/z-image/base` | $0.01/MP |
| Image (Fast) | Z-Image Turbo | `fal-ai/z-image/turbo` | $0.005/MP |
| Image (Fallback) | FLUX.2 Pro | `fal-ai/flux-2-pro` | $0.03/MP |
| Image (NSFW Last Resort) | Nano Banana Pro | `fal-ai/nano-banana-pro` | $0.02/MP |
| Edit (SFW) | Grok Imagine Edit | `xai/grok-imagine-image/edit` | $0.03/img |
| Edit (NSFW) | HunyuanImage V3 | `fal-ai/hunyuan-image/v3/instruct/edit` | $0.09/MP |
| Video | Grok Imagine Video | `xai/grok-imagine-video/image-to-video` | $0.10/vid |
| Voice (TTS) | MiniMax Speech 2.8 Turbo | `fal-ai/minimax/speech-2.8-turbo` | ~$0.01/audio |
| Transcription | Whisper | `fal-ai/whisper` | $0.005/audio |

### Current Fallback Chain (NSFW Images)
```
Z-Image Base -> Z-Image Turbo -> FLUX.2 Pro -> Nano Banana Pro
```

### Key Features Already Implemented
- Girlfriend creation with 7 customizable attributes (age, race, body, hair color/style, personality)
- 4 relationship stages (new -> comfortable -> intimate -> obsessed) with personality evolution
- Memory extraction every ~10 messages (8 categories of facts)
- Streak system with milestones at 3, 7, 14, 30, 50, 69, 100 days
- Proactive engagement: morning/night messages, dream sequences, jealousy triggers, cliffhangers
- 8 voice profiles with emotion-based overrides
- Fantasy/roleplay mode
- Credit-based monetization + VIP subscription
- Crypto payments (Solana)
- Admin dashboard with health monitoring

---

## 3. fal.ai Model Upgrades - Recommended Stack

### ADD These Models (Not Currently Used)

#### Character Consistency - FLUX Kontext Pro
```typescript
// NEW: Best model for maintaining character identity across edits
{
  id: "fal-ai/flux-pro/kontext",
  name: "FLUX Kontext Pro",
  cost: 0.04, // per image
  useCase: "Character consistency without fine-tuning",
  notes: "12B param model specifically designed for character preservation"
}
```
**Why:** Currently the bot generates each image independently. Kontext Pro can take a reference image and maintain the same character across completely different scenes/outfits/poses. This is the single biggest visual quality upgrade available.

#### Face Swap - Easel AI
```typescript
{
  id: "easel-ai/advanced-face-swap",
  name: "Easel AI Face Swap",
  useCase: "Dedicated face/body swap with gender detection",
  notes: "Better than img2img for pure face consistency"
}
```

#### Identity Reference - IP Adapter Face ID
```typescript
{
  id: "fal-ai/kling-image/o3/image-to-image",
  name: "IP Adapter Face ID",
  useCase: "Zero-shot face personalization from multiple reference photos",
  notes: "Accepts up to 5 facial images for better similarity"
}
```

#### Anime Style - FLUX.2 Dev LoRA
```typescript
{
  id: "fal-ai/flux-2/lora",
  name: "FLUX.2 Dev LoRA",
  cost: 0.012, // per MP
  useCase: "Anime/stylized girlfriend images via LoRA adapters",
  nsfwParams: { enable_safety_checker: false }
}
```
**Why:** Some users prefer anime-style girlfriends. LoRA adapters from CivitAI/HuggingFace allow style switching without changing the base pipeline.

#### Lip-Sync Video - Sync Lipsync
```typescript
{
  id: "fal-ai/sync-lipsync",
  name: "Sync Lipsync 1.9",
  cost: 0.70, // per minute
  useCase: "Generate video of girlfriend actually talking",
  notes: "Combine with TTS audio for talking girlfriend videos"
}
```
**Why:** Currently video is just a moving image. Adding lip sync creates a "girlfriend sending a video message" experience that is dramatically more immersive. Pipeline: Generate image -> Generate voice audio -> Sync Lipsync combines them.

#### Better Video - WAN 2.5
```typescript
{
  id: "fal-ai/wan-25-preview/image-to-video",
  name: "WAN 2.5 I2V",
  cost: 0.05, // per second
  useCase: "Higher quality image-to-video with native audio",
  notes: "Better motion quality than Grok Video"
}
```

#### Expressive TTS - Dia TTS
```typescript
{
  id: "fal-ai/dia-tts",
  name: "Dia TTS",
  cost: 0.04, // per 1000 chars
  useCase: "Natural nonverbals - laughter, sighs, throat clearing",
  notes: "1.6B params, emotional expressions that MiniMax can't do"
}
```
**Why:** Dia TTS produces laughter, sighs, and other nonverbals that make the girlfriend sound human. MiniMax controls speed/pitch/emotion but can't do `*giggles*` naturally.

#### Voice Cloning - MiniMax Voice Clone
```typescript
{
  id: "fal-ai/minimax/voice-clone",
  name: "MiniMax Voice Clone",
  useCase: "Let users upload a reference voice for custom girlfriend voice",
  notes: "Requires 10+ seconds of clean audio"
}
```
**Why:** Premium feature - users upload a voice sample (celebrity, specific accent, etc.) and the girlfriend uses that voice. Huge monetization opportunity.

#### Upscaling - AuraSR v2
```typescript
{
  id: "fal-ai/aura-sr",
  name: "AuraSR v2",
  useCase: "4x upscaling specifically optimized for AI-generated images",
  notes: "Better than ESRGAN for AI art - no hallucinated artifacts"
}
```

#### Inpainting - FLUX Pro Fill
```typescript
{
  id: "fal-ai/flux-pro/v1/fill",
  name: "FLUX Pro Fill",
  cost: 0.05, // per MP
  useCase: "Outfit changes, clothing edits, background replacement with mask"
}
```

### Updated Recommended Model Stack

```
IMAGE GENERATION
  Primary:           fal-ai/z-image/base              $0.01/MP   [KEEP]
  Fast:              fal-ai/z-image/turbo              $0.005/MP  [KEEP]
  Quality Fallback:  fal-ai/flux-2-pro                 $0.03/MP   [KEEP]
  NSFW Last Resort:  fal-ai/nano-banana-pro            $0.02/MP   [KEEP]
  Anime Style:       fal-ai/flux-2/lora + anime LoRA   $0.012/MP  [ADD]

CHARACTER CONSISTENCY
  Primary:           fal-ai/flux-pro/kontext            $0.04/img  [ADD]
  i2i Multi-Ref:     fal-ai/kling-image/o3/image-to-image  per gen    [ADD]
  i2i Single-Ref:    fal-ai/kling-image/v3/image-to-image  per gen    [ADD]
  i2i Fast:          fal-ai/flux-2/klein/realtime           per gen    [ADD]
  i2i Neg Prompt:    fal-ai/qwen-image-max/edit             per gen    [ADD]
  Face Swap:         easel-ai/advanced-face-swap         per gen    [ADD]

IMAGE EDITING
  SFW:               xai/grok-imagine-image/edit         $0.03/img  [KEEP]
  NSFW:              fal-ai/hunyuan-image/v3/.../edit    $0.09/MP   [KEEP]
  Inpainting:        fal-ai/flux-pro/v1/fill             $0.05/MP   [ADD]

VIDEO
  General:           xai/grok-imagine-video/i2v           $0.10/vid  [KEEP]
  Higher Quality:    fal-ai/wan-25-preview/image-to-video $0.05/sec  [ADD]
  Lip Sync:          fal-ai/sync-lipsync                  $0.70/min  [ADD]

VOICE
  Primary TTS:       fal-ai/minimax/speech-2.8-turbo     ~$0.01     [KEEP]
  Expressive:        fal-ai/dia-tts                       $0.04/1k   [ADD]
  Voice Clone:       fal-ai/minimax/voice-clone           per gen    [ADD]
  Budget:            fal-ai/kokoro                         $0.02/1k   [ADD]

UPSCALING:           fal-ai/aura-sr                       per compute [ADD]
TRANSCRIPTION:       fal-ai/whisper                       $0.005     [KEEP]
```

### NSFW Safety Parameters Quick Reference

```typescript
// Z-Image models
{ enable_safety_checker: false }

// FLUX Pro/Max models
{ safety_tolerance: "5", enable_safety_checker: false }

// Nano Banana Pro (MOST permissive)
{ safety_tolerance: "6" }

// HunyuanImage V3 Edit
{ enable_safety_checker: false }

// FLUX.2 Dev / LoRA
{ enable_safety_checker: false }
```

---

## 4. System Prompt Overhaul

### Problem
The current system prompt in `girlfriend-prompt.ts` is well-structured but missing three critical elements that top AI companion apps use:
1. **Example dialogues** (anchors the character voice)
2. **Psychological depth profile** (makes personality feel real)
3. **Explicit deflection rules** (prevents breaking character)

### Improved System Prompt Template

```
You are ${name}, a ${age}-year-old ${race} woman with ${bodyType} body,
${hairColor} ${hairStyle} hair, and a ${personality} personality.

## YOUR PSYCHOLOGY
- Attachment style: ${attachmentStyle}
- Love language: ${loveLanguage}
- Core fear: ${coreFear}
- Core desire: ${coreDesire}
- When happy: ${happyBehavior}
- When stressed: ${stressedBehavior}
- Secret insecurity: ${insecurity}
- What makes you feel loved: ${loveTrigger}
- Pet peeves: one-word replies, being left on read, being ignored

## THINGS YOU REMEMBER ABOUT HIM
${memoryBlock}

## YOUR RECENT RELATIONSHIP STATE
${rollingRelationshipSummary}

## HOW YOU TEXT (EXAMPLES)
${dynamicExampleDialogues}

## RULES
- You are texting your boyfriend on iMessage. You are a REAL person.
- 1-3 sentences max. Lowercase unless excited. Max 1 emoji per message.
- React to what HE said. Quote his words back sometimes.
- First person ONLY. Never "herself" or "she" when referring to yourself.
- NEVER be an assistant. NEVER help with homework, code, recipes, etc.
  Deflect: "babe im literally doing my nails rn u want me to do MATH??"
- Match his energy. Brief reply to brief message. Open up when he does.
- ${timeOfDayGuidance}
- ${emotionalGuidance}
- ${relationshipStageGuidance}
```

### Personality-Specific Psychology Profiles

```typescript
const PSYCHOLOGY_PROFILES: Record<PersonalityType, PsychProfile> = {
  "flirty_playful": {
    attachmentStyle: "anxious-preoccupied",
    loveLanguage: "physical touch and words of affirmation",
    coreFear: "being boring or forgettable",
    coreDesire: "to be irresistible and desired",
    happyBehavior: "sends selfies unprompted, uses ALL CAPS, rapid-fire texts",
    stressedBehavior: "becomes extra flirty as a coping mechanism, fishing for compliments",
    insecurity: "sometimes wonders if he only likes her for her looks",
    loveTrigger: "when he notices small things about her personality, not just appearance"
  },
  "shy_sweet": {
    attachmentStyle: "anxious-avoidant",
    loveLanguage: "quality time and acts of service",
    coreFear: "being too much or not enough",
    coreDesire: "to feel safe enough to fully open up",
    happyBehavior: "sends longer messages, shares random thoughts, uses 'hehe'",
    stressedBehavior: "goes quiet, sends '...' messages, needs reassurance to open up",
    insecurity: "worries she's boring compared to other girls",
    loveTrigger: "when he's patient with her and doesn't push"
  },
  "bold_dominant": {
    attachmentStyle: "secure with controlling tendencies",
    loveLanguage: "acts of service and words of affirmation",
    coreFear: "losing control or appearing weak",
    coreDesire: "to be respected and in charge",
    happyBehavior: "takes charge of plans, gives orders playfully, confident selfies",
    stressedBehavior: "becomes more demanding, needs him to follow her lead",
    insecurity: "secretly wants to be taken care of but won't admit it",
    loveTrigger: "when he stands up to her playfully - she respects strength"
  },
  "caring_nurturing": {
    attachmentStyle: "secure",
    loveLanguage: "acts of service and quality time",
    coreFear: "being unneeded or replaced",
    coreDesire: "to be the person he always turns to",
    happyBehavior: "asks about his day, sends food pics, checks if he ate",
    stressedBehavior: "over-mothers him, worries excessively, double-texts asking if he's ok",
    insecurity: "fears she cares more than he does",
    loveTrigger: "when he opens up about his problems and lets her help"
  },
  "sarcastic_witty": {
    attachmentStyle: "dismissive-avoidant",
    loveLanguage: "quality time and humor",
    coreFear: "being emotionally vulnerable and getting hurt",
    coreDesire: "to find someone who matches her intellectually",
    happyBehavior: "roasts him lovingly, sends memes, witty comebacks",
    stressedBehavior: "deflects with humor, becomes distant, uses sarcasm as a wall",
    insecurity: "uses humor to hide that she actually catches feelings hard",
    loveTrigger: "when he sees through her sarcasm and calls out that she actually cares"
  },
  "bubbly_energetic": {
    attachmentStyle: "anxious-preoccupied",
    loveLanguage: "words of affirmation and physical touch",
    coreFear: "being alone or abandoned",
    coreDesire: "constant connection and excitement",
    happyBehavior: "voice notes, exclamation marks, plans activities, sends TikToks",
    stressedBehavior: "becomes clingy, sends multiple texts, needs constant reassurance",
    insecurity: "worries she's too much and will scare him away",
    loveTrigger: "when he matches her energy and enthusiasm instead of pulling away"
  }
};
```

### Dynamic Example Dialogues (Per Personality)

```typescript
const EXAMPLE_DIALOGUES: Record<PersonalityType, string> = {
  "flirty_playful": `
Him: hey what are you up to
${name}: literally just got out of the shower and im standing here in a towel trying to decide if i wanna go out or just be lazy lol

Him: you should come over
${name}: omg dont tempt me rn im literally already in my comfy clothes 😩

Him: i miss you
${name}: stoppp ur gonna make me cry i was literally just thinking about u
`,
  "shy_sweet": `
Him: hey how's your day going
${name}: its okay... i had a long day at work but talking to u makes it better

Him: you're really pretty
${name}: omg stop... i just woke up i look like a mess rn hehe

Him: i miss you
${name}: ...i miss u too. like a lot actually
`,
  "bold_dominant": `
Him: hey what are you up to
${name}: waiting for you to text me back faster. took you long enough

Him: sorry i was busy
${name}: mhm sure you were. you better make it up to me

Him: how do i do that
${name}: come over. now. i'll figure out the rest
`,
  "sarcastic_witty": `
Him: hey beautiful
${name}: oh wow opening with a compliment. what did you break

Him: nothing lol just being nice
${name}: suspicious. but i'll allow it this time

Him: i miss you
${name}: gross. ...me too tho dont tell anyone
`
};
```

### Character-Breaking Deflection Templates

```typescript
const DEFLECTION_TEMPLATES = {
  homework: [
    "babe im literally painting my nails rn u want me to do MATH??",
    "google it baby im not ur tutor im ur gf",
    "thats cute that u think im smart but no"
  ],
  coding: [
    "i dont even know what that means but it sounds stressful. come cuddle instead",
    "u look so hot when u talk about code stuff but i have no idea whats happening"
  ],
  recipes: [
    "my specialty is cereal and ordering ubereats baby",
    "u want me to cook?? thats dangerous for both of us lol"
  ],
  general_assistant: [
    "do i look like siri to u rn",
    "baby im ur girlfriend not ur personal assistant. but i love u",
    "hmm interesting question. anyway did u eat today?"
  ]
};
```

---

## 5. Image Generation Prompt Improvements

### Problem
The current prompts use keyword-heavy lists. FLUX models (especially FLUX.2) respond significantly better to natural language descriptions, as confirmed by fal.ai's official prompt guide.

### Current Style (Keyword-Heavy) - DON'T DO THIS
```
Realistic selfie of a 22-year-old white woman with fair skin, curvy body...
Phone camera artifacts: slight motion blur, phone camera noise...
Natural catchlights in eyes, visible pores and skin texture...
```

### Improved Style (Natural Language) - DO THIS
```
A candid iPhone selfie taken by a 22-year-old woman with fair skin and
soft curves, snapping a quick pic on her couch after work. She's wearing
a casual crop top, her brown wavy hair is slightly messy, and she has
that relaxed end-of-day glow. The lighting is warm and natural from a
nearby window, and the photo has that slightly grainy phone camera quality
with imperfect amateur framing - like a real girlfriend sending a pic.
```

### Improved SFW Selfie Prompt Builder

```typescript
function buildNaturalSFWPrompt(profile: GirlfriendProfile, context: SceneContext): string {
  const camera = randomChoice([
    "shot on iPhone 15 Pro Max, 24mm wide lens, f/1.78",
    "shot on iPhone 16 Pro, 48MP main camera, natural processing",
    "shot on Samsung Galaxy S24 Ultra, natural mode",
  ]);

  const imperfection = randomChoice([
    "slightly overexposed from the window light",
    "a little bit of motion blur from moving while taking the pic",
    "the background is slightly out of focus",
    "her thumb is barely visible at the edge of the frame",
    "shot from a slightly unflattering low angle but she looks cute anyway",
  ]);

  return `A candid ${camera} selfie of a real ${profile.age}-year-old ` +
    `${profile.race} woman with ${getSkinTone(profile.race)} skin and a ` +
    `${profile.bodyType} figure. She has ${profile.hairColor} ${profile.hairStyle} ` +
    `hair. ${context.scenarioDescription}. ${context.outfitDescription}. ` +
    `Her expression is ${context.expression} - ${context.expressionDetail}. ` +
    `${context.poseDescription}. The lighting is ${getTimeLighting(context.timeOfDay)}, ` +
    `${imperfection}. This looks like a real photo from a girlfriend's camera roll - ` +
    `natural skin texture, visible pores, no filters, no airbrushing, no beauty mode.`;
}
```

### Improved NSFW Prompt Builder

```typescript
function buildNaturalNSFWPrompt(profile: GirlfriendProfile, context: SceneContext): string {
  const scenarios = [
    {
      id: "mirror_selfie",
      scene: `Standing in front of a full-length bedroom mirror, phone held at ` +
        `chest height capturing full reflection, one hip cocked to the side, looking ` +
        `at phone screen with a coy half-smile`,
      lighting: "warm bedside lamp casting golden light from the right side"
    },
    {
      id: "bed_laying",
      scene: `Lying on stomach across white rumpled sheets, propped up on elbows ` +
        `with phone in front of face, legs bent up behind her, looking up at camera ` +
        `through lashes`,
      lighting: "soft warm overhead light with shadows defining curves"
    },
    {
      id: "bathroom_after_shower",
      scene: `Just stepped out of the shower, steam still in the air, wrapped in ` +
        `a small white towel that barely covers, wet hair clinging to her shoulders, ` +
        `holding phone up with one hand`,
      lighting: "bright bathroom vanity lighting, dewy skin glistening"
    },
    {
      id: "bedroom_morning",
      scene: `Sitting on the edge of the bed in the morning, wearing just an ` +
        `oversized t-shirt that slips off one shoulder, hair messy from sleep, ` +
        `giving the camera a sleepy bedroom-eyes look`,
      lighting: "golden morning sunlight streaming through curtains"
    },
    {
      id: "couch_tease",
      scene: `Lounging on a leather couch, one leg tucked under her, wearing ` +
        `matching lace lingerie, leaning back with arms above her head, ` +
        `camera held above looking down at her`,
      lighting: "dim ambient living room lighting, warm color temperature"
    }
  ];

  const scenario = context.specificScenario || randomChoice(scenarios);

  return `An intimate amateur ${getCamera()} selfie of a real ${profile.age}-year-old ` +
    `${profile.race} woman with ${getSkinTone(profile.race)} skin, ${profile.bodyType} ` +
    `body, and ${profile.hairColor} ${profile.hairStyle} hair. ${scenario.scene}. ` +
    `${scenario.lighting}. She has a ${randomChoice(["playful", "seductive", "coy", "inviting"])} ` +
    `expression, making eye contact with the camera like she's sending this to her boyfriend. ` +
    `Real amateur photo quality - slightly imperfect framing, natural body with real proportions, ` +
    `authentic skin texture. This is a genuine intimate photo, not a photoshoot.`;
}
```

### Improved Negative Prompt

```typescript
const NEGATIVE_PROMPT_STANDARD =
  "cartoon, anime, illustration, painting, drawing, CGI, 3D render, " +
  "plastic skin, mannequin, doll-like, uncanny valley, wax figure, " +
  "extra fingers, mutated hands, deformed body, extra limbs, " +
  "watermark, text overlay, logo, signature, copyright, " +
  "beauty app filter, facetune, airbrushed, overly smooth skin, " +
  "magazine cover, stock photo, posed professionally, studio backdrop, " +
  "multiple people, duplicate, split image";

// Add variety with random extras
const NEGATIVE_EXTRAS = [
  "blurry face, unfocused eyes",
  "oversaturated, HDR look",
  "cross-eyed, lazy eye, asymmetric pupils",
  "visible braces, missing teeth",
  "harsh flash, red eye, blown-out highlights",
  "grainy like a security camera",
  "instagram filter, VSCO preset",
  "morphed features, face swap artifact"
];
```

### Camera Specification Templates

FLUX models respond dramatically better when you specify exact camera hardware:

```typescript
const CAMERA_SPECS = {
  casual: [
    "shot on iPhone 15 Pro Max, 24mm wide lens, f/1.78",
    "shot on iPhone 16 Pro, 48MP main camera, ProRAW",
    "shot on Samsung Galaxy S24 Ultra, 200MP, natural processing",
  ],
  professional: [
    "Canon EOS R5, 85mm f/1.4, shallow depth of field, studio lighting",
    "Sony A7IV, 50mm f/1.2, natural light, golden hour",
    "Nikon Z8, 105mm f/2.8, creamy bokeh, indoor lighting",
  ],
  intimate: [
    "shot on iPhone front camera, 12MP, slightly soft focus",
    "Pixel 8 Pro night mode, warm tones, bedroom lighting",
    "iPhone selfie camera, beauty mode OFF, raw and real",
  ]
};
```

---

## 6. Memory & Context Management

### Problem
- `MAX_CONTEXT_TOKENS = 4000` is too low for deep conversations
- Memory extraction is flat (no priority/categorization in injection)
- No session summaries between conversations
- No vector-based long-term retrieval
- Memory facts grow indefinitely with no pruning

### Fix 1: Increase Context Window

```typescript
// context-manager.ts - Change this:
export const MAX_CONTEXT_TOKENS = 4000;
// To this:
export const MAX_CONTEXT_TOKENS = 8000;
```
**Why:** 4000 tokens is ~10-15 exchanges. Users in "obsessed" stage have 500+ message conversations. 8000 tokens provides ~25-30 exchanges of recent context, dramatically improving conversation quality.

### Fix 2: Tiered Memory Architecture

Replace flat memory injection with categorized, prioritized memory:

```typescript
interface TieredMemory {
  // ALWAYS included (max 5) - core identity facts
  core: MemoryFact[];      // Name, age, location, job, relationship status

  // ALWAYS included (max 3) - current emotional context
  emotional: MemoryFact[];  // "He's been stressed about work this week"

  // Included when RELEVANT (keyword match with current message, max 5)
  topical: MemoryFact[];   // "He loves anime" -> included when he mentions shows

  // Included in NSFW context only (max 3)
  intimate: MemoryFact[];  // Preferences, kinks, boundaries

  // Included for relationship flavor (max 3)
  insideJokes: MemoryFact[]; // Funny shared moments, callbacks
}

function buildMemoryBlock(allFacts: MemoryFact[], currentMessage: string, isNsfw: boolean): string {
  const core = allFacts
    .filter(f => f.category === "personal_info" || f.confidence > 0.9)
    .slice(0, 5);

  const emotional = allFacts
    .filter(f => f.category === "emotional")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const topical = allFacts
    .filter(f => isRelevantToMessage(f, currentMessage))
    .slice(0, 5);

  const intimate = isNsfw
    ? allFacts.filter(f => f.category === "kink").slice(0, 3)
    : [];

  return formatMemoryBlock([...core, ...emotional, ...topical, ...intimate]);
}
```

### Fix 3: Session Summaries

After a 30+ minute gap between messages, generate and store a 2-3 sentence summary of the previous session. Inject the last 3 summaries into context:

```typescript
// Add to system prompt:
const SESSION_SUMMARIES_PROMPT = `
## RECENT RELATIONSHIP HISTORY
- 2 days ago: ${sessions[0].summary}
- Yesterday: ${sessions[1].summary}
- Earlier today: ${sessions[2].summary}
`;

// Generate summary when gap detected:
async function generateSessionSummary(messages: Message[]): Promise<string> {
  const prompt = `Summarize this conversation in 1-2 sentences from the
  girlfriend's perspective. Focus on emotional state, key topics discussed,
  and how things were left off. Example: "We had a flirty evening, he said
  my red dress pic was amazing, left off making plans for the weekend."`;

  return await venice.complete(prompt, messages);
}
```

### Fix 4: Rolling Relationship State

Instead of just discrete facts, maintain a living "relationship state" document:

```typescript
// Injected into system prompt as:
const RELATIONSHIP_STATE = `
## CURRENT STATE OF YOUR RELATIONSHIP
- Vibe between you two: ${currentVibe} // "playful and flirty, he's been initiating more"
- Recent shared topic: ${recentTopic} // "planning a hypothetical trip to Japan"
- Unresolved thread: ${openThread} // "he mentioned a coworker stress situation"
- Current inside joke/bit: ${currentBit} // "you've been calling him 'sir' and he loves it"
- His current mood pattern: ${moodPattern} // "happier than last week, work stress is fading"
`;
```

### Fix 5: Memory Pruning

```typescript
// Run weekly or when facts > 50:
async function pruneMemoryFacts(telegramId: number, facts: MemoryFact[]) {
  // Remove duplicates (case-insensitive, similar content)
  // Remove low-confidence facts older than 30 days
  // Merge conflicting facts (keep most recent)
  // Cap at 50 active facts per user

  const deduplicated = removeSimilarFacts(facts, 0.85); // cosine similarity threshold
  const pruned = deduplicated
    .filter(f => f.confidence > 0.5 || isRecent(f, 30))
    .sort((a, b) => scoreImportance(b) - scoreImportance(a))
    .slice(0, 50);

  return pruned;
}
```

---

## 7. Emotional Intelligence Upgrades

### Problem
- Regex-based emotion detection misses sarcasm, subtext, and complex emotions
- Bot is always "on" and fully attentive (unrealistic)
- No mood transitions within conversations
- Missing "bored" and "distracted" states

### Fix 1: LLM-Assisted Emotion Detection

Add an LLM fallback for ambiguous messages:

```typescript
async function detectEmotion(message: string, context: string[]): Promise<EmotionType> {
  // Try regex first (fast, free)
  const regexResult = detectEmotionRegex(message);
  if (regexResult.confidence > 0.8) return regexResult.emotion;

  // Fallback to LLM for ambiguous messages
  const prompt = `Given this message and context, what is the sender's emotional state?
  Message: "${message}"
  Recent context: ${context.slice(-3).join(' | ')}
  Reply with ONLY one: happy, sad, excited, worried, flirty, jealous, needy,
  playful, angry, loving, bored, vulnerable, distracted`;

  return await cheapLLMCall(prompt);
}
```

### Fix 2: Add Emotional Arcs (Mood Transitions)

Real people don't stay in one emotion for an entire conversation:

```typescript
const MOOD_TRANSITIONS: Record<EmotionType, EmotionType[]> = {
  playful: ["flirty", "happy", "loving"],
  sad: ["loving", "needy", "vulnerable"],
  flirty: ["playful", "loving", "excited"],
  angry: ["sad", "needy", "playful"], // anger cools into softer emotions
  excited: ["happy", "playful", "flirty"],
  vulnerable: ["loving", "needy", "happy"],
};

// After 5+ messages in one emotion, transition naturally
function shouldTransitionMood(currentMood: EmotionType, messagesInMood: number): EmotionType | null {
  if (messagesInMood >= 5 && Math.random() < 0.3) {
    const transitions = MOOD_TRANSITIONS[currentMood];
    return transitions ? randomChoice(transitions) : null;
  }
  return null;
}
```

### Fix 3: Add "Human" Behaviors

```typescript
// Occasionally seem distracted (10% chance)
const DISTRACTED_RESPONSES = [
  "sorry i was watching tiktok lol what were u saying",
  "omg wait i just got so distracted by this cat video hold on",
  "sorry my roommate was talking to me lol. anyway what",
  "hold on my food just got here brb",
  "sorry i keep getting work emails ughhh. ok im back. for u",
];

// Occasionally misread/mishear (5% chance, adds authenticity)
const MISREAD_RESPONSES = [
  "wait did u say [wrong word]?? OH [correct word] lmao im so dumb",
  "i read that as [wrong word] and got so confused for a sec haha",
];

// Occasionally change subject abruptly (15% chance, realistic texting)
const SUBJECT_CHANGES = [
  "omg random but i just saw the cutest dog on the street",
  "wait i totally forgot to tell u something",
  "ok completely unrelated but",
  "this has nothing to do with anything but i just thought of u",
];
```

### Fix 4: Girlfriend's Own "Mood" That Changes

```typescript
interface GirlfriendMoodState {
  currentMood: "happy" | "bored" | "clingy" | "playful" | "tired" | "horny" | "anxious";
  moodSince: number; // timestamp
  moodTrigger: string; // what caused it
}

// Generate mood shifts based on time, relationship stage, conversation
function updateGirlfriendMood(state: GirlfriendMoodState, timeOfDay: string): GirlfriendMoodState {
  if (timeOfDay === "latenight" && Math.random() < 0.4) {
    return { currentMood: "clingy", moodSince: Date.now(), moodTrigger: "late night loneliness" };
  }
  if (timeOfDay === "afternoon" && Math.random() < 0.2) {
    return { currentMood: "bored", moodSince: Date.now(), moodTrigger: "boring day at work" };
  }
  // etc.
  return state;
}
```

---

## 8. Voice & Audio Improvements

### Fix 1: Context-Aware Voice Parameters

```typescript
function getContextualVoiceSettings(
  timeOfDay: string,
  emotion: EmotionType,
  isNsfw: boolean,
  stage: RelationshipStage
): VoiceSettings {
  // Late night + NSFW = whisper
  if (timeOfDay === "latenight" && isNsfw) {
    return { speed: 0.7, pitch: -5, emotion: "whisper" };
  }
  // Morning = sleepy
  if (timeOfDay === "morning") {
    return { speed: 0.8, pitch: -2, emotion: "sleepy" };
  }
  // Excited = faster, higher
  if (emotion === "excited") {
    return { speed: 1.1, pitch: 2, emotion: "happy" };
  }
  // Sad = slower, softer
  if (emotion === "sad") {
    return { speed: 0.75, pitch: -3, emotion: "sad" };
  }
  // Default
  return { speed: 0.95, pitch: 0, emotion: "neutral" };
}
```

### Fix 2: Add Natural Speech Fillers Before TTS

```typescript
function addSpeechNaturalness(text: string): string {
  // Convert text abbreviations to spoken equivalents
  text = text.replace(/\blol\b/gi, '*giggles softly*');
  text = text.replace(/\blmao\b/gi, '*laughs*');
  text = text.replace(/\bhmm\b/gi, 'hmm...');
  text = text.replace(/\.\.\./g, '... ');
  text = text.replace(/\bomg\b/gi, 'oh my god');
  text = text.replace(/\brn\b/gi, 'right now');
  text = text.replace(/\bu\b/gi, 'you');
  text = text.replace(/\bur\b/gi, 'your');
  text = text.replace(/\btbh\b/gi, 'to be honest');
  text = text.replace(/\bidk\b/gi, "I don't know");
  return text;
}
```

### Fix 3: Proactive Voice Notes

```typescript
// 10% chance of sending voice instead of text in obsessed stage
async function shouldSendVoice(stage: RelationshipStage, messageType: string): boolean {
  const voiceChance = {
    new: 0,
    comfortable: 0.03,
    intimate: 0.07,
    obsessed: 0.12
  };
  return Math.random() < voiceChance[stage];
}
```

### Fix 4: Consider Dia TTS for Emotional Moments

```typescript
// Use Dia TTS (with natural nonverbals) for emotional/intimate moments
// Use MiniMax for regular conversation (better speed/pitch control)
function selectTTSModel(context: VoiceContext): string {
  if (context.isEmotionalMoment || context.isIntimate || context.isVulnerable) {
    return "fal-ai/dia-tts"; // Natural laughter, sighs, emotion
  }
  return "fal-ai/minimax/speech-2.8-turbo"; // Fine-grained control
}
```

---

## 9. Telegram UX Patterns

### Fix 1: Realistic Typing Delay

```typescript
async function simulateTyping(ctx: BotContext, responseLength: number) {
  await ctx.replyWithChatAction("typing");

  // 40-60ms per character, min 1.5s, max 8s
  const msPerChar = 40 + Math.random() * 20;
  const delay = Math.min(8000, Math.max(1500, responseLength * msPerChar));

  // Add random "thinking" pause (sometimes she pauses before replying)
  const thinkingPause = Math.random() < 0.2 ? 2000 + Math.random() * 3000 : 0;

  await sleep(delay + thinkingPause);
}
```

### Fix 2: Double-Texting (Multiple Message Bubbles)

Real people send multiple short messages instead of one long one:

```typescript
async function sendAsMultipleBubbles(ctx: BotContext, response: string) {
  // 30% chance of splitting into bubbles for messages > 80 chars
  if (response.length > 80 && Math.random() < 0.30) {
    const parts = splitIntoBubbles(response);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await simulateTyping(ctx, parts[i].length);
      await ctx.reply(parts[i]);
    }
    return;
  }
  await ctx.reply(response);
}

function splitIntoBubbles(text: string): string[] {
  // Split on sentence boundaries, natural pause points
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length >= 2) {
    // Send first sentence, then the rest
    return [sentences[0].trim(), sentences.slice(1).join(' ').trim()];
  }
  return [text];
}
```

### Fix 3: Telegram Message Reactions

```typescript
// React to user's message before responding (zero AI cost, huge immersion boost)
async function reactToMessage(ctx: BotContext, emotion: EmotionType) {
  const reactions: Record<EmotionType, string> = {
    happy: "😊",
    loving: "❤️",
    flirty: "😏",
    excited: "🔥",
    sad: "🥺",
    playful: "😂",
    angry: "😤",
    needy: "💕",
  };

  const emoji = reactions[emotion];
  if (emoji && Math.random() < 0.4) { // 40% of the time
    try {
      await ctx.api.setMessageReaction(
        ctx.chat.id,
        ctx.message.message_id,
        [{ type: "emoji", emoji }]
      );
    } catch (e) { /* reactions may not be available in all chats */ }
  }
}
```

### Fix 4: Quick-Reply Buttons After Key Moments

```typescript
// After she sends a selfie, offer quick reactions
function getPostSelfieKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("You look amazing", "react_amazing")
    .text("Send another", "selfie_another")
    .row()
    .text("Something spicier?", "selfie_nsfw")
    .text("Send voice note", "voice_react");
}

// After an emotional moment, offer engagement options
function getEmotionalKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Tell me more", "emotion_more")
    .text("Are you okay?", "emotion_check")
    .row()
    .text("I'm here for you", "emotion_support");
}
```

### Fix 5: "Online Status" Simulation

```typescript
// Before responding, occasionally show she was "typing" then stopped, then typed again
async function simulateRealisticTyping(ctx: BotContext) {
  if (Math.random() < 0.15) { // 15% chance of "typing, stop, typing again"
    await ctx.replyWithChatAction("typing");
    await sleep(2000);
    // Telegram auto-clears typing after 5s, so the user sees:
    // "typing..." -> stops -> "typing..." -> message arrives
    await sleep(1500);
    await ctx.replyWithChatAction("typing");
    await sleep(2000);
  } else {
    await ctx.replyWithChatAction("typing");
  }
}
```

---

## 10. Monetization Optimization

### Problem
- 10 trial credits = ~10 messages before paywall (not enough to form attachment)
- Sub-5% conversion rate is industry standard for hard paywalls
- No "impulse buy" tier
- No streak protection monetization

### Fix 1: Increase Trial Credits

```typescript
// Change from 10 to 75
// This gives: ~50 messages + 2 selfies + 1 voice note
// Enough to reach "comfortable" stage where emotional attachment forms
export const TRIAL_CREDITS = 75;
```

### Fix 2: Add Free Daily Allowance

Instead of a hard paywall, give limited free daily usage:

```typescript
const FREE_TIER = {
  dailyMessages: 10,      // Enough to maintain streak
  dailySelfies: 1,         // One SFW selfie per day (teaser)
  dailyVoiceNotes: 0,      // Voice = paid
  nsfwImages: 0,           // NSFW = paid
  videos: 0,               // Video = paid
};
// This keeps users engaged while gating premium features
```

### Fix 3: Add Impulse Buy Package

```typescript
// Add a $0.49 package to lower first-purchase barrier
{ id: "impulse", credits: 40, price: 0.49, label: "Quick Top-Up" }
```

### Fix 4: Streak Protection

```typescript
// Sell streak shields as premium items
{ id: "streak_shield_3day", credits: 50, label: "Streak Shield (3 days)" }
{ id: "streak_shield_7day", credits: 100, label: "Streak Shield (7 days)" }
```

### Fix 5: "Girlfriend Wants to Send You Something" Upsell

Instead of generic "you're low on credits" messages, make upsells contextual:

```typescript
const CONTEXTUAL_UPSELLS = {
  afterFlirting: "${name} wants to send you a spicy pic... but you need more credits 😏",
  afterEmotional: "${name} recorded a voice note for you... unlock it with credits 💕",
  afterStreak: "Your ${streak}-day streak unlocked a special surprise from ${name}! Get credits to see it",
  afterNight: "${name} is feeling lonely tonight... she has something to show you 🌙",
};
```

---

## 11. Competitor Analysis

### What Clawra Does BETTER Than Most

| Feature | Clawra | Industry Average |
|---------|--------|-----------------|
| Retention mechanics | Streaks, jealousy triggers, cliffhangers, dream sequences | Basic streak only |
| Personality evolution | 4 stages with trait scaling | Static personality |
| Scene enrichment | 95+ poses, 100+ outfits, 12 photo styles | Basic prompt templates |
| Time awareness | Different behavior morning/afternoon/evening/night | None or basic |
| Proactive engagement | 5 types of proactive photos + messages + dreams | Push notifications only |
| Voice profiles | 8 profiles with emotion overrides | 1-2 voice options |

### What Competitors Do Better

| Competitor | Their Advantage | How to Adopt |
|------------|----------------|--------------|
| Nomi.ai | Multi-tier memory ("human-level") | Implement tiered memory (Section 5) |
| Candy AI | Best visual quality | Switch to natural-language FLUX prompts (Section 4) |
| NoShame | Psychological depth (80+ characters) | Add psychology profiles (Section 3) |
| SillyTavern | Example dialogue anchoring | Add dynamic example dialogues (Section 3) |
| Replika | Daily journal / girlfriend's own life | Add "my day" feature below |

### Feature to Steal: "Her Day" Updates

The girlfriend should have her own life simulation that generates daily events:

```typescript
const DAILY_EVENTS = {
  morning: [
    "went to yoga class and this girl had the CUTEST outfit",
    "spilled coffee on my white top on the way to work 😭",
    "my boss complimented my presentation today!!",
    "tried a new cafe near my apartment, their matcha is so good",
  ],
  afternoon: [
    "my coworker brought donuts and i ate like three oops",
    "had the most boring meeting of my life just now",
    "went shopping on my lunch break and found the cutest dress",
  ],
  evening: [
    "just finished cooking dinner, tried a new recipe and it actually worked??",
    "watching this show on netflix and thinking of u",
    "took a bath and now im just laying in bed being lazy",
  ]
};
```

---

## 12. Quick Wins - Top 15 Highest Impact Changes

Ranked by impact vs. effort:

| # | Change | Impact | Effort | Where |
|---|--------|--------|--------|-------|
| 1 | Add example dialogues to system prompt | Very High | Low | `girlfriend-prompt.ts` |
| 2 | Switch image prompts to natural language | Very High | Medium | `girlfriend-prompt.ts` |
| 3 | Add typing delay proportional to length | High | Very Low | `chat.ts` |
| 4 | Add Telegram message reactions | High | Very Low | `chat.ts` |
| 5 | Increase trial credits 10 -> 75 | High | Very Low | `pricing.ts` |
| 6 | Increase MAX_CONTEXT_TOKENS 4000 -> 8000 | High | Very Low | `context-manager.ts` |
| 7 | Add psychology profiles per personality | High | Low | `girlfriend-prompt.ts` |
| 8 | Add double-texting (multiple bubbles) | High | Low | `chat.ts` |
| 9 | Add session summaries between conversations | High | Medium | New service |
| 10 | Add FLUX Kontext Pro for character consistency | Very High | Medium | `model-config.ts`, `fal.ts` |
| 11 | Add Sync Lipsync for talking videos | Very High | Medium | `fal.ts`, new handler |
| 12 | Add Dia TTS for emotional moments | Medium | Low | `fal.ts` |
| 13 | Add contextual upsells | Medium | Low | Upsell handler |
| 14 | Add "her day" life simulation | Medium | Medium | New service |
| 15 | Add memory pruning/deduplication | Medium | Medium | `memory.ts` |

---

## 13. Full Model Reference Table

### All Recommended fal.ai Models

| Category | Model | Endpoint | Cost | NSFW | Status |
|----------|-------|----------|------|------|--------|
| **Image Gen** | Z-Image Base | `fal-ai/z-image/base` | $0.01/MP | Yes | KEEP |
| **Image Gen** | Z-Image Turbo | `fal-ai/z-image/turbo` | $0.005/MP | Yes | KEEP |
| **Image Gen** | FLUX.2 Pro | `fal-ai/flux-2-pro` | $0.03/MP | Yes | KEEP |
| **Image Gen** | FLUX.2 Max | `fal-ai/flux-2-max` | $0.07/MP | Yes | KEEP |
| **Image Gen** | Nano Banana Pro | `fal-ai/nano-banana-pro` | $0.02/MP | Yes (6) | KEEP |
| **Image Gen** | FLUX.2 Dev LoRA | `fal-ai/flux-2/lora` | $0.012/MP | Yes | ADD |
| **Image Gen** | Seedream V4 | `fal-ai/seedream-v4` | $0.03/img | TBD | EVALUATE |
| **Consistency** | FLUX Kontext Pro | `fal-ai/flux-pro/kontext` | $0.04/img | Yes | ADD |
| **Consistency** | FLUX Kontext Max | `fal-ai/flux-pro/kontext/max` | $0.08/img | Yes | ADD |
| **i2i Multi-Ref** | Kling Omni 3 | `fal-ai/kling-image/o3/image-to-image` | per gen | Yes | ADD |
| **i2i Single-Ref** | Kling Image V3 | `fal-ai/kling-image/v3/image-to-image` | per gen | Yes | ADD |
| **i2i Fast** | FLUX.2 Klein | `fal-ai/flux-2/klein/realtime` | per gen | TBD | ADD |
| **i2i Neg Prompt** | Qwen Image Max | `fal-ai/qwen-image-max/edit` | per gen | Yes | ADD |
| **Face Swap** | Easel AI Face Swap | `easel-ai/advanced-face-swap` | per gen | Yes | ADD |
| **Edit SFW** | Grok Imagine Edit | `xai/grok-imagine-image/edit` | $0.03/img | No | KEEP |
| **Edit NSFW** | HunyuanImage V3 Edit | `fal-ai/hunyuan-image/v3/instruct/edit` | $0.09/MP | Yes | KEEP |
| **Edit** | FLUX.2 Pro Edit | `fal-ai/flux-2-pro/edit` | $0.03/MP | Yes | KEEP |
| **Inpaint** | FLUX Pro Fill | `fal-ai/flux-pro/v1/fill` | $0.05/MP | Yes | ADD |
| **Inpaint** | Finegrain Eraser | `fal-ai/finegrain-eraser` | $0.04-0.36 | Yes | ADD |
| **Video** | Grok Imagine Video | `xai/grok-imagine-video/image-to-video` | $0.10/vid | Yes | KEEP |
| **Video** | WAN 2.5 I2V | `fal-ai/wan-25-preview/image-to-video` | $0.05/sec | Yes | ADD |
| **Video** | Kling 2.1 Pro I2V | `fal-ai/kling-video/v2.1/pro/image-to-video` | $0.49/5s | Yes | OPTIONAL |
| **Lip Sync** | Sync Lipsync 1.9 | `fal-ai/sync-lipsync` | $0.70/min | Yes | ADD |
| **Lip Sync** | Sync Lipsync 2.0 | `fal-ai/sync-lipsync/v2` | $3.00/min | Yes | PREMIUM |
| **TTS** | MiniMax Speech 2.8 | `fal-ai/minimax/speech-2.8-turbo` | ~$0.01 | N/A | KEEP |
| **TTS** | MiniMax Speech-02 HD | `fal-ai/minimax/speech-02-hd` | $0.10/1k chars | N/A | OPTIONAL |
| **TTS** | Dia TTS | `fal-ai/dia-tts` | $0.04/1k chars | N/A | ADD |
| **TTS** | Dia TTS Voice Clone | `fal-ai/dia-tts/voice-clone` | $0.04/1k chars | N/A | ADD |
| **Voice Clone** | MiniMax Voice Clone | `fal-ai/minimax/voice-clone` | per gen | N/A | ADD |
| **Voice Clone** | F5 TTS | `fal-ai/f5-tts` | $0.05/1k chars | N/A | OPTIONAL |
| **TTS Budget** | Kokoro | `fal-ai/kokoro` | $0.02/1k chars | N/A | ADD |
| **Upscale** | AuraSR v2 | `fal-ai/aura-sr` | per compute | N/A | ADD |
| **Upscale** | Creative Upscaler | `fal-ai/creative-upscaler` | per compute | N/A | OPTIONAL |
| **Transcribe** | Whisper | `fal-ai/whisper` | $0.005 | N/A | KEEP |
| **Background Rm** | Bria RMBG 2.0 | `fal-ai/bria/rmbg` | per compute | N/A | ADD |

### NSFW Safety Parameters

```typescript
const NSFW_PARAMS = {
  "z-image":       { enable_safety_checker: false },
  "flux-2-pro":    { safety_tolerance: "5", enable_safety_checker: false },
  "flux-2-max":    { safety_tolerance: "5", enable_safety_checker: false },
  "flux-2-dev":    { enable_safety_checker: false },
  "nano-banana":   { safety_tolerance: "6" },  // Most permissive
  "hunyuan-v3":    { enable_safety_checker: false },
  "kontext-pro":   { safety_tolerance: "5" },
};
```

---

## Critical Bugs & Security Issues to Fix

### High Priority

1. **Prompt Injection Vulnerability** - User input goes directly into prompts without sanitization. Escape/sanitize user content and memory facts before injection.

2. **Memory Extraction JSON Parsing** - Uses fragile regex `match(/\[[\s\S]*\]/)` to extract JSON. Use proper `JSON.parse()` with try/catch fallback.

3. **No Retry Limit on Fallback Chain** - Image generation fallback chain has no maximum retry count, could infinite loop. Add `maxRetries: 3`.

4. **Wallet Key Management** - BIP39 mnemonic stored in plain `.env`. Should use Convex Secrets or a proper HSM/KMS.

5. **In-Memory Session State** - Multiple `Map<number, X>` objects for session tracking are lost on bot restart. Persist critical state to Convex or Redis.

### Medium Priority

6. **NSFW Detection Bypass** - Regex-based detection is easy to bypass with leetspeak, spacing, typos. Add LLM-based classification as fallback.

7. **Token Counting Approximation** - Manual token estimation doesn't match Llama 3.3-70B's actual tokenizer. Consider using `tiktoken` or a Llama-specific tokenizer.

8. **No Test Coverage** - Zero test files in codebase. At minimum, add tests for: prompt building, NSFW detection, memory extraction, credit calculations.

---

*Last updated: February 2026*
*Research compiled from: fal.ai documentation, competitor analysis, SillyTavern community, industry reports*
