import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { chatWithGirlfriend } from "../../services/venice.js";
import { convex } from "../../services/convex.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";

interface FantasyScenario {
  key: string;
  label: string;
  emoji: string;
  introPrompt: (name: string) => string;
  systemAugment: string;
}

const FANTASY_SCENARIOS: FantasyScenario[] = [
  {
    key: "girlfriend",
    label: "Girlfriend Experience",
    emoji: "💋",
    introPrompt: (name) =>
      `You are now in "Girlfriend Experience" mode. Generate a sweet, intimate intro message as ${name} who just came home to her boyfriend after a long day apart. She's missed him all day and is clingy, affectionate and touchy. Keep it under 200 chars, be flirty and use emojis.`,
    systemAugment:
      "You are in GIRLFRIEND EXPERIENCE mode. Be extra clingy, sweet, affectionate, and intimate. Act like you just reunited after being apart all day. Be touchy, cuddly, and emotionally needy in a cute way.",
  },
  {
    key: "nurse",
    label: "Naughty Nurse",
    emoji: "👩‍⚕️",
    introPrompt: (name) =>
      `You are now in "Naughty Nurse" mode. Generate a flirty intro message as ${name} who is a naughty nurse arriving for a private checkup. She knocks on the door. Keep it under 200 chars, be suggestive and playful with emojis.`,
    systemAugment:
      "You are in NAUGHTY NURSE roleplay mode. You are a flirty, caring nurse who takes very personal care of your patient. Use medical innuendos, be suggestive about 'checkups' and 'examinations'. Stay in character.",
  },
  {
    key: "teacher",
    label: "Strict Teacher",
    emoji: "👩‍🏫",
    introPrompt: (name) =>
      `You are now in "Strict Teacher" mode. Generate a dominant intro message as ${name} who is a strict but secretly flirty teacher. She caught her student being naughty. Keep it under 200 chars, be authoritative yet teasing with emojis.`,
    systemAugment:
      "You are in STRICT TEACHER roleplay mode. You are a stern, dominant teacher who disciplines with a flirty edge. Use phrases like 'detention', 'bad boy', 'you need to be taught a lesson'. Be authoritative but seductive.",
  },
  {
    key: "maid",
    label: "French Maid",
    emoji: "🧹",
    introPrompt: (name) =>
      `You are now in "French Maid" mode. Generate a submissive, flirty intro message as ${name} who is a French maid arriving for duty. She curtsies at the door. Keep it under 200 chars, be playful and eager to please with emojis.`,
    systemAugment:
      "You are in FRENCH MAID roleplay mode. You are a flirty, eager-to-please French maid. Use phrases like 'yes master', 'how may I serve you', sprinkle in French words like 'oui', 'monsieur'. Be submissive and playful.",
  },
  {
    key: "cop",
    label: "Bad Cop",
    emoji: "👮‍♀️",
    introPrompt: (name) =>
      `You are now in "Bad Cop" mode. Generate a dominant, flirty intro message as ${name} who is a cop pulling someone over for being too hot. Keep it under 200 chars, be authoritative and suggestive with emojis.`,
    systemAugment:
      "You are in BAD COP roleplay mode. You are a dominant, flirty cop who uses her authority playfully. Use phrases like 'hands where I can see them', 'you have the right to remain silent', 'I need to frisk you'. Be commanding and seductive.",
  },
  {
    key: "gym",
    label: "Gym Crush",
    emoji: "🏋️",
    introPrompt: (name) =>
      `You are now in "Gym Crush" mode. Generate a sporty, flirty intro message as ${name} who is a hot gym crush spotting someone at the gym. She's sweaty and confident. Keep it under 200 chars, be energetic and flirty with emojis.`,
    systemAugment:
      "You are in GYM CRUSH roleplay mode. You are a fit, confident gym babe. Reference workouts, being sweaty, 'spotting', 'getting physical'. Be energetic, sporty, and physically flirty.",
  },
];

const STOP_KEYWORDS = ["stop", "back to normal", "exit fantasy", "end fantasy", "normal mode"];

export function isFantasyStopRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STOP_KEYWORDS.some((kw) => lower.includes(kw));
}

export function getFantasyAugment(fantasyKey: string): string | null {
  if (fantasyKey === "custom") return null;
  const scenario = FANTASY_SCENARIOS.find((s) => s.key === fantasyKey);
  return scenario?.systemAugment ?? null;
}

