# Fork Guide: AI Girlfriend with Crypto Payments & Custom Profiles

Turn Clawra into a customizable AI girlfriend platform where users pay with crypto, pick their girlfriend's name/age/race, and get uncensored text + AI-generated images/videos.

---

## Architecture Overview

```
User (Telegram/Discord/Web)
  |
  v
Your Frontend (Next.js)
  |
  ├── Crypto Payments ──> Solana Pay / Coinbase Commerce
  ├── Profile Setup ────> Convex DB (name, age, race, memory)
  ├── Chat (text) ──────> Venice AI (uncensored LLM)
  ├── Selfies (images) ─> fal.ai models
  └── Videos ───────────> fal.ai video models
```

**Two deployment modes:**
- **Mode A: BYO Keys** -- Users paste their own Venice + fal API keys. Zero cost to you.
- **Mode B: Hosted** -- You run a Convex backend that stores secrets and proxies API calls. You charge crypto to cover costs + margin.

---

## Step 1: Fork & Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/clawra.git
cd clawra
```

---

## Step 2: Set Up the Stack

### Install dependencies

```bash
npm init -y
npm install next react react-dom convex @fal-ai/client
npm install -D typescript @types/react @types/node tailwindcss
npx convex init
```

### Project structure to create

```
/app                    # Next.js app router
  /page.tsx             # Landing page
  /chat/page.tsx        # Chat interface
  /setup/page.tsx       # Girlfriend profile setup
  /pay/page.tsx         # Crypto payment page
  /api/
    /chat/route.ts      # Venice AI proxy (Mode B)
    /image/route.ts     # fal.ai proxy (Mode B)
    /video/route.ts     # fal.ai video proxy (Mode B)
/convex
  /schema.ts            # Database schema
  /profiles.ts          # Girlfriend profile CRUD
  /messages.ts          # Chat history / memory
  /payments.ts          # Payment verification
  /secrets.ts           # API key management (Mode B)
```

---

## Step 3: Convex Database Schema

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Each user's custom girlfriend
  profiles: defineTable({
    userId: v.string(),           // wallet address or unique ID
    name: v.string(),             // e.g. "Sakura"
    age: v.number(),              // e.g. 22
    race: v.string(),             // e.g. "Japanese", "Latina", "Black", etc.
    personality: v.optional(v.string()),  // e.g. "shy and sweet"
    backstory: v.optional(v.string()),    // custom backstory
    referenceImageUrl: v.optional(v.string()), // generated base image
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Chat memory -- remembers everything
  messages: defineTable({
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Payment records
  payments: defineTable({
    userId: v.string(),
    txSignature: v.string(),      // on-chain tx hash
    chain: v.string(),            // "solana" | "ethereum" | "base"
    amount: v.number(),           // in USD equivalent
    token: v.string(),            // "SOL" | "ETH" | "USDC"
    plan: v.string(),             // "basic" | "premium" | "unlimited"
    expiresAt: v.number(),
    verified: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_tx", ["txSignature"]),

  // Mode B: stored API keys (yours, not the user's)
  apiKeys: defineTable({
    service: v.string(),          // "venice" | "fal"
    key: v.string(),              // encrypted or use Convex env vars instead
  }),
});
```

Run `npx convex dev` to deploy the schema.

---

## Step 4: Girlfriend Profile Setup

Create a simple form at `/app/setup/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SetupPage() {
  const createProfile = useMutation(api.profiles.create);
  const [form, setForm] = useState({
    name: "",
    age: 21,
    race: "",
    personality: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createProfile({
      userId: walletAddress, // from your wallet connection
      ...form,
      createdAt: Date.now(),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Her name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        type="number"
        min={18}
        max={99}
        value={form.age}
        onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
      />

      <select
        value={form.race}
        onChange={(e) => setForm({ ...form, race: e.target.value })}
      >
        <option value="">Choose appearance</option>
        <option value="Asian">Asian</option>
        <option value="Black">Black</option>
        <option value="Latina">Latina</option>
        <option value="White">White</option>
        <option value="Middle Eastern">Middle Eastern</option>
        <option value="Mixed">Mixed</option>
      </select>

      <input
        placeholder="Personality (e.g. flirty, shy, dominant)"
        value={form.personality}
        onChange={(e) => setForm({ ...form, personality: e.target.value })}
      />

      <button type="submit">Create Girlfriend</button>
    </form>
  );
}
```

