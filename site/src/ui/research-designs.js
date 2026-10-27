import { layered, VORONOI } from './more-designs.js';
import { defineControls, r1, r2, withColour } from './structure-controls.js';
import { withPicture, patternField } from '../engine/picture.js';
import { FIELD_IDS } from '../engine/fields.js';
import { ringsLayers, RING_LATTICE_IDS } from '../engine/rings.js';
import { rotatingSquaresLayers, rotatingTrianglesLayers } from '../engine/rotating-units.js';
import { arrowheadLayers } from '../engine/arrowhead.js';
import { spiralCellsLayers, sanitizeSpiralTwist } from '../engine/spiral-cells.js';
import { voronoiCellsLayers } from '../engine/voronoi.js';
import { stochasticNetLayers } from '../engine/stochastic-net.js';
import { laceLayers, laceOnCarrierLayers } from '../engine/lace.js';
import { meanderTiesLayers, CURVES, CURVE_IDS } from '../engine/meander.js';
import { kirigamiLayers } from '../engine/kirigami.js';
import { starMetricLayers } from '../engine/star-metric.js';
import { isohedralLayers, isohedralParameterCount, isohedralMaterialClass } from '../engine/isohedral.js';
import { climbOverlaps } from '../engine/climb.js';
import { buildLayeredVerdict } from './verdict.js';
import { stepLaceLayers } from '../engine/step-lace.js';
import { pairedLoopsLayers } from '../engine/paired-loops.js';
import { scalesLayers } from '../engine/scales.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const COLOUR = { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the first layer so you can load a second filament (M600).' };
const ISOHEDRAL = withColour(defineControls({
  ranges:{...SIZE,scale:{min:5,max:30,step:.5},shape1:{min:-1,max:2,step:.05},shape2:{min:-1,max:2,step:.05},shape3:{min:-1,max:2,step:.05},shape4:{min:-1,max:2,step:.05},shape5:{min:-1,max:2,step:.05},shape6:{min:-1,max:2,step:.05}},
  defaults:{width:100,height:100,family:'IH28',scale:10,shape1:0,shape2:0,shape3:0,shape4:0,shape5:0,shape6:0,colorChange:false},
  enums:{family:['IH28','IH21','IH1','IH41','IH84','IH2','IH3','IH7','IH10','IH14','IH18','IH20']},
  bools:['colorChange'],
  presets:[{id:'square',name:'Square symmetry',blurb:'A fourfold repeating tile',patch:{family:'IH28'}},{id:'hexagonal',name:'Hexagonal symmetry',blurb:'A sixfold repeating tile',patch:{family:'IH21'}},{id:'triangle',name:'Triangular symmetry',blurb:'A threefold repeating tile',patch:{family:'IH1'}}],
  describe:s=>({family:s.family,scale:`${r1(s.scale)} mm`}),
}));

const RINGS = withColour(defineControls({
  ranges: { ...SIZE, ringSize: { min: 3, max: 20, step: .5 }, overlap: { min: .45, max: 3, step: .05 }, patternScale: { min: .5, max: 2, step: .25 },levelHeight:{min:.15,max:.4,step:.05},maxLevels:{min:2,max:6,step:1},rampLength:{min:.8,max:4,step:.1} },
  defaults: { width: 100, height: 100, ringSize: 8, overlap: .9, lattice: 'hex', pattern: 'none', patternScale: 1, patternEffect: 'size', colorChange: false,buildOrder:'rows',levelHeight:.2,maxLevels:4,rampLength:1.5 },
  enums: { lattice: RING_LATTICE_IDS, pattern: withPicture(['none', ...FIELD_IDS]),buildOrder:['rows','checker','spiral'] },
  bools: ['colorChange'],
  presets: [
    { id: 'staggered', name: 'Staggered', blurb: 'Close-packed hexagonal lattice', patch: { lattice: 'hex', ringSize: 8, overlap: .9 } },
    { id: 'square', name: 'Square', blurb: 'Even rows and columns', patch: { lattice: 'square', ringSize: 8, overlap: .9 } },
    { id: 'open', name: 'Open rings', blurb: 'Larger rings and softer contact', patch: { lattice: 'hex', ringSize: 10, overlap: .55 } },
  ],
  describe: s => ({ ringSize: `${r1(s.ringSize)} mm`, overlap: `${r1(s.overlap)} mm` }),
}));

