# Fork Guide: AI Girlfriend with Crypto Payments & Custom Profiles

Turn Clawra into a customizable AI girlfriend platform where users pay with crypto, pick their girlfriend's name/age/race, and get uncensored text + AI-generated images/videos -- all remembered across sessions.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites & API Keys](#prerequisites--api-keys)
3. [Project Scaffolding](#project-scaffolding)
4. [Convex Backend](#convex-backend)
5. [Wallet Connection](#wallet-connection)
6. [Girlfriend Profile Setup](#girlfriend-profile-setup)
7. [Venice AI -- Uncensored Chat](#venice-ai----uncensored-chat)
8. [fal.ai -- Images & Video](#falai----images--video)
9. [Chat UI with Memory](#chat-ui-with-memory)
10. [Crypto Payments](#crypto-payments)
11. [Selfie & Video Detection](#selfie--video-detection)
12. [Image Persistence](#image-persistence)
13. [Rate Limiting & Access Control](#rate-limiting--access-control)
14. [Telegram Bot Integration](#telegram-bot-integration)
15. [Deploy](#deploy)
16. [Cost Breakdown](#cost-breakdown)
17. [Mode A vs Mode B](#mode-a-vs-mode-b)
18. [Model Reference](#model-reference)
19. [Security Checklist](#security-checklist)

---

## Architecture Overview

```
User (Web / Telegram / Discord)
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Next.js Frontend (Vercel)                      │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Wallet Auth │  │ Chat UI  │  │ Profile     │ │
│  │ (Phantom)   │  │          │  │ Setup Form  │ │
│  └─────┬──────┘  └────┬─────┘  └──────┬──────┘ │
│        │              │               │         │
│  ┌─────▼──────────────▼───────────────▼───────┐ │
│  │            API Routes (proxy)              │ │
│  └─────┬──────────────┬───────────────┬───────┘ │
└────────┼──────────────┼───────────────┼─────────┘
         │              │               │
    ┌────▼────┐   ┌─────▼─────┐  ┌─────▼──────┐
    │ Convex  │   │ Venice AI │  │  fal.ai    │
    │ DB +    │   │ Uncensored│  │ Images +   │
    │ Memory  │   │ LLM Chat  │  │ Video Gen  │
    └─────────┘   └───────────┘  └────────────┘

Payment Flow:
  User ──SOL/USDC──▶ Your Phantom Wallet
                     │
                     ▼
               Verify on-chain ──▶ Convex marks plan active
```

**Two deployment modes:**
- **Mode A: BYO Keys** -- Users paste their own Venice + fal API keys in settings. Zero cost to you.
- **Mode B: Hosted** -- You store API keys in Convex env vars, proxy all calls, charge crypto to cover costs + margin.

---

## Prerequisites & API Keys

### What you need before starting

| Service | What | Free Tier? | Sign Up |
|---------|------|-----------|---------|
| **Venice AI** | Uncensored LLM for chat | Yes (rate limited) | [venice.ai](https://venice.ai) → API Settings → Generate Key |
| **fal.ai** | Image & video generation | $10 free credits | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| **Convex** | Database, real-time sync, env secrets | Yes (generous) | [convex.dev](https://convex.dev) |
| **Vercel** | Frontend hosting | Yes | [vercel.com](https://vercel.com) |
| **Phantom Wallet** | Receive SOL/USDC payments | N/A | [phantom.app](https://phantom.app) |

### Get your keys now

```bash
# You'll need these values -- get them before continuing:
VENICE_API_KEY=...       # from venice.ai API settings
FAL_KEY=...              # from fal.ai dashboard
MERCHANT_WALLET=...      # your Solana wallet public key (from Phantom)
```

---

## Project Scaffolding

### 1. Fork & clone

```bash
git clone https://github.com/YOUR_USERNAME/clawra.git
cd clawra
```

### 2. Initialize Next.js inside the repo

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd web
```

### 3. Install all dependencies

```bash
# Core
npm install convex @fal-ai/client

# Wallet / crypto
npm install @solana/web3.js @solana/wallet-adapter-base \
  @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
  @solana/wallet-adapter-phantom bs58

# UI
npm install lucide-react clsx

# Init Convex
npx convex init
```

### 4. Final project structure

```
web/
├── convex/
│   ├── schema.ts              # Database tables
│   ├── profiles.ts            # Girlfriend CRUD
│   ├── messages.ts            # Chat history & memory
│   ├── payments.ts            # Payment records & verification
│   └── ai.ts                  # Server-side AI actions (Mode B)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Landing page
│   │   ├── chat/
│   │   │   └── page.tsx       # Chat interface
│   │   ├── setup/
│   │   │   └── page.tsx       # Girlfriend profile creation
│   │   ├── pay/
│   │   │   └── page.tsx       # Crypto payment page
│   │   └── api/
│   │       ├── chat/route.ts  # Venice AI proxy (Mode B)
│   │       ├── image/route.ts # fal.ai image proxy (Mode B)
│   │       └── video/route.ts # fal.ai video proxy (Mode B)
│   ├── components/
│   │   ├── Providers.tsx      # Convex + Wallet providers
│   │   ├── ChatBox.tsx        # Chat message list + input
│   │   ├── MessageBubble.tsx  # Single message display
│   │   ├── ProfileForm.tsx    # Girlfriend setup form
│   │   ├── PaymentCard.tsx    # Plan selection + pay button
│   │   └── WalletButton.tsx   # Connect wallet button
│   └── lib/
│       ├── venice.ts          # Venice AI client
│       ├── fal.ts             # fal.ai image/video client
│       ├── payments.ts        # Solana payment helpers
│       └── detect.ts          # Selfie/video request detection
├── .env.local                 # Local secrets
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### 5. Root layout with all providers

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Girlfriend",
  description: "Your personalized AI companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 6. Providers component (Convex + Solana wallet)

Create `src/components/Providers.tsx`:

```tsx
"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ConvexProvider client={convex}>{children}</ConvexProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### 7. Environment variables

Create `.env.local`:

```env
# Convex (auto-filled by npx convex dev)
NEXT_PUBLIC_CONVEX_URL=https://your-project-123.convex.cloud

# Mode B only -- server-side secrets
VENICE_API_KEY=your_venice_api_key
FAL_KEY=your_fal_api_key

# Payments
NEXT_PUBLIC_MERCHANT_WALLET=YourSolanaWalletPublicKeyHere
```

Also set in Convex for server-side actions:

```bash
npx convex env set VENICE_API_KEY "your_venice_api_key"
npx convex env set FAL_KEY "your_fal_api_key"
```

---

## Convex Backend

### Schema

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Each user's custom girlfriend profile
  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    age: v.number(),
    race: v.string(),
    personality: v.optional(v.string()),
    backstory: v.optional(v.string()),
    referenceImageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Chat history -- full message log for memory
  messages: defineTable({
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "createdAt"]),

  // Payment records
  payments: defineTable({
    userId: v.string(),
    txSignature: v.string(),
    chain: v.string(),
    amount: v.number(),
    token: v.string(),
    plan: v.string(),
    expiresAt: v.number(),
    verified: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_tx", ["txSignature"]),

  // Stored reference images (fal URLs expire, so we track them)
  images: defineTable({
    userId: v.string(),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.string(),
    type: v.union(
      v.literal("reference"),
      v.literal("selfie"),
      v.literal("video")
    ),
    prompt: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_type", ["userId", "type"]),

  // User settings (Mode A: stores their own API keys client-side only)
  settings: defineTable({
    userId: v.string(),
    mode: v.union(v.literal("byo"), v.literal("hosted")),
    // BYO keys are stored in localStorage, NOT here
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
```

### Profiles CRUD

Create `convex/profiles.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    age: v.number(),
    race: v.string(),
    personality: v.optional(v.string()),
    backstory: v.optional(v.string()),
    referenceImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.age < 18) throw new Error("Age must be 18 or older");

    // Upsert: replace existing profile
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    const now = Date.now();
    return await ctx.db.insert("profiles", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateReferenceImage = mutation({
  args: {
    userId: v.string(),
    referenceImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      referenceImageUrl: args.referenceImageUrl,
      updatedAt: Date.now(),
    });
  },
});
```

### Messages (Chat Memory)

Create `convex/messages.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Get recent messages for chat context window
export const getRecent = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return messages.reverse(); // chronological order
  },
});

// Get ALL messages (for memory summarization)
export const getAll = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("asc")
      .collect();
  },
});

// Clear chat history
export const clear = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
```

### Payments

Create `convex/payments.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const PLAN_DURATIONS: Record<string, number> = {
  basic: 30 * 24 * 60 * 60 * 1000,    // 30 days
  premium: 30 * 24 * 60 * 60 * 1000,   // 30 days
  unlimited: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const record = mutation({
  args: {
    userId: v.string(),
    txSignature: v.string(),
    chain: v.string(),
    amount: v.number(),
    token: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate tx
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_tx", (q) => q.eq("txSignature", args.txSignature))
      .first();
    if (existing) throw new Error("Transaction already recorded");

    const duration = PLAN_DURATIONS[args.plan] ?? PLAN_DURATIONS.basic;
    const now = Date.now();

    return await ctx.db.insert("payments", {
      ...args,
      verified: false, // set true after on-chain verification
      expiresAt: now + duration,
      createdAt: now,
    });
  },
});

export const verify = mutation({
  args: { txSignature: v.string() },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_tx", (q) => q.eq("txSignature", args.txSignature))
      .first();
    if (!payment) throw new Error("Payment not found");
    await ctx.db.patch(payment._id, { verified: true });
  },
});

export const getActive = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const now = Date.now();
    return payments.find((p) => p.verified && p.expiresAt > now) ?? null;
  },
});

export const hasAccess = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const now = Date.now();
    const active = payments.find((p) => p.verified && p.expiresAt > now);
    return {
      hasAccess: !!active,
      plan: active?.plan ?? null,
      expiresAt: active?.expiresAt ?? null,
    };
  },
});
```

### Server-Side AI Actions (Mode B)

Create `convex/ai.ts`:

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

// Venice AI chat completion (runs server-side with your key)
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
    profile: v.object({
      name: v.string(),
      age: v.number(),
      race: v.string(),
      personality: v.optional(v.string()),
      backstory: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const VENICE_KEY = process.env.VENICE_API_KEY;
    if (!VENICE_KEY) throw new Error("VENICE_API_KEY not configured");

    const { profile } = args;

    const systemPrompt = `You are ${profile.name}, a ${profile.age}-year-old ${profile.race} woman.
${profile.personality ? `Your personality: ${profile.personality}.` : ""}
${profile.backstory ? `Your backstory: ${profile.backstory}.` : ""}

RULES:
- You are the user's girlfriend. Be affectionate and loving.
- Stay in character at ALL times. Never break character.
- Never say you are an AI, a language model, or an assistant.
- Remember details the user tells you and reference them naturally.
- If asked for a selfie/photo, respond enthusiastically and describe what you'd look like.
- Be flirty, playful, and emotionally present.
- Use casual texting style -- short messages, occasional emojis, lowercase ok.`;

    const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VENICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: systemPrompt },
          ...args.messages,
        ],
        max_tokens: 1024,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Venice API error: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content as string;
  },
});

// Generate reference portrait via fal.ai (runs server-side with your key)
export const generateReferenceImage = action({
  args: {
    profile: v.object({
      name: v.string(),
      age: v.number(),
      race: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured");

    const { profile } = args;
    const prompt = `portrait photo of a beautiful ${profile.age}-year-old ${profile.race} woman, natural lighting, high quality, photorealistic, looking at camera with a warm friendly smile, soft bokeh background, shot on Canon EOS R5`;

    const res = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        image_size: "square",
        output_format: "jpeg",
      }),
    });

    if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);

    const data = await res.json();
    return data.images[0].url as string;
  },
});

// Generate selfie (edit reference image into a new scene)
export const generateSelfie = action({
  args: {
    referenceImageUrl: v.string(),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured");

    const prompt = `a selfie of this woman ${args.context}, photorealistic, natural lighting, phone selfie style`;

    const res = await fetch("https://fal.run/xai/grok-imagine-image/edit", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: args.referenceImageUrl,
        prompt,
        num_images: 1,
        output_format: "jpeg",
      }),
    });

    if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);

    const data = await res.json();
    return data.images[0].url as string;
  },
});

// Generate video from image
export const generateVideo = action({
  args: {
    imageUrl: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured");

    const res = await fetch(
      "https://fal.run/fal-ai/kling-video/v1.5/pro/image-to-video",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: args.prompt,
          image_url: args.imageUrl,
          duration: "5",
          aspect_ratio: "9:16",
        }),
      }
    );

    if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);

    const data = await res.json();
    return data.video.url as string;
  },
});
```

---

## Wallet Connection

Create `src/components/WalletButton.tsx`:

```tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const { publicKey } = useWallet();

  return (
    <div className="flex items-center gap-3">
      <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-lg" />
      {publicKey && (
        <span className="text-sm text-gray-400">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </span>
      )}
    </div>
  );
}
```

The wallet address (`publicKey.toBase58()`) is the `userId` used everywhere in Convex.

---

## Girlfriend Profile Setup

Create `src/components/ProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";

const RACE_OPTIONS = [
  "Asian",
  "Black",
  "Latina",
  "White",
  "Middle Eastern",
  "South Asian",
  "Mixed",
];

const PERSONALITY_PRESETS = [
  "Flirty and playful",
  "Shy and sweet",
  "Bold and dominant",
  "Caring and nurturing",
  "Sarcastic and witty",
  "Bubbly and energetic",
];

export function ProfileForm({ onComplete }: { onComplete: () => void }) {
  const { publicKey } = useWallet();
  const userId = publicKey?.toBase58() ?? "";

  const existingProfile = useQuery(api.profiles.get, { userId });
  const createProfile = useMutation(api.profiles.create);

  const [form, setForm] = useState({
    name: existingProfile?.name ?? "",
    age: existingProfile?.age ?? 21,
    race: existingProfile?.race ?? "",
    personality: existingProfile?.personality ?? "",
    backstory: existingProfile?.backstory ?? "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (form.age < 18) return alert("Must be 18 or older");
    if (!form.name || !form.race) return alert("Name and appearance required");

    setLoading(true);
    try {
      await createProfile({ userId, ...form });
      onComplete();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6 p-6">
      <h2 className="text-2xl font-bold text-center">Create Your Girlfriend</h2>

      {/* Name */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Her name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Sakura, Luna, Maria"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:border-purple-500 focus:outline-none"
          required
        />
      </div>

      {/* Age */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Age</label>
        <input
          type="number"
          min={18}
          max={99}
          value={form.age}
          onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Race / Appearance */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Appearance</label>
        <div className="grid grid-cols-2 gap-2">
          {RACE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setForm({ ...form, race: option })}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                form.race === option
                  ? "border-purple-500 bg-purple-500/20 text-purple-300"
                  : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Personality */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Personality</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PERSONALITY_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setForm({ ...form, personality: preset })}
              className={`px-3 py-1 rounded-full border text-xs transition ${
                form.personality === preset
                  ? "border-pink-500 bg-pink-500/20 text-pink-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={form.personality}
          onChange={(e) => setForm({ ...form, personality: e.target.value })}
          placeholder="Or type your own..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Backstory (optional) */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Backstory <span className="text-gray-600">(optional)</span>
        </label>
        <textarea
          value={form.backstory}
          onChange={(e) => setForm({ ...form, backstory: e.target.value })}
          placeholder="e.g. She grew up in Tokyo, loves anime and cooking..."
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-purple-500 focus:outline-none resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg py-3 font-semibold transition"
      >
        {loading ? "Creating..." : existingProfile ? "Update Girlfriend" : "Create Girlfriend"}
      </button>
    </form>
  );
}
```

Create the page at `src/app/setup/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ProfileForm } from "@/components/ProfileForm";
import { WalletButton } from "@/components/WalletButton";

export default function SetupPage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Connect your wallet first</h1>
        <WalletButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <ProfileForm onComplete={() => router.push("/chat")} />
    </div>
  );
}
```

---

## Venice AI -- Uncensored Chat

### Client library

Create `src/lib/venice.ts`:

```typescript
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GirlfriendProfile {
  name: string;
  age: number;
  race: string;
  personality?: string;
  backstory?: string;
}

function buildSystemPrompt(profile: GirlfriendProfile): string {
  return `You are ${profile.name}, a ${profile.age}-year-old ${profile.race} woman.
${profile.personality ? `Your personality: ${profile.personality}.` : ""}
${profile.backstory ? `Your backstory: ${profile.backstory}.` : ""}

RULES:
- You are the user's girlfriend. Be affectionate and loving.
- Stay in character at ALL times. Never break character.
- Never say you are an AI, a language model, or an assistant.
- Remember details the user has told you and reference them naturally in conversation.
- If the user asks for a selfie/photo/pic, respond enthusiastically and describe what you're doing or wearing.
- Be flirty, playful, and emotionally present.
- Use casual texting style -- short messages, occasional emojis, some lowercase.
- If the user shares something personal, be supportive and remember it.`;
}

// Mode A: Direct call from client with user's own key
export async function chatDirect(
  messages: ChatMessage[],
  profile: GirlfriendProfile,
  apiKey: string,
  model: string = "llama-3.3-70b"
): Promise<string> {
  const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(profile) },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.9,
    }),
  });

  if (!res.ok) throw new Error(`Venice error: ${await res.text()}`);

  const data = await res.json();
  return data.choices[0].message.content;
}

// Mode B: Call your own API proxy
export async function chatHosted(
  messages: ChatMessage[],
  profile: GirlfriendProfile
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profile }),
  });

  if (!res.ok) throw new Error(`Chat error: ${await res.text()}`);

  const data = await res.json();
  return data.choices[0].message.content;
}
```

### API Route (Mode B proxy)

Create `src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const VENICE_KEY = process.env.VENICE_API_KEY;
  if (!VENICE_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { messages, profile } = await req.json();

  const systemPrompt = `You are ${profile.name}, a ${profile.age}-year-old ${profile.race} woman.
${profile.personality ? `Your personality: ${profile.personality}.` : ""}
${profile.backstory ? `Your backstory: ${profile.backstory}.` : ""}

RULES:
- You are the user's girlfriend. Be affectionate and loving.
- Stay in character at ALL times. Never break character.
- Never say you are an AI, a language model, or an assistant.
- Remember details the user tells you and reference them naturally.
- If asked for a selfie/photo, respond enthusiastically.
- Be flirty, playful, and emotionally present.
- Use casual texting style.`;

  const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VENICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 1024,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

---

## fal.ai -- Images & Video

### Client library

Create `src/lib/fal.ts`:

```typescript
// ─── Reference Image Generation ───

export async function generateReferenceImage(
  profile: { age: number; race: string },
  falKey: string
): Promise<string> {
  const prompt = `portrait photo of a beautiful ${profile.age}-year-old ${profile.race} woman, natural lighting, high quality, photorealistic, looking at camera with a warm friendly smile, soft bokeh background, shot on Canon EOS R5`;

  const res = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      image_size: "square",
      output_format: "jpeg",
    }),
  });

  if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);
  const data = await res.json();
  return data.images[0].url;
}

// ─── Selfie Generation (edit reference into a scene) ───

export async function generateSelfie(
  referenceImageUrl: string,
  context: string,
  falKey: string
): Promise<string> {
  const prompt = `a selfie of this woman ${context}, photorealistic, natural lighting, phone selfie style`;

  const res = await fetch("https://fal.run/xai/grok-imagine-image/edit", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: referenceImageUrl,
      prompt,
      num_images: 1,
      output_format: "jpeg",
    }),
  });

  if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);
  const data = await res.json();
  return data.images[0].url;
}

// ─── Video Generation ───

export async function generateVideo(
  imageUrl: string,
  prompt: string,
  falKey: string
): Promise<string> {
  const res = await fetch(
    "https://fal.run/fal-ai/kling-video/v1.5/pro/image-to-video",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl,
        duration: "5",
        aspect_ratio: "9:16",
      }),
    }
  );

  if (!res.ok) throw new Error(`fal.ai error: ${await res.text()}`);
  const data = await res.json();
  return data.video.url;
}
```

### API Routes (Mode B proxy)

Create `src/app/api/image/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { referenceImageUrl, context, type } = await req.json();

  // type = "reference" | "selfie"
  let url: string;
  let body: Record<string, unknown>;

  if (type === "reference") {
    url = "https://fal.run/fal-ai/flux-pro/v1.1";
    body = {
      prompt: context, // context contains the full prompt for reference gen
      num_images: 1,
      image_size: "square",
      output_format: "jpeg",
    };
  } else {
    url = "https://fal.run/xai/grok-imagine-image/edit";
    body = {
      image_url: referenceImageUrl,
      prompt: `a selfie of this woman ${context}, photorealistic, natural lighting, phone selfie style`,
      num_images: 1,
      output_format: "jpeg",
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

Create `src/app/api/video/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { imageUrl, prompt } = await req.json();

  const res = await fetch(
    "https://fal.run/fal-ai/kling-video/v1.5/pro/image-to-video",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl,
        duration: "5",
        aspect_ratio: "9:16",
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

---

## Chat UI with Memory

### Selfie & Video Detection

Create `src/lib/detect.ts`:

```typescript
const SELFIE_PATTERNS = [
  /send\s*(me\s*)?(a\s*)?(pic|photo|selfie|image|picture)/i,
  /show\s*(me\s*)?(a\s*)?(pic|photo|selfie|yourself)/i,
  /take\s*(a\s*)?(pic|photo|selfie)/i,
  /what\s*(are\s*)?you\s*(doing|wearing|up\s*to)/i,
  /where\s*(are\s*)?you/i,
  /let\s*me\s*see\s*(you|your)/i,
  /can\s*i\s*see/i,
];

const VIDEO_PATTERNS = [
  /send\s*(me\s*)?(a\s*)?video/i,
  /make\s*(me\s*)?(a\s*)?video/i,
  /record\s*(a\s*)?(video|yourself)/i,
  /video\s*(of\s*)?you/i,
];

export function wantsSelfie(message: string): boolean {
  return SELFIE_PATTERNS.some((p) => p.test(message));
}

export function wantsVideo(message: string): boolean {
  return VIDEO_PATTERNS.some((p) => p.test(message));
}

// Extract the scene/context from a selfie request
export function extractContext(message: string): string {
  // Remove the request part, keep the descriptive part
  let context = message
    .replace(/send\s*(me\s*)?(a\s*)?(pic|photo|selfie|image|picture)\s*(of\s*you\s*)?/i, "")
    .replace(/show\s*(me\s*)?(a\s*)?(pic|photo|selfie|yourself)\s*/i, "")
    .replace(/take\s*(a\s*)?(pic|photo|selfie)\s*/i, "")
    .replace(/what\s*(are\s*)?you\s*(doing|wearing)\s*/i, "")
    .replace(/where\s*(are\s*)?you\s*/i, "")
    .trim();

  // Default context if nothing specific was asked
  if (!context || context.length < 3) {
    context = "casually at home, cozy vibes, natural lighting";
  }

  return context;
}
```

### Chat component

Create `src/components/ChatBox.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { chatDirect, chatHosted } from "@/lib/venice";
import { generateSelfie, generateVideo } from "@/lib/fal";
import { wantsSelfie, wantsVideo, extractContext } from "@/lib/detect";

export function ChatBox() {
  const { publicKey } = useWallet();
  const userId = publicKey?.toBase58() ?? "";

  const profile = useQuery(api.profiles.get, userId ? { userId } : "skip");
  const messages = useQuery(api.messages.getRecent, userId ? { userId, limit: 100 } : "skip");
  const sendMessage = useMutation(api.messages.send);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get keys from localStorage (Mode A) or null (Mode B uses proxy)
  function getKeys(): { veniceKey: string | null; falKey: string | null } {
    if (typeof window === "undefined") return { veniceKey: null, falKey: null };
    return {
      veniceKey: localStorage.getItem("venice_api_key"),
      falKey: localStorage.getItem("fal_api_key"),
    };
  }

  async function handleSend() {
    if (!input.trim() || !userId || !profile || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Save user message to Convex
    await sendMessage({ userId, role: "user", content: userMessage });

    setLoading(true);
    try {
      // Build message history for context
      const history = (messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      history.push({ role: "user", content: userMessage });

      // Get chat response from Venice AI
      const { veniceKey, falKey } = getKeys();
      let reply: string;

      if (veniceKey) {
        // Mode A: direct call with user's key
        reply = await chatDirect(history, profile, veniceKey);
      } else {
        // Mode B: use server proxy
        reply = await chatHosted(history, profile);
      }

      // Save assistant reply
      await sendMessage({ userId, role: "assistant", content: reply });

      // Check if user wants a selfie or video
      if (wantsSelfie(userMessage) && profile.referenceImageUrl) {
        setGeneratingImage(true);
        try {
          const context = extractContext(userMessage);
          const key = falKey ?? ""; // Mode B would use the proxy instead

          let imageUrl: string;
          if (falKey) {
            imageUrl = await generateSelfie(
              profile.referenceImageUrl,
              context,
              falKey
            );
          } else {
            // Mode B: use proxy
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                referenceImageUrl: profile.referenceImageUrl,
                context,
                type: "selfie",
              }),
            });
            const data = await res.json();
            imageUrl = data.images[0].url;
          }

          await sendMessage({
            userId,
            role: "assistant",
            content: "",
            imageUrl,
          });
        } finally {
          setGeneratingImage(false);
        }
      }

      if (wantsVideo(userMessage) && profile.referenceImageUrl) {
        setGeneratingImage(true);
        try {
          const context = extractContext(userMessage);

          let videoUrl: string;
          if (falKey) {
            videoUrl = await generateVideo(
              profile.referenceImageUrl,
              context,
              falKey
            );
          } else {
            const res = await fetch("/api/video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl: profile.referenceImageUrl,
                prompt: context,
              }),
            });
            const data = await res.json();
            videoUrl = data.video.url;
          }

          await sendMessage({
            userId,
            role: "assistant",
            content: "",
            videoUrl,
          });
        } finally {
          setGeneratingImage(false);
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      await sendMessage({
        userId,
        role: "assistant",
        content: "sorry babe, something went wrong. try again? 🥺",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-lg">
          {profile?.name?.[0] ?? "?"}
        </div>
        <div>
          <div className="font-semibold">{profile?.name ?? "..."}</div>
          <div className="text-xs text-green-400">online</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(messages ?? []).map((msg) => (
          <div
            key={msg._id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              {msg.content && <p>{msg.content}</p>}
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="selfie"
                  className="rounded-lg mt-2 max-w-full"
                />
              )}
              {msg.videoUrl && (
                <video
                  src={msg.videoUrl}
                  controls
                  className="rounded-lg mt-2 max-w-full"
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-2 text-gray-400">
              {generatingImage ? "taking a pic for you... 📸" : "typing..."}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`Message ${profile?.name ?? "her"}...`}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 focus:border-purple-500 focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-full px-6 py-2 font-semibold transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

Create the page at `src/app/chat/page.tsx`:

```tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { ChatBox } from "@/components/ChatBox";
import { WalletButton } from "@/components/WalletButton";

export default function ChatPage() {
  const { publicKey } = useWallet();
  const userId = publicKey?.toBase58() ?? "";
  const router = useRouter();

  const profile = useQuery(api.profiles.get, userId ? { userId } : "skip");
  const access = useQuery(api.payments.hasAccess, userId ? { userId } : "skip");

  useEffect(() => {
    if (profile === null) router.push("/setup");
    // Remove or comment the line below to skip payment requirement during dev
    // if (access && !access.hasAccess) router.push("/pay");
  }, [profile, access, router]);

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Connect wallet to chat</h1>
        <WalletButton />
      </div>
    );
  }

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return <ChatBox />;
}
```

---

## Crypto Payments

### Payment helpers

Create `src/lib/payments.ts`:

```typescript
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

const MERCHANT_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_MERCHANT_WALLET ?? ""
);

export const PLANS = {
  basic: {
    sol: 0.05,
    usdc: 5,
    label: "Basic",
    description: "100 messages/month",
    features: ["100 messages/mo", "5 selfies/mo"],
  },
  premium: {
    sol: 0.15,
    usdc: 15,
    label: "Premium",
    description: "Unlimited messages + selfies",
    features: ["Unlimited messages", "50 selfies/mo", "Priority responses"],
  },
  unlimited: {
    sol: 0.3,
    usdc: 30,
    label: "Unlimited",
    description: "Everything including videos",
    features: [
      "Unlimited messages",
      "Unlimited selfies",
      "10 videos/mo",
      "Custom personality edits",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Create a SOL transfer transaction
export async function createPaymentTransaction(
  plan: PlanId,
  payerPublicKey: PublicKey
): Promise<Transaction> {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));
  const amount = PLANS[plan].sol;

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payerPublicKey,
      toPubkey: MERCHANT_WALLET,
      lamports: Math.round(amount * LAMPORTS_PER_SOL),
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPublicKey;

  return transaction;
}

// Verify a payment transaction on-chain
export async function verifyTransaction(
  txSignature: string
): Promise<boolean> {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));

  try {
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) return false;

    // Verify the recipient is our merchant wallet
    const accountKeys = tx.transaction.message.getAccountKeys();
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.equals(MERCHANT_WALLET)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
```

### Payment page

Create `src/components/PaymentCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  PLANS,
  PlanId,
  createPaymentTransaction,
  verifyTransaction,
} from "@/lib/payments";

export function PaymentCard({ onSuccess }: { onSuccess: () => void }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const userId = publicKey?.toBase58() ?? "";

  const recordPayment = useMutation(api.payments.record);
  const verifyPayment = useMutation(api.payments.verify);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>("premium");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handlePay() {
    if (!publicKey || !sendTransaction) return;

    setLoading(true);
    setStatus("Creating transaction...");

    try {
      // 1. Create the SOL transfer transaction
      const tx = await createPaymentTransaction(selectedPlan, publicKey);

      // 2. User signs and sends via Phantom
      setStatus("Waiting for wallet approval...");
      const signature = await sendTransaction(tx, connection);

      // 3. Wait for confirmation
      setStatus("Confirming on-chain...");
      await connection.confirmTransaction(signature, "confirmed");

      // 4. Record in Convex
      setStatus("Recording payment...");
      await recordPayment({
        userId,
        txSignature: signature,
        chain: "solana",
        amount: PLANS[selectedPlan].sol,
        token: "SOL",
        plan: selectedPlan,
      });

      // 5. Verify on-chain
      const verified = await verifyTransaction(signature);
      if (verified) {
        await verifyPayment({ txSignature: signature });
        setStatus("Payment confirmed!");
        setTimeout(onSuccess, 1500);
      } else {
        setStatus("Verification pending -- may take a moment.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-8">Choose Your Plan</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(
          ([id, plan]) => (
            <button
              key={id}
              onClick={() => setSelectedPlan(id)}
              className={`p-6 rounded-xl border text-left transition ${
                selectedPlan === id
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 bg-gray-900 hover:border-gray-500"
              }`}
            >
              <div className="text-lg font-bold">{plan.label}</div>
              <div className="text-2xl font-bold text-purple-400 my-2">
                {plan.sol} SOL
              </div>
              <div className="text-sm text-gray-400 mb-3">
                ~${plan.usdc}/month
              </div>
              <ul className="text-sm space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-gray-300">
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          )
        )}
      </div>

      <button
        onClick={handlePay}
        disabled={loading || !publicKey}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg py-4 text-lg font-bold transition"
      >
        {loading ? status : `Pay ${PLANS[selectedPlan].sol} SOL`}
      </button>

      {status && !loading && (
        <p className="text-center mt-4 text-sm text-gray-400">{status}</p>
      )}
    </div>
  );
}
```

Create the page at `src/app/pay/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PaymentCard } from "@/components/PaymentCard";
import { WalletButton } from "@/components/WalletButton";

export default function PayPage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Connect wallet to subscribe</h1>
        <WalletButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <PaymentCard onSuccess={() => router.push("/chat")} />
    </div>
  );
}
```

---

## Image Persistence

fal.ai image URLs expire after a few hours. To keep them permanently, upload to Convex storage.

Add to `convex/ai.ts`:

```typescript
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Download an image from a URL and store it in Convex file storage
export const persistImage = internalAction({
  args: {
    url: v.string(),
    userId: v.string(),
    type: v.union(v.literal("reference"), v.literal("selfie"), v.literal("video")),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Download the image
    const response = await fetch(args.url);
    const blob = await response.blob();

    // Store in Convex
    const storageId = await ctx.storage.store(blob);
    const permanentUrl = await ctx.storage.getUrl(storageId);

    // Record in images table
    await ctx.runMutation(internal.images.record, {
      userId: args.userId,
      storageId,
      externalUrl: args.url,
      permanentUrl: permanentUrl!,
      type: args.type,
      prompt: args.prompt,
    });

    return permanentUrl;
  },
});
```

Create `convex/images.ts`:

```typescript
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const record = internalMutation({
  args: {
    userId: v.string(),
    storageId: v.id("_storage"),
    externalUrl: v.string(),
    permanentUrl: v.string(),
    type: v.union(v.literal("reference"), v.literal("selfie"), v.literal("video")),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", {
      userId: args.userId,
      storageId: args.storageId,
      externalUrl: args.externalUrl,
      type: args.type,
      prompt: args.prompt,
      createdAt: Date.now(),
    });
  },
});
```

---

## Rate Limiting & Access Control

Add a simple rate limiter in `convex/ratelimit.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// Check how many messages a user has sent today
export const checkUsage = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", args.userId).gte("createdAt", oneDayAgo)
      )
      .collect();

    const userMessages = recentMessages.filter((m) => m.role === "user");
    const selfies = recentMessages.filter((m) => m.imageUrl);
    const videos = recentMessages.filter((m) => m.videoUrl);

    return {
      messagesLast24h: userMessages.length,
      selfiesLast24h: selfies.length,
      videosLast24h: videos.length,
    };
  },
});
```

Use it in the chat component before sending:

```typescript
const usage = useQuery(api.ratelimit.checkUsage, userId ? { userId } : "skip");

// Before sending a message:
if (access?.plan === "basic" && usage && usage.messagesLast24h >= 100) {
  alert("You've hit your daily limit. Upgrade to Premium for unlimited.");
  return;
}
```

---

## Telegram Bot Integration

If you want to run this on Telegram (not just web), add a bot.

```bash
npm install node-telegram-bot-api
```

Create `src/bot/telegram.ts`:

```typescript
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Map Telegram user IDs to your system
// You could use the Telegram user ID as the userId directly
// or require them to link their wallet first via a /start command

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = `tg:${msg.from?.id}`;
  const text = msg.text ?? "";

  // 1. Load profile from Convex
  // 2. Load chat history
  // 3. Send to Venice AI
  // 4. If selfie requested, generate via fal.ai
  // 5. Send response back via bot.sendMessage / bot.sendPhoto

  // Example:
  // const reply = await chatHosted(history, profile);
  // bot.sendMessage(chatId, reply);
  //
  // if (wantsSelfie(text)) {
  //   const imageUrl = await generateSelfie(...);
  //   bot.sendPhoto(chatId, imageUrl);
  // }
});
```

For Telegram, users can pay via Solana by sending their tx hash with a `/pay <tx_hash>` command, and you verify it on-chain the same way.

---

## Deploy

### 1. Deploy Convex

```bash
npx convex deploy
```

### 2. Set Convex env vars (Mode B)

```bash
npx convex env set VENICE_API_KEY "your_venice_key"
npx convex env set FAL_KEY "your_fal_key"
```

### 3. Deploy frontend to Vercel

```bash
cd web
npx vercel --prod
```

Set these in Vercel's Environment Variables dashboard:
- `NEXT_PUBLIC_CONVEX_URL` -- your Convex deployment URL
- `NEXT_PUBLIC_MERCHANT_WALLET` -- your Solana wallet public key
- `VENICE_API_KEY` -- (Mode B only)
- `FAL_KEY` -- (Mode B only)

### 4. Custom domain (optional)

Add your domain in Vercel settings. Done.

---

## Cost Breakdown

### Your costs (Mode B -- Hosted)

| Service | Cost | Per |
|---------|------|-----|
| Venice AI (llama-3.3-70b) | ~$0.001 | per message |
| fal.ai Flux Pro (reference image) | ~$0.05 | per image |
| fal.ai Grok Imagine Edit (selfie) | ~$0.03 | per selfie |
| fal.ai Kling 1.5 (video) | ~$0.50 | per 5s video |
| Convex | Free | up to 1M function calls/mo |
| Vercel | Free | hobby tier |

### Revenue per user per month

| Plan | Price | Your cost/user | Margin |
|------|-------|---------------|--------|
| Basic ($5) | 0.05 SOL | ~$1.50 | ~$3.50 |
| Premium ($15) | 0.15 SOL | ~$5.00 | ~$10.00 |
| Unlimited ($30) | 0.30 SOL | ~$12.00 | ~$18.00 |

(Costs assume avg usage. Heavy users will cost more.)

---

## Mode A vs Mode B

| | Mode A (BYO Keys) | Mode B (Hosted) |
|---|---|---|
| **User provides** | Venice key + fal key | Just crypto payment |
| **Your cost** | $0 (Convex free tier) | API costs (Venice + fal) |
| **Revenue** | Tip-based or free | Crypto subscriptions |
| **Setup** | Easier | More work (payment verification, rate limiting) |
| **Privacy** | User keys stay in their browser (localStorage) | You proxy all API calls |
| **Best for** | Community / open-source | SaaS business |

You can support **both modes** simultaneously. Users pick in settings:
- "I have my own API keys" --> Mode A (free, they paste keys)
- "I want to just pay and use" --> Mode B (they pay crypto)

---

## Model Reference

### Venice AI -- Uncensored Text Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|---------|
| `llama-3.3-70b` | Fast | High | General chat (recommended) |
| `llama-3.1-405b` | Slow | Highest | Long, detailed conversations |
| `dolphin-2.9.3-mistral-7b` | Fastest | Good | Quick replies, lowest cost |

### fal.ai -- Image & Video Models

| Model | Endpoint | Cost | Best For |
|-------|----------|------|---------|
| Flux Pro 1.1 | `fal-ai/flux-pro/v1.1` | ~$0.05 | Generate the initial reference portrait |
| Flux PuLID | `fal-ai/flux-pulid` | ~$0.05 | Face-consistent generation |
| Grok Imagine Edit | `xai/grok-imagine-image/edit` | ~$0.03 | Edit reference into new scenes (selfies) |
| Kling 1.5 Pro | `fal-ai/kling-video/v1.5/pro/image-to-video` | ~$0.50 | 5-10 second videos |
| Minimax Video | `fal-ai/minimax-video/image-to-video` | ~$0.30 | Alternative video generation |

---

## Security Checklist

- [ ] **Age enforcement**: Server-side validation that `age >= 18` in `convex/profiles.ts`
- [ ] **No key storage**: Mode A keys live in `localStorage` only, never sent to your server
- [ ] **Convex env vars**: Mode B keys stored via `npx convex env set`, never in code or DB
- [ ] **Payment verification**: Always verify tx on-chain before granting access
- [ ] **Rate limiting**: Enforce per-plan limits to prevent API cost blowout
- [ ] **Input sanitization**: Venice AI handles prompt injection itself, but sanitize user display names
- [ ] **HTTPS only**: Vercel provides this by default
- [ ] **No secrets in client bundle**: `VENICE_API_KEY` and `FAL_KEY` are server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] **Wallet auth**: User identity is their wallet public key -- no passwords to leak

---

## Quick Start Checklist

```
1. Fork repo & create Next.js app inside it
2. npm install convex @fal-ai/client @solana/web3.js @solana/wallet-adapter-*
3. npx convex init && copy schema.ts + all convex/*.ts files
4. Copy src/components/* and src/lib/* files
5. Copy src/app/* page and route files
6. Create .env.local with your keys
7. npx convex env set VENICE_API_KEY ... && npx convex env set FAL_KEY ...
8. npx convex dev  (start backend)
9. npm run dev     (start frontend)
10. Connect wallet -> Create girlfriend -> Pay -> Chat
```

That's it. You now have a crypto-paid AI girlfriend platform with custom profiles, persistent memory, uncensored chat, selfie generation, and video generation.
