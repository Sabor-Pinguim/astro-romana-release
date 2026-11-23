// Shared texts of the experiment minigames (English and Portuguese). Loads after en.js and pt.js and before
// i18n.js; each experiment has its own file next to this one (<id>.js), merged into translation.experiments.
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) Object.assign(pack.translation.experiments ||= {}, value); };

  put('en', {
    common: {
      level: { easy: 'Easy level', normal: 'Normal level', hard: 'Hard level' },
      cap: 'Best result {{stars}}',
      restart: 'Restart · max {{stars}}',
      giveUp: 'End with 0 stars',
      failTitle: 'Attempt failed',
      stars: '{{stars}}',
      botWorking: '{{name}} (AI) is working on it…',
      botDone: '{{name}} (AI) finished: {{stars}}',
      takeOver: 'Take over from the AI',
    },
    mechanics: {
      keep: 'Keep in range', timing: 'Timing', aim: 'Aim', choice: 'Choice under a limit',
      pattern: 'Pattern search', route: 'Route planning', piloting: 'Piloting',
    },
    places: { orbit: 'Mars orbit', surface: 'Surface', descent: 'Descent' },
    orbit: {
      step: 'Mars orbit',
      title: 'Experiments from Mars orbit',
      intro: 'Before the descent, each crew member runs one experiment from orbit. The AI does the empty seats; take over to aim higher.',
      play: 'Play',
      takeOver: 'Take over',
      waiting: 'Waiting for {{name}}',
      done: 'Done {{stars}}',
      window: 'Orbit window {{time}}',
      startDescent: 'Start the descent',
      locked: 'Finish the experiments first',
      skip: 'Skip mine (0 stars)',
      windowClosed: 'The orbit window closed: unfinished experiments count 0 stars.',
    },
    results: {
      heading: 'Experiments',
      ai: 'AI',
      notDone: 'Not done',
      multiplier: 'Difficulty × {{mult}}',
    },
  });

  put('pt', {
    common: {
      level: { easy: 'Nível fácil', normal: 'Nível normal', hard: 'Nível difícil' },
      cap: 'Melhor resultado {{stars}}',
      restart: 'Recomeçar · máx. {{stars}}',
      giveUp: 'Encerrar com 0 estrela',
      failTitle: 'Tentativa falhou',
      stars: '{{stars}}',
      botWorking: '{{name}} (IA) está trabalhando nisso…',
      botDone: '{{name}} (IA) terminou: {{stars}}',
      takeOver: 'Assumir no lugar da IA',
    },
    mechanics: {
      keep: 'Manter na faixa', timing: 'Timing', aim: 'Mira', choice: 'Escolha sob limite',
      pattern: 'Busca de padrão', route: 'Planejar rota', piloting: 'Pilotagem',
    },
    places: { orbit: 'Órbita de Marte', surface: 'Superfície', descent: 'Descida' },
    orbit: {
      step: 'Órbita de Marte',
      title: 'Experimentos da órbita de Marte',
      intro: 'Antes da descida, cada tripulante faz um experimento em órbita. A IA cuida das vagas vazias; assuma o lugar dela para mirar mais alto.',
      play: 'Jogar',
      takeOver: 'Assumir',
      waiting: 'Esperando {{name}}',
      done: 'Feito {{stars}}',
      window: 'Janela orbital {{time}}',
      startDescent: 'Iniciar a descida',
      locked: 'Termine os experimentos primeiro',
      skip: 'Pular o meu (0 estrela)',
      windowClosed: 'A janela orbital fechou: experimentos não terminados contam 0 estrela.',
    },
    results: {
      heading: 'Experimentos',
      ai: 'IA',
      notDone: 'Não feito',
      multiplier: 'Dificuldade × {{mult}}',
    },
  });
})();
