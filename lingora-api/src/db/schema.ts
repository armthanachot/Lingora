import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    displayName: varchar('display_name', { length: 160 }),
    firstName: varchar('first_name', { length: 120 }),
    lastName: varchar('last_name', { length: 120 }),
    avatarUrl: text('avatar_url'),
    locale: varchar('locale', { length: 32 }),
    role: varchar('role', { length: 32 }).default('learner').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
    authProvider: varchar('auth_provider', { length: 32 }).default('google').notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    providerEmail: varchar('provider_email', { length: 320 }).notNull(),
    providerEmailVerified: boolean('provider_email_verified').default(false).notNull(),
    providerHostedDomain: varchar('provider_hosted_domain', { length: 255 }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_provider_account_unique').on(table.authProvider, table.providerAccountId),
  ],
);

export const userReadingPreferences = pgTable('user_reading_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  autoRead: boolean('auto_read').default(false).notNull(),
  ...timestamps,
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('sessions_token_hash_unique').on(table.tokenHash)],
);

export const languages = pgTable('languages', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 16 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  nativeName: varchar('native_name', { length: 120 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
  ...softDelete,
});

export const vocabularyPages = pgTable('vocabulary_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  languageId: uuid('language_id').notNull().references(() => languages.id, { onDelete: 'restrict' }),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  heading: varchar('heading', { length: 200 }).notNull(),
  translationCode: varchar('translation_code', { length: 16 }).default('th').notNull(),
  category: varchar('category', { length: 120 }).notNull(),
  description: text('description').default('').notNull(),
  backgroundUrl: text('background_url').default('').notNull(),
  aspectRatio: doublePrecision('aspect_ratio').default(1.5).notNull(),
  items: jsonb('items').$type<Array<{
    id: string; word: string; translation: string; description: string; imageUrl: string;
    mode: 'object' | 'marker'; x: number; y: number; width: number;
    markerX: number; markerY: number; rotation?: number;
  }>>().default([]).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  revision: integer('revision').default(1).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
  ...softDelete,
});

export const countries = pgTable('countries', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 2 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  nativeName: varchar('native_name', { length: 120 }),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  status: varchar('status', { length: 24 }).default('inactive').notNull(),
  flagImageUrl: text('flag_image_url'),
  heroImageUrl: text('hero_image_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
  ...softDelete,
});

export const countryLanguages = pgTable(
  'country_languages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade' }),
    languageId: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('country_languages_country_language_unique').on(table.countryId, table.languageId),
  ],
);

export const levels = pgTable(
  'levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex('levels_code_unique').on(table.code)],
);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    languageId: uuid('language_id')
      .notNull()
      .references(() => languages.id, { onDelete: 'cascade' }),
    levelId: uuid('level_id').references(() => levels.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    // Temporary legacy column kept for the staged levelId migration.
    // Remove it after existing course data has been backfilled to levelId.
    level: varchar('level', { length: 50 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex('courses_language_slug_unique').on(table.languageId, table.slug)],
);

export const modules = pgTable('modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
  ...softDelete,
});

export const lessons = pgTable('lessons', {
  id: uuid('id').defaultRandom().primaryKey(),
  moduleId: uuid('module_id')
    .notNull()
    .references(() => modules.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  // Legacy lesson JSON is kept during the block-system migration. New lesson content
  // should be stored in lessonBlocks.
  content: jsonb('content'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  ...timestamps,
  ...softDelete,
});

export const lessonBlocks = pgTable('lesson_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  lessonId: uuid('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  version: integer('version').default(1).notNull(),
  content: jsonb('content').notNull(),
  settings: jsonb('settings').notNull(),
  interaction: jsonb('interaction').notNull(),
  completion: jsonb('completion').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
  ...softDelete,
});

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).default('active').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex('enrollments_user_course_unique').on(table.userId, table.courseId)],
);

export const learnerBlockStates = pgTable(
  'learner_block_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id')
      .notNull()
      .references(() => lessonBlocks.id, { onDelete: 'cascade' }),
    response: jsonb('response'),
    attempts: integer('attempts').default(0).notNull(),
    score: doublePrecision('score'),
    completed: boolean('completed').default(false).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('learner_block_states_enrollment_block_unique').on(table.enrollmentId, table.blockId),
  ],
);

export const progress = pgTable(
  'progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).default('not_started').notNull(),
    percent: integer('percent').default(0).notNull(),
    currentBlockId: uuid('current_block_id').references(() => lessonBlocks.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [uniqueIndex('progress_enrollment_lesson_unique').on(table.enrollmentId, table.lessonId)],
);
