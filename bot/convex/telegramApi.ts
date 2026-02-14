"use node";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function getApiBase(): string {
  if (!BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");
  }
  return `https://api.telegram.org/bot${BOT_TOKEN}`;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: "HTML" | "MarkdownV2";
    reply_markup?: unknown;
  }
): Promise<{ ok: boolean; chatBlocked?: boolean }> {
  const resp = await fetch(`${getApiBase()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    const isChatGone =
      /chat not found|bot was blocked|user is deactivated|PEER_ID_INVALID/i.test(body);
    if (isChatGone) {
      console.warn(`Telegram chat unreachable for ${chatId}: ${body}`);
      return { ok: false, chatBlocked: true };
    }
    console.error("Telegram API sendMessage error:", body);
    return { ok: false };
  }

  return { ok: true };
}

export async function sendChatAction(
  chatId: number,
  action: string
): Promise<void> {
  const resp = await fetch(`${getApiBase()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });

  if (!resp.ok) {
    console.error("Telegram API sendChatAction error:", await resp.text());
  }
}

export async function sendPhoto(
  chatId: number,
  photo: string,
  caption?: string
): Promise<void> {
  const resp = await fetch(`${getApiBase()}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo, caption }),
  });

  if (!resp.ok) {
    console.error("Telegram API sendPhoto error:", await resp.text());
  }
}
