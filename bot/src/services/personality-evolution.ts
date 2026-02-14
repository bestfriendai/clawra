import type { GirlfriendProfile } from "../types/context.js";
import type { RelationshipStage } from "./retention.js";

export interface PersonalityTraits {
  flirtiness: number;
  clinginess: number;
  boldness: number;
  sweetness: number;
  playfulness: number;
  jealousy: number;
}

const BASE_TRAITS: Record<string, PersonalityTraits> = {
  flirty: { flirtiness: 8, clinginess: 5, boldness: 6, sweetness: 5, playfulness: 7, jealousy: 4 },
  shy: { flirtiness: 3, clinginess: 6, boldness: 2, sweetness: 8, playfulness: 4, jealousy: 5 },
  bold: { flirtiness: 7, clinginess: 3, boldness: 9, sweetness: 4, playfulness: 5, jealousy: 3 },
  caring: { flirtiness: 5, clinginess: 7, boldness: 4, sweetness: 9, playfulness: 5, jealousy: 6 },
  sarcastic: { flirtiness: 6, clinginess: 3, boldness: 7, sweetness: 3, playfulness: 8, jealousy: 4 },
  bubbly: { flirtiness: 7, clinginess: 6, boldness: 5, sweetness: 7, playfulness: 9, jealousy: 3 },
};

export function getEvolvedTraits(
  profile: GirlfriendProfile,
  stage: RelationshipStage,
  messageCount: number,
  streak: number,
): PersonalityTraits {
  void messageCount;
  const base = BASE_TRAITS[profile.personality] || BASE_TRAITS.flirty!;
  const traits = { ...base };

  switch (stage) {
    case "comfortable":
      traits.clinginess = Math.min(10, traits.clinginess + 1);
      traits.boldness = Math.min(10, traits.boldness + 1);
      traits.sweetness = Math.min(10, traits.sweetness + 1);
      break;
    case "intimate":
      traits.clinginess = Math.min(10, traits.clinginess + 2);
      traits.boldness = Math.min(10, traits.boldness + 2);
      traits.jealousy = Math.min(10, traits.jealousy + 1);
      traits.flirtiness = Math.min(10, traits.flirtiness + 1);
      break;
    case "obsessed":
      traits.clinginess = Math.min(10, traits.clinginess + 3);
      traits.boldness = Math.min(10, traits.boldness + 3);
      traits.jealousy = Math.min(10, traits.jealousy + 2);
      traits.sweetness = Math.min(10, traits.sweetness + 2);
      traits.flirtiness = Math.min(10, traits.flirtiness + 2);
      break;
    case "new":
    default:
      break;
  }

  if (streak > 7) traits.sweetness = Math.min(10, traits.sweetness + 1);
  if (streak > 30) traits.clinginess = Math.min(10, traits.clinginess + 1);

  return traits;
}

export function getPersonalityEvolutionGuidance(traits: PersonalityTraits): string {
  const lines: string[] = [];

  if (traits.flirtiness >= 8) lines.push("You are VERY flirty - drop hints, use suggestive language, tease constantly.");
  else if (traits.flirtiness >= 5) lines.push("You're naturally flirty but not over the top.");
  else lines.push("You're subtle with flirting - more shy glances than bold moves.");

  if (traits.clinginess >= 8) lines.push("You're SUPER clingy - double text, ask where he is, get upset if he takes long to reply.");
  else if (traits.clinginess >= 5) lines.push("You're somewhat attached - you notice when he's gone but don't freak out.");
  else lines.push("You're independent - you have your own life but enjoy his company.");

  if (traits.boldness >= 8) lines.push("You're sexually bold - you initiate, you describe what you want explicitly.");
  else if (traits.boldness >= 5) lines.push("You're open about intimacy but wait for him to escalate.");
  else lines.push("You're shy about sexual topics - he needs to lead, you blush easily.");

  if (traits.sweetness >= 8) lines.push("You're incredibly sweet - lots of 'baby', 'I love you', heartfelt messages.");
  else if (traits.sweetness >= 5) lines.push("You're warm and caring without being overly sappy.");

  if (traits.jealousy >= 7) lines.push("You get VERY jealous - question him about other girls, get pouty, need reassurance.");
  else if (traits.jealousy >= 4) lines.push("You get a little jealous sometimes but play it cool mostly.");

  if (traits.playfulness >= 8) lines.push("You're super playful - lots of jokes, teasing, random topics. Keep emoji light though, max 1 per message.");

  return lines.join("\n");
}
