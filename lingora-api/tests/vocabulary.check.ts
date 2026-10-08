import 'dotenv/config';
import { expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db as realDb, pool } from '../src/db';
import { languages, users } from '../src/db/schema';

test('drafts stay private, writes require admins and stale saves cannot overwrite', async () => {
  const [english] = await realDb.select().from(languages).where(eq(languages.code, 'en')).limit(1);
  const [admin] = await realDb.select().from(users).where(eq(users.isSuperAdmin, true)).limit(1);
  expect(english).toBeDefined(); expect(admin).toBeDefined();
  let signedIn: { id: string; isSuperAdmin: boolean } | null = null;
  const rollback = new Error('ROLLBACK_VOCABULARY_TEST');
  try {
    await realDb.transaction(async tx => {
      mock.module('../src/db', () => ({ db: tx, pool }));
      mock.module('../src/modules/auth/session', () => ({ resolveSessionUser: async () => signedIn }));
      const { vocabularyRoutes, adminVocabularyRoutes } = await import('../src/modules/vocabulary/routes');
      const app = new Elysia().use(vocabularyRoutes).use(adminVocabularyRoutes);
      const call = (path: string, method = 'GET', body?: unknown) => app.handle(new Request(`http://localhost/api/v1${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }));
      const body = {
        languageId: english.id, slug: `test-vocab-${crypto.randomUUID()}`, title: 'Test scene', heading: 'English–Thai Vocabulary', translationCode: 'th', category: 'Test', description: '',
        backgroundUrl: '/assets/vocab/bedroom-background.png', aspectRatio: 1.5, isPublished: false, sortOrder: 99999,
        items: [{ id: 'test-object', word: 'ball', translation: 'ลูกบอล', description: 'A ball.', imageUrl: '/assets/vocab/bedroom-object-6.png', mode: 'object', x: 50, y: 50, width: 20, markerX: 40, markerY: 60, rotation: 37.25 }],
      };
      expect((await call('/vocabulary/')).status).toBe(401);
      expect((await call('/admin/vocabulary/')).status).toBe(403);
      signedIn = { id: admin.id, isSuperAdmin: false };
      expect((await call('/admin/vocabulary/', 'POST', body)).status).toBe(403);
      signedIn = { id: admin.id, isSuperAdmin: true };
      expect((await call('/admin/vocabulary/', 'POST', { ...body, items: [{ ...body.items[0], x: 101 }] })).status).toBe(422);
      expect((await call('/admin/vocabulary/', 'POST', { ...body, items: [{ ...body.items[0], rotation: -1 }] })).status).toBe(422);
      expect((await call('/admin/vocabulary/', 'POST', { ...body, items: [{ ...body.items[0], rotation: 361 }] })).status).toBe(422);
      expect((await call('/admin/vocabulary/', 'POST', { ...body, backgroundUrl: 'javascript:alert(1)' })).status).toBe(400);
      expect((await call('/admin/vocabulary/', 'POST', { ...body, items: [body.items[0], body.items[0]] })).status).toBe(400);
      const created = await call('/admin/vocabulary/', 'POST', body);
      expect(created.status).toBe(201);
      const { page } = await created.json();
      expect(page.revision).toBe(1);
      signedIn = { id: admin.id, isSuperAdmin: false };
      expect((await call(`/vocabulary/${page.id}`)).status).toBe(404);
      expect((await (await call(`/vocabulary/?languageId=${english.id}`)).json()).some((p: { id: string }) => p.id === page.id)).toBe(false);
      expect((await call(`/admin/vocabulary/${page.id}`, 'PUT', { ...body, revision: 1, isPublished: true })).status).toBe(403);
      signedIn = { id: admin.id, isSuperAdmin: true };
      const published = await call(`/admin/vocabulary/${page.id}`, 'PUT', { ...body, revision: 1, isPublished: true });
      expect(published.status).toBe(200);
      expect((await published.json()).page.revision).toBe(2);
      expect((await call(`/admin/vocabulary/${page.id}`, 'PUT', { ...body, title: 'Stale overwrite', revision: 1, isPublished: true })).status).toBe(409);
      signedIn = { id: admin.id, isSuperAdmin: false };
      const visible = await call(`/vocabulary/${page.id}`); expect(visible.status).toBe(200);
      const visiblePage = (await visible.json()).page;
      expect(visiblePage.title).toBe('Test scene'); expect(visiblePage.languageCode).toBe('en');
      expect(visiblePage.items[0].rotation).toBe(37.25);
      expect((await (await call(`/vocabulary/?languageId=${english.id}`)).json()).some((p: { id: string }) => p.id === page.id)).toBe(true);
      expect(await (await call(`/vocabulary/?languageId=${crypto.randomUUID()}`)).json()).toEqual([]);
      signedIn = { id: admin.id, isSuperAdmin: true };
      const beforeOrder = (await (await call('/admin/vocabulary/')).json()).filter((p: { languageId: string }) => p.languageId === english.id);
      const ordered = [...beforeOrder].reverse().map((p: { id: string; revision: number }) => ({ id: p.id, revision: p.revision }));
      expect((await call('/admin/vocabulary/reorder', 'POST', { languageId: english.id, pages: ordered.slice(1) })).status).toBe(400);
      const staleOrder = ordered.map(p => p.id === page.id ? { ...p, revision: 999999 } : p);
      expect((await call('/admin/vocabulary/reorder', 'POST', { languageId: english.id, pages: staleOrder })).status).toBe(409);
      const afterConflict = await (await call('/admin/vocabulary/')).json();
      for (const previous of beforeOrder) expect(afterConflict.find((p: { id: string }) => p.id === previous.id).revision).toBe(previous.revision);
      const reordered = await call('/admin/vocabulary/reorder', 'POST', { languageId: english.id, pages: ordered });
      expect(reordered.status).toBe(200);
      const reorderedPages = (await reordered.json()).pages;
      expect(reorderedPages.map((p: { id: string }) => p.id)).toEqual(ordered.map(p => p.id));
      expect(reorderedPages.map((p: { sortOrder: number }) => p.sortOrder)).toEqual(ordered.map((_, index) => index + 1));
      signedIn = { id: admin.id, isSuperAdmin: false };
      await tx.update(languages).set({ isActive: false }).where(eq(languages.id, english.id));
      expect((await call(`/vocabulary/${page.id}`)).status).toBe(404);
      expect(await (await call(`/vocabulary/?languageId=${english.id}`)).json()).toEqual([]);
      await tx.update(languages).set({ isActive: true }).where(eq(languages.id, english.id));
      signedIn = { id: admin.id, isSuperAdmin: true };
      expect((await call(`/admin/vocabulary/${page.id}`, 'DELETE')).status).toBe(200);
      signedIn = { id: admin.id, isSuperAdmin: false };
      expect((await call(`/vocabulary/${page.id}`)).status).toBe(404);
      throw rollback;
    });
  } catch(error) { if (error !== rollback) throw error; }
  finally { await pool.end(); }
}, 45000);
