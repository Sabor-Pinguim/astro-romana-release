// Texts of M-S2 · Laser on rocks (English and Portuguese). Merged into translation.experiments['M-S2'].
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) (pack.translation.experiments ||= {})['M-S2'] = value; };

  put('en', {
    title: 'Laser on rocks',
    minigame: 'Sharp shot',
    basis: 'SuperCam (Perseverance) and ChemCam (Curiosity)',
    desc: 'Fire the laser at small spots on a rock several metres away. The first hits on a spot only blow the dust off; the next ones read its chemistry. The mast sways, and the shots are limited.',
    fact: 'Real fact: Curiosity’s laser has fired more than 1 million times, though it was designed for 2 years. It reads rocks more than {{range}} away.',
    viewAria: 'Mast camera view of a rock with dusty target spots and the laser reticle',
    readReadout: 'READ {{read}} / {{need}}',
    shotsReadout: 'SHOTS {{left}} / {{total}}',
    distReadout: 'ROCK AT {{dist}}',
    fireBtn: 'Fire laser · {{watts}} W',
    legend: { dust: 'Dust layer', read: 'Chemistry reading', done: 'Spot read' },
    hint: 'Mouse: point and click. Touch: drag to aim, tap or press the button to fire. Keys: ← ↑ → ↓ / WASD and Space. Pick thin-dust spots: 3★ with up to {{three}} shots, 2★ up to {{two}}.',
    statusInitial: 'Read {{need}} spots on the rock {{dist}} away. Hit a spot to blow off its dust, then keep hitting it to read its chemistry.',
    statusAim: 'Time the shot: the mast sways and the spots drift under the reticle.',
    statusMiss: 'Missed: the burst hit bare rock. Shot wasted.',
    statusAlready: 'That spot is already read: shot wasted.',
    statusDust: 'Dust blown off: {{left}} layer(s) left on this spot.',
    statusDustClear: 'Clean rock! The next hits read its chemistry.',
    statusReading: 'Reading the plasma light: {{done}} of {{total}}.',
    statusSpotRead: 'Spot read: rich in {{el}} ({{sym}}). {{mb}} of data.',
    statusDevilGone: 'The dust devil moved on: the mast is steady again.',
    statusDone: '{{read}} spots read without touching the rock: {{mb}} of chemistry for Earth.',
    failShots: 'Not enough shots left to read the rest: {{read}} of {{need}} spots read. The bursts went into dust and bare rock, the sol’s laser time is over, and the rover drives on without this rock’s chemistry.',
    summary: '{{read}} spots read with {{shots}} shots (fewest possible {{best}}) · {{mb}}',
    elements: { Fe: 'iron', Si: 'silicon', Mg: 'magnesium', Ca: 'calcium' },
    event: {
      dustDevil: 'A dust devil passes the rover (they pass ~4 times a day, and many carry dust): the mast shakes, and {{count}} cleared spot(s) got dusty again.',
      heavyDust: 'A thick dust coat: every spot needs one more hit to clear.',
      farRock: 'Far rock: it is near SuperCam’s {{range}} reach, so the spots look tiny.',
    },
    mods: { dustDevil: 'Dust devil', heavyDust: 'Thick dust', farRock: 'Far rock' },
  });

  put('pt', {
    title: 'Laser nas rochas',
    minigame: 'Tiro certeiro',
    basis: 'SuperCam (Perseverance) e ChemCam (Curiosity)',
    desc: 'Dispare o laser em pontos pequenos de uma rocha a vários metros. Os primeiros acertos num ponto só tiram a poeira; os seguintes leem a química. O mastro balança e os disparos são limitados.',
    fact: 'Fato real: o laser do Curiosity já disparou mais de 1 milhão de vezes, embora tenha sido projetado para 2 anos. Ele lê rochas a mais de {{range}}.',
    viewAria: 'Vista da câmera do mastro com uma rocha, pontos-alvo com poeira e a mira do laser',
    readReadout: 'LIDOS {{read}} / {{need}}',
    shotsReadout: 'DISPAROS {{left}} / {{total}}',
    distReadout: 'ROCHA A {{dist}}',
    fireBtn: 'Disparar laser · {{watts}} W',
    legend: { dust: 'Camada de poeira', read: 'Leitura química', done: 'Ponto lido' },
    hint: 'Mouse: aponte e clique. Toque: arraste para mirar, toque rápido ou use o botão para disparar. Teclas: ← ↑ → ↓ / WASD e Espaço. Prefira pontos com pouca poeira: 3★ com até {{three}} disparos, 2★ até {{two}}.',
    statusInitial: 'Leia {{need}} pontos da rocha a {{dist}}. Acerte um ponto para tirar a poeira e continue acertando para ler a química.',
    statusAim: 'Escolha a hora do disparo: o mastro balança e os pontos passam sob a mira.',
    statusMiss: 'Errou: o pulso acertou a rocha nua. Disparo perdido.',
    statusAlready: 'Esse ponto já foi lido: disparo perdido.',
    statusDust: 'Poeira removida: falta(m) {{left}} camada(s) neste ponto.',
    statusDustClear: 'Rocha limpa! Os próximos acertos leem a química.',
    statusReading: 'Lendo a luz do plasma: {{done}} de {{total}}.',
    statusSpotRead: 'Ponto lido: rico em {{el}} ({{sym}}). {{mb}} de dados.',
    statusDevilGone: 'O redemoinho passou: o mastro voltou a ficar firme.',
    statusDone: '{{read}} pontos lidos sem tocar na rocha: {{mb}} de química para a Terra.',
    failShots: 'Não sobram disparos para ler o resto: {{read}} de {{need}} pontos lidos. Os pulsos foram para a poeira e a rocha nua, o tempo de laser do sol acabou e o rover segue viagem sem a química desta rocha.',
    summary: '{{read}} pontos lidos com {{shots}} disparos (mínimo possível {{best}}) · {{mb}}',
    elements: { Fe: 'ferro', Si: 'silício', Mg: 'magnésio', Ca: 'cálcio' },
    event: {
      dustDevil: 'Um redemoinho de poeira passa pelo rover (passam ~4 por dia, e muitos levam poeira): o mastro treme e {{count}} ponto(s) limpo(s) voltou(aram) a ficar empoeirado(s).',
      heavyDust: 'Uma camada grossa de poeira: cada ponto precisa de um acerto a mais para limpar.',
      farRock: 'Rocha distante: ela está perto do alcance de {{range}} da SuperCam, e os pontos parecem minúsculos.',
    },
    mods: { dustDevil: 'Redemoinho de poeira', heavyDust: 'Poeira grossa', farRock: 'Rocha distante' },
  });
})();
