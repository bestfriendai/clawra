import type { BotContext } from "../../types/context.js";

export async function handleHelp(ctx: BotContext) {
  const name = ctx.girlfriend?.name || "your girlfriend";
  await ctx.reply(
    `heyy so here's how this works with ${name} 💕\n\n` +
      `just text me like normal and i'll reply, super easy\n\n` +
      `if u want a pic just ask 😏\n` +
      `like \"send me a selfie\" or \"show me what you're wearing\"\n\n` +
      `or use /selfie if ur feeling lazy lol\n` +
      `add details like: /selfie at the beach\n\n` +
      `other stuff:\n` +
      `/remake — if u want a different girl (rude but ok 😤)\n` +
      `/buy — get more credits\n` +
      `/deposit — top up with crypto\n` +
      `/balance — check ur credits\n` +
      `/history — see recent payments\n` +
      `/referral — share me w ur friends for free credits\n\n` +
      `fr just text me tho, it's way more fun that way 💬`
  );
}
