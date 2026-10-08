import { and, asc, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { languages, vocabularyPages } from '../../db/schema';
import { resolveSessionUser } from '../auth/session';
import { vocabularyBody, validateVocabulary, vocabularyWriteError } from './contract';

export const vocabularyRoutes = new Elysia({ prefix: '/api/v1/vocabulary' })
  .get('/', async ({ request, query, set }) => {
    if (!await resolveSessionUser(request)) { set.status = 401; return { error: 'Sign in to explore vocabulary.' }; }
    return db.select({
      id: vocabularyPages.id, title: vocabularyPages.title, heading: vocabularyPages.heading,
      category: vocabularyPages.category, description: vocabularyPages.description,
      backgroundUrl: vocabularyPages.backgroundUrl, languageId: vocabularyPages.languageId,
      languageCode: languages.code, languageName: languages.name,
      translationCode: vocabularyPages.translationCode, sortOrder: vocabularyPages.sortOrder,
      items: vocabularyPages.items, aspectRatio: vocabularyPages.aspectRatio,
    }).from(vocabularyPages).innerJoin(languages, eq(languages.id, vocabularyPages.languageId))
      .where(and(isNull(vocabularyPages.deletedAt), eq(vocabularyPages.isPublished, true),
        isNull(languages.deletedAt), eq(languages.isActive, true),
        query.languageId ? eq(vocabularyPages.languageId, query.languageId) : undefined))
      .orderBy(asc(vocabularyPages.sortOrder), asc(vocabularyPages.title));
  }, { query: t.Object({ languageId: t.Optional(t.String({ format: 'uuid' })) }) })
  .get('/:id', async ({ request, params, set }) => {
    if (!await resolveSessionUser(request)) { set.status = 401; return { error: 'Sign in to explore vocabulary.' }; }
    const [row] = await db.select({ page: vocabularyPages, languageCode: languages.code, languageName: languages.name })
      .from(vocabularyPages).innerJoin(languages, eq(languages.id, vocabularyPages.languageId))
      .where(and(eq(vocabularyPages.id, params.id), isNull(vocabularyPages.deletedAt), eq(vocabularyPages.isPublished, true),
        isNull(languages.deletedAt), eq(languages.isActive, true))).limit(1);
    if (!row) { set.status = 404; return { error: 'Vocabulary page not found.' }; }
    return { page: { ...row.page, languageCode: row.languageCode, languageName: row.languageName } };
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });

export const adminVocabularyRoutes = new Elysia({ prefix: '/api/v1/admin/vocabulary' })
  .onBeforeHandle(async ({ request, set }) => {
    if (!(await resolveSessionUser(request))?.isSuperAdmin) { set.status = 403; return { error: 'Super admin access required.' }; }
  })
  .get('/', () => db.select().from(vocabularyPages).where(isNull(vocabularyPages.deletedAt))
    .orderBy(asc(vocabularyPages.sortOrder), asc(vocabularyPages.title)))
  .post('/reorder', async ({ body, set }) => {
    const rows = await db.select().from(vocabularyPages).where(and(eq(vocabularyPages.languageId, body.languageId), isNull(vocabularyPages.deletedAt)));
    const ids = new Set(rows.map(row => row.id));
    if (body.pages.length !== ids.size || new Set(body.pages.map(p => p.id)).size !== ids.size || body.pages.some(p => !ids.has(p.id))) {
      set.status = 400; return { error: 'Include every active page of this language exactly once.' };
    }
    try {
      const pages = await db.transaction(async tx => {
        const result = [];
        for (const [index, page] of body.pages.entries()) {
          const [updated] = await tx.update(vocabularyPages).set({ sortOrder: index + 1, revision: page.revision + 1, updatedAt: new Date() })
            .where(and(eq(vocabularyPages.id, page.id), eq(vocabularyPages.revision, page.revision), isNull(vocabularyPages.deletedAt))).returning();
          if (!updated) throw new Error('Pages changed. Reload the library before reordering.');
          result.push(updated);
        }
        return result;
      });
      return { pages };
    } catch { set.status = 409; return { error: 'Pages changed. Reload the library before reordering.' }; }
  }, { body: t.Object({ languageId: t.String({ format: 'uuid' }), pages: t.Array(t.Object({ id: t.String({ format: 'uuid' }), revision: t.Integer({ minimum: 1 }) }), { maxItems: 1000 }) }) })
  .post('/', async ({ body, request, set }) => {
    try {
      validateVocabulary(body);
      const [language] = await db.select().from(languages).where(and(eq(languages.id, body.languageId), isNull(languages.deletedAt))).limit(1);
      if (!language) { set.status = 400; return { error: 'Choose an existing language.' }; }
      const user = await resolveSessionUser(request);
      const [page] = await db.insert(vocabularyPages).values({ ...body, revision: 1, updatedBy: user!.id }).returning();
      set.status = 201; return { page };
    } catch (error) {
      set.status = 400; return { error: vocabularyWriteError(error, 'Could not create page.') };
    }
  }, { body: vocabularyBody })
  .put('/:id', async ({ params, body, request, set }) => {
    try {
      validateVocabulary(body);
      if (!body.revision) { set.status = 400; return { error: 'Page revision is required.' }; }
      const [language] = await db.select().from(languages).where(and(eq(languages.id, body.languageId), isNull(languages.deletedAt))).limit(1);
      if (!language) { set.status = 400; return { error: 'Choose an existing language.' }; }
      const user = await resolveSessionUser(request);
      const [page] = await db.update(vocabularyPages).set({ ...body, revision: body.revision + 1, updatedBy: user!.id, updatedAt: new Date() })
        .where(and(eq(vocabularyPages.id, params.id), eq(vocabularyPages.revision, body.revision), isNull(vocabularyPages.deletedAt))).returning();
      if (!page) { set.status = 409; return { error: 'This page changed or was removed. Reload before saving to protect another admin’s work.' }; }
      return { page };
    } catch (error) {
      set.status = 400; return { error: vocabularyWriteError(error, 'Could not save page.') };
    }
  }, { body: vocabularyBody, params: t.Object({ id: t.String({ format: 'uuid' }) }) })
  .delete('/:id', async ({ params }) => {
    await db.update(vocabularyPages).set({ deletedAt: new Date(), updatedAt: new Date(), isPublished: false })
      .where(and(eq(vocabularyPages.id, params.id), isNull(vocabularyPages.deletedAt)));
    return { deleted: true };
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
