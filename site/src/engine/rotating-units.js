import { densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { clipLines, tidyEdge } from './flat-variants.js';

// the smallest cell: a unit of four walls round an open middle, joined by a neck, needs about this much room at the standard bead
export const MIN_UNIT_CELL = 1.5;

const rotate = (p, angle, center) => {
  const c=Math.cos(angle),s=Math.sin(angle),x=p.x-center.x,y=p.y-center.y;
  return {x:center.x+x*c-y*s,y:center.y+x*s+y*c};
};

function squareCorners(center, side, angle) {
  const h=side/2;
  return [[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,y])=>rotate({x:center.x+x,y:center.y+y},angle,center));
}

function closestCorners(a,b) {
  let best=null;
  for(const p of a)for(const q of b){const d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.distance)best={a:p,b:q,distance:d};}
  return best;
}

function closestOnPath(path,target){
  let best=null;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/Math.max(1e-20,dx*dx+dy*dy)));
    const point={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(point.x-target.x,point.y-target.y);
    if(!best||distance<best.distance)best={point,distance};
  }
  return best.point;
}

function squareContactPair(a,b,side,angle,fillet){
  const ca=squareCorners(a,side,(a.i+a.j)%2?-angle:angle),cb=squareCorners(b,side,(b.i+b.j)%2?-angle:angle),pair=closestCorners(ca,cb);
  const pa=closestOnPath(roundedSquare(a,side,(a.i+a.j)%2?-angle:angle,fillet),pair.a);
  const pb=closestOnPath(roundedSquare(b,side,(b.i+b.j)%2?-angle:angle,fillet),pair.b);
  return {a:pa,b:pb,distance:Math.hypot(pb.x-pa.x,pb.y-pa.y)};
}

function solveSquareSide(a,b,angle,cell,length,fillet) {
  const gap=side=>squareContactPair(a,b,side,angle,fillet).distance;
  let lo=0,hi=0,previous=gap(0),bracketed=false;
  for(let i=1;i<=200;i++){
    const side=cell*i/200,current=gap(side);
    if(previous>=length&&current<=length){lo=cell*(i-1)/200;hi=side;bracketed=true;break;}
    previous=current;
  }
  if(!bracketed)throw new ConfigError(['The chosen angle and neck length do not fit this cell size. Increase the cell size or reduce the neck length.']);
  for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(gap(mid)>length)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}

function roundedSquare(center,side,angle,fillet) {
  const corners=squareCorners(center,side,angle),r=Math.max(0,Math.min(fillet,side*.45));
  if(r<1e-6)return [...corners,{...corners[0]}];
  const points=[];
  for(let i=0;i<4;i++){
    const prev=corners[(i+3)%4],cur=corners[i],next=corners[(i+1)%4];
    const toward=(p,q,d)=>{const n=Math.hypot(q.x-p.x,q.y-p.y);return{x:p.x+(q.x-p.x)*d/n,y:p.y+(q.y-p.y)*d/n};};
    const a=toward(cur,prev,r),b=toward(cur,next,r);
    if(!points.length)points.push(a);
    for(let k=1;k<=6;k++){const t=k/6,u=1-t;points.push({x:u*u*a.x+2*u*t*cur.x+t*t*b.x,y:u*u*a.y+2*u*t*cur.y+t*t*b.y});}
    points.push(b);
  }
  points.push({...points[0]});
  return points;
}

function triangleCorners(center,side,angle){
  const parity=(Number(center.i)+Number(center.j))%2,radius=side/Math.sqrt(3),rotation=(center.orientation??(parity?Math.PI:0))+(center.turnSign??(parity?-1:1))*angle;
  return Array.from({length:3},(_,i)=>({x:center.x+radius*Math.cos(rotation+2*Math.PI*i/3),y:center.y+radius*Math.sin(rotation+2*Math.PI*i/3)}));
}

