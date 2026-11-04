// Torso teardown: splits the torso shell open and fans out the internal components.
// Everything here lives in the torso body's frame (MuJoCo: x forward, y left, z up, meters).
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const CUT_X = 0.008; // where the shell splits into front and back halves

// ---------- materials ----------
const M = {
  pcb: () => new THREE.MeshStandardMaterial({ color: 0x0f5c3a, roughness: 0.6, metalness: 0.1 }),
  pcbBlue: () => new THREE.MeshStandardMaterial({ color: 0x173a7a, roughness: 0.6, metalness: 0.1 }),
  chip: () => new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.3 }),
  alu: () => new THREE.MeshStandardMaterial({ color: 0xb8c2cf, roughness: 0.3, metalness: 0.85 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xc87533, roughness: 0.35, metalness: 0.9 }),
  cell: () => new THREE.MeshStandardMaterial({ color: 0x2b8cff, roughness: 0.35, metalness: 0.4 }),
  casing: () => new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }),
  red: () => new THREE.MeshStandardMaterial({ color: 0xe0303a, roughness: 0.4 }),
  yellow: () => new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.6, metalness: 0.2 }),
  cap: () => new THREE.MeshStandardMaterial({ color: 0x2b2f6a, roughness: 0.4, metalness: 0.5 }),
};

