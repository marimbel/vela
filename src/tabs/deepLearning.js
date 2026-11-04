// Deep Learning tab: the models a humanoid needs, and the VELA agent orchestrator.
import { LAYERS, NODES, CHART, TRACES, STATUS, SKILL_SCHEMA, PRINCIPLES, PIPELINE } from './deepLearning.content.js';

// Chart colors (validated for dark surfaces and color-vision deficiency).
const KIND_COLOR = { agent: '#9a6cf0', model: '#1a9fc0', control: '#d9702a' };
const KIND_LABEL = { agent: 'LLM / agents', model: 'Learned models', control: 'Classical control' };
const chartKind = (id) => (NODES[id].kind === 'agent' ? 'agent' : NODES[id].kind === 'model' ? 'model' : 'control');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chip = (st) => `<span class="st ${STATUS[st].cls}">${STATUS[st].label}</span>`;

export function initDeepLearning(root) {
  root.innerHTML = `
  <div class="dl">
    <header class="dl-hero">
      <p class="eyebrow">Deep learning on a humanoid</p>
      <h1>From a sentence to motor torques</h1>
      <p class="lede">A humanoid isn't run by one AI model. It runs a <b>stack</b> of them: a large, slow model that reasons
      about the task at the top, and small, fast models and controllers that keep it balanced at the bottom.
      VELA organizes that stack as an <b>agent orchestrator</b> that delegates to specialist sub-agents.</p>
      <div class="legend-row">${Object.keys(STATUS).map(chip).join('')}<span class="muted">status in the VELA build</span></div>
    </header>

    <section class="dl-section">
      <div class="sec-head">
        <h2>The VELA agent stack</h2>
        <p>Click any block to see what the model needs. Run a task to watch a request flow down the stack.</p>
      </div>
      <div class="stack-grid">
        <div class="stack" id="stack">
          ${LAYERS.map((L, i) => `
            <div class="layer-row" data-layer="${L.id}">
              <div class="layer-meta"><b>${L.name}</b><span>${L.hz}</span><small>${L.where}</small></div>
              <div class="layer-nodes">
                ${L.nodes.map(nodeBtn).join('')}
                ${L.side ? `<div class="side-nodes">${L.side.map(nodeBtn).join('')}</div>` : ''}
              </div>
            </div>
            ${i < LAYERS.length - 1 ? '<div class="flow"><span>↓ commands</span><span>↑ observations</span></div>' : ''}`).join('')}
          <div class="speed-axis"><span>slow · big · smart</span><i></i><span>fast · small · simple</span></div>
        </div>
        <div class="stack-side">
          <div class="card" id="node-card"></div>
          <div class="card trace" id="trace">
            <h3>Run a task through the orchestrator</h3>
            <div class="task-pick">${Object.entries(TRACES).map(([k, t], i) => `<button data-trace="${k}" class="${i === 0 ? 'on' : ''}">${esc(t.task)}</button>`).join('')}</div>
            <div class="trace-ctrl">
              <button id="trace-run" class="primary">▶ Run</button>
              <button id="trace-step">Step</button>
              <button id="trace-reset">Reset</button>
              <span class="muted" id="trace-pos"></span>
            </div>
            <ol class="trace-log" id="trace-log"></ol>
            <p class="small muted">A scripted example of the planned behavior: it shows the message flow, not live model output.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="dl-section">
      <div class="sec-head">
        <h2>Every model has different needs</h2>
        <p>The faster a loop has to run, the smaller its model must be. That single trade-off explains the whole stack.</p>
      </div>
      <div class="chart-wrap">
        <div class="chart-card card">
          <div class="chart-legend">${Object.entries(KIND_LABEL).map(([k, v]) => `<span><i style="background:${KIND_COLOR[k]}"></i>${v}</span>`).join('')}</div>
          <div class="chart-holder" id="chart"></div>
          <p class="small muted">Typical ranges for humanoid robots, plotted on log scales. Hover a point for details.</p>
        </div>
        <div class="needs">
          ${needCard('⏱', 'Latency budget', 'A balance policy that answers in 200 ms is useless: the robot has already fallen. An orchestrator that takes 3 s is fine.')}
          ${needCard('🧮', 'Compute & memory', 'Billion-parameter models need datacenter GPUs. Onboard Jetson-class modules fit models in the millions to low billions.')}
          ${needCard('🔋', 'Power', 'Everything onboard runs from the battery. Quantizing to int8 cuts energy per inference several-fold.')}
          ${needCard('📦', 'Training data', 'Locomotion learns from simulation (RL). Manipulation learns from human teleoperation demos. Vision learns from labeled and synthetic images.')}
        </div>
      </div>
      <div class="table-wrap card">
        <table class="req">
          <thead><tr><th>Model</th><th>Architecture</th><th>Rate</th><th>Latency</th><th>Size</th><th>Runs on</th><th>Learns from</th></tr></thead>
          <tbody>${['orchestrator', 'vlm', 'detector', 'pose', 'manip_policy', 'loco_policy', 'pd'].map((id) => {
            const n = NODES[id];
            return `<tr data-node="${id}"><td><i class="dot" style="background:${KIND_COLOR[chartKind(id)]}"></i><b>${n.title}</b></td><td>${n.model}</td><td>${n.rate}</td><td>${n.latency}</td><td>${n.size}</td><td>${n.runsOn}</td><td>${n.training}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </section>

    <section class="dl-section">
      <div class="sec-head">
        <h2>How the orchestrator talks to the robot</h2>
        <p>Sub-agents expose <b>skills</b> as typed tools. The orchestrator can only call what's on the menu.</p>
      </div>
      <div class="api-grid">
        <div class="card code-card"><div class="code-title">Skill definition (tool schema)</div><pre><code>${esc(SKILL_SCHEMA)}</code></pre></div>
        <div class="principles">${PRINCIPLES.map(([t, d], i) => `<div class="principle"><span class="num">${i + 1}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
      </div>
    </section>

    <section class="dl-section">
      <div class="sec-head">
        <h2>From training to the robot</h2>
        <p>Every learned model goes through the same pipeline, and failures loop back as new data.</p>
      </div>
      <div class="pipeline">${PIPELINE.map(([t, d], i) => `<div class="pipe-step"><span class="pipe-n">${i + 1}</span><b>${t}</b><p>${d}</p></div>`).join('<div class="pipe-arrow">→</div>')}</div>
      <div class="loop-back">↺ Monitor feeds new data back into step 1</div>
    </section>

    <footer class="dl-foot">See the robot these models drive in <a href="#anatomy">Anatomy</a>, and the world they'll be tested in under <a href="#simulation">Simulation</a>.</footer>
  </div>`;

  function nodeBtn(id) {
    const n = NODES[id];
    return `<button class="node ${n.kind}" data-node="${id}"><span class="n-title">${n.title}</span>${chip(n.status)}</button>`;
  }
  function needCard(icon, title, text) {
    return `<div class="need card"><span class="need-ic">${icon}</span><b>${title}</b><p>${text}</p></div>`;
  }

  // ---------- Node details ----------
  const card = root.querySelector('#node-card');
  function showNode(id) {
    const n = NODES[id];
    root.querySelectorAll('.node').forEach((b) => b.classList.toggle('sel', b.dataset.node === id));
    const row = (k, v) => (v && v !== '—' ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
    card.innerHTML = `
      <div class="nc-head"><span class="kind ${n.kind}">${{ agent: 'Agent', infra: 'Infrastructure', model: 'Learned model', control: 'Control', hw: 'Hardware' }[n.kind]}</span>${chip(n.status)}</div>
      <h3>${n.title}</h3>
      <p>${n.one}</p>
      <div class="kvs">
        ${row('Model', n.model)}${row('Inputs', n.inputs)}${row('Outputs', n.outputs)}
        ${row('Rate', n.rate)}${row('Latency budget', n.latency)}${row('Runs on', n.runsOn)}
        ${row('Size', n.size)}${row('Precision', n.precision)}${row('Learns from', n.training)}
      </div>
      ${n.needs?.length ? `<h4>What it needs</h4><ul>${n.needs.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}`;
  }
  root.querySelector('#stack').addEventListener('click', (e) => {
    const b = e.target.closest('.node');
    if (b) showNode(b.dataset.node);
  });
  root.querySelector('.req tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-node]');
    if (!tr) return;
    showNode(tr.dataset.node);
    root.querySelector('#stack').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  showNode('orchestrator');

  // ---------- Task trace ----------
  let traceKey = 'stack', pos = 0, timer = null;
  const log = root.querySelector('#trace-log');
  const label = (id) => (NODES[id] ? NODES[id].title : id);
  function highlight(path) {
    root.querySelectorAll('.node').forEach((b) => b.classList.toggle('lit', path.includes(b.dataset.node)));
  }
  function renderTrace() {
    const steps = TRACES[traceKey].steps;
    log.innerHTML = steps.slice(0, pos).map((s, i) => `
      <li class="${i === pos - 1 ? 'cur' : ''}">
        <div class="hop"><b>${label(s.from)}</b> → <b>${label(s.to)}</b></div>
        <p>${s.text}</p>
        <pre><code>${esc(s.code)}</code></pre>
        ${s.result ? `<div class="res ${s.result.ok ? 'ok' : 'bad'}">${esc(s.result.text)}</div>` : ''}
      </li>`).join('');
    root.querySelector('#trace-pos').textContent = pos ? `step ${pos} / ${steps.length}` : `${steps.length} steps`;
    highlight(pos ? steps[pos - 1].path : []);
    const last = log.lastElementChild;
    if (last) log.scrollTop = log.scrollHeight;
  }
  function step() {
    if (pos >= TRACES[traceKey].steps.length) { stop(); return false; }
    pos++;
    renderTrace();
    return true;
  }
  function stop() { clearInterval(timer); timer = null; root.querySelector('#trace-run').textContent = '▶ Run'; }
  function reset() { stop(); pos = 0; renderTrace(); }
  root.querySelector('#trace-run').onclick = () => {
    if (timer) return stop();
    if (pos >= TRACES[traceKey].steps.length) pos = 0;
    root.querySelector('#trace-run').textContent = '❚❚ Pause';
    step();
    timer = setInterval(() => { if (!step()) stop(); }, 1800);
  };
  root.querySelector('#trace-step').onclick = () => { stop(); step(); };
  root.querySelector('#trace-reset').onclick = reset;
  root.querySelector('.task-pick').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-trace]');
    if (!b) return;
    traceKey = b.dataset.trace;
    root.querySelectorAll('.task-pick button').forEach((x) => x.classList.toggle('on', x === b));
    reset();
  });
  renderTrace();

  // ---------- Chart: model size vs loop rate (log-log) ----------
  drawChart(root.querySelector('#chart'));

  return {
    show() {},
    hide() { stop(); },
  };
}

function drawChart(holder) {
  const W = 640, H = 380, m = { l: 74, r: 24, t: 18, b: 52 };
  const x0 = -1, x1 = 3.3, y0 = 1, y1 = 11.5; // log10 ranges
  const X = (hz) => m.l + ((Math.log10(hz) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (p) => H - m.b - ((Math.log10(p) - y0) / (y1 - y0)) * (H - m.t - m.b);
  const xt = [0.1, 1, 10, 100, 1000], yt = [1e1, 1e3, 1e5, 1e7, 1e9, 1e11];
  const fmtP = (p) => (p >= 1e9 ? `${+(p / 1e9).toFixed(1)}B` : p >= 1e6 ? `${+(p / 1e6).toFixed(1)}M` : p >= 1e3 ? `${+(p / 1e3).toFixed(1)}K` : `${p}`);
  const fmtHz = (h) => (h >= 1000 ? `${h / 1000} kHz` : `${h} Hz`);
  // label placement nudges to avoid collisions
  const nudge = { detector: [10, 18], pose: [-11, 4, 'end'], manip_policy: [11, 0], vlm: [10, 4], orchestrator: [10, 4], loco_policy: [10, 4], pd: [-10, -12, 'end'] };

  holder.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Model size versus loop rate, log scales. Faster loops use smaller models.">
    <defs><linearGradient id="trend" x1="0" x2="1"><stop offset="0" stop-color="#9aa7bd" stop-opacity="0.18"/><stop offset="1" stop-color="#9aa7bd" stop-opacity="0.05"/></linearGradient></defs>
    ${xt.map((t) => `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${H - m.b}"/><text class="tick" x="${X(t)}" y="${H - m.b + 18}" text-anchor="middle">${fmtHz(t)}</text>`).join('')}
    ${yt.map((t) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${m.l - 10}" y="${Y(t) + 4}" text-anchor="end">${fmtP(t)}</text>`).join('')}
    <line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>
    <text class="axis-title" x="${(m.l + W - m.r) / 2}" y="${H - 10}" text-anchor="middle">How often it must run (loop rate) →</text>
    <text class="axis-title" transform="translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">Model size (parameters) →</text>
    <path d="M ${X(0.15)} ${Y(3e11)} L ${X(1500)} ${Y(10)}" stroke="url(#trend)" stroke-width="34" stroke-linecap="round" fill="none"/>
    ${CHART.map((d) => {
      const c = KIND_COLOR[chartKind(d.id)];
      const [dx, dy, anchor] = nudge[d.id] || [10, 4];
      return `<g class="pt" data-id="${d.id}" tabindex="0">
        <circle class="hit" cx="${X(d.hz)}" cy="${Y(d.params)}" r="16"/>
        <circle cx="${X(d.hz)}" cy="${Y(d.params)}" r="6.5" fill="${c}" stroke="#0e1626" stroke-width="2"/>
        <text class="pt-label" x="${X(d.hz) + dx}" y="${Y(d.params) + dy}" text-anchor="${anchor || 'start'}">${d.label}</text>
      </g>`;
    }).join('')}
  </svg>
  <div class="tip" hidden></div>`;

  const tip = holder.querySelector('.tip');
  holder.querySelectorAll('.pt').forEach((g) => {
    const d = CHART.find((c) => c.id === g.dataset.id);
    const n = NODES[d.id];
    const show = () => {
      tip.innerHTML = `<b>${d.label}</b><div>Runs at ~${fmtHz(d.hz)} · ~${fmtP(d.params)} params</div><div class="muted">${n.runsOn}</div>`;
      tip.hidden = false;
      const svg = holder.querySelector('svg').getBoundingClientRect();
      const s = svg.width / W;
      tip.style.left = `${X(d.hz) * s + 14}px`;
      tip.style.top = `${Y(d.params) * s - 10}px`;
    };
    g.addEventListener('mouseenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('mouseleave', () => { tip.hidden = true; });
    g.addEventListener('blur', () => { tip.hidden = true; });
  });
}
