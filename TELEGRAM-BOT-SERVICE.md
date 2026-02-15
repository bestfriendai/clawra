# Clawra Telegram Bot-as-a-Service: Complete Blueprint

> A hosted Telegram bot where users sign up, buy credits (via Telegram Payments or crypto wallet), and use your fal.ai API keys at a markup. Convex handles all backend state.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Telegram Bot Setup](#3-telegram-bot-setup)
4. [Convex Backend Schema](#4-convex-backend-schema)
5. [Credit System Design](#5-credit-system-design)
6. [Payment Rails](#6-payment-rails)
7. [fal.ai Proxy & Markup](#7-falai-proxy--markup)
8. [User Flows](#8-user-flows)
9. [Anti-Abuse & Security](#9-anti-abuse--security)
10. [Deployment](#10-deployment)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Revenue Projections](#12-revenue-projections)
13. [Marketing & Growth](#13-marketing--growth)
14. [Legal & Compliance](#14-legal--compliance)
15. [Implementation Roadmap](#15-implementation-roadmap)

---

## 1. Architecture Overview

```
User (Telegram)
    │
    ▼
┌──────────────────┐
│  Telegram Bot    │  grammY (TypeScript)
│  (Webhook Mode)  │  Hosted on Railway/Fly.io
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Convex        │  Real-time backend
│  (Backend DB)    │  Users, credits, transactions, usage logs
└────────┬─────────┘
         │
         ├──► fal.ai API (image gen, video, AI models)
         │    Your API keys, proxied with markup
         │
         ├──► Telegram Payments API (Stripe provider)
         │    In-chat credit purchases
         │
         └──► Blockchain Watchers
              TON / SOL / ETH wallets
              Auto-detect incoming payments → credit user
```

**Core Principle**: The bot is a thin proxy. Users interact via Telegram, Convex stores everything, fal.ai does the heavy lifting. You pocket the difference.

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Bot Framework** | grammY (TypeScript) | Best type-safety, webhook-ready, plugin ecosystem |
| **Backend/DB** | Convex | Real-time, serverless, built-in mutations/queries, no infra to manage |
| **AI Service** | fal.ai | Image gen, video, models - your keys proxied to users |
| **Payments (Fiat)** | Telegram Payments API (Stripe) | Native in-chat checkout, zero friction |
| **Payments (Crypto)** | On-chain wallet monitoring | Users send to your wallet, bot auto-credits |
| **Hosting** | Railway (MVP) → Fly.io (Scale) | Easy deploy, auto-SSL, good free tiers |
| **Cache/Sessions** | Upstash Redis | Rate limiting, session state, serverless Redis |
| **Monitoring** | Sentry + UptimeRobot | Error tracking + uptime alerts |

### Project Structure

```
clawra-telegram-bot/
├── src/
│   ├── bot/
│   │   ├── index.ts                 # Bot init, webhook setup
│   │   ├── handlers/
│   │   │   ├── start.ts             # /start onboarding
│   │   │   ├── generate.ts          # /generate image/video
│   │   │   ├── buy.ts               # /buy credits
│   │   │   ├── balance.ts           # /balance check
│   │   │   ├── pay-crypto.ts        # /pay_crypto flow
│   │   │   └── admin.ts             # /admin stats
│   │   └── middleware/
│   │       ├── auth.ts              # User lookup/create
│   │       ├── credits.ts           # Sufficient balance check
│   │       └── ratelimit.ts         # Per-user rate limiting
│   ├── services/
│   │   ├── fal.ts                   # fal.ai proxy with cost tracking
│   │   ├── payments/
│   │   │   ├── telegram-stripe.ts   # Telegram Payments API
│   │   │   ├── ton-watcher.ts       # TON blockchain watcher
│   │   │   ├── sol-watcher.ts       # Solana USDT watcher
│   │   │   └── eth-watcher.ts       # ETH/USDT ERC-20 watcher
│   │   └── convex.ts               # Convex client wrapper
│   └── index.ts                     # Entry point
├── convex/
│   ├── schema.ts                    # All Convex tables
│   ├── users.ts                     # User mutations/queries
│   ├── credits.ts                   # Credit operations
│   ├── transactions.ts              # Transaction log
│   ├── usage.ts                     # Usage tracking
│   └── admin.ts                     # Admin queries
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 3. Telegram Bot Setup

### Create the Bot

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`, pick a name and username (must end in `bot`)
3. Save the token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
4. Configure it:

```
/setdescription    → "AI image & video generation. Buy credits, generate anything."
/setabouttext      → "Powered by fal.ai. Pay with card or crypto."
/setcommands       →
start - Get started
generate - Generate image or video
buy - Buy credits
balance - Check your credit balance
history - View usage history
referral - Get your referral link
help - How to use this bot
```

### Webhook vs Polling

**Use webhooks for production.** Telegram pushes updates to your HTTPS endpoint — sub-second latency, no polling overhead.

```typescript
// src/bot/index.ts
import { Bot, webhookCallback } from "grammy";
import express from "express";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Register all handlers
import { registerStartHandler } from "./handlers/start";
import { registerGenerateHandler } from "./handlers/generate";
import { registerBuyHandler } from "./handlers/buy";
import { registerBalanceHandler } from "./handlers/balance";

registerStartHandler(bot);
registerGenerateHandler(bot);
registerBuyHandler(bot);
registerBalanceHandler(bot);

// Webhook server
const app = express();
app.use(express.json());

// Validate Telegram secret
const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET!;
app.post("/webhook", (req, res, next) => {
  if (req.headers["x-telegram-bot-api-secret-token"] !== SECRET_TOKEN) {
    return res.sendStatus(403);
  }
  next();
}, webhookCallback(bot, "express"));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(3000, async () => {
  await bot.api.setWebhook(`${process.env.WEBHOOK_URL}/webhook`, {
    secret_token: SECRET_TOKEN,
  });
  console.log("Bot running on webhook");
});
```

---

## 4. Convex Backend Schema

Convex is the single source of truth. All user state, credits, transactions, and usage logs live here.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Users ────────────────────────────────────
  users: defineTable({
    telegramId: v.number(),              // Telegram chat ID
    username: v.optional(v.string()),     // @username
    firstName: v.string(),
    referredBy: v.optional(v.number()),   // Referrer's telegramId
    tier: v.string(),                     // "free" | "bronze" | "silver" | "gold"
    createdAt: v.number(),
    lastActive: v.number(),
    isBanned: v.boolean(),
  })
    .index("by_telegram_id", ["telegramId"])
    .index("by_tier", ["tier"]),

  // ─── Credits ──────────────────────────────────
  credits: defineTable({
    telegramId: v.number(),
    balance: v.number(),                  // Current credit balance (integer)
    lifetimeSpent: v.number(),
    lifetimePurchased: v.number(),
  })
    .index("by_telegram_id", ["telegramId"]),

  // ─── Transactions ─────────────────────────────
  transactions: defineTable({
    telegramId: v.number(),
    type: v.union(
      v.literal("purchase"),              // Bought credits
      v.literal("spend"),                 // Used credits on fal.ai
      v.literal("refund"),                // Failed request refund
      v.literal("bonus"),                 // Referral/promo bonus
    ),
    amount: v.number(),                   // + for purchase/refund/bonus, - for spend
    balanceAfter: v.number(),

    // Purchase-specific
    paymentMethod: v.optional(v.string()),// "telegram_stripe" | "crypto_ton" | "crypto_sol" | "crypto_eth"
    paymentRef: v.optional(v.string()),   // Stripe charge ID or tx hash
    usdAmount: v.optional(v.number()),    // What they paid in USD

    // Spend-specific
    service: v.optional(v.string()),      // "image_gen" | "video_gen" | "upscale" etc.
    model: v.optional(v.string()),        // "flux-pro" | "kling-1.5" etc.
    falCostUsd: v.optional(v.number()),   // What fal.ai actually charged you
    profitUsd: v.optional(v.number()),    // Your profit on this request

    description: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_telegram_id", ["telegramId"])
    .index("by_telegram_id_time", ["telegramId", "createdAt"])
    .index("by_payment_ref", ["paymentRef"])
    .index("by_type", ["type"]),

  // ─── Usage Logs ───────────────────────────────
  usageLogs: defineTable({
    telegramId: v.number(),
    service: v.string(),                  // "image_gen" | "video_gen" | "upscale"
    model: v.string(),                    // fal.ai model ID
    prompt: v.optional(v.string()),       // What user asked for
    creditsCharged: v.number(),
    falCostUsd: v.number(),               // Actual fal.ai cost
    markupPercent: v.number(),
    profitUsd: v.number(),
    responseTimeMs: v.number(),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("timeout"),
    ),
    errorMessage: v.optional(v.string()),
    resultUrl: v.optional(v.string()),    // fal.ai result URL
    refunded: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_telegram_id", ["telegramId"])
    .index("by_telegram_id_time", ["telegramId", "createdAt"])
    .index("by_status", ["status"]),

  // ─── User Deposit Wallets ────────────────────
  // Each user gets a unique deposit address per chain (HD wallet derivation)
  // Any crypto hitting this address = that user, fully automated
  depositWallets: defineTable({
    telegramId: v.number(),
    chain: v.union(
      v.literal("ton"),
      v.literal("solana"),
      v.literal("ethereum"),
    ),
    address: v.string(),                  // Unique derived deposit address
    derivationIndex: v.number(),          // HD wallet index for this user
    createdAt: v.number(),
  })
    .index("by_telegram_id", ["telegramId"])
    .index("by_address", ["address"])
    .index("by_telegram_chain", ["telegramId", "chain"]),

  // ─── Processed Transactions ────────────────────
  // Track which on-chain txs we've already credited (idempotency)
  processedChainTxs: defineTable({
    txHash: v.string(),
    chain: v.string(),
    telegramId: v.number(),
    amountCrypto: v.number(),
    amountUsd: v.number(),
    creditsCredited: v.number(),
    createdAt: v.number(),
  })
    .index("by_tx_hash", ["txHash"]),

  // ─── API Keys (Bot Owner's) ───────────────────
  apiKeys: defineTable({
    provider: v.string(),                 // "fal" | "openai" | "venice"
    keyEncrypted: v.string(),             // AES-256-GCM encrypted
    label: v.string(),
    isActive: v.boolean(),
    totalRequests: v.number(),
    totalCostUsd: v.number(),
    dailyBudgetUsd: v.optional(v.number()),
    monthlyBudgetUsd: v.optional(v.number()),
    lastUsed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_provider", ["provider", "isActive"]),
});
```

### Core Convex Mutations

```typescript
// convex/credits.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Check balance
export const getBalance = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .first();
    return credits?.balance ?? 0;
  },
});

// Deduct credits for a fal.ai request (returns false if insufficient)
export const spendCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    service: v.string(),
    model: v.string(),
    falCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId))
      .first();

    if (!credits || credits.balance < args.amount) {
      return { success: false, balance: credits?.balance ?? 0 };
    }

    const newBalance = credits.balance - args.amount;
    const profitUsd = (args.amount * 0.01) - args.falCostUsd;

    // Update balance
    await ctx.db.patch(credits._id, {
      balance: newBalance,
      lifetimeSpent: credits.lifetimeSpent + args.amount,
    });

    // Log transaction
    await ctx.db.insert("transactions", {
      telegramId: args.telegramId,
      type: "spend",
      amount: -args.amount,
      balanceAfter: newBalance,
      service: args.service,
      model: args.model,
      falCostUsd: args.falCostUsd,
      profitUsd,
      createdAt: Date.now(),
    });

    return { success: true, balance: newBalance };
  },
});

// Add credits after payment confirmed
export const addCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    paymentMethod: v.string(),
    paymentRef: v.string(),
    usdAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Idempotency check — don't double-credit same payment
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_payment_ref", (q) => q.eq("paymentRef", args.paymentRef))
      .first();
    if (existing) return { success: false, reason: "already_processed" };

    let credits = await ctx.db
      .query("credits")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId))
      .first();

    if (!credits) {
      // First purchase — create credits record
      const id = await ctx.db.insert("credits", {
        telegramId: args.telegramId,
        balance: args.amount,
        lifetimeSpent: 0,
        lifetimePurchased: args.amount,
      });
      credits = { _id: id, balance: args.amount, lifetimeSpent: 0, lifetimePurchased: args.amount, telegramId: args.telegramId } as any;
    } else {
      await ctx.db.patch(credits._id, {
        balance: credits.balance + args.amount,
        lifetimePurchased: credits.lifetimePurchased + args.amount,
      });
    }

    const newBalance = (credits?.balance ?? 0) + args.amount;

    await ctx.db.insert("transactions", {
      telegramId: args.telegramId,
      type: "purchase",
      amount: args.amount,
      balanceAfter: newBalance,
      paymentMethod: args.paymentMethod,
      paymentRef: args.paymentRef,
      usdAmount: args.usdAmount,
      createdAt: Date.now(),
    });

    return { success: true, newBalance };
  },
});

// Refund credits on failed fal.ai request
export const refundCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId))
      .first();

    if (!credits) return;

    const newBalance = credits.balance + args.amount;

    await ctx.db.patch(credits._id, {
      balance: newBalance,
      lifetimeSpent: credits.lifetimeSpent - args.amount,
    });

    await ctx.db.insert("transactions", {
      telegramId: args.telegramId,
      type: "refund",
      amount: args.amount,
      balanceAfter: newBalance,
      description: args.reason,
      createdAt: Date.now(),
    });
  },
});
```

---

## 5. Credit System Design

### Credit Economics

```
1 credit = $0.01 USD
```

Users buy credits in packages. You charge markup on fal.ai costs.

### Pricing Table (fal.ai costs → user credit charge)

| Service | fal.ai Model | fal.ai Cost | Credits Charged | User Pays | Your Markup |
|---------|-------------|-------------|-----------------|-----------|-------------|
| Image Gen | FLUX Pro 1.1 | $0.05 | 15 credits | $0.15 | 200% |
| Image Gen | FLUX Schnell | $0.003 | 3 credits | $0.03 | 900% |
| Image Gen | Stable Diffusion XL | $0.01 | 5 credits | $0.05 | 400% |
| Video Gen | Kling 1.5 Pro | $0.50 | 150 credits | $1.50 | 200% |
| Video Gen | MiniMax Video | $0.30 | 100 credits | $1.00 | 233% |
| Upscale | Real-ESRGAN | $0.02 | 5 credits | $0.05 | 150% |
| Image Edit | FLUX Fill | $0.04 | 10 credits | $0.10 | 150% |

### Credit Packages (what users buy)

| Package | Credits | Price | Bonus | Effective Rate |
|---------|---------|-------|-------|----------------|
| Starter | 100 | $1.00 | 0% | $0.010/credit |
| Popular | 500 | $4.50 | 10% (550 total) | $0.008/credit |
| Power | 1,000 | $8.00 | 25% (1,250 total) | $0.006/credit |
| Mega | 5,000 | $35.00 | 43% (7,150 total) | $0.005/credit |

### Pricing Config

```typescript
// src/config/pricing.ts
export const CREDIT_PACKAGES = {
  starter: {
    credits: 100,
    bonusCredits: 0,
    priceUsd: 1.00,
    priceCents: 100,
    label: "100 Credits - Starter",
    description: "~20 images or 1 video",
  },
  popular: {
    credits: 500,
    bonusCredits: 50,
    priceUsd: 4.50,
    priceCents: 450,
    label: "550 Credits - Popular (10% bonus)",
    description: "~100 images or 5 videos",
  },
  power: {
    credits: 1000,
    bonusCredits: 250,
    priceUsd: 8.00,
    priceCents: 800,
    label: "1,250 Credits - Power (25% bonus)",
    description: "~250 images or 10 videos",
  },
  mega: {
    credits: 5000,
    bonusCredits: 2150,
    priceUsd: 35.00,
    priceCents: 3500,
    label: "7,150 Credits - Mega (43% bonus)",
    description: "~1,400 images or 50 videos",
  },
} as const;

