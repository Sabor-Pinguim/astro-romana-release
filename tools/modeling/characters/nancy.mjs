import { box, cyl, ball, lathe } from '../lib/shapes.mjs';
import { smooth } from '../lib/animations.mjs';

// Nancy Grace Roman, NASA astronomer (non-playable). The body and clothes follow the team's
// full-length reference photo (white short-sleeved blouse, full dark skirt below the knee,
// flat shoes, purple badge); the head follows the reference portrait (cat-eye glasses, curly
// grey updo). The wooden ruler never leaves her right hand.

/** Turns an n-sided lathe/cylinder by half a segment so a flat facet faces the front (+Z). */
const flat = (geometry, segments) => geometry.rotateY(Math.PI / segments);

// Slimmer proportions than the suited astronauts: narrow shoulders, arms close to the body,
// feet close together (same pivots and hierarchy; see RIG in lib/avatar.mjs).
const RIG = {
  Head: { pos: [0, 0.45, 0] },
  UpperArm_L: { pos: [0.185, 0.37, 0], rest: [0, 0, 6] },
  LowerArm_L: { pos: [0, -0.28, 0], rest: [-8, 0, 0] },
  Hand_L: { pos: [0, -0.24, 0] },
  UpperArm_R: { pos: [-0.185, 0.37, 0], rest: [0, 0, -6] },
  LowerArm_R: { pos: [0, -0.28, 0], rest: [-8, 0, 0] },
  Hand_R: { pos: [0, -0.24, 0] },
  UpperLeg_L: { pos: [0.085, -0.05, 0] },
  UpperLeg_R: { pos: [-0.085, -0.05, 0] },
};

// Wooden ruler held in the right hand (a common 50 cm ruler; marks every 5 cm, stylized).
const RULER = { length: 0.5, width: 0.04, thickness: 0.009, grip: 0.06, tilt: -30, twist: -35 };
const RULER_GRIP = [0, -0.105, 0.012]; // Hand_R local: between the palm and the curled fingers

/** Ruler axis (unit vector) and center in Hand_R coordinates. */
function rulerFrame() {
  const a = (RULER.tilt * Math.PI) / 180;
  const dir = [0, -Math.cos(a), -Math.sin(a)];
  const along = RULER.length / 2 - RULER.grip;
  const center = RULER_GRIP.map((v, i) => v + dir[i] * along);
  return { dir, center };
}

// Blouse profile [radius, Torso y] and depth; the buttons and the badge sit on its front facet.
const BLOUSE = [
  [0.13, -0.05],
  [0.13, 0.03],
  [0.148, 0.13],
  [0.162, 0.22],
  [0.168, 0.29],
  [0.172, 0.34],
  [0.15, 0.385],
  [0.1, 0.425],
  [0.055, 0.445],
];
const BLOUSE_DEPTH = 0.8;
/** z of the blouse front facet at Torso height y. */
function blouseFront(y) {
  for (let i = 1; i < BLOUSE.length; i++) {
    const [r0, y0] = BLOUSE[i - 1];
    const [r1, y1] = BLOUSE[i];
    if (y <= y1) return Math.cos(Math.PI / 8) * BLOUSE_DEPTH * (r0 + ((y - y0) / (y1 - y0)) * (r1 - r0));
  }
  return 0;
}

