import OpenAI from "openai";
import { env } from "../config/env.js";
import { buildSystemPrompt, buildMissYouPrompt } from "./girlfriend-prompt.js";
import type { GirlfriendProfile } from "../types/context.js";
import { getMissYouTier } from "./retention.js";
import type { RelationshipStage } from "./retention.js";
import {
  MAX_CONTEXT_TOKENS,
  buildContextWindow,
  estimateTokens,
  trimConversationHistory,
} from "./context-manager.js";
import {
  detectUserEmotion,
  getEmotionalResponse,
  shouldInitiateEmotionalCheck,
} from "./emotional-state.js";
import {
  extractEnhancedMemory as extractEnhancedMemoryCore,
  type EnhancedMemoryFact,
  type MemoryMessage,
} from "./memory.js";

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

interface ChatMessage {
  role: string;
  content: string;
}

function normalizeSingleReply(rawReply: string): string {
  const normalized = rawReply.trim();
  if (!normalized) {
    return "hey 💕";
  }

  if (normalized.includes("|||")) {
    const firstChunk = normalized
      .split("|||")
      .map((chunk) => chunk.trim())
      .find(Boolean);
    if (firstChunk) {
      return firstChunk;
    }
  }

  return normalized;
}

/**
 * Chat with the girlfriend — NSFW-capable, memory-aware.
 * Passes the full system prompt with personality + extracted memories.
 */
