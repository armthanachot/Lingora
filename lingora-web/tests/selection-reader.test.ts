import { expect, test } from 'bun:test';
import { detectReadingLanguage, fallbackLanguage, matchingVoice } from '../src/features/speech/language';

test('selected script overrides the lesson language', () => {
  expect(fallbackLanguage('สวัสดี', 'en')).toBe('th');
  expect(fallbackLanguage('こんにちは', 'en')).toBe('ja');
  expect(fallbackLanguage('안녕하세요', 'en')).toBe('ko');
  expect(fallbackLanguage('你好', 'en')).toBe('zh');
  expect(fallbackLanguage('漢字', 'ja')).toBe('ja');
});

test('ambiguous short words use their lesson language', async () => {
  expect(await detectReadingLanguage('pain', 'pain', 'fr')).toBe('fr');
  expect(await detectReadingLanguage('hello', 'hello', '')).toBe('en');
});

test('voices match language and prefer the exact locale then a local voice', () => {
  const voices = [
    { lang: 'en-US', localService: false, default: true },
    { lang: 'en-GB', localService: true, default: false },
    { lang: 'th-TH', localService: true, default: false },
  ];
  expect(matchingVoice(voices, 'en-US')).toBe(voices[0]);
  expect(matchingVoice(voices, 'en')).toBe(voices[1]);
  expect(matchingVoice(voices, 'th')).toBe(voices[2]);
  expect(matchingVoice(voices, 'ja')).toBeUndefined();
});
