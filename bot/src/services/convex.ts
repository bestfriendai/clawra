import { ConvexHttpClient } from "convex/browser";
import { env } from "../config/env.js";

const client = new ConvexHttpClient(env.CONVEX_URL);

export interface LeaderboardEntry {
  telegramId: number;
  count: number;
  profileName: string;
}

export interface Badge {
  telegramId: number;
  badgeId: string;
  earnedAt: number;
  badgeName: string;
  badgeEmoji: string;
}

export interface RelationshipEvent {
  telegramId: number;
  eventType: string;
  eventDate: number;
  description: string;
  isRecurring: boolean;
}

export interface ReferralStats {
  totalReferrals: number;
  totalCreditsEarned: number;
  activeReferrals: number;
}

export interface TopReferrer {
  telegramId: number;
  displayName: string;
  referralCount: number;
  creditsEarned: number;
}

export interface SavedImage {
  _id: string;
  telegramId: number;
  imageUrl: string;
  prompt?: string;
  category: string;
  isFavorite: boolean;
  isNsfw: boolean;
  createdAt: number;
}

export interface SubscriptionRecord {
  _id: string;
  telegramId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: number;
  plan: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  telegramId: number;
  morningMessages?: boolean;
  goodnightMessages?: boolean;
  proactivePhotos?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  timezone?: string;
  missYouEnabled?: boolean;
  missYouHourUtc?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Helper to call Convex functions by string path (works without generated API types)
function query(path: string, args: Record<string, unknown> = {}) {
  return (client as any).query(path, args);
}
function mutation(path: string, args: Record<string, unknown> = {}) {
  return (client as any).mutation(path, args);
}

export const convex = {
  // Users
  getUser: (telegramId: number) =>
    query("users:getByTelegramId", { telegramId }),
  createUser: (args: {
    telegramId: number;
    username?: string;
    firstName?: string;
    referredBy?: number;
  }) => mutation("users:create", args),
  updateLastActive: (telegramId: number) =>
    mutation("users:updateLastActive", { telegramId }),
  getInactiveUsers: (thresholdMs: number): Promise<any[]> =>
    query("users:getInactive", { thresholdMs }),

  recordReferral: (referrerTelegramId: number, referredTelegramId: number) =>
    mutation("referrals:recordReferral", { referrerTelegramId, referredTelegramId }),
  getReferralCount: (telegramId: number): Promise<number> =>
    query("referrals:getReferralCount", { telegramId }),
  getReferralStats: (telegramId: number): Promise<ReferralStats> =>
    query("referrals:getReferralStats", { telegramId }),
  getTopReferrers: (limit = 5): Promise<TopReferrer[]> =>
    query("referrals:getTopReferrers", { limit }),

  // Girlfriend Profiles
  getProfile: (telegramId: number) =>
    query("girlfriendProfiles:get", { telegramId }),
  getActiveProfile: (telegramId: number) =>
    query("girlfriendProfiles:get", { telegramId }),
  getAllProfiles: (telegramId: number): Promise<any[]> =>
    query("girlfriendProfiles:getAll", { telegramId }),
  switchActiveProfile: (telegramId: number, profileId: string) =>
    mutation("girlfriendProfiles:switchActive", { telegramId, profileId }),
  getProfileCount: (telegramId: number): Promise<number> =>
    query("girlfriendProfiles:getCount", { telegramId }),
  createProfile: (args: {
    telegramId: number;
    name: string;
    age: number;
    race: string;
    bodyType: string;
    hairColor: string;
    hairStyle: string;
    eyeColor?: string;
    personality: string;
    backstory?: string;
  }) => mutation("girlfriendProfiles:create", args),
  updateProfile: (args: {
    telegramId: number;
    name?: string;
    age?: number;
    race?: string;
    bodyType?: string;
    hairColor?: string;
    hairStyle?: string;
    eyeColor?: string;
    personality?: string;
    backstory?: string;
    voiceId?: string;
    referenceImageUrl?: string;
    isConfirmed?: boolean;
  }) => mutation("girlfriendProfiles:update", args),
  confirmProfile: (telegramId: number, referenceImageUrl: string) =>
    mutation("girlfriendProfiles:setConfirmed", {
      telegramId,
      referenceImageUrl,
    }),

  // Credits
  getBalance: (telegramId: number): Promise<number> =>
    query("credits:getBalance", { telegramId }),
  initCredits: (telegramId: number, initialBalance: number) =>
    mutation("credits:initCredits", { telegramId, initialBalance }),
  spendCredits: (args: {
    telegramId: number;
    amount: number;
    service: string;
    model?: string;
    falCostUsd?: number;
  }) => mutation("credits:spendCredits", args),
  addCredits: (args: {
    telegramId: number;
    amount: number;
    paymentMethod: string;
    paymentRef: string;
  }): Promise<number> => mutation("credits:addCredits", args),
  refundCredits: (telegramId: number, amount: number, service: string) =>
    mutation("credits:refundCredits", {
      telegramId,
      amount,
      service,
    }),

  upsertSubscription: (args: {
    telegramId: number;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: number;
    plan: string;
  }) => mutation("subscriptions:upsert", args),
  getSubscriptionByTelegramId: (
    telegramId: number
  ): Promise<SubscriptionRecord | null> =>
    query("subscriptions:getByTelegramId", { telegramId }),
  getSubscriptionByStripeSubscriptionId: (
    stripeSubscriptionId: string
  ): Promise<SubscriptionRecord | null> =>
    query("subscriptions:getByStripeSubscriptionId", { stripeSubscriptionId }),
  updateSubscriptionByStripeSubscriptionId: (args: {
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: number;
  }) => mutation("subscriptions:updateByStripeSubscriptionId", args),
  cancelSubscriptionByTelegramId: (telegramId: number) =>
    mutation("subscriptions:cancelByTelegramId", { telegramId }),
  isSubscriptionActive: (telegramId: number): Promise<boolean> =>
    query("subscriptions:isActive", { telegramId }),

  // Messages
  addMessage: (args: {
    telegramId: number;
    role: string;
    content: string;
    imageUrl?: string;
    videoUrl?: string;
    voiceUrl?: string;
  }) => mutation("messages:addMessage", args),
  getRecentMessages: (telegramId: number, limit?: number): Promise<any[]> =>
    query("messages:getRecent", { telegramId, limit }),

  saveImage: (
    telegramId: number,
    imageUrl: string,
    prompt?: string,
    category?: string,
    isNsfw?: boolean
  ): Promise<string> =>
    mutation("savedImages:saveImage", {
      telegramId,
      imageUrl,
      prompt,
      category,
      isNsfw,
    }),
  getUserImages: (
    telegramId: number,
    limit?: number,
    category?: string
  ): Promise<SavedImage[]> => query("savedImages:getUserImages", { telegramId, limit, category }),
  getUserFavorites: (telegramId: number): Promise<SavedImage[]> =>
    query("savedImages:getUserFavorites", { telegramId }),
  toggleFavorite: (
    imageId: string
  ): Promise<{ ok: boolean; isFavorite?: boolean }> =>
    mutation("savedImages:toggleFavorite", { imageId }),
  getImageCategories: (
    telegramId: number
  ): Promise<Array<{ category: string; count: number }>> =>
    query("savedImages:getCategories", { telegramId }),
  getImageCount: (telegramId: number, category?: string): Promise<number> =>
    query("savedImages:getImageCount", { telegramId, category }),

  // Transactions
  getRecentTransactions: (telegramId: number, limit?: number): Promise<any[]> =>
    query("transactions:getRecentByUser", { telegramId, limit }),

  // Usage
  logUsage: (args: {
    telegramId: number;
    service: string;
    model: string;
    prompt?: string;
    creditsCharged: number;
    falCostUsd?: number;
    status: string;
    resultUrl?: string;
  }) => mutation("usage:log", args),

  // Admin
  getStats: (): Promise<any> => query("admin:getStats"),
  getDetailedStats: (): Promise<any> => query("admin:getDetailedStats"),
  getActiveUsersWithProfiles: (): Promise<
    Array<{ telegramId: number; lastActive: number; profileName: string }>
  > => query("admin:getActiveUsersWithProfiles"),

  // Deposit Wallets
  getDepositWallet: (telegramId: number, chain: string) =>
    query("depositWallets:getByTelegramId", { telegramId, chain }),
  getWalletByAddress: (address: string) =>
    query("depositWallets:getByAddress", { address }),
  getAllWalletsByChain: (chain: string): Promise<any[]> =>
    query("depositWallets:getAllByChain", { chain }),
  getNextWalletIndex: (): Promise<number> =>
    query("depositWallets:getNextIndex"),
  createDepositWallet: (args: {
    telegramId: number;
    chain: string;
    address: string;
    derivationIndex: number;
  }) => mutation("depositWallets:create", args),

  // Memory Facts
  getMemoryFacts: (telegramId: number): Promise<any[]> =>
    query("memoryFacts:getByTelegramId", { telegramId }),
  getRecentMemoryFacts: (telegramId: number, limit?: number): Promise<any[]> =>
    query("memoryFacts:getRecentFacts", { telegramId, limit }),
  getMemoryFactsByCategory: (telegramId: number, category: string): Promise<any[]> =>
    query("memoryFacts:getFactsByCategory", { telegramId, category }),
  addMemoryFacts: (telegramId: number, facts: string[]) =>
    mutation("memoryFacts:addFacts", { telegramId, facts }),
  addCategorizedMemoryFact: (
    telegramId: number,
    category: string,
    fact: string,
    confidence: number
  ) => mutation("memoryFacts:addCategorizedFact", {
    telegramId,
    category,
    fact,
    confidence,
  }),
  clearMemory: (telegramId: number) =>
    mutation("memoryFacts:clearForUser", { telegramId }),

  // Processed Chain Txs
  getProcessedTx: (txHash: string) =>
    query("processedChainTxs:getByHash", { txHash }),
  createProcessedTx: (args: {
    txHash: string;
    chain: string;
    telegramId: number;
    amountCrypto: number;
    amountUsd: number;
    creditsCredited: number;
  }) => mutation("processedChainTxs:create", args),
  getRetentionState: (telegramId: number): Promise<any> =>
    query("retention:getState", { telegramId }),
  upsertRetentionState: (args: {
    telegramId: number;
    streak: number;
    lastChatDate: string;
    messageCount: number;
    stage: string;
    lastJealousyTrigger?: number;
    lastCliffhanger?: number;
  }) => mutation("retention:upsertState", args),

  completeChallenge: (
    telegramId: number,
    challengeId: string,
    creditsAwarded: number
  ): Promise<{ completed: boolean }> =>
    mutation("challenges:completeChallenge", {
      telegramId,
      challengeId,
      creditsAwarded,
    }),
  hasCompletedChallengeToday: (
    telegramId: number,
    challengeId: string
  ): Promise<boolean> => query("challenges:hasCompletedToday", { telegramId, challengeId }),
  getUserChallengeCount: (telegramId: number): Promise<number> =>
    query("challenges:getUserChallengeCount", { telegramId }),
  getLeaderboard: (): Promise<LeaderboardEntry[]> => query("challenges:getLeaderboard"),

  awardBadge: (
    telegramId: number,
    badgeId: string,
    badgeName: string,
    badgeEmoji: string
  ): Promise<{ awarded: boolean }> =>
    mutation("achievements:awardBadge", {
      telegramId,
      badgeId,
      badgeName,
      badgeEmoji,
    }),
  getUserBadges: (telegramId: number): Promise<Badge[]> =>
    query("achievements:getUserBadges", { telegramId }),

  trackAnalyticsEvent: (
    telegramId: number,
    event: string,
    metadata?: string
  ): Promise<void> =>
    mutation("analytics:trackEvent", {
      telegramId,
      event,
      metadata,
      timestamp: Date.now(),
    }),
  getAnalyticsEventCounts: (
    startTimestamp: number,
    endTimestamp: number
  ): Promise<Array<{ event: string; count: number }>> =>
    query("analytics:getEventCounts", { startTimestamp, endTimestamp }),
  getAnalyticsSummary: async (): Promise<{
    dailyActiveUsers: number;
    revenueMetrics: {
      totalRevenue: number;
      arpu: number;
      revenueByDay: Array<{ day: string; revenue: number }>;
    };
  }> => {
    const [dailyActiveUsers, revenueMetrics] = await Promise.all([
      query("analytics:getDailyActiveUsers", { days: 7 }),
      query("analytics:getRevenueMetrics"),
    ]);

    return { dailyActiveUsers, revenueMetrics };
  },

  addRelationshipEvent: (
    telegramId: number,
    eventType: string,
    description: string,
    isRecurring = true
  ) =>
    mutation("relationshipEvents:addEventPublic", {
      telegramId,
      eventType,
      eventDate: Date.now(),
      description,
      isRecurring,
    }),
  getUserRelationshipEvents: (telegramId: number): Promise<RelationshipEvent[]> =>
    query("relationshipEvents:getUserEventsPublic", { telegramId }),
  getUpcomingAnniversaries: (telegramId: number): Promise<RelationshipEvent[]> =>
    query("relationshipEvents:getUpcomingAnniversariesPublic", { telegramId }),
  getRelationshipEventsByType: (
    telegramId: number,
    eventType: string
  ): Promise<RelationshipEvent[]> =>
    query("relationshipEvents:getEventsByTypePublic", { telegramId, eventType }),

  // Session State
  getSessionValue: (telegramId: number, key: string): Promise<string | null> =>
    query("sessionState:get", { telegramId, key }),
  setSessionValue: (telegramId: number, key: string, value: string) =>
    mutation("sessionState:set", { telegramId, key, value }),
  getAllSessionValues: (telegramId: number): Promise<Record<string, string>> =>
    query("sessionState:getAll", { telegramId }),

  getUserPreferences: (telegramId: number): Promise<UserPreferences> =>
    query("userPreferences:getPreferences", { telegramId }),
  updateUserPreferences: (
    telegramId: number,
    preferences: Partial<
      Pick<
        UserPreferences,
        | "morningMessages"
        | "goodnightMessages"
        | "proactivePhotos"
        | "quietHoursStart"
        | "quietHoursEnd"
        | "timezone"
        | "missYouEnabled"
        | "missYouHourUtc"
      >
    >
  ) =>
    mutation("userPreferences:updatePreferences", {
      telegramId,
      preferences,
    }),
};
