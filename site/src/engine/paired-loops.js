import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';

/** Two staggered families of bonded, loop-shaped rows on separate print planes. */
export function pairedLoopsLayers(boundary,{loopWidth=4,aspect=1.8,rowPitch=null,offset=.5}={}){
  const box=boundary.bbox(),w=Math.max(2,Number(loopWidth)||4),a=Math.max(1.2,Math.min(2.6,Number(aspect)||1.8)),h=w*a,overlap=.7,pitchY=Math.min(Math.max(.5,Number(rowPitch)||w*a*.6),h-overlap),shift=Math.max(.25,Math.min(.75,Number(offset)||.5)),dx=Math.min(w*.8,w-overlap),cols=Math.ceil((box.maxX-box.minX)/dx)+1,rows=Math.ceil((box.maxY-box.minY)/pitchY)+1;
  if(rows*cols*64>MAX_MOVES)throw new ConfigError(['This paired-loop layout exceeds the move budget. Use larger loops or a smaller swatch.']);
  const families=[[],[]],n=64;
  for(let family=0;family<2;family++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cx=box.minX+w/2+i*dx+(family?shift*w:0),cy=box.minY+h/2+j*pitchY;
    if(cx-w/2<box.minX||cx+w/2>box.maxX||cy-h/2<box.minY||cy+h/2>box.maxY)continue;
    const pts=Array.from({length:n+1},(_,k)=>{const t=2*Math.PI*k/n;return{x:cx+w/2*Math.cos(t),y:cy+h/2*Math.sin(t)};});
    Object.assign(pts,{id:`${family?'B':'A'}-${j}-${i}`,family:family?'loops-B':'loops-A',role:'native',source:'paired-loops',rowOrder:j});families[family].push(pts);
  }
  const layers=families;layers.families=['loops-A','loops-B'];layers.extra={planes:true,families:layers.families,loopCountA:families[0].length,loopCountB:families[1].length};return layers;
}
