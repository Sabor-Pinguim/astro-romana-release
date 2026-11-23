import { addHarnessStripe, addHelmetStripe, addLimbBand, addLimbStripe } from '../lib/avatar.mjs';
import { box, cyl } from '../lib/shapes.mjs';
import { wave } from '../lib/animations.mjs';

export default {
  id: 'helena',
  name: 'Helena',
  role: 'Comandante e Piloto',
  accent: '#D7263D',
  visor: 'VisorGold',
  summary:
    'Faixa central vermelha no capacete, listras no arnês do peito, duplas faixas horizontais nas coxas, visor dourado, propulsor SAFER nas costas e kit de manutenção com chave de fenda.',
  equipment: [
    { item: 'Faixa vermelha central no capacete, no arnês e duplas faixas nas coxas', basis: 'Comandantes da Apollo e o EV1 na ISS usam faixas vermelhas para identificação' },
    { item: 'Visor dourado panorâmico', basis: 'Visor com camada de ouro dos capacetes Apollo/EMU' },
    { item: 'Propulsor sob a mochila com 4 bocais', basis: 'SAFER, propulsor de resgate preso à base da mochila do EMU' },
    { item: 'Controle de mão abaixo do módulo do peito', basis: 'Controle manual do SAFER, montado no módulo de display do peito' },
    { item: 'Checklist no pulso esquerdo', basis: 'Cuff checklist usado em caminhadas espaciais' },
    { item: 'Chave de fenda EVA e painel de manutenção da nave (ação)', basis: 'Ferramenta manual de reparo e caixa de junção usadas em manutenção de espaçonaves e EVAs' },
  ],
  animations: {
    idle_loop: 'Parada, respirando',
    walk_loop: 'Caminhada em baixa gravidade',
    wave: 'Aceno',
    salute: 'Continência',
    action_loop: 'Usa a chave de fenda para ajustar um painel de manutenção da nave',
  },

  build(avatar) {
    // Signature red commander stripes: helmet center crest, chest V-harness,
    // twin thigh rings, single bicep ring, and vertical outer shin stripes.
    addHelmetStripe(avatar, 'crest');
    addHarnessStripe(avatar, 'Torso', { p: [0.125, 0.3, 0.21], s: [0.028, 0.32, 0.014], r: [10, 0, 14] });
    addHarnessStripe(avatar, 'Torso', { p: [-0.125, 0.3, 0.21], s: [0.028, 0.32, 0.014], r: [10, 0, -14] });

    for (const [s, side] of [['L', 1], ['R', -1]]) {
      addLimbBand(avatar, `UpperLeg_${s}`, { y: -0.265, radius: 0.116, height: 0.024, x: side * 0.016 });
      addLimbBand(avatar, `UpperLeg_${s}`, { y: -0.315, radius: 0.122, height: 0.024, x: side * 0.016 });
      addLimbStripe(avatar, `LowerLeg_${s}`, side, { y: -0.19, length: 0.24, offset: 0.14 });
      addLimbBand(avatar, `UpperArm_${s}`, { y: -0.105, radius: 0.106, height: 0.036, x: side * 0.015 });
    }

    // SAFER-style jet pack bolted under the life-support pack.
    const torso = avatar.part('Torso');
    torso.add('SuitGrey', box(0.5, 0.1, 0.23), { p: [0, -0.07, -0.325] });
    torso.add('Accent', box(0.51, 0.024, 0.24), { p: [0, -0.02, -0.325] });
    for (const x of [0.21, -0.21]) {
      for (const z of [-0.245, -0.405]) {
        torso.add('Metal', cyl(0.02, 0.03, 0.05, 5), { p: [x, -0.14, z] });
      }
    }
    // Hand controller mounted at the base of the chest DCM.
    torso.add('Pack', box(0.12, 0.045, 0.07), { p: [0, 0.138, 0.25] });
    torso.add('Metal', cyl(0.01, 0.012, 0.05, 6), { p: [0.03, 0.178, 0.255] });
    torso.add('LedRed', box(0.02, 0.012, 0.02), { p: [-0.03, 0.162, 0.27] });

    // Cuff checklist on the left forearm.
    avatar.part('LowerArm_L').add('SuitGrey', box(0.105, 0.075, 0.032), { p: [0, -0.145, 0.095] });
    avatar.part('LowerArm_L').add('Accent', box(0.105, 0.014, 0.034), { p: [0, -0.102, 0.095] });

    // Temporary action props: EVA screwdriver in Hand_R and spacecraft maintenance panel in front.
    const screwdriver = avatar.prop('Hand_R', 'Screwdriver');
    screwdriver
      .add('Accent', cyl(0.021, 0.018, 0.12, 6), { p: [0, -0.095, 0.028] })
      .add('Accent', box(0.04, 0.024, 0.04), { p: [0, -0.035, 0.028] })
      .add('Metal', cyl(0.007, 0.007, 0.14, 5), { p: [0, -0.225, 0.028] })
      .add('Metal', box(0.018, 0.028, 0.006), { p: [0, -0.3, 0.028] });

    const panel = avatar.prop('root', 'Panel');
    panel
      .add('Metal', box(0.05, 0.03, 0.24), { p: [0.16, 0.017, 0.54] })
      .add('Metal', box(0.05, 0.03, 0.24), { p: [-0.16, 0.017, 0.54] })
      .add('Metal', box(0.04, 0.86, 0.045), { p: [0.16, 0.46, 0.56] })
      .add('Metal', box(0.04, 0.86, 0.045), { p: [-0.16, 0.46, 0.56] })
      .add('Metal', box(0.42, 0.36, 0.12), { p: [0, 0.98, 0.54], r: [-18, 0, 0] })
      .add('Metal', box(0.026, 0.026, 0.018), { p: [-0.13, 0.91, 0.473], r: [-18, 0, 0] })
      .add('Metal', box(0.026, 0.026, 0.018), { p: [0.13, 0.91, 0.473], r: [-18, 0, 0] })
      .add('HullBlack', box(0.36, 0.28, 0.024), { p: [0, 0.959, 0.475], r: [-18, 0, 0] })
      .add('HullBlack', box(0.24, 0.14, 0.08), { p: [0, 0.72, 0.55] })
      .add('HullBlack', box(0.035, 0.1, 0.03), { p: [0.19, 0.96, 0.49], r: [-18, 0, 0] })
      .add('Screen', box(0.22, 0.044, 0.016), { p: [0, 1.027, 0.443], r: [-18, 0, 0] })
      .add('Screen', box(0.08, 0.028, 0.016), { p: [0, 0.91, 0.473], r: [-18, 0, 0] });

    avatar.anchor('FX_Sparks', 'Hand_R', { p: [0, -0.31, 0.028] }, {
      preset: 'sparks',
      clips: ['action_loop'],
    });
  },

  action: {
    duration: 2.4,
    samples: 24,
    pose(u) {
      const s = wave(u);
      const twist = 26 * wave(u, 2);
      return {
        Hips: { p: [0, -0.032, 0], r: [4, 0, 0] },
        UpperLeg_L: { r: [-20, 0, 3] },
        LowerLeg_L: { r: [34, 0, 0] },
        Foot_L: { r: [-18, 0, 0] },
        UpperLeg_R: { r: [-20, 0, -3] },
        LowerLeg_R: { r: [34, 0, 0] },
        Foot_R: { r: [-18, 0, 0] },
        Torso: { r: [14 + 1.5 * s, 0, 0] },
        Head: { r: [14, 3 * s, 0] },
        UpperArm_R: { r: [5, 16, 18] },
        LowerArm_R: { r: [-80, 0, 0] },
        Hand_R: { r: [0, twist, 0] },
        UpperArm_L: { r: [-8, -12, -10] },
        LowerArm_L: { r: [-64, 0, 0] },
      };
    },
  },
};