function roundedPolygon(corners,fillet){
  const points=[],n=corners.length,r=Math.max(0,Math.min(fillet,.45*Math.min(...corners.map((p,i)=>Math.hypot(p.x-corners[(i+1)%n].x,p.y-corners[(i+1)%n].y)))));
  if(r<1e-6)return [...corners,{...corners[0]}];
  for(let i=0;i<n;i++){
    const prev=corners[(i+n-1)%n],cur=corners[i],next=corners[(i+1)%n];
    const point=(from,to)=>{const d=Math.hypot(to.x-from.x,to.y-from.y);return{x:cur.x+(from.x-cur.x)*r/d,y:cur.y+(from.y-cur.y)*r/d};};
    const a=point(prev,cur),b=point(next,cur);if(!points.length)points.push(a);
    for(let k=1;k<=6;k++){const t=k/6,u=1-t;points.push({x:u*u*a.x+2*u*t*cur.x+t*t*b.x,y:u*u*a.y+2*u*t*cur.y+t*t*b.y});}
    points.push(b);
  }
  points.push({...points[0]});return points;
}

export function triangleContactPair(a,b,side,angle,fillet){
  const ca=triangleCorners(a,side,angle),cb=triangleCorners(b,side,angle),pair=closestCorners(ca,cb);
  const pa=closestOnPath(roundedPolygon(ca,fillet),pair.a),pb=closestOnPath(roundedPolygon(cb,fillet),pair.b);
  return {a:pa,b:pb,distance:Math.hypot(pb.x-pa.x,pb.y-pa.y)};
}

function solveTriangleSide(a,b,cell,length,fillet,angle){
  const gap=side=>side<=1e-9?cell:triangleContactPair(a,b,side,angle,fillet).distance;
  let lo=0,hi=0,prev=gap(0),found=false;
  const maximum=cell*1.5;
  for(let i=1;i<=300;i++){const value=maximum*i/300,current=gap(value);if(prev>=length&&current<=length){lo=maximum*(i-1)/300;hi=value;found=true;break;}prev=current;}
  if(!found)throw new ConfigError(['The chosen triangle and neck settings do not fit this cell size. Increase the cell size or reduce the neck length.']);
  for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(gap(mid)>length)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}

// A joint is named by where it is, so necks that leave the same corner (squares aligned to the grid) share it
const nodeId=p=>`node:${p.x.toFixed(3)},${p.y.toFixed(3)}`;

/**
 * The pass, or two passes when the neck is wider than a bead, that join the contact points `a` and `b` of two outlines.
 * Offset sideways from its contact point, the end of a wide neck, or of one on a sharp corner, can fall clear of the
 * outline; such an end is pulled back onto it and given a joint of its own, so a neck always holds its two shapes together.
 */
function neckPasses(a,b,width,bead,jointA,jointB,shapeA,shapeB) {
  const d=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;
  const offsets=width>bead?[ -width/2,width/2 ]:[0];
  return offsets.map((offset,k)=>{
    const ends=[{x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset}];
    const joints=[{id:jointA,x:a.x,y:a.y},{id:jointB,x:b.x,y:b.y}];
    [shapeA,shapeB].forEach((shape,side)=>{
      if(!shape||!offset)return;
      const onShape=closestOnPath(shape,ends[side]);
      if(Math.hypot(onShape.x-ends[side].x,onShape.y-ends[side].y)>bead)ends[side]=onShape; // within a bead it still touches
      const joint={id:`${side?jointB:jointA}:pass${k}`,x:ends[side].x,y:ends[side].y};
      joints.push(joint);shape.joints.push({...joint});
    });
    const line=densify(ends);line.family='necks';line.joints=joints;
    return line;
  });
}

function borderLoop(boundary, inset) {
  const box=boundary.bbox();
  const ring=boundary.rings?.[0]??[];
  if(ring.length===4&&ring.every(p=>[box.minX,box.maxX].includes(p.x)&&[box.minY,box.maxY].includes(p.y))){const x0=box.minX+inset,y0=box.minY+inset,x1=box.maxX-inset,y1=box.maxY-inset;return [[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1},{x:x0,y:y0}]];}
  return (boundary.rings??[]).map(ring=>ring.map(p=>({...p})));
}

/**
 * Alternating rotating squares and corner-link necks. The lattice is centred on the swatch and runs past its edges, so a square at
 * the edge is cut by it: the pattern fills the whole swatch instead of stopping short of it. There is no border band: what the edge
 * leaves loose is taken away (tidyEdge), and a line can be drawn where an edge needs holding.
 */
