import test from 'node:test';
import assert from 'node:assert/strict';
import * as gcode from '../src/engine/gcode.js';
import { generate } from '../src/engine/generate.js';
import { defaultProfiles } from './helpers.js';
import { exportPanel } from '../src/engine/panel.js';
import { DESIGNS } from '../src/ui/designs.js';
import { toTextile } from '../src/ui/controls.js';

test('streaming prints a single full-outline brim before backing, and records its setting', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'crosshatch', width: 60, height: 40, repeat: 20 };
  let text = '';
  const stats = await exportPanel(options, { write: async (s) => { text += s; } });
  assert.equal(stats.print.brim, 2);
  const tags = [...text.matchAll(/; brim run (brim-[^\n]+)/g)].map((m) => m[1]);
  assert.equal(tags.length, 2, 'two runs around the complete piece, never around each section');
  assert.ok(text.indexOf('; brim run brim-') < text.indexOf('; texture section '));
  let off = '';
  const noBrim = await exportPanel({ ...options, brim: 0 }, { write: async (s) => { off += s; } });
  assert.equal(noBrim.print.brim, 0);
  assert.ok(!off.includes('; brim run brim-'));
  assert.ok(stats.filamentMm > noBrim.filamentMm);
});

test('every design exports bounded texture sections with the appropriate row precedence', async () => {
  const { machine, material } = defaultProfiles();
  for (const d of DESIGNS.filter((d) => d.status === 'ready')) {
    let text = '';
    const settings = d.id === 'loop-pile' ? toTextile(d.defaults()) : d.defaults();
    const r = await exportPanel({ machine, material, design: d.id, settings, width: 60, height: 60, repeat: 30 }, { write: async (s) => { text += s; } });
    assert.equal(r.sections, 4, d.id);
    assert.match(text, /BODY END/, d.id);
    assert.match(text, ['loop-pile', 'relief', 'fringe'].includes(d.id) ? /texture section 1; origin 0,30/ : /texture section 1; origin 0,0/, d.id);
  }
});

test('panel export preserves layer, nozzle, free-strand classes and selected pile fields', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'loop-pile', width: 30, height: 30, repeat: 30, settings: { layer_height: 0.4, nozzle_diameter: 0.8, extrusion_width: 0.9, boundary_policy: 'footprint' } };
  let normal = '', patterned = '';
  await exportPanel(options, { write: async (s) => { normal += s; } });
  await exportPanel({ ...options, pilePattern: 'diamondGrid' }, { write: async (s) => { patterned += s; } });
  assert.match(normal, /"layer_height":0.4/);
  assert.match(normal, /"nozzle_diameter":0.8/);
  assert.notEqual(patterned, normal);
});

test('full-panel squiggle uses the imported image sampler', async () => {
  const { machine, material } = defaultProfiles();
  const options = { machine, material, design: 'squiggle', width: 30, height: 30, repeat: 30, settings: { pattern: 'image' } };
  const render = async (tone) => { let text = ''; await exportPanel({ ...options, image: { width: 1, height: 1, data: new Uint8ClampedArray([tone, tone, tone, 255]) } }, { write: async (s) => { text += s; } }); return text; };
  assert.notEqual(await render(0), await render(255));
});

test('streamed G-code preserves extrusion, fan and retraction state across chunk boundaries', () => {
  assert.equal(typeof gcode.GcodeWriter, 'function');
  const { machine, material } = defaultProfiles();
  const result = generate(machine, material, { sample_width: 20, sample_height: 20 });
  const writer = new gcode.GcodeWriter(result.cfg);
  const lines = [...writer.header({ stats: result.stats })];
  for (const move of result.moves) lines.push(...writer.move(move));
  lines.push(...writer.footer());
  assert.equal(lines.join('\n') + '\n', gcode.writeGcode(result.moves, result.cfg, { stats: result.stats }));
});

