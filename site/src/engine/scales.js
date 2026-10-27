import { ConfigError } from './params.js';
import { solidLayer } from './solid-fill.js';
import { hatch } from './layers.js';

export const SCALES_MAX_POINTS=260000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const regular=(cx,cy,r,n,rotation=0)=>Array.from({length:n},(_,i)=>({x:cx+r*Math.cos(rotation+2*Math.PI*i/n),y:cy+r*Math.sin(rotation+2*Math.PI*i/n)}));
const inside=(boundary,ring)=>ring.every((p,i)=>{const q=ring[(i+1)%ring.length];for(let k=0;k<=4;k++){const t=k/4;if(!boundary.contains(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t))return false;}return true;});

/** Solid carrier with inset, separated tile islands, printed as a stacked pseudo-scale sheet. */
export function scalesLayers(boundary,{tile='hex',pitch=8,gap=.4,scaleLayers=4,carrierLayers=2,carrier='solid',interlock=false,bead=.45}={}){
  if(!['hex','square','triangle'].includes(tile))throw new ConfigError(['Choose hex, square or triangle scales.']);
  if(!['solid','net'].includes(carrier))throw new ConfigError(['Choose a solid or open-net carrier.']);
  const size=clamp(Number(pitch)||8,4,20),clearance=clamp(Number(gap)||.4,.4,2),upper=Math.max(1,Math.min(10,Math.round(Number(scaleLayers)||4))),base=Math.max(1,Math.min(3,Math.round(Number(carrierLayers)||2))),box=boundary.bbox(),layers=Array.from({length:base+upper},()=>[]),rings=boundary.rings??[];
  if(!rings.length)throw new ConfigError(['A closed carrier boundary is required for scales.']);
  if(carrier==='solid')for(let k=0;k<base;k++)for(const ring of rings)layers[k].push(...solidLayer(ring,{bead,layer:k}));
  else for(let k=0;k<base;k++)layers[k].push(...hatch(boundary,{angle:k%2?90:0,spacing:Math.max(1.2,bead*2.5)}));
  const polygons=[],stepX=tile==='square'?size:size*.75,stepY=tile==='triangle'?size*Math.sqrt(3)/2:tile==='hex'?size*Math.sqrt(3)/2:size;
  for(let row=0,cy=box.minY+size/2;cy<=box.maxY-size/2+1e-6;row++,cy+=stepY){
    for(let col=0,cx=box.minX+size/2+(tile==='hex'&&row%2?stepX/2:0);cx<=box.maxX-size/2+1e-6;col++,cx+=stepX){
      const vertices=tile==='square'?[{x:cx-(size-clearance)/2,y:cy-(size-clearance)/2},{x:cx+(size-clearance)/2,y:cy-(size-clearance)/2},{x:cx+(size-clearance)/2,y:cy+(size-clearance)/2},{x:cx-(size-clearance)/2,y:cy+(size-clearance)/2}]:regular(cx,cy,size/(tile==='triangle'?1.8:2) - clearance/2,tile==='triangle'?3:6,tile==='triangle'?-Math.PI/2:0);
      if(inside(boundary,vertices)){polygons.push(vertices);for(let k=0;k<upper;k++)layers[base+k].push(...solidLayer(vertices,{bead,layer:interlock&&k===0?1:k}));}
    }
  }
  if(!polygons.length)throw new ConfigError(['No complete scale tiles fit inside this carrier. Increase the swatch size or reduce tile pitch.']);
  // every layer is a solid fill, so a thick sheet is a great many points: past this the studio takes minutes and the file runs to hundreds of MB
  const points=layers.flat().reduce((n,p)=>n+p.length,0);
  if(points>SCALES_MAX_POINTS)throw new ConfigError([`This tile sheet would need about ${Math.round(points/1000)} thousand points; the limit is ${SCALES_MAX_POINTS/1000} thousand (a 100 mm square takes two tile layers on one carrier layer). Use fewer tile or carrier layers, an open-net carrier or a smaller swatch.`]);
  layers.families=Array.from({length:layers.length},(_,k)=>k<base?'carrier':`scales-${k-base+1}`);layers.extra={families:layers.families,carrierPasses:base,carrier,scaleLayers:upper,tile,pitch:size,gap:clearance,tiles:polygons.length,interlock:!!interlock,interlockApproximation:interlock?'Concentric first-layer fill approximates a keyed groove; it is not a mechanical interlock.':undefined};return layers;
}
