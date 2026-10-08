# Lingora Project Handoff

> Last updated: 2026-10-03
>
> Purpose: This document is the current project handoff for Lingora. It summarizes the product direction, architecture decisions, implementation status, important files, known gaps, and recommended next steps so another developer or agent can continue without reconstructing the full conversation history.

### Latest session status (2026-10-03)

- Learner catalog, enrollment, outline, lesson player, resume/review and progress are implemented.
- Reading supports Markdown authoring/preview and a shared sanitized renderer, including formatting, links, images and five allowed text colors.
- A desktop Chrome review of Light/Dark themes is complete for the main signed-in pages and all 11 Settings sections. Main issues were faint secondary text in Light, insufficient surface separation in Dark, and weak selected/progress state hierarchy.
- The source-level theme pass from [theme-modify-plan.md](theme-modify-plan.md) is now implemented across semantic tokens, shared control states, Settings/Builder, Landing/Globe, learner catalog/outline and Reading presentation.
- Settings Content setup guide is collapsed by default with a disclosure plus the existing guided-tour entry point; learner lesson rows now distinguish completed / in-progress / not-started with color plus shape/border/text treatment.
- The follow-up UX pass is implemented and checked in the user's Chrome: Globe card/legend placement, compact catalog/Builder, actual My learning progress, clearer Start/Review states, Reading review labels, keyboard-safe Settings dialogs and working theme taps/dragging. Mobile Globe overflow discovered during verification is fixed.
- Web `rtk bun run build` passes (includes TypeScript). Targeted Light/Dark desktop and 390 × 844 mobile checks are recorded in section 30. The full state/fixture sweep and measured contrast audit remain open; this is not WCAG certification. API/schema, stored lesson content and learner progress were not modified for these checks.

---

## 1. Product overview

**Lingora** is a language-learning product centered around a world/globe exploration experience, structured language courses, modular lessons, and a flexible block-based lesson system.

The current high-level product flow is intended to become:

```text
Landing
  ↓
Google Sign-In
  ↓
Globe Explorer
  ↓
Country / Language
  ↓
Course
  ↓
Module
  ↓
Lesson
  ↓
Lesson Player
  ↓
Blocks
  ↓
Progress / Resume
```

The project currently has a public/learner experience and a super-admin Settings area used to manage users and learning master data.

A key product decision is that lessons are **not modeled as a fixed number of pages**. A creator keeps adding blocks as needed. Presentation/page grouping can be added later if useful, but it is not the fundamental content model.

The more free-form **sandbox/game lesson system is intentionally deferred to a later MVP**. MVP 1 focuses on reusable structured lesson blocks.

---

## 2. Repository / workspace shape

The workspace root is:

```text
Lingora/
├── docs/
├── lingora-api/
└── lingora-web/
```

The root itself is only the project workspace; the application code is split into API and Web projects.

### Main stack

**API**

- Bun
- TypeScript
- Elysia
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- Google authentication verification
- Supabase Storage for lesson media

**Web**

- React 19
- TypeScript
- Vite
- react-globe.gl
- topojson / world-atlas

---

## 3. Current project structure

### Root