const SQUARE_UNITS = withColour(defineControls({
  ranges: { ...SIZE, cell: { min: 5, max: 25, step: .5 }, angle: { min: 0, max: 35, step: 1 }, neck: { min: .45, max: 2, step: .05 }, neckLength: { min: .6, max: 4, step: .1 }, fillet: { min: 0, max: 2, step: .1 } },
  defaults: { width: 100, height: 100, cell: 10, angle: 15, neck: .9, neckLength: 1.2, fillet: .8, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'soft-open', name: 'Soft opening', blurb: 'A gentle rotating-square lattice', patch: { cell: 10, angle: 15, neck: .9, neckLength: 1.2, fillet: .8 } },
    { id: 'broad', name: 'Broad cells', blurb: 'Larger cells with wider joins', patch: { cell: 15, angle: 20, neck: 1.1, neckLength: 1.5, fillet: 1 } },
    { id: 'closed', name: 'Closed', blurb: 'Squares aligned to the grid', patch: { cell: 10, angle: 0, neck: .9, neckLength: 1.2, fillet: .8 } },
  ],
  describe: s => ({ cell: `${r1(s.cell)} mm`, angle: `${s.angle}°` }),
}));
const TRIANGLE_UNITS = withColour(defineControls({
  ranges: { ...SIZE, cell: { min: 5, max: 25, step: .5 }, angle: { min: -30, max: 30, step: 1 }, neck: { min: .45, max: 2, step: .05 }, neckLength: { min: .6, max: 4, step: .1 }, fillet: { min: 0, max: 2, step: .1 } },
  defaults: { width: 100, height: 100, cell: 10, angle: 15, neck: .9, neckLength: 1.2, fillet: .6, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'kagome', name: 'Kagome', blurb: 'Corner-linked triangular units', patch: { cell: 10, angle: 0, neck: .9, neckLength: 1.2, fillet: .6 } },
    { id: 'tilted', name: 'Tilted', blurb: 'A gentle alternating inclination', patch: { cell: 10, angle: 15, neck: .9, neckLength: 1.2, fillet: .6 } },
    { id: 'maximum', name: 'Maximum inclination', blurb: 'Triangles at thirty degrees', patch: { cell: 12, angle: 30, neck: 1, neckLength: 1.5, fillet: .6 } },
  ],
  describe: s => ({ cell: `${r1(s.cell)} mm`, angle: `${s.angle}°` }),
}));
const ARROWHEAD = withColour(defineControls({
  ranges: { ...SIZE, columns: { min: 1, max: 12, step: 1 }, cellHeight: { min: 6, max: 30, step: .5 }, hingeAngle: { min: 30, max: 110, step: 1 }, depth: { min: .2, max: .7, step: .05 }, rail: { min: 0, max: 10, step: .5 } },
  defaults: { width: 100, height: 100, columns: 4, cellHeight: 15, hingeAngle: 60, depth: .45, rail: 5, colorChange: false },
  bools: ['colorChange'],
  presets: [
    { id: 'ariel-band', name: 'Ariel band', blurb: 'Re-entrant cells with continuous side rails', patch: { columns: 4, cellHeight: 15, hingeAngle: 60, depth: .45, rail: 5 } },
    { id: 'spahiu-panel', name: 'Spahiu panel', blurb: 'Four columns without side rails', patch: { columns: 4, cellHeight: 16, hingeAngle: 60, depth: .45, rail: 0 } },
  ],
  describe: s => ({ columns: `${s.columns} across`, cellHeight: `${r1(s.cellHeight)} mm` }),
}));
const SPIRAL_CELLS_BASE = defineControls({
  ranges: { ...SIZE, cell: { min: 10, max: 30, step: .5 }, twist: { min: .5, max: 4, step: .1 }, armWidth: { min: .45, max: 1.2, step: .05 }, patternScale: { min: .5, max: 2, step: .25 } },
  defaults: { width: 100, height: 100, cell: 12, twist: 2.2, armWidth: .45, handedness: 1, pattern: 'none', patternScale: 1, colorChange: false },
  enums: { handedness: [1,-1], pattern: withPicture(['none',...FIELD_IDS]) },
  bools: ['colorChange'],
  presets: [
    { id: 'balanced', name: 'Balanced', blurb: 'Four gentle spiral arms', patch: { cell: 12, twist: 2.2, handedness: 1 } },
    { id: 'tight', name: 'Tight', blurb: 'More turns within each cell', patch: { cell: 12, twist: 3.2, handedness: 1 } },
    { id: 'reverse', name: 'Reverse', blurb: 'The same cell turning the other way', patch: { cell: 12, twist: 2.2, handedness: -1 } },
  ],
  describe: s => ({ cell: `${r1(s.cell)} mm`, twist: `${r1(s.twist)} rad`, handedness: s.handedness>0?'Clockwise':'Anticlockwise' }),
});
const SPIRAL_CELLS = withColour({ ...SPIRAL_CELLS_BASE, sanitize(raw) { return { ...SPIRAL_CELLS_BASE.sanitize(raw), ...sanitizeSpiralTwist(SPIRAL_CELLS_BASE.sanitize(raw)) }; } });
const STOCHASTIC = withColour(defineControls({
  ranges:{...SIZE,density:{min:.01,max:.2,step:.005},k:{min:3,max:8,step:1},stretch:{min:1,max:3,step:.1},direction:{min:0,max:180,step:5},seed:{min:1,max:9999,step:1},patternScale:{min:.5,max:2,step:.25}},
  defaults:{width:100,height:100,density:.04,k:5,stretch:1.5,direction:0,seed:1,border:true,pattern:'none',patternScale:1,colorChange:false},
  enums:{pattern:withPicture(['none',...FIELD_IDS])},bools:['border','colorChange'],
  presets:[
    {id:'balanced',name:'Balanced',blurb:'Moderate links with directional stretch',patch:{density:.04,k:5,stretch:1.5,direction:0}},
    {id:'soft',name:'Soft net',blurb:'Fewer, longer links',patch:{density:.025,k:4,stretch:1.2,direction:0}},
    {id:'stiff',name:'Directional',blurb:'Dense net stretched along one axis',patch:{density:.06,k:6,stretch:2,direction:45}},
  ],
  describe:s=>({density:`${r1(s.density*1000)/10} nodes/cm²`,k:`${s.k} neighbours`,stretch:`${r1(s.stretch)}×`,direction:`${s.direction}°`,seed:`#${s.seed}`}),
}));
const CONNECTED_LACE=withColour(defineControls({
  ranges:{...SIZE,scale:{min:6,max:30,step:.5},neck:{min:.45,max:2,step:.05},openness:{min:.3,max:.8,step:.05}},
  defaults:{width:100,height:100,motif:'petal',scale:10,neck:.9,openness:.5,lattice:'hex',spacing:3,angle:45,backing:'straight',backingDepth:2,backingLength:10,backingLayers:'one',colorChange:false},
  enums:{motif:['ring','petal','scallop'],lattice:['hex','square']},bools:['colorChange'],
  presets:[
    {id:'petal-lace',name:'Petal lace',blurb:'Six-lobed rosettes',patch:{motif:'petal',scale:12,neck:.9,openness:.5,lattice:'hex'}},
    {id:'ring-lace',name:'Ring lace',blurb:'Round loops on a square grid',patch:{motif:'ring',scale:12,neck:.9,openness:.5,lattice:'square'}},
    {id:'scallop-lace',name:'Scallop lace',blurb:'Eight-lobed cells',patch:{motif:'scallop',scale:15,neck:1,openness:.55,lattice:'hex'}},
  ],
  describe:s=>({motif:s.motif,scale:`${r1(s.scale)} mm`,neck:`${r1(s.neck)} mm`}),
}));
const MEANDER_TIES=withColour(defineControls({
  ranges:{...SIZE,cell:{min:.8,max:14,step:.1},angle:{min:15,max:75,step:5},tieInterval:{min:2,max:20,step:.5},seed:{min:1,max:999,step:1}},
  defaults:{width:100,height:100,curve:'hilbert',cell:6,angle:45,tieInterval:6,seed:1,colorChange:false},enums:{curve:CURVE_IDS},bools:['colorChange'],
  presets:[
    {id:'hilbert',name:'Hilbert ties',blurb:'Fine folds with sparse joins',patch:{curve:'hilbert',cell:6,tieInterval:6}},
    {id:'peano',name:'Peano ties',blurb:'Serpentine folds with ties',patch:{curve:'peano',cell:6,tieInterval:8}},
    {id:'maze',name:'Maze ties',blurb:'Seeded maze folds',patch:{curve:'maze',cell:6,tieInterval:6}},
  ],
  describe:s=>({curve:CURVES[s.curve].label,cell:`${r1(s.cell)} mm`,tieInterval:`${r1(s.tieInterval)} mm`}),
}));
const KIRIGAMI=withColour(defineControls({
  ranges:{...SIZE,slitLength:{min:4,max:30,step:.5},slitGap:{min:1,max:3,step:.1},interval:{min:2,max:15,step:.5},endSpacing:{min:2,max:20,step:.5}},
  defaults:{width:100,height:100,slitLength:15,slitGap:1,interval:5,endSpacing:10,passes:2,colorChange:false},enums:{passes:[1,2]},bools:['colorChange'],
  presets:[
    {id:'robust-two-pass',name:'Robust · two pass',blurb:'Staggered cuts with orthogonal fill',patch:{slitLength:15,slitGap:1,interval:5,endSpacing:10,passes:2}},
    {id:'single-pass',name:'Single pass',blurb:'One-direction solid fill',patch:{slitLength:15,slitGap:1,interval:5,endSpacing:10,passes:1}},
    {id:'open',name:'More open',blurb:'Wider slit spacing',patch:{slitLength:20,slitGap:1.5,interval:6,endSpacing:12,passes:2}},
  ],
  describe:s=>({slitLength:`${r1(s.slitLength)} mm`,slitGap:`${r1(s.slitGap)} mm`,ratio:`h/i = ${r1(s.slitGap/s.interval)}`,passes:`${s.passes} passes`}),
}));
const STAR_METRIC_BASE=defineControls({
  ranges:{...SIZE,cell:{min:5,max:25,step:.5},wall:{min:.45,max:1.2,step:.05},patternScale:{min:.5,max:2,step:.25}},
  defaults:{width:100,height:100,lattice:'triangular',symmetry:3,spans:[1,.6,1],cell:10,wall:.45,smooth:true,pattern:'none',patternScale:1,colorChange:false},
  enums:{lattice:['triangular','honeycomb','square','diagonal-square'],symmetry:[3,4,6],pattern:withPicture(['none',...FIELD_IDS])},bools:['smooth','colorChange'],
  presets:[
    {id:'tri-petal',name:'Triangular · threefold',blurb:'Three-fold radial metric',patch:{lattice:'triangular',symmetry:3,spans:[1,.6,1],cell:10}},
    {id:'square-petal',name:'Square · fourfold',blurb:'Four-fold metric on a square lattice',patch:{lattice:'square',symmetry:4,spans:[1,.7,1],cell:10}},
    {id:'hex-petal',name:'Hexagonal · sixfold',blurb:'Six-fold radial metric',patch:{lattice:'honeycomb',symmetry:6,spans:[1,.65,1],cell:10}},
  ],
  describe:s=>({lattice:s.lattice,symmetry:`${s.symmetry}-fold`,cell:`${r1(s.cell)} mm`}),
});
const STAR_METRIC=withColour({...STAR_METRIC_BASE,sanitize(raw){
  const base=STAR_METRIC_BASE.sanitize(raw),spans=Array.isArray(raw?.spans)?raw.spans.slice(0,7).map(v=>Math.max(.3,Math.min(1.5,Number(v)||1))):base.spans;
  return {...base,spans:spans.length>=3?spans:base.spans};
}});
const STEP_LACE=withColour(defineControls({
  ranges:{...SIZE,spacing:{min:1.5,max:8,step:.1},tieLength:{min:3,max:20,step:.5},tieDepth:{min:3,max:24,step:.1},petals:{min:4,max:10,step:1}},
  defaults:{width:100,height:100,spacing:3,tie:'step',tieLength:6,tieDepth:3.3,petals:6,colorChange:false},
  enums:{tie:['step','hexagon','ripple','petal']},
  presets:[{id:'step',name:'Step',blurb:'Straight lines tied by zigzag rows',patch:{tie:'step'}},{id:'hexagon',name:'Hexagon',blurb:'A hexagonal tie network',patch:{tie:'hexagon'}},{id:'ripple',name:'Ripple',blurb:'Sine-shaped ties',patch:{tie:'ripple'}},{id:'petal',name:'Petal',blurb:'Rosette ties on a staggered lattice',patch:{tie:'petal'}}],
  describe:s=>({spacing:`${r1(s.spacing)} mm`,tie:s.tie,tieLength:`${r1(s.tieLength)} mm`,tieDepth:`${r1(s.tieDepth)} mm`}),
}));
const PAIRED_LOOPS=withColour(defineControls({
  ranges:{...SIZE,loopWidth:{min:2,max:10,step:.1},aspect:{min:1.2,max:2.6,step:.05},rowPitch:{min:2,max:15,step:.1},offset:{min:.25,max:.75,step:.05}},
  defaults:{width:100,height:100,loopWidth:4,aspect:1.8,rowPitch:4.32,offset:.5,colorChange:false},
  describe:s=>({loopWidth:`${r1(s.loopWidth)} mm`,aspect:`${r1(s.aspect)}× tall`,rowPitch:`${r1(s.rowPitch)} mm`,offset:`${r2(s.offset)} loop`}),
}));
const SCALES=withColour(defineControls({
  ranges:{...SIZE,pitch:{min:4,max:20,step:.1},gap:{min:.4,max:2,step:.05},scaleLayers:{min:1,max:10,step:1},carrierLayers:{min:1,max:3,step:1}},
  defaults:{width:100,height:100,tile:'hex',pitch:8,gap:.4,scaleLayers:2,carrierLayers:1,carrier:'solid',interlock:false,colorChange:false},
  enums:{tile:['hex','square','triangle'],carrier:['solid','net']},bools:['interlock'],
  describe:s=>({tile:s.tile,pitch:`${r1(s.pitch)} mm`,gap:`${r1(s.gap)} mm`,scaleLayers:`${s.scaleLayers} layers`,carrier:s.carrier}),
}));