function buildHead(h) {
  // Neck and a faceted egg-shaped head (flat front facet for the glasses).
  h.add('Skin', cyl(0.045, 0.05, 0.11, 6), { p: [0, 0.035, -0.005] });
  h.add('Skin', flat(lathe([
    [0.03, 0.05],
    [0.07, 0.07],
    [0.098, 0.115],
    [0.107, 0.17],
    [0.104, 0.215],
    [0.088, 0.26],
    [0.05, 0.29],
    [0.012, 0.3],
  ], 8), 8), { p: [0, 0, 0.012], s: [0.95, 1, 1] });
  h.add('Skin', cyl(0.013, 0.013, 0.045, 3), { p: [0, 0.14, 0.106], r: [-8, 0, 0] }); // nose

  // Smile.
  h.add('Lips', box(0.036, 0.009, 0.006), { p: [0, 0.098, 0.096] });

  for (const side of [1, -1]) {
    h.add('Skin', box(0.022, 0.05, 0.035), { p: [side * 0.097, 0.16, 0] }); // ears
    h.add('FoilGold', ball(0.012, 5, 3), { p: [side * 0.1, 0.122, 0] }); // earrings
    h.add('Lips', box(0.012, 0.007, 0.006), { p: [side * 0.022, 0.101, 0.094], r: [0, 0, side * 28] });

    // Cat-eye glasses: thick upswept top rim, thin lower rim, lenses and eyes behind them.
    h.add('Lens', box(0.054, 0.038, 0.004), { p: [side * 0.044, 0.172, 0.117] });
    h.add('HullBlack', box(0.066, 0.012, 0.009), { p: [side * 0.046, 0.192, 0.118], r: [0, 0, side * 4] })
      .add('HullBlack', box(0.02, 0.011, 0.009), { p: [side * 0.082, 0.198, 0.116], r: [0, 0, side * 28] })
      .add('HullBlack', box(0.05, 0.005, 0.007), { p: [side * 0.044, 0.152, 0.118] })
      .add('HullBlack', box(0.006, 0.036, 0.007), { p: [side * 0.073, 0.174, 0.117] })
      .add('HullBlack', box(0.005, 0.032, 0.007), { p: [side * 0.016, 0.172, 0.118] })
      .add('HullBlack', box(0.005, 0.007, 0.124), { p: [side * 0.09, 0.193, 0.056], r: [0, -side * 9.3, 0] })
      .add('HullBlack', box(0.013, 0.015, 0.004), { p: [side * 0.043, 0.17, 0.12] });
  }
  h.add('HullBlack', box(0.024, 0.006, 0.007), { p: [0, 0.184, 0.119] }); // bridge

  // Curly grey updo: a cap with the hairline above the forehead, a swept-up front roll
  // and curls around the sides and the back.
  h.add('Hair', ball(0.122, 8, 6), { p: [0, 0.232, -0.026], s: [1.02, 0.92, 1.03] })
    .add('Hair', ball(0.075, 8, 4), { p: [0, 0.3, 0.035], s: [1.25, 0.65, 0.85] });
  const curls = [
    // [phi (deg from +Z toward +X), y, horizontal radius, curl radius]
    [70, 0.215, 0.105, 0.042], [105, 0.19, 0.105, 0.046], [140, 0.18, 0.105, 0.046], [180, 0.19, 0.105, 0.046],
    [50, 0.275, 0.09, 0.044], [110, 0.27, 0.09, 0.046], [160, 0.275, 0.09, 0.046],
  ];
  for (const [phi, y, radius, size] of curls) {
    for (const side of phi === 180 ? [1] : [1, -1]) {
      const a = (phi * Math.PI) / 180;
      h.add('Hair', ball(size, 6, 4), { p: [side * radius * Math.sin(a), y, -0.03 + radius * Math.cos(a)] });
    }
  }
}

function buildTorso(t) {
  // White blouse tucked into the skirt.
  t.add('Suit', flat(lathe(BLOUSE, 8), 8), { s: [1, 1, BLOUSE_DEPTH] });
  // Pointed shirt collar: a band around the neck and two flaps lying on the upper chest.
  t.add('Suit', lathe([[0.05, 0.42], [0.053, 0.47]], 8));
  for (const side of [1, -1]) {
    t.add('Suit', box(0.05, 0.036, 0.008), { p: [side * 0.03, 0.41, blouseFront(0.41) + 0.006], r: [-38, 0, side * 32] });
  }
  // Buttons down the placket.
  for (const y of [0.07, 0.16, 0.25, 0.34]) {
    t.add('SuitGrey', box(0.012, 0.012, 0.004), { p: [0, y, blouseFront(y) + 0.002] });
  }
  // Purple badge on the left chest (reference photo): no real logo, only a white photo square.
  const by = 0.245;
  const bz = blouseFront(by) + 0.003;
  t.add('Accent', box(0.07, 0.045, 0.005), { p: [0.043, by, bz] });
  t.add('Suit', box(0.018, 0.026, 0.002), { p: [0.021, by, bz + 0.0035] });
}

