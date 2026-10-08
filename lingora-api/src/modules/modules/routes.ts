import { and, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { resolveSessionUser } from '../auth/session';
import { db } from '../../db';
import { modules, courses } from '../../db/schema';

export const moduleRoutes = new Elysia({ prefix: '/api/v1/modules' })
  .get('/', async ({ request }) => {
    const user = await resolveSessionUser(request);
    return db.select({ module: modules }).from(modules).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(isNull(modules.deletedAt), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : eq(courses.isPublished, true)))
      .orderBy(modules.sortOrder, modules.title).then(rows => rows.map(row => row.module));
  })
  .get('/:id', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    const [row] = await db
      .select({ module: modules })
      .from(modules)
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(eq(modules.id, params.id), isNull(modules.deletedAt), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : eq(courses.isPublished, true)))
      .limit(1);
    const module = row?.module;
    if (!module) {
      set.status = 404;
      return { error: 'Module not found' };
    }
    return module;
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