export const FAL_PRICING: Record<string, { falCostUsd: number; credits: number }> = {
  "fal-ai/flux-pro/v1.1":       { falCostUsd: 0.05, credits: 15 },
  "fal-ai/flux/schnell":        { falCostUsd: 0.003, credits: 3 },
  "fal-ai/stable-diffusion-xl": { falCostUsd: 0.01, credits: 5 },
  "fal-ai/kling-video/v1.5/pro":{ falCostUsd: 0.50, credits: 150 },
  "fal-ai/minimax-video":       { falCostUsd: 0.30, credits: 100 },
  "fal-ai/real-esrgan":         { falCostUsd: 0.02, credits: 5 },
  "fal-ai/flux-fill":           { falCostUsd: 0.04, credits: 10 },
};
```

---

## 6. Payment Rails

### Rail 1: Telegram Payments (Stripe — In-Chat Checkout)

Users tap "Buy", see a native Telegram payment sheet, pay with card. Zero friction.

**Setup:**
1. Message @BotFather: `/mybots` → select bot → Payments → Stripe
2. Get `PAYMENT_PROVIDER_TOKEN` from BotFather

```typescript
// src/bot/handlers/buy.ts
import { Bot, InlineKeyboard } from "grammy";
import { CREDIT_PACKAGES } from "../../config/pricing";

