import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {missionImageIds} from '../lib/mission-images.js';
await mkdir('artifacts/mission-image-audit',{recursive:true});
for(let start=0;start<missionImageIds.length;start+=6){
  const cells=[];
  for(let j=0;j<Math.min(6,missionImageIds.length-start);j++){
    const id=missionImageIds[start+j];
    cells.push({input:await sharp(`public/images/research-missions/${id}.webp`).extract({left:0,top:0,width:640,height:600}).resize(384,360).toBuffer(),left:(j%3)*384,top:Math.floor(j/3)*388});
    cells.push({input:Buffer.from(`<svg width="384" height="28"><text x="8" y="20" fill="white" font-size="18" font-family="Arial">${id}</text></svg>`),left:(j%3)*384,top:Math.floor(j/3)*388+360});
  }
  await sharp({create:{width:1152,height:776,channels:3,background:'#102d22'}}).composite(cells).jpeg({quality:95}).toFile(`artifacts/mission-image-audit/sheet-${Math.floor(start/6)+1}.jpg`);
}
