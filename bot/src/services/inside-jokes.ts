import { convex } from "./convex.js";

export interface InsideJoke {
  trigger: string;
  firstOccurrence: number;
  occurrences: number;
  lastUsed: number;
  userOriginated: boolean;
}

type JokeMemoryFact = {
  fact: string;
  extractedAt?: number;
  createdAt?: number;
};

type NgramHit = {
  phrase: string;
  occurrences: number;
  firstOccurrence: number;
  lastOccurrence: number;
  userOriginated: boolean;
};

type MessageLike = {
  role: string;
  content: string;
  createdAt?: number;
  timestamp?: number;
};

const INSIDE_JOKE_CATEGORY = "inside_joke";
const SERIALIZED_PREFIX = "INSIDE_JOKE::";
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "you",
  "your",
  "are",
  "this",
  "that",
  "with",
  "have",
  "just",
  "from",
  "what",
  "when",
  "where",
  "would",
  "could",
  "should",
  "about",
  "there",
  "they",
  "them",
  "then",
  "than",
  "been",
  "into",
  "like",
  "dont",
  "cant",
  "im",
  "its",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTimestamp(message: MessageLike, fallback: number): number {
  if (typeof message.createdAt === "number") return message.createdAt;
  if (typeof message.timestamp === "number") return message.timestamp;
  return fallback;
}

function isUserRole(role: string): boolean {
  return role.trim().toLowerCase() === "user";
}

function serializeInsideJoke(joke: InsideJoke): string {
  return `${SERIALIZED_PREFIX}${JSON.stringify(joke)}`;
}

function parseInsideJokeFact(fact: string): InsideJoke | null {
  if (!fact.trim()) return null;

  const raw = fact.startsWith(SERIALIZED_PREFIX)
    ? fact.slice(SERIALIZED_PREFIX.length)
    : fact;

  try {
    const parsed = JSON.parse(raw) as Partial<InsideJoke>;
    if (!parsed.trigger || typeof parsed.trigger !== "string") return null;

    return {
      trigger: parsed.trigger.trim().toLowerCase(),
      firstOccurrence:
        typeof parsed.firstOccurrence === "number"
          ? parsed.firstOccurrence
          : Date.now(),
      occurrences:
        typeof parsed.occurrences === "number" && parsed.occurrences > 0
          ? Math.floor(parsed.occurrences)
          : 1,
      lastUsed:
        typeof parsed.lastUsed === "number" ? parsed.lastUsed : Date.now(),
      userOriginated: Boolean(parsed.userOriginated),
    };
  } catch {
    return null;
  }
}

function getLatestByTrigger(records: JokeMemoryFact[]): Map<string, InsideJoke> {
  const latest = new Map<string, { joke: InsideJoke; ts: number }>();

  for (const record of records) {
    const joke = parseInsideJokeFact(record.fact);
    if (!joke) continue;

    const ts =
      typeof record.extractedAt === "number"
        ? record.extractedAt
        : typeof record.createdAt === "number"
          ? record.createdAt
          : joke.lastUsed;

    const prev = latest.get(joke.trigger);
    if (!prev || ts >= prev.ts) {
      latest.set(joke.trigger, { joke, ts });
    }
  }

  return new Map(Array.from(latest.entries()).map(([trigger, value]) => [trigger, value.joke]));
}

function detectRepeatedNgrams(recentMessages: MessageLike[]): NgramHit[] {
  const counts = new Map<string, number>();
  const firstSeenAt = new Map<string, number>();
  const lastSeenAt = new Map<string, number>();
  const firstSeenRole = new Map<string, string>();

  const now = Date.now();

  recentMessages.forEach((message, index) => {
    const text = normalizeText(message.content);
    if (!text) return;

    const words = text
      .split(" ")
      .map((word) => word.trim())
      .filter((word) => word.length >= 2);

    if (words.length < 2) return;

    const seenInMessage = new Set<string>();

    for (let size = 2; size <= 4; size += 1) {
      if (words.length < size) continue;

      for (let i = 0; i <= words.length - size; i += 1) {
        const phraseWords = words.slice(i, i + size);
        if (phraseWords.every((word) => STOP_WORDS.has(word))) continue;
        if (phraseWords[0] === phraseWords[1] && size === 2) continue;

        const phrase = phraseWords.join(" ");
        if (seenInMessage.has(phrase)) continue;

        seenInMessage.add(phrase);
        counts.set(phrase, (counts.get(phrase) || 0) + 1);

        const ts = toTimestamp(message, now - (recentMessages.length - index) * 1000);
        if (!firstSeenAt.has(phrase)) {
          firstSeenAt.set(phrase, ts);
          firstSeenRole.set(phrase, message.role);
        }
        lastSeenAt.set(phrase, ts);
      }
    }
  });

  const rawHits: NgramHit[] = [];
  for (const [phrase, occurrences] of counts.entries()) {
    if (occurrences < 3) continue;

    rawHits.push({
      phrase,
      occurrences,
      firstOccurrence: firstSeenAt.get(phrase) || now,
      lastOccurrence: lastSeenAt.get(phrase) || now,
      userOriginated: isUserRole(firstSeenRole.get(phrase) || ""),
    });
  }

  rawHits.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    if (b.phrase.length !== a.phrase.length) return b.phrase.length - a.phrase.length;
    return b.lastOccurrence - a.lastOccurrence;
  });

  const filtered: NgramHit[] = [];
  for (const hit of rawHits) {
    const overlaps = filtered.some((existing) =>
      existing.phrase.includes(hit.phrase) || hit.phrase.includes(existing.phrase)
    );

    if (!overlaps) filtered.push(hit);
  }

  return filtered;
}

