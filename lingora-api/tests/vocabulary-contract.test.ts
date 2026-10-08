import { expect, test } from 'bun:test';
import { validateVocabulary, VocabularyValidationError, vocabularyWriteError } from '../src/modules/vocabulary/contract';

test('image URLs reject traversal, malformed URLs and embedded credentials', () => {
  const body = { backgroundUrl: '', isPublished: false, items: [] };
  for (const url of ['/assets/../private.png', '/assets/./object.png', 'https://', 'https://user:secret@example.com/object.png', 'javascript:alert(1)']) {
    expect(() => validateVocabulary({ ...body, backgroundUrl: url })).toThrow(VocabularyValidationError);
  }
  for (const url of ['/assets/vocab/bedroom-background.png', 'https://example.com/object.png', 'http://localhost:3001/object.png']) {
    expect(() => validateVocabulary({ ...body, backgroundUrl: url })).not.toThrow();
  }
});

test('write errors explain duplicate slugs without exposing database details', () => {
  expect(vocabularyWriteError({ cause: { code: '23505' } }, 'Could not save page.')).toBe('This slug already exists.');
  expect(vocabularyWriteError(new Error('SQL query and parameters'), 'Could not save page.')).toBe('Could not save page.');
  expect(vocabularyWriteError(new VocabularyValidationError('Every object needs a word.'), 'Could not save page.')).toBe('Every object needs a word.');
});
