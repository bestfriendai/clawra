export const MAX_CONTEXT_TOKENS = 8000;

interface MessageLike {
  role: string;
  content: string;
}

export interface MemoryFactLike {
  fact: string;
  category?: string;
  confidence?: number;
  createdAt?: number;
}

interface TieredMemorySelection {
  identity: MemoryFactLike[];
  preferences: MemoryFactLike[];
  emotional: MemoryFactLike[];
  relationship: MemoryFactLike[];
  topical: MemoryFactLike[];
  intimate: MemoryFactLike[];
}

function normalizeMemoryFact(fact: string | { fact: string; category?: string }): string {
  if (typeof fact === "string") return fact;
  return fact.fact || "";
}

function normalizeMemoryFacts(
  memoryFacts: Array<string | MemoryFactLike>
): MemoryFactLike[] {
  const normalized: MemoryFactLike[] = [];

  for (const fact of memoryFacts) {
    if (typeof fact === "string") {
      const value = fact.trim();
      if (!value) continue;
      normalized.push({ fact: value });
      continue;
    }

    const value = String(fact.fact || "").trim();
    if (!value) continue;

    normalized.push({
      fact: value,
      category: typeof fact.category === "string" ? fact.category.toLowerCase() : undefined,
      confidence: typeof fact.confidence === "number" ? fact.confidence : undefined,
      createdAt: typeof fact.createdAt === "number" ? fact.createdAt : 0,
    });
  }

  return normalized;
}

