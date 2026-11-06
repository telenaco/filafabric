import { layered } from './more-designs.js';
import { defineControls } from './structure-controls.js';
import { strainCellLayers, reentrantStarLayers } from '../engine/research-cells.js';
import { joinedPlane } from '../engine/flat-variants.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };
const slider = (key, label, unit = 'mm') => ({ key, label, unit, edit: true, lo: 'Low', hi: 'High' });
const wave = defineControls({ ranges: { ...SIZE, cell: { min: 4, max: 24, step: 0.5 }, depth: { min: 0.2, max: 3, step: 0.1 } }, defaults: { width: 100, height: 100, cell: 8, depth: 1, waves: 2, direction: 'both', colorChange: false }, enums: { waves: [1, 2], direction: ['both', 'x', 'y'] }, describe: s => ({ cell: `${s.cell} mm`, depth: `${s.depth} mm` }) });

export const RESEARCH_CELL_DESIGNS = [layered({
  id: 'strain-wave-cells', name: 'Localized wave cells', file: 'strain-wave-cells', c: wave, shelf: 'layered', family: 'waves', support: 'self', state: 'untested', sources: { papers: [66] },
  blurb: 'One or two slack waves between straight junctions', about: 'Pattinson-inspired cells keep the grid junctions straight and place one or two trapezoidal waves between them. Select one or both directions. This geometry may stiffen as its slack straightens; no strain threshold is predicted.', joins: 'Two strand families fuse at the straight junctions between the slack waves.',
  controls: [{ kind: 'size', title: 'Size and shape' }, { kind: 'choice', key: 'waves', title: 'Waves per segment', options: [{ id: 1, label: 'One' }, { id: 2, label: 'Two' }] }, { kind: 'choice', key: 'direction', title: 'Slack direction', options: [{ id: 'both', label: 'Both' }, { id: 'x', label: 'X only' }, { id: 'y', label: 'Y only' }] }, { kind: 'sliders', title: 'Look and feel', items: [slider('cell', 'Junction spacing'), slider('depth', 'Slack depth')] }],
  build: (s, boundary) => { const layers = strainCellLayers(boundary, s); return { layers, families: layers.families }; }, summary: () => 'a net with localized slack between junctions',
}), ...[false, true].map(floral => {
  const c = defineControls({ ranges: { ...SIZE, cell: { min: 5, max: 20, step: 0.1 }, angle: { min: floral ? 55 : 25, max: floral ? 65 : 35, step: 5 } }, defaults: { width: 100, height: 100, cell: 10.8, angle: floral ? 60 : 30, colorChange: false }, describe: s => ({ cell: `${s.cell} mm side (${(s.cell * Math.SQRT2).toFixed(2)} mm diagonal)`, angle: `${s.angle}°` }) });
  return layered({ id: floral ? 'auxetic-floral' : 'auxetic-star', name: floral ? 'Floral re-entrant · study' : 'Star re-entrant', file: floral ? 'auxetic-floral' : 'auxetic-star', c, shelf: floral ? 'experimental' : 'flat', family: 'cells', support: 'self', state: 'untested', sources: { papers: [27], notes: ['Reconstruction from Figures 1 and 4; source CAD is not supplied.'] },
    blurb: floral ? 'Curved-arm reconstruction for comparison' : 'Four-point re-entrant stars joined at their corners',
    about: floral ? 'Kabir 2025 shows curved floral arms but supplies neither spline control points nor CAD. This is an experimental curved-arm interpolation, not an exact replication; its angle is a shape parameter and cannot inherit the paper\'s measured response.' : 'Reconstructed from Kabir 2025 Figures 1 and 4: four square-corner tips with inward notches. The default square diagonal is approximately 15.24 mm. Thin corner contacts and auxetic response require physical testing.',
    joins: 'Neighbouring re-entrant cells share their corner junctions in one plane.',
    controls: [{ kind: 'size', title: 'Size and shape' }, { kind: 'sliders', title: 'Look and feel', items: [slider('cell', 'Cell side'), slider('angle', floral ? 'Curve shape angle' : 'Arm angle', '°')] }],
    singleLine: true, build: (s, boundary) => ({ layers: reentrantStarLayers(boundary, { ...s, floral }), extra: { flat: true, transform: joinedPlane } }), summary: () => `${floral ? 'curved floral' : 'straight star'} re-entrant cells`,
  });
})];
