/**
 * Geometry findings a card makes on purpose. The suite holds every ready card at its defaults to one connected fabric region and
 * a slope of at most 25 degrees; these research structures cannot meet both by construction, and say so here, with the reason,
 * instead of being quietly loosened. Keys: `regions` (separate fabric regions) and `slope` (extrusion slope over the planning limit).
 */
export const BY_DESIGN = Object.freeze({
  'grid-sliding': {
    regions: 'The two directions are held by printed channels, not fused, so the contact check counts them as separate regions; that is how the structure slides.',
    slope: "Li's channel legs rise 2 mm over 1.7 mm; the steepness is part of the published geometry.",
  },
  'colour-exposure': {
    regions: 'Where the picture is light the upper family stands up to the exposure height above the lower one and touches it less; the loose regions are the effect.',
  },
});
export const isByDesign = (id, kind) => Boolean(BY_DESIGN[id]?.[kind]);
