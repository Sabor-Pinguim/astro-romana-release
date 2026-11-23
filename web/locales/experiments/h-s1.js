// Texts of H-S1 · Escort route (English and Portuguese). Merged into translation.experiments['H-S1'].
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) (pack.translation.experiments ||= {})['H-S1'] = value; };

  put('en', {
    title: 'Surface escort',
    minigame: 'Escort route',
    basis: 'Mars traverse & Ingenuity recon (2021–24)',
    desc: 'Trace one trail through the crust elements in order, without stepping on ⚠ sand or crossing your own trail.',
    fact: 'Real fact: Scouting routes on Mars avoid smooth, featureless sand ripples. Ingenuity was planned for 5 flights and made 72 ({{dist}} in total), ending in Jan 2024 when its navigation camera lost visual reference over smooth sand on flight 72.',
    boardAria: 'Escort reconnaissance map',
    orderLabel: 'Order',
    moveUp: 'Move up', moveLeft: 'Move left', moveDown: 'Move down', moveRight: 'Move right',
    tileSandAria: 'Row {{row}}, column {{col}}, sand, impassable',
    tileAria: 'Row {{row}}, column {{col}}{{el}}{{onRoute}}',
    tileEl: ', element {{el}}',
    tileOnRoute: ', on the trail',
    waypoint: 'WAYPOINT {{reached}} / {{total}}',
    steps: '{{steps}} STEPS',
    stepsLimit: '{{steps}} / {{max}} STEPS',
    startStatus: 'Connect the crust elements in order ({{order}}) without touching ⚠ sand. Drag, tap the highlighted squares or use the arrows.',
    smoothHint: 'Watch out: smooth sand (≈) only shows when the escort is right next to it.',
    smoothSpotted: 'Smooth sand spotted (≈)! It looked safe from afar, as it did to Ingenuity on flight 72. Find a way around it.',
    rewound: 'Trail rewound. Next element: {{el}}.',
    adjacentHint: 'Step onto an adjacent highlighted square to extend the trail.',
    orderHint: 'Visit {{el}} first (the pulsing amber square).',
    limitHint: 'Battery limit: {{max}} steps. Tap an earlier square of the trail to rewind and find a shorter way.',
    headingTo: 'Heading to {{el}} (avoid ⚠ sand).',
    doneStatus: 'Escort route complete in {{steps}} steps (best possible: {{best}}).',
    summary: '{{steps}} steps · best possible {{best}}',
    elements: { O: 'Oxygen', Si: 'Silicon', Fe: 'Iron', Mg: 'Magnesium', Ca: 'Calcium' },
  });

  put('pt', {
    title: 'Escolta na superfície',
    minigame: 'Rota de escolta',
    basis: 'Travessia em Marte e reconhecimento do Ingenuity (2021–24)',
    desc: 'Trace uma trilha só pelos elementos da crosta, em ordem, sem pisar na ⚠ areia nem cruzar a própria trilha.',
    fact: 'Fato real: Rotas de reconhecimento em Marte evitam ondulações de areia lisa, sem textura. O Ingenuity foi planejado para 5 voos e fez 72 ({{dist}} no total); terminou em jan/2024, quando sua câmera de navegação perdeu a referência visual sobre areia lisa no voo 72.',
    boardAria: 'Mapa de reconhecimento da escolta',
    orderLabel: 'Ordem',
    moveUp: 'Mover para cima', moveLeft: 'Mover para a esquerda', moveDown: 'Mover para baixo', moveRight: 'Mover para a direita',
    tileSandAria: 'Linha {{row}}, coluna {{col}}, areia, intransponível',
    tileAria: 'Linha {{row}}, coluna {{col}}{{el}}{{onRoute}}',
    tileEl: ', elemento {{el}}',
    tileOnRoute: ', na trilha',
    waypoint: 'PONTO {{reached}} / {{total}}',
    steps: '{{steps}} PASSOS',
    stepsLimit: '{{steps}} / {{max}} PASSOS',
    startStatus: 'Ligue os elementos da crosta em ordem ({{order}}) sem tocar na ⚠ areia. Arraste, toque nas casas destacadas ou use as setas.',
    smoothHint: 'Cuidado: a areia lisa (≈) só aparece quando a escolta está bem ao lado dela.',
    smoothSpotted: 'Areia lisa à vista (≈)! De longe parecia segura, como pareceu ao Ingenuity no voo 72. Dê a volta.',
    rewound: 'Trilha retrocedida. Próximo elemento: {{el}}.',
    adjacentHint: 'Avance para uma casa vizinha destacada para estender a trilha.',
    orderHint: 'Visite {{el}} primeiro (a casa âmbar piscando).',
    limitHint: 'Limite da bateria: {{max}} passos. Toque numa casa anterior da trilha para voltar e achar um caminho mais curto.',
    headingTo: 'Indo para {{el}} (evite a ⚠ areia).',
    doneStatus: 'Rota de escolta concluída em {{steps}} passos (melhor possível: {{best}}).',
    summary: '{{steps}} passos · melhor possível {{best}}',
    elements: { O: 'Oxigênio', Si: 'Silício', Fe: 'Ferro', Mg: 'Magnésio', Ca: 'Cálcio' },
  });
})();
