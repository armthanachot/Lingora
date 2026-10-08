# Theme modification plan

วันที่: 2026-10-03  
สถานะ: **Implementation applied to source; visual/build validation pending**  
อ้างอิงสถานะโครงการ: [HANDOFF.md](HANDOFF.md)

## 1. เป้าหมาย

ทำให้ Lingora อ่านง่ายและแยกพื้นที่ทำงานได้ชัดใน Light และ Dark theme โดยรักษาโทนฟ้า–ม่วงและบุคลิกเดิมของแบรนด์ ผู้ใช้ควรมองออกทันทีว่าข้อความไหนสำคัญ ปุ่มไหนกดได้ พื้นที่ไหนแก้ไขได้ และบทเรียนอยู่ในสถานะอะไร

แผนนี้เริ่มถูก implement แล้วในวันที่ 2026-10-03 โดยปรับเฉพาะ presentation/frontend source และไม่เปลี่ยน API, DB, lesson content หรือ learner progress

## 2. หลักฐานจากการสำรวจ

สำรวจผ่าน Chrome ของผู้ใช้บน desktop วันที่ 2026-10-03 ทั้ง Light และ Dark:

- Landing: ส่วน hero และ feature cards
- Globe Explorer: ช่องค้นหา แผนที่ และ country card ที่มีคอร์สให้เริ่มเรียน
- Courses / My learning
- Course outline: modules, lesson states และ progress
- Reading: Hello & Goodbye ตั้งแต่ปกถึงปุ่ม Finish lesson
- Settings ทั้ง 11 เมนู: Users, Languages, Levels, Countries, Country languages, Courses, Modules, Lessons, Lesson builder, Enrollments, Progress

| พื้นที่ | สิ่งที่พบ | ผลต่อการใช้งาน | ความสำคัญ |
|---|---|---|---|
| Light ทั้งระบบ | ข้อความรอง placeholder และเส้นขอบหลายจุดจางบนพื้นขาว | ต้องเพ่ง และบางสิ่งที่กดได้ดูคล้าย disabled | Required |
| Dark ใน Settings / Builder | พื้นหน้า การ์ด ช่องกรอก และกรอบซ้อนใช้กรมท่าใกล้กัน | แยกพื้นที่อ่านกับพื้นที่แก้ไขได้ช้า | Required |
| Courses / My learning | แท็บที่เลือกมีสีอ่อนและน้ำหนักน้อย | selected state ดูคล้าย inactive/disabled | Required |
| Course outline | เรียนแล้วและยังไม่เริ่มใช้ม่วงคล้ายกัน; progress bar บาง | ต้องอ่านหรือดูไอคอนเพื่อทราบสถานะ | Required |
| Settings | Content setup guide ใหญ่และเด่นกว่าตาราง | ข้อมูลที่ใช้ทำงานถูกดันลงด้านล่าง | Recommended |
| Lesson Builder | กรอบซ้อนหลายชั้นและสีพื้นใกล้กัน | หน้าดูแน่นแม้แบ่งเป็นส่วนแล้ว | Required |
| Reading | เนื้อหาหลักและปุ่มท้ายบทอ่านชัด แต่หัวข้อ บทสนทนา คำแปล และคำอธิบายน้ำหนักใกล้กัน | อ่านยาวแล้วหาจุดสำคัญยาก | Recommended |
| Landing / Globe | หัวข้อใหญ่และ CTA ชัด; ข้อความรองกับ search ยังอ่อน | ภาพรวมสวย แต่ส่วนใช้งานบางจุดไม่เด่น | Required เฉพาะ contrast |

### ขอบเขตที่ยังไม่ยืนยัน