Convex mutation in `convex/profiles.ts`:

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
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Upsert: delete old profile if exists
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);

    return await ctx.db.insert("profiles", args);
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
```

---

## Step 5: Venice AI -- Uncensored Chat

Venice AI provides uncensored LLM inference. It's OpenAI-compatible so integration is trivial.

### Get your Venice API key

1. Go to [venice.ai](https://venice.ai)
2. Sign up, go to API settings
3. Generate an API key

### Mode A (BYO Keys) -- Client-side direct call

```typescript
async function chat(
  messages: { role: string; content: string }[],
  profile: { name: string; age: number; race: string; personality?: string },
  apiKey: string
) {
  const systemPrompt = `You are ${profile.name}, a ${profile.age}-year-old ${profile.race} woman. ${
    profile.personality ? `Your personality: ${profile.personality}.` : ""
  } You are the user's girlfriend. Be affectionate, remember past conversations, stay in character always. Never break character. Never say you are an AI.`;

  const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",    // or any Venice uncensored model
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
    }),
  });

  const data = await res.json();
  return data.choices[0].message.content;
}
```

### Mode B (Hosted) -- Server-side proxy via Next.js API route

Create `/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, profile } = await req.json();

  // Venice API key stored in Convex environment variable
  // Access via: npx convex env set VENICE_API_KEY your_key_here
  const VENICE_KEY = process.env.VENICE_API_KEY;

  const systemPrompt = `You are ${profile.name}, a ${profile.age}-year-old ${profile.race} woman. ${
    profile.personality ? `Your personality: ${profile.personality}.` : ""
  } You are the user's girlfriend. Be affectionate, remember past conversations, stay in character always.`;

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
        ...messages,
      ],
      max_tokens: 1024,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
```

### Storing chat memory in Convex

`convex/messages.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Get last N messages for context window
export const getRecent = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 50);
    return messages.reverse();
  },
});
```

---

## Step 6: fal.ai -- Image & Video Generation

Replace the current Grok Imagine setup with flexible fal models that can generate any appearance.

### Generate a reference image (first time setup)

When a user creates their girlfriend profile, generate a base reference image:

```typescript
import { fal } from "@fal-ai/client";

