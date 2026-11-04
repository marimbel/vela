// Loads the MuJoCo WASM engine and robot files once, then compiles scenes from them.
import loadMujoco from '@mujoco/mujoco';

// Load the engine and copy every model file into MuJoCo's in-memory file system.
export async function loadEngine(modelUrl, onProgress = () => {}) {
  onProgress(0.02, 'Starting physics engine');
  const mj = await loadMujoco();
  const { files } = await (await fetch(`${modelUrl}/manifest.json`)).json();
  mj.FS.mkdir('/model');
  const made = new Set(['/model']);
  let done = 0;
  await Promise.all(
    files.map(async (f) => {
      const buf = new Uint8Array(await (await fetch(`${modelUrl}/${f}`)).arrayBuffer());
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        const d = '/model/' + parts.slice(0, i).join('/');
        if (!made.has(d)) { mj.FS.mkdir(d); made.add(d); }
      }
      mj.FS.writeFile(`/model/${f}`, buf);
      onProgress(0.05 + 0.85 * (++done / files.length), `Loading robot parts (${done}/${files.length})`);
    }),
  );
  return { mj };
}

// Compile one scene (an MJCF file in the model folder) into a steppable simulation.
export function createSim({ mj }, sceneFile) {
  const model = mj.MjModel.from_xml_path(`/model/${sceneFile}`);
  const data = new mj.MjData(model);

  const sim = {
    mj, model, data,
    paused: false,
    time: 0,
    timeScale: 1,
    pushTimer: 0,
    beforeStep: null, // optional hook, called before every physics step
    name(type, id) { return mj.mj_id2name(model, mj.mjtObj[type].value, id); },
    id(type, name) { return mj.mj_name2id(model, mj.mjtObj[type].value, name); },
    reset() {
      // Keyframe 0 is the robot's "stand" pose; anything it doesn't cover keeps its default position.
      if (model.nkey > 0) mj.mj_resetDataKeyframe(model, data, 0);
      else mj.mj_resetData(model, data);
      mj.mj_forward(model, data);
      this.time = 0;
    },
    // Shove a body for a moment, to show the physics reacting.
    push(bodyId, force = [0, 120, 0]) {
      const f = data.xfrc_applied;
      for (let i = 0; i < 3; i++) f[bodyId * 6 + i] = force[i];
      this.pushTimer = 0.15;
      this.pushBody = bodyId;
    },
    // Advance physics to keep pace with wall-clock time (times timeScale).
    advance(dt) {
      if (this.paused) return;
      const h = model.opt.timestep;
      const target = this.time + Math.min(dt, 1 / 30) * this.timeScale;
      while (this.time < target) {
        if (this.beforeStep) this.beforeStep();
        if (this.pushTimer > 0) {
          this.pushTimer -= h;
          if (this.pushTimer <= 0) {
            const f = data.xfrc_applied;
            for (let i = 0; i < 6; i++) f[this.pushBody * 6 + i] = 0;
          }
        }
        mj.mj_step(model, data);
        this.time += h;
      }
    },
  };
  sim.reset();
  return sim;
}
