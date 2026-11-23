import { addHarnessStripe, addHelmetStripe, addLimbBand, addLimbStripe } from '../lib/avatar.mjs';
import { box, cyl } from '../lib/shapes.mjs';
import { smooth } from '../lib/animations.mjs';

/** White cross on a green square (ISO 7010 first-aid sign; the red cross emblem is legally protected). */
function addFirstAidSign(part, { p, size, normalAxis }) {
  const [x, y, z] = p;
  const t = 0.01;
  const thin = size * 0.22;
  const long = size * 0.7;
  if (normalAxis === 'z') {
    part.add('Accent', box(size, size, t), { p });
    part.add('Suit', box(long, thin, t), { p: [x, y, z - t * 0.6] });
    part.add('Suit', box(thin, long, t), { p: [x, y, z - t * 0.6] });
  } else {
    part.add('Accent', box(t, size, size), { p });
    part.add('Suit', box(t, thin, long), { p: [x + t * 0.6, y, z] });
    part.add('Suit', box(t, long, thin), { p: [x + t * 0.6, y, z] });
  }
}

export default {
  id: 'maya',
  name: 'Maya',
  role: 'Cientista de Missão e Oficial Médica',
  accent: '#2BB673',
  visor: 'Visor',
  summary:
    'Listras laterais verdes no capacete, faixa transversal no peito, listras verticais nas coxas e faixas únicas nas panturrilhas e punhos, com pá de coleta.',
  equipment: [
    { item: 'Listras laterais no capacete, faixa no peito, verticais nas coxas e faixas na panturrilha e punho', basis: 'Marcações verdes para identificação da cientista e oficial médica' },
    { item: 'Pá/ancinho de coleta com cabo longo', basis: 'Ferramentas de geologia de Harrison Schmitt na Apollo 17' },
    { item: 'Bolsas de amostra no quadril e na mochila', basis: 'Bolsas de coleta penduradas na mochila nas EVAs da Apollo' },
    { item: 'Câmera no peito', basis: 'Câmera Hasselblad presa ao peito na Apollo' },
    { item: 'Símbolo de primeiros socorros (cruz branca em fundo verde)', basis: 'Oficial médica; padrão ISO 7010 de primeiros socorros' },
  ],
  animations: {
    idle_loop: 'Parada, respirando',
    walk_loop: 'Caminhada em baixa gravidade',
    wave: 'Aceno',
    salute: 'Continência',
    action_loop: 'Agachando para coletar amostra (poeira na pá)',
  },

  build(avatar) {
    // Signature emerald science/medical stripes: temple helmet stripes, diagonal chest sash,
    // outer thigh vertical stripes, single calf band, shoulder-cuff arm band, wrist gauntlet band.
    addHelmetStripe(avatar, 'temple');
    addHarnessStripe(avatar, 'Torso', { p: [0.06, 0.34, 0.22], s: [0.036, 0.28, 0.016], r: [8, 0, -44] });

    for (const [s, side] of [['L', 1], ['R', -1]]) {
      addLimbStripe(avatar, `UpperLeg_${s}`, side, { y: -0.18, length: 0.25, offset: 0.16 });
      addLimbBand(avatar, `LowerLeg_${s}`, { y: -0.305, radius: 0.104, height: 0.032, x: side * 0.016 });
      addLimbBand(avatar, `UpperArm_${s}`, { y: -0.105, radius: 0.106, height: 0.03, x: side * 0.015 });
      addLimbBand(avatar, `LowerArm_${s}`, { y: -0.19, radius: 0.088, height: 0.026, x: side * 0.005 });
    }

    const torso = avatar.part('Torso');
    addFirstAidSign(torso, { p: [0, 0.24, -0.458], size: 0.16, normalAxis: 'z' });
    // Chest camera mounted cleanly below the chest DCM.
    torso.add('Pack', box(0.095, 0.082, 0.072), { p: [0, 0.115, 0.26] });
    torso.add('Visor', cyl(0.026, 0.026, 0.042, 8), { p: [0, 0.115, 0.31], r: [90, 0, 0] });
    // Sample bag hanging from the pack.
    torso.add('Bag', box(0.125, 0.165, 0.065), { p: [0.18, 0.03, -0.45] });
    torso.add('Accent', box(0.128, 0.032, 0.068), { p: [0.18, 0.105, -0.45] });

    addFirstAidSign(avatar.part('UpperArm_L'), { p: [0.127, -0.175, 0], size: 0.062, normalAxis: 'x' });

    // Hip sample bag fitted over the wider hip profile.
    avatar.part('Hips').add('Bag', box(0.105, 0.135, 0.065), { p: [0.248, -0.075, 0.02], r: [0, 0, 8] });
    avatar.part('Hips').add('Accent', box(0.108, 0.028, 0.068), { p: [0.254, -0.015, 0.02], r: [0, 0, 8] });

    // Temporary action props: long-handled scoop in Hand_R and regolith sample mound + canister on the ground.
    const scoop = avatar.prop('Hand_R', 'Scoop');
    scoop
      .add('Metal', cyl(0.012, 0.012, 0.86, 6), { p: [0, -0.36, 0.04] })
      .add('Accent', cyl(0.017, 0.017, 0.1, 6), { p: [0, -0.02, 0.04] })
      .add('Metal', box(0.11, 0.025, 0.13), { p: [0, -0.8, 0.08], r: [20, 0, 0] })
      .add('Metal', box(0.11, 0.05, 0.015), { p: [0, -0.78, 0.14], r: [20, 0, 0] });

    const sample = avatar.prop('root', 'Sample');
    sample
      .add('Foam', cyl(0.14, 0.22, 0.07, 6), { p: [0.02, 0.037, 0.44] })
      .add('Foam', cyl(0.07, 0.13, 0.05, 5), { p: [0.04, 0.08, 0.45], r: [5, 18, -6] })
      .add('Foam', box(0.055, 0.03, 0.048), { p: [-0.07, 0.019, 0.39], r: [0, 25, 0] })
      .add('Accent', cyl(0.036, 0.038, 0.15, 6), { p: [-0.18, 0.077, 0.38] })
      .add('Accent', box(0.082, 0.022, 0.082), { p: [-0.18, 0.155, 0.38] });

    avatar.anchor('FX_Scoop', 'Hand_R', { p: [0, -0.8, 0.08] }, { preset: 'dust', clips: ['action_loop'] });
  },

  action: {
    duration: 2.6,
    samples: 26,
    pose(u) {
      const d = smooth(0.08, 0.35, u) * (1 - smooth(0.7, 0.95, u));
      const scoop = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.38) / 0.32)));
      return {
        Hips: { p: [0, -0.18 * d * d, 0] },
        UpperLeg_L: { r: [-45 * d, 0, 4 * d] },
        UpperLeg_R: { r: [-45 * d, 0, -4 * d] },
        LowerLeg_L: { r: [80 * d, 0, 0] },
        LowerLeg_R: { r: [80 * d, 0, 0] },
        Foot_L: { r: [-35 * d, 0, 0] },
        Foot_R: { r: [-35 * d, 0, 0] },
        Torso: { r: [28 * d, 0, 0] },
        Head: { r: [22 * d, 0, 0] },
        UpperArm_R: { r: [-8 * d - 10 * scoop, 0, 24 * d] },
        LowerArm_R: { r: [-76 * d + 6 * scoop, 0, 0] },
        Hand_R: { r: [64 * d - 14 * scoop, 0, 0] },
        UpperArm_L: { r: [-25 * d, 0, 8 * d] },
        LowerArm_L: { r: [-45 * d, 0, 0] },
      };
    },
  },
};