test('a 1000 mm panel streams bounded sections without constructing a full move list', async () => {
  const { exportPanel } = await import('../src/engine/panel.js');
  const { machine, material } = defaultProfiles();
  const gantry = { ...machine, id: 'test-gantry', bed: { width: 1000, depth: 1000, max_z: 300 } };
  let bytes = 0, largest = 0, first = '', last = '';
  const stats = await exportPanel({ machine: gantry, material, design: 'crosshatch', settings: { directions: '0-90', spacing: 8, size: 0 }, width: 1000, height: 1000, repeat: 50 }, {
    write: async (text) => { bytes += text.length; largest = Math.max(largest, text.length); first ||= text; last = text; },
  });
  assert.ok(bytes > 100000);
  assert.ok(largest < 270000);
  assert.ok(stats.sections >= 400);
  assert.ok(stats.peakSectionMoves < 10000);
  assert.match(first, /1000 x 1000/);
  assert.match(last, /BODY END/);
});

test('panel cancellation stops generation without an end block', async () => {
  const { exportPanel } = await import('../src/engine/panel.js');
  const { machine, material } = defaultProfiles(), controller = new AbortController();
  let ended = false;
  await assert.rejects(exportPanel({ machine, material, design: 'crosshatch', settings: {}, width: 100, height: 100, repeat: 50 }, {
    write: async (text) => { if (text.includes('BODY END')) ended = true; }, signal: controller.signal,
    progress: ({ phase }) => { if (phase === 'texture') controller.abort(); },
  }), { name: 'AbortError' });
  assert.equal(ended, false);
});

test('panel outlines clip texture first, then tie every remaining region to the backing', async () => {
  const { machine, material } = defaultProfiles();
  const outer = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }];
  const hole = [{ x: 24, y: 24 }, { x: 36, y: 24 }, { x: 36, y: 36 }, { x: 24, y: 36 }];
  const concave = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 60 }, { x: 0, y: 60 }];
  for (const outline of [[outer, hole], [concave]]) {
    let ended = false;
    const r = await exportPanel({ machine, material, design: 'crosshatch', settings: {}, width: 60, height: 60, repeat: 20, outline }, { write: async (s) => { ended ||= s.includes('BODY END'); } });
    assert.equal(r.sections, 9);
    assert.equal(ended, true);
  }
});

test('a picture spans the whole panel: each section is its own window onto it, not the picture again', async () => {
  const { machine, material } = defaultProfiles();
  // 2 x 1 px: black on the left, white on the right
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) };
  let text = '';
  await exportPanel({ machine, material, design: 'squiggle', width: 60, height: 30, repeat: 30, settings: { pattern: 'image', mode: 'cross', width: 60, height: 30, spacing: 3, amplitude: 1.2, wavelength: 4 }, image }, { write: async (s) => { text += s; } });
  const parts = text.split(/; texture section \d+; origin [\d.,]+\n/);
  assert.equal(parts.length >= 3, true, 'two sections');
  const filament = (chunk) => [...chunk.matchAll(/ E(-?\d+\.\d+)/g)].reduce((n, m) => n + Math.max(0, Number(m[1])), 0);
  const left = filament(parts[1]), right = filament(parts[2]);
  assert.ok(left > right * 1.03, `the dark left half uses more line than the light right half (${left.toFixed(1)} vs ${right.toFixed(1)})`);
});

const renderPanel=async(options)=>{ let text='';const stats=await exportPanel({...defaultProfiles(),design:'crosshatch',width:40,height:30,repeat:20,brim:0,...options},{write:async(s)=>{text+=s;}});return{stats,text};};
const panelBody=(text)=>text.split('; BODY START\n')[1].split('; texture section ')[0];
const extrusions=(text)=>{let pos={x:0,y:0,z:0};const out=[];for(const line of text.split('\n')){if(!line.startsWith('G1 '))continue;const prior={...pos};for(const axis of ['x','y','z']){const m=line.match(new RegExp(`(?:^| )${axis.toUpperCase()}(-?[\\d.]+)`));if(m)pos[axis]=Number(m[1]);}const e=line.match(/(?:^| )E(-?[\d.]+)/);if(e&&Number(e[1])>0&&Math.hypot(pos.x-prior.x,pos.y-prior.y)>1e-5)out.push({a:prior,b:{...pos}});}return out;};

