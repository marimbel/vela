// Content for the Deep Learning tab. Numbers are typical ranges for humanoid robots,
// meant to show the trade-offs between models, not to describe one specific product.

export const STATUS = {
  built: { label: 'Built', cls: 'built' },
  dev: { label: 'In development', cls: 'dev' },
  planned: { label: 'Planned', cls: 'planned' },
};

// The layered architecture, top (slow, big, smart) to bottom (fast, small, simple).
export const LAYERS = [
  {
    id: 'reason', name: 'Reasoning', hz: '0.1–1 Hz', where: 'Cloud / offboard GPU',
    nodes: ['orchestrator'],
  },
  {
    id: 'agents', name: 'Sub-agents', hz: '~1 Hz', where: 'Agent backend (Cloud Run)',
    nodes: ['perception_agent', 'navigation_agent', 'manipulation_agent', 'verifier_agent'],
    side: ['memory', 'safety'],
  },
  {
    id: 'models', name: 'Learned models', hz: '10–50 Hz', where: 'Onboard GPU / NPU',
    nodes: ['vlm', 'detector', 'pose', 'loco_policy', 'manip_policy'],
  },
  {
    id: 'control', name: 'Control', hz: '500–1000 Hz', where: 'Real-time CPU / motor drivers',
    nodes: ['ik', 'pd'],
  },
  {
    id: 'hardware', name: 'Body', hz: 'physics', where: 'Robot (or MuJoCo)',
    nodes: ['sensors', 'motors'],
  },
];

