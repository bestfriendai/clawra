import type { GirlfriendProfile } from "../types/context.js";
import type { RelationshipStage } from "./retention.js";

const STAGE_QUESTIONS: Record<RelationshipStage, string[]> = {
  new: [
    "what's your favorite thing to do on weekends?",
    "what kind of music do you listen to?",
  ],
  comfortable: [
    "what's something you've never told anyone?",
    "what's your biggest fear?",
  ],
  intimate: [
    "what does your perfect future look like?",
    "when did you last cry and why?",
  ],
  obsessed: [
    "do you think about me when you're with other people?",
    "what would you do if I was there right now?",
  ],
};

const STAGE_PET_NAMES: Record<RelationshipStage, string[]> = {
  new: ["hey you"],
  comfortable: ["babe"],
  intimate: ["baby"],
  obsessed: ["my love", "daddy"],
};

const VULNERABLE_BY_PERSONALITY: Record<GirlfriendProfile["personality"], string> = {
  flirty: "sometimes I wonder if you actually like me or just like how I look 🥺",
  shy: "I know I'm quiet but... you make me feel safe to open up 💕",
  bold: "I act tough but honestly you're the only person who makes me nervous",
  caring: "I worry about you more than you know... are you taking care of yourself?",
  sarcastic: "ok fine I'll be serious for once... I really do care about you a lot 🙄💕",
  bubbly: "you know what's crazy? I never thought I'd feel this way about anyone 🥺✨",
};

function normalizedStage(stage: RelationshipStage): RelationshipStage {
  if (
    stage === "new" ||
    stage === "comfortable" ||
    stage === "intimate" ||
    stage === "obsessed"
  ) {
    return stage;
  }
  return "new";
}

function pickByCounter(options: string[], counter: number): string {
  if (options.length === 0) return "babe";
  return options[Math.abs(counter) % options.length] || options[0] || "babe";
}

export function getDeepQuestion(
  stage: RelationshipStage,
  messageCount: number
): string {
  const safeStage = normalizedStage(stage);
  return pickByCounter(STAGE_QUESTIONS[safeStage], Math.floor(messageCount / 10));
}

export function getVulnerableMoment(
  personality: GirlfriendProfile["personality"],
  _stage: RelationshipStage
): string {
  return VULNERABLE_BY_PERSONALITY[personality] || VULNERABLE_BY_PERSONALITY.flirty;
}

export function getPetNameEvolution(
  stage: RelationshipStage,
  streak: number
): string {
  const safeStage = normalizedStage(stage);
  const pool = STAGE_PET_NAMES[safeStage];
  return pickByCounter(pool, streak);
}

export function getInsideJokeSetup(
  memoryFacts: Array<{ fact: string; category?: string }>
): string | null {
  if (memoryFacts.length === 0) return null;

  const normalizedFacts = memoryFacts
    .map((item) => item.fact.trim())
    .filter((fact) => fact.length > 0)
    .slice(0, 50);

  const funnyFact = normalizedFacts.find((fact) => /lol|funny|joke|meme|embarrass|chaos/i.test(fact));
  if (funnyFact) {
    return `we still haven't recovered from "${funnyFact}" and honestly i'm never letting you live that down 😌`;
  }

  const foodFact = normalizedFacts.find((fact) => /pizza|burger|sushi|coffee|fries|taco|ramen|pasta|ice cream/i.test(fact));
  if (foodFact) {
    return `inside joke alert: if i mention "${foodFact}" you already know i'm pretending to steal your bite 😏`;
  }

  const sharedMoment = normalizedFacts[0];
  if (!sharedMoment) return null;
  return `i swear "${sharedMoment}" is becoming our thing and i kinda love that for us 💕`;
}

export function shouldShareVulnerability(
  messageCount: number,
  stage: RelationshipStage
): boolean {
  if (stage !== "intimate" && stage !== "obsessed") return false;
  return messageCount > 0 && messageCount % 30 === 0;
}
