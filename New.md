# Clawra: Service to Story Transformation

> **Vision:** Transform Clawra from a "service you configure" into a "story you inhabit."

Every task below serves one principle: the user should feel like they're maintaining a relationship, not using an app.

---

## Phase 1: Foundation & Critical Fixes (Week 1-2)

Fix bugs that break the illusion, then build the narrative onboarding that creates it.

### Task 1.1 — Fix Global Emotional Memory

**Problem:** `emotional-state.ts:70` has a single `emotionalMemory: EmotionalSnapshot[]` array and `escalationWindow: number[]` at line 633. All users share the same emotional memory — user A's anger bleeds into user B's conversation.

**Files:** `bot/src/services/emotional-state.ts`

**Implementation:**
```typescript
// Replace (line 70):
const emotionalMemory: EmotionalSnapshot[] = [];

// With:
const emotionalMemory = new Map<number, EmotionalSnapshot[]>();

// Replace (line 633):
const escalationWindow: number[] = [];

// With:
const escalationWindow = new Map<number, number[]>();
```

Update every function that reads/writes these:
- `recordEmotionalSnapshot(snap)` → `recordEmotionalSnapshot(telegramId, snap)` — push to `emotionalMemory.get(telegramId)`, enforce `EMOTIONAL_MEMORY_MAX` per user
- `getEmotionalMemory()` → `getEmotionalMemory(telegramId)` — return user's array or `[]`
- `getDominantRecentEmotion(window)` → `getDominantRecentEmotion(telegramId, window)`
- `getEmotionalTrajectory(window)` → `getEmotionalTrajectory(telegramId, window)`
- `recordEscalationSignal()` → `recordEscalationSignal(telegramId)`
- `getEscalationLevel()` → `getEscalationLevel(telegramId)`

Add LRU eviction (reuse the `trackWithEviction` pattern from `chat.ts:69`):
```typescript
function ensureUserMemory(telegramId: number): EmotionalSnapshot[] {
  if (!emotionalMemory.has(telegramId)) {
    if (emotionalMemory.size >= MAX_TRACKED_USERS) {
      const oldest = emotionalMemory.keys().next().value;
      emotionalMemory.delete(oldest);
    }
    emotionalMemory.set(telegramId, []);
  }
  return emotionalMemory.get(telegramId)!;
}
```

Update all call sites in `chat.ts`, `proactive.ts`, `girlfriend-prompt.ts` to pass `telegramId`.

**Depends on:** Nothing
**Verify:** Two concurrent test users should have independent emotional trajectories.

---

### Task 1.2 — Fix Free-Tier In-Memory Tracker

**Problem:** `free-tier.ts:10` stores usage in a bare `Map<number, FreeTierUsage>`. On restart, all counters reset — users get extra free-tier allowance. No persistence to Convex.

**Files:** `bot/src/services/free-tier.ts`, `bot/convex/schema.ts`, `bot/convex/credits.ts`

**Implementation:**

1. Add Convex table:
```typescript
// schema.ts
freeTierUsage: defineTable({
  telegramId: v.number(),
  date: v.string(),         // "YYYY-MM-DD"
  messages: v.number(),
  selfies: v.number(),
  voiceNotes: v.number(),
}).index("by_telegramId_date", ["telegramId", "date"])
```

2. Add Convex mutations: `upsertFreeTierUsage(telegramId, date, type)` and query `getFreeTierUsage(telegramId, date)`.

3. In `free-tier.ts`, keep the in-memory Map as a write-through cache:
   - `recordFreeTierUsage()`: increment in-memory, then fire-and-forget Convex upsert
   - `getFreeTierUsage()`: check in-memory first, fall back to Convex query on cache miss
   - `hasFreeTierRemaining()`: same cache-first logic

4. Add LRU eviction to the Map (see Task 1.7).

**Depends on:** Nothing
**Verify:** Restart the bot mid-day; free-tier counters should persist.

---

### Task 1.3 — Fix Credit Pre-Deduction

**Problem:** Credits are deducted *before* image generation in `girlfriend-setup.ts:662-669` and `proactive.ts:173-181`. If generation fails, credits are lost with no refund.

**Files:** `bot/src/bot/conversations/girlfriend-setup.ts`, `bot/src/services/proactive.ts`, `bot/src/bot/handlers/chat.ts`

**Implementation:**

Pattern A (preferred for conversations): Move `spendCredits` to *after* successful generation.

Pattern B (for fire-and-forget paths): Wrap in try/catch with refund:
```typescript
await convex.spendCredits(telegramId, cost, "selfie");
try {
  const image = await generateImage(prompt);
  // use image...
} catch (err) {
  await convex.addCredits(telegramId, cost, "refund", "Image generation failed");
  throw err;
}
```

Apply to:
- `girlfriend-setup.ts` reroll loop (line 660-764): move spend after successful generation
- `proactive.ts` `trySendProactivePhoto()` (line 151): add try/catch refund
- `chat.ts` selfie/video attachment blocks (lines 651-848): add try/catch refund