function box(w, d, h, mat, x = 0, y = 0, z = 0) {
  // w = size along x (depth), d = along y (width), h = along z (height)
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(r, h, mat, x = 0, y = 0, z = 0, axis = 'z', seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  return m;
}
// A flat circuit board lying in the y-z plane (facing ±x), with parts on its face.
function board(depthAxis, w, h, mat) {
  return depthAxis === 'x' ? box(0.003, w, h, mat) : box(w, h, 0.003, mat);
}

// ---------- component builders (each returns a Group centered at its origin) ----------
const build = {
  chassis() {
    const g = new THREE.Group();
    const alu = M.alu();
    for (const y of [-0.055, 0.055]) g.add(box(0.016, 0.016, 0.28, alu, -0.035, y, 0.14)); // rear rails
    for (const y of [-0.055, 0.055]) g.add(box(0.012, 0.012, 0.24, alu, 0.045, y, 0.15)); // front rails
    g.add(box(0.1, 0.19, 0.012, alu, 0.005, 0, 0.25)); // shoulder cross-plate
    g.add(box(0.1, 0.13, 0.01, alu, 0.005, 0, 0.12)); // mid shelf
    const flange = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 10, 32), alu);
    flange.position.set(0.005, 0, 0.012);
    g.add(flange); // waist mounting flange
    return g;
  },
  battery() {
    const g = new THREE.Group();
    g.add(box(0.08, 0.15, 0.085, M.casing()));
    const cellMat = M.cell();
    const strip = M.alu();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
      const x = -0.025 + i * 0.025, y = -0.0625 + j * 0.025;
      g.add(cyl(0.0105, 0.07, cellMat, x, y, 0));
    }
    for (let j = 0; j < 6; j++) g.add(box(0.07, 0.008, 0.002, strip, 0, -0.0625 + j * 0.025, 0.036)); // nickel strips
    g.add(box(0.02, 0.03, 0.012, M.red(), 0.0, 0.06, 0.048)); // connector
    return g;
  },
  bms() {
    const g = new THREE.Group();
    g.add(box(0.07, 0.12, 0.003, M.pcb()));
    g.add(box(0.016, 0.016, 0.004, M.chip(), 0, -0.03, 0.003));
    for (let k = 0; k < 4; k++) g.add(box(0.008, 0.012, 0.005, M.chip(), -0.02, 0.01 + k * 0.014, 0.003)); // MOSFETs
    g.add(box(0.004, 0.03, 0.003, M.copper(), 0.025, 0.03, 0.003)); // shunt
    return g;
  },
  pdb() {
    const g = new THREE.Group();
    g.add(board('x', 0.12, 0.07, M.pcbBlue()));
    const cu = M.copper();
    g.add(box(0.004, 0.1, 0.008, cu, 0.003, 0, 0.022));
    g.add(box(0.004, 0.1, 0.008, cu, 0.003, 0, -0.022));
    for (let k = 0; k < 3; k++) g.add(cyl(0.008, 0.02, M.cap(), 0.012, -0.035 + k * 0.035, 0, 'x'));
    for (let k = 0; k < 3; k++) g.add(box(0.008, 0.014, 0.014, M.chip(), 0.006, -0.035 + k * 0.035, -0.002 + 0.0)); // regulators
    g.add(box(0.006, 0.01, 0.006, M.yellow(), 0.004, 0.05, 0.01)); // fuse
    return g;
  },
  estop() {
    const g = new THREE.Group();
    g.add(board('x', 0.05, 0.04, M.pcb()));
    g.add(box(0.016, 0.022, 0.02, M.pcbBlue(), 0.01, -0.008, 0)); // relay
    g.add(cyl(0.012, 0.008, M.red(), -0.008, 0.016, 0.0, 'x')); // mushroom button (faces back)
    g.add(cyl(0.007, 0.01, M.yellow(), -0.002, 0.016, 0.0, 'x'));
    return g;
  },
  control_computer() {
    const g = new THREE.Group();
    g.add(board('x', 0.1, 0.07, M.pcb()));
    g.add(box(0.005, 0.03, 0.03, M.alu(), 0.004, -0.015, 0.008)); // CPU heat spreader
    g.add(box(0.004, 0.02, 0.01, M.chip(), 0.003, 0.025, 0.015)); // RAM
    g.add(box(0.004, 0.02, 0.01, M.chip(), 0.003, 0.025, -0.002));
    for (let k = 0; k < 3; k++) g.add(box(0.012, 0.014, 0.012, M.dark(), 0.007, -0.035 + k * 0.022, -0.026)); // ports
    return g;
  },
  ai_compute() {
    const g = new THREE.Group();
    g.add(box(0.09, 0.1, 0.003, M.pcb())); // carrier board
    g.add(box(0.045, 0.07, 0.006, M.pcbBlue(), 0.0, 0.0, 0.004)); // system-on-module
    const fin = M.alu();
    g.add(box(0.05, 0.075, 0.004, fin, 0, 0, 0.009));
    for (let k = 0; k < 9; k++) g.add(box(0.05, 0.0018, 0.02, fin, 0, -0.034 + k * 0.0085, 0.021)); // fins
    g.add(cyl(0.003, 0.08, M.copper(), 0.018, 0, 0.012, 'y')); // heat pipe
    for (let k = 0; k < 2; k++) g.add(box(0.012, 0.016, 0.01, M.dark(), -0.035, -0.03 + k * 0.06, 0.006)); // camera connectors
    return g;
  },
  accelerator() {
    const g = new THREE.Group();
    g.add(box(0.022, 0.08, 0.002, M.pcbBlue()));
    g.add(box(0.014, 0.014, 0.002, M.chip(), 0, -0.01, 0.002));
    g.add(box(0.012, 0.01, 0.0015, M.chip(), 0, 0.02, 0.002));
    g.add(box(0.02, 0.006, 0.003, M.copper(), 0, -0.038, 0)); // M.2 gold fingers
    return g;
  },
  cooling() {
    const g = new THREE.Group();
    const frame = M.dark();
    g.add(box(0.012, 0.06, 0.006, frame, 0, 0, 0.027));
    g.add(box(0.012, 0.06, 0.006, frame, 0, 0, -0.027));
    g.add(box(0.012, 0.006, 0.06, frame, 0, 0.027, 0));
    g.add(box(0.012, 0.006, 0.06, frame, 0, -0.027, 0));
    const rotor = new THREE.Group();
    rotor.add(cyl(0.01, 0.012, M.chip(), 0, 0, 0, 'x'));
    for (let k = 0; k < 7; k++) {
      const blade = box(0.002, 0.012, 0.022, M.chip(), 0, 0, 0.016);
      const pivot = new THREE.Group();
      blade.rotation.y = 0.35;
      pivot.add(blade);
      pivot.rotation.x = (k / 7) * Math.PI * 2;
      rotor.add(pivot);
    }
    rotor.userData.spin = true;
    g.add(rotor);
    return g;
  },
  imu() {
    const g = new THREE.Group();
    g.add(board('x', 0.026, 0.026, M.pcb()));
    g.add(box(0.003, 0.008, 0.008, M.chip(), 0.003, 0, 0));
    return g;
  },
  comms() {
    const g = new THREE.Group();
    g.add(box(0.06, 0.07, 0.003, M.pcb()));
    g.add(box(0.016, 0.016, 0.003, M.chip(), 0, -0.012, 0.003)); // switch chip
    for (let k = 0; k < 4; k++) g.add(box(0.012, 0.012, 0.01, M.dark(), -0.022, -0.026 + k * 0.017, 0.006)); // ports
    g.add(cyl(0.002, 0.05, M.dark(), 0.02, 0.03, 0.026, 'z')); // antenna
    return g;
  },
  harness() {
    const g = new THREE.Group();
    const power = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
    const data = new THREE.MeshStandardMaterial({ color: 0x2f8cff, roughness: 0.5 });
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const runs = [
      [power, [V(-0.045, 0, 0.16), V(-0.02, 0.04, 0.2), V(0.0, 0.085, 0.245)]], // to left shoulder
      [power, [V(-0.045, 0, 0.16), V(-0.02, -0.04, 0.2), V(0.0, -0.085, 0.245)]], // to right shoulder
      [power, [V(-0.045, 0, 0.14), V(-0.02, 0.0, 0.06), V(0.0, 0.0, 0.0)]], // down to waist
      [data, [V(0.0, 0.07, 0.24), V(0.01, 0.03, 0.27), V(0.01, 0.0, 0.31)]], // up to head
      [data, [V(0.0, 0.07, 0.24), V(0.02, 0.09, 0.25), V(0.004, 0.1, 0.248)]], // left arm data
      [data, [V(0.0, 0.07, 0.24), V(0.02, -0.06, 0.25), V(0.004, -0.1, 0.248)]], // right arm data
      [data, [V(0.03, 0.03, 0.18), V(0.02, 0.03, 0.08), V(0.008, 0.012, 0.0)]], // to legs
    ];
    for (const [mat, pts] of runs) {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0035, 8), mat));
    }
    return g;
  },
};

