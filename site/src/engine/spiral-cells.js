import { densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { findCrossings } from './crossings.js';

/** Four inward Archimedean spiral arms per square cell, terminating on shared edge midpoints. */
export function spiralCellsLayers(boundary,{cell=12,twist=2.2,armWidth=.45,handedness=1,tone=null}={}){
  const box=boundary.bbox(),s=Math.max(10,Number(cell)||12),phi=Math.max(.5,Math.min(4,Number(twist)||2.2)),width=Math.max(.45,Number(armWidth)||.45),sign=handedness<0?-1:1;
  const cols=Math.max(1,Math.floor((box.maxX-box.minX)/s)),rows=Math.max(1,Math.floor((box.maxY-box.minY)/s));
  const pitchX=cols===1?Math.min(s,box.maxX-box.minX):s,pitchY=rows===1?Math.min(s,box.maxY-box.minY):s;
  const startX=box.minX+((box.maxX-box.minX)-(cols-1)*pitchX)/2,startY=box.minY+((box.maxY-box.minY)-(rows-1)*pitchY)/2;
  if(cols*rows*4*Math.ceil(s*phi/.35)>MAX_MOVES)throw new ConfigError(['This spiral-cell sheet exceeds the move limit. Use larger cells or a smaller swatch.']);
  const paths=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cx=startX+i*pitchX,cy=startY+j*pitchY;
    const localTwist=Math.max(.5,Math.min(4,phi+(tone?(tone(cx-box.minX,cy-box.minY)-.5)*.8:0)));
    for(let arm=0;arm<4;arm++){
      const rotation=arm*Math.PI/2,pts=[],count=Math.max(24,Math.ceil(s*localTwist/.35));
      for(let k=0;k<=count;k++){
        const t=k/count,r=.5*s*(1-t),a=sign*t*localTwist+rotation;
        pts.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});
      }
      // The radial equation ends at the exact midpoint of a shared cell edge.
      pts[0]= {x:cx+s/2*Math.cos(rotation),y:cy+s/2*Math.sin(rotation)};
      const path=densify(pts);path.family='arms';path.rowOrder=(j*cols+i)*4+arm;paths.push(path);
    }
    const ring=[];const n=Math.max(12,Math.ceil(2*Math.PI*width/.3));
    for(let k=0;k<=n;k++){const a=2*Math.PI*k/n;ring.push({x:cx+width*Math.cos(a),y:cy+width*Math.sin(a)});}
    const loop=densify(ring);loop.rowOrder=(j*cols+i)*4+3.5;paths.push(loop);
  }
  const {found}=findCrossings(paths.map((p)=>({pts:p.map((q)=>({...q,z:0}))})),{strandWidth:width,cell:1});
  found.forEach((crossing,index)=>{
    const id=`spiral-cell-joint:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){paths[pathIndex].joints??=[];paths[pathIndex].joints.push({id,x:crossing.x,y:crossing.y});}
  });
  const layers=[paths];layers.families=['arms'];layers.extra={families:['arms'],rows,columns:cols};
  return layers;
}

/** Conservative upper bound for the minimum radial spacing between successive turns. */
export function spiralMinimumGap({cell=12,twist=2.2}={}){
  return Math.max(0,Math.min(cell,Math.PI*cell/Math.max(.5,Number(twist)||2.2)));
}

export function sanitizeSpiralTwist(settings,{bead=.45}={}){
  const minimum=bead+.2,cell=Math.max(10,Number(settings.cell)||12),maxTwist=Math.max(.5,Math.min(4,Math.PI*cell/minimum));
  const twist=Math.min(maxTwist,Math.max(.5,Number(settings.twist)||2.2));
  const out={...settings,twist};
  if(twist!==settings.twist)out.spiralNote='Twist was reduced to preserve at least one bead plus 0.2 mm between turns.';
  else delete out.spiralNote;
  return out;
}
