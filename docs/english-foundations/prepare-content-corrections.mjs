import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const requireApi=createRequire(path.join(dir,'../../lingora-api/package.json'));
requireApi('dotenv').config({path:path.join(dir,'../../lingora-api/.env'),quiet:true});
const {Client}=requireApi('pg');
const seed=JSON.parse(fs.readFileSync(path.join(dir,'compiled.json'),'utf8'));
const corrections=[
 {code:'18.FINAL',old:'Ben can cook. Can you bring some cups? Sure. Could you help me carry the bag? Of course.',next:'Ben can cook.\n\nMai: Can you bring some cups?\nBen: Sure.\nMai: Could you help me carry the bag?\nBen: Of course.'},
 {code:'27.FINAL',old:'Mai visited her friend last Saturday. They were cooking when Ben called. She has known her friend for five years. She is meeting Ben at six tomorrow. My story: Last week, I visited my sister. We cooked lunch because we were hungry. I have cooked many meals with her. Tomorrow, I’m going to visit her again. I’ll help her after I finish my work.',next:null},
 {code:'35.CP',old:'Let me know if you can come, and tell me if another time is better. See you soon, Mai.',next:'Let me know if you can come, and tell me if another time is better. See you soon, and thanks, Mai.'},
];
const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 await client.connect();await client.query('BEGIN READ ONLY');
 const patches=[];
 for(const fix of corrections){
  const lesson=seed.lessons.find(l=>l.code===fix.code);
  const block=seed.blocks.filter(b=>b.lessonId===lesson.id&&b.type==='reading').at(-1);
  const row=(await client.query('SELECT content FROM lesson_blocks WHERE id=$1 AND type=\'reading\' AND deleted_at IS NULL',[block.id])).rows[0];
  if(!row?.content.body.includes(fix.old))throw new Error('Expected original production model missing: '+fix.code);
  let expectedNew=row.content.body;
  if(fix.next)expectedNew=expectedNew.replace(fix.old,fix.next);
  else{
   const nextModel=block.content.body.split('### ตัวอย่างผลงาน\n\n')[1]?.split('\n\n### เกณฑ์ตรวจ')[0];
   if(!nextModel?.includes('เรื่องของฉัน (87 คำ)')||!nextModel.includes('What are you going to do tomorrow?'))throw new Error('Corrected capstone model missing');
   expectedNew=expectedNew.replace(fix.old,nextModel);
  }
  if(expectedNew!==block.content.body)throw new Error('Unexpected additional source differences: '+fix.code);
  patches.push({code:fix.code,blockId:block.id,expectedOldContent:row.content});
 }
 await client.query('ROLLBACK');
 fs.writeFileSync(path.join(dir,'final-content-corrections.json'),JSON.stringify(patches,null,2)+'\n');
 console.log(JSON.stringify({prepared:patches.map(p=>p.code),mode:'read-only preparation',guard:'Exact original content match required for each update'}));
}finally{await client.end();}
