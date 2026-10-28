import { clipPolyline, densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';
import { findCrossings } from './crossings.js';

/** Hollow nested arrowhead outlines. The columns fill the swatch's width; the rows are centred and run past its top and bottom, and the swatch cuts them. */
export function arrowheadLayers(boundary,{columns=4,cellHeight=15,hingeAngle=60,depth=.45,strand=.45}={}){
  const b=boundary.bbox(),cols=Math.max(1,Math.round(columns)),h=Math.max(3,Number(cellHeight)||15),d=Math.max(.2,Math.min(.7,Number(depth)||.45));
  const wall=Math.max(.3,Number(strand)||.45),angle=Math.max(30,Math.min(110,Number(hingeAngle)||60))*Math.PI/180;
  const cellWidth=(b.maxX-b.minX)/cols,stepY=h*(1-d),centreY=(b.minY+b.maxY)/2,count=Math.ceil((b.maxY-b.minY+h)/stepY)+1;
  if(cellWidth<wall*4)throw new ConfigError(['The swatch is too narrow for these arrowheads. Reduce columns.']);
  if(count*cols*12*Math.ceil(h/.5)>MAX_MOVES)throw new ConfigError(['This arrowhead sheet exceeds the move limit. Use larger cells or a smaller swatch.']);
  const arrows=[];
  for(let row=0;row<count;row++)for(let col=0;col<cols;col++){
    const cx=b.minX+cellWidth*(col+.5),cy=centreY+(row-(count-1)/2)*stepY;
    const width=cellWidth+2*wall,height=h,notch=cy+h*d;
    // Two chevrons form a hollow re-entrant arrow. Angle controls the arm run, retaining a clear hollow interior.
    const run=Math.min(width/2,h/(2*Math.tan(angle/2)));
    const outer=[{x:cx-width/2,y:cy-h/2},{x:cx+width/2,y:cy-h/2},{x:cx,y:cy+h/2},{x:cx-width/2,y:cy-h/2}];
    const inset=Math.min(wall,Math.min(width,h)*.2),inner=[{x:cx-width/2+inset,y:cy-h/2+inset},{x:cx+width/2-inset,y:cy-h/2+inset},{x:cx,y:cy+h/2-inset},{x:cx-width/2+inset,y:cy-h/2+inset}];
    // Re-entrant notch arm creates the characteristic arrowhead return, shared with the following nested row.
    const motif=[outer,inner,[{x:cx-width/2,y:cy-h/2},{x:cx,y:notch},{x:cx+width/2,y:cy-h/2}],[{x:cx-width/2,y:cy-h/2},{x:cx-run,y:cy-h/2+wall/2}]];
    for(const path of motif)for(const clipped of clipPolyline(densify(path),boundary,wall*2))if(clipped.length>1){clipped.family='arrows';clipped.unitId=`${row}:${col}`;arrows.push(clipped);}
  }
  const {found}=findCrossings(arrows.map((p)=>({pts:p.map((q)=>({...q,z:0}))})),{strandWidth:wall,cell:1});
  found.forEach((crossing,index)=>{
    const id=`arrowhead-crossing:${index}`;
    for(const pathIndex of [crossing.sa,crossing.sb]){
      const path=arrows[pathIndex];path.joints??=[];path.joints.push({id,x:crossing.x,y:crossing.y});
    }
  });
  const layers=[arrows];layers.families=['arrows'];
  layers.extra={families:layers.families,rows:count,columns:cols,hingeAngle:angle*180/Math.PI};
  return layers;
}
