// Deliberately independent of the drawing parser and UI: no artwork, filenames, profile names or person identifiers.
export const STUDY_NOTICE_VERSION = '2026-10-15';
export const STUDY_DESIGNS = ['loop-pile', 'squiggle', 'coil', 'weave', 'spiral', 'boucle', 'relief', 'fringe', 'zigzag', 'svgdesign', 'crosshatch', 'auxetic', 'dipweave', 'web', 'chainmail', 'meander', 'harmonograph', 'truchet', 'voronoi', 'turing', 'conformal', 'sunflower', 'rosette', 'flowlines', 'bubbles', 'parquet', 'spirograph', 'starlattice', 'halftone', 'spacer', 'pillarweave'];
const TYPES = ['gcode-swatch', 'gcode-panel', 'settings-json', 'build-error'];
const ERROR_CODES = ['crossing-limit', 'move-limit', 'bed-fit', 'invalid-settings', 'empty-geometry', 'unknown-build-error'];
const KEYS = new Set('a airFlow amplitude angle arms b backing backing1Angle backing1Pattern backing1Spacing backing2Angle backing2Pattern backing2Spacing backingArea backingDepth backingLayers backingLength baseGap bend binding block cell colorChange curve customHeight customWidth depth designAngle designPattern designSpacing directions edgeLoops every feature flow height hub hubStyle layers length lift link lobes loop loopSize loopSpacing map mode pattern patternScale period phase pileHeight pitch radius ratio relax relief roomy rowGap rowOverlap rowPitch scale second seed shape size spacing spokes swatch thick thin tile tiling tooth turn twist variation warpPitch wavelength weftPitch width'.split(' '));
const CATEGORIES = new Set('0-60-120 0-90 45-135 60-120 adaptive aligned archimedean arcs basket both box brick bumps chevron circuitBoard complement concentric crepe cross cubic custom deepSpiral diagonals diamond diamondGrid dipole every figure8 fill full gosper gradientX gradientY grid gyroid herringbone hexagon hexagonCells hilbert hole honeycomb honeycomb3d image inside kagome lightning lightningBolts line looped lotusPetals maze moore mountainPeaks nautilus noise none normals oceanWaves octagon octagram one open outline parallel pattern peano plain rectilinear reentrant ring same satin shape sierpinski solid square stars straight stripes support swatch swirl triangles tribalFeathers tsp twill21 twill22 twin two uniform vortices wave waves zigzag centerSpot'.split(' '));
const number = (v, min = 0, max = 1e9) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const numeric = (raw, keys) => Object.fromEntries(keys.filter((key) => number(raw?.[key])).map((key) => [key, raw[key]]));

/** A strict allowlist, used again by the server even if a caller bypasses the client. */
export function sanitizeStudyRecord(raw) {
  if (!raw || raw.noticeVersion !== STUDY_NOTICE_VERSION || typeof raw.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.eventId) || !STUDY_DESIGNS.includes(raw.design) || !TYPES.includes(raw.exportType)) return null;
  const { width, height } = raw.dimensions ?? {};
  if (!number(width, 0.001, 5000) || !number(height, 0.001, 5000)) return null;
  const p = raw.properties ?? {}, settings = {};
  if (raw.exportType === 'build-error' && !ERROR_CODES.includes(p.error?.code)) return null;
  for (const [key, value] of Object.entries(p.settings ?? {})) {
    if (!KEYS.has(key)) continue;
    if (typeof value === 'boolean' || number(value, -1e7, 1e7) || (typeof value === 'string' && CATEGORIES.has(value))) settings[key] = value;
  }
  return {
    schemaVersion: 1, noticeVersion: STUDY_NOTICE_VERSION, eventId: raw.eventId.toLowerCase(),
    design: raw.design, exportType: raw.exportType, dimensions: { width, height },
    properties: {
      settings,
      print: numeric(p.print, ['layerHeight', 'layers', 'extraLayers', 'nativeLayers', 'totalLayers', 'backingLayers', 'totalBackingLayers', 'brim', 'nozzleDiameter', 'extrusionWidth']),
      metrics: numeric(p.metrics, ['timeSec', 'filamentMm', 'moves']),
      sources: { svg: p.sources?.svg === true, image: p.sources?.image === true, ...numeric(p.sources, ['svgPaths', 'svgPoints', 'svgGuides']) },
      panel: numeric(p.panel, ['repeat', 'backingSpacing']),
      ...(raw.exportType === 'build-error' ? { error: { code: p.error.code, ...numeric(p.error, ['limit', 'observed']) } } : {}),
    },
  };
}

export const studyEnabled = (env) => env?.STUDY_ENABLED === 'true' && !!env.STUDY_DB;
