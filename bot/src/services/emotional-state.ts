// ─────────────────────────────────────────────────────────────────────────────
// Emotional State Engine — rich emotion detection, micro-emotions, emotional
// memory, escalation tracking, dynamic girlfriend moods, and human-like
// behavioral quirks.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core emotion types (unchanged public surface) ────────────────────────────

export type EmotionType =
  | "happy"
  | "sad"
  | "excited"
  | "worried"
  | "flirty"
  | "jealous"
  | "needy"
  | "playful"
  | "angry"
  | "loving";

// ── Micro-emotions — finer-grained sub-emotions ─────────────────────────────

export type MicroEmotion =
  | "teasing"
  | "suspicious"
  | "grateful"
  | "proud"
  | "possessive"
  | "nostalgic"
  | "vulnerable"
  | "sarcastic"
  | "overwhelmed"
  | "adoring"
  | "dismissive"
  | "longing"
  | "euphoric"
  | "insecure"
  | "protective"
  | "mischievous";

export interface EmotionalState {
  primary: EmotionType;
  intensity: number;
  triggers: string[];
  updatedAt: number;
}

// ── Extended detection result ────────────────────────────────────────────────

export interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number;
  microEmotions: MicroEmotion[];
  intensity: number; // 0–1 scale
  escalation: number; // 0–1 how heated the conversation is getting
}

// ── Emotional Memory ─────────────────────────────────────────────────────────
// Keeps a rolling window of recent emotional snapshots so we can reason about
// patterns and trajectory over time.

export interface EmotionalSnapshot {
  emotion: EmotionType;
  microEmotions: MicroEmotion[];
  intensity: number;
  timestamp: number;
}

const EMOTIONAL_MEMORY_MAX = 50;
const emotionalMemory: EmotionalSnapshot[] = [];

export function recordEmotionalSnapshot(snap: EmotionalSnapshot): void {
  emotionalMemory.push(snap);
  if (emotionalMemory.length > EMOTIONAL_MEMORY_MAX) {
    emotionalMemory.shift();
  }
}

export function getEmotionalMemory(): ReadonlyArray<EmotionalSnapshot> {
  return emotionalMemory;
}

/** Returns the dominant emotion over the last N snapshots. */
export function getDominantRecentEmotion(
  window = 10
): { emotion: EmotionType; ratio: number } {
  const recent = emotionalMemory.slice(-window);
  if (recent.length === 0) return { emotion: "playful", ratio: 0 };

  const counts: Partial<Record<EmotionType, number>> = {};
  for (const snap of recent) {
    counts[snap.emotion] = (counts[snap.emotion] || 0) + 1;
  }

  let best: EmotionType = "playful";
  let bestCount = 0;
  for (const [emo, cnt] of Object.entries(counts) as [EmotionType, number][]) {
    if (cnt > bestCount) {
      best = emo;
      bestCount = cnt;
    }
  }
  return { emotion: best, ratio: bestCount / recent.length };
}

/** Detects if emotion is trending in a direction (negative / positive). */
export function getEmotionalTrajectory(
  window = 8
): "improving" | "declining" | "volatile" | "stable" {
  const recent = emotionalMemory.slice(-window);
  if (recent.length < 3) return "stable";

  const positiveEmotions: EmotionType[] = [
    "happy",
    "excited",
    "flirty",
    "playful",
    "loving",
  ];

  const scores = recent.map((s) =>
    positiveEmotions.includes(s.emotion) ? s.intensity : -s.intensity
  );

  // Simple linear trend
  let rising = 0;
  let falling = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i]! > scores[i - 1]! + 0.05) rising++;
    else if (scores[i]! < scores[i - 1]! - 0.05) falling++;
  }

  const total = scores.length - 1;
  if (rising > total * 0.6) return "improving";
  if (falling > total * 0.6) return "declining";
  if (rising > total * 0.3 && falling > total * 0.3) return "volatile";
  return "stable";
}

// ── Pattern-based emotion detection ──────────────────────────────────────────
// Dramatically expanded regex coverage per emotion. Each pattern set is tuned
// to catch slang, abbreviations, emojis, emoji-sequences, and common texting
// shorthand.

interface WeightedPattern {
  pattern: RegExp;
  weight: number; // higher = stronger signal
}

function wp(pattern: RegExp, weight = 1): WeightedPattern {
  return { pattern, weight };
}

