/**
 * constants.ts — Shared constants for the Nerve Center client.
 *
 * Includes attachment limits, wake/stop phrases, model context-window
 * sizes, and context-usage warning thresholds.
 */

/** Maximum number of file attachments per message. */
export const MAX_ATTACHMENTS = 4;
/** Maximum size per attachment in bytes (4 MB). */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

// ─── Connection defaults ──────────────────────────────────────────────────────
// Used as placeholder/fallback only — actual URL comes from /api/connect-defaults
export const DEFAULT_GATEWAY_WS = 'ws://127.0.0.1:18789';

/** Escape special regex characters for safe use in RegExp constructors */
export function escapeRegex(input: string): string {
  if (!input) return '';
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DEFAULT_WAKE_PREFIXES = ['hey'];

/**
 * Wake-word prefixes per language (ISO 639-1).
 *
 * English is always included as fallback for backwards compatibility.
 */
export const WAKE_PREFIXES_BY_LANGUAGE: Record<string, string[]> = {
  en: ['hey'],
  zh: ['嘿', '你好'],
  hi: ['हे', 'अरे'],
  es: ['oye', 'hola'],
  fr: ['salut', 'hé'],
  ar: ['يا', 'مرحبا'],
  bn: ['এই', 'হেই'],
  pt: ['oi', 'olá'],
  ru: ['эй', 'привет'],
  ja: ['ねえ', 'やあ'],
  de: ['hey', 'hallo'],
  tr: ['selam', 'hey'],
};

function normalizeLanguageCode(language: string): string {
  const normalized = (language || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'en';
  return normalized.split('-')[0] || 'en';
}

/**
 * Build a single primary wake phrase for display and strict matching.
 *
 * If a custom wake phrase exists, it wins. Otherwise uses the first
 * language-specific prefix with agent name (fallback: English "hey").
 */
export function buildPrimaryWakePhrase(
  agentName: string,
  language: string = 'en',
  customWakePhrases?: string[],
): string {
  const custom = customWakePhrases
    ?.map((phrase) => phrase.trim().toLowerCase())
    .find(Boolean);

  if (custom) return custom;

  const name = agentName.trim().toLowerCase() || 'agent';
  const lang = normalizeLanguageCode(language);
  const prefix = WAKE_PREFIXES_BY_LANGUAGE[lang]?.[0]?.trim().toLowerCase() || DEFAULT_WAKE_PREFIXES[0];
  return `${prefix} ${name}`;
}

function wakePhraseVariants(prefix: string, name: string): string[] {
  // Include spaced + punctuation + no-space variants to handle STT quirks
  return [
    `${prefix} ${name}`,
    `${prefix}, ${name}`,
    `${prefix}${name}`,
    `${prefix},${name}`,
  ];
}

/** Build wake phrases for a given agent name and language. */
export function buildWakePhrases(agentName: string, language: string = 'en'): string[] {
  const name = agentName.trim().toLowerCase() || 'agent';
  const lang = normalizeLanguageCode(language);
  const languagePrefixes = WAKE_PREFIXES_BY_LANGUAGE[lang] || [];
  const prefixes = [...new Set([...languagePrefixes, ...DEFAULT_WAKE_PREFIXES])];

  const phrases = new Set<string>();

  for (const prefixRaw of prefixes) {
    const prefix = prefixRaw.trim().toLowerCase();
    if (!prefix) continue;
    for (const variant of wakePhraseVariants(prefix, name)) {
      phrases.add(variant);
    }
  }

  // Keep the legacy "Helena" -> "Helenah" phonetic variant for English wake words.
  if (name.endsWith('a')) {
    const variantName = name.slice(0, -1) + 'ah';
    for (const variant of wakePhraseVariants('hey', variantName)) {
      phrases.add(variant);
    }
  }

  return [...phrases];
}

/**
 * Default wake phrase arrays.
 * Used as test fixtures and fallback defaults.
 * Runtime code should use buildWakePhrases(agentName) for agent-specific phrases.
 */
export const DEFAULT_WAKE_PHRASES = buildWakePhrases('agent');
/** @deprecated Use DEFAULT_WAKE_PHRASES — kept for test compatibility */
export const WAKE_PHRASES = DEFAULT_WAKE_PHRASES;

/**
 * Stop/cancel phrases are server-managed runtime config and served via
 * GET /api/voice-phrases. Constants below are kept for test compatibility.
 */
export const STOP_PHRASES = ["boom", "i'm done", 'im done', "all right i'm done", "alright i'm done", "that's it", 'thats it', 'send it', 'done'];
export const CANCEL_PHRASES = ['cancel', 'never mind', 'nevermind'];

export interface StopPhrasesRegexOptions {
  language?: string;
  stopPhrases?: string[];
  cancelPhrases?: string[];
  wakePhrases?: string[];
}

/**
 * Build a regex that strips a trailing stop/cancel/wake phrase from transcribed text.
 *
 * Note: this intentionally avoids `\b` word boundaries because they only work for
 * ASCII word chars in JS and fail on many non-Latin scripts.
 */
export function buildStopPhrasesRegex(
  agentName: string,
  options: StopPhrasesRegexOptions = {},
): RegExp {
  const stopPhrases = options.stopPhrases ?? STOP_PHRASES;
  const cancelPhrases = options.cancelPhrases ?? CANCEL_PHRASES;
  const wakePhrases = options.wakePhrases?.length
    ? options.wakePhrases
    : buildWakePhrases(agentName, options.language);

  const allPhrases = [...stopPhrases, ...cancelPhrases, ...wakePhrases]
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  // Fallback regex that never matches if phrase arrays are unexpectedly empty.
  if (allPhrases.length === 0) return /$^/u;

  // Latin-script phrases get a leading boundary guard so short words like "done"
  // don't over-match inside larger words (e.g. "undone").
  const phrasePatterns = allPhrases.map((phrase) => {
    const escaped = escapeRegex(phrase);
    if (/[A-Za-z]/.test(phrase)) {
      return `(?:^|[^\\p{L}\\p{N}])${escaped}`;
    }
    return escaped;
  });

  return new RegExp(`(?:${phrasePatterns.join('|')})\\s*[.!?,،؟。！？।…]*\\s*$`, 'iu');
}

/**
 * Default context window fallback (tokens).
 * The gateway sends the actual limit per session via contextTokens.
 * This is only used when the gateway doesn't provide it.
 */
export const DEFAULT_CONTEXT_LIMIT = 200_000;

// Param kept for API compat — actual limits come from gateway
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getContextLimit(_model: string): number {
  return DEFAULT_CONTEXT_LIMIT;
}

/** Percentage of context used before showing a yellow warning. */
export const CONTEXT_WARNING_THRESHOLD = 75;
/** Percentage of context used before showing a red critical warning. */
export const CONTEXT_CRITICAL_THRESHOLD = 90;