export function rotatingSquaresLayers(boundary,{cell=10,angle=15,neck=.9,neckLength=1.2,fillet=.8,outline=true,bead=.45}={}){
  const box=boundary.bbox(),a=Math.max(0,Math.min(35,Number(angle)||0))*Math.PI/180;
  const cellSize=Math.max(MIN_UNIT_CELL,Number(cell)||10),length=Math.max(.6,Number(neckLength)||1.2),width=Math.max(bead,Number(neck)||.9);
  const sideEstimate=Math.max(1,cellSize-length);
  const prototypeA={i:0,j:0,x:0,y:0},prototypeB={i:1,j:0,x:cellSize,y:0};
  const side=solveSquareSide(prototypeA,prototypeB,a,cellSize,length,fillet);
  if(side>sideEstimate*1.3)throw new ConfigError(['The requested corner necks do not fit between these squares. Increase cell size or reduce neck length.']);
  // measured on the rounded outline: rounding pulls a corner back
  const reach=Math.max(...roundedSquare({x:0,y:0},side,a,fillet).map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))));
  const spanX=box.maxX-box.minX,spanY=box.maxY-box.minY,centreX=(box.minX+box.maxX)/2,centreY=(box.minY+box.maxY)/2;
  const nx=Math.ceil((spanX+2*reach)/cellSize)+1,ny=Math.ceil((spanY+2*reach)/cellSize)+1;
  if(nx*ny*Math.ceil(cellSize*4/.5)>MAX_MOVES)throw new ConfigError(['This rotating-square sheet exceeds the move limit. Use larger cells or a smaller swatch.']);
  const cells=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)cells.push({i,j,x:centreX+(i-(nx-1)/2)*cellSize,y:centreY+(j-(ny-1)/2)*cellSize});
  const squares=[],necks=[],squareByCell=new Map(),kept=[];
  for(const cellAt of cells){
    const theta=(cellAt.i+cellAt.j)%2?-a:a;
    const line=roundedSquare(cellAt,side,theta,fillet).map(p=>({...p}));line.family='squares';line.joints=[];
    if(!clipLines([line],boundary,{minLength:bead*3,inset:bead/2}).length)continue; // wholly outside the swatch
    kept.push(cellAt);
    if(outline){squares.push(line);squareByCell.set(`${cellAt.i},${cellAt.j}`,line);}
  }
  const byIndex=new Map(kept.map(c=>[`${c.i},${c.j}`,c]));
  for(const c of kept)for(const [di,dj] of [[1,0],[0,1]]){
    const n=byIndex.get(`${c.i+di},${c.j+dj}`);if(!n)continue;
    const pair=squareContactPair(c,n,side,a,fillet);
    if(Math.abs(pair.distance-length)>.05)continue;
    const jointA=nodeId(pair.a),jointB=nodeId(pair.b);
    squareByCell.get(`${c.i},${c.j}`)?.joints.push({id:jointA,x:pair.a.x,y:pair.a.y});
    squareByCell.get(`${n.i},${n.j}`)?.joints.push({id:jointB,x:pair.b.x,y:pair.b.y});
    necks.push(...neckPasses(pair.a,pair.b,width,bead,jointA,jointB,squareByCell.get(`${c.i},${c.j}`),squareByCell.get(`${n.i},${n.j}`)));
  }
  const cut=clipLines([...squares,...necks],boundary,{minLength:bead*3,inset:bead/2});
  const layers=[tidyEdge(cut,boundary)];
  layers.families=['squares','necks'];
  layers.extra={families:layers.families,cellSide:side};
  return layers;
}

/**
 * Alternating regular triangles on an equilateral lattice with corner necks. The lattice is centred on the swatch and runs past its
 * edges, so a triangle at the edge is cut by it. There is no border band: what the edge leaves loose is taken away (tidyEdge).
 */
