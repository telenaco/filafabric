import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';

/** Two staggered families of bonded, loop-shaped rows on separate print planes. */
export function pairedLoopsLayers(boundary,{loopWidth=4,aspect=1.8,rowPitch=null,offset=.5}={}){
  // Within a family the loops only touch (a hair apart, so their beads fuse without crossing, and nothing is lifted in its plane);
  // the second family sits in the first one's gaps, so every loop of it crosses its four neighbours in the plane below.
  const box=boundary.bbox(),w=Math.max(2,Number(loopWidth)||4),a=Math.max(1.2,Math.min(2.6,Number(aspect)||1.8)),h=w*a,kiss=.05,pitchY=Math.min(Math.max(2,Number(rowPitch)||h+kiss),h+kiss),shift=Math.max(.25,Math.min(.75,Number(offset)||.5)),dx=w+kiss,cols=Math.ceil((box.maxX-box.minX)/dx)+1,rows=Math.ceil((box.maxY-box.minY)/pitchY)+1;
  if(rows*cols*64>MAX_MOVES)throw new ConfigError(['This paired-loop layout exceeds the move budget. Use larger loops or a smaller swatch.']);
  const families=[[],[]],n=64,placed=new Set();
  for(let family=0;family<2;family++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cx=box.minX+w/2+i*dx+(family?shift*dx:0),cy=box.minY+h/2+j*pitchY+(family?pitchY/2:0);
    if(cx-w/2<box.minX||cx+w/2>box.maxX||cy-h/2<box.minY||cy+h/2>box.maxY)continue;
    // a second-family loop sits among four first-family loops; at an edge it is only kept if it still crosses two of them
    if(family){let near=0;for(const [dj,di] of [[0,0],[0,1],[1,0],[1,1]])if(placed.has(`${j+dj},${i+di}`))near++;if(near<2)continue;}
    const pts=Array.from({length:n+1},(_,k)=>{const t=2*Math.PI*k/n;return{x:cx+w/2*Math.cos(t),y:cy+h/2*Math.sin(t)};});
    Object.assign(pts,{id:`${family?'B':'A'}-${j}-${i}`,family:family?'loops-B':'loops-A',role:'native',source:'paired-loops',rowOrder:j});families[family].push(pts);if(!family)placed.add(`${j},${i}`);
  }
  const layers=families;layers.families=['loops-A','loops-B'];layers.extra={planes:true,families:layers.families,loopCountA:families[0].length,loopCountB:families[1].length};return layers;
}
