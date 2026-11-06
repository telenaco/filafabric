/** Seeded PRNG (mulberry32). Same seed => same sequence, on every platform. */
export function createRng(seed) {
  let a = Number(seed) >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    symmetric(amp) {
      return (next() * 2 - 1) * amp;
    },
  };
}
