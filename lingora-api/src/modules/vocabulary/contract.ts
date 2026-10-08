import { t } from 'elysia';

export class VocabularyValidationError extends Error {}

export function vocabularyWriteError(error: unknown, fallback: string) {
  if (error instanceof VocabularyValidationError) return error.message;
  const databaseError = error as { code?: string; cause?: { code?: string } } | null;
  if (databaseError?.code === '23505' || databaseError?.cause?.code === '23505') return 'This slug already exists.';
  return fallback;
}

const coordinate = t.Number({ minimum: 0, maximum: 100 });
export const vocabularyBody = t.Object({
  languageId: t.String({ format: 'uuid' }),
  slug: t.String({ minLength: 1, maxLength: 160, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  title: t.String({ minLength: 1, maxLength: 200 }),
  heading: t.String({ minLength: 1, maxLength: 200 }),
  translationCode: t.String({ minLength: 2, maxLength: 16 }),
  category: t.String({ minLength: 1, maxLength: 120 }),
  description: t.String({ maxLength: 2000 }),
  backgroundUrl: t.String({ maxLength: 2048 }),
  aspectRatio: t.Number({ minimum: 0.5, maximum: 3 }),
  isPublished: t.Boolean(),
  sortOrder: t.Integer({ minimum: 0, maximum: 100000 }),
  revision: t.Optional(t.Integer({ minimum: 1 })),
  items: t.Array(t.Object({
    id: t.String({ minLength: 1, maxLength: 80 }),
    word: t.String({ minLength: 1, maxLength: 200 }),
    translation: t.String({ maxLength: 300 }),
    description: t.String({ maxLength: 1000 }),
    imageUrl: t.String({ maxLength: 2048 }),
    mode: t.Union([t.Literal('object'), t.Literal('marker')]),
    x: coordinate, y: coordinate,
    width: t.Number({ minimum: 2, maximum: 80 }),
    markerX: coordinate, markerY: coordinate,
    rotation: t.Optional(t.Number({ minimum: 0, maximum: 360 })),
  }), { maxItems: 100 }),
});

export function validateVocabulary(body: { backgroundUrl: string; isPublished: boolean; items: Array<{ id: string; word: string; imageUrl: string }> }) {
  const safeImage = (url: string) => {
    if (!url) return true;
    if (url.startsWith('/assets/')) return /^\/assets\/[a-z0-9/_.-]+$/i.test(url) && !url.split('/').some(part => part === '.' || part === '..');
    try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
    catch { return false; }
  };
  if (!safeImage(body.backgroundUrl) || body.items.some(item => !safeImage(item.imageUrl))) {
    throw new VocabularyValidationError('Images must use an HTTP(S) URL or a local /assets/ path.');
  }
  if (new Set(body.items.map(item => item.id)).size !== body.items.length) throw new VocabularyValidationError('Object IDs must be unique.');
  if (body.items.some(item => !item.word.trim())) throw new VocabularyValidationError('Every object needs a word.');
  if (body.isPublished && (!body.backgroundUrl || !body.items.length || body.items.some(item => !item.imageUrl))) {
    throw new VocabularyValidationError('Published pages need a background and at least one word with an image.');
  }
}
