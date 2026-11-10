import { ShapeUtils, Vector2 } from '../../vendor/three/three.module.js';
import { ConfigError } from './params.js';
import { roundedRectArea } from './extrusion.js';
import { offsetPolyline } from './drawing.js';

let kernel = null, loading = null;
/** Explicit async initialization; the synchronous generator never substitutes a different algorithm. */
export async function prepareAdaptiveSolids() {
  if (kernel) return;
  loading ??= import('../../vendor/arachne/slicer_core.js').then(({ default: create }) => create());
  try { kernel = await loading; }
  catch (error) { loading = null; throw new ConfigError([`Unable to load the adaptive solid engine: ${error.message}`]); }
}

const signedArea = ring => ring.reduce((n,p,i) => { const q=ring[(i+1)%ring.length]; return n+p.x*q.y-q.x*p.y; },0);
function ringPoints(source, positive) {
  let ring = source.map(p => ({x:p.x,y:p.y}));
  if (ring.length>1 && Math.hypot(ring[0].x-ring.at(-1).x,ring[0].y-ring.at(-1).y)<1e-8) ring.pop();
  if (ring.length<3 || ring.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)) || Math.abs(signedArea(ring))<1e-10) throw new ConfigError(['Adaptive solids require finite, closed nonzero-area outlines.']);
  if ((signedArea(ring)>0)!==positive) ring.reverse();
  return ring;
}

/** One watertight layer; outer CCW / holes CW also gives the side faces outward normals. */
export function solidMesh(ring, holes, height) {
  const rings=[ringPoints(ring,true),...holes.map(h=>ringPoints(h,false))];
  const count=rings.reduce((n,r)=>n+r.length,0);
  if(count>100_000) throw new ConfigError(['Adaptive solid outline exceeds 100,000 points. Simplify the drawing.']);
  const flat=rings.flat();
  const faces=ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(p.x,p.y)),rings.slice(1).map(r=>r.map(p=>new Vector2(p.x,p.y))));
  if(!faces.length) throw new ConfigError(['The adaptive solid outline could not be triangulated.']);
  const triangles=[];
  for(const f of faces) {
    triangles.push(f.map(i=>[flat[i].x,flat[i].y,height]));
    triangles.push([...f].reverse().map(i=>[flat[i].x,flat[i].y,0]));
  }
  for(const r of rings) for(let i=0;i<r.length;i++) {
    const a=r[i],b=r[(i+1)%r.length];
    triangles.push([[a.x,a.y,0],[b.x,b.y,0],[b.x,b.y,height]],[[a.x,a.y,0],[b.x,b.y,height],[a.x,a.y,height]]);
  }
  const bytes=new Uint8Array(84+50*triangles.length), view=new DataView(bytes.buffer);
  view.setUint32(80,triangles.length,true);
  triangles.forEach((t,i)=>t.flat().forEach((v,k)=>view.setFloat32(84+i*50+12+k*4,v,true)));
  return bytes;
}

/** Real upstream Arachne walls and rectilinear dense core. Printer commands from the vendor are discarded. */
export function adaptiveSolidPaths(ring,{holes=[],edged=[],bead=.45,layerHeight=.2,perimeters=2,layer=0,nozzleDiameter=.4}={}) {
  if(!Number.isFinite(bead)||bead<=layerHeight*(1-Math.PI/4)||!Number.isFinite(layerHeight)||layerHeight<=0) throw new ConfigError(['Adaptive bead width and layer height must describe a positive extrusion area.']);
  if(!Number.isInteger(perimeters)||perimeters<1||perimeters>50) throw new ConfigError(['Adaptive perimeters must be an integer from 1 to 50.']);
  if(!Number.isFinite(nozzleDiameter)||nozzleDiameter<=0) throw new ConfigError(['Adaptive nozzle diameter must be positive.']);
  if(!kernel) throw new ConfigError(['Initialize the adaptive solid engine with prepareAdaptiveSolids() before generating Arachne paths.']);
  // The upstream bridge tunes Arachne at 0.4 mm. Similarity-transform the geometry so its
  // minimum bead/feature thresholds follow the selected nozzle, then restore physical mm.
  const scale=0.4/nozzleDiameter, scaledRing=r=>r.map(p=>({x:p.x*scale,y:p.y*scale}));
  const adjustedHoles=holes.map((h,i)=>{
    if(!edged[i]) return h;
    const cw=ringPoints(h,false);
    return offsetPolyline([...cw,cw[0]],bead*0.8-bead/2).slice(0,-1);
  });
  const mesh=solidMesh(scaledRing(ring),adjustedHoles.map(scaledRing),layerHeight*scale);
  const sliced=kernel.slice(mesh,JSON.stringify({
    wall_generator:'arachne',wall_loops:perimeters,layer_height:layerHeight*scale,first_layer_height:layerHeight*scale,
    line_width:bead*scale,initial_layer_line_width:bead*scale,nozzle_diameter:0.4,
    top_shell_layers:1,bottom_shell_layers:1,infill_density:1,infill_angle:layer%2?90:0,
    sparse_infill_pattern:'rectilinear',top_surface_pattern:'monotonic',bottom_surface_pattern:'monotonic',
    top_bottom_infill_wall_overlap:15,skirt_loops:0,brim_width:0,auto_center:false,
    bed_width:10000,bed_depth:10000,bed_origin_x:-5000,bed_origin_y:-5000,
  }),()=>{});
  if(sliced.layers.length!==1) throw new ConfigError(['Adaptive solid engine did not produce exactly one vertical layer.']);
  const {paths,widths}=sliced.layers[0], out=[];
  let run=null;
  for(let i=0,j=0;i<paths.length;i+=8,j++) {
    const role=Math.round(paths[i+3])&15;
    if(role===0) {run=null;continue;}
    if(![1,2,3,7,8].includes(role)) throw new ConfigError([`Unexpected adaptive solid role ${role}.`]);
    const x=paths[i]/scale,y=paths[i+1]/scale,qx=paths[i+4]/scale,qy=paths[i+5]/scale,width=widths[j]/scale;
    if(![x,y,qx,qy,width].every(Number.isFinite)||width<=layerHeight*(1-Math.PI/4)) throw new ConfigError(['Adaptive engine returned an invalid bead.']);
    const wall=role===1||role===8, name=wall?'perimeter':'solid';
    if(!run||run.role!==name||Math.hypot(run.pts.at(-1).x-x,run.pts.at(-1).y-y)>1e-5) {
      run={role:name,routingGroup:wall?0:1,pts:[{x,y}]};out.push(run);
    }
    run.pts.push({x:qx,y:qy,width,flow:roundedRectArea(width,layerHeight)/roundedRectArea(bead,layerHeight)});
  }
  return out;
}
