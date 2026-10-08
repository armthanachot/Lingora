# Agent rules

- Run every shell command through RTK first (for example, `rtk bun test` or `rtk proxy <command>`).
- Do not run any Git command unless the user explicitly asks for that Git action.
- Change database structure only in the Drizzle schema (`src/db/schema.ts` in the API package). Never write or edit SQL migration files by hand.
- Read relevant files before editing, and run the affected typecheck or build through RTK after changes.