- ยังไม่ได้วัด contrast ratio ของทุกองค์ประกอบ; ผลข้างต้นเป็นการประเมินด้วยสายตาและการใช้งาน
- รอบรีวิวธีมนี้ยังไม่ได้ตรวจ mobile, signed-out / sign-in / profile completion, create modal, guided tour และทุก hover/focus/error/loading state
- ไม่ได้เปิดเนื้อหาครบทั้ง 32 lessons หรือทดสอบทุกสถานะของ Multiple Choice, Audio, Video, Conversation
- Hello & Goodbye เป็นตัวอย่าง Reading; ห้ามสรุปว่าการจัดข้อความทุกบทเหมือนกัน
- หลังสำรวจคืน theme preference เป็น Auto และกลับ Settings → Country languages

## 3. ขอบเขตและแนวทางออกแบบ

### Required

1. เพิ่ม contrast ของข้อความที่ผู้ใช้ต้องอ่าน รวมถึง metadata, helper text และ placeholder
2. ทำให้พื้นหน้า / การ์ด / control แยกกันชัดทั้งสองธีม
3. ทำ selected, hover, focus, disabled และ read-only ให้ต่างกัน โดยไม่ใช้สีอย่างเดียว
4. ใช้สีสถานะให้สม่ำเสมอ: success, warning, danger, neutral และ in-progress
5. แก้ hardcoded colors ในองค์ประกอบที่เกี่ยวข้องให้ใช้ semantic tokens

### Recommended

- ย่อ Guide ให้เป็นแถบสรุปหรือ disclosure ที่เปิดได้ พร้อมปุ่มเปิด guided tour ที่หาเจอ
- ลดกรอบซ้อนที่ไม่ได้ช่วยแบ่งงานใน Builder
- ทำหัวข้อ บทสนทนา คำแปล และคำอธิบายใน Reading ให้มีลำดับชั้นชัดขึ้น
- เพิ่มน้ำหนัก progress และ next lesson โดยใช้ข้อมูลที่ระบบมีอยู่แล้ว

### Optional / deferred

- ทำขนาด ThemeToggle บน Landing และหน้าด้านในให้สอดคล้องกันมากขึ้น โดยรักษา compact mode
- ปรับสัดส่วนภาพปกหลังเทียบตัวอย่างหลายบทและ mobile; ไม่ตัดเนื้อหาภาพสำคัญ

### ไม่รวมในแผน

เปลี่ยนแบรนด์ทั้งหมด, เปลี่ยน routing, เพิ่ม block types, เปลี่ยนกฎ publish/enrollment/progress, แก้ API/DB, เปลี่ยนเนื้อหาทั้ง 32 บท หรือเพิ่ม dependency เพื่อทำธีม งาน typography ที่ต้องแก้เนื้อหาให้แยกออกเป็นงาน authoring ภายหลัง

## 4. Theme token contract

จุดเริ่มต้นคือ `lingora-web/src/style.css`: `:root` และ `:root[data-theme="dark"]` มี tokens อยู่แล้ว ให้ปรับและต่อยอดจากชุดนี้ ไม่สร้างระบบธีมคู่ขนาน

| บทบาท | แนวทาง Light | แนวทาง Dark |
|---|---|---|
| Page | สีอ่อนอมฟ้า ใช้ gradient เป็นฉากหลัง | กรมท่าเข้ม ใช้ gradient เฉพาะบริเวณตกแต่ง |
| Surface / elevated | การ์ดสีขาวบนพื้นหน้าที่ต่างเฉด; overlay ต้องแยกจากฉากหลัง | การ์ดสว่างกว่าพื้นหน้า; popover/modal แยกชัดอีกระดับ |
| Input | สีพื้นและขอบเห็นได้บนการ์ด | ไม่ปล่อยให้พื้นช่องกรอกกลืนกับการ์ด; focus ชัด |
| Text / muted | ตัวหลักเข้ม ตัวรองยังอ่านสบาย | ตัวหลักขาวนวล ตัวรองสว่างพอโดยไม่แย่งหัวข้อ |
| Soft text | ใช้เฉพาะข้อมูลที่ไม่จำเป็นต่อการทำงาน | ห้ามนำสีจางนี้ไปใช้แทน label/help ที่ต้องอ่าน |
| Border | แยกขอบตกแต่งกับขอบ control | เพิ่มความชัดของขอบที่ใช้บอกพื้นที่หรือการโต้ตอบ |
| Accent | ฟ้า–ม่วงสำหรับ action หลักและ selected | รักษาแบรนด์แต่ตรวจคู่สีกับพื้นเข้ม |
| Semantic status | success เขียว, warning อำพัน, danger แดง, neutral เทา | ปรับ foreground/background แยกให้เหมาะกับพื้นเข้ม |

