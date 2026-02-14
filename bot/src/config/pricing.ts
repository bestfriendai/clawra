export const CREDIT_COSTS = {
  CHAT_MESSAGE: 1,
  GROUP_CHAT_MESSAGE: 2,
  VOICE_NOTE: 5,
  SELFIE: 5,
  IMAGE_PRO: 15,
  IMAGE_MAX: 25,
  IMAGE_SCHNELL: 3,
  VIDEO_SHORT: 100,
  VIDEO_LONG: 150,
} as const;

export const CREDIT_PACKAGES = [
  { id: "impulse", credits: 50, priceUsd: 0.49, priceCents: 49, label: "50 credits - $0.49" },
  { id: "streak_shield_3day", credits: 0, priceUsd: 1.99, priceCents: 199, label: "Streak Shield (3 days)" },
  { id: "streak_shield_7day", credits: 0, priceUsd: 3.49, priceCents: 349, label: "Streak Shield (7 days)" },
  { id: "starter", credits: 100, priceUsd: 1.0, priceCents: 100, label: "100 credits - $1" },
  { id: "popular", credits: 550, priceUsd: 4.5, priceCents: 450, label: "550 credits - $4.50 (10% bonus)" },
  { id: "power", credits: 1250, priceUsd: 8.0, priceCents: 800, label: "1,250 credits - $8 (25% bonus)" },
  { id: "mega", credits: 7150, priceUsd: 35.0, priceCents: 3500, label: "7,150 credits - $35 (43% bonus)" },
] as const;

export const VIP_MONTHLY = {
  id: "vip_monthly",
  credits: 5000,
  priceUsd: 19.99,
  priceCents: 1999,
  label: "👑 VIP Monthly - $19.99 (Best Value!)",
  isSubscription: true,
} as const;

export const VIP_BENEFITS = {
  monthlyCredits: 5000,
  priorityGeneration: true,
  exclusivePoses: true,
  noAds: true,
  doubleStreak: true,
} as const;

export const LOW_BALANCE_THRESHOLD = 15;
export const UPSELL_INTERVAL = 10;

export const TRIAL_CREDITS = 75;
export const REFERRAL_BONUS = 25;

export const FREE_TIER = {
  dailyMessages: 10,
  dailySelfies: 1,
  dailyVoiceNotes: 0,
  nsfwImages: 0,
  videos: 0,
} as const;
