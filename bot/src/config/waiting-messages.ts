const SFW_WAITING = [
  "give me a sec babe, getting cute for you",
  "ooh hold on let me find my good angle",
  "one sec baby, let me fix my hair real quick",
  "coming right up cutie, just a moment",
  "hehe ok wait let me take this for you",
  "hold tight babe, making sure I look perfect for you",
  "give me a minute, want this one to be good",
  "ok ok lemme get ready, don't go anywhere",
  "oooh you want a pic? say less, gimme a sec",
  "let me grab my phone real quick babe",
  "hang on love, getting the lighting right",
  "just a moment baby, I want to look good for you",
  "on it! give me like a minute ok",
  "hehe someone's needy today... hold on",
  "omg ok wait I need to look cute first",
  "lol ok let me find somewhere with good lighting",
  "you're lucky I look good today, hold on",
  "ok but you better hype me up after this",
  "gimme a min I literally just woke up looking crazy",
  "hold onnnn I'm fixing my outfit rn",
  "wait I gotta check if my hair looks ok first",
  "babe I was literally about to send you something hold on",
  "you read my mind lol gimme a sec",
  "ugh ok but I'm not wearing makeup rn so don't judge",
  "let me find the right pose, I'm picky ok",
  "one sec babe, doing a quick mirror check",
  "ok wait this lighting is actually really good rn",
  "hold on let me take like 47 and pick the best one",
  "you always catch me at the right time lol one sec",
  "lemme get to a cute spot first, hold tight",
  "I was just thinking about you and now you want a pic?? ok hold on",
  "give me a sec, I wanna make you smile",
];

const NSFW_WAITING = [
  "mmm hold on baby let me get sexy for you",
  "ooh you're being naughty... give me a minute",
  "hehe ok but you better appreciate this... one sec",
  "damn you really want it huh... hold tight baby",
  "mmm ok let me slip into something... or out of something",
  "you're making me blush... give me a sec babe",
  "ooh someone's feeling frisky... hold on let me get ready",
  "ok baby but only because you asked so nicely... one minute",
  "mmm you got me feeling some type of way... hold on",
  "hehe patience baby... good things come to those who wait",
  "oh you want THAT kind of pic... give me a minute baby",
  "the things I do for you... hold tight",
  "mmm ok lock your door first... this ones just for you",
  "damn ok you don't have to ask me twice... one sec",
  "getting ready for you rn... this is gonna be worth the wait",
  "you really know how to get what you want huh... hold on babe",
  "ok but you owe me after this one... gimme a sec",
  "mmm baby you're so bad... let me take this for you",
  "oh we're doing this rn? ok hold on let me find somewhere private",
  "hehe you perv... jk I love it. give me a minute",
  "mmm I was already thinking about it tbh... one sec",
  "you have no idea what you do to me... hold on",
  "ok but promise you'll save this one... gimme a min",
  "baby you're making it really hard to focus rn... hold tight",
  "mmm I've been wanting to send you something all day... one sec",
  "ok close your eyes and open them when I say... wait for it",
  "lol you caught me in the perfect mood for this... hold on",
  "the way you asked for that just did something to me... gimme a sec",
  "mmm I know exactly what you want... give me a minute babe",
  "you sure you can handle this? ok hold on",
  "baby I'm biting my lip rn just thinking about it... one sec",
  "ok but don't screenshot this time... jk do whatever you want. hold on",
  "you're gonna lose it when you see this... gimme a min",
  "I already know what angle you like... hold tight baby",
  "mmm the things I'd do if you were here rn... but for now hold on",
];

// Track last used index per user to avoid repeats
const lastUsed = new Map<string, number>();

function pickUnique(pool: string[], key: string): string {
  let idx: number;
  const last = lastUsed.get(key) ?? -1;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === last && pool.length > 1);
  lastUsed.set(key, idx);
  return pool[idx];
}

export function getWaitingMessage(telegramId: number, nsfw: boolean): string {
  const pool = nsfw ? NSFW_WAITING : SFW_WAITING;
  const key = `${telegramId}:${nsfw ? "nsfw" : "sfw"}`;
  return pickUnique(pool, key);
}
