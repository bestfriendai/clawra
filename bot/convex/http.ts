import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get("Authorization") ?? "";
  const expectedKey = process.env.WHITELABEL_API_KEY;
  if (!expectedKey) return false;
  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  return providedKey === expectedKey;
}

// ─── Main Bot Webhook ────────────────────────────────────────────────

http.route({
  path: "/telegram-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Missing TELEGRAM_WEBHOOK_SECRET in Convex runtime");
      return new Response("Unauthorized", { status: 401 });
    }

    const requestSecret = request.headers.get(TELEGRAM_SECRET_HEADER) || "";
    const rawBody = await request.text();
    const bodySignature = await hmacSha256Hex(webhookSecret, rawBody);

    const validSecret = constantTimeEqual(requestSecret, webhookSecret);
    const validSignature = constantTimeEqual(requestSecret, bodySignature);

    if (!validSecret && !validSignature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    await ctx.scheduler.runAfter(0, internal.telegramBot.processUpdate, {
      update: body,
    });
    return new Response("OK", { status: 200 });
  }),
});

// ─── Health Check ────────────────────────────────────────────────────

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
  }),
});

// ─── White-Label Bot Registration ────────────────────────────────────

http.route({
  path: "/api/bots/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateApiKey(request)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: {
      ownerTelegramId?: number;
      botToken?: string;
      girlfriendName?: string;
      girlfriendPersonality?: string;
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body.ownerTelegramId || !body.botToken) {
      return jsonResponse(
        { error: "Missing required fields: ownerTelegramId, botToken" },
        400
      );
    }

    const result = await ctx.runAction(internal.whitelabelApi.registerBot, {
      ownerTelegramId: body.ownerTelegramId,
      botToken: body.botToken,
      girlfriendName: body.girlfriendName,
      girlfriendPersonality: body.girlfriendPersonality,
    });

    if (!result.success) {
      return jsonResponse({ error: result.error }, 400);
    }

    return jsonResponse({
      success: true,
      botId: result.botId,
      botUsername: result.botUsername,
    });
  }),
});

// ─── White-Label Bot Listing ─────────────────────────────────────────

http.route({
  path: "/api/bots/list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateApiKey(request)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const ownerIdParam = url.searchParams.get("ownerTelegramId");

    if (!ownerIdParam) {
      return jsonResponse(
        { error: "Missing query parameter: ownerTelegramId" },
        400
      );
    }

    const ownerTelegramId = Number(ownerIdParam);
    if (isNaN(ownerTelegramId)) {
      return jsonResponse(
        { error: "ownerTelegramId must be a number" },
        400
      );
    }

    const bots = await ctx.runQuery(internal.botInstances.list, {
      ownerTelegramId,
    });

    const sanitized = bots.map((b) => ({
      _id: b._id,
      botUsername: b.botUsername,
      girlfriendName: b.girlfriendName,
      girlfriendPersonality: b.girlfriendPersonality,
      isActive: b.isActive,
      totalUsers: b.totalUsers,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return jsonResponse({ bots: sanitized });
  }),
});

// ─── White-Label Bot Deactivation ────────────────────────────────────

http.route({
  path: "/api/bots/deactivate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!validateApiKey(request)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: { botToken?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body.botToken) {
      return jsonResponse({ error: "Missing required field: botToken" }, 400);
    }

    try {
      await ctx.runMutation(internal.botInstances.deactivate, {
        botToken: body.botToken,
      });
      return jsonResponse({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Deactivation failed";
      return jsonResponse({ error: message }, 400);
    }
  }),
});

// ─── White-Label Bot Webhook (receives Telegram updates) ─────────────
// Matches any POST to /api/bots/{botToken}/webhook via pathPrefix

http.route({
  pathPrefix: "/api/bots/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 4 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "bots" ||
      pathParts[3] !== "webhook"
    ) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const botToken = pathParts[2];

    let update: unknown;
    try {
      update = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.whitelabelApi.processWhitelabelUpdate,
      { botToken, update }
    );

    return new Response("OK", { status: 200 });
  }),
});

// ─── Admin: List All Bots ────────────────────────────────────────────

http.route({
  path: "/api/admin/bots",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!validateApiKey(request)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const bots = await ctx.runQuery(internal.botInstances.listAll, {});

    const sanitized = bots.map((b) => ({
      _id: b._id,
      ownerTelegramId: b.ownerTelegramId,
      botUsername: b.botUsername,
      girlfriendName: b.girlfriendName,
      isActive: b.isActive,
      totalUsers: b.totalUsers,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return jsonResponse({ bots: sanitized });
  }),
});

// ─── Mini App Auth ───────────────────────────────────────────────────

function validateMiniAppAuth(request: Request): number | null {
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;
    const user = JSON.parse(decodeURIComponent(userJson));
    return typeof user.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data",
  };
}

function miniAppResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders() },
  });
}

// ─── Mini App API ────────────────────────────────────────────────────

http.route({
  path: "/api/miniapp/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const telegramId = validateMiniAppAuth(request);
    if (!telegramId) return miniAppResponse({ error: "Unauthorized" }, 401);

    const profile = await ctx.runQuery(
      internal.girlfriendProfiles.getByTelegramId,
      { telegramId }
    );
    if (!profile) return miniAppResponse({ error: "No profile" }, 404);

    return miniAppResponse({ profile });
  }),
});

http.route({
  path: "/api/miniapp/gallery",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const telegramId = validateMiniAppAuth(request);
    if (!telegramId) return miniAppResponse({ error: "Unauthorized" }, 401);

    const images = await ctx.runQuery(internal.messages.getWithImages, {
      telegramId,
      limit: 50,
    });
    return miniAppResponse({ images });
  }),
});

http.route({
  path: "/api/miniapp/balance",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const telegramId = validateMiniAppAuth(request);
    if (!telegramId) return miniAppResponse({ error: "Unauthorized" }, 401);

    const credits = await ctx.runQuery(
      internal.credits.getByTelegramId,
      { telegramId }
    );
    return miniAppResponse({ balance: credits?.balance ?? 0 });
  }),
});

http.route({
  path: "/api/miniapp/profile",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/miniapp/gallery",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/miniapp/balance",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

export default http;
