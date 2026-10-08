import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const assets=path.join(dir,'../assets/english-foundations');
// Native SVG keeps the grammar labels exact and readable at any screen size.
const data=[
 [1,'Letters and sounds','ชื่ออักษรกับเสียงในคำ',['LETTER NAME','SOUND IN A WORD','STRESS'],['B → /biː/','bag → /b/','TEAcher · baNAna'],'สะกดด้วยชื่ออักษร อ่านด้วยเสียง และฟังคำเต็ม'],
 [2,'Build a sentence','จากคำสู่ประโยค',['SUBJECT','VERB','OBJECT'],['Mai','reads','books'],'ใคร → ทำอะไร → กับสิ่งใด  •  บางกริยาไม่ต้องมีกรรม'],
 [3,'One or more?','คำนามและจำนวน',['ONE','MORE THAN ONE','IRREGULAR'],['a book','three books','child → children'],'คำนามนับได้: ดูจำนวน แล้วเลือกรูปเอกพจน์หรือพหูพจน์'],
 [4,'Choose your be','จับคู่ประธานกับ be',['I','HE · SHE · IT','YOU · WE · THEY'],['am','is','are'],'บอกตัวตน สภาพและตำแหน่ง  •  คำถามย้าย be ขึ้นหน้า'],
 [5,'A, an or the?','ดูเสียงและสิ่งที่ระบุได้',['ONE, NOT SPECIFIED','VOWEL SOUND FIRST','IDENTIFIABLE'],['a book','an hour','the book on this desk'],'a/an ตามเสียง  •  the เมื่อระบุได้  •  books กล่าวทั่วไป'],
 [6,'Point and own','ชี้สิ่งของและบอกเจ้าของ',['NEAR · ONE','FAR · MANY','POSSESSION'],['this book','those books','my bag → mine'],'this/that + is  •  these/those + are  •  mine ไม่มี noun ตาม'],
 [7,'Describe clearly','คำบรรยายไม่เติม s ตามจำนวน',['BEFORE A NOUN','AFTER BE','FEELING / CAUSE'],['a small blue bag','The bags are small.','bored / boring'],'adjective บรรยาย noun  •  สภาพใช้ be เชื่อม'],
 [8,'Who controls the verb?','ดูประธาน ไม่ใช่จำนวนกรรม',['I · YOU · WE · THEY','HE · SHE · IT','TWO DIFFERENT s'],['read books','reads books','reads ≠ books'],'s ของกริยาตามประธาน  •  s ของคำนามบอกจำนวน'],
 [9,'Who receives it?','ประธานกับกรรมใช้คนละรูป',['SUBJECT','OBJECT','AFTER PREPOSITION'],['I · he · they','me · him · them','with me · for her'],'She helps me.  ↔  I help her.'],
 [10,'Do and does','ถามและปฏิเสธกริยาทั่วไป',['QUESTION','NEGATIVE','SHORT ANSWER'],['Does she work?','She doesn’t work.','Yes, she does.'],'หลัง do/does ใช้ base verb  •  be ใช้ Is/Are แยกกัน'],
 [11,'Time and dates','เลือกบุพบทตามชนิดเวลา',['IN','ON','AT'],['in October','on Monday','at 7:30'],'every day / next week / last year ไม่เติม preposition ในรูปทั่วไป'],
 [12,'Frequency or duration?','ถามคนละชนิดข้อมูล',['HOW OFTEN?','HOW LONG?','WHEN?'],['twice a week','for an hour','at seven'],'I usually read.  •  I am usually at home.  •  ไม่มีเปอร์เซ็นต์ตายตัว'],
 [13,'Place and movement','ตำแหน่งกับเส้นทาง',['POSITION','MOVEMENT','EXISTENCE'],['in the room','into the room','There are two chairs.'],'in: อยู่ภายใน  •  into: เคลื่อนเข้า  •  there: แนะนำว่ามี'],
 [14,'Many or much?','นับหน่วยหรือบอกปริมาณ',['COUNTABLE PLURAL','UNCOUNTABLE','A UNIT + OF'],['many apples','much water','two bottles of water'],'a few apples  •  a little rice  •  enough + noun'],
 [15,'Refer without repeating','อ้างกลับให้ชัดเจน',['EVERYONE','ONE / ONES','SELF / EACH OTHER'],['Everyone is ready.','the blue one','help yourself / help each other'],'ดูจำนวน หน้าที่และสิ่งที่อ้างกลับ ไม่แปลคำโดดอย่างเดียว'],
 [16,'How do you do it?','คุณลักษณะกับวิธีทำ',['ADJECTIVE','ADVERB','ENOUGH'],['a careful driver','drives carefully','big enough / enough space'],'very = มาก  •  too = มากเกินเกณฑ์'],
 [17,'Usually or now?','กิจวัตรกับกำลังทำ',['USUALLY','AT THE MOMENT','THE COMPLETE FORM'],['She reads.','She is reading.','am / is / are + ing'],'ดูความหมายทั้งประโยค  •  know/want มัก simple ในความหมายพื้นฐาน'],
 [18,'Ask and act','คำสั่ง ความสามารถและคำขอ',['IMPERATIVE','ABILITY','REQUEST / PERMISSION'],['Open it. / Don’t run.','She can swim.','Can you help? / Can I sit?'],'base verb หลัง can, Don’t และ Let’s'],
 [19,'Be in the past','เล่าสภาพและสถานที่อดีต',['I · HE · SHE · IT','YOU · WE · THEY','QUESTION'],['was / wasn’t','were / weren’t','Where were you?'],'be อดีตไม่ใช้ didn’t be  •  There was / There were'],
 [20,'Three verb forms','รูปเดียวกันไม่ได้แปลว่าหน้าที่เดียวกัน',['V1 · BASE','V2 · PAST','V3 · PARTICIPLE'],['go · eat · see','went · ate · saw','gone · eaten · seen'],'I went yesterday.  •  I didn’t go.  •  I have seen it.'],
 [21,'Tell the scene and event','ฉากหลังกับเหตุการณ์หลัก',['BACKGROUND','EVENT','TOGETHER'],['I was reading.','The phone rang.','while + ongoing activity'],'I was reading when the phone rang.  •  continuous ไม่ต้องมีเหตุการณ์แทรกเสมอ'],
 [22,'Different future meanings','เลือกจากแผน นัดและบริบท',['INTENTION','DECISION / OFFER','ARRANGEMENT / TABLE'],['I’m going to study.','I’ll help you.','I’m meeting Mai. / It leaves.'],'รูปต่าง ๆ ทับซ้อนกันได้บางบริบท ไม่ใช่สูตรแยกเด็ดขาด'],
 [23,'Compare your choices','ขั้นกว่า เท่ากันและที่สุด',['COMPARATIVE','EQUAL','SUPERLATIVE'],['smaller than','as big as','the smallest'],'good → better → best  •  well → better  •  ไม่ใช้ more better'],
 [24,'Meaning matters','หน้าที่ ห้ามและไม่จำเป็น',['OBLIGATION','PROHIBITION','NOT NECESSARY'],['You have to go.','You mustn’t go.','You don’t have to go.'],'ห้ามทำ ≠ ไม่จำเป็น  •  should: คำแนะนำ  •  might: อาจเป็นไปได้'],
 [25,'Past connected to now','Present Perfect และ V3',['FORM','DURATION / START','FINISHED PAST TIME'],['have / has + V3','for two years / since 2024','I saw her yesterday.'],'I have seen it.  •  Have you ever…?  •  รายละเอียดอดีตจบใช้ Past Simple'],
 [26,'Which form comes next?','กริยาต่อกริยา',['TO + BASE','ING','BASE ONLY'],['want to go','enjoy going','can go'],'after eating  •  good at swimming  •  ing ไม่ใช่ continuous ทุกคำ'],
 [27,'Connect your ideas','เหตุผล ผลและจุดประสงค์',['REASON','RESULT','PURPOSE'],['I stayed because it rained.','It rained, so I stayed.','I read to learn.'],'I’ll call when I arrive.  •  present ใน time clause อนาคต'],
 [28,'Conditions and results','เงื่อนไขทั่วไปกับอนาคตที่เป็นไปได้',['GENERAL RESULT','POSSIBLE FUTURE','IF / WHEN'],['If I’m tired, I rest.','If it rains, I’ll stay.','uncertain / expected'],'if + present ในรูปที่ฝึก  •  ส่วนผลใช้ will/can/คำสั่งตามความหมาย'],
 [29,'Which person or thing?','ใช้ clause ระบุคำนาม',['PERSON','THING','PLACE'],['the person who helps me','the book I read','the cafe where we meet'],'ไม่ซ้ำ he/it/there ในส่วนขยาย  •  กรรมละ relative pronoun ได้บางรูป'],
 [30,'Report and ask politely','คำพูดและคำถามทางอ้อม',['SAY','TELL','INDIRECT QUESTION'],['She says she is ready.','She tells me she is ready.','Do you know where it is?'],'ส่วนย่อยใช้ subject + verb  •  ไม่ใช้ where is it ซ้อนในคำถามทางอ้อม'],
 [31,'Focus on the receiver','Active และ Passive',['ACTIVE','PASSIVE PRESENT','PASSIVE PAST'],['Mai makes the cake.','The cake is made here.','The cake was made by Mai.'],'be + V3  •  by ระบุผู้ทำเมื่อมีประโยชน์  •  made of ระบุวัสดุ'],
 [32,'Learn words you can use','ศัพท์พร้อมเสียง หน้าที่และกลุ่มคำ',['WORD FAMILY','COLLOCATION','PHRASAL VERB'],['teach → teacher','do homework','turn it off'],'ตรวจความหมายในบริบท  •  บันทึกตัวอย่าง  •  ทบทวนโดยปิดคำตอบ'],
 [33,'Make the message clear','เสียงท้าย เสียงเน้นและวลี',['ENDING SOUNDS','WORD STRESS','CONNECTED SPEECH'],['cups · bags · buses','TEAcher · aBOUT','turn‿it‿off'],'จังหวะช่วยผู้ฟังรับข้อมูล  •  ความเข้าใจได้คือเป้าหมาย'],
 [34,'Listen and read with a goal','ใจความ รายละเอียดและการแก้ข้อมูล',['FIRST PASS','SECOND PASS','CHECK THE REPAIR'],['Who? Why?','When? Where? How many?','seven → sorry, seven thirty'],'ใช้ข้อมูลสุดท้ายที่ยืนยัน  •  สรุปโดยไม่เติมข้อเท็จจริงเอง'],
 [35,'Keep the conversation going','ตอบ ถามกลับและแก้ความไม่เข้าใจ',['ANSWER + ASK','CLARIFY','CLOSE POLITELY'],['How about you?','Could you repeat that?','See you later.'],'พูดและเขียนเพื่อจุดประสงค์  •  ตรวจข้อความแล้วแก้หนึ่งรอบ'],
 [36,'Show what you can do','หลักฐานก่อนเลือกทางต่อยอด',['UNDERSTAND','COMMUNICATE','REVIEW'],['listen + read','speak + write','feedback → practise again'],'ข้อเลือกตอบตรวจอัตโนมัติ  •  งานพูด/เขียนใช้ตนเองหรือครูตรวจ'],
];
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function lines(text,max=23){const words=text.split(' ');const result=[];let current='';for(const w of words){if((current+' '+w).trim().length>max&&current){result.push(current);current=w;}else current=(current+' '+w).trim();}if(current)result.push(current);return result;}
const manifest=[];
for(const [n,title,kicker,labels,examples,foot]of data){
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560"><rect width="1200" height="560" rx="28" fill="#fffaf2"/><g font-family="Tahoma,Arial,sans-serif"><text x="60" y="63" fill="#258578" font-size="18" letter-spacing="2">ENGLISH FOUNDATIONS · M'+String(n).padStart(2,'0')+'</text><text x="60" y="119" fill="#233b3a" font-size="40" font-weight="bold">'+xml(title)+'</text><text x="60" y="160" fill="#566e6c" font-size="23">'+xml(kicker)+'</text>';
 labels.forEach((label,i)=>{const x=60+i*366;svg+='<rect x="'+x+'" y="207" width="346" height="231" rx="19" fill="'+['#e4f3ed','#fbe6df','#e8ecfb'][i]+'"/><text x="'+(x+24)+'" y="249" fill="#49615d" font-size="16" font-weight="bold">'+xml(label)+'</text>';examples[i].split(" / ").flatMap(part=>lines(part)).forEach((line,j)=>{svg+='<text x="'+(x+24)+'" y="'+(302+j*41)+'" fill="#263d3a" font-size="25" font-weight="bold">'+xml(line)+'</text>';});});
 svg+='<text x="60" y="495" fill="#425d58" font-size="20">'+xml(foot)+'</text><text x="60" y="533" fill="#71847f" font-size="15">สังเกตรูป → เข้าใจความหมาย → ลองใช้ข้อมูลของคุณ</text></g></svg>';
 const file='module-'+String(n).padStart(2,'0')+'-map.svg';fs.writeFileSync(path.join(assets,file),svg);manifest.push({module:n,file,title,kicker,alt:kicker+': '+examples.join('; '),caption:foot});
}
fs.writeFileSync(path.join(assets,'diagram-plan.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({diagrams:manifest.length,format:'native SVG',purpose:'exact grammar labels and visual comparison'}));
