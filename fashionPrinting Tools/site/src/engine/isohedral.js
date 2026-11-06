import { IsohedralTiling, mul, tilingTypes } from '../../vendor/tactile/tactile.js';
import { clipPolyline, densify, trailsFromEdges } from './layers.js';
import { findCrossings } from './crossings.js';
import { ConfigError } from './params.js';

export const ISOHEDRAL_TYPES=Object.freeze(tilingTypes.slice());
const validType=value=>{const match=String(value??'IH28').match(/^IH(\d{1,2})$/i),type=match?Number(match[1]):28;return ISOHEDRAL_TYPES.includes(type)?type:28;};
const transformPoint=(matrix,point)=>mul(matrix,point);
const edgeKey=(a,b)=>{const key=p=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`,x=key(a),y=key(b);return x<y?`${x}|${y}`:`${y}|${x}`;};

/** Generate one copy of every straightened Tactile prototile edge, clipped to the swatch. */
export function isohedralLayers(boundary,{family='IH28',params=[],scale=10,line=.45,border=true}={}){
  const type=validType(family),size=Math.max(1,Math.min(30,Number(scale)||10)),width=Math.max(.3,Number(line)||.45),tiling=new IsohedralTiling(type),defaults=tiling.getParameters();
  if(Array.isArray(params)&&params.length===defaults.length)tiling.setParameters(params.map(value=>Math.max(-1,Math.min(2,Number(value)||0))));
  const box=boundary.bbox(),x0=box.minX/size-3,x1=box.maxX/size+3,y0=box.minY/size-3,y1=box.maxY/size+3,edges=new Map();
  for(const tile of tiling.fillRegionBounds(x0,y0,x1,y1))for(const side of tiling.shape()){
    // The base tile geometry is intentionally straight-edged. Tactile's shared
    // transforms/reversal ensure the paired edge has identical endpoints.
    const matrix=mul(tile.T,side.T),p=transformPoint(matrix,{x:0,y:0}),q=transformPoint(matrix,{x:1,y:0});
    const a={x:p.x*size,y:p.y*size},b={x:q.x*size,y:q.y*size},key=edgeKey(a,b);
    if(!edges.has(key))edges.set(key,[a,b]);
  }
  const raw=[...edges.values()],paths=trailsFromEdges(raw).flatMap(path=>clipPolyline(densify(path),boundary));
  for(const path of paths)path.family='edges';
  if(border){
    const borderPaths=[];
    for(const ring of boundary.rings??[]){const cx=ring.reduce((sum,p)=>sum+p.x,0)/ring.length,cy=ring.reduce((sum,p)=>sum+p.y,0)/ring.length,inset=ring.map(point=>{const d=Math.hypot(cx-point.x,cy-point.y),offset=Math.min(Math.max(width,1),d*.02);return d?{x:point.x+(cx-point.x)*offset/d,y:point.y+(cy-point.y)*offset/d}:point;});const p=densify([...inset,inset[0]]);p.family='border';borderPaths.push(p);}
    const project=(point)=>{let nearest=null,best=Infinity,target=null;for(const ring of borderPaths)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:a.x+u*dx,y:a.y+u*dy},d=Math.hypot(point.x-q.x,point.y-q.y);if(d<best){best=d;nearest=q;target=ring;}}return {point:nearest,distance:best,target};};
    for(const path of paths.filter(p=>p.family==='edges'))for(const end of [path[0],path.at(-1)]){const near=project(end);if(near.point&&near.distance>width*.5&&near.distance<size*1.5){const id=`iso-border:${paths.length}`,connector=densify([end,near.point]);connector.family='edges';connector.joints=[{id,x:end.x,y:end.y},{id,x:near.point.x,y:near.point.y}];path.joints??=[];path.joints.push(connector.joints[0]);near.target.joints??=[];near.target.joints.push(connector.joints[1]);paths.push(connector);}}
    paths.push(...borderPaths);
  }
  for(const path of paths)for(const point of path){if(point.x<0&&point.x>-1e-6)point.x=0;if(point.y<0&&point.y>-1e-6)point.y=0;if(point.x>box.maxX&&point.x<box.maxX+1e-6)point.x=box.maxX;if(point.y>box.maxY&&point.y<box.maxY+1e-6)point.y=box.maxY;if(!boundary.contains(point.x,point.y)){const cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2,d=Math.hypot(cx-point.x,cy-point.y)||1,step=1e-5;point.x+=(cx-point.x)*step/d;point.y+=(cy-point.y)*step/d;}}
  const {found}=findCrossings(paths.map(path=>({pts:path.map(p=>({...p,z:0}))})),{strandWidth:width,cell:1});
  found.forEach(crossing=>{const id=`isohedral-node:${Math.round(crossing.x/Math.max(1,width*2))},${Math.round(crossing.y/Math.max(1,width*2))}`;for(const pathIndex of[crossing.sa,crossing.sb]){paths[pathIndex].joints??=[];paths[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}});
  const vertices=new Map();
  paths.forEach((path,pathIndex)=>path.forEach(point=>{const key=`${Math.round(point.x*1000)},${Math.round(point.y*1000)}`,list=vertices.get(key)??[];if(!list.some(entry=>entry.pathIndex===pathIndex))list.push({pathIndex,point});vertices.set(key,list);}));
  for(const [key,list]of vertices)if(list.length>1){const id=`isohedral-vertex:${key}`;for(const {pathIndex,point}of list){paths[pathIndex].joints??=[];paths[pathIndex].joints.push({id,x:point.x,y:point.y});}}
  if(!paths.length)throw new ConfigError(['This isohedral family produced no printable tile edges.']);
  const layers=[paths];layers.families=['edges','border'];layers.extra={families:layers.families,family:`IH${type}`,parameters:tiling.getParameters(),scale:size,uniqueEdges:edges.size,border};
  return layers;
}

export function isohedralParameterCount(family){return new IsohedralTiling(validType(family)).numParameters();}

/** In-plane class inferred from Tactile's tile-orientation orbit; a single mirror is not resolved here. */
export function isohedralMaterialClass(family){
  const tiling=new IsohedralTiling(validType(family)),angles=new Set();
  for(let i=0;i<tiling.numAspects();i++){const m=tiling.getAspectTransform(i),angle=((Math.round(Math.atan2(m[3],m[0])*180/Math.PI)%360)+360)%360;angles.add(angle);}
  if([3,6].includes(angles.size)&&[...angles].every(angle=>Math.abs(angle%(360/angles.size))<1))return 'isotropic';
  if(angles.size===4&&[...angles].every(angle=>angle%90===0))return 'tetragonal';
  if(angles.size===2&&angles.has(0)&&angles.has(180))return 'anisotropic';
  return 'orthotropic / anisotropic (rotation orbit alone does not distinguish mirrors)';
}
