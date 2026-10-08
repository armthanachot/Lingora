import { and, eq, isNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../../db';
import {
  countries,
  countryLanguages,
  courses,
  enrollments,
  languages,
  levels,
  lessons,
  modules,
  progress,
  users,
} from '../../db/schema';
import { resolveSessionUser } from '../auth/session';

type FieldKind = 'string' | 'number' | 'boolean' | 'json' | 'date';

type ReferenceDefinition = {
  resource: string;
  label: string;
};

type ReferenceOption = {
  id: string;
  label: string;
  description?: string;
};

type FieldDefinition = {
  name: string;
  kind: FieldKind;
  nullable?: boolean;
  requiredOnCreate?: boolean;
  editable?: boolean;
  creatable?: boolean;
  defaultValue?: unknown;
  reference?: ReferenceDefinition;
};

type ResourceDefinition = {
  table: any;
  fields: FieldDefinition[];
  orderBy: any[];
};

const lockedFields: FieldDefinition[] = [
  { name: 'id', kind: 'string', editable: false, creatable: false },
  { name: 'createdAt', kind: 'date', editable: false, creatable: false },
  { name: 'updatedAt', kind: 'date', editable: false, creatable: false },
  { name: 'deletedAt', kind: 'date', nullable: true, editable: false, creatable: false },
];

const resourceDefinitions: Record<string, ResourceDefinition> = {
  languages: {
    table: languages,
    fields: [
      { name: 'code', kind: 'string', requiredOnCreate: true },
      { name: 'name', kind: 'string', requiredOnCreate: true },
      { name: 'nativeName', kind: 'string', requiredOnCreate: true },
      { name: 'description', kind: 'string', nullable: true },
      { name: 'isActive', kind: 'boolean', defaultValue: true },
      ...lockedFields,
    ],
    orderBy: [languages.name],
  },
  levels: {
    table: levels,
    fields: [
      { name: 'code', kind: 'string', requiredOnCreate: true },
      { name: 'name', kind: 'string', requiredOnCreate: true },
      { name: 'description', kind: 'string', nullable: true },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      { name: 'isActive', kind: 'boolean', defaultValue: true },
      ...lockedFields,
    ],
    orderBy: [levels.sortOrder, levels.name],
  },
  countries: {
    table: countries,
    fields: [
      { name: 'code', kind: 'string', requiredOnCreate: true },
      { name: 'name', kind: 'string', requiredOnCreate: true },
      { name: 'nativeName', kind: 'string', nullable: true },
      { name: 'latitude', kind: 'number', requiredOnCreate: true },
      { name: 'longitude', kind: 'number', requiredOnCreate: true },
      { name: 'status', kind: 'string', defaultValue: 'inactive' },
      { name: 'flagImageUrl', kind: 'string', nullable: true },
      { name: 'heroImageUrl', kind: 'string', nullable: true },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      ...lockedFields,
    ],
    orderBy: [countries.sortOrder, countries.name],
  },
  'country-languages': {
    table: countryLanguages,
    fields: [
      { name: 'countryId', kind: 'string', requiredOnCreate: true, reference: { resource: 'countries', label: 'Country' } },
      { name: 'languageId', kind: 'string', requiredOnCreate: true, reference: { resource: 'languages', label: 'Language' } },
      { name: 'isPrimary', kind: 'boolean', defaultValue: false },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      ...lockedFields,
    ],
    orderBy: [countryLanguages.sortOrder, countryLanguages.createdAt],
  },
  courses: {
    table: courses,
    fields: [
      { name: 'languageId', kind: 'string', requiredOnCreate: true, reference: { resource: 'languages', label: 'Language' } },
      { name: 'levelId', kind: 'string', requiredOnCreate: true, reference: { resource: 'levels', label: 'Level' } },
      { name: 'slug', kind: 'string', requiredOnCreate: true },
      { name: 'title', kind: 'string', requiredOnCreate: true },
      { name: 'description', kind: 'string', nullable: true },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      { name: 'isPublished', kind: 'boolean', defaultValue: false },
      ...lockedFields,
    ],
    orderBy: [courses.sortOrder, courses.title],
  },
  modules: {
    table: modules,
    fields: [
      { name: 'courseId', kind: 'string', requiredOnCreate: true, reference: { resource: 'courses', label: 'Course' } },
      { name: 'title', kind: 'string', requiredOnCreate: true },
      { name: 'description', kind: 'string', nullable: true },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      ...lockedFields,
    ],
    orderBy: [modules.sortOrder, modules.title],
  },
  lessons: {
    table: lessons,
    fields: [
      { name: 'moduleId', kind: 'string', requiredOnCreate: true, reference: { resource: 'modules', label: 'Module' } },
      { name: 'title', kind: 'string', requiredOnCreate: true },
      { name: 'description', kind: 'string', nullable: true },
      { name: 'content', kind: 'json', nullable: true, editable: false, creatable: false },
      { name: 'sortOrder', kind: 'number', defaultValue: 0 },
      { name: 'isPublished', kind: 'boolean', defaultValue: false },
      ...lockedFields,
    ],
    orderBy: [lessons.sortOrder, lessons.title],
  },
  enrollments: {
    table: enrollments,
    fields: [
      { name: 'userId', kind: 'string', requiredOnCreate: true, reference: { resource: 'users', label: 'Learner' } },
      { name: 'courseId', kind: 'string', requiredOnCreate: true, reference: { resource: 'courses', label: 'Course' } },
      { name: 'status', kind: 'string', defaultValue: 'active' },
      { name: 'enrolledAt', kind: 'date', editable: false, creatable: false },
      { name: 'completedAt', kind: 'date', nullable: true },
      ...lockedFields,
    ],
    orderBy: [enrollments.enrolledAt],
  },
  progress: {
    table: progress,
    fields: [
      { name: 'enrollmentId', kind: 'string', requiredOnCreate: true, reference: { resource: 'enrollments', label: 'Enrollment' } },
      { name: 'lessonId', kind: 'string', requiredOnCreate: true, reference: { resource: 'lessons', label: 'Lesson' } },
      { name: 'status', kind: 'string', defaultValue: 'not_started' },
      { name: 'percent', kind: 'number', defaultValue: 0 },
      { name: 'completedAt', kind: 'date', nullable: true },
      ...lockedFields,
    ],
    orderBy: [progress.updatedAt],
  },
};

function publicFields(definition: ResourceDefinition) {
  return definition.fields.map((field) => ({
    name: field.name,
    kind: field.kind,
    nullable: field.nullable ?? false,
    requiredOnCreate: field.requiredOnCreate ?? false,
    editable: field.editable ?? true,
    creatable: field.creatable ?? true,
    defaultValue: field.defaultValue,
    reference: field.reference,
  }));
}

async function loadReferenceOptions(resource: string): Promise<ReferenceOption[]> {
  switch (resource) {
    case 'languages': {
      const rows = await db
        .select({
          id: languages.id,
          name: languages.name,
          nativeName: languages.nativeName,
          code: languages.code,
        })
        .from(languages)
        .where(isNull(languages.deletedAt))
        .orderBy(languages.name);

      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: [row.nativeName, row.code].filter(Boolean).join(' · '),
      }));
    }
    case 'levels': {
      const rows = await db
        .select({
          id: levels.id,
          code: levels.code,
          name: levels.name,
          description: levels.description,
          isActive: levels.isActive,
        })
        .from(levels)
        .where(isNull(levels.deletedAt))
        .orderBy(levels.sortOrder, levels.name);

      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: [
          row.code,
          row.isActive ? null : 'Inactive',
          row.description,
        ].filter(Boolean).join(' · '),
      }));
    }
    case 'countries': {
      const rows = await db
        .select({
          id: countries.id,
          name: countries.name,
          code: countries.code,
          nativeName: countries.nativeName,
        })
        .from(countries)
        .where(isNull(countries.deletedAt))
        .orderBy(countries.name);

      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: [row.nativeName, row.code].filter(Boolean).join(' · '),
      }));
    }
    case 'courses': {
      const rows = await db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          languageName: languages.name,
          levelName: levels.name,
        })
        .from(courses)
        .innerJoin(languages, eq(courses.languageId, languages.id))
        .leftJoin(levels, and(eq(courses.levelId, levels.id), isNull(levels.deletedAt)))
        .where(and(isNull(courses.deletedAt), isNull(languages.deletedAt)))
        .orderBy(courses.title);

      return rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: [row.languageName, row.levelName, row.slug].filter(Boolean).join(' · '),
      }));
    }
    case 'modules': {
      const rows = await db
        .select({
          id: modules.id,
          title: modules.title,
          courseTitle: courses.title,
        })
        .from(modules)
        .innerJoin(courses, eq(modules.courseId, courses.id))
        .where(and(isNull(modules.deletedAt), isNull(courses.deletedAt)))
        .orderBy(modules.title);

      return rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: row.courseTitle,
      }));
    }
    case 'lessons': {
      const rows = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          moduleTitle: modules.title,
          courseTitle: courses.title,
        })
        .from(lessons)
        .innerJoin(modules, eq(lessons.moduleId, modules.id))
        .innerJoin(courses, eq(modules.courseId, courses.id))
        .where(and(isNull(lessons.deletedAt), isNull(modules.deletedAt), isNull(courses.deletedAt)))
        .orderBy(lessons.title);

      return rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: [row.courseTitle, row.moduleTitle].filter(Boolean).join(' · '),
      }));
    }
    case 'users': {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .orderBy(users.email);

      return rows.map((row) => {
        const accountName = row.displayName?.trim()
          || [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
          || row.email;

        return {
          id: row.id,
          label: accountName,
          description: accountName === row.email ? undefined : row.email,
        };
      });
    }
    case 'enrollments': {
      const rows = await db
        .select({
          id: enrollments.id,
          userEmail: users.email,
          userDisplayName: users.displayName,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          courseTitle: courses.title,
          status: enrollments.status,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.userId, users.id))
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(and(isNull(enrollments.deletedAt), isNull(courses.deletedAt)))
        .orderBy(enrollments.enrolledAt);

      return rows.map((row) => {
        const accountName = row.userDisplayName?.trim()
          || [row.userFirstName, row.userLastName].filter(Boolean).join(' ').trim()
          || row.userEmail;

        return {
          id: row.id,
          label: `${accountName} — ${row.courseTitle}`,
          description: row.status,
        };
      });
    }
    default:
      return [];
  }
}

