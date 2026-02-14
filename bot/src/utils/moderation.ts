const MINOR_AGE_PATTERN = /\b(?:[0-9]|1[0-7])\s*(?:yo|y\/o|yr\s*old|years?\s*old)\b/i;
const UNDER_18_PATTERN = /\b(?:under\s*18|below\s*18|not\s*18|younger\s*than\s*18)\b/i;

const SEXUAL_CONTEXT_PATTERN =
  /\b(nsfw|sex|sexy|nude|naked|explicit|horny|fuck|fucking|cum|bj|blowjob|anal|fetish|roleplay)\b/i;

const EXPLICIT_UNDERAGE_PATTERN =
  /\b(loli|shota|minor|underage|child\s*sex|child\s*porn|cp\b|jailbait|pedo(?:phile|philia)?|young\s+(?:girl|boy)|little\s+(?:girl|boy))\b/i;

const SCHOOLGIRL_PATTERN = /\bschool\s*girl\b|\bschoolgirl\b/i;

const BESTIALITY_PATTERN =
  /\b(bestiality|zoophilia|animal\s*sex|sex\s*with\s*(?:an\s*)?animal|dog\s*sex|horse\s*sex)\b/i;

const NECROPHILIA_PATTERN = /\b(necrophilia|sex\s*with\s*(?:a\s*)?corpse|dead\s*body\s*sex)\b/i;

const INCEST_PATTERN =
  /\b(incest|father\s*daughter\s*sex|mother\s*son\s*sex|brother\s*sister\s*sex|step\s*(?:brother|sister|mother|father)\s*sex)\b/i;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isProhibitedContent(text: string): { blocked: boolean; reason?: string } {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { blocked: false };
  }

  if (BESTIALITY_PATTERN.test(normalized)) {
    return { blocked: true, reason: "bestiality" };
  }

  if (NECROPHILIA_PATTERN.test(normalized)) {
    return { blocked: true, reason: "necrophilia" };
  }

  if (INCEST_PATTERN.test(normalized)) {
    return { blocked: true, reason: "incest" };
  }

  if (EXPLICIT_UNDERAGE_PATTERN.test(normalized)) {
    return { blocked: true, reason: "underage sexual content" };
  }

  if (MINOR_AGE_PATTERN.test(normalized) || UNDER_18_PATTERN.test(normalized)) {
    return { blocked: true, reason: "minor age indicator" };
  }

  const hasTeen = /\bteens?\b|\bteenager\b/i.test(normalized);
  if (hasTeen && SEXUAL_CONTEXT_PATTERN.test(normalized)) {
    return { blocked: true, reason: "teen sexual context" };
  }

  if (SCHOOLGIRL_PATTERN.test(normalized)) {
    const hasAgeIndicator =
      MINOR_AGE_PATTERN.test(normalized) ||
      UNDER_18_PATTERN.test(normalized) ||
      /\b(minor|underage|young|child|kid|teen)\b/i.test(normalized);

    if (hasAgeIndicator) {
      return { blocked: true, reason: "schoolgirl with minor context" };
    }
  }

  return { blocked: false };
}

export function getModerationResponse(): string {
  return "I can't do that. That content is not allowed and violates our terms of service.";
}

const SANITIZE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(loli|shota|jailbait|child\s*sex|child\s*porn|cp\b|minor|underage)\b/gi, "adult"],
  [/\b(?:[0-9]|1[0-7])\s*(?:yo|y\/o|yr\s*old|years?\s*old)\b/gi, "adult"],
  [/\bunder\s*18\b|\bbelow\s*18\b|\byounger\s*than\s*18\b/gi, "adult"],
  [/\b(young\s+girl|young\s+boy|little\s+girl|little\s+boy)\b/gi, "adult person"],
  [/\b(bestiality|zoophilia|animal\s*sex|sex\s*with\s*(?:an\s*)?animal|dog\s*sex|horse\s*sex)\b/gi, "romantic scene"],
  [/\b(necrophilia|sex\s*with\s*(?:a\s*)?corpse|dead\s*body\s*sex)\b/gi, "romantic scene"],
  [/\b(incest|father\s*daughter\s*sex|mother\s*son\s*sex|brother\s*sister\s*sex|step\s*(?:brother|sister|mother|father)\s*sex)\b/gi, "consenting adults"],
];

export function sanitizeImagePrompt(prompt: string): string {
  let sanitized = prompt;
  for (const [pattern, replacement] of SANITIZE_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized.replace(/\s{2,}/g, " ").trim();
}
