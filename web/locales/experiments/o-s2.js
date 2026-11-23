// Texts of O-S2 · Radio geodesy (English and Portuguese). Merged into translation.experiments['O-S2'].
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) (pack.translation.experiments ||= {})['O-S2'] = value; };

  put('en', {
    title: 'Radio geodesy',
    minigame: 'Tune the Doppler',
    basis: 'RISE on InSight (2018–22)',
    desc: 'The lander’s radio tone slides slowly across the receiver as Mars turns. Turn the tuner to keep the tone inside the lock window: every locked minute of today’s session adds to the measurement of the planet’s core.',
    fact: 'Real fact: only by tracking InSight’s radio for ~{{sols}} sols did scientists measure that Mars’s liquid core has a radius of ~{{core}} and that the planet’s rotation is speeding up.',
    powerReadout: 'X-BAND · {{watts}} W',
    timeReadout: 'LOCKED {{got}}/{{max}} MIN · {{left}} s',
    lockLabel: 'Locked time (goal {{need}} of {{max}} min)',
    signalLabel: 'Signal in the tuner · {{pct}}%',
    dialLabel: 'Tuner',
    tuneDown: 'Tune lower',
    tuneUp: 'Tune higher',
    canvasSol: 'SOL {{sol}} OF ~{{total}}',
    canvasAxis: 'DOPPLER ↔',
    canvasNoLink: 'NO LINK TO EARTH',
    state: { locked: '✓ LOCKED', acquiring: 'ACQUIRING…', searching: 'SEARCHING', nolink: 'NO LINK' },
    status: {
      locked: 'Locked: hold the tone inside the window as it slides.',
      acquiring: 'The tone is in the window: hold it there to lock.',
      searching: 'Lock lost: find the bright tone in the waterfall and bring the window over it.',
      nolink: '',
    },
    statusInitial: 'Turn the dial (or hold ◀ ▶, ← → or A D) to bring the lock window over the bright tone and keep it there. Goal: {{need}} of the {{max}}-minute session locked.',
    statusBack: 'Link back: the tone kept sliding while it was gone. Find it again.',
    statusDone: 'Session over: {{got}} minutes of locked Doppler for the core measurement.',
    failLost: 'The lock held for only {{got}} of the {{need}} minutes needed: today’s session is lost, and the experiment takes longer (RISE needed ~{{sols}} sols of tracking).',
    summary: 'Locked {{got}} of {{max}} min ({{pct}}% of the best)',
    event: {
      earthSet: 'Earth is setting: RISE needs a direct link to Earth, and the signal is gone for a few seconds. The tone keeps sliding.',
      conjunction: 'Near solar conjunction: the Sun sits close to the line to Earth, and the tone jitters.',
      dustyPanels: 'Dusty solar panels (dust ended InSight in 2022): less power, so the tone is faint in the noise.',
    },
    mods: { earthSet: 'Earth setting', conjunction: 'Near conjunction', dustyPanels: 'Dusty panels' },
  });

  put('pt', {
    title: 'Radiogeodésia',
    minigame: 'Sintonizar o Doppler',
    basis: 'RISE no InSight (2018–22)',
    desc: 'O tom de rádio do módulo de pouso desliza devagar pelo receptor enquanto Marte gira. Gire o sintonizador para manter o tom dentro da janela de travamento: cada minuto travado da sessão de hoje soma na medição do núcleo do planeta.',
    fact: 'Fato real: só acompanhando o rádio do InSight por ~{{sols}} sóis os cientistas mediram que o núcleo líquido de Marte tem raio de ~{{core}} e que a rotação do planeta está acelerando.',
    powerReadout: 'BANDA X · {{watts}} W',
    timeReadout: 'TRAVADO {{got}}/{{max}} MIN · {{left}} s',
    lockLabel: 'Tempo travado (meta {{need}} de {{max}} min)',
    signalLabel: 'Sinal no sintonizador · {{pct}}%',
    dialLabel: 'Sintonizador',
    tuneDown: 'Sintonizar mais baixo',
    tuneUp: 'Sintonizar mais alto',
    canvasSol: 'SOL {{sol}} DE ~{{total}}',
    canvasAxis: 'DOPPLER ↔',
    canvasNoLink: 'SEM LINK COM A TERRA',
    state: { locked: '✓ TRAVADO', acquiring: 'TRAVANDO…', searching: 'PROCURANDO', nolink: 'SEM LINK' },
    status: {
      locked: 'Travado: mantenha o tom dentro da janela enquanto ele desliza.',
      acquiring: 'O tom está na janela: segure aí para travar.',
      searching: 'Travamento perdido: ache o tom brilhante na cascata e leve a janela até ele.',
      nolink: '',
    },
    statusInitial: 'Gire o botão (ou segure ◀ ▶, ← → ou A D) para levar a janela de travamento até o tom brilhante e mantê-la lá. Meta: {{need}} da sessão de {{max}} minutos travados.',
    statusBack: 'Link de volta: o tom continuou deslizando enquanto sumiu. Ache-o de novo.',
    statusDone: 'Sessão encerrada: {{got}} minutos de Doppler travado para a medição do núcleo.',
    failLost: 'O travamento durou só {{got}} dos {{need}} minutos necessários: a sessão de hoje se perdeu, e o experimento demora mais (o RISE precisou de ~{{sols}} sóis de acompanhamento).',
    summary: 'Travado {{got}} de {{max}} min ({{pct}}% do melhor)',
    event: {
      earthSet: 'A Terra está se pondo: o RISE precisa de link direto com a Terra, e o sinal some por alguns segundos. O tom continua deslizando.',
      conjunction: 'Perto da conjunção solar: o Sol fica perto da linha até a Terra, e o tom treme.',
      dustyPanels: 'Painéis solares empoeirados (a poeira encerrou o InSight em 2022): menos energia, e o tom fica fraco no ruído.',
    },
    mods: { earthSet: 'Terra se pondo', conjunction: 'Perto da conjunção', dustyPanels: 'Painéis empoeirados' },
  });
})();