เพิ่ม tokens เฉพาะบทบาทที่ขาด เช่น `--theme-focus`, `--theme-warning`, `--theme-success-soft`, `--theme-danger-soft`, `--theme-disabled-text`, `--theme-disabled-surface` และสี Reading ทั้งห้า หากจำเป็น ใช้ชื่อบทบาทแทนชื่อหน้า

ไม่กำหนด hex สุดท้ายจากความรู้สึกเพียงอย่างเดียว: ทดสอบคู่สีจริงบนพื้นหลังที่ render แล้ว โดยคำนึงถึง opacity, gradient และ backdrop ที่ซ้อนกัน ไม่ใช่วัดค่า token เดี่ยว

### เกณฑ์ตรวจรับด้าน contrast

- ตั้งเป้าข้อความปกติที่ต้องอ่านอย่างน้อย 4.5:1 และหัวข้อขนาดใหญ่ตามเกณฑ์การทดสอบอย่างน้อย 3:1
- ตั้งเป้าขอบ/เครื่องหมายที่จำเป็นต่อการระบุ control, state และ focus อย่างน้อย 3:1 เทียบพื้นติดกัน
- ข้อความบนปุ่ม gradient ต้องตรวจบริเวณที่ contrast ต่ำสุด; ใช้พื้น solid หรือเปลี่ยน foreground หากไม่ผ่าน
- disabled ต้องเห็นว่าปิดใช้งาน แต่ห้ามทำข้อความอธิบายเหตุผลจางจนอ่านไม่ได้
- สีสำเร็จ/ผิด/กำลังเรียนต้องมีไอคอนหรือข้อความประกอบ และ selected ต้องมี shape/border/weight เพิ่มเติม
- ตัวเลขเหล่านี้เป็นเกณฑ์ของงานถัดไป ไม่ใช่คำยืนยันว่าระบบปัจจุบันผ่านแล้ว

## 5. แผนดำเนินงาน

Source implementation ของ T2–T7 และ UX follow-up ถูกลงแล้วในวันที่ 2026-10-03; build และ targeted Chrome checks ผ่านแล้ว T1/T8/T9 ยังเป็น partial เพราะ measured contrast และ full fixture/state sweep ยังไม่ครบ งานสีใช้ visual verification แทน unit tests ที่เพียงตรวจค่า CSS