async function referenceOptionsForDefinition(definition: ResourceDefinition) {
  const referenceFields = definition.fields.filter((field) => field.reference);
  const cache = new Map<string, Promise<ReferenceOption[]>>();

  const entries = await Promise.all(referenceFields.map(async (field) => {
    const resource = field.reference!.resource;
    let options = cache.get(resource);
    if (!options) {
      options = loadReferenceOptions(resource);
      cache.set(resource, options);
    }
    return [field.name, await options] as const;
  }));

  return Object.fromEntries(entries) as Record<string, ReferenceOption[]>;
}

function parseField(field: FieldDefinition, value: unknown) {
  if ((value === null || value === '') && field.nullable) return null;
  if (value === null || value === undefined || value === '') {
    throw new Error(`${field.name} is required.`);
  }

  switch (field.kind) {
    case 'string':
      return String(value).trim();
    case 'number': {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`${field.name} must be a number.`);
      if (field.name === 'percent' && (parsed < 0 || parsed > 100)) {
        throw new Error('percent must be between 0 and 100.');
      }
      return parsed;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error(`${field.name} must be true or false.`);
    case 'json':
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`${field.name} must contain valid JSON.`);
      }
    case 'date': {
      const parsed = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(parsed.getTime())) throw new Error(`${field.name} must be a valid date.`);
      return parsed;
    }
  }
}

