import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/** Four roles are shown instead of six move classes: what people care about is what hangs in the air. */
export const ROLES = ['base', 'anchored', 'lifting', 'free'];
const ROLE_OF = { base: 'base', supported: 'anchored', rising: 'lifting', falling: 'lifting', unsupported: 'free' };

/** Strand widths in mm for the true-thickness layer: base 0.45; free strands about 0.49 once foamed. */
export const STRAND_WIDTH = { base: 0.45, anchored: 0.45, lifting: 0.49, free: 0.49 };

// Roles also differ in lightness, not only hue, so they survive colour-vision differences.
const PALETTES = {
  light: {
    base: 0x27366b, anchored: 0x1f8179, lifting: 0xb87400, free: 0xb0316f,
    centreline: 0x12161e, travel: 0x566074, hop: 0xa04b00, violation: 0xd32f2f, bed: 0x9aa3b2, sample: 0x34469a,
  },
  dark: {
    base: 0x8fa6f5, anchored: 0x4fc3b8, lifting: 0xe8b04a, free: 0xf07ab0,
    centreline: 0xf2f3f0, travel: 0x9aa4b5, hop: 0xffa060, violation: 0xff6b6b, bed: 0x5b6577, sample: 0x7ba3ff,
  },
};

function countBelow(sorted, k) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < k) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function createPreview(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.replaceChildren(renderer.domElement);
  renderer.domElement.style.display = 'block';
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;

  const world = new THREE.Group();
  scene.add(world);

  const state = {
    result: null,
    objects: [],
    thin: {}, fat: {}, buckets: {}, travel: null, hops: null, violations: null,
    roleVisible: { base: true, anchored: true, lifting: true, free: true },
    layers: { path: true, strand: false, travel: false, hops: false },
    showViolations: false,
    exaggerate: true,
    moveIndex: Infinity,
    camera: 'angled',
    framedFor: '',
  };

  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const palette = () => (dark && dark.matches ? PALETTES.dark : PALETTES.light);

  const materials = [];
  function resize() {
    const w = Math.max(container.clientWidth, 60);
    const h = Math.max(container.clientHeight, 60);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const m of materials) m.resolution.set(w, h);
  }
  new ResizeObserver(resize).observe(container);

  function clear() {
    for (const o of state.objects) {
      world.remove(o);
      o.geometry?.dispose();
      const mat = o.material;
      if (mat) mat.dispose();
    }
    state.objects = [];
    materials.length = 0;
    state.thin = {}; state.fat = {}; state.buckets = {};
    state.travel = state.hops = state.violations = null;
  }

  function add(object) {
    world.add(object);
    state.objects.push(object);
    return object;
  }

  function rectangle(x0, y0, x1, y1, color) {
    const pts = [x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
  }

  function build(result) {
    clear();
    const pal = palette();
    const { moves, cfg } = result;
    const buckets = { base: { pos: [], idx: [] }, anchored: { pos: [], idx: [] }, lifting: { pos: [], idx: [] }, free: { pos: [], idx: [] } };
    const travel = { pos: [], idx: [] };
    const hops = { pos: [], idx: [] };
    const viol = { pos: [], idx: [] };
    for (let i = 1; i < moves.length; i++) {
      const a = moves[i - 1], b = moves[i];
      if (b.extrude) {
        const bk = buckets[ROLE_OF[b.cls]];
        bk.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        bk.idx.push(i);
      } else {
        const t = Math.hypot(b.x - a.x, b.y - a.y) > 1e-6 ? travel : hops;
        t.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        t.idx.push(i);
      }
      if (b.violation) { viol.pos.push(b.x, b.y, b.z); viol.idx.push(i); }
    }
    state.buckets = { ...buckets, travel, hops, viol };

    const centreline = state.layers.strand;
    for (const role of ROLES) {
      const { pos } = buckets[role];
      // thin path line (the exact nozzle route)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const thin = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: centreline ? pal.centreline : pal[role] }));
      state.thin[role] = add(thin);
      // strand at true width, in millimetres
      const sg = new LineSegmentsGeometry();
      if (pos.length) sg.setPositions(pos);
      const sm = new LineMaterial({ color: pal[role], linewidth: STRAND_WIDTH[role], worldUnits: true });
      materials.push(sm);
      state.fat[role] = add(new LineSegments2(sg, sm));
    }

    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(travel.pos, 3));
    state.travel = add(new THREE.LineSegments(tg, new THREE.LineDashedMaterial({ color: pal.travel, dashSize: 2, gapSize: 1.5 })));
    state.travel.computeLineDistances();

    const hg = new LineSegmentsGeometry();
    if (hops.pos.length) hg.setPositions(hops.pos);
    const hm = new LineMaterial({ color: pal.hop, linewidth: 2.5, worldUnits: false });
    materials.push(hm);
    state.hops = add(new LineSegments2(hg, hm));

    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.Float32BufferAttribute(viol.pos, 3));
    state.violations = add(new THREE.Points(vg, new THREE.PointsMaterial({ color: pal.violation, size: 4, sizeAttenuation: false })));

    const o = cfg.derived.origin;
    const bed = cfg.machine.bed;
    add(rectangle(-o.x, -o.y, bed.width - o.x, bed.depth - o.y, pal.bed));
    add(rectangle(0, 0, cfg.t.sample_width, cfg.t.sample_height, pal.sample));
    resize();
  }

  function applyVisibility() {
    for (const role of ROLES) {
      const on = state.roleVisible[role] && state.buckets[role]?.idx.length > 0;
      if (state.thin[role]) state.thin[role].visible = on && state.layers.path;
      if (state.fat[role]) state.fat[role].visible = on && state.layers.strand;
    }
    if (state.travel) state.travel.visible = state.layers.travel && state.buckets.travel.idx.length > 0;
    if (state.hops) state.hops.visible = state.layers.hops && state.buckets.hops.idx.length > 0;
    if (state.violations) state.violations.visible = state.showViolations;
    world.scale.z = state.exaggerate ? 2.5 : 1;
  }

  function applyRange() {
    const k = state.moveIndex;
    for (const role of ROLES) {
      const n = countBelow(state.buckets[role].idx, k);
      state.thin[role].geometry.setDrawRange(0, n * 2);
      state.fat[role].geometry.instanceCount = n;
    }
    state.travel.geometry.setDrawRange(0, countBelow(state.buckets.travel.idx, k) * 2);
    state.hops.geometry.instanceCount = countBelow(state.buckets.hops.idx, k);
    state.violations.geometry.setDrawRange(0, countBelow(state.buckets.viol.idx, k));
  }

  function frame(force) {
    const { cfg } = state.result;
    const key = `${cfg.t.sample_width}x${cfg.t.sample_height}:${state.camera}`;
    if (!force && state.framedFor === key) return;
    const w = cfg.t.sample_width, h = cfg.t.sample_height;
    const size = Math.max(w, h);
    const cx = w / 2, cy = h / 2;
    controls.target.set(cx, cy, 2);
    // distance that fits the swatch's bounding sphere in the vertical field of view, with some air
    const radius = Math.hypot(w, h) / 2 + 4;
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.05;
    const dir = state.camera === 'top' ? [0, -0.01, 1] : state.camera === 'side' ? [0, -1, 0.1] : [0, -0.72, 0.69];
    const len = Math.hypot(...dir);
    camera.position.set(cx + (dir[0] / len) * distance, cy + (dir[1] / len) * distance, 2 + (dir[2] / len) * distance);
    controls.update();
    state.framedFor = key;
  }

  function update(result) {
    state.result = result;
    build(result);
    applyVisibility();
    applyRange();
    frame(false);
  }

  dark?.addEventListener?.('change', () => {
    if (state.result) { build(state.result); applyVisibility(); applyRange(); }
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  resize();

  return {
    update,
    setCamera(name) { state.camera = name; if (state.result) frame(true); },
    setLayers(layers) { state.layers = { ...state.layers, ...layers }; if (state.result) { build(state.result); applyVisibility(); applyRange(); } },
    setRoles(roles) { state.roleVisible = { ...state.roleVisible, ...roles }; applyVisibility(); },
    setShowViolations(on) { state.showViolations = on; applyVisibility(); },
    setExaggerate(on) { state.exaggerate = on; applyVisibility(); },
    /** Show everything printed before move number k. */
    setMoveIndex(k) { state.moveIndex = k; if (state.result) applyRange(); },
    dispose() { renderer.setAnimationLoop(null); clear(); renderer.dispose(); },
  };
}
