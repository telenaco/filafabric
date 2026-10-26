/** Generate an alternate on H × W, with the original boundary rotated inversely into that coordinate system. */
export function rotateDesignInput(input) {
  const { width, height } = input;
  const turn = (p, w = width) => ({ ...p, x: p.y, y: w - p.x });
  const out = { ...input, width: height, height: width,
    machine: { ...input.machine, bed: { ...input.machine.bed, width: input.machine.bed.depth, depth: input.machine.bed.width } },
    outline: input.outline?.map((ring) => ring.map((p) => turn(p))),
  };
  if (input.vector) {
    const vector = input.vector, [fw, fh] = input.vectorSize ?? [width, height];
    const sx = fw / vector.width, sy = fh / vector.height;
    out.vector = { ...vector, width: fh, height: fw,
      paths: vector.paths.map((path) => path.map((p) => turn({ ...p, x: p.x * sx, y: p.y * sy }, fw))),
      styles: vector.styles?.map((s) => ({ ...s, ...(s.width !== undefined ? { width: s.width * Math.sqrt(sx * sy) } : {}) })),
    };
    const [ox, oy] = input.vectorOffset ?? [0, 0];
    out.vectorSize = [fh, fw]; out.vectorOffset = [oy, fw - ox - width];
  }
  return out;
}
