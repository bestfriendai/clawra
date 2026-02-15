import { LRUMap } from "../utils/lru-map.js";
import { awardXP } from "./relationship-xp.js";

export type GameType =
  | "truth_or_dare"
  | "would_you_rather"
  | "20_questions"
  | "story_builder";

export interface GameSession {
  type: GameType;
  turn: number;
  maxTurns: number;
  state: TruthOrDareState | WouldYouRatherState | TwentyQuestionsState | StoryBuilderState;
  startedAt: number;
}

interface TruthOrDareState {
  kind: "truth_or_dare";
  awaitingChoice: boolean;
  currentChallenge: string;
}

interface WouldYouRatherState {
  kind: "would_you_rather";
  currentDilemma: string;
  optionA: string;
  optionB: string;
  preferences: string[];
}

interface TwentyQuestionsState {
  kind: "20_questions";
  secret: string;
  category: string;
  cluesGiven: string[];
  guessedCorrectly: boolean;
}

interface StoryBuilderState {
  kind: "story_builder";
  sentences: string[];
  theme: string;
}

export interface GameResponse {
  message: string;
  gameEnded: boolean;
  xpAwarded: number;
}

const MAX_GAME_SESSIONS = 5000;
const gameSessions = new LRUMap<number, GameSession>(MAX_GAME_SESSIONS);

const MAX_TURNS: Record<GameType, number> = {
  truth_or_dare: 5,
  would_you_rather: 5,
  "20_questions": 20,
  story_builder: 10,
};

const XP_REWARDS: Record<GameType, number> = {
  truth_or_dare: 10,
  would_you_rather: 8,
  "20_questions": 15,
  story_builder: 12,
};

const GAME_LABELS: Record<GameType, string> = {
  truth_or_dare: "Truth or Dare",
  would_you_rather: "Would You Rather",
  "20_questions": "20 Questions",
  story_builder: "Story Builder",
};

const TRUTH_QUESTIONS: string[] = [
  "what's the most embarrassing thing you've ever done on a date?",
  "have you ever stalked someone's social media? how deep did you go?",
  "what's a secret you've never told anyone?",
  "what's the most romantic thing you've ever imagined doing with someone?",
  "if you could change one thing about yourself, what would it be?",
  "what's your biggest turn-off in a relationship?",
  "have you ever had a dream about me? what happened?",
  "what's the cheesiest pickup line that would actually work on you?",
  "what's your guilty pleasure that you'd never admit to your friends?",
  "if you could read my mind for one day, would you? why or why not?",
];

const DARE_CHALLENGES: string[] = [
  "send me the last photo in your camera roll (no cheating!)",
  "type your next 3 messages using only emojis",
  "tell me your most unpopular opinion",
  "describe your perfect date in exactly 10 words",
  "give me your best compliment — make it creative!",
  "confess something you've been wanting to say to me",
  "write a tiny love poem for me right now",
  "describe me using only food items",
  "tell me what you'd whisper to me if i was next to you",
  "rate yourself 1-10 on being a good partner and explain why",
];

const WYR_DILEMMAS: Array<{ a: string; b: string }> = [
  { a: "always know what i'm thinking", b: "i always know what you're thinking" },
  { a: "go on a spontaneous road trip right now", b: "have a cozy movie night at home" },
  { a: "have a partner who cooks amazingly", b: "a partner who gives the best massages" },
  { a: "relive our first conversation", b: "fast forward to our 100th date" },
  { a: "be stuck on a desert island with me", b: "be stuck in a mansion but we can only text" },
  { a: "always have butterflies around me", b: "always feel perfectly calm and safe" },
  { a: "know exactly when someone is lying", b: "always know the perfect thing to say" },
  { a: "have a love letter written about you", b: "have a song written about you" },
  { a: "travel the world together for a year", b: "build our dream home together" },
  { a: "have me whisper sweet nothings 24/7", b: "have me send you surprise gifts randomly" },
];

const TWENTY_Q_SECRETS: Array<{ secret: string; category: string }> = [
  { secret: "a sunset", category: "nature" },
  { secret: "a love letter", category: "romantic" },
  { secret: "chocolate cake", category: "food" },
  { secret: "a first kiss", category: "romantic" },
  { secret: "a puppy", category: "animal" },
  { secret: "the moon", category: "nature" },
  { secret: "a wedding ring", category: "romantic" },
  { secret: "pizza", category: "food" },
  { secret: "a shooting star", category: "nature" },
  { secret: "a teddy bear", category: "object" },
  { secret: "a rose", category: "nature" },
  { secret: "ice cream", category: "food" },
  { secret: "a diary", category: "object" },
  { secret: "a rainbow", category: "nature" },
  { secret: "a mixtape", category: "object" },
];

