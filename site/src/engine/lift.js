import { findCrossings } from './crossings.js';

const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const cumulative=points=>{const arcs=[0];for(let i=1;i<points.length;i++)arcs.push(arcs.at(-1)+distance(points[i-1],points[i]));return arcs;};

/** Interpolate all point fields that affect a printed move at arc distance `at`. */
export function pointAtArc(points,arcs,at){
  let i=1;while(i<arcs.length&&arcs[i]<at)i++;
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i)],span=arcs[i]-arcs[i-1],t=span>1e-12?Math.max(0,Math.min(1,(at-arcs[i-1])/span)):0;
  return {...a,...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z??0)+((b.z??0)-(a.z??0))*t,...(a.flow!==undefined||b.flow!==undefined?{flow:(a.flow??1)+((b.flow??1)-(a.flow??1))*t}:{})};
}

/** Locate selected crossings and return them in stable strand/arc order. */
export function crossingEvents(strands,{bead=.45,mask=null,limit=Infinity}={}){
  const {found}=findCrossings(strands,{strandWidth:bead,cell:1,limit});
  return found.filter(c=>!mask||mask(c.x,c.y,c)).map(c=>{
    const later=Math.max(c.sa,c.sb),earlier=Math.min(c.sa,c.sb),arc=later===c.sa?c.arcA:c.arcB,underArc=earlier===c.sa?c.arcA:c.arcB;
    const underArcs=cumulative(strands[earlier].pts),overArcs=cumulative(strands[later].pts),under=pointAtArc(strands[earlier].pts,underArcs,underArc);
    return {...c,later,earlier,arc,underArc,underZ:under.z??0,baseZ:pointAtArc(strands[later].pts,overArcs,arc).z??0};
  });
}

/** Raise later strands at selected crossings, with cosine ramps and a flat cooling hold. */
export function liftCrossings(strands,{lift=1,length=3,hold=null,mask=null,layerHeight=.2,bead=.45}={}){
  const liftHeight=Math.max(0,Number(lift)||0),rampLength=Math.max(.01,Number(length)||.01),holdLength=Math.max(0,Number(hold??(bead+.4))||0),notes=[];
  // A half-cosine's peak derivative is π·height/(2·length). 3.5×height
  // keeps the profile below a 25° planner slope limit with sampling margin.
  const actualLength=Math.max(rampLength,3.5*liftHeight);
  if(actualLength>rampLength+1e-9)notes.push(`Lift ramps lengthened to ${actualLength.toFixed(2)} mm to keep slope at or below 0.5.`);
  const events=crossingEvents(strands,{bead,mask}),byStrand=strands.map(()=>[]);
  for(const event of events){
    const target=event.underZ+liftHeight,offset=Math.max(0,target-event.baseZ),half=holdLength/2,start=event.arc-half-actualLength,end=event.arc+half+actualLength;
    byStrand[event.later].push({...event,target,offset,start,coreStart:event.arc-half,coreEnd:event.arc+half,end});
  }
  let maxLift=0,maxSlope=0;
  const output=strands.map((strand,si)=>{
    const original=strand.pts,arcs=cumulative(original),total=arcs.at(-1),marks=new Set(arcs);
    for(const event of byStrand[si]){
      marks.add(event.start);marks.add(event.coreStart);marks.add(event.arc);marks.add(event.coreEnd);marks.add(event.end);
      for(let i=1;i<6;i++){marks.add(event.start+(event.coreStart-event.start)*i/6);marks.add(event.coreEnd+(event.end-event.coreEnd)*i/6);}
      marks.add(Math.max(0,event.start));marks.add(Math.min(total,event.end));
    }
    const ordered=[...marks].filter(at=>at>=0&&at<=total).sort((a,b)=>a-b).filter((at,i,list)=>i===0||at-list[i-1]>1e-6),pts=ordered.map(at=>{
      const point=pointAtArc(original,arcs,at),cover=byStrand[si].filter(event=>at>=event.start-1e-9&&at<=event.end+1e-9);
      let rise=0,cls=null,lifted=false;
      for(const event of cover){let weight=0,candidateClass='unsupported';if(at<event.coreStart){const t=(at-event.start)/(event.coreStart-event.start);weight=.5*(1-Math.cos(Math.PI*Math.max(0,Math.min(1,t))));candidateClass='rising';}else if(at>event.coreEnd){const t=(event.end-at)/(event.end-event.coreEnd);weight=.5*(1-Math.cos(Math.PI*Math.max(0,Math.min(1,t))));candidateClass='falling';}else weight=1;
        if(event.offset*weight>=rise){rise=event.offset*weight;cls=candidateClass;}
        if(Math.abs(at-event.arc)<1e-6){point.lifted=true;lifted=true;rise=Math.max(rise,event.offset);cls='unsupported';}
      }
      if(rise>0){point.z+=rise;point.cls=cls;maxLift=Math.max(maxLift,rise);}return point;
    });
    for(let i=1;i<pts.length;i++){const d=distance(pts[i-1],pts[i]);if(d>1e-9)maxSlope=Math.max(maxSlope,Math.abs(pts[i].z-pts[i-1].z)/d);}
    return {...strand,pts};
  });
  return {strands:output,crossings:events.length,events,maxLift,maxSlope,notes,layerHeight};
}
