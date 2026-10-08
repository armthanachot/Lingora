import { and, asc, count, eq, isNull, max } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { countries, countryLanguages, courses, languages, levels, lessonBlocks, lessons, modules } from '../../db/schema';
import { resolveSessionUser } from '../auth/session';
import {
  blockDefaults,
  isLessonBlockType,
  normalizeBlockDefinition,
} from '../lessons/block-contract';

async function requireSuperAdmin(request: Request) {
  const user = await resolveSessionUser(request);
  return user?.isSuperAdmin ? user : null;
}

async function requireLesson(lessonId: string) {
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), isNull(lessons.deletedAt)))
    .limit(1);
  return lesson ?? null;
}

const blockBody = t.Object({
  type: t.String({ minLength: 1 }),
  version: t.Optional(t.Number()),
  content: t.Optional(t.Record(t.String(), t.Any())),
  settings: t.Optional(t.Record(t.String(), t.Any())),
  interaction: t.Optional(t.Record(t.String(), t.Any())),
  completion: t.Optional(t.Record(t.String(), t.Any())),
});

const blockPatchBody = t.Object({
  type: t.Optional(t.String({ minLength: 1 })),
  version: t.Optional(t.Number()),
  content: t.Optional(t.Record(t.String(), t.Any())),
  settings: t.Optional(t.Record(t.String(), t.Any())),
  interaction: t.Optional(t.Record(t.String(), t.Any())),
  completion: t.Optional(t.Record(t.String(), t.Any())),
  sortOrder: t.Optional(t.Number()),
});