export const NODES = {
  orchestrator: {
    title: 'Orchestrator', kind: 'agent', status: 'dev',
    one: 'Turns a request in plain English into a plan, then delegates each step to a sub-agent.',
    model: 'Large language model (LLM) with tool calling',
    inputs: 'User task, world-state memory, results returned by sub-agents',
    outputs: 'Structured tool calls (JSON) to sub-agents, and a final report',
    rate: 'Event-driven, ~0.1–1 Hz', latency: '1–5 s is fine', runsOn: 'Cloud API or offboard GPU',
    size: 'Tens of billions of parameters (hosted)', precision: 'Provider-managed (fp16/bf16)',
    training: 'Pretrained; steered with a system prompt, tool schemas and examples. No robot training needed to start.',
    needs: ['Clear, typed tool schemas', 'A compact world-state summary (not raw sensor data)', 'Replanning when a step fails', 'Hard limits enforced outside the LLM'],
  },
  perception_agent: {
    title: 'Perception Agent', kind: 'agent', status: 'planned',
    one: 'Answers "what is where?" by running the vision models and writing results to memory.',
    model: 'Agent wrapper around the detector, pose estimator and VLM',
    inputs: 'Camera frames, depth, questions from the orchestrator',
    outputs: 'Object list with 3D poses and confidence scores',
    rate: 'On request, plus a background refresh', latency: '< 0.5 s', runsOn: 'Backend + onboard GPU',
    size: '—', precision: '—',
    training: 'Not trained itself; it composes the perception models below.',
    needs: ['Calibrated cameras (intrinsics + extrinsics)', 'Consistent object naming', 'Confidence thresholds'],
  },
  navigation_agent: {
    title: 'Navigation Agent', kind: 'agent', status: 'planned',
    one: 'Moves the whole robot: plans a path and commands the walking policy.',
    model: 'Path planner + learned locomotion policy',
    inputs: 'Goal pose, map / obstacles, robot state',
    outputs: 'Velocity commands to the locomotion policy',
    rate: '~1–10 Hz planning', latency: '< 100 ms', runsOn: 'Onboard CPU',
    size: '—', precision: '—',
    training: 'Classical planning; the walking itself comes from the RL locomotion policy.',
    needs: ['Obstacle map', 'Reliable state estimate (where am I?)', 'Stop / abort behavior'],
  },
  manipulation_agent: {
    title: 'Manipulation Agent', kind: 'agent', status: 'planned',
    one: 'Reaches, grasps and places objects using the arms and hands.',
    model: 'Grasp selection + inverse kinematics + visuomotor policy',
    inputs: 'Target object pose, skill name (grasp / place), arm state',
    outputs: 'Arm and hand joint targets',
    rate: '~1 Hz decisions; 10–50 Hz execution', latency: '< 50 ms per action chunk', runsOn: 'Onboard GPU',
    size: '—', precision: '—',
    training: 'Policies learned from teleoperated demonstrations (imitation learning).',
    needs: ['Accurate object poses', 'Grasp success check (force / vision)', 'Workspace and collision limits'],
  },
  verifier_agent: {
    title: 'Verifier Agent', kind: 'agent', status: 'planned',
    one: 'Checks whether a step actually worked, so the orchestrator can retry or replan.',
    model: 'Vision-language model asked a yes / no question about the scene',
    inputs: 'Camera image + condition ("red cube is on blue cube")',
    outputs: 'Pass / fail, with a short reason',
    rate: 'After each step', latency: '0.5–2 s', runsOn: 'Backend / offboard GPU',
    size: '—', precision: '—',
    training: 'Pretrained VLM; can be fine-tuned on success and failure examples from simulation.',
    needs: ['A good camera view of the result', 'Conditions phrased as checkable facts'],
  },
  memory: {
    title: 'World-State Memory', kind: 'infra', status: 'planned',
    one: 'Shared notes that every agent reads and writes: objects, robot state, task progress.',
    model: 'Structured store (JSON); not a neural network',
    inputs: 'Writes from every agent', outputs: 'Compact summaries for the orchestrator prompt',
    rate: 'Continuous', latency: '—', runsOn: 'Agent backend', size: '—', precision: '—',
    training: '—',
    needs: ['Timestamps (stale data is dangerous)', 'One source of truth per fact'],
  },
  safety: {
    title: 'Safety Gate', kind: 'infra', status: 'planned',
    one: 'Validates every skill call before it reaches the robot.',
    model: 'Rule-based checks; deliberately not AI',
    inputs: 'Proposed skill call + robot state', outputs: 'Allow / reject, with a reason',
    rate: 'Every call', latency: '< 1 ms', runsOn: 'Onboard CPU', size: '—', precision: '—',
    training: '—',
    needs: ['Workspace bounds', 'Speed and force limits', 'E-stop status', 'Allow-list of skills'],
  },
  vlm: {
    title: 'Vision-Language Model', kind: 'model', status: 'planned',
    one: 'Understands images and text together: describes scenes, answers questions about them.',
    model: 'Transformer: vision encoder + language model',
    inputs: 'RGB image(s) + text prompt', outputs: 'Text (descriptions, yes / no, object names)',
    rate: '0.2–2 Hz', latency: '0.5–2 s', runsOn: 'Offboard GPU or a large edge module',
    size: '~1–10 billion parameters', precision: 'fp16 or int8 / int4 quantized',
    training: 'Internet-scale image-text pretraining; optional fine-tuning on robot views.',
    needs: ['Lots of GPU memory', 'Not fast enough for control loops'],
  },
  detector: {
    title: 'Object Detector / Segmenter', kind: 'model', status: 'planned',
    one: 'Finds and outlines objects in every camera frame.',
    model: 'CNN or vision transformer (YOLO-style detector, segmentation network)',
    inputs: 'RGB frame', outputs: 'Bounding boxes or masks + class labels',
    rate: '10–30 Hz', latency: '< 50 ms', runsOn: 'Jetson-class GPU (TensorRT)',
    size: '~3–100 million parameters', precision: 'fp16 / int8',
    training: 'Labeled images, plus synthetic images rendered in simulation (auto-labeled).',
    needs: ['Training data that matches the real lighting and objects', 'Domain randomization for sim-to-real'],
  },
  pose: {
    title: 'Depth & 6-DoF Pose Estimator', kind: 'model', status: 'planned',
    one: 'Works out exactly where an object is in 3D and how it is rotated.',
    model: 'CNN / transformer on RGB-D input',
    inputs: 'RGB + depth, object mask', outputs: 'Position (x, y, z) + orientation',
    rate: '10–30 Hz', latency: '< 50 ms', runsOn: 'Jetson-class GPU',
    size: '~10–50 million parameters', precision: 'fp16',
    training: 'Synthetic data from simulation, where the true pose is known exactly.',
    needs: ['Calibrated depth camera', 'Object models or examples'],
  },
  loco_policy: {
    title: 'Locomotion Policy', kind: 'model', status: 'planned',
    one: 'Keeps the robot balanced and walking. This is what would let it survive the Shove.',
    model: 'Small MLP (sometimes with an LSTM for memory)',
    inputs: 'IMU, joint angles and velocities, last action, velocity command',
    outputs: 'Joint position targets for all motors',
    rate: '50 Hz', latency: '< 5 ms', runsOn: 'Onboard CPU or GPU',
    size: '~0.1–2 million parameters', precision: 'fp32 / fp16',
    training: 'Reinforcement learning (e.g. PPO) in thousands of parallel simulations, with randomized friction, masses and pushes.',
    needs: ['Accurate robot model (mass, inertia, motor limits)', 'Domain randomization', 'Tight, consistent timing'],
  },
  manip_policy: {
    title: 'Manipulation Policy', kind: 'model', status: 'planned',
    one: 'Moves the arm and hand from what the cameras see: the fine motor skill of grasping.',
    model: 'Visuomotor transformer or diffusion policy (outputs chunks of future actions)',
    inputs: 'Camera images + arm and hand joint states', outputs: 'A short sequence of arm and hand joint targets',
    rate: '10–50 Hz', latency: '< 30 ms per chunk', runsOn: 'Jetson-class GPU',
    size: '~10–300 million parameters', precision: 'fp16',
    training: 'Imitation learning from teleoperated demonstrations: a human drives the robot and the policy learns to copy them.',
    needs: ['Hundreds to thousands of high-quality demos', 'Consistent camera placement', 'Clean, synchronized data'],
  },
  ik: {
    title: 'Inverse Kinematics / Motion Planner', kind: 'control', status: 'planned',
    one: 'Converts "put the hand here" into joint angles that avoid collisions.',
    model: 'Numerical optimization; not deep learning',
    inputs: 'Target hand pose, current joints', outputs: 'Joint trajectory',
    rate: '10–100 Hz', latency: '< 10 ms', runsOn: 'Onboard CPU', size: '—', precision: 'fp64',
    training: '—',
    needs: ['Accurate kinematic model', 'Joint limits'],
  },
  pd: {
    title: 'PD Joint Controllers', kind: 'control', status: 'built',
    one: 'Turns each target angle into motor torque. This is what holds the robot up in the Anatomy tab.',
    model: 'torque = kp × (target − angle) − kd × velocity',
    inputs: 'Target joint angles', outputs: 'Motor torques (clamped to limits)',
    rate: '500–1000 Hz', latency: '< 1 ms', runsOn: 'Motor drivers / real-time CPU', size: '2 gains per joint', precision: 'fixed / float',
    training: 'Tuned by hand or by system identification.',
    needs: ['Fast, jitter-free timing', 'Torque limits'],
  },
  sensors: {
    title: 'Sensors', kind: 'hw', status: 'built',
    one: 'Cameras, depth, IMUs and joint encoders: everything the models see.',
    model: '—', inputs: 'The world', outputs: 'Images, point clouds, angles, accelerations',
    rate: '30 Hz cameras – 1 kHz encoders', latency: '—', runsOn: 'Robot', size: '—', precision: '—', training: '—',
    needs: ['Calibration', 'Time synchronization'],
  },
  motors: {
    title: 'Actuators', kind: 'hw', status: 'built',
    one: '29 joint motors with gearboxes: the only way the robot affects the world.',
    model: '—', inputs: 'Torque commands', outputs: 'Motion',
    rate: '—', latency: '—', runsOn: 'Robot (simulated in MuJoCo here)', size: '—', precision: '—', training: '—',
    needs: ['Thermal limits', 'Torque limits'],
  },
};

