import * as THREE from 'three';

const DEG = THREE.MathUtils.DEG2RAD;
const TAU = Math.PI * 2;

export const wave = (u, cycles = 1, phase = 0) => Math.sin(TAU * (cycles * u + phase));
export const cosWave = (u, cycles = 1, phase = 0) => Math.cos(TAU * (cycles * u + phase));
export const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Samples a procedural pose function into a keyframed AnimationClip.
 *
 * `pose(u)` receives the normalized time u ∈ [0, 1] and returns, per pivot,
 * `{ r: [x, y, z] }` rotation offsets in degrees and/or `{ p: [x, y, z] }` position
 * offsets in meters, both relative to the rest pose. Looping clips must return the
 * same pose at u = 0 and u = 1.
 *
 * Looping clips are named `*_loop`; the game plays those in a loop and the others once.
 */
export function buildClip(avatar, name, { duration, samples, pose }) {
  const frames = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    frames.push({ t: u * duration, pose: pose(u) });
  }

  const rotated = new Set();
  const moved = new Set();
  for (const { pose: p } of frames) {
    for (const [pivot, value] of Object.entries(p)) {
      if (!avatar.pivots[pivot]) throw new Error(`Clip "${name}" targets unknown pivot "${pivot}"`);
      if (value.r) rotated.add(pivot);
      if (value.p) moved.add(pivot);
    }
  }

  const times = frames.map((f) => f.t);
  const tracks = [];
  const euler = new THREE.Euler();
  const delta = new THREE.Quaternion();

  for (const pivot of rotated) {
    const values = [];
    for (const { pose: p } of frames) {
      const [x, y, z] = p[pivot]?.r ?? [0, 0, 0];
      delta.setFromEuler(euler.set(x * DEG, y * DEG, z * DEG));
      const q = avatar.restQuaternions[pivot].clone().multiply(delta);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${pivot}.quaternion`, times, values));
  }

  for (const pivot of moved) {
    const values = [];
    for (const { pose: p } of frames) {
      const [x, y, z] = p[pivot]?.p ?? [0, 0, 0];
      const rest = avatar.restPositions[pivot];
      values.push(rest.x + x, rest.y + y, rest.z + z);
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${pivot}.position`, times, values));
  }

  return new THREE.AnimationClip(name, duration, tracks);
}

// ---------------------------------------------------------------------------
// Clips shared by every avatar. Rotation signs (character faces +Z, left = +X):
//   limb swings forward  -> negative X      knee / torso bend forward -> positive X
//   left arm out to side -> positive Z      right arm out to side     -> negative Z
// ---------------------------------------------------------------------------

/** Slow breathing and looking around. */
export function idlePose(u) {
  const s = wave(u);
  return {
    Hips: { p: [0, 0.006 * s, 0] },
    Torso: { r: [1.5 * s, 0, 0] },
    Head: { r: [-1.2 * s, 5 * wave(u, 1, 0.25), 0] },
    UpperArm_L: { r: [2 * s, 0, 1.5 * s] },
    UpperArm_R: { r: [2 * s, 0, -1.5 * s] },
    LowerArm_L: { r: [-2 * s, 0, 0] },
    LowerArm_R: { r: [-2 * s, 0, 0] },
  };
}

/** Bouncy low-gravity lope (Apollo crews moved in short hops). */
export function walkPose(u) {
  const c = wave(u);
  const swing = 24;
  const kneeL = 8 + 42 * Math.max(0, cosWave(u));
  const kneeR = 8 + 42 * Math.max(0, -cosWave(u));
  const thighL = -swing * c;
  const thighR = swing * c;
  return {
    Hips: { p: [0, 0.03 - 0.09 * Math.abs(c), 0], r: [0, 6 * c, 0] },
    Torso: { r: [6, -8 * c, 0] },
    Head: { r: [-4, 5 * c, 0] },
    UpperLeg_L: { r: [thighL, 0, 0] },
    UpperLeg_R: { r: [thighR, 0, 0] },
    LowerLeg_L: { r: [kneeL, 0, 0] },
    LowerLeg_R: { r: [kneeR, 0, 0] },
    Foot_L: { r: [-0.6 * (thighL + kneeL), 0, 0] },
    Foot_R: { r: [-0.6 * (thighR + kneeR), 0, 0] },
    UpperArm_L: { r: [22 * c, 0, 0] },
    UpperArm_R: { r: [-22 * c, 0, 0] },
    LowerArm_L: { r: [-25 - 8 * Math.max(0, -c), 0, 0] },
    LowerArm_R: { r: [-25 - 8 * Math.max(0, c), 0, 0] },
  };
}

/** Raises the LEFT arm and waves (one-shot in the game). The right hand holds tools. */
export function wavePose(u) {
  const e = smooth(0.0, 0.2, u) * (1 - smooth(0.8, 1.0, u));
  const w = 18 * wave(u, 3);
  return {
    Torso: { r: [0, 0, -3 * e] },
    Head: { r: [0, 10 * e, -4 * e] },
    UpperArm_L: { r: [-10 * e, 0, 150 * e] },
    LowerArm_L: { r: [0, 0, (40 + w) * e] },
    UpperArm_R: { r: [0, 0, 4 * e] },
  };
}

/** Crisp astronaut/military salute with the LEFT hand (🫡, one-shot in the game). */
export function salutePose(u) {
  const e = smooth(0.0, 0.18, u) * (1 - smooth(0.82, 1.0, u));
  const breath = wave(u, 1) * e;
  return {
    Hips: { p: [0, 0.008 * e, 0] },
    Torso: { r: [-4 * e + 0.6 * breath, 0, -2 * e] },
    Head: { r: [-3 * e, 4 * e, 0] },
    UpperArm_L: { r: [10 * e, -30 * e, 110 * e] },
    LowerArm_L: { r: [-120 * e, 0, 70 * e] },
    Hand_L: { r: [4 * e, 0, 10 * e] },
    UpperArm_R: { r: [2 * e, 0, 6 * e] },
    LowerArm_R: { r: [8 * e, 0, 0] },
    UpperLeg_L: { r: [0, 0, -2 * e] },
    UpperLeg_R: { r: [0, 0, 2 * e] },
  };
}