function normalizeValues(definition: ResourceDefinition, values: Record<string, unknown>, mode: 'create' | 'update') {
  const output: Record<string, unknown> = {};
  const allowedFields = definition.fields.filter((field) =>
    mode === 'create' ? (field.creatable ?? true) : (field.editable ?? true),
  );

  for (const field of allowedFields) {
    if (!(field.name in values)) {
      if (mode === 'create' && field.requiredOnCreate) throw new Error(`${field.name} is required.`);
      continue;
    }
    output[field.name] = parseField(field, values[field.name]);
  }

  if (mode === 'update' && Object.keys(output).length === 0) throw new Error('No editable fields to update.');
  return output;
}

async function requireSuperAdmin(request: Request) {
  const user = await resolveSessionUser(request);
  return user?.isSuperAdmin ? user : null;
}

function getDefinition(resource: string) {
  return resourceDefinitions[resource] ?? null;
}

async function updateRow(executor: typeof db, definition: ResourceDefinition, id: string, values: Record<string, unknown>) {
  const updateValues = normalizeValues(definition, values, 'update');
  const [row] = await executor
    .update(definition.table)
    .set({ ...updateValues, updatedAt: new Date() })
    .where(and(eq(definition.table.id, id), isNull(definition.table.deletedAt)))
    .returning();
  if (!row) throw new Error('Record not found.');
  return row as Record<string, unknown>;
}

