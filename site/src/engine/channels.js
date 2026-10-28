import { findCrossings } from './crossings.js';

const arcTable=pts=>{const a=[0];for(let i=1;i<pts.length;i++)a.push(a.at(-1)+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));return a;};
const at=(pts,arcs,d)=>{let i=1;while(i<arcs.length&&arcs[i]<d)i++;const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i)],t=(d-arcs[i-1])/Math.max(1e-9,arcs[i]-arcs[i-1]);return {...a,...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};

/** Build a two-family sliding weave: selected crossings capture one family beneath channels on the other. */
export function slidingChannels(families,{mask=()=> 'b',spanLift=1,channelLift=2,legBefore=1.2,legAfterFactor=1.4,spanFlow=.55,channelFlow=.47,anchor=12,ramp=12,layerHeight=.2,bead=.5,clearanceOrder=null,constrainFused=false}={}){
  const groups=families.slice(0,2),flat=groups.flatMap((group,gi)=>group.map((strand,index)=>({...strand,family:strand.family??String.fromCharCode(97+gi),id:strand.id??`family-${gi}-${index}`}))),groupOf=flat.map((_,index)=>index<groups[0].length?'a':'b'),{found}=findCrossings(flat,{strandWidth:bead,cell:1}),tables=flat.map(s=>arcTable(s.pts)),events=[],marks=flat.map(()=>[]),channels=[];
  for(const crossing of found){const chosen=mask({...crossing,a:flat[crossing.sa],b:flat[crossing.sb],familyA:groupOf[crossing.sa],familyB:groupOf[crossing.sb]})??'fused';if(!['a','b','fused'].includes(chosen))throw new TypeError("mask must return 'fused', 'a' or 'b'");const captive=chosen==='fused'?null:groupOf[crossing.sa]===chosen?crossing.sa:groupOf[crossing.sb]===chosen?crossing.sb:null,base=captive===crossing.sa?crossing.sb:crossing.sa,event={...crossing,chosen,captive,base};events.push(event);if(captive!==null){const capArc=captive===crossing.sa?crossing.arcA:crossing.arcB,baseArc=base===crossing.sa?crossing.arcA:crossing.arcB;marks[captive].push({arc:capArc,captive:true,event});marks[base].push({arc:baseArc,captive:false,event});const p=at(flat[base].pts,tables[base],baseArc),before=Math.min(legBefore,baseArc),after=Math.min(legBefore*legAfterFactor,tables[base].at(-1)-baseArc),left=at(flat[base].pts,tables[base],baseArc-before),right=at(flat[base].pts,tables[base],baseArc+after),z0=layerHeight;channels.push({...flat[base],id:`channel-${channels.length+1}`,role:'channel',family:'channel',flow:channelFlow,pts:[{...left,z:z0,flow:channelFlow},{...p,z:z0,flow:channelFlow},{...p,z:z0+channelLift,flow:channelFlow,cls:'unsupported'},{...right,z:z0,flow:channelFlow,cls:'falling'}]});}}
  // A fused crossing is also a height constraint, including within an otherwise sliding loop.
  for (const event of events.filter(e => constrainFused && e.chosen === 'fused')) {
    marks[event.sa].push({ arc: event.arcA, captive: false, event });
    marks[event.sb].push({ arc: event.arcB, captive: false, event });
  }
  const basePieces=[],raisedPieces=[];
  // New closed-loop channels follow Li's triangle directly: no bed-level leg through the captive crossing.
  if (constrainFused) for (const channel of channels) channel.pts.splice(1, 1);
  flat.forEach((strand,si)=>{
    const arcs=tables[si],cross=marks[si].sort((a,b)=>a.arc-b.arc);if(!cross.length){basePieces.push({...strand,pts:strand.pts.map(p=>({...p,z:layerHeight}))});return;}
    const boundaries=[0];for(let i=1;i<cross.length;i++)if(cross[i].captive!==cross[i-1].captive)boundaries.push((cross[i].arc+cross[i-1].arc)/2);boundaries.push(arcs.at(-1));
    for(let bi=0;bi<boundaries.length-1;bi++){
      const lo=boundaries[bi],hi=boundaries[bi+1],mid=(lo+hi)/2,nearest=cross.reduce((best,item)=>Math.abs(item.arc-mid)<Math.abs(best.arc-mid)?item:best,cross[0]),raised=nearest.captive,tag={...strand,id:`${strand.id}-${raised?'raised':'base'}-${bi+1}`,pts:[]};
      const heightAt = d => {
        if (!constrainFused) {
          const distanceToSwitch = Math.min(...boundaries.slice(1, -1).map(x => Math.abs(x - d)), Infinity);
          const rampWidth = Math.min(Math.max(0.01, ramp), Math.max(0.01, (hi - lo) / 2));
          return raised ? spanLift * Math.max(0, Math.min(1, (distanceToSwitch + rampWidth / 2) / rampWidth)) : 0;
        }
        let i = cross.findIndex(m => m.arc >= d);
        if (i < 0) return cross.at(-1).captive ? spanLift : 0;
        if (i === 0) return cross[0].captive ? spanLift : 0;
        const a = cross[i - 1], b = cross[i], za = a.captive ? spanLift : 0, zb = b.captive ? spanLift : 0;
        if (za === zb) return za;
        const width = Math.min(Math.max(0.01, ramp), Math.max(0.01, b.arc - a.arc));
        const t = Math.max(0, Math.min(1, (d - (a.arc + b.arc - width) / 2) / width));
        return za + (zb - za) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      };
      const points=[lo,...arcs.filter(d=>d>lo+1e-8&&d<hi-1e-8),hi];tag.pts=points.map(d=>{const p=at(strand.pts,arcs,d);return {...p,z:layerHeight+heightAt(d),...(raised?{flow:spanFlow,cls:'supported'}:{})};});
      (raised?raisedPieces:basePieces).push(tag);
    }
  });
  const ordered=[...basePieces,...raisedPieces,...channels];
  return {strands:ordered,events,crossings:events.length,fused:events.filter(e=>e.chosen==='fused').length,channels:channels.length,levels:{base:basePieces.length,raised:raisedPieces.length},order:typeof clearanceOrder==='function'?clearanceOrder(ordered):ordered,anchor,layerHeight};
}
