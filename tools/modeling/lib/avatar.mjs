import * as THREE from 'three';
import { createPalette } from './palette.mjs';
import { PartSet, box, cyl, ball, ring, lathe, shell } from './shapes.mjs';

const DEG = THREE.MathUtils.DEG2RAD;

/**
 * Shared astronaut rig. Every avatar has exactly these pivots, with these names, so
 * game code and animations can treat all characters the same way.
 *
 * Conventions: meters, +Y up, the character faces +Z, origin between the feet.
 * The character's left side is +X. Pivots are empty nodes placed at the joints;
 * meshes are children named `<Pivot>_<Material>`.
 *
 * `pos` is relative to the parent pivot; `rest` is the rest rotation in degrees (XYZ).
 */
export const RIG = [
  { name: 'Hips', parent: null, pos: [0, 0.95, 0] },
  { name: 'Torso', parent: 'Hips', pos: [0, 0.1, 0] },
  { name: 'Head', parent: 'Torso', pos: [0, 0.47, 0] },
  { name: 'UpperArm_L', parent: 'Torso', pos: [0.31, 0.39, 0], rest: [0, 0, 10] },
  { name: 'LowerArm_L', parent: 'UpperArm_L', pos: [0, -0.3, 0], rest: [-10, 0, 0] },
  { name: 'Hand_L', parent: 'LowerArm_L', pos: [0, -0.25, 0] },
  { name: 'UpperArm_R', parent: 'Torso', pos: [-0.31, 0.39, 0], rest: [0, 0, -10] },
  { name: 'LowerArm_R', parent: 'UpperArm_R', pos: [0, -0.3, 0], rest: [-10, 0, 0] },
  { name: 'Hand_R', parent: 'LowerArm_R', pos: [0, -0.25, 0] },
  { name: 'UpperLeg_L', parent: 'Hips', pos: [0.11, -0.05, 0] },
  { name: 'LowerLeg_L', parent: 'UpperLeg_L', pos: [0, -0.38, 0] },
  { name: 'Foot_L', parent: 'LowerLeg_L', pos: [0, -0.4, 0] },
  { name: 'UpperLeg_R', parent: 'Hips', pos: [-0.11, -0.05, 0] },
  { name: 'LowerLeg_R', parent: 'UpperLeg_R', pos: [0, -0.38, 0] },
  { name: 'Foot_R', parent: 'LowerLeg_R', pos: [0, -0.4, 0] },
];

export const PIVOT_NAMES = RIG.map((j) => j.name);
export const SIDES = { L: 1, R: -1 };

/**
 * Creates the base astronaut (oversized bubble helmet, bulky bellowed pressurized suit,
 * chest DCM + umbilical ports, PLSS backpack, wrist rings, insulated gloves and boots).
 * Characters add their own gear and identifying stripes, then call `avatar.finish()`.
 * With `astronaut: false` the rig comes empty and the character builds its whole body.
 * `rig` overrides the position (`pos`) and rest rotation (`rest`) of pivots for other body
 * proportions; names and hierarchy never change, so the shared clips still apply.
 */
