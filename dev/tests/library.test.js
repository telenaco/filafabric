import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { SHELVES, FAMILIES, validateCard, libraryGroups, variantsOf, variantDefaultErrors, selectVariant, initialDesignSettings } from '../../site/src/ui/library.js';
import { layered } from '../../site/src/ui/more-designs.js';
import { panelOrderErrors } from '../../site/src/ui/panels.js';

// every card now follows the panel order; T1.11 asserts that this stays empty
const ALLOWED_LEGACY = new Set();

test('all ready cards have the exact ticket metadata', () => {
  const brief = [
    "   | `loop-pile` | raised | pile | built-in | untested | Raised loops are anchored to an open base mesh. |",
    "   | `squiggle` | layered | waves | self | untested | Two wavy families cross and fuse where they meet. |",
    "   | `square-net` | layered | waves | self | untested | Two square-wave families cross and fuse. |",
    "   | `honeycomb-layered` | layered | cells | self | untested | Two half-hexagon families meet as cells. |",
    "   | `figure8-net` | layered | loops | self | untested | Two figure-8 families cross and fuse. |",
    "   | `looped-net` | raised | loops | built-in | untested | Loops circle over themselves and lift over the earlier pass. |",
    "   | `squiggle-rings` | layered | rings | self | untested | Wavy ring families cross. |",
    "   | `squiggle-zigzag` | layered | waves | self | untested | Two zigzag families cross and fuse. |",
    "   | `coil` | raised | loops | self | untested | One strand in rows of loops; each touches the next row. |",
    "   | `figure8-rows` | raised | loops | self | untested | One strand in rows of figure-8s; each touches the next row. |",
    "   | `coil-shapes` | flat | loops | self | untested | One strand in rows; each loop touches the next row. |",
    "   | `weave` | layered | woven | self | untested | Lower and upper pieces at two levels, joined by ramps; crossings fuse. |",
    "   | `spiral` | layered | radial | built-in | untested | Nested rings held by a crossing carrier. |",
    "   | `boucle` | layered | rings | built-in | untested | Rings sit on a carrier line, for edges. |",
    "   | `relief` | raised | textures | built-in | untested | Rows rise and fall over a crossed base. |",
    "   | `fringe` | raised | pile | built-in | untested | Hanging loops with free ends, anchored to base rows. |",
    "   | `zigzag` | layered | waves | self | untested | Two zigzag layers fuse where they meet. |",
    "   | `svgdesign` | layered | motif | auto | untested | Your drawing, held by a backing printed with it. |",
    "   | `crosshatch` | layered | grids | self | untested | Straight lines in two or three directions fuse where they cross. |",
    "   | `crosshatch-wavy` | layered | grids | self | untested | Straight lines in two or three directions fuse where they cross. |",
    "   | `auxetic` | layered | cells | self | untested | Bow-tie cells joined by struts; they widen when pulled. |",
    "   | `honeycomb-flat` | layered | cells | self | untested | Hexagon cells share their walls in one pass. |",
    "   | `dipweave` | raised | woven | self | untested | Wefts rise over the warps and dip between them. |",
    "   | `web` | layered | radial | self | untested | A spiral crossed by a radial zigzag. |",
    "   | `chainmail` | layered | rings | self | untested | Rings on two layers overlap and fuse. |",
    "   | `meander` | layered | motif | auto | untested | A space-filling curve held by a backing. |",
    "   | `harmonograph` | layered | curves | self | untested | One closed curve crosses itself in diamonds. |",
    "   | `truchet` | layered | tiles | self | needs-repair | Tile curves meet at tile edges; a shifted second layer crosses them. |",
    "   | `voronoi` | layered | cells | self | untested | Triangle edges print first, then the cells over them. |",
    "   | `turing` | layered | motif | auto | untested | Grown stripes held by a backing. |",
    "   | `conformal` | layered | fields | self | untested | A square grid bent round holes; its two directions cross. |",
    "   | `sunflower` | layered | radial | self | untested | Two seed spirals wind opposite ways and meet at the seeds. |",
    "   | `rosette` | layered | radial | self | untested | Two wavy spirals in opposite phase cross. |",
    "   | `flowlines` | layered | fields | self | untested | Lines along a flow, crossed at 90 degrees. |",
    "   | `bubbles` | layered | rings | self | untested | Packed rings held by a ring in every gap. |",
    "   | `parquet` | layered | tiles | self | needs-repair | Block turnarounds meet a designed seam family. Print validation is still pending. |",
    "   | `spirograph` | layered | radial | self | untested | Two rings of curls, half a ring apart, cross. |",
    "   | `starlattice` | layered | lattices | self | untested | Star straps in non-crossing families meet at the tile edges. |",
    "   | `halftone` | layered | waves | self | untested | A crossed net whose line thickness carries a picture. |",
    "   | `spacer` | raised | spacers | built-in | untested | Two nets held apart by small pillars. |",
    "   | `pillarweave` | raised | spacers | self | untested | Fibre locked round upright pillars. |",
    "   | `rotated-stack` | layered | grids | self | untested | Straight parallel strands bond where each rotated plane crosses the one below. |",
    "   | `moire-net` | layered | grids | self | untested | Two close-pitched line families cross to make broad interference bands. |",
    "   | `rings-flat` | flat | rings | self | untested | Rings overlap and fuse in one pass. |",
    "   | `rotating-squares` | flat | lattices | self | untested | Alternating square outlines meet only through corner necks. |",
    "   | `rotating-triangles` | flat | lattices | self | untested | Alternating triangular outlines meet through corner necks. |",
    "   | `arrowhead-band` | flat | lattices | self | untested | Arrowhead arms nest across rows and join the columns beside them. |",
    "   | `spiral-cells` | flat | lattices | self | untested | Four spiral arms meet at their cell centre and shared edge midpoints. |",
    "   | `voronoi-cells` | flat | cells | self | untested | Voronoi cell walls meet at shared vertices and close against the perimeter. |",
    "   | `stochastic-net` | flat | grids | self | untested | K-nearest links meet at shared nodes; the perimeter anchors the edge. |",
    "   | `connected-lace` | flat | lattices | self | untested | Each motif links to lattice neighbours through necks; a perimeter line closes the boundary. |",
    "   | `meander-ties` | flat | curves | self | untested | Designed ties bridge nearby folds of one space-filling curve. |",
    "   | `kirigami` | flat | lattices | self | untested | The remaining solid sheet joins the slit pattern as one filled piece. |",
    "   | `star-metric` | flat | cells | self | untested | Metric cell walls meet at shared vertices and close against the perimeter. |",
    "   | `isohedral-tiles` | flat | lattices | self | untested | Shared prototile edges are deduplicated and joined into a repeating net. |",
    "   | `lace-backing` | layered | lattices | auto | untested | The open carrier crosses and holds each motif island. |",
    "   | `rings-raised` | raised | rings | self | untested | Each ring climbs over the rings printed before it, building up in levels. |",
    "   | `corrugation` | raised | textures | built-in | untested | Smooth ridges rise over a crossed base net. |",
    "   | `step-lace` | layered | curves | built-in | untested | A second decorative family crosses the parallel base lines and holds them together. |",
    "   | `paired-loops` | layered | loops | self | untested | The second loop family crosses and bonds to the first on the next print plane. |",
    "   | `scales` | layered | cells | built-in | untested | Tiles are separated by a constant gap and bonded to the carrier underneath. |",
    "   | `coil-flat` | flat | loops | self | untested | One strand in rows; each row touches the next, all in one layer. |",
    "   | `figure8-rows-flat` | flat | loops | self | untested | One strand in rows; each row touches the next, all in one layer. |",
    "   | `auxetic-flat` | flat | cells | self | untested | Bow-tie cells in one layer: each strut ends on the rows beside it. |",
    "   | `honeycomb-planar` | flat | cells | self | untested | Hexagon cells in one layer: each strut ends on the rows beside it. |",
    "   | `starlattice-flat` | flat | lattices | self | untested | Star straps in non-crossing families meet at the tile edges, joined in one layer. |",
    "   | `harmonograph-flat` | flat | curves | self | untested | One closed curve crosses itself in diamonds, joined in one layer. |",
    "   | `truchet-flat` | flat | tiles | needs-backing | untested | Tile curves meet at the tile edges, in one layer without a backing. |",
    "   | `turing-flat` | flat | motif | needs-backing | untested | Grown stripes in one layer, without a backing. |",
    "   | `meander-flat` | flat | motif | needs-backing | untested | One space-filling curve in one layer, without a backing. |",
    "   | `parquet-flat` | flat | tiles | needs-backing | untested | Blocks of parallel lines joined by seams, in one layer without a backing. |",
    "   | `boucle-flat` | flat | rings | needs-backing | untested | Rings sit on a line, in one layer without the built-in backing. |",
    "   | `squiggle-flat` | flat | waves | self | untested | Two wavy families meet in one layer, joined where they cross. |",
    "   | `square-net-flat` | flat | waves | self | untested | Two square-wave families meet in one layer, joined where they cross. |",
    "   | `figure8-net-flat` | flat | loops | self | untested | Two figure-8 families meet in one layer, joined where they cross. |",
    "   | `zigzag-flat` | flat | waves | self | untested | Zigzag lines, with or without a second set joined to them in the same layer. |",
    "   | `grid-lifted` | raised | grids | self | untested | Later strands lift over earlier ones at chosen crossings and land after cooling. |",
    "   | `grid-sliding` | raised | grids | self | untested | Printed channels hold one direction over the other while letting it slide. |",
    "   | `wave-bridged` | raised | waves | self | untested | The second family rises over the first on rounded bridges at every crossing. |",
    "   | `colour-exposure` | raised | textures | self | untested | The upper family sits higher where the picture is light, showing more of the lower colour. |",
  ].join("\n");
  const rows = [...brief.matchAll(/\| `([^`]+)` \| (flat|layered|raised) \| (\w+) \| (self|auto|built-in|needs-backing) \| (untested|needs-repair) \| ([^|]+) \|/g)];
  assert.equal(rows.length, 80);
  const additions = ['trapezoid-net', 'strain-wave-cells', 'auxetic-star', 'auxetic-floral', 'sliding-squares', 'sliding-circles', 'experiment-slub', 'experiment-pearls', 'experiment-couch', 'experiment-tuck', 'experiment-floats', 'experiment-drawn', 'experiment-tufts'];
  assert.equal(DESIGNS.filter(d => d.status === 'ready' && !d.id.endsWith('-legacy')).length, 80 + additions.length);
  for (const id of additions) assert.deepEqual(validateCard(DESIGNS.find(d => d.id === id)), [], id);
  assert.deepEqual(DESIGNS.filter(d => d.id.endsWith('-legacy')).map(d=>d.id).sort(),['meander-legacy','truchet-legacy','turing-legacy']);
  assert.ok(DESIGNS.filter(d=>d.id.endsWith('-legacy')).every(d=>d.hidden&&d.status==='ready'));
  for (const [, id, shelf, family, support, state, joins] of rows) {
    const card = DESIGNS.find(d => d.id === id);
    assert.deepEqual(validateCard(card), [], id);
    assert.deepEqual([card.shelf, card.family, card.support, card.state, card.joins], [shelf, family, support, state, joins.trim()]);
    const sources = {
      auxetic: { catalogue: ['S4'], papers: [24, 26, 55] },
      'honeycomb-flat': { catalogue: ['S4'], papers: [24, 26, 55] },
      crosshatch: { catalogue: ['S2'], papers: [29, 54, 9] },
      'crosshatch-wavy': { catalogue: ['S2'], papers: [29, 54, 9] },
      starlattice: { catalogue: ['S3'], papers: [30, 31] },
      'rotated-stack': { papers: [69] },
      'moire-net': { catalogue: ['M7'], papers: [43, 58, 61] },
      'rings-flat': { catalogue: ['M4'], papers: [53, 66] },
      'rotating-squares': { catalogue: ['S4'], papers: [55] },
      'rotating-triangles': { papers: [6, 34] },
      'arrowhead-band': { papers: [1, 68] },
      'spiral-cells': { catalogue: ['S5'], papers: [42] },
      'voronoi-cells': { papers: [44] },
      'stochastic-net': { catalogue: ['S6'], papers: [44, 45] },
      'connected-lace': { catalogue: ['S1'], papers: [59, 60, 58] },
      'meander-ties': { catalogue: ['S3'] },
      kirigami: { catalogue: ['S4'], papers: [48] },
      'star-metric': { catalogue: ['S7'], papers: [46] },
      'isohedral-tiles': { catalogue: ['S7'], papers: [47, 54] },
      'lace-backing': { catalogue: ['M1'], papers: [58, 59] },
      'rings-raised': { papers: [31, 36], notes: ["Luis's construction; not from a paper"] },
      corrugation: { catalogue: ['N2'] },
      'step-lace': { catalogue: ['M6'], papers: [10, 37] },
      'paired-loops': { catalogue: ['M4'], papers: [3, 4, 25] },
      scales: { catalogue: ['M8'], papers: [47] },
      'auxetic-flat': { catalogue: ['S4'], papers: [24, 26, 55] },
      'honeycomb-planar': { catalogue: ['S4'], papers: [24, 26, 55] },
      'starlattice-flat': { catalogue: ['S3'], papers: [30, 31] },
      'grid-lifted': { papers: [66], catalogue: ['M9'] },
      'grid-sliding': { papers: [67] },
      'wave-bridged': { papers: [31] },
      'colour-exposure': { catalogue: ['N3', 'M2'], papers: [17] },
    };
    assert.deepEqual(card.sources, sources[id] ?? {});
    assert.ok(Object.hasOwn(FAMILIES, family));
  }
});

test('visible ready cards occur once on their shelf, grouped by family', () => {
  const groups = libraryGroups();
  assert.deepEqual(Object.keys(groups), Object.keys(SHELVES));
  const cards = Object.entries(groups).flatMap(([shelf, families]) => families.flatMap(({ family, cards }) => {
    for (const card of cards) { assert.equal(card.shelf, shelf); assert.equal(card.family, family); }
    return cards;
  }));
  assert.deepEqual(cards.map(d => d.id).sort(), DESIGNS.filter(d => d.status === 'ready' && !d.hidden).map(d => d.id).sort());
  assert.deepEqual(libraryGroups([{ status: 'preset' }, { status: 'planned' }]), { flat: [], layered: [], raised: [], experimental: [] });
});

test('library groups order cards by print state and then name', () => {
  const fixture = ['Zulu', 'Beta', 'Alpha'].map((name, i) => ({ ...DESIGNS.find((d) => d.id === 'coil'), id: `fixture-${i}`, name,
    family: 'loops', state: ['untested', 'tested', 'needs-repair'][i] }));
  const cards = Object.values(libraryGroups(fixture)).flatMap((groups) => groups.flatMap((group) => group.cards));
  assert.deepEqual(cards.map((card) => card.name), ['Beta', 'Zulu', 'Alpha']);
});

test('panel order accepts six sections and optional Structure editors, and rejects legacy or repeated groups', () => {
  assert.ok(panelOrderErrors([{ kind: 'presets' }, { kind: 'size' }]).some((error) => error.includes('size is out of panel order')));
  assert.deepEqual(panelOrderErrors([{ kind: 'size' }, { kind: 'presets' }, { kind: 'choice' }, { kind: 'petal' }, { kind: 'choice' },
    { kind: 'sliders' }, { kind: 'switch', key: 'link' }, { kind: 'pattern' }, { kind: 'colour' }, { kind: 'support' }]), []);
  assert.deepEqual(panelOrderErrors([{kind:'size'},{kind:'choice'},{kind:'draft'},{kind:'sliders'}]),[]);
  assert.ok(panelOrderErrors([{kind:'size'},{kind:'draft'},{kind:'draft'}]).some(error=>error.includes('draft appears more than once')));
  assert.ok(panelOrderErrors([{ kind: 'shape' }]).some((error) => error.includes('shape')));
  assert.ok(panelOrderErrors([{ kind: 'switch', key: 'colorChange' }]).some((error) => error.includes('colorChange')));
  assert.ok(panelOrderErrors([{ kind: 'pattern' }, { kind: 'sliders' }]).length);
  assert.ok(panelOrderErrors([{ kind: 'size' }, { kind: 'size' }]).length);
  assert.ok(panelOrderErrors([{ kind: 'switch' }]).length);
});

test('every visible card follows the panel contract or is explicitly on the Phase 1 legacy list', () => {
  for (const card of DESIGNS.filter((entry) => entry.status === 'ready' && !entry.hidden)) {
    const errors = panelOrderErrors(card.controls);
    if (!ALLOWED_LEGACY.has(card.id)) assert.deepEqual(errors, [], `${card.id}: ${errors.join('; ')}`);
    else assert.ok(errors.length, `${card.id} no longer needs the temporary legacy allowance`);
  }
});

test('validation rejects malformed metadata and skips preset tiles', () => {
  const base = { ...DESIGNS[0] };
  for (const [key, values] of Object.entries({ shelf: ['missing', 'toString'], family: ['missing', 'toString'], joins: ['', 'No stop', 'x'.repeat(120) + '.'], support: ['missing'], state: ['missing'], sources: [null, [], 'text'], settingsKey: [12, null], legacy: [true, {}, [{ id: 12 }], [{ id: 'old', patch: [] }]] })) {
    for (const value of values) assert.ok(validateCard({ ...base, [key]: value }).length, `${key}: ${value}`);
  }
  assert.deepEqual(validateCard({ status: 'preset' }), []);
  assert.deepEqual(validateCard({ ...base, legacy: [{ id: 'old', patch: { shape: 'ring' } }] }), []);
});

test('variants default to each card id; unknown ids have no variants', () => {
  for (const card of DESIGNS.filter(d => d.status === 'ready' && !d.hidden)) {
    const expected = card.variantGroup
      ? Object.keys(SHELVES).flatMap(shelf => DESIGNS.filter(other => other.status === 'ready' && !other.hidden && other.shelf === shelf && other.variantGroup === card.variantGroup))
      : card.settingsKey
      ? Object.keys(SHELVES).flatMap(shelf => DESIGNS.filter(other => other.status === 'ready' && !other.hidden && other.shelf === shelf && other.settingsKey === card.settingsKey))
      : [card];
    assert.deepEqual(variantsOf(card.id), expected);
  }
  for (const card of DESIGNS.filter(d => d.status === 'ready' && d.hidden)) assert.deepEqual(variantsOf(card.id), []);
  assert.deepEqual(variantsOf('missing'), []);
  assert.deepEqual(variantsOf('rings-flat').map(card=>card.id),['rings-flat','chainmail','rings-raised']);
  const cards = ['raised', 'flat', 'layered'].map(shelf => ({ ...DESIGNS[0], id: `test-${shelf}`, shelf, settingsKey: 'test' }));
  DESIGNS.push(...cards);
  try { assert.deepEqual(variantsOf('test-flat').map(d => d.shelf), ['flat', 'layered', 'raised']); }
  finally { DESIGNS.splice(-cards.length); }
});

test('variant fixtures share settings keys and order links by shelf', () => {
  const fixture = ['raised', 'flat', 'layered'].map((shelf) => ({ ...DESIGNS[0], id: `variant-${shelf}`, shelf,
    settingsKey: 'fixture', defaults: () => ({ width: 100, height: 100, spacing: 4 }) }));
  assert.deepEqual(variantsOf('variant-layered', fixture).map((card) => card.shelf), ['flat', 'layered', 'raised']);
  assert.deepEqual(variantDefaultErrors(fixture), []);
  assert.deepEqual(variantDefaultErrors(DESIGNS), []);
  const settings = initialDesignSettings(fixture);
  const state = { design: 'variant-flat', designs: settings };
  const shared = state.designs.fixture;
  assert.equal(selectVariant(state, 'variant-raised', fixture), true);
  assert.equal(state.design, 'variant-raised');
  assert.equal(state.designs.fixture, shared);
  assert.equal(selectVariant(state, 'missing', fixture), false);
  fixture[2].defaults = () => ({ width: 100, height: 100, spacing: 4, lift: 0.2 });
  assert.match(variantDefaultErrors(fixture)[0], /defaults differ/);
});

test('layered preserves every optional metadata field including migration arrays', () => {
  const meta = { shelf: 'flat', family: 'waves', joins: 'Lines join.', support: 'self', state: 'untested', settingsKey: 'wave', sources: {}, patternEffects: ['depth'], colourModes: ['one'], legacy: [{ id: 'old' }] };
  const card = layered({ ...meta, id: 'test', c: { defaults: {} }, controls: [], build: () => ({ layers: [] }) });
  for (const [key, value] of Object.entries(meta)) assert.equal(card[key], value, key);
  assert.equal(card.legacyPanel, undefined);
});

test('reserved permanent IDs are documented, without creating future cards', () => {
  const library = readFileSync(new URL('../../site/src/ui/library.js', import.meta.url), 'utf8');
  const table = [
    "| Plan ID | Card ID | Name | Notes |",
    "   |---|---|---|---|",
    "   | F-01 | `rings-flat` | Rings \u00b7 flat | new; settingsKey `rings` |",
    "   | F-02 | `honeycomb-flat` | Honeycomb \u00b7 flat | from `auxetic` with `cell: 'hexagon'`; settingsKey `honeycomb` |",
    "   | F-03 | `auxetic` | Re-entrant (bow-tie) | existing ID |",
    "   | F-04 | `starlattice` | Star lattice | existing |",
    "   | F-05 | \u2014 | *withdrawn* | the same as L-08 (see the plan's \u00a75.1); do not use the ID `isogrid-flat` |",
    "   | F-06 | `rotating-squares` | Rotating squares | new |",
    "   | F-07 | `rotating-triangles` | Rotating triangles | new |",
    "   | F-08 | `arrowhead-band` | Arrowhead band | new |",
    "   | F-09 | `spiral-cells` | Spiral cells | new |",
    "   | F-10 | `stochastic-net` | Stochastic net | new |",
    "   | F-11 | `star-metric` | Star-metric cells | new |",
    "   | F-12 | `isohedral-tiles` | Isohedral tiles | new |",
    "   | F-13 | `connected-lace` | Connected lace | new |",
    "   | F-14 | `meander-ties` | Meander with ties | new |",
    "   | F-15 | `voronoi-cells` | Voronoi cells | new |",
    "   | F-16 | `coil` | Looped rows | existing ID |",
    "   | F-17 | `figure8-rows` | Figure-8 rows | new ID, Coil generator |",
    "   | F-18 | `harmonograph` | Harmonograph | existing |",
    "   | F-19 | `kirigami` | Kirigami sheet | new |",
    "   | L-01 | `squiggle` | Wave net | existing ID; settingsKey `wave` |",
    "   | L-02 | `zigzag` | Zigzag net | existing ID |",
    "   | L-03 | `square-net` | Square-wave net | new ID, Squiggle generator |",
    "   | L-04 | `honeycomb-layered` | Honeycomb \u00b7 layered | new ID, Squiggle generator; settingsKey `honeycomb` |",
    "   | L-05 | `figure8-net` | Figure-8 net | new ID, Squiggle generator |",
    "   | L-06 | `chainmail` | Rings \u00b7 layered | existing ID; comparison group `rings` (card-specific geometry settings) |",
    "   | L-07 | `bubbles` | Bubbles | existing |",
    "   | L-08 | `crosshatch` | Grid & isogrid \u00b7 layered | existing ID; settingsKey `grid` |",
    "   | L-09 | `rotated-stack` | Rotated stack | new |",
    "   | L-10 | `moire-net` | Moir\u00e9 net | new |",
    "   | L-11 \u2026 L-18 | `voronoi`, `web`, `sunflower`, `rosette`, `spirograph`, `conformal`, `flowlines`, `spiral` | unchanged names | existing |",
    "   | L-19 | `weave` | Woven draft | existing ID |",
    "   | L-20, L-21 | `truchet`, `parquet` | unchanged | existing |",
    "   | L-22, L-23 | `meander`, `turing` | unchanged | existing |",
    "   | L-24 | `svgdesign` | Your drawing | existing ID |",
    "   | L-25 | `lace-backing` | Lace + backing | new |",
    "   | L-26 | `step-lace` | Step, ripple and petal lace | new |",
    "   | L-27 | `paired-loops` | Paired loops | new |",
    "   | L-28 | `scales` | Scales on a carrier | new |",
    "   | L-29 | `boucle` | Boucl\u00e9 & picots | existing |",
    "   | R-01 | `rings-raised` | Rings \u00b7 raised | new; settingsKey `rings` |",
    "   | R-02 \u2026 R-04 | `loop-pile`, `relief`, `dipweave` | unchanged | existing |",
    "   | R-05 | `looped-net` | Looped net | new ID, Squiggle generator |",
    "   | R-06 \u2026 R-08 | `fringe`, `spacer`, `pillarweave` | unchanged | existing |",
    "   | R-09 | `grid-lifted` | Grid \u00b7 lifted crossings | new; settingsKey `grid` |",
    "   | R-10 | `grid-sliding` | Grid \u00b7 sliding channels | new; settingsKey `grid` |",
    "   | R-11 | `wave-bridged` | Wave net \u00b7 bridged crossings | new; settingsKey `wave` |",
    "   | R-12 | `corrugation` | Corrugation | new |",
    "   | R-13 | `colour-exposure` | Colour exposure texture | new |",
    "   | (hidden) | `squiggle-rings`, `squiggle-zigzag`, `coil-shapes`, `halftone` | legacy only | open old links exactly (T1.2, T1.3, T1.4, T1.5) |",
  ].join("\n");
  for (const line of table.trim().split('\n')) assert.ok(library.includes(line.trim()), line);
  assert.equal(new Set(DESIGNS.map(d => d.id)).size, DESIGNS.length);
  assert.ok(!DESIGNS.some(d => d.id === 'isogrid-flat'));
});

test('cards are listed simplest first, and every visible card has a place in that order', async () => {
  const { SIMPLEST_FIRST, simplestFirst } = await import('../../site/src/ui/library.js');
  const visible = DESIGNS.filter((d) => d.status === 'ready' && !d.hidden).map((d) => d.id);
  assert.deepEqual(visible.filter((id) => !SIMPLEST_FIRST.includes(id)), [], 'a new card needs a place in SIMPLEST_FIRST');
  assert.deepEqual(SIMPLEST_FIRST.filter((id) => !visible.includes(id)), [], 'SIMPLEST_FIRST names a card that is not there');
  assert.equal(new Set(SIMPLEST_FIRST).size, SIMPLEST_FIRST.length);
  const flat = simplestFirst(DESIGNS.filter((d) => d.status === 'ready' && !d.hidden && d.shelf === 'flat')).map((d) => d.id);
  assert.deepEqual(flat.slice(0, 3), ['honeycomb-planar', 'auxetic-flat', 'rings-flat']);
  assert.ok(flat.indexOf('stochastic-net') > flat.indexOf('rotating-squares'), 'the random graph comes after the plain regular patterns');
  assert.deepEqual(simplestFirst([{ id: 'zzz' }, { id: 'auxetic' }, { id: 'yyy' }]).map((c) => c.id), ['auxetic', 'zzz', 'yyy'], 'unlisted cards keep their order, after the listed ones');
});
