import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { languages, vocabularyPages } from './schema';
import { validateVocabulary } from '../modules/vocabulary/contract';

try {
  const [english] = await db.select().from(languages).where(eq(languages.code, 'en')).limit(1);
  if (!english) throw new Error('Create the English language before seeding vocabulary.');
  const definitions = await Bun.file(resolve(import.meta.dir, '../../../docs/vocabulary-pages.json')).json() as Array<Omit<typeof vocabularyPages.$inferInsert, 'languageId'>>;
  let added = 0; let skipped = 0;
  for (const definition of definitions) {
    const assets = [definition.backgroundUrl!, ...definition.items!.map(item => item.imageUrl)];
    const available = await Promise.all(assets.map(async url => {
      if (url.startsWith('/assets/')) return existsSync(resolve(import.meta.dir, '../../../lingora-web/public', url.slice(1)));
      if (!url.startsWith('https://')) return false;
      return (await fetch(url, { method: 'HEAD' })).ok;
    }));
    if (available.some(value => !value)) {
      console.log(`Waiting for assets: ${definition.title}`); skipped++; continue;
    }
    validateVocabulary({ backgroundUrl: definition.backgroundUrl!, isPublished: true, items: definition.items! });
    const rows = await db.insert(vocabularyPages).values({ ...definition, languageId: english.id }).onConflictDoNothing({ target: vocabularyPages.slug }).returning({ id: vocabularyPages.id });
    added += rows.length;
  }
  console.log(`Vocabulary seed: ${added} pages added, ${skipped} awaiting assets. Existing admin edits preserved.`);
} finally { await pool.end(); }