export const RESEARCH_DESIGNS = [layered({
  id:'step-lace',name:'Step, ripple & petal lace',blurb:'Straight lines tied by decorative crossings',about:'Parallel base lines are held together by a second, decorative family: zigzag steps, hexagons, ripples or petals. The ties are the carrier. The design is a fused pseudo-textile, not sliding yarn.',file:'step-lace',c:STEP_LACE,
  shelf:'layered',family:'curves',support:'built-in',state:'untested',settingsKey:'step-lace',joins:'A second decorative family crosses the parallel base lines and holds them together.',sources:{catalogue:['M6'],papers:[10,37]},
  sanitize(raw){const s=STEP_LACE.sanitize(raw);return {...s,tieDepth:Math.max(s.spacing,Math.min(3*s.spacing,s.tieDepth)),petals:Math.max(4,Math.min(10,Math.round(s.petals)))};},
  controls:[{kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},{kind:'choice',key:'tie',title:'Tying pattern',options:[{id:'step',label:'Step'},{id:'hexagon',label:'Hexagon'},{id:'ripple',label:'Ripple'},{id:'petal',label:'Petal'}]},{kind:'sliders',title:'Look and feel',items:[{key:'spacing',label:'Line spacing',help:'Distance between parallel base lines.',lo:'Close',hi:'Open',unit:'mm',edit:true},{key:'tieLength',label:'Tie length',help:'Spacing of the decorative ties.',lo:'Short',hi:'Long',unit:'mm',edit:true},{key:'tieDepth',label:'Tie depth',help:'How far the ties reach across the base lines.',lo:'Shallow',hi:'Deep',unit:'mm',edit:true},{key:'petals',label:'Petals',help:'Lobes in each rosette; used for petal ties.',lo:'Four',hi:'Ten',unit:'',edit:true,when:s=>s.tie==='petal'}]},COLOUR],
  build:(s,boundary)=>{const built=stepLaceLayers(boundary,s);return {layers:built,families:built.families,extra:built.extra};},
  summary:r=>`${r.baseLines} base lines held by ${r.ties} decorative ties`,
 }), layered({
  id:'scales',name:'Scales on a carrier',blurb:'Inset tile islands on a flexible base',about:'Solid tile islands sit on a continuous solid or open-net carrier, with gaps between neighbouring scales. One-material bonded construction; not sliding armour. FlexScale motivates this geometry, but these tiles do not reproduce its interlocking groove.',file:'scales',c:SCALES,
  shelf:'layered',family:'cells',support:'built-in',state:'untested',settingsKey:'scales',joins:'Tiles are separated by a constant gap and bonded to the carrier underneath.',sources:{catalogue:['M8'],papers:[47]},
  controls:[{kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},{kind:'choice',key:'tile',title:'Scale shape',options:[{id:'hex',label:'Hexagon'},{id:'square',label:'Square'},{id:'triangle',label:'Triangle'}]},{kind:'choice',key:'carrier',title:'Carrier',options:[{id:'solid',label:'Solid'},{id:'net',label:'Open net'}]},{kind:'sliders',title:'Look and feel',items:[{key:'pitch',label:'Tile pitch',lo:'Small',hi:'Large',unit:'mm',edit:true},{key:'gap',label:'Tile gap',lo:'Narrow',hi:'Wide',unit:'mm',edit:true},{key:'carrierLayers',label:'Carrier thickness',lo:'Thin',hi:'Thick',unit:'layers',edit:true},{key:'scaleLayers',label:'Scale height',lo:'Low',hi:'High',unit:'layers',edit:true}]},COLOUR],
  build:(s,boundary,ctx)=>{const built=scalesLayers(boundary,{...s,bead:ctx?.bead??.45});return {layers:built,families:built.families,extra:built.extra};},
  summary:r=>`${r.tiles} scales on a ${r.carrier} carrier`,
 }), layered({
  id:'paired-loops',name:'Paired loops',blurb:'Two bonded, staggered loop families',about:'Two flat loop rows interleave on separate print planes and bond at their crossings. This is a knit-like bonded lattice, not mobile stitches or sliding yarn. Published knitted structures motivate the proportions; this FDM construction remains untested.',file:'paired-loops',c:PAIRED_LOOPS,
  shelf:'layered',family:'loops',support:'self',state:'untested',settingsKey:'paired-loops',joins:'The second loop family crosses and bonds to the first on the next print plane.',sources:{catalogue:['M4'],papers:[3,4,25]},
  controls:[{kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},{kind:'sliders',title:'Look and feel',items:[{key:'loopWidth',label:'Loop width',help:'Horizontal size of each closed loop.',lo:'Small',hi:'Large',unit:'mm',edit:true},{key:'aspect',label:'Loop aspect',help:"Beecroft's knit loops were about 1.6–2.4 times as tall as wide.",lo:'Short',hi:'Tall',unit:'×',edit:true},{key:'rowPitch',label:'Row spacing',help:'Centre-to-centre distance between loop rows.',lo:'Close',hi:'Wide',unit:'mm',edit:true},{key:'offset',label:'Row offset',help:'Horizontal offset of the second loop family.',lo:'Quarter',hi:'Three-quarter',unit:'loop',edit:true}]},COLOUR],
  build:(s,boundary)=>{const built=pairedLoopsLayers(boundary,s);return {layers:built,families:built.families,extra:built.extra};},
  summary:r=>`${r.loopCountA} loops in each bonded family`,
 }), layered({
  id: 'rings-flat', name: 'Rings · flat', blurb: 'Overlapping loops in one pass', about: 'One pass of overlapping rings on a staggered or square lattice. The loops overlap rather than meeting at a point, making a flexible sheet whose local contact can be graded by a picture.', file: 'rings-flat', c: RINGS,
  shelf: 'flat', family: 'rings', support: 'self', state: 'untested', settingsKey: 'rings',
  variantGroup:'rings',
  joins: 'Rings overlap and fuse in one pass.', sources: { catalogue: ['M4'], papers: [53, 66] },
  patternEffects: ['size'], patterns: withPicture(['none', ...FIELD_IDS]),
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'lattice', title: 'Structure', hint: 'Choose the arrangement of ring centres.', options: [
      { id: 'hex', label: 'Staggered', hint: 'Offset rows make a close-packed lattice.' },
      { id: 'square', label: 'Square', hint: 'Even rows and columns.' },
    ] },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'ringSize', label: 'Ring size', help: 'Outer diameter. Centres stay on the lattice when the picture grades the ring size.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
      { key: 'overlap', label: 'Overlap', help: 'How far each ring reaches into its neighbour. At least one bead width is kept at every join.', lo: 'Touching', hi: 'Deep', unit: 'mm', edit: true },
    ] },
    { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Ring size follows the picture; overlap stays at least one bead.', picture: 'positive', pictureHint: 'Dark parts of the picture make smaller rings.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the picture or field across the sheet.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false } },
    COLOUR,
  ],
  build: (s, boundary, ctx) => {
    const field = patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture });
    const built = ringsLayers(boundary, { lattice: s.lattice, ringSize: s.ringSize, overlap: s.overlap, sizeField: field, bead: ctx?.bead ?? .45 });
    return { layers: [...built], families: built.families, extra: built.extra };
  },
  summary: result => `rings in one pass, ${result.report.crossings} joins`,
}), layered({
  id:'rings-raised',name:'Rings · raised',blurb:'Each ring climbs over earlier rings',about:"Each ring climbs over rings printed before it, building up in levels. This is Luis's construction; not from a paper. Height is capped so the next ring can climb without exceeding the selected number of levels.",file:'rings-raised',c:RINGS,
  shelf:'raised',family:'rings',support:'self',state:'untested',settingsKey:'rings',joins:'Each ring climbs over the rings printed before it, building up in levels.',sources:{papers:[31,36],notes:["Luis's construction; not from a paper"]},
  variantGroup:'rings',
   controls:[{kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},{kind:'choice',key:'lattice',title:'Structure',hint:'Choose the arrangement of ring centres.',options:[{id:'hex',label:'Staggered'},{id:'square',label:'Square'}]},{kind:'choice',key:'buildOrder',title:'Build order',options:[{id:'rows',label:'Rows',hint:'A steady row-by-row staircase.'},{id:'checker',label:'Checker',hint:'Alternate rings between two levels.'},{id:'spiral',label:'Centre out',hint:'Build from the centre toward the edge.'}]},{kind:'sliders',title:'Look and feel',items:[{key:'ringSize',label:'Ring size',lo:'Small',hi:'Large',unit:'mm',edit:true},{key:'overlap',label:'Overlap',lo:'Touching',hi:'Deep',unit:'mm',edit:true},{key:'levelHeight',label:'Level height',help:'Rise added at each new overlap.',lo:'Low',hi:'High',unit:'mm',edit:true},{key:'maxLevels',label:'Most levels',help:'Maximum permitted height above the bed.',lo:'Few',hi:'Many',unit:'',edit:true},{key:'rampLength',label:'Ramp length',help:'Distance used to climb between levels.',lo:'Short',hi:'Long',unit:'mm',edit:true}]},COLOUR],
  defaults:()=>({...RINGS.defaults,buildOrder:'rows',levelHeight:.2,maxLevels:4,rampLength:1.5}),
  sanitize(raw){const base=RINGS.sanitize(raw);return {...base,buildOrder:['rows','checker','spiral'].includes(raw?.buildOrder)?raw.buildOrder:'rows',levelHeight:Math.max(.15,Math.min(.4,Number(raw?.levelHeight)||.2)),maxLevels:Math.max(2,Math.min(6,Math.round(Number(raw?.maxLevels)||4))),rampLength:Math.max(.8,Math.min(4,Number(raw?.rampLength)||1.5))};},
  ranges:{...RINGS.ranges,levelHeight:{min:.15,max:.4,step:.05},maxLevels:{min:2,max:6,step:1},rampLength:{min:.8,max:4,step:.1}},
  build:(s,boundary,ctx)=>{const built=ringsLayers(boundary,{lattice:s.lattice,ringSize:s.ringSize,overlap:s.overlap,sizeField:patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture}),bead:ctx?.bead??.45,order:s.buildOrder}),extra={...built.extra,clearanceOrder:true};extra.transform=(strands,cfg)=>{const climbed=climbOverlaps(strands,{bead:cfg.t.extrusion_width,layerHeight:cfg.t.layer_height,levelHeight:s.levelHeight,maxLevels:s.maxLevels,rampLength:s.rampLength});extra.clipped=climbed.clipped;return climbed.strands;};return {layers:[...built],families:built.families,extra};},
  verdict:(result,s)=>{const v=buildLayeredVerdict(result);if(result.clipped>0)v.body+=` Some rings could not climb higher and fuse into the layer below (${result.clipped}).`;return v;},
  summary:result=>`rings build up to ${result.construction.levels?.max??1} levels`,
}), layered({
  id: 'rotating-squares', name: 'Rotating squares', blurb: 'Alternating squares linked at their corners', about: 'Alternating squares turn in opposite directions and join only at their corners through short necks. Pulling the sheet makes the units counter-rotate; the border band closes the free edge. The reported auxetic result used ABS squares on a pre-stretched knit, so this single-material version remains untested.', file: 'rotating-squares', c: SQUARE_UNITS,
  shelf: 'flat', family: 'lattices', support: 'self', state: 'untested', settingsKey: 'rotating-units',
  joins: 'Alternating square outlines meet only through corner necks and a border band.', sources: { catalogue: ['S4'], papers: [55] },
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'cell', label: 'Cell size', help: 'Spacing of the square centres. Larger cells leave room for longer joints.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
      { key: 'angle', label: 'Opening angle', help: 'Neighbouring squares rotate by this angle in alternating directions.', lo: 'Closed', hi: 'Open', unit: '°', edit: true },
      { key: 'neck', label: 'Neck width', help: 'Width of the short corner links; wide links make a firmer sheet.', lo: 'Thin', hi: 'Thick', unit: 'mm', edit: true },
      { key: 'neckLength', label: 'Neck length', help: 'Clear distance between the facing square corners.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true },
      { key: 'fillet', label: 'Corner rounding', help: 'Rounds each square corner with a short arc.', lo: 'Sharp', hi: 'Round', unit: 'mm', edit: true },
    ] },
    COLOUR,
  ],
  build: (s,boundary,ctx) => {
    const built=rotatingSquaresLayers(boundary,{...s,bead:ctx?.bead??.45});
    return {layers:[...built],families:built.families,extra:built.extra};
  },
  summary: result => `rotating squares with ${result.report.joints} joins`,
}), layered({
  id: 'rotating-triangles', name: 'Rotating triangles', blurb: 'Alternating triangles linked at their corners', about: 'Equilateral triangles occupy two interleaved sublattices and connect through three short corner necks per interior unit. At zero inclination, the paired corner links form a kagome-like network; a perimeter band closes the free edge. This single-material version is untested, and published mechanisms do not qualify its physical behaviour.', file: 'rotating-triangles', c: TRIANGLE_UNITS,
  shelf: 'flat', family: 'lattices', support: 'self', state: 'untested', settingsKey: 'rotating-triangles',
  joins: 'Alternating triangular outlines meet through corner necks and a border band.', sources: { papers: [6, 34] },
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'cell', label: 'Cell size', help: 'Spacing of the triangular lattice. Larger cells leave room for longer joins.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
      { key: 'angle', label: 'Inclination', help: 'Alternating triangle rotation; the source mechanism remains within ±30°.', lo: '−30°', hi: '30°', unit: '°', edit: true },
      { key: 'neck', label: 'Neck width', help: 'Width of the corner links; a wider link makes a firmer sheet.', lo: 'Thin', hi: 'Thick', unit: 'mm', edit: true },
      { key: 'neckLength', label: 'Neck length', help: 'Clear distance between facing triangle corners.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true },
      { key: 'fillet', label: 'Corner rounding', help: 'Rounds each triangle corner with a short arc.', lo: 'Sharp', hi: 'Round', unit: 'mm', edit: true },
    ] },
    COLOUR,
  ],
  build: (s,boundary,ctx) => {
    const built=rotatingTrianglesLayers(boundary,{...s,bead:ctx?.bead??.45});
    return {layers:[...built],families:built.families,extra:built.extra};
  },
  summary: result => `rotating triangles with ${result.construction.joints} corner joins`,
}), layered({
  id: 'arrowhead-band', name: 'Arrowhead band', blurb: 'Nested re-entrant cells held by side rails', about: 'Rows of hollow arrowhead outlines nest into the row below. Two continuous side rails anchor the edge cells; without them the free edges may fray. This is a flat single-plane interpretation of published re-entrant bands and remains untested.', file: 'arrowhead-band', c: ARROWHEAD,
  shelf: 'flat', family: 'lattices', support: 'self', state: 'untested', settingsKey: 'arrowhead',
  joins: 'Arrowhead arms nest across rows and continuous side rails retain the edges.', sources: { papers: [1, 68] },
  controls: [
    { kind: 'presets', title: 'Start from' },
    { kind: 'size', title: 'Size and shape' },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'columns', label: 'Arrowheads across', help: 'Number of cells spanning the width.', lo: 'Few', hi: 'Many', unit: '', edit: true },
      { key: 'cellHeight', label: 'Cell size', help: 'Vertical height of each hollow arrowhead.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
      { key: 'hingeAngle', label: 'Hinge angle', help: 'Controls the opening of the V arms.', lo: 'Acute', hi: 'Open', unit: '°', edit: true },
      { key: 'depth', label: 'Notch depth', help: 'Depth of the re-entrant notch as a fraction of cell height.', lo: 'Shallow', hi: 'Deep', unit: '×', edit: true },
      { key: 'rail', label: 'Side rails', help: 'Continuous edge rails hold the outer cells. Zero leaves free edges that may fray.', lo: 'None', hi: 'Wide', unit: 'mm', edit: true },
    ] },
    COLOUR,
  ],
  build: (s,boundary,ctx) => {
    const built=arrowheadLayers(boundary,{...s,strand:ctx?.bead??.45});
    return {layers:[...built],families:built.families,extra:built.extra,warnings:built.extra.edgeWarning?[built.extra.edgeWarning]:[]};
  },
  summary: result => `nested arrowheads in ${result.rows} rows`,
}), layered({
  id: 'spiral-cells', name: 'Spiral cells', blurb: 'Four bending arms in each cell', about: 'Four Archimedean arms spiral from the shared edge midpoints into a small central loop. Each arm bends within its cell; adjacent cells meet at those midpoints. Twist grading varies cell-by-cell while retaining the exact shared endpoints.', file: 'spiral-cells', c: SPIRAL_CELLS,
  shelf: 'flat', family: 'lattices', support: 'self', state: 'untested', settingsKey: 'spiral-cells',
  joins: 'Four spiral arms meet at their cell centre and shared edge midpoints.', sources: { catalogue: ['S5'], papers: [42] },
  patternEffects: ['twist'], patterns: withPicture(['none',...FIELD_IDS]),
  controls: [
    { kind: 'presets', title: 'Start from' }, { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'handedness', title: 'Turning', hint: 'Choose clockwise or anticlockwise arms.', options: [{id:1,label:'Clockwise'},{id:-1,label:'Anticlockwise'}] },
    { kind: 'sliders', title: 'Look and feel', items: [
      { key: 'cell', label: 'Cell size', help: 'Keep cells at least 10 mm for the source design’s robustness floor.', lo: 'Small', hi: 'Large', unit: 'mm', edit: true },
      { key: 'twist', label: 'Twist', help: 'Angular travel of each inward arm. The generator preserves the minimum turn gap.', lo: 'Loose', hi: 'Tight', unit: 'rad', edit: true },
      { key: 'armWidth', label: 'Arm width', help: 'Width of the central joining loop.', lo: 'Thin', hi: 'Thick', unit: 'mm', edit: true },
    ] },
    { kind: 'pattern', key: 'pattern', title: 'Pattern', hint: 'Twist changes by cell: darker areas tighten the spiral arms; lighter areas loosen them.', picture: 'positive', pictureHint: 'Darker tones increase twist, tightening each spiral; lighter tones reduce twist and loosen the arms.', scale: { key: 'patternScale', label: 'Pattern size', help: 'Stretches the picture across the sheet.', lo: 'Fine', hi: 'Broad', unit: '×', edit: false } },
    COLOUR,
  ],
  build: (s,boundary,ctx) => { const field=patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture});const built=spiralCellsLayers(boundary,{...s,tone:field});return {layers:[...built],families:built.families,extra:{...built.extra,spiralNote:s.spiralNote},warnings:s.spiralNote?[s.spiralNote]:[]}; },
  summary: result => `four spiral arms per cell in ${result.rows} rows`,
}), layered({
  id: 'voronoi-cells', name: 'Voronoi cells', blurb: 'A single family of closed cell walls', about: 'The Voronoi walls from Voronoi lace, printed alone as a flat cellular net. The optional perimeter line closes boundary cells. Site placement and seed match the existing layered Voronoi card.', file: 'voronoi-cells', c: VORONOI,
  shelf: 'flat', family: 'cells', support: 'self', state: 'untested', settingsKey: 'voronoi',
  joins: 'Voronoi cell walls meet at shared vertices and close against the perimeter.', sources: { papers: [44] },
  patternEffects: ['size'], patterns: withPicture(['none',...FIELD_IDS]),
  controls: [
    {kind:'presets',title:'Start from'}, {kind:'size',title:'Size and shape'},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'spacing',label:'Cell size',help:'Mean distance between neighbouring sites.',lo:'Fine',hi:'Coarse',unit:'mm',edit:true},
      {key:'relax',label:'Evenness',help:'Lloyd relaxation passes; zero is a random scatter.',lo:'Random',hi:'Even',unit:'',edit:true},
      {key:'seed',label:'Pattern number',help:'The same number repeats the same cell arrangement.',lo:'1',hi:'999',unit:'',edit:true},
      {key:'patternScale',label:'Pattern size',help:'Stretches the pattern across the swatch.',lo:'Fine',hi:'Broad',unit:'×',edit:false},
    ]},
    {kind:'switch',key:'border',label:'Close the edge',help:'Print a perimeter strand around the open cell walls.'},
    {kind:'pattern',key:'pattern',title:'Grade with a pattern',hint:'Cell spacing follows the picture.',picture:'positive',pictureHint:'Cells become smaller where the picture is bright.'},
    COLOUR,
  ],
  build:(s,boundary,ctx)=>{const built=voronoiCellsLayers(boundary,{spacing:s.spacing,relax:s.relax,seed:s.seed,border:s.border,tone:patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture})});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`${result.sites} Voronoi cells`,
}), layered({
  id:'stochastic-net',name:'Stochastic net',blurb:'Seeded links with a preferred direction',about:'A repeatable jittered node field connected by anisotropic k-nearest links. The stretched metric biases link lengths along the chosen direction; a boundary strand catches edge nodes. This procedural net is an untested starting point, not a calibrated stiffness guarantee.',file:'stochastic-net',c:STOCHASTIC,
  shelf:'flat',family:'grids',support:'self',state:'untested',settingsKey:'stochastic-net',
  patternEffects:['size'],patterns:withPicture(['none',...FIELD_IDS]),
  joins:'K-nearest links meet at shared nodes; the perimeter anchors the edge.',sources:{catalogue:['S6'],papers:[44,45]},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'density',label:'Node density',help:'Higher density makes smaller cells.',lo:'Sparse',hi:'Dense',unit:'nodes/mm²',edit:true},
      {key:'k',label:'Links per node',help:'Each node selects its nearest neighbours; edges are made undirected.',lo:'Few',hi:'Many',unit:'',edit:true},
      {key:'stretch',label:'Stretch',help:'Anisotropy of the distance metric; 1 is isotropic.',lo:'Even',hi:'Directional',unit:'×',edit:true},
      {key:'direction',label:'Stiff direction',help:'Direction favoured by the stretched metric.',lo:'0°',hi:'180°',unit:'°',edit:true},
      {key:'seed',label:'Variation',help:'The same seed produces the same nodes, including after resizing.',lo:'1',hi:'9999',unit:'',edit:true},
    ]},
    {kind:'switch',key:'border',label:'Close the edge',help:'Add a perimeter strand and connect edge-near nodes.'},
    {kind:'pattern',key:'pattern',title:'Pattern',hint:'Bright areas add nodes for locally denser links; this grading is experimental.',picture:'positive',pictureHint:'Bright image areas add nodes and make the net denser; dark areas retain the base spacing.',scale:{key:'patternScale',label:'Pattern size',help:'Stretches the picture across the swatch.',lo:'Fine',hi:'Broad',unit:'×',edit:false}},COLOUR,
  ],
  build:(s,boundary,ctx)=>{const tone=patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture});const built=stochasticNetLayers(boundary,{...s,tone});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`a seeded net of ${result.nodes} nodes`,
}), layered({
  id:'connected-lace',name:'Connected lace',blurb:'Motifs joined into a single sheet',about:'Ring, six-petal rosette or scallop motifs are placed on a square or staggered lattice and linked by in-plane necks. A perimeter line closes the edge; this card is a flat, backing-free interpretation.',file:'connected-lace',c:CONNECTED_LACE,
  shelf:'flat',family:'lattices',support:'self',state:'untested',settingsKey:'connected-lace',joins:'Each motif links to lattice neighbours through necks; a perimeter line closes the boundary.',sources:{catalogue:['S1'],papers:[59,60,58]},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'motif',title:'Motif',hint:'Choose the repeated lace outline.',options:[{id:'ring',label:'Ring'},{id:'petal',label:'Petal'},{id:'scallop',label:'Scallop'}]},
    {kind:'choice',key:'lattice',title:'Arrangement',hint:'Choose square or staggered placement.',options:[{id:'hex',label:'Staggered'},{id:'square',label:'Square'}]},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'scale',label:'Motif size',help:'Spacing of neighbouring motifs.',lo:'Small',hi:'Large',unit:'mm',edit:true},
      {key:'neck',label:'Neck width',help:'Connection width is kept at least one bead.',lo:'Thin',hi:'Thick',unit:'mm',edit:true},
      {key:'openness',label:'Openness',help:'Motif outline size as a fraction of the lattice pitch.',lo:'Compact',hi:'Open',unit:'×',edit:true},
    ]},COLOUR,
  ],
  build:(s,boundary,ctx)=>{const built=laceLayers(boundary,{...s,bead:ctx?.bead??.45});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`${result.motifCount} lace motifs with ${result.neckCount} joins`,
}), layered({
  id:'meander-ties',name:'Meander with ties',blurb:'A space-filling curve joined without a backing',about:'The existing Meander curves are printed without their backing. Sparse, designed in-plane ties join nearby parallel portions of the curve; these are native geometry, not automatic repair ties.',file:'meander-ties',c:MEANDER_TIES,
  shelf:'flat',family:'curves',support:'self',state:'untested',settingsKey:'meander-ties',joins:'Designed ties bridge nearby folds of one space-filling curve.',sources:{catalogue:['S3']},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'curve',title:'Curve',hint:'Select the space-filling path.',options:CURVE_IDS.map(id=>({id,label:CURVES[id].label,hint:CURVES[id].hint}))},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'cell',label:'Fold size',help:'Target spacing between the folds.',lo:'Fine',hi:'Coarse',unit:'mm',edit:true},
      {key:'angle',label:'Direction',help:'Meander direction setting.',lo:'15°',hi:'75°',unit:'°',edit:true},
      {key:'tieInterval',label:'Tie interval',help:'Approximate spacing of designed cross-ties.',lo:'Sparse',hi:'Frequent',unit:'mm',edit:true},
      {key:'seed',label:'Variation',help:'Repeats the same maze or dot tour.',lo:'1',hi:'999',unit:'',edit:true},
    ]},COLOUR,
  ],
  build:(s,boundary,ctx)=>{const built=meanderTiesLayers(boundary,{...s,bead:ctx?.bead??.45});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`a meander held by ${result.ties} designed ties`,
}), layered({
  id:'kirigami',name:'Kirigami sheet',blurb:'Solid fill with staggered slits',about:'A filled sheet with staggered, rounded-ended slits. Two orthogonal fill passes form a solid piece around the cuts; the slit-to-interval ratio is exposed for TPU experimentation. This toolpath estimate needs physical validation.',file:'kirigami',c:KIRIGAMI,
  shelf:'flat',family:'lattices',support:'self',state:'untested',settingsKey:'kirigami',joins:'The remaining solid sheet joins the slit pattern as one filled piece.',sources:{catalogue:['S4'],papers:[48]},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'passes',title:'Fill passes',hint:'Two orthogonal passes make the filled sheet more robust.',options:[{id:1,label:'One'},{id:2,label:'Two'}]},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'slitLength',label:'Slit length',help:'Length of each rounded-ended cut.',lo:'Short',hi:'Long',unit:'mm',edit:true},
      {key:'slitGap',label:'Slit width',help:'Minimum printable slit width is 1 mm.',lo:'Narrow',hi:'Wide',unit:'mm',edit:true},
      {key:'interval',label:'Row spacing',help:'Distance used for the h/i comparison ratio.',lo:'Close',hi:'Wide',unit:'mm',edit:true},
      {key:'endSpacing',label:'Gap between slit ends',help:'Solid material between adjacent cuts.',lo:'Small',hi:'Large',unit:'mm',edit:true},
    ]},COLOUR,
  ],
  build:(s,boundary,ctx)=>{const built=kirigamiLayers(boundary,{...s,strandWidth:ctx?.bead??.45});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`solid fill around ${result.slits} staggered slits`,
}), layered({
  id:'star-metric',name:'Star-metric cells',blurb:'Petal-shaped cells with radial symmetry',about:'Voronoi cells grow under a periodic star-shaped metric. The lattice and symmetry set the repeating material class; each petal handle changes the radial spans. Pattern grading assigns a nearby metric at each site rather than blending neighbouring cells.',file:'star-metric',c:STAR_METRIC,
  shelf:'flat',family:'cells',support:'self',state:'untested',settingsKey:'star-metric',patterns:withPicture(['none',...FIELD_IDS]),joins:'Metric cell walls meet at shared vertices and close against the perimeter.',sources:{catalogue:['S7'],papers:[46]},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'lattice',title:'Lattice',hint:'Choose the arrangement of cell centres.',options:[{id:'triangular',label:'Triangular'},{id:'honeycomb',label:'Honeycomb'},{id:'square',label:'Square'},{id:'diagonal-square',label:'Diagonal square'}]},
    {kind:'choice',key:'symmetry',title:'Symmetry',hint:'The metric repeats this many times around each site.',options:[{id:3,label:'3-fold'},{id:4,label:'4-fold'},{id:6,label:'6-fold'}]},
    {kind:'petal',key:'spans',hint:'Drag a handle to change one radial span. Arrow keys adjust it by 0.05.'},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'cell',label:'Cell size',help:'Spacing of the metric sites.',lo:'Small',hi:'Large',unit:'mm',edit:true},
      {key:'wall',label:'Wall width',help:'Nominal line width for metric cell walls.',lo:'Thin',hi:'Thick',unit:'mm',edit:true},
    ]},
    {kind:'pattern',key:'pattern',title:'Grade with a pattern',hint:'Darker image areas widen cells; lighter areas keep the base metric.',picture:'positive',pictureHint:'Bright areas enlarge cells and shift their radial metric; darker areas retain the base cell spacing.',scale:{key:'patternScale',label:'Pattern size',help:'Stretches the tone field over the piece.',lo:'Fine',hi:'Broad',unit:'×',edit:false}},COLOUR,
  ],
  build:(s,boundary,ctx)=>{const tone=patternField(s.pattern,{scale:s.patternScale,picture:ctx?.picture});const built=starMetricLayers(boundary,{...s,tone});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`${result.sites} star-metric sites`,
}), layered({
  id:'isohedral-tiles',name:'Isohedral tiles',blurb:'A repeating network of tile edges',about:'TactileJS supplies the periodic tile geometry for the selected isohedral family. Edges are straightened for this first printable study; the expected symmetry class is a geometric prediction, not a measured material property.',file:'isohedral-tiles',c:ISOHEDRAL,
  shelf:'flat',family:'lattices',support:'self',state:'untested',settingsKey:'isohedral-tiles',joins:'Shared prototile edges are deduplicated and joined into a repeating net.',sources:{catalogue:['S7'],papers:[47,54]},
  controls:[{kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'family',title:'Tile family',hint:'The initial curated set uses TactileJS families; more than 80 are available in the library.',options:['IH28','IH21','IH1','IH41','IH84','IH2','IH3','IH7','IH10','IH14','IH18','IH20'].map(id=>({id,label:id,hint:`Predicted symmetry class: ${isohedralMaterialClass(id)}; geometric expectation, not a physical result.`}))},
    {kind:'sliders',title:'Shape and scale',items:[{key:'scale',label:'Tile scale',help:'Approximate repeat scale.',lo:'Small',hi:'Large',unit:'mm',edit:true},...[1,2,3,4,5,6].map(i=>({key:`shape${i}`,label:`Shape ${i}`,help:'Isohedral prototile parameter (−1 to 2).',lo:'−1',hi:'2',unit:'',edit:true}))]},COLOUR],
  build:(s,boundary)=>{const count=isohedralParameterCount(s.family),params=Array.from({length:count},(_,i)=>s[`shape${i+1}`]??0),built=isohedralLayers(boundary,{family:s.family,params,scale:s.scale});return {layers:[...built],families:built.families,extra:built.extra};},
  summary:result=>`${result.family} with ${result.uniqueEdges} unique tile edges`,
}), layered({
  id:'lace-backing',name:'Lace + backing',blurb:'A decorative motif held by an open carrier',about:'Ring, petal or scallop lace is printed face-down on the bed, then held by one open carrier pass or two crossed passes. Unlike connected lace, the motifs need no necks because the carrier supports each island. Only motif-first ordering is implemented.',file:'lace-backing',c:CONNECTED_LACE,
  shelf:'layered',family:'lattices',support:'auto',state:'untested',joins:'The open carrier crosses and holds each motif island.',sources:{catalogue:['M1'],papers:[58,59]},
  controls:[
    {kind:'presets',title:'Start from'},{kind:'size',title:'Size and shape'},
    {kind:'choice',key:'motif',title:'Motif',hint:'Choose the repeated lace outline.',options:[{id:'ring',label:'Ring'},{id:'petal',label:'Petal'},{id:'scallop',label:'Scallop'}]},
    {kind:'choice',key:'lattice',title:'Arrangement',hint:'Choose square or staggered placement.',options:[{id:'hex',label:'Staggered'},{id:'square',label:'Square'}]},
    {kind:'sliders',title:'Look and feel',items:[
      {key:'scale',label:'Motif size',help:'Spacing of neighbouring motifs.',lo:'Small',hi:'Large',unit:'mm',edit:true},
      {key:'openness',label:'Openness',help:'Motif outline size as a fraction of the lattice pitch.',lo:'Compact',hi:'Open',unit:'×',edit:true},
    ]},
  ],
  build:(s,boundary)=>{const built=laceOnCarrierLayers(boundary,{...s,support:s.support});return {layers:built,families:built.families,extra:built.extra};},
  summary:result=>`${result.motifs} motifs on ${result.carrierPasses} carrier passes`,
})];
