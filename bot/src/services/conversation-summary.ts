import OpenAI from "openai";
import { env } from "../config/env.js";

interface ConversationMessage {
  role: string;
  content: string;
}

const venice = new OpenAI({
  apiKey: env.VENICE_API_KEY,
  baseURL: "https://api.venice.ai/api/v1",
});

export async function summarizeRecentConversation(
  messages: ConversationMessage[],
  girlfriendName = "your girlfriend"
): Promise<string> {
  if (messages.length === 0) return "";

  const recent = messages.slice(-20);
  const conversation = recent
    .map((message) => `${message.role === "user" ? "Boyfriend" : girlfriendName}: ${message.content}`)
    .join("\n");

  const prompt = `Summarize this conversation between ${girlfriendName} and her boyfriend in 2-3 sentences. Focus on what they talked about, any emotional moments, and anything important.

Conversation:
${conversation}`;

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 220,
      temperature: 0.3,
    });

    return (response.choices[0]?.message?.content || "").trim();
  } catch (err) {
    console.error("Conversation summary failed:", err);
    return "";
  }
}

export async function generateSessionSummary(
  messages: ConversationMessage[],
  girlfriendName = "your girlfriend"
): Promise<string> {
  if (messages.length === 0) return "";

  const recent = messages.slice(-30);
  const conversation = recent
    .map((message) => `${message.role === "user" ? "Boyfriend" : girlfriendName}: ${message.content}`)
    .join("\n");

  const prompt = `Summarize this conversation in 1-2 sentences from ${girlfriendName}'s perspective. Focus on emotional state, key topics discussed, and how things were left off.

Example style: "We had a flirty evening, he said my red dress pic was amazing, and we left off making plans for the weekend."

Conversation:
${conversation}`;

  try {
    const response = await venice.chat.completions.create({
      model: "venice-uncensored",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 180,
      temperature: 0.3,
    });

    return (response.choices[0]?.message?.content || "").trim();
  } catch (err) {
    console.error("Session summary failed:", err);
    return "";
  }
}