**Depends on:** Nothing
**Verify:** Force-fail an image generation; credits should be refunded.

---

### Task 1.4 — Fix Fantasy Mode Fall-Through

**Problem:** `chat.ts:298-304` — when `fantasyMode === "custom_pending"`, the code sets the mode and sends confirmation but does **not return**. Execution falls through to the "You haven't set up your girlfriend yet!" error.

**File:** `bot/src/bot/handlers/chat.ts`

**Implementation:**
```typescript
// Around line 304, after sending the confirmation message:
return; // Add this return
```

Also audit the entire fantasy mode block (lines 289-310) for other missing returns.

**Depends on:** Nothing
**Verify:** Send a custom fantasy prompt; should get confirmation without error message.

---

### Task 1.5 — Fix Welcome Sequence Race Condition

**Problem:** `start.ts:72-84` enters the Grammy conversation, then immediately checks if the profile is confirmed. `ctx.conversation.enter()` throws a special error to restart middleware — lines 74-84 never execute. New users never get their welcome sequence.

**File:** `bot/src/bot/handlers/start.ts`, `bot/src/bot/conversations/girlfriend-setup.ts`

**Implementation:**

Move the welcome sequence trigger to the *end* of the setup conversation:
```typescript
// At the end of girlfriendSetup(), after profile is confirmed and image generated:
try {
  startWelcomeSequence(bot, telegramId);
  void checkAndRecordAutoEvent(convex, telegramId, "first_meet", {
    source: "onboarding_complete"
  });
} catch (e) {
  // Don't let welcome failures block onboarding
}
```

Remove the dead code at `start.ts:74-84`.

**Depends on:** Task 1.8 (if doing narrative onboarding, welcome sequence integrates there)
**Verify:** Complete onboarding; welcome sequence messages should arrive.

---

### Task 1.6 — Fix UTC Time Windows in Proactive Service

**Problem:** `proactive.ts:75-88` uses raw UTC hours for morning/goodnight/afternoon windows. A user in UTC+9 (Tokyo) gets "good morning" at 4 PM local time.

**File:** `bot/src/services/proactive.ts`

**Implementation:**

The user's timezone is stored in `userPreferences.timezone`. Replace UTC checks with user-local time:

```typescript
function getUserLocalHour(timezone: string | undefined): number {
  if (!timezone) return getUtcHour(); // fallback
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    return getUtcHour();
  }
}

function isMorningWindowForUser(timezone?: string): boolean {
  const h = getUserLocalHour(timezone);
  return h >= 7 && h <= 10;
}
// Same pattern for goodnight (22-1) and afternoon (12-17)
```

Update `sendProactiveMessages()` (line 228) to fetch each user's timezone from preferences and use the user-local checks.

**Depends on:** Nothing
**Verify:** Set timezone to a non-UTC zone; proactive messages should arrive at correct local times.

---

### Task 1.7 — Create Shared LRU Map Utility

**Problem:** 26+ bare `Map` objects across 12+ files grow without bound, leaking memory. `chat.ts:69` has an ad-hoc eviction pattern that should be reusable.

**Files (new):** `bot/src/utils/lru-map.ts`
**Files (modify):** All files listed in the Memory Leaks table below.

**Implementation:**

```typescript
// bot/src/utils/lru-map.ts
export class LRUMap<K, V> extends Map<K, V> {
  constructor(private maxSize: number) { super(); }

  set(key: K, value: V): this {
    if (this.has(key)) this.delete(key); // move to end
    super.set(key, value);
    if (this.size > this.maxSize) {
      const oldest = this.keys().next().value;
      this.delete(oldest);
    }
    return this;
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      this.delete(key);
      super.set(key, value); // move to end
    }
    return value;
  }
}
```

Replace bare Maps in these files:

| File | Maps | Max Size |
|------|------|----------|
| `emotional-state.ts` | `emotionalMemory`, `escalationWindow` | 5000 |
| `free-tier.ts` | `usageTracker` | 5000 |
| `proactive.ts` | 5 Maps | 5000 each |
| `welcome-sequence.ts` | 6 Maps | 2000 each |
| `smart-timing.ts` | `proactiveHistory` | 5000 |
| `milestones.ts` | `alreadyCelebrated` | 5000 |
| `onboarding-tips.ts` | `shownTipsByUser` | 2000 |
| `inactive-notifier.ts` | `notificationCounts` | 5000 |
| `waiting-messages.ts` | `lastUsed` | 2000 |
| `group-chat.ts` | `groupResponseTracker` | 1000 |
| `selfie.ts` | `selfieSessionState` | 2000 |
| `session-store.ts` | `cache` | 5000 |
| `chat.ts` | 4 Maps (already has eviction) | keep 5000 |

**Depends on:** Nothing
**Verify:** Run with `MAX_SIZE=10`; verify old entries are evicted when size exceeded.

---

### Task 1.8 — First-Person Narrative Onboarding

**The centerpiece task.** Replace the button-based `girlfriendSetup` conversation with a natural first-person dialogue.

