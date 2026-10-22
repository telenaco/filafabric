import { segmentInside, segmentContact } from './fabric.js';
import { roundedRectArea } from './extrusion.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const planar = s => s.role === 'solid' && s.pts.length >= 2 && s.pts.every(p => p.cls === undefined && Math.abs(p.z-s.pts[0].z)<1e-8);

/** Stitch ordered neighbouring dense hatches, never walls, holes, pauses or layer changes.
 * Incoming width/flow stay on every original segment. Only the new short link gets nominal-or-narrower bead flow.
 */
export function joinDenseInfill(strands,{boundary,bead,layerHeight,maxLink=bead*1.5}={}) {
  const edges=(boundary?.rings??[]).flatMap(ring=>ring.map((a,i)=>({a,b:ring[(i+1)%ring.length]})));
  const clear = (a,b,radius) => !edges.some(edge=>{
    if(Math.max(edge.a.x,edge.b.x)<Math.min(a.x,b.x)-radius || Math.min(edge.a.x,edge.b.x)>Math.max(a.x,b.x)+radius
      || Math.max(edge.a.y,edge.b.y)<Math.min(a.y,b.y)-radius || Math.min(edge.a.y,edge.b.y)>Math.max(a.y,b.y)+radius) return false;
    return segmentContact(a,b,edge.a,edge.b).distance<radius-1e-8;
  });
  const out=[];
  for(const s of strands) {
    const prev=out.at(-1), a=prev?.pts.at(-1), b=s.pts[0];
    const width=Math.min(bead,a?.width??bead,s.pts[1]?.width??bead);
    if(!prev || !planar(prev) || !planar(s) || s.pauseBefore || prev.solidLayer!==s.solidLayer || prev.layer!==s.layer || prev.routingGroup!==s.routingGroup || prev.kind!==s.kind
      || prev.travelBoundary!==s.travelBoundary || Math.abs(a.z-b.z)>1e-8 || distance(a,b)>maxLink
      || !boundary || !segmentInside(a,b,boundary,width/2) || !clear(a,b,width/2)) { out.push(s); continue; }
    const link=distance(a,b)>1e-8 ? [{...b,width,flow:roundedRectArea(width,layerHeight)/roundedRectArea(bead,layerHeight)}] : [];
    out[out.length-1]={...prev,pts:[...prev.pts,...link,...s.pts.slice(1)]};
  }
  return out;
}
