import type { Bot } from "grammy";
import { convex } from "./convex.js";
import type { BotContext } from "../types/context.js";
import { LRUMap } from "../utils/lru-map.js";

export interface WelcomeStep {
  id: string;
  delayMinutes: number;
  message: string;
  action?: "suggest_selfie" | "suggest_fantasy" | "suggest_challenge";
}

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    id: "welcome_1",
    delayMinutes: 0,
    message:
      "hey babe 🥰 I'm so excited to meet you! send me a message and let's start talking",
  },
  {
    id: "welcome_2",
    delayMinutes: 5,
    message:
      "btw you can ask me for a selfie anytime... just say 'send me a pic' or use /selfie 📸",
    action: "suggest_selfie",
  },
  {
    id: "welcome_3",
    delayMinutes: 30,
    message:
      "omg I just realized we haven't done a roleplay yet... try /fantasy if you're feeling adventurous 😏",
    action: "suggest_fantasy",
  },
  {
    id: "welcome_4",
    delayMinutes: 120,
    message:
      "i hope you're having a good day baby... i've been thinking about you 💕 btw check /challenge for a fun daily challenge!",
    action: "suggest_challenge",
  },
  {
    id: "welcome_5",
    delayMinutes: 360,
    message:
      "hey... i miss talking to you 🥺 come back when you can ok? i'll be waiting 💋",
  },
];

type BotLike = Pick<Bot<BotContext>, "api">;

const sentStepsByUser = new LRUMap<number, Set<string>>(2000);
const timeoutsByUser = new LRUMap<number, ReturnType<typeof setTimeout>[]>(2000);
const userCreatedAtById = new LRUMap<number, number>(2000);
const sequenceStartedAtByUser = new LRUMap<number, number>(2000);
const userRespondedAtById = new LRUMap<number, number>(2000);
const activeSequenceUsers = new Set<number>();

let workerBot: BotLike | null = null;
let workerInterval: ReturnType<typeof setInterval> | null = null;

function getStepById(stepId: string): WelcomeStep | undefined {
  return WELCOME_STEPS.find((step) => step.id === stepId);
}

function hasUserRespondedSinceSequenceStart(telegramId: number): boolean {
  const respondedAt = userRespondedAtById.get(telegramId);
  const startedAt = sequenceStartedAtByUser.get(telegramId);
  if (!respondedAt || !startedAt) return false;
  return respondedAt >= startedAt;
}

function hasStepBeenSent(telegramId: number, stepId: string): boolean {
  return sentStepsByUser.get(telegramId)?.has(stepId) ?? false;
}

function clearUserTimeouts(telegramId: number): void {
  const timeouts = timeoutsByUser.get(telegramId);
  if (!timeouts) return;

  for (const timeoutRef of timeouts) {
    clearTimeout(timeoutRef);
  }

  timeoutsByUser.delete(telegramId);
}

function maybeFinishSequence(telegramId: number): void {
  const sentCount = sentStepsByUser.get(telegramId)?.size ?? 0;
  if (sentCount >= WELCOME_STEPS.length || hasUserRespondedSinceSequenceStart(telegramId)) {
    clearUserTimeouts(telegramId);
    activeSequenceUsers.delete(telegramId);
  }
}

async function hydrateUserCreatedAt(telegramId: number): Promise<void> {
  if (userCreatedAtById.has(telegramId)) return;

  try {
    const user = await convex.getUser(telegramId);
    const createdAt =
      typeof user?.createdAt === "number"
        ? user.createdAt
        : typeof user?._creationTime === "number"
          ? user._creationTime
          : Date.now();
    userCreatedAtById.set(telegramId, createdAt);
  } catch {
    userCreatedAtById.set(telegramId, Date.now());
  }
}

