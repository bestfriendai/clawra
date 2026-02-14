import { convex } from "./convex.js";

export const EVENTS = {
  CHAT_SENT: "chat_sent",
  SELFIE_REQUESTED: "selfie_requested",
  SELFIE_GENERATED: "selfie_generated",
  VIDEO_REQUESTED: "video_requested",
  VOICE_REQUESTED: "voice_requested",
  CREDITS_PURCHASED: "credits_purchased",
  CHALLENGE_COMPLETED: "challenge_completed",
  FANTASY_STARTED: "fantasy_started",
  INLINE_USED: "inline_used",
  REFERRAL_SENT: "referral_sent",
  ONBOARDING_COMPLETED: "onboarding_completed",
  PROFILE_CREATED: "profile_created",
} as const;

export function trackEvent(
  telegramId: number,
  event: string,
  metadata?: Record<string, any>
): void {
  convex
    .trackAnalyticsEvent(
      telegramId,
      event,
      metadata !== undefined ? JSON.stringify(metadata) : undefined
    )
    .catch(() => {});
}