```text
Lingora/
├── docs/
│   ├── google.txt
│   ├── lesson-block-mvp.md
│   ├── theme-modify-plan.md
│   ├── assets/                 # Lesson illustrations, prompts and upload/content snapshots
│   └── HANDOFF.md
│
├── lingora-api/
│   ├── .env.example
│   ├── AGENTS.md
│   ├── compose.yaml
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── scripts/
│   │   └── drizzle.sh
│   ├── drizzle/
│   │   ├── 0000_orange_human_cannonball.sql
│   │   ├── 0001_good_magma.sql
│   │   ├── 0002_wealthy_power_man.sql
│   │   ├── 0003_add-levels.sql
│   │   ├── 0004_slim_mandroid.sql
│   │   └── meta/
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   ├── index.ts
│       │   ├── schema.ts
│       │   ├── promote-super-admin.ts
│       │   ├── seed-globe.ts
│       │   ├── seed-levels.ts
│       │   └── seed-english-beginner-1.ts
│       └── modules/
│           ├── admin/
│           │   ├── routes.ts
│           │   └── lesson-builder-routes.ts
│           ├── auth/
│           │   ├── routes.ts
│           │   └── session.ts
│           ├── courses/routes.ts
│           ├── enrollments/routes.ts
│           ├── home/routes.ts
│           ├── languages/routes.ts
│           ├── lessons/
│           │   ├── routes.ts
│           │   └── block-contract.ts
│           ├── modules/routes.ts
│           ├── progress/routes.ts
│           └── users/routes.ts
│
└── lingora-web/
    ├── .env.example
    ├── AGENTS.md
    ├── package.json
    ├── vite.config.ts
    ├── public/
    │   └── assets/illustrations/landing/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── style.css
        ├── api/
        │   └── client.ts
        ├── components/
        │   └── BrandMark.tsx
        └── features/
            ├── auth/
            │   ├── google.ts
            │   ├── GoogleSignInButton.tsx
            │   └── ProfileCompletionModal.tsx
            ├── courses/index.ts
            ├── enrollments/index.ts
            ├── globe/
            │   ├── GlobeExplorer.tsx
            │   └── index.ts
            ├── landing/LandingPage.tsx
            ├── learning/LearningPage.tsx
            ├── languages/index.ts
            ├── lessons/
            │   ├── blocks.ts
            │   ├── index.ts
            │   ├── ReadingContent.tsx
            │   └── LessonPlayer.tsx
            ├── modules/index.ts
            ├── progress/index.ts
            ├── settings/
            │   ├── api.ts
            │   ├── SettingsPage.tsx
            │   ├── LessonBuilder.tsx
            │   ├── ReadingEditor.tsx
            │   └── lessonBuilderApi.ts
            ├── theme/
            │   ├── theme.ts
            │   └── ThemeToggle.tsx
            └── users/index.ts
```

---

## 4. Existing application behavior

### App-level navigation

`lingora-web/src/App.tsx` currently uses a simple hash-based view model:

```text
# empty      → Landing
#app         → Globe Explorer
#settings    → Super-admin Settings
```

Learner hash routes now include:

- `#courses` — searchable catalog and My learning;
- `#courses/:courseId` — course overview, module accordion, lesson status and course progress;
- `#courses/:courseId/lessons/:lessonId` — LessonPlayer with enrollment, resume, review, next lesson and return to course.

Globe Start learning links use course IDs and these hash routes. Learner links survive Google sign-in. Direct resource IDs are UUID-validated by the API.

Super-admin Settings is protected in the client based on the authenticated user's `isSuperAdmin` flag, with server-side authorization still required by admin APIs.

### Authentication

Authentication currently uses Google Sign-In.

The app supports:

- Google login
- server-backed sessions
- current-user lookup
- sign-out
- profile completion for missing display name
- super-admin access

---

## 5. Core database model

Current major tables in `lingora-api/src/db/schema.ts`:

```text
users
sessions

languages
countries
country_languages
levels

courses
modules
lessons
lesson_blocks

enrollments
learner_block_states
progress
```

Main content hierarchy:

```text
Language
  └── Course
        └── Module
              └── Lesson
                    └── Lesson Blocks
```

Learner hierarchy:

```text
User
  └── Enrollment (Course)
        ├── Lesson Progress
        └── Learner Block States
```

---

## 6. Important lesson architecture decision

The biggest architecture decision made in this phase is to separate three different concerns.

### A. Block Definition

This is what the lesson creator defines.

Examples:

- type
- content
- settings
- interaction rules
- completion rules

Stored in:

```text
lesson_blocks
```

### B. Learner Block State

This is what happened when a specific learner interacted with a specific block.

Examples:

- response
- attempts
- score
- completed
- startedAt
- completedAt

Stored in:

```text
learner_block_states
```

### C. Lesson Progress

This is the overall learner state for a lesson.

Examples:

- status
- percent
- currentBlockId
- startedAt
- completedAt

Stored in:

```text
progress
```

Relationship:

```text
Lesson Definition
      │
      ├── Block Definition
      │       │
      │       └── Learner Block State (many learners)
      │
      └── Lesson Progress (per learner/enrollment)
```

This separation is intentional and should remain a core architecture rule.

---

## 7. Block Contract MVP

Implemented in:

```text
lingora-api/src/modules/lessons/block-contract.ts
lingora-web/src/features/lessons/blocks.ts
```

Every block has:

```ts
{
  id,
  lessonId,
  type,
  version,
  content,
  settings,
  interaction,
  completion,
  sortOrder
}
```

### ID

The creator does **not** manually enter block IDs.

