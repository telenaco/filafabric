import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CLASS_COLORS = {
  base: 0x4f7cff,
  supported: 0x22b573,
  rising: 0xf5a623,
  falling: 0xe8743b,
  unsupported: 0xd6336c,
  travel: 0x8a909a,
};

export function createPreview(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.replaceChildren(renderer.domElement);
  renderer.domElement.style.display = 'block';
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const world = new THREE.Group();
  scene.add(world);

  const state = {
    extrude: null, travel: null, violations: null, outlines: [],
    eCount: new Uint32Array(1), tCount: new Uint32Array(1),
    framedFor: '', showTravel: true, showViolations: false,
  };

  function resize() {
    const w = Math.max(container.clientWidth, 50);
    const h = Math.max(container.clientHeight, 50);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function discard(object) {
    if (!object) return;
    world.remove(object);
    object.geometry?.dispose();
    object.material?.dispose();
  }

  function segments(positions, colors) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }));
  }

  function rectangle(x0, y0, x1, y1, color) {
    const pts = [x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  }

  function update(result) {
    const { moves, cfg } = result;
    discard(state.extrude);
    discard(state.travel);
    discard(state.violations);
    state.outlines.forEach(discard);
    state.outlines = [];

    const ePos = [], eCol = [], tPos = [], tCol = [], vPos = [];
    const eCount = new Uint32Array(moves.length + 1);
    const tCount = new Uint32Array(moves.length + 1);
    const color = new THREE.Color();
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (i > 0) {
        const p = moves[i - 1];
        const target = m.extrude ? [ePos, eCol] : [tPos, tCol];
        target[0].push(p.x, p.y, p.z, m.x, m.y, m.z);
        color.setHex(CLASS_COLORS[m.cls] ?? 0xffffff);
        target[1].push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
      if (m.violation) vPos.push(m.x, m.y, m.z);
      eCount[i + 1] = ePos.length / 6;
      tCount[i + 1] = tPos.length / 6;
    }
    state.eCount = eCount;
    state.tCount = tCount;

    state.extrude = segments(ePos, eCol);
    state.travel = segments(tPos, tCol);
    state.travel.visible = state.showTravel;
    world.add(state.extrude, state.travel);

    if (vPos.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
      state.violations = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff0000, size: 1.0 }));
      state.violations.visible = state.showViolations;
      world.add(state.violations);
    } else {
      state.violations = null;
    }

    const o = cfg.derived.origin;
    const bed = cfg.machine.bed;
    state.outlines.push(rectangle(-o.x, -o.y, bed.width - o.x, bed.depth - o.y, 0x6b7280));
    state.outlines.push(rectangle(0, 0, cfg.t.sample_width, cfg.t.sample_height, 0x3b6df0));
    world.add(...state.outlines);

    const key = `${cfg.t.sample_width}x${cfg.t.sample_height}`;
    if (state.framedFor !== key) {
      const w = cfg.t.sample_width, h = cfg.t.sample_height;
      const size = Math.max(w, h);
      controls.target.set(w / 2, h / 2, 0);
      camera.position.set(w / 2, h / 2 - size * 1.4, size * 1.1);
      controls.update();
      state.framedFor = key;
    }
  }

  function setScrub(index) {
    const k = Math.max(0, Math.min(index, state.eCount.length - 1));
    if (state.extrude) state.extrude.geometry.setDrawRange(0, state.eCount[k] * 2);
    if (state.travel) state.travel.geometry.setDrawRange(0, state.tCount[k] * 2);
  }

  function setShowTravel(show) {
    state.showTravel = show;
    if (state.travel) state.travel.visible = show;
  }

  function setShowViolations(show) {
    state.showViolations = show;
    if (state.violations) state.violations.visible = show;
  }

  function setZScale(scale) {
    world.scale.z = scale;
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { update, setScrub, setShowTravel, setShowViolations, setZScale };
}
