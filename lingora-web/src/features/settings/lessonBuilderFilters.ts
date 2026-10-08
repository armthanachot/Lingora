import type { LessonBuilderCountryLanguage, LessonBuilderSummary } from './lessonBuilderApi';

export const filterFields = [
  { key: 'languageId', label: 'Language' },
  { key: 'levelId', label: 'Levels' },
  { key: 'countryId', label: 'Countries' },
  { key: 'countryLanguageId', label: 'Country language' },
  { key: 'courseId', label: 'Courses' },
  { key: 'moduleId', label: 'Modules' },
  { key: 'lessonId', label: 'Lessons' },
] as const;

export type FilterKey = typeof filterFields[number]['key'];
export type LessonFilters = Record<FilterKey | 'dateFrom' | 'dateTo', string>;
export const emptyLessonFilters: LessonFilters = {
  languageId: '', levelId: '', countryId: '', countryLanguageId: '',
  courseId: '', moduleId: '', lessonId: '', dateFrom: '', dateTo: '',
};

export function buildLessonFilters(
  lessons: LessonBuilderSummary[], links: LessonBuilderCountryLanguage[], filters: LessonFilters,
) {
  let rows = lessons;
  const options = {} as Record<FilterKey, { id: string; label: string }[]>;
  for (const { key } of filterFields) {
    const availableLanguages = new Set(rows.map(row => row.languageId));
    const availableLinks = links.filter(link => availableLanguages.has(link.languageId)
      && (!filters.countryId || key === 'countryId' || link.countryId === filters.countryId));
    const values = key === 'countryId'
      ? availableLinks.map(link => ({ id: link.countryId, label: link.countryName }))
      : key === 'countryLanguageId'
        ? availableLinks.map(link => ({ id: link.id, label: `${link.countryName} · ${link.languageName}` }))
        : rows.flatMap(row => {
          const id = key === 'lessonId' ? row.id : row[key];
          const label = key === 'languageId' ? row.languageName
            : key === 'levelId' ? row.levelName
              : key === 'courseId' ? row.courseTitle
                : key === 'moduleId' ? row.moduleTitle : row.title;
          return id && label ? [{ id, label }] : [];
        });
    options[key] = [...new Map(values.map(value => [value.id, value])).values()]
      .sort((a, b) => a.label.localeCompare(b.label));
    const selected = filters[key];
    if (!selected) continue;
    rows = rows.filter(row => key === 'countryId'
      ? availableLinks.some(link => link.countryId === selected && link.languageId === row.languageId)
      : key === 'countryLanguageId'
        ? availableLinks.some(link => link.id === selected && link.languageId === row.languageId)
        : (key === 'lessonId' ? row.id : row[key]) === selected);
  }
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : -Infinity;
  const to = filters.dateTo ? new Date(`${filters.dateTo}T00:00:00`) : null;
  // Calendar arithmetic includes the entire end date, even across daylight-saving changes.
  if (to) to.setDate(to.getDate() + 1);
  rows = rows.filter(row => {
    if (!filters.dateFrom && !filters.dateTo) return true;
    const updated = new Date(row.updatedAt).getTime();
    return updated >= from && updated < (to?.getTime() ?? Infinity);
  });
  return { options, rows };
}