// Model size vs how fast it has to run. Plotted on log-log axes.
export const CHART = [
  { id: 'orchestrator', label: 'Orchestrator LLM', hz: 0.3, params: 7e10 },
  { id: 'vlm', label: 'VLM', hz: 1, params: 5e9 },
  { id: 'manip_policy', label: 'Manipulation policy', hz: 30, params: 1e8 },
  { id: 'detector', label: 'Detector', hz: 20, params: 2.5e7 },
  { id: 'pose', label: 'Pose estimator', hz: 15, params: 2e7 },
  { id: 'loco_policy', label: 'Locomotion policy', hz: 50, params: 5e5 },
  { id: 'pd', label: 'PD controller', hz: 1000, params: 58 },
];

// Example run of the orchestrator, step by step. `path` lights up nodes in the diagram.
export const TRACES = {
  stack: {
    task: 'Put the red cube on top of the blue cube.',
    steps: [
      { from: 'You', to: 'orchestrator', path: ['orchestrator'], text: 'Task received.', code: '"Put the red cube on top of the blue cube."' },
      { from: 'orchestrator', to: 'perception_agent', path: ['orchestrator', 'perception_agent', 'detector', 'pose', 'sensors'], text: 'First, find out what is on the table.', code: '{ "tool": "describe_scene", "args": { "area": "table" } }' },
      { from: 'perception_agent', to: 'memory', path: ['perception_agent', 'memory'], text: 'Detector + pose estimator report the objects; results go into memory.', code: '{ "red_cube":  { "pos": [0.52, 0.12, 0.74], "conf": 0.97 },\n  "blue_cube": { "pos": [0.60, -0.15, 0.74], "conf": 0.95 } }' },
      { from: 'orchestrator', to: 'orchestrator', path: ['orchestrator', 'memory'], text: 'Plan: walk to the table → grasp red cube → place it on blue cube → verify.', code: 'plan = [walk_to(table), grasp(red_cube),\n        place(red_cube, on=blue_cube), verify(...)]' },
      { from: 'orchestrator', to: 'navigation_agent', path: ['orchestrator', 'safety', 'navigation_agent', 'loco_policy', 'pd', 'motors'], text: 'Safety gate approves; the walking policy runs at 50 Hz until the robot arrives.', code: '{ "tool": "walk_to", "args": { "x": 0.25, "y": 0.0, "face": "table" } }' },
      { from: 'orchestrator', to: 'manipulation_agent', path: ['orchestrator', 'safety', 'manipulation_agent', 'manip_policy', 'ik', 'pd', 'motors'], text: 'Grasp: the policy reaches and closes the hand; grip force confirms it is holding.', code: '{ "tool": "grasp", "args": { "object": "red_cube" } }' },
      { from: 'orchestrator', to: 'manipulation_agent', path: ['orchestrator', 'safety', 'manipulation_agent', 'manip_policy', 'ik', 'pd', 'motors'], text: 'Place it on the blue cube.', code: '{ "tool": "place", "args": { "object": "red_cube", "on": "blue_cube" } }' },
      { from: 'orchestrator', to: 'verifier_agent', path: ['orchestrator', 'verifier_agent', 'vlm', 'sensors'], text: 'Verify with the camera…', code: '{ "tool": "verify", "args": { "condition": "red cube is on top of blue cube" } }', result: { ok: false, text: 'FAIL: "The red cube slid off and is next to the blue cube."' } },
      { from: 'orchestrator', to: 'orchestrator', path: ['orchestrator', 'memory'], text: 'Replan: re-detect, grasp again, place with a slower, centered approach.', code: 'retry 1/3 → describe_scene, grasp(red_cube),\n            place(red_cube, on=blue_cube, speed="slow", align="center")' },
      { from: 'orchestrator', to: 'verifier_agent', path: ['orchestrator', 'verifier_agent', 'vlm', 'sensors'], text: 'Verify again…', code: '{ "tool": "verify", "args": { "condition": "red cube is on top of blue cube" } }', result: { ok: true, text: 'PASS: "The red cube is stacked on the blue cube."' } },
      { from: 'orchestrator', to: 'You', path: ['orchestrator'], text: 'Done. Reports what happened, including the retry.', code: '"Stacked the red cube on the blue cube (needed 1 retry: first placement slid off)."' },
    ],
  },
  bring: {
    task: 'Bring me the green ball.',
    steps: [
      { from: 'You', to: 'orchestrator', path: ['orchestrator'], text: 'Task received.', code: '"Bring me the green ball."' },
      { from: 'orchestrator', to: 'perception_agent', path: ['orchestrator', 'perception_agent', 'detector', 'pose', 'sensors'], text: 'Locate the ball and the person.', code: '{ "tool": "locate", "args": { "objects": ["green_ball", "person"] } }' },
      { from: 'perception_agent', to: 'memory', path: ['perception_agent', 'memory'], text: 'Found both.', code: '{ "green_ball": { "pos": [0.70, 0.25, 0.74] },\n  "person":     { "pos": [-1.2, 0.4, 0.0] } }' },
      { from: 'orchestrator', to: 'navigation_agent', path: ['orchestrator', 'safety', 'navigation_agent', 'loco_policy', 'pd', 'motors'], text: 'Walk to the table.', code: '{ "tool": "walk_to", "args": { "near": "green_ball" } }' },
      { from: 'orchestrator', to: 'manipulation_agent', path: ['orchestrator', 'safety', 'manipulation_agent', 'manip_policy', 'ik', 'pd', 'motors'], text: 'Grasp the ball. Round objects need a wrap grasp.', code: '{ "tool": "grasp", "args": { "object": "green_ball", "style": "wrap" } }' },
      { from: 'orchestrator', to: 'navigation_agent', path: ['orchestrator', 'safety', 'navigation_agent', 'loco_policy', 'pd', 'motors'], text: 'Walk to the person while holding it. The safety gate lowers the speed limit near people.', code: '{ "tool": "walk_to", "args": { "near": "person", "max_speed": 0.3 } }' },
      { from: 'orchestrator', to: 'manipulation_agent', path: ['orchestrator', 'safety', 'manipulation_agent', 'manip_policy', 'ik', 'pd', 'motors'], text: 'Hand it over: hold out the arm, release when the person pulls.', code: '{ "tool": "handover", "args": { "object": "green_ball" } }' },
      { from: 'orchestrator', to: 'verifier_agent', path: ['orchestrator', 'verifier_agent', 'vlm', 'sensors'], text: 'Check that the hand is empty and the person has the ball.', code: '{ "tool": "verify", "args": { "condition": "person is holding the green ball" } }', result: { ok: true, text: 'PASS' } },
      { from: 'orchestrator', to: 'You', path: ['orchestrator'], text: 'Done.', code: '"Here is the green ball."' },
    ],
  },
};