function publicStorageUrl(baseUrl: string, bucket: string, storagePath: string) {
  const configuredBase = process.env.SUPABASE_STORAGE_PUBLIC_URL?.replace(/\/$/, '');
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  if (configuredBase) return `${configuredBase}/${encodedPath}`;
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

export const lessonBuilderRoutes = new Elysia({ prefix: '/api/v1/admin/lesson-builder' })
  .get('/filter-options', async ({ request, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    return db.select({
      id: countryLanguages.id,
      countryId: countries.id,
      countryName: countries.name,
      languageId: languages.id,
      languageName: languages.name,
    })
      .from(countryLanguages)
      .innerJoin(countries, eq(countryLanguages.countryId, countries.id))
      .innerJoin(languages, eq(countryLanguages.languageId, languages.id))
      .where(and(isNull(countryLanguages.deletedAt), isNull(countries.deletedAt), isNull(languages.deletedAt)))
      .orderBy(countries.name, languages.name);
  })
  .get('/lessons', async ({ request, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    return db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        title: lessons.title,
        description: lessons.description,
        sortOrder: lessons.sortOrder,
        isPublished: lessons.isPublished,
        moduleTitle: modules.title,
        courseId: courses.id,
        courseTitle: courses.title,
        languageId: courses.languageId,
        languageName: languages.name,
        languageCode: languages.code,
        levelId: courses.levelId,
        levelName: levels.name,
        updatedAt: lessons.updatedAt,
        blockCount: count(lessonBlocks.id),
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .innerJoin(languages, eq(courses.languageId, languages.id))
      .leftJoin(levels, and(eq(courses.levelId, levels.id), isNull(levels.deletedAt)))
      .leftJoin(
        lessonBlocks,
        and(eq(lessonBlocks.lessonId, lessons.id), isNull(lessonBlocks.deletedAt)),
      )
      .where(
        and(
          isNull(lessons.deletedAt),
          isNull(modules.deletedAt),
          isNull(courses.deletedAt),
        ),
      )
      .groupBy(
        lessons.id,
        lessons.moduleId,
        lessons.title,
        lessons.description,
        lessons.sortOrder,
        lessons.isPublished,
        modules.id,
        modules.title,
        modules.sortOrder,
        courses.id,
        courses.title,
        languages.id,
        levels.id,
      )
      .orderBy(courses.title, modules.sortOrder, lessons.sortOrder, lessons.title);
  })
  .post(
    '/media/upload',
    async ({ request, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }

      const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
      const secretKey = process.env.SUPABASE_SECRET_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'lesson-media';

      if (!supabaseUrl || !secretKey) {
        set.status = 503;
        return {
          error: 'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
        };
      }

      const file = body.file;
      if (!['image/', 'audio/', 'video/'].some((prefix) => file.type.startsWith(prefix))) {
        set.status = 400;
        return { error: 'Only image, audio, and video files are supported.' };
      }
      if (file.size > 50 * 1024 * 1024) {
        set.status = 400;
        return { error: 'Media file must be 50 MB or smaller.' };
      }

      const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(-120) || 'media';
      const day = new Date().toISOString().slice(0, 10);
      const storagePath = `${day}/${crypto.randomUUID()}-${safeName}`;
      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');

      const uploadResponse = await fetch(
        `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
        {
          method: 'POST',
          headers: {
            apikey: secretKey,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
          },
          body: file,
        },
      );

      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text().catch(() => '');
        set.status = 502;
        return { error: detail || 'Supabase Storage upload failed.' };
      }

      return {
        media: {
          source: 'upload' as const,
          url: publicStorageUrl(supabaseUrl, bucket, storagePath),
          storagePath,
          mimeType: file.type,
          originalName: file.name,
        },
      };
    },
    {
      body: t.Object({ file: t.File() }),
    },
  )
  .get('/:lessonId', async ({ request, params, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    const lesson = await requireLesson(params.lessonId);
    if (!lesson) {
      set.status = 404;
      return { error: 'Lesson not found.' };
    }

    const blocks = await db
      .select()
      .from(lessonBlocks)
      .where(and(eq(lessonBlocks.lessonId, lesson.id), isNull(lessonBlocks.deletedAt)))
      .orderBy(asc(lessonBlocks.sortOrder), asc(lessonBlocks.createdAt));

    return { lesson, blocks };
  })
  .post(
    '/:lessonId/blocks',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }

      const lesson = await requireLesson(params.lessonId);
      if (!lesson) {
        set.status = 404;
        return { error: 'Lesson not found.' };
      }

      try {
        const normalized = normalizeBlockDefinition(body);
        const [{ maxSortOrder }] = await db
          .select({ maxSortOrder: max(lessonBlocks.sortOrder) })
          .from(lessonBlocks)
          .where(and(eq(lessonBlocks.lessonId, lesson.id), isNull(lessonBlocks.deletedAt)));
        const sortOrder = Number(maxSortOrder ?? 0) + 1;

        const [block] = await db
          .insert(lessonBlocks)
          .values({
            lessonId: lesson.id,
            ...normalized,
            sortOrder,
          })
          .returning();

        set.status = 201;
        return { block };
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Could not create block.' };
      }
    },
    { body: blockBody },
  )
  .patch(
    '/:lessonId/blocks/:blockId',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }

      const [existing] = await db
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

      if (!existing) {
        set.status = 404;
        return { error: 'Block not found.' };
      }

      try {
        const nextType = body.type ?? existing.type;
        if (!isLessonBlockType(nextType)) throw new Error(`Unsupported block type: ${nextType}`);

        const changedType = nextType !== existing.type;
        const reset = changedType ? blockDefaults(nextType) : null;
        const normalized = normalizeBlockDefinition({
          type: nextType,
          version: body.version ?? (reset?.version ?? existing.version),
          content: body.content ?? (reset?.content ?? existing.content),
          settings: body.settings ?? (reset?.settings ?? existing.settings),
          interaction: body.interaction ?? (reset?.interaction ?? existing.interaction),
          completion: body.completion ?? (reset?.completion ?? existing.completion),
        });

        const [block] = await db
          .update(lessonBlocks)
          .set({
            ...normalized,
            ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
            updatedAt: new Date(),
          })
          .where(eq(lessonBlocks.id, existing.id))
          .returning();

        return { block };
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Could not update block.' };
      }
    },
    { body: blockPatchBody },
  )
  .post(
    '/:lessonId/reorder',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }

      const existing = await db
        .select({ id: lessonBlocks.id })
        .from(lessonBlocks)
        .where(and(eq(lessonBlocks.lessonId, params.lessonId), isNull(lessonBlocks.deletedAt)));

      const existingIds = new Set(existing.map((block) => block.id));
      if (
        body.blockIds.length !== existingIds.size
        || new Set(body.blockIds).size !== body.blockIds.length
        || body.blockIds.some((id) => !existingIds.has(id))
      ) {
        set.status = 400;
        return { error: 'Reorder payload must contain every active block exactly once.' };
      }

      await db.transaction(async (tx) => {
        for (let index = 0; index < body.blockIds.length; index += 1) {
          await tx
            .update(lessonBlocks)
            .set({ sortOrder: index + 1, updatedAt: new Date() })
            .where(eq(lessonBlocks.id, body.blockIds[index]));
        }
      });

      return { reordered: true };
    },
    {
      body: t.Object({
        blockIds: t.Array(t.String({ minLength: 1 })),
      }),
    },
  )
  .delete('/:lessonId/blocks/:blockId', async ({ request, params, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    const now = new Date();
    const [block] = await db
      .update(lessonBlocks)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(lessonBlocks.id, params.blockId),
          eq(lessonBlocks.lessonId, params.lessonId),
          isNull(lessonBlocks.deletedAt),
        ),
      )
      .returning({ id: lessonBlocks.id });

    if (!block) {
      set.status = 404;
      return { error: 'Block not found.' };
    }

    return { deleted: true, id: block.id };
  });