IDs are generated automatically by PostgreSQL/Drizzle using UUIDs.

The ID is infrastructure identity used by learner state, progress, analytics, etc.

### MVP block types

Currently implemented:

```text
reading
multiple_choice
image
audio
video
conversation
```

Potential future dedicated block types that were discussed but not yet implemented:

```text
vocabulary
fill_in_the_blank
matching
ordering
text / explanation (if needed separately from reading)
```

Sandbox/game blocks are deferred to a later MVP.

---

## 8. Block behavior in MVP

Interaction mode is currently fixed by block type to prevent unsupported creator configurations.

Current concept:

```text
Reading            → passive / viewed
Image              → passive / viewed
Audio              → activity / viewed
Video              → activity / viewed
Conversation       → activity / viewed
Multiple Choice    → answer
```

Completion options currently exposed only where learner runtime supports them.

Passive blocks:

```text
viewed
```

Multiple Choice:

```text
answered
correct
score
```

Do not expose arbitrary custom interaction/completion rules until the player runtime supports them.

---

## 9. Lesson Builder: implemented

Main files:

```text
lingora-api/src/modules/admin/lesson-builder-routes.ts
lingora-web/src/features/settings/LessonBuilder.tsx
lingora-web/src/features/settings/lessonBuilderApi.ts
```

Available in:

```text
Settings → Lesson builder
```

Current creator capabilities:

- choose an existing lesson;
- see the block count;
- add blocks without declaring page count;
- edit each block using a block-specific editor;
- save each block;
- reorder blocks;
- soft-delete blocks;
- media upload;
- media external URL;
- media preview;
- edit completion behavior supported by MVP.

### Reading

Supports:

- title
- body
- text size
- alignment
- plain text or Markdown format;
- Write / Preview / Split views;
- formatting toolbar, including bold, italic and underline;
- headings, lists, tables, links and images;
- allowed text colors: blue, purple, green, red and orange.

`ReadingEditor.tsx` and `ReadingContent.tsx` share the same rendering path for preview/player. Markdown uses GFM and line breaks; HTML is sanitized. Underline and color toolbar actions insert restricted HTML tags/classes. Keep the sanitizer and safe external-link behavior when changing presentation. Existing plain-text lessons remain supported.

### Existing lesson illustration assets

The workspace contains a Hello & Goodbye cover (`docs/assets/hello-goodbye-cover.png`) and three additional English Level 1 illustrations: people-around-me, food-and-drinks and places-in-town. Prompts, Supabase upload URLs and a content snapshot are under `docs/assets/english-level-1/`.

The Hello & Goodbye cover was observed at the top of its Reading content during the Chrome review. Asset/upload records are evidence of generated media, not proof that every current lesson has an image; inspect current content before making that claim or rewriting lesson media.

### Multiple Choice

Supports:

- question
- choices
- correct choice
- explanation
- shuffle choices
- show explanation
- completion rule

Server evaluates correctness.

### Image

Supports:

- uploaded or external image
- preview
- alt text
- caption
- fit

### Audio

Supports:

- uploaded or external audio
- preview
- title
- transcript
- autoplay
- controls

### Video

Supports:

- uploaded or external video
- preview
- title
- caption
- autoplay
- controls

### Conversation

Conversation is intentionally a dedicated block because creator UX benefits from structured editing.

Supports:

- conversation title
- variable number of participants
- participant names
- optional avatar URL
- variable conversation turns
- selecting speaker per turn
- text per turn
- chat/script layout
- show/hide speaker names

---

## 10. Media / Supabase Storage

Lesson media can use either:

```text
Upload file
    ↓
Supabase Storage
    ↓
Persistent URL
    ↓
Preview
```

or:

```text
External URL
    ↓
Preview
```

Current API environment:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=lesson-media