const valuesBody = t.Object({ values: t.Record(t.String(), t.Any()) });
const batchBody = t.Object({
  rows: t.Array(t.Object({ id: t.String({ minLength: 1 }), values: t.Record(t.String(), t.Any()) }), { minItems: 1 }),
});

export const adminRoutes = new Elysia({ prefix: '/api/v1/admin' })
  .get('/master/:resource', async ({ request, params, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }

    const definition = getDefinition(params.resource);
    if (!definition) {
      set.status = 404;
      return { error: 'Unknown master-data resource.' };
    }

    const [rows, references] = await Promise.all([
      db
        .select()
        .from(definition.table)
        .where(isNull(definition.table.deletedAt))
        .orderBy(...definition.orderBy),
      referenceOptionsForDefinition(definition),
    ]);

    return { resource: params.resource, fields: publicFields(definition), rows, references };
  })
  .post(
    '/master/:resource',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }
      const definition = getDefinition(params.resource);
      if (!definition) {
        set.status = 404;
        return { error: 'Unknown master-data resource.' };
      }

      try {
        const values = normalizeValues(definition, body.values, 'create');
        const rows = await db
          .insert(definition.table)
          .values(values)
          .returning() as unknown as Record<string, unknown>[];
        const row = rows[0];
        if (!row) throw new Error('Could not create record.');
        set.status = 201;
        return { row };
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Could not create record.' };
      }
    },
    { body: valuesBody },
  )
  .patch(
    '/master/:resource/batch',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }
      const definition = getDefinition(params.resource);
      if (!definition) {
        set.status = 404;
        return { error: 'Unknown master-data resource.' };
      }

      try {
        const rows = await db.transaction(async (tx) => {
          const updated: Record<string, unknown>[] = [];
          for (const change of body.rows) {
            updated.push(await updateRow(tx as unknown as typeof db, definition, change.id, change.values));
          }
          return updated;
        });
        return { rows };
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Could not save changes.' };
      }
    },
    { body: batchBody },
  )
  .patch(
    '/master/:resource/:id',
    async ({ request, params, body, set }) => {
      if (!(await requireSuperAdmin(request))) {
        set.status = 403;
        return { error: 'Super admin access required.' };
      }
      const definition = getDefinition(params.resource);
      if (!definition) {
        set.status = 404;
        return { error: 'Unknown master-data resource.' };
      }

      try {
        const row = await updateRow(db, definition, params.id, body.values);
        return { row };
      } catch (error) {
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Could not update record.' };
      }
    },
    { body: valuesBody },
  )
  .delete('/master/:resource/:id', async ({ request, params, set }) => {
    if (!(await requireSuperAdmin(request))) {
      set.status = 403;
      return { error: 'Super admin access required.' };
    }
    const definition = getDefinition(params.resource);
    if (!definition) {
      set.status = 404;
      return { error: 'Unknown master-data resource.' };
    }

    const now = new Date();
    const [row] = await db
      .update(definition.table)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(definition.table.id, params.id), isNull(definition.table.deletedAt)))
      .returning({ id: definition.table.id });

    if (!row) {
      set.status = 404;
      return { error: 'Record not found.' };
    }
    return { deleted: true, id: row.id };
  });
