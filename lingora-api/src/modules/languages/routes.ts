import { and, eq, isNull } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../../db';
import { languages } from '../../db/schema';

export const languageRoutes = new Elysia({ prefix: '/api/v1/languages' })
  .get('/', async () => db.select().from(languages).where(isNull(languages.deletedAt)).orderBy(languages.name))
  .get('/:id', async ({ params, set }) => {
    const [language] = await db
      .select()
      .from(languages)
      .where(and(eq(languages.id, params.id), isNull(languages.deletedAt)))
      .limit(1);
    if (!language) {
      set.status = 404;
      return { error: 'Language not found' };
    }
    return language;
  });