| Task | งาน | Definition of Done | Depends | Status |
|---|---|---|---|---|
| T1 | `[lane:fast]` เก็บภาพ before และรายการคู่สี/selector ที่มีปัญหา พร้อมตรวจ baseline tooling | มีภาพตัวแทน Light/Dark, contrast audit และ typecheck/build baseline; ตรวจและบันทึก lint/formatter setup ก่อน source edits | — | cc:PARTIAL — มี qualitative Chrome baseline เดิมและ scripts ชัดเจน แต่ไม่มี measured contrast/before artifact ใน session นี้ |
| T2 | `[lane:fast] [tdd:skip:visual-css]` ปรับ semantic tokens และเก็บ hardcoded colors ที่กระทบ | มีตาราง token ก่อน/หลัง; คู่สีข้อความ/control ผ่านเกณฑ์; decorative brand colors ไม่ถูกแทนโดยไม่มีเหตุผล | T1 | cc:IMPLEMENTED — เพิ่ม semantic surface/focus/status/disabled/Reading tokens; pending rendered contrast verification |
| T3 | `[lane:fast] [tdd:skip:visual-css]` ปรับ shared controls: button, input, select, textarea, tab, badge, focus, popover/modal | ทุก state แยกได้ทั้งสองธีม; enabled ไม่ดู disabled; keyboard focus เห็นชัด; overlay อ่านชัด | T2 | cc:IMPLEMENTED — source complete; pending browser state sweep |
| T4 | `[lane:fast] [tdd:skip:visual-css]` ปรับ Settings และ Builder surfaces, table headers, helper text, selected lesson, read-only fields | ตารางและช่องแก้ไขแยกกันชัด; label/metadata อ่านได้; published badge ใช้ความหมายเดียวทั้งสองธีม; save/create action มี hierarchy สม่ำเสมอ | T3 | cc:IMPLEMENTED — source complete; pending visual verification |
| T5 | `[lane:gate]` ลดพื้นที่ Guide และกรอบซ้อนที่ไม่จำเป็น | เข้าถึงตารางเร็วขึ้น; เปิด/ปิด Guide และเรียก tour ได้; draft edits ไม่สูญหาย; ไม่เปลี่ยนสิทธิ์หรือข้อมูล | T4 | cc:IMPLEMENTED — Guide collapsed by default with disclosure + tour CTA; interaction smoke test pending |
| T6 | `[lane:fast] [tdd:skip:visual-css]` ปรับ Landing/Globe และ catalog/outline | search และข้อความรองอ่านชัด; selected tab ชัด; completed/in-progress/not-started มีสีพร้อม label/icon; progress มองเห็นง่าย | T3 | cc:IMPLEMENTED — source complete; pending Light/Dark/mobile review |
| T7 | `[lane:fast] [tdd:skip:visual-css]` ปรับ Reading presentation และสีเนื้อหาใน Editor/Player | headings, lists, links, quotes, tables และ Reading colors อ่านได้; preview/player ให้ผลสอดคล้อง; plain text และ Markdown ยังแสดงถูกต้อง | T3 | cc:IMPLEMENTED — Reading color tokens + editor state hierarchy applied; pending fixture/browser review |
| T8 | `[lane:gate]` ตรวจรวม Light/Dark/Auto บน desktop/mobile และ review diff | checklist ข้อ 7 ผ่าน; typecheck/build ผ่าน; มีภาพ after และรายการข้อยกเว้น/สิ่งที่ยังไม่ตรวจ | T4, T5, T6, T7 | cc:PARTIAL — local build/typecheck and targeted Chrome desktop/390 × 844 checks pass; measured contrast, saved matched images and full state/fixture sweep remain |
| T9 | `[lane:fast] [tdd:skip:docs-only]` สรุปผลและอัปเดต handoff | บันทึก tokens, ภาพเปรียบเทียบ, contrast results, validation และงานค้าง; PR evidence เตรียมได้หากผู้ใช้ขอ โดยไม่ push/deploy ในงานนี้ | T8 | cc:PARTIAL — follow-up implementation/results/limits recorded here and in HANDOFF section 30; final contrast/fixture evidence remains |

### Implementation notes (2026-10-03)

Source changes applied in this pass:

- `style.css`: strengthened Light/Dark text, borders, inputs and surfaces; added semantic elevated/focus/warning/status/disabled/Reading tokens; normalized selected, hover, focus, disabled and read-only presentation.
- `SettingsPage.tsx`: Content setup guide is collapsed by default and can be opened without removing the guided-tour entry point.
- Settings/Builder: tables, editable inputs, read-only values, draft/dirty/published states and modal surfaces now use semantic roles more consistently.
- Landing/Globe: search, secondary text, interactive surfaces, country card and disabled CTA use the shared theme hierarchy.
- `LearningPage.tsx`: lesson rows now expose presentational classes for completed, in-progress and not-started states; CSS adds non-color cues and a heavier progress treatment.
- Reading editor/player: five allowed reading colors are backed by Light/Dark tokens and editor view selection/focus hierarchy is stronger.
- No API, DB schema, lesson content, enrollment/progress behavior, sanitizer contract or theme preference behavior was changed.

The initial MCP session only supported source inspection and structural CSS checks. The follow-up used the local workspace and user's Chrome; its build and targeted rendered checks supersede that tooling limitation. T8 remains partial for the coverage listed below.

