# lingora-api

Elysia API for Lingora with PostgreSQL, Drizzle, Google Sign-In, server-side sessions, super-admin settings, and the country/language globe catalog.

1. Run `rtk bun install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `GOOGLE_CLIENT_ID`.
3. For local PostgreSQL, run `rtk docker compose up -d db` from this folder, or use an existing PostgreSQL server.
4. Generate a migration with `rtk bun run db:generate -- <migration-name>` and apply it with `rtk bun run db:migrate`.
5. Optionally seed the interactive-globe demo catalog with `rtk bun run db:seed:globe`.
6. Run `rtk bun run dev`.

See `../docs/google.txt` for Google Auth Platform setup.

## Database migrations

The migration helper lives at `scripts/drizzle.sh` and uses `drizzle.config.ts`, which reads the schema from `src/db/schema.ts`, writes generated migrations to `./drizzle`, and connects using `DATABASE_URL` from `.env`.

```sh
sh scripts/drizzle.sh generate add-auth-sessions
sh scripts/drizzle.sh migrate
```

The same commands are exposed through Bun:

```sh
rtk bun run db:generate -- add-auth-sessions
rtk bun run db:migrate
```

Use `generate` + `migrate` as the normal schema-change workflow. `db:push` remains available only for disposable/prototyping databases.

## Authentication and sessions

- `POST /api/v1/auth/google` verifies the Google ID token, creates/updates the Lingora user, creates a server-side session, and sets the `lingora_session` HttpOnly cookie.
- `GET /api/v1/auth/me` restores the current signed-in user from the session cookie.
- `PATCH /api/v1/auth/profile` updates the signed-in user's Lingora display name.
- `POST /api/v1/auth/signout` removes the current session and expires the cookie.
- Sessions expire after 30 days and only the token hash is stored in PostgreSQL.
- CORS is configured with credentials enabled so `lingora-web` can send the HttpOnly session cookie to the API.

New Google users are created with `display_name = NULL`. The web UI blocks the signed-in experience with a profile-completion modal until the user chooses a display name.

## Super admin

`users.is_super_admin` defaults to `false`. The Settings UI and administrative APIs require this flag.

To bootstrap the first super admin, sign in once so the user row exists, then run:

```sh
rtk bun run db:promote-super-admin -- you@example.com
```

Super-admin user management currently allows only:
- editing `displayName`
- toggling `isSuperAdmin`

Administrative user endpoints:
- `GET /api/v1/users/`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`

All require an authenticated super-admin session.

## Settings master-data API

`GET /api/v1/admin/master/:resource` requires a super-admin session and supports these resources:
- `languages`
- `countries`
- `country-languages`
- `courses`
- `modules`
- `lessons`
- `enrollments`
- `progress`

The Settings web UI exposes each resource as a separate menu with create, inline update, per-row save, transactional save-all, and soft delete. The API exposes:
- `GET /api/v1/admin/master/:resource` — active rows plus field metadata
- `POST /api/v1/admin/master/:resource` — create
- `PATCH /api/v1/admin/master/:resource/:id` — update one row
- `PATCH /api/v1/admin/master/:resource/batch` — update multiple rows in one transaction
- `DELETE /api/v1/admin/master/:resource/:id` — soft delete

All master-data tables have a nullable `deleted_at`. Soft-deleted rows are excluded from the Settings list and from normal application read APIs. Primary keys, `createdAt`, `updatedAt`, `deletedAt`, and other automatic date fields are read-only in the inline editor.

## Other endpoints

- `GET /health`
- `GET /api/v1/home/globe`
- `GET /api/v1/languages/` and `GET /api/v1/languages/:id`
- `GET /api/v1/courses/` and `GET /api/v1/courses/:id`
- `GET /api/v1/modules/` and `GET /api/v1/modules/:id`
- `GET /api/v1/lessons/` and `GET /api/v1/lessons/:id`
- `GET /api/v1/enrollments/` and `GET /api/v1/enrollments/:id` are session-scoped to the current user; a super admin may retrieve an enrollment by ID.
- `GET /api/v1/progress/` and `GET /api/v1/progress/:id` are session-scoped to the current user; a super admin may retrieve progress by ID.
