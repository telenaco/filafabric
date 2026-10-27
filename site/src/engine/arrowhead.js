import { clipPolyline, densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { findCrossings } from './crossings.js';

const line=(a,b)=>densify([a,b]);
function railFill(x0,x1,y0,y1,pitch){
  const pts=[];let direction=1;
  for(let y=y0+pitch/2;y<y1;y+=pitch){
    const start={x:direction>0?x0:x1,y},end={x:direction>0?x1:x0,y};
    if(pts.length){const previous=pts.at(-1);pts.push(...line(previous,start).slice(1));}
    else pts.push(start);
    pts.push(...line(start,end).slice(1));direction*=-1;
  }
  return pts.length>1?[pts]:[];
}

/** Hollow nested arrowhead outlines anchored by continuous side rails. */
export function arrowheadLayers(boundary,{columns=4,cellHeight=15,hingeAngle=60,depth=.45,rail=5,strand=.45}={}){
  const b=boundary.bbox(),cols=Math.max(1,Math.round(columns)),h=Math.max(6,Number(cellHeight)||15),d=Math.max(.2,Math.min(.7,Number(depth)||.45));
  const r=Math.max(0,Number(rail)||0),wall=Math.max(.3,Number(strand)||.45),angle=Math.max(30,Math.min(110,Number(hingeAngle)||60))*Math.PI/180;
  const innerWidth=b.maxX-b.minX-2*r,cellWidth=innerWidth/cols,stepY=h*(1-d),rows=Math.ceil((b.maxY-b.minY)/stepY)+1;
  if(innerWidth<cols*wall*4)throw new ConfigError(['The swatch is too narrow for these arrowheads and rails. Reduce columns or rail width.']);
  if(rows*cols*12*Math.ceil(h/.5)>MAX_MOVES)throw new ConfigError(['This arrowhead sheet exceeds the move limit. Use larger cells or a smaller swatch.']);
  const arrows=[];
  for(let row=-1;row<rows;row++)for(let col=0;col<cols;col++){
    const cx=b.minX+r+cellWidth*(col+.5),cy=b.minY+h/2+row*stepY;
      const width=cellWidth+2*wall,height=h,notch=cy+h*d;
    // Two chevrons form a hollow re-entrant arrow. Angle controls the arm run, retaining a clear hollow interior.
    const run=Math.min(width/2,h/(2*Math.tan(angle/2)));
    const outer=[{x:cx-width/2,y:cy-h/2},{x:cx+width/2,y:cy-h/2},{x:cx,y:cy+h/2},{x:cx-width/2,y:cy-h/2}];
    const inset=Math.min(wall,Math.min(width,h)*.2),inner=[{x:cx-width/2+inset,y:cy-h/2+inset},{x:cx+width/2-inset,y:cy-h/2+inset},{x:cx,y:cy+h/2-inset},{x:cx-width/2+inset,y:cy-h/2+inset}];
    // Re-entrant notch arm creates the characteristic arrowhead return, shared with the following nested row.
    const motif=[outer,inner,[{x:cx-width/2,y:cy-h/2},{x:cx,y:notch},{x:cx+width/2,y:cy-h/2}],[{x:cx-width/2,y:cy-h/2},{x:cx-run,y:cy-h/2+wall/2}]];
    for(const path of motif)for(const clipped of clipPolyline(densify(path),boundary,wall*2))if(clipped.length>1){clipped.family='arrows';clipped.unitId=`${row}:${col}`;arrows.push(clipped);}
  }
  const rails=[];
  if(r>0){
    const pitch=Math.max(.3,wall*.8);
    rails.push(...railFill(b.minX+wall/2,b.minX+r,b.minY,b.maxY,pitch),...railFill(b.maxX-r,b.maxX-wall/2,b.minY,b.maxY,pitch));
  }
  for(const p of rails)p.family='rails';
  const paths=[...arrows,...rails],{found}=findCrossings(paths.map((p)=>({pts:p.map((q)=>({...q,z:0}))})),{strandWidth:wall,cell:1});
  found.forEach((crossing,index)=>{
    const id=`arrowhead-crossing:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){
      const path=paths[pathIndex];path.joints??=[];path.joints.push({id,x:crossing.x,y:crossing.y});
    }
  });
  const layers=[[...arrows,...rails]];layers.families=['arrows','rails'];
  layers.extra={families:layers.families,rows,columns:cols,hingeAngle:angle*180/Math.PI,edgeWarning:r===0?'Without side rails the arrowhead edges may fray.':null};
  return layers;
}