### UX follow-up ที่แก้และตรวจแล้ว (2026-10-03)

- Settings Modal ใช้ native dialog ผ่าน `SettingsDialog.tsx`: focus แรก, Tab/Shift+Tab ไม่หลุดไปพื้นหลัง, Escape ปิดและคืน focus; reference autocomplete portal อยู่ใน dialog และ Escape ปิด dropdown ก่อนปิดฟอร์ม
- Globe ลดความสูง desktop ให้การ์ดและ Start learning อยู่ในจอ ย้าย legend ไปมุมบนของแผนที่ และแก้ grid min-width ที่ทำให้หัวข้อ/ช่องค้นหา mobile ถูกตัด
- My learning ลดพื้นที่ hero พร้อม progress จริงและบทถัดไปจาก read-only course outlines; กรณีโหลดไม่สำเร็จให้เปิดคอร์สเพื่อดูข้อมูล ไม่แสดง 0% ที่คาดเดา
- Course outline เน้น Start/Up next และใช้เครื่องหมาย completed สีเขียวพร้อม Review แบบ neutral; stats/progress จัดวางกระชับ
- Builder เพิ่มค้นหาบทเรียน/ซ่อนรายการ, ย่อ guide/header, พับ Add a block และ Behavior & completion สำหรับบทที่มีเนื้อหา, เพิ่ม Save block บน sticky header และเอา UUID/contract strip ออกจากพื้นที่หลัก
- Reading editor source ขยายตามเนื้อหาและความกว้าง; preview เลื่อนตามหน้า ลด scroll ซ้อน; รูปปกรักษาสัดส่วน lists/quotes/scenarios มีระยะชัดขึ้น; player แสดง Review · Completed lesson / Finish review / Review complete
- แก้ ThemeToggle ที่แตะแล้วไม่เปลี่ยน เพราะ pointer capture ทำให้ click ไปตกที่ container; แตะเลือกและลากยังทำงาน

ผลทดสอบใน Chrome ของผู้ใช้:

| ขอบเขต | ผล |
|---|---|
| Desktop ประมาณ 1470 × 870 CSS pixels, Light/Dark | Globe card/legend, catalog/My learning, outline, Reading และ Builder ตรวจหลังแก้; My learning แสดง 2/32, 6%, Next: How Are You? |
| Dark New Language Modal | focus ช่องแรก, Tab/Shift+Tab wrap, Escape และคืน focus ไป Create ผ่าน |
| Mobile 390 × 844 Light New Lesson Modal | dropdown Module อยู่เหนือ form; Escape ครั้งแรกปิด dropdown ครั้งที่สองปิด Modal; ไม่มี submit |
| Mobile 390 × 844 Light/Dark Builder | search empty state, ซ่อนรายการ, เปิด/ปิด palette และปุ่ม editor wrap โดยไม่ตัด |
| Mobile Dark/Auto Globe | หัวข้อ/search อยู่ในจอ, legend กับการ์ดคนละตำแหน่ง, Start learning แสดงครบ |
| Theme interaction | แตะ Light/Dark/Auto และลาก Dark → Light ผ่าน; คืน Auto และปิด test DevTools |
| Completed passive Reading review | Finish review → Review complete ผ่าน local path โดยไม่ submit progress |
| `rtk bun run build` | TypeScript + production build ผ่าน; ยังมี warning chunk >500 kB เดิม |

ยังไม่ได้วัด contrast จริงครบคู่สี/พื้นโปร่งใส, ไม่ได้เก็บภาพ before/after คู่กันเป็นไฟล์ และยังไม่ sweep ทุก mobile Settings/auth/tour/exercise feedback/media fixture/Reading format. จึงไม่ประกาศว่า checklist ทั้งหมดหรือ WCAG ผ่านแล้ว ไม่มี API/schema/content/enrollment/progress write, secret access, Git action หรือ deploy ในรอบนี้

### Baseline tooling

