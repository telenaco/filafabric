import { offsetPolyline } from './drawing.js';
import { clipPolyline } from './layers.js';
import { segmentContact, segmentInside } from './fabric.js';

export const pathLength = pts => pts.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y):0),0);
export const cellSeed = (seed,x,y,salt=0) => {
  let h=(Number(seed)>>>0)^Math.imul(x|0,0x45d9f3b)^Math.imul(y|0,0x27d4eb2d)^salt;
  h=Math.imul(h^(h>>>16),0x85ebca6b);return (h^(h>>>13))>>>0;
};

/** An inset border is designed geometry, not an engine repair tie. */
export function nativeBorders(boundary, bead=.45, family='border') {
  return boundary.rings.flatMap(ring=>{
    const first=ring[0],next=ring[1],length=Math.hypot(next.x-first.x,next.y-first.y);
    const mid={x:(first.x+next.x)/2,y:(first.y+next.y)/2};
    const left=boundary.contains(mid.x-(next.y-first.y)/length*bead,mid.y+(next.x-first.x)/length*bead);
    const pts=offsetPolyline([...ring,ring[0]],(left?1:-1)*bead*.55);
    return clipPolyline(pts,boundary,.01).map(path=>Object.assign(path,{family,role:'native'}));
  });
}

/** Merge near stripe fragments only along a connector that is entirely in the printable area. */
export function mergeFragments(paths,boundary,bead=.45) {
  const out=paths.map(path=>path.map(p=>({...p})));
  for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
    let joined=false;
    for(const reverseA of [false,true])for(const reverseB of [false,true]){
      if(joined)continue;
      const a=reverseA?[...out[i]].reverse():out[i],b=reverseB?[...out[j]].reverse():out[j];
      if(Math.hypot(a.at(-1).x-b[0].x,a.at(-1).y-b[0].y)<bead&&segmentInside(a.at(-1),b[0],boundary)){
        out[i]=[...a,...b];out.splice(j--,1);joined=true;
      }
    }
  }
  return out;
}

/** Count distinct geometric carrier contacts, not duplicate sample points at one crossing. */
export function carrierContacts(path, carriers, bead=.45) {
  const found=[];
  for(let i=1;i<path.length;i++)for(const line of carriers)for(let j=1;j<line.length;j++){
    const a=path[i-1],b=path[i],c=line[j-1],d=line[j];
    if(Math.max(a.x,b.x)+bead<Math.min(c.x,d.x)||Math.min(a.x,b.x)-bead>Math.max(c.x,d.x)||Math.max(a.y,b.y)+bead<Math.min(c.y,d.y)||Math.min(a.y,b.y)-bead>Math.max(c.y,d.y))continue;
    const contact=segmentContact(a,b,c,d);
    if(contact.distance>bead*.8)continue;
    const p={x:c.x+contact.u*(d.x-c.x),y:c.y+contact.u*(d.y-c.y)};
    if(!found.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<bead*1.5))found.push(p);
  }
  return found;
}

/** Every retained motif must have two carrier contacts. Extend along its end direction, staying inside the boundary. */
export function attachMotifs(paths, carrierLayers, boundary, {bead=.45,reach=30,merge=false}={}) {
  const carriers=carrierLayers.flat(),source=merge?mergeFragments(paths,boundary,bead):paths;
  const kept=[];let dropped=0,extended=0,unattached=0;
  for(const original of source){
    let path=original.map(p=>({...p})),contacts=carrierContacts(path,carriers,bead);
    if(contacts.length>=2){kept.push(Object.assign(path,{role:'motif',family:'motif'}));continue;}
    if(pathLength(path)<3){dropped++;continue;}
    let changed=false;
    for(const reverse of [false,true]){
      if(contacts.length>=2)break;
      if(reverse)path.reverse();
      const end=path.at(-1),previous=path.at(-2),length=Math.hypot(end.x-previous.x,end.y-previous.y);
      if(length>1e-8)for(let distance=bead/2;distance<=reach;distance+=bead/2){
        const p={x:end.x+(end.x-previous.x)/length*distance,y:end.y+(end.y-previous.y)/length*distance};
        if(!segmentInside(path.at(-1),p,boundary,bead/2))break;
        path.push(p);changed=true;contacts=carrierContacts(path,carriers,bead);
        if(contacts.length>=2)break;
      }
      if(reverse)path.reverse();
    }
    if(contacts.length<2){unattached++;dropped++;continue;}
    if(changed)extended++;
    kept.push(Object.assign(path,{role:'motif',family:'motif'}));
  }
  return {paths:kept,dropped,extended,unattached};
}
