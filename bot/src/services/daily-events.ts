const DAILY_EVENTS = {
  morning: [
    "went to yoga class and this girl had the CUTEST outfit",
    "spilled coffee on my white top on the way to work 😭",
    "my boss complimented my presentation today!!",
    "tried a new cafe near my apartment, their matcha is so good",
  ],
  afternoon: [
    "my coworker brought donuts and i ate like three oops",
    "had the most boring meeting of my life just now",
    "went shopping on my lunch break and found the cutest dress",
  ],
  evening: [
    "just finished cooking dinner, tried a new recipe and it actually worked??",
    "watching this show on netflix and thinking of u",
    "took a bath and now im just laying in bed being lazy",
  ],
};

type DailyEventTime = keyof typeof DAILY_EVENTS;

export function getDailyEvent(timeOfDay: string): string {
  const normalized = timeOfDay.toLowerCase();

  const bucket: DailyEventTime =
    normalized.includes("morning")
      ? "morning"
      : normalized.includes("afternoon")
        ? "afternoon"
        : "evening";

  const events = DAILY_EVENTS[bucket];
  const index = Math.floor(Math.random() * events.length);
  return events[index];
}
