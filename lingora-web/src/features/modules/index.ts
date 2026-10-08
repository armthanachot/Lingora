import { apiRequest } from '../../api/client';

export type CourseModule = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export const moduleApi = {
  list: () => apiRequest<CourseModule[]>('/modules/'),
  get: (id: string) => apiRequest<CourseModule>(`/modules/${encodeURIComponent(id)}`),
};
