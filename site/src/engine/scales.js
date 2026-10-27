import { ConfigError } from './params.js';
import { solidLayer } from './solid-fill.js';
import { hatch } from './layers.js';

export const SCALES_MAX_POINTS=260000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const regular=(cx,cy,r,n,rotation=0)=>Array.from({length:n},(_,i)=>({x:cx+r*Math.cos(rotation+2*Math.PI*i/n),y:cy+r*Math.sin(rotation+2*Math.PI*i/n)}));
const inside=(boundary,ring)=>ring.every((p,i)=>{const q=ring[(i+1)%ring.length];for(let k=0;k<=4;k++){const t=k/4;if(!boundary.contains(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t))return false;}return true;});

const sizes=(pitch,gap)=>({size:clamp(Number(pitch)||8,4,20),clearance:clamp(Number(gap)||.4,.4,2)});

const SQRT3=Math.sqrt(3);
/** Shrink a tile about its centre so that its inradius loses half the gap: two neighbours then stand exactly one gap apart across a shared edge. */
const inset=(ring,centre,inradius,clearance)=>{const f=1-clearance/2/inradius;return ring.map((p)=>({x:centre.x+(p.x-centre.x)*f,y:centre.y+(p.y-centre.y)*f}));};

/** The tile outlines (closed rings, no repeated end point) of a true tiling at `pitch`, each shrunk by half the gap and lying fully inside the boundary. */
export function scaleTiles(boundary,{tile='hex',pitch=8,gap=.4}={}){
  if(!['hex','square','triangle'].includes(tile))throw new ConfigError(['Choose hex, square or triangle scales.']);
  const {size,clearance}=sizes(pitch,gap),box=boundary.bbox(),polygons=[],keep=(ring)=>{if(inside(boundary,ring))polygons.push(ring);};
  if(tile==='square'){
    for(let cy=box.minY+size/2;cy<=box.maxY-size/2+1e-6;cy+=size)for(let cx=box.minX+size/2;cx<=box.maxX-size/2+1e-6;cx+=size){
      const h=size/2;keep(inset([{x:cx-h,y:cy-h},{x:cx+h,y:cy-h},{x:cx+h,y:cy+h},{x:cx-h,y:cy+h}],{x:cx,y:cy},h,clearance));
    }
  }else if(tile==='hex'){ // flat-topped hexagons, point to point = pitch: columns 1.5R apart, every other column half a hexagon down
    const R=size/2,rho=SQRT3*R/2;
    for(let i=0,cx=box.minX+R;cx<=box.maxX-R+1e-6;i++,cx+=1.5*R)for(let cy=box.minY+rho+(i%2?rho:0);cy<=box.maxY-rho+1e-6;cy+=2*rho)keep(inset(regular(cx,cy,R,6,0),{x:cx,y:cy},rho,clearance));
  }else{ // up and down triangles of side `pitch`, every other row half a triangle along
    const rowHeight=size*SQRT3/2,rho=size/(2*SQRT3);
    for(let j=0;box.minY+(j+1)*rowHeight<=box.maxY+1e-6;j++){
      const top=box.minY+j*rowHeight,bottom=top+rowHeight,start=box.minX-size+(j%2?size/2:0);
      for(let a=start;a<=box.maxX+1e-6;a+=size){
        const up=[{x:a,y:bottom},{x:a+size,y:bottom},{x:a+size/2,y:top}],down=[{x:a+size/2,y:top},{x:a+size*1.5,y:top},{x:a+size,y:bottom}];
        keep(inset(up,{x:a+size/2,y:bottom-rowHeight/3},rho,clearance));
        keep(inset(down,{x:a+size,y:top+rowHeight/3},rho,clearance));
      }
    }
  }
  return polygons;
}

/** Solid carrier with inset, separated tile islands, printed as a stacked pseudo-scale sheet. */
export function scalesLayers(boundary,{tile='hex',pitch=8,gap=.4,scaleLayers=4,carrierLayers=2,carrier='solid',interlock=false,bead=.45}={}){
  if(!['hex','square','triangle'].includes(tile))throw new ConfigError(['Choose hex, square or triangle scales.']);
  if(!['solid','net'].includes(carrier))throw new ConfigError(['Choose a solid or open-net carrier.']);
  const {size,clearance}=sizes(pitch,gap),upper=Math.max(1,Math.min(10,Math.round(Number(scaleLayers)||4))),base=Math.max(1,Math.min(3,Math.round(Number(carrierLayers)||2))),layers=Array.from({length:base+upper},()=>[]),rings=boundary.rings??[];
  if(!rings.length)throw new ConfigError(['A closed carrier boundary is required for scales.']);
  if(carrier==='solid')for(let k=0;k<base;k++)for(const ring of rings)layers[k].push(...solidLayer(ring,{bead,layer:k,kind:'zigzag'}));
  else for(let k=0;k<base;k++)layers[k].push(...hatch(boundary,{angle:k%2?90:0,spacing:Math.max(1.2,bead*2.5)}));
  const polygons=scaleTiles(boundary,{tile,pitch,gap});
  for(const vertices of polygons)for(let k=0;k<upper;k++)layers[base+k].push(...solidLayer(vertices,{bead,layer:interlock&&k===0?1:k,kind:'zigzag'}));
  if(!polygons.length)throw new ConfigError(['No complete scale tiles fit inside this carrier. Increase the swatch size or reduce tile pitch.']);
  // every layer is a solid fill, so a thick sheet is a great many points: past this the studio takes minutes and the file runs to hundreds of MB
  const points=layers.flat().reduce((n,p)=>n+p.length,0);
  if(points>SCALES_MAX_POINTS)throw new ConfigError([`This tile sheet would need about ${Math.round(points/1000)} thousand points; the limit is ${SCALES_MAX_POINTS/1000} thousand. Use fewer tile or carrier layers, an open-net carrier or a smaller swatch.`]);
  layers.families=Array.from({length:layers.length},(_,k)=>k<base?'carrier':`scales-${k-base+1}`);// a fill starts and ends where it began, so its own start touches its end and the pipeline would lift that spot: every strand sits at its layer's height
  layers.extra={planes:true,transform:(strands,cfg)=>strands.map(st=>({...st,pts:st.pts.map(pt=>({...pt,z:(st.layer+1)*cfg.t.layer_height}))})),families:layers.families,carrierPasses:base,carrier,scaleLayers:upper,tile,pitch:size,gap:clearance,tiles:polygons.length,interlock:!!interlock,interlockApproximation:interlock?'Concentric first-layer fill approximates a keyed groove; it is not a mechanical interlock.':undefined};return layers;
}
