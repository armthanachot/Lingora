import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const requireApi=createRequire(path.join(dir,'../../lingora-api/package.json'));
requireApi('dotenv').config({path:path.join(dir,'../../lingora-api/.env'),quiet:true});
const {Client}=requireApi('pg');
const mode=process.argv[2];
if(!['--dry-run','--execute','--verify'].includes(mode))throw new Error('Use --dry-run, --execute or --verify');
const seed=JSON.parse(fs.readFileSync(path.join(dir,'compiled.json'),'utf8'));
const sql=fs.readFileSync(path.join(dir,'../english-foundations-seed.sql'),'utf8');
if(!sql.trimEnd().endsWith('COMMIT;'))throw new Error('Unexpected seed ending');
const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
const expectedIds={courses:seed.courses.map(c=>c.id),modules:seed.modules.map(m=>m.id),lessons:seed.lessons.map(l=>l.id),lesson_blocks:seed.blocks.map(b=>b.id)};
async function counts(){const result={};for(const table of Object.keys(expectedIds))result[table]=Number((await client.query('SELECT count(*) AS n FROM '+table+' WHERE deleted_at IS NULL')).rows[0].n);return result;}
async function verify(){const result={};for(const [table,ids]of Object.entries(expectedIds)){const r=await client.query('SELECT count(*) AS n FROM '+table+' WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL',[ids]);result[table]=Number(r.rows[0].n);if(result[table]!==ids.length)throw new Error('Expected seed rows missing in '+table);}return result;}
try{
 await client.connect();
 const before=await counts();
 if(mode!=='--verify'){
  await client.query(mode==='--dry-run'?sql.replace(/COMMIT;\s*$/,'ROLLBACK;'):sql);
  // Dry-run transaction itself includes complete row-count assertions before rollback.
 }
 const actual=mode==='--dry-run'?null:await verify();
 const after=await counts();
 if(mode==='--dry-run'&&JSON.stringify(before)!==JSON.stringify(after))throw new Error('Dry-run changed row counts');
 const result={mode,timestamp:new Date().toISOString(),sqlFile:'docs/english-foundations-seed.sql',before,after,actual,status:'passed'};
 const file=path.join(dir,'execution-report.json');const history=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
 history.push(result);fs.writeFileSync(file,JSON.stringify(history,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({status:'failed',code:error.code||error.name,message:error.message}));process.exitCode=1;}
finally{await client.end();}
