// Shared experiment screen texts (English, Portuguese and Spanish). Loads after en.js, pt.js and es.js
// and before i18n.js; each experiment has its own file next to this one (<id>.js), merged into translation.experiments.
(() => {
  'use strict';
  const L = window.ASTRO_LOCALES || (window.ASTRO_LOCALES = {});
  const put = (code, value) => { const pack = L[code]; if (pack) Object.assign(pack.translation.experiments ||= {}, value); };

  put('en', {
    mechanics: {
      keep: 'Keep in range', timing: 'Timing', aim: 'Aim', choice: 'Choice under a limit',
      pattern: 'Pattern search', route: 'Route planning', piloting: 'Piloting',
    },
    places: { orbit: 'Mars orbit', surface: 'Surface', descent: 'Descent' },
    orbit: {
      step: 'Mars orbit',
      eyebrow: 'Mars orbit / Science',
      title: 'Experiments from Mars orbit',
      intro: 'Before the descent, each crew member runs one experiment from orbit. BOTs cover empty seats; take over to aim higher.',
      play: 'Play',
      takeOver: 'Take over',
      yours: 'Yours',
      waiting: 'Waiting for {{name}}',
      done: 'Done {{stars}}',
      window: 'Orbit window {{time}}',
      startDescent: 'Start the descent',
      locked: 'Finish the experiments first',
      waitHost: 'The host starts the descent',
      skip: 'Skip mine (0 stars)',
      windowClosed: 'The orbit window closed: unfinished experiments count 0 stars.',
      log: 'Mars orbit reached: {{count}} experiments before the descent.',
    },
    descent: {
      log: 'Descent camera on: {{name}} picks the landing spot.',
      skipped: 'No landing spot was chosen in time: the lander keeps its original aim.',
    },
    dev: { jumpOrbit: 'Cockpit · Mars orbit' },
    results: {
      totalScore: 'Total score: {{pts}} pts · {{done}}/{{total}} experiments',
      heading: 'Experiments',
      ai: 'BOT',
      notDone: 'Not done',
      multiplier: 'Difficulty × {{mult}}',
      points: '{{raw}} pts × {{mult}} = {{total}} pts',
    },
  });

  put('pt', {
    mechanics: {
      keep: 'Manter na faixa', timing: 'Sincronia', aim: 'Mira', choice: 'Escolha sob limite',
      pattern: 'Busca de padrão', route: 'Planejar rota', piloting: 'Pilotagem',
    },
    places: { orbit: 'Órbita de Marte', surface: 'Superfície', descent: 'Descida' },
    orbit: {
      step: 'Órbita de Marte',
      eyebrow: 'Órbita de Marte / Ciência',
      title: 'Experimentos da órbita de Marte',
      intro: 'Antes da descida, cada tripulante faz um experimento em órbita. O BOT cuida das vagas vazias; assuma o lugar dele para mirar mais alto.',
      play: 'Jogar',
      takeOver: 'Assumir',
      yours: 'Seu',
      waiting: 'Esperando {{name}}',
      done: 'Feito {{stars}}',
      window: 'Janela orbital {{time}}',
      startDescent: 'Iniciar a descida',
      locked: 'Termine os experimentos primeiro',
      waitHost: 'O host inicia a descida',
      skip: 'Pular o meu (0 estrela)',
      windowClosed: 'A janela orbital fechou: experimentos não terminados contam 0 estrela.',
      log: 'Órbita de Marte alcançada: {{count}} experimentos antes da descida.',
    },
    descent: {
      log: 'Câmera de descida ligada: {{name}} escolhe o ponto de pouso.',
      skipped: 'Nenhum ponto de pouso foi escolhido a tempo: o módulo mantém a mira original.',
    },
    dev: { jumpOrbit: 'Cockpit · Órbita de Marte' },
    results: {
      totalScore: 'Pontuação total: {{pts}} pts · {{done}}/{{total}} experimentos',
      heading: 'Experimentos',
      ai: 'BOT',
      notDone: 'Não feito',
      multiplier: 'Dificuldade × {{mult}}',
      points: '{{raw}} pts × {{mult}} = {{total}} pts',
    },
  });

  put('es', {
    mechanics: {
      keep: 'Mantener en rango', timing: 'Sincronización', aim: 'Puntería', choice: 'Elección con límite',
      pattern: 'Búsqueda de patrones', route: 'Planificación de ruta', piloting: 'Pilotaje',
    },
    places: { orbit: 'Órbita de Marte', surface: 'Superficie', descent: 'Descenso' },
    orbit: {
      step: 'Órbita de Marte',
      eyebrow: 'Órbita de Marte / Ciencia',
      title: 'Experimentos desde la órbita de Marte',
      intro: 'Antes del descenso, cada tripulante hace un experimento desde la órbita. El BOT cubre los puestos vacíos; toma su lugar para apuntar más alto.',
      play: 'Jugar',
      takeOver: 'Tomar el control',
      yours: 'Tuyo',
      waiting: 'Esperando a {{name}}',
      done: 'Hecho {{stars}}',
      window: 'Ventana orbital {{time}}',
      startDescent: 'Iniciar el descenso',
      locked: 'Termina primero los experimentos',
      waitHost: 'El anfitrión inicia el descenso',
      skip: 'Saltar el mío (0 estrellas)',
      windowClosed: 'La ventana orbital se cerró: los experimentos sin terminar cuentan 0 estrellas.',
      log: 'Órbita de Marte alcanzada: {{count}} experimentos antes del descenso.',
    },
    descent: {
      log: 'Cámara de descenso encendida: {{name}} elige el punto de aterrizaje.',
      skipped: 'No se eligió punto de aterrizaje a tiempo: el módulo mantiene su puntería original.',
    },
    dev: { jumpOrbit: 'Cabina · Órbita de Marte' },
    results: {
      totalScore: 'Puntuación total: {{pts}} pts · {{done}}/{{total}} experimentos',
      heading: 'Experimentos',
      ai: 'BOT',
      notDone: 'No hecho',
      multiplier: 'Dificultad × {{mult}}',
      points: '{{raw}} pts × {{mult}} = {{total}} pts',
    },
  });
})();
