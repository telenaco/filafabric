import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { airStrandDiameter } from '../engine/extrusion.js';

/** Four roles are shown instead of six move classes: what people care about is what hangs in the air. */
export const ROLES = ['base', 'anchored', 'lifting', 'free'];
const ROLE_OF = { base: 'base', supported: 'anchored', rising: 'lifting', falling: 'lifting', unsupported: 'free' };

/**
 * Strand widths in mm for the true-thickness layer: the base and feet at the extrusion width, strands in the air
 * at their foamed diameter including any extra flow (about 0.49 mm on a 0.4 mm nozzle at standard flow).
 */
export function strandWidths(cfg) {
  return {
    base: cfg.t.extrusion_width,
    anchored: cfg.t.extrusion_width,
    lifting: airStrandDiameter('rising', cfg),
    free: airStrandDiameter('unsupported', cfg),
  };
}

// Roles also differ in lightness, not only hue, so they survive colour-vision differences.
const PALETTES = {
  light: {
    base: 0x27366b, anchored: 0x1f8179, lifting: 0xb87400, free: 0xb0316f,
    centreline: 0x12161e, travel: 0x566074, hop: 0xa04b00, violation: 0xd32f2f, bed: 0xd3d7de, sample: 0x34469a,
  },
  dark: {
    base: 0x8fa6f5, anchored: 0x4fc3b8, lifting: 0xe8b04a, free: 0xf07ab0,
    centreline: 0xf2f3f0, travel: 0x9aa4b5, hop: 0xffa060, violation: 0xff6b6b, bed: 0x2f3746, sample: 0x7ba3ff,
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
    // Open on what the fabric will look like: strands at their true thickness, at true scale.
    layers: { path: false, strand: true, travel: false, hops: false },
    showViolations: false,
    exaggerate: false,
    moveIndex: Infinity,
    camera: 'angled',
    framedFor: '',
    extent: null, // bounding box of everything printed: loops can reach past the swatch edge
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
        // flow within 10% of nominal draws at the role's width; any other flow is drawn in quarter steps
        const flow = b.flow !== undefined && Math.abs(b.flow - 1) >= 0.1 ? Math.max(0.25, Math.round(b.flow * 4) / 4) : 1;
        const key = flow === 1 ? ROLE_OF[b.cls] : `${ROLE_OF[b.cls]}@${flow}`;
        const bk = (buckets[key] ??= { pos: [], idx: [] });
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
    const [documentWidth, documentHeight] = result.documentSize ?? [cfg.t.sample_width, cfg.t.sample_height];
    const ext = { minX: 0, minY: 0, maxX: documentWidth, maxY: documentHeight };
    for (const m of moves) {
      if (!m.extrude) continue;
      if (m.x < ext.minX) ext.minX = m.x;
      if (m.x > ext.maxX) ext.maxX = m.x;
      if (m.y < ext.minY) ext.minY = m.y;
      if (m.y > ext.maxY) ext.maxY = m.y;
    }
    state.extent = ext;

    const centreline = state.layers.strand;
    const widths = strandWidths(cfg);
    for (const key of Object.keys(buckets)) {
      const [role, flowText] = key.split('@');
      const flow = flowText ? Number(flowText) : 1;
      // flat strands widen with flow; strands in the air grow as the square root of the volume
      const width = widths[role] * (role === 'base' || role === 'anchored' ? flow : Math.sqrt(flow));
      const { pos } = buckets[key];
      // thin path line (the exact nozzle route)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const thin = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: centreline ? pal.centreline : pal[role] }));
      state.thin[key] = add(thin);
      // strand at true width, in millimetres
      const sg = new LineSegmentsGeometry();
      if (pos.length) sg.setPositions(pos);
      const sm = new LineMaterial({ color: pal[role], linewidth: width, worldUnits: true });
      materials.push(sm);
      state.fat[key] = add(new LineSegments2(sg, sm));
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
    const bed = result.documentSize ? { width: documentWidth, depth: documentHeight } : cfg.machine.bed;
    // the bed as a faint plane rather than an outline, so its far edges never cut across the view
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(bed.width, bed.depth),
      new THREE.MeshBasicMaterial({ color: pal.bed, transparent: true, opacity: 0.3, depthWrite: false })
    );
    plate.position.set(bed.width / 2 - (result.documentSize ? 0 : o.x), bed.depth / 2 - (result.documentSize ? 0 : o.y), -0.05);
    add(plate);
    if (result.documentSize) add(rectangle(0, 0, documentWidth, documentHeight, pal.sample));
    if (result.outline) {
      for (const ring of result.outline) {
        const pts = [];
        ring.forEach((p, i) => {
          const q = ring[(i + 1) % ring.length];
          pts.push(p.x, p.y, 0, q.x, q.y, 0);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: pal.sample })));
      }
    } else {
      add(rectangle(0, 0, cfg.t.sample_width, cfg.t.sample_height, pal.sample));
    }
    resize();
  }

  function applyVisibility() {
    for (const key of Object.keys(state.thin)) {
      const on = state.roleVisible[key.split('@')[0]] && state.buckets[key]?.idx.length > 0;
      if (state.thin[key]) state.thin[key].visible = on && state.layers.path;
      if (state.fat[key]) state.fat[key].visible = on && state.layers.strand;
    }
    if (state.travel) state.travel.visible = state.layers.travel && state.buckets.travel.idx.length > 0;
    if (state.hops) state.hops.visible = state.layers.hops && state.buckets.hops.idx.length > 0;
    if (state.violations) state.violations.visible = state.showViolations;
    world.scale.z = state.exaggerate ? 2.5 : 1;
  }

  function applyRange() {
    const k = state.moveIndex;
    for (const key of Object.keys(state.thin)) {
      const n = countBelow(state.buckets[key].idx, k);
      state.thin[key].geometry.setDrawRange(0, n * 2);
      state.fat[key].geometry.instanceCount = n;
    }
    state.travel.geometry.setDrawRange(0, countBelow(state.buckets.travel.idx, k) * 2);
    state.hops.geometry.instanceCount = countBelow(state.buckets.hops.idx, k);
    state.violations.geometry.setDrawRange(0, countBelow(state.buckets.viol.idx, k));
  }

  function frame(force) {
    const e = state.extent;
    const key = `${e.minX.toFixed(1)},${e.minY.toFixed(1)},${e.maxX.toFixed(1)},${e.maxY.toFixed(1)}:${state.camera}`;
    if (!force && state.framedFor === key) return;
    const w = e.maxX - e.minX, h = e.maxY - e.minY;
    const cx = (e.minX + e.maxX) / 2, cy = (e.minY + e.maxY) / 2;
    controls.target.set(cx, cy, 2);
    // distance that fits the swatch's bounding sphere in the vertical field of view, with a little air
    const radius = Math.hypot(w, h) / 2 + 2;
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.92;
    // 'angled' is a three-quarter view from the front right, so rows and loop heights both read
    const dir = state.camera === 'top' ? [0, -0.01, 1] : state.camera === 'side' ? [0, -1, 0.12] : [0.42, -0.78, 0.62];
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
    /** Roles that have at least one move in the current result, in legend order. */
    presentRoles() { return ROLES.filter((role) => Object.keys(state.buckets).some((key) => key.split('@')[0] === role && state.buckets[key].idx?.length > 0)); },
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