export function registerBuyHandler(bot: Bot) {
  // /buy command — show package options
  bot.command("buy", async (ctx) => {
    const keyboard = new InlineKeyboard();

    Object.entries(CREDIT_PACKAGES).forEach(([key, pkg]) => {
      keyboard
        .text(`${pkg.label} — $${pkg.priceUsd.toFixed(2)}`, `buy:${key}`)
        .row();
    });

    keyboard.text("Pay with Crypto", "buy:crypto").row();

    await ctx.reply(
      "Choose a credit package:\n\n" +
      "1 credit = $0.01 | Images cost 3-15 credits | Videos cost 100-150 credits",
      { reply_markup: keyboard }
    );
  });

  // Handle package selection → send Stripe invoice
  bot.callbackQuery(/^buy:(?!crypto)(.+)$/, async (ctx) => {
    const key = ctx.match![1] as keyof typeof CREDIT_PACKAGES;
    const pkg = CREDIT_PACKAGES[key];
    if (!pkg) return ctx.answerCallbackQuery("Invalid package");

    await ctx.answerCallbackQuery();

    await ctx.api.sendInvoice(ctx.chat!.id, {
      title: pkg.label,
      description: pkg.description,
      payload: JSON.stringify({
        telegramId: ctx.from.id,
        package: key,
        totalCredits: pkg.credits + pkg.bonusCredits,
      }),
      provider_token: process.env.STRIPE_PROVIDER_TOKEN!,
      currency: "USD",
      prices: [{ label: pkg.label, amount: pkg.priceCents }],
    });
  });

  // Pre-checkout — always approve (Stripe handles card validation)
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // Payment succeeded
  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);

    const result = await convex.mutation(api.credits.addCredits, {
      telegramId: ctx.from.id,
      amount: payload.totalCredits,
      paymentMethod: "telegram_stripe",
      paymentRef: payment.telegram_payment_charge_id,
      usdAmount: payment.total_amount / 100,
    });

    await ctx.reply(
      `Payment successful! +${payload.totalCredits} credits added.\n\n` +
      `Balance: ${result.newBalance} credits ($${(result.newBalance * 0.01).toFixed(2)})`
    );
  });
}
```

### Rail 2: Crypto — Unique Deposit Address Per User (Fully Automated)

**How it works**: Each user gets their own unique deposit wallet address, derived from your master wallet using HD (Hierarchical Deterministic) wallet derivation. Any crypto sent to that address is automatically credited to that user. No memos, no manual steps.

```
User taps "Pay with Crypto"
    │
    ├── Bot looks up (or creates) user's unique deposit address
    ├── Shows: "Send any amount of SOL/TON/ETH to YOUR_UNIQUE_ADDRESS"
    ├── User sends crypto whenever they want, any amount
    │
    │   [Background: Watcher monitors all user deposit addresses]
    │
    ├── Watcher detects incoming tx to a deposit address
    ├── Looks up which user owns that address (Convex query)
    ├── Converts crypto amount → USD → credits
    ├── Credits user automatically
    └── Bot DMs user: "Received 0.5 SOL → +750 credits added"