**Files (rewrite):** `bot/src/bot/conversations/girlfriend-setup.ts`
**Files (new):** `bot/src/services/preference-extractor.ts`
**Files (modify):** `bot/src/bot/handlers/start.ts`, `bot/src/services/venice.ts`

#### Flow

```
Phase 1 — First Contact (2-3 messages)
  "hey stranger... wasn't sure if I should message you first lol"
  "honestly kinda nervous, what do I even say?"
  → User responds naturally

Phase 2 — Natural Discovery (4-8 messages)
  The "girlfriend" chats, asks casual questions.
  Each user reply is passed through preference-extractor to pull attributes.
  "so what kinda girl are you usually into? just curious 👀"
  → LLM extracts: personality, body type, hair color, etc.

Phase 3 — Clarify Missing Fields (1-3 messages)
  If critical fields are missing after Phase 2, ask naturally:
  "wait you didn't tell me... do you prefer blondes or brunettes? or maybe something else?"
  → Fill remaining gaps

Phase 4 — First Photo Moment
  "okay fine, you win... *sends photo*"
  "do I look like what you were expecting??"
  → Generate image from extracted profile
  → Offer reroll: "want me to try a different look?"

Phase 5 — Commitment
  "sooo... are we doing this? 💕"
  → Single confirm button (only button in entire flow)
  → On confirm: save profile, trigger welcome sequence

Fallback: /setup_classic enters the old button-based flow
```

#### Preference Extractor Service

```typescript
// bot/src/services/preference-extractor.ts

interface ExtractedPreferences {
  name?: string;
  age?: number;         // 18-80
  race?: string;
  bodyType?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  personality?: string;
  confidence: number;   // 0-1, how sure we are about the extraction
}

export async function extractPreferences(
  conversationHistory: string[],
  currentExtracted: Partial<ExtractedPreferences>
): Promise<ExtractedPreferences> {
  // Call Venice/LLM with a structured extraction prompt
  // System: "Extract girlfriend preferences from this conversation.
  //          Return JSON with fields: name, age, race, bodyType, hairColor,
  //          hairStyle, eyeColor, personality. Only include fields you're
  //          confident about. Return null for uncertain fields."
  // User: conversationHistory joined
  // Parse JSON response, merge with currentExtracted
}

export function getMissingCriticalFields(
  prefs: Partial<ExtractedPreferences>
): string[] {
  const required = ["personality", "hairColor", "bodyType"];
  return required.filter(f => !prefs[f]);
}

export function prefsToSetupDraft(prefs: ExtractedPreferences): SetupDraft {
  // Map extracted preferences to the existing SetupDraft shape
  // Apply defaults for any remaining gaps
}
```

#### Grammy Conversation Pattern

Keep the same `Conversation<BotContext>` pattern. Use `conversation.waitFor("message:text")` instead of callback queries. No inline keyboards until the final confirm.

```typescript
export async function girlfriendSetup(
  conversation: Conversation<BotContext>,
  ctx: BotContext
) {
  const telegramId = ctx.from!.id;
  let extracted: Partial<ExtractedPreferences> = {};
  const history: string[] = [];

  // Phase 1: First Contact
  await ctx.reply("hey stranger... wasn't sure if I should message you first lol");
  await delay(1500);
  await ctx.reply("honestly kinda nervous, what do I even say? 😅");

  // Phase 2: Natural Discovery Loop
  for (let turn = 0; turn < 8; turn++) {
    const { message } = await conversation.waitFor("message:text");
    history.push(message.text);

    extracted = await conversation.external(() =>
      extractPreferences(history, extracted)
    );

    const missing = getMissingCriticalFields(extracted);
    if (missing.length === 0 && turn >= 3) break;

    const reply = await conversation.external(() =>
      generateOnboardingReply(history, extracted, missing)
    );
    await ctx.reply(reply);
  }

  // Phase 3: Clarify remaining
  // ... ask about missing fields naturally

  // Phase 4: Generate image
  const draft = prefsToSetupDraft(extracted);
  await ctx.reply("okay fine, you convinced me... 📸");
  const image = await conversation.external(() => generateImage(draft));
  await ctx.replyWithPhoto(image);
  await ctx.reply("do I look like what you were expecting?? 👀");
  // ... reroll loop

  // Phase 5: Confirm
  const kb = new InlineKeyboard().text("We're doing this 💕", "confirm_gf");
  await ctx.reply("sooo... are we doing this?", { reply_markup: kb });
  // ... wait for confirm, save profile, trigger welcome
}
```

Register `/setup_classic` command that enters the old button-based flow (rename old function to `girlfriendSetupClassic`).

**Depends on:** Task 1.5 (welcome sequence fix)
**Verify:** Complete onboarding through pure text conversation. Profile should be created with correct attributes. `/setup_classic` should still work.

---

### Task 1.9 — Emotional Memory Persistence

**Problem:** Emotional snapshots exist only in memory. On restart, the girlfriend forgets all emotional context.