export async function detectInsideJokes(
  telegramId: number,
  recentMessages: MessageLike[]
): Promise<InsideJoke[]> {
  if (!Number.isFinite(telegramId) || telegramId <= 0) return [];
  if (recentMessages.length < 3) return [];

  const candidates = detectRepeatedNgrams(recentMessages);
  if (candidates.length === 0) return [];

  const existingRecords = await convex.getMemoryFactsByCategory(
    telegramId,
    INSIDE_JOKE_CATEGORY
  ) as JokeMemoryFact[];

  const existingByTrigger = getLatestByTrigger(existingRecords);
  const now = Date.now();
  const detected: InsideJoke[] = [];

  for (const candidate of candidates) {
    const existing = existingByTrigger.get(candidate.phrase);
    const joke: InsideJoke = {
      trigger: candidate.phrase,
      firstOccurrence: existing
        ? Math.min(existing.firstOccurrence, candidate.firstOccurrence)
        : candidate.firstOccurrence,
      occurrences: existing
        ? Math.max(existing.occurrences, candidate.occurrences)
        : candidate.occurrences,
      lastUsed: now,
      userOriginated: existing
        ? existing.userOriginated || candidate.userOriginated
        : candidate.userOriginated,
    };

    const shouldPersist =
      !existing
      || existing.occurrences !== joke.occurrences
      || existing.userOriginated !== joke.userOriginated;

    if (shouldPersist) {
      await convex.addCategorizedMemoryFact(
        telegramId,
        INSIDE_JOKE_CATEGORY,
        serializeInsideJoke(joke),
        Math.min(1, 0.5 + joke.occurrences * 0.1)
      );
    }

    detected.push(joke);
  }

  return detected;
}

export async function getActiveInsideJokes(
  telegramId: number,
  limit = 3
): Promise<InsideJoke[]> {
  if (!Number.isFinite(telegramId) || telegramId <= 0) return [];
  const cappedLimit = Math.max(1, Math.min(limit, 10));

  const records = await convex.getMemoryFactsByCategory(
    telegramId,
    INSIDE_JOKE_CATEGORY
  ) as JokeMemoryFact[];

  const jokes = Array.from(getLatestByTrigger(records).values());
  const now = Date.now();

  jokes.sort((a, b) => {
    const ageA = Math.max(1, now - a.lastUsed);
    const ageB = Math.max(1, now - b.lastUsed);
    const scoreA = a.occurrences * 2 + 1 / ageA;
    const scoreB = b.occurrences * 2 + 1 / ageB;
    return scoreB - scoreA;
  });

  return jokes.slice(0, cappedLimit);
}

export async function recordJokeUsage(
  telegramId: number,
  trigger: string
): Promise<void> {
  if (!Number.isFinite(telegramId) || telegramId <= 0) return;

  const normalizedTrigger = normalizeText(trigger);
  if (!normalizedTrigger) return;

  const active = await getActiveInsideJokes(telegramId, 25);
  const existing = active.find((joke) => joke.trigger === normalizedTrigger);

  const now = Date.now();
  const updated: InsideJoke = existing
    ? {
      ...existing,
      occurrences: existing.occurrences + 1,
      lastUsed: now,
    }
    : {
      trigger: normalizedTrigger,
      firstOccurrence: now,
      occurrences: 1,
      lastUsed: now,
      userOriginated: true,
    };

  await convex.addCategorizedMemoryFact(
    telegramId,
    INSIDE_JOKE_CATEGORY,
    serializeInsideJoke(updated),
    Math.min(1, 0.5 + updated.occurrences * 0.1)
  );
}
