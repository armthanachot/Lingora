# English Foundations 1–4

Single SQL artifact: ../english-foundations-seed.sql.

| Course | Scope | Modules | Lessons | Builder blocks |
|---|---|---:|---:|---:|
| 1 — เริ่มสร้างประโยคภาษาอังกฤษ | M01–M10 | 10 | 65 | 328 |
| 2 — ขยายประโยคและบอกข้อมูล | M11–M18 | 8 | 55 | 278 |
| 3 — เล่าเหตุการณ์และใช้เวลาให้ถูก | M19–M27 | 9 | 62 | 313 |
| 4 — เชื่อมความคิดและสื่อสารเป็นเรื่องราว | M28–M36 | 9 | 54 | 280 |
| Total | | 36 | 236 | 1,199 |

The 236 lessons include 198 content/final-assessment lessons, 35 module checkpoints and three course capstones. Builder blocks contain 472 Reading/production blocks, 198 audio blocks and 529 multiple-choice questions with explanations.

The SQL requires existing English and Beginner 1/2, Elementary 1/2 records and creates published content without schema changes. Repeated execution preserves existing target rows, except three original production examples are corrected only when their entire original content still matches. Later user edits are preserved. The original situational course is untouched.

40 teaching images are used at 103 positions in 95 lessons. The 198 audio clips use synthetic English macOS voices. Supabase media URLs are publicly verified. Speaking and writing use learner/teacher assessment; the app automatically checks multiple-choice answers. Course completion is not a CEFR certification.

## Authoring and verification

- content-1.mjs through content-4.mjs: authored explanations, examples, questions and tasks.
- build-seed.mjs: compile curriculum and verified Chrome bodies to compiled.json and the SQL file.
- verified-ui-decorations.json: bodies saved through Chrome and matched by a read-only DB query. Base hashes protect authored text against accidental drift.
- final-content-corrections.json: preserved original content for the three guarded production-example corrections. Already prepared; do not regenerate this manifest.
- ui-save-proof.json, decoration-audit.json, visual-qa.md: image save and preview evidence.
- execute-seed.mjs: loads API .env privately, supports --dry-run, --execute and --verify, appends execution-report.json.
- audit-database.mjs: compares metadata and every block JSON with compiled.json.
- validate-seed.ts: checks the real normalizeBlockDefinition application contract.

From the repository root:

```sh
rtk proxy node docs/english-foundations/build-seed.mjs
rtk proxy bun docs/english-foundations/validate-seed.ts
rtk proxy node docs/english-foundations/audit-database.mjs
```

DB checks need network access. Audio/image authoring and uploads are already completed; no regeneration is needed for a seed retry. See WORK-STATUS.md and completion-report.json for final results.