# Optional
SUPABASE_STORAGE_PUBLIC_URL=...
```

The secret key is backend-only.

Do **not** expose it through `VITE_` environment variables or frontend code.

The upload endpoint uses the Supabase secret key through the `apikey` header.

For the current MVP, the media bucket is expected to be public because lesson block definitions store persistent public URLs for image/audio/video playback.

---

## 11. Learner runtime: implemented as reusable layer

Main file:

```text
lingora-web/src/features/lessons/LessonPlayer.tsx
```

The player currently knows how to render all six MVP block types.

Supported runtime behavior:

- load lesson blocks;
- resume based on lesson progress;
- render Reading;
- render Image;
- render Audio;
- render Video;
- render Conversation;
- answer Multiple Choice;
- submit block response;
- update attempts;
- calculate score;
- update completion;
- synchronize lesson progress;
- continue to next block;
- display lesson completion state.

The player is connected to `features/learning/LearningPage.tsx`. Finished lessons can be reviewed without resubmitting passive blocks; completion shows the next lesson and a return to the course. Multiple Choice feedback remains visible until the learner explicitly finishes the last block.

---

## 12. Multiple Choice security behavior

Do not expose answer keys in learner-facing lesson payloads.

Current implementation:

- creator definition stores `correctChoiceId`;
- learner `GET /lessons/:id` removes `correctChoiceId`;
- explanation is also removed from the initial learner payload;
- server checks the learner response;
- explanation can be returned as feedback after successful completion.

This avoids trivially revealing the answer through browser network inspection.

---

## 13. Learner state / progress implementation

Main API:

```text
GET /api/v1/progress/lesson/:lessonId
PUT /api/v1/progress/lesson/:lessonId/blocks/:blockId
```

Each block submission can:

- increment attempts;
- store response;
- calculate score;
- calculate completion;
- store `startedAt`;
- store `completedAt`;
- synchronize overall lesson progress.

Lesson progress recalculates:

```text
status
percent
currentBlockId
startedAt
completedAt
```

---

## 14. Database migration status

The generated block migration exists:

```text
lingora-api/drizzle/0004_slim_mandroid.sql
```

It includes:

- `lesson_blocks`
- `learner_block_states`
- `progress.current_block_id`
- `progress.started_at`
- related foreign keys and index

The migration file is generated from Drizzle schema as intended.

Before relying on a fresh environment, verify the migration has actually been applied to the target database:

```sh
cd lingora-api
bun run db:migrate
```

Do not hand-write Drizzle migrations unless repository rules change.

---

## 15. Legacy lesson content

The existing column remains:

```text
lessons.content
```

It is intentionally kept temporarily for migration/backward compatibility.

New content should use:

```text
lesson_blocks
```

The legacy `content` field is read-only/non-creatable in the generic admin master-data editor to avoid having two competing authoring paths.

Eventually, after old content is migrated and no longer needed, this legacy field can be removed in a future migration.

---

## 16. Super-admin Settings

Main file:

```text
lingora-web/src/features/settings/SettingsPage.tsx
```

Current sections include:

- Users
- Languages
- Levels
- Countries
- Country languages
- Courses
- Modules
- Lessons
- Lesson builder
- Enrollments
- Progress

The page includes:

- admin guide / guided tour;
- inline master-data editing;
- reference autocomplete;
- create modal;
- save per row;
- save all;
- soft delete;
- super-admin management.

---

## 17. Latest UX change: Modules / Lessons accordion

Implemented in `SettingsPage.tsx`.

### Modules

Modules are grouped by Course:

```text
▸ Course A    4 modules    + Add
▸ Course B    6 modules    + Add
▸ Course C    0 modules    + Add
```

### Lessons

Lessons are grouped by Module:

```text
▸ Module A    5 lessons    + Add
▸ Module B    3 lessons    + Add
```

Behavior:

- all groups are collapsed by default;
- click group row to expand/collapse;
- `Expand all`;
- `Collapse all`;
- group header shows child count;
- group header shows unsaved draft count;
- collapsing does not discard drafts;
- `+ Add` on a group opens Create with parent preselected;
- new record expands its group automatically;
- moving a Module to another Course opens the destination group after save;
- moving a Lesson to another Module opens the destination group after save;
- responsive/mobile styling is included.

Other master-data screens remain flat tables.

---

## 18. Generic admin API

Main file:

```text
lingora-api/src/modules/admin/routes.ts
```

This is a generic super-admin master-data API driven by resource definitions.

It supports list/create/update/batch update/soft delete for resources such as languages, levels, countries, courses, modules, lessons, enrollments, and progress.

A TypeScript issue occurred with generic Drizzle insert inference:

```text
Type 'any[] | QueryResult<never>' must have a '[Symbol.iterator]()'
```

The create route was fixed by receiving the `.returning()` result first, casting to a row array, then reading `rows[0]` rather than directly destructuring the inferred union.

---

## 19. Current API routes

Mounted from `lingora-api/src/index.ts`.

Major route modules:

```text
auth
admin
admin lesson builder
home
users
languages
courses
modules
lessons
enrollments
progress
```

Lesson Builder admin endpoints:

```text
GET    /api/v1/admin/lesson-builder/lessons
GET    /api/v1/admin/lesson-builder/:lessonId
POST   /api/v1/admin/lesson-builder/:lessonId/blocks
PATCH  /api/v1/admin/lesson-builder/:lessonId/blocks/:blockId
POST   /api/v1/admin/lesson-builder/:lessonId/reorder
DELETE /api/v1/admin/lesson-builder/:lessonId/blocks/:blockId
POST   /api/v1/admin/lesson-builder/media/upload
```

Learner lesson/progress endpoints:

```text
GET /api/v1/lessons/:lessonId
GET /api/v1/progress/lesson/:lessonId
PUT /api/v1/progress/lesson/:lessonId/blocks/:blockId
```

---

## 20. Current scripts

### API

```sh
bun run dev
bun run start
bun run typecheck

