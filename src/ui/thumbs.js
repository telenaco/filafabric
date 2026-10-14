// Tile thumbnails for the design column, as SVG strings keyed by design id. Static markup, no user input.
// Colours come from the preview role variables so they follow light and dark themes.

import { lanePoints } from '../engine/shapes.js';

/** An SVG path for one strand shape along a lane (mm in the design's own units), at x0, y0. */
function lanePath(shape, x0, y0, length, pitch, size) {
  const pts = lanePoints({ shape, length, pitch, size, step: 0.8 });
  return pts.map((p, i) => `${i ? 'L' : 'M'}${(x0 + p.u).toFixed(1)} ${(y0 + p.v).toFixed(1)}`).join('');
}

/** A 48 x 28 picture of a strand shape, for the shape picker. */
export function shapeThumb(shape) {
  return `<svg class="shape-thumb" width="48" height="28" viewBox="0 0 48 28" fill="none" aria-hidden="true"><path d="${lanePath(shape, 2, 14, 44, 11, 5.5)}" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const coilRows = [20, 38, 56, 74]
  .map((y, k) => `<path d="${lanePath('looped', 10, y, 140, 22, 11)}" stroke="var(--role-${k % 2 ? 'anchored' : 'base'})"/>`)
  .join('');

export const THUMBS = {
  coil: `<svg class="design-thumb" viewBox="0 0 160 96" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${coilRows}</svg>`,
  'loop-pile': `<svg class="design-thumb" viewBox="0 0 160 96" fill="none" aria-hidden="true">
  <g stroke="var(--role-base)" stroke-width="1.4" opacity="0.65"><path d="M8 88H152M8 76H152M8 64H152"/></g>
  <g stroke="var(--role-free)" stroke-width="2.2" stroke-linecap="round">
    <path d="M18 52C18 32 34 32 34 52M28 52C28 32 44 32 44 52M38 52C38 32 54 32 54 52M48 52C48 32 64 32 64 52M58 52C58 32 74 32 74 52M68 52C68 32 84 32 84 52M78 52C78 32 94 32 94 52M88 52C88 32 104 32 104 52M98 52C98 32 114 32 114 52M108 52C108 32 124 32 124 52M118 52C118 32 134 32 134 52" opacity="0.4"/>
    <path d="M24 68C24 42 42 42 42 68M34 68C34 42 52 42 52 68M44 68C44 42 62 42 62 68M54 68C54 42 72 42 72 68M64 68C64 42 82 42 82 68M74 68C74 42 92 42 92 68M84 68C84 42 102 42 102 68M94 68C94 42 112 42 112 68M104 68C104 42 122 42 122 68M114 68C114 42 132 42 132 68" opacity="0.7"/>
    <path d="M18 84C18 52 38 52 38 84M28 84C28 52 48 52 48 84M38 84C38 52 58 52 58 84M48 84C48 52 68 52 68 84M58 84C58 52 78 52 78 84M68 84C68 52 88 52 88 84M78 84C78 52 98 52 98 84M88 84C88 52 108 52 108 84M98 84C98 52 118 52 118 84M108 84C108 52 128 52 128 84M118 84C118 52 138 52 138 84"/>
  </g>
</svg>`,
  squiggle: `<svg class="design-thumb" viewBox="0 0 160 96" fill="none" stroke-linecap="round" aria-hidden="true">
  <path stroke="var(--role-base)" stroke-width="1.8" d="M22 8Q16.8 12 22 16T22 24T22 32T22 40T22 48T22 56T22 64T22 72T22 80T22 88M35 8Q40.2 12 35 16T35 24T35 32T35 40T35 48T35 56T35 64T35 72T35 80T35 88M48 8Q42.8 12 48 16T48 24T48 32T48 40T48 48T48 56T48 64T48 72T48 80T48 88M61 8Q66.2 12 61 16T61 24T61 32T61 40T61 48T61 56T61 64T61 72T61 80T61 88M74 8Q68.8 12 74 16T74 24T74 32T74 40T74 48T74 56T74 64T74 72T74 80T74 88M87 8Q92.2 12 87 16T87 24T87 32T87 40T87 48T87 56T87 64T87 72T87 80T87 88M100 8Q94.8 12 100 16T100 24T100 32T100 40T100 48T100 56T100 64T100 72T100 80T100 88M113 8Q118.2 12 113 16T113 24T113 32T113 40T113 48T113 56T113 64T113 72T113 80T113 88M126 8Q120.8 12 126 16T126 24T126 32T126 40T126 48T126 56T126 64T126 72T126 80T126 88M139 8Q144.2 12 139 16T139 24T139 32T139 40T139 48T139 56T139 64T139 72T139 80T139 88"/>
  <path stroke="var(--role-anchored)" stroke-width="1.8" d="M10 14Q15 19.2 20 14T30 14T40 14T50 14T60 14T70 14T80 14T90 14T100 14T110 14T120 14T130 14T140 14T150 14M10 26Q15 20.8 20 26T30 26T40 26T50 26T60 26T70 26T80 26T90 26T100 26T110 26T120 26T130 26T140 26T150 26M10 38Q15 43.2 20 38T30 38T40 38T50 38T60 38T70 38T80 38T90 38T100 38T110 38T120 38T130 38T140 38T150 38M10 50Q15 44.8 20 50T30 50T40 50T50 50T60 50T70 50T80 50T90 50T100 50T110 50T120 50T130 50T140 50T150 50M10 62Q15 67.2 20 62T30 62T40 62T50 62T60 62T70 62T80 62T90 62T100 62T110 62T120 62T130 62T140 62T150 62M10 74Q15 68.8 20 74T30 74T40 74T50 74T60 74T70 74T80 74T90 74T100 74T110 74T120 74T130 74T140 74T150 74M10 86Q15 91.2 20 86T30 86T40 86T50 86T60 86T70 86T80 86T90 86T100 86T110 86T120 86T130 86T140 86T150 86"/>
</svg>`,
};