test('extra layers default to zero and count individual native texture passes above the one-time backing',async()=>{
  const implicit=await renderPanel({}),zero=await renderPanel({extraLayers:0}),one=await renderPanel({extraLayers:1});
  assert.equal(implicit.text,zero.text);
  assert.equal(zero.stats.print.extraLayers,0);
  assert.equal(zero.stats.print.nativeLayers,4,'two global backing plus two native texture passes');
  assert.equal(zero.stats.print.totalLayers,4);
  assert.equal(one.stats.print.extraLayers,1);
  assert.equal(one.stats.print.totalLayers,5);
  assert.deepEqual(one.stats.print.sequence,[0,1,0]);
  assert.equal(panelBody(one.text),panelBody(zero.text),'full backing prints once');
  assert.ok(one.stats.filamentMm>zero.stats.filamentMm);
});

test('legacy whole-copy layer options retain their output only while extraLayers is absent',async()=>{
  const original=await renderPanel({extraLayers:0}),legacy=await renderPanel({layers:2}),overridden=await renderPanel({layers:2,extraLayers:0});
  assert.equal(overridden.text,original.text);
  assert.ok(legacy.stats.filamentMm>original.stats.filamentMm);
  assert.equal(legacy.stats.print.extraLayers,2);
  assert.equal(legacy.stats.print.totalLayers,6);
});

test('single-layer texture alternates90degrees and fills its full section footprint',async()=>{
  const {stats,text}=await renderPanel({design:'coil',width:30,height:20,repeat:30,settings:{shape:'zigzag',size:1,pitch:5,rowOverlap:10},extraLayers:1});
  assert.equal(stats.print.nativeLayers,3);
  assert.equal(stats.print.totalLayers,4);
  assert.deepEqual(stats.print.rotations,[0,90]);
  const lines=extrusions(text.split('; texture section 1;')[1]);
  const minX=Math.min(...lines.flatMap(s=>[s.a.x,s.b.x])),maxX=Math.max(...lines.flatMap(s=>[s.a.x,s.b.x]));
  const minY=Math.min(...lines.flatMap(s=>[s.a.y,s.b.y])),maxY=Math.max(...lines.flatMap(s=>[s.a.y,s.b.y]));
  assert.ok(maxX-minX>27&&maxY-minY>17,'both passes cover the selected section');
});

test('raised texture prints once above reinforced backing when extras are requested',async()=>{
  const zero=await renderPanel({design:'loop-pile',width:30,height:30,repeat:30,extraLayers:0}),extra=await renderPanel({design:'loop-pile',width:30,height:30,repeat:30,extraLayers:2});
  assert.equal(extra.stats.print.extraLayers,2);
  assert.equal(extra.stats.print.mode,'backing');
  assert.equal(extra.stats.print.backingLayers,4,'two global and two native backing passes');
  assert.equal(extra.stats.print.totalBackingLayers,6);
  assert.equal(extra.stats.print.repeatable,true);
  assert.equal(panelBody(extra.text),panelBody(zero.text),'global backing remains one copy');
  const raised=(text,minZ)=>extrusions(text.split('; texture section 1;')[1]).filter(s=>s.a.z>minZ&&s.b.z>minZ);
  const original=raised(zero.text,.85),reinforced=raised(extra.text,1.25);
  assert.ok(original.length>0);
  assert.deepEqual(reinforced.map(s=>[s.a.x,s.a.y,s.b.x,s.b.y]),original.map(s=>[s.a.x,s.a.y,s.b.x,s.b.y]));
  for(let i=0;i<original.length;i++) assert.ok(Math.abs(reinforced[i].b.z-original[i].b.z-.4)<.002,'texture shifts up two layer heights');
  assert.ok(extra.stats.filamentMm>zero.stats.filamentMm);
  const legacy=await renderPanel({design:'loop-pile',width:30,height:30,repeat:30,extraLayers:0,legacyCopies:2});
  assert.equal(legacy.stats.print.extraLayers,0,'old ignored raised copies do not become reinforcement');
});

test('SVG source and global backing print once while extra layers repeat only drawn texture',async()=>{
  const square=[{x:4,y:4},{x:36,y:4},{x:36,y:26},{x:4,y:26},{x:4,y:4}];
  const vector={name:'panel.svg',width:40,height:30,paths:[square],styles:[{color:'red',width:.45}]};
  const options={design:'svgdesign',vector,settings:{mode:'fill',backing:'none',designPattern:'rectilinear',designAngle:0,designSpacing:3}};
  const zero=await renderPanel({...options,extraLayers:0}),one=await renderPanel({...options,extraLayers:1});
  assert.equal(panelBody(one.text),panelBody(zero.text));
  assert.equal(one.stats.print.nativeLayers,4,'SVG source, crossed backing, one native fill');
  assert.equal(one.stats.print.totalLayers,5);
  assert.deepEqual(one.stats.print.rotations,[0,90]);
});

