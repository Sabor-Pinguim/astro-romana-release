import { addHarnessStripe, addHelmetStripe, addLimbBand, addLimbStripe } from '../lib/avatar.mjs';
import { ball, box, cyl } from '../lib/shapes.mjs';
import { cosWave, wave } from '../lib/animations.mjs';

export default {
  id: 'oscar',
  name: 'Oscar',
  role: 'Especialista de Dados e Telecom',
  accent: '#1FA2FF',
  visor: 'Visor',
  summary:
    'Faixa azul frontal na aba do capacete, ombreiras e bandas triplas de telemetria nos braços, antenas na mochila, tablet no pulso e antena portátil de solo.',
  equipment: [
    { item: 'Listra frontal no capacete, ombreiras azuis, bandas triplas nos braços e faixa alta nas coxas', basis: 'Padrão azul de telemetria inspirado nas alças e costuras dos trajes Artemis OCSS' },
    { item: 'Antena de chicote no topo da mochila', basis: 'Antena de rádio da mochila (PLSS) das EVAs da Apollo' },
    { item: 'Mini-antena parabólica', basis: 'Antenas de alto ganho (estilizado)' },
    { item: 'Tablet no antebraço esquerdo', basis: 'Display no pulso, evolução do cuff checklist' },
    { item: 'Câmera extra no capacete', basis: 'Câmera HD do conjunto de luzes e câmeras do capacete (EHIP) na ISS' },
    { item: 'Antena parabólica portátil de solo com tripé (ação)', basis: 'Terminais portáteis de solo e antenas de alto ganho usadas para enlace orbital' },
  ],
  animations: {
    idle_loop: 'Parado, respirando',
    walk_loop: 'Caminhada em baixa gravidade',
    wave: 'Aceno',
    salute: 'Continência',
    action_loop: 'Agacha para alinhar uma antena portátil de solo',
  },

  build(avatar) {
    // Signature electric-blue telemetry pattern: horizontal brow band on helmet, shoulder/clavicle
    // yoke stripes, triple bands on upper arms, single bold upper-thigh ring, outer calf stripe.
    addHelmetStripe(avatar, 'brow');
    addHarnessStripe(avatar, 'Torso', { p: [0.19, 0.44, 0.08], s: [0.11, 0.032, 0.14], r: [8, 0, -18] });
    addHarnessStripe(avatar, 'Torso', { p: [-0.19, 0.44, 0.08], s: [0.11, 0.032, 0.14], r: [8, 0, 18] });
    addHarnessStripe(avatar, 'Torso', { p: [0.11, 0.24, -0.456], s: [0.028, 0.3, 0.012] });
    addHarnessStripe(avatar, 'Torso', { p: [-0.11, 0.24, -0.456], s: [0.028, 0.3, 0.012] });

    for (const [s, side] of [['L', 1], ['R', -1]]) {
      addLimbBand(avatar, `UpperArm_${s}`, { y: -0.095, radius: 0.106, height: 0.022, x: side * 0.015 });
      addLimbBand(avatar, `UpperArm_${s}`, { y: -0.125, radius: 0.108, height: 0.014, x: side * 0.015 });
      addLimbBand(avatar, `UpperArm_${s}`, { y: -0.245, radius: 0.101, height: 0.022, x: side * 0.015 });
      addLimbBand(avatar, `UpperLeg_${s}`, { y: -0.065, radius: 0.13, height: 0.036, x: side * 0.016 });
      addLimbStripe(avatar, `LowerLeg_${s}`, side, { y: -0.19, length: 0.24, offset: 0.14 });
    }

    const torso = avatar.part('Torso');
    // Whip antenna on the top-left of the pack.
    torso.add('Metal', box(0.055, 0.055, 0.055), { p: [0.175, 0.59, -0.35] });
    torso.add('Metal', cyl(0.008, 0.008, 0.5, 5), { p: [0.175, 0.84, -0.35] });
    torso.add('Screen', ball(0.022, 6, 4), { p: [0.175, 1.09, -0.35] });
    // Small dish on the top-right of the pack.
    torso.add('Metal', cyl(0.012, 0.012, 0.08, 6), { p: [-0.165, 0.61, -0.34] });
    torso.add('Helmet', cyl(0.092, 0.028, 0.038, 8), { p: [-0.165, 0.67, -0.36], r: [-35, 0, 0] });
    torso.add('Metal', cyl(0.005, 0.005, 0.07, 4), { p: [-0.165, 0.71, -0.34], r: [-35, 0, 0] });

    // Data pad on the left forearm.
    avatar.part('LowerArm_L').add('Pack', box(0.105, 0.135, 0.024), { p: [0.008, -0.12, 0.096] });
    avatar.part('LowerArm_L').add('Screen', box(0.088, 0.114, 0.006), { p: [0.008, -0.12, 0.109] });
    avatar.part('LowerArm_L').add('Accent', box(0.108, 0.018, 0.028), { p: [0.008, -0.188, 0.096] });

    // Extra helmet camera mounted above the right temple pod of the larger EMU helmet.
    const head = avatar.part('Head');
    head.add('SuitGrey', box(0.054, 0.054, 0.095), { p: [-0.175, 0.34, 0.03], r: [0, 0, -24] });
    head.add('Visor', cyl(0.018, 0.018, 0.022, 6), { p: [-0.175, 0.34, 0.082], r: [90, 0, 0] });
    head.add('LedRed', box(0.013, 0.013, 0.013), { p: [-0.16, 0.37, 0.072] });

    // Temporary action prop: portable tripod ground dish antenna placed in front.
    const antenna = avatar.prop('root', 'Antenna');
    antenna
      .add('HullBlack', box(0.028, 0.37, 0.028), { p: [0, 0.175, 0.555], r: [-30, 0, 0] })
      .add('HullBlack', box(0.028, 0.37, 0.028), { p: [0.082, 0.175, 0.412], r: [15, 0, 26] })
      .add('HullBlack', box(0.028, 0.37, 0.028), { p: [-0.082, 0.175, 0.412], r: [15, 0, -26] })
      .add('HullBlack', box(0.08, 0.05, 0.08), { p: [0, 0.34, 0.46] })
      .add('Metal', cyl(0.2, 0.05, 0.08, 6), { p: [0, 0.42, 0.46], r: [30, 0, 0] })
      .add('Metal', box(0.018, 0.22, 0.018), { p: [0, 0.533, 0.525], r: [30, 0, 0] })
      .add('Screen', box(0.055, 0.025, 0.02), { p: [0, 0.34, 0.412], r: [-20, 0, 0] });

    avatar.anchor('FX_Antenna', 'root', { p: [0, 0.635, 0.585], r: [30, 0, 0] }, {
      preset: 'signal',
      clips: ['action_loop'],
    });
  },

  action: {
    duration: 2.6,
    samples: 26,
    pose(u) {
      const s = wave(u);
      const glance = 2 + 18 * cosWave(u);
      return {
        Hips: { p: [0, -0.345, 0] },
        UpperLeg_L: { r: [-68, 0, 8] },
        LowerLeg_L: { r: [112, 0, 0] },
        Foot_L: { r: [-44, 0, 0] },
        UpperLeg_R: { r: [-68, 0, -8] },
        LowerLeg_R: { r: [112, 0, 0] },
        Foot_R: { r: [-44, 0, 0] },
        Torso: { r: [32, 0, 0] },
        Head: { r: [glance, 4 * s, 0] },
        UpperArm_L: { r: [-36 + 3 * s, 0, -18] },
        LowerArm_L: { r: [-24, 0, 0] },
        UpperArm_R: { r: [-36 - 3 * s, 0, 18] },
        LowerArm_R: { r: [-24 + 5 * wave(u, 2), 0, 0] },
      };
    },
  },
};
