/**
 * Session Store — persistent per-user state with in-memory cache + Convex write-through.
 * Survives cold starts on Convex serverless hosting.
 */

import { convex } from "./convex.js";
import { LRUMap } from "../utils/lru-map.js";

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const cache = new LRUMap<string, CacheEntry>(5000);

function cacheKey(telegramId: number, key: string): string {
  return `${telegramId}:${key}`;
}

/**
 * Get a session value. Checks in-memory cache first, then falls back to Convex.
 */
export async function getSessionValue<T = any>(
  telegramId: number,
  key: string,
  defaultValue?: T
): Promise<T> {
  const ck = cacheKey(telegramId, key);
  const cached = cache.get(ck);
  if (cached && cached.expiresAt > Date.now()) {
    try {
      return JSON.parse(cached.value) as T;
    } catch {
      return cached.value as unknown as T;
    }
  }

  try {
    const raw = await convex.getSessionValue(telegramId, key);
    if (raw !== null && raw !== undefined) {
      cache.set(ck, { value: raw, expiresAt: Date.now() + CACHE_TTL_MS });
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
  } catch {
    // Convex unavailable — fall through to default
  }

  return defaultValue as T;
}

/**
 * Set a session value. Writes to both in-memory cache and Convex.
 */
export async function setSessionValue(
  telegramId: number,
  key: string,
  value: any
): Promise<void> {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const ck = cacheKey(telegramId, key);
  cache.set(ck, { value: serialized, expiresAt: Date.now() + CACHE_TTL_MS });

  try {
    await convex.setSessionValue(telegramId, key, serialized);
  } catch {
    // Fire-and-forget — cache still has it for this session
  }
}

/**
 * Hydrate multiple keys at once from Convex into cache.
 */
export async function hydrateSession(telegramId: number): Promise<Record<string, any>> {
  try {
    const all = await convex.getAllSessionValues(telegramId);
    const result: Record<string, any> = {};
    for (const [key, raw] of Object.entries(all)) {
      const ck = cacheKey(telegramId, key);
      cache.set(ck, { value: raw, expiresAt: Date.now() + CACHE_TTL_MS });
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
    return result;
  } catch {
    return {};
  }
}
