// The design registry: one entry per card in the left column. Pure data and functions (no DOM), so it is tested
// in Node and shared by the studio, the share-link sanitiser and the exporter.
//
// A module is { id, name, blurb, file, status: 'ready' | 'planned', roles, defaults(), sanitize(raw), legacy? }.
//   file      prefix of the exported G-code file name
//   roles     what each preview role is called in this design's legend (base, anchored, lifting, free)
//   legacy    the loop pile and squiggle keep their hand-written panels and their own state keys
//             (`primary`, `squiggle`); newer designs keep their state under `designs[id]`
//   planned   a placeholder tile: visible, not selectable
import { PRIMARY_DEFAULTS, sanitizePrimary } from './controls.js';
import { SQUIGGLE_DEFAULTS, sanitizeSquiggle } from './squiggle-controls.js';

export const DESIGNS = [
  {
    id: 'loop-pile',
    name: 'Loop pile',
    blurb: 'Soft raised loops on an open base',
    file: 'looppile',
    status: 'ready',
    legacy: true,
    roles: { base: 'Base', anchored: 'Anchored feet', lifting: 'Rising and falling', free: 'Free-hanging' },
    defaults: () => ({ ...PRIMARY_DEFAULTS }),
    sanitize: sanitizePrimary,
  },
  {
    id: 'squiggle',
    name: 'Squiggle & Gyroid',
    blurb: 'Two wavy layers that lock together',
    file: 'squiggle',
    status: 'ready',
    legacy: true,
    roles: { base: 'Layer 1', anchored: 'Layer 2' },
    defaults: () => ({ ...SQUIGGLE_DEFAULTS }),
    sanitize: sanitizeSquiggle,
  },
];

const BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

export const designById = (id) => BY_ID.get(id);
export const READY_IDS = Object.freeze(DESIGNS.filter((d) => d.status === 'ready').map((d) => d.id));
export const isReady = (id) => READY_IDS.includes(id);