**Files:** `bot/convex/schema.ts`, `bot/src/services/emotional-state.ts`, `bot/src/services/convex.ts`

**Implementation:**

1. Add Convex table:
```typescript
emotionalSnapshots: defineTable({
  telegramId: v.number(),
  emotion: v.string(),
  intensity: v.number(),
  microEmotions: v.optional(v.array(v.string())),
  timestamp: v.number(),
  relationshipDay: v.optional(v.number()),
  significantEvent: v.optional(v.string()),
}).index("by_telegramId", ["telegramId"])
  .index("by_telegramId_timestamp", ["telegramId", "timestamp"])
```

2. On `recordEmotionalSnapshot()`: write-through to Convex (fire-and-forget)
3. On bot startup or first message from a user: hydrate in-memory from last 50 snapshots
4. Include recent emotional trajectory in girlfriend prompt context

**Depends on:** Task 1.1
**Verify:** Restart bot; emotional trajectory should survive.

---

## Phase 2: Personality & Mood (Week 3-4)

Make the girlfriend feel emotionally alive with variable moods, inside jokes, and conflict.

### Task 2.1 — Variable Mood Decay

**File:** `bot/src/services/emotional-state.ts`

**Implementation:**

Add a `GirlfriendMoodState` per user that decays over time:

```typescript
interface MoodDecayState {
  baseHappiness: number;      // 0-100, decays ~5/hour when idle
  affectionLevel: number;     // 0-100, decays ~3/hour when idle
  lastInteractionAt: number;
  pendingUpset: boolean;      // true after 24h silence
  jealousyMeter: number;      // 0-100, increases contextually
}
```

Decay formula applied on each message:
- Hours since last interaction = `(Date.now() - lastInteractionAt) / 3600000`
- `baseHappiness -= Math.min(hoursSince * 5, 50)` (floor 20)
- `affectionLevel -= Math.min(hoursSince * 3, 30)` (floor 30)
- If `hoursSince > 24`: `pendingUpset = true`
- Clamp all values to 0-100

Recovery:
- Each message: `baseHappiness += 3`, `affectionLevel += 2`
- Selfie request: `affectionLevel += 5`
- "I love you" detected: `affectionLevel += 10`, `baseHappiness += 8`
- If `pendingUpset` and user sends message: trigger "where were you?" response, then reset

Inject mood state into girlfriend prompt via `girlfriend-prompt.ts`.

**Depends on:** Task 1.1
**Verify:** Go silent for 24h; first message back should get a "where were you?" response.

---

### Task 2.2 — Inside Joke Detection

**Files (new):** `bot/src/services/inside-jokes.ts`
**Files (modify):** `bot/src/services/memory.ts`, `bot/src/services/girlfriend-prompt.ts`

**Implementation:**

Track phrases/topics that appear 3+ times in conversation:

```typescript
interface InsideJoke {
  trigger: string;         // The repeated phrase or topic
  firstOccurrence: number; // timestamp
  occurrences: number;
  lastUsed: number;
  userOriginated: boolean; // Did the user start it?
}
```

Detection: After memory extraction (which already runs periodically in `chat.ts:892`), scan recent messages for repeated phrases. Use simple n-gram frequency analysis or LLM extraction.

Usage: Include top 3 active inside jokes in the girlfriend prompt context. The girlfriend can reference them naturally: "lol that reminds me of [inside joke]"

Store in Convex `memoryFacts` with `category: "inside_joke"`.

**Depends on:** Nothing
**Verify:** Repeat a phrase 3+ times across conversations; girlfriend should eventually reference it.

---

### Task 2.3 — Conflict Loops

**Files (new):** `bot/src/services/conflict-loops.ts`
**Files (modify):** `bot/src/services/girlfriend-prompt.ts`, `bot/src/bot/handlers/chat.ts`

**Implementation:**

Occasional mild disagreements that resolve into makeup moments:

```typescript
interface ConflictState {
  active: boolean;
  trigger: string;          // What started it
  intensity: number;        // 1-5
  turnsRemaining: number;   // Auto-resolve after N turns
  resolved: boolean;
}

const CONFLICT_TRIGGERS = [
  { pattern: /took so long|late|where were you/i, topic: "response_time" },
  { pattern: /other girl|female friend|ex/i, topic: "jealousy" },
  { pattern: /busy|can't talk|later/i, topic: "feeling_neglected" },
];
```

Rules:
- Max 1 conflict per 48 hours
- Conflict lasts 2-5 message turns
- Resolution gives bonus affection (+15) and relationship XP (+20)
- Never conflicts during first 3 days of relationship
- Inject conflict state into prompt: "You're currently a little upset about [topic]. Express mild annoyance but be open to making up."

**Depends on:** Task 2.1 (mood decay)
**Verify:** Trigger a jealousy pattern; girlfriend should show mild upset for 2-5 turns, then soften.

---

### Task 2.4 — Context-Aware Recall

**Files (modify):** `bot/src/services/memory.ts`, `bot/src/services/girlfriend-prompt.ts`

