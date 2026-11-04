// Three.js scene: draws the MuJoCo model and keeps it in sync with physics.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const MESH = 7; // mjGEOM_MESH
const VISUAL_GROUP = 2; // visual geoms in the G1 model

export function createViewer(container, sim, opts = {}) {
  const { model } = sim;
  const { camera: camPos = [1.9, 1.25, 1.9], target: camTarget = [0, 0.75, 0], primitives = false, shadowExtent = 2 } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'label-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.fog = new THREE.Fog(0x0b1220, 6, 14);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  camera.position.set(...camPos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...camTarget);
  controls.enableDamping = true;
  controls.minDistance = 0.6;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.495;

  // Lights
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2233, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const se = shadowExtent;
  Object.assign(sun.shadow.camera, { left: -se, right: se, top: se, bottom: -se, near: 0.5, far: 12 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7fb8ff, 1.0);
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x111a2b, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(16, 64, 0x2a3b5c, 0x1a263d);
  grid.position.y = 0.001;
  scene.add(grid);

  // MuJoCo is Z-up; Three.js is Y-up. Rotate one root group to convert.
  const world = new THREE.Group();
  world.rotation.x = -Math.PI / 2;
  scene.add(world);

  // One Three.js group per MuJoCo body, holding that body's visual meshes.
  const bodies = [];
  for (let b = 0; b < model.nbody; b++) {
    const g = new THREE.Group();
    g.userData.bodyId = b;
    world.add(g);
    bodies.push(g);
  }

  const pickables = [];
  const geomCache = new Map();
  for (let i = 0; i < model.ngeom; i++) {
    if (model.geom_type[i] !== MESH || model.geom_group[i] !== VISUAL_GROUP) continue;
    const meshId = model.geom_dataid[i];
    let geometry = geomCache.get(meshId);
    if (!geometry) {
      geometry = meshGeometry(model, meshId);
      geomCache.set(meshId, geometry);
    }
    const matId = model.geom_matid[i];
    const rgba = matId >= 0 ? model.mat_rgba.slice(matId * 4, matId * 4 + 4) : model.geom_rgba.slice(i * 4, i * 4 + 4);
    const dark = rgba[0] < 0.4;
    const material = new THREE.MeshStandardMaterial({
      color: dark ? 0x23262d : 0xd9dde4,
      metalness: dark ? 0.35 : 0.55,
      roughness: dark ? 0.55 : 0.35,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.fromArray(model.geom_pos, i * 3);
    const q = model.geom_quat;
    mesh.quaternion.set(q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3], q[i * 4]);
    const bodyId = model.geom_bodyid[i];
    const meshName = sim.name('mjOBJ_MESH', meshId) || '';
    mesh.userData = { bodyId, geomId: i, meshName, baseColor: material.color.clone() };
    bodies[bodyId].add(mesh);
    pickables.push(mesh);
  }

  // Simple shapes (boxes, spheres, cylinders, capsules) for scenes with props.
  // Skips planes (the floor is drawn separately) and group-3 collision-only geoms.
  const propMeshes = [];
  if (primitives) {
    for (let i = 0; i < model.ngeom; i++) {
      const type = model.geom_type[i];
      if (type === MESH || type === 0 || model.geom_group[i] >= 3) continue;
      const s = model.geom_size;
      let g;
      if (type === 2) g = new THREE.SphereGeometry(s[i * 3], 28, 18);
      else if (type === 3) g = new THREE.CapsuleGeometry(s[i * 3], 2 * s[i * 3 + 1], 8, 20).rotateX(Math.PI / 2);
      else if (type === 4) g = new THREE.SphereGeometry(1, 24, 16).scale(s[i * 3], s[i * 3 + 1], s[i * 3 + 2]);
      else if (type === 5) g = new THREE.CylinderGeometry(s[i * 3], s[i * 3], 2 * s[i * 3 + 1], 28).rotateX(Math.PI / 2);
      else if (type === 6) g = new THREE.BoxGeometry(2 * s[i * 3], 2 * s[i * 3 + 1], 2 * s[i * 3 + 2]);
      else continue;
      const matId = model.geom_matid[i];
      const rgba = matId >= 0 ? model.mat_rgba.slice(matId * 4, matId * 4 + 4) : model.geom_rgba.slice(i * 4, i * 4 + 4);
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(rgba[0], rgba[1], rgba[2]), roughness: 0.55, metalness: 0.1 });
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.fromArray(model.geom_pos, i * 3);
      const q = model.geom_quat;
      mesh.quaternion.set(q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3], q[i * 4]);
      const bodyId = model.geom_bodyid[i];
      const ja = model.body_jntadr[bodyId];
      const free = ja >= 0 && model.jnt_type[ja] === 0 && sim.name('mjOBJ_BODY', bodyId) !== 'pelvis';
      mesh.userData = { bodyId, geomId: i, prop: free };
      bodies[bodyId].add(mesh);
      if (free) propMeshes.push(mesh);
    }
  }

  // Exploded view: each body slides away from its parent, so the tree spreads out.
  const explodeOffsets = Array.from({ length: model.nbody }, () => new THREE.Vector3());
  let explode = 0;

  function sync() {
    const { data } = sim;
    const xpos = data.xpos, xquat = data.xquat;
    for (let b = 1; b < model.nbody; b++) {
      const g = bodies[b];
      g.position.set(xpos[b * 3], xpos[b * 3 + 1], xpos[b * 3 + 2]);
      g.quaternion.set(xquat[b * 4 + 1], xquat[b * 4 + 2], xquat[b * 4 + 3], xquat[b * 4]);
      const p = model.body_parentid[b];
      const off = explodeOffsets[b];
      if (explode > 0 && p > 0) {
        off.set(xpos[b * 3] - xpos[p * 3], xpos[b * 3 + 1] - xpos[p * 3 + 1], xpos[b * 3 + 2] - xpos[p * 3 + 2])
          .multiplyScalar(explode * 0.75)
          .add(explodeOffsets[p]);
      } else off.set(0, 0, p === 0 ? explode * 0.4 : 0); // lift the robot so the legs stay above the floor
      g.position.add(off);
    }
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer, controls, world, bodies, pickables, propMeshes, container,
    explodeOffsets,
    resize,
    setExplode(v) { explode = v; },
    getExplode() { return explode; },
    render() {
      sync();
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    },
  };
}

function meshGeometry(model, id) {
  const va = model.mesh_vertadr[id], vn = model.mesh_vertnum[id];
  const fa = model.mesh_faceadr[id], fn = model.mesh_facenum[id];
  const v = model.mesh_vert, f = model.mesh_face;
  const pos = new Float32Array(fn * 9);
  for (let t = 0; t < fn; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = f[(fa + t) * 3 + k];
      if (vi >= vn) continue;
      pos.set(v.subarray((va + vi) * 3, (va + vi) * 3 + 3), t * 9 + k * 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
