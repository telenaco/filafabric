/** Measured flow-to-width tables. No guessed measurements are supplied. */
export function sanitizeWidthMaps(raw) {
  const out={};
  for(const key of ['bed','overNet']){
    const rows=raw?.[key];if(rows==null||Array.isArray(rows)&&!rows.length)continue;
    if(!Array.isArray(rows)||rows.length<2||rows.length>32)throw new TypeError(`${key}: enter 2–32 measured flow/width pairs.`);
    const points=rows.map(row=>({flow:Number(row?.flow),width:Number(row?.width)}));
    if(points.some((point,i)=>!Number.isFinite(point.flow)||!Number.isFinite(point.width)||point.flow<.1||point.flow>3||point.width<.05||point.width>5||i>0&&(point.flow<=points[i-1].flow||point.width<=points[i-1].width)))throw new TypeError(`${key}: flow (0.1–3) and measured width (0.05–5 mm) must both increase.`);
    out[key]=points;
  }
  return Object.keys(out).length?out:null;
}

export function flowForWidth(width,table) {
  if(!table?.length)return null;
  if(width<=table[0].width)return table[0].flow;
  if(width>=table.at(-1).width)return table.at(-1).flow;
  const i=table.findIndex(point=>point.width>=width),a=table[i-1],b=table[i];
  return a.flow+(b.flow-a.flow)*(width-a.width)/(b.width-a.width);
}
