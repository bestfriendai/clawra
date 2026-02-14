const MAX_INPUT_LENGTH = 2000;

const MARKUP_PATTERNS: RegExp[] = [
  /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,
  /<\s*img\b[^>]*>/gi,
  /<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi,
  /<\s*object\b[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi,
  /<\s*embed\b[^>]*>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\s*\/\s*html/gi,
  /on\w+\s*=\s*(["']).*?\1/gi,
  /<[^>]+>/g,
];

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /you\s+are\s+now\b/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?/gi,
  /system\s*:/gi,
  /system\s+prompt\s*:/gi,
  /developer\s+message\s*:/gi,
  /assistant\s+instructions?\s*:/gi,
  /###\s*(system|developer|assistant)\b/gi,
  /<\s*(system|developer|assistant)\s*>[\s\S]*?<\s*\/\s*(system|developer|assistant)\s*>/gi,
];

function cleanControlCharacters(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

function applyPatterns(text: string, patterns: RegExp[]): string {
  let sanitized = text;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, " ");
  }
  return sanitized;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeUserInput(text: string): string {
  const cleaned = cleanControlCharacters(text);
  const withoutMarkup = applyPatterns(cleaned, MARKUP_PATTERNS);
  const normalized = normalizeWhitespace(withoutMarkup);
  return normalized.slice(0, MAX_INPUT_LENGTH);
}

export function sanitizeForAI(text: string): string {
  const base = sanitizeUserInput(text);
  const withoutInjection = applyPatterns(base, PROMPT_INJECTION_PATTERNS);
  const normalized = normalizeWhitespace(withoutInjection);
  return normalized.slice(0, MAX_INPUT_LENGTH);
}
