import * as THREE from 'three';
import { createSim } from './sim/mujoco.js';
import { createViewer } from './viewer/renderer.js';
import { createLayers } from './viewer/layers.js';
import { createPicking } from './viewer/picking.js';
import { createPanel, partKeyFor, sideOf } from './explainer/panel.js';
import content from './explainer/parts.json';
import teardownContent from './explainer/teardown.json';
import { createTeardown } from './viewer/teardown.js';

const $ = (s) => document.querySelector(s);
const MODEL_URL = `${import.meta.env.BASE_URL}models/unitree_g1`;

async function main() {
  const sim = await createSim(MODEL_URL, 'scene.xml', (p, text) => {
    $('#load-bar').style.width = `${(p * 100).toFixed(0)}%`;
    $('#load-text').textContent = text;
  });
  const { model } = sim;
  const viewer = createViewer($('#stage'), sim);
  const layers = createLayers(viewer, sim);
  const panel = createPanel($('#panel'), sim);

  const bodyName = (b) => sim.name('mjOBJ_BODY', b) || '';
  let pelvisId = 1;
  let torsoId = 1;
  for (let b = 0; b < model.nbody; b++) {
    if (bodyName(b) === 'pelvis') pelvisId = b;
    if (bodyName(b) === 'torso_link') torsoId = b;
  }
  const teardown = createTeardown(viewer, sim, torsoId);

  // ---------- Selection & highlighting ----------
  let hovered = null, selected = null;
  const keyOfMesh = (m) => partKeyFor(bodyName(m.userData.bodyId), m.userData.meshName);
  const sameGroup = (a, b) => a && b && a.userData.bodyId === b.userData.bodyId && keyOfMesh(a) === keyOfMesh(b);

  function paint() {
    if (teardown.active) return; // teardown handles its own highlighting
    for (const m of viewer.pickables) {
      const e = m.material.emissive;
      if (sameGroup(m, selected)) e.setHex(0x1f6fff).multiplyScalar(0.55);
      else if (sameGroup(m, hovered)) e.setHex(0x3ddcff).multiplyScalar(0.25);
      else e.setHex(0x000000);
    }
  }

  function selectTeardown(key) {
    teardown.highlight(key);
    if (key) panel.show({ teardown: true, key, onClose: () => selectTeardown(null) });
    else panel.show(null);
    renderIndex();
  }

  function select(obj) {
    if (teardown.active) return selectTeardown(obj ? obj.userData.teardownKey : null);
    if (obj && obj.userData.markerKey) {
      selected = null;
      panel.show({
        marker: true, key: obj.userData.markerKey, actuator: obj.userData.actuator,
        side: obj.userData.actuator != null ? sideOf(sim.name('mjOBJ_ACTUATOR', obj.userData.actuator) || '') : '',
        onClose: () => select(null),
      });
    } else if (obj) {
      selected = obj;
      const name = bodyName(obj.userData.bodyId);
      const key = keyOfMesh(obj);
      panel.show({
        key, bodyId: obj.userData.bodyId,
        side: ['head', 'logo'].includes(key) ? '' : sideOf(name),
        onClose: () => select(null),
        action: ['torso', 'logo'].includes(key) ? { label: 'Open it up: see what’s inside →', onClick: () => setTeardown(true) } : null,
      });
    } else {
      selected = null;
      panel.show(null);
    }
    $('#hint').classList.add('gone');
    paint();
    renderIndex();
  }

  createPicking(viewer, () => (teardown.active ? teardown.pickables : [...viewer.pickables, ...layers.pickables]), {
    onHover(obj) { hovered = obj && !obj.userData.markerKey && !teardown.active ? obj : null; paint(); },
    onSelect(obj) { select(obj); },
  });

  // ---------- Parts index (left) ----------
  const order = ['Structure', 'Actuation', 'Sensing', 'Compute'];
  const meshForKey = (key) => viewer.pickables.find((m) => keyOfMesh(m) === key && !bodyName(m.userData.bodyId).startsWith('right_'));
  const markerLayer = { imu: 'sensing', foot: 'sensing', camera: 'sensing', compute: 'compute', actuator: 'actuation' };
  function renderIndex() {
    const curKey = panel.current?.key;
    if (teardown.active) {
      const comps = teardownContent.torso.components;
      const groups = [...new Set(Object.values(comps).map((c) => c.group))];
      $('#index').innerHTML = `<button class="back" data-back="1">← Back to full robot</button><h4>Inside the torso</h4>` +
        groups.map((g) => `<div class="idx-sys"><div class="idx-title ${g.toLowerCase()}">${g}</div>${Object.entries(comps)
          .filter(([, c]) => c.group === g)
          .map(([k, c]) => `<button data-tk="${k}" class="${curKey === k ? 'on' : ''}">${c.title}</button>`).join('')}</div>`).join('');
      return;
    }
    const items = [
      ...Object.entries(content.parts).map(([k, v]) => ({ k, v, marker: false })),
      ...Object.entries(content.markers).map(([k, v]) => ({ k, v, marker: true })),
    ];
    $('#index').innerHTML = `<h4>Parts</h4>` + order.map((sys) => {
      const list = items.filter((i) => i.v.system === sys);
      return `<div class="idx-sys"><div class="idx-title ${sys.toLowerCase()}">${sys}</div>${list
        .map((i) => `<button data-k="${i.k}" data-m="${i.marker ? 1 : 0}" class="${curKey === i.k ? 'on' : ''}">${i.v.title}</button>`)
        .join('')}</div>`;
    }).join('');
  }
  $('#index').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) return setTeardown(false);
    const tk = e.target.closest('button[data-tk]');
    if (tk) return selectTeardown(tk.dataset.tk);
    const btn = e.target.closest('button[data-k]');
    if (!btn) return;
    const k = btn.dataset.k;
    if (btn.dataset.m === '1') {
      const layer = markerLayer[k];
      if (!layers.isOn(layer)) toggleLayer(layer, true);
      select(layers.pickables.find((o) => o.userData.markerKey === k));
    } else {
      const m = meshForKey(k);
      if (m) select(m);
    }
  });
  renderIndex();

  // ---------- Toolbar ----------
  const playBtn = $('#play');
  function togglePlay() { sim.paused = !sim.paused; playBtn.textContent = sim.paused ? '▶' : '❚❚'; }
  playBtn.onclick = togglePlay;
  $('#reset').onclick = () => sim.reset();
  // Nudge: small enough for stiff joint control to absorb. Shove: it falls.
  // A learned balance policy (roadmap Phase 6) is what lets real humanoids survive the shove.
  const push = (newtons) => {
    if (sim.paused) togglePlay();
    sim.push(pelvisId, [0, (Math.random() > 0.5 ? 1 : -1) * newtons, 0]);
  };
  $('#nudge').onclick = () => push(80);
  $('#shove').onclick = () => push(220);

  const slider = $('#explode');
  slider.oninput = () => {
    if (teardown.active) { tdAnim = null; teardown.setProgress(+slider.value); }
    else viewer.setExplode(+slider.value);
  };

  // ---------- Torso teardown ----------
  let tdAnim = null; // { from, to, t } animating teardown progress
  let camAnim = 0; // seconds left of camera fly-in
  let wasPaused = false;
  const camGoal = new THREE.Vector3();
  function setTeardown(on) {
    if (on === teardown.active && !(tdAnim && tdAnim.to === 0)) return;
    if (on) {
      wasPaused = sim.paused;
      sim.reset();
      if (!sim.paused) togglePlay(); // freeze physics so the parts stay put
      viewer.setExplode(0);
      for (const l of ['actuation', 'sensing', 'compute']) toggleLayer(l, false);
      if (xray) toggleXray();
      selected = hovered = null;
      paint();
      teardown.setActive(true);
      tdAnim = { from: teardown.progress, to: 1, t: 0 };
      camAnim = 3;
      slider.value = 0;
      $('#explode-label').textContent = 'Open';
      $('#teardown').classList.add('on');
      $('#teardown').textContent = 'Close torso';
      panel.show(null);
      selectTeardown(null);
    } else {
      tdAnim = { from: teardown.progress, to: 0, t: 0, then: () => {
        teardown.setActive(false);
        if (sim.paused !== wasPaused) togglePlay();
        slider.value = 0;
        $('#explode-label').textContent = 'Explode';
        $('#teardown').classList.remove('on');
        $('#teardown').textContent = 'Open torso';
        panel.show(null);
        renderIndex();
      } };
    }
  }
  $('#teardown').onclick = () => setTeardown(!teardown.active || (tdAnim && tdAnim.to === 0));

  function toggleLayer(layer, force) {
    const on = force ?? !layers.isOn(layer);
    layers.set(layer, on);
    document.querySelector(`[data-layer="${layer}"]`).classList.toggle('on', on);
  }
  document.querySelectorAll('[data-layer]').forEach((b) => (b.onclick = () => toggleLayer(b.dataset.layer)));

  let xray = false;
  function toggleXray() {
    xray = !xray;
    $('#xray').classList.toggle('on', xray);
    for (const m of viewer.pickables) { m.material.opacity = xray ? 0.28 : 1; m.material.depthWrite = !xray; }
  }
  $('#xray').onclick = toggleXray;

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'r') sim.reset();
    else if (e.key === 'n') push(80);
    else if (e.key === 's') push(220);
    else if (e.key === 'x') toggleXray();
    else if (e.key === 'e') { slider.value = +slider.value > 0 ? 0 : 0.6; slider.oninput(); }
    else if (e.key === 't') setTeardown(!teardown.active);
    else if (e.key === 'Escape') select(null);
  });

  // ---------- Main loop ----------
  const hud = $('#hud');
  let last = performance.now(), hudTimer = 0;
  const target = new THREE.Vector3();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    sim.advance(dt);
    layers.update();

    // Gently keep the camera aimed at the robot as it moves.
    const x = sim.data.xpos;
    if (tdAnim) {
      tdAnim.t = Math.min(1, tdAnim.t + dt / 2.4);
      const p = tdAnim.from + (tdAnim.to - tdAnim.from) * tdAnim.t;
      teardown.setProgress(p);
      slider.value = p;
      if (tdAnim.t >= 1) { const done = tdAnim.then; tdAnim = null; done?.(); }
    }
    teardown.update(dt);

    if (teardown.active) {
      teardown.focus(target);
      const k = 1 - Math.exp(-dt * 4); // frame-rate independent easing
      viewer.controls.target.lerp(target, k);
      if (camAnim > 0) {
        camAnim -= dt;
        // fly to a mostly-front view of the torso; Three.js coords: x front, y up, z = robot's right
        camGoal.copy(target).add(new THREE.Vector3(2.05, 0.18, 0.4));
        viewer.camera.position.lerp(camGoal, k);
        if (viewer.camera.position.distanceTo(camGoal) < 0.01) camAnim = 0;
      }
    } else {
      const focusY = Math.max(0.2, Math.min(0.75, x[pelvisId * 3 + 2] * 0.95));
      target.set(x[pelvisId * 3], focusY + viewer.getExplode() * 0.55, -x[pelvisId * 3 + 1]);
      viewer.controls.target.lerp(target, 0.04);
    }

    viewer.render();

    hudTimer += dt;
    if (hudTimer > 0.1) {
      hudTimer = 0;
      panel.update();
      const z = x[pelvisId * 3 + 2];
      const standing = z > 0.55;
      hud.innerHTML = `<span>t = ${sim.time.toFixed(1)} s</span><span>pelvis height ${z.toFixed(2)} m</span>
        <span class="${standing ? 'ok' : 'bad'}">${standing ? '● standing' : '● fallen — press ↺'}</span>
        <span>${model.nbody - 1} links · ${model.nu} motors · ${(1 / model.opt.timestep).toFixed(0)} Hz physics</span>`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  $('#loading').classList.add('done');
  window.vela = { sim, viewer, layers, select, teardown, setTeardown }; // handy for debugging in the console
}

main().catch((err) => {
  console.error(err);
  $('#load-text').textContent = `Failed to load: ${err.message}`;
});
