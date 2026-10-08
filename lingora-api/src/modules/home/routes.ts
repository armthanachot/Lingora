import { and, asc, eq, isNull } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../../db';
import { countries, countryLanguages, courses, languages, levels } from '../../db/schema';

function flagEmojiFromCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🌐';
  return String.fromCodePoint(...[...normalized].map((character) => 127397 + character.charCodeAt(0)));
}

export const homeRoutes = new Elysia({ prefix: '/api/v1/home' }).get('/globe', async () => {
  const [countryRows, publishedCourses] = await Promise.all([
    db
      .select({
        countryId: countries.id,
        countryCode: countries.code,
        countryName: countries.name,
        countryNativeName: countries.nativeName,
        latitude: countries.latitude,
        longitude: countries.longitude,
        status: countries.status,
        flagImageUrl: countries.flagImageUrl,
        heroImageUrl: countries.heroImageUrl,
        countrySortOrder: countries.sortOrder,
        languageId: languages.id,
        languageCode: languages.code,
        languageName: languages.name,
        languageNativeName: languages.nativeName,
        languageIsActive: languages.isActive,
        languageIsPrimary: countryLanguages.isPrimary,
        languageSortOrder: countryLanguages.sortOrder,
      })
      .from(countries)
      .leftJoin(
        countryLanguages,
        and(eq(countryLanguages.countryId, countries.id), isNull(countryLanguages.deletedAt)),
      )
      .leftJoin(
        languages,
        and(eq(languages.id, countryLanguages.languageId), isNull(languages.deletedAt)),
      )
      .where(isNull(countries.deletedAt))
      .orderBy(asc(countries.sortOrder), asc(countries.name), asc(countryLanguages.sortOrder)),
    db
      .select({
        id: courses.id,
        languageId: courses.languageId,
        slug: courses.slug,
        title: courses.title,
        level: levels.name,
      })
      .from(courses)
      .leftJoin(
        levels,
        and(eq(levels.id, courses.levelId), isNull(levels.deletedAt)),
      )
      .where(and(eq(courses.isPublished, true), isNull(courses.deletedAt)))
      .orderBy(asc(courses.sortOrder), asc(courses.title)),
  ]);

  const firstCourseByLanguage = new Map<string, (typeof publishedCourses)[number]>();
  for (const course of publishedCourses) {
    if (!firstCourseByLanguage.has(course.languageId)) {
      firstCourseByLanguage.set(course.languageId, course);
    }
  }

  type GlobeCountry = {
    id: string;
    code: string;
    name: string;
    nativeName: string | null;
    latitude: number;
    longitude: number;
    status: string;
    flag: { emoji: string; imageUrl: string | null };
    heroImageUrl: string | null;
    languages: Array<{
      id: string;
      code: string;
      name: string;
      nativeName: string;
      isActive: boolean;
      isPrimary: boolean;
      course: {
        id: string;
        slug: string;
        title: string;
        level: string | null;
      } | null;
    }>;
  };

  const countriesById = new Map<string, GlobeCountry>();

  for (const row of countryRows) {
    let country = countriesById.get(row.countryId);
    if (!country) {
      country = {
        id: row.countryId,
        code: row.countryCode,
        name: row.countryName,
        nativeName: row.countryNativeName,
        latitude: row.latitude,
        longitude: row.longitude,
        status: row.status,
        flag: {
          emoji: flagEmojiFromCode(row.countryCode),
          imageUrl: row.flagImageUrl,
        },
        heroImageUrl: row.heroImageUrl,
        languages: [],
      };
      countriesById.set(row.countryId, country);
    }

    if (row.languageId && row.languageCode && row.languageName && row.languageNativeName) {
      const course = firstCourseByLanguage.get(row.languageId);
      country.languages.push({
        id: row.languageId,
        code: row.languageCode,
        name: row.languageName,
        nativeName: row.languageNativeName,
        isActive: row.languageIsActive ?? false,
        isPrimary: row.languageIsPrimary ?? false,
        course: course
          ? {
              id: course.id,
              slug: course.slug,
              title: course.title,
              level: course.level,
            }
          : null,
      });
    }
  }

  const globeCountries = [...countriesById.values()];
  const popularLanguages = new Map<string, { id: string; code: string; name: string; nativeName: string }>();

  for (const country of globeCountries) {
    if (country.status !== 'active') continue;
    for (const language of country.languages) {
      if (!language.isActive || popularLanguages.has(language.id)) continue;
      popularLanguages.set(language.id, {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
      });
    }
  }

  return {
    countries: globeCountries,
    popularLanguages: [...popularLanguages.values()].slice(0, 6),
  };
});
