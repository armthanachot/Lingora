import { apiRequest } from '../../api/client';

export type Language = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const languageApi = {
  list: () => apiRequest<Language[]>('/languages/'),
  get: (id: string) => apiRequest<Language>(`/languages/${encodeURIComponent(id)}`),
};
