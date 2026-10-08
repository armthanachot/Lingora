import { apiRequest } from '../../api/client';
import type { LessonBlock } from './blocks';

export type Lesson = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: unknown;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LessonDetail = Lesson & {
  blocks: LessonBlock[];
};

export const lessonApi = {
  list: () => apiRequest<Lesson[]>('/lessons/'),
  get: (id: string) => apiRequest<LessonDetail>(`/lessons/${encodeURIComponent(id)}`),
};
