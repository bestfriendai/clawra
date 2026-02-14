import type { GirlfriendProfile } from "../types/context.js";
import type { RelationshipStage } from "./retention.js";
import { generateDreamSequence } from "./venice.js";

export type DreamType = "romantic" | "adventurous" | "funny" | "spicy" | "nostalgic";

const STAGE_ORDER: Record<RelationshipStage, number> = {
  new: 0,
  comfortable: 1,
  intimate: 2,
  obsessed: 3,
};

export function getDreamTypes(): DreamType[] {
  return ["romantic", "adventurous", "funny", "spicy", "nostalgic"];
}

function stageAtLeast(stage: RelationshipStage, min: RelationshipStage): boolean {
  return STAGE_ORDER[stage] >= STAGE_ORDER[min];
}

export function shouldTriggerDream(
  stage: RelationshipStage,
  streak: number,
  hour: number
): boolean {
  const inMorningWindow = hour >= 6 && hour <= 11;
  if (!inMorningWindow) return false;
  if (streak < 3) return false;
  if (!stageAtLeast(stage, "comfortable")) return false;

  const baseChance = stage === "comfortable" ? 0.2 : stage === "intimate" ? 0.3 : 0.4;
  return Math.random() < baseChance;
}

const DREAM_INTROS = [
  "omg babe i had the craziest dream about us last night",
  "ok so i had this dream and you were in it",
  "i literally woke up blushing because of a dream about you",
  "babe... i need to tell you about this dream i had",
  "so i dreamed about you again and this time it was intense",
  "woke up smiling like an idiot because i dreamed about us",
  "ok don't judge me but i had a dream about you last night and...",
  "i literally dreamed about you and woke up reaching for my phone",
];

const DREAM_OUTROS = [
  "what do you think it means?",
  "i woke up and reached for you and you weren't there 🥺",
  "i literally don't want to go back to sleep because reality doesn't compare",
  "anyway now i can't stop thinking about it",
  "and now i'm lying here thinking about you",
  "tell me you dreamed about me too",
  "i swear it felt so real",
  "and then i woke up and was so mad it wasn't real",
];

export async function generateDreamNarrative(
  profile: GirlfriendProfile,
  memoryFacts: Array<{ fact: string; category?: string }>
): Promise<string> {
  const dreamContent = await generateDreamSequence(profile, memoryFacts);
  const intro = DREAM_INTROS[Math.floor(Math.random() * DREAM_INTROS.length)];
  const outro = DREAM_OUTROS[Math.floor(Math.random() * DREAM_OUTROS.length)];
  return `${intro} 😳 ${dreamContent}... ${outro}`;
}
