import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { relevantKeys, settingsFileName, exportFileName, parseFileName, ownName } from '../src/ui/file-name.js';

const PRINT = { layerHeight: 0.2, extraLayers: 0, brim: 2 };
const MATERIAL = 'filaflex-95-foamy';

/** A design's settings as the demo exporter makes them: its defaults, a preset, a patch, at 100 x 100 mm. */
function settingsFor(id, preset = null, patch = {}) {
  const mod = designById(id);
  const s = mod.sanitize({ ...mod.defaults(), ...(preset ? mod.presets.find((p) => p.id === preset).patch : {}), ...patch });
  mod.setSize(s, 100, 100);
  return { mod, s };
}

test('the demo prints keep the names they had: the studio and the demo exporter name files one way', () => {
  const demo = (n, id, preset, patch) => {
    const { mod, s } = settingsFor(id, preset, patch);
    const [w, h] = mod.size(s);
    return settingsFileName({ head: [String(n).padStart(2, '0'), mod.file, preset ?? 'custom', `${w}x${h}mm`], s, keys: relevantKeys(mod, s) });
  };
  assert.equal(demo(17, 'coil', 'overlapping'), '17_coil_overlapping_100x100mm_shape-looped_size3_pitch5_overlap30_lift0.25_pattern-none_scale1.gcode');
  assert.equal(demo(8, 'halftone', 'colour-swap'), '08_halftone_colour-swap_100x100mm_shape-straight_second-complement_pattern-bumps_scale1_spacing3_thin0.6_thick1.8_angle0_size1.5_pitch8_twoColours-on.gcode');
  assert.equal(demo(10, 'svgdesign', 'filled-backed'), '10_svgdesign_filled-backed_100x100mm_mode-both_fill-rectilinear_fillSp2.5_fillAng45_backing-one_area-swatch_b1-gyroid_b1Sp4_b1Ang0.gcode');
  assert.equal(demo(4, 'weave', null, { binding: 'plain', pitch: 4 }), '04_weave_custom_100x100mm_binding-plain_pitch4.gcode');
});

test('an exported swatch is named after its design, preset, size, every look-and-feel value and the print setup', () => {
  const { mod, s } = settingsFor('coil', 'overlapping');
  const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: PRINT, material: MATERIAL, docName: 'Untitled swatch' });
  assert.equal(name, 'coil_overlapping_100x100mm_shape-looped_size3_pitch5_overlap30_lift0.25_pattern-none_scale1_brim2_lh0.2_extra0_filaflex-95-foamy.gcode');
});

test('moving a slider changes its value in the name, and the preset becomes custom', () => {
  const { mod, s } = settingsFor('coil', 'overlapping');
  s.pitch = 7;
  const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: { layerHeight: 0.15, layers: 2 }, material: MATERIAL });
  assert.match(name, /^coil_custom_100x100mm_/);
  assert.match(name, /_pitch7_/);
  assert.match(name, /_brim2_lh0\.15_layers2_filaflex-95-foamy\.gcode$/);
});

test('a design left at its defaults is "default"; a name the swatch was given closes the file name', () => {
  const mod = designById('zigzag');
  const s = mod.defaults();
  const plain = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: PRINT, material: MATERIAL, docName: 'Untitled swatch' });
  assert.match(plain, /^zigzag_default_100x100mm_mode-parallel_/);
  const named = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: PRINT, material: MATERIAL, docName: 'Red heart, try 2!' });
  assert.match(named, /_filaflex-95-foamy_red-heart-try-2\.gcode$/);
  assert.equal(ownName('  Untitled   swatch '), '');
});

test('a full panel says so after its size', () => {
  const mod = designById('zigzag');
  const s = mod.defaults();
  const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [1000, 600], print: PRINT, material: MATERIAL, panel: true });
  assert.match(name, /^zigzag_default_1000x600mm_panel_mode-parallel_/);
});