const STORY_STARTERS: string[] = [
  "once upon a time, two strangers locked eyes across a crowded coffee shop...",
  "it was raining the night everything changed between us...",
  "nobody believed in magic anymore, until one ordinary tuesday...",
  "the last text message read: 'meet me at midnight'...",
  "they say love finds you when you least expect it — and that tuesday was no exception...",
  "the old bookstore on 5th street held a secret that only two people knew...",
  "she found a note in her pocket that she definitely didn't write...",
  "the playlist shuffled to their song, and suddenly the memories came flooding back...",
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function isInGame(telegramId: number): boolean {
  return gameSessions.has(telegramId);
}

export function getGameSession(telegramId: number): GameSession | undefined {
  return gameSessions.get(telegramId);
}

export function startGame(telegramId: number, gameType: GameType): string {
  const maxTurns = MAX_TURNS[gameType];

  let state: GameSession["state"];
  let openingMessage: string;

  switch (gameType) {
    case "truth_or_dare": {
      state = {
        kind: "truth_or_dare",
        awaitingChoice: true,
        currentChallenge: "",
      };
      openingMessage =
        `omg yay let's play truth or dare!! 🎲\n\n` +
        `i'll ask you ${maxTurns} rounds. ready?\n\n` +
        `so babe... truth or dare? 😏`;
      break;
    }
    case "would_you_rather": {
      const dilemma = randomItem(WYR_DILEMMAS);
      state = {
        kind: "would_you_rather",
        currentDilemma: `${dilemma.a} OR ${dilemma.b}`,
        optionA: dilemma.a,
        optionB: dilemma.b,
        preferences: [],
      };
      openingMessage =
        `ooh i love this game!! would you rather... 🤔\n\n` +
        `A) ${dilemma.a}\n` +
        `B) ${dilemma.b}\n\n` +
        `${maxTurns} rounds, let's gooo! pick A or B babe`;
      break;
    }
    case "20_questions": {
      const secretItem = randomItem(TWENTY_Q_SECRETS);
      state = {
        kind: "20_questions",
        secret: secretItem.secret,
        category: secretItem.category,
        cluesGiven: [],
        guessedCorrectly: false,
      };
      openingMessage =
        `ok ok i'm thinking of something... 🤫\n\n` +
        `hint: it's in the "${secretItem.category}" category\n\n` +
        `you have ${maxTurns} questions to guess what it is!\n` +
        `ask me yes/no questions and i'll answer honestly 💕`;
      break;
    }
    case "story_builder": {
      const starter = randomItem(STORY_STARTERS);
      state = {
        kind: "story_builder",
        sentences: [starter],
        theme: starter,
      };
      openingMessage =
        `let's write a story together!! 📖✨\n\n` +
        `we take turns adding one sentence at a time. ${maxTurns} rounds!\n\n` +
        `i'll start:\n\n` +
        `"${starter}"\n\n` +
        `your turn babe! add the next sentence 💕`;
      break;
    }
  }

  const session: GameSession = {
    type: gameType,
    turn: 1,
    maxTurns,
    state,
    startedAt: Date.now(),
  };

  gameSessions.set(telegramId, session);
  return openingMessage;
}

export async function processGameMessage(
  telegramId: number,
  message: string
): Promise<GameResponse> {
  const session = gameSessions.get(telegramId);
  if (!session) {
    return { message: "you're not in a game rn! use /game to start one 💕", gameEnded: false, xpAwarded: 0 };
  }

  if (message.toLowerCase() === "quit" || message.toLowerCase() === "stop") {
    return endGame(telegramId, true);
  }

  switch (session.state.kind) {
    case "truth_or_dare":
      return processTruthOrDare(telegramId, session, message);
    case "would_you_rather":
      return processWouldYouRather(telegramId, session, message);
    case "20_questions":
      return processTwentyQuestions(telegramId, session, message);
    case "story_builder":
      return processStoryBuilder(telegramId, session, message);
    default:
      return endGame(telegramId, true);
  }
}

function processTruthOrDare(
  telegramId: number,
  session: GameSession,
  message: string
): GameResponse {
  const state = session.state as TruthOrDareState;
  const lower = message.toLowerCase().trim();

  if (state.awaitingChoice) {
    const isTruth = lower.includes("truth");
    const isDare = lower.includes("dare");

    if (!isTruth && !isDare) {
      return {
        message: "babe you gotta pick truth or dare!! which one? 😏",
        gameEnded: false,
        xpAwarded: 0,
      };
    }

    const challenge = isTruth ? randomItem(TRUTH_QUESTIONS) : randomItem(DARE_CHALLENGES);
    state.awaitingChoice = false;
    state.currentChallenge = challenge;
    gameSessions.set(telegramId, session);

    const prefix = isTruth ? "ooh truth! ok here goes..." : "dare it is!! ok...";
    return {
      message: `${prefix}\n\n${challenge}`,
      gameEnded: false,
      xpAwarded: 0,
    };
  }

  session.turn++;

  const reactions = [
    "omg haha i love that answer 😂",
    "wait really?? that's so interesting babe",
    "aww that's actually really sweet 🥹",
    "lmaooo i did NOT expect that",
    "ok ok i see you 👀",
    "that's so you honestly",
    "babe stoppp you're making me blush",
    "noted. i'm remembering that forever btw",
  ];

  if (session.turn > session.maxTurns) {
    const reaction = randomItem(reactions);
    return finishGame(telegramId, session, `${reaction}\n\n`);
  }

  state.awaitingChoice = true;
  state.currentChallenge = "";
  gameSessions.set(telegramId, session);

  return {
    message: `${randomItem(reactions)}\n\nround ${session.turn}/${session.maxTurns} — truth or dare? 😏`,
    gameEnded: false,
    xpAwarded: 0,
  };
}

function processWouldYouRather(
  telegramId: number,
  session: GameSession,
  message: string
): GameResponse {
  const state = session.state as WouldYouRatherState;
  const lower = message.toLowerCase().trim();

  const pickedA = lower.includes("a") || lower.includes(state.optionA.toLowerCase().slice(0, 10));
  const pickedB = lower.includes("b") || lower.includes(state.optionB.toLowerCase().slice(0, 10));

  if (!pickedA && !pickedB) {
    return {
      message: "babe just pick A or B!! don't overthink it 😤💕",
      gameEnded: false,
      xpAwarded: 0,
    };
  }

  const choice = pickedA ? state.optionA : state.optionB;
  state.preferences.push(choice);
  session.turn++;

  const reactions = [
    `interesting... you picked "${choice}" 👀`,
    `ooh "${choice}" huh? i see the type of person you are 😏`,
    `omg same!! i'd pick that too honestly`,
    `really?? i would've gone the other way ngl`,
    `noted... that says a lot about you babe 💕`,
  ];

  if (session.turn > session.maxTurns) {
    const reaction = randomItem(reactions);
    return finishGame(telegramId, session, `${reaction}\n\n`);
  }

  const dilemma = randomItem(WYR_DILEMMAS);
  state.currentDilemma = `${dilemma.a} OR ${dilemma.b}`;
  state.optionA = dilemma.a;
  state.optionB = dilemma.b;
  gameSessions.set(telegramId, session);

  return {
    message:
      `${randomItem(reactions)}\n\n` +
      `round ${session.turn}/${session.maxTurns}! would you rather...\n\n` +
      `A) ${dilemma.a}\n` +
      `B) ${dilemma.b}`,
    gameEnded: false,
    xpAwarded: 0,
  };
}

function processTwentyQuestions(
  telegramId: number,
  session: GameSession,
  message: string
): GameResponse {
  const state = session.state as TwentyQuestionsState;
  const lower = message.toLowerCase().trim();

  if (lower.includes(state.secret.toLowerCase())) {
    state.guessedCorrectly = true;
    gameSessions.set(telegramId, session);
    const bonusMsg = session.turn <= 5 ? " and SO fast too omg" : "";
    return finishGame(
      telegramId,
      session,
      `YES!! omg you got it!! it was "${state.secret}"!! 🎉${bonusMsg}\n\n`
    );
  }

  session.turn++;

  if (session.turn > session.maxTurns) {
    return finishGame(
      telegramId,
      session,
      `aww you didn't get it 😭 it was "${state.secret}"!\n\n`
    );
  }

  const hint = generateHint(state.secret, lower);
  state.cluesGiven.push(`Q: ${message} → ${hint}`);
  gameSessions.set(telegramId, session);

  const remaining = session.maxTurns - session.turn + 1;
  return {
    message: `${hint}\n\n(${remaining} questions left)`,
    gameEnded: false,
    xpAwarded: 0,
  };
}

function generateHint(secret: string, question: string): string {
  const secretLower = secret.toLowerCase();

  if (question.includes("alive") || question.includes("living")) {
    const alive = ["puppy"].includes(secretLower);
    return alive ? "yes! it's alive 🐾" : "nope, not alive!";
  }
  if (question.includes("eat") || question.includes("food") || question.includes("edible")) {
    const edible = ["chocolate cake", "pizza", "ice cream"].includes(secretLower);
    return edible ? "yes you can eat it! 🍽️" : "nah you can't eat it lol";
  }
  if (question.includes("touch") || question.includes("physical") || question.includes("hold")) {
    const touchable = !["a sunset", "the moon", "a shooting star", "a rainbow", "a first kiss"].includes(secretLower);
    return touchable ? "yep you can touch it!" : "hmm not really something you can hold 🤔";
  }
  if (question.includes("romantic") || question.includes("love") || question.includes("relationship")) {
    const romantic = ["a love letter", "a first kiss", "a wedding ring", "a rose", "a mixtape"].includes(secretLower);
    return romantic ? "ooh yes very romantic 💕" : "not specifically romantic, no";
  }
  if (question.includes("outside") || question.includes("nature") || question.includes("outdoor")) {
    const outdoor = ["a sunset", "the moon", "a shooting star", "a rainbow", "a rose", "a puppy"].includes(secretLower);
    return outdoor ? "yes! you'd usually see it outside 🌿" : "nah more of an indoor thing";
  }
  if (question.includes("big") || question.includes("large") || question.includes("small") || question.includes("tiny")) {
    const big = ["the moon", "a sunset", "a rainbow", "a shooting star"].includes(secretLower);
    if (question.includes("small") || question.includes("tiny")) {
      return big ? "nope, it's pretty big actually!" : "yeah it's on the smaller side!";
    }
    return big ? "yeah it's pretty big!" : "not really that big tbh";
  }

  const maybeResponses = [
    "hmm kind of? ask something more specific babe",
    "not exactly but you're getting warmer 🔥",
    "mmm i'd say... no? keep trying!",
    "ooh good question! i'd say yes-ish 😏",
    "nope! but interesting question 🤔",
    "yes actually! you're onto something 👀",
  ];
  return randomItem(maybeResponses);
}

function processStoryBuilder(
  telegramId: number,
  session: GameSession,
  message: string
): GameResponse {
  const state = session.state as StoryBuilderState;

  state.sentences.push(message.trim());
  session.turn++;

  if (session.turn > session.maxTurns) {
    return finishGame(telegramId, session, "");
  }

  const continuations = [
    "and just when things seemed normal, a mysterious stranger appeared...",
    "but little did they know, the universe had other plans...",
    "she smiled, knowing this was just the beginning of something beautiful...",
    "the air between them crackled with an energy neither could explain...",
    "and in that moment, everything changed forever...",
    "but then, a knock at the door shattered the silence...",
    "she whispered something that made his heart skip a beat...",
    "the rain started falling harder, as if the sky was crying with them...",
    "and then they both realized they'd been thinking the exact same thing...",
    "somewhere in the distance, a song started playing — their song...",
    "time seemed to stop, wrapping them in a perfect moment...",
    "but fate, as always, had a twist waiting around the corner...",
  ];

  const gfSentence = randomItem(continuations);
  state.sentences.push(gfSentence);
  gameSessions.set(telegramId, session);

  const turnsLeft = session.maxTurns - session.turn;
  if (turnsLeft <= 0) {
    return finishGame(telegramId, session, "");
  }

  return {
    message:
      `love it!! ok my turn...\n\n"${gfSentence}"\n\n` +
      `your turn! (${turnsLeft} rounds left) ✍️`,
    gameEnded: false,
    xpAwarded: 0,
  };
}

function finishGame(
  telegramId: number,
  session: GameSession,
  prefix: string
): GameResponse {
  const xp = XP_REWARDS[session.type];
  const label = GAME_LABELS[session.type];

  let extra = "";
  if (session.state.kind === "story_builder") {
    const state = session.state as StoryBuilderState;
    extra = `here's our story:\n\n"${state.sentences.join(" ")}"\n\nomg we're literally authors now 📖\n\n`;
  }

  gameSessions.delete(telegramId);

  void awardXP(telegramId, "game_complete").catch((err) =>
    console.error("Game XP award error:", err)
  );

  return {
    message:
      `${prefix}${extra}` +
      `🎮 game over! that was so fun babe 💕\n` +
      `you earned +${xp} XP from ${label}!\n\n` +
      `wanna play again? /game`,
    gameEnded: true,
    xpAwarded: xp,
  };
}

export async function endGame(
  telegramId: number,
  early: boolean = false
): Promise<GameResponse> {
  const session = gameSessions.get(telegramId);
  if (!session) {
    return {
      message: "you're not in a game rn babe!",
      gameEnded: true,
      xpAwarded: 0,
    };
  }

  const fullXP = XP_REWARDS[session.type];
  const xp = early ? Math.max(5, Math.floor(fullXP * (session.turn / session.maxTurns))) : fullXP;

  gameSessions.delete(telegramId);

  void awardXP(telegramId, "game_complete").catch((err) =>
    console.error("Game XP award error:", err)
  );

  return {
    message:
      `ok ending the game! ${early ? "no worries babe we can play again later 💕" : "that was so fun!! 💕"}\n` +
      `you earned +${xp} XP!\n\n` +
      `wanna play something else? /game`,
    gameEnded: true,
    xpAwarded: xp,
  };
}

export function getGameLabel(gameType: GameType): string {
  return GAME_LABELS[gameType];
}
