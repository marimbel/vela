# VELA — Versatile Embodied Learning Agent

**An interactive, browser-based humanoid robot explainer and physics simulation, driven by a multi-agent orchestration system.**

🔗 **Live demo:** https://marimbel.github.io/vela
👩‍💻 **Author:** Marianna Belmares · [LinkedIn](https://linkedin.com/in/marianna-belmares) · [GitHub](https://github.com/marimbel)

---

## Overview

VELA is a full-body humanoid robot that lives entirely in your browser. The project has three goals:

1. **Explain how a humanoid is built.** Click any part of the robot to learn what it is, how it moves, and why it matters. Use the exploded view to see how the structure, actuators, sensors and compute fit together.
2. **Explain how deep learning runs on real robot hardware.** Follow the data from cameras to edge compute (Jetson-class modules, TPUs, AI accelerators) to learned policies to motors.
3. **Show an agentic robot acting in a physics world.** An LLM orchestrator breaks down a natural-language task and hands the pieces to specialized sub-agents. The sub-agents direct the robot to move and manipulate objects in a 3D environment with real rigid-body physics.

---

## Features

| Module | Description |
|---|---|
| 🦾 **Anatomy Explorer** | Clickable 3D humanoid with highlighted parts, info panels, and an animated exploded view |
| 🧩 **System Layers** | Toggle structure, actuation, sensing, and compute overlays |
| 🧠 **Compute & AI Pipeline** | Animated data flow: perception → planning → policy → torque commands, with the rate and hardware each stage runs on |
| 🌍 **Physics Sandbox** | MuJoCo-powered world with gravity, contact, friction, and objects you can interact with |
| 🤖 **Agent Console** | Type a task ("put the cube on the shelf") and watch the orchestrator plan, delegate, and verify |
| ⏯️ **Replay Mode** | Pre-recorded agent runs, so the demo works without a live backend |

---

## Tech Stack

- **Rendering:** [Three.js](https://threejs.org/)
- **Physics:** [MuJoCo](https://github.com/google-deepmind/mujoco) via WebAssembly (`@mujoco/mujoco`)
- **Robot model:** Humanoid from [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) (see [Licensing](#licensing))
- **Policy inference (browser):** [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- **Policy training (offline):** Isaac Lab / MuJoCo (Python)
- **Agent backend:** Node.js + Express on Google Cloud Run
- **Build & deploy:** Vite + GitHub Actions → GitHub Pages

---

## Architecture

```
┌─────────────────────────── Browser (GitHub Pages) ───────────────────────────┐
│                                                                              │
│   Anatomy Explorer ──┐                                                       │
│   Compute Pipeline ──┼──► Three.js renderer ◄── MuJoCo WASM physics (1 kHz)  │
│   Physics Sandbox ───┘                               ▲                       │
│                                                      │ joint targets         │
│                                    Skill policies (ONNX, ~50 Hz)             │
│                                                      ▲                       │
│                                                      │ skill calls           │
│   Agent Console ◄───────── HTTPS ─────────► Agent Backend (Cloud Run)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Agent hierarchy

```
Orchestrator (LLM planner)        "put the mug on the shelf"
 ├── Perception agent             what objects are where?
 ├── Navigation agent             walk_to(table)
 ├── Manipulation agent           grasp(mug) → place(shelf)
 └── Verifier agent               success? → retry / replan
          │
          ▼  calls named, parameterized skills
Learned skill policies  →  PD joint controllers  →  MuJoCo physics
```

**Design rule:** agents choose *skills*; they never output raw joint torques. This keeps fast control loops (milliseconds) separate from slow reasoning (seconds).

| Layer | Rate | Runs on (real robot) |
|---|---|---|
| Orchestrator / sub-agents | ~0.1–1 Hz | Cloud or onboard LLM |
| Perception models | ~10–30 Hz | Jetson-class GPU / AI accelerator |
| Skill policies | ~50 Hz | Onboard GPU / NPU |
| PD joint control | ~500–1000 Hz | Motor drivers / MCU |

---

## Simulation Readiness Checklist

Each robot model in this project is checked against the following before use:

- [ ] Floating-base kinematic tree with correct joint axes, limits, and damping
- [ ] Mass, center of mass, and inertia defined for every link; total mass matches spec
- [ ] Simplified collision geometry (capsules/boxes) separate from visual meshes
- [ ] Actuator at every driven joint with torque limits, gear ratio, and PD gains
- [ ] Sensors: joint encoders, torso IMU, foot force sensors, head camera(s)
- [ ] Friction set on feet and hands; stable solver settings and timestep (1–2 ms)
- [ ] Validation: holds a standing pose under gravity, sweeps each joint through its range, makes clean foot contact

---

## Project Structure

```
vela/
├── index.html
├── src/
│   ├── main.js                 # app entry, routing between modules
│   ├── sim/
│   │   ├── mujoco.js           # load WASM, step physics
│   │   └── sceneSync.js        # MuJoCo → Three.js transforms
│   ├── viewer/
│   │   ├── renderer.js         # Three.js scene, camera, lights
│   │   ├── picking.js          # raycasting + highlight
│   │   └── explode.js          # exploded-view animation
│   ├── explainer/
│   │   ├── parts.json          # body name → title, description, specs
│   │   └── pipeline.js         # compute/data-flow animation
│   ├── control/
│   │   ├── pd.js               # joint PD controller
│   │   └── policy.js           # ONNX policy inference
│   └── agents/
│       ├── client.js           # calls agent backend
│       └── replays/            # recorded agent runs (JSON)
├── public/
│   └── models/                 # MJCF + meshes
├── backend/                    # Express agent service (Cloud Run)
├── training/                   # Python: policy training + ONNX export
└── .github/workflows/deploy.yml
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.10+ (only for `training/`)

### Run locally
```bash
git clone https://github.com/marimbel/vela.git
cd vela
npm install
npm run dev
```
Open http://localhost:5173.

### Run the agent backend (optional)
```bash
cd backend
npm install
cp .env.example .env    # add your LLM API key — never commit this
npm start
```
Set `VITE_AGENT_API_URL` in the root `.env` to point the frontend at the backend. If no backend is configured, the Agent Console falls back to Replay Mode.

### Deploy
Pushing to `main` builds the site and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.

---

## Roadmap

- [ ] **Phase 1:** Vite + Three.js site deployed to GitHub Pages
- [ ] **Phase 2:** Humanoid loaded in MuJoCo WASM, standing under PD control
- [ ] **Phase 3:** Anatomy Explorer (picking, info panels, exploded view, system layers)
- [ ] **Phase 4:** Compute & AI Pipeline explainer
- [ ] **Phase 5:** Physics Sandbox with interactive objects
- [ ] **Phase 6:** Trained walking/reaching policies exported to ONNX
- [ ] **Phase 7:** Multi-agent orchestrator backend + Agent Console + Replay Mode

---

## Licensing

Project code is released under the MIT License (see `LICENSE`).
Third-party robot models and meshes keep their original licenses. See `public/models/<robot>/LICENSE` and check them before redistributing.

---

## Acknowledgments

- Google DeepMind for MuJoCo and MuJoCo Menagerie
- The Three.js community
- NVIDIA Isaac Lab