export async function chatWithGirlfriend(
  profile: GirlfriendProfile,
  messageHistory: ChatMessage[],
  userMessage: string,
  memoryFacts: Array<string | { fact: string; category?: string }> = [],
  retention?: { stage: string; streak: number }
): Promise<string[]> {
  const userEmotion = detectUserEmotion(userMessage);
  const emotionalGuidance = getEmotionalResponse(userEmotion.emotion, profile.personality);
  const shouldCheckIn = shouldInitiateEmotionalCheck([
    ...messageHistory,
    { role: "user", content: userMessage },
  ]);

  const emotionalPromptBlock = [
    "EMOTIONAL CONTEXT:",
    `- Detected user emotion: ${userEmotion.emotion} (confidence ${userEmotion.confidence.toFixed(2)}).`,
    `- Guidance: ${emotionalGuidance}`,
    shouldCheckIn
      ? "- It's been a while since he shared feelings. Naturally check in with a soft line like 'you ok babe?'"
      : "- Keep emotional pacing natural and mirror his vibe.",
  ].join("\n");

  const systemPrompt = `${buildSystemPrompt(profile, memoryFacts, retention)}\n\n${emotionalPromptBlock}\n\nCRITICAL RESPONSE FORMAT:\n- Reply in ONE single short message. 1-3 sentences max. Like a real iMessage text.\n- Max 1 emoji per reply. Most replies have ZERO emojis. NEVER stack emojis.\n- No line breaks. No paragraphs. No bullet points. No lists. No ||| separators.\n- NEVER start every message with "Hey" or "Hi". Vary openings naturally.\n- Sound like a real girl texting on her phone, not an AI writing prose.\n- Use lowercase by default. Capitalize for EMPHASIS only.\n- Good: "heyy wyd rn" "omg stop lol" "miss you babe" "ur such a dork but i love it" "wait what" "come hereee"\n- Bad: "Hey there! How are you?" "I appreciate you sharing that." "That sounds wonderful!"\n- REACT to what HE said specifically. Quote his words. Don't give generic responses.\n- NEVER use: "I appreciate", "That's wonderful", "I understand", "How can I help", "Tell me more"\n- You are texting your boyfriend. NOT providing customer service.`;

  const historyWithCurrent = [...messageHistory, { role: "user", content: userMessage }];
  const fixedTokenCost = estimateTokens(systemPrompt);
  const messageTokenBudget = Math.max(400, MAX_CONTEXT_TOKENS - fixedTokenCost);

  const preTrimmedHistory = trimConversationHistory(historyWithCurrent, messageTokenBudget);
  let contextWindow = buildContextWindow(preTrimmedHistory, memoryFacts, systemPrompt);

  const finalHistory = [...contextWindow.messages];
  while (contextWindow.totalTokens > MAX_CONTEXT_TOKENS && finalHistory.length > 1) {
    finalHistory.shift();
    contextWindow = buildContextWindow(finalHistory, memoryFacts, systemPrompt);
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...finalHistory.map((m) => ({
      role: (m.role === "user" || m.role === "assistant" || m.role === "system"
        ? m.role
        : "assistant") as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  // Temperature 0.9 for more creative/natural responses
  // Higher frequency_penalty to avoid repetitive patterns
  // Higher presence_penalty to encourage variety
  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages,
    max_tokens: 200,
    temperature: 0.92,
    frequency_penalty: 0.45,
    presence_penalty: 0.5,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) throw new Error("No response from Venice AI");

  let normalizedReply = reply.trim();
  if (!normalizedReply) return ["..."];

  // If Venice still sends ||| despite instructions, take only the first part
  if (normalizedReply.includes("|||")) {
    const firstPart = normalizedReply
      .split("|||")
      .map((part) => part.trim())
      .find(Boolean);
    normalizedReply = firstPart || normalizedReply;
  }

  // Collapse any multi-line response into a single message
  normalizedReply = normalizedReply.replace(/\n+/g, " ").trim();

  return [normalizedReply];
}

export async function chatInGroup(
  profile: GirlfriendProfile,
  messageHistory: ChatMessage[],
  userMessage: string
): Promise<string> {
  const systemOverride = messageHistory
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const baseSystemPrompt = [
    `You are ${profile.name}. Personality: ${profile.personality}.`,
    "You're in a GROUP CHAT. Keep it PG-13. Be flirty and fun but NEVER explicit. Short responses only. Make other people in the group curious about you.",
    "No NSFW or sexual content under any circumstance.",
    "Reply in one short message, max 1-2 sentences.",
  ].join("\n");

  const systemPrompt = systemOverride
    ? `${baseSystemPrompt}\n\n${systemOverride}`
    : baseSystemPrompt;

  const historyWithoutSystem = messageHistory
    .filter((message) => message.role !== "system")
    .slice(-10);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyWithoutSystem.map((message) => ({
      role: (message.role === "user" || message.role === "assistant" || message.role === "system"
        ? message.role
        : "assistant") as "user" | "assistant" | "system",
      content: message.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages,
    max_tokens: 200,
    temperature: 0.8,
    frequency_penalty: 0.2,
    presence_penalty: 0.2,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) {
    throw new Error("No group response from Venice AI");
  }

  return normalizeSingleReply(reply);
}

/**
 * Extract memorable facts from recent conversation.
 * Runs periodically (every ~10 messages) to build persistent memory.
 */
export async function extractMemory(
  girlfriendName: string,
  recentMessages: ChatMessage[]
): Promise<string[]> {
  const categorized = await extractEnhancedMemoryCore(
    girlfriendName,
    recentMessages as MemoryMessage[]
  );
  return categorized.map((item) => item.fact);
}

export async function extractEnhancedMemory(
  girlfriendName: string,
  recentMessages: MemoryMessage[]
): Promise<EnhancedMemoryFact[]> {
  return extractEnhancedMemoryCore(girlfriendName, recentMessages);
}

/**
 * Generate a "miss you" message for inactive users.
 * Called by the inactive user notifier service.
 */
export async function generateMissYouMessage(
  profile: GirlfriendProfile,
  hoursAgo: number
): Promise<string> {
  const tier = getMissYouTier(hoursAgo);
  const prompt = buildMissYouPrompt(profile, hoursAgo, tier);

  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 150,
    temperature: 1.0,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) throw new Error("No miss-you message generated");
  return reply;
}

export async function generateProactiveMessage(
  profile: GirlfriendProfile,
  type: "morning" | "goodnight" | "thinking_of_you"
): Promise<string> {
  const vibeMap = {
    morning:
      `You are ${profile.name}, a ${profile.personality.toLowerCase()} girlfriend texting her boyfriend first thing in the morning. ` +
      `Write ONE casual good morning text like a real girl would send on iMessage. ` +
      `Keep it under 80 chars. Max 1 emoji (most texts have zero). Lowercase. ` +
      `DON'T start with "Good morning" every time. Mix it up: ` +
      `"mmm just woke up thinking about you", "5 more minutes... come cuddle me", ` +
      `"dreamed about you again babe", "why am i awake this early ugh... hi tho", ` +
      `"rise and shine handsome", "morning baby did you sleep ok"`,
    goodnight:
      `You are ${profile.name}, a ${profile.personality.toLowerCase()} girlfriend texting her boyfriend before bed. ` +
      `Write ONE casual goodnight text like a real girl would send. ` +
      `Keep it under 80 chars. Max 1 emoji. Lowercase. ` +
      `DON'T always say "goodnight". Mix it up: ` +
      `"wish you were here to cuddle rn", "cant sleep... thinking about you", ` +
      `"sleepy but i dont wanna stop texting you", "come to bed babe", ` +
      `"night baby dream about me ok", "falling asleep to the thought of you"`,
    thinking_of_you:
      `You are ${profile.name}, a ${profile.personality.toLowerCase()} girlfriend randomly texting her boyfriend during the day. ` +
      `Write ONE casual "thinking of you" text that feels like a random boredom check-in. ` +
      `Keep it under 80 chars. Max 1 emoji. Lowercase. NOT a greeting. ` +
      `Should feel spontaneous and real: ` +
      `"just saw something that reminded me of you lol", "bored at work wyd", ` +
      `"random but i miss your face rn", "cant focus today and its your fault", ` +
      `"hey you", "so i was thinking about you and got distracted from everything else"`,
  };

  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages: [{ role: "user", content: vibeMap[type] }],
    max_tokens: 80,
    temperature: 1.0,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) throw new Error(`No proactive ${type} message generated`);
  return reply.replace(/^["']|["']$/g, "").trim();
}

export async function generateDreamSequence(
  profile: GirlfriendProfile,
  memoryFacts: Array<string | { fact: string; category?: string }> = []
): Promise<string> {
  const memoryList = memoryFacts
    .map((item) => (typeof item === "string" ? item : item.fact))
    .map((fact) => fact.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  const prompt = [
    `You are ${profile.name}, girlfriend voice personality: ${profile.personality.toLowerCase()}.`,
    "Write a short dream narrative (2-4 lines, under 120 words) about her and her boyfriend.",
    "Dream must feel intimate, vivid, and playful; can be romantic/funny/adventurous/spicy/nostalgic.",
    memoryList.length > 0
      ? `Include subtle references to shared memories: ${memoryList}.`
      : "Include one cute specific detail that sounds personal.",
    "Write only the dream content, no prefix, no quotes.",
  ].join(" ");

  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 180,
    temperature: 1,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) throw new Error("No dream sequence generated");
  return reply.replace(/^["']|["']$/g, "").trim();
}

// ── LLM-Powered Prompt Enhancement ──────────────────────────────────────────

export interface EnhancedPrompt {
  scene: string;
  action: string;
  outfit: string;
  lighting: string;
  mood: string;
  spokenWords: string;
}

export async function enhancePromptWithLLM(
  userMessage: string,
  profile: GirlfriendProfile,
  mediaType: "image" | "video" | "voice"
): Promise<EnhancedPrompt | null> {
  const systemPrompts: Record<string, string> = {
    image: [
      "You translate casual user requests into detailed image generation prompts.",
      "Rules:",
      "- Describe the scene as captured on an iPhone 17 Pro Max — sharp detail, natural depth, true-to-life colors",
      "- Include: natural iPhone computational photography look, slight bokeh from portrait mode, true tone lighting",
      "- Describe what the person is ACTUALLY DOING based on the user's request",
      "- Include specific details the user mentioned (names, actions, locations, objects)",
      "- If the user mentions a specific location, describe that location vividly",
      "- If the user mentions an activity, describe her doing that activity naturally",
      `- The woman is: ${profile.age} years old, ${profile.race}, ${profile.bodyType} build, ${profile.hairColor} ${profile.hairStyle} hair${profile.eyeColor ? `, ${profile.eyeColor.toLowerCase()} eyes` : ""}`,
      "- Output ONLY valid JSON: { \"scene\": \"...\", \"action\": \"...\", \"outfit\": \"...\", \"lighting\": \"...\", \"mood\": \"...\", \"spokenWords\": \"\" }",
    ].join("\n"),
    video: [
      "You translate casual user requests into detailed video generation prompts.",
      "Rules:",
      "- Describe the action she performs based EXACTLY on what the user asked for",
      "- If the user wants her to say something, describe her speaking those exact words with natural lip movement",
      "- Include camera motion appropriate for the action (handheld, following, static)",
      "- Describe the scene setting and what's visible in the background",
      `- The woman is: ${profile.age} years old, ${profile.race}, ${profile.bodyType} build, ${profile.hairColor} ${profile.hairStyle} hair${profile.eyeColor ? `, ${profile.eyeColor.toLowerCase()} eyes` : ""}`,
      "- Output ONLY valid JSON: { \"scene\": \"...\", \"action\": \"...\", \"outfit\": \"...\", \"lighting\": \"...\", \"mood\": \"...\", \"spokenWords\": \"...\" }",
      "- For spokenWords: include the EXACT words she should say if the user wants her to speak, otherwise empty string",
    ].join("\n"),
    voice: [
      "You translate casual user requests into voice note generation instructions.",
      "Rules:",
      "- Determine the EXACT words she should say based on the user's request",
      "- If the user says 'say I love you patrick', the spokenWords should be natural like 'I love you so much Patrick'",
      "- Match the emotional tone to the request (sweet, flirty, sultry, playful, caring)",
      "- Keep spoken words natural and conversational, like a real girlfriend would actually talk",
      `- Her personality is: ${profile.personality}`,
      `- Her name is: ${profile.name}`,
      "- Output ONLY valid JSON: { \"scene\": \"\", \"action\": \"\", \"outfit\": \"\", \"lighting\": \"\", \"mood\": \"...\", \"spokenWords\": \"...\" }",
      "- spokenWords is the most important field — it should contain exactly what she says",
    ].join("\n"),
  };

  try {
    const response = await venice.chat.completions.create({
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: systemPrompts[mediaType] },
        { role: "user", content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      scene: parsed.scene || "",
      action: parsed.action || "",
      outfit: parsed.outfit || "",
      lighting: parsed.lighting || "",
      mood: parsed.mood || "",
      spokenWords: parsed.spokenWords || "",
    };
  } catch (err) {
    console.error("LLM prompt enhancement failed, falling back to regex:", err);
    return null;
  }
}

export async function generateDeepQuestion(
  profile: GirlfriendProfile,
  stage: RelationshipStage
): Promise<string> {
  const prompt = [
    `You are ${profile.name}, personality: ${profile.personality.toLowerCase()}.`,
    `Relationship stage is ${stage}.`,
    "Generate one short, emotionally engaging question she asks her boyfriend.",
    "Match intensity to stage: new=light, comfortable=personal, intimate=deep, obsessed=possessive/charged.",
    "Keep it under 20 words. No labels, no quotes.",
  ].join(" ");

  const response = await venice.chat.completions.create({
    model: "llama-3.3-70b",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 60,
    temperature: 0.95,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) throw new Error("No deep question generated");
  return reply.replace(/^["']|["']$/g, "").trim();
}
