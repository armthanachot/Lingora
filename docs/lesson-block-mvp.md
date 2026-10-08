# Lesson Block MVP

This document describes the first block-based lesson implementation in Lingora.

## Architecture

Lesson content is split into three concerns:

1. **Lesson / Block Definition** — creator-owned content and behavior.
2. **Learner Block State** — one learner's response, attempts, score, and completion for one block.
3. **Lesson Progress** — the learner's overall status, current block, and percent for the lesson.

The legacy `lessons.content` JSON column is intentionally retained for migration compatibility, but new lesson content should be created through `lesson_blocks`.

## MVP block types

- `reading`
- `multiple_choice`
- `image`
- `audio`
- `video`
- `conversation`

Every block has an automatically generated database UUID plus `type`, `version`, `content`, `settings`, `interaction`, `completion`, and `sortOrder`.

Interaction mode is fixed by block type in this MVP. Completion is configurable only where the current learner runtime supports it.

## Creator flow

Super admins can open **Settings → Lesson builder** to:

- select an existing lesson;
- add blocks without declaring a page count;
- edit type-specific content and settings;
- reorder or soft-delete blocks;
- upload image/audio/video files or use an external URL;
- preview configured media;
- configure conversation participants and turns.

Multiple-choice answer keys are stored in the creator definition but are removed from learner-facing lesson payloads. Explanations are returned as learner feedback only after the block is completed.

### Reading editor

Reading blocks support `content.format: "plain" | "markdown"`. Existing blocks without a format remain plain text; newly created Reading blocks default to Markdown. No database migration is needed because the format lives inside the existing JSON content.

The Reading editor provides Write, Preview, and Split view, plus toolbar actions for bold, italic, underline, headings, bullet lists, quotes, five theme-aware text colors, links, and images. Images can use an external HTTP(S) URL or the existing Supabase media upload endpoint. Select text before applying formatting; Cmd/Ctrl+B, I, and U are supported. Changes are persisted through Save block.

Preview and LessonPlayer share `ReadingContent.tsx`. Markdown supports GFM tables and line breaks. Underline uses `<u>` and colors use allowlisted `<span class="reading-color-blue">` markup (blue, purple, green, red, orange). Raw HTML is sanitized; scripts, event handlers, arbitrary styles, and unsafe URL protocols are removed.

Validation: API/Web typecheck, Web production build, and `rtk bun test tests/reading-content.test.ts`. The tests cover legacy plain-text behavior, Markdown formatting, links/images/tables, and unsafe HTML/URLs.

## Learner state and progress

Learner responses are written to `learner_block_states`.

Submitting a block response:

- increments attempts;
- evaluates supported completion rules server-side;
- evaluates Multiple Choice answers server-side;
- stores score and completion;
- synchronizes lesson percent/status/current block in `progress`.

The reusable web component is:

`src/features/lessons/LessonPlayer.tsx`

It renders all six MVP block types and resumes from learner progress. The existing app does not yet have a full course/lesson navigation route wired to this component, so course navigation integration remains a separate product-flow step.

## Supabase Storage

Set these values in `lingora-api/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-secret-key
SUPABASE_STORAGE_BUCKET=lesson-media
# Optional:
# SUPABASE_STORAGE_PUBLIC_URL=https://cdn.example.com/lesson-media
```

For the MVP, `SUPABASE_STORAGE_BUCKET` should be a public bucket because block definitions store persistent public media URLs.

The Supabase secret key stays in the API environment only. Do not expose it through Vite/client environment variables.

## Database migration

Database structure is defined only in `src/db/schema.ts`. Generate the Drizzle migration from the schema rather than writing SQL by hand.

From `lingora-api`, using the repository-required RTK wrapper:

```sh
rtk bun run db:generate
rtk bun run db:migrate
rtk bun run typecheck
```

From `lingora-web`:

```sh
rtk bun run typecheck
rtk bun run build
```

The current MCP configuration exposes no runnable project tasks, so these commands must be run in the project environment before deployment.

## Main API endpoints

Creator/admin:

- `GET /api/v1/admin/lesson-builder/lessons`
- `GET /api/v1/admin/lesson-builder/:lessonId`
- `POST /api/v1/admin/lesson-builder/:lessonId/blocks`
- `PATCH /api/v1/admin/lesson-builder/:lessonId/blocks/:blockId`
- `POST /api/v1/admin/lesson-builder/:lessonId/reorder`
- `DELETE /api/v1/admin/lesson-builder/:lessonId/blocks/:blockId`
- `POST /api/v1/admin/lesson-builder/media/upload`

Learner:

- `GET /api/v1/lessons/:lessonId`
- `GET /api/v1/progress/lesson/:lessonId`
- `PUT /api/v1/progress/lesson/:lessonId/blocks/:blockId`