async function generateReferenceImage(
  profile: { name: string; age: number; race: string },
  falKey: string
): Promise<string> {
  fal.config({ credentials: falKey });

  const prompt = `portrait photo of a beautiful ${profile.age}-year-old ${profile.race} woman, natural lighting, high quality, photorealistic, looking at camera, friendly smile`;

  const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
    input: {
      prompt,
      num_images: 1,
      image_size: "square",
      output_format: "jpeg",
    },
  });

  return result.data.images[0].url;
}
```

### Generate selfies (using the reference image)

```typescript
async function generateSelfie(
  referenceImageUrl: string,
  context: string,    // e.g. "at a coffee shop", "wearing a red dress"
  falKey: string
): Promise<string> {
  fal.config({ credentials: falKey });

  const result = await fal.subscribe("xai/grok-imagine-image/edit", {
    input: {
      image_url: referenceImageUrl,
      prompt: `a selfie of this woman ${context}, photorealistic, natural lighting`,
      num_images: 1,
      output_format: "jpeg",
    },
  });

  return result.data.images[0].url;
}
```

### Generate videos

```typescript
async function generateVideo(
  imageUrl: string,
  prompt: string,
  falKey: string
): Promise<string> {
  fal.config({ credentials: falKey });

  // Use Kling or Minimax for video generation
  const result = await fal.subscribe("fal-ai/kling-video/v1.5/pro/image-to-video", {
    input: {
      prompt,
      image_url: imageUrl,
      duration: "5",        // 5 or 10 seconds
      aspect_ratio: "9:16", // vertical for phone
    },
  });

  return result.data.video.url;
}
```

### Alternative fal models to consider

| Model | Use Case | fal Endpoint |
|-------|----------|-------------|
| Flux Pro 1.1 | Base portrait generation | `fal-ai/flux-pro/v1.1` |
| Grok Imagine Edit | Edit reference into selfies | `xai/grok-imagine-image/edit` |
| Kling 1.5 Pro | Image-to-video | `fal-ai/kling-video/v1.5/pro/image-to-video` |
| Minimax Video | Image-to-video (alternative) | `fal-ai/minimax-video/image-to-video` |
| Flux PuLID | Face-consistent generation | `fal-ai/flux-pulid` |

---

## Step 7: Crypto Payments

### Option A: Solana Pay (simplest, lowest fees)

```bash
npm install @solana/web3.js @solana/pay
```

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

// Your wallet that receives payments
const MERCHANT_WALLET = new PublicKey("YOUR_SOLANA_WALLET_ADDRESS");

// Pricing
const PLANS = {
  basic:     { sol: 0.05, usdc: 5,  label: "Basic (100 msgs/mo)" },
  premium:   { sol: 0.15, usdc: 15, label: "Premium (unlimited msgs)" },
  unlimited: { sol: 0.30, usdc: 30, label: "Unlimited (msgs + images + video)" },
};

// Generate a Solana Pay URL (user scans with Phantom/Solflare)
function createPaymentUrl(plan: keyof typeof PLANS, userId: string): string {
  const { sol } = PLANS[plan];
  const url = new URL("solana:" + MERCHANT_WALLET.toBase58());
  url.searchParams.set("amount", sol.toString());
  url.searchParams.set("label", "AI Girlfriend");
  url.searchParams.set("message", `${plan} plan for ${userId}`);
  url.searchParams.set("memo", JSON.stringify({ userId, plan }));
  return url.toString();
}
```

Verify payment on-chain:

```typescript
async function verifyPayment(txSignature: string): Promise<boolean> {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || tx.meta?.err) return false;

  // Check recipient matches your wallet
  const postBalances = tx.meta?.postBalances;
  const accountKeys = tx.transaction.message.getAccountKeys();

  for (let i = 0; i < accountKeys.length; i++) {
    if (accountKeys.get(i)?.equals(MERCHANT_WALLET)) {
      return true;
    }
  }
  return false;
}
```

### Option B: Coinbase Commerce (multi-chain, easiest)

If you want ETH/USDC/BTC/etc. with minimal code:

