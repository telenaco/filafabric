const pointKey=(x,y)=>`${x},${y}`;
const resample=points=>{
  if(points.length<2)return points.slice();
  const out=[{...points[0]}];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/.5));
    for(let k=1;k<=n;k++){const t=k/n;out.push({...a,...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z??0)+((b.z??0)-(a.z??0))*t});}
  }
  return out;
};

function conflictsFor(strands,{tipRadius,coneHalfAngle,layerHeight,bead}){
  const alpha=Math.max(0,Math.min(89,Number(coneHalfAngle)||0))*Math.PI/180,top=strands.reduce((m,s)=>s.pts.reduce((n,p)=>Math.max(n,p.z??layerHeight),m),layerHeight),/* a loop: spreading every point into Math.max overflows the stack on a dense sheet */cell=Math.max(.5,tipRadius+Math.max(0,top-layerHeight)*Math.tan(alpha)+bead/2),grid=new Map(),samples=[];
  strands.forEach((strand,si)=>resample(strand.pts).forEach(point=>{const sample={si,point},ix=Math.floor(point.x/cell),iy=Math.floor(point.y/cell);samples.push(sample);const key=pointKey(ix,iy),list=grid.get(key)??[];list.push(sample);grid.set(key,list);}));
  const arcs=new Map();
  for(const a of samples){const {x,y,z:za=layerHeight}=a.point,ix=Math.floor(x/cell),iy=Math.floor(y/cell);
    for(let gx=ix-1;gx<=ix+1;gx++)for(let gy=iy-1;gy<=iy+1;gy++)for(const b of grid.get(pointKey(gx,gy))??[]){
      if(a.si===b.si||a.si>b.si)continue;
      let lower=a,higher=b,from=za,to=higher.point.z??layerHeight;
      if(to<from){lower=b;higher=a;from=to;to=za;}
      const dz=to-from;if(dz<=layerHeight*.5)continue;
      const d=Math.hypot(lower.point.x-higher.point.x,lower.point.y-higher.point.y),reach=tipRadius+dz*Math.tan(alpha)+bead/2;
      if(d>=reach)continue;
      const key=`${lower.si}>${higher.si}`,old=arcs.get(key);
      if(!old||d<old.distance)arcs.set(key,{from:lower.si,to:higher.si,x:(lower.point.x+higher.point.x)/2,y:(lower.point.y+higher.point.y)/2,distance:d});
    }
  }
  return [...arcs.values()];
}

function stableOrder(strands,arcs){
  const out=[],indegree=new Uint32Array(strands.length),next=Array.from({length:strands.length},()=>[]);
  for(const edge of arcs){next[edge.from].push(edge.to);indegree[edge.to]++;}
  const ready=[];for(let i=0;i<strands.length;i++)if(!indegree[i])ready.push(i);
  while(ready.length){const i=ready.shift();out.push(i);for(const j of next[i])if(--indegree[j]===0){let at=ready.findIndex(value=>value>j);if(at<0)at=ready.length;ready.splice(at,0,j);}}
  return {order:out,remaining:Array.from(indegree,(n,i)=>n?i:-1).filter(i=>i>=0)};
}

function stronglyConnected(strands,arcs){
  const next=Array.from({length:strands.length},()=>[]);for(const edge of arcs)next[edge.from].push(edge.to);
  const index=new Int32Array(strands.length).fill(-1),low=new Int32Array(strands.length),stack=[],onStack=new Uint8Array(strands.length),components=[];let serial=0;
  const visit=v=>{index[v]=low[v]=serial++;stack.push(v);onStack[v]=1;for(const w of next[v]){if(index[w]<0){visit(w);low[v]=Math.min(low[v],low[w]);}else if(onStack[w])low[v]=Math.min(low[v],index[w]);}if(low[v]===index[v]){const component=[];let w;do{w=stack.pop();onStack[w]=0;component.push(w);}while(w!==v);if(component.length>1||next[v].includes(v))components.push(component);}};
  for(let v=0;v<strands.length;v++)if(index[v]<0)visit(v);
  return components;
}

