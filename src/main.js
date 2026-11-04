// App entry: loads the physics engine once, then routes between the three tabs.
import { loadEngine } from './sim/mujoco.js';
import { initAnatomy } from './tabs/anatomy.js';
import { initDeepLearning } from './tabs/deepLearning.js';
import { initSimulation } from './tabs/simulation.js';

const $ = (s) => document.querySelector(s);
const MODEL_URL = `${import.meta.env.BASE_URL}models/unitree_g1`;

async function main() {
  const engine = await loadEngine(MODEL_URL, (p, text) => {
    $('#load-bar').style.width = `${(p * 100).toFixed(0)}%`;
    $('#load-text').textContent = text;
  });

  // The Deep Learning tab is plain HTML; the other two are 3D scenes.
  // Simulation is built the first time it's opened, to keep the initial load fast.
  const tabs = {
    anatomy: initAnatomy(engine),
    'deep-learning': initDeepLearning($('#tab-deep-learning')),
    simulation: null,
  };
  let current = null;

  function open(name) {
    if (!(name in tabs)) name = 'anatomy';
    if (name === current) return;
    if (current && tabs[current]) tabs[current].hide();
    document.querySelectorAll('section.tab').forEach((s) => { s.hidden = s.dataset.tab !== name; });
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
    if (name === 'simulation' && !tabs.simulation) tabs.simulation = initSimulation(engine);
    current = name;
    tabs[name].show();
  }
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
  open(location.hash.slice(1) || 'anatomy');

  // One render loop; only the visible tab does any work.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tabs[current]?.frame?.(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  $('#loading').classList.add('done');
  window.vela = { tabs, open }; // handy for debugging in the console
}

main().catch((err) => {
  console.error(err);
  $('#load-text').textContent = `Failed to load: ${err.message}`;
});