export function rotatingTrianglesLayers(boundary,{cell=10,angle=15,neck=.9,neckLength=1.2,fillet=.6,bead=.45}={}){
  const box=boundary.bbox(),cellSize=Math.max(MIN_UNIT_CELL,Number(cell)||10),inclination=Math.max(-30,Math.min(30,Number(angle)||0))*Math.PI/180;
  const length=Math.max(.6,Number(neckLength)||1.2),width=Math.max(bead,Number(neck)||.9),rowStep=cellSize*Math.sqrt(3)/2;
  const sampleA={i:0,j:0,x:0,y:0,orientation:0,turnSign:1},sampleB={i:0,j:0,x:cellSize,y:0,orientation:Math.PI/3,turnSign:-1};
  const side=solveTriangleSide(sampleA,sampleB,cellSize,length,fillet,inclination);
  const centreX=(box.minX+box.maxX)/2,centreY=(box.minY+box.maxY)/2,halfX=(box.maxX-box.minX)/2+2*cellSize,halfY=(box.maxY-box.minY)/2+2*cellSize;
  const iMax=Math.ceil(halfX/(1.5*cellSize))+1,iMin=-iMax,jMax=Math.ceil(halfY/(2*rowStep))+Math.ceil(iMax/2)+1,jMin=-jMax;
  if((iMax-iMin+1)*(jMax-jMin+1)*Math.ceil(cellSize*5/.5)>MAX_MOVES*4)throw new ConfigError(['This rotating-triangle sheet exceeds the move limit. Use larger cells or a smaller swatch.']);
  const cells=[];
  for(let i=iMin;i<=iMax;i++)for(let j=jMin;j<=jMax;j++){
    const ax=centreX+i*1.5*cellSize,ay=centreY+(i+2*j)*rowStep;
    if(Math.abs(ax-centreX)>halfX+cellSize||Math.abs(ay-centreY)>halfY+cellSize)continue;
    cells.push({i,j,sub:'a',x:ax,y:ay,orientation:0,turnSign:1});
    cells.push({i,j,sub:'b',x:ax+cellSize,y:ay,orientation:Math.PI/3,turnSign:-1});
  }
  const shapes=new Map(),triangles=[],necks=[],insideCell=new Map();
  for(const c of cells){
    const path=roundedPolygon(triangleCorners(c,side,inclination),fillet);path.family='triangles';path.joints=[];
    if(!clipLines([path],boundary,{minLength:bead*3,inset:bead/2}).length)continue; // wholly outside the swatch
    shapes.set(`${c.i},${c.j},${c.sub}`,path);triangles.push(path);insideCell.set(`${c.i},${c.j},${c.sub}`,c);
  }
  const degree=new Map([...insideCell.keys()].map(key=>[key,0])),linkedCells=[];
  const links=[[0,0],[ -1,0 ],[ -1,1 ]];
  for(const a of cells.filter(c=>c.sub==='a'))for(const [di,dj]of links){
    const n=insideCell.get(`${a.i+di},${a.j+dj},b`);if(!n)continue;
    const aKey=`${a.i},${a.j},a`,bKey=`${n.i},${n.j},b`,shapeA=shapes.get(aKey),shapeB=shapes.get(bKey);
    if(!shapeA||!shapeB)continue;
    const pair=triangleContactPair(a,n,side,inclination,fillet);
    if(Math.abs(pair.distance-length)>.05)continue;
    const idA=nodeId(pair.a),idB=nodeId(pair.b);
    shapeA.joints.push({id:idA,x:pair.a.x,y:pair.a.y});shapeB.joints.push({id:idB,x:pair.b.x,y:pair.b.y});
    necks.push(...neckPasses(pair.a,pair.b,width,bead,idA,idB,shapeA,shapeB));
    degree.set(aKey,degree.get(aKey)+1);degree.set(bKey,degree.get(bKey)+1);
    linkedCells.push([aKey,bKey]);
  }
  const cut=clipLines([...triangles,...necks],boundary,{minLength:bead*3,inset:bead/2});
  const layers=[tidyEdge(cut,boundary)];
  layers.families=['triangles','necks'];
  // Each fully interior hinge joins two corners of closed triangle outlines;
  // those paired corners contribute two contour branches apiece at the node.
  const interiorNodeDegrees=linkedCells.filter(([a,b])=>degree.get(a)===3&&degree.get(b)===3).map(()=>4);
  layers.extra={families:layers.families,cellSide:side,interiorNodeDegrees,cellDegrees:[...degree.values()]};
  return layers;
}
