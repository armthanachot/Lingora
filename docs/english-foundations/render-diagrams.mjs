import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const assets=path.join(dir,'../assets/english-foundations');
const runtime=createRequire('/Users/thanachottesjaroen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/runtime.js');
const sharp=runtime('sharp');
const file=path.join(assets,'diagram-plan.json');
const plan=JSON.parse(fs.readFileSync(file,'utf8'));
for(const item of plan){
 const svg=item.svgSource||item.file;
 const png=svg.replace(/\.svg$/,'.png');
 await sharp(path.join(assets,svg)).png().toFile(path.join(assets,png));
 item.svgSource=svg;item.file=png;
}
fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({rendered:plan.length,width:1200,height:560,format:'PNG',editableSource:'SVG'}));
