import { apiRequest } from '../../api/client';

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  authProvider: string;
  providerEmail: string;
  providerEmailVerified: boolean;
  providerHostedDomain: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserAdminPatchInput = {
  displayName?: string;
  isSuperAdmin?: boolean;
};

export const userApi = {
  readingPreferences: () => apiRequest<{ autoRead: boolean }>('/users/me/reading-preferences'),
  updateReadingPreferences: (autoRead: boolean) => apiRequest<{ autoRead: boolean }>('/users/me/reading-preferences', {
    method: 'PATCH', body: JSON.stringify({ autoRead }),
  }),
  list: () => apiRequest<User[]>('/users/'),
  get: (id: string) => apiRequest<User>(`/users/${encodeURIComponent(id)}`),
  update: (id: string, data: UserAdminPatchInput) =>
    apiRequest<User>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
