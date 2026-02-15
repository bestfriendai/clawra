import type { BotContext } from "../../types/context.js";

export async function handleSetupClassic(ctx: BotContext) {
  await ctx.reply("Switching to classic button setup.");
  await ctx.conversation.enter("girlfriendSetupClassic");
}
