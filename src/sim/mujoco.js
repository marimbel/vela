// Loads the MuJoCo WASM engine and a robot model, and steps the physics.
import loadMujoco from '@mujoco/mujoco';

export async function createSim(modelUrl, sceneFile, onProgress = () => {}) {
  onProgress(0.02, 'Starting physics engine');
  const mj = await loadMujoco();

  // Fetch every model file into MuJoCo's in-memory file system.
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

  onProgress(0.92, 'Compiling model');
  const model = mj.MjModel.from_xml_path(`/model/${sceneFile}`);
  const data = new mj.MjData(model);

  const sim = {
    mj, model, data,
    paused: false,
    time: 0,
    pushTimer: 0,
    name(type, id) { return mj.mj_id2name(model, mj.mjtObj[type].value, id); },
    reset() {
      if (model.nkey > 0) mj.mj_resetDataKeyframe(model, data, 0);
      else mj.mj_resetData(model, data);
      mj.mj_forward(model, data);
      this.time = 0;
    },
    // Shove a body sideways for a moment, to show the physics reacting.
    push(bodyId, force = [0, 120, 0]) {
      const f = data.xfrc_applied;
      for (let i = 0; i < 3; i++) f[bodyId * 6 + i] = force[i];
      this.pushTimer = 0.15;
      this.pushBody = bodyId;
    },
    // Advance physics to keep pace with wall-clock time.
    advance(dt) {
      if (this.paused) return;
      const h = model.opt.timestep;
      const target = this.time + Math.min(dt, 1 / 30);
      while (this.time < target) {
        mj.mj_step(model, data);
        this.time += h;
        if (this.pushTimer > 0) {
          this.pushTimer -= h;
          if (this.pushTimer <= 0) {
            const f = data.xfrc_applied;
            for (let i = 0; i < 6; i++) f[this.pushBody * 6 + i] = 0;
          }
        }
      }
    },
  };
  sim.reset();
  onProgress(1, 'Ready');
  return sim;
}
