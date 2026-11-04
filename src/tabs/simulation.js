// Simulation tab: the robot in a physics world with objects you can grab and throw.
import * as THREE from 'three';
import { createSim } from '../sim/mujoco.js';
import { createViewer } from '../viewer/renderer.js';

const $ = (s) => document.querySelector(s);

const GRAVITY = { Earth: 9.81, Mars: 3.71, Moon: 1.62, 'Zero-G': 0 };
const PRETTY = (n) => n.replace(/_\d+$/, '').replace(/_/g, ' ');

export function initSimulation(engine) {
  const sim = createSim(engine, 'world.xml');
  const { model, data, mj } = sim;
  const viewer = createViewer($('#sim-stage'), sim, {
    primitives: true, camera: [2.9, 1.7, 2.3], target: [0.5, 0.55, 0], shadowExtent: 3,
  });

  const pelvisId = sim.id('mjOBJ_BODY', 'pelvis');
  const geomFriction0 = Float64Array.from(model.geom_friction);
  const propGeoms = [];
  for (let g = 0; g < model.ngeom; g++) {
    const b = model.geom_bodyid[g];
    const robot = model.body_rootid[b] === pelvisId;
    if (!robot) propGeoms.push(g); // floor, table, ramp and every prop
  }

  // ---------- Drag to grab: a spring pulls the grabbed object toward the cursor ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hitPoint = new THREE.Vector3();
  const el = viewer.renderer.domElement;
  let grab = null; // { bodyId, target (MuJoCo coords) }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x3ddcff, dashSize: 0.03, gapSize: 0.02 }),
  );
  line.visible = false;
  viewer.scene.add(line);
  const toMj = (v) => [v.x, -v.z, v.y]; // Three.js (Y up) → MuJoCo (Z up)
  const toThree = (x, y, z, out) => out.set(x, z, -y);

  function setNdc(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, viewer.camera);
  }
  el.addEventListener('pointerdown', (e) => {
    setNdc(e);
    const hit = ray.intersectObjects(viewer.propMeshes, false)[0];
    if (!hit) return;
    viewer.controls.enabled = false;
    el.setPointerCapture(e.pointerId);
    plane.setFromNormalAndCoplanarPoint(viewer.camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
    grab = { bodyId: hit.object.userData.bodyId, target: toMj(hit.point) };
    line.visible = true;
    if (sim.paused) togglePlay();
    $('#sim-hint').classList.add('gone');
  });
  el.addEventListener('pointermove', (e) => {
    setNdc(e);
    if (grab) {
      if (ray.ray.intersectPlane(plane, hitPoint)) {
        hitPoint.y = Math.max(0.02, hitPoint.y); // don't drag through the floor
        grab.target = toMj(hitPoint);
      }
    } else {
      el.style.cursor = ray.intersectObjects(viewer.propMeshes, false).length ? 'grab' : 'default';
    }
  });
  const release = () => {
    if (!grab) return;
    const f = data.xfrc_applied;
    for (let i = 0; i < 6; i++) f[grab.bodyId * 6 + i] = 0;
    grab = null;
    line.visible = false;
    viewer.controls.enabled = true;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  // Timed pushes, counted in simulation time so they're identical on fast and slow computers.
  const kicks = []; // { body, wrench, left }
  sim.beforeStep = () => {
    const f = data.xfrc_applied, h = model.opt.timestep;
    for (let i = kicks.length - 1; i >= 0; i--) {
      const k = kicks[i];
      for (let j = 0; j < 6; j++) f[k.body * 6 + j] = k.left > 0 ? k.wrench[j] || 0 : 0;
      k.left -= h;
      if (k.left < -h) kicks.splice(i, 1);
    }
    if (!grab) return;
    const b = grab.bodyId;
    const m = model.body_mass[b];
    const dof = model.jnt_dofadr[model.body_jntadr[b]];
    const k = 400 * m, c = 2 * Math.sqrt(k * m); // critically damped spring
    const p = data.xipos, v = data.qvel;
    const g = -model.opt.gravity[2];
    for (let i = 0; i < 3; i++) f[b * 6 + i] = k * (grab.target[i] - p[b * 3 + i]) - c * v[dof + i] + (i === 2 ? m * g : 0);
    for (let i = 0; i < 3; i++) f[b * 6 + 3 + i] = -0.02 * m * v[dof + 3 + i]; // calm the spin a little
  };

  // ---------- Controls ----------
  const controls = $('#sim-controls');
  controls.innerHTML = `
    <h3>Physics</h3>
    <div class="row">
      <button id="sim-play">❚❚ Pause</button>
      <button id="sim-reset">↺ Reset world</button>
    </div>
    <label class="check"><input type="checkbox" id="sim-slow" /> Slow motion (¼ speed)</label>

    <h3>Gravity</h3>
    <div class="seg" id="sim-gravity">
      ${Object.entries(GRAVITY).map(([k, v]) => `<button data-g="${v}" class="${k === 'Earth' ? 'on' : ''}">${k}<small>${v} m/s²</small></button>`).join('')}
    </div>

    <h3>Friction <span id="sim-fric-val">1.0×</span></h3>
    <input type="range" id="sim-friction" min="0.05" max="1.5" step="0.05" value="1" />
    <p class="small">Scales friction on the floor, table and objects. Try ice (0.1×) and push the dominoes.</p>

    <h3>Experiments</h3>
    <div class="col">
      <button id="exp-dominoes">Tip the first domino</button>
      <button id="exp-tower">Knock the tower</button>
      <button id="exp-ball">Roll the ball again</button>
      <button id="exp-table">Sweep the table</button>
    </div>

    <h3>Robot</h3>
    <div class="row">
      <button id="sim-nudge">Nudge</button>
      <button id="sim-shove">Shove</button>
    </div>
    <p class="small">The robot only holds its pose (no balance policy yet), so a shove topples it. Learned locomotion is on the roadmap.</p>`;

  const playBtn = $('#sim-play');
  function togglePlay() {
    sim.paused = !sim.paused;
    playBtn.textContent = sim.paused ? '▶ Play' : '❚❚ Pause';
  }
  playBtn.onclick = togglePlay;
  $('#sim-reset').onclick = () => { release(); kicks.length = 0; sim.reset(); applyFriction(); };
  $('#sim-slow').onchange = (e) => { sim.timeScale = e.target.checked ? 0.25 : 1; };

  $('#sim-gravity').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-g]');
    if (!b) return;
    model.opt.gravity[2] = -Number(b.dataset.g);
    document.querySelectorAll('#sim-gravity button').forEach((x) => x.classList.toggle('on', x === b));
  });

  const fric = $('#sim-friction');
  function applyFriction() {
    const s = +fric.value;
    for (const g of propGeoms) model.geom_friction[g * 3] = geomFriction0[g * 3] * s;
    $('#sim-fric-val').textContent = `${s.toFixed(2)}×`;
  }
  fric.oninput = applyFriction;

  // Experiments: short pushes on specific bodies.
  // wrench = [fx, fy, fz, tx, ty, tz] in world coordinates (N, N·m), applied at the body's center of mass
  function kick(name, wrench, duration = 0.08) {
    const b = sim.id('mjOBJ_BODY', name);
    if (b < 0) return;
    if (sim.paused) togglePlay();
    kicks.push({ body: b, wrench, left: duration });
  }
  // A small twist tips the first domino toward the others (axis = up × line direction).
  $('#exp-dominoes').onclick = () => kick('domino_1', [0, 0, 0, 0.447 * 0.03, 0.894 * 0.03, 0]);
  $('#exp-tower').onclick = () => kick('tower_2', [0, 40, 0], 0.1);
  $('#exp-ball').onclick = () => {
    const b = sim.id('mjOBJ_BODY', 'ramp_ball');
    const qa = model.jnt_qposadr[model.body_jntadr[b]], da = model.jnt_dofadr[model.body_jntadr[b]];
    data.qpos.set([-0.3, -1.0, 0.34, 1, 0, 0, 0], qa);
    for (let i = 0; i < 6; i++) data.qvel[da + i] = 0;
    if (sim.paused) togglePlay();
  };
  $('#exp-table').onclick = () => {
    for (const n of ['red_cube', 'blue_cube', 'green_ball', 'yellow_can', 'purple_mug']) {
      const m = model.body_mass[sim.id('mjOBJ_BODY', n)];
      kick(n, [0, -40 * m, 5 * m], 0.12); // same acceleration for every object, whatever its mass
    }
  };
  $('#sim-nudge').onclick = () => { if (sim.paused) togglePlay(); sim.push(pelvisId, [0, 80, 0]); };
  $('#sim-shove').onclick = () => { if (sim.paused) togglePlay(); sim.push(pelvisId, [0, 220, 0]); };

  // ---------- Info panel ----------
  const info = $('#sim-info');
  info.innerHTML = `
    <h3>Live physics</h3>
    <div id="sim-stats" class="stats"></div>
    <h3>What the engine does every step</h3>
    <ol class="steps">
      <li><b>Forward kinematics:</b> work out where every body is from the joint angles.</li>
      <li><b>Collision detection:</b> find every pair of shapes that touch.</li>
      <li><b>Contact solve:</b> compute contact forces that stop objects passing through each other, limited by friction.</li>
      <li><b>Actuation:</b> add the robot's motor torques (PD position control).</li>
      <li><b>Integrate:</b> step velocities and positions forward by ${(model.opt.timestep * 1000).toFixed(0)} ms.</li>
    </ol>
    <p class="small">That's ${(1 / model.opt.timestep).toFixed(0)} steps per simulated second, all running in your browser through MuJoCo compiled to WebAssembly.</p>
    <h3>Why simulation matters</h3>
    <p class="small">Robots learn in worlds like this one: thousands of simulated copies practice walking or grasping in parallel, with randomized friction, masses and gravity, before a policy ever touches real hardware. The VELA agents will be tested here first.</p>`;
  const stats = $('#sim-stats');

  // ---------- Loop ----------
  let statTimer = 0, simAt = 0, wallAt = 0;
  const pA = new THREE.Vector3(), pB = new THREE.Vector3();
  function frame(dt) {
    sim.advance(dt);
    if (grab) {
      const b = grab.bodyId, p = data.xipos;
      toThree(p[b * 3], p[b * 3 + 1], p[b * 3 + 2], pA);
      toThree(grab.target[0], grab.target[1], grab.target[2], pB);
      line.geometry.setFromPoints([pA, pB]);
      line.computeLineDistances();
    }
    viewer.render();

    statTimer += dt;
    wallAt += dt;
    if (statTimer > 0.25) {
      const rtf = wallAt > 0 ? (sim.time - simAt) / wallAt : 0;
      simAt = sim.time; wallAt = 0; statTimer = 0;
      const z = data.xpos[pelvisId * 3 + 2];
      let held = '';
      if (grab) {
        const b = grab.bodyId, dof = model.jnt_dofadr[model.body_jntadr[b]];
        const speed = Math.hypot(data.qvel[dof], data.qvel[dof + 1], data.qvel[dof + 2]);
        held = `<div class="stat wide"><span>Holding</span><b>${PRETTY(sim.name('mjOBJ_BODY', b))} · ${model.body_mass[b].toFixed(2)} kg · ${speed.toFixed(2)} m/s</b></div>`;
      }
      stats.innerHTML = `
        <div class="stat"><span>Sim time</span><b>${sim.time.toFixed(1)} s</b></div>
        <div class="stat"><span>Speed vs real time</span><b>${sim.paused ? 'paused' : `${rtf.toFixed(2)}×`}</b></div>
        <div class="stat"><span>Active contacts</span><b>${data.ncon}</b></div>
        <div class="stat"><span>Gravity</span><b>${(-model.opt.gravity[2]).toFixed(2)} m/s²</b></div>
        <div class="stat"><span>Bodies</span><b>${model.nbody - 1}</b></div>
        <div class="stat"><span>Robot</span><b class="${z > 0.55 ? 'ok' : 'bad'}">${z > 0.55 ? 'standing' : 'fallen'}</b></div>
        ${held}`;
    }
  }

  let active = false;
  window.addEventListener('keydown', (e) => {
    if (!active || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'r') $('#sim-reset').click();
  });

  return {
    sim, viewer, frame,
    show() { active = true; viewer.resize(); },
    hide() { active = false; release(); },
  };
}
