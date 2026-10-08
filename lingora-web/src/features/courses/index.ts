import type { Enrollment } from '../enrollments';
import type { CourseModule } from '../modules';
import type { Lesson } from '../lessons';
import type { LessonProgress } from '../progress';
import { apiRequest } from '../../api/client';

export type Course = {
  id: string;
  languageId: string;
  levelId: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CourseOutline = { course: Course & { languageCode: string }; enrollment: Enrollment | null; modules: (CourseModule & { lessons: (Lesson & { progress: LessonProgress | null })[] })[] };

export const courseApi = {
  outline: (id: string) => apiRequest<CourseOutline>(`/courses/${encodeURIComponent(id)}/outline`),
  list: () => apiRequest<Course[]>('/courses/'),
  get: (id: string) => apiRequest<Course>(`/courses/${encodeURIComponent(id)}`),
};
