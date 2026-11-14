import sharp from 'sharp';
import {missionImageIds,missionImageFor} from '../lib/mission-images.js';
const cells=[];
for(let i=0;i<missionImageIds.length;i++){
  const id=missionImageIds[i];
  cells.push({input:await sharp(`public${missionImageFor(id)}`).resize(128,180).toBuffer(),left:(i%9)*136+4,top:Math.floor(i/9)*204});
  cells.push({input:Buffer.from(`<svg width="136" height="24"><text x="5" y="16" fill="#e4edcb" font-size="10" font-family="Arial">${id}</text></svg>`),left:(i%9)*136,top:Math.floor(i/9)*204+180});
}
await sharp({create:{width:1224,height:1224,channels:3,background:'#102d22'}}).composite(cells).jpeg({quality:88}).toFile('artifacts/research-mission-contact-sheet.jpg');
console.log('Contact sheet saved.');
