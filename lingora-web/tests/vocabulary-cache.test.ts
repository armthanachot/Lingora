import { expect, test } from 'bun:test';
import { categoryNeighbours, createVocabularyReaderCache } from '../src/features/vocabulary/readerCache';
import type { VocabularyPage } from '../src/features/vocabulary/api';

const definitions = await Bun.file(new URL('../../docs/vocabulary-pages.json', import.meta.url)).json() as VocabularyPage[];
const pages = definitions.map((page, index) => ({ ...page, id: `page-${index}`, languageId: 'en', languageCode: 'en', revision: 1 }));
function fixture() {
  const calls: string[] = []; const images: string[] = []; let clock = 0;
  const cache = createVocabularyReaderCache({ get: async id => { calls.push(id); return pages.find(p => p.id === id)!; }, list: async () => { calls.push('list'); return pages; }, image: async url => { images.push(url); } }, () => clock);
  return { cache, calls, images, expire: () => { clock += 300001; } };
}
test('visiting and prefetching share requests; revisiting reuses data and images', async () => {
  const { cache, calls, images } = fixture();
  await Promise.all([cache.prefetch(pages[0].id), cache.prefetch(pages[0].id), cache.get(pages[0].id)]);
  await cache.assets(await cache.get(pages[0].id));
  await Promise.all([cache.list('en'), cache.list('en')]); await cache.list('en');
  expect(calls).toEqual([pages[0].id, 'list']); expect(images).toHaveLength(7); expect(new Set(images).size).toBe(7);
});
test('one-page prefetch respects category and language and does not cascade', async () => {
  const { cache, calls } = fixture();
  const neighbours = categoryNeighbours([...pages, { ...pages[1], id: 'another-language', languageId: 'fr' }], pages[0]);
  expect(neighbours.previous).toBeUndefined(); expect(neighbours.next?.id).toBe(pages[1].id);
  await cache.prefetch(neighbours.next!.id);
  expect(calls).toEqual([pages[1].id]);
  expect(categoryNeighbours(pages, pages[2]).next).toBeUndefined();
});
test('expired data refreshes; failed loads can be retried', async () => {
  const { cache, calls, expire } = fixture();
  await cache.get(pages[0].id); expire(); await cache.get(pages[0].id);
  expect(calls).toHaveLength(2);
  let failed = true;
  const retry = createVocabularyReaderCache({ get: async () => { if (failed) throw new Error('Offline'); return pages[0]; }, list: async () => [], image: async () => {} });
  await expect(retry.get(pages[0].id)).rejects.toThrow('Offline'); failed = false;
  expect((await retry.get(pages[0].id)).id).toBe(pages[0].id);
});
test('an admin save wins over an older in-flight page response and invalidates lists', async () => {
  let resolve!: (page: VocabularyPage) => void; let listCalls = 0;
  const cache = createVocabularyReaderCache({ get: () => new Promise(r => { resolve = r; }), list: async () => { listCalls++; return pages; }, image: async () => {} });
  await cache.list('en'); const pending = cache.get(pages[0].id);
  const edited = { ...pages[0], title: 'Edited', revision: 2 };
  cache.put(edited); resolve(pages[0]);
  expect((await pending).title).toBe('Edited'); expect((await cache.get(edited.id)).revision).toBe(2);
  await cache.list('en'); expect(listCalls).toBe(2);
});
test('stopping a prefetch prevents queued image loads and image failures retry', async () => {
  const { cache, images } = fixture();
  await cache.prefetch(pages[0].id, () => false); expect(images).toHaveLength(0);
  let attempts = 0;
  const retry = createVocabularyReaderCache({ get: async () => pages[0], list: async () => pages, image: async () => { if (++attempts === 1) throw new Error('Image offline'); } });
  await expect(retry.assets({ ...pages[0], items: [] })).rejects.toThrow('Image offline');
  await retry.assets({ ...pages[0], items: [] }); expect(attempts).toBe(2);
});

test('newly saved scenes refetch joined language metadata; existing edits retain it', async () => {
  const { cache, calls } = fixture();
  cache.put({ ...pages[0], languageCode: undefined });
  expect((await cache.get(pages[0].id)).languageCode).toBe('en');
  cache.put({ ...pages[0], languageCode: undefined, revision: 2 });
  expect((await cache.get(pages[0].id)).revision).toBe(2);
  expect(calls).toHaveLength(1);
});

test('forced refresh supersedes an older pending request', async () => {
  const resolvers: ((page: VocabularyPage) => void)[] = [];
  const cache = createVocabularyReaderCache({ get: () => new Promise(r => resolvers.push(r)), list: async () => [], image: async () => {} });
  const old = cache.get(pages[0].id); const fresh = cache.get(pages[0].id, true);
  resolvers[0](pages[0]); resolvers[1]({ ...pages[0], revision: 2 });
  expect((await old).revision).toBe(2); expect((await fresh).revision).toBe(2);
});
