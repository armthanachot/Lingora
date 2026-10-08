import { apiRequest } from '../../api/client';
import { createVocabularyReaderCache } from './readerCache';

export type VocabularyItem = {
  id: string; word: string; translation: string; description: string; imageUrl: string;
  mode: 'object' | 'marker'; x: number; y: number; width: number; markerX: number; markerY: number;
  rotation?: number;
};
export type VocabularyPage = {
  id: string; languageId: string; slug: string; title: string; heading: string;
  translationCode: string; category: string; description: string; backgroundUrl: string;
  aspectRatio: number; items: VocabularyItem[]; isPublished: boolean; sortOrder: number; revision: number;
  languageCode?: string; languageName?: string;
};
export type VocabularySummary = Pick<VocabularyPage, 'id' | 'languageId' | 'title' | 'heading' | 'category' | 'description' | 'backgroundUrl' | 'translationCode' | 'sortOrder' | 'languageCode' | 'languageName' | 'items' | 'aspectRatio'>;
export const vocabularyApi = {
  list: (languageId?: string) => apiRequest<VocabularySummary[]>(`/vocabulary/${languageId ? `?languageId=${encodeURIComponent(languageId)}` : ''}`),
  get: (id: string) => apiRequest<{ page: VocabularyPage }>(`/vocabulary/${encodeURIComponent(id)}`),
  adminList: () => apiRequest<VocabularyPage[]>('/admin/vocabulary/'),
  reorder: async (languageId: string, pages: VocabularyPage[]) => {
    const result = await apiRequest<{ pages: VocabularyPage[] }>('/admin/vocabulary/reorder', { method: 'POST', body: JSON.stringify({ languageId, pages: pages.map(p => ({ id: p.id, revision: p.revision })) }) });
    for (const page of result.pages) vocabularyReaderCache.remove(page.id);
    return result;
  },
  save: async (page: VocabularyPage) => {
    const result = await apiRequest<{ page: VocabularyPage }>(`/admin/vocabulary/${page.id ? encodeURIComponent(page.id) : ''}`, {
    method: page.id ? 'PUT' : 'POST', body: JSON.stringify(page),
    });
    if (result.page.isPublished) vocabularyReaderCache.put(result.page); else vocabularyReaderCache.remove(result.page.id);
    return result;
  },
  remove: async (id: string) => { const result = await apiRequest(`/admin/vocabulary/${encodeURIComponent(id)}`, { method: 'DELETE' }); vocabularyReaderCache.remove(id); return result; },
};

export const vocabularyReaderCache = createVocabularyReaderCache({
  get: async id => (await vocabularyApi.get(id)).page,
  list: languageId => vocabularyApi.list(languageId),
  image: url => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => { void image.decode().catch(() => {}).then(() => resolve()); };
    image.onerror = () => reject(new Error('Could not load vocabulary images. Please try again.'));
    image.src = url;
  }),
});

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export function speakVocabulary(word: string, languageCode: string) {
  if (!('speechSynthesis' in window)) throw new Error('Read aloud is unavailable in this browser.');
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = languageCode;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(languageCode.toLowerCase()));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
