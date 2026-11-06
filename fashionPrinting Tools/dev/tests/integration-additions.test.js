import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { sanitizeState, encodeState, decodeState } from '../../site/src/ui/share.js';
import { regionsFromDrawing, sanitizeRegions, sharedRegionBorders } from '../../site/src/engine/regions.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { sanitizeWidthMaps, flowForWidth } from '../../site/src/engine/width-maps.js';
import { thicknessAlong } from '../../site/src/engine/pattern-effects.js';
import { SWATCH_SETS, zipFiles, swatchRecord } from '../../site/src/ui/swatch-lab.js';
import { carrierContacts } from '../../site/src/engine/repair-geometry.js';
import { mergeTouching } from '../../site/src/engine/travel.js';
import { joinNetwork } from '../../site/src/engine/network.js';
import { defaultProfiles } from './helpers.js';

const profiles = defaultProfiles();
const known = { machines: [profiles.machine.id], materials: [profiles.material.id] };
const square = (x0, y0, x1, y1) => [{ x:x0, y:y0 }, { x:x1, y:y0 }, { x:x1, y:y1 }, { x:x0, y:y1 }, { x:x0, y:y0 }];
const vector = () => ({ name:'regions.svg', width:30, height:20,
  paths:[square(0, 0, 15, 20), square(15, 0, 30, 20)],
  styles:[{ color:'red', hex:'#ff0000', width:.45 }, { color:'red', hex:'#cc0000', width:.45 }],
});
const settings = () => designById('crosshatch').sanitize({ ...designById('crosshatch').defaults(), width:30, height:20 });

test('saved regions derive path membership and tolerate malformed colour fields', () => {
  const drawing = vector();
  const regions = regionsFromDrawing(drawing, { currentCard:'crosshatch', currentSettings:settings() });
  const raw = [{ ...regions[0], key:'unknown', id:'unknown', hex:42, pathIndices:[1,999] }, { ...regions[1], pathIndices:[0] }];
  const clean = sanitizeRegions(raw, drawing, { cards:DESIGNS, currentCard:'crosshatch', currentSettings:settings() });
  assert.deepEqual(clean.map(region => region.pathIndices), [[0], [1]]);
});

test('repaired generator revision survives repeated save/load cycles', () => {
  for (const design of ['truchet','meander','turing']) {
    const raw = { v:4, geometryRevision:2, design, designs:{ [design]:designById(design).defaults() } };
    const first = sanitizeState(raw, known);
    const second = sanitizeState(decodeState(encodeState(first)), known);
    assert.equal(second.design, design, `${design} must not revert to legacy after saving`);
    assert.equal(second.geometryRevision, 2);
    assert.equal(sanitizeState({ ...raw, geometryRevision:undefined }, known).design, `${design}-legacy`);
  }
});