function isRelevantToMessage(fact: MemoryFactLike, currentMessage: string): boolean {
  const normalizedMessage = currentMessage.toLowerCase();
  if (!normalizedMessage.trim()) return false;

  const keywords = fact.fact
    .toLowerCase()
    .split(/\W+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  return keywords.some((keyword) => normalizedMessage.includes(keyword));
}

function dedupeFacts(facts: MemoryFactLike[]): MemoryFactLike[] {
  const seen = new Set<string>();
  const deduped: MemoryFactLike[] = [];

  for (const fact of facts) {
    const key = fact.fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(fact);
  }

  return deduped;
}

function formatMemoryBlock(facts: MemoryFactLike[]): string {
  const lines = dedupeFacts(facts).map((fact) => `- ${fact.fact}`);
  if (lines.length === 0) return "";
  return `## PRIORITY MEMORY\n${lines.join("\n")}`;
}

function pickFacts(
  facts: MemoryFactLike[],
  maxCount: number,
  currentMessage: string
): MemoryFactLike[] {
  return dedupeFacts(facts)
    .sort((a, b) => {
      const relA = isRelevantToMessage(a, currentMessage) ? 1 : 0;
      const relB = isRelevantToMessage(b, currentMessage) ? 1 : 0;
      if (relA !== relB) return relB - relA;
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      if (confA !== confB) return confB - confA;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    })
    .slice(0, maxCount);
}

function selectTieredMemory(
  normalizedFacts: MemoryFactLike[],
  currentMessage: string,
  isNsfw: boolean
): TieredMemorySelection {
  const identity = pickFacts(
    normalizedFacts.filter(
      (fact) =>
        fact.category === "personal_info" ||
        fact.category === "important_date" ||
        fact.category === "routine" ||
        (fact.confidence ?? 0) >= 0.93
    ),
    5,
    currentMessage
  );

  const preferences = pickFacts(
    normalizedFacts.filter((fact) =>
      [
        "preference",
        "interest",
        "appearance_pref",
        "communication_style",
        "humor",
      ].includes(fact.category || "")
    ),
    5,
    currentMessage
  );

  const emotional = pickFacts(
    normalizedFacts.filter((fact) =>
      ["emotional", "fear", "dream"].includes(fact.category || "")
    ),
    4,
    currentMessage
  );

  const relationship = pickFacts(
    normalizedFacts.filter((fact) =>
      [
        "relationship",
        "relationship_narrative",
        "pet_name",
        "conversation_summary",
      ].includes(fact.category || "")
    ),
    5,
    currentMessage
  );

  const topical = pickFacts(
    normalizedFacts.filter((fact) => isRelevantToMessage(fact, currentMessage)),
    4,
    currentMessage
  );

  const intimate = isNsfw
    ? pickFacts(
        normalizedFacts.filter((fact) => fact.category === "kink"),
        3,
        currentMessage
      )
    : [];

  return {
    identity,
    preferences,
    emotional,
    relationship,
    topical,
    intimate,
  };
}

function formatTier(
  title: string,
  facts: MemoryFactLike[],
  dedupeSet: Set<string>
): string[] {
  const lines: string[] = [];
  for (const fact of facts) {
    const key = fact.fact.toLowerCase();
    if (dedupeSet.has(key)) continue;
    dedupeSet.add(key);
    lines.push(`- ${fact.fact}`);
  }
  if (lines.length === 0) return [];
  return [`## ${title}`, ...lines];
}

export function buildTieredMemoryBlock(
  allFacts: Array<string | MemoryFactLike>,
  currentMessage: string,
  isNsfw: boolean
): string {
  const normalizedFacts = normalizeMemoryFacts(allFacts);
  const selected = selectTieredMemory(normalizedFacts, currentMessage, isNsfw);

  const seen = new Set<string>();
  const sections = [
    ...formatTier("IDENTITY ANCHORS", selected.identity, seen),
    ...formatTier("PREFERENCES", selected.preferences, seen),
    ...formatTier("EMOTIONAL CONTEXT", selected.emotional, seen),
    ...formatTier("RELATIONSHIP THREAD", selected.relationship, seen),
    ...formatTier("TOPICAL RECALL", selected.topical, seen),
    ...(isNsfw ? formatTier("INTIMATE CONTEXT", selected.intimate, seen) : []),
  ];

  if (sections.length === 0) return "";
  return `## TIERED MEMORY\n${sections.join("\n")}`;
}

export function buildMemoryBlock(
  allFacts: Array<string | MemoryFactLike>,
  currentMessage: string,
  isNsfw: boolean
): string {
  const normalizedFacts = normalizeMemoryFacts(allFacts);

  const core = normalizedFacts
    .filter((fact) => fact.category === "personal_info" || (fact.confidence ?? 0) > 0.9)
    .slice(0, 5);

  const emotional = normalizedFacts
    .filter((fact) => fact.category === "emotional")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 3);

  const topical = normalizedFacts
    .filter((fact) => isRelevantToMessage(fact, currentMessage))
    .slice(0, 5);

  const intimate = isNsfw
    ? normalizedFacts.filter((fact) => fact.category === "kink").slice(0, 3)
    : [];

  return formatMemoryBlock([...core, ...emotional, ...topical, ...intimate]);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateMessagesTokens(messages: MessageLike[]): number {
  return messages.reduce((sum, message) => {
    const roleOverhead = 4;
    return sum + estimateTokens(message.content) + roleOverhead;
  }, 0);
}

function summarizeMiddleMessages(middleMessages: MessageLike[]): string {
  const snippets: string[] = [];

  for (const message of middleMessages) {
    const raw = message.content.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const clipped = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
    const speaker = message.role === "user" ? "User" : "Girlfriend";
    snippets.push(`${speaker}: ${clipped}`);
    if (snippets.length >= 6) break;
  }

  if (snippets.length === 0) {
    return "Previously discussed: casual back-and-forth chat and emotional check-ins.";
  }

  return `Previously discussed: ${snippets.join(" | ")}`;
}

export function trimConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const cleaned = messages
    .filter((message) => typeof message?.content === "string" && message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content.trim() }));

  if (cleaned.length === 0) return [];

  if (cleaned.length <= 10 && estimateMessagesTokens(cleaned) <= maxTokens) {
    return cleaned;
  }

  const firstCount = Math.min(2, cleaned.length);
  const firstPart = cleaned.slice(0, firstCount);
  const remainingForTail = Math.max(0, cleaned.length - firstCount);
  const lastCount = Math.min(8, remainingForTail);
  const lastStart = cleaned.length - lastCount;
  const middleStart = firstCount;
  const middleEnd = Math.max(middleStart, lastStart);
  const middlePart = cleaned.slice(middleStart, middleEnd);
  const tailPart = cleaned.slice(lastStart);

  const trimmed: MessageLike[] = [...firstPart];

  if (middlePart.length > 0) {
    trimmed.push({
      role: "system",
      content: summarizeMiddleMessages(middlePart),
    });
  }

  for (const message of tailPart) {
    const last = trimmed[trimmed.length - 1];
    if (last && last.role === message.role && last.content === message.content) continue;
    trimmed.push(message);
  }

  if (estimateMessagesTokens(trimmed) <= maxTokens) {
    return trimmed;
  }

  const reduced = [...trimmed];
  const summaryIndex = reduced.findIndex(
    (message) => message.role === "system" && message.content.startsWith("Previously discussed:")
  );
  if (summaryIndex !== -1) {
    reduced[summaryIndex] = {
      role: "system",
      content: "Previously discussed: ongoing relationship chat and emotional moments.",
    };
    if (estimateMessagesTokens(reduced) <= maxTokens) return reduced;
  }

  while (reduced.length > 1 && estimateMessagesTokens(reduced) > maxTokens) {
    if (reduced.length > 9) {
      reduced.splice(2, 1);
      continue;
    }
    reduced.shift();
  }

  return reduced;
}

export function buildContextWindow(
  messages: Array<{ role: string; content: string }>,
  memoryFacts: Array<string | { fact: string; category?: string }>,
  systemPrompt: string
): {
  messages: Array<{ role: string; content: string }>;
  totalTokens: number;
} {
  const memoryText = memoryFacts.map(normalizeMemoryFact).filter(Boolean).join("\n");
  const fixedTokenCost = estimateTokens(systemPrompt) + estimateTokens(memoryText);
  const availableForMessages = Math.max(400, MAX_CONTEXT_TOKENS - fixedTokenCost);
  const trimmedMessages = trimConversationHistory(messages, availableForMessages);
  const totalTokens = fixedTokenCost + estimateMessagesTokens(trimmedMessages);

  return {
    messages: trimmedMessages,
    totalTokens,
  };
}
