import { apiRequest } from '../../api/client';

export type GlobeCourse = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
};

export type GlobeLanguage = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  isActive: boolean;
  isPrimary: boolean;
  course: GlobeCourse | null;
};

export type GlobeCountry = {
  id: string;
  code: string;
  name: string;
  nativeName: string | null;
  latitude: number;
  longitude: number;
  status: string;
  flag: {
    emoji: string;
    imageUrl: string | null;
  };
  heroImageUrl: string | null;
  languages: GlobeLanguage[];
};

export type PopularLanguage = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
};

export type GlobeHomePayload = {
  countries: GlobeCountry[];
  popularLanguages: PopularLanguage[];
};

export const globeHomeApi = {
  get: () => apiRequest<GlobeHomePayload>('/home/globe'),
};