test('every design gives a short, safe name that reads back to the same design and settings', () => {
  for (const mod of DESIGNS) {
    if (mod.status !== 'ready' || mod.legacy) continue;
    const s = mod.defaults();
    const keys = relevantKeys(mod, s);
    const name = exportFileName(mod, s, keys, { size: mod.size(s), print: PRINT, material: MATERIAL, docName: 'A long swatch name that somebody typed in full' });
    assert.ok(name.length <= 180 + '.gcode'.length, `${mod.id}: ${name.length} characters`);
    assert.match(name, /^[A-Za-z0-9._-]+$/, mod.id);
    const back = parseFileName(name);
    assert.equal(back.design, mod.file, mod.id);
    assert.deepEqual(back.size, mod.size(s), mod.id);
    assert.equal(back.layerHeight, 0.2);
    assert.equal(back.layers, null);
    assert.equal(back.extraLayers, 0);
    assert.equal(back.brim, 2);
    assert.equal(back.material, MATERIAL);
    // every setting that made it into the name reads back with the value it was written with
    for (const [key, value] of Object.entries(back.settings)) {
      const original = keys.find((k) => k === key || ({ fill: 'designPattern', fillSp: 'designSpacing', fillAng: 'designAngle', area: 'backingArea', b1: 'backing1Pattern', b1Sp: 'backing1Spacing', b1Ang: 'backing1Angle', b2: 'backing2Pattern', b2Sp: 'backing2Spacing', b2Ang: 'backing2Angle', scale: 'patternScale', overlap: 'rowOverlap', twoColours: 'colorChange' })[key] === k);
      assert.ok(original, `${mod.id}: ${key} is one of its settings`);
      const v = s[original];
      assert.equal(value, typeof v === 'number' ? String(Number(v.toFixed(2))) : v === true ? 'on' : String(v), `${mod.id}: ${key}`);
    }
  }
});

test('names that are not the studio\'s are not read', () => {
  assert.equal(parseFileName('my print.gcode'), null);
  assert.equal(parseFileName('benchy_0.2mm_PLA.gcode'), null);
  const demo = parseFileName('03_dipweave_default_100x100mm_warpPitch3.5_weftPitch3.5.gcode');
  assert.deepEqual(demo.settings, { warpPitch: '3.5', weftPitch: '3.5' });
  assert.equal(parseFileName('01_crosshatch_isogrid_100x100mm_directions-0-60-120_shape-wave_spacing3.5.gcode').settings.directions, '0-60-120');
});

test('truncated late settings retain a distinguishing deterministic digest', () => {
  const mod = designById('svgdesign');
  const options = { size: [100, 100], print: PRINT, material: MATERIAL, docName: 'A long swatch name that somebody typed in full' };
  const names = [5, 6].map((backing1Spacing) => {
    const s = { ...mod.defaults(), backing1Spacing };
    return exportFileName(mod, s, relevantKeys(mod, s), options);
  });
  assert.notEqual(names[0], names[1]);
  for (const name of names) {
    assert.ok(name.length <= 186);
    assert.match(name, /_h-[0-9a-f]{16}_/);
    const back = parseFileName(name);
    assert.equal(back.material, MATERIAL);
    assert.equal(Object.hasOwn(back.settings, 'h'), false);
  }
  const s = { ...mod.defaults(), backing1Spacing: 5 };
  assert.equal(exportFileName(mod, s, relevantKeys(mod, s), options), names[0]);
});

test('material tokens round-trip underscores, percent signs, spaces and Unicode without splitting', () => {
  const mod = designById('coil'), s = mod.defaults();
  for (const material of ['my_material', 'my%5Fmaterial', 'PLA white', '柔軟_TPU']) {
    const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [30, 30], print: PRINT, material, docName: 'Trial one' });
    const back = parseFileName(name);
    assert.equal(back.material, material);
    assert.equal(back.swatchName, 'trial-one');
  }
  assert.equal(parseFileName('coil_custom_100x100mm_lh0.2_layers1_bad%ZZ.gcode'), null);
});

test('long profile and document names respect the length budget and retain distinguishing identifiers', () => {
  const mod = designById('coil'), s = mod.defaults();
  const options = { size: [100, 100], print: PRINT, material: 'm'.repeat(140), docName: 'drawing '.repeat(30) };
  const a = exportFileName(mod, s, relevantKeys(mod, s), options);
  const b = exportFileName(mod, s, relevantKeys(mod, s), { ...options, material: options.material + 'b' });
  const c = exportFileName(mod, s, relevantKeys(mod, s), { ...options, docName: options.docName + 'another' });
  assert.ok(a.length <= 186);
  assert.ok(b.length <= 186);
  assert.ok(c.length <= 186);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(parseFileName(a).material, /^m+-h[0-9a-f]{16}$/);
  assert.equal(parseFileName(a).layerHeight, 0.2);
  const unicode = exportFileName(mod, s, relevantKeys(mod, s), { ...options, material: '柔軟_'.repeat(100) });
  assert.ok(unicode.length <= 186);
  assert.ok(parseFileName(unicode), 'shortening never leaves an incomplete percent-encoded character');
});

