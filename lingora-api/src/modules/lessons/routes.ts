import { and, asc, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { resolveSessionUser } from '../auth/session';
import { db } from '../../db';
import { lessonBlocks, lessons, modules, courses } from '../../db/schema';

function learnerFacingBlock<T extends { type: string; content: unknown }>(block: T) {
  if (block.type !== 'multiple_choice' || !block.content || typeof block.content !== 'object' || Array.isArray(block.content)) {
    return block;
  }

  const safeContent = { ...(block.content as Record<string, unknown>) };
  delete safeContent.correctChoiceId;
  delete safeContent.explanation;

  return { ...block, content: safeContent };
}

export const lessonRoutes = new Elysia({ prefix: '/api/v1/lessons' })
  .get('/', async ({ request }) => {
    const user = await resolveSessionUser(request);
    return db.select({ lesson: lessons }).from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(isNull(lessons.deletedAt), isNull(modules.deletedAt), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : and(eq(lessons.isPublished, true), eq(courses.isPublished, true))))
      .orderBy(lessons.sortOrder, lessons.title).then(rows => rows.map(row => ({ ...row.lesson, content: null })));
  })
  .get('/:id', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    const [row] = await db.select({ lesson: lessons }).from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(eq(lessons.id, params.id), isNull(lessons.deletedAt), isNull(modules.deletedAt), isNull(courses.deletedAt), user?.isSuperAdmin ? undefined : and(eq(lessons.isPublished, true), eq(courses.isPublished, true)))).limit(1);
    const lesson = row?.lesson;

    if (!lesson) {
      set.status = 404;
      return { error: 'Lesson not found' };
    }

    const blocks = await db
      .select()
      .from(lessonBlocks)
      .where(and(eq(lessonBlocks.lessonId, lesson.id), isNull(lessonBlocks.deletedAt)))
      .orderBy(asc(lessonBlocks.sortOrder), asc(lessonBlocks.createdAt));

    return { ...lesson, content: null, blocks: blocks.map(learnerFacingBlock) };
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
