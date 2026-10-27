import { clipPolyline, densify, hatch } from './layers.js';
import { ConfigError } from './params.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Parallel ground lines tied together by a decorative, second family. */
export function stepLaceLayers(boundary,{spacing=3,tie='step',tieLength=6,tieDepth=null,petals=6}={}){
  if(!['step','hexagon','ripple','petal'].includes(tie))throw new ConfigError(['Choose step, hexagon, ripple or petal ties.']);
  const box=boundary.bbox(),gap=clamp(Number(spacing)||3,1.5,8),period=clamp(Number(tieLength)||6,3,20),depth=clamp(Number(tieDepth)||gap*1.1,gap,gap*3),lines=hatch(boundary,{angle:0,spacing:gap}).map((pts,i)=>Object.assign(pts,{family:'lines',role:'native',source:'step-lace',id:`line-${i}`})),ties=[];
  const add=pts=>{for(const part of clipPolyline(densify(pts),boundary,0.15))if(part.length>1){part.family='tie';part.role='tie';part.source='step-lace';ties.push(part);}};
  if(tie==='step'||tie==='ripple'){
    const count=Math.ceil((box.maxX-box.minX)/period),amp=tie==='step'?depth:depth/2;
    for(let i=0;i<=count;i++){
      const x=box.minX+i*period,y0=box.minY-amp,y1=box.maxY+amp,pts=[];
      const n=Math.max(1,Math.ceil((y1-y0)/Math.max(.5,gap/3)));
      for(let j=0;j<=n;j++){const y=y0+(y1-y0)*j/n,xx=tie==='step'?x+(j%2?amp:-amp):x+amp*Math.sin((y-y0)*Math.PI/Math.max(period,1));pts.push({x:xx,y});}
      add(pts);
    }
  }else if(tie==='hexagon'){
    // Three clipped diagonal families make a connected hexagonal tie grid.
    for(const angle of [30,90,150])for(const path of hatch(boundary,{angle,spacing:Math.max(period*.6,gap*2)}))add(path);
  }else{
    const sides=Math.max(4,Math.min(10,Math.round(Number(petals)||6))),pitch=period,row= pitch*Math.sqrt(3)/2,r=pitch*.43;
    for(let y=box.minY+r;y+r<=box.maxY+1e-6;y+=row)for(let x=box.minX+r;x+r<=box.maxX+1e-6;x+=pitch){
      const cx=x+((Math.round((y-box.minY)/row)%2)?pitch/2:0);if(cx+r>box.maxX)continue;const pts=[];
      for(let k=0;k<=sides*12;k++){const a=2*Math.PI*k/(sides*12),rr=r*(.72+.28*Math.cos(sides*a));pts.push({x:cx+rr*Math.cos(a),y:y+rr*Math.sin(a)});}add(pts);
    }
  }
  const layers=[lines,ties];layers.families=['lines','tie'];layers.extra={families:layers.families,tie,baseLines:lines.length,ties:ties.length};
  return layers;
}
