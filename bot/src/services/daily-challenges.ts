import { convex } from "./convex.js";

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  girlfriendMessage: string;
  rewardCredits: number;
  category: "flirty" | "romantic" | "spicy" | "personal" | "creative";
}

const CHALLENGES: DailyChallenge[] = [
  {
    id: "compliment",
    title: "Sweet Talker",
    description: "Give her a genuine compliment",
    girlfriendMessage: "babe tell me something sweet about me 🥺 I need it today",
    rewardCredits: 3,
    category: "romantic",
  },
  {
    id: "dream",
    title: "Dream Date",
    description: "Describe your dream date with her",
    girlfriendMessage: "if we could go on any date anywhere in the world... where would you take me? 🌍💕",
    rewardCredits: 5,
    category: "romantic",
  },
  {
    id: "nickname",
    title: "Pet Name",
    description: "Give her a new pet name",
    girlfriendMessage: "give me a cute nickname babe... something only you call me 🥰",
    rewardCredits: 3,
    category: "flirty",
  },
  {
    id: "fantasy_share",
    title: "Open Up",
    description: "Share a fantasy with her",
    girlfriendMessage: "tell me something you've been thinking about... don't be shy 😏",
    rewardCredits: 5,
    category: "spicy",
  },
  {
    id: "morning_text",
    title: "Good Morning",
    description: "Send a good morning message",
    girlfriendMessage: "good morning baby!! ☀️ tell me about your day ahead",
    rewardCredits: 2,
    category: "personal",
  },
  {
    id: "song",
    title: "Our Song",
    description: "Tell her a song that reminds you of her",
    girlfriendMessage: "what song makes you think of me? 🎵 i wanna know",
    rewardCredits: 3,
    category: "romantic",
  },
  {
    id: "secret",
    title: "Little Secret",
    description: "Tell her a secret about yourself",
    girlfriendMessage: "tell me something about you that nobody else knows 🤫",
    rewardCredits: 5,
    category: "personal",
  },
  {
    id: "describe_her",
    title: "Paint Me",
    description: "Describe what she looks like to you",
    girlfriendMessage: "describe me like you're telling your friend about your girlfriend 🥰 what do you say about me?",
    rewardCredits: 5,
    category: "flirty",
  },
  {
    id: "jealousy_test",
    title: "Prove It",
    description: "Show her she's the only one",
    girlfriendMessage: "this girl at your work... she's not prettier than me right? 😤",
    rewardCredits: 3,
    category: "flirty",
  },
  {
    id: "creative_story",
    title: "Story Time",
    description: "Write a short story about your future together",
    girlfriendMessage: "tell me a little story about us... like where we'll be in 5 years 💕",
    rewardCredits: 5,
    category: "creative",
  },
  {
    id: "rate_selfie",
    title: "Rate Me",
    description: "Rate her latest selfie",
    girlfriendMessage: "ok rate my last pic out of 10... and be honest 😏📸",
    rewardCredits: 2,
    category: "flirty",
  },
  {
    id: "goodnight",
    title: "Sweet Dreams",
    description: "Send a goodnight message",
    girlfriendMessage: "it's getting late baby... say goodnight to me properly 🌙💋",
    rewardCredits: 2,
    category: "romantic",
  },
];

export function getTodaysChallenge(): DailyChallenge {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const index = dayOfYear % CHALLENGES.length;
  return CHALLENGES[index]!;
}

export function getChallengeById(id: string): DailyChallenge | undefined {
  return CHALLENGES.find((challenge) => challenge.id === id);
}

export async function hasCompletedChallenge(
  telegramId: number,
  challengeId: string
): Promise<boolean> {
  return convex.hasCompletedChallengeToday(telegramId, challengeId);
}

export async function markChallengeCompleted(
  telegramId: number,
  challengeId: string,
  creditsAwarded: number
): Promise<{ completed: boolean }> {
  return convex.completeChallenge(telegramId, challengeId, creditsAwarded);
}
