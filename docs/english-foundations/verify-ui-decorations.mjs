import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const requireApi=createRequire(path.join(dir,'../../lingora-api/package.json'));
requireApi('dotenv').config({path:path.join(dir,'../../lingora-api/.env'),quiet:true});
const {Client}=requireApi('pg');
const plan=JSON.parse(fs.readFileSync(path.join(dir,'decoration-plan.json'),'utf8'));
const proofFile=path.join(dir,'ui-save-proof.json');
const proof=fs.existsSync(proofFile)?JSON.parse(fs.readFileSync(proofFile,'utf8')):{codes:[]};
const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 await client.connect();await client.query('BEGIN READ ONLY');
 const rows=(await client.query('SELECT id,content FROM lesson_blocks WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL',[plan.map(p=>p.blockId)])).rows;
 const byId=new Map(rows.map(r=>[r.id,r.content]));
 const verified=[],pending=[],mismatches=[],decoratedBodies=[];
 for(const p of plan){
  const content=byId.get(p.blockId),body=content?.body;
  p.uiSaved=proof.codes.includes(p.code);
  p.dbVerified=body===p.body;
  if(p.dbVerified){verified.push(p.code);decoratedBodies.push({code:p.code,blockId:p.blockId,baseBodySha256:p.baseBodySha256,body});}
  else if(body&&crypto.createHash('sha256').update(body).digest('hex')===p.baseBodySha256)pending.push(p.code);
  else mismatches.push(p.code);
 }
 await client.query('ROLLBACK');
 const report={timestamp:new Date().toISOString(),planned:plan.length,verified:verified.length,pending,mismatches,uiSaved:proof.codes.length,imagePlacements:plan.filter(p=>p.dbVerified).reduce((sum,p)=>sum+p.images.length,0)};
 fs.writeFileSync(path.join(dir,'decoration-audit.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'decoration-plan.json'),JSON.stringify(plan,null,2)+'\n');
 if(process.argv.includes('--final')){
  if(verified.length!==plan.length||mismatches.length||plan.some(p=>!p.uiSaved))throw new Error('UI decoration not fully verified');
  fs.writeFileSync(path.join(dir,'verified-ui-decorations.json'),JSON.stringify(decoratedBodies,null,2)+'\n');
 }
 console.log(JSON.stringify(report,null,2));
 if(mismatches.length)process.exitCode=1;
}finally{await client.end();}
