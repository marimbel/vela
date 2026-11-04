// Info panel: explains the selected part and shows live physics telemetry.
import content from './parts.json';
import teardown from './teardown.json';

const RAD2DEG = 180 / Math.PI;

// Map a MuJoCo body / mesh name to a key in parts.json.
export function partKeyFor(bodyName, meshName) {
  if (meshName === 'head_link') return 'head';
  if (meshName === 'logo_link') return 'logo';
  if (meshName && meshName.includes('rubber_hand')) return 'hand';
  return bodyName.replace(/^(left|right)_/, '').replace(/_link$/, '');
}

export function sideOf(name) {
  if (name.startsWith('left_')) return 'Left';
  if (name.startsWith('right_')) return 'Right';
  return '';
}

export function createPanel(root, sim) {
  const { model } = sim;
  let current = null; // { key, info, bodyId, jointId, actuatorId }

  // Which actuator drives each joint.
  const actuatorForJoint = new Map();
  for (let a = 0; a < model.nu; a++) actuatorForJoint.set(model.actuator_trnid[a * 2], a);

  function showTeardown(sel) {
    const info = teardown.torso.components[sel.key];
    if (!info) return;
    current = { ...sel, info };
    root.innerHTML = `
      <button class="close" aria-label="Close">×</button>
      <div class="chip ${info.group.toLowerCase()}">Inside the torso · ${info.group}</div>
      <h2>${info.title}</h2>
      <p class="summary">${info.summary}</p>
      <section><h3>What it does</h3><p>${info.role}</p></section>
      <section><h3>What it's built from</h3><ul class="built">${info.parts.map((p) => `<li>${p}</li>`).join('')}</ul></section>
      <section><h3>How it connects</h3><p>${info.connects}</p></section>
      <section><h3>In simulation &amp; AI</h3><p>${info.sim}</p></section>
      <p class="note">${teardown.torso.note}</p>`;
    root.querySelector('.close').onclick = () => sel.onClose?.();
    root.classList.add('open');
  }

  function show(sel) {
    if (!sel) { root.classList.remove('open'); current = null; return; }
    if (sel.teardown) return showTeardown(sel);
    const info = sel.marker ? content.markers[sel.key] : content.parts[sel.key];
    if (!info) return;
    current = { ...sel, info };
    const b = sel.bodyId;
    const ja = b != null ? model.body_jntadr[b] : -1;
    const isHinge = ja >= 0 && model.jnt_type[ja] === 3;
    current.jointId = !sel.marker && isHinge && !['head', 'logo', 'hand'].includes(sel.key) ? ja : -1;
    current.actuatorId = current.jointId >= 0 ? actuatorForJoint.get(current.jointId) : undefined;
    if (sel.marker && sel.actuator != null) {
      current.actuatorId = sel.actuator;
      current.jointId = model.actuator_trnid[sel.actuator * 2];
    }

    const sys = info.system.toLowerCase();
    root.innerHTML = `
      <button class="close" aria-label="Close">×</button>
      <div class="chip ${sys}">${info.system}</div>
      <h2>${sel.side ? `<span class="side">${sel.side}</span> ` : ''}${info.title}</h2>
      <p class="summary">${info.summary}</p>
      <div class="telemetry" id="telemetry"></div>
      <section><h3>How it's built</h3><p>${info.build}</p></section>
      <section><h3>In simulation</h3><p>${info.sim}</p></section>
      <section><h3>Where the AI comes in</h3><p>${info.ai}</p></section>
      ${sel.action ? `<button class="cta">${sel.action.label}</button>` : ''}`;
    root.querySelector('.close').onclick = () => sel.onClose?.();
    if (sel.action) root.querySelector('.cta').onclick = sel.action.onClick;
    root.classList.add('open');
    update();
  }

  function row(label, value, bar) {
    return `<div class="t-row"><span>${label}</span><b>${value}</b>${bar != null
      ? `<i class="bar"><i style="width:${Math.min(100, bar * 100).toFixed(0)}%"></i></i>` : ''}</div>`;
  }

  function update() {
    if (!current || current.teardown) return;
    const el = root.querySelector('#telemetry');
    if (!el) return;
    const { data } = sim;
    let html = '';
    const j = current.jointId;
    if (j != null && j >= 0) {
      const ang = data.qpos[model.jnt_qposadr[j]] * RAD2DEG;
      const lo = model.jnt_range[j * 2] * RAD2DEG, hi = model.jnt_range[j * 2 + 1] * RAD2DEG;
      html += row('Joint', `<code>${sim.name('mjOBJ_JOINT', j)}</code>`);
      html += row('Angle', `${ang.toFixed(1)}°`, (ang - lo) / (hi - lo));
      html += row('Range', `${lo.toFixed(0)}° to ${hi.toFixed(0)}°`);
    }
    const a = current.actuatorId;
    if (a != null) {
      const lim = Math.abs(model.actuator_forcerange[a * 2 + 1]);
      const f = data.actuator_force[a];
      html += row('Motor torque', `${f.toFixed(1)} / ${lim.toFixed(0)} N·m`, Math.abs(f) / lim);
    }
    if (current.bodyId != null && !current.marker && !['head', 'logo'].includes(current.key)) {
      html += row('Link mass', `${model.body_mass[current.bodyId].toFixed(2)} kg`);
    }
    el.innerHTML = html ? `<h3>Live from the physics engine</h3>${html}` : '';
  }

  return { show, update, get current() { return current; } };
}