```

**Why this is better than memos:**
- Zero friction — user just sends crypto, done
- Works with any wallet app (no memo field needed)
- User can top up anytime by sending more to the same address
- No expiring payment links

#### HD Wallet Derivation (Generating Unique Addresses)

```typescript
// src/services/payments/wallet-derivation.ts
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
import { mnemonicToSeedSync } from "bip39";

// Your master mnemonic (KEEP THIS SECRET — store in env var)
const MASTER_SEED = mnemonicToSeedSync(process.env.MASTER_MNEMONIC!);

// Derive a unique Solana deposit address for a user
export function deriveSolanaAddress(userIndex: number): {
  address: string;
  // Private key stays on server — used to sweep funds to your main wallet
} {
  // BIP44 path: m/44'/501'/{userIndex}'/0'
  const path = `m/44'/501'/${userIndex}'/0'`;
  const derived = derivePath(path, MASTER_SEED.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);

  return {
    address: keypair.publicKey.toBase58(),
  };
}

// For TON: Use TonWeb HD wallet derivation
export function deriveTonAddress(userIndex: number): string {
  // TON uses a different derivation scheme
  // Use @ton/crypto mnemonicToPrivateKey with subwalletId = userIndex
  // Each user gets wallet v4r2 with unique subwalletId
  const path = `m/44'/607'/${userIndex}'/0'`;
  // ... (TON-specific derivation)
  return "EQ..."; // User's unique TON deposit address
}

// For Ethereum: Standard BIP44 derivation
import { HDNodeWallet } from "ethers";

export function deriveEthAddress(userIndex: number): string {
  const hdNode = HDNodeWallet.fromSeed(MASTER_SEED);
  const child = hdNode.derivePath(`m/44'/60'/0'/0/${userIndex}`);
  return child.address;
}
```

#### Crypto Payment Handler (Bot Side)

```typescript
// src/bot/handlers/pay-crypto.ts
import { Bot, InlineKeyboard } from "grammy";
import {
  deriveSolanaAddress,
  deriveTonAddress,
  deriveEthAddress,
} from "../../services/payments/wallet-derivation";

