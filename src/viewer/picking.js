// Mouse hover + click selection of robot parts and layer markers.
import * as THREE from 'three';

export function createPicking(viewer, getTargets, { onHover, onSelect }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const el = viewer.renderer.domElement;
  let down = null;

  function hit(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, viewer.camera);
    const targets = getTargets().filter((o) => o.visible && (!o.parent || o.parent.visible));
    // Markers draw on top of the robot, so they win if hit.
    const hits = ray.intersectObjects(targets, false);
    return hits.find((h) => h.object.userData.markerKey) || hits[0] || null;
  }

  el.addEventListener('pointermove', (e) => {
    const h = hit(e);
    el.style.cursor = h ? 'pointer' : 'grab';
    onHover(h ? h.object : null);
  });
  el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
    down = null;
    if (moved > 5) return; // that was a camera drag, not a click
    const h = hit(e);
    onSelect(h ? h.object : null, h ? h.point : null);
  });
}