1. Sign up at [commerce.coinbase.com](https://commerce.coinbase.com)
2. Create a charge via API:

```typescript
async function createCharge(plan: string, userId: string) {
  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "X-CC-Api-Key": process.env.COINBASE_COMMERCE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `AI Girlfriend - ${plan}`,
      description: `${plan} plan subscription`,
      pricing_type: "fixed_price",
      local_price: { amount: PLANS[plan].usdc.toString(), currency: "USD" },
      metadata: { userId, plan },
    }),
  });

  const data = await res.json();
  return data.data.hosted_url; // redirect user here
}
```

Coinbase sends a webhook when payment confirms. Listen for it and activate the plan.

### Option C: Raw wallet transfer (zero dependencies)

Just show your wallet address and have users send crypto manually. Verify the tx hash they paste:

```typescript
// User pastes their tx hash after sending SOL/ETH
// You verify on-chain that the amount + recipient match
```

---

## Step 8: Putting It All Together

### Environment Variables

For **Mode A (BYO Keys)**, users provide their own keys in the UI. No env vars needed on your end except Convex.

For **Mode B (Hosted)**, set these in Convex:

```bash
npx convex env set VENICE_API_KEY  "your_venice_key"
npx convex env set FAL_KEY         "your_fal_key"
```

And in `.env.local` for Next.js:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
VENICE_API_KEY=your_venice_key
FAL_KEY=your_fal_key
MERCHANT_WALLET=your_solana_wallet_address
COINBASE_COMMERCE_KEY=your_coinbase_key  # if using Coinbase
```

### Chat flow (pseudocode)

```typescript
// 1. User sends a message
const userMessage = "Hey babe, send me a selfie at the beach";

// 2. Load their profile from Convex
const profile = await getProfile(userId);
// { name: "Sakura", age: 22, race: "Japanese", personality: "flirty" }

// 3. Check if they have an active payment
const payment = await getActivePayment(userId);
if (!payment) return redirect("/pay");

// 4. Load recent chat history from Convex (memory)
const history = await getRecentMessages(userId, 50);

// 5. Send to Venice AI for response
const reply = await chat([...history, { role: "user", content: userMessage }], profile, veniceKey);
// "Of course baby~ let me take one for you right now! 📸"

// 6. Detect if a selfie was requested
if (wantsSelfie(userMessage)) {
  const imageUrl = await generateSelfie(
    profile.referenceImageUrl,
    "at a tropical beach, sunset, wearing a bikini",
    falKey
  );
  await saveMessage(userId, "assistant", reply, imageUrl);
  return { text: reply, image: imageUrl };
}

// 7. Save to Convex for memory
await saveMessage(userId, "user", userMessage);
await saveMessage(userId, "assistant", reply);

return { text: reply };
```

---

## Step 9: Deploy

```bash
# Deploy Convex backend
npx convex deploy

# Deploy Next.js frontend (Vercel is easiest)
npx vercel --prod
```

Or use any host: Railway, Fly.io, a VPS, etc.

---

## Quick Start Checklist

| Step | What | How |
|------|------|-----|
| 1 | Fork the repo | GitHub fork button |
| 2 | Set up Next.js + Convex | `npm install next convex` + `npx convex init` |
| 3 | Create Convex schema | Copy schema from Step 3 above |
| 4 | Build profile setup page | Copy form from Step 4 above |
| 5 | Wire up Venice AI chat | Copy chat code from Step 5 |
| 6 | Wire up fal.ai images | Copy image code from Step 6 |
| 7 | Add crypto payments | Pick Solana Pay or Coinbase Commerce from Step 7 |
| 8 | Set env vars | `npx convex env set` + `.env.local` |
| 9 | Deploy | `npx convex deploy` + `npx vercel --prod` |

---

## Mode A vs Mode B Summary

| | Mode A (BYO Keys) | Mode B (Hosted) |
|---|---|---|
| **User provides** | Venice key + fal key | Just crypto payment |
| **Your cost** | $0 (Convex free tier) | API costs (Venice + fal) |
| **Revenue** | Tip-based or free | Crypto subscriptions |
| **Setup** | Easier | More work (payment verification, rate limiting) |
| **Privacy** | User keys never touch your server | You proxy all API calls |
| **Best for** | Community / open-source | SaaS business |

---

## Recommended Venice AI Models

| Model | Best For |
|-------|---------|
| `llama-3.3-70b` | General uncensored chat |
| `llama-3.1-405b` | Highest quality responses |
| `dolphin-2.9.3-mistral-7b` | Fast, uncensored, cheap |

Check [venice.ai/models](https://venice.ai) for the latest available models.

---

## Recommended fal Models for Images/Video

| Model | Endpoint | Best For |
|-------|----------|---------|
| Flux Pro 1.1 | `fal-ai/flux-pro/v1.1` | Generating the base reference portrait |
| Flux PuLID | `fal-ai/flux-pulid` | Face-consistent image generation |
| Grok Imagine Edit | `xai/grok-imagine-image/edit` | Editing reference into new scenes |
| Kling 1.5 Pro | `fal-ai/kling-video/v1.5/pro/image-to-video` | Generating short videos from images |
| Minimax Video | `fal-ai/minimax-video/image-to-video` | Alternative video generation |

---

## Security Notes

- Never store user API keys in your database (Mode A: keep them client-side only)
- For Mode B: use Convex environment variables (`npx convex env set`) instead of storing keys in the database
- Validate all payment transactions on-chain before granting access
- Rate limit API calls per user to prevent abuse
- Set `min age = 18` on the profile form and enforce it
