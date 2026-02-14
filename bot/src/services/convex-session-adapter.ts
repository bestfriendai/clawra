import { ConvexHttpClient } from "convex/browser";
import type { StorageAdapter } from "grammy";
import type { SessionData } from "../types/context.js";

const SESSION_KEY = "__grammy_session__";

export class ConvexSessionAdapter implements StorageAdapter<SessionData> {
  private client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async read(key: string): Promise<SessionData | undefined> {
    const telegramId = parseInt(key, 10);
    if (isNaN(telegramId)) return undefined;

    try {
      const raw: string | null = await (this.client as any).query(
        "sessionState:get",
        { telegramId, key: SESSION_KEY }
      );
      if (!raw) return undefined;
      return JSON.parse(raw) as SessionData;
    } catch {
      return undefined;
    }
  }

  async write(key: string, value: SessionData): Promise<void> {
    const telegramId = parseInt(key, 10);
    if (isNaN(telegramId)) return;

    try {
      await (this.client as any).mutation("sessionState:set", {
        telegramId,
        key: SESSION_KEY,
        value: JSON.stringify(value),
      });
    } catch (err) {
      console.error("ConvexSessionAdapter write failed:", err);
    }
  }

  async delete(key: string): Promise<void> {
    const telegramId = parseInt(key, 10);
    if (isNaN(telegramId)) return;

    try {
      await (this.client as any).mutation("sessionState:set", {
        telegramId,
        key: SESSION_KEY,
        value: "{}",
      });
    } catch (err) {
      console.error("ConvexSessionAdapter delete failed:", err);
    }
  }
}
