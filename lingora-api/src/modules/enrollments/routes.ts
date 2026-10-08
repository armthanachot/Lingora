import { and, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { enrollments, courses } from '../../db/schema';
import { resolveSessionUser } from '../auth/session';

export const enrollmentRoutes = new Elysia({ prefix: '/api/v1/enrollments' })
  .post('/', async ({ request, body, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) { set.status = 401; return { error: 'Not signed in.' }; }
    const [course] = await db.select().from(courses).where(and(eq(courses.id, body.courseId), isNull(courses.deletedAt), user.isSuperAdmin ? undefined : eq(courses.isPublished, true))).limit(1);
    if (!course) { set.status = 404; return { error: 'Course not found.' }; }
    // The existing unique index makes double clicks and simultaneous requests safe.
    await db.insert(enrollments).values({ userId: user.id, courseId: course.id })
      .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] });
    const [existing] = await db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, course.id))).limit(1);
    if (!existing) { set.status = 409; return { error: 'Could not start course. Please try again.' }; }
    if (existing.deletedAt || !['active', 'completed'].includes(existing.status)) {
      const [restored] = await db.update(enrollments).set({ deletedAt: null, status: 'active', completedAt: null, updatedAt: new Date() }).where(eq(enrollments.id, existing.id)).returning();
      return restored;
    }
    return existing;
  }, { body: t.Object({ courseId: t.String({ format: 'uuid' }) }) })
  .get('/', async ({ request, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }

    return db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, user.id), isNull(enrollments.deletedAt)))
      .orderBy(enrollments.enrolledAt);
  })
  .get('/:id', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        user.isSuperAdmin
          ? and(eq(enrollments.id, params.id), isNull(enrollments.deletedAt))
          : and(
              eq(enrollments.id, params.id),
              eq(enrollments.userId, user.id),
              isNull(enrollments.deletedAt),
            ),
      )
      .limit(1);

    if (!enrollment) {
      set.status = 404;
      return { error: 'Enrollment not found' };
    }
    return enrollment;
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
