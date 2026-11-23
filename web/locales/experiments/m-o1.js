// Texts of M-O1 · High-resolution photo (English and Portuguese). Merged into translation.experiments['M-O1'].
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) (pack.translation.experiments ||= {})['M-O1'] = value; };

  put('en', {
    title: 'High-resolution photo',
    minigame: 'Perfect shot',
    basis: 'HiRISE on Mars Reconnaissance Orbiter (2006–today)',
    desc: 'Mars scrolls below the orbiter. Take each photo when the target crosses the centre of the frame: the closer to the centre, the sharper the image. The recorder only holds a few images.',
    fact: 'Real fact: HiRISE sees {{detail}} details from orbit and took its 100,000th photo in 2025. Its images help choose where to land safely.',
    photosReadout: 'TARGETS {{got}} / {{n}}',
    recorderReadout: 'RECORDER {{left}} IMG',
    qualityReadout: 'SHARPNESS {{pct}}%',
    shootBtn: 'Take the photo (Space)',
    readoutBtn: 'Reading out the image…',
    kinds: { crater: 'crater', delta: 'river delta', dunes: 'dune field' },
    statusInitial: 'MRO flies over {{n}} targets. Take each photo (Space, or tap the button or the picture) when the target crosses the centre line of the frame. HiRISE ({{kg}}, {{watts}} W) makes images of up to {{gb}} Gb, so the recorder holds only {{shots}}.',
    statusPerfect: 'Perfect shot: the {{kind}} is centred, {{pct}}% sharp.',
    statusShot: 'Photo of the {{kind}}: {{pct}}% sharp. Closer to the centre line is sharper.',
    statusHazy: 'Photo of the {{kind}} through the dust: only {{pct}}% sharp.',
    statusEmpty: 'Empty frame: no target in it. That image (up to {{gb}} Gb) is wasted recorder space.',
    statusMissed: 'The {{kind}} left the frame without a photo.',
    statusReadout: 'Still reading out the last image: wait a moment.',
    statusFull: 'The recorder is full: no room for another image.',
    statusDone: 'Pass over: {{got}} of {{n}} targets imaged for the landing-site maps.',
    failBlur: 'Only {{got}} of {{n}} targets came out in frame. Each HiRISE image can hold up to {{gb}} Gb, so the blurred and empty ones wasted hours of downlink for Oscar, and the landing sites stay unmapped.',
    summary: '{{got}} of {{n}} targets · {{pct}}% of the best sharpness · {{wasted}} wasted image(s)',
    event: {
      dustStorm: 'Dust storm ahead: the haze over this part of the pass will soften the images. Mars dust storms can cover the planet: one ended the Opportunity rover in 2018.',
      fullRecorder: 'Recorder almost full: one spare image fewer this pass.',
    },
    mods: { dustStorm: 'Dust storm', fullRecorder: 'Full recorder' },
  });

  put('pt', {
    title: 'Foto em alta resolução',
    minigame: 'Clique perfeito',
    basis: 'HiRISE na Mars Reconnaissance Orbiter (2006–hoje)',
    desc: 'Marte passa embaixo do orbitador. Tire cada foto quando o alvo cruzar o centro do quadro: quanto mais perto do centro, mais nítida a imagem. O gravador só guarda algumas imagens.',
    fact: 'Fato real: a HiRISE enxerga detalhes de {{detail}} lá da órbita e tirou sua foto número 100.000 em 2025. As imagens dela ajudam a escolher onde pousar com segurança.',
    photosReadout: 'ALVOS {{got}} / {{n}}',
    recorderReadout: 'GRAVADOR {{left}} IMG',
    qualityReadout: 'NITIDEZ {{pct}}%',
    shootBtn: 'Tirar a foto (Espaço)',
    readoutBtn: 'Lendo a imagem…',
    kinds: { crater: 'cratera', delta: 'delta de rio', dunes: 'campo de dunas' },
    statusInitial: 'A MRO passa sobre {{n}} alvos. Tire cada foto (Espaço, o botão ou a imagem) quando o alvo cruzar a linha central do quadro. A HiRISE ({{kg}}, {{watts}} W) faz imagens de até {{gb}} Gb, então o gravador só guarda {{shots}}.',
    statusPerfect: 'Clique perfeito: {{kind}} no centro, {{pct}}% de nitidez.',
    statusShot: 'Foto de {{kind}}: {{pct}}% de nitidez. Mais perto da linha central fica mais nítida.',
    statusHazy: 'Foto de {{kind}} através da poeira: só {{pct}}% de nitidez.',
    statusEmpty: 'Quadro vazio: nenhum alvo nele. Essa imagem (até {{gb}} Gb) desperdiçou espaço do gravador.',
    statusMissed: 'Alvo ({{kind}}) saiu do quadro sem foto.',
    statusReadout: 'Ainda lendo a última imagem: espere um instante.',
    statusFull: 'O gravador está cheio: não cabe outra imagem.',
    statusDone: 'Passagem concluída: {{got}} de {{n}} alvos fotografados para os mapas de pouso.',
    failBlur: 'Só {{got}} de {{n}} alvos saíram no quadro. Cada imagem da HiRISE pode ter até {{gb}} Gb, então as borradas e vazias gastaram horas de transmissão do Oscar, e os locais de pouso ficam sem mapa.',
    summary: '{{got}} de {{n}} alvos · {{pct}}% da melhor nitidez · {{wasted}} imagem(ns) desperdiçada(s)',
    event: {
      dustStorm: 'Tempestade de poeira à frente: a névoa nesta parte da passagem vai deixar as imagens menos nítidas. As tempestades de poeira de Marte podem cobrir o planeta: uma delas encerrou o rover Opportunity em 2018.',
      fullRecorder: 'Gravador quase cheio: uma imagem reserva a menos nesta passagem.',
    },
    mods: { dustStorm: 'Tempestade de poeira', fullRecorder: 'Gravador cheio' },
  });
})();
