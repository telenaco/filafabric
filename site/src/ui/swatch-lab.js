import { el } from './dom.js';
import { designById } from './designs.js';
import { fingerprint } from './swatch.js';
import { buildSwatch } from './export-builder.js';
import { printerFileToken } from './file-name.js';

export const SWATCH_SETS = {
  rings:{label:'Comparison · Rings',pieces:[['rings-flat',{}],['chainmail',{}],['rings-raised',{}]]},
  grid:{label:'Comparison · Grid',pieces:[['crosshatch',{}],['grid-lifted',{}],['grid-sliding',{}]]},
  bonding:{label:'Comparison · Bonded / gapped bundles',pieces:[['crosshatch',{bundle:5,bundleTouch:true}],['crosshatch',{bundle:5,bundleTouch:false}]]},
  layers:{label:'Comparison · Layer thickness',pieces:[['rotated-stack',{layers:6},.1],['rotated-stack',{layers:4},.15],['rotated-stack',{layers:2},.3]]},
  waves:{label:'Comparison · Wave / bridged wave',pieces:[['squiggle',{}],['wave-bridged',{}]]},
  lifts:{label:'Calibration · Lift × fan',pieces:[.5,1,1.5].flatMap(lift=>[0,60,100].map(liftFan=>['grid-lifted',{lift,liftFan}]))},
  channels:{label:'Calibration · Sliding channels',pieces:[.8,1,1.2].flatMap(spanLift=>[1.6,2,2.4].map(channelLift=>['grid-sliding',{spanLift,channelLift}]))},
  climbing:{label:'Calibration · Climbing levels / ramps',pieces:[.2,.3].flatMap(levelHeight=>[1,1.5,2.5].map(rampLength=>['rings-raised',{levelHeight,rampLength}]))},
  bridges:{label:'Calibration · Bridge roundness',pieces:[.6,1,1.6].map(filletRadius=>['wave-bridged',{filletRadius}])},
  thickness:{label:'Calibration · Thickness wedge',pieces:[.6,1,1.4,1.8].map(flow=>['squiggle',{pattern:'gradientX',patternEffect:'thickness',thin:flow,thick:flow}])},
  exposure:{label:'Calibration · Colour exposure',pieces:[0,.1,.2,.3].map(exposureHeight=>['colour-exposure',{exposureHeight}])},
};

export function swatchRecord({code,card,settings,machine,material,width,height,print,construction}) {
  return `# Swatch ${code}\n\n- Card: ${card}\n- Settings hash: ${fingerprint(settings)}\n- Machine: ${machine}\n- Material: ${material}\n- Nominal size: ${width} × ${height} mm\n- Generated: ${new Date().toISOString()}\n- Print date: pending\n- Printed by: pending\n- Material batch: pending\n- Verdict: **Not printed — untested**\n\n## Settings\n\n\`\`\`json\n${JSON.stringify({settings,print},null,2)}\n\`\`\`\n\n## Print evidence (Luis completes after printing)\n\n- Photos: front/back, flat/draped, same support\n- Actual size and mass: pending\n- Areal mass (g/m²): pending\n- Strand width at five points: pending\n- Crossing height at five points: pending\n- Low-force extension X / Y / bias: pending\n- Unloading and recovery after 1 / 10 cycles: pending\n- Drape: support dimensions, weights, twelve views at 30°, coefficient and folds: pending\n- Raised: measured Z envelope, dragging/snags, movable crossings: pending\n- Good / usable with notes / failed, with reason: pending\n\n## Software construction (not print evidence)\n\n\`\`\`json\n${JSON.stringify(construction??{},null,2)}\n\`\`\`\n`;
}

// Uncompressed ZIP writer: browser-native bytes, no dependency or server upload.
const crc32 = bytes => {let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
export function zipFiles(files) {
  const encode=new TextEncoder(),chunks=[],central=[];let offset=0;
  const record=(size)=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
  for(const [name,content] of files){
    const filename=encode.encode(name),body=typeof content==='string'?encode.encode(content):content,crc=crc32(body);
    if(body.length>=0xffffffff||offset+body.length+filename.length+30>=0xffffffff)throw new Error('This comparison archive exceeds the ZIP format size limit. Export individual pieces instead.');
    const local=record(30+filename.length);local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint16(12,0x21,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,body.length,true);local.view.setUint32(22,body.length,true);local.view.setUint16(26,filename.length,true);local.bytes.set(filename,30);
    chunks.push(local.bytes,body);
    const entry=record(46+filename.length);entry.view.setUint32(0,0x02014b50,true);entry.view.setUint16(4,20,true);entry.view.setUint16(6,20,true);entry.view.setUint16(8,0x800,true);entry.view.setUint16(14,0x21,true);entry.view.setUint32(16,crc,true);entry.view.setUint32(20,body.length,true);entry.view.setUint32(24,body.length,true);entry.view.setUint16(28,filename.length,true);entry.view.setUint32(42,offset,true);entry.bytes.set(filename,46);central.push(entry.bytes);
    offset+=local.bytes.length+body.length;
  }
  const centralSize=central.reduce((n,bytes)=>n+bytes.length,0),end=record(22);
  end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end.bytes],{type:'application/zip'});
}

