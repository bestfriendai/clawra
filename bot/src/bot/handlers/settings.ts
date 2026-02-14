import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { convex, type UserPreferences } from "../../services/convex.js";
import {
  TIMEZONE_ABBREVIATIONS,
  formatUtcOffset,
  parseTimezoneOffset,
} from "../../services/smart-timing.js";

const DEFAULTS = {
  morningMessages: true,
  goodnightMessages: true,
  proactivePhotos: true,
  quietHoursStart: 23,
  quietHoursEnd: 7,
  timezone: "UTC+0",
};

const COMMON_TIMEZONES = [
  "EST",
  "CST",
  "MST",
  "PST",
  "GMT",
  "CET",
  "JST",
  "AEST",
  "IST",
  "NZST",
] as const;

type SettingToggleKey = "morningMessages" | "goodnightMessages" | "proactivePhotos";

function normalizePreferences(raw: UserPreferences): Required<
  Pick<
    UserPreferences,
    | "morningMessages"
    | "goodnightMessages"
    | "proactivePhotos"
    | "quietHoursStart"
    | "quietHoursEnd"
    | "timezone"
  >
> {
  return {
    morningMessages:
      typeof raw.morningMessages === "boolean"
        ? raw.morningMessages
        : DEFAULTS.morningMessages,
    goodnightMessages:
      typeof raw.goodnightMessages === "boolean"
        ? raw.goodnightMessages
        : DEFAULTS.goodnightMessages,
    proactivePhotos:
      typeof raw.proactivePhotos === "boolean"
        ? raw.proactivePhotos
        : DEFAULTS.proactivePhotos,
    quietHoursStart:
      typeof raw.quietHoursStart === "number"
        ? raw.quietHoursStart
        : DEFAULTS.quietHoursStart,
    quietHoursEnd:
      typeof raw.quietHoursEnd === "number"
        ? raw.quietHoursEnd
        : DEFAULTS.quietHoursEnd,
    timezone: raw.timezone ?? DEFAULTS.timezone,
  };
}

function onOff(value: boolean): string {
  return value ? "ON" : "OFF";
}