bun run db:generate
bun run db:migrate
bun run db:push

bun run db:seed:globe
bun run db:seed:levels
bun run db:seed:english-beginner-1
bun run db:promote-super-admin
```

### Web

```sh
bun run dev
bun run typecheck
bun run build
bun run preview
```

The Lingora MCP currently reports no configured runnable tasks, so shell scripts/typecheck/build must be run in the user's local project environment rather than via MCP task execution.

---

## 21. What is considered done for this phase

### Product / architecture

- block-based lesson direction decided;
- fixed page-count requirement rejected;
- sandbox game deferred;
- Block Definition separated from learner runtime state;
- Learner Block State separated from Lesson Progress;
- DB-generated UUID strategy accepted;
- six core MVP block types selected;
- media upload + URL source strategy selected;
- Supabase Storage backend configuration selected.

### Backend

- lesson block schema;
- learner block state schema;
- progress extension;
- generated Drizzle migration;
- Block Contract;
- block validation;
- admin Lesson Builder routes;
- media upload route;
- learner lesson payload sanitization;
- server-side MC evaluation;
- block-state persistence;
- lesson-progress synchronization.

### Frontend / creator

- Lesson Builder UI;
- block-specific editors;
- media upload/URL preview;
- conversation editor;
- reorder/delete/save;
- master-data Lesson legacy content locked;
- Modules grouped/collapsed by Course;
- Lessons grouped/collapsed by Module.

### Frontend / learner foundation

- LessonPlayer component;
- renderers for all six blocks;
- MC submission;
- progress/resume logic.

### Frontend / presentation source pass

Implemented on 2026-10-03 from `docs/theme-modify-plan.md`:

- `lingora-web/src/style.css`
  - expanded semantic Light/Dark roles for elevated surfaces, stronger borders, focus/ring, warning, success/danger soft states, neutral/disabled states, and Reading colors;
  - strengthened shared focus, disabled and read-only presentation;
  - improved Settings/sidebar/table/input/modal hierarchy in both themes;
  - improved Lesson Builder selected lesson, editable fields, dirty/draft/published states and surface separation without changing builder behavior;
  - improved Landing/Globe search, secondary copy, controls, country card and disabled CTA hierarchy;
  - improved learner catalog tab selection, course progress visibility and lesson state styling;
  - mapped allowed Reading colors to theme-aware tokens and strengthened editor view/focus states.
- `lingora-web/src/features/settings/SettingsPage.tsx`
  - Content setup guide is collapsed by default;
  - added explicit Open/Hide guide disclosure while preserving Start guided tour;
  - disclosure state is presentation-only and does not alter master-data drafts or API behavior.
- `lingora-web/src/features/learning/LearningPage.tsx`
  - lesson rows now expose `is-completed`, `is-in-progress`, and `is-not-started` presentational classes;
  - learner status meaning remains derived from the existing progress payload; no progress logic changed.

This source pass is complete enough for visual validation, but the theme milestone is **not fully verified yet**. Local Web typecheck/build plus rendered Light/Dark/Auto desktop/mobile/state checks are still required before closing T8.

---

## 22. Implementation status and remaining gaps

The following should not be assumed complete.

### A–C. Learner flow — now implemented (2026-10-03)

The catalog, Course → Module → Lesson navigation, self enrollment, LessonPlayer, resume, completion, review and course progress are connected.

Implementation:

- `lingora-web/src/features/learning/LearningPage.tsx`
- `POST /api/v1/enrollments/` (signed-in user only; body `{ courseId }`)
- `GET /api/v1/courses/:id/outline` (ordered modules/lessons with current user's enrollment and progress)

Enrollment uses the existing user/course unique index to avoid duplicate enrollment, and can reactivate a soft-deleted/inactive enrollment while preserving existing learning data. Course completion is derived from completed published lessons. Block submissions serialize per enrollment inside a database transaction, keeping block state, lesson progress and enrollment completion together.

Ordinary users/public APIs see only published courses and lessons with undeleted parents. Super-admins can try drafts with an explicit Admin preview message; this does not publish content. Course APIs, lesson APIs, module APIs and progress access enforce parent availability. Legacy `lessons.content` is removed from learner payloads; block MC keys remain stripped.

### D. Publish/version workflow

Lessons and courses have publish flags, but there is not yet a robust draft/publish/version/snapshot model for block content.

Lesson and course publish flags are separate: a lesson can be marked published while its course remains a draft. Ordinary learner access still requires the published course and published lesson with available parents. Linking a country to a language alone does not enable Globe Start learning: the globe endpoint attaches an undeleted, published course for that language. Country availability and course readiness are separate signals; do not interpret the disabled "Course setup pending" action as a theme-only issue.

Do not over-engineer this until product behavior is decided.

### E. Block schema migration/version handling

Blocks have `version`, but there is no block-version migration framework yet.

### F. More exercise block types

Not yet implemented:

- Vocabulary
- Fill in the Blank
- Matching
- Ordering
- richer speaking/listening activities
- sandbox/game blocks

### G. Analytics

The state model is suitable for analytics, but there is no finished analytics UI/pipeline.

### H. Media lifecycle

Uploads work for MVP, but future work may include:

- delete unused Supabase files;
- private buckets / signed URLs if desired;
- upload progress;
- larger-file strategy;
- thumbnail generation;
- transcoding;
- file metadata table.

### I. Legacy cleanup

Eventually remove:

- `lessons.content` after migration;
- legacy `courses.level` after all data is backfilled to `levelId`.

---

## 23. Recommended next milestone

Validate and refine the implemented presentation pass in [theme-modify-plan.md](theme-modify-plan.md). Run Web typecheck/build locally, then review Light/Dark/Auto on desktop and mobile across Landing, Globe, learner flow, Reading and all Settings states. Fix any rendered contrast/state exceptions without changing the blue–purple brand, theme preference behavior or learner/admin business logic. Continue content/practice validation as a separate milestone; draft authoring remains supported by the admin preview. Later priorities remain interactive exercises, publish/version behavior and richer learning activities.

Validation performed on 2026-10-03:

- API typecheck and Web build;
- read-only learner API access integration tests (`bun test tests/learner-access.test.ts`);
- Chrome smoke test: catalog → outline (8 modules / 32 lessons) → Hello & Goodbye → finish → course progress (1 completed / 3%) → refresh/resume/review → next lesson → My Name Is… completion at mobile viewport 390 × 844. Current account has two completed lessons from this smoke test.

The API integration tests read the configured DB and do not create sessions or test data. The Chrome smoke test uses the current signed-in user's real enrollment/progress.

## 24. Product questions to revisit after Learning Flow

After the full learning loop works, revisit these in order:

1. **Settings per block type**
   - Which creator controls are genuinely useful?
   - Avoid generic settings that runtime does not honor.

2. **Interaction per block type**
   - Today interaction is mostly fixed.
   - Define richer learner behaviors only when implementing their runtime.

3. **Completion per block type**
   - Define semantics carefully for audio/video/conversation/new exercises.

4. **Vocabulary dedicated block**
   - Likely useful because it can combine word, translation, example, image, audio, pronunciation, and part of speech in one creator workflow.

5. **New exercise types**
   - Fill blank
   - Matching
   - Ordering

6. **Publishing/versioning**
   - Decide whether published lessons are snapshots.
   - Decide whether block identity persists across revisions.

7. **Sandbox/game MVP**
   - Keep separate from the first structured-block MVP.

---

## 25. Architecture principles to preserve

These principles were explicitly chosen during design and should not be changed casually.

### Principle 1: Do not mix creator definition with learner state

Bad:

```text
block {
  content
  correctAnswer
  learnerAnswer
  attempts
  completed
}
```

Preferred:

```text
Block Definition
  ├── content
  ├── settings
  ├── interaction
  └── completion

