import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import {
  enrollments,
  courses,
  learnerBlockStates,
  lessonBlocks,
  lessons,
  modules,
  progress,
} from '../../db/schema';
import { resolveSessionUser } from '../auth/session';
import { evaluateBlockResponse } from '../lessons/block-contract';

async function enrollmentForLesson(userId: string, lessonId: string, previewDrafts = false) {
  const [row] = await db
    .select({ enrollmentId: enrollments.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.courseId, modules.courseId),
        eq(enrollments.userId, userId),
        isNull(enrollments.deletedAt),
        or(eq(enrollments.status, 'active'), eq(enrollments.status, 'completed')),
      ),
    )
    .where(
      and(
        eq(lessons.id, lessonId),
        isNull(lessons.deletedAt),
        isNull(modules.deletedAt),
        isNull(courses.deletedAt),
        previewDrafts ? undefined : and(eq(lessons.isPublished, true), eq(courses.isPublished, true)),
      ),
    )
    .limit(1);

  return row?.enrollmentId ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function feedbackForBlock(
  block: { type: string; content: unknown; settings: unknown },
  completed: boolean,
) {
  if (!completed || block.type !== 'multiple_choice') return null;

  const content = asRecord(block.content);
  const settings = asRecord(block.settings);
  const explanation = typeof content.explanation === 'string' ? content.explanation : '';

  if (settings.showExplanation === false || !explanation) return null;
  return { explanation };
}

