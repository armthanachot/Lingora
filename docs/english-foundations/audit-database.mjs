import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const requireApi=createRequire(path.join(dir,'../../lingora-api/package.json'));
requireApi('dotenv').config({path:path.join(dir,'../../lingora-api/.env'),quiet:true});
const {Client}=requireApi('pg');
const seed=JSON.parse(fs.readFileSync(path.join(dir,'compiled.json'),'utf8'));
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const tables=[
 {table:'courses',source:seed.courses,fields:{slug:'slug',title:'title',description:'description',sortOrder:'sort_order',isPublished:'is_published'}},
 {table:'modules',source:seed.modules,fields:{courseId:'course_id',title:'title',description:'description',sortOrder:'sort_order'}},
 {table:'lessons',source:seed.lessons,fields:{moduleId:'module_id',title:'title',description:'description',sortOrder:'sort_order',isPublished:'is_published'}},
 {table:'lesson_blocks',source:seed.blocks,fields:{lessonId:'lesson_id',type:'type',version:'version',content:'content',settings:'settings',interaction:'interaction',completion:'completion',sortOrder:'sort_order'}},
];
const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 await c.connect();await c.query('BEGIN READ ONLY');const mismatches=[],counts={};
 for(const t of tables){
  const rows=(await c.query('SELECT id,deleted_at,'+Object.values(t.fields).join(',')+' FROM '+t.table+' WHERE id=ANY($1::uuid[])',[t.source.map(x=>x.id)])).rows;
  const byId=new Map(rows.map(r=>[r.id,r]));counts[t.table]=rows.length;
  for(const expected of t.source){const actual=byId.get(expected.id);if(!actual){mismatches.push({table:t.table,id:expected.id,field:'missing'});continue;}if(actual.deleted_at)mismatches.push({table:t.table,id:expected.id,field:'deleted_at'});for(const [key,column]of Object.entries(t.fields))if(canonical(expected[key])!==canonical(actual[column]))mismatches.push({table:t.table,id:expected.id,field:column});}
 }
 const total=await c.query('SELECT c.slug,count(DISTINCT m.id)::int AS modules,count(DISTINCT l.id)::int AS lessons,count(b.id)::int AS blocks FROM courses c JOIN modules m ON m.course_id=c.id AND m.deleted_at IS NULL JOIN lessons l ON l.module_id=m.id AND l.deleted_at IS NULL JOIN lesson_blocks b ON b.lesson_id=l.id AND b.deleted_at IS NULL WHERE c.id=ANY($1::uuid[]) GROUP BY c.slug ORDER BY c.slug',[seed.courses.map(x=>x.id)]);
 await c.query('ROLLBACK');
 const report={timestamp:new Date().toISOString(),counts,perCourse:total.rows,mismatches,baseSeedMatchesDatabase:mismatches.length===0,sqlSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'../english-foundations-seed.sql'))).digest('hex')};
 fs.writeFileSync(path.join(dir,'database-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(mismatches.length)process.exitCode=1;
}finally{await c.end();}
