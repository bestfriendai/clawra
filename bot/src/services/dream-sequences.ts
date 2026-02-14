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

export async function generateDreamNarrative(
  profile: GirlfriendProfile,
  memoryFacts: Array<{ fact: string; category?: string }>
): Promise<string> {
  const dreamContent = await generateDreamSequence(profile, memoryFacts);
  return `omg babe I had the craziest dream about us last night 😳💕 ${dreamContent}... what do you think it means? 🥰`;
}