export function createAvatar({ id, accent, visor = 'Visor', astronaut = true, rig = {} }) {
  for (const name of Object.keys(rig)) {
    if (!PIVOT_NAMES.includes(name)) throw new Error(`Unknown rig pivot "${name}"`);
  }
  const materials = createPalette(accent);
  const root = new THREE.Group();
  root.name = `Avatar_${id}`;

  const pivots = {};
  const restQuaternions = {};
  const parts = {};
  const props = new Map();
  for (const joint of RIG) {
    const node = new THREE.Group();
    node.name = joint.name;
    const { pos = joint.pos, rest = joint.rest ?? [0, 0, 0] } = rig[joint.name] ?? {};
    node.position.set(...pos);
    const [rx, ry, rz] = rest;
    node.quaternion.setFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG));
    restQuaternions[joint.name] = node.quaternion.clone();
    (joint.parent ? pivots[joint.parent] : root).add(node);
    pivots[joint.name] = node;
    parts[joint.name] = new PartSet(materials);
  }

  const avatar = {
    id,
    root,
    pivots,
    materials,
    restQuaternions,
    restPositions: Object.fromEntries(RIG.map((j) => [j.name, pivots[j.name].position.clone()])),
    fx: [],
    part: (pivot) => parts[pivot],
    /** Temporary prop group (`Prop_*`), attached to `root` or a rig pivot. */
    prop(parentName, propName) {
      const parent = parentName === 'root' ? root : pivots[parentName];
      if (!parent) throw new Error(`Unknown prop parent "${parentName}"`);
      if (!propName) throw new Error('Prop name must be a non-empty string');
      const key = propName.startsWith('Prop_') ? propName : `Prop_${propName}`;
      if (!props.has(key)) {
        const group = new THREE.Group();
        group.name = key;
        parent.add(group);
        props.set(key, { group, parentName, partSet: new PartSet(materials) });
      } else if (props.get(key).parentName !== parentName) {
        throw new Error(`Prop "${key}" is already attached to "${props.get(key).parentName}"`);
      }
      return props.get(key).partSet;
    },
    /** Empty node used as a particle emitter in the viewer and in the game. Emits along its local +Y. */
    anchor(name, pivot, { p = [0, 0, 0], r = [0, 0, 0] } = {}, fx = null) {
      if (!name.startsWith('FX_')) throw new Error(`FX anchors must start with "FX_": ${name}`);
      const parent = pivot === 'root' ? root : pivots[pivot];
      if (!parent) throw new Error(`Unknown anchor parent "${pivot}"`);
      const node = new THREE.Object3D();
      node.name = name;
      node.position.set(...p);
      node.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
      if (fx) node.userData = { fx: fx.preset };
      parent.add(node);
      if (fx) avatar.fx.push({ anchor: name, ...fx });
      return node;
    },
    finish() {
      for (const name of PIVOT_NAMES) parts[name].attachTo(pivots[name], name);
      for (const [key, { group, partSet }] of props) partSet.attachTo(group, key);
      return root;
    },
  };

  if (astronaut) buildBody(avatar, visor);
  return avatar;
}

