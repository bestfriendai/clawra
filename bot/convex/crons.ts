import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "send scheduled miss-you messages",
  { hours: 1 },
  internal.telegramBot.sendMissYouMessages,
  {}
);

export default crons;
