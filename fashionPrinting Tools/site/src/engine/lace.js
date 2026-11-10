import { clipPolyline, densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { carrierLayers } from './backing.js';
import { findCrossings } from './crossings.js';

function motifPoints(cx,cy,scale,motif,count=72){
  const radius=scale/2,pts=[];
  for(let i=0;i<=count;i++){
    const a=2*Math.PI*i/count;
    let r=radius;
    if(motif==='petal')r=radius*(.68+.32*Math.cos(6*a));
    else if(motif==='scallop')r=radius*(.82+.18*Math.cos(8*a));
    pts.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});
  }
  return pts;
}
const segmentLength=pts=>pts.reduce((n,p,i)=>i?n+Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y):0,0);
function closestOnSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return {x:a.x+u*dx,y:a.y+u*dy};
}

/** Motif outlines without connecting necks, also used by motif-on-carrier tickets. */
export function laceMotifs(boundary,{motif='petal',scale=12,openness=.5,lattice='hex',inset=0}={}){
  const box=boundary.bbox(),pitch=Math.max(3,Number(scale)||12),open=Math.max(.3,Math.min(.8,Number(openness)||.5)),diameter=pitch*open,radius=diameter/2,rowStep=lattice==='hex'?pitch*Math.sqrt(3)/2:pitch;
  const rows=Math.ceil((box.maxY-box.minY)/rowStep),cols=Math.ceil((box.maxX-box.minX)/pitch);
  if(rows*cols*100>MAX_MOVES)throw new ConfigError(['This lace layout exceeds the move budget. Use larger motifs or a smaller swatch.']);
  const motifs=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cx=box.minX+radius+inset+i*pitch+(lattice==='hex'&&j%2?pitch/2:0),cy=box.minY+radius+inset+j*rowStep;
    if(cx+radius>box.maxX-inset||cy+radius>box.maxY-inset)continue;
    const path=motifPoints(cx,cy,diameter,motif);path.family='motifs';path.center={x:cx,y:cy};motifs.push(path);
  }
  return motifs;
}

/** Connected ring, rosette or scallop lace with contact necks and an optional perimeter. */
export function laceLayers(boundary,{motif='petal',scale=12,neck=.9,openness=.5,lattice='hex',bead=.45}={}){
  if(!['ring','petal','scallop'].includes(motif))throw new ConfigError(['Choose ring, petal or scallop motifs.']);
  const pitch=Math.max(3,Number(scale)||12),open=Math.max(.3,Math.min(.8,Number(openness)||.5)),width=Math.max(bead,Number(neck)||.9),radius=pitch*open/2;
  const motifs=laceMotifs(boundary,{motif,scale:pitch,openness:open,lattice}),links=[];
  const edgeKeys=new Set();
  for(let ai=0;ai<motifs.length;ai++){
    const a=motifs[ai];
    for(let bi=ai+1;bi<motifs.length;bi++){
      const b=motifs[bi],dx=b.center.x-a.center.x,dy=b.center.y-a.center.y,d=Math.hypot(dx,dy);
      if(Math.abs(d-pitch)>.02)continue;
      const edgeKey=`${ai}:${bi}`;if(edgeKeys.has(edgeKey))continue;edgeKeys.add(edgeKey);
       const ux=dx/d,uy=dy/d;
       const start=a.reduce((best,p)=>Math.hypot(p.x-b.center.x,p.y-b.center.y)<Math.hypot(best.x-b.center.x,best.y-b.center.y)?p:best,a[0]);
       const end=b.reduce((best,p)=>Math.hypot(p.x-a.center.x,p.y-a.center.y)<Math.hypot(best.x-a.center.x,best.y-a.center.y)?p:best,b[0]);
      const path=densify([start,end]);path.family='necks';path.role='native';path.neckLength=segmentLength(path);links.push(path);
    }
  }
  // drawn a little inside the outline, as the other bordered cards do: a line exactly on the edge is clipped away
  const border=(boundary.rings??[]).map(r=>{
    const cx=r.reduce((n,p)=>n+p.x,0)/r.length,cy=r.reduce((n,p)=>n+p.y,0)/r.length;
    const inset=r.map(p=>{const d=Math.hypot(cx-p.x,cy-p.y),step=Math.min(.6,d*.08);return d?{x:p.x+(cx-p.x)*step/d,y:p.y+(cy-p.y)*step/d}:p;});
    const p=densify([...inset,inset[0]]);p.family='border';return p;
  });
  // The lattice stops short of the edge, so the border is tied to the motifs near it: a neck runs out from each to the border
  // (one that already touches it needs none, and one too far off is left alone). Otherwise the border floats along that edge.
  const borderLinks=[],edgeReach=pitch*.75;
  for(const motif of motifs){
    let near=null;
    for(const line of border)for(let i=1;i<line.length;i++){
      const q=closestOnSegment(motif.center,line[i-1],line[i]),d=Math.hypot(q.x-motif.center.x,q.y-motif.center.y);
      if(!near||d<near.d)near={q,d};
    }
    if(!near)continue;
    const start=motif.reduce((best,p)=>Math.hypot(p.x-near.q.x,p.y-near.q.y)<Math.hypot(best.x-near.q.x,best.y-near.q.y)?p:best,motif[0]);
    const gap=Math.hypot(start.x-near.q.x,start.y-near.q.y);
    if(gap<=width||gap>edgeReach)continue;
    const path=densify([start,near.q]);path.family='necks';path.role='native';path.neckLength=segmentLength(path);borderLinks.push(path);
  }
  const families=[...motifs,...links,...borderLinks,...border];
  const {found}=findCrossings(families.map(path=>({pts:path.map(p=>({...p,z:0}))})),{strandWidth:width,cell:1});
  found.forEach((crossing,index)=>{
    const id=`lace-joint:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){families[pathIndex].joints??=[];families[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}
  });
  const layers=[families];layers.families=['motifs','necks','border'];layers.extra={families:layers.families,motifCount:motifs.length,neckCount:links.length};
  return layers;
}

/** Decorative lace printed face-down first, then held by one or two configurable carrier passes. */
export function laceOnCarrierLayers(boundary,{motif='petal',scale=12,openness=.5,lattice='hex',support={},bead=.45}={}){
  const motifs=laceMotifs(boundary,{motif,scale,openness,lattice,inset:bead/2+.05}).map(path=>{path.family='motif';path.role='motif';return path;});
  const carrier=carrierLayers(boundary,{...support,order:'motif-first'});
  const layers=[motifs,...carrier];
  layers.families=['motif',...carrier.map((_,i)=>`carrier-${i+1}`)];
  layers.extra={families:layers.families,order:'motif-first',motifs:motifs.length,carrierPasses:carrier.length};
  return layers;
}
