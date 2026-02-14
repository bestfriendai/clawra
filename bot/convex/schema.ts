import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    telegramId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    tier: v.string(), // "free" | "basic" | "premium"
    referredBy: v.optional(v.number()),
    isBanned: v.boolean(),
    createdAt: v.number(),
    lastActive: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  girlfriendProfiles: defineTable({
    telegramId: v.number(),
    isActive: v.optional(v.boolean()),
    slotIndex: v.optional(v.float64()),
    name: v.string(),
    age: v.number(),
    race: v.string(),
    bodyType: v.string(),
    hairColor: v.string(),
    hairStyle: v.string(),
    eyeColor: v.optional(v.string()),
    personality: v.string(),
    backstory: v.optional(v.string()),
    referenceImageUrl: v.optional(v.string()),
    lastImageUrl: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    creationMethod: v.optional(v.string()),
    uploadedPhotoUrls: v.optional(v.array(v.string())),
    distinctiveFeatures: v.optional(v.string()),
    isConfirmed: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_telegramId", ["telegramId"])
    .index("by_user_active", ["telegramId", "isActive"]),

  userPreferences: defineTable({
    telegramId: v.number(),
    morningMessages: v.optional(v.boolean()),
    goodnightMessages: v.optional(v.boolean()),
    proactivePhotos: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.number()),
    quietHoursEnd: v.optional(v.number()),
    timezone: v.optional(v.string()),
    missYouEnabled: v.optional(v.boolean()),
    missYouHourUtc: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  credits: defineTable({
    telegramId: v.number(),
    balance: v.number(),
    lifetimeSpent: v.number(),
    lifetimePurchased: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  transactions: defineTable({
    telegramId: v.number(),
    type: v.string(), // "purchase" | "spend" | "refund" | "bonus"
    amount: v.number(),
    balanceAfter: v.number(),
    paymentMethod: v.optional(v.string()),
    paymentRef: v.optional(v.string()),
    service: v.optional(v.string()),
    model: v.optional(v.string()),
    falCostUsd: v.optional(v.number()),
    profitUsd: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_telegramId", ["telegramId"])
    .index("by_paymentRef", ["paymentRef"]),

  subscriptions: defineTable({
    telegramId: v.number(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    plan: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_telegramId", ["telegramId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  messages: defineTable({
    telegramId: v.number(),
    role: v.string(), // "user" | "assistant" | "system"
    content: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    voiceUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_telegramId_createdAt", ["telegramId", "createdAt"]),

  retentionStates: defineTable({
    telegramId: v.number(),
    streak: v.number(),
    lastChatDate: v.string(),
    messageCount: v.number(),
    stage: v.string(),
    lastJealousyTrigger: v.optional(v.number()),
    lastCliffhanger: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  usageLogs: defineTable({
    telegramId: v.number(),
    service: v.string(),
    model: v.string(),
    prompt: v.optional(v.string()),
    creditsCharged: v.number(),
    falCostUsd: v.optional(v.number()),
    status: v.string(),
    resultUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  depositWallets: defineTable({
    telegramId: v.number(),
    chain: v.string(),
    address: v.string(),
    derivationIndex: v.number(),
    createdAt: v.number(),
  })
    .index("by_telegramId", ["telegramId"])
    .index("by_address", ["address"])
    .index("by_chain", ["chain"]),

  memoryFacts: defineTable({
    telegramId: v.number(),
    fact: v.string(),
    category: v.optional(v.string()),
    confidence: v.optional(v.number()),
    extractedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_telegramId", ["telegramId"]),

  processedChainTxs: defineTable({
    txHash: v.string(),
    chain: v.string(),
    telegramId: v.number(),
    amountCrypto: v.number(),
    amountUsd: v.number(),
    creditsCredited: v.number(),
    createdAt: v.number(),
  }).index("by_txHash", ["txHash"]),

  botInstances: defineTable({
    ownerTelegramId: v.number(),
    botToken: v.string(), // TODO: encrypt in production
    botUsername: v.optional(v.string()),
    girlfriendName: v.optional(v.string()),
    girlfriendPersonality: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
    totalUsers: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerTelegramId", ["ownerTelegramId"])
    .index("by_botToken", ["botToken"]),

  challengeCompletions: defineTable({
    telegramId: v.number(),
    challengeId: v.string(),
    completedAt: v.number(),
    creditsAwarded: v.number(),
  })
    .index("by_user", ["telegramId"])
    .index("by_challenge_date", ["challengeId", "completedAt"]),

  achievements: defineTable({
    telegramId: v.number(),
    badgeId: v.string(),
    earnedAt: v.number(),
    badgeName: v.string(),
    badgeEmoji: v.string(),
  }).index("by_user", ["telegramId"]),

  analyticsEvents: defineTable({
    telegramId: v.number(),
    event: v.string(),
    metadata: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_event", ["event", "timestamp"])
    .index("by_user", ["telegramId", "timestamp"]),

  relationshipEvents: defineTable({
    telegramId: v.number(),
    eventType: v.string(),
    eventDate: v.number(),
    description: v.string(),
    isRecurring: v.boolean(),
  }).index("by_user", ["telegramId"]),

  referrals: defineTable({
    referrerTelegramId: v.number(),
    referredTelegramId: v.number(),
    creditsAwarded: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed")),
    createdAt: v.number(),
  })
    .index("by_referrer", ["referrerTelegramId"])
    .index("by_referred", ["referredTelegramId"]),

  sessionState: defineTable({
    telegramId: v.number(),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_user_key", ["telegramId", "key"]),

  savedImages: defineTable({
    telegramId: v.number(),
    imageUrl: v.string(),
    prompt: v.optional(v.string()),
    category: v.string(),
    isFavorite: v.boolean(),
    isNsfw: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["telegramId", "createdAt"])
    .index("by_user_category", ["telegramId", "category"])
    .index("by_user_favorites", ["telegramId", "isFavorite"]),
});