test('whole-piece export joins two patterns and keeps region provenance and progress', () => {
  const drawing = vector(), own = settings();
  const regions = regionsFromDrawing(drawing, { currentCard:'crosshatch', currentSettings:own });
  const updates = [];
  const input = { ...profiles, design:'crosshatch', settings:own, studySettings:own, vector:drawing, regions, width:30, height:20, brim:0 };
  const result = generateDesignExport(input, { progress:update => updates.push(update) });
  assert.equal(result.cfg.t.sample_width, 30);
  assert.equal(result.cfg.t.sample_height, 20);
  assert.equal(result.regions.length, 2);
  assert.ok(result.strands.some(strand => strand.role === 'seam'));
  assert.ok(result.strands.filter(strand => strand.regionId).every(strand => strand.source.includes('@#')));
  assert.match(result.gcode, /region #ff0000/);
  assert.match(result.gcode, /region #cc0000/);
  assert.deepEqual(result.construction.errors, []);
  assert.equal(updates.at(-1).done, 2);
  assert.equal(generateDesignExport(input).gcode, result.gcode);
  assert.throws(() => generateDesignExport({ ...input, width:500 }), { name:'PreflightError' });
});

test('region holes allow a nested positive island to print', () => {
  const drawing = vector();
  drawing.paths.push(square(3,3,12,17), square(5,6,10,14));
  drawing.styles.push({color:'blue',hex:'#0000ff',width:.45}, {color:'red',hex:'#ee0000',width:.45});
  const own = settings(), regions = regionsFromDrawing(drawing, { currentCard:'crosshatch', currentSettings:own });
  const result = generateDesignExport({ ...profiles, design:'crosshatch', settings:own, vector:drawing, regions, width:30, height:20, brim:0 });
  assert.ok(result.strands.some(strand => strand.regionId === regions[3].id), 'the nested island must not be removed by the parent hole');
});

test('shared borders accept different segment subdivisions', () => {
  const borders = sharedRegionBorders([
    {regionId:'a',rings:[square(0,0,10,20)]},
    {regionId:'b',rings:[[{x:10,y:0},{x:20,y:0},{x:20,y:20},{x:10,y:20},{x:10,y:10}]]},
  ]);
  assert.equal(borders.reduce((sum, border) => sum + Math.hypot(border.pts[1].x-border.pts[0].x, border.pts[1].y-border.pts[0].y), 0), 20);
});

test('width calibration interpolates each measured table without inventing values', () => {
  const maps = sanitizeWidthMaps({ bed:[{flow:.5,width:.3},{flow:1.5,width:.9}], overNet:[{flow:.4,width:.3},{flow:1.2,width:.9}] });
  assert.equal(sanitizeWidthMaps({}), null);
  assert.ok(Math.abs(flowForWidth(.6, maps.bed)-1) < 1e-10);
  assert.equal(flowForWidth(2, maps.overNet), 1.2);
  assert.equal(flowForWidth(.1, maps.bed), .5);
  const line = [{x:0,y:0},{x:10,y:0}];
  const bed = thicknessAlong(line, () => .5, {thin:1,thick:1,bead:.6,widthMaps:maps});
  const net = thicknessAlong(line, () => .5, {thin:1,thick:1,bead:.6,widthMaps:maps,layer:1});
  assert.ok(Math.abs(bed[0].flow-1) < 1e-10);
  assert.ok(Math.abs(net[0].flow-.8) < 1e-10);
  for (const rows of [[{flow:1,width:.5}], [{flow:1,width:.5},{flow:1,width:.6}], [{flow:1,width:.6},{flow:2,width:.5}]]) {
    assert.throws(() => sanitizeWidthMaps({bed:rows}));
  }
});

test('comparison and calibration recipes retain every requested setting after sanitization', () => {
  for (const [name, set] of Object.entries(SWATCH_SETS)) for (const [card, patch] of set.pieces) {
    const mod = designById(card), clean = mod.sanitize({ ...mod.defaults(), ...patch });
    for (const [key,value] of Object.entries(patch)) assert.equal(clean[key], value, `${name}/${card}/${key}`);
  }
});

test('every comparison and calibration piece builds at its exact requested size', async t => {
  for (const [name,set] of Object.entries(SWATCH_SETS)) {
    await t.test(name, () => {
      for (const [card,patch,layerHeight] of set.pieces) {
        const mod=designById(card), own=mod.sanitize({...mod.defaults(),...patch,width:40,height:30});
        const material=layerHeight?{...profiles.material,print_defaults:{...profiles.material.print_defaults,layer_height:layerHeight}}:profiles.material;
        const result=generateDesignExport({...profiles,material,design:card,settings:own,width:40,height:30,extraLayers:0,brim:0});
        assert.equal(result.cfg.t.sample_width,40);
        assert.equal(result.cfg.t.sample_height,30);
        if(layerHeight)assert.equal(result.cfg.t.layer_height,layerHeight);
        assert.ok(result.moves.some(move=>move.extrude), `${name}/${card} must print`);
        assert.deepEqual(result.construction.errors,[]);
      }
    });
  }
});

test('ZIP downloads contain readable Unicode filenames, bytes and an indexed central directory', async () => {
  const files = [['récord.md','Not printed — untested'],['piece.gcode','G1 X10\n']];
  const bytes = new Uint8Array(await zipFiles(files).arrayBuffer()), view = new DataView(bytes.buffer), decoder = new TextDecoder();
  let offset = 0;
  for (const [name, content] of files) {
    assert.equal(view.getUint32(offset,true), 0x04034b50);
    const size = view.getUint32(offset+18,true), length = view.getUint16(offset+26,true);
    assert.equal(decoder.decode(bytes.subarray(offset+30,offset+30+length)), name);
    assert.equal(decoder.decode(bytes.subarray(offset+30+length,offset+30+length+size)), content);
    offset += 30+length+size;
  }
  assert.equal(view.getUint32(offset,true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length-22,true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length-12,true), files.length);
  const record = swatchRecord({code:'sample',card:'crosshatch',settings:{},machine:'m',material:'t',width:30,height:20});
  assert.match(record, /Not printed — untested/);
  assert.match(record, /Print date: pending/);
});

test('one geometric carrier crossing is not counted repeatedly on a long segment', () => {
  const path = [{x:0,y:0},{x:10,y:10}];
  const carrier = [[{x:0,y:5},{x:10,y:5}]];
  assert.equal(carrierContacts(path, carrier).length, 1);
  const sampled = Array.from({length:101}, (_,i) => ({x:i/10,y:i/10}));
  assert.equal(carrierContacts(sampled, carrier).length, 1, 'contact count must be independent of point sampling');
});

test('path joining keeps the designed joints contributed by every source strand', () => {
  const a={id:'a',family:'seams',role:'native',kind:'base',layer:0,joints:[{id:'left',x:0,y:0}],pts:[{x:0,y:0,z:.2},{x:5,y:0,z:.2}]};
  const b={id:'b',family:'seams',role:'native',kind:'base',layer:0,joints:[{id:'right',x:10,y:0}],pts:[{x:5,y:0,z:.2},{x:10,y:0,z:.2}]};
  for(const join of [mergeTouching,joinNetwork]){
    const result=join([a,b]);
    assert.equal(result.length,1);
    assert.deepEqual(result[0].joints.map(joint=>joint.id).sort(),['left','right']);
    assert.equal(result[0].family,'seams');
  }
});