function buildBody(avatar, visorMaterial) {
  const P = avatar.part;

  // Hips: fuller bellowed pelvis, metallic waist bearing ring, padded hip bellows & lower harness.
  P('Hips')
    .add('Suit', lathe([
      [0.16, -0.13],
      [0.215, -0.06],
      [0.228, 0.01],
      [0.215, 0.07],
      [0.185, 0.11],
    ], 8), { s: [1.06, 1, 0.84] })
    .add('Metal', cyl(0.218, 0.214, 0.032, 8), { p: [0, 0.085, 0], s: [1.05, 1, 0.84] })
    .add('Suit', ball(0.118, 6, 4), { p: [0.118, -0.06, 0] })
    .add('Suit', ball(0.118, 6, 4), { p: [-0.118, -0.06, 0] })
    .add('Pack', box(0.052, 0.17, 0.022), { p: [0.095, -0.02, 0.182], r: [8, 0, 26] })
    .add('Pack', box(0.052, 0.17, 0.022), { p: [-0.095, -0.02, 0.182], r: [8, 0, -26] })
    .add('Metal', box(0.056, 0.044, 0.028), { p: [0, -0.085, 0.19] });

  // Torso: pleated lower abdomen + broad sculpted Hard Upper Torso (no straight cylinders),
  // shoulder cowls, Display & Control Module (DCM) with umbilical ports, V-harness, and PLSS pack.
  P('Torso')
    .add('Suit', lathe([
      [0.18, -0.04],
      [0.215, 0.02],
      [0.20, 0.09],
      [0.27, 0.22],
      [0.295, 0.34],
      [0.265, 0.43],
      [0.175, 0.49],
    ], 8), { s: [1.06, 1, 0.78] })
    .add('Suit', ball(0.125, 6, 4), { p: [0.255, 0.4, 0], s: [1.05, 0.88, 0.92] })
    .add('Suit', ball(0.125, 6, 4), { p: [-0.255, 0.4, 0], s: [1.05, 0.88, 0.92] })
    // Chest DCM (Display and Control Module) & lower gas/water umbilical ports.
    .add('SuitGrey', box(0.25, 0.17, 0.095), { p: [0, 0.245, 0.22] })
    .add('Suit', box(0.26, 0.05, 0.105), { p: [0, 0.335, 0.215], r: [22, 0, 0] })
    .add('Visor', box(0.115, 0.045, 0.008), { p: [0, 0.28, 0.268] })
    .add('Metal', cyl(0.02, 0.02, 0.028, 6), { p: [0.085, 0.21, 0.268], r: [90, 0, 0] })
    .add('Metal', cyl(0.015, 0.015, 0.028, 6), { p: [-0.085, 0.21, 0.268], r: [90, 0, 0] })
    .add('Pack', box(0.05, 0.032, 0.024), { p: [0, 0.21, 0.268] })
    .add('Metal', cyl(0.024, 0.028, 0.036, 6), { p: [0.11, 0.1, 0.22], r: [82, -16, 0] })
    .add('Metal', cyl(0.024, 0.028, 0.036, 6), { p: [-0.11, 0.1, 0.22], r: [82, 16, 0] })
    // Front V-harness straps over the chest.
    .add('Pack', box(0.052, 0.34, 0.022), { p: [0.125, 0.3, 0.195], r: [10, 0, 14] })
    .add('Pack', box(0.052, 0.34, 0.022), { p: [-0.125, 0.3, 0.195], r: [10, 0, -14] })
    // Sculpted PLSS life-support backpack placed cleanly behind the larger helmet.
    .add('Pack', box(0.46, 0.56, 0.19), { p: [0, 0.27, -0.325] })
    .add('Suit', box(0.49, 0.14, 0.21), { p: [0, 0.51, -0.335], r: [-12, 0, 0] })
    .add('SuitGrey', box(0.32, 0.34, 0.045), { p: [0, 0.24, -0.43] })
    .add('Metal', cyl(0.048, 0.048, 0.42, 6), { p: [0.215, 0.24, -0.35] })
    .add('Metal', cyl(0.048, 0.048, 0.42, 6), { p: [-0.215, 0.24, -0.35] });

  // Head: larger, wider NASA EMU / Artemis pressurized helmet (top at ~1.91 m in world space),
  // outer protective EVVA shroud + brow hood, wide panoramic bubble visor, heavy neck ring,
  // chin bail frame, and side EHIP camera/lamp pods.
  P('Head')
    .add('Accent', cyl(0.168, 0.174, 0.026, 8), { p: [0, -0.014, 0] })
    .add('Metal', cyl(0.162, 0.172, 0.042, 8), { p: [0, 0.015, 0] })
    .add('Metal', ring(0.172, 0.024, 8, 3), { p: [0, 0.036, 0] })
    .add('Helmet', ball(0.205, 10, 6), { p: [0, 0.185, -0.005], s: [1.0, 1.0, 1.02] })
    // Outer EVVA sun-visor brow hood & side cheek cowls for the chunky layered EMU helmet look.
    .add('Helmet', box(0.28, 0.05, 0.13), { p: [0, 0.352, 0.095], r: [16, 0, 0] })
    .add('Helmet', box(0.32, 0.09, 0.22), { p: [0, 0.345, -0.055], r: [-8, 0, 0] })
    .add('Helmet', box(0.055, 0.19, 0.2), { p: [0.188, 0.23, -0.04] })
    .add('Helmet', box(0.055, 0.19, 0.2), { p: [-0.188, 0.23, -0.04] })
    // Panoramic bubble visor + grey visor trim & lower Artemis-style bail wire.
    .add(visorMaterial, shell(0.212, 8, 4, Math.PI / 2 - 1.06, 2.12, 0.56, 1.24), { p: [0, 0.182, 0.004] })
    .add('SuitGrey', box(0.27, 0.024, 0.04), { p: [0, 0.328, 0.145], r: [16, 0, 0] })
    .add('Metal', box(0.24, 0.014, 0.016), { p: [0, 0.065, 0.172], r: [-18, 0, 0] })
    .add('Metal', box(0.016, 0.014, 0.14), { p: [0.132, 0.072, 0.115], r: [-8, 22, 0] })
    .add('Metal', box(0.016, 0.014, 0.14), { p: [-0.132, 0.072, 0.115], r: [-8, -22, 0] });

  for (const side of [1, -1]) {
    P('Head')
      .add('SuitGrey', box(0.058, 0.075, 0.105), { p: [side * 0.214, 0.21, 0.025] })
      .add('Lamp', box(0.038, 0.042, 0.012), { p: [side * 0.214, 0.21, 0.08] });
  }

  for (const [suffix, side] of [['L', 1], ['R', -1]]) {
    // Upper arm: padded shoulder ball, metal scye bearing, bellowed sleeve, side utility pocket.
    P(`UpperArm_${suffix}`)
      .add('Suit', ball(0.115, 6, 4), { p: [side * 0.012, -0.01, 0], s: [1.08, 0.96, 1.04] })
      .add('Metal', cyl(0.108, 0.102, 0.034, 8), { p: [side * 0.015, -0.065, 0], r: [0, 0, -side * 12] })
      .add('Suit', lathe([
        [0.074, -0.29],
        [0.098, -0.23],
        [0.084, -0.175],
        [0.104, -0.12],
        [0.092, -0.06],
      ], 8), { p: [side * 0.015, 0, 0] })
      .add('Suit', box(0.036, 0.1, 0.076), { p: [side * 0.106, -0.175, 0] });

    // Forearm: elbow puff, bellowed sleeve, heavy metallic wrist disconnect ring, right wrist mirror.
    P(`LowerArm_${suffix}`)
      .add('Suit', ball(0.086, 6, 4), { p: [side * 0.012, -0.004, 0] })
      .add('Suit', lathe([
        [0.07, -0.225],
        [0.092, -0.165],
        [0.082, -0.115],
        [0.096, -0.065],
        [0.082, -0.01],
      ], 8), { p: [side * 0.008, 0, 0] })
      .add('Metal', cyl(0.076, 0.08, 0.042, 8), { p: [0, -0.228, 0] });
    if (suffix === 'R') {
      P('LowerArm_R')
        .add('Metal', box(0.044, 0.068, 0.018), { p: [-0.04, -0.155, 0.078], r: [0, -24, 0] });
    }

    // Hand: gauntlet cuff, thick EVA padded palm, articulated finger mitt, thumb.
    P(`Hand_${suffix}`)
      .add('Glove', cyl(0.068, 0.062, 0.048, 8), { p: [0, -0.018, 0] })
      .add('Glove', box(0.092, 0.095, 0.106), { p: [0, -0.07, 0.002] })
      .add('Glove', box(0.088, 0.064, 0.094), { p: [0, -0.135, 0.012], r: [12, 0, 0] })
      .add('GloveTip', box(0.09, 0.028, 0.096), { p: [0, -0.172, 0.02], r: [12, 0, 0] })
      .add('Glove', box(0.034, 0.064, 0.038), { p: [-side * 0.048, -0.078, 0.042], r: [8, 0, side * 14] });

    // Upper leg: bellowed thigh (offset outward to avoid inner-thigh clipping), cargo pocket, quilted knee pad.
    P(`UpperLeg_${suffix}`)
      .add('Suit', lathe([
        [0.096, -0.365],
        [0.118, -0.3],
        [0.105, -0.22],
        [0.13, -0.12],
        [0.11, -0.01],
      ], 8), { p: [side * 0.016, 0, 0] })
      .add('Suit', ball(0.1, 6, 4), { p: [side * 0.016, -0.375, 0] })
      .add('Suit', box(0.145, 0.096, 0.054), { p: [side * 0.016, -0.365, 0.092] })
      .add('Suit', box(0.044, 0.15, 0.12), { p: [side * 0.135, -0.18, 0.01] })
      .add('Suit', box(0.048, 0.026, 0.124), { p: [side * 0.135, -0.12, 0.01] });

    // Lower leg: bellowed calf with lower gaiter flare, outer shin pouch.
    P(`LowerLeg_${suffix}`)
      .add('Suit', lathe([
        [0.098, -0.385],
        [0.088, -0.31],
        [0.114, -0.185],
        [0.108, -0.095],
        [0.096, -0.02],
      ], 8), { p: [side * 0.016, 0, 0] })
      .add('Suit', box(0.04, 0.14, 0.1), { p: [side * 0.118, -0.19, 0.005] });

    // Boot: bulky EVA lunar/Mars boot + chunky sole sitting flat at world y = 0 (Foot local y = -0.12).
    P(`Foot_${suffix}`)
      .add('Boot', box(0.145, 0.06, 0.13), { p: [side * 0.016, 0, -0.015] })
      .add('Boot', box(0.165, 0.085, 0.265), { p: [side * 0.016, -0.045, 0.03] })
      .add('Boot', box(0.155, 0.06, 0.09), { p: [side * 0.016, -0.058, 0.155], r: [12, 0, 0] })
      .add('Sole', box(0.178, 0.042, 0.305), { p: [side * 0.016, -0.099, 0.042] });
  }
}