export const SKILL_SCHEMA = `{
  "name": "grasp",
  "description": "Pick up a known object with one hand.",
  "parameters": {
    "type": "object",
    "properties": {
      "object": { "type": "string", "description": "Name from world-state memory" },
      "hand":   { "type": "string", "enum": ["left", "right", "auto"] },
      "style":  { "type": "string", "enum": ["pinch", "wrap", "auto"] }
    },
    "required": ["object"]
  }
}`;

export const PRINCIPLES = [
  ['Agents pick skills, never torques', 'LLMs are slow (seconds) and can be wrong. They choose from a fixed menu of tested skills; fast learned policies and controllers do the motion.'],
  ['Every call is typed and validated', 'Tool calls follow a JSON schema. The safety gate rejects anything outside the workspace, speed limits or allow-list before it reaches the robot.'],
  ['Verify, then retry or replan', 'A verifier checks each step against the camera. Failures go back to the orchestrator with a reason, instead of being silently ignored.'],
  ['Memory is shared and timestamped', 'Agents communicate through world-state memory, so the orchestrator reasons over a compact summary instead of raw sensor streams.'],
  ['Simulation first', 'Every skill and every agent plan runs in the MuJoCo world (Simulation tab) before it is allowed on hardware.'],
  ['Hardware safety stays outside the AI', 'The e-stop, torque limits and watchdogs are physical and rule-based. No model can override them.'],
];

export const PIPELINE = [
  ['Data', 'Simulation rollouts · teleoperated demos · labeled + synthetic images · internet pretraining'],
  ['Train', 'RL (PPO) for locomotion · imitation learning for manipulation · fine-tuning for vision'],
  ['Export', 'PyTorch → ONNX: one portable file per model'],
  ['Optimize', 'TensorRT · fp16 / int8 quantization · pruning, to fit the latency budget'],
  ['Deploy', 'Jetson-class GPU / NPU on the robot · ONNX Runtime Web in this browser'],
  ['Monitor', 'Log failures and edge cases → they become new training data'],
];