Web package มี `typecheck` และ `build`; จาก package scripts และรายการ config ที่ตรวจครั้งนี้ยังไม่พบ lint/formatter ที่ประกาศใช้ ก่อนแก้ source ให้ตรวจ convention ใน repository อีกครั้ง หากไม่มีให้จัด baseline ที่แคบสำหรับไฟล์ที่จะเปลี่ยนก่อนเริ่ม T2 ไม่จัดรูปแบบทั้งโครงการหรือเพิ่มเครื่องมือโดยไม่จำเป็น

## 6. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | ความรับผิดชอบ |
|---|---|
| `lingora-web/src/style.css` | Tokens, page surfaces, controls, tables, responsive rules และ Reading styles; ตรวจ cascade/override ที่อยู่ท้ายไฟล์ด้วย |
| `lingora-web/src/features/theme/theme.ts` | Light/Dark/Auto, system preference, localStorage และ meta theme-color; รักษาพฤติกรรมเดิม |
| `lingora-web/src/features/theme/ThemeToggle.tsx` | Selected/focus/compact presentation; ไม่รื้อ drag/click behavior โดยไม่จำเป็น |
| `lingora-web/src/features/settings/SettingsPage.tsx` | Guide, table groups และ form states |
| `lingora-web/src/features/settings/LessonBuilder.tsx` | Selected lesson, editor sections และ block states |
| `lingora-web/src/features/settings/ReadingEditor.tsx` | Toolbar, Write/Preview/Split และ preview contrast |
| `lingora-web/src/features/lessons/ReadingContent.tsx` | Shared Markdown renderer; รักษา sanitizer และ allowlist |
| `lingora-web/src/features/lessons/LessonPlayer.tsx` | Reading และ feedback/completion ของแต่ละ block |
| `lingora-web/src/features/learning/LearningPage.tsx` | Catalog, tabs, outline, lesson state และ progress |
| `lingora-web/src/features/landing/LandingPage.tsx`, `features/globe/GlobeExplorer.tsx`, `App.tsx` | Landing, globe card และ shared navigation |

## 7. Validation checklist

### Visual / accessibility

- [ ] เก็บ before/after ที่ viewport และเนื้อหาเดียวกันใน Light/Dark
- [ ] ตรวจ Landing, Globe, All courses, My learning, outline, Reading และ Settings ทั้ง 11 เมนู
- [ ] ตรวจ mobile อย่างน้อย 390 × 844 และ desktop ที่ใช้งานจริง; ไม่มีข้อความ/toolbar/modal ถูกตัดหรือทำให้หน้า overflow
- [ ] ตรวจ enabled/disabled/read-only/selected/hover/focus/error/loading/empty state ของ shared controls
- [ ] ตรวจ create modal, account popover, guide/tour และ profile completion ตาม state ที่เข้าถึงได้; บันทึก unknown หากเข้าไม่ถึง
- [ ] ตรวจ Reading สี blue/purple/green/red/orange, bold/italic/underline, link, image, heading, list และ table ทั้ง preview/player
- [ ] ตรวจ Multiple Choice feedback ถูก/ผิด และ block types อื่นด้วย fixture ที่เหมาะสม ไม่เปลี่ยน progress ของผู้ใช้จริงเพื่อเก็บภาพ
- [ ] บันทึก contrast ของคู่สีสำคัญ รวม translucent/gradient backgrounds; ไม่ประกาศว่าผ่านทั้งระบบจาก token เพียงไม่กี่ตัว

### Behavior regression

