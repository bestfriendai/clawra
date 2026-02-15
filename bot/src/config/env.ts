// Load .env files for local dev; skip in Convex serverless where process.env is pre-populated
try {
  const dotenv = require("dotenv");
  const path = require("path");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* Convex runtime — env vars already available via dashboard */
}

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string = ""): string {
  return process.env[key] || fallback;
}

export const env = {
  TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_WEBHOOK_SECRET: required("TELEGRAM_WEBHOOK_SECRET"),
  WEBHOOK_URL: optional("WEBHOOK_URL"),

  STRIPE_PROVIDER_TOKEN: optional("STRIPE_PROVIDER_TOKEN"),
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),

  FAL_KEY: required("FAL_KEY"),
  VENICE_API_KEY: required("VENICE_API_KEY"),

  CONVEX_URL: required("CONVEX_URL"),

  UPSTASH_REDIS_REST_URL: optional("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: optional("UPSTASH_REDIS_REST_TOKEN"),

  MINI_APP_URL: optional("MINI_APP_URL"),

  ADMIN_TELEGRAM_IDS: optional("ADMIN_TELEGRAM_IDS", "")
    .split(",")
    .filter(Boolean)
    .map(Number),
  IMAGE_QUALITY: optional("IMAGE_QUALITY", "pro"),
  FALLBACK_STRATEGY: optional("FALLBACK_STRATEGY", "nano"),

  MASTER_MNEMONIC: optional("MASTER_MNEMONIC"),
  SOLANA_RPC_URL: optional("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"),
  MAIN_SOL_WALLET: optional("MAIN_SOL_WALLET"),

  PORT: Number(optional("PORT", "3000")),
  NODE_ENV: optional("NODE_ENV", "development"),
  FREE_MODE: optional("FREE_MODE", "false") === "true",
} as const;