function to12HourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const base = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${base}${suffix}`;
}

function quietHoursLabel(start: number, end: number): string {
  return `${to12HourLabel(start)}-${to12HourLabel(end)}`;
}

function buildSettingsKeyboard(
  prefs: ReturnType<typeof normalizePreferences>
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      `🔔 Morning: ${onOff(prefs.morningMessages)}`,
      "settings:toggle:morningMessages"
    )
    .text(
      `🌙 Night: ${onOff(prefs.goodnightMessages)}`,
      "settings:toggle:goodnightMessages"
    )
    .row()
    .text(
      `📸 Photos: ${onOff(prefs.proactivePhotos)}`,
      "settings:toggle:proactivePhotos"
    )
    .text(
      `🔕 Quiet: ${quietHoursLabel(prefs.quietHoursStart, prefs.quietHoursEnd)}`,
      "settings:quiet:cycle"
    )
    .row()
    .text(`⏰ Timezone: ${prefs.timezone}`, "settings:timezone");
}

function buildSettingsText(prefs: ReturnType<typeof normalizePreferences>): string {
  return [
    "⚙️ *Notification Settings*",
    "",
    `🔔 Morning Messages: *${onOff(prefs.morningMessages)}*`,
    `🌙 Goodnight Messages: *${onOff(prefs.goodnightMessages)}*`,
    `📸 Proactive Photos: *${onOff(prefs.proactivePhotos)}*`,
    `🔕 Quiet Hours: *${quietHoursLabel(prefs.quietHoursStart, prefs.quietHoursEnd)}*`,
    `⏰ Timezone: *${prefs.timezone}*`,
  ].join("\n");
}

function buildTimezoneKeyboard(currentOffset: number): InlineKeyboard {
  const kb = new InlineKeyboard();

  kb.text("EST", "settings:tz:set:EST")
    .text("CST", "settings:tz:set:CST")
    .text("MST", "settings:tz:set:MST")
    .text("PST", "settings:tz:set:PST")
    .row()
    .text("GMT", "settings:tz:set:GMT")
    .text("CET", "settings:tz:set:CET")
    .text("JST", "settings:tz:set:JST")
    .text("AEST", "settings:tz:set:AEST")
    .row()
    .text("IST", "settings:tz:set:IST")
    .text("NZST", "settings:tz:set:NZST")
    .row()
    .text("➖ 1h", "settings:tz:delta:-1")
    .text("➕ 1h", "settings:tz:delta:1")
    .row()
    .text("➖ 30m", "settings:tz:delta:-0.5")
    .text("➕ 30m", "settings:tz:delta:0.5")
    .row()
    .text(`✅ Current: ${formatUtcOffset(currentOffset)}`, "settings:tz:back")
    .row()
    .text("⬅️ Back to Settings", "settings:tz:back");

  return kb;
}

function buildTimezoneText(currentOffset: number): string {
  const common = COMMON_TIMEZONES.map(
    (abbr) => `${abbr}=${TIMEZONE_ABBREVIATIONS[abbr]}`
  ).join("  •  ");

  return [
    "⏰ *Set Timezone*",
    "",
    `Current: *${formatUtcOffset(currentOffset)}*`,
    "",
    "Pick a common timezone or use custom +/- controls:",
    common,
  ].join("\n");
}

async function editOrReplySettings(
  ctx: BotContext,
  prefs: ReturnType<typeof normalizePreferences>
): Promise<void> {
  const text = buildSettingsText(prefs);
  const replyMarkup = buildSettingsKeyboard(prefs);

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
      return;
    } catch {
    }
  }

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

async function showTimezoneSelector(
  ctx: BotContext,
  prefs: ReturnType<typeof normalizePreferences>
): Promise<void> {
  const currentOffset = parseTimezoneOffset(prefs.timezone);
  const text = buildTimezoneText(currentOffset);
  const replyMarkup = buildTimezoneKeyboard(currentOffset);

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      });
      return;
    } catch {
    }
  }

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

async function loadPreferences(
  telegramId: number
): Promise<ReturnType<typeof normalizePreferences>> {
  const raw = await convex.getUserPreferences(telegramId);
  return normalizePreferences(raw);
}

export async function handleSettings(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const preferences = await loadPreferences(telegramId);
  await ctx.reply(buildSettingsText(preferences), {
    parse_mode: "Markdown",
    reply_markup: buildSettingsKeyboard(preferences),
  });
}

export async function handleSettingsCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("settings:")) return;

  await ctx.answerCallbackQuery();

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const parts = data.split(":");
  const action = parts[1];
  const scope = parts[2];
  const value = parts[3];

  let preferences = await loadPreferences(telegramId);

  if (action === "toggle" && scope) {
    const toggleKey = scope as SettingToggleKey;
    await convex.updateUserPreferences(telegramId, {
      [toggleKey]: !preferences[toggleKey],
    });
    preferences = await loadPreferences(telegramId);
    await editOrReplySettings(ctx, preferences);
    return;
  }

  if (action === "quiet" && scope === "cycle") {
    const presets: Array<{ start: number; end: number }> = [
      { start: 23, end: 7 },
      { start: 22, end: 6 },
      { start: 0, end: 0 },
    ];

    const currentIndex = presets.findIndex(
      (preset) =>
        preset.start === preferences.quietHoursStart &&
        preset.end === preferences.quietHoursEnd
    );
    const next = presets[(currentIndex + 1) % presets.length] ?? presets[0]!;

    await convex.updateUserPreferences(telegramId, {
      quietHoursStart: next.start,
      quietHoursEnd: next.end,
    });
    preferences = await loadPreferences(telegramId);
    await editOrReplySettings(ctx, preferences);
    return;
  }

  if (action === "timezone") {
    await showTimezoneSelector(ctx, preferences);
    return;
  }

  if (action === "tz" && scope === "set" && value) {
    const timezone = value.toUpperCase();
    await convex.updateUserPreferences(telegramId, { timezone });
    preferences = await loadPreferences(telegramId);
    await showTimezoneSelector(ctx, preferences);
    return;
  }

  if (action === "tz" && scope === "delta" && value) {
    const delta = Number(value);
    if (!Number.isFinite(delta)) return;

    const currentOffset = parseTimezoneOffset(preferences.timezone);
    const nextOffset = Math.min(14, Math.max(-12, currentOffset + delta));
    await convex.updateUserPreferences(telegramId, {
      timezone: formatUtcOffset(nextOffset),
    });
    preferences = await loadPreferences(telegramId);
    await showTimezoneSelector(ctx, preferences);
    return;
  }

  if (action === "tz" && scope === "back") {
    preferences = await loadPreferences(telegramId);
    await editOrReplySettings(ctx, preferences);
  }
}
