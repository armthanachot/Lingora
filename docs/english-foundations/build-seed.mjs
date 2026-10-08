import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const proposal = fs.readFileSync(path.join(dir, '../english-foundations-curriculum-proposal.md'), 'utf8');
const modules = [...proposal.matchAll(/^### M(\d{2}) — (.+)\n([\s\S]*?)(?=^### M|^## ตารางตรวจความครอบคลุม)/gm)].map(m => ({
  number: Number(m[1]), title: m[2], prerequisite: m[3].match(/ควรรู้ก่อน: (.+)/)?.[1]?.trim(),
  outcome: m[3].match(/ผลลัพธ์หลัง module: \*\*(.+)\*\*/)?.[1],
  references: [...m[3].matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(r => ({title:r[1],url:r[2]})),
  lessons: [...m[3].matchAll(/^\| (\d{2}\.(?:\d{2}|CP)) \| (.+?) \| (.+?) \|$/gm)].map(l => ({code:l[1],title:l[2],scope:l[3]})),
}));
const courses = [
  {number:1, end:10, level:'beginner-1', title:'English Foundations 1 — เริ่มสร้างประโยคภาษาอังกฤษ', outcome:'สร้างประโยคบอกเล่า ปฏิเสธ และคำถามเกี่ยวกับตัวเองหรือกิจวัตรได้'},
  {number:2, end:18, level:'beginner-2', title:'English Foundations 2 — ขยายประโยคและบอกข้อมูล', outcome:'บอกเวลา ความถี่ สถานที่ ปริมาณ และสิ่งที่กำลังเกิดขึ้นได้'},
  {number:3, end:27, level:'elementary-1', title:'English Foundations 3 — เล่าเหตุการณ์และใช้เวลาให้ถูก', outcome:'เล่าอดีต พูดถึงแผน ประสบการณ์ เปรียบเทียบ และอธิบายเหตุผลง่าย ๆ ได้'},
  {number:4, end:36, level:'elementary-2', title:'English Foundations 4 — เชื่อมความคิดและสื่อสารเป็นเรื่องราว', outcome:'เชื่อมหลายประโยค อ่านและฟังเรื่องสั้น แล้วพูดหรือเขียนตอบเป็นเรื่องราวได้'},
];
const uid = key => {const h=crypto.createHash('sha256').update('lingora/english-foundations/v1/'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const raw = fs.readdirSync(dir).filter(f=>/^content-\d\.mjs$/.test(f));
const kits = {}, checkpointKits = {};
for (const name of raw) {const m=await import(path.join(dir,name));Object.assign(kits,m.lessons);Object.assign(checkpointKits,m.checkpoints);}
if (modules.length!==36) throw new Error(`Expected 36 modules; got ${modules.length}`);
const missing = modules.flatMap(m=>m.lessons.filter(l=>!l.code.endsWith('CP')&&!kits[l.code]).map(l=>l.code));
const missingCheckpoints=modules.filter(m=>m.number<36&&!checkpointKits[m.number]).map(m=>m.number);
if(missing.length||missingCheckpoints.length){console.log(JSON.stringify({status:'authoring',authored:Object.keys(kits).length,missing,missingCheckpoints},null,2));process.exit(2);}
const assetsDir=path.join(dir,'../assets/english-foundations');
const audioPlan=JSON.parse(fs.readFileSync(path.join(assetsDir,'audio-plan.json'),'utf8'));
const uploads=JSON.parse(fs.readFileSync(path.join(assetsDir,'uploads.json'),'utf8'));
const audioMap=new Map(audioPlan.map(a=>[a.code,a]));
if(audioPlan.length!==198)throw new Error('Expected 198 authored audio clips');
for(const a of audioPlan)if(!uploads[a.file]?.publicVerified)throw new Error('Audio URL not verified: '+a.file);
const audio=code=>{const plan=audioMap.get(code);const asset=uploads[plan.file];return {type:'audio',version:1,content:{media:{source:'url',url:asset.url},title:code==='36.02'?'ฟังข้อความใหม่ แล้วตอบคำถาม':'ฟังตัวอย่างและลองพูดตาม',transcript:code==='36.02'?'':plan.transcript},settings:{autoplay:false,controls:true},interaction:{mode:'activity'},completion:{rule:'viewed'}};};
const read=(title,body)=>({type:'reading',version:1,content:{title,body,format:'markdown'},settings:{textSize:'medium',alignment:'left'},interaction:{mode:'none'},completion:{rule:'viewed'}});
const mc=(q)=>({type:'multiple_choice',version:1,content:{question:q[0],choices:q[1].map((text,i)=>({id:`choice_${i+1}`,text})),correctChoiceId:`choice_${q[2]+1}`,explanation:q[3]},settings:{shuffleChoices:true,showExplanation:true},interaction:{mode:'answer'},completion:{rule:'correct'}});
const compiled={courses:[],modules:[],lessons:[],blocks:[]};
function addLesson(m,l,blocks){
 const id=uid('lesson/'+l.code); compiled.lessons.push({id,moduleId:uid('module/'+m.number),code:l.code,title:`${l.code} · ${l.title}`,description:l.scope,sortOrder:m.lessons.indexOf(l)+1,isPublished:true});
 blocks.forEach((b,i)=>compiled.blocks.push({id:uid('block/'+l.code+'/'+i),lessonId:id,...b,sortOrder:i+1}));
}
function refs(m){return m.references.map(r=>`[${r.title}](${r.url})`).join(' · ');}
for(const c of courses)compiled.courses.push({...c,id:uid('course/'+c.number),slug:`english-foundations-${c.number}`,description:`สำหรับผู้เรียนไทยวัยรุ่นและผู้ใหญ่\nเป้าหมาย: ${c.outcome}\n${c.number===1?'เริ่มต้นได้โดยไม่ต้องท่อง A–Z':'ควรรู้ผลลัพธ์ของ English Foundations '+(c.number-1)+' ก่อนเรียน'}\nฝึกคำศัพท์ ออกเสียง อ่าน ฟัง พูด และเขียนควบคู่กับโครงสร้างภาษา งานพูด/เขียนใช้เกณฑ์ตรวจตนเองหรือครูตรวจ การจบคอร์สไม่ใช่ใบรับรองระดับ CEFR`,sortOrder:c.number+10,isPublished:true});
for(const m of modules){
 const c=courses.find(c=>m.number<=c.end);const previous=c.number===1?0:courses[c.number-2].end;
 compiled.modules.push({id:uid('module/'+m.number),courseId:uid('course/'+c.number),title:`M${String(m.number).padStart(2,'0')} · ${m.title}`,description:`ควรรู้ก่อน: ${m.prerequisite}\nผลลัพธ์: ${m.outcome}`,sortOrder:m.number-previous});
 for(const l of m.lessons){
  if(l.code.endsWith('CP')){
   const cp=checkpointKits[m.number];
   addLesson(m,l,[read('ลองทำด้วยตัวเอง',`## ตรวจความเข้าใจ\n\nเป้าหมาย: **${m.outcome}**\n\nทำข้อทดสอบโดยไม่เปิดตัวอย่างก่อน จากนั้นอ่านเหตุผลทุกข้อ ข้อที่ยังตอบไม่มั่นใจให้ย้อนกลับไปบทที่ระบุใน feedback แล้วลองอธิบายใหม่ด้วยคำของตัวเอง\n\nข้อเลือกตอบต้องตอบถูกเพื่อผ่าน block สามารถลองใหม่ได้ คะแนนแต่ละข้อไม่ได้ใช้รับรองทักษะพูดหรือเขียน`),...cp.questions.map(mc),read('ภารกิจประจำ module',`## ใช้ภาษาเพื่อสื่อสาร\n\n${cp.task}\n\n### ตัวอย่างผลงาน\n\n${cp.model}\n\n### ตรวจผลงาน\n\n${cp.rubric.map(r=>'- '+r).join('\n')}\n\nลองทำก่อนดูตัวอย่าง แล้วแก้ผลงานของคุณอีกครั้ง งานนี้ใช้ตรวจตนเองหรือให้ครูตรวจ ระบบบันทึกการอ่าน block และไม่ได้ให้คะแนนงานพูด/เขียนโดยอัตโนมัติ`)]);
   continue;
  }
  const k=kits[l.code];
  if(!k.rule||k.examples.length<2||k.questions.length<2||!k.task||!k.model)throw new Error(`Incomplete authored lesson ${l.code}`);
  const table=k.examples.map(e=>`| ${e[0].replaceAll('|','/')} | ${e[1].replaceAll('|','/')} |`).join('\n');
  const body=`## ${l.title}\n\n${k.rule}\n\n### ดูรูปและความหมายร่วมกัน\n\n| ภาษาอังกฤษ | ความหมาย / จุดสังเกต |\n|---|---|\n${table}\n\n### จุดที่มักสับสน\n\n${k.notice}\n\n${k.extra||''}\n\n### ลองสังเกต\n\nอ่านตัวอย่างออกเสียง ชี้คำที่ทำหน้าที่สำคัญในบทนี้ แล้วอธิบายว่าถ้าเปลี่ยนคำนั้น ความหมายหรือรูปประโยคจะเปลี่ยนอย่างไร\n\nแหล่งอ่านต่อ: ${refs(m)}`;
  addLesson(m,l,[read(l.title,body),audio(l.code),...k.questions.map(mc),...(k.dialogue?[{type:'conversation',version:1,content:{title:'ลองใช้ในบทสนทนา',participants:[{id:'a',name:'Mai'},{id:'b',name:'Ben'}],turns:k.dialogue.map((text,i)=>({id:`turn_${i+1}`,speakerId:i%2?'b':'a',text}))},settings:{layout:'chat',showSpeakerNames:true},interaction:{mode:'activity'},completion:{rule:'viewed'}}]:[]),read('ตาคุณลองใช้',`## เปลี่ยนจากตัวอย่างเป็นข้อมูลของคุณ\n\n${k.task}\n\n### ตัวอย่างคำตอบ\n\n${k.model}\n\n### ตรวจตนเอง\n\n- สื่อข้อมูลตามโจทย์ครบ และผู้อ่านหรือผู้ฟังเข้าใจว่าพูดถึงอะไร\n- ใช้รูปหรือกลุ่มคำ **${l.title}** ตามความหมาย ไม่เติมหรือละคำสำคัญ\n- อ่านออกเสียงหนึ่งรอบ แล้วแก้การสะกด ตัวใหญ่และเครื่องหมายที่ทำให้ความหมายไม่ชัด\n\nตัวอย่างเป็นเพียงคำตอบหนึ่งแบบ ใช้ข้อมูลของคุณได้ งานพูด/เขียนใช้ตรวจตนเองหรือครูตรวจ ระบบไม่ได้ประเมินผลงานเหล่านี้อัตโนมัติ`)]);
 }
 // Each of the first three courses receives its own cumulative capstone.
 if([10,18,27].includes(m.number)){
  const cap=checkpointKits[`final${c.number}`];if(!cap)throw new Error('Missing course capstone '+c.number);
  const l={code:`${String(m.number).padStart(2,'0')}.FINAL`,title:`งานปิดคอร์ส English Foundations ${c.number}`,scope:c.outcome};m.lessons.push(l);
  addLesson(m,l,[read('แสดงสิ่งที่ทำได้',`## งานปิดคอร์ส ${c.number}\n\n**${c.outcome}**\n\nทำข้อทดสอบใหม่ต่อไปนี้ แล้วทำงานอ่าน/พูด/เขียนตามโจทย์ ใช้ feedback เพื่อเลือกทบทวน ไม่ใช้จำนวน block ที่อ่านเป็นหลักฐานว่าคุณใช้ภาษาได้แล้ว`),...cap.questions.map(mc),read('ผลงานปิดคอร์ส',`${cap.task}\n\n### ตัวอย่างผลงาน\n\n${cap.model}\n\n### เกณฑ์ตรวจ\n\n${cap.rubric.map(r=>'- '+r).join('\n')}\n\nให้ตนเองหรือครูตรวจงาน ระบบตรวจอัตโนมัติเฉพาะข้อเลือกตอบ แล้วทบทวนจุดที่ยังไม่มั่นใจเป็นระยะ`) ]);
 }
}
for(const b of compiled.blocks){if(b.type==='multiple_choice'){const q=b.content;if(!q.choices.some(c=>c.id===q.correctChoiceId)||!q.explanation)throw new Error('Invalid question '+b.id);if(new Set(q.choices.map(c=>c.text)).size!==q.choices.length)throw new Error('Duplicate choices');}}
if(compiled.lessons.length!==236)throw new Error(`Expected 236 lessons, got ${compiled.lessons.length}`);
// These bodies were saved in the user's Chrome, then compared with a read-only DB query.
const decorationsFile=path.join(dir,'verified-ui-decorations.json');
let decoratedLessons=0;
if(fs.existsSync(decorationsFile)){
 const decorations=JSON.parse(fs.readFileSync(decorationsFile,'utf8'));
 if(decorations.length!==95)throw new Error('Expected all 95 verified UI decorations');
 for(const d of decorations){
  const block=compiled.blocks.find(b=>b.id===d.blockId);
  if(!block||block.type!=='reading')throw new Error('Decoration block missing: '+d.code);
  const hash=crypto.createHash('sha256').update(block.content.body).digest('hex');
  if(hash!==d.baseBodySha256)throw new Error('Authored body changed after UI decoration: '+d.code);
  block.content.body=d.body;
 }
 decoratedLessons=decorations.length;
}
fs.writeFileSync(path.join(dir,'compiled.json'),JSON.stringify(compiled,null,2)+'\n');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const json=o=>quote(JSON.stringify(o))+'::jsonb';
const sql=[];
sql.push(`-- English Foundations 1–4: 36 modules, 236 lessons (233 proposed + 3 course capstones).\n-- Authored Thai explanations, worked examples, interactive questions and self/teacher-assessed production.\n-- Data seed only: no schema changes. Stable UUIDs make retries safe; existing edits are preserved.\n-- New courses only. Existing Everyday English content is untouched.\n-- Built by docs/english-foundations/build-seed.mjs; keep the authored source and media manifest.\nBEGIN;\nSET LOCAL lock_timeout = '10s';\nSET LOCAL statement_timeout = '120s';\nSELECT pg_advisory_xact_lock(716203004);\nDO $requirements$ BEGIN\nIF NOT EXISTS(SELECT 1 FROM languages WHERE code='en' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Active English language missing'; END IF;\nIF (SELECT count(*) FROM levels WHERE code IN ('beginner-1','beginner-2','elementary-1','elementary-2') AND deleted_at IS NULL)<>4 THEN RAISE EXCEPTION 'Required foundation levels missing'; END IF;\nEND $requirements$;`);
for(const c of compiled.courses){sql.push(`DO $collision$ BEGIN IF EXISTS(SELECT 1 FROM courses WHERE slug=${quote(c.slug)} AND language_id=(SELECT id FROM languages WHERE code='en' AND deleted_at IS NULL) AND id<>${quote(c.id)}::uuid) THEN RAISE EXCEPTION 'Course slug collision: ${c.slug}'; END IF; END $collision$;`);sql.push(`INSERT INTO courses (id,language_id,level_id,slug,title,description,level,sort_order,is_published) SELECT ${quote(c.id)}::uuid,l.id,v.id,${quote(c.slug)},${quote(c.title)},${quote(c.description)},${quote(c.level)},${c.sortOrder},true FROM languages l CROSS JOIN levels v WHERE l.code='en' AND l.deleted_at IS NULL AND v.code=${quote(c.level)} AND v.deleted_at IS NULL ON CONFLICT(id) DO NOTHING;`);}
for(const m of compiled.modules)sql.push(`INSERT INTO modules(id,course_id,title,description,sort_order) VALUES(${quote(m.id)}::uuid,${quote(m.courseId)}::uuid,${quote(m.title)},${quote(m.description)},${m.sortOrder}) ON CONFLICT(id) DO NOTHING;`);
for(const l of compiled.lessons)sql.push(`INSERT INTO lessons(id,module_id,title,description,content,sort_order,is_published) VALUES(${quote(l.id)}::uuid,${quote(l.moduleId)}::uuid,${quote(l.title)},${quote(l.description)},NULL,${l.sortOrder},true) ON CONFLICT(id) DO NOTHING;`);
for(const b of compiled.blocks)sql.push(`INSERT INTO lesson_blocks(id,lesson_id,type,version,content,settings,interaction,completion,sort_order) VALUES(${quote(b.id)}::uuid,${quote(b.lessonId)}::uuid,${quote(b.type)},1,${json(b.content)},${json(b.settings)},${json(b.interaction)},${json(b.completion)},${b.sortOrder}) ON CONFLICT(id) DO NOTHING;`);
const correctionsFile=path.join(dir,'final-content-corrections.json');
if(fs.existsSync(correctionsFile)){
 const fixes=JSON.parse(fs.readFileSync(correctionsFile,'utf8'));
 if(fixes.length!==3)throw new Error('Expected three reviewed production corrections');
 sql.push('-- Correct three original production examples only when their entire original content still matches.\n-- Fresh installs already contain the corrected examples; future user edits are preserved.');
 for(const fix of fixes){
  const block=compiled.blocks.find(b=>b.id===fix.blockId);
  if(!block||block.type!=='reading')throw new Error('Correction block missing: '+fix.code);
  sql.push(`UPDATE lesson_blocks SET content=${json(block.content)},updated_at=now() WHERE id=${quote(block.id)}::uuid AND lesson_id=${quote(block.lessonId)}::uuid AND type='reading' AND deleted_at IS NULL AND content=${json(fix.expectedOldContent)};`);
 }
}
sql.push(`-- Verify the full seed before commit (including on retries).\nDO $verify$ BEGIN\nIF (SELECT count(*) FROM courses WHERE id IN (${compiled.courses.map(c=>quote(c.id)+'::uuid').join(',')}) AND deleted_at IS NULL)<>4 THEN RAISE EXCEPTION 'Course count mismatch'; END IF;\nIF (SELECT count(*) FROM modules WHERE id IN (${compiled.modules.map(m=>quote(m.id)+'::uuid').join(',')}) AND deleted_at IS NULL)<>36 THEN RAISE EXCEPTION 'Module count mismatch'; END IF;\nIF (SELECT count(*) FROM lessons WHERE id IN (${compiled.lessons.map(l=>quote(l.id)+'::uuid').join(',')}) AND deleted_at IS NULL)<>236 THEN RAISE EXCEPTION 'Lesson count mismatch'; END IF;\nIF (SELECT count(*) FROM lesson_blocks WHERE id IN (${compiled.blocks.map(b=>quote(b.id)+'::uuid').join(',')}) AND deleted_at IS NULL)<>${compiled.blocks.length} THEN RAISE EXCEPTION 'Block count mismatch'; END IF;\nEND $verify$;\nCOMMIT;\n`);
fs.writeFileSync(path.join(dir,'../english-foundations-seed.sql'),sql.join('\n\n'));
console.log(JSON.stringify({courses:compiled.courses.length,modules:compiled.modules.length,lessons:compiled.lessons.length,blocks:compiled.blocks.length,decoratedLessons,types:compiled.blocks.reduce((a,b)=>(a[b.type]=(a[b.type]||0)+1,a),{})},null,2));