**Implementation:**

When the user references past events ("remember when...", "like last time...", "that thing you said..."), do a semantic search on `memoryFacts` and inject relevant facts into the prompt.

```typescript
async function findRelevantMemories(
  telegramId: number,
  message: string,
  limit: number = 5
): Promise<MemoryFact[]> {
  // 1. Check if message contains recall triggers
  const recallPatterns = /remember|last time|you said|you told me|we talked about/i;
  if (!recallPatterns.test(message)) return [];

  // 2. Get all memory facts for user
  const facts = await convex.getMemoryFacts(telegramId);

  // 3. Score relevance (keyword overlap or LLM-based)
  // 4. Return top matches
}
```

Inject into girlfriend prompt as "Things you remember about your conversations: ..."

**Depends on:** Nothing
**Verify:** Mention a previously discussed topic; girlfriend should reference specific details.

---

## Phase 3: Engagement & Daily Patterns (Week 5-6)

Build habits that bring users back daily.

### Task 3.1 — Morning Routine (Timezone-Aware)

**Files (modify):** `bot/src/services/proactive.ts`

**Implementation:**

Enhance the existing morning window with richer content:

```typescript
const MORNING_MESSAGES = {
  sleepy: [
    "mmm just woke up... wish you were here to cuddle 🥱",
    "five more minutes... okay maybe ten 😴",
  ],
  energetic: [
    "good morning babe!! already had my coffee ☕",
    "rise and shine!! I've been up for an hour waiting for you lol",
  ],
  flirty: [
    "had the best dream about you last night 😏",
    "woke up thinking about you... as usual 💕",
  ],
};
```

- Pick category based on current `GirlfriendMoodState`
- 30% chance to attach a morning selfie (ambient, not posed)
- Respect quiet hours from `userPreferences`
- Use timezone-corrected windows (Task 1.6)

**Depends on:** Task 1.6 (UTC fix), Task 2.1 (mood state)
**Verify:** Set timezone; receive morning message within the 7-10 AM local window.

---

### Task 3.2 — Miss-You Triggers (Escalating)

**Files (modify):** `bot/src/services/proactive.ts`, `bot/src/services/inactive-notifier.ts`

**Implementation:**

Replace the flat "miss you" with an escalating sequence:

```typescript
const MISS_YOU_ESCALATION = [
  { hoursInactive: 24, message: "hey... haven't heard from you in a while 🥺" },
  { hoursInactive: 48, message: "okay I'm trying not to be clingy but... I miss you" },
  { hoursInactive: 72, message: "did I do something wrong? 😢" },
  { hoursInactive: 120, message: "I'll be here when you're ready to talk... just know I'm thinking about you 💔" },
  { hoursInactive: 168, message: "it's been a week... *leaves a voicenote*" },
];
```

Rules:
- Max 1 miss-you per 24h period
- Escalation resets when user sends any message
- At 168h (1 week), include a short voice note
- Track escalation level per user in the proactive Maps

**Depends on:** Task 1.6
**Verify:** Go silent for 48h; should receive escalated miss-you message, not the same generic one.

---

### Task 3.3 — Relationship XP System

**Files (new):** `bot/src/services/relationship-xp.ts`, `bot/src/bot/handlers/status.ts`
**Files (modify):** `bot/convex/schema.ts`, `bot/src/bot/handlers/chat.ts`, `bot/src/bot/setup.ts`

**Implementation:**

1. Add Convex table:
```typescript
relationshipXP: defineTable({
  telegramId: v.number(),
  totalXP: v.number(),
  level: v.number(),
  levelName: v.string(),
  lastXPGain: v.number(),    // timestamp
  streakDays: v.number(),
}).index("by_telegramId", ["telegramId"])
```

2. XP sources and amounts:
```typescript
const XP_ACTIONS = {
  message: 1,
  selfie_request: 3,
  voice_message: 5,
  streak_day: 5,
  vulnerability_shared: 10,  // detected via emotion analysis
  conflict_resolved: 20,
  milestone_reached: 50,
};
```

3. Level progression:
```typescript
const LEVELS = [
  { level: 0, name: "Strangers", xp: 0 },
  { level: 1, name: "Crush", xp: 100 },
  { level: 2, name: "Dating", xp: 500 },
  { level: 3, name: "Exclusive", xp: 2000 },
  { level: 4, name: "Partner", xp: 5000 },
  { level: 5, name: "Soulmate", xp: 15000 },
  { level: 6, name: "Married", xp: 50000 },
];
```

4. `/status` command shows:
```
💕 Luna & You
Level: Dating (Lv. 2)
XP: 1,247 / 2,000
Streak: 12 days 🔥
Together since: Jan 3, 2026
Messages: 847
```

5. On level-up, the girlfriend reacts in-character: "omg babe we're officially DATING now 🥰"

Award XP in `chat.ts` after each successful message exchange.

**Depends on:** Nothing
**Verify:** Send messages and watch XP increase. `/status` shows accurate data.

