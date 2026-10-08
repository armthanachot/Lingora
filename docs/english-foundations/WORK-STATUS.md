# English Foundations implementation status

Completed 2026-10-04. The user authorized four new courses, one SQL file under docs, execution with the API .env, and image decoration through the user’s Chrome at localhost:5173.

## Delivered and verified

- Single SQL: docs/english-foundations-seed.sql. Four courses, 36 modules, 236 lessons and 1,199 blocks. Data seed only; no DDL.
- Initial seed execution and final execution both committed. Final dry run rolled back with unchanged row counts. The final retry created no duplicate rows. execution-report.json preserves the history.
- Authored content includes Thai explanations, bilingual worked examples, 529 multiple-choice questions with explanations, and self/teacher-assessed production tasks. There are 198 content/final-assessment lessons, 35 module checkpoints and three course capstones.
- 198 synthetic English audio clips were generated, checked for nonempty nonsilent PCM, uploaded and publicly verified.
- 40 teaching images were uploaded: four generated with built-in image_gen and 36 native grammar diagrams rendered as PNG. Prompts, PNG/SVG sources and media URLs are preserved under docs/assets/english-foundations.
- All 95 planned Reading blocks were decorated and saved through the user’s Chrome, with 103 image placements. Disabled Save block buttons and image previews were observed. Read-only DB verification matched all 95 bodies exactly.
- Previews were visually inspected across all four courses: transparent pantry, park activities, three-panel story and grammar map. See visual-qa.md.
- Final QA improved three production examples. The final SQL applied these corrections only when the entire original content still matched, preserving later user edits. These were text corrections through authorized SQL; image decoration was completed through Chrome.
- build-seed.mjs incorporates verified Chrome bodies into the SQL artifact. The actual application block contract passes for all 1,199 blocks. Final database-audit.json reports no mismatches across target metadata and every block JSON.

## Reproduction

- content-1.mjs through content-4.mjs hold authored sources.
- verified-ui-decorations.json holds image bodies saved through Chrome and checked in DB. Base-body hashes protect against accidental source drift.
- final-content-corrections.json holds original-content guards for three reviewed production fixes. It is already prepared; do not recreate it against the corrected DB.
- build-seed.mjs compiles compiled.json and the single SQL file. Repeated execution preserves existing rows; three original-model corrections are guarded by exact content equality.
- execute-seed.mjs uses API .env without printing secrets, supports --dry-run/--execute/--verify, and appends reports.
- audit-database.mjs is read-only. validate-seed.ts uses normalizeBlockDefinition from the application.
- Media authoring/upload is complete; regeneration is unnecessary for a seed retry.

The original situational course remains unchanged. No Git actions or app/schema changes were made. All shell commands used RTK. The Mac locking again after completed image decoration did not leave any required work pending.