export function registerCryptoHandler(bot: Bot) {
  // User picked "Pay with Crypto" from /buy
  bot.callbackQuery("buy:crypto", async (ctx) => {
    await ctx.answerCallbackQuery();

    const keyboard = new InlineKeyboard()
      .text("TON", "crypto:ton").row()
      .text("SOL / USDT (Solana)", "crypto:solana").row()
      .text("ETH / USDT (Ethereum)", "crypto:ethereum").row();

    await ctx.reply("Which chain do you want to pay on?", {
      reply_markup: keyboard,
    });
  });

  // User picked a chain → show their unique deposit address
  bot.callbackQuery(/^crypto:(.+)$/, async (ctx) => {
    const chain = ctx.match![1] as "ton" | "solana" | "ethereum";
    await ctx.answerCallbackQuery();

    const telegramId = ctx.from.id;

    // Check if user already has a deposit address for this chain
    let wallet = await convex.query(api.depositWallets.getByUserAndChain, {
      telegramId,
      chain,
    });

    if (!wallet) {
      // Get next available derivation index
      const nextIndex = await convex.query(api.depositWallets.getNextIndex, {});

      // Derive unique address
      let address: string;
      if (chain === "solana") address = deriveSolanaAddress(nextIndex).address;
      else if (chain === "ton") address = deriveTonAddress(nextIndex);
      else address = deriveEthAddress(nextIndex);

      // Save to Convex
      wallet = await convex.mutation(api.depositWallets.create, {
        telegramId,
        chain,
        address,
        derivationIndex: nextIndex,
      });
    }

    const chainNames = { ton: "TON", solana: "SOL", ethereum: "ETH" };
    const chainName = chainNames[chain];

    await ctx.reply(
      `Your personal ${chainName} deposit address:\n\n` +
      `\`${wallet.address}\`\n\n` +
      `Send any amount of ${chainName} to this address.\n` +
      `Credits are added automatically (1-3 min confirmation).\n\n` +
      `Rate: $1 = 100 credits\n` +
      `This is YOUR permanent deposit address — bookmark it and top up anytime.`,
      { parse_mode: "Markdown" }
    );
  });
}
```

#### Blockchain Watcher (Fully Automated Crediting)

Runs as a background process. Monitors all user deposit addresses for incoming transactions. No memos needed — the address itself identifies the user.

```typescript
// src/services/payments/chain-watcher.ts
// Monitors all deposit addresses and auto-credits users

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export async function startSolanaWatcher() {
  const POLL_INTERVAL = 10_000; // 10 seconds
  let lastSignature: string | undefined;

  setInterval(async () => {
    try {
      // 1. Get all active deposit addresses from Convex
      const wallets = await convex.query(api.depositWallets.getAllByChain, {
        chain: "solana",
      });

      for (const wallet of wallets) {
        // 2. Fetch recent transactions for this deposit address
        const signatures = await connection.getSignaturesForAddress(
          new PublicKey(wallet.address),
          { limit: 5 }
        );

        for (const sig of signatures) {
          // 3. Skip if already processed (idempotency)
          const processed = await convex.query(api.processedChainTxs.getByHash, {
            txHash: sig.signature,
          });
          if (processed) continue;

          // 4. Get full transaction details
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!tx || tx.meta?.err) continue;

          // 5. Calculate SOL received at this address
          const accountIndex = tx.transaction.message.accountKeys.findIndex(
            (key) => key.pubkey.toBase58() === wallet.address
          );
          if (accountIndex === -1) continue;

          const preBalance = tx.meta!.preBalances[accountIndex];
          const postBalance = tx.meta!.postBalances[accountIndex];
          const solReceived = (postBalance - preBalance) / LAMPORTS_PER_SOL;

          if (solReceived <= 0) continue; // Outgoing tx or zero, skip

          // 6. Convert to USD and credits
          const solPrice = await getSolPrice(); // CoinGecko API
          const usdValue = solReceived * solPrice;
          const credits = Math.floor(usdValue * 100); // $1 = 100 credits

          if (credits < 1) continue; // Too small

          // 7. Credit the user
          await convex.mutation(api.credits.addCredits, {
            telegramId: wallet.telegramId,
            amount: credits,
            paymentMethod: "crypto_solana",
            paymentRef: sig.signature,
            usdAmount: usdValue,
          });

          // 8. Mark tx as processed
          await convex.mutation(api.processedChainTxs.create, {
            txHash: sig.signature,
            chain: "solana",
            telegramId: wallet.telegramId,
            amountCrypto: solReceived,
            amountUsd: usdValue,
            creditsCredited: credits,
          });

          // 9. Notify user
          await bot.api.sendMessage(
            wallet.telegramId,
            `Deposit received!\n\n` +
            `${solReceived.toFixed(4)} SOL (~$${usdValue.toFixed(2)})\n` +
            `+${credits} credits added to your balance.\n\n` +
            `TX: ${sig.signature}`
          );
        }
      }
    } catch (err) {
      console.error("Solana watcher error:", err);
    }
  }, POLL_INTERVAL);
}

// Live price from CoinGecko (cache for 60s)
let cachedSolPrice = { price: 0, updatedAt: 0 };

async function getSolPrice(): Promise<number> {
  if (Date.now() - cachedSolPrice.updatedAt < 60_000) return cachedSolPrice.price;

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  const data = await res.json();
  cachedSolPrice = { price: data.solana.usd, updatedAt: Date.now() };
  return cachedSolPrice.price;
}
```

**Same pattern for TON and Ethereum** — just swap the RPC client and balance parsing.

#### Sweeping Funds to Your Main Wallet

Since each user has a derived address, you'll want to periodically sweep funds to your main wallet:

```typescript
// src/services/payments/sweeper.ts
// Runs every hour — moves funds from user deposit addresses to your main wallet

export async function sweepToMainWallet() {
  const wallets = await convex.query(api.depositWallets.getAllByChain, {
    chain: "solana",
  });

  for (const wallet of wallets) {
    const balance = await connection.getBalance(new PublicKey(wallet.address));
    const solBalance = balance / LAMPORTS_PER_SOL;

    // Only sweep if balance > dust threshold (covers tx fees)
    if (solBalance < 0.01) continue;

    // Reconstruct keypair from derivation index
    const keypair = deriveFullKeypair(wallet.derivationIndex);

    // Send to main wallet, minus fee
    const fee = 0.000005; // SOL tx fee
    const sweepAmount = solBalance - fee;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(process.env.MAIN_SOL_WALLET!),
        lamports: Math.floor(sweepAmount * LAMPORTS_PER_SOL),
      })
    );

    await connection.sendTransaction(tx, [keypair]);
  }
}
```

**Production upgrade**: Use [Helius](https://helius.dev) webhooks (Solana) or [Alchemy](https://alchemy.com) (Ethereum) for instant transaction notifications instead of polling. They push to your endpoint the moment a deposit address receives funds — sub-second latency.

---

## 7. fal.ai Proxy & Markup

Every user request goes through your proxy. You deduct credits first, call fal.ai, then log the result.

```typescript
// src/services/fal.ts
import * as fal from "@fal-ai/serverless-client";
import { FAL_PRICING } from "../config/pricing";