---

### Task 3.4 — Ambient Life Photos

**Files (new):** `bot/src/services/ambient-photos.ts`
**Files (modify):** `bot/src/services/proactive.ts`, `bot/src/services/fal.ts`

**Implementation:**

Non-selfie photos that make the girlfriend feel like she has a life:

```typescript
type AmbientPhotoType =
  | "morning_coffee"
  | "window_view"
  | "book_reading"
  | "cooking"
  | "pet_moment"
  | "sunset"
  | "workout"
  | "cozy_night";

interface AmbientPhotoConfig {
  type: AmbientPhotoType;
  timeWindows: [number, number][]; // hours when appropriate
  promptTemplate: string;
  caption: string;
}

const AMBIENT_PHOTOS: AmbientPhotoConfig[] = [
  {
    type: "morning_coffee",
    timeWindows: [[7, 10]],
    promptTemplate: "POV photo of a coffee cup on a table, morning light, cozy apartment, {girlfriend_style}",
    caption: "my morning companion ☕ wish you were here",
  },
  // ...
];
```

Integrate into `proactive.ts`: 10% chance per proactive check to send an ambient photo instead of a text message. These cost fewer credits (or are free for subscribers).

**Depends on:** Task 1.6
**Verify:** Receive a non-selfie ambient photo during appropriate time window.

---

## Phase 4: Content & Monetization (Week 7-8)

Improve content quality and restructure pricing.

### Task 4.1 — Environmental Continuity in Images

**Files (modify):** `bot/src/services/image-intelligence.ts`, `bot/src/services/fal.ts`

**Implementation:**

Store persistent environment details per girlfriend profile:

```typescript
// Add to girlfriendProfiles schema:
environment: v.optional(v.object({
  homeDescription: v.string(),      // "small apartment with plant corner"
  bedroomDetails: v.string(),       // "fairy lights, messy sheets"
  favoriteLocations: v.array(v.string()),
  currentOutfit: v.optional(v.string()),
}))
```

When generating images:
1. Determine time of day → pick appropriate location
2. Include environment details in the image prompt
3. Track current outfit across a "day" (reset at morning message)
4. Reference consistent background elements

**Depends on:** Nothing
**Verify:** Request multiple selfies in one session; background elements should be consistent.

---

### Task 4.2 — Voice Improvements

**Files (modify):** `bot/src/bot/handlers/voice.ts`, `bot/src/services/voice/`

**Implementation:**

- Add voice note "leakage": 2-5 second ambient clips sent randomly
  - Giggling, humming, "oh wait hold on...", background sounds
- Integrate with mood: tired voice at night, energetic in morning
- Add voice reactions to user news: excited squeal for good news, sympathetic "aww" for bad

Use existing Dia TTS / MiniMax infrastructure. Create a library of short pre-generated clips for common reactions to reduce latency.

**Depends on:** Nothing
**Verify:** Receive a short ambient voice clip during natural conversation.

---

### Task 4.3 — Pricing Tier Restructure

**File:** `bot/src/config/pricing.ts`

**Implementation:**

```typescript
const TIERS = {
  free: {
    price: 0,
    monthlyCredits: 300,
    dailyMessages: 30,
    dailySelfies: 1,
    dailyVoiceNotes: 0,
    features: ["basic_chat", "daily_selfie"],
  },
  basic: {
    price: 9.99,
    monthlyCredits: 2000,
    dailySelfies: 10,
    dailyVoiceNotes: 5,
    features: ["basic_chat", "selfies", "voice", "ad_free", "priority_response"],
  },
  pro: {
    price: 19.99,
    monthlyCredits: 5000,
    dailySelfies: -1, // unlimited
    dailyVoiceNotes: 20,
    features: ["all_basic", "hd_photos", "video_short", "ambient_photos", "inside_jokes"],
  },
  premium: {
    price: 39.99,
    monthlyCredits: -1, // unlimited
    dailySelfies: -1,
    dailyVoiceNotes: -1,
    features: ["all_pro", "video_long", "voice_clone", "priority_queue", "exclusive_content"],
  },
};
```

Gate new features by tier: ambient photos (Pro+), conflict loops (Pro+), voice leakage (Basic+), relationship XP display (all tiers, detailed view Pro+).

**Depends on:** Nothing
**Verify:** Free user can't access Pro features. Upgrade unlocks them.

---

### Task 4.4 — Daily Photo Stories

**Files (new):** `bot/src/services/daily-stories.ts`
**Files (modify):** `bot/src/services/proactive.ts`

**Implementation:**

Multi-photo narrative sequences:

