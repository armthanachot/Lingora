import { and, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { resolveSessionUser } from '../auth/session';
import { db } from '../../db';
import { courses, languages, levels, modules, lessons, progress, enrollments } from '../../db/schema';

const courseSelection = {
  id: courses.id,
  languageId: courses.languageId,
  levelId: courses.levelId,
  slug: courses.slug,
  title: courses.title,
  description: courses.description,
  level: levels.name,
  sortOrder: courses.sortOrder,
  isPublished: courses.isPublished,
  createdAt: courses.createdAt,
  updatedAt: courses.updatedAt,
} as const;

export const courseRoutes = new Elysia({ prefix: '/api/v1/courses' })
  .get('/', async ({ request }) => {
    const user = await resolveSessionUser(request);
    return db
      .select(courseSelection)
      .from(courses)
      .leftJoin(levels, and(eq(levels.id, courses.levelId), isNull(levels.deletedAt)))
      .where(and(isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : eq(courses.isPublished, true)))
      .orderBy(courses.sortOrder, courses.title);
  })
  .get('/:id/outline', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    const [course] = await db.select({ ...courseSelection, languageCode: languages.code }).from(courses)
      .innerJoin(languages, eq(languages.id, courses.languageId))
      .leftJoin(levels, and(eq(levels.id, courses.levelId), isNull(levels.deletedAt)))
      .where(and(eq(courses.id, params.id), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : eq(courses.isPublished, true))).limit(1);
    if (!course) { set.status = 404; return { error: 'Course not found.' }; }
    const moduleRows = await db.select().from(modules).where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt))).orderBy(modules.sortOrder, modules.createdAt);
    const lessonRows = await db.select({ lesson: lessons }).from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt), isNull(lessons.deletedAt), user?.isSuperAdmin ? undefined : eq(lessons.isPublished, true)))
      .orderBy(lessons.sortOrder, lessons.createdAt);
    const [enrollment] = user ? await db.select().from(enrollments)
      .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, course.id), isNull(enrollments.deletedAt))).limit(1) : [];
    const progressRows = enrollment ? await db.select().from(progress)
      .where(and(eq(progress.enrollmentId, enrollment.id), isNull(progress.deletedAt))) : [];
    return { course, enrollment: enrollment ?? null, modules: moduleRows.map(module => ({ ...module,
      lessons: lessonRows.filter(row => row.lesson.moduleId === module.id).map(row => ({ ...row.lesson, content: null,
        progress: progressRows.find(item => item.lessonId === row.lesson.id) ?? null })) })) };
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) })
  .get('/:id', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    const [course] = await db
      .select(courseSelection)
      .from(courses)
      .leftJoin(levels, and(eq(levels.id, courses.levelId), isNull(levels.deletedAt)))
      .where(and(eq(courses.id, params.id), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : eq(courses.isPublished, true)))
      .limit(1);

    if (!course) {
      set.status = 404;
      return { error: 'Course not found' };
    }

    return course;
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
