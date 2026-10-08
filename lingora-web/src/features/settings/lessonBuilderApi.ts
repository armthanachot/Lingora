import { apiRequest } from '../../api/client';
import type { LessonBlock, LessonBlockType, MediaAsset } from '../lessons/blocks';

export type LessonBuilderSummary = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  languageId: string;
  languageName: string;
  languageCode: string;
  levelId: string | null;
  levelName: string | null;
  updatedAt: string;
  blockCount: number;
};

export type LessonBuilderCountryLanguage = {
  id: string;
  countryId: string;
  countryName: string;
  languageId: string;
  languageName: string;
};

export type LessonBuilderDetail = {
  lesson: {
    id: string;
    moduleId: string;
    title: string;
    description: string | null;
    content: unknown;
    sortOrder: number;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
  blocks: LessonBlock[];
};

export type BlockWritePayload = {
  type: LessonBlockType;
  version?: number;
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
  completion?: Record<string, unknown>;
};

export const lessonBuilderApi = {
  filterOptions: () => apiRequest<LessonBuilderCountryLanguage[]>('/admin/lesson-builder/filter-options'),
  listLessons: () => apiRequest<LessonBuilderSummary[]>('/admin/lesson-builder/lessons'),
  getLesson: (lessonId: string) =>
    apiRequest<LessonBuilderDetail>(`/admin/lesson-builder/${encodeURIComponent(lessonId)}`),
  createBlock: (lessonId: string, payload: BlockWritePayload) =>
    apiRequest<{ block: LessonBlock }>(`/admin/lesson-builder/${encodeURIComponent(lessonId)}/blocks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBlock: (lessonId: string, blockId: string, payload: Partial<BlockWritePayload> & { sortOrder?: number }) =>
    apiRequest<{ block: LessonBlock }>(
      `/admin/lesson-builder/${encodeURIComponent(lessonId)}/blocks/${encodeURIComponent(blockId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),
  reorderBlocks: (lessonId: string, blockIds: string[]) =>
    apiRequest<{ reordered: true }>(`/admin/lesson-builder/${encodeURIComponent(lessonId)}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ blockIds }),
    }),
  deleteBlock: (lessonId: string, blockId: string) =>
    apiRequest<{ deleted: true; id: string }>(
      `/admin/lesson-builder/${encodeURIComponent(lessonId)}/blocks/${encodeURIComponent(blockId)}`,
      { method: 'DELETE' },
    ),
  uploadMedia: (file: File) => {
    const body = new FormData();
    body.set('file', file);
    return apiRequest<{ media: MediaAsset }>('/admin/lesson-builder/media/upload', {
      method: 'POST',
      body,
    });
  },
};