fal.config({
  credentials: process.env.FAL_KEY!,
});

interface GenerateResult {
  success: boolean;
  resultUrl?: string;
  error?: string;
  responseTimeMs: number;
  falCostUsd: number;
}

export async function generateWithFal(
  model: string,
  input: Record<string, any>
): Promise<GenerateResult> {
  const startTime = Date.now();
  const pricing = FAL_PRICING[model];

  if (!pricing) {
    return {
      success: false,
      error: `Unknown model: ${model}`,
      responseTimeMs: 0,
      falCostUsd: 0,
    };
  }

  try {
    const result = await fal.subscribe(model, { input });
    const responseTimeMs = Date.now() - startTime;

    // Extract result URL (varies by model)
    const resultUrl =
      result.images?.[0]?.url ||
      result.video?.url ||
      result.image?.url ||
      result.output?.url;

    return {
      success: true,
      resultUrl,
      responseTimeMs,
      falCostUsd: pricing.falCostUsd,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "fal.ai request failed",
      responseTimeMs: Date.now() - startTime,
      falCostUsd: 0,
    };
  }
}
```

### The /generate Handler (Ties It All Together)

```typescript
// src/bot/handlers/generate.ts
import { Bot } from "grammy";
import { generateWithFal } from "../../services/fal";
import { FAL_PRICING } from "../../config/pricing";

export function registerGenerateHandler(bot: Bot) {
  bot.command("generate", async (ctx) => {
    const prompt = ctx.match;
    if (!prompt) {
      return ctx.reply("Usage: /generate <prompt>\nExample: /generate a cat in space");
    }

    const model = "fal-ai/flux/schnell"; // Default model
    const pricing = FAL_PRICING[model];

    // 1. Check & deduct credits
    const spend = await convex.mutation(api.credits.spendCredits, {
      telegramId: ctx.from.id,
      amount: pricing.credits,
      service: "image_gen",
      model,
      falCostUsd: pricing.falCostUsd,
    });

    if (!spend.success) {
      return ctx.reply(
        `Insufficient credits. You need ${pricing.credits} credits.\n` +
        `Your balance: ${spend.balance} credits.\n\n` +
        `Use /buy to add more credits.`
      );
    }

    // 2. Show "generating..." status
    const statusMsg = await ctx.reply("Generating your image...");

    // 3. Call fal.ai
    const result = await generateWithFal(model, {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
    });

    // 4. Handle result
    if (result.success && result.resultUrl) {
      await ctx.replyWithPhoto(result.resultUrl, {
        caption: `"${prompt}"\n\nCost: ${pricing.credits} credits | Balance: ${spend.balance} credits`,
      });

      // Log usage
      await convex.mutation(api.usage.log, {
        telegramId: ctx.from.id,
        service: "image_gen",
        model,
        prompt,
        creditsCharged: pricing.credits,
        falCostUsd: pricing.falCostUsd,
        markupPercent: ((pricing.credits * 0.01) / pricing.falCostUsd - 1) * 100,
        profitUsd: (pricing.credits * 0.01) - pricing.falCostUsd,
        responseTimeMs: result.responseTimeMs,
        status: "success",
        resultUrl: result.resultUrl,
        refunded: false,
      });
    } else {
      // Refund on failure
      await convex.mutation(api.credits.refundCredits, {
        telegramId: ctx.from.id,
        amount: pricing.credits,
        reason: `fal.ai error: ${result.error}`,
      });

      await ctx.reply(
        `Generation failed. Your ${pricing.credits} credits have been refunded.\n` +
        `Error: ${result.error}`
      );
    }

    // Delete "generating..." message
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  });
}
```

---

## 8. User Flows

### Flow 1: New User Onboarding

```
User opens bot → /start
    │
    ├── Create user in Convex (users table)
    ├── Grant 10 free trial credits
    ├── Send welcome message with commands
    └── If referral code → credit referrer 25 bonus credits
```

```typescript
// src/bot/handlers/start.ts
export function registerStartHandler(bot: Bot) {
  bot.command("start", async (ctx) => {
    const telegramId = ctx.from.id;
    const referralCode = ctx.match; // From deep link: t.me/bot?start=REF_123

    // Create or get user
    const existing = await convex.query(api.users.getByTelegramId, { telegramId });

    if (!existing) {
      // New user
      await convex.mutation(api.users.create, {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        referredBy: referralCode?.startsWith("REF_")
          ? parseInt(referralCode.replace("REF_", ""))
          : undefined,
      });

      // Grant trial credits
      await convex.mutation(api.credits.addCredits, {
        telegramId,
        amount: 10,
        paymentMethod: "trial",
        paymentRef: `trial_${telegramId}_${Date.now()}`,
        usdAmount: 0,
      });

      // Credit referrer
      if (referralCode?.startsWith("REF_")) {
        const referrerId = parseInt(referralCode.replace("REF_", ""));
        await convex.mutation(api.credits.addCredits, {
          telegramId: referrerId,
          amount: 25,
          paymentMethod: "referral_bonus",
          paymentRef: `ref_${referrerId}_${telegramId}`,
          usdAmount: 0,
        });
        await bot.api.sendMessage(referrerId, `Someone used your referral link! +25 bonus credits.`);
      }

      await ctx.reply(
        `Welcome to Clawra!\n\n` +
        `You have 10 free credits to start.\n\n` +
        `Commands:\n` +
        `/generate <prompt> — Generate an image\n` +
        `/buy — Buy more credits\n` +
        `/balance — Check your balance\n` +
        `/referral — Get your referral link (earn 25 credits per invite)\n\n` +
        `Try it: /generate a cyberpunk cityscape at sunset`
      );
    } else {
      await ctx.reply(`Welcome back! Your balance: ${await convex.query(api.credits.getBalance, { telegramId })} credits.`);
    }
  });
}
```

### Flow 2: Generate Image

```
/generate a cat in space
    │
    ├── Check credits >= 3 (FLUX Schnell)
    │   └── If not: "Insufficient credits. /buy to add more."
    ├── Deduct 3 credits (Convex mutation)
    ├── Send "Generating..." status
    ├── Call fal.ai FLUX Schnell
    │   ├── Success → Send image + log usage
    │   └── Failure → Refund 3 credits + error message
    └── Delete status message
