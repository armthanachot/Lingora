import type { VocabularyPage, VocabularySummary } from './api';

export function categoryNeighbours(pages: VocabularySummary[], page: VocabularyPage) {
  const group = pages.filter(p => p.languageId === page.languageId && p.category === page.category);
  const index = group.findIndex(p => p.id === page.id);
  return { previous: index > 0 ? group[index - 1] : undefined, next: index >= 0 ? group[index + 1] : undefined };
}

export function createVocabularyReaderCache(source: {
  get: (id: string) => Promise<VocabularyPage>;
  list: (languageId?: string) => Promise<VocabularySummary[]>;
  image: (url: string) => Promise<void>;
}, now = Date.now) {
  const ttl = 5 * 60 * 1000;
  const pages = new Map<string, { value: VocabularyPage; time: number }>();
  const lists = new Map<string, { value: VocabularySummary[]; time: number }>();
  const pendingPages = new Map<string, Promise<VocabularyPage>>();
  const pendingLists = new Map<string, Promise<VocabularySummary[]>>();
  const images = new Map<string, Promise<void>>();
  const versions = new Map<string, number>();
  let listVersion = 0;
  const invalidateLists = () => { listVersion++; lists.clear(); pendingLists.clear(); };
  const get = (id: string, force = false): Promise<VocabularyPage> => {
    const cached = pages.get(id);
    if (!force && cached && now() - cached.time < ttl) return Promise.resolve(cached.value);
    if (!force && pendingPages.has(id)) return pendingPages.get(id)!;
    if (force) versions.set(id, (versions.get(id) ?? 0) + 1);
    const version = versions.get(id) ?? 0;
    const promise = source.get(id).then(value => {
      if ((versions.get(id) ?? 0) !== version) return pendingPages.get(id) ?? pages.get(id)?.value ?? get(id);
      pages.set(id, { value, time: now() });
      return pages.get(id)?.value ?? value;
    }).finally(() => { if (pendingPages.get(id) === promise) pendingPages.delete(id); });
    pendingPages.set(id, promise); return promise;
  };
  const list = (languageId?: string): Promise<VocabularySummary[]> => {
    const key = languageId ?? ''; const cached = lists.get(key);
    if (cached && now() - cached.time < ttl) return Promise.resolve(cached.value);
    if (pendingLists.has(key)) return pendingLists.get(key)!;
    const version = listVersion;
    const promise = source.list(languageId).then(value => {
      if (version !== listVersion) return list(languageId);
      lists.set(key, { value, time: now() });
      return value;
    }).finally(() => { if (pendingLists.get(key) === promise) pendingLists.delete(key); });
    pendingLists.set(key, promise); return promise;
  };
  const assets = async (page: VocabularyPage, shouldContinue = () => true) => {
    const urls = [...new Set([page.backgroundUrl, ...page.items.map(i => i.imageUrl)].filter(Boolean))];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
      while (cursor < urls.length && shouldContinue()) {
        const url = urls[cursor++];
        let promise = images.get(url);
        if (!promise) {
          promise = source.image(url).catch(error => { if (images.get(url) === promise) images.delete(url); throw error; });
          images.set(url, promise);
        }
        await promise;
      }
    }));
  };
  return {
    get, list, assets,
    prefetch: async (id: string, shouldContinue = () => true) => { const page = await get(id); if (shouldContinue()) await assets(page, shouldContinue); },
    put: (page: VocabularyPage) => {
      const previous = pages.get(page.id)?.value;
      versions.set(page.id, (versions.get(page.id) ?? 0) + 1); pendingPages.delete(page.id);
      const languageCode = page.languageCode ?? (previous?.languageId === page.languageId ? previous.languageCode : undefined);
      // Mutation responses lack joined language metadata. Fetch new/language-changed
      // scenes again rather than caching an incomplete page with the wrong speech voice.
      if (languageCode) pages.set(page.id, { value: { ...page, languageCode, languageName: page.languageName ?? (previous?.languageId === page.languageId ? previous.languageName : undefined) }, time: now() });
      else pages.delete(page.id);
      invalidateLists();
    },
    remove: (id: string) => { versions.set(id, (versions.get(id) ?? 0) + 1); pages.delete(id); pendingPages.delete(id); invalidateLists(); },
    clear: () => { for (const id of new Set([...pages.keys(), ...pendingPages.keys()])) versions.set(id, (versions.get(id) ?? 0) + 1); pages.clear(); pendingPages.clear(); images.clear(); invalidateLists(); },
  };
}