- [ ] เปลี่ยน Light/Dark/Auto, refresh และเปลี่ยน route แล้ว preference ยังถูกต้อง; Auto ตาม system theme
- [ ] ใช้ keyboard ไปยัง navigation, tabs, forms, accordion และ ThemeToggle ได้ พร้อม focus ที่เห็นชัด
- [ ] Guide ย่อ/ขยายได้และ guided tour ยังใช้ได้; การเปลี่ยน section ไม่ทำให้ draft หาย
- [ ] Catalog → outline → lesson → review/resume ยังทำงาน; ไม่มีการเปลี่ยน availability/publish/enrollment rules
- [ ] Markdown sanitizer, safe links และ plain-text fallback ยังอยู่
- [x] รันจาก `lingora-web`: `rtk bun run build` (script รัน `tsc --noEmit` ก่อน Vite จึงรวม typecheck)
- [ ] Review diff ว่าไม่แตะ API/DB/content และไม่มี CSS override ที่ทำให้ธีมอีกฝั่งเสีย

## 8. ความเสี่ยงและวิธีควบคุม

- **ปรับ token แล้วกระทบทุกหน้า:** เปลี่ยนเป็นชุดย่อยและเทียบทั้งสองธีมทุกช่วง; อย่าเพิ่ม override รายหน้าเพื่อกลบปัญหา token
- **CSS ยาวและมี hardcoded colors:** ตรวจ selector ซ้ำ, specificity และกฎท้ายไฟล์ก่อนสรุปว่าปรับครบ
- **สีดูดีบนพื้นหนึ่งแต่ไม่ผ่านอีกพื้น:** ตรวจ context จริง รวม Reader colors, badge และปุ่ม gradient
- **เพิ่มสีจนเสีย focus:** ใช้ accent เฉพาะ action/selection และ semantic colors เฉพาะสถานะ
- **Reading ต้องเปลี่ยนเนื้อหาเพื่อจัดหัวข้อ:** CSS อย่างเดียวอาจแก้ plain text ไม่ได้; แยกงาน authoring และไม่แก้ lesson DB ในงานธีม
- **ทดสอบแล้วเปลี่ยนข้อมูลจริง:** ใช้ review mode/fixture และไม่กด Finish/Save/Create/Delete เพียงเพื่อรีวิวสี

## 9. Planning validation และการเริ่มงานต่อ

- `team_validation_mode: subagent` — มีการตรวจแผนแบบ read-only จากมุม Product/Architecture/Security/QA/Skeptic
- `Spec skip reason`: บันทึกเป็นแผนเฉพาะเรื่องตามชื่อไฟล์ที่ผู้ใช้กำหนด โดยยึด `HANDOFF.md` และ `lesson-block-mvp.md`; ไม่สร้าง spec/Plans.md คู่ขนานหรือเปลี่ยนสัญญา API/ข้อมูลในงานเอกสารนี้
- หลักฐานเดิม: browser review, theme source, package scripts และเอกสาร handoff; ไม่พบ project spec/Plans/memory files จากการค้นชื่อที่ตรวจ จึงไม่อ้างว่าได้ตรวจระบบ memory ภายนอกทั้งหมด
- เอกสารเดิมที่คลาดเคลื่อน: `lesson-block-mvp.md` ยังมีข้อความว่า course/lesson navigation ไม่ได้เชื่อมแล้ว ให้ยึด learner route/status ล่าสุดใน `HANDOFF.md`; สัญญา Reading sanitizer ในเอกสาร MVP ยังใช้ได้
- งานนี้ไม่ต้องอ่าน `.env`, ส่งข้อมูลภายนอก, เปลี่ยน DB, publish, deploy หรือทำ Git action
- Implementation และ UX follow-up เสร็จแล้ว; งานถัดไปเก็บหลักฐานส่วนที่เหลือใน T8 แล้วอัปเดต T9 ไม่เริ่ม T2–T7 ซ้ำ

หากเริ่มต่อใน session ใหม่ ให้เปิดโครงการ Lingora แล้วใช้คำสั่งงานนี้:

> อ่าน docs/HANDOFF.md โดยเฉพาะ section 30 และ docs/theme-modify-plan.md แล้วทำ validation ส่วนที่ค้างใน T8: measured contrast, saved matched screenshots และ state/fixture coverage ที่ยังไม่ตรวจ แก้เฉพาะปัญหาที่พบและอัปเดตหลักฐาน ห้ามเปลี่ยนข้อมูล lesson/progress เพื่อทดสอบสี