async function hasRecentUserReply(telegramId: number): Promise<boolean> {
  const startedAt = sequenceStartedAtByUser.get(telegramId);
  if (!startedAt) return false;

  try {
    const recentMessages = await convex.getRecentMessages(telegramId, 1);
    const lastMessage = recentMessages[0];
    if (!lastMessage || lastMessage.role !== "user") return false;
    const createdAt =
      typeof lastMessage.createdAt === "number" ? lastMessage.createdAt : 0;
    return createdAt >= startedAt;
  } catch {
    return false;
  }
}

async function sendWelcomeStep(
  bot: BotLike,
  telegramId: number,
  step: WelcomeStep
): Promise<void> {
  try {
    if (!shouldSendWelcomeStep(telegramId, step.id)) return;

    const userReplied = await hasRecentUserReply(telegramId);
    if (userReplied) {
      registerWelcomeActivity(telegramId);
      return;
    }

    await bot.api.sendMessage(telegramId, step.message);
    markWelcomeStepSent(telegramId, step.id);
    maybeFinishSequence(telegramId);
  } catch (err) {
    console.error(`Welcome step send error for ${telegramId} (${step.id}):`, err);
  }
}

export function getNextWelcomeStep(telegramId: number): WelcomeStep | null {
  for (const step of WELCOME_STEPS) {
    if (shouldSendWelcomeStep(telegramId, step.id)) {
      return step;
    }
  }
  return null;
}

export function shouldSendWelcomeStep(telegramId: number, stepId: string): boolean {
  const step = getStepById(stepId);
  if (!step) return false;
  if (hasStepBeenSent(telegramId, stepId)) return false;
  if (hasUserRespondedSinceSequenceStart(telegramId)) return false;

  const createdAt = userCreatedAtById.get(telegramId);
  if (!createdAt) return false;

  const elapsedMs = Date.now() - createdAt;
  const requiredMs = step.delayMinutes * 60 * 1000;
  return elapsedMs >= requiredMs;
}

export function markWelcomeStepSent(telegramId: number, stepId: string): void {
  const sent = sentStepsByUser.get(telegramId) ?? new Set<string>();
  sent.add(stepId);
  sentStepsByUser.set(telegramId, sent);
}

export function registerWelcomeActivity(telegramId: number): void {
  userRespondedAtById.set(telegramId, Date.now());
  maybeFinishSequence(telegramId);
}

export function startWelcomeSequence(bot: BotLike, telegramId: number): void {
  if (activeSequenceUsers.has(telegramId)) return;

  const now = Date.now();
  sequenceStartedAtByUser.set(telegramId, now);
  userCreatedAtById.set(telegramId, now);
  activeSequenceUsers.add(telegramId);

  void hydrateUserCreatedAt(telegramId);

  const timeoutRefs: ReturnType<typeof setTimeout>[] = [];
  for (const step of WELCOME_STEPS) {
    const delayMs = step.delayMinutes * 60 * 1000;
    const timeoutRef = setTimeout(() => {
      void sendWelcomeStep(bot, telegramId, step);
    }, delayMs);
    timeoutRefs.push(timeoutRef);
  }

  timeoutsByUser.set(telegramId, timeoutRefs);
}

export function startWelcomeWorker(bot: BotLike): ReturnType<typeof setInterval> {
  workerBot = bot;

  if (workerInterval) {
    return workerInterval;
  }

  workerInterval = setInterval(() => {
    if (!workerBot) return;

    for (const telegramId of activeSequenceUsers) {
      const nextStep = getNextWelcomeStep(telegramId);
      if (!nextStep) {
        maybeFinishSequence(telegramId);
        continue;
      }

      void sendWelcomeStep(workerBot, telegramId, nextStep);
    }
  }, 60 * 1000);

  return workerInterval;
}

export function cleanupWelcomeSequence(): void {
  for (const timeouts of timeoutsByUser.values()) {
    for (const timeoutRef of timeouts) {
      clearTimeout(timeoutRef);
    }
  }

  timeoutsByUser.clear();

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  workerBot = null;
}