async function syncLessonProgress(enrollmentId: string, lessonId: string, store: Pick<typeof db, 'select' | 'insert' | 'update'> = db) {
  const [blocks, states] = await Promise.all([
    store
      .select({ id: lessonBlocks.id })
      .from(lessonBlocks)
      .where(and(eq(lessonBlocks.lessonId, lessonId), isNull(lessonBlocks.deletedAt)))
      .orderBy(asc(lessonBlocks.sortOrder), asc(lessonBlocks.createdAt)),
    store
      .select({
        blockId: learnerBlockStates.blockId,
        completed: learnerBlockStates.completed,
      })
      .from(learnerBlockStates)
      .where(
        and(
          eq(learnerBlockStates.enrollmentId, enrollmentId),
          eq(learnerBlockStates.lessonId, lessonId),
          isNull(learnerBlockStates.deletedAt),
        ),
      ),
  ]);

  const completedIds = new Set(states.filter((state) => state.completed).map((state) => state.blockId));
  const total = blocks.length;
  const completedCount = blocks.filter((block) => completedIds.has(block.id)).length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const isCompleted = total > 0 && completedCount === total;
  const currentBlockId = isCompleted
    ? null
    : blocks.find((block) => !completedIds.has(block.id))?.id ?? null;
  const now = new Date();

  const [existing] = await store
    .select()
    .from(progress)
    .where(
      and(
        eq(progress.enrollmentId, enrollmentId),
        eq(progress.lessonId, lessonId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await store
      .update(progress)
      .set({
        deletedAt: null,
        status: isCompleted ? 'completed' : 'in_progress',
        percent,
        currentBlockId,
        startedAt: existing.startedAt ?? now,
        completedAt: isCompleted ? (existing.completedAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(progress.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await store
    .insert(progress)
    .values({
      enrollmentId,
      lessonId,
      status: isCompleted ? 'completed' : 'in_progress',
      percent,
      currentBlockId,
      startedAt: now,
      completedAt: isCompleted ? now : null,
    })
    .returning();

  return created;
}

export const progressRoutes = new Elysia({ prefix: '/api/v1/progress' })
  .get('/', async ({ request, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }

    return db
      .select({ progress })
      .from(progress)
      .innerJoin(
        enrollments,
        and(eq(enrollments.id, progress.enrollmentId), isNull(enrollments.deletedAt)),
      )
      .where(and(eq(enrollments.userId, user.id), isNull(progress.deletedAt)))
      .orderBy(progress.updatedAt)
      .then((rows) => rows.map((row) => row.progress));
  })
  .get('/lesson/:lessonId', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }

    const enrollmentId = await enrollmentForLesson(user.id, params.lessonId, user.isSuperAdmin);
    if (!enrollmentId) {
      set.status = 404;
      return { error: 'Active enrollment for this lesson was not found.' };
    }

    const [lessonProgress, states, blocks] = await Promise.all([
      db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.enrollmentId, enrollmentId),
            eq(progress.lessonId, params.lessonId),
            isNull(progress.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(learnerBlockStates)
        .where(
          and(
            eq(learnerBlockStates.enrollmentId, enrollmentId),
            eq(learnerBlockStates.lessonId, params.lessonId),
            isNull(learnerBlockStates.deletedAt),
          ),
        )
        .orderBy(learnerBlockStates.createdAt),
      db
        .select({
          id: lessonBlocks.id,
          type: lessonBlocks.type,
          content: lessonBlocks.content,
          settings: lessonBlocks.settings,
        })
        .from(lessonBlocks)
        .where(and(eq(lessonBlocks.lessonId, params.lessonId), isNull(lessonBlocks.deletedAt))),
    ]);

    const blockById = new Map(blocks.map((block) => [block.id, block] as const));
    const feedbackByBlock = Object.fromEntries(
      states.flatMap((state) => {
        const block = blockById.get(state.blockId);
        if (!block) return [];
        const feedback = feedbackForBlock(block, state.completed);
        return feedback ? [[state.blockId, feedback] as const] : [];
      }),
    );

    return { progress: lessonProgress, blockStates: states, feedbackByBlock };
  }, { params: t.Object({ lessonId: t.String({ format: 'uuid' }) }) })
  .put(
    '/lesson/:lessonId/blocks/:blockId',
    async ({ request, params, body, set }) => {
      const user = await resolveSessionUser(request);
      if (!user) {
        set.status = 401;
        return { error: 'Not signed in.' };
      }

      const enrollmentId = await enrollmentForLesson(user.id, params.lessonId, user.isSuperAdmin);
      if (!enrollmentId) {
        set.status = 404;
        return { error: 'Active enrollment for this lesson was not found.' };
      }

      return db.transaction(async (tx) => {
        // Serialize submissions per enrollment, including progress and course completion.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${enrollmentId}, 0))`);
        const [block] = await tx
          .select()
          .from(lessonBlocks)
          .where(
            and(
              eq(lessonBlocks.id, params.blockId),
              eq(lessonBlocks.lessonId, params.lessonId),
              isNull(lessonBlocks.deletedAt),
            ),
          )
          .limit(1);

        if (!block) {
          set.status = 404;
          return { error: 'Block not found.' };
        }

        const evaluation = evaluateBlockResponse(
          block,
          body.response,
          body.score,
          body.completed,
        );
        const now = new Date();

        const [existing] = await tx
          .select()
          .from(learnerBlockStates)
          .where(
            and(
              eq(learnerBlockStates.enrollmentId, enrollmentId),
              eq(learnerBlockStates.blockId, block.id),
            ),
          )
          .limit(1);

        const completed = Boolean(existing?.completed || evaluation.completed);
        const completedAt = completed
          ? (existing?.completedAt ?? now)
          : null;

        const [state] = existing
          ? await tx
              .update(learnerBlockStates)
              .set({
                deletedAt: null,
                response: body.response,
                attempts: existing.attempts + 1,
                score: evaluation.score,
                completed,
                startedAt: existing.startedAt ?? now,
                completedAt,
                updatedAt: now,
              })
              .where(eq(learnerBlockStates.id, existing.id))
              .returning()
          : await tx
              .insert(learnerBlockStates)
              .values({
                enrollmentId,
                lessonId: params.lessonId,
                blockId: block.id,
                response: body.response,
                attempts: 1,
                score: evaluation.score,
                completed,
                startedAt: now,
                completedAt,
              })
              .returning();

        const lessonProgress = await syncLessonProgress(enrollmentId, params.lessonId, tx);
        const [enrollment] = await tx.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
        if (enrollment) {
          const courseLessons = await tx.select({ id: lessons.id }).from(lessons)
            .innerJoin(modules, eq(modules.id, lessons.moduleId))
            .where(and(eq(modules.courseId, enrollment.courseId), isNull(modules.deletedAt), isNull(lessons.deletedAt), eq(lessons.isPublished, true)));
          const completedLessons = await tx.select({ id: progress.lessonId }).from(progress)
            .where(and(eq(progress.enrollmentId, enrollmentId), eq(progress.status, 'completed'), isNull(progress.deletedAt)));
          const completedIds = new Set(completedLessons.map(item => item.id));
          const courseComplete = courseLessons.length > 0 && courseLessons.every(item => completedIds.has(item.id));
          await tx.update(enrollments).set({ status: courseComplete ? 'completed' : 'active', completedAt: courseComplete ? enrollment.completedAt ?? now : null, updatedAt: now }).where(eq(enrollments.id, enrollmentId));
        }
        return {
          state,
          progress: lessonProgress,
          feedback: feedbackForBlock(block, completed),
        };
      });
    },
    {
      params: t.Object({ lessonId: t.String({ format: 'uuid' }), blockId: t.String({ format: 'uuid' }) }),
      body: t.Object({
        response: t.Any(),
        score: t.Optional(t.Number()),
        completed: t.Optional(t.Boolean()),
      }),
    },
  )
  .get('/:id', async ({ request, params, set }) => {
    const user = await resolveSessionUser(request);
    if (!user) {
      set.status = 401;
      return { error: 'Not signed in.' };
    }

    const [row] = await db
      .select({ progress, enrollmentUserId: enrollments.userId })
      .from(progress)
      .innerJoin(
        enrollments,
        and(eq(enrollments.id, progress.enrollmentId), isNull(enrollments.deletedAt)),
      )
      .where(
        user.isSuperAdmin
          ? and(eq(progress.id, params.id), isNull(progress.deletedAt))
          : and(
              eq(progress.id, params.id),
              eq(enrollments.userId, user.id),
              isNull(progress.deletedAt),
            ),
      )
      .limit(1);

    if (!row) {
      set.status = 404;
      return { error: 'Progress not found' };
    }
    return row.progress;
  }, { params: t.Object({ id: t.String({ format: 'uuid' }) }) });
