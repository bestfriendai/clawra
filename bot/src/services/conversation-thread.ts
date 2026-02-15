import { getSessionValue, setSessionValue } from "./session-store.js";

const THREAD_KEY = "conversationThreadId";

function createThreadId(telegramId: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `tg-${telegramId}-${Date.now().toString(36)}-${random}`;
}

export async function getOrCreateConversationThreadId(
  telegramId: number
): Promise<string> {
  const existing = await getSessionValue<string | undefined>(telegramId, THREAD_KEY, undefined);
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }

  const created = createThreadId(telegramId);
  await setSessionValue(telegramId, THREAD_KEY, created);
  return created;
}

export async function resetConversationThreadId(
  telegramId: number
): Promise<string> {
  const created = createThreadId(telegramId);
  await setSessionValue(telegramId, THREAD_KEY, created);
  return created;
}

