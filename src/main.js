import * as THREE from 'three';
import { createSim } from './sim/mujoco.js';
import { createViewer } from './viewer/renderer.js';
import { createLayers } from './viewer/layers.js';
import { createPicking } from './viewer/picking.js';
import { createPanel, partKeyFor, sideOf } from './explainer/panel.js';
import content from './explainer/parts.json';

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
  for (let b = 0; b < model.nbody; b++) if (bodyName(b) === 'pelvis') pelvisId = b;

  // ---------- Selection & highlighting ----------
  let hovered = null, selected = null;
  const keyOfMesh = (m) => partKeyFor(bodyName(m.userData.bodyId), m.userData.meshName);
  const sameGroup = (a, b) => a && b && a.userData.bodyId === b.userData.bodyId && keyOfMesh(a) === keyOfMesh(b);

  function paint() {
    for (const m of viewer.pickables) {
      const e = m.material.emissive;
      if (sameGroup(m, selected)) e.setHex(0x1f6fff).multiplyScalar(0.55);
      else if (sameGroup(m, hovered)) e.setHex(0x3ddcff).multiplyScalar(0.25);
      else e.setHex(0x000000);
    }
  }

  function select(obj) {
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
      panel.show({
        key: keyOfMesh(obj), bodyId: obj.userData.bodyId,
        side: ['head', 'logo'].includes(keyOfMesh(obj)) ? '' : sideOf(name),
        onClose: () => select(null),
      });
    } else {
      selected = null;
      panel.show(null);
    }
    $('#hint').classList.add('gone');
    paint();
    renderIndex();
  }

  createPicking(viewer, () => [...viewer.pickables, ...layers.pickables], {
    onHover(obj) { hovered = obj && !obj.userData.markerKey ? obj : null; paint(); },
    onSelect(obj) { select(obj); },
  });

  // ---------- Parts index (left) ----------
  const order = ['Structure', 'Actuation', 'Sensing', 'Compute'];
  const meshForKey = (key) => viewer.pickables.find((m) => keyOfMesh(m) === key && !bodyName(m.userData.bodyId).startsWith('right_'));
  const markerLayer = { imu: 'sensing', foot: 'sensing', camera: 'sensing', compute: 'compute', actuator: 'actuation' };
  function renderIndex() {
    const curKey = panel.current?.key;
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
  slider.oninput = () => viewer.setExplode(+slider.value);

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
    const focusY = Math.max(0.2, Math.min(0.75, x[pelvisId * 3 + 2] * 0.95));
    target.set(x[pelvisId * 3], focusY + viewer.getExplode() * 0.55, -x[pelvisId * 3 + 1]);
    viewer.controls.target.lerp(target, 0.04);

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
  window.vela = { sim, viewer, layers, select }; // handy for debugging in the console
}

main().catch((err) => {
  console.error(err);
  $('#load-text').textContent = `Failed to load: ${err.message}`;
});
