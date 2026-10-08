import 'dotenv/config';
import { db, pool } from './index';
import { countries, countryLanguages, languages } from './schema';

const languageSeeds = [
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
] as const;

const countrySeeds = [
  { code: 'JP', name: 'Japan', nativeName: '日本', latitude: 36.2048, longitude: 138.2529, status: 'active', languageCodes: ['ja'] },
  { code: 'KR', name: 'South Korea', nativeName: '대한민국', latitude: 35.9078, longitude: 127.7669, status: 'active', languageCodes: ['ko'] },
  { code: 'FR', name: 'France', nativeName: 'France', latitude: 46.2276, longitude: 2.2137, status: 'active', languageCodes: ['fr'] },
  { code: 'ES', name: 'Spain', nativeName: 'España', latitude: 40.4637, longitude: -3.7492, status: 'active', languageCodes: ['es'] },
  { code: 'GB', name: 'United Kingdom', nativeName: 'United Kingdom', latitude: 55.3781, longitude: -3.436, status: 'active', languageCodes: ['en'] },
  { code: 'US', name: 'United States', nativeName: 'United States', latitude: 37.0902, longitude: -95.7129, status: 'active', languageCodes: ['en'] },
  { code: 'TH', name: 'Thailand', nativeName: 'ประเทศไทย', latitude: 15.87, longitude: 100.9925, status: 'active', languageCodes: ['th'] },
  { code: 'CN', name: 'China', nativeName: '中国', latitude: 35.8617, longitude: 104.1954, status: 'active', languageCodes: ['zh'] },
  { code: 'DE', name: 'Germany', nativeName: 'Deutschland', latitude: 51.1657, longitude: 10.4515, status: 'inactive', languageCodes: ['de'] },
  { code: 'IT', name: 'Italy', nativeName: 'Italia', latitude: 41.8719, longitude: 12.5674, status: 'inactive', languageCodes: ['it'] },
  { code: 'BR', name: 'Brazil', nativeName: 'Brasil', latitude: -14.235, longitude: -51.9253, status: 'inactive', languageCodes: ['pt'] },
  { code: 'CA', name: 'Canada', nativeName: 'Canada', latitude: 56.1304, longitude: -106.3468, status: 'inactive', languageCodes: ['en', 'fr'] },
] as const;

async function seedGlobe() {
  const languageIds = new Map<string, string>();

  for (const language of languageSeeds) {
    const [row] = await db
      .insert(languages)
      .values({ ...language, isActive: true })
      .onConflictDoUpdate({
        target: languages.code,
        set: {
          name: language.name,
          nativeName: language.nativeName,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: languages.id, code: languages.code });
    languageIds.set(row.code, row.id);
  }

  for (let index = 0; index < countrySeeds.length; index += 1) {
    const country = countrySeeds[index];
    const [countryRow] = await db
      .insert(countries)
      .values({
        code: country.code,
        name: country.name,
        nativeName: country.nativeName,
        latitude: country.latitude,
        longitude: country.longitude,
        status: country.status,
        flagImageUrl: `https://flagcdn.com/w80/${country.code.toLowerCase()}.png`,
        sortOrder: index,
      })
      .onConflictDoUpdate({
        target: countries.code,
        set: {
          name: country.name,
          nativeName: country.nativeName,
          latitude: country.latitude,
          longitude: country.longitude,
          status: country.status,
          flagImageUrl: `https://flagcdn.com/w80/${country.code.toLowerCase()}.png`,
          sortOrder: index,
          updatedAt: new Date(),
        },
      })
      .returning({ id: countries.id });

    for (let languageIndex = 0; languageIndex < country.languageCodes.length; languageIndex += 1) {
      const languageId = languageIds.get(country.languageCodes[languageIndex]);
      if (!languageId) continue;

      await db
        .insert(countryLanguages)
        .values({
          countryId: countryRow.id,
          languageId,
          isPrimary: languageIndex === 0,
          sortOrder: languageIndex,
        })
        .onConflictDoUpdate({
          target: [countryLanguages.countryId, countryLanguages.languageId],
          set: {
            isPrimary: languageIndex === 0,
            sortOrder: languageIndex,
            updatedAt: new Date(),
          },
        });
    }
  }

  console.log(`Seeded ${countrySeeds.length} globe countries.`);
}

seedGlobe()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
