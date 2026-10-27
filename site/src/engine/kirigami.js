import { PolygonBoundary } from './boundary.js';
import { polygonRegion } from './polygon-region.js';
import { clipPolyline, densify } from './layers.js';
import { ConfigError } from './params.js';
import { MAX_MOVES } from './tiler.js';

function capsule(cx,cy,length,width,segments=8){
  const r=width/2,half=Math.max(0,length/2-r),ring=[];
  for(let i=0;i<=segments;i++){const a=-Math.PI/2+Math.PI*i/segments;ring.push({x:cx+half+r*Math.cos(a),y:cy+r*Math.sin(a)});}
  for(let i=0;i<=segments;i++){const a=Math.PI/2+Math.PI*i/segments;ring.push({x:cx-half+r*Math.cos(a),y:cy+r*Math.sin(a)});}
  return ring;
}

/** A filled sheet with staggered rounded slits and one or two orthogonal solid-fill passes. */
export function kirigamiLayers(boundary,{slitLength=15,slitGap=1,interval=5,endSpacing=10,passes=2,strandWidth=.45}={}){
  const box=boundary.bbox(),length=Math.max(4,Number(slitLength)||15),gap=Math.max(1,Number(slitGap)||1),rowGap=Math.max(2,Number(interval)||5),ends=Math.max(2,Number(endSpacing)||10),passCount=Number(passes)===1?1:2,bead=Math.max(.3,Number(strandWidth)||.45);
  const dx=length+ends,dy=rowGap+gap,rows=Math.ceil((box.maxY-box.minY)/dy)+1,cols=Math.ceil((box.maxX-box.minX)/dx)+1;
  if(rows*cols>MAX_MOVES)throw new ConfigError(['This kirigami layout exceeds the slit limit. Use larger spacing or a smaller swatch.']);
  const slits=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cx=box.minX+length/2+ends/2+i*dx+(j%2?dx/2:0),cy=box.minY+gap/2+j*dy;
    if(cx-length/2<box.minX||cx+length/2>box.maxX||cy-gap/2<box.minY||cy+gap/2>box.maxY)continue;
    slits.push(capsule(cx,cy,length,gap));
  }
  const outer=boundary.rings??[],rings=polygonRegion([...outer,...slits],(x,y)=>boundary.contains(x,y)&&!slits.some(r=>{
    // A slit is capsule-shaped; the region boolean tests its polygon using an even-odd point test.
    let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;
  }));
  const region=new PolygonBoundary(rings),passesOut=[],pitch=Math.max(.3,bead*.82);
  for(let pass=0;pass<passCount;pass++){
    const lines=[],vertical=pass===1;
    const start=vertical?box.minX:box.minY,end=vertical?box.maxX:box.maxY;
    for(let c=start+pitch/2;c<end;c+=pitch){
      const raw=vertical?[{x:c,y:box.minY-1},{x:c,y:box.maxY+1}]:[{x:box.minX-1,y:c},{x:box.maxX+1,y:c}];
      for(const clipped of clipPolyline(densify(raw),region))if(clipped.length>1){clipped.family=vertical?'fill-90':'fill-0';clipped.role='native';lines.push(clipped);}
    }
    passesOut.push(lines);
  }
  const first=passesOut[0]??[],second=passesOut[1]??[];
  for(let i=0;i<first.length;i++)for(let j=0;j<second.length;j++){
    const a=first[i],b=second[j];if(a.length<2||b.length<2)continue;
    const p=a[0],q=a.at(-1),r=b[0],s=b.at(-1),rx=q.x-p.x,ry=q.y-p.y,sx=s.x-r.x,sy=s.y-r.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-9)continue;
    const t=((r.x-p.x)*sy-(r.y-p.y)*sx)/den,u=((r.x-p.x)*ry-(r.y-p.y)*rx)/den;
    if(t<0||t>1||u<0||u>1)continue;
    const joint={id:`fill-cross:${i}:${j}`,x:p.x+t*rx,y:p.y+t*ry};
    (a.joints??=[]).push(joint);(b.joints??=[]).push(joint);
  }
  const layers=[passesOut.flat()];
  layers.families=passCount===1?['fill-0']:['fill-0','fill-90'];
  layers.extra={families:layers.families,slits:slits.length,passes:passCount,ratio:gap/rowGap};
  return layers;
}
