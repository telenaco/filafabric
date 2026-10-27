import { createRng } from './rng.js';
import { clipPolyline, densify, trailsFromEdges } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { findCrossings } from './crossings.js';

const hash=(seed,i,j)=>{let h=(Number(seed)|0)^Math.imul(i|0,0x9e3779b1)^Math.imul(j|0,0x85ebca77);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return(h^(h>>>16))>>>0;};
const cross=(a,b,c)=>((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));
function intersects(a,b,c,d){const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);return ab1*ab2 < -1e-8 && cd1*cd2 < -1e-8;}
function metric(a,b,cos,sin,stretch){const dx=b.x-a.x,dy=b.y-a.y,x=dx*cos+dy*sin,y=-dx*sin+dy*cos;return Math.hypot(x/stretch,y);}

/** Deterministic anisotropic k-nearest-neighbour net; a fixed world grid preserves nodes on resize. */
export function stochasticNetLayers(boundary,{density=.04,k=5,stretch=1.5,direction=0,seed=1,border=true,tone=null}={}){
  const box=boundary.bbox(),w=Math.max(.01,box.maxX-box.minX),h=Math.max(.01,box.maxY-box.minY),pitch=1/Math.sqrt(Math.max(.01,Number(density)||.04));
  const i0=Math.floor(box.minX/pitch),i1=Math.ceil(box.maxX/pitch),j0=Math.floor(box.minY/pitch),j1=Math.ceil(box.maxY/pitch),nodes=[];
  if((i1-i0)*(j1-j0)>MAX_MOVES)throw new ConfigError(['This stochastic net exceeds the node budget. Reduce density or use a smaller swatch.']);
  for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){
    const rng=createRng(hash(seed,i,j)),p={x:(i+rng.next())*pitch,y:(j+rng.next())*pitch};
    if(boundary.contains(p.x,p.y))nodes.push({...p,i,j});
    const toneAt=tone?Math.max(0,Math.min(1,tone(p.x-box.minX,p.y-box.minY,w,h))):0;
    if(toneAt>.6){
      for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){
        const child=createRng(hash(seed,i*2+sx,j*2+sy)^0x51ed270b),q={x:(i+(sx+.15+.7*child.next())/2)*pitch,y:(j+(sy+.15+.7*child.next())/2)*pitch};
        if(boundary.contains(q.x,q.y))nodes.push({...q,i:i*2+sx,j:j*2+sy,subcell:true});
      }
    }
  }
  const cos=Math.cos(direction*Math.PI/180),sin=Math.sin(direction*Math.PI/180),ratio=Math.max(1,Math.min(3,Number(stretch)||1)),count=Math.max(3,Math.min(8,Math.round(k)||5));
  const candidates=new Map();
  nodes.forEach((p,index)=>{
    const near=nodes.map((q,j)=>({j,d:metric(p,q,cos,sin,ratio)})).filter(q=>q.j!==index).sort((a,b)=>a.d-b.d).slice(0,count);
    for(const q of near){const a=Math.min(index,q.j),b=Math.max(index,q.j),key=`${a},${b}`;if(!candidates.has(key))candidates.set(key,{a,b,d:q.d});}
  });
  const edges=[...candidates.values()].sort((a,b)=>a.d-b.d).filter((edge,idx,all)=>{
    const a=nodes[edge.a],b=nodes[edge.b];
    return !all.slice(0,idx).some(other=>{
      if(edge.a===other.a||edge.a===other.b||edge.b===other.a||edge.b===other.b)return false;
      return intersects(a,b,nodes[other.a],nodes[other.b]);
    });
  }).map(e=>[nodes[e.a],nodes[e.b]]).filter(([a,b])=>{
    for(let n=1;n<10;n++){const t=n/10;if(!boundary.contains(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}
    return true;
  });
  if(border){
    for(const ring of boundary.rings??[]){
      const closed=[...ring,ring[0]],outline=densify(closed);
      for(let i=1;i<outline.length;i++)edges.push([outline[i-1],outline[i]]);
      for(const p of ring){let nearest=null,best=Infinity;for(const n of nodes){const d=Math.hypot(n.x-p.x,n.y-p.y);if(d<best){best=d;nearest=n;}}if(nearest&&best>1e-8)edges.push([nearest,p]);}
    }
  }
  const trails=trailsFromEdges(edges).flatMap(path=>clipPolyline(densify(path),boundary));
  for(const path of trails)path.family=path.some(p=>Math.abs(p.x-box.minX)<1e-6||Math.abs(p.x-box.maxX)<1e-6||Math.abs(p.y-box.minY)<1e-6||Math.abs(p.y-box.maxY)<1e-6)?'border':'net';
  const {found}=findCrossings(trails.map(path=>({pts:path.map(p=>({...p,z:0}))})),{strandWidth:.45,cell:1});
  found.forEach((crossing,index)=>{
    const id=`stochastic-node:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){trails[pathIndex].joints??=[];trails[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}
  });
  const layers=[trails];layers.families=['net','border'];layers.extra={families:layers.families,nodes:nodes.length,edges:edges.length,pitch};
  return layers;
}
