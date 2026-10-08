# Chrome preview checks

Observed in the user's Google Chrome at http://localhost:5173/#settings, Settings → Lesson builder. Reading Preview uses the application's shared Markdown renderer.

| Course | Lesson | Observed result |
|---|---|---|
| 1 | 03.05 · นับชิ้นกับนับปริมาณ | Transparent pantry cutout renders against the dark reading background. Three apples, two bottles, rice bowl, loaf with two slices and milk glass match the caption. Full image and caption fit the preview width. |
| 2 | 17.01 · am/is/are + ing | Park image renders with four people performing the captioned activities and one sleeping dog. English caption and Thai production prompt remain readable below the image. |
| 3 | 21.03 · when/while | Three-panel story renders in order with consistent Mai/Ben characters. Walking, rain and cafe arrival support the Past Simple/Past Continuous caption. No crop or horizontal overflow. |
| 4 | 36.01 · เลือกและอธิบายโครงสร้าง | M36 map renders at full preview width. English labels, Thai explanations and the three cards fit within the image and remain readable. |

Every one of the 95 decorated Reading blocks was edited and saved through Chrome. A disabled Save block button and an image accessibility node were observed after each save. A separate read-only DB comparison confirms all 95 bodies match the prepared content exactly, including all 103 image placements. See ui-save-proof.json and decoration-audit.json.

Native audio controls also displayed a loaded duration in the lesson builder. The complete 198-clip manifest has public URL verification and local nonempty, nonsilent PCM checks.

Final content QA additionally found three small production-example improvements: explicit four-line dialogue in 18.FINAL, an 87-word story plus three follow-up questions in 27.FINAL, and a 61-word message in 35.CP. The authoring and single SQL were updated. Authorized SQL execution applied these three text corrections with exact-original-content guards. The final read-only audit verifies all corrected content; image decoration was already completed through Chrome.