export function bindSwatchLab({ button, options, download }) {
  const picker = el('select', { 'aria-label': 'Comparison or calibration set' },
    ...Object.entries(SWATCH_SETS).map(([value, set]) => el('option', { value, text: set.label })));
  const width = el('input', { type: 'number', min: 10, max: 1000, step: 1, value: 40 });
  const height = el('input', { type: 'number', min: 10, max: 1000, step: 1, value: 30 });
  const status = el('p', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
  const progress = el('progress', { max: 1, value: 0, hidden: true });
  const cancel = el('button', { type: 'button', class: 'btn', text: 'Close' });
  const start = el('button', { type: 'button', class: 'btn primary', text: 'Build and download ZIP' });
  const dialog = el('dialog', { class: 'swatch-lab', 'aria-labelledby': 'swatch-lab-title' },
    el('h2', { id: 'swatch-lab-title', text: 'Comparison & calibration swatches' }),
    el('p', { class: 'muted', text: 'One separate G-code file per piece, exact dimensions, with blank print records. No automatic shrinking. These are starting recipes, not calibrated recommendations.' }),
    el('label', { class: 'field-row stacked' }, el('span', { text: 'Set' }), picker),
    el('label', { class: 'field-row' }, el('span', { text: 'Width (mm)' }), width),
    el('label', { class: 'field-row' }, el('span', { text: 'Height (mm)' }), height),
    el('p', { class: 'small muted', text: 'Print each file separately using the same material batch. Sliding channels: review the nozzle temperature before printing. Calibrate bed and over-net thickness separately.' }),
    progress, status, el('div', { class: 'dialog-actions' }, cancel, start));
  document.body.append(dialog);

  let activeJob = null;
  const controls = (busy) => {
    for (const control of [start, picker, width, height]) control.disabled = busy;
    cancel.textContent = busy ? 'Cancel build' : 'Close';
  };
  const finish = (job) => {
    if (activeJob !== job) return;
    activeJob = null;
    controls(false);
  };
  const cancelBuild = () => {
    const job = activeJob;
    if (!job) return;
    finish(job);
    job.abort();
    progress.hidden = true;
    status.textContent = 'Build cancelled.';
  };

  button.addEventListener('click', () => {
    if (dialog.open) return;
    cancelBuild();
    dialog.showModal();
  });
  cancel.addEventListener('click', () => { cancelBuild(); dialog.close(); });
  dialog.addEventListener('cancel', cancelBuild);
  // The browser queues the close event. The dialog might already host a new build when it arrives.
  dialog.addEventListener('close', () => { if (!dialog.open) cancelBuild(); });

  start.addEventListener('click', async () => {
    if (activeJob || !dialog.open) return;
    const w = Number(width.value), h = Number(height.value);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 10 || h < 10 || w > 1000 || h > 1000) {
      status.textContent = 'Enter dimensions from 10 to 1000 mm; the selected printer must fit them.';
      return;
    }
    const setKey = picker.value;
    if (!Object.hasOwn(SWATCH_SETS, setKey)) {
      status.textContent = 'Choose a comparison or calibration set.';
      return;
    }
    const set = SWATCH_SETS[setKey];
    const job = new AbortController();
    activeJob = job;
    controls(true);
    progress.hidden = false;
    progress.value = 0;

    try {
      const captured = structuredClone(options());
      const printer = printerFileToken(captured.machine);
      const files = [], manifest = [];
      for (const [index, [card, patch, layerHeight]] of set.pieces.entries()) {
        const mod = designById(card);
        status.textContent = `Building ${index + 1} of ${set.pieces.length}: ${mod.name}…`;
        progress.value = index / set.pieces.length;
        const settings = mod.sanitize({ ...mod.defaults(), ...patch, width: w, height: h });
        const input = { ...captured, design: card, width: w, height: h, settings, studySettings: settings,
          outline: null, vector: null, regions: null, image: null, extraLayers: 0, legacyCopies: undefined, meshPerimeters: 0 };
        if (layerHeight) input.material = { ...input.material, print_defaults: { ...input.material.print_defaults, layer_height: layerHeight } };
        const result = await buildSwatch(input, { signal: job.signal });
        if (activeJob !== job) return;
        if (!dialog.open) { cancelBuild(); return; }

        const code = `${card}-${fingerprint({ settings, material: input.material, machine: input.machine.id, width: w, height: h })}`;
        const stem = [String(index + 1).padStart(2, '0'), printer, code].filter(Boolean).join('-');
        files.push([`${stem}.gcode`, result.gcode.replace('; BODY START', `; swatch ${code}\n; BODY START`)]);
        const record = { code, card, settings, machine: input.machine.id, material: input.material.id, width: w, height: h,
          print: { layerHeight: layerHeight ?? captured.material.print_defaults?.layer_height }, construction: result.construction };
        files.push([`records/${stem}.md`, swatchRecord(record)]);
        manifest.push({ ...record, construction: undefined });
      }

      files.push(
        ['manifest.json', JSON.stringify({ set: set.label, printed: false, pieces: manifest }, null, 2)],
        ['README.md', `# ${set.label}\n\nPrint each G-code separately. All pieces are ${w} × ${h} mm, without resizing. Fill in records only after actual prints. No measured properties or successful prints are claimed.\n`],
      );
      const archive = ['filafabric', setKey, printer, fingerprint(manifest)].filter(Boolean).join('-');
      download(`${archive}.zip`, zipFiles(files));
      progress.value = 1;
      status.textContent = `Saved ${set.pieces.length} G-code files and blank evidence records.`;
    } catch (error) {
      if (activeJob !== job) return;
      if (!dialog.open) { cancelBuild(); return; }
      status.textContent = error.name === 'AbortError' ? 'Build cancelled.' : `Could not build this set: ${error.message}`;
    } finally {
      finish(job);
    }
  });
}
