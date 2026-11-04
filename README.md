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
| 🔧 **Torso Teardown** | The torso shell splits open and 12 internal components fan out (battery, BMS, power distribution, e-stop, real-time computer, AI compute module, AI accelerator, cooling, IMU, comms hub, chassis, wiring). Click each one to see what it's built from |
| 🧩 **System Layers** | Toggle structure, actuation, sensing, and compute overlays |
| 🧠 **Deep Learning tab** | The layered model stack (LLM orchestrator → sub-agents → learned models → control), each model's requirements (rate, latency, size, hardware, training data), a size-vs-loop-rate chart, a step-by-step orchestrator task trace, the skill API and the training-to-deployment pipeline |
| 🌍 **Simulation tab** | MuJoCo world with a table, objects, a block tower, dominoes and a ramp. Grab and throw objects with the mouse, switch gravity (Earth / Mars / Moon / Zero-G), change friction, slow motion, live physics stats |
| 🧠 **Compute & AI Pipeline** | Animated data flow: perception → planning → policy → torque commands, with the rate and hardware each stage runs on |
| 🌍 **Physics Sandbox** | MuJoCo-powered world with gravity, contact, friction, and objects you can interact with |
| 🤖 **Agent Console** | Type a task ("put the cube on the shelf") and watch the orchestrator plan, delegate, and verify |
| ⏯️ **Replay Mode** | Pre-recorded agent runs, so the demo works without a live backend |

---

## Tech Stack

- **Rendering:** [Three.js](https://threejs.org/)
- **Physics:** [MuJoCo](https://github.com/google-deepmind/mujoco) via WebAssembly (`@mujoco/mujoco`)
- **Robot model:** Unitree G1 (29 DoF) from [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) (see [Licensing](#licensing))
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
│   ├── main.js                 # app entry: loads the engine once, routes between tabs
│   ├── style.css
│   ├── tabs/
│   │   ├── anatomy.js          # Anatomy tab: clickable robot, layers, teardown
│   │   ├── deepLearning.js     # Deep Learning tab: stack diagram, chart, task trace
│   │   ├── deepLearning.content.js  # model requirements, agents, traces, pipeline
│   │   ├── simulation.js       # Simulation tab: world, grab-and-throw, gravity/friction
│   │   └── tabs.css
│   ├── sim/
│   │   └── mujoco.js           # load WASM + model files once; compile scenes; step physics
│   ├── viewer/
│   │   ├── renderer.js         # Three.js scene, MuJoCo → Three.js sync, exploded view
│   │   ├── layers.js           # actuator / sensor / compute overlay markers
│   │   ├── teardown.js         # torso teardown: clipped shell halves + internal components
│   │   └── picking.js          # raycast hover + click selection
│   └── explainer/
│       ├── parts.json          # explainer text for every part and marker
│       ├── teardown.json       # explainer text for the torso's internal components
│       └── panel.js            # info panel + live telemetry
├── public/
│   └── models/unitree_g1/      # MJCF + meshes + manifest.json (world.xml = Simulation scene)
├── scripts/make-manifest.mjs   # lists model files for the browser loader
└── .github/workflows/deploy.yml
```

Planned for later phases: `src/control/` (PD + ONNX policies), `src/agents/` (agent client, replays), `backend/` (Express agent service on Cloud Run), and `training/` (Python policy training + ONNX export).

---

## Controls

The site has three tabs: **Anatomy**, **Deep Learning** and **Simulation** (links: `#anatomy`, `#deep-learning`, `#simulation`).

**Anatomy**

| Action | How |
|---|---|
| Learn about a part | Click it on the robot, or pick it from the **Parts** list |
| Orbit / zoom | Drag / scroll |
| Pause or resume physics | **Space** or ❚❚ |
| Reset to standing | **R** or ↺ |
| Small push (robot recovers) | **N** or **Nudge** |
| Big push (robot falls) | **S** or **Shove** |
| Exploded view | **E** or the **Explode** slider |
| Open the torso | **T**, **Open torso**, or *Open it up* in the Torso panel (the slider then scrubs the teardown) |
| Overlay layers | **Actuators**, **Sensors**, **Compute** buttons |
| See-through shell | **X** or **X-ray** |

**Simulation**

| Action | How |
|---|---|
| Grab / throw an object | Drag any colored object (a spring pulls it to the cursor) |
| Pause / reset | **Space** / **R**, or the Physics buttons |
| Gravity | Earth · Mars · Moon · Zero-G |
| Friction | Slider (0.05×–1.5×) |
| Experiments | Tip the dominoes, knock the tower, roll the ball, sweep the table |

The robot holds its pose with stiff joint position control only: no balance controller yet. That's why a shove knocks it over. Adding a learned balance and walking policy is Phase 6.

### Adding another robot

1. Copy a model folder (MJCF + `assets/`) into `public/models/<robot>/`.
2. Run `npm run manifest`.
3. Point `MODEL_URL` in `src/main.js` at the new folder and add entries to `parts.json`.

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
Open http://localhost:5173/vela/.

### Run the agent backend (Phase 7, coming later)
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

- [x] **Phase 1:** Vite + Three.js site deployed to GitHub Pages
- [x] **Phase 2:** Humanoid loaded in MuJoCo WASM, standing under PD control
- [x] **Phase 3:** Anatomy Explorer (picking, info panels, exploded view, system layers)
- [x] **Phase 3b:** Torso teardown (internal components explained)
- [ ] **Phase 3c:** Teardowns for the head, legs and arm actuators
- [x] **Phase 4:** Deep Learning tab: model requirements + orchestrator architecture
- [x] **Phase 5a:** Simulation tab: physics world with interactive objects
- [ ] **Phase 5b:** Robot tasks in the world (reach, grasp, push)
- [ ] **Phase 6:** Trained walking/reaching policies exported to ONNX
- [ ] **Phase 7:** Multi-agent orchestrator backend + Agent Console + Replay Mode

---

## Licensing

Project code is released under the MIT License (see `LICENSE`).
Third-party robot models and meshes keep their original licenses. The Unitree G1 model is © Unitree Robotics, BSD-3-Clause. See `public/models/unitree_g1/LICENSE`.

---

## Acknowledgments

- Google DeepMind for MuJoCo and MuJoCo Menagerie
- Unitree Robotics for the G1 robot model
- The Three.js community
- NVIDIA Isaac Lab
