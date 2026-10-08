type Detector = { detect: (text: string) => Promise<{ detectedLanguage: string; confidence: number }[]> };
type DetectorAPI = { availability: () => Promise<string>; create: () => Promise<Detector> };
let detectorPromise: Promise<Detector> | undefined;

export function fallbackLanguage(text: string, hint = '') {
  if (/\p{Script=Thai}/u.test(text)) return 'th';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko';
  if (/\p{Script=Greek}/u.test(text)) return 'el';
  if (/\p{Script=Hebrew}/u.test(text)) return 'he';
  if (/\p{Script=Devanagari}/u.test(text)) return /^(hi|mr|ne)(-|$)/.test(hint) ? hint : 'hi';
  if (/\p{Script=Han}/u.test(text)) return /^(ja|zh)(-|$)/.test(hint) ? hint : 'zh';
  if (/\p{Script=Arabic}/u.test(text)) return /^(ar|fa|ur)(-|$)/.test(hint) ? hint : 'ar';
  if (/\p{Script=Cyrillic}/u.test(text)) return /^(ru|uk|bg|sr|mk|be)(-|$)/.test(hint) ? hint : 'ru';
  return hint || 'en';
}

export async function detectReadingLanguage(text: string, context: string, hint: string) {
  const fallback = fallbackLanguage(text, hint);
  // A distinctive script in the selected text takes precedence over surrounding text.
  if (/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(text)) return fallback;
  // A single word is ambiguous; trust its authored lesson language when available.
  if (hint && text.trim().split(/\s+/).length < 4) return fallback;
  const api = (globalThis as typeof globalThis & { LanguageDetector?: DetectorAPI }).LanguageDetector;
  if (!api) return fallback;
  try {
    // Avoid blocking pronunciation on a model download or requiring another permission flow.
    if (await api.availability() !== 'available') return fallback;
    detectorPromise ??= api.create().catch(error => { detectorPromise = undefined; throw error; });
    const detector = await detectorPromise;
    const sample = text.trim().split(/\s+/).length >= 4 ? text : context;
    const [result] = await detector.detect(sample.slice(0, 1000));
    return result?.confidence >= 0.8 && result.detectedLanguage !== 'und' ? result.detectedLanguage : fallback;
  } catch { return fallback; }
}

export function matchingVoice<T extends { lang: string; localService: boolean; default: boolean }>(voices: T[], language: string) {
  const tag = language.toLowerCase();
  const base = tag.split('-')[0];
  return voices.filter(voice => voice.lang.toLowerCase().split('-')[0] === base)
    .sort((a, b) => Number(b.lang.toLowerCase() === tag) - Number(a.lang.toLowerCase() === tag)
      || Number(b.localService) - Number(a.localService) || Number(b.default) - Number(a.default))[0];
}
