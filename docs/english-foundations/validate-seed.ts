import { readFileSync } from 'node:fs';
import { normalizeBlockDefinition } from '../../lingora-api/src/modules/lessons/block-contract';
const seed=JSON.parse(readFileSync(new URL('./compiled.json',import.meta.url),'utf8'));
const seen=new Set<string>();
for(const section of ['courses','modules','lessons','blocks'])for(const item of seed[section]){
 if(seen.has(item.id))throw new Error('Duplicate UUID '+item.id);seen.add(item.id);
}
const courseIds=new Set(seed.courses.map((c:any)=>c.id));
const moduleIds=new Set(seed.modules.map((m:any)=>m.id));
const lessonIds=new Set(seed.lessons.map((l:any)=>l.id));
for(const m of seed.modules)if(!courseIds.has(m.courseId))throw new Error('Orphan module');
for(const l of seed.lessons)if(!moduleIds.has(l.moduleId))throw new Error('Orphan lesson');
const blockGroups=new Map<string,any[]>();
for(const b of seed.blocks){
 if(!lessonIds.has(b.lessonId))throw new Error('Orphan block');
 normalizeBlockDefinition(b);
 if(b.type==='reading'&&(!b.content.body.trim()||/TODO|placeholder|coming soon/i.test(b.content.body)))throw new Error('Unfinished content');
 if(b.type==='multiple_choice'&&(!b.content.question.trim()||!b.content.explanation.trim()||b.content.choices.some((c:any)=>!c.text.trim())))throw new Error('Incomplete question');
 if(b.type==='audio'&&!/^https:\/\//.test(b.content.media.url))throw new Error('Audio URL missing');
 const a=blockGroups.get(b.lessonId)||[];a.push(b);blockGroups.set(b.lessonId,a);
}
for(const l of seed.lessons){
 const a=blockGroups.get(l.id)||[];
 if(a.length<4||a.filter(b=>b.type==='multiple_choice').length<2||a.filter(b=>b.type==='reading').length<2)throw new Error('Lesson lacks teaching, practice or production: '+l.code);
 a.sort((x,y)=>x.sortOrder-y.sortOrder).forEach((b,i)=>{if(b.sortOrder!==i+1)throw new Error('Invalid block order: '+l.code);});
 if(!l.code.endsWith('CP')&&!l.code.endsWith('FINAL')&&a.filter(b=>b.type==='audio').length!==1)throw new Error('Missing pronunciation/listening: '+l.code);
}
if(seed.courses.length!==4||seed.modules.length!==36||seed.lessons.length!==236)throw new Error('Scope mismatch');
console.log(JSON.stringify({status:'passed',courses:4,modules:36,lessons:236,blocks:seed.blocks.length,contractValidated:true,relationsValidated:true,minimumTeachingPracticeProductionValidated:true},null,2));
