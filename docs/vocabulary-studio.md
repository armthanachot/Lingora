# Explore Vocab

Vocabulary pages belong to a learning language, independently of courses and countries. Each page stores a background, title, category, translation language, and ordered vocabulary objects. The initial collection contains ten English–Thai scenes with six words and example sentences per scene.

## Learner entry

Select an active country on the globe, then choose **Explore vocab** beside **Start learning**. Pages can be filtered by category and searched by scene title. Within a scene, search English words, translations or descriptions; click an object, number or list item to select the same vocabulary entry. Read aloud uses the learning language through browser speech synthesis. Zoom controls support smaller screens.

Superadmins also see **Edit vocabulary** on the scene they are reading. Edit mode supports dragging objects and numbers, resizing objects, precise numeric placement, changing the scene/list headings, and editing the selected word, translation and example. **Save changes** persists through the same admin API and revision checks used by Settings; **Cancel edits** returns to the saved scene. Unsaved edits require confirmation before changing scenes, opening Settings or signing out, and browser reload/close receives an unload warning. During a save, navigation and editing are blocked. **Reload page** retrieves the latest saved version after a concurrent-edit conflict. Learners retain the normal interactive reader without edit controls.

## Admin workflow

1. Open **Settings → Vocabulary → New scene**.
2. Set the learning language, translation code, title, slug, category and vocabulary heading.
3. Upload the background. Its aspect ratio is detected from the image.
4. Upload individual transparent PNG/WebP objects. The same asset appears on the scene and in the word list.
5. Drag each object to place it; select it and drag ↔ to resize or ↻ to rotate freely through 360 degrees without snapping. Rotation ° accepts fractional angles. The rotate handle also supports left/right arrow keys (1°) or Shift + arrow (0.1°). Numbers follow object movement and can also be dragged separately; they remain upright during rotation. Numeric position and size controls are available. These rotation controls are also available in the inline reader editor, and gallery previews reflect saved rotation.
6. Enter the word, translation and description or example sentence.
7. Drag word handles to change order; displayed numbers update automatically. **Number only** mode supports an object already present in the background, using an uploaded thumbnail in the list.
8. Preview, choose Draft or Published, and save. Published pages appear in Explore Vocab.

Page order can be dragged within each language after saving edits. Writes use revision checks to prevent concurrent admins from overwriting each other. Reload library retrieves the latest version after a conflict. Scene removal is a soft delete.

## Setup and assets

Run through RTK from `lingora-api`:

```sh
rtk bun run db:migrate
rtk bun run db:migrate:vocabulary-assets
rtk bun run db:seed:vocabulary
```

Schema migrations are generated from the Drizzle schema. Moving images requires no schema change: `db:migrate:vocabulary-assets` is a data migration using the API environment's Supabase storage configuration. It uploads illustrations to the existing public bucket under `vocabulary/`, verifies every public response against the original SHA-256 checksum, and then replaces matching local URLs in a database transaction. It increments page revisions so open admin drafts cannot overwrite the migrated data. Custom image URLs and other page fields are preserved. Content-addressed filenames make repeated runs safe without overwriting objects.

The script also updates `docs/vocabulary-pages.json` and writes `docs/vocabulary-storage.json` with public URLs, checksums and source filenames. The seed checks image availability and preserves existing admin edits when rerun. Built-in imagegen creates the illustrations; prompt records are in `docs/vocabulary-image-prompts.json`. Original illustrations are retained in `docs/vocabulary-assets/` for backup and repeatable uploads; the web application loads images from Supabase rather than bundling these originals.

Uploads use the existing Supabase media storage configuration in the API environment. Speech availability and voices depend on the browser/operating system. There is no translation or paid speech API dependency in this feature.

## Verification

API integration tests exercise anonymous/learner/admin access, draft visibility, publication, stale revisions, input validation and soft deletion in a transaction that is rolled back. Geometry tests verify number tracking, independent marker movement, resize proportions and coordinate limits. Web build/typecheck and existing web tests are also run.

### Current verification — 2026-10-08

- Database readback: 10 English pages, all published, 60 vocabulary entries.
- Asset audit: 10 backgrounds and 60 object PNGs; every object has an RGBA alpha range of 0–255. Object illustrations were visually checked against their words.
- Web: 14 tests passed, including all ten scenes using matching assets and numbers in the scene and bilingual list; production build passed. Vite reports the existing large application chunk warning.
- API: typecheck passed; vocabulary lifecycle integration test and two URL/error contract tests passed. Reorder conflict tests prove transaction rollback, and inactive-language pages are hidden from learners.
- Chrome admin: Settings → Vocabulary and Bedroom preview inspected; numeric placement edits saved and confirmed in the database. Pointer dragging moved the object and its number together, independent number dragging left the object in place, and the resize handle changed object size. Reload restored the saved page after these temporary edits.
- Chrome uploads: a temporary new-scene draft accepted a background, detected its aspect ratio, and accepted a generated transparent object image. The object appeared in both scene and vocabulary list. The unsaved draft was discarded with the user's authorization.
- Chrome learner: globe country card showed Explore vocab beside Start learning. The English gallery loaded all ten published scenes; scene search found Airport and the Travel category showed only Airport. Searching the Thai translation selected the passport match; object and word-list selection displayed the corresponding description. Read aloud produced Chrome's audio-playing indicator, and zoom enlarged the scene.
- Responsive verification: Airport inspected at 390 × 844 in Chrome device mode. Scene, controls and selected-word details fit the viewport; the vocabulary list used one column and all six items remained accessible. Device mode and DevTools were closed after verification, leaving the ten-scene English gallery open.
- Final readback confirmed exactly ten active, published English pages with six words each. Final web tests (14), API vocabulary tests (3), web production build and API typecheck passed. Database integration checks run in a rolled-back transaction.

