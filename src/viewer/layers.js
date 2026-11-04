// Overlay layers: actuators, sensors and compute markers attached to the robot.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const COLORS = { actuation: 0xff8a3d, sensing: 0x3ddcff, compute: 0xb07cff };

function markerMaterial(color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
}

function label(text, cls) {
  const el = document.createElement('div');
  el.className = `marker-label ${cls}`;
  el.textContent = text;
  return new CSS2DObject(el);
}

export function createLayers(viewer, sim) {
  const { model } = sim;
  const pickables = [];
  const rings = [];

  function attach(layer, bodyId, obj, localPos, markerKey, text) {
    obj.position.copy(localPos);
    obj.renderOrder = 10;
    obj.userData.markerKey = markerKey;
    obj.userData.layer = layer;
    if (text) {
      const l = label(text, layer);
      l.position.set(0, 0, 0.06);
      obj.add(l);
    }
    // Parent to the body so the marker moves (and explodes) with it.
    const holder = new THREE.Group();
    holder.userData.layer = layer;
    holder.add(obj);
    viewer.bodies[bodyId].add(holder);
    pickables.push(obj);
    return obj;
  }

  // Actuation: a ring around each motorized joint, aligned with its axis.
  const ringGeo = new THREE.TorusGeometry(0.045, 0.007, 8, 32);
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let a = 0; a < model.nu; a++) {
    const j = model.actuator_trnid[a * 2];
    const b = model.jnt_bodyid[j];
    const ring = new THREE.Mesh(ringGeo, markerMaterial(COLORS.actuation, 0.55));
    const axis = new THREE.Vector3().fromArray(model.jnt_axis, j * 3);
    ring.quaternion.setFromUnitVectors(zAxis, axis.normalize());
    attach('actuation', b, ring, new THREE.Vector3().fromArray(model.jnt_pos, j * 3), 'actuator');
    ring.userData.actuator = a;
    ring.userData.limit = Math.max(Math.abs(model.actuator_forcerange[a * 2]), Math.abs(model.actuator_forcerange[a * 2 + 1])) || 100;
    rings.push(ring);
  }

  // Sensing: IMUs and foot contact sites.
  const dot = new THREE.SphereGeometry(0.022, 16, 12);
  for (let s = 0; s < model.nsite; s++) {
    const name = sim.name('mjOBJ_SITE', s) || '';
    const b = model.site_bodyid[s];
    const pos = new THREE.Vector3().fromArray(model.site_pos, s * 3);
    if (name.startsWith('imu')) {
      attach('sensing', b, new THREE.Mesh(dot, markerMaterial(COLORS.sensing)), pos, 'imu',
        name.includes('torso') ? 'IMU · torso' : 'IMU · pelvis');
    } else if (name.endsWith('foot')) {
      attach('sensing', b, new THREE.Mesh(dot, markerMaterial(COLORS.sensing)), pos, 'foot', 'Foot contact');
    }
  }

  // Head camera + LiDAR: placed at the front of the head mesh.
  let torsoId = -1;
  for (let g = 0; g < model.ngeom; g++) {
    if (sim.name('mjOBJ_MESH', model.geom_dataid[g]) === 'head_link' && model.geom_type[g] === 7) {
      torsoId = model.geom_bodyid[g];
      const p = new THREE.Vector3().fromArray(model.geom_pos, g * 3).add(new THREE.Vector3(0.07, 0, 0.0));
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.03), markerMaterial(COLORS.sensing));
      attach('sensing', torsoId, cam, p, 'camera', 'Depth camera + LiDAR');
      break;
    }
  }

  // Compute: a board inside the chest, at the torso's center of mass.
  if (torsoId < 0) torsoId = model.nbody - 1;
  for (let b = 0; b < model.nbody; b++) if (sim.name('mjOBJ_BODY', b) === 'torso_link') torsoId = b;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.09), markerMaterial(COLORS.compute));
  attach('compute', torsoId, board, new THREE.Vector3().fromArray(model.body_ipos, torsoId * 3), 'compute', 'Onboard compute');

  const visible = { actuation: false, sensing: false, compute: false };
  function applyVisibility() {
    for (const obj of pickables) obj.parent.visible = visible[obj.userData.layer];
  }
  applyVisibility();

  return {
    pickables,
    colors: COLORS,
    set(layer, on) { visible[layer] = on; applyVisibility(); },
    isOn(layer) { return visible[layer]; },
    // Ring brightness follows the live motor torque.
    update() {
      if (!visible.actuation) return;
      const force = sim.data.actuator_force;
      for (const r of rings) {
        const load = Math.min(1, Math.abs(force[r.userData.actuator]) / r.userData.limit);
        r.material.opacity = 0.35 + 0.65 * Math.min(1, load * 2.5);
        r.material.color.setHex(COLORS.actuation).lerp(new THREE.Color(0xff3355), load);
        r.scale.setScalar(1 + load * 0.6);
      }
    },
  };
}