Learner Block State
  ├── response
  ├── attempts
  ├── score
  └── completed
```

### Principle 2: One block supports many learners

Do not duplicate lesson blocks per learner.

Use:

```text
Block
 ├── Learner A state
 ├── Learner B state
 └── Learner C state
```

### Principle 3: Block ID is infrastructure identity

Creator does not manage IDs.

Do not encode order or type inside the ID.

Reordering must not change block identity.

### Principle 4: Type-specific authoring UX is preferred

Avoid forcing creators to write generic JSON.

Conversation is the clearest example: dedicated participant/turn editing is better than generic content fields.

### Principle 5: Runtime support must match creator options

Do not expose a setting, interaction mode, or completion rule merely because it can be stored in JSON.

If the LessonPlayer does not implement it, do not offer it in the creator UI.

### Principle 6: Lesson length is organic

Do not require a creator to choose number of pages/screens in advance.

Blocks are the content model.

---

## 26. Environment notes

### API example

See:

```text
lingora-api/.env.example
```

Important lesson media values:

```env
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_STORAGE_BUCKET=lesson-media
```

Keep the Supabase secret key on the server only.

### Web

See:

```text
lingora-web/.env.example
```

The web app uses `VITE_API_BASE_URL` through the shared API client.

---

## 27. Validation checklist for the next developer/agent

Before adding major features, run:

### API

```sh
cd lingora-api
bun run typecheck
bun run db:migrate
```

### Web

```sh
cd lingora-web
bun run typecheck
bun run build
```

Then smoke-test:

1. sign in;
2. open super-admin Settings;
3. open Modules and Lessons and verify collapsed grouping;
4. open Lesson Builder;
5. create Reading;
6. create Multiple Choice;
7. upload image/audio/video to Supabase;
8. create Conversation;
9. reorder blocks;
10. refresh and verify persistence;
11. verify learner lesson API does not expose MC answer key.

---

## 28. Immediate continuation recommendation

The content builder, learner learning loop and follow-up theme/UX fixes are implemented. Build and targeted Chrome checks pass; see section 30. Continue the remaining validation in [theme-modify-plan.md](theme-modify-plan.md): measured contrast, broader mobile/state coverage, tour/auth states and exercise/media fixtures. Preserve the existing Block Definition / Learner Block State / Lesson Progress separation and do not modify actual course/lesson/progress data just to validate colors.

---

## 29. Theme review and planned improvements (2026-10-03)

### Review scope and findings

Reviewed in the user's Chrome on desktop, in both Light and Dark: Landing hero/features, Globe search/country card, All courses/My learning, course outline, Hello & Goodbye Reading from cover to Finish lesson, and all 11 Settings sections.

- Main headings, primary CTAs and the Reading body are generally clear in both themes.
- Light: secondary copy, placeholders and table borders are often too faint; selected catalog tabs can look disabled.
- Dark: Settings/Builder backgrounds, cards and inputs use nearby navy shades, weakening hierarchy.
- Course outline: completed and unstarted states share the accent color; progress is visually weak.
- Settings: the large Content setup guide competes with the actual table and pushes work below the fold.
- Reading: existing text is legible, but headings/dialogue/explanations need stronger hierarchy. CSS cannot infer semantic headings from stored plain text; any lesson restructuring is separate authoring work.

This was a qualitative review, not a measured contrast certification. This review did not cover mobile, every modal/auth state, all 32 lesson contents, or every exercise feedback/media state. The earlier learner mobile smoke test in section 23 is separate evidence.

### Implementation entry points

- `lingora-web/src/style.css` — existing Light/Dark tokens plus legacy hardcoded colors and later overrides; adjusting tokens alone will not reach every component.
- `lingora-web/src/features/theme/theme.ts` and `ThemeToggle.tsx` — preserve Light/Auto/Dark, localStorage and system preference behavior.
- `SettingsPage.tsx`, `LessonBuilder.tsx`, `ReadingEditor.tsx` — admin hierarchy and controls.
- `features/learning/LearningPage.tsx` — catalog selection, progress and presentational lesson status classes.
- `features/lessons/ReadingContent.tsx` / `LessonPlayer.tsx` — shared reading styles and feedback; preserve sanitization.

### Plan and verification status

The plan specifies priorities, semantic token roles, task dependencies, contrast targets, desktop/mobile/state checks and behavior regression checks. The main source work is now implemented:

- semantic Light/Dark tokens were expanded for elevated surfaces, focus, warning/success/danger soft states, disabled states and Reading colors;
- shared controls, Settings tables/modals, Builder fields/states, Landing/Globe search/card surfaces and learner catalog/outline states were moved toward semantic roles;
- the Settings guide is collapsed by default and remains expandable with the guided tour available;
- `LearningPage.tsx` now exposes completed / in-progress / not-started lesson classes and the course progress presentation is stronger;
- Reading preview/player colors use theme-aware tokens without changing the sanitizer or Markdown/plain-text behavior.

The initial source pass had only a structural CSS check because its MCP session lacked runnable tasks/browser access. That limitation is superseded by the local build and targeted Chrome verification in section 30; the full validation gate remains partial.

Documentation precedence for current navigation: this handoff reflects the implemented learner routes. `lesson-block-mvp.md` still contains an older sentence saying full course/lesson navigation is not wired; that sentence is historical and superseded by sections 4, 11 and 22 here. Its Reading renderer/security contract remains applicable.

The earlier Chrome review is qualitative before-state evidence. Follow-up results below include rendered after-state checks, but not saved matched before/after artifacts or measured contrast certification. No API/DB migration, media upload, secret access, Git action or deployment was performed for this theme milestone.

---

## 30. Follow-up UX fixes and verification (2026-10-03)

Implemented after the second visual review and the user's approval to fix:

- Settings create/confirmation dialogs use `SettingsDialog.tsx` and native modal dialogs: background inertness, initial focus, Tab/Shift+Tab containment, Escape dismissal and focus restoration. Reference autocomplete renders its portal inside the dialog; Escape closes its options before closing the form.
- Globe legend is anchored inside the map, away from the country card. Desktop map height fits the viewport; country CTA stays visible. Responsive grid tracks/children can shrink, fixing clipped mobile headings/search.
- Catalog/outline hero spacing is reduced. My learning reads enrolled course outlines to show actual completion, progress and next lesson, with loading/failure fallback. This currently makes one read-only outline request per enrolled course; consider an aggregate endpoint if enrollment volume grows.
- Outline emphasizes Start/Up next, while completed rows have a green completion icon and neutral Review action.
- Builder has lesson search and hide/show list, a compact guide/header, collapsed Add a block palette for existing lessons, collapsed Behavior & completion, and a sticky header containing Save block. UUID/contract metadata is removed from the primary authoring surface.
- Reading source auto-grows and resizes when its width changes; preview uses page scrolling. Covers retain aspect ratio, and lists/quotes/scenarios have clearer spacing. Review mode says Review · Completed lesson, Finish review and Review complete; the completed passive-block review path remains local.
- ThemeToggle taps now apply the option captured on pointer-down; pointer capture previously retargeted the click to its container. Dragging and keyboard button activation remain supported.

Verification:

- `rtk bun run build` in `lingora-web` passes TypeScript and production bundling. Vite still warns about the existing >500 kB JavaScript chunk.
- User's Chrome, desktop approximately 1470 × 870 CSS viewport: Light/Dark Globe card and legend, catalog/My learning, outline, Reading and Builder. My learning displayed real data: 2 of 32 lessons completed, 6%, next How Are You?. Completed Hello & Goodbye review showed Finish review → Review complete without submitting progress.
- Dark New Language dialog: initial input focus, Tab/Shift+Tab wrap, Escape and return to Create. Mobile Light New Lesson dialog: reference list visible above the form, first Escape closed the list, second closed the dialog and restored focus. No form was submitted.
- Chrome device emulation 390 × 844: Light/Dark Builder, search empty state, hide list, collapsed/open block palette and wrapping editor actions; Light modal; Dark/Auto Globe heading/search and complete country card/CTA. Theme taps to Light/Dark/Auto and dragging Dark → Light worked. Browser was returned to desktop/Auto with test DevTools closed.
- No lesson/content/enrollment/progress writes, secret access, Git operations or deployment during this follow-up. Existing lesson content was inspected, not rewritten.

Remaining validation: measured rendered contrast; matched saved before/after images; every mobile Settings section, auth/tour/popover state, all exercise feedback/media fixtures and all Reading formatting combinations. Plain numbered scenario headings/dialogues in stored Reading still require separate semantic Markdown authoring if stronger content structure is desired.