```

### Flow 3: Buy Credits (Stripe)

```
/buy
    │
    ├── Show inline keyboard with packages
    ├── User taps "550 Credits - Popular — $4.50"
    ├── Bot sends Telegram invoice (Stripe)
    ├── User enters card → pays
    ├── Telegram confirms payment
    ├── Convex: add 550 credits, log transaction
    └── "Payment successful! +550 credits. Balance: 560 credits."
```

### Flow 4: Buy Credits (Crypto)

```
/buy → "Pay with Crypto"
    │
    ├── Choose chain: TON / SOL / ETH
    ├── Bot shows user's unique permanent deposit address
    │   (derived from master HD wallet — one per user per chain)
    ├── User sends ANY amount of crypto to their address
    │   No memo needed. No package selection needed.
    │   Just send crypto whenever they want.
    │
    │   [Background: Blockchain watcher monitors all deposit addresses]
    │
    ├── Watcher detects incoming tx to a deposit address
    ├── Looks up user by address (Convex index)
    ├── Converts crypto → USD (CoinGecko live price) → credits ($1 = 100 credits)
    ├── Credits user automatically
    └── Bot DMs user: "Received 0.5 SOL (~$75) → +7,500 credits added"
```

User can bookmark their deposit address and top up anytime — just like depositing to an exchange.

---

## 9. Anti-Abuse & Security

### Rate Limiting (Per User)

```typescript
// src/bot/middleware/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
});

export async function checkRateLimit(telegramId: number): Promise<boolean> {
  const { success } = await ratelimit.limit(`user:${telegramId}`);
  return success;
}
```

### Bot Token Security

- Store `TELEGRAM_BOT_TOKEN` in environment variables only
- Validate webhook requests with `secret_token`
- Never log or expose the token
- Rotate via BotFather `/token` if compromised

### API Key Protection

- Encrypt fal.ai keys with AES-256-GCM before storing in Convex
- Users never see your API keys — bot proxies all requests
- Set daily/monthly budget limits per key in Convex
- Monitor spend and alert if anomalous

### Crypto Payment Security

- Unique deposit address per user (HD wallet derivation) — no ambiguity on who sent what
- Idempotency check: `processedChainTxs` table prevents double-crediting same tx hash
- Funds swept from deposit addresses to your main wallet periodically
- Master mnemonic stored in env var, never in code or DB
- Live price fetched from CoinGecko with 60s cache to prevent stale conversions
- Dust threshold on sweeper prevents wasting tx fees on micro-balances

### User Banning

```typescript
bot.use(async (ctx, next) => {
  const user = await convex.query(api.users.getByTelegramId, {
    telegramId: ctx.from?.id,
  });
  if (user?.isBanned) {
    return ctx.reply("Your account has been suspended.");
  }
  await next();
});
```

---

## 10. Deployment

### Phase 1: MVP (0-100 users) — $0/month

| Service | Tier | Cost |
|---------|------|------|
| Railway | Free ($5 credit) | $0 |
| Convex | Free tier (up to 1M function calls) | $0 |
| Upstash Redis | Free (10K commands/day) | $0 |
| Sentry | Free (5K errors/month) | $0 |
| UptimeRobot | Free (50 monitors) | $0 |

### Phase 2: Growth (100-1K users) — ~$50/month

| Service | Tier | Cost |
|---------|------|------|
| Railway | Hobby | $5-20/month |
| Convex | Pro | $25/month |
| Upstash Redis | Pay-as-you-go | $5-10/month |
| Sentry | Free still works | $0 |

### Phase 3: Scale (1K+ users) — ~$150/month

| Service | Tier | Cost |
|---------|------|------|
| Fly.io | Multi-region | $20-50/month |
| Convex | Pro | $25/month |
| Upstash Redis | Pro | $30/month |
| Sentry | Team | $26/month |
| Helius (Solana webhooks) | Builder | $50/month |

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

### Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
WEBHOOK_URL=https://your-app.up.railway.app
STRIPE_PROVIDER_TOKEN=...
FAL_KEY=...
CONVEX_URL=...
TON_WALLET_ADDRESS=...
SOL_WALLET_ADDRESS=...
ETH_WALLET_ADDRESS=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_DSN=...
```

---

## 11. Admin Dashboard

### Option A: Admin Commands in Telegram (MVP)

```typescript
// src/bot/handlers/admin.ts
const ADMIN_IDS = [YOUR_TELEGRAM_ID];

bot.command("admin", async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return;

  const stats = await convex.query(api.admin.getStats, {});

  await ctx.reply(
    `ADMIN STATS\n\n` +
    `Users: ${stats.totalUsers} (${stats.activeUsers7d} active 7d)\n` +
    `Total Revenue: $${stats.totalRevenueUsd.toFixed(2)}\n` +
    `Total API Costs: $${stats.totalFalCostUsd.toFixed(2)}\n` +
    `Profit: $${stats.profitUsd.toFixed(2)} (${stats.profitMargin.toFixed(0)}%)\n\n` +
    `Today:\n` +
    `  Requests: ${stats.requestsToday}\n` +
    `  Revenue: $${stats.revenueTodayUsd.toFixed(2)}\n` +
    `  API Cost: $${stats.falCostTodayUsd.toFixed(2)}\n` +
    `  Profit: $${stats.profitTodayUsd.toFixed(2)}\n\n` +
    `Credits in circulation: ${stats.totalCreditsCirculating}`
  );
});
```