### Supabase storage migration — 2026-10-08

- Used the existing public `lesson-media` bucket in project `paovbldfnyaudjmhnpoh`; objects are under `vocabulary/`. No bucket permission or schema changes were needed.
- Uploaded and fetched all 70 images. Every public response matched the original SHA-256 checksum; transparent PNG bytes were preserved.
- Data migration updated all ten pages. Final DB audit found 70 Supabase image URLs and zero local image URLs; all ten pages remain published. The updated seed ran successfully with zero new pages and zero missing assets.
- Original images moved out of the web public directory to `docs/vocabulary-assets/`. The production build contains none of the vocabulary source PNGs. Manifest checksums and all 70 seed URLs were checked against these backups.
- Chrome reloaded Café after migration and displayed its background and object images; selecting coffee showed its translation and example. Web tests (14), API vocabulary tests (3), web build and API typecheck passed after the change.

### Inline editing — 2026-10-08

- Chrome superadmin session showed Edit vocabulary on Café. Pointer dragging moved coffee and its number together; Save changes persisted the new coordinates and incremented the revision, confirmed by DB readback. Original coordinates were then restored through the inline editor and confirmed in DB.
- A temporary word edit appeared in both scene and word list. Navigating to Bedroom prompted before discarding; cancelling navigation retained the Café draft and URL. Cancel edits restored the original word without saving the temporary edit.
- Web tests (14) and the production build/typecheck passed. Backend authorization and stale-save handling reuse the previously verified admin API.

### Object rotation — 2026-10-08

- Rotation is an optional number in the existing items JSON; old objects render at 0°. Drizzle generation confirmed no SQL schema changes are required.
- Geometry tests cover fractional unsnapped angles, clockwise/counterclockwise movement and wrapping through 360°. Scene tests check arbitrary rotation rendering and edit-only handles. API integration tests preserve 37.25° on save/read and reject out-of-range angles.
- Chrome's inline Rotation ° control saved 37.25° and DB readback confirmed that exact value. The test angle was reset to 0° afterwards, preserving the current positions and sizes. Web tests (16), API vocabulary tests (3), web build and API typecheck passed.

## Reader navigation and preload — 2026-10-09

- Previous/next controls follow the published scene order within the current language and category. The first/last scene has no previous/next control respectively; navigation does not wrap into another category. The existing scene links remain available.
- When changing scenes, keep the current scene visible until the destination data, background and object images are ready. Shrink/fade the old page out for 140 ms, then bring the new page in for 220 ms. Respect the browser's reduced-motion preference. Superseded navigation cannot replace the latest selected destination.
- After a scene is ready, wait 200 ms and preload exactly its next scene, including data and all images. Image loading runs at most three requests concurrently. Prefetch completion does not recursively load further scenes; leaving a page stops its queued image work. Failed background prefetches do not interrupt reading and can retry when visited.
- Share cached data, images and in-flight requests between navigation and prefetch. Scene and library data use an in-memory cache with a five-minute freshness period; expired data refreshes on the next access. Reloading the browser or signing out clears the data cache. Images retain browser HTTP caching independently. Revisiting fresh pages avoids repeated API requests.
- Admin saves update a cached page and invalidate library metadata; newly created scenes or language changes refetch joined language metadata for the correct speech voice. Reorder/delete invalidate affected pages. Revision checks still protect concurrent edits, and Reload page forces a fresh request. Older in-flight responses cannot overwrite newer saves or forced reloads.

### Verification

- Web tests: 23 passed (547 assertions), including request/image deduplication, category boundaries, exactly one prefetch without cascading, expiry, retry, cancellation, save invalidation, joined language metadata and forced-refresh races. Production build and typecheck passed; the existing Vite large-chunk warning remains.
- Chrome localhost: navigated Kitchen → Bathroom → Kitchen and Bedroom → Kitchen → Bathroom using the new controls. First/last controls respected category boundaries; scene images loaded successfully. Computed transition CSS confirmed `vocab-page-in` with reduced motion disabled.
- Browser resource timing was cleared before Bedroom → Kitchen → Bathroom: only the previously uncached Bedroom detail request occurred. Kitchen and Bathroom were reused without repeated detail or library requests. DevTools was closed afterwards, leaving Bathroom open.