// Where each component sits inside the torso (home), and where it goes when the torso is opened (target).
// Targets form a labeled gallery in front of the robot.
const LAYOUT = {
  chassis:          { home: [0, 0, 0],            target: [0, 0, 0] },
  harness:          { home: [0, 0, 0],            target: [0, 0, 0] },
  // robot's right side (screen left from the front): power + sensing
  battery:          { home: [0.005, 0, 0.07],     target: [0.2, -0.25, -0.04] },
  bms:              { home: [0.005, 0, 0.118],    target: [0.2, -0.47, -0.04] },
  pdb:              { home: [-0.052, 0, 0.165],   target: [0.2, -0.25, 0.2] },
  estop:            { home: [-0.05, -0.06, 0.06], target: [0.2, -0.47, 0.2] },
  imu:              { home: [-0.04, -0.002, 0.148], target: [0.2, -0.25, 0.44] },
  cooling:          { home: [-0.058, 0.0, 0.225], target: [0.2, -0.47, 0.44] },
  // robot's left side (screen right): compute + comms
  ai_compute:       { home: [0.005, 0.0, 0.192],  target: [0.2, 0.25, 0.44] },
  accelerator:      { home: [0.03, -0.06, 0.22],  target: [0.2, 0.47, 0.44] },
  control_computer: { home: [0.055, 0, 0.17],     target: [0.2, 0.25, 0.2] },
  comms:            { home: [0.0, 0.07, 0.235],   target: [0.2, 0.47, 0.2] },
};
const OUT_SCALE = 1.6; // parts grow a bit once they're out, so the details are readable
const TILT = { battery: 0.6, bms: 1.0, ai_compute: 0.9, accelerator: 1.0, comms: 1.0 };
const ORDER = ['battery', 'bms', 'pdb', 'estop', 'imu', 'cooling', 'control_computer', 'comms', 'ai_compute', 'accelerator'];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function createTeardown(viewer, sim, torsoId) {
  const torsoGroup = viewer.bodies[torsoId];
  const root = new THREE.Group();
  root.visible = false;
  torsoGroup.add(root);
  viewer.renderer.localClippingEnabled = true;

  const pickables = [];
  const parts = {};

  function addLabel(obj, text) {
    const el = document.createElement('div');
    el.className = 'marker-label teardown';
    el.textContent = text;
    const l = new CSS2DObject(el);
    obj.add(l);
    return l;
  }
  function tag(group, key) {
    group.traverse((o) => { if (o.isMesh) { o.userData.teardownKey = key; pickables.push(o); } });
  }

  // Internal components
  for (const [key, lay] of Object.entries(LAYOUT)) {
    const g = build[key]();
    g.position.fromArray(lay.home);
    root.add(g);
    tag(g, key);
    parts[key] = { group: g, home: new THREE.Vector3(...lay.home), target: new THREE.Vector3(...lay.target) };
  }

  // Shell halves: clones of the torso + chest-panel meshes, each clipped at CUT_X.
  const shellMeshes = viewer.pickables.filter(
    (m) => m.userData.bodyId === torsoId && ['torso_link', 'logo_link'].includes(m.userData.meshName),
  );
  const halves = {};
  for (const [key, dir, offset] of [['shell_front', 1, [0.02, 0, 0.6]], ['shell_back', -1, [-0.3, 0, 0.12]]]) {
    const holder = new THREE.Group();
    const localPlane = new THREE.Plane(new THREE.Vector3(dir, 0, 0), -dir * CUT_X);
    const worldPlane = localPlane.clone();
    for (const src of shellMeshes) {
      const mat = src.material.clone();
      mat.clippingPlanes = [worldPlane];
      mat.side = THREE.DoubleSide;
      mat.opacity = 1;
      mat.transparent = false;
      mat.emissive = new THREE.Color(0);
      const m = new THREE.Mesh(src.geometry, mat);
      m.position.copy(src.position);
      m.quaternion.copy(src.quaternion);
      m.castShadow = true;
      holder.add(m);
    }
    root.add(holder);
    tag(holder, key);
    halves[key] = { holder, localPlane, worldPlane, offset: new THREE.Vector3(...offset) };
  }

  // Labels (shown once a part reaches its gallery spot)
  const labels = {};
  const names = {
    battery: 'Battery pack', bms: 'BMS', estop: 'E-stop circuit', pdb: 'Power distribution',
    imu: 'IMU board', control_computer: 'Real-time computer', ai_compute: 'AI compute module',
    accelerator: 'AI accelerator', cooling: 'Cooling fan', comms: 'Comms hub',
  };
  for (const k of ORDER) {
    labels[k] = addLabel(parts[k].group, names[k]);
    labels[k].position.set(0, 0, -0.06); // below the part (local units, before scaling)
  }
  labels.shell_front = addLabel(halves.shell_front.holder, 'Front cover');
  labels.shell_front.position.set(0.09, 0, 0.32);
  labels.shell_back = addLabel(halves.shell_back.holder, 'Back cover');
  labels.shell_back.position.set(-0.08, 0, 0.32);
  labels.chassis = addLabel(parts.chassis.group, 'Chassis + wiring');
  labels.chassis.position.set(-0.04, 0.12, 0.29);

  let progress = 0, active = false, highlighted = null;
  const tmp = new THREE.Vector3();

  function apply() {
    // Stage 1 (0 → 0.35): the shell opens. Stage 2 (0.25 → 1): components fan out, one after another.
    const shellT = smooth(clamp01(progress / 0.35));
    for (const h of Object.values(halves)) h.holder.position.copy(h.offset).multiplyScalar(shellT);
    ORDER.forEach((k, i) => {
      const start = 0.25 + i * 0.045;
      const t = smooth(clamp01((progress - start) / 0.3));
      const p = parts[k];
      p.group.position.lerpVectors(p.home, p.target, t);
      // tilt flat-lying parts toward the viewer once they're out
      p.group.rotation.y = t * (TILT[k] || 0);
      p.group.scale.setScalar(1 + (OUT_SCALE - 1) * t);
      labels[k].visible = t > 0.92;
    });
    labels.shell_front.visible = labels.shell_back.visible = labels.chassis.visible = shellT > 0.95;
  }

  return {
    pickables,
    get active() { return active; },
    get progress() { return progress; },
    setActive(on) {
      active = on;
      root.visible = on;
      // hide the real torso shell (the halves replace it) and fade the rest of the robot
      for (const m of viewer.pickables) {
        const isShell = shellMeshes.includes(m);
        m.visible = !(on && isShell);
        m.material.opacity = on ? 0.12 : 1;
        m.material.depthWrite = !on;
      }
      if (!on) progress = 0;
      apply();
    },
    setProgress(v) { progress = v; apply(); },
    highlight(key) {
      highlighted = key;
      for (const o of pickables) {
        const on = o.userData.teardownKey === key;
        if (o.material.emissive) o.material.emissive.setHex(on ? 0x1f6fff : 0).multiplyScalar(on ? 0.6 : 1);
      }
    },
    // Called every frame: keep clipping planes attached to the moving halves, spin the fan.
    update(dt) {
      if (!active) return;
      for (const h of Object.values(halves)) {
        h.holder.updateWorldMatrix(true, false);
        h.worldPlane.copy(h.localPlane).applyMatrix4(h.holder.matrixWorld);
      }
      parts.cooling.group.traverse((o) => { if (o.userData.spin) o.rotation.x += dt * 12; });
    },
    // Point in world space the camera should look at.
    focus(out) {
      torsoGroup.updateWorldMatrix(true, false);
      return out.set(0.1 * progress, 0, 0.17 + 0.05 * progress).applyMatrix4(torsoGroup.matrixWorld);
    },
    torsoGroup,
  };
}
