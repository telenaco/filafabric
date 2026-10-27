import { clipPolyline, densify, trailsFromEdges } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { findCrossings } from './crossings.js';

function starFactor(angle,spans,symmetry,smooth){
  const sector=2*Math.PI/symmetry,phase=((angle%sector)+sector)%sector;
  const mirrored=symmetry%2===0&&phase>sector/2?sector-phase:phase,limit=symmetry%2===0?sector/2:sector;
  const u=mirrored/limit*(spans.length-1),i=Math.min(spans.length-2,Math.floor(u)),t=u-i;
  if(!smooth)return spans[i]*(1-t)+spans[i+1]*t;
  const p0=spans[Math.max(0,i-1)],p1=spans[i],p2=spans[i+1],p3=spans[Math.min(spans.length-1,i+2)];
  return Math.max(.3,Math.min(1.5,.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)));
}
function sitesFor(box,lattice,cell){
  const points=[],row=lattice==='triangular'||lattice==='honeycomb'?cell*Math.sqrt(3)/2:cell;
  const cols=Math.ceil((box.maxX-box.minX)/cell)+3,rows=Math.ceil((box.maxY-box.minY)/row)+3;
  for(let j=-1;j<rows;j++)for(let i=-1;i<cols;i++){
    if(lattice==='honeycomb'&&(i+j)%3===0)continue;
    const angle=lattice==='diagonal-square'?Math.PI/4:0;
    const x=box.minX+i*cell+(lattice==='triangular'||lattice==='honeycomb'?(j%2)*cell/2:0),y=box.minY+j*row;
    if(angle){const cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2,dx=x-cx,dy=y-cy;points.push({x:cx+dx*Math.cos(angle)-dy*Math.sin(angle),y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)});}else points.push({x,y});
  }
  return points;
}

/** Rasterized Voronoi cell walls under a periodic star-shaped radial metric. */
export function starMetricLayers(boundary,{lattice='triangular',spans=[1,.6,1],symmetry=3,cell=10,wall=.45,smooth=true,raster=.2,tone=null}={}){
  const box=boundary.bbox(),step=Math.max(.1,Number(raster)||.2),cols=Math.ceil((box.maxX-box.minX)/step),rows=Math.ceil((box.maxY-box.minY)/step),
    metricSym=[3,4,6].includes(Number(symmetry))?Number(symmetry):3,shape=(Array.isArray(spans)?spans:[1,.6,1]).slice(0,7).map(v=>Math.max(.3,Math.min(1.5,Number(v)||1)));
  if(cols*rows>MAX_MOVES)throw new ConfigError(['This star-metric raster is too large. Use a coarser grid or a smaller swatch.']);
  const cellSize=Math.max(5,Number(cell)||10),pts=sitesFor(box,lattice,cellSize),labels=new Int16Array(cols*rows),siteFactors=pts.map(p=>{
    const value=tone?Math.max(0,Math.min(1,tone(p.x-box.minX,p.y-box.minY,box.maxX-box.minX,box.maxY-box.minY))):.5;
    const local=shape.map((v,i)=>Math.max(.3,Math.min(1.5,v+(value-.5)*(i===0||i===shape.length-1?0:.4))));
    return Float32Array.from({length:720},(_,a)=>starFactor(a*Math.PI/360,local,metricSym,smooth));
  });
  const buckets=new Map();
  pts.forEach((p,i)=>{const x=Math.floor((p.x-box.minX)/cellSize),y=Math.floor((p.y-box.minY)/cellSize),key=`${x},${y}`,list=buckets.get(key)??[];list.push(i);buckets.set(key,list);});
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const px=box.minX+(x+.5)*step,py=box.minY+(y+.5)*step,bx=Math.floor((px-box.minX)/cellSize),by=Math.floor((py-box.minY)/cellSize);let best=Infinity,id=0;
    for(let radius=0;radius<=8;radius++){
      const x0=radius?bx-radius:bx,x1=radius?bx+radius:bx,y0=radius?by-radius:by,y1=radius?by+radius:by;
      for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
        if(radius&&gx!==x0&&gx!==x1&&gy!==y0&&gy!==y1)continue;
        for(const i of buckets.get(`${gx},${gy}`)??[]){
          const dx=pts[i].x-px,dy=pts[i].y-py,angle=Math.atan2(dy,dx),idx=((Math.round((angle+2*Math.PI)*360/Math.PI)%720)+720)%720,d=Math.hypot(dx,dy)/Math.max(.3,siteFactors[i][idx]);
          if(d<best){best=d;id=i;}
        }
      }
      if(best<Infinity&&radius*cellSize>best*1.5)break;
    }
    labels[y*cols+x]=id;
  }
  const edges=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const id=labels[y*cols+x],px=box.minX+x*step,py=box.minY+y*step;
    if(x+1<cols&&id!==labels[y*cols+x+1])edges.push([{x:px+step,y:py},{x:px+step,y:py+step}]);
    if(y+1<rows&&id!==labels[(y+1)*cols+x])edges.push([{x:px,y:py+step},{x:px+step,y:py+step}]);
  }
  const walls=trailsFromEdges(edges).map(path=>{const p=densify(path);p.family='walls';return p;});
  const border=(boundary.rings??[]).map(r=>{
    const cx=r.reduce((n,q)=>n+q.x,0)/r.length,cy=r.reduce((n,q)=>n+q.y,0)/r.length;
    const inset=r.map(q=>{const d=Math.hypot(cx-q.x,cy-q.y),step=Math.min(.6,d*.08);return d?{x:q.x+(cx-q.x)*step/d,y:q.y+(cy-q.y)*step/d}:q;});
    const p=clipPolyline(densify([...inset,inset[0]]),boundary).flat();p.family='border';return p;
  }).filter(p=>p.length>1);
  const paths=[...walls,...border],{found}=findCrossings(paths.map(path=>({pts:path.map(p=>({...p,z:0}))})),{strandWidth:wall,cell:1});
  found.forEach((crossing,index)=>{
    const id=`star-metric-node:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){paths[pathIndex].joints??=[];paths[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}
  });
  const layers=[paths];layers.families=['walls','border'];layers.extra={families:layers.families,sites:pts.length,raster:step,symmetry:metricSym};
  return layers;
}
