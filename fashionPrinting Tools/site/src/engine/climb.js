/** Build an incremental bead-height field, laying each later path over the material already present. */
export function climbOverlaps(paths,{bead=.45,layerHeight=.2,levelHeight=layerHeight,maxLevels=4,rampLength=1.5,cell=.2,tags=null}={}){
  const step=Math.max(.05,Number(cell)||.2),width=Math.max(.05,Number(bead)||.45),lh=Math.max(.01,Number(layerHeight)||.2),rise=Math.max(.01,Number(levelHeight)||lh),cap=Math.max(1,Math.round(Number(maxLevels)||4))*rise,slope=rise/Math.max(.01,Number(rampLength)||1.5),field=new Map();let clipped=0;
  const key=(x,y)=>`${x},${y}`,cellAt=(x,y)=>[Math.floor(x/step),Math.floor(y/step)],near=(x,y)=>{const [ix,iy]=cellAt(x,y),reach=Math.ceil(width/(2*step));let z=0;for(let dx=-reach;dx<=reach;dx++)for(let dy=-reach;dy<=reach;dy++)z=Math.max(z,field.get(key(ix+dx,iy+dy))??0);return z;};
  const raster=(point,z)=>{const [ix,iy]=cellAt(point.x,point.y),reach=Math.ceil(width/(2*step));for(let dx=-reach;dx<=reach;dx++)for(let dy=-reach;dy<=reach;dy++)if(Math.hypot(dx*step,dy*step)<=width/2+step*.75){const k=key(ix+dx,iy+dy);field.set(k,Math.max(field.get(k)??0,z));}};
  const result=[];
  paths.forEach((input,index)=>{
    const strand=Array.isArray(input)?{pts:input}:input,source=strand.pts??[],points=[];
    for(let i=0;i<source.length;i++){
      const a=source[i];if(i===0){points.push({...a});continue;}
      const p=source[i-1],length=Math.hypot(a.x-p.x,a.y-p.y),n=Math.max(1,Math.ceil(length/step));
      for(let k=1;k<=n;k++){const t=k/n;points.push({...p,...a,x:p.x+(a.x-p.x)*t,y:p.y+(a.y-p.y)*t});}
    }
    const targets=points.map(p=>{const under=near(p.x,p.y),wanted=under>0?under+rise:lh,z=Math.min(cap,wanted);if(wanted>cap+1e-9)clipped++;return {z,under};});
    const z=targets.map(q=>q.z);
    for(let i=1;i<z.length;i++){const d=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);z[i]=Math.min(z[i],z[i-1]+slope*d);}
    for(let i=z.length-2;i>=0;i--){const d=Math.hypot(points[i+1].x-points[i].x,points[i+1].y-points[i].y);z[i]=Math.min(z[i],z[i+1]+slope*d);}
    const pts=points.map((p,i)=>{const base=targets[i].under>0?targets[i].under+rise:lh,actual=Math.max(lh,z[i]);let cls='base';if(actual>lh+1e-6)cls=actual+1e-6<base?'falling':targets[i].under>0?'supported':'rising';return {...p,z:actual,level:Math.min(Math.round(Number(maxLevels)||4),Math.max(1,Math.round((actual-lh)/rise)+1)),cls};});
    for(let i=0;i<pts.length;i++)raster(pts[i],pts[i].z);
    const tag=tags?.[index]??strand;
    result.push({...strand,...(tag.family!==undefined?{family:tag.family}:{}),...(tag.role!==undefined?{role:tag.role}:{}),...(tag.source!==undefined?{source:tag.source}:{}),id:strand.id??`climb-${index+1}`,pts});
  });
  const levelSummary=result.flatMap(s=>s.pts).reduce((summary,p)=>{const level=Math.round(p.z/rise);summary.max=Math.max(summary.max,level);summary.histogram[level]=(summary.histogram[level]??0)+1;return summary;},{max:0,histogram:{}});
  return {strands:result,clipped,levels:levelSummary};
}