test('exact negative and fine precision values survive filename parsing and remain distinct', () => {
  const make = (spacing) => settingsFileName({ head: ['test', 'custom', '30x30mm'], s: { spacing, angle: -12.3456, phase: 1e-7, scale: 1e21 }, keys: ['spacing', 'angle', 'phase', 'scale'], tail: ['lh0.2', 'layers1', MATERIAL] });
  const a = make(3.001), b = make(3.004);
  assert.notEqual(a, b);
  assert.deepEqual(parseFileName(a).settings, { spacing: '3.001', angle: '-12.3456', phase: '1e-7', scale: '1e+21' });
  const mod = designById('coil'), s = mod.defaults();
  const options = { size: [30.001, 31.004], print: PRINT, material: MATERIAL };
  const sized = exportFileName(mod, s, relevantKeys(mod, s), options);
  assert.deepEqual(parseFileName(sized).size, [30.001, 31.004]);
  assert.notEqual(sized, exportFileName(mod, s, relevantKeys(mod, s), { ...options, size: [30.004, 31.004] }));
});

test('custom small budgets remain bounded when no readable setting tokens fit', () => {
  const input = { head: ['a-very-long-design-identifier', 'custom', '100x100mm'], s: { spacing: 5 }, keys: ['spacing'], tail: ['lh0.2', 'layers1', 'm'.repeat(140)] };
  for (const max of [12, 40, 100, 150]) assert.ok(settingsFileName(input, { max }).length <= max + 6);
});

test('panel names describe one-filament output without modifying the supplied settings', () => {
  const { mod, s } = settingsFor('halftone', 'colour-swap');
  const before = structuredClone(s);
  const options = { size: [100, 100], print: PRINT, material: MATERIAL };
  const panel = exportFileName(mod, s, relevantKeys(mod, s), { ...options, panel: true });
  const swatch = exportFileName(mod, s, relevantKeys(mod, s), options);
  assert.doesNotMatch(panel, /twoColours-on/);
  assert.match(swatch, /twoColours-on/);
  assert.deepEqual(s, before);
  assert.equal(exportFileName(mod, { ...s, colorChange: false }, relevantKeys(mod, s), { ...options, panel: true }), panel);
});

test('all twenty existing demo filenames keep their ordinary names including omitted zero angles', () => {
  const cases = [
    ['crosshatch', 'isogrid', {}, '01_crosshatch_isogrid_100x100mm_directions-0-60-120_shape-wave_spacing3.5_size0_pitch6.gcode'],
    ['starlattice', 'stars', {}, '02_starlattice_stars_100x100mm_tiling-square_size8_angle67.5_pattern-none_scale1.gcode' /* the star lattice took a pattern on 2026-10-21 */],
    ['dipweave', null, {}, '03_dipweave_default_100x100mm_warpPitch3.5_weftPitch3.5.gcode'],
    ['weave', null, { binding: 'plain', pitch: 4 }, '04_weave_plain_100x100mm_binding-plain_pitch4.gcode'],
    ['weave', null, { binding: 'diamond', pitch: 4 }, '05_weave_diamond_100x100mm_binding-diamond_pitch4.gcode'],
    ['weave', null, { binding: 'crepe', pitch: 4 }, '06_weave_crepe_100x100mm_binding-crepe_pitch4.gcode'],
    ['halftone', 'soft', {}, '07_halftone_soft_100x100mm_shape-straight_second-same_pattern-bumps_scale1_spacing3_thin0.8_thick1.4_angle0_size1.5_pitch8.gcode'],
    ['halftone', 'colour-swap', {}, '08_halftone_colour-swap_100x100mm_shape-straight_second-complement_pattern-bumps_scale1_spacing3_thin0.6_thick1.8_angle0_size1.5_pitch8_twoColours-on.gcode'],
    ['svgdesign', 'line-art', {}, '09_svgdesign_line-art_100x100mm_mode-outline_backing-none.gcode'],
    ['svgdesign', 'filled-backed', {}, '10_svgdesign_filled-backed_100x100mm_mode-both_fill-rectilinear_fillSp2.5_fillAng45_backing-one_area-swatch_b1-gyroid_b1Sp4_b1Ang0.gcode'],
    ['svgdesign', 'two-layer', {}, '11_svgdesign_two-layer_100x100mm_mode-both_fill-concentric_fillSp2.5_backing-two_area-swatch_b1-gyroid_b1Sp4_b2-triangles_b2Sp6_b2Ang15.gcode'],
    ['svgdesign', 'lightning-badge', {}, '12_svgdesign_lightning-badge_100x100mm_mode-both_fill-honeycomb_fillSp3_fillAng0_backing-one_area-shape_b1-lightning_b1Sp4_b1Ang0.gcode'],
    ['svgdesign', null, { mode: 'both', designPattern: 'hilbert', designSpacing: 3.5, designAngle: 0, backing: 'one', backingArea: 'box', backing1Pattern: 'cubic', backing1Spacing: 5, backing1Angle: 0 }, '13_svgdesign_custom_100x100mm_mode-both_fill-hilbert_fillSp3.5_fillAng0_backing-one_area-box_b1-cubic_b1Sp5_b1Ang0.gcode'],
    ['auxetic', 're-entrant', {}, '14_auxetic_re-entrant_100x100mm_cell-reentrant_rowPitch6_period8_amplitude1.75.gcode'],
    ['spiral', null, {}, '15_spiral_standard_100x100mm_second-none_spacing3.gcode'],
    ['meander', null, {}, '16_meander_hilbert_100x100mm_curve-hilbert_cell6_angle45_spacing5_seed1_backing-wave_backingDepth2_backingLength10_backingLayers-one_pattern-none.gcode'],
    ['coil', 'overlapping', {}, '17_coil_overlapping_100x100mm_shape-looped_size3_pitch5_overlap30_lift0.25_pattern-none_scale1.gcode'],
    ['spacer', 'thin', {}, '18_spacer_thin_100x100mm_pitch6_layers4_radius1_every1.gcode'],
    ['pillarweave', 'close', {}, '19_pillarweave_close_100x100mm_pitch4_layers5_radius0.8.gcode'],
    ['spacer', 'airy', {}, '20_spacer_airy_100x100mm_pitch4_layers6_radius1_every2.gcode'],
  ];
  for (const [id, preset, patch, expected] of cases) {
    const { mod, s } = settingsFor(id, preset, patch);
    const head = expected.slice(0, -6).split('_').slice(0, 4);
    const name = settingsFileName({ head, s, keys: relevantKeys(mod, s) });
    assert.equal(name, expected, id);
  }
});

