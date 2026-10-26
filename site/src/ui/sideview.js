// Inline SVG drawing for the measured side profile, shared by card strips and panel headers.

const ROLE = { native: 'var(--role-base)', motif: 'var(--role-base)', carrier: 'var(--muted)', tie: 'var(--role-lifting)', channel: 'var(--accent)' };

/**
 * Draws side-profile samples as bead marks.
 * @param {Array} profile Samples from sideProfile.
 * @param {{width:number,height:number,exaggerate?:number,compact?:boolean,bead?:number}} options SVG dimensions and display scale.
 * @returns {string} Inline SVG markup.
 */
export function drawSideView(profile, { width, height, exaggerate = 5, compact = false, bead = 0.45 } = {}) {
  if (!profile?.length || !(width > 0) || !(height > 0)) return '';
  const minS = Math.min(...profile.map((p) => p.s)), maxS = Math.max(...profile.map((p) => p.s));
  const minZ = Math.min(...profile.map((p) => p.z)), maxZ = Math.max(...profile.map((p) => p.z));
  const pad = compact ? 1 : 5, plotH = height - pad * 2 - (compact ? 0 : 12), plotW = width - pad * 2;
  const sx = (s) => pad + (maxS === minS ? plotW / 2 : (s - minS) / (maxS - minS) * plotW);
  const sy = (z) => height - pad - (compact ? 0 : 12) - (maxZ === minZ ? plotH / 2 : (z - minZ) / (maxZ - minZ) * plotH);
  const diameter = Math.max(1, Math.min(5, bead * exaggerate));
  const marks = profile.map((p) => `<circle cx="${sx(p.s).toFixed(2)}" cy="${sy(p.z).toFixed(2)}" r="${(diameter / 2).toFixed(2)}" fill="${ROLE[p.role] ?? ROLE.native}"${p.role === 'tie' ? ' stroke="currentColor" stroke-dasharray="1 1"' : ''}/>`).join('');
  return `<svg class="side-view${compact ? ' compact' : ''}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Side view, height exaggerated ${exaggerate} times">${marks}${compact ? '' : `<text x="${pad}" y="${height - 1}" class="side-view-label">height × ${exaggerate}</text>`}</svg>`;
}
