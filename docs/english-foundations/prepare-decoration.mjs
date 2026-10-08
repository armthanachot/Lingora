import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const assets=path.join(dir,'../assets/english-foundations');
const seed=JSON.parse(fs.readFileSync(path.join(dir,'compiled.json'),'utf8'));
const uploads=JSON.parse(fs.readFileSync(path.join(assets,'uploads.json'),'utf8'));
const diagrams=JSON.parse(fs.readFileSync(path.join(assets,'diagram-plan.json'),'utf8'));
const intended=new Map();
function place(code,file,alt,caption,prompt){
 if(!uploads[file]?.publicVerified)throw new Error('Image not publicly verified: '+file);
 const a=intended.get(code)||[];a.push({file,url:uploads[file].url,alt,caption,prompt});intended.set(code,a);
}
const primary=['01.01','02.02','03.03','04.01','05.03','06.01','07.01','08.05','09.01','10.02','11.06','12.04','13.03','14.04','15.05','16.01','17.04','18.04','19.01','20.06','21.02','22.03','23.04','24.04','25.06','26.03','27.02','28.03','29.03','30.04','31.01','32.03','33.04','34.02','35.02','36.01'];
for(const item of diagrams){
 const code=primary[item.module-1];
 place(code,item.file,item.alt,item.caption,'ชี้ส่วนที่สัมพันธ์กับตัวอย่างในบท แล้วอธิบายด้วยคำของคุณก่อนดูข้อทดสอบ');
 if(item.module<36)place(String(item.module).padStart(2,'0')+'.CP',item.file,item.alt,item.caption,'ปิดตัวอย่างแล้วลองนึกโครงสร้าง จากนั้นใช้ภาพตรวจเหตุผลของคำตอบอีกครั้ง');
}
for(const code of ['03.03','05.01','05.02','05.03','05.05','06.01','06.04','07.02','07.03']){
 place(code,'study-desk.png','โต๊ะที่มีหนังสือสีแดงหนึ่งเล่ม สีฟ้าหนึ่งเล่ม ดินสอสามแท่ง แอปเปิลหนึ่งผลและร่มหนึ่งคัน','Two books, three pencils, an apple and an umbrella.','เลือกของสองชนิดในภาพ บอกจำนวน สีหรือคำชี้ให้ตรงหัวข้อบทนี้ แล้วแต่งประโยคใหม่ของคุณ');
}
for(const code of ['08.03','08.05','12.01','13.02','17.01','17.06']){
 place(code,'park-activities.png','ผู้หญิงเสื้อฟ้าอ่านหนังสือ ผู้ชายเสื้อแดงวิ่ง คนสองคนเดินและสุนัขนอนใต้ต้นไม้','Four people are in the park. A woman is reading, a man is running, and two people are walking.','ชี้คนที่หมายถึงก่อนบรรยาย แยกสิ่งที่เห็นตอนนี้จากกิจวัตรที่คุณต้องการสมมติ แล้วใช้รูปประโยคตามบท');
}
for(const code of ['03.05','14.01','14.02','14.04','14.05','14.07']){
 place(code,'pantry-counting.png','แอปเปิลสามผล น้ำสองขวด ข้าวหนึ่งชาม ขนมปังหนึ่งก้อนกับสองแผ่นและนมหนึ่งแก้ว','Three apples, two bottles of water, a bowl of rice, a loaf of bread, two slices of bread and a glass of milk.','แยกสิ่งที่นับโดยตรงจากปริมาณที่ต้องมีหน่วย แล้วเขียนรายการเตรียมอาหารสำหรับสองคน');
}
for(const code of ['19.01','20.03','20.07','21.02','21.03','21.04','21.05','22.01','27.05','28.03','35.07']){
 place(code,'rain-story.png','ภาพสามช่อง Mai เดินในสวน จากนั้นฝนตก Ben ใช้ร่มช่วยและทั้งคู่ถึงร้านกาแฟ','Mai was walking when it began to rain. Ben opened his umbrella. Then they reached a cafe.','ใช้ภาพเป็นเรื่องใหม่สำหรับฝึก ไม่เปลี่ยนข้อเท็จจริงของตัวอย่างเดิม เล่าลำดับที่เห็น หรือเสนอแผนเมื่อมีฝนตามหัวข้อบท');
}
const plan=[];
for(const [code,images]of intended){
 const lesson=seed.lessons.find(l=>l.code===code);if(!lesson)throw new Error('Missing lesson '+code);
 const block=seed.blocks.find(b=>b.lessonId===lesson.id&&b.type==='reading');
 const snippet='\n\n### ดูภาพแล้วลองใช้\n\n'+images.map(x=>'!['+x.alt+']('+x.url+')\n\n*'+x.caption+'*\n\n'+x.prompt).join('\n\n');
 const marker='\n\n### ลองสังเกต';
 const body=block.content.body.includes(marker)?block.content.body.replace(marker,snippet+marker):block.content.body+snippet;
 plan.push({code,lessonId:lesson.id,blockId:block.id,title:lesson.title,baseBodySha256:crypto.createHash('sha256').update(block.content.body).digest('hex'),body,images,uiSaved:false,dbVerified:false});
}
plan.sort((a,b)=>a.code.localeCompare(b.code));
fs.writeFileSync(path.join(dir,'decoration-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({lessonsToDecorate:plan.length,imagePlacements:plan.reduce((s,p)=>s+p.images.length,0),uniqueImages:new Set(plan.flatMap(p=>p.images.map(x=>x.file))).size,uiSaved:0,dbVerified:0}));