/** Accent stripe on the outer side of a limb (colored EVA suit ID stripe). */
export function addLimbStripe(
  avatar,
  pivot,
  side,
  { y, length, offset = 0.118, width = 0.052, depth = 0.016, material = 'Accent' },
) {
  avatar.part(pivot).add(material, box(depth, length, width), { p: [side * offset, y, 0] });
}

/** Accent band wrapping around a limb segment. */
export function addLimbBand(
  avatar,
  pivot,
  { y, radius, height = 0.034, x = 0, s = [1, 1, 1], r = [0, 0, 0], segments = 8, material = 'Accent' },
) {
  avatar.part(pivot).add(material, cyl(radius, radius, height, segments), { p: [x, y, 0], r, s });
}

/** Diagonal or vertical chest/hip harness stripe for character differentiation. */
export function addHarnessStripe(avatar, pivot, { p, s, r = [0, 0, 0], material = 'Accent' }) {
  avatar.part(pivot).add(material, box(s[0], s[1], s[2]), { p, r });
}

/** Punctual identifying stripe pattern on the helmet hood (`crest`, `twin`, `brow`, or `temple`). */
export function addHelmetStripe(avatar, style, material = 'Accent') {
  const head = avatar.part('Head');
  if (style === 'crest') {
    head
      .add(material, box(0.056, 0.032, 0.145), { p: [0, 0.372, 0.088], r: [16, 0, 0] })
      .add(material, box(0.056, 0.032, 0.22), { p: [0, 0.386, -0.058], r: [-8, 0, 0] })
      .add(material, box(0.056, 0.14, 0.032), { p: [0, 0.295, -0.195], r: [20, 0, 0] });
  } else if (style === 'twin') {
    for (const side of [1, -1]) {
      head
        .add(material, box(0.036, 0.03, 0.14), { p: [side * 0.072, 0.368, 0.088], r: [16, 0, 0] })
        .add(material, box(0.036, 0.03, 0.21), { p: [side * 0.072, 0.382, -0.058], r: [-8, 0, 0] });
    }
  } else if (style === 'brow') {
    head
      .add(material, box(0.285, 0.028, 0.03), { p: [0, 0.352, 0.148], r: [16, 0, 0] })
      .add(material, box(0.022, 0.028, 0.14), { p: [0.155, 0.348, 0.06], r: [8, 0, 0] })
      .add(material, box(0.022, 0.028, 0.14), { p: [-0.155, 0.348, 0.06], r: [8, 0, 0] });
  } else if (style === 'temple') {
    for (const side of [1, -1]) {
      head
        .add(material, box(0.026, 0.044, 0.19), { p: [side * 0.214, 0.29, -0.02] })
        .add(material, box(0.024, 0.026, 0.13), { p: [side * 0.212, 0.326, 0.015], r: [12, 0, 0] });
    }
  }
}