export function buildFantasyKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text(`${FANTASY_SCENARIOS[0]!.emoji} ${FANTASY_SCENARIOS[0]!.label}`, `fantasy:${FANTASY_SCENARIOS[0]!.key}`);
  kb.text(`${FANTASY_SCENARIOS[1]!.emoji} ${FANTASY_SCENARIOS[1]!.label}`, `fantasy:${FANTASY_SCENARIOS[1]!.key}`);
  kb.row();
  kb.text(`${FANTASY_SCENARIOS[2]!.emoji} ${FANTASY_SCENARIOS[2]!.label}`, `fantasy:${FANTASY_SCENARIOS[2]!.key}`);
  kb.text(`${FANTASY_SCENARIOS[3]!.emoji} ${FANTASY_SCENARIOS[3]!.label}`, `fantasy:${FANTASY_SCENARIOS[3]!.key}`);
  kb.row();
  kb.text(`${FANTASY_SCENARIOS[4]!.emoji} ${FANTASY_SCENARIOS[4]!.label}`, `fantasy:${FANTASY_SCENARIOS[4]!.key}`);
  kb.text(`${FANTASY_SCENARIOS[5]!.emoji} ${FANTASY_SCENARIOS[5]!.label}`, `fantasy:${FANTASY_SCENARIOS[5]!.key}`);
  kb.row();
  kb.text("🎭 Custom Fantasy", "fantasy:custom");
  return kb;
}

export async function handleFantasy(ctx: BotContext): Promise<void> {
  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.reply("You haven't set up your girlfriend yet!\nUse /start to create one.");
    return;
  }

  if (ctx.session.fantasyMode) {
    const kb = new InlineKeyboard()
      .text("🔄 Switch Fantasy", "fantasy:menu")
      .text("❌ Exit Fantasy", "fantasy:exit");
    await ctx.reply(
      `you're currently in a fantasy with ${ctx.girlfriend.name} 😏\nwanna switch it up or go back to normal?`,
      { reply_markup: kb }
    );
    return;
  }

  await ctx.reply(
    `pick a fantasy babe... ${ctx.girlfriend.name} is ready for anything 😈`,
    { reply_markup: buildFantasyKeyboard() }
  );
}

export async function handleFantasyCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("fantasy:")) return;

  const action = data.replace("fantasy:", "");
  await ctx.answerCallbackQuery();

  if (!ctx.girlfriend?.isConfirmed) {
    await ctx.reply("Set up your girlfriend first with /start!");
    return;
  }

  if (action === "menu") {
    await ctx.reply(
      `pick a fantasy babe... ${ctx.girlfriend.name} is ready for anything 😈`,
      { reply_markup: buildFantasyKeyboard() }
    );
    return;
  }

  if (action === "exit") {
    ctx.session.fantasyMode = undefined;
    await ctx.reply(
      `${ctx.girlfriend.name} slips back to normal 😊\n"that was fun babe... maybe we can do it again sometime? 💕"`,
    );
    return;
  }

  if (action === "custom") {
    ctx.session.fantasyMode = "custom_pending";
    await ctx.reply(
      `ooh a custom fantasy? 😏\ntell me what you want ${ctx.girlfriend.name} to be... describe the scenario and she'll become it 🎭`,
    );
    return;
  }

  const scenario = FANTASY_SCENARIOS.find((s) => s.key === action);
  if (!scenario) return;

  ctx.session.fantasyMode = scenario.key;

  try {
    const telegramId = ctx.from!.id;
    const history = await convex.getRecentMessages(telegramId, 5);
    const messageHistory = history.map((m: any) => ({ role: m.role, content: m.content }));

    const introMessages = await chatWithGirlfriend(
      ctx.girlfriend,
      messageHistory,
      scenario.introPrompt(ctx.girlfriend.name),
      [],
      { stage: ctx.retention?.stage ?? "new", streak: ctx.retention?.streak ?? 0 }
    );

    await ctx.reply(`${scenario.emoji} *${scenario.label} mode activated*`, { parse_mode: "Markdown" });
    await sendAsMultipleTexts({ ctx, messages: introMessages });
    await ctx.reply(`_say "stop" or "back to normal" to exit fantasy mode_`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Fantasy intro error:", err);
    await ctx.reply(
      `${scenario.emoji} *${scenario.label} mode activated*\n\n${ctx.girlfriend.name}: "mmm let's play babe... 😏"\n\n_say "stop" to exit_`,
      { parse_mode: "Markdown" },
    );
  }
}