function splitAt(strand,point){
  let best=Infinity,index=-1;
  for(let i=1;i<strand.pts.length-1;i++){const p=strand.pts[i],d=Math.hypot(p.x-point.x,p.y-point.y);if(d<best){best=d;index=i;}}
  if(index<1)return null;
  const a={...strand,id:`${strand.id}-a`,pts:strand.pts.slice(0,index+1)},b={...strand,id:`${strand.id}-b`,pts:strand.pts.slice(index)};
  return [a,b];
}

const pathLength=strand=>strand.pts.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-strand.pts[i-1].x,p.y-strand.pts[i-1].y):0,0);
const cyclicCost=(strands,arcs)=>stronglyConnected(strands,arcs).reduce((sum,component)=>sum+component.length*component.length,0);

function bestCycleSplit(strands,component,options){
  const arcs=conflictsFor(strands,options),base=cyclicCost(strands,arcs),candidates=[],size=strands.reduce((n,s)=>n+s.pts.length,0);
  // every cut point is re-checked against the whole sheet, so past about 200 only every nth is tried (small cases try them all)
  const cuts=component.reduce((n,index)=>n+Math.max(0,strands[index].pts.length-2),0),stride=Math.max(1,Math.ceil(cuts/200));
  for(const index of component){const strand=strands[index];for(let cut=1;cut<strand.pts.length-1;cut+=stride)candidates.push({index,cut,length:pathLength(strand),pieces:[{...strand,id:`${strand.id}-a`,pts:strand.pts.slice(0,cut+1)},{...strand,id:`${strand.id}-b`,pts:strand.pts.slice(cut)}]});}
  candidates.sort((a,b)=>b.length-a.length||a.index-b.index||a.cut-b.cut);
  let best=null;
  for(const candidate of candidates){if(options.budget&&(options.budget.left-=size)<0)break;const trial=strands.slice();trial.splice(candidate.index,1,...candidate.pieces);const trialArcs=conflictsFor(trial,options),cost=cyclicCost(trial,trialArcs);if(!best||cost<best.cost){best={...candidate,cost};if(cost===0)break;}}
  return best&&best.cost<base?best:null;
}

/** Order strands so lower material is deposited before nearby higher material that could strike the nozzle. */
export function clearanceOrder(input,{tipRadius=.6,coneHalfAngle=30,layerHeight=.2,bead=.45,maxSplits=50,workBudget=6e6}={}){
  // each trial cut re-checks the whole sheet; heavily overlapping rings made the search run for minutes, so it is bounded by
  // the work done (points re-checked), which gives the same answer on every machine
  let strands=input.slice(),split=0;const budget={left:workBudget};
  while(true){
    const arcs=conflictsFor(strands,{tipRadius:Number(tipRadius)||0,coneHalfAngle,layerHeight:Number(layerHeight)||.2,bead:Number(bead)||.45}),{order,remaining}=stableOrder(strands,arcs);
    budget.left-=strands.reduce((n,s)=>n+s.pts.length,0);
    if(!remaining.length){const sorted=order.map(i=>strands[i]);return {strands:order.every((index,i)=>index===i)?input:sorted,split,conflicts:[]};}
    if(split>=maxSplits) return {strands:order.concat(remaining).map(i=>strands[i]),split,conflicts:arcs.filter(edge=>remaining.includes(edge.from)&&remaining.includes(edge.to)).map(edge=>({a:strands[edge.from].id,b:strands[edge.to].id,x:edge.x,y:edge.y}))};
    const options={tipRadius:Number(tipRadius)||0,coneHalfAngle,layerHeight:Number(layerHeight)||.2,bead:Number(bead)||.45,budget},cyclic=stronglyConnected(strands,arcs)[0]??remaining,cycleEdges=arcs.filter(edge=>cyclic.includes(edge.from)&&cyclic.includes(edge.to)),best=bestCycleSplit(strands,cyclic,options),candidate=best?.index??[...cyclic].sort((a,b)=>pathLength(strands[b])-pathLength(strands[a])||a-b)[0],pieces=best?.pieces??splitAt(strands[candidate],cycleEdges[0]??strands[candidate].pts[Math.floor(strands[candidate].pts.length/2)]);
    if(!pieces||!best&&budget.left<=0)return {strands:order.concat(remaining).map(i=>strands[i]),split,conflicts:cycleEdges.map(e=>({a:strands[e.from].id,b:strands[e.to].id,x:e.x,y:e.y}))};
    strands.splice(candidate,1,...pieces);split++;
  }
}
