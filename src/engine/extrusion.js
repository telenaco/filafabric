export const EXTRUDING = new Set(['base', 'supported', 'rising', 'falling', 'unsupported']);

export const filamentArea = (d) => Math.PI * (d / 2) ** 2;
export const roundArea = (d) => Math.PI * (d / 2) ** 2;
/** PrusaSlicer's rounded-rectangle strand model: h * (w - h * (1 - pi/4)). */
export const roundedRectArea = (w, h) => h * (w - h * (1 - Math.PI / 4));

export function strandArea(cls, cfg) {
  if (cls === 'base' || cls === 'supported') return roundedRectArea(cfg.t.extrusion_width, cfg.t.layer_height);
  return roundArea(cfg.derived.freeDiameter);
}

/**
 * Extra flow for strands in the air, as a factor (1 = nominal). Rising and falling legs use `flow_nonplanar`,
 * free-hanging spans `flow_unsupported`; the base and the anchored feet always print at nominal flow.
 */
export function classFlow(cls, t) {
  if (cls === 'rising' || cls === 'falling') return t.flow_nonplanar / 100;
  if (cls === 'unsupported') return t.flow_unsupported / 100;
  return 1;
}

/** Actual deposited volume per mm of path (after the material's flow multiplier and any extra flow in the air). */
export function volumePerMm(cls, cfg) {
  return strandArea(cls, cfg) * cfg.derived.multiplier * classFlow(cls, cfg.t);
}

/**
 * Expected diameter (mm) of a strand in the air once it has foamed: a round strand at the free diameter,
 * grown by the material's foam expansion and by any extra flow. Used by the clearance model and the preview.
 */
export function airStrandDiameter(cls, cfg) {
  const foam = Math.max(cfg.material.flow.foam_expansion ?? 1, 1);
  return cfg.derived.freeDiameter * Math.sqrt(foam * classFlow(cls, cfg.t));
}

/** Filament length (mm, relative E) for a move of 3D length `ds`. */
export function segmentE(ds, cls, cfg) {
  return (ds * volumePerMm(cls, cfg)) / filamentArea(cfg.derived.filamentDiameter);
}

export function classTargetSpeed(cls, t) {
  switch (cls) {
    case 'base': return t.speed_base;
    case 'supported': return t.speed_supported;
    case 'rising':
    case 'falling': return t.speed_nonplanar;
    case 'unsupported': return t.speed_unsupported;
    case 'travel': return t.speed_travel;
    default: throw new Error(`Unknown move class: ${cls}`);
  }
}

/** Linear speed (mm/s along the 3D vector) after all clamps. */
export function moveSpeed(cls, dx, dy, dz, cfg) {
  const ds = Math.hypot(dx, dy, dz);
  let v = classTargetSpeed(cls, cfg.t);
  if (ds === 0) return v;
  const lim = cfg.derived.limits.max_feedrate;
  const cap = (limit, component) => {
    if (component > 1e-12) v = Math.min(v, (limit * ds) / component);
  };
  cap(lim.x, Math.abs(dx));
  cap(lim.y, Math.abs(dy));
  cap(lim.z, Math.abs(dz));
  if (EXTRUDING.has(cls)) {
    const vol = volumePerMm(cls, cfg);
    v = Math.min(v, cfg.derived.maxVolActual / vol);
    v = Math.min(v, (lim.e * filamentArea(cfg.derived.filamentDiameter)) / vol);
  }
  return v;
}