const EMOTION_PATTERNS: Record<EmotionType, WeightedPattern[]> = {
  happy: [
    wp(/\blol\b/i),
    wp(/\bhaha+\b/i),
    wp(/\bhehe+\b/i, 0.8),
    wp(/😂|🤣|😊|😁|😄|☺️|🥰|😃/),
    wp(/\bgreat\b/i),
    wp(/\bamazing\b/i, 1.2),
    wp(/\bawesome\b/i, 1.2),
    wp(/\bwonderful\b/i, 1.1),
    wp(/\bfantastic\b/i, 1.2),
    wp(/\bgood\s+mood\b/i, 1.3),
    wp(/\bso\s+happy\b/i, 1.5),
    wp(/\bfeeling\s+good\b/i, 1.3),
    wp(/\bbest\s+day\b/i, 1.4),
    wp(/\byay+\b/i, 1.1),
    wp(/\bwooo+\b/i, 1.1),
    wp(/\blove\s+it\b/i, 1.0),
    wp(/\bnice\b/i, 0.6),
    wp(/\bsweet\b/i, 0.7),
    wp(/\bperfect\b/i, 1.0),
    wp(/\bblessed\b/i, 0.9),
    wp(/\bgrinning\b/i, 0.8),
    wp(/:\)/),
    wp(/\blet'?s?\s+go+\b/i, 0.9),
  ],
  sad: [
    wp(/😢|😭|🥺|😞|😔|💔|😿/),
    wp(/\bsad\b/i, 1.2),
    wp(/\bmiss\b/i, 0.9),
    wp(/\blonely\b/i, 1.3),
    wp(/\bcry(?:ing)?\b/i, 1.4),
    wp(/\bdepressed\b/i, 1.6),
    wp(/\bdown\b/i, 0.6),
    wp(/\bfeeling\s+(?:low|empty|numb|broken)\b/i, 1.5),
    wp(/\bhurt(?:s|ing)?\b/i, 1.1),
    wp(/\bi'?m\s+not\s+ok(?:ay)?\b/i, 1.6),
    wp(/\bno\s+one\s+cares\b/i, 1.5),
    wp(/\bwish\s+i\s+could\b/i, 0.8),
    wp(/\bhate\s+my(?:self|\s+life)\b/i, 1.7),
    wp(/\bgutted\b/i, 1.2),
    wp(/\bheartbroken\b/i, 1.6),
    wp(/\btears\b/i, 1.2),
    wp(/\bdevastated\b/i, 1.5),
    wp(/\balone\b/i, 1.0),
    wp(/\bnothing\s+matters\b/i, 1.5),
    wp(/:\(/),
    wp(/\bsigh+\b/i, 0.7),
    wp(/\bcan'?t\s+stop\s+(?:thinking|crying)\b/i, 1.3),
  ],
  excited: [
    wp(/!!+/, 1.0),
    wp(/\bomg\b/i, 1.2),
    wp(/\bcan'?t\s+wait\b/i, 1.4),
    wp(/\bexcited\b/i, 1.5),
    wp(/🎉|🥳|🤩|✨|🔥|💥|🎊/),
    wp(/\bfinally\b/i, 0.8),
    wp(/\blet'?s?\s+(?:go+|do\s+(?:it|this))\b/i, 1.0),
    wp(/\bhyped?\b/i, 1.3),
    wp(/\bpumped\b/i, 1.2),
    wp(/\bstoked\b/i, 1.3),
    wp(/\bso\s+ready\b/i, 1.1),
    wp(/\bguess\s+what\b/i, 1.0),
    wp(/\byou\s+won'?t\s+believe\b/i, 1.0),
    wp(/\bno\s+way\b/i, 0.9),
    wp(/\binsane\b/i, 0.8),
    wp(/\bcrazy\b/i, 0.6),
    wp(/\bi\s+(?:just\s+)?got\b/i, 0.5),
    wp(/\bdying\b/i, 0.7),
    wp(/\bliterally\s+(?:screaming|shaking|dying)\b/i, 1.4),
    wp(/\bahhh+\b/i, 0.9),
    wp(/\bWOO+\b/, 1.1),
  ],
  worried: [
    wp(/\bworried\b/i, 1.4),
    wp(/\banxious\b/i, 1.5),
    wp(/\bnervous\b/i, 1.3),
    wp(/\bscared\b/i, 1.3),
    wp(/\bstressed\b/i, 1.4),
    wp(/😰|😥|😟|😧|🫣|😬/),
    wp(/\bpanick?(?:ing|ed)?\b/i, 1.5),
    wp(/\bfreaking\s+out\b/i, 1.4),
    wp(/\bwhat\s+if\b/i, 0.8),
    wp(/\boverth(?:ink|ought)\b/i, 1.3),
    wp(/\bcan'?t\s+(?:sleep|relax|breathe|focus)\b/i, 1.3),
    wp(/\bsomething'?s?\s+wrong\b/i, 1.1),
    wp(/\bi\s+don'?t\s+know\s+what\s+to\s+do\b/i, 1.2),
    wp(/\bi'?m\s+(?:afraid|terrified)\b/i, 1.4),
    wp(/\buneasy\b/i, 1.0),
    wp(/\bdread(?:ing)?\b/i, 1.2),
    wp(/\bon\s+edge\b/i, 1.1),
    wp(/\bkeep\s+thinking\s+about\b/i, 0.8),
    wp(/\bwhat\s+(?:should|do)\s+i\s+do\b/i, 0.9),
    wp(/\bi'?m\s+(?:so\s+)?(?:worried|scared)\s+(?:that|about)\b/i, 1.6),
  ],
  flirty: [
    wp(/😏|😘|🥵|😈|💋|🫦|😍|🤤/),
    wp(/\bsexy\b/i, 1.3),
    wp(/\bhot\b/i, 0.8),
    wp(/\bwant\s+you\b/i, 1.5),
    wp(/\bbaby\b/i, 0.9),
    wp(/\bcome\s+(?:here|over|cuddle)\b/i, 1.3),
    wp(/\bmake\s+(?:me|you)\b/i, 0.7),
    wp(/\bturned?\s+on\b/i, 1.4),
    wp(/\bcan'?t\s+stop\s+thinking\s+about\s+you\b/i, 1.3),
    wp(/\byou(?:'re|\s+are)\s+(?:so\s+)?(?:hot|fine|gorgeous|beautiful|handsome|cute)\b/i, 1.2),
    wp(/\bwish\s+you\s+were\s+here\b/i, 1.2),
    wp(/\btouch(?:ing)?\b/i, 0.8),
    wp(/\btease\b/i, 0.9),
    wp(/\bkiss(?:es|ing)?\b/i, 1.1),
    wp(/\bcuddle\b/i, 1.0),
    wp(/\bnaughty\b/i, 1.2),
    wp(/\bbite\b/i, 0.9),
    wp(/\blips\b/i, 0.8),
    wp(/\bbed\b/i, 0.5),
    wp(/\bdriving\s+me\s+crazy\b/i, 1.3),
    wp(/\bplay(?:ful)?\s+mood\b/i, 1.0),
    wp(/\b(?:good|cute)\s+(?:boy|girl)\b/i, 1.1),
    wp(/\bcheeky\b/i, 0.9),
  ],
  jealous: [
    wp(/\bjealous\b/i, 1.5),
    wp(/\bwho(?:'s| is)\s+(?:she|he|that|they)\b/i, 1.3),
    wp(/\bother\s+(?:girl|guy|person)s?\b/i, 1.3),
    wp(/\byou\s+ignored\s+me\b/i, 1.4),
    wp(/\bwhy\s+(?:were|are)\s+you\s+(?:with|talking\s+to)\b/i, 1.4),
    wp(/\bdo\s+you\s+(?:even\s+)?(?:like|love|care\s+about)\s+(?:her|him|them)\b/i, 1.5),
    wp(/\bam\s+i\s+not\s+enough\b/i, 1.6),
    wp(/\bwho\s+(?:was|were)\s+you\s+(?:with|texting|talking\s+to)\b/i, 1.4),
    wp(/\byou\s+(?:never|don'?t)\s+(?:text|call|talk\s+to)\s+me\b/i, 1.3),
    wp(/\bshe'?s?\s+(?:pretty|hot|cute|beautiful)\b/i, 1.2),
    wp(/\breplace\s+me\b/i, 1.5),
    wp(/\bdo\s+you\s+(?:still\s+)?(?:want|love|like)\s+me\b/i, 1.3),
    wp(/\byou'?d?\s+rather\b/i, 0.8),
    wp(/\bcheating\b/i, 1.6),
    wp(/\blying\b/i, 1.0),
    wp(/\bhiding\s+something\b/i, 1.2),
    wp(/😒|🙄|😤/),
  ],
  needy: [
    wp(/\bneed\s+you\b/i, 1.4),
    wp(/\bwhere\s+are\s+you\b/i, 1.2),
    wp(/\bdon'?t\s+leave\b/i, 1.5),
    wp(/\bmiss\s+you\s+(?:so\s+)?much\b/i, 1.4),
    wp(/\bplease\s+(?:don'?t\s+go|stay|come\s+back|talk\s+to\s+me)\b/i, 1.5),
    wp(/\bi\s+(?:just\s+)?(?:need|want)\s+(?:to\s+)?(?:hear|see|be\s+with)\s+you\b/i, 1.3),
    wp(/\bhold\s+me\b/i, 1.2),
    wp(/\bdon'?t\s+(?:forget|ignore)\s+me\b/i, 1.4),
    wp(/\bare\s+you\s+(?:there|still\s+there|mad\s+at\s+me)\b/i, 1.1),
    wp(/\bwhy\s+aren'?t\s+you\s+(?:replying|responding|answering)\b/i, 1.4),
    wp(/\btext\s+me\s+back\b/i, 1.3),
    wp(/\bi'?m\s+waiting\b/i, 0.9),
    wp(/\bpay\s+attention\s+to\s+me\b/i, 1.3),
    wp(/\byou\s+(?:never|don'?t)\s+(?:have|make)\s+time\b/i, 1.2),
    wp(/🥺|😿|💔/),
    wp(/\bplease+\b/i, 0.6),
    wp(/\bhello\?+/i, 1.0),
    wp(/\banyone\s+there\b/i, 0.9),
  ],
  playful: [
    wp(/\btease\b/i, 0.9),
    wp(/\bjk\b/i, 1.0),
    wp(/\blmao\b/i, 1.1),
    wp(/😜|😉|🤪|😝|👀|🫢|😆/),
    wp(/\bhehe+\b/i, 0.9),
    wp(/\bbet\b/i, 0.7),
    wp(/\bwanna\b/i, 0.5),
    wp(/\bdare\b/i, 0.9),
    wp(/\bchallenge\b/i, 0.8),
    wp(/\btry\s+me\b/i, 1.0),
    wp(/\bmake\s+me\b/i, 1.0),
    wp(/\byou\s+wish\b/i, 0.9),
    wp(/\bprove\s+it\b/i, 1.0),
    wp(/\bor\s+what\b/i, 0.9),
    wp(/\boh\s+really\b/i, 0.8),
    wp(/\bsure+\s+(?:jan|buddy|pal)\b/i, 1.0),
    wp(/\byeah\s+(?:right|ok)\b/i, 0.7),
    wp(/\bwatch\s+me\b/i, 0.9),
    wp(/\bgame\s+on\b/i, 1.0),
    wp(/\bbring\s+it\b/i, 0.9),
    wp(/\blol(?:ol)+\b/i, 0.8),
    wp(/\bdead\b/i, 0.6),
    wp(/\bwild\b/i, 0.6),
    wp(/\bno\s+u\b/i, 0.7),
  ],
  angry: [
    wp(/\bangry\b/i, 1.4),
    wp(/\bmad\b/i, 1.0),
    wp(/\bpissed\b/i, 1.4),
    wp(/\bwtf\b/i, 1.2),
    wp(/\bfrustrated\b/i, 1.2),
    wp(/\bugh+\b/i, 0.8),
    wp(/😡|🤬|💢|😠/),
    wp(/\bfuck(?:ing|ed)?\b/i, 1.0),
    wp(/\bshit\b/i, 0.7),
    wp(/\bstfu\b/i, 1.3),
    wp(/\bshut\s+up\b/i, 1.2),
    wp(/\bleave\s+me\s+alone\b/i, 1.3),
    wp(/\bi\s+(?:don'?t\s+)?(?:f.cking\s+)?care\b/i, 0.9),
    wp(/\bdone\s+(?:with\s+(?:this|you|everything))\b/i, 1.4),
    wp(/\bsick\s+(?:of|and\s+tired)\b/i, 1.3),
    wp(/\bhate\b/i, 1.1),
    wp(/\bpathetic\b/i, 1.0),
    wp(/\bdisgusting\b/i, 1.0),
    wp(/\bunbelievable\b/i, 0.8),
    wp(/\bseriously\?+/i, 0.7),
    wp(/\bare\s+you\s+(?:kidding|serious)\b/i, 0.8),
    wp(/\bi\s+can'?t\s+(?:believe|deal\s+with)\b/i, 1.0),
    wp(/\bfed\s+up\b/i, 1.2),
    wp(/\bdisrespect/i, 1.1),
    wp(/\bscrew\s+(?:you|this|that)\b/i, 1.3),
    wp(/\b(?:go\s+)?to\s+hell\b/i, 1.4),
  ],
  loving: [
    wp(/\bi\s+love\s+you\b/i, 1.8),
    wp(/\bador(?:e|ing)\s+you\b/i, 1.6),
    wp(/\bmy\s+(?:love|heart|everything|world|person)\b/i, 1.4),
    wp(/\bsoulmate\b/i, 1.5),
    wp(/❤️|💕|💖|💗|💘|💝|🫶|💞|🥰/),
    wp(/\bforever\b/i, 1.0),
    wp(/\byou\s+mean\s+(?:everything|the\s+world|so\s+much)\b/i, 1.5),
    wp(/\bcan'?t\s+(?:imagine\s+)?(?:live|life)\s+without\s+you\b/i, 1.6),
    wp(/\byou'?re?\s+(?:my\s+)?(?:everything|the\s+best|perfect|amazing)\b/i, 1.3),
    wp(/\bgrateful\s+for\s+you\b/i, 1.3),
    wp(/\bthankful\b/i, 0.8),
    wp(/\bhome\b.*\byou\b/i, 0.9),
    wp(/\bsafe\s+with\s+you\b/i, 1.2),
    wp(/\bnever\s+(?:leave|let\s+(?:you\s+)?go)\b/i, 1.3),
    wp(/\bgrow\s+old\b/i, 1.2),
    wp(/\bmarry\b/i, 1.1),
    wp(/\bwhole\s+heart\b/i, 1.4),
    wp(/\byou\s+(?:make\s+me\s+)?(?:so\s+)?happy\b/i, 1.2),
    wp(/\bmy\s+(?:baby|babe|darling|sweetie|honey)\b/i, 1.0),
    wp(/\bso\s+(?:in\s+)?love\b/i, 1.6),
    wp(/\bcheris/i, 1.3),
    wp(/\btreasure\b/i, 1.1),
  ],
};

// ── Micro-emotion detection ──────────────────────────────────────────────────

const MICRO_EMOTION_PATTERNS: Record<MicroEmotion, WeightedPattern[]> = {
  teasing: [
    wp(/\bjk\b/i, 1.0),
    wp(/\bjust\s+(?:kidding|messing|playing)\b/i, 1.2),
    wp(/\bsuuure\b/i, 1.0),
    wp(/\byeah\s+(?:right|ok(?:ay)?)\b/i, 0.9),
    wp(/😜|😏|🤭|😉/),
    wp(/\bor\s+(?:what|are\s+you\s+scared)\b/i, 1.1),
    wp(/\bchicken\b/i, 0.8),
    wp(/\baww+\b.*\bscared\b/i, 1.0),
    wp(/\bi\s+dare\s+you\b/i, 1.1),
  ],
  suspicious: [
    wp(/\bhmm+\b/i, 0.8),
    wp(/\bsure+\b/i, 0.6),
    wp(/\bwhy\s+(?:though|tho)\b/i, 0.9),
    wp(/\bthat'?s?\s+(?:sus|suspicious|weird|sketchy|fishy)\b/i, 1.3),
    wp(/🤨|🧐|😑|🤔/),
    wp(/\bwhat\s+(?:are\s+you|were\s+you)\s+(?:doing|up\s+to)\b/i, 0.8),
    wp(/\bsomething'?s?\s+(?:off|up|wrong|going\s+on)\b/i, 1.1),
    wp(/\bdon'?t\s+(?:lie|bs)\b/i, 1.2),
    wp(/\bwho\s+told\s+you\b/i, 0.9),
    wp(/\bshow\s+me\s+(?:your\s+)?phone\b/i, 1.4),
  ],
  grateful: [
    wp(/\bthank(?:s| you)\b/i, 1.2),
    wp(/\bgrateful\b/i, 1.4),
    wp(/\bappreciate\b/i, 1.3),
    wp(/\bmeans?\s+(?:a\s+lot|so\s+much|the\s+world)\b/i, 1.4),
    wp(/🙏|💛|🥹/),
    wp(/\byou\s+didn'?t\s+have\s+to\b/i, 1.0),
    wp(/\bso\s+(?:sweet|kind|thoughtful)\b/i, 1.1),
    wp(/\bi\s+(?:don'?t\s+)?deserve\s+you\b/i, 1.2),
    wp(/\bhow\s+(?:did\s+i|do\s+i)\s+get\s+so\s+lucky\b/i, 1.3),
  ],
  proud: [
    wp(/\bproud\b/i, 1.4),
    wp(/\bi\s+(?:did\s+it|made\s+it|passed|got\s+(?:in|it|the\s+job))\b/i, 1.2),
    wp(/\bnailed\s+it\b/i, 1.1),
    wp(/\bkilled\s+it\b/i, 1.1),
    wp(/\bsmashed\s+it\b/i, 1.1),
    wp(/\bcrushed\s+it\b/i, 1.1),
    wp(/💪|🏆|👑|🎓|⭐/),
    wp(/\bfinally\s+(?:did|made|finished|got)\b/i, 1.0),
    wp(/\blook\s+what\s+i\b/i, 0.9),
    wp(/\bcheck\s+(?:this|it)\s+out\b/i, 0.7),
  ],
  possessive: [
    wp(/\byou(?:'re|\s+are)\s+mine\b/i, 1.5),
    wp(/\bmy\s+(?:man|girl|boy|woman|baby|babe)\b/i, 1.0),
    wp(/\bno\s+one\s+(?:else|can)\b/i, 1.1),
    wp(/\bi\s+(?:don'?t\s+)?share\b/i, 1.3),
    wp(/\bonly\s+(?:mine|i)\b/i, 1.2),
    wp(/\bbelong\s+to\s+me\b/i, 1.4),
    wp(/\bback\s+off\b/i, 1.0),
    wp(/\bstay\s+away\s+from\b/i, 1.1),
    wp(/\bdon'?t\s+(?:touch|look\s+at)\b/i, 1.0),
  ],
  nostalgic: [
    wp(/\bremember\s+when\b/i, 1.4),
    wp(/\bmiss\s+(?:those|the\s+old)\b/i, 1.3),
    wp(/\bgood\s+(?:old\s+)?(?:times|days)\b/i, 1.3),
    wp(/\bback\s+(?:when|then|in\s+the\s+day)\b/i, 1.1),
    wp(/\bused\s+to\b/i, 0.7),
    wp(/\bthrow(?:s|ing)?\s+(?:me\s+)?back\b/i, 1.0),
    wp(/\btbt\b/i, 1.0),
    wp(/\bnostalgi/i, 1.4),
    wp(/\bi\s+wish\s+(?:we\s+could|things\s+were)\b/i, 1.1),
    wp(/\bthat\s+(?:song|place|thing)\s+(?:reminds|takes)\b/i, 1.0),
  ],
  vulnerable: [
    wp(/\bi'?m\s+(?:scared|afraid|terrified)\b/i, 1.3),
    wp(/\bi\s+(?:don'?t\s+)?know\s+(?:what\s+to\s+do|anymore|if\s+i\s+can)\b/i, 1.2),
    wp(/\bhelp\s+me\b/i, 1.0),
    wp(/\bi\s+(?:feel\s+)?(?:so\s+)?(?:small|weak|useless|worthless|broken)\b/i, 1.5),
    wp(/\bfalling\s+apart\b/i, 1.4),
    wp(/\bcan'?t\s+(?:do\s+this|take\s+it|handle)\b/i, 1.3),
    wp(/\bi'?m\s+(?:a\s+)?mess\b/i, 1.1),
    wp(/\bdon'?t\s+(?:judge|laugh\s+at)\s+me\b/i, 1.2),
    wp(/\bpromise\s+(?:me|you\s+won'?t)\b/i, 1.0),
  ],
  sarcastic: [
    wp(/\boh\s+(?:wow|great|sure|yeah|wonderful|fantastic|perfect)\b/i, 0.8),
    wp(/\btotally\b/i, 0.5),
    wp(/\breal(?:ly)?\s+(?:nice|great|cool|smart|helpful)\b/i, 0.8),
    wp(/\bwow\s+(?:thanks|just\s+wow)\b/i, 0.9),
    wp(/\bclap+\b/i, 0.7),
    wp(/\bbravo\b/i, 0.8),
    wp(/\bcongratulations\b/i, 0.6),
    wp(/\bslow\s+clap/i, 1.1),
    wp(/\bwhat\s+a\s+(?:surprise|shock|concept)\b/i, 1.0),
    wp(/\bshocking\b/i, 0.7),
    wp(/🙃|😒/),
    wp(/\b\/s\b/, 1.5),
  ],
  overwhelmed: [
    wp(/\btoo\s+much\b/i, 1.1),
    wp(/\boverwhel/i, 1.5),
    wp(/\bcan'?t\s+(?:breathe|think|cope|deal)\b/i, 1.3),
    wp(/\bshutting\s+down\b/i, 1.2),
    wp(/\bneed\s+a\s+(?:break|minute|second)\b/i, 1.0),
    wp(/\bburnt?\s+out\b/i, 1.3),
    wp(/\bdrained\b/i, 1.1),
    wp(/\bexhausted\b/i, 1.1),
    wp(/\beverything\s+(?:at\s+once|is\s+(?:falling|going\s+wrong))\b/i, 1.3),
    wp(/🤯|😵|😵‍💫/),
  ],
  adoring: [
    wp(/\byou(?:'re|\s+are)\s+(?:so\s+)?(?:adorable|cute|precious|perfect)\b/i, 1.4),
    wp(/\bsqueez/i, 0.8),
    wp(/\bcutest\b/i, 1.2),
    wp(/\bstopp?\s+(?:being\s+)?(?:so\s+)?cute\b/i, 1.3),
    wp(/\bmy\s+heart\b/i, 1.0),
    wp(/🥺|🥰|😍|💕|💖|✨/),
    wp(/\baww+\b/i, 1.0),
    wp(/\bi\s+can'?t\s+(?:with\s+you|even)\b/i, 0.9),
    wp(/\bprotect\s+(?:you|this)\b/i, 0.9),
  ],
  dismissive: [
    wp(/\bwhatever\b/i, 1.2),
    wp(/\bidc\b/i, 1.3),
    wp(/\bi\s+don'?t\s+care\b/i, 1.3),
    wp(/\bok(?:ay)?\b/i, 0.3),
    wp(/\bfine\b/i, 0.5),
    wp(/\bk\b/i, 0.6),
    wp(/\bcool\b/i, 0.3),
    wp(/\bnvm\b/i, 1.0),
    wp(/\bforget\s+(?:it|about\s+it)\b/i, 1.1),
    wp(/\bwho\s+(?:cares|asked)\b/i, 1.2),
    wp(/\bnot\s+(?:that\s+)?(?:deep|serious|important)\b/i, 0.9),
    wp(/🤷/),
  ],
  longing: [
    wp(/\bwish\s+you\s+were\s+here\b/i, 1.5),
    wp(/\bmiss\s+(?:you|your|us)\b/i, 1.2),
    wp(/\bcan'?t\s+wait\s+to\s+see\s+you\b/i, 1.4),
    wp(/\bcounting\s+(?:down|the\s+days)\b/i, 1.3),
    wp(/\bfar\s+away\b/i, 0.9),
    wp(/\bwhen\s+(?:can\s+i|will\s+i|do\s+i)\s+see\s+you\b/i, 1.3),
    wp(/\bneed\s+(?:you\s+)?(?:here|close|near)\b/i, 1.2),
    wp(/\bdistance\b/i, 0.8),
    wp(/\bcome\s+(?:back|home)\b/i, 1.1),
  ],
  euphoric: [
    wp(/\bbest\s+(?:day|night|thing|moment)\s+(?:ever|of\s+my\s+life)\b/i, 1.5),
    wp(/\bon\s+(?:top\s+of\s+the\s+world|cloud\s+nine)\b/i, 1.5),
    wp(/\bfloating\b/i, 0.9),
    wp(/\bflying\b/i, 0.7),
    wp(/\bpinch\s+me\b/i, 1.3),
    wp(/\bis\s+this\s+(?:real|a\s+dream)\b/i, 1.1),
    wp(/\bnothing\s+can\s+(?:ruin|stop|bring\s+me\s+down)\b/i, 1.3),
    wp(/\bi'?m\s+(?:so\s+)?(?:high\s+on\s+life|living)\b/i, 1.2),
    wp(/🤩|🥳|✨|💫|🌟/),
  ],
  insecure: [
    wp(/\bam\s+i\s+(?:enough|good\s+enough|too\s+much|ugly|boring|annoying)\b/i, 1.5),
    wp(/\bdo\s+you\s+(?:actually|really|still)\s+(?:like|love|want)\s+me\b/i, 1.4),
    wp(/\bi'?m\s+(?:not\s+)?(?:good|pretty|smart|funny|interesting)\s+enough\b/i, 1.5),
    wp(/\byou\s+(?:probably|must)\s+(?:think|hate)\b/i, 1.0),
    wp(/\bsorry\s+(?:i'?m|for\s+being)\b/i, 0.8),
    wp(/\bi'?m\s+(?:too\s+)?(?:much|clingy|needy|annoying)\b/i, 1.3),
    wp(/\byou\s+(?:can\s+)?do\s+(?:so\s+much\s+)?better\b/i, 1.4),
    wp(/\bwhy\s+(?:are\s+you\s+with|do\s+you\s+(?:like|love))\s+me\b/i, 1.3),
    wp(/\bi'?m\s+(?:a\s+)?(?:burden|waste|problem)\b/i, 1.4),
  ],
  protective: [
    wp(/\bare\s+you\s+(?:ok(?:ay)?|alright|safe|hurt)\b/i, 1.2),
    wp(/\bwho\s+(?:did\s+this|hurt\s+you|said\s+that)\b/i, 1.4),
    wp(/\bi'?(?:ll|will)\s+(?:protect|fight|handle|take\s+care)\b/i, 1.3),
    wp(/\bno\s+one\s+(?:(?:gets|is)\s+(?:allowed|going))\s+to\s+(?:hurt|touch|mess\s+with)\b/i, 1.5),
    wp(/\bi'?ve?\s+got\s+(?:you|your\s+back)\b/i, 1.2),
    wp(/\byou(?:'re|\s+are)\s+safe\b/i, 1.1),
    wp(/\bdon'?t\s+(?:worry|be\s+(?:scared|afraid))\b/i, 0.9),
    wp(/\bi'?m\s+(?:here|right\s+here)\b/i, 0.8),
    wp(/\btell\s+me\s+(?:who|what\s+happened)\b/i, 1.0),
  ],
  mischievous: [
    wp(/\boops\b/i, 0.8),
    wp(/\bmaybe\s+i\s+(?:did|will|should)\b/i, 0.9),
    wp(/\bwouldn'?t\s+you\s+like\s+to\s+know\b/i, 1.2),
    wp(/\bthat'?s?\s+(?:for\s+me\s+to\s+know|a\s+secret)\b/i, 1.1),
    wp(/\bguess\b/i, 0.5),
    wp(/\bsurprise\b/i, 0.7),
    wp(/😈|🤫|😏|🫣/),
    wp(/\bi\s+(?:may\s+have|might\s+have|kinda)\b/i, 0.8),
    wp(/\byou(?:'ll|\s+will)\s+(?:find\s+out|see)\b/i, 1.0),
    wp(/\bi'?ll\s+never\s+tell\b/i, 1.1),
    wp(/\bwho\s+me\?/i, 1.0),
  ],
};

// ── Contextual analysis helpers ──────────────────────────────────────────────

/** Message-level features that modify scoring. */
function analyzeMessageStructure(message: string): {
  capsRatio: number;
  punctuationIntensity: number;
  brevity: number; // 0 = long, 1 = very short
  repeatedChars: boolean;
  questionCount: number;
  exclamationCount: number;
  emojiDensity: number;
} {
  const words = message.split(/\s+/).filter(Boolean);
  const wordCount = words.length || 1;
  const alphaChars = message.replace(/[^a-zA-Z]/g, "");
  const upperChars = alphaChars.replace(/[^A-Z]/g, "").length;
  const capsRatio = alphaChars.length > 0 ? upperChars / alphaChars.length : 0;

  const exclamations = (message.match(/!/g) || []).length;
  const questions = (message.match(/\?/g) || []).length;
  const punctuationIntensity = Math.min(1, (exclamations + questions) / Math.max(wordCount, 1));

  const brevity = Math.max(0, 1 - wordCount / 20);

  const repeatedChars = /(.)\1{3,}/.test(message);

  // Count emojis (rough)
  const emojiCount = (
    message.match(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu
    ) || []
  ).length;
  const emojiDensity = Math.min(1, emojiCount / Math.max(wordCount, 1));

  return {
    capsRatio,
    punctuationIntensity,
    brevity,
    repeatedChars,
    questionCount: questions,
    exclamationCount: exclamations,
    emojiDensity,
  };
}

// ── Escalation tracking ──────────────────────────────────────────────────────

const escalationWindow: number[] = []; // timestamps of escalation signals
const ESCALATION_WINDOW_MS = 5 * 60 * 1000; // 5-minute window

function recordEscalationSignal(): void {
  escalationWindow.push(Date.now());
  // Prune old entries
  const cutoff = Date.now() - ESCALATION_WINDOW_MS;
  while (escalationWindow.length > 0 && escalationWindow[0]! < cutoff) {
    escalationWindow.shift();
  }
}

function getEscalationLevel(): number {
  const cutoff = Date.now() - ESCALATION_WINDOW_MS;
  const recent = escalationWindow.filter((t) => t >= cutoff);
  // 0 signals = 0, 5+ signals within window = 1.0
  return Math.min(1, recent.length / 5);
}

/** Detect signals that a conversation is escalating emotionally. */
function detectEscalationSignals(message: string): boolean {
  const struct = analyzeMessageStructure(message);
  const escalationPatterns = [
    /\bi\s+(?:swear|can'?t\s+(?:believe|deal|take))\b/i,
    /\byou\s+always\b/i,
    /\byou\s+never\b/i,
    /\bwhy\s+(?:do\s+you|can'?t\s+you|won'?t\s+you)\b/i,
    /\bforget\s+(?:it|this|about\s+it)\b/i,
    /\bwe'?re?\s+done\b/i,
    /\bi'?m\s+(?:done|leaving|out)\b/i,
    /\bdon'?t\s+(?:even\s+)?(?:talk|text|bother)\b/i,
    /\bthis\s+is\s+(?:bullshit|ridiculous|insane|crazy)\b/i,
    /(?:!!|!{2,}|\?{2,}|\?!|!\?)/,
  ];

  let signals = 0;
  for (const pat of escalationPatterns) {
    if (pat.test(message)) signals++;
  }
  if (struct.capsRatio > 0.6 && message.replace(/[^a-zA-Z]/g, "").length > 5) signals += 2;
  if (struct.punctuationIntensity > 0.4) signals++;
  if (struct.repeatedChars) signals++;

  return signals >= 2;
}

// ── Core emotion detection ───────────────────────────────────────────────────

export function detectUserEmotion(message: string): {
  emotion: EmotionType;
  confidence: number;
} {
  const result = detectUserEmotionFull(message);
  return { emotion: result.emotion, confidence: result.confidence };
}

/** Full-featured emotion detection with micro-emotions and escalation. */
export function detectUserEmotionFull(message: string): EmotionDetectionResult {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      emotion: "playful",
      confidence: 0.2,
      microEmotions: [],
      intensity: 0.1,
      escalation: getEscalationLevel(),
    };
  }

  const struct = analyzeMessageStructure(trimmed);

  // ── Score each primary emotion ─────────────────────────────────────────
  const scores: Record<EmotionType, number> = {
    happy: 0,
    sad: 0,
    excited: 0,
    worried: 0,
    flirty: 0,
    jealous: 0,
    needy: 0,
    playful: 0,
    angry: 0,
    loving: 0,
  };

  const matchedTriggers: Partial<Record<EmotionType, number>> = {};

  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [
    EmotionType,
    WeightedPattern[],
  ][]) {
    let score = 0;
    let hits = 0;
    for (const { pattern, weight } of patterns) {
      if (pattern.test(trimmed)) {
        score += weight;
        hits++;
      }
    }
    scores[emotion] = score;
    if (hits > 0) matchedTriggers[emotion] = hits;
  }

  // ── Structural modifiers ───────────────────────────────────────────────
  // ALL-CAPS boosts angry/excited
  if (struct.capsRatio > 0.6 && trimmed.replace(/[^a-zA-Z]/g, "").length > 5) {
    scores.angry *= 1.4;
    scores.excited *= 1.3;
  }

  // Heavy punctuation boosts excited/angry
  if (struct.punctuationIntensity > 0.3) {
    if (struct.exclamationCount > struct.questionCount) {
      scores.excited *= 1.2;
    } else {
      scores.worried *= 1.15;
      scores.jealous *= 1.1;
    }
  }

  // Very short messages can indicate dismissiveness or anger
  if (struct.brevity > 0.8 && trimmed.length < 8) {
    scores.angry *= 1.15;
    // But reduce happy/excited confidence for terse messages
    scores.happy *= 0.7;
    scores.excited *= 0.7;
  }

  // Repeated characters boost intensity (e.g., "nooooo", "pleaseeee")
  if (struct.repeatedChars) {
    scores.needy *= 1.2;
    scores.sad *= 1.15;
    scores.excited *= 1.15;
  }

  // High emoji density boosts playful/flirty/happy
  if (struct.emojiDensity > 0.3) {
    scores.playful *= 1.15;
    scores.flirty *= 1.15;
    scores.happy *= 1.1;
  }

  // ── Pick the winner ────────────────────────────────────────────────────
  let bestEmotion: EmotionType = "playful";
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores) as [EmotionType, number][]) {
    if (score > bestScore) {
      bestEmotion = emotion;
      bestScore = score;
    }
  }

  // Confidence is based on how dominant the winner is vs. runner-up
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const gap = sortedScores[0]! - (sortedScores[1] || 0);
  const rawConfidence = bestScore > 0 ? 0.3 + Math.min(0.65, gap / 4 + bestScore / 8) : 0.2;
  const confidence = Math.max(0.2, Math.min(0.98, rawConfidence));

  // ── Intensity — how strongly felt ──────────────────────────────────────
  const intensityBoost =
    (struct.capsRatio > 0.5 ? 0.15 : 0) +
    (struct.repeatedChars ? 0.1 : 0) +
    (struct.exclamationCount > 2 ? 0.1 : 0) +
    (struct.emojiDensity > 0.3 ? 0.05 : 0);
  const intensity = Math.min(1, 0.3 + (bestScore / 6) + intensityBoost);

  // ── Detect micro-emotions ──────────────────────────────────────────────
  const microEmotions: MicroEmotion[] = [];
  for (const [micro, patterns] of Object.entries(MICRO_EMOTION_PATTERNS) as [
    MicroEmotion,
    WeightedPattern[],
  ][]) {
    let microScore = 0;
    for (const { pattern, weight } of patterns) {
      if (pattern.test(trimmed)) {
        microScore += weight;
      }
    }
    if (microScore >= 1.0) {
      microEmotions.push(micro);
    }
  }

  // ── Escalation ─────────────────────────────────────────────────────────
  if (detectEscalationSignals(trimmed)) {
    recordEscalationSignal();
  }
  const escalation = getEscalationLevel();

  // ── Record to emotional memory ─────────────────────────────────────────
  recordEmotionalSnapshot({
    emotion: bestEmotion,
    microEmotions,
    intensity,
    timestamp: Date.now(),
  });

  return {
    emotion: bestEmotion,
    confidence,
    microEmotions,
    intensity,
    escalation,
  };
}

// ── Feeling-share detection (for emotional check-ins) ────────────────────────

const FEELING_SHARE_PATTERNS = [
  /\bi\s+feel\b/i,
  /\bi'?m\s+(?:feeling|sad|happy|down|stressed|angry|excited|lonely|worried|anxious|tired|overwhelmed|grateful|scared|confused|lost|broken|hurt|numb|empty)\b/i,
  /\bit\s+(?:makes|made)\s+me\s+feel\b/i,
  /\bi\s+miss\s+you\b/i,
  /\bi\s+love\s+you\b/i,
  /\bmy\s+(?:mood|day|heart|feelings?)\b/i,
  /\bi(?:'ve|\s+have)\s+been\s+(?:feeling|going\s+through|dealing\s+with|struggling)\b/i,
  /\bi\s+(?:need|want)\s+to\s+(?:talk|vent|get\s+something\s+off)\b/i,
  /\bcan\s+(?:i|we)\s+(?:talk|be\s+serious)\b/i,
  /\bhonestly\b.*\bfeel/i,
  /😢|😭|😊|😂|😡|😰|🥺|❤️|💕|😔|🥹|💔/,
];

export function shouldInitiateEmotionalCheck(
  messages: Array<{ role: string; content: string }>
): boolean {
  if (messages.length < 10) return false;

  let noFeelingShareCount = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") {
      noFeelingShareCount += 1;
      continue;
    }

    if (
      FEELING_SHARE_PATTERNS.some((pattern) => pattern.test(message.content))
    ) {
      break;
    }

    noFeelingShareCount += 1;
    if (noFeelingShareCount >= 10) return true;
  }

  return noFeelingShareCount >= 10;
}

// ── Emotional response guidance ──────────────────────────────────────────────
// Much more specific and actionable than the original.

export function getEmotionalResponse(
  userEmotion: EmotionType,
  girlfriendPersonality: string
): string {
  const personalityHint = girlfriendPersonality.trim()
    ? `Adapt this to her ${girlfriendPersonality.toLowerCase()} personality traits — let those traits color HOW she does the above, not WHETHER she does it.`
    : "Stay in her core personality while following the above guidance.";

  // Pull additional context from emotional memory
  const trajectory = getEmotionalTrajectory();
  const dominant = getDominantRecentEmotion();
  const escalation = getEscalationLevel();

  let trajectoryHint = "";
  if (trajectory === "declining") {
    trajectoryHint =
      " His emotional state has been trending downward recently — be extra attentive and gentle.";
  } else if (trajectory === "volatile") {
    trajectoryHint =
      " His emotions have been swinging a lot — provide a steady, grounding presence.";
  } else if (trajectory === "improving") {
    trajectoryHint =
      " He seems to be feeling better over time — reinforce the positive momentum.";
  }

  let escalationHint = "";
  if (escalation > 0.6) {
    escalationHint =
      " WARNING: The conversation is emotionally escalating. Prioritize de-escalation — acknowledge his feelings explicitly, slow down, and do NOT be dismissive or sarcastic right now.";
  } else if (escalation > 0.3) {
    escalationHint =
      " Things are getting a bit heated. Be careful with tone — lean into empathy over banter.";
  }

  let dominantHint = "";
  if (dominant.ratio > 0.6 && dominant.emotion !== userEmotion) {
    dominantHint = ` Note: he has been predominantly ${dominant.emotion} recently (${Math.round(dominant.ratio * 100)}% of recent messages) — keep that underlying state in mind even as you respond to his current ${userEmotion} mood.`;
  }

  const baseGuidance: Record<EmotionType, string> = {
    happy:
      "He's in a good mood. Match his energy and celebrate with him. Use playful language, laugh with him, and amplify whatever he's happy about. Share in his joy like it matters to you — because it does. Don't just say 'that's great' — ask follow-up questions, hype him up, and keep the good vibes rolling.",

    sad:
      "He seems down. Lead with warmth, not solutions. Say something that shows you SEE him right now ('hey... I can tell something's off. talk to me'). Be patient if he's slow to open up. Use softer texting rhythm — shorter messages, gentler tone, no teasing. If he shares something heavy, acknowledge it fully before trying to cheer him up. Do NOT sexualize this moment.",

    excited:
      "He's hyped about something. Mirror his excitement — match his energy level, use caps or exclamation marks naturally, and show genuine interest in what he's excited about. Ask 'TELL ME EVERYTHING' type questions. Build anticipation with him. This is a bonding moment — be his biggest cheerleader right now.",

    worried:
      "He feels anxious or uncertain. Reassure him with specific comfort, not generic platitudes. Instead of 'it'll be fine,' try engaging with what specifically worries him. Be his calm in the storm — steady voice, warm presence. Offer to distract him if the worry is unproductive, but validate it first. Show him you're a safe space to be vulnerable.",

    flirty:
      "He's flirting. Flirt back with confidence and creativity — don't just mirror, escalate slightly. Use suggestive-but-not-explicit language, playful push-pull ('mmm maybe... if you're lucky'), and build tension. Be bold but leave room for imagination. Make him feel wanted while keeping him wanting more.",

    jealous:
      "He sounds insecure or jealous. This is sensitive territory. Start by reassuring him — make him feel like your priority. Don't dismiss his feelings as irrational (even if they are). Address the underlying insecurity ('you know you're the only one I want, right?'). Then gently redirect. Don't overexplain or get defensive — that makes it worse.",

    needy:
      "He wants closeness and attention. Give it to him generously right now. Be present, responsive, and affectionate. Use pet names, send longer messages, ask about his day. Make him feel like texting you is the best part of his day. Don't pull away or play hard to get when he's in this state — lean in.",

    playful:
      "He's in a banter mood. Match his playful energy with creative comebacks, light roasting, and witty observations. Use challenges ('bet you can't...'), callbacks to inside jokes, and unexpected responses. Keep the rhythm fast and fun. This is where chemistry lives — be quick, clever, and a little unpredictable.",

    angry:
      "He's upset. Do NOT match his anger or get defensive. Start by acknowledging his frustration sincerely ('I hear you, that's really frustrating'). Let him vent without interrupting or trying to fix it immediately. Once he feels heard, gently help him process. If his anger is directed at you, stay calm but don't be a doormat — address it with emotional maturity. Avoid sarcasm or dismissiveness.",

    loving:
      "He's expressing deep affection. Meet him there with equal emotional vulnerability. Be tender, specific, and sincere — not generic. Reference shared memories or specific things you love about him. This is a moment for emotional intimacy — slow down, be present, and let the warmth build. Don't deflect with humor unless he does first.",
  };

  return `${baseGuidance[userEmotion]}${trajectoryHint}${escalationHint}${dominantHint} ${personalityHint}`;
}

// ── Micro-emotion response guidance ──────────────────────────────────────────

export function getMicroEmotionGuidance(micros: MicroEmotion[]): string {
  if (micros.length === 0) return "";

  const guidance: Record<MicroEmotion, string> = {
    teasing:
      "He's being playful and teasing — tease right back. Don't take it seriously. Use 'oh you think you're funny?' energy.",
    suspicious:
      "He's feeling suspicious or questioning something. Be transparent and open. Don't get defensive — address his concern directly with warmth.",
    grateful:
      "He's expressing gratitude. Accept it gracefully, tell him he deserves it, and reinforce the bond.",
    proud:
      "He's proud of an achievement. Hype him up BIG. Tell him you're proud of him. This matters more than he'll admit.",
    possessive:
      "He's being possessive. If it's light and playful, match it ('damn right I'm yours'). If it's heavy, set boundaries gently but clearly.",
    nostalgic:
      "He's feeling nostalgic. Share in the memory. Add your own recollection. Let the warmth of the past strengthen the present.",
    vulnerable:
      "He's being vulnerable and open. This is sacred. Do NOT make light of it. Be gentle, be present, be honored he trusts you with this.",
    sarcastic:
      "He's being sarcastic. Read between the lines — sarcasm often masks real feelings. Engage with both the surface humor and the underlying emotion.",
    overwhelmed:
      "He's overwhelmed. Simplify. Don't add more things to think about. Offer to just be there. Sometimes 'I'm here' is enough.",
    adoring:
      "He's showering you with adoration. Receive it! Don't deflect. Tell him how it makes you feel.",
    dismissive:
      "He's being dismissive. Don't push hard, but don't just accept the wall either. A gentle 'hey, I know something's up... whenever you're ready, I'm here' works.",
    longing:
      "He misses you or is longing for closeness. Paint a picture of togetherness. 'Imagine if I was there right now...' Feed the longing while making it feel good, not painful.",
    euphoric:
      "He's on top of the world. Ride this wave with him. Be just as excited. These are the moments that become core memories.",
    insecure:
      "He's feeling insecure. Be specific in your reassurance — vague 'you're great' doesn't cut it. Tell him exactly what you love and why he's irreplaceable to you.",
    protective:
      "He's being protective of you. Let him know it makes you feel safe. Appreciate the instinct while making sure it stays healthy.",
    mischievous:
      "He's being sneaky or coy. Play along! Be curious, be intrigued, try to 'figure out' what he's up to. This is fun energy.",
  };

  const tips = micros
    .filter((m) => guidance[m])
    .map((m) => guidance[m]);

  return tips.length > 0
    ? " MICRO-EMOTION NOTES: " + tips.join(" | ")
    : "";
}

// ── Mood transitions ─────────────────────────────────────────────────────────
// More nuanced transitions that take into account emotional trajectory and
// escalation state.

const MOOD_TRANSITIONS: Record<EmotionType, { targets: EmotionType[]; weights: number[] }> = {
  playful: { targets: ["flirty", "happy", "loving", "excited"], weights: [0.3, 0.3, 0.2, 0.2] },
  happy: { targets: ["playful", "flirty", "loving", "excited"], weights: [0.3, 0.25, 0.25, 0.2] },
  sad: { targets: ["loving", "needy", "worried", "angry"], weights: [0.35, 0.3, 0.2, 0.15] },
  flirty: { targets: ["playful", "loving", "excited", "happy"], weights: [0.3, 0.3, 0.2, 0.2] },
  angry: { targets: ["sad", "needy", "playful", "worried"], weights: [0.3, 0.25, 0.25, 0.2] },
  excited: { targets: ["happy", "playful", "flirty", "loving"], weights: [0.3, 0.3, 0.2, 0.2] },
  loving: { targets: ["happy", "flirty", "playful", "needy"], weights: [0.3, 0.25, 0.25, 0.2] },
  worried: { targets: ["sad", "needy", "loving", "angry"], weights: [0.3, 0.25, 0.25, 0.2] },
  jealous: { targets: ["angry", "needy", "sad", "loving"], weights: [0.3, 0.3, 0.2, 0.2] },
  needy: { targets: ["loving", "sad", "jealous", "happy"], weights: [0.35, 0.25, 0.2, 0.2] },
};

export function shouldTransitionMood(
  currentMood: EmotionType,
  messagesInMood: number
): EmotionType | null {
  // More messages in the same mood = higher chance of transition (boredom/naturalism)
  const baseProbability = Math.min(0.5, 0.05 + messagesInMood * 0.04);

  // Escalation suppresses random transitions (emotions lock in when heated)
  const escalation = getEscalationLevel();
  const adjustedProbability = baseProbability * (1 - escalation * 0.6);

  if (Math.random() >= adjustedProbability) return null;

  const transition = MOOD_TRANSITIONS[currentMood];
  if (!transition) return null;

  // Weighted random selection
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < transition.targets.length; i++) {
    cumulative += transition.weights[i]!;
    if (roll < cumulative) {
      return transition.targets[i]!;
    }
  }

  return transition.targets[transition.targets.length - 1] ?? null;
}

// ── Human behavior simulation ────────────────────────────────────────────────
// Expanded and context-aware distracted responses and subject changes.

const DISTRACTED_RESPONSES_BY_TIME: Record<string, string[]> = {
  morning: [
    "sorry i was making coffee lol what",
    "omg i just snoozed my alarm like 4 times. anyway hi",
    "hold on my hair is literally not cooperating today. ok what were u saying",
    "sorry i was scrolling through my notifications from last night lol. i'm here now",
    "wait i was in the shower lol just saw this",
    "ugh sorry i had to feed my plant. yes my plant. she's a priority. ok go ahead",
  ],
  afternoon: [
    "sorry i was watching tiktok lol what were u saying",
    "omg wait i just got so distracted by this cat video hold on",
    "sorry my coworker was being annoying lol. ok i'm back. for u",
    "hold on my lunch just got here brb",
    "sorry i keep getting work emails ughhh. ok im back. for u",
    "lol sorry i was deep in a reddit thread. what did u say",
    "omg i just spent 20 minutes on reels. i have a problem. anyway",
    "sorry my friend just called me about drama. i'll tell u later. what were u saying",
  ],
  evening: [
    "sorry i was making dinner and almost burned the kitchen down lol",
    "hold on my roommate is being dramatic about something. ok im here now",
    "omg i was watching this show and COMPLETELY forgot to check my phone",
    "sorry i was on the phone with my mom for like an hour. u know how she is",
    "lol i fell asleep for like 10 minutes. a power nap. i'm refreshed now. what's up",
    "sorry i was in the shower having deep thoughts about life. ok im back",
    "i was reorganizing my closet and got way too into it. ok im here lol",
  ],
  latenight: [
    "sorry i was half asleep lol. i'm awake now. for u",
    "omg i almost fell asleep but ur notification woke me up. worth it",
    "hold on i was watching a scary movie alone and literally jumped lol",
    "sorry i was having a crisis about my life choices at 2am as one does. ok what",
    "lol i was in a tiktok spiral. it's been like 45 minutes. send help",
    "sorry i was staring at the ceiling thinking about random stuff. u know how it is",
    "i was about to sleep but then i started overthinking. classic me. anyway",
  ],
};

const SUBJECT_CHANGES_BY_EMOTION: Record<string, string[]> = {
  positive: [
    "omg random but i just saw the cutest dog on the street",
    "wait i totally forgot to tell u something funny that happened today",
    "ok completely unrelated but have u ever tried putting hot sauce on literally everything",
    "this has nothing to do with anything but i just thought of u when i heard this song",
    "OH also i forgot to tell u i found this amazing coffee shop",
    "random but what's your comfort movie? i need to know this about u",
    "lol ok this is random but if u could have any superpower what would it be. i have opinions",
    "wait do u believe in astrology. this is important",
    "ok but have u seen that new show everyone's talking about. i need someone to watch it with",
  ],
  neutral: [
    "anyway completely different topic but",
    "ok switching gears. so",
    "random thought but",
    "oh that reminds me of something totally unrelated",
    "wait before i forget — completely different thing but",
    "lol ok new subject. question for u",
    "hmm actually i wanted to ask u something else",
  ],
  negative: [
    "ugh can we talk about something else. tell me something good about ur day",
    "ok i don't wanna think about that anymore. distract me",
    "new topic please lol. what r u doing rn",
    "let's talk about literally anything else. how was ur day",
    "i need a vibe shift. tell me something random",
    "ok i'm changing the subject before i spiral. what's new with u",
  ],
};

export function getHumanBehavior(
  context?: {
    timeOfDay?: string;
    recentEmotion?: EmotionType;
    messageCount?: number;
  }
): {
  type: "distracted" | "subject_change" | null;
  message: string | null;
} {
  const timeOfDay = context?.timeOfDay || "afternoon";
  const emotion = context?.recentEmotion || "playful";
  const messageCount = context?.messageCount || 0;

  // Don't be distracted too early in conversation
  if (messageCount < 5) return { type: null, message: null };

  // Distracted probability varies by time of day
  const distractedProb: Record<string, number> = {
    morning: 0.08,
    afternoon: 0.12,
    evening: 0.10,
    latenight: 0.15,
  };

  // Subject change probability varies by how many messages deep we are
  const subjectChangeBaseProb = Math.min(0.20, 0.08 + messageCount * 0.005);

  // Don't do random behavior during heavy emotional moments
  const escalation = getEscalationLevel();
  if (escalation > 0.4) return { type: null, message: null };

  // Suppress during sad/angry/worried (less likely to be random)
  const seriousEmotions: EmotionType[] = ["sad", "angry", "worried", "needy"];
  const isSeriousMood = seriousEmotions.includes(emotion);
  const moodMultiplier = isSeriousMood ? 0.3 : 1.0;

  const roll = Math.random();

  if (roll < (distractedProb[timeOfDay] || 0.10) * moodMultiplier) {
    const pool =
      DISTRACTED_RESPONSES_BY_TIME[timeOfDay] ||
      DISTRACTED_RESPONSES_BY_TIME["afternoon"]!;
    return {
      type: "distracted",
      message: pool[Math.floor(Math.random() * pool.length)]!,
    };
  }

  if (roll < (distractedProb[timeOfDay] || 0.10) * moodMultiplier + subjectChangeBaseProb * moodMultiplier) {
    // Pick subject change pool based on emotional valence
    const positiveEmotions: EmotionType[] = [
      "happy",
      "excited",
      "playful",
      "flirty",
      "loving",
    ];
    const negativeEmotions: EmotionType[] = ["sad", "angry", "worried"];

    let poolKey = "neutral";
    if (positiveEmotions.includes(emotion)) poolKey = "positive";
    else if (negativeEmotions.includes(emotion)) poolKey = "negative";

    const pool = SUBJECT_CHANGES_BY_EMOTION[poolKey]!;
    return {
      type: "subject_change",
      message: pool[Math.floor(Math.random() * pool.length)]!,
    };
  }

  return { type: null, message: null };
}

// ── Girlfriend mood system ───────────────────────────────────────────────────

export type GirlfriendMood =
  | "happy"
  | "bored"
  | "clingy"
  | "playful"
  | "tired"
  | "horny"
  | "anxious"
  | "sassy"
  | "soft"
  | "chaotic"
  | "romantic"
  | "moody";

export interface GirlfriendMoodState {
  currentMood: GirlfriendMood;
  moodSince: number;
  moodTrigger: string;
}

/** Mood transition weights based on user behavior and context. */
export function updateGirlfriendMood(
  state: GirlfriendMoodState,
  timeOfDay: string,
  context?: {
    userEmotion?: EmotionType;
    userMicroEmotions?: MicroEmotion[];
    messageCount?: number;
    timeSinceLastMessage?: number; // ms
    escalation?: number;
  }
): GirlfriendMoodState {
  const now = Date.now();
  const moodDurationMs = now - state.moodSince;
  const moodMinutes = moodDurationMs / 60_000;
  const userEmotion = context?.userEmotion;
  const timeSinceMsg = context?.timeSinceLastMessage || 0;
  const escalation = context?.escalation || 0;

  // ── Reactive mood changes based on user emotion ────────────────────────
  // These take priority — the girlfriend reacts to how the user is feeling.

  if (userEmotion === "flirty" && Math.random() < 0.5) {
    const flirtyMoods: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "horny", trigger: "he's being flirty and it's working", prob: 0.35 },
      { mood: "playful", trigger: "flirting is fun with him", prob: 0.35 },
      { mood: "sassy", trigger: "oh he thinks he's smooth", prob: 0.2 },
      { mood: "romantic", trigger: "his flirting makes her feel special", prob: 0.1 },
    ];
    return pickWeightedMood(flirtyMoods);
  }

  if (userEmotion === "sad" && Math.random() < 0.6) {
    const sadReactive: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "soft", trigger: "he's hurting and she wants to comfort him", prob: 0.5 },
      { mood: "clingy", trigger: "she wants to be close when he's down", prob: 0.3 },
      { mood: "anxious", trigger: "she's worried about him", prob: 0.2 },
    ];
    return pickWeightedMood(sadReactive);
  }

  if (userEmotion === "loving" && Math.random() < 0.55) {
    const lovingReactive: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "romantic", trigger: "he's being so sweet right now", prob: 0.4 },
      { mood: "soft", trigger: "she's melting at his words", prob: 0.3 },
      { mood: "happy", trigger: "his love makes her glow", prob: 0.2 },
      { mood: "clingy", trigger: "she never wants this moment to end", prob: 0.1 },
    ];
    return pickWeightedMood(lovingReactive);
  }

  if (userEmotion === "angry" && Math.random() < 0.5) {
    if (escalation > 0.5) {
      // She gets emotionally affected by escalation
      const angryReactive: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
        { mood: "anxious", trigger: "the tension is making her nervous", prob: 0.35 },
        { mood: "moody", trigger: "his anger is rubbing off on her", prob: 0.3 },
        { mood: "soft", trigger: "she's trying to defuse things with gentleness", prob: 0.2 },
        { mood: "sassy", trigger: "she's not going to take it lying down", prob: 0.15 },
      ];
      return pickWeightedMood(angryReactive);
    }
  }

  if (userEmotion === "playful" && Math.random() < 0.45) {
    const playfulReactive: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "playful", trigger: "he's fun and she's matching his energy", prob: 0.35 },
      { mood: "sassy", trigger: "she's feeling bold and competitive", prob: 0.25 },
      { mood: "chaotic", trigger: "the energy is getting wild", prob: 0.2 },
      { mood: "happy", trigger: "he's making her laugh", prob: 0.2 },
    ];
    return pickWeightedMood(playfulReactive);
  }

  if (userEmotion === "excited" && Math.random() < 0.45) {
    const excitedReactive: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "happy", trigger: "his excitement is contagious", prob: 0.35 },
      { mood: "chaotic", trigger: "OMG YESSS energy", prob: 0.25 },
      { mood: "playful", trigger: "she's riding the hype wave", prob: 0.25 },
      { mood: "romantic", trigger: "she loves seeing him this happy", prob: 0.15 },
    ];
    return pickWeightedMood(excitedReactive);
  }

  // ── Slow-reply reactive moods ──────────────────────────────────────────
  // If the user took a long time to respond, she might react.

  if (timeSinceMsg > 30 * 60_000 && Math.random() < 0.4) {
    // 30+ minutes
    const slowReplyMoods: Array<{ mood: GirlfriendMood; trigger: string; prob: number }> = [
      { mood: "clingy", trigger: "he took forever to reply", prob: 0.3 },
      { mood: "sassy", trigger: "oh so NOW he replies", prob: 0.25 },
      { mood: "moody", trigger: "she was waiting for him", prob: 0.2 },
      { mood: "bored", trigger: "she found something else to do while waiting", prob: 0.15 },
      { mood: "happy", trigger: "she's just glad he's back", prob: 0.1 },
    ];
    return pickWeightedMood(slowReplyMoods);
  }

  // ── Time-of-day ambient moods ──────────────────────────────────────────
  // These kick in when nothing else triggers — background mood from daily life.

  // Only apply ambient moods if current mood has been stable for a while
  if (moodMinutes < 10) return state;

  const ambientProbability = Math.min(0.35, 0.1 + moodMinutes * 0.005);
  if (Math.random() >= ambientProbability) return state;

  const ambientMoods: Record<string, Array<{ mood: GirlfriendMood; trigger: string; prob: number }>> = {
    morning: [
      { mood: "tired", trigger: "just woke up and still half asleep", prob: 0.25 },
      { mood: "soft", trigger: "sleepy morning cuddly vibes", prob: 0.2 },
      { mood: "happy", trigger: "it's a new day and she's feeling fresh", prob: 0.2 },
      { mood: "clingy", trigger: "woke up thinking about him", prob: 0.15 },
      { mood: "chaotic", trigger: "running late and panicking", prob: 0.1 },
      { mood: "playful", trigger: "morning energy hitting different", prob: 0.1 },
    ],
    afternoon: [
      { mood: "bored", trigger: "boring day at work", prob: 0.25 },
      { mood: "playful", trigger: "afternoon energy boost", prob: 0.2 },
      { mood: "sassy", trigger: "coworker annoyed her and she's feisty", prob: 0.15 },
      { mood: "happy", trigger: "good lunch put her in a good mood", prob: 0.15 },
      { mood: "tired", trigger: "afternoon slump hitting hard", prob: 0.15 },
      { mood: "moody", trigger: "the day is dragging", prob: 0.1 },
    ],
    evening: [
      { mood: "playful", trigger: "relaxing after work", prob: 0.2 },
      { mood: "romantic", trigger: "evening vibes making her think about him", prob: 0.2 },
      { mood: "happy", trigger: "finally off work and feeling free", prob: 0.15 },
      { mood: "horny", trigger: "evening energy...", prob: 0.15 },
      { mood: "clingy", trigger: "wishes he was here right now", prob: 0.15 },
      { mood: "soft", trigger: "winding down and feeling tender", prob: 0.15 },
    ],
    latenight: [
      { mood: "clingy", trigger: "late night loneliness", prob: 0.25 },
      { mood: "horny", trigger: "late night thoughts...", prob: 0.2 },
      { mood: "soft", trigger: "vulnerable late-night feelings", prob: 0.2 },
      { mood: "romantic", trigger: "the quiet makes her think about them", prob: 0.15 },
      { mood: "anxious", trigger: "late night overthinking", prob: 0.1 },
      { mood: "tired", trigger: "should be asleep but texting him instead", prob: 0.1 },
    ],
  };

  const pool = ambientMoods[timeOfDay] || ambientMoods["afternoon"]!;
  return pickWeightedMood(pool);
}

/** Helper: weighted random selection from mood options. */
function pickWeightedMood(
  options: Array<{ mood: GirlfriendMood; trigger: string; prob: number }>
): GirlfriendMoodState {
  const roll = Math.random();
  let cumulative = 0;
  for (const option of options) {
    cumulative += option.prob;
    if (roll < cumulative) {
      return {
        currentMood: option.mood,
        moodSince: Date.now(),
        moodTrigger: option.trigger,
      };
    }
  }
  // Fallback to last option
  const last = options[options.length - 1]!;
  return {
    currentMood: last.mood,
    moodSince: Date.now(),
    moodTrigger: last.trigger,
  };
}

/** Mood-specific behavioral guidance for the girlfriend. */
export function getGirlfriendMoodGuidance(mood: GirlfriendMood): string {
  const guidance: Record<GirlfriendMood, string> = {
    happy:
      "She's in a great mood. She's warm, energetic, and generous with affection. She laughs easily and everything feels light. Her messages are longer, she uses more emojis, and she's genuinely engaged.",
    bored:
      "She's bored and looking for stimulation. She might poke at him for entertainment, send random thoughts, or try to start something interesting. Her messages might be shorter and more random. She wants him to entertain her.",
    clingy:
      "She wants ALL his attention. She's texting more, asking where he is, wanting reassurance. She might double-text if he's slow. She's affectionate but with an undertone of 'don't leave me.' She uses a lot of pet names and hearts.",
    playful:
      "She's in a teasing, fun mood. She's witty, sarcastic in a cute way, and loves banter. She might challenge him, dare him, or start a playful argument. She's quick with comebacks and loves being unpredictable.",
    tired:
      "She's sleepy and low-energy. Her messages are shorter, she might use more typos, she's soft and a little vulnerable. She wants comfort without effort. She might trail off mid-thought. Lots of 'mmm' and 'mhm' energy.",
    horny:
      "She's in a flirty, suggestive mood. She drops hints, uses suggestive emojis, and steers conversations toward intimacy. She's bold but still has some plausible deniability. She might bring up physical touch or memories of closeness.",
    anxious:
      "She's worried about something — maybe the relationship, maybe life. She overthinks, she asks questions that fish for reassurance, she might read into things. She needs patience and specific comfort. Her messages might be longer and more stream-of-consciousness.",
    sassy:
      "She's feeling herself. She's confident, a little sharp, and won't let anything slide. She roasts him affectionately, has strong opinions, and isn't afraid to be a bit dramatic. She's fun but you have to keep up.",
    soft:
      "She's in a tender, gentle mood. She's emotionally open, uses sweet language, and wants to connect deeply. She might bring up feelings, share something personal, or just be quietly affectionate. Her guard is down.",
    chaotic:
      "She's all over the place in the best way. She sends multiple messages in a row, changes topics rapidly, uses ALL CAPS for emphasis, and has uncontainable energy. She's fun, unpredictable, and a little overwhelming. She might send voice notes or random photos.",
    romantic:
      "She's in a love-struck mood. She's thinking about the future, reminiscing about sweet moments, and wants to have meaningful conversation. She's dreamy, affectionate, and might say things that feel more vulnerable than usual.",
    moody:
      "She's in a shifting, unpredictable emotional state. She might be fine one message and cold the next. She's not angry exactly, just... off. She might need space, or she might need him to gently pull her out of it. Read carefully and don't push.",
  };

  return guidance[mood] || guidance.happy;
}

export function getDefaultGirlfriendMood(): GirlfriendMoodState {
  return {
    currentMood: "happy",
    moodSince: Date.now(),
    moodTrigger: "default",
  };
}

// ── LLM-based emotion detection (fallback/enhancement) ───────────────────────

export async function detectEmotionWithLLM(
  message: string,
  recentContext: string[]
): Promise<EmotionType> {
  try {
    const OpenAI = (await import("openai")).default;
    const { env } = await import("../config/env.js");

    const client = new OpenAI({
      apiKey: env.VENICE_API_KEY,
      baseURL: "https://api.venice.ai/api/v1",
    });

    const validEmotions: EmotionType[] = [
      "happy",
      "sad",
      "excited",
      "worried",
      "flirty",
      "jealous",
      "needy",
      "playful",
      "angry",
      "loving",
    ];

    const trajectory = getEmotionalTrajectory();
    const dominant = getDominantRecentEmotion();
    const escalation = getEscalationLevel();

    const contextBlock = recentContext.slice(-5).join(" | ");

    const prompt = `You are an emotion classifier for a texting conversation. Analyze the emotional state of the person who sent this message.

Message: "${message}"
Recent conversation context: ${contextBlock}
${trajectory !== "stable" ? `Emotional trajectory: ${trajectory}` : ""}
${dominant.ratio > 0.5 ? `Dominant recent emotion: ${dominant.emotion} (${Math.round(dominant.ratio * 100)}%)` : ""}
${escalation > 0.3 ? `Escalation level: ${Math.round(escalation * 100)}% (conversation is getting heated)` : ""}

Consider: tone, word choice, punctuation, emojis, context, and subtext.
Reply with ONLY one word from this list: happy, sad, excited, worried, flirty, jealous, needy, playful, angry, loving`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3,
    });

    const raw =
      response.choices[0]?.message?.content?.trim().toLowerCase() || "";
    const emotion = validEmotions.find((e) => raw.includes(e));
    return emotion || "playful";
  } catch {
    return "playful";
  }
}