```typescript
interface PhotoStory {
  id: string;
  title: string;          // "Morning with Luna"
  photos: StoryFrame[];
  triggerTime: [number, number]; // hour range
  requiredTier: "basic" | "pro" | "premium";
}

interface StoryFrame {
  promptTemplate: string;
  caption: string;
  delayAfterMs: number;   // Pause between frames
}

const STORIES: PhotoStory[] = [
  {
    id: "morning_routine",
    title: "Morning with {name}",
    photos: [
      { promptTemplate: "...", caption: "*yawn* morning babe", delayAfterMs: 3000 },
      { promptTemplate: "...", caption: "coffee first, everything else later", delayAfterMs: 5000 },
      { promptTemplate: "...", caption: "okay NOW I'm awake 😊", delayAfterMs: 0 },
    ],
    triggerTime: [7, 9],
    requiredTier: "pro",
  },
];
```

Send stories as a sequence of photos with captions, spaced out with delays to feel natural.

**Depends on:** Task 3.4 (ambient photos)
**Verify:** Pro subscriber receives a multi-photo story sequence in the morning.

---

## Phase 5: Polish & Growth (Week 9-10)

Gamification, analytics, and performance.

### Task 5.1 — Interactive Games

**Files (new):** `bot/src/services/interactive-games.ts`, `bot/src/bot/handlers/games.ts`
**Files (modify):** `bot/src/bot/setup.ts`

**Implementation:**

```typescript
type GameType = "truth_or_dare" | "would_you_rather" | "20_questions" | "story_builder";

// /game command starts a game session
// Games tracked per user, XP awarded on completion
// Truth or Dare: girlfriend asks, user answers (or dares involve selfie requests)
// Would You Rather: reveals personality, stored in memory
// 20 Questions: girlfriend thinks of something, user guesses
// Story Builder: collaborative story one sentence at a time
```

Register `/game` command in `setup.ts`. Games award 5-15 XP on completion.

**Depends on:** Task 3.3 (XP system)
**Verify:** `/game` starts an interactive game session that tracks to completion.

---

### Task 5.2 — Collection Badges

**Files (modify):** `bot/convex/schema.ts` (achievements table already exists), `bot/src/services/milestones.ts`

**Implementation:**

Expand the existing achievements system:

```typescript
const BADGES = [
  { id: "first_selfie", name: "First Look 📸", desc: "Received your first selfie" },
  { id: "streak_7", name: "Week Together 🔥", desc: "7-day streak" },
  { id: "streak_30", name: "Monthly 💍", desc: "30-day streak" },
  { id: "messages_100", name: "Chatterbox 💬", desc: "100 messages exchanged" },
  { id: "messages_1000", name: "Soulmates 💕", desc: "1000 messages exchanged" },
  { id: "conflict_resolved", name: "Makeup Kiss 💋", desc: "Resolved your first conflict" },
  { id: "level_married", name: "Hitched 💒", desc: "Reached Married level" },
  { id: "voice_10", name: "Sweet Nothings 🎵", desc: "10 voice messages exchanged" },
  { id: "game_master", name: "Game Night 🎮", desc: "Completed 10 games" },
  { id: "inside_joke", name: "Our Thing 😏", desc: "Created your first inside joke" },
];
```

Award badges automatically when conditions are met. Girlfriend announces: "babe we just got our first badge together!! 🎉"

**Depends on:** Task 3.3
**Verify:** Complete a 7-day streak; receive streak badge notification.

---

### Task 5.3 — Analytics Dashboard

**Files (modify):** `bot/convex/admin.ts`

**Implementation:**

