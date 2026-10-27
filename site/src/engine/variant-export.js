import { bedFitErrors, PreflightError, writeGcode } from './gcode.js';
import { resolveConfig } from './params.js';
import { emitStrands } from './emit.js';
import { computeStats } from './stats.js';
import { fingerprint } from '../ui/swatch.js';

const GAP=10, MIN_SIZE=40;

/** Choose the largest same-aspect single-row swatches that fit the printer bed. */
export function planVariantLayout({width,height,count,machine,material,gap=GAP,minSize=MIN_SIZE,overrides={}}){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isInteger(count)||count<1)throw new TypeError('Variant layout needs positive dimensions and at least one card.');
  const minimumScale=Math.max(minSize/width,minSize/height);
  const candidates=[];
  for(let scale=1;scale>minimumScale+1e-9;scale-=.005)candidates.push(scale);
  candidates.push(minimumScale);
  for(const scale of candidates){
    const w=width*scale,h=height*scale,totalW=count*w+(count-1)*gap;
    try{
      const cfg=resolveConfig(machine,material,{...overrides,sample_width:totalW,sample_height:h});
      if(!bedFitErrors(cfg).length)return {width:w,height:h,totalWidth:totalW,totalHeight:h,gap,scaled:scale<.999999,scale,positions:Array.from({length:count},(_,i)=>({x:i*(w+gap),y:0}))};
    }catch{/* Try the next smaller swatch. */}
  }
  throw new PreflightError([`The ${count} variants do not fit on this bed, even at the minimum ${minSize} × ${minSize} mm swatch size.`]);
}

/** Re-emit independently validated variant toolpaths as one bed-layout G-code job. */
export function combineVariantResults(results,{machine,material,positions,width,height,settings={},print={},gap=GAP}={}){
  if(!Array.isArray(results)||!results.length||results.some(result=>!result?.strands?.length))throw new TypeError('Every variant must have printable strands.');
  if(positions?.length!==results.length)throw new TypeError('A layout position is required for each variant.');
  const first=results[0],cfg=resolveConfig(machine,material,{...first.cfg.t,sample_width:width,sample_height:height});
  const strands=[],pieces=[];
  results.forEach((result,index)=>{
    const card=result.designId??result.id??`variant-${index+1}`,hash=fingerprint({card,settings,print,material:material.id,machine:machine.id,width:first.cfg.t.sample_width,height:first.cfg.t.sample_height});
    const prefix=`variant-${index+1}-`,{x,y}=positions[index];
    for(let strandIndex=0;strandIndex<result.strands.length;strandIndex++){
      const strand=result.strands[strandIndex],pieceStrand={...strand,id:prefix+strand.id,pts:strand.pts.map(p=>({...p,x:p.x+x,y:p.y+y}))};
      if(index>0&&strandIndex===0&&result.strands.some(item=>item.pauseBefore))pieceStrand.pauseBefore=true;
      strands.push(pieceStrand);
    }
    pieces.push({index:index+1,card,settingsHash:hash,x,y,width:first.cfg.t.sample_width,height:first.cfg.t.sample_height});
  });
  const moves=emitStrands(strands,{retraction:cfg.derived.retraction});
  for(const piece of pieces){
    const tag=`variant-${piece.index}-`;
    const firstMove=moves.find(move=>move.extrude&&String(move.tag).startsWith(tag));
    if(firstMove)firstMove.comment=`piece ${piece.index}: ${piece.card} ${piece.settingsHash}`;
  }
  const stats=computeStats(moves,cfg,[]);
  stats.pieces=pieces.length;
  const comments=[`Print all variants; ${pieces.length} pieces; ${width} × ${height} mm each; ${gap} mm gaps`,...pieces.map(p=>`piece ${p.index}: ${p.card} ${p.settingsHash} at ${p.x},${p.y} mm`)];
  const gcode=writeGcode(moves,cfg,{stats,comments});
  return {gcode,cfg,stats,moves,strands,pieces,width,height,gap,settingsHash:fingerprint(pieces.map(p=>[p.card,p.settingsHash,p.x,p.y]))};
}
