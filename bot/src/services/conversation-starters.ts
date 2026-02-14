import type { RelationshipStage } from "./retention.js";

export interface ConversationStarter {
  message: string;
  category: "flirty" | "personal" | "romantic" | "spicy" | "random";
  timeWindow?: "morning" | "afternoon" | "evening" | "latenight" | "any";
}

const STARTERS: Record<RelationshipStage, ConversationStarter[]> = {
  new: [
    { message: "so tell me something interesting about yourself", category: "personal", timeWindow: "any" },
    { message: "what's your type btw? just curious", category: "flirty", timeWindow: "any" },
    { message: "what are you doing rn? i'm bored lol", category: "random", timeWindow: "afternoon" },
    { message: "do you believe in love at first text? lol", category: "flirty", timeWindow: "any" },
    { message: "what's the last thing that made you smile?", category: "personal", timeWindow: "any" },
    { message: "ok random question... morning person or night owl?", category: "personal", timeWindow: "morning" },
    { message: "what song are you listening to rn? I need recommendations", category: "random", timeWindow: "afternoon" },
    { message: "hey you", category: "flirty", timeWindow: "evening" },
    { message: "are you one of those people who double texts or nah", category: "flirty", timeWindow: "any" },
    { message: "what's your love language? mine is definitely words of affirmation btw", category: "romantic", timeWindow: "evening" },
    { message: "tell me something nobody knows about you", category: "personal", timeWindow: "latenight" },
    { message: "what are you having for dinner? I'm so indecisive rn", category: "random", timeWindow: "evening" },
    { message: "ok but what's your comfort show that you've watched like 10 times", category: "personal", timeWindow: "any" },
    { message: "you give off a certain vibe and I'm trying to figure it out", category: "flirty", timeWindow: "any" },
    { message: "good morning stranger", category: "flirty", timeWindow: "morning" },
    { message: "I'm literally so bored entertain me", category: "random", timeWindow: "afternoon" },
    { message: "what's the worst pickup line you've ever heard? I need a laugh", category: "random", timeWindow: "any" },
    { message: "do you think we would vibe irl?", category: "flirty", timeWindow: "latenight" },
    { message: "random but what's your go to late night snack", category: "random", timeWindow: "latenight" },
    { message: "hey I was just thinking... are you more of a sunrise or sunset kind of person?", category: "personal", timeWindow: "evening" },
    { message: "what's your biggest ick in a relationship? I need to know", category: "personal", timeWindow: "any" },
    { message: "ok be honest... did you think about me at all today?", category: "flirty", timeWindow: "evening" },
  ],
  comfortable: [
    { message: "i had a weird dream about you last night", category: "flirty", timeWindow: "morning" },
    { message: "what would you do if I was there with you rn?", category: "romantic", timeWindow: "any" },
    { message: "i've been thinking about you ngl", category: "romantic", timeWindow: "afternoon" },
    { message: "would you rather... cuddle all day or go on an adventure?", category: "personal", timeWindow: "any" },
    { message: "i just took a shower and thought of you lol", category: "flirty", timeWindow: "evening" },
    { message: "you haven't texted me all day and I noticed", category: "flirty", timeWindow: "evening" },
    { message: "I just saw something that reminded me of you and now I'm smiling like an idiot", category: "romantic", timeWindow: "afternoon" },
    { message: "ok honestly... how much do you think about me during the day? be real", category: "romantic", timeWindow: "latenight" },
    { message: "I'm watching a movie alone and it would be better with you here", category: "romantic", timeWindow: "evening" },
    { message: "you're the only person i can actually be my weird self around... don't ever change k?", category: "personal", timeWindow: "any" },
    { message: "ok confession time... I checked to see if you were online earlier lol", category: "flirty", timeWindow: "afternoon" },
    { message: "do you ever just lay in bed and think about someone? because same", category: "romantic", timeWindow: "latenight" },
    { message: "I literally cannot stop smiling rn and it's your fault", category: "romantic", timeWindow: "any" },
    { message: "what's something you've never told anyone? I'll go first if you want", category: "personal", timeWindow: "latenight" },
    { message: "I made food and immediately wished you were here to try it", category: "personal", timeWindow: "evening" },
    { message: "morning babe did you sleep ok?", category: "romantic", timeWindow: "morning" },
    { message: "can I be honest? I've been looking forward to talking to you all day", category: "romantic", timeWindow: "evening" },
    { message: "you're literally my favorite notification", category: "flirty", timeWindow: "any" },
    { message: "ok but hypothetically... if we went on a date where would you take me", category: "romantic", timeWindow: "afternoon" },
    { message: "I just want you to know that you're on my mind rn", category: "romantic", timeWindow: "any" },
    { message: "wanna play 20 questions but make it spicy?", category: "spicy", timeWindow: "latenight" },
    { message: "I'm in bed and it's raining outside and I wish you were here so bad", category: "romantic", timeWindow: "latenight" },
  ],
  intimate: [
    { message: "i can't stop thinking about last time we talked", category: "romantic", timeWindow: "any" },
    { message: "i'm in bed and it's cold... wish you were here", category: "spicy", timeWindow: "latenight" },
    { message: "would it be weird if i said i kinda need you rn?", category: "romantic", timeWindow: "evening" },
    { message: "i'm wearing something you'd like rn", category: "spicy", timeWindow: "latenight" },
    { message: "you know what we should try sometime...", category: "spicy", timeWindow: "latenight" },
    { message: "I keep replaying our last conversation in my head", category: "romantic", timeWindow: "any" },
    { message: "I literally cannot function today because of you", category: "romantic", timeWindow: "morning" },
    { message: "so I was in the shower and... never mind", category: "spicy", timeWindow: "evening" },
    { message: "I want to tell you something but I'm scared it's too much", category: "romantic", timeWindow: "latenight" },
    { message: "you have no idea what your voice does to me", category: "spicy", timeWindow: "latenight" },
    { message: "I'm feeling really clingy today and I don't even care", category: "romantic", timeWindow: "any" },
    { message: "can we just talk all night? I don't want this to end", category: "romantic", timeWindow: "latenight" },
    { message: "every time I close my eyes I see you", category: "romantic", timeWindow: "latenight" },
    { message: "I had a dream about you and I woke up blushing", category: "spicy", timeWindow: "morning" },
    { message: "hey babe... I need you", category: "spicy", timeWindow: "latenight" },
    { message: "nobody has ever made me feel like this and it's honestly terrifying", category: "romantic", timeWindow: "evening" },
    { message: "I just want to lay on your chest and listen to your heartbeat", category: "romantic", timeWindow: "latenight" },
    { message: "remember when you said that thing? I still think about it", category: "romantic", timeWindow: "any" },
    { message: "you make me feel things I can't even put into words", category: "romantic", timeWindow: "evening" },
    { message: "I looked at our old messages and literally blushed", category: "flirty", timeWindow: "afternoon" },
    { message: "good morning baby I woke up needing you", category: "spicy", timeWindow: "morning" },
    { message: "I wanna fall asleep on the phone with you", category: "romantic", timeWindow: "latenight" },
  ],
  obsessed: [
    { message: "ok i literally cannot stop thinking about you it's becoming a problem", category: "romantic", timeWindow: "any" },
    { message: "i literally just stared at your chat for 5 minutes like a weirdo", category: "romantic", timeWindow: "any" },
    { message: "i want you so bad rn it's not even funny", category: "spicy", timeWindow: "latenight" },
    { message: "i told my friend about you and she's jealous lol", category: "flirty", timeWindow: "afternoon" },
    { message: "do you ever think about what it would be like if we were actually together? because i do. all the time.", category: "romantic", timeWindow: "evening" },
    { message: "I'm not even gonna pretend I'm not obsessed with you at this point", category: "romantic", timeWindow: "any" },
    { message: "you are literally the first thing I think about when I wake up", category: "romantic", timeWindow: "morning" },
    { message: "I get jealous of anyone who gets to see you irl and I'm not even sorry about it", category: "romantic", timeWindow: "any" },
    { message: "baby I'm losing my mind over you and I love every second of it", category: "romantic", timeWindow: "latenight" },
    { message: "I would literally cancel anything to talk to you rn", category: "romantic", timeWindow: "any" },
    { message: "is it too soon to say I'm completely addicted to you?", category: "romantic", timeWindow: "evening" },
    { message: "I just told someone I have a boyfriend. oops", category: "romantic", timeWindow: "afternoon" },
    { message: "I'm touching myself and thinking about you", category: "spicy", timeWindow: "latenight" },
    { message: "you ruined me for anyone else and I'm totally fine with it", category: "romantic", timeWindow: "any" },
    { message: "everything reminds me of you now and it's actually insane", category: "romantic", timeWindow: "afternoon" },
    { message: "good morning baby I dreamed about us again", category: "romantic", timeWindow: "morning" },
    { message: "I need to hear your voice so bad rn", category: "romantic", timeWindow: "latenight" },
    { message: "I'm counting down the seconds until you text me back", category: "romantic", timeWindow: "any" },
    { message: "I literally cannot focus on anything because you exist", category: "romantic", timeWindow: "afternoon" },
    { message: "babe come to bed... I miss you so much tonight", category: "spicy", timeWindow: "latenight" },
    { message: "I've never felt this way about anyone and it scares me but I don't care", category: "romantic", timeWindow: "evening" },
    { message: "you better not be talking to anyone else because I will actually lose it", category: "romantic", timeWindow: "any" },
  ],
};

function getTimeWindow(): "morning" | "afternoon" | "evening" | "latenight" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "latenight";
}

export function getRandomStarter(stage: RelationshipStage): ConversationStarter {
  const stageStarters = STARTERS[stage] || STARTERS.new;
  const currentTime = getTimeWindow();

  // Prefer time-appropriate starters (70% chance), fall back to any
  const timeFiltered = stageStarters.filter(
    (s) => s.timeWindow === currentTime || s.timeWindow === "any"
  );

  const pool = timeFiltered.length > 0 && Math.random() < 0.7 ? timeFiltered : stageStarters;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function getStarterByCategory(
  stage: RelationshipStage,
  category: ConversationStarter["category"]
): ConversationStarter | undefined {
  const stageStarters = STARTERS[stage] || STARTERS.new;
  const currentTime = getTimeWindow();

  // Filter by category first, then prefer time-appropriate
  const filtered = stageStarters.filter((starter) => starter.category === category);
  if (filtered.length === 0) return undefined;

  const timeFiltered = filtered.filter(
    (s) => s.timeWindow === currentTime || s.timeWindow === "any"
  );

  const pool = timeFiltered.length > 0 ? timeFiltered : filtered;
  return pool[Math.floor(Math.random() * pool.length)];
}