function buildSkirt(hips) {
  // Full dark skirt below the knee with a high waist, closed at the hem so it never looks hollow.
  hips.add('Pack', flat(lathe([
    [0.02, -0.61],
    [0.315, -0.61],
    [0.29, -0.48],
    [0.24, -0.3],
    [0.195, -0.12],
    [0.178, 0],
    [0.15, 0.1],
    [0.145, 0.135],
    [0.05, 0.145],
  ], 8), 8), { s: [1, 1, 0.9] });
}

function buildArm(P, s, side) {
  // Short puffed sleeve (closed at the hem) over a bare arm.
  P(`UpperArm_${s}`)
    .add('Suit', ball(0.052, 8, 5), { p: [0, -0.015, 0], s: [1, 0.9, 1] })
    .add('Suit', flat(lathe([[0.043, -0.125], [0.052, -0.125], [0.056, -0.09], [0.056, -0.04], [0.05, 0]], 8), 8))
    .add('Skin', flat(lathe([[0.034, -0.29], [0.04, -0.2], [0.045, -0.11]], 6), 6));
  P(`LowerArm_${s}`)
    .add('Skin', ball(0.036, 6, 4))
    .add('Skin', flat(lathe([[0.027, -0.235], [0.033, -0.16], [0.039, -0.06], [0.037, 0]], 6), 6));
  // Hand: wrist, palm (facing the body), fingers curled toward the palm, thumb in front.
  P(`Hand_${s}`)
    .add('Skin', cyl(0.025, 0.027, 0.04, 6))
    .add('Skin', box(0.03, 0.078, 0.066), { p: [0, -0.055, 0.004] })
    .add('Skin', box(0.026, 0.065, 0.062), { p: [-side * 0.005, -0.12, 0.006], r: [0, 0, -side * 10] })
    .add('Skin', box(0.02, 0.046, 0.022), { p: [-side * 0.015, -0.055, 0.042], r: [-18, 0, -side * 10] });
}

function buildLeg(P, s) {
  P(`LowerLeg_${s}`).add('Skin', flat(lathe([
    [0.031, -0.37],
    [0.038, -0.3],
    [0.05, -0.16],
    [0.047, -0.06],
    [0.044, 0.05],
  ], 6), 6), { p: [0, 0, -0.004] });
  // Flat strapped shoes; the sole sits on y = 0 (Foot local y = -0.12).
  P(`Foot_${s}`)
    .add('Skin', cyl(0.03, 0.032, 0.06, 6), { p: [0, -0.01, 0] })
    .add('Skin', box(0.054, 0.03, 0.07), { p: [0, -0.072, 0.035], r: [22, 0, 0] })
    .add('HullBlack', box(0.066, 0.045, 0.09), { p: [0, -0.0975, -0.02] })
    .add('HullBlack', box(0.066, 0.034, 0.1), { p: [0, -0.103, 0.07] })
    .add('HullBlack', box(0.052, 0.028, 0.04), { p: [0, -0.106, 0.13] })
    .add('HullBlack', box(0.058, 0.006, 0.014), { p: [0, -0.056, 0.03], r: [22, 0, 0] });
}