### Option B: Convex Dashboard (Built-in)

Convex has a built-in dashboard at `dashboard.convex.dev` where you can:
- View all tables and data
- Run queries manually
- Monitor function execution
- See real-time logs

This is your admin dashboard for free.

---

## 12. Revenue Projections

### Scenario: 100 Users

```
Assumptions:
- 60% free (10 requests/month) → 600 requests
- 30% Starter ($1/month)       → 3,000 requests
- 10% Power ($8/month)         → 2,000 requests

Revenue:
  30 × $1.00  = $30
  10 × $8.00  = $80
  Total        = $110/month

fal.ai Costs (avg $0.02/request):
  5,600 requests × $0.02 = $112/month

Infrastructure: $0 (free tiers)

Net: -$2/month (break-even at this scale)
```

### Scenario: 500 Users

```
Assumptions:
- 50% free
- 35% Popular ($4.50/month)
- 15% Power ($8/month)

Revenue:
  175 × $4.50  = $787.50
  75  × $8.00  = $600.00
  Total         = $1,387.50/month

fal.ai Costs:
  ~30K requests × $0.02 = $600/month

Infrastructure: ~$50/month

Net Profit: ~$737/month (53% margin)
```

### Scenario: 2,000 Users

```
Revenue:
  600 × $4.50  = $2,700
  200 × $8.00  = $1,600
  100 × $35.00 = $3,500
  Total         = $7,800/month

fal.ai Costs: ~$2,000/month
Infrastructure: ~$150/month

Net Profit: ~$5,650/month (72% margin)
Annual: ~$67,800
```

### Break-Even

With free tier infrastructure: **~5 paying users** covers fal.ai costs.
With paid infrastructure ($50/month): **~15 paying users**.

---

## 13. Marketing & Growth

### Telegram-Native Growth

1. **Referral Program** — 25 credits per invite. Deep links: `t.me/ClawraBot?start=REF_123`
2. **Telegram Channels** — Join AI art, crypto, indie hacker groups. Provide value, soft promote.
3. **Telegram Ads** — $200 minimum. Target AI/crypto channels. ~$10-20 per acquisition.

### External

4. **Product Hunt** — Launch day push. Target top 10 in AI category.
5. **X/Twitter** — Post generated images with "Made with @ClawraBot" watermark.
6. **Reddit** — r/StableDiffusion, r/SideProject, r/Telegram
7. **SEO** — Landing page at clawra.com with "AI image generation Telegram bot"

### Growth Loop

```
User generates image → Shares on social → Friends see bot name →
Friends join bot → Get 10 free credits → Try it → Buy more → Repeat
```

---

## 14. Legal & Compliance

### Required

- **Privacy Policy** — Link in /start message. Cover: data collected (Telegram ID, prompts, usage), storage (Convex, encrypted), retention (delete on request via /delete_account)
- **Terms of Service** — No illegal content generation, no abuse, credits non-refundable
- **GDPR** — `/export_data` and `/delete_account` commands
- **Telegram Bot Policy** — No spam, no impersonation, respect rate limits

### Crypto Compliance

- Check local regulations for accepting crypto payments
- Keep transaction records for tax purposes
- Consider KYC for large purchases (>$1K) depending on jurisdiction
- Use a business wallet, not personal

---

## 15. Implementation Roadmap

### Week 1: Core Bot + Convex

- [ ] Set up grammY bot with webhook
- [ ] Implement Convex schema (all tables above)
- [ ] `/start` with user creation + 10 trial credits
- [ ] `/generate` with FLUX Schnell (cheapest model)
- [ ] `/balance` command
- [ ] Credit deduction + refund on failure
- [ ] Deploy to Railway

### Week 2: Payments

- [ ] Telegram Payments (Stripe) — `/buy` flow
- [ ] Credit packages with bonus tiers
- [ ] Payment confirmation → Convex credit mutation
- [ ] Crypto wallet addresses configured
- [ ] TON watcher (poll every 15s)
- [ ] SOL/USDT watcher
- [ ] Unique memo system for matching payments

### Week 3: Polish + More Models

- [ ] Add more fal.ai models (FLUX Pro, Kling video, upscale)
- [ ] Model selection inline keyboard
- [ ] Usage history `/history`
- [ ] Referral system `/referral`
- [ ] Rate limiting via Upstash
- [ ] Error tracking via Sentry

### Week 4: Admin + Launch

- [ ] Admin commands (`/admin` stats)
- [ ] Anti-abuse (ban system, fraud detection)
- [ ] Landing page (simple Next.js on Vercel)
- [ ] Product Hunt prep
- [ ] Launch to Telegram communities
- [ ] Monitor, iterate, profit

---

## Quick Start Commands

```bash
# 1. Initialize project
mkdir clawra-telegram-bot && cd clawra-telegram-bot
npm init -y
npm install grammy @fal-ai/serverless-client convex express @upstash/redis @upstash/ratelimit
npm install -D typescript @types/node @types/express tsx

# 2. Set up Convex
npx convex init

# 3. Set up TypeScript
npx tsc --init --target es2022 --module nodenext --outDir dist

# 4. Create bot with BotFather
# → Get TELEGRAM_BOT_TOKEN

# 5. Get fal.ai key
# → https://fal.ai/dashboard/keys

# 6. Deploy
npx convex deploy
railway up
```

---

*This is a living document. Update pricing, models, and strategies as the market evolves.*
