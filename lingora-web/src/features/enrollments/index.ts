import { apiRequest } from '../../api/client';

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const enrollmentApi = {
  enroll: (courseId: string) => apiRequest<Enrollment>('/enrollments/', { method: 'POST', body: JSON.stringify({ courseId }) }),
  list: () => apiRequest<Enrollment[]>('/enrollments/'),
  get: (id: string) => apiRequest<Enrollment>(`/enrollments/${encodeURIComponent(id)}`),
};
