import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const assets=path.join(dir,'../assets/english-foundations');
function waveData(bytes){
 if(bytes.toString('ascii',0,4)!=='RIFF')return null;
 let offset=12;
 while(offset+8<=bytes.length){const tag=bytes.toString('ascii',offset,offset+4);const size=bytes.readUInt32LE(offset+4);if(tag==='data')return bytes.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
 return null;
}
function validWave(file){
 if(!fs.existsSync(file))return false;
 const data=waveData(fs.readFileSync(file));if(!data||data.length<22050)return false;
 for(let i=0;i+1<data.length;i+=2)if(Math.abs(data.readInt16LE(i))>100)return true;
 return false;
}
const overrides={
 '01.01':'The letter B. Bag. The letter M. Mai. My name is Ben. B. E. N.',
 '01.02':'Light. Right. Light. Right. Vest. West. Vest. West. Think. This. Ship. Chip.',
 '01.03':'Ship. Sheep. Ship. Sheep. Bed. Bad. Bed. Bad. Tea. Bread. A sheep is on the ship.',
 '01.04':'Cap. Cat. Cap. Cat. Book. Books. One book. Two books. Stop. Books.',
 '01.05':'Cap. Cape. Cap. Cape. Rain. Train. Shop. Chair. Three. Know. Walk.',
 '01.06':'Teacher. Teacher. Banana. Banana. About. About. Student. Today.',
 '08.05':'She works. He plays. She watches. Mai studies English. Her friends study English.',
 '20.02':'Walked. Played. Wanted. Needed. I walked home. I played tennis. I wanted tea.',
 '21.05':'At six, Mai was walking home. It began to rain. Ben saw her and gave her an umbrella. Then Mai went home.',
 '33.01':'Cups. Bags. Buses. Cups. Bags. Buses. Walked. Played. Wanted. Walked. Played. Wanted.',
 '33.02':'About. Teacher. Banana. About. Teacher. Banana. My teacher is kind.',
 '33.03':'I bought a blue bag. After work, I went home and cooked dinner.',
 '33.04':"I'm ready. He doesn't work here. I'll help you. I've finished. She's tired. She's done it.",
 '33.05':'Turn it off. Please turn it off. Can you help me? Where are you?',
 '34.01':'Hi Ben, this is Mai. Would you like to study English together? We can meet at the library at six this evening. Please bring your book. See you there.',
 '34.02':'Let us meet at seven. Sorry, I mean seven thirty. The ticket is fifteen pounds, not fifty. We need thirteen tickets, not thirty.',
 '36.02':'Hi Ben, would you like to practise English together on Saturday? Let us meet at ten. Sorry, I mean ten thirty. We are meeting in room three. Please bring a pencil and some water. Three people are coming. Actually, four people are coming now. Can you join us?',
 '36.05':'I visited Mai yesterday. Would you like to meet on Sunday? I enjoyed studying with you. Please bring a notebook and a pencil.',
 '36.06':"I didn't go home. I need some water. How much water do we need? How many books do you have? Could you repeat the time, please?",
};
const plan=[];
for(const n of [1,2,3,4]){
 const {lessons}=await import(path.join(dir,'content-'+n+'.mjs'));
 for(const [code,k]of Object.entries(lessons)){
  // Examples supply pronunciation practice throughout all four courses.
  const text=overrides[code]||k.examples.map(e=>e[0]).join('. ').replaceAll(' / ','. ').replaceAll(' — ','. ').replaceAll('→',', ').replace(/[~|]/g,' ').trim();
  const name='lesson-'+code.replace('.','-')+'.wav';
  const voice=n%2?'Samantha':'Daniel';
  const target=path.join(assets,name);
  if(!validWave(target)){
   const aiff=target+'.aiff';
   let r=spawnSync('rtk',['proxy','say','-v',voice,'-r',code.startsWith('01.')?'125':'145','-o',aiff,text],{encoding:'utf8'});
   if(r.status!==0)throw new Error('Speech synthesis failed for '+code);
   r=spawnSync('rtk',['proxy','afconvert','-f','WAVE','-d','LEI16',aiff,target],{encoding:'utf8'});
   if(r.status!==0)throw new Error('Audio conversion failed for '+code);
   fs.unlinkSync(aiff);
  }
  const bytes=fs.readFileSync(target);
  if(!validWave(target))throw new Error('Missing or silent audio '+code);
  plan.push({code,file:name,transcript:text,voice,engine:'macOS say (synthetic teaching audio)',rate:code.startsWith('01.')?125:145});
  if(plan.length%25===0)console.log(JSON.stringify({generated:plan.length}));
 }
}
fs.writeFileSync(path.join(assets,'audio-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({audioFiles:plan.length,bytes:plan.reduce((s,p)=>s+fs.statSync(path.join(assets,p.file)).size,0)}));