function buildRuler(hand) {
  const { center } = rulerFrame();
  const transform = { p: center, r: [RULER.tilt, RULER.twist, 0] };
  hand.add('Wood', box(RULER.width, RULER.length, RULER.thickness), transform);
  // Graduation marks on the front face, every 5 cm (longer every 10 cm).
  for (let i = 1; i < 10; i++) {
    const len = i % 2 === 0 ? 0.016 : 0.01;
    const mark = box(len, 0.003, 0.002).translate(
      -RULER.width / 2 + len / 2,
      RULER.length / 2 - i * 0.05,
      RULER.thickness / 2 + 0.001,
    );
    hand.add('HullBlack', mark, transform);
  }
}

// Action pose (degrees), solved numerically so the ruler lies flat and level across the
// upturned left palm, 6 mm above it, while the right elbow is bent at about 90°.
const TAP = {
  UpperArm_R: [11, 36, -18],
  LowerArm_R: [-94, 0, 0],
  Hand_R: [8, 31, 23],
  UpperArm_L: [-4, -17, 9],
  LowerArm_L: [-60, 0, 0],
  Hand_L: [-21, 100, -2],
};
const TAP_LIFT = { LowerArm_R: [-7, 0, 0], Hand_R: [-4, 0, 0] }; // added at the top of each tap: lifts the ruler ~10 cm

export default {
  id: 'nancy',
  name: 'Nancy Grace Roman',
  role: 'Astrônoma da NASA (personagem não jogável)',
  accent: '#9B5DE5',
  astronaut: false,
  rig: RIG,
  summary:
    'Sem traje: blusa branca de manga curta com gola e botões, saia rodada escura abaixo do joelho, sapatos baixos de presilha, ' +
    'crachá roxo no peito, óculos gatinho, cabelo grisalho cacheado preso para cima e uma régua de madeira sempre na mão direita.',
  equipment: [
    { item: 'Régua de madeira de 50 cm com marcas a cada 5 cm', basis: 'Régua graduada comum de desenho e medição (marcas estilizadas)' },
    { item: 'Blusa branca de manga curta com gola, saia rodada escura e sapatos baixos', basis: 'Foto de corpo inteiro de referência fornecida pelo time' },
    { item: 'Crachá roxo no peito, sem logotipo', basis: 'Crachá da foto de referência; roxo é a cor de identidade da personagem' },
    { item: 'Óculos gatinho, cabelo grisalho cacheado preso para cima e brincos', basis: 'Retrato de referência fornecido pelo time' },
  ],
  animations: {
    idle_loop: 'Parada, respirando',
    walk_loop: 'Caminhada em baixa gravidade',
    wave: 'Aceno',
    salute: 'Continência',
    action_loop: 'Bate a régua na palma da mão esquerda, como uma professora',
  },

  build(avatar) {
    const P = avatar.part;
    buildHead(P('Head'));
    buildTorso(P('Torso'));
    buildSkirt(P('Hips'));
    for (const [s, side] of [['L', 1], ['R', -1]]) {
      buildArm(P, s, side);
      buildLeg(P, s);
    }
    buildRuler(P('Hand_R'));
  },

  action: {
    duration: 2.4,
    samples: 36,
    pose(u) {
      // Three taps per loop: a quick lift and a sharp landing on the palm (lift = 0 on contact).
      const lift = Math.pow(Math.abs(Math.sin(Math.PI * 3 * u)), 0.7);
      const breath = smooth(0, 1, 0.5 + 0.5 * Math.sin(2 * Math.PI * u)) - 0.5;
      const pose = {
        Torso: { r: [4 + breath, 0, 0] },
        Head: { r: [14 - 3 * lift, 0, 0] },
      };
      for (const [pivot, r] of Object.entries(TAP)) {
        const extra = TAP_LIFT[pivot] ?? [0, 0, 0];
        pose[pivot] = { r: r.map((v, i) => v + extra[i] * lift) };
      }
      return pose;
    },
  },
};

export { RULER, RULER_GRIP, rulerFrame, TAP };
