import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { VocabularyScene, VocabularyWords } from '../src/features/vocabulary/VocabularyScene';
import type { VocabularyPage } from '../src/features/vocabulary/api';

const definitions = await Bun.file(new URL('../../docs/vocabulary-pages.json', import.meta.url)).json() as VocabularyPage[];
const storage = await Bun.file(new URL('../../docs/vocabulary-storage.json', import.meta.url)).json() as { assets: Array<{ url: string; sourcePath: string }> };
async function expectStoredAsset(url: string) {
  expect(url).toStartWith('https://');
  const asset = storage.assets.find(asset => asset.url === url);
  expect(asset).toBeDefined();
  expect(await Bun.file(new URL(`../../${asset!.sourcePath}`, import.meta.url)).exists()).toBe(true);
}
test('all ten scenes render matching object images and numbered bilingual word lists', async () => {
  expect(definitions).toHaveLength(10);
  for (const page of definitions) {
    const scene = renderToStaticMarkup(<VocabularyScene page={page} selectedId="" onSelect={() => {}} />);
    const words = renderToStaticMarkup(<VocabularyWords page={page} selectedId="" onSelect={() => {}} />);
    await expectStoredAsset(page.backgroundUrl);
    expect(page.items).toHaveLength(6);
    for (const [index, item] of page.items.entries()) {
      expect(scene).toContain(`aria-label="${index + 1}. ${item.word}"`);
      expect(scene).toContain(`src="${item.imageUrl}"`);
      expect(words).toContain(`src="${item.imageUrl}"`);
      expect(words).toContain(item.translation);
      await expectStoredAsset(item.imageUrl);
    }
  }
});
test('reordered words retain their IDs and update the same number in scene and list', () => {
  const page = { ...definitions[0], items: [...definitions[0].items].reverse() };
  const selected = page.items[0];
  const scene = renderToStaticMarkup(<VocabularyScene page={page} selectedId={selected.id} onSelect={() => {}} />);
  const words = renderToStaticMarkup(<VocabularyWords page={page} selectedId={selected.id} onSelect={() => {}} />);
  expect(scene).toContain(`aria-label="1. ${selected.word}"`);
  expect(words).toContain(`<strong>${selected.word}</strong>`);
  expect(scene).toContain('is-selected'); expect(words).toContain('is-selected');
});
test('scene renders arbitrary object rotation and edit-only rotation handles', () => {
  const page = { ...definitions[0], items: [{ ...definitions[0].items[0], rotation: 37.25 }] };
  const selectedId = page.items[0].id;
  const reader = renderToStaticMarkup(<VocabularyScene page={page} selectedId={selectedId} onSelect={() => {}} />);
  const editor = renderToStaticMarkup(<VocabularyScene page={page} selectedId={selectedId} onSelect={() => {}} onChange={() => {}} />);
  expect(reader).toContain('rotate(37.25deg)');
  expect(reader).not.toContain('aria-label="Rotate');
  expect(editor).toContain(`aria-label="Rotate ${page.items[0].word}"`);
});
