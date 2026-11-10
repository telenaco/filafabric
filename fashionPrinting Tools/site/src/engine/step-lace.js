import { clipPolyline, densify, hatch } from './layers.js';
import { ConfigError } from './params.js';
import { findCrossings } from './crossings.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Parallel ground lines tied together by a decorative, second family. */
export function stepLaceLayers(boundary,{spacing=3,tie='step',tieLength=6,tieDepth=null,petals=6}={}){
  if(!['step','hexagon','ripple','petal'].includes(tie))throw new ConfigError(['Choose step, hexagon, ripple or petal ties.']);
  const box=boundary.bbox(),gap=clamp(Number(spacing)||3,1.5,8),period=clamp(Number(tieLength)||6,3,20),depth=clamp(Number(tieDepth)||gap*1.1,gap,gap*3),lines=hatch(boundary,{angle:0,spacing:gap,maxJog:-1}).map((pts,i)=>Object.assign(pts,{family:'lines',role:'native',source:'step-lace',id:`line-${i}`})),ties=[];
  const add=pts=>{for(const part of clipPolyline(densify(pts),boundary,0.15))if(part.length>1){part.family='tie';part.role='native';part.source='step-lace';ties.push(part);}};
  if(tie==='step'||tie==='ripple'){
    // a tie column crosses a base line somewhere within its swing, so neighbouring columns are spaced to keep every free span within 1.5 tie lengths
    const amp=tie==='step'?Math.min(depth,period/2):Math.min(depth/2,period/2),pitch=Math.min(period,Math.max(period*.4,1.5*period-2*amp));
    for(let x=box.minX+pitch/2;x<box.maxX+pitch/2-1e-6;x+=pitch){
      const y0=box.minY-amp,y1=box.maxY+amp,pts=[];
      const n=Math.max(1,Math.ceil((y1-y0)/Math.max(.5,gap/3)));
      for(let j=0;j<=n;j++){const y=y0+(y1-y0)*j/n,xx=tie==='step'?x+(j%2?amp:-amp):x+amp*Math.sin((y-y0)*Math.PI/Math.max(period,1));pts.push({x:xx,y});}
      add(pts);
    }
  }else if(tie==='hexagon'){
    // Three clipped diagonal families make a connected hexagonal tie grid.
    for(const angle of [30,90,150])for(const path of hatch(boundary,{angle,spacing:Math.min(Math.max(period*.6,gap*2),period*1.2)}))add(path);
  }else{
    // rows close enough that every base line meets a rosette, and a lattice that runs off the edges (the boundary clips it)
    const sides=Math.max(4,Math.min(10,Math.round(Number(petals)||6))),pitch=period,row=pitch*.55,r=pitch*.43;
    for(let y=box.minY;y<=box.maxY+row/2;y+=row)for(let x=box.minX-pitch/2;x<=box.maxX+pitch/2;x+=pitch){
      const cx=x+((Math.round((y-box.minY)/row)%2)?pitch/2:0),pts=[];
      for(let k=0;k<=sides*12;k++){const a=2*Math.PI*k/(sides*12),rr=r*(.72+.28*Math.cos(sides*a));pts.push({x:cx+rr*Math.cos(a),y:y+rr*Math.sin(a)});}add(pts);
    }
  }
  // a tie fragment that crosses no base line (the pattern overhangs the first and last lines, and the edges) would be a loose bead
  const {found}=findCrossings([...lines,...ties].map(pts=>({pts})),{strandWidth:.45}),hit=new Set();
  for(const c of found){if(c.sa<lines.length&&c.sb>=lines.length)hit.add(c.sb-lines.length);else if(c.sb<lines.length&&c.sa>=lines.length)hit.add(c.sa-lines.length);}
  const kept=ties.filter((_,i)=>hit.has(i));
  const layers=[lines,kept];layers.families=['lines','tie'];layers.extra={families:layers.families,tie,baseLines:lines.length,ties:kept.length};
  return layers;
}