test('each pictured section repeats its own image-dependent native pass',async()=>{
  const image={width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,255,255,255,255])};
  const {stats,text}=await renderPanel({design:'squiggle',width:60,height:30,repeat:30,image,settings:{pattern:'image',mode:'cross',spacing:3,amplitude:1.2,wavelength:4},extraLayers:1});
  assert.equal(stats.print.extraLayers,1);
  const parts=text.split(/; texture section \d+; origin [\d.,]+\n/);
  const filament=(chunk)=>[...chunk.matchAll(/ E(-?\d+\.\d+)/g)].reduce((n,m)=>n+Math.max(0,Number(m[1])),0);
  assert.ok(filament(parts[1])>filament(parts[2])*1.03);
});

test('invalid individual extra-layer counts fail before writing output',async()=>{
  for(const extraLayers of [-1,251,1.5,NaN,'2']) await assert.rejects(renderPanel({extraLayers}),/Extra layers must be an integer/);
});

test('drawn sections repeat their own fill and final metadata survives an initially empty window',async()=>{
  const square=[{x:24,y:4},{x:36,y:4},{x:36,y:16},{x:24,y:16},{x:24,y:4}];
  const vector={name:'right-only.svg',width:40,height:20,paths:[square],styles:[{color:'red',width:.45}]};
  const {stats,text}=await renderPanel({design:'svgdesign',width:40,height:20,repeat:20,vector,extraLayers:1,settings:{mode:'fill',backing:'none',designPattern:'rectilinear',designAngle:0,designSpacing:3}});
  const parts=text.split(/; texture section \d+; origin [\d.,]+\n/);
  assert.equal((parts[1].match(/ E\d/g)??[]).length,0,'the empty left window gets no cached right-hand texture');
  assert.ok((parts[2].match(/ E\d/g)??[]).length>0);
  assert.equal(stats.print.nativeLayers,4);
  assert.equal(stats.print.extraLayers,1);
  assert.equal(stats.print.totalLayers,5);
  assert.equal(stats.print.repeatable,true);
  assert.equal(stats.print.reason,undefined);
  const actual=JSON.parse(text.match(/; actual print (.+)/)[1]);
  assert.deepEqual(actual,stats.print);
});

test('manual extra-layer counts above50 and migrated27copy textures retain all52 extra passes',async()=>{
  const options={width:10,height:10,repeat:10,settings:{directions:'0-90',spacing:5,size:0}};
  for(const printOptions of [{extraLayers:52},{extraLayers:0,legacyCopies:27}]) {
    const {stats}=await renderPanel({...options,...printOptions});
    assert.equal(stats.print.extraLayers,52);
    assert.equal(stats.print.nativeLayers,4);
    assert.equal(stats.print.totalLayers,56);
  }
});

test('panel sections never bypass the physical bed fit check or write an oversized print', async () => {
  const { machine, material } = defaultProfiles();
  let writes = 0;
  for (const repeat of [50, 300, 500]) await assert.rejects(
    exportPanel({ machine, material, design: 'crosshatch', width: 300, height: 300, repeat }, { write: async () => { writes++; } }),
    (e) => e.name === 'PreflightError' && /does not fit the bed/.test(e.message));
  assert.equal(writes, 0);
  assert.equal(machine.bed.width, 250, 'the printer bed is never enlarged to fit the requested panel');
});

test('a panel beyond the swatch limit stays centered on a real large bed', async () => {
  const { machine, material } = defaultProfiles();
  const gantry = { ...machine, bed: { width: 1400, depth: 100, max_z: 300 } };
  let text = '';
  await exportPanel({ machine: gantry, material, design: 'crosshatch', width: 1200, height: 20, repeat: 20, brim: 0 }, { write: async (s) => { text += s; } });
  const lines = extrusions(text.split('; BODY START\n')[1].split('; BODY END')[0]);
  const xs = lines.flatMap(s => [s.a.x, s.b.x]);
  assert.ok(Math.min(...xs) >= 100 && Math.max(...xs) <= 1300, 'body uses the true 1200 mm footprint, centered with 100 mm margins');
});
