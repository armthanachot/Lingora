import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const requireApi=createRequire(path.join(dir,'../../lingora-api/package.json'));
requireApi('dotenv').config({path:path.join(dir,'../../lingora-api/.env'),quiet:true});
const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SECRET_KEY;
const bucket=process.env.SUPABASE_STORAGE_BUCKET||'lesson-media';
if(!base||!key)throw new Error('Supabase storage is not configured in api .env');
const assetsDir=path.join(dir,'../assets/english-foundations');
const manifestPath=path.join(assetsDir,'uploads.json');
const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
async function uploadName(name){
 if(!/^[a-z0-9._-]+\.(png|webp|jpg|svg|wav|m4a)$/.test(name))throw new Error('Invalid media name');
 const bytes=fs.readFileSync(path.join(assetsDir,name));
 const checksum=crypto.createHash('sha256').update(bytes).digest('hex');
 const mime=({png:'image/png',webp:'image/webp',jpg:'image/jpeg',svg:'image/svg+xml',wav:'audio/wav',m4a:'audio/mp4'})[name.split('.').pop()];
 const storagePath='english-foundations/v1/'+checksum.slice(0,16)+'-'+name;
 const encoded=storagePath.split('/').map(encodeURIComponent).join('/');
 const url=process.env.SUPABASE_STORAGE_PUBLIC_URL?process.env.SUPABASE_STORAGE_PUBLIC_URL.replace(/\/$/,'')+'/'+encoded:base+'/storage/v1/object/public/'+encodeURIComponent(bucket)+'/'+encoded;
 let head=await fetch(url,{method:'HEAD'});
 if(!head.ok){
  const response=await fetch(base+'/storage/v1/object/'+encodeURIComponent(bucket)+'/'+encoded,{method:'POST',headers:{apikey:key,'Content-Type':mime,'x-upsert':'false'},body:bytes});
  if(!response.ok)throw new Error('Storage upload failed: HTTP '+response.status);
  head=await fetch(url,{method:'HEAD'});
 }
 if(!head.ok)throw new Error('Media URL is not publicly accessible: HTTP '+head.status);
 manifest[name]={url,storagePath,mimeType:mime,originalName:name,sha256:checksum,bytes:bytes.length,publicVerified:true};
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({file:name,bytes:bytes.length,publicVerified:true}));
}
const args=process.argv.slice(2);
const names=args.includes('--audio')?JSON.parse(fs.readFileSync(path.join(assetsDir,'audio-plan.json'),'utf8')).map(p=>p.file):args;
let cursor=0;
const outcomes=await Promise.allSettled(Array.from({length:Math.min(4,names.length)},async()=>{while(cursor<names.length){const name=names[cursor++];await uploadName(name);}}));
const failures=outcomes.filter(r=>r.status==='rejected');
if(failures.length)throw new Error('One or more media uploads failed; successful uploads are saved in uploads.json. '+failures.map(r=>r.reason.message).join('; '));