test('export filenames distinguish brim off and run counts without changing preset identity', () => {
  const { mod, s } = settingsFor('coil', 'overlapping');
  const names = [0, 2, 5].map((brim) => {
    const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: { ...PRINT, brim }, material: MATERIAL, docName: 'Brim trial' });
    assert.match(name, /^coil_overlapping_/);
    assert.ok(name.includes(`_brim${brim}_lh0.2_extra0_`));
    const back = parseFileName(name);
    assert.equal(back.brim, brim);
    assert.equal(back.material, MATERIAL);
    assert.equal(back.swatchName, 'brim-trial');
    return name;
  });
  assert.equal(new Set(names).size, 3);
});

test('older filenames without brim still read their filament and swatch name', () => {
  const back = parseFileName('coil_custom_100x100mm_lh0.2_layers1_filaflex-95-foamy_trial.gcode');
  assert.equal(back.layerHeight, 0.2);
  assert.equal(back.layers, 1);
  assert.equal(back.material, MATERIAL);
  assert.equal(back.swatchName, 'trial');
  assert.equal(Object.hasOwn(back, 'extraLayers'), false);
  const namedBrim = parseFileName('coil_custom_100x100mm_lh0.2_layers1_brim2_trial.gcode');
  assert.equal(namedBrim.material, 'brim2');
  assert.equal(namedBrim.swatchName, 'trial');
});

test('shortened export names preserve brim count and their length budget', () => {
  const mod = designById('svgdesign'), s = mod.defaults();
  const options = { size: [100, 100], print: PRINT, material: MATERIAL, docName: 'A long swatch name that somebody typed in full' };
  const names = [0, 2, 50].map((brim) => {
    const name = exportFileName(mod, s, relevantKeys(mod, s), { ...options, print: { ...PRINT, brim } });
    assert.ok(name.length <= 186);
    assert.match(name, /_h-[0-9a-f]{16}_/);
    assert.equal(parseFileName(name).brim, brim);
    return name;
  });
  assert.equal(new Set(names).size, 3);
});


test('export filenames distinguish additional layers including zero from legacy copies', () => {
  const { mod, s } = settingsFor('coil', 'overlapping');
  const names = [0, 3, 250].map((extraLayers) => {
    const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: { ...PRINT, extraLayers, layers: 7 }, material: MATERIAL });
    assert.ok(name.includes(`_brim2_lh0.2_extra${extraLayers}_`));
    const back = parseFileName(name);
    assert.equal(back.extraLayers, extraLayers);
    assert.equal(back.layers, null);
    assert.equal(back.brim, 2);
    assert.equal(back.material, MATERIAL);
    assert.equal(back.preset, 'overlapping');
    return name;
  });
  assert.equal(new Set(names).size, 3);
});

test('legacy export callers keep their copies token and parser return shape', () => {
  const { mod, s } = settingsFor('coil', 'overlapping');
  const name = exportFileName(mod, s, relevantKeys(mod, s), { size: [100, 100], print: { layerHeight: 0.3, layers: 4, brim: 0 }, material: MATERIAL });
  assert.match(name, /_brim0_lh0\.3_layers4_filaflex-95-foamy\.gcode$/);
  const back = parseFileName(name);
  assert.equal(back.layers, 4);
  assert.equal(back.brim, 0);
  assert.equal(back.material, MATERIAL);
  assert.equal(Object.hasOwn(back, 'extraLayers'), false);
});