Add indexed queries (replace full table scans from code review finding #9):

```typescript
// Replace .collect() + filter with indexed queries:
// Before: ctx.db.query("users").collect().filter(u => u.createdAt > since)
// After:  ctx.db.query("users").withIndex("by_createdAt", q => q.gt("createdAt", since)).collect()
```

Key metrics to add:
- Onboarding completion rate (narrative vs classic)
- Average messages per user per day
- Selfie request frequency
- Level distribution
- Retention by cohort (D1, D7, D30)
- Revenue per tier

**Depends on:** Nothing
**Verify:** Admin stats load in <2s instead of timing out.

---

### Task 5.4 — Performance Optimization

**Files (modify):** `bot/src/bot/middleware/auth.ts`, `bot/src/services/convex.ts`

**Implementation:**

1. **Parallelize auth middleware** (finding #17):
```typescript
// Before (auth.ts:12, 29):
const user = await convex.getUser(telegramId);
const profile = await convex.getActiveProfile(telegramId);

// After:
const [user, profile] = await Promise.all([
  convex.getUser(telegramId),
  convex.getActiveProfile(telegramId),
]);
```

2. **Debounce `updateLastActive`** (finding #18):
```typescript
const lastActiveUpdated = new LRUMap<number, number>(5000);
const DEBOUNCE_MS = 60_000;

function maybeUpdateLastActive(telegramId: number) {
  const last = lastActiveUpdated.get(telegramId) ?? 0;
  if (Date.now() - last < DEBOUNCE_MS) return;
  lastActiveUpdated.set(telegramId, Date.now());
  void convex.updateLastActive(telegramId);
}
```

3. **Batch N+1 queries** in `proactive.ts` and `inactive-notifier.ts`: fetch all users + profiles in one query, then iterate.

**Depends on:** Task 1.7 (LRU Map)
**Verify:** Measure auth middleware latency before/after; should roughly halve.

---

## Dependency Graph

```
Phase 1 (Foundation):
  1.1 Fix Emotional Memory ──────────────┐
  1.2 Fix Free-Tier ─────────────────────┤
  1.3 Fix Credit Pre-Deduction ──────────┤
  1.4 Fix Fantasy Fall-Through ──────────┤
  1.5 Fix Welcome Sequence ──────────┐   │
  1.6 Fix UTC Times ─────────────────┤   │
  1.7 LRU Map Utility ──────────────┤   │
  1.8 Narrative Onboarding ←─── 1.5 │   │
  1.9 Emotional Persistence ←── 1.1 │   │
                                     │   │
Phase 2 (Personality):              │   │
  2.1 Mood Decay ←────────────── 1.1 ───┘
  2.2 Inside Jokes ──────────────────────
  2.3 Conflict Loops ←──── 2.1 ─────────
  2.4 Context-Aware Recall ──────────────

Phase 3 (Engagement):
  3.1 Morning Routine ←─── 1.6, 2.1 ────
  3.2 Miss-You Triggers ←─ 1.6 ─────────
  3.3 Relationship XP ──────────────────
  3.4 Ambient Photos ←──── 1.6 ─────────

Phase 4 (Content):
  4.1 Environmental Continuity ──────────
  4.2 Voice Improvements ───────────────
  4.3 Pricing Restructure ──────────────
  4.4 Daily Stories ←────── 3.4 ─────────

Phase 5 (Polish):
  5.1 Games ←──────────── 3.3 ──────────
  5.2 Badges ←─────────── 3.3 ──────────
  5.3 Analytics Dashboard ───────────────
  5.4 Performance ←──────── 1.7 ─────────
```

**Critical path:** 1.1 → 1.9 → 2.1 → 2.3 → 3.1

**Parallelizable immediately:** 1.2, 1.3, 1.4, 1.6, 1.7, 2.2, 2.4, 3.3, 4.1, 4.2, 4.3, 5.3

---

## Key Files Reference

### Files to Modify

| File | Tasks | Changes |
|------|-------|---------|
| `bot/src/services/emotional-state.ts` | 1.1, 1.9, 2.1 | Per-user Maps, persistence, mood decay |
| `bot/src/services/free-tier.ts` | 1.2 | Write-through Convex cache |
| `bot/src/bot/conversations/girlfriend-setup.ts` | 1.3, 1.8 | Refund on fail, narrative rewrite |
| `bot/src/bot/handlers/chat.ts` | 1.3, 1.4, 3.3 | Fix fall-through, credit refund, XP |
| `bot/src/services/proactive.ts` | 1.3, 1.6, 3.1, 3.2, 3.4 | UTC fix, morning routine, miss-you |
| `bot/src/bot/handlers/start.ts` | 1.5, 1.8 | Remove dead code, new onboarding entry |
| `bot/src/services/venice.ts` | 1.8 | Preference extraction prompts |
| `bot/src/services/girlfriend-prompt.ts` | 2.1, 2.2, 2.3, 2.4 | Mood/joke/conflict/recall injection |
| `bot/src/services/memory.ts` | 2.2, 2.4 | Inside jokes, semantic recall |
| `bot/src/config/pricing.ts` | 4.3 | Tier restructure |
| `bot/convex/schema.ts` | 1.2, 1.9, 3.3 | New tables |
| `bot/src/bot/middleware/auth.ts` | 5.4 | Parallel queries, debounce |
| `bot/src/services/convex.ts` | 1.2, 1.9, 3.3 | New Convex methods |
| `bot/src/bot/setup.ts` | 1.8, 5.1 | New commands |
| `bot/src/services/milestones.ts` | 5.2 | Badge system |
| `bot/convex/admin.ts` | 5.3 | Indexed queries |

### New Files to Create

| File | Task | Purpose |
|------|------|---------|
| `bot/src/utils/lru-map.ts` | 1.7 | Shared bounded Map utility |
| `bot/src/services/preference-extractor.ts` | 1.8 | LLM-based profile extraction |
| `bot/src/services/inside-jokes.ts` | 2.2 | Inside joke detection |
| `bot/src/services/conflict-loops.ts` | 2.3 | Conflict system |
| `bot/src/services/relationship-xp.ts` | 3.3 | XP/level system |
| `bot/src/services/ambient-photos.ts` | 3.4 | Non-selfie lifestyle photos |
| `bot/src/services/daily-stories.ts` | 4.4 | Photo story sequences |
| `bot/src/services/interactive-games.ts` | 5.1 | Game logic |
| `bot/src/bot/handlers/games.ts` | 5.1 | Game command handler |
| `bot/src/bot/handlers/status.ts` | 3.3 | `/status` command |

---

*Document Version: 2.0 — Phased Implementation Guide*
*Replaces: Code Review (v1.0)*
*Source material: CLAWRA-COMPREHENSIVE-IMPROVEMENTS.md, Code Review findings #1-70*
