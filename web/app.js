(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const i18n = window.ASTRO_I18N || { t: k => k, applyDOM() {}, locale: 'en-US' };
  const t = (key, opts) => i18n.t(key, opts);
  const U = window.ASTRO_UNITS || {
    number: (n, o) => (n == null ? 'n/f' : o ? Number(n).toLocaleString('en-US', o) : Math.round(n).toLocaleString('en-US')),
    decimal: (n, d = 1) => (n == null ? 'n/f' : Number(n).toFixed(d)),
    money: n => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) < 10 ? 1 : 0 }) + 'M',
    massKg: kg => `${Math.round(kg).toLocaleString('en-US')} kg`,
    massTonnes: kg => `${(kg / 1000).toLocaleString('en-US', { maximumFractionDigits: kg < 10000 ? 2 : 1 })} t`,
    massGrams: (g, d = 1) => `${Number(g).toFixed(d)} g`,
    thrustKn: kn => `${Math.round(kn).toLocaleString('en-US')} kN`,
    velocityMs: (ms, d = 0) => `${d ? Number(ms).toFixed(d) : Math.round(ms)} m/s`,
    speedKmh: kmh => `${Math.round(kmh).toLocaleString('en-US')} km/h`,
    altitudeKm: km => km < 1 ? `${Math.round(km * 1000)} m` : `${(Math.round(km * 10) / 10)} km`,
    distanceM: m => `${Math.round(m)} m`,
    distanceKm: (km, d = 1) => `${Number(km).toFixed(d)} km`,
    tempC: c => `${Math.round(c)} °C`,
    tempRangeC: (a, b) => `${a}–${b} °C`,
  };
  const capFirst = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const crew = [
    // Keep HUD, labels, and lobby accents in sync with each avatar's 3D Accent material.
    {id:'helena',name:'Helena',color:'#D7263D',get role(){return t('crew.helena.role');},get quote(){return t('crew.helena.quote');},get tags(){return t('crew.helena.tags');},get perk(){return t('crew.helena.perk');},get perkText(){return t('crew.helena.perkText');}},
    {id:'lucas',name:'Lucas',color:'#F2A900',get role(){return t('crew.lucas.role');},get quote(){return t('crew.lucas.quote');},get tags(){return t('crew.lucas.tags');},get perk(){return t('crew.lucas.perk');},get perkText(){return t('crew.lucas.perkText');}},
    {id:'oscar',name:'Oscar',color:'#1FA2FF',get role(){return t('crew.oscar.role');},get quote(){return t('crew.oscar.quote');},get tags(){return t('crew.oscar.tags');},get perk(){return t('crew.oscar.perk');},get perkText(){return t('crew.oscar.perkText');}},
    {id:'maya',name:'Maya',color:'#2BB673',get role(){return t('crew.maya.role');},get quote(){return t('crew.maya.quote');},get tags(){return t('crew.maya.tags');},get perk(){return t('crew.maya.perk');},get perkText(){return t('crew.maya.perkText');}}
  ];
  const SITES_INFO = {
    jezero:{get name(){return t('sites.jezero.name');},get mission(){return t('sites.jezero.mission');},get tag(){return t('sites.jezero.tag');},lat:18.4447,lon:77.4508,coords:'18.4° N, 77.5° E',get desc(){return t('sites.jezero.desc');}},
    gale:{get name(){return t('sites.gale.name');},get mission(){return t('sites.gale.mission');},get tag(){return t('sites.gale.tag');},lat:-4.5895,lon:137.4417,coords:'4.6° S, 137.4° E',get desc(){return t('sites.gale.desc');}}
  };
  // Per difficulty (game-balance): budget multiplier (the base budget comes from missionRules), surface window in
  // seconds and the engineering rules. fuelTypes: engine and tank must burn the same propellants. failures: the
  // telemetry can end the mission (no liftoff, Δv abort); without it every problem is a warning. penalties: low TWR,
  // a power deficit and overspending cost points and add trouble in flight. dvTolerance: share of the orbit and
  // Mars-transfer Δv the rocket may lack and still make it. The badge and the button tooltips show all of it.
  const difficulty = {
    easy:{get label(){return t('difficulty.easy.label');},get tagline(){return t('difficulty.easy.tagline');},accent:'var(--safe)',factor:1.2,surfaceS:210,fuelTypes:false,failures:false,penalties:false,dvTolerance:0,get rules(){return t('difficulty.easy.rules');},
      get about(){return t('difficulty.easy.about');}},
    normal:{get label(){return t('difficulty.normal.label');},get tagline(){return t('difficulty.normal.tagline');},accent:'var(--solar-amber)',factor:1,surfaceS:180,fuelTypes:false,failures:true,penalties:true,dvTolerance:.2,get rules(){return t('difficulty.normal.rules');},
      get about(){return t('difficulty.normal.about');}},
    hard:{get label(){return t('difficulty.hard.label');},get tagline(){return t('difficulty.hard.tagline');},accent:'#D7263D',factor:.8,surfaceS:140,fuelTypes:true,failures:true,penalties:true,dvTolerance:0,get rules(){return t('difficulty.hard.rules');},
      get about(){return t('difficulty.hard.about');}},
  };
  const LV = () => difficulty[state.difficulty];
  const easyNote = () => LV().failures ? '' : t('planner.easyNote');
  // Δv target text: the real target (⚠) and, on Normal, the one the game accepts.
  const tolNote = (target,key) => LV().dvTolerance
    ? t('planner.tolNormal',{target:U.velocityMs(target),full:U.velocityMs(rule(key,0)),pct:Math.round(LV().dvTolerance*100)})
    : t('planner.tolFull',{target:U.velocityMs(target)});
  const EQUIPMENT_GROUPS = [['power','planner.tabs.power',/^power-/],['data','planner.tabs.data',/^(comm|data)-/],['science','planner.tabs.science',/^(sci|drill|truss)-/],['edl','planner.tabs.edl',/^edl-/],['systems','planner.tabs.systems',/^(attitude|isru|hab)-/]];
  const CABIN_GROUPS = [['helena','Helena',['cabin-launch-seats','cabin-orion-cockpit','cabin-idss-docking']],['lucas','Lucas',['cabin-pcdu-thermal','cabin-eva-airlock','cabin-eclss-wrs']],['oscar','Oscar',['cabin-hera-dosimetry','cabin-scan-console','cabin-autonav-conjunction']],['maya','Maya',['cabin-ared-exercise','cabin-storm-shelter','cabin-msg-minion']]];
  const CREW_MODELS = { helena: 'characters/helena.glb', lucas: 'characters/lucas.glb', oscar: 'characters/oscar.glb', maya: 'characters/maya.glb' };
  const COCKPIT_MODEL = 'rocket/cockpit_pilot.glb';
  const THUMB_CACHE = new Map();
  window.ASTRO_THUMBS = THUMB_CACHE;
  // Specs of every part and the mission rules (tools/modeling/parts/specs.mjs → parts/manifest.json).
  let DATA = null;
  const useData = manifest => { DATA = {rules:manifest.missionRules,parts:Object.fromEntries(manifest.parts.map(p=>[p.id,p]))}; };
  if (window.ASTRO_FILES?.['parts/manifest.json']) useData(window.ASTRO_FILES['parts/manifest.json']);
  const rule = (key,fallback) => DATA?.rules?.[key] ?? fallback;
  const MAX_STAGES = () => rule('maxInternalStages',7), CABIN_SLOTS = () => rule('cabinModuleSlots',4), TWR_MIN = () => rule('minSafeLiftoffTwr',1.2), TWR_BARE = () => rule('minBareLiftoffTwr',1), UPPER_TWR = () => rule('minUpperStageTwr',.3);
  const stageName = key => key==='booster'?t('planner.stage1Name'):t('planner.stageNName',{n:+key.slice(6)+2});
  // Ascent (game-balance): at a constant net acceleration (TWR − 1)·g the time to climb a fixed height goes as
  // 1/√(TWR − 1). The liftoff minigame lasts refS at refTwr, follows that law and stays within minS–maxS.
  const ASCENT = { refTwr: 1.5, refS: 15, minS: 9, maxS: 30 };
  const ascentSeconds = twr => Math.round(Math.min(ASCENT.maxS, Math.max(ASCENT.minS, ASCENT.refS*Math.sqrt((ASCENT.refTwr-1)/Math.max(1e-3,twr-1)))));
  // Liftoff (rule): stage 1 needs an engine that can fire (with a tank of its propellants) and thrust above the
  // weight (TWR_BARE). Otherwise the rocket stays on the pad and the mission ends there.
  // accel: net climb acceleration relative to the reference design (the launch pad animation uses it).
  function liftoffOf(m){
    if(!LV().failures){const fly=m.ready&&m.twr>=TWR_BARE();return {ok:true,twr:m.twr,seconds:fly?ascentSeconds(m.twr):ASCENT.refS,accel:fly?(m.twr-1)/(ASCENT.refTwr-1):1};} // Easy: it always flies
    const b=state.rocket.booster,fail=(reason,pad,status,title,detail)=>({ok:false,reason,pad,status,title,detail,twr:m.twr});
    if(!b.engine)return fail('no-engine',t('launch.liftoff.noEnginePad'),t('launch.liftoff.noEngineStatus'),t('launch.liftoff.noEngineTitle'),t('launch.liftoff.noEngineDetail'));
    if(!b.tank)return fail('no-tank',t('launch.liftoff.noEnginePad'),t('launch.liftoff.noTankStatus'),t('launch.liftoff.noEngineTitle'),t('launch.liftoff.noTankDetail'));
    if(m.issue==='propellant')return fail('propellant',t('launch.liftoff.noEnginePad'),t('launch.liftoff.propStatus'),t('launch.liftoff.noEngineTitle'),t('launch.liftoff.propDetail',{engineFuel:fuelOf(b.engine),tankFuel:fuelOf(b.tank)}));
    if(m.twr<TWR_BARE())return fail('low-twr',t('launch.liftoff.lowTwrPad'),t('launch.liftoff.lowTwrStatus'),t('launch.liftoff.lowTwrTitle'),t('launch.liftoff.lowTwrDetail',{twr:U.decimal(m.twr,2),bare:U.decimal(TWR_BARE(),1)}));
    return {ok:true,twr:m.twr,seconds:ascentSeconds(m.twr),accel:(m.twr-1)/(ASCENT.refTwr-1)};
  }
  const ORBIT = { altKm: 400, velMs: 7670 }; // game: ISS-like orbit; 7,670 m/s ≈ √(GM/r) at 400 km (derived)
  // Δv (rule): stages that run dry before orbit abort the flight after the ascent; a rocket that cannot make the Mars
  // transfer even refuelled aborts after the orbital refuel. Either way the capsule splashes down and the mission fails.
  // warn: the launch review (future); detail: the debrief (past).
  function abortOf(m){
    if(!m.ready||!LV().failures)return null;
    const vNum=Math.round(m.dv/m.leo*ORBIT.velMs),v=U.velocityMs(vNum),orbVel=U.velocityMs(ORBIT.velMs),base={ok:false,sea:true,pad:t('launch.pad.splashdown')};
    if(!m.orbit)return {...base,reason:'no-orbit',status:t('launch.abort.noOrbitStatus'),title:t('launch.abort.noOrbitTitle'),
      warn:t('launch.abort.noOrbitWarn',{vel:v,orbVel}),
      detail:t('launch.abort.noOrbitDetail',{vel:v,orbVel,dv:U.velocityMs(m.dv),leo:U.velocityMs(m.leo)})};
    if(!m.marsOk)return {...base,reason:'no-mars',status:t('launch.abort.noMarsStatus'),title:t('launch.abort.noMarsTitle'),
      warn:t('launch.abort.noMarsWarn',{marsDv:U.velocityMs(m.marsDv),transfer:U.velocityMs(m.transfer)}),
      detail:t('launch.abort.noMarsDetail',{marsDv:U.velocityMs(m.marsDv),transfer:U.velocityMs(m.transfer)})};
    return null;
  }
  const budgetOf = level => rule('defaultBudgetM',250)*difficulty[level].factor;
  const defaultRocket=()=>({booster:{engine:'merlin-1d',fins:'fins-small',tank:'falcon-9-stage-1-tank'},stages:[{item:'power-rosa-solar'},{item:null}],cabin:[]});
  const state={screen:'menu',lobbyStep:'mode',difficulty:'normal',site:'jezero',detail:{kind:'crew',id:'helena'},rocket:defaultRocket(),sel:{kind:'booster'},tab:'engine'};
  const money = n => U.money(n);
  const number = (n, opts) => U.number(n, opts);
  const tonnes = kg => U.massTonnes(kg);
  const part = id => DATA?.parts[id];
  const spec = id => part(id)?.specs || {};
  const warn = (id,key) => String(spec(id).sources?.[key]||'').includes('⚠')?` <span class="warn" title="${t('planner.metrics.sourcesDisagree')}">⚠</span>`:'';
  const partName = id => { const p = part(id); return p ? t(`parts.${id}.name`, { defaultValue: p.name }) : id; };
  const partRole = id => { const p = part(id); return p ? t(`parts.${id}.role`, { defaultValue: p.role || '' }) : ''; };
  const shortName = id => partName(id).replace(/\s*\(.*\)\s*$/,'');
  // Low-poly astronaut: flat polygons; s* = suit tones, c* = crew colour, v* = visor, d1 = dark gear.
  // When isGhost = true (left behind on Mars), backpack/chest equipment and legs/boots are removed and replaced by a translucent legless wavy ghost tail (👻).
  const astronaut = (person, isGhost = false) => `<svg class="astronaut${isGhost ? ' is-ghost' : ''}" style="--crew:${person.color}" viewBox="0 0 150 215" aria-hidden="true">${[
    ...(!isGhost ? [['d1','40,62 110,62 114,120 36,120']] : []),
    ...(isGhost ? [
      ['s1','50,138 75,138 75,196 61,180 46,194'],
      ['s2','75,138 100,138 104,194 89,180 75,196'],
      ['c2','49,128 101,128 100,142 50,142'],
    ] : [
      ['s1','52,138 74,138 72,170 54,170'],['s2','54,170 72,170 70,196 55,196'],['c2','55,165 71,165 70,176 56,176'],
      ['s2','98,138 76,138 78,170 96,170'],['s3','96,170 78,170 80,196 95,196'],['c2','95,165 79,165 80,176 94,176'],
      ['d1','50,196 72,196 73,206 46,206'],['d1','100,196 78,196 77,206 104,206'],
    ]),
    ['s1','52,64 75,64 75,140 50,140 44,108'],['s2','75,64 98,64 106,108 100,140 75,140'],['s3','98,64 106,108 86,92'],
    ['c2','49,128 101,128 100,138 50,138'],
    ...(!isGhost ? [['d1','62,84 88,84 90,108 60,108'],['c1','64,96 86,96 86,100 64,100'],['c1','75,87 78,90 75,93 72,90']] : []),
    ['c1','44,66 58,62 56,78 40,82'],['c2','92,62 106,66 110,82 94,78'],
    ['s2','40,68 54,70 50,104 36,102'],['s1','36,102 50,104 46,128 32,126'],['d1','31,126 47,128 46,140 33,140'],['c1','32,123 47,125 47,130 32,128'],
    ['s3','110,68 96,70 100,104 114,102'],['s2','114,102 100,104 104,128 118,126'],['d1','119,126 103,128 104,140 117,140'],['c1','118,123 103,125 103,130 118,128'],
    ['c1','58,69 92,69 96,80 54,80'],
    ['s2','106.4,29 88,10.6 62,10.6 43.6,29 43.6,55 62,73.4 88,73.4 106.4,55'],
    ['s1','75,42 62,10.6 43.6,29'],['s1','75,42 88,10.6 62,10.6'],['s1','75,42 43.6,29 43.6,55'],
    ['s3','75,42 106.4,29 106.4,55'],['s3','75,42 106.4,55 88,73.4'],
    ['v1','50,30 62,22 88,22 100,30 98,52 75,60 52,52'],['v2','50,30 62,22 88,22 52,52'],['v3','55,31 63,26 77,26 59,37']
  ].map(([c,p])=>`<polygon class="${c}" points="${p}"/>`).join('')}</svg>`;
  // Multiplayer (web/net.js, docs/multiplayer.md). Solo when the script or the server is missing.
  const net = window.ASTRO_NET || {enabled:false,mode:'solo',isHost:false,isGuest:false,peers:[],cached:{},available:()=>false,owns:()=>true,peerOf:()=>null,on:()=>()=>{},setPhase(){},setState(){},emit(){},act(){},start(){},getPlayerName:()=>'',setPlayerName:n=>n,isPlayerNameLocked:()=>false,sanitizePlayerName:n=>String(n||''),listRooms:async()=>({rooms:[]}),checkRoom:async()=>({exists:false}),getLeaderboard:async()=>({tab:'missions',entries:[]}),submitScore:async()=>({}),recordSoloScore:()=>false,getSoloLeaderboard:()=>({tab:'missions',entries:[]})};
  // The host tells the room which screen it is on; a guest follows (guestScreen) and never changes it alone.
  const showScreen = id => {state.screen=id;$$('.screen').forEach(screen=>screen.classList.toggle('active',screen.id===id));window.scrollTo(0,0);if(id==='planner'){renderPlanner();maybeAutoOpenWizard();}if(id==='lobby'&&state.lobbyStep==='mode')refreshRoomBrowser();net.setPhase(id);lockGuest();};
  let toastTimer;
  const toast = message => {const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);};

  // Lobby: 5-step setup (01 Play mode → 02 Difficulty → 03 Destination → 04 Landing site → 05 Crew).
  // Guests skip steps 1–4 (host controls) and land straight on step 5 to pick a crew seat.
  const LOBBY_STEPS = ['mode', 'difficulty', 'destination', 'site', 'crew'];
  const lobbyStepMeta = step => ({
    eyebrow: t(`lobby.setup.steps.${step}.eyebrow`),
    title: t(`lobby.setup.steps.${step}.title`),
    back: t(`lobby.setup.steps.${step}.back`),
    next: step === 'mode' ? null : t(`lobby.setup.steps.${step}.next`),
    hint: t(`lobby.setup.steps.${step}.hint`),
  });
  const formatSurfaceClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function setLobbyStep(step){
    const next = net.isGuest ? 'crew' : (LOBBY_STEPS.includes(step) ? step : 'mode');
    state.lobbyStep = next;
    renderLobbyStepper();
    if(next==='mode')refreshRoomBrowser();
    if(next==='site')window.dispatchEvent(new CustomEvent('astro:site',{detail:{id:state.site,focus:true,arrive:true}}));
    if(next==='crew')renderDetail();
  }
  function renderLobbyStepper(){
    const step = net.isGuest ? 'crew' : state.lobbyStep;
    const idx = LOBBY_STEPS.indexOf(step);
    const meta = lobbyStepMeta(step);
    $('#lobby-eyebrow').textContent = meta.eyebrow;
    $('#lobby-title').textContent = meta.title;
    $('#lobby-hint').textContent = net.isGuest ? t('lobby.setup.guestHint') : meta.hint;
    const back = $('#lobby-back');
    if(back && !net.isGuest){ back.textContent = meta.back; }
    LOBBY_STEPS.forEach(id => {
      const panel = $(`#lobby-step-${id}`);
      if(panel) panel.hidden = id !== step;
    });
    $$('#lobby-stepper [data-lobby-step]').forEach(tab => {
      const tStep = tab.dataset.lobbyStep, tIdx = LOBBY_STEPS.indexOf(tStep);
      const isActive = tStep === step, isDone = tIdx < idx;
      tab.classList.toggle('active', isActive);
      tab.classList.toggle('done', isDone);
      tab.toggleAttribute('aria-current', isActive);
      if(isActive) tab.setAttribute('aria-current', 'step');
      tab.disabled = net.isGuest && tStep !== 'crew';
    });
    $('#step-summary-mode').textContent = net.mode === 'solo' ? t('lobby.setup.soloTitle') : `${t('lobby.room.coop')} · ${net.code}`;
    $('#step-summary-difficulty').textContent = difficulty[state.difficulty].label;
    $('#step-summary-destination').textContent = worldName(state.world || 'mars');
    $('#step-summary-site').textContent = SITES_INFO[state.site].name;
    $('#step-summary-crew').textContent = t('lobby.setup.crewSummary', { count: playerCount() });
    const nextBtn = $('#lobby-next');
    if(nextBtn){
      const showNext = !!meta.next;
      nextBtn.hidden = !showNext;
      if(showNext){
        if(net.isGuest){
          nextBtn.disabled = true;
          nextBtn.textContent = t('common.waitingForHost');
        }else if(step === 'destination' && state.world !== 'mars'){
          nextBtn.disabled = true;
          nextBtn.textContent = t('common.unavailable');
        }else{
          nextBtn.disabled = false;
          nextBtn.textContent = meta.next;
        }
      }
    }
    $('#lobby-change-difficulty').hidden = step !== 'crew' || net.isGuest;
  }
  function selectSite(id, focus = true){
    if(!SITES_INFO[id]) return;
    if(!net.isGuest) state.site = id;
    renderSiteStep();
    renderLobby();
    window.dispatchEvent(new CustomEvent('astro:site', { detail: { id: state.site, focus } }));
  }
  function renderSiteStep(){
    const cards = $('#site-cards'), site = SITES_INFO[state.site];
    if(cards){
      cards.innerHTML = Object.entries(SITES_INFO).map(([id, s]) => {
        const selected = state.site === id;
        return `<button type="button" class="site-card" data-site="${id}" role="radio" aria-checked="${selected}" aria-pressed="${selected}" ${net.isGuest?'aria-disabled="true"':''}>
          <span class="site-card-media">
            <img class="site-photo" src="assets/sites/${id}.png" alt="${esc(t('lobby.sitePhotoAlt', { name: s.name }))}">
            <span class="site-card-badges">
              <span class="tag">HiRISE · 1.5 KM</span>
              <span class="tag">${s.coords}</span>
            </span>
            <span class="site-walk" aria-hidden="true"><small>${esc(t('lobby.walkArea', { dist: U.distanceM(512, 0) }))}</small></span>
          </span>
          <span class="site-card-body">
            <span class="site-card-head"><h4>${s.name}</h4></span>
            <span class="site-card-meta">${s.mission} · ${s.tag}</span>
            <p>${s.desc}</p>
          </span>
        </button>`;
      }).join('');
      $$('#site-cards [data-site]').forEach(btn => btn.addEventListener('click', () => {
        if(net.isGuest) return;
        selectSite(btn.dataset.site, true);
      }));
    }
    const title = $('#site-step-mission'); if(title) title.textContent = site.mission;
    const coords = $('#mars-globe-coords'); if(coords) coords.textContent = `${site.name.toUpperCase()} · ${site.coords}`;
    const readout = $('#crew-site-readout'); if(readout) readout.textContent = `${worldName('mars')} · ${site.name}`;
    $$('#mars-pins [data-mars-pin]').forEach(pin => {
      const on = pin.dataset.marsPin === state.site;
      pin.classList.toggle('selected', on);
      pin.setAttribute('aria-pressed', String(on));
    });
  }
  const ROBOT_ICON = `<svg viewBox="0 0 44 38" aria-hidden="true"><polygon points="20,4 24,4 23,11 21,11" fill="#B9B0CE"/><polygon points="22,0 26,3 22,6 18,3" fill="#F59E0B"/><polygon points="22,0 22,6 18,3" fill="#FCE8A6"/><polygon points="1,18 6,16 6,28 1,26" fill="#F59E0B"/><polygon points="43,18 38,16 38,28 43,26" fill="#E04F26"/><polygon points="9,10 35,10 38,14 38,31 34,35 10,35 6,31 6,14" fill="#9D95B8"/><polygon points="9,10 22,10 22,35 10,35 6,31 6,14" fill="#DCD6EC"/><polygon points="10,14 34,14 34,25 10,25" fill="#17183B"/><polygon points="13,17 19,17 19,22 13,22" fill="#7EDAC2"/><polygon points="25,17 31,17 31,22 25,22" fill="#7EDAC2"/><polygon points="13,28 31,28 31,32 13,32" fill="#17183B"/><polygon points="16,28 18,28 18,32 16,32" fill="#B9B0CE"/><polygon points="21,28 23,28 23,32 21,32" fill="#B9B0CE"/><polygon points="26,28 28,28 28,32 26,32" fill="#B9B0CE"/></svg>`;
  const COOP_ICON = `<svg viewBox="0 0 44 34" aria-hidden="true"><polygon points="22,2 30,10 22,18 14,10" fill="#F59E0B"/><polygon points="22,2 26,10 22,18 14,10" fill="#FCE8A6"/><polygon points="8,16 16,24 8,32 0,24" fill="#7EDAC2"/><polygon points="36,16 44,24 36,32 28,24" fill="#1FA2FF"/><polygon points="14,13 18,16 12,22 9,19" fill="#9B5DE5"/><polygon points="30,13 35,19 32,22 26,16" fill="#9B5DE5"/></svg>`;
  const PENCIL_ICON = '<svg class="pencil-icon" viewBox="0 0 16 16" aria-hidden="true"><polygon points="11.5,1.5 14.5,4.5 5.5,13.5 2,14 2.5,10.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter"/><line x1="9.5" y1="3.5" x2="12.5" y2="6.5" stroke="currentColor" stroke-width="1.5"/></svg>';
  const browserState = { status: 'idle', rooms: [], fetchedAt: 0 };
  let draftRoomName = '', draftRoomPassword = '', draftRoomPrivate = false, draftJoinCode = '', draftPlayerName = '';
  let editingPlayerName = false;
  let mpTab = 'browse'; // 'browse' | 'create'

  function ensurePlayerName() {
    if (net.isPlayerNameLocked?.() && !editingPlayerName) return net.getPlayerName();
    const input = $('#mp-player-name');
    const raw = input ? input.value : draftPlayerName;
    const clean = net.sanitizePlayerName ? net.sanitizePlayerName(raw) : String(raw || '').trim();
    if (clean.length < 2) {
      toast(t('lobby.roomBrowser.nameRequired'));
      input?.focus();
      return null;
    }
    const saved = net.setPlayerName?.(clean, editingPlayerName) || clean;
    editingPlayerName = false;
    draftPlayerName = saved;
    renderModeStep();
    return saved;
  }

  function promptRoomPassword(code) {
    const dlg = $('#room-password-dialog'), input = $('#room-pw-input'), form = $('#room-pw-form'), cancel = $('#room-pw-cancel'), desc = $('#room-pw-desc');
    if (!dlg || !input || !form) return Promise.resolve(null);
    desc.textContent = t('lobby.roomBrowser.passwordDesc', { code: String(code || '').toUpperCase() });
    input.value = '';
    return new Promise(resolve => {
      let settled = false;
      const done = val => {
        if (settled) return;
        settled = true;
        form.removeEventListener('submit', onSubmit);
        cancel?.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onCancel);
        dlg.removeEventListener('click', onBackdrop);
        if (dlg.open) dlg.close();
        resolve(val);
      };
      const onSubmit = e => { e.preventDefault(); done(input.value); };
      const onCancel = e => { e.preventDefault(); done(null); };
      const onBackdrop = e => { if (e.target === dlg) done(null); };
      form.addEventListener('submit', onSubmit);
      cancel?.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onCancel);
      dlg.addEventListener('click', onBackdrop);
      if (!dlg.open) dlg.showModal();
      input.focus();
    });
  }

  async function joinRoomWithPrompt(rawCode, needsPassword = false, skipNameCheck = false) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return;
    if (!skipNameCheck && !ensurePlayerName()) return;
    let password;
    if (needsPassword) {
      password = await promptRoomPassword(code);
      if (password === null) return;
    }
    try {
      await enterRoom(() => net.join(code, password ? { password } : {}), undefined, true);
    } catch (err) {
      if (err?.code === 'password-required') {
        const pw = await promptRoomPassword(code);
        if (pw !== null) await enterRoom(() => net.join(code, { password: pw }));
      } else {
        toast(net.message(err));
      }
    }
  }

  function paintRoomBrowser() {
    const list = $('#room-browser-list');
    if (!list) return;
    if (browserState.status === 'loading') {
      list.innerHTML = `<div class="room-browser-empty">${t('lobby.roomBrowser.loading')}</div>`;
      return;
    }
    if (browserState.status === 'offline') {
      list.innerHTML = `<div class="room-browser-empty">${t('lobby.roomBrowser.offline')}</div>`;
      return;
    }
    if (!browserState.rooms.length) {
      list.innerHTML = `<div class="room-browser-empty">${t('lobby.roomBrowser.empty')}</div>`;
      return;
    }
    list.innerHTML = browserState.rooms.map(rm => {
      const siteTag = rm.site && SITES_INFO[rm.site] ? SITES_INFO[rm.site].name : '';
      const diffTag = rm.difficulty && difficulty[rm.difficulty] ? difficulty[rm.difficulty].label : '';
      const host = rm.hostName ? esc(t('lobby.roomBrowser.hostLabel', { name: rm.hostName })) : esc(rm.code);
      return `<div class="room-browser-item">
        <div class="room-browser-info">
          <strong>${esc(rm.name || rm.code)}</strong>
          <div class="room-browser-meta">
            <span>${esc(rm.code)}</span><span>· ${host}</span>
            <span class="tag">${esc(t('lobby.roomBrowser.slots', { players: rm.players, max: rm.maxPlayers }))}</span>
            ${siteTag ? `<span class="tag">${esc(siteTag)}</span>` : ''}
            ${diffTag ? `<span class="tag">${esc(diffTag)}</span>` : ''}
            ${rm.hasPassword ? `<span class="tag">${t('lobby.roomBrowser.lockedBadge')}</span>` : ''}
          </div>
        </div>
        <button class="button secondary" type="button" data-join-room="${esc(rm.code)}" data-join-locked="${rm.hasPassword ? '1' : ''}" ${rm.players >= rm.maxPlayers ? 'disabled' : ''}>${t('lobby.roomBrowser.joinBtn')}</button>
      </div>`;
    }).join('');
    $$('[data-join-room]', list).forEach(btn => btn.addEventListener('click', () => {
      joinRoomWithPrompt(btn.dataset.joinRoom, btn.dataset.joinLocked === '1');
    }));
  }

  async function refreshRoomBrowser(force = false) {
    if (!net.enabled || !net.available?.() || net.mode !== 'solo') return;
    if (!force && browserState.status === 'ok' && Date.now() - browserState.fetchedAt < 2500) {
      paintRoomBrowser();
      return;
    }
    browserState.status = 'loading';
    paintRoomBrowser();
    try {
      const data = await net.listRooms();
      browserState.rooms = Array.isArray(data?.rooms) ? data.rooms : [];
      browserState.status = 'ok';
      browserState.fetchedAt = Date.now();
    } catch {
      browserState.status = 'offline';
    }
    paintRoomBrowser();
  }

  function renderModeStep(){
    const soloVis = $('#mode-solo-visual'), mpVis = $('#mode-mp-visual'), mpCta = $('#mode-mp-cta'), mpFoot = $('#mode-mp-foot');
    if(!mpCta || !mpFoot || !mpVis) return;
    const langCode = window.ASTRO_I18N?.language || 'en';
    if(soloVis && soloVis.dataset.lang !== langCode){
      soloVis.dataset.lang = langCode;
      soloVis.innerHTML = `<div class="mode-figure-group"><span class="mode-badge-top is-player">${esc(t('lobby.setup.helenaYou'))}</span><div class="mode-avatar is-hero" style="--crew:${crew[0].color}">${astronaut(crew[0])}</div></div><span class="mode-plus">+</span><div class="mode-figure-group"><span class="mode-badge-top is-ai">${ROBOT_ICON} ${esc(t('lobby.setup.aiCrewBadge'))}</span><div class="mode-trio">${crew.slice(1).map(p=>`<div class="mode-avatar" style="--crew:${p.color}">${astronaut(p)}</div>`).join('')}</div></div>`;
    }
    const soloCard = $('[data-mode-card="solo"]'), mpCard = $('[data-mode-card="multiplayer"]');
    soloCard?.classList.toggle('selected', net.mode === 'solo');
    mpCard?.classList.toggle('selected', net.mode !== 'solo');
    const soloBtn = $('#mode-solo-btn');
    if(soloBtn) soloBtn.innerHTML = net.isHost ? t('lobby.roomBrowser.switchSoloBtn') : t('lobby.roomBrowser.playSoloBtn');

    const netReady = net.enabled && net.available();
    if (net.mode !== 'solo') editingPlayerName = false;
    const lockedName = net.isPlayerNameLocked?.() ? net.getPlayerName() : '';
    const viewKey = `${netReady}|${net.mode}|${net.code || ''}|${langCode}|${net.url}|${mpTab}|${lockedName}|${editingPlayerName}`;

    if(!netReady){
      mpVis.classList.remove('is-browser');
      if(mpCta.dataset.viewKey !== viewKey){
        mpCta.dataset.viewKey = viewKey;
        mpVis.innerHTML = `<div class="mode-figure-group"><span class="mode-badge-top">${COOP_ICON} ${esc(t('lobby.setup.coopSquadBadge'))}</span><div class="mode-squad">${crew.map(p=>`<div class="mode-avatar" style="--crew:${p.color}">${astronaut(p)}</div>`).join('')}</div></div>`;
        mpCta.innerHTML = `<button class="button amber" type="button" disabled>${t('lobby.roomBrowser.createBtn')}</button>`;
        mpFoot.innerHTML = `<span class="mode-foot-note">${t('lobby.room.noServer')}</span>`;
      }
      return;
    }

    if(net.mode === 'solo'){
      mpVis.classList.add('is-browser');
      if(mpCta.dataset.viewKey !== viewKey){
        mpCta.dataset.viewKey = viewKey;
        const nameLocked = !!net.isPlayerNameLocked?.();
        const savedName = nameLocked ? net.getPlayerName() : draftPlayerName;
        const serverHost = (net.httpBase?.() || net.url || '').replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
        const header = `
          <div class="mp-server-bar">
            <span class="micro">${t('lobby.roomBrowser.serverLabel')}</span>
            <strong class="mp-server-url" title="${esc(net.url)}">${esc(serverHost)}</strong>
            <button class="button quiet" type="button" id="mp-server-settings" aria-label="${esc(t('lobby.roomBrowser.changeServer'))}" title="${esc(t('lobby.roomBrowser.changeServer'))}"><span class="settings-glyph" aria-hidden="true"></span></button>
          </div>
          <div class="mp-name-bar">
            ${nameLocked && !editingPlayerName
              ? `<span class="micro">${t('lobby.roomBrowser.playerNameLabel')}</span><strong class="mp-name-locked">${esc(savedName)}</strong><button class="button quiet mp-name-edit-btn" type="button" id="mp-name-edit" aria-label="${esc(t('lobby.roomBrowser.editName'))}" title="${esc(t('lobby.roomBrowser.editName'))}">${PENCIL_ICON}</button>`
              : `<label for="mp-player-name">${t('lobby.roomBrowser.playerNameLabel')}</label><input class="mp-input" id="mp-player-name" maxlength="20" autocomplete="nickname" value="${esc(editingPlayerName ? draftPlayerName : savedName)}" placeholder="${esc(t('lobby.roomBrowser.playerNamePlaceholder'))}">${editingPlayerName ? `<button class="button secondary mp-name-save-btn" type="button" id="mp-name-save">${t('lobby.roomBrowser.confirmNameBtn')}</button>` : ''}`}
          </div>
          <div class="segmented mp-tabs" role="group">
            <button type="button" data-mp-tab="browse" aria-pressed="${mpTab === 'browse'}">${t('lobby.roomBrowser.tabBrowse')}</button>
            <button type="button" data-mp-tab="create" aria-pressed="${mpTab === 'create'}">${t('lobby.roomBrowser.tabCreate')}</button>
          </div>`;
        if(mpTab === 'browse'){
          mpVis.innerHTML = header + `
            <div class="mp-browser-head">
              <span class="micro">${t('lobby.roomBrowser.openRooms')}</span>
              <button class="button quiet" type="button" id="room-browser-refresh">↻ ${t('lobby.roomBrowser.refresh')}</button>
            </div>
            <div class="room-browser-list" id="room-browser-list" aria-live="polite"></div>`;
          mpCta.innerHTML = '';
          mpFoot.innerHTML = `<span class="micro">${t('lobby.room.join')}</span><div class="mode-join-row"><input id="mode-room-code" maxlength="4" value="${esc(draftJoinCode)}" placeholder="${esc(t('lobby.room.codePlaceholder'))}" aria-label="${esc(t('lobby.room.codeAria'))}" autocomplete="off"><button class="button" type="button" id="mode-join-btn">${t('lobby.roomBrowser.joinBtn')}</button></div>`;
        }else{
          mpVis.innerHTML = header + `
            <div class="mp-create-panel">
              <input class="mp-input" id="mp-room-name" maxlength="32" autocomplete="off" value="${esc(draftRoomName)}" aria-label="${esc(t('lobby.roomBrowser.roomNameAria'))}" placeholder="${esc(t('lobby.roomBrowser.roomNamePlaceholder'))}">
              <input class="mp-input" id="mp-room-password" type="password" maxlength="32" autocomplete="new-password" value="${esc(draftRoomPassword)}" aria-label="${esc(t('lobby.roomBrowser.passwordAria'))}" placeholder="${esc(t('lobby.roomBrowser.passwordPlaceholder'))}">
              <label class="mp-check"><input type="checkbox" id="mp-room-private" ${draftRoomPrivate ? 'checked' : ''}><span>${t('lobby.roomBrowser.privateToggle')}</span></label>
            </div>`;
          mpCta.innerHTML = `<button class="button amber" type="button" id="mode-create-btn">${t('lobby.roomBrowser.createBtn')}</button>`;
          mpFoot.innerHTML = `<span class="mode-foot-note">${t('lobby.roomBrowser.createHint')}</span>`;
        }

        $('#mp-server-settings').addEventListener('click', () => { window.ASTRO_SETTINGS?.syncUI(); showScreen('settings'); });
        if (nameLocked && !editingPlayerName) {
          $('#mp-name-edit').addEventListener('click', () => {
            editingPlayerName = true;
            draftPlayerName = net.getPlayerName();
            renderModeStep();
            const inp = $('#mp-player-name');
            inp?.focus();
            inp?.select();
          });
        } else {
          const nameInput = $('#mp-player-name');
          nameInput.addEventListener('input', e => { draftPlayerName = e.target.value; });
          if (editingPlayerName) {
            $('#mp-name-save').addEventListener('click', () => { ensurePlayerName(); });
            nameInput.addEventListener('keydown', e => {
              if (e.key === 'Enter') { e.preventDefault(); ensurePlayerName(); }
              else if (e.key === 'Escape') {
                editingPlayerName = false;
                draftPlayerName = net.getPlayerName();
                renderModeStep();
              }
            });
          }
        }
        $$('[data-mp-tab]', mpVis).forEach(btn => btn.addEventListener('click', () => {
          if(mpTab === btn.dataset.mpTab) return;
          mpTab = btn.dataset.mpTab;
          renderModeStep();
        }));
        if(mpTab === 'browse'){
          $('#mode-room-code').addEventListener('input', e => { draftJoinCode = e.target.value; });
          $('#room-browser-refresh').addEventListener('click', () => refreshRoomBrowser(true));
          $('#mode-join-btn').addEventListener('click', () => joinRoomWithPrompt($('#mode-room-code').value));
          $('#mode-room-code').addEventListener('keydown', e => { if(e.key === 'Enter') $('#mode-join-btn').click(); });
        }else{
          $('#mp-room-name').addEventListener('input', e => { draftRoomName = e.target.value; });
          $('#mp-room-password').addEventListener('input', e => { draftRoomPassword = e.target.value; });
          $('#mp-room-private').addEventListener('change', e => { draftRoomPrivate = e.target.checked; });
          $('#mode-create-btn').addEventListener('click', () => {
            if (!ensurePlayerName()) return;
            enterRoom(() => net.create('lobby', {
              name: $('#mp-room-name').value,
              password: $('#mp-room-password').value,
              isPrivate: $('#mp-room-private').checked,
            }), () => setLobbyStep('difficulty'));
          });
        }
      }
      if(mpTab === 'browse'){
        paintRoomBrowser();
        if(browserState.status === 'idle') refreshRoomBrowser();
      }
      return;
    }

    mpVis.classList.remove('is-browser');
    if(mpCta.dataset.viewKey !== viewKey){
      mpCta.dataset.viewKey = viewKey;
      mpVis.innerHTML = `<div class="mode-figure-group"><span class="mode-badge-top">${COOP_ICON} ${esc(t('lobby.setup.coopSquadBadge'))}</span><div class="mode-squad">${crew.map(p=>`<div class="mode-avatar" style="--crew:${p.color}">${astronaut(p)}</div>`).join('')}</div></div>`;
      mpCta.innerHTML = `<button class="button amber" type="button" id="mode-continue-room">${t('lobby.roomBrowser.continueHostBtn')}</button>`;
      mpFoot.innerHTML = `<div class="mode-room-active">
        <span class="micro">${t('lobby.room.label')}</span>
        <strong class="room-code">${esc(net.code)}</strong>
        ${net.roomName ? `<span class="tag">${esc(net.roomName)}</span>` : ''}
        ${net.hasPassword ? `<span class="tag">${t('lobby.roomBrowser.lockedBadge')}</span>` : ''}
        ${net.isPrivate ? `<span class="tag">${t('lobby.roomBrowser.privateBadge')}</span>` : ''}
        <button class="button quiet" type="button" id="mode-copy-btn">${t('lobby.roomBrowser.copyLinkShort')}</button>
        <button class="button quiet" type="button" id="mode-leave-btn">${t('lobby.room.leave')}</button>
      </div>`;
      $('#mode-copy-btn').addEventListener('click', async () => { try{ await navigator.clipboard.writeText(net.link); toast(t('lobby.room.linkCopied')); } catch { prompt(t('lobby.room.copyPrompt'), net.link); } });
      $('#mode-continue-room').addEventListener('click', () => setLobbyStep('difficulty'));
      $('#mode-leave-btn').addEventListener('click', () => { net.leave(); });
    }
  }
  function renderDifficultyStep(){
    const grid = $('#difficulty-buttons');
    if(!grid) return;
    grid.innerHTML = ['easy', 'normal', 'hard'].map(id => {
      const lv = difficulty[id], selected = state.difficulty === id;
      const rulesLabel = t(`difficulty.${id}.rulesLong`);
      return `<button type="button" class="difficulty-card" data-difficulty="${id}" role="radio" aria-checked="${selected}" aria-pressed="${selected}" title="${lv.about}" style="--diff-accent:${lv.accent}" ${net.isGuest?'aria-disabled="true"':''}>
        <div class="difficulty-card-head"><span class="tag">${lv.tagline}</span><span class="diff-check">${selected?t('lobby.setup.selected'):t('lobby.setup.choose')}</span></div>
        <h4>${lv.label}</h4>
        <ul class="setup-specs">
          <li><span>${t('lobby.setup.specBudget')}</span><strong>${money(budgetOf(id))}</strong></li>
          <li><span>${t('lobby.setup.specEvaWindow')}</span><strong>${formatSurfaceClock(lv.surfaceS)}</strong></li>
          <li><span>${t('lobby.setup.specRules')}</span><strong>${rulesLabel}</strong></li>
        </ul>
        <p class="diff-about">${lv.about}</p>
      </button>`;
    }).join('');
    $$('#difficulty-buttons [data-difficulty]').forEach(button => button.addEventListener('click', () => {
      if(net.isGuest) return;
      setDifficulty(button.dataset.difficulty);
      syncSetup();
    }));
  }
  function renderLobby(){
    const site=SITES_INFO[state.site];
    $('#mission-name').textContent=site.mission;
    $('#planner-title').textContent=t('common.missionPrefix',{name:site.mission});
    $$('[data-site]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.site===state.site)));
    $('#crew-count').textContent=t('lobby.crewCount',{count:playerCount()});
    $('#crew-grid').innerHTML=crew.map(p=>{const seat=seatStatus(p.id),picked=state.detail.kind==='crew'&&state.detail.id===p.id,take=net.isGuest&&net.joinable&&!seat.player;
      return `<article class="crew-card ${picked?'selected':''}" style="--crew:${p.color}"><div class="crew-stage">${astronaut(p)}</div><div class="crew-info"><h4 class="crew-name">${p.name}</h4><span class="crew-role">${p.role}</span><span class="status ${seat.player?'player':''}"><span class="dot"></span>${esc(seat.text)}</span></div><div class="crew-actions">${take?`<button class="invite" type="button" data-take="${p.id}" aria-label="${t('lobby.takeSeatBtn')}: ${p.name}">${t('lobby.takeSeatBtn')}</button>`:''}<button class="pick" type="button" data-pick="${p.id}" aria-label="${t('lobby.detailsBtn')}: ${p.name}" aria-pressed="${picked}">${t('lobby.detailsBtn')}</button></div></article>`;}).join('');
    $$('#crew-grid [data-pick]').forEach(b=>b.addEventListener('click',()=>{state.detail={kind:'crew',id:b.dataset.pick};renderLobby();}));
    $$('#crew-grid [data-take]').forEach(b=>b.addEventListener('click',()=>net.setSeat(b.dataset.take)));
    renderModeStep();renderDifficultyStep();renderSiteStep();renderRoom();renderLobbyStepper();renderDetail();syncSetup();
  }
  // Who plays each crew member: the room's peers, or (solo) the player as Helena and the AI for the rest.
  function seatStatus(id){
    if(net.mode==='solo'){const host=id===crew[0].id,pName=net.getPlayerName?.();return {player:host,text:host?(pName?`${pName} · ${t('lobby.hostPlayer')}`:t('lobby.hostPlayer')):t('lobby.aiNpc')};}
    const peer=net.peerOf(id);
    if(!peer)return {player:false,text:t('lobby.aiNpc')};
    const pName=net.sanitizePlayerName?.(peer.meta?.name)||'';
    const roleText=(peer.host?t('lobby.seatHost'):t('lobby.seatPlayer'))+(peer.online?'':t('lobby.seatOffline'))+(peer.id===net.you.id?t('lobby.seatYou'):'');
    return {player:true,text:pName?`${pName} · ${roleText}`:roleText};
  }
  const playerCount = () => net.mode==='solo'?1:net.peers.filter(p=>p.online).length;
  // Room panel in Step 5: only shown in Multiplayer (code, room name/privacy tags, invite link, leave, plus one-time name entry if joined via invite link).
  function renderRoom(){
    const panel=$('#room-panel');if(!panel)return;
    if(!net.enabled||net.mode==='solo'){panel.hidden=true;panel.innerHTML='';return;}
    if(panel.contains(document.activeElement)) return;
    panel.hidden=false;
    const lost=net.status!=='open';
    const nameLocked=!!net.isPlayerNameLocked?.();
    const curName=nameLocked?net.getPlayerName():'';
    panel.innerHTML=`<span class="micro">${t('lobby.room.label')}</span><strong class="room-code">${esc(net.code)}</strong>${net.roomName?`<span class="tag">${esc(net.roomName)}</span>`:''}${net.hasPassword?`<span class="tag">${t('lobby.roomBrowser.lockedBadge')}</span>`:''}${net.isPrivate?`<span class="tag">${t('lobby.roomBrowser.privateBadge')}</span>`:''}<button class="button" type="button" id="room-copy">${t('lobby.room.copyLink')}</button><button class="button quiet" type="button" id="room-leave">${t('lobby.room.leave')}</button>${nameLocked?`<span class="tag">${esc(curName)}</span>`:`<div class="room-name-edit"><span class="micro">${t('lobby.roomBrowser.playerNameLabel')}</span><input class="mp-input" id="room-player-name" maxlength="20" autocomplete="nickname" placeholder="${esc(t('lobby.roomBrowser.playerNamePlaceholder'))}"><button class="button secondary" type="button" id="room-name-confirm">${t('lobby.roomBrowser.confirmNameBtn')}</button></div>`}<span class="room-note">${lost?t('lobby.room.reconnecting'):net.isHost?t('lobby.room.hostNote'):t('lobby.room.guestNote')}</span>`;
    $('#room-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(net.link);toast(t('lobby.room.linkCopied'));}catch{prompt(t('lobby.room.copyPrompt'),net.link);}});
    $('#room-leave').addEventListener('click',()=>{net.leave();});
    if(!nameLocked){
      const saveOnce=()=>{
        const input=$('#room-player-name');
        const clean=net.sanitizePlayerName?.(input?.value)||'';
        if(clean.length<2){toast(t('lobby.roomBrowser.nameRequired'));input?.focus();return;}
        net.setPlayerName?.(clean);
        renderLobby();
      };
      $('#room-name-confirm')?.addEventListener('click',saveOnce);
      $('#room-player-name')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveOnce();});
    }
  }
  async function enterRoom(go, onSuccess, rethrow = false){
    $$('#mode-mp-cta button, #mode-mp-foot button, #room-panel button, [data-join-room]').forEach(b=>{b.disabled=true;});
    try{
      await go();
      if(onSuccess) onSuccess();
    }catch(err){
      if(rethrow){ renderLobby(); throw err; }
      toast(net.message(err));
    }
    renderLobby();
  }
  function renderDetail(){
    const d=state.detail,view=$('#detail-view');
    if(d.kind==='crew'){
      const p=crew.find(c=>c.id===d.id);
      $('#detail-kind').textContent=t('lobby.kindCrew');$('#detail-name').textContent=p.name;$('#detail-role').textContent=p.role;$('#detail-desc').textContent='“'+p.quote+'”';
      $('#detail-status').textContent=seatStatus(p.id).text;
      $('#detail-extra').innerHTML=p.tags.map(tg=>`<span class="tag">${tg}</span>`).join('')+`<div class="perk"><strong>${p.perk}</strong><p>${p.perkText}</p></div>`;
      view.classList.remove('site');view.style.setProperty('--crew',p.color);
    }else{
      const s=SITES_INFO[d.id];
      $('#detail-kind').textContent=t('lobby.kindSite');$('#detail-name').textContent=s.name;$('#detail-role').textContent=s.tag;$('#detail-desc').textContent=s.desc;
      $('#detail-status').textContent=state.site===d.id?t('lobby.siteSelected'):t('lobby.siteAvailable');
      $('#detail-extra').innerHTML='';$('#detail-site').innerHTML=sitePhoto(d.id,true);view.classList.add('site');
    }
    window.dispatchEvent(new CustomEvent('astro:detail',{detail:d}));
  }

  // Planner: Main Booster (engine cluster + tank) → 0 to 7 middle stages (1 module each) → cabin (4 modules).
  const moduleKey = sel => sel.kind==='stage'?`stage-${sel.index}`:sel.kind;
  const parseKey = key => key.startsWith('stage-')?{kind:'stage',index:+key.slice(6)}:{kind:key};
  // [title, contents, status]; the status line (Δv of a propulsive stage or why it cannot fire) needs metrics().
  function moduleLabel(key,m){
    const r=state.rocket,st=m?.stack.find(s=>s.key===key);
    const engineSub=s=>s.engine&&s.tank?`${shortName(s.engine)} + ${shortName(s.tank)}`:s.engine?t('planner.tankMissing'):s.tank?t('planner.engineMissing'):t('planner.engineTankEmpty');
    const status=!st?'':st.issue==='propellant'?t('planner.propellantMismatch'):st.issue==='thrust'?t('planner.tooWeakTwr',{twr:U.decimal(st.twr,2)})
      :st.dv?`Δv ${U.velocityMs(st.dv)}${key!=='booster'?` · TWR ${U.decimal(st.twr,2)}`:''}`:st.issue&&key!=='booster'?t('planner.deadWeight'):'';
    if(key==='booster')return [t('planner.stage1Title'),engineSub(r.booster)+(r.booster.fins?t('planner.plusFins'):''),status];
    if(key==='cabin')return [t('planner.cabinTitle'),t('planner.cabinSlotsCount',{used:r.cabin.length,total:CABIN_SLOTS()}),''];
    const i=+key.slice(6),stage=r.stages[i],item=stage?.item;if(stage?.type==='booster')return [t('planner.stageNTitle',{n:i+2}),engineSub(stage),status];return [t('planner.stageBayTitle',{n:i+2}),item?shortName(item):t('planner.emptyBay'),''];
  }
  // An engine and a tank work together only when they hold the same propellants (specs: `propellants`).
  const fuelOf = id => (spec(id).propellants||[]).join('/');
  const sameFuel = (engine,tank) => [...(spec(engine).propellants||[])].sort().join('/')===[...(spec(tank).propellants||[])].sort().join('/');
  // Totals: cost, mass and cruise power of every module, plus the staged Δv (references/parts/parts.md: Tsiolkovsky
  // per stage, m0 = the stage and everything above it, fuelled).
  // - Propulsive stages are the Main Booster and every middle stage set to "booster". They fire bottom-up; each
  //   one drops its engines, tank, thrust section (and the fins, on stage 1) when its tank runs dry.
  // - Stage 1 uses the Isp averaged between sea level and vacuum; upper stages use the vacuum Isp.
  // - A stage with a missing part or mismatched propellants cannot fire: it rides along as dead weight.
  // - Equipment bays and the cabin ride all the way to Mars.
  // - Orbit: the stage burning when the running Δv reaches low Earth orbit refuels in orbit. Refilled, it and the
  //   stages above must give the Mars transfer Δv; the refuel is the propellant it is missing for that.
  // Engine pumps draw power only during the ascent, so engines stay out of the cruise power balance.
  function metrics(){
    const r=state.rocket,g0=rule('g0Ms2',9.80665),tol=1-LV().dvTolerance,leo=rule('earthOrbitDeltaVMs',9400)*tol,transfer=rule('marsTransferDeltaVMs',4300)*tol;
    let cost=0,draw=0,gen=0,payload=0;
    const take=s=>{if(!s)return 0;cost+=s.costM||0;if(s.powerW<0)draw-=s.powerW;else gen+=s.powerW||0;return s.massDryKg||0;};
    const engineStage=(key,m,first)=>{
      const e=m.engine?spec(m.engine):null,t=m.tank?spec(m.tank):null,n=e?(e.defaultClusterCount||1):0;
      let hw=take(spec('booster-thrust-section'));
      if(e){cost+=n*(e.costM||0);hw+=n*(e.massDryKg||0);}
      if(t){cost+=t.costM||0;hw+=t.massDryKg||0;}
      if(first&&m.fins)hw+=take(spec(m.fins));
      const issue=!e||!t?'incomplete':!LV().fuelTypes||sameFuel(m.engine,m.tank)?null:'propellant';
      const ispVac=e?.ispVacS||0,isp=first&&e?.ispSlS?(e.ispSlS+ispVac)/2:ispVac;
      return {key,hw,prop:t?.propellantMassKg||0,isp,ispVac,thrustSl:n*(e?.thrustSlKn||0)*1000,thrustVac:n*(e?.thrustVacKn||0)*1000,issue,ready:!issue,dv:0};
    };
    const stack=[engineStage('booster',r.booster,true)];
    r.stages.forEach((s,i)=>{if(s.type==='booster')stack.push(engineStage(`stage-${i}`,s,false));else payload+=take(spec('stage-module'))+take(s.item?spec(s.item):null);});
    payload+=take(spec('crew-cabin'));r.cabin.forEach(id=>{payload+=take(spec(id));});
    // Upper stages that cannot fire ride along as dead weight. Besides an incomplete stage or a propellant mismatch, that
    // includes a stage too weak to climb: vacuum thrust-to-weight at its ignition below minUpperStageTwr. Dead weight
    // makes the stages above heavier, so the check runs again from the bottom up until nothing changes.
    const ready=stack[0].ready,upperTwr=UPPER_TWR(),mass=payload+stack.reduce((a,s)=>a+s.hw+s.prop,0);
    let firing=[];
    for(let pass=0;pass<stack.length;pass++){
      firing=ready?stack.filter(s=>s.ready):[];
      let m=mass;
      stack.forEach(s=>{s.dv=0;});
      for(const s of firing){s.m0=m;s.mf=m-s.prop;s.dv=s.prop&&s.mf>0?s.isp*g0*Math.log(s.m0/s.mf):0;s.twr=s.thrustVac/(m*g0);m=s.mf-s.hw;}
      const weak=firing.slice(1).find(s=>s.twr<upperTwr);
      if(!weak)break;
      weak.issue='thrust';weak.ready=false;
    }
    const dv=firing.reduce((a,s)=>a+s.dv,0),orbit=ready&&dv>=leo;
    let marsDv=0,refuelKg=0,refuelStage=null,orbitLeftKg=0;
    if(orbit){
      let k=0,run=0;while(k<firing.length-1&&run+firing[k].dv<leo)run+=firing[k++].dv;
      const s=firing[k],left=s.m0*Math.exp(-(leo-run)/(s.isp*g0))-s.mf; // propellant still in stage k at orbit
      const above=firing.slice(k+1).reduce((a,x)=>a+x.dv,0),owed=Math.max(0,transfer-above);
      marsDv=s.ispVac*g0*Math.log(s.m0/s.mf)+above; // stage k refilled, burning in vacuum
      refuelKg=Math.max(0,Math.min(s.prop,owed?s.mf*(Math.exp(owed/(s.ispVac*g0))-1):0)-left);
      refuelStage=s;orbitLeftKg=Math.max(0,left);
    }
    const thrust=ready?stack[0].thrustSl:0;
    return {cost,mass,draw,gen,thrust,ready,issue:stack[0].issue,stack,twr:ready&&mass?thrust/(mass*g0):0,dv,orbit,
      marsDv,marsOk:orbit&&marsDv>=transfer,refuelKg,refuelPct:refuelStage?refuelKg/refuelStage.prop*100:0,refuelStage,orbitLeftKg,
      budget:budgetOf(state.difficulty),leo,transfer};
  }
  function setBar(id,frac,mode){const el=$(id);el.style.width=Math.min(100,Math.max(0,frac*100))+'%';el.classList.toggle('danger',mode==='danger');el.classList.toggle('short',mode==='short');}
  let activeHintAction = null;
  function openHintDialog(message, hint, action) {
    const dlg = $('#hint-dialog');
    if (!dlg) return;
    $('#hint-dialog-alert').textContent = message;
    $('#hint-dialog-text').textContent = hint;
    const actBtn = $('#hint-dialog-action');
    activeHintAction = action?.key ? action : null;
    if (actBtn) {
      actBtn.hidden = !activeHintAction;
      if (activeHintAction) actBtn.textContent = `${activeHintAction.label} →`;
    }
    if (!dlg.open) dlg.showModal();
  }
  $('#hint-dialog-close')?.addEventListener('click', () => $('#hint-dialog')?.close());
  $('#hint-dialog-action')?.addEventListener('click', () => {
    const act = activeHintAction;
    $('#hint-dialog')?.close();
    if (act?.key) selectModule(act.key, act.tab);
  });
  $('#hint-dialog')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });
  $$('[data-meter-info]').forEach(btn => btn.addEventListener('click', () => {
    const target = $(`#${btn.dataset.meterInfo}`);
    if (!target) return;
    const open = target.hidden;
    target.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }));
  function setAlert(id, show, message, hint, action) {
    const el = $(id);
    if (!el) return;
    const hintsOn = (window.ASTRO_SETTINGS?.get?.().hints ?? true) && !!hint;
    el.classList.toggle('show', !!show);
    el.classList.toggle('has-hint', !!show && hintsOn);
    el.onclick = null;
    if (!show) { el.replaceChildren(); return; }
    const msg = document.createElement('div');
    msg.className = 'alert-msg';
    msg.textContent = message;
    const nodes = [msg];
    if (hintsOn) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'alert-hint-go';
      btn.textContent = `${t('planner.hints.label')} ↗`;
      btn.addEventListener('click', e => { e.stopPropagation(); openHintDialog(message, hint, action); });
      el.onclick = () => openHintDialog(message, hint, action);
      nodes.push(btn);
    }
    el.replaceChildren(...nodes);
  }
  function renderTelemetry(){
    if(!DATA)return null;
    const m=metrics();
    $('#cost-value').textContent=`${money(m.cost)} / ${money(m.budget)}`;setBar('#cost-fill',m.cost/m.budget,m.cost>m.budget?'danger':'');
    $('#twr-value').textContent=m.ready?U.number(m.twr,{maximumFractionDigits:2}):'—';setBar('#twr-fill',m.ready?m.twr/2:0,m.ready&&m.twr<TWR_MIN()?'danger':'');
    $('#twr-hint').textContent=m.ready&&m.twr>=TWR_BARE()?t('planner.twrHintReady',{sec:ascentSeconds(m.twr),min:U.decimal(TWR_MIN(),1),bare:U.decimal(TWR_BARE(),1),easy:easyNote()}):t('planner.twrHintLow',{bare:U.decimal(TWR_BARE(),1),easy:easyNote()});
    $('#power-value').textContent=`${number(m.gen)} W / ${number(m.draw)} W`;setBar('#power-fill',m.draw?m.gen/(m.draw*1.5):0,m.gen<m.draw?'danger':'');
    $('#dv-value').textContent=m.ready?`${U.velocityMs(m.dv)} / ${U.velocityMs(m.leo)}`:'—';setBar('#dv-fill',m.dv/m.leo,m.ready&&!m.orbit?'short':'');
    $('#mars-value').textContent=m.orbit?`${U.velocityMs(m.marsDv)} / ${U.velocityMs(m.transfer)}`:'—';setBar('#mars-fill',m.marsDv/m.transfer,m.orbit&&!m.marsOk?'short':'');
    $('#mars-hint').textContent=(!m.orbit?t('planner.marsHintWait')
      :!m.marsOk?t('planner.marsHintShort',{stage:stageName(m.refuelStage.key)})
      :m.refuelKg>0?t('planner.marsHintRefuel',{pct:Math.ceil(m.refuelPct),stage:stageName(m.refuelStage.key),mass:tonnes(m.refuelKg)}):t('planner.marsHintEnough'))+` ${tolNote(m.transfer,'marsTransferDeltaVMs')}`;
    $('#dv-hint').textContent=t('planner.dvHint',{tol:tolNote(m.leo,'earthOrbitDeltaVMs')});
    $('#mass-value').textContent=tonnes(m.mass);
    const b=state.rocket.booster,dead=m.stack.slice(1).find(s=>s.issue);
    const hasUpperBooster=state.rocket.stages.some(s=>s.type==='booster');
    const bayIdx=state.rocket.stages.findIndex(s=>s.type!=='booster');
    const bayKey=bayIdx>=0?`stage-${bayIdx}`:null;
    setAlert('#booster-alert',!m.ready,
      !b.engine?t('planner.alerts.noEngine',{easy:easyNote()}):!b.tank?t('planner.alerts.noTank',{easy:easyNote()}):t('planner.alerts.propellantMismatch',{engineFuel:fuelOf(b.engine),tankFuel:fuelOf(b.tank),easy:easyNote()}),
      !b.engine?t('planner.hints.noEngine'):!b.tank?t('planner.hints.noTank',{fuel:fuelOf(b.engine)}):t('planner.hints.propellantMismatch',{engineFuel:fuelOf(b.engine)}),
      {key:'booster',tab:!b.engine?'engine':'tank',label:!b.engine?t('planner.hints.goStage1Engines'):t('planner.hints.goStage1Tanks')}
    );
    setAlert('#stage-alert',!!dead,
      !dead?'':dead.issue==='thrust'?t('planner.alerts.stageTooWeak',{stage:stageName(dead.key).toUpperCase(),twr:U.decimal(dead.twr,2),min:U.decimal(UPPER_TWR(),1),easy:easyNote()})
        :t('planner.alerts.stageDead',{stage:stageName(dead.key).toUpperCase(),reason:dead.issue==='propellant'?t('planner.alerts.reasonPropellant'):t('planner.alerts.reasonIncomplete')}),
      !dead?'':dead.issue==='thrust'?t('planner.hints.stageTooWeak',{stage:stageName(dead.key)}):dead.issue==='propellant'?t('planner.hints.stagePropellant',{stage:stageName(dead.key)}):t('planner.hints.stageIncomplete',{stage:stageName(dead.key)}),
      dead?{key:dead.key,tab:dead.issue==='propellant'?'tank':'engine',label:t('planner.hints.goStage',{stage:stageName(dead.key)})}:null
    );
    setAlert('#twr-alert',m.ready&&m.twr<TWR_MIN(),
      m.twr<TWR_BARE()?t('planner.alerts.noLiftoff',{bare:U.decimal(TWR_BARE(),1),easy:easyNote()}):t('planner.alerts.lowTwr',{min:U.decimal(TWR_MIN(),1)}),
      t('planner.hints.lowTwr',{min:U.decimal(TWR_MIN(),1)}),
      {key:'booster',tab:'engine',label:t('planner.hints.goStage1Engines')}
    );
    setAlert('#dv-alert',m.ready&&!m.marsOk,
      !m.orbit?t('planner.alerts.noOrbit',{easy:easyNote()}):t('planner.alerts.noMars',{marsDv:U.velocityMs(m.marsDv),transfer:U.velocityMs(m.transfer),easy:easyNote()}),
      !m.orbit?(hasUpperBooster?t('planner.hints.noOrbitTank'):t('planner.hints.noOrbitStage')):t('planner.hints.noMars',{stage:m.refuelStage?stageName(m.refuelStage.key):stageName('booster')}),
      {key:!m.orbit?'booster':(m.refuelStage?.key||'booster'),tab:'tank',label:t('planner.hints.goTanks')}
    );
    setAlert('#budget-alert',m.cost>m.budget,
      t('planner.alerts.overBudget'),
      t('planner.hints.overBudget',{over:money(m.cost-m.budget)}),
      {key:'booster',tab:'engine',label:t('planner.hints.goStage1Engines')}
    );
    setAlert('#power-alert',m.gen<m.draw,
      t('planner.alerts.powerDeficit'),
      t('planner.hints.powerDeficit',{watts:number(m.draw-m.gen)}),
      bayKey?{key:bayKey,tab:'power',label:t('planner.hints.goPower')}:null
    );
    $('#budget-remaining').textContent=money(m.budget-m.cost);$('#budget-readout').classList.toggle('negative',m.cost>m.budget);
    return m;
  }
  function renderRocket(){
    const r=state.rocket,keys=['booster',...r.stages.map((_,i)=>`stage-${i}`),'cabin'],cur=moduleKey(state.sel),m=DATA?metrics():null;
    $('#stack-overlay').innerHTML=keys.map((k,i)=>{const [title,sub,status]=moduleLabel(k,m),rem=k.startsWith('stage-')?`<button class="remove-stage" type="button" data-remove="${k.slice(6)}" title="${t('planner.removeTitle',{title})}" aria-label="${t('planner.removeTitle',{title})}">×</button>`:'';return `<div class="stage-node ${i%2?'right':'left'}" data-module="${k}"><button class="rocket-stage ${k===cur?'selected':''}" type="button" data-select="${k}" aria-pressed="${k===cur}"><strong>${title}</strong><small>${sub}</small>${status?`<small>${status}</small>`:''}</button>${rem}</div>`;}).join('')
      +(r.stages.length<MAX_STAGES()?Array.from({length:r.stages.length+1},(_,i)=>`<button class="add-stage" type="button" data-insert="${i}" title="${t('planner.addStageTitle')}" aria-label="${t('planner.addStageAria',{pos:i+2})}">+</button>`).join(''):'');
    $$('#stack-overlay [data-select]').forEach(b=>b.addEventListener('click',()=>selectModule(b.dataset.select)));
    $$('#stack-overlay [data-remove]').forEach(b=>b.addEventListener('click',()=>removeStage(+b.dataset.remove)));
    $$('#stack-overlay [data-insert]').forEach(b=>b.addEventListener('click',()=>addStage(+b.dataset.insert)));
    const installed=[r.booster.engine,r.booster.tank,r.booster.fins,...r.stages.flatMap(s=>s.type==='booster'?[s.engine,s.tank]:[s.item]),...r.cabin].filter(Boolean).length;
    $('#rocket-tags').innerHTML=`<span class="tag">${t('planner.stagesTag',{count:r.stages.length+2})}</span><span class="tag">${t('planner.partsTag',{count:installed})}</span>`;
    window.dispatchEvent(new Event('astro:rocket'));
  }
  const isBooster = sel => sel.kind==='booster'||(sel.kind==='stage'&&state.rocket.stages[sel.index]?.type==='booster');
  const tabsFor = sel => isBooster(sel)?[['engine',t('planner.tabs.engine')],['tank',t('planner.tabs.tank')],...(sel.kind==='booster'?[['fins',t('planner.tabs.fins')]]:[])]:sel.kind==='stage'?EQUIPMENT_GROUPS.map(([k,key])=>[k,t(key)]):CABIN_GROUPS.map(([k,l])=>[k,l]);
  function partsFor(sel,tab){
    const all=Object.entries(DATA.parts);
    // Stage 1 takes sea-level engines; the upper stages take the vacuum ones (thrustSlKn = 0: they cannot lift off).
    if(isBooster(sel))return all.filter(([,p])=>tab==='engine'?p.specs?.engineRole===(sel.kind==='booster'?'booster':'upper-stage'):tab==='fins'?p.category==='fins':p.category==='tanks'&&p.specs?.tankRole==='stage').map(([id])=>id);
    if(sel.kind==='stage'){const g=EQUIPMENT_GROUPS.find(x=>x[0]===tab);return all.filter(([id,p])=>p.category==='equipment'&&g[2].test(id)).map(([id])=>id);}
    return CABIN_GROUPS.find(x=>x[0]===tab)[2];
  }
  const installedIn = sel => isBooster(sel)?Object.values(sel.kind==='booster'?state.rocket.booster:{engine:state.rocket.stages[sel.index].engine,tank:state.rocket.stages[sel.index].tank}).filter(Boolean):sel.kind==='stage'?[state.rocket.stages[sel.index]?.item].filter(Boolean):state.rocket.cabin;
  // Flags a catalog engine or tank whose propellants differ from the partner already installed in the selected stage.
  function fuelClash(id){
    const sel=state.sel;if(!isBooster(sel)||!LV().fuelTypes)return '';
    const m=sel.kind==='booster'?state.rocket.booster:state.rocket.stages[sel.index],partner=part(id)?.category==='engines'?'tank':'engine',other=m[partner];
    return other&&!sameFuel(id,other)?` <span class="warn" title="${t('planner.metrics.differentFuel',{partner})}">≠ ${partner}</span>`:'';
  }
  // Upper stage catalog: the thrust-to-weight the stage would have at ignition with this part (minUpperStageTwr).
  function stageTwr(id){
    const sel=state.sel;if(sel.kind!=='stage'||!isBooster(sel))return [];
    const st=state.rocket.stages[sel.index],slot=part(id)?.category==='engines'?'engine':'tank',was=st[slot];
    st[slot]=id;const s=metrics().stack.find(x=>x.key===`stage-${sel.index}`);st[slot]=was;
    if(!s||s.twr==null||!(s.ready||s.issue==='thrust'))return [];
    return [s.twr<UPPER_TWR()?`<span class="warn" title="${t('planner.metrics.weakTitle',{min:U.decimal(UPPER_TWR(),1)})}">TWR ${U.decimal(s.twr,2)}</span>`:`TWR ${U.decimal(s.twr,2)}`];
  }
  function partMetrics(id){
    const s=spec(id),p=part(id);
    if(p.category==='engines'){const n=s.defaultClusterCount||1,sl=s.thrustSlKn>0;return [`${n}×`,sl?`${U.thrustKn(s.thrustSlKn)}${warn(id,'thrustSlKn')}`:`${U.thrustKn(s.thrustVacKn)} ${t('common.vac')}${warn(id,'thrustVacKn')}`,sl?`Isp ${number(s.ispSlS)}${s.ispVacS&&s.ispVacS!==s.ispSlS?'–'+number(s.ispVacS):''} s${warn(id,'ispSlS')}`:`Isp ${number(s.ispVacS)} s ${t('common.vac')}${warn(id,'ispVacS')}`,`${U.massKg(s.massDryKg)} ${t('common.each')}${warn(id,'massDryKg')}`,fuelOf(id)+fuelClash(id),...stageTwr(id),money(n*s.costM)];}
    if(p.category==='fins')return [U.massKg(s.massDryKg),t('planner.metrics.gusts',{pct:Math.round((1-(s.aeroDriftFactor??1))*100)}),money(s.costM)];
    if(p.category==='tanks')return [`${t('common.propellant')} ${tonnes(s.propellantMassKg)}${warn(id,'propellantMassKg')}`,`${t('common.dry')} ${tonnes(s.massDryKg)}${warn(id,'massDryKg')}`,fuelOf(id)+fuelClash(id),...stageTwr(id),money(s.costM)];
    return [`${U.massKg(s.massDryKg)}${warn(id,'massDryKg')}`,s.powerW>0?`+${number(s.powerW)} W`:`${number(Math.abs(s.powerW||0))} W`,money(s.costM)];
  }
  function partThumbFallback(id, p) {
    const cached = THUMB_CACHE.get(id);
    if (cached) return `<img src="${cached}" alt="">`;
    let polys = '';
    if (p?.category === 'engines') {
      polys = '<polygon points="22,8 42,8 42,18 22,18" fill="#B9B0CE"/><polygon points="20,18 44,18 39,26 25,26" fill="#F59E0B"/><polygon points="25,26 39,26 48,54 16,54" fill="#3a2f52"/><polygon points="25,26 32,26 24,54 16,54" fill="#8f86ab"/>';
    } else if (p?.category === 'tanks') {
      polys = '<polygon points="22,12 32,6 42,12 42,52 32,58 22,52" fill="#e9dccb"/><polygon points="22,12 32,6 32,58 22,52" fill="#FFFFFF"/><polygon points="22,22 42,22 42,27 22,27" fill="#E04F26"/>';
    } else if (id.startsWith('power-')) {
      polys = '<polygon points="6,24 24,18 24,46 6,40" fill="#1d5f9a"/><polygon points="40,18 58,24 58,40 40,46" fill="#2c86ba"/><polygon points="25,16 39,16 39,48 25,48" fill="#F59E0B"/><polygon points="28,22 36,22 36,42 28,42" fill="#FCE8A6"/>';
    } else if (/^(comm|data)-/.test(id)) {
      polys = '<polygon points="14,22 32,10 50,22 42,38 22,38" fill="#FCE8A6"/><polygon points="14,22 32,10 32,38 22,38" fill="#FFFFFF"/><polygon points="30,22 34,12 34,26" fill="#E04F26"/><polygon points="26,38 38,38 42,54 22,54" fill="#3a2f52"/>';
    } else if (/^(sci|drill|truss)-/.test(id)) {
      polys = '<polygon points="16,14 48,14 48,36 16,36" fill="#7EDAC2"/><polygon points="20,18 44,18 44,32 20,32" fill="#17183B"/><polygon points="29,36 35,36 32,56" fill="#F59E0B"/>';
    } else if (id.startsWith('edl-')) {
      polys = '<polygon points="12,34 32,14 52,34" fill="#E04F26"/><polygon points="12,34 32,14 32,34" fill="#EE7B57"/><polygon points="18,34 46,34 38,50 26,50" fill="#F59E0B"/>';
    } else {
      polys = '<polygon points="14,14 50,14 54,24 54,50 10,50 10,24" fill="#9B5DE5"/><polygon points="16,18 48,18 48,32 16,32" fill="#17183B"/><polygon points="18,36 46,36 46,44 18,44" fill="#7EDAC2"/>';
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${polys}</svg>`;
  }
  function renderCatalog(){
    if(!DATA){$('#parts-list').innerHTML=`<div class="empty-state">${t('planner.loadingParts')}</div>`;return;}
    const sel=state.sel,tabs=tabsFor(sel);if(!tabs.some(t=>t[0]===state.tab))state.tab=tabs[0][0];
    $('#category-tabs').innerHTML=tabs.map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" aria-selected="${k===state.tab}">${l}</button>`).join('');
    $$('#category-tabs [data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;renderCatalog();}));
    $('#selected-stage-tag').textContent=moduleLabel(moduleKey(sel))[0].toUpperCase();
    $('#catalog-summary').innerHTML=sel.kind==='stage'?`<label>${t('planner.stageTypeLabel')} <select id="stage-type"><option value="bay">${t('planner.stageTypeBay')}</option><option value="booster">${t('planner.stageTypeBooster')}</option></select></label><br>${isBooster(sel)?t('planner.summaryUpperStage',{twr:U.decimal(UPPER_TWR(),1)}):t('planner.summaryBay')}`:sel.kind==='booster'?t('planner.summaryBooster'):t('planner.summaryCabin',{used:state.rocket.cabin.length,total:CABIN_SLOTS()});
    if(sel.kind==='stage'){const control=$('#stage-type');control.value=state.rocket.stages[sel.index].type||'bay';control.addEventListener('change',()=>{state.tab=control.value==='booster'?'engine':'power';plan('stageType',sel.index,control.value);});}
    const inst=installedIn(sel),current=isBooster(sel)?(sel.kind==='booster'?state.rocket.booster:state.rocket.stages[sel.index])[state.tab]:sel.kind==='stage'?inst[0]:null;
    $('#parts-list').innerHTML=partsFor(sel,state.tab).map(id=>{const p=part(id),on=inst.includes(id);
      return `<article class="part ${on?'equipped':''}"><div class="part-head"><div class="part-thumb" data-part-thumb="${id}">${partThumbFallback(id,p)}</div><div class="part-body"><div class="part-top"><span class="part-name">${esc(partName(id))}</span><span class="part-slot">${t('planner.tier',{n:p.tier})}</span></div><p>${esc(partRole(id).replace(/`/g,''))}</p></div></div><div class="part-metrics">${partMetrics(id).map(x=>`<span>${x}</span>`).join('')}</div><button type="button" data-part="${id}">${on?t('planner.btnRemove'):current?t('planner.btnSwap'):t('planner.btnInstall')}</button></article>`;}).join('');
    $$('#parts-list [data-part]').forEach(b=>b.addEventListener('click',()=>togglePart(b.dataset.part)));
    window.dispatchEvent(new Event('astro:catalog'));
  }
  function renderPlanner(){renderTelemetry();renderRocket();renderCatalog();renderWizard();syncSetup();}
  function selectModule(key,tab){state.sel=parseKey(key);const r=state.rocket;state.tab=tab||(state.sel.kind==='booster'?(r.booster.engine&&!r.booster.tank?'tank':'engine'):state.sel.kind==='cabin'?'helena':'power');window.dispatchEvent(new CustomEvent('astro:focus-module',{detail:key}));renderPlanner();}
  function stepRocketModule(delta){
    const keys=['booster',...state.rocket.stages.map((_,i)=>`stage-${i}`),'cabin'];
    const idx=keys.indexOf(moduleKey(state.sel));
    const next=keys[idx+delta];
    if(next)selectModule(next);
  }
  window.addEventListener('keydown',e=>{
    if(state.screen!=='planner'||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(document.querySelector('dialog[open]'))return;
    const tag=document.activeElement?.tagName;
    if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
    e.preventDefault();
    stepRocketModule(e.key==='ArrowUp'?1:-1);
  });
  // Rocket changes (the shared planner): each one is an action the host applies (plan → ROCKET_ACTIONS) and then
  // sends to the room; a guest sends it to the host instead. The selection and the tab stay on each screen, so the
  // part actions carry the module they apply to. An action returns an error text for the one who did it.
  const ROCKET_ACTIONS = {
    addStage(index){const r=state.rocket;if(r.stages.length>=MAX_STAGES()||!(index>=0&&index<=r.stages.length))return t('planner.errors.noRoomStage');r.stages.splice(index,0,{item:null});},
    removeStage(index){const r=state.rocket;if(!(index>=0&&index<r.stages.length))return t('planner.errors.stageGone');r.stages.splice(index,1);},
    stageType(index,type){const s=state.rocket.stages[index];if(!s||!['bay','booster'].includes(type))return t('planner.errors.stageGone');s.type=type;},
    togglePart(id,sel,tab){
      const r=state.rocket;if(!part(id))return t('planner.errors.unknownPart');
      if(!['booster','stage','cabin'].includes(sel?.kind))return t('planner.errors.unknownModule');
      if(sel.kind==='stage'&&!r.stages[sel.index])return t('planner.errors.stageGone');
      if(isBooster(sel)){if(!['engine','tank','fins'].includes(tab))return t('planner.errors.unknownSlot');const target=sel.kind==='booster'?r.booster:r.stages[sel.index];target[tab]=target[tab]===id?null:id;}
      else if(sel.kind==='stage'){const s=r.stages[sel.index];s.item=s.item===id?null:id;}
      else{const i=r.cabin.indexOf(id);if(i>=0)r.cabin.splice(i,1);else if(r.cabin.length>=CABIN_SLOTS())return t('planner.errors.cabinFull',{max:CABIN_SLOTS()});else r.cabin.push(id);}
    },
  };
  function plan(name,...args){
    if(net.isGuest){
      if(name==='togglePart'){const [id,sel]=args;if(sel.kind==='cabin'&&!state.rocket.cabin.includes(id)&&state.rocket.cabin.length>=CABIN_SLOTS()){toast(t('planner.errors.cabinFull',{max:CABIN_SLOTS()}));return false;}}
      net.act('rocket',name,...args);return true;
    }
    const error=ROCKET_ACTIONS[name](...args);
    if(error){toast(error);return false;}
    fitSelection();renderPlanner();return true;
  }
  // After someone else's change, a selected stage that no longer exists falls back to the booster.
  function fitSelection(){if(state.sel.kind==='stage'&&!state.rocket.stages[state.sel.index]){state.sel={kind:'booster'};state.tab='engine';}}
  function addStage(index){if(plan('addStage',index)){toast(t('planner.stageAdded',{n:index+2}));if(!net.isGuest)selectModule(`stage-${index}`);}}
  function removeStage(index){if(!plan('removeStage',index))return;toast(t('planner.stageRemoved'));if(net.isGuest)return;state.sel=parseKey(index>0?`stage-${index-1}`:'booster');state.tab=isBooster(state.sel)?'engine':'power';window.dispatchEvent(new CustomEvent('astro:stage-removed',{detail:moduleKey(state.sel)}));renderPlanner();}
  function togglePart(id){plan('togglePart',id,{...state.sel},state.tab);}

  // Rocket Construction Wizard — Dr. Nancy Grace Roman + Compact Chalkboard (Lousa)
  // Recommends the wizard on the user's first access to #planner only; can be reopened anytime via #wizard-toggle.
  const WIZARD_SEEN_KEY = 'astro-romana-wizard-seen';
  const wizardState = { open: false, promptOpen: false, step: 0, seen: false, blinkDismissed: false };
  try { wizardState.seen = localStorage.getItem(WIZARD_SEEN_KEY) === '1'; } catch {}
  const WIZARD_STEPS = [
    {
      id: 'welcome',
      targets: () => [$('#planner .blueprint')].filter(Boolean),
      clip: 'wave',
      check: () => ({ done: true, vars: {} }),
      action: () => selectModule('booster', 'engine'),
    },
    {
      id: 'booster',
      targets: () => [$('#planner .catalog')].filter(Boolean),
      clip: 'action_loop',
      check: m => ({
        done: Boolean(m?.ready && m.twr >= TWR_MIN()),
        vars: { twr: m?.ready ? U.decimal(m.twr, 2) : '—' },
      }),
      action: () => selectModule('booster', 'engine'),
    },
    {
      id: 'staging',
      targets: () => {
        const adds = $$('#stack-overlay .add-stage');
        return adds.length ? adds : [$('#planner .blueprint')].filter(Boolean);
      },
      clip: 'action_loop',
      check: m => ({
        done: Boolean(m?.orbit),
        vars: { dv: m?.ready ? U.velocityMs(m.dv) : '—', leo: U.velocityMs(m?.leo ?? rule('earthOrbitDeltaVMs', 9400)) },
      }),
      action: () => {
        const idx = state.rocket.stages.findIndex(s => s.type === 'booster');
        if (idx >= 0) { selectModule(`stage-${idx}`, 'engine'); return; }
        if (state.rocket.stages.length > 0) { selectModule('stage-0'); return; }
        addStage(0);
      },
    },
    {
      id: 'mars',
      targets: () => [$('#mars-value')?.closest('.meter')].filter(Boolean),
      clip: 'action_loop',
      check: m => ({
        done: Boolean(m?.marsOk),
        vars: {
          marsDv: m?.orbit ? U.velocityMs(m.marsDv) : '—',
          transfer: U.velocityMs(m?.transfer ?? rule('marsTransferDeltaVMs', 4300)),
        },
      }),
      action: () => {
        const m = DATA ? metrics() : null;
        selectModule(m?.refuelStage?.key || 'booster', 'tank');
      },
    },
    {
      id: 'bays',
      targets: () => [$('#power-value')?.closest('.meter')].filter(Boolean),
      clip: 'action_loop',
      check: m => ({
        done: Boolean(m && m.gen >= m.draw),
        vars: { gen: number(m?.gen ?? 0), draw: number(m?.draw ?? 0) },
      }),
      action: () => {
        const bayIdx = state.rocket.stages.findIndex(s => s.type !== 'booster');
        if (bayIdx >= 0) selectModule(`stage-${bayIdx}`, 'power');
        else if (state.rocket.stages.length < MAX_STAGES()) addStage(state.rocket.stages.length);
      },
    },
    {
      id: 'cabin',
      targets: () => {
        const cabBtn = $('#stack-overlay [data-select="cabin"]');
        return cabBtn ? [cabBtn] : [$('#planner .blueprint')].filter(Boolean);
      },
      clip: 'action_loop',
      check: () => ({
        done: state.rocket.cabin.length > 0,
        vars: { used: state.rocket.cabin.length, total: CABIN_SLOTS() },
      }),
      action: () => selectModule('cabin', 'helena'),
    },
    {
      id: 'launch',
      targets: () => [$('#budget-readout'), $('#launch-button')].filter(Boolean),
      clip: 'salute',
      check: m => {
        if (!m) return { done: false, vars: { cost: '—', budget: '—', issues: 1 } };
        let issues = 0;
        if (!m.ready || m.twr < TWR_MIN()) issues++;
        if (!m.orbit) issues++;
        if (!m.marsOk) issues++;
        if (m.cost > m.budget) issues++;
        if (m.gen < m.draw) issues++;
        return {
          done: issues === 0,
          vars: { cost: money(m.cost), budget: money(m.budget), issues },
        };
      },
      action: () => showLaunch(),
    },
  ];
  let activeBlinkTargets = [];
  function markWizardSeen() {
    wizardState.seen = true;
    try { localStorage.setItem(WIZARD_SEEN_KEY, '1'); } catch {}
  }
  function clearWizardBlink() {
    $$('#planner .wizard-blink, #planner .wizard-highlight').forEach(el => el.classList.remove('wizard-blink', 'wizard-highlight'));
    activeBlinkTargets = [];
  }
  function stopWizardBlinkOnly() {
    $$('#planner .wizard-blink').forEach(el => el.classList.remove('wizard-blink'));
  }
  function applyWizardBlink(def) {
    clearWizardBlink();
    if (!wizardState.open || !def?.targets) return;
    activeBlinkTargets = def.targets();
    activeBlinkTargets.forEach(el => {
      el.classList.add('wizard-highlight');
      if (!wizardState.blinkDismissed) el.classList.add('wizard-blink');
    });
  }
  function setWizardStep(step) {
    wizardState.step = Math.max(0, Math.min(WIZARD_STEPS.length - 1, step));
    wizardState.blinkDismissed = false;
    renderWizard({ gesture: true });
  }
  function setWizardOpen(open, { step = null, gesture = true } = {}) {
    wizardState.open = !!open;
    wizardState.promptOpen = false;
    if (typeof step === 'number' && step >= 0 && step < WIZARD_STEPS.length) wizardState.step = step;
    if (wizardState.open) wizardState.blinkDismissed = false;
    markWizardSeen();
    renderWizard({ gesture });
  }
  function maybeAutoOpenWizard() {
    if (!wizardState.seen && !wizardState.open && !net.isGuest) {
      wizardState.promptOpen = true;
      renderWizard();
    }
  }
  function renderWizard({ gesture = false } = {}) {
    const dock = $('#rocket-wizard'), promptEl = $('#wizard-prompt'), plannerEl = $('#planner'), toggle = $('#wizard-toggle');
    if (!dock || !plannerEl) return;
    if (promptEl) promptEl.hidden = !wizardState.promptOpen || wizardState.open;
    dock.hidden = !wizardState.open;
    plannerEl.classList.toggle('has-wizard', wizardState.open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(wizardState.open));
      const label = toggle.querySelector('span[data-i18n]');
      if (label) label.textContent = t(wizardState.open ? 'planner.wizard.closeBtn' : 'planner.wizard.openBtn');
    }
    if (!wizardState.open) {
      clearWizardBlink();
      window.dispatchEvent(new CustomEvent('astro:wizard', { detail: { open: false } }));
      return;
    }
    const idx = wizardState.step, def = WIZARD_STEPS[idx], m = DATA ? metrics() : null;
    const status = def.check(m);
    const baseKey = `planner.wizard.steps.${def.id}`;
    $('#wizard-step-kicker').textContent = t('planner.wizard.kicker', { current: String(idx + 1).padStart(2, '0'), total: String(WIZARD_STEPS.length).padStart(2, '0') });
    $('#wizard-step-title').textContent = t(`${baseKey}.title`);
    $('#wizard-step-body').textContent = t(`${baseKey}.body`, status.vars);
    $('#wizard-formula').textContent = t(`${baseKey}.formula`, status.vars);
    const checkEl = $('#wizard-check');
    const checkText = t(status.done ? `${baseKey}.checkReady` : `${baseKey}.checkPending`, status.vars);
    checkEl.textContent = t(status.done ? 'planner.wizard.checkDone' : 'planner.wizard.checkPending', { text: checkText });
    checkEl.classList.toggle('is-done', status.done);
    const nav = $('#wizard-steps-nav');
    if (nav) {
      nav.innerHTML = WIZARD_STEPS.map((s, i) => {
        const done = i > 0 && s.check(m).done;
        return `<button type="button" class="chalk-step-pip${i === idx ? ' active' : ''}${done ? ' done' : ''}" role="tab" aria-selected="${i === idx}" data-wizard-step="${i}" title="${esc(t(`planner.wizard.steps.${s.id}.title`))}">${i + 1}</button>`;
      }).join('');
      $$('[data-wizard-step]', nav).forEach(b => b.addEventListener('click', () => setWizardStep(+b.dataset.wizardStep)));
    }
    const actBtn = $('#wizard-action');
    if (actBtn) {
      const actLabel = t(`${baseKey}.action`);
      actBtn.hidden = !actLabel || actLabel === `${baseKey}.action`;
      actBtn.textContent = actLabel;
    }
    const prevBtn = $('#wizard-prev'), nextBtn = $('#wizard-next');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.textContent = t(idx === WIZARD_STEPS.length - 1 ? 'planner.wizard.finishBtn' : 'planner.wizard.nextBtn');
    applyWizardBlink(def);
    const clip = def.id === 'launch' ? (status.done ? 'salute' : 'action_loop') : def.clip;
    window.dispatchEvent(new CustomEvent('astro:wizard', { detail: { open: true, step: idx, id: def.id, clip: gesture ? clip : null } }));
  }
  // Stop blinking as soon as the user clicks the suggested element on screen, keeping the solid yellow border.
  $('#planner')?.addEventListener('pointerdown', e => {
    if (!wizardState.open || wizardState.blinkDismissed || !activeBlinkTargets.length) return;
    if (activeBlinkTargets.some(el => el.contains(e.target))) {
      wizardState.blinkDismissed = true;
      stopWizardBlinkOnly();
    }
  }, true);
  $('#wizard-prompt-start')?.addEventListener('click', () => setWizardOpen(true, { step: 0, gesture: true }));
  $('#wizard-prompt-dismiss')?.addEventListener('click', () => { wizardState.promptOpen = false; markWizardSeen(); renderWizard(); });
  $('#wizard-toggle')?.addEventListener('click', () => setWizardOpen(!wizardState.open, { gesture: true }));
  $('#wizard-close')?.addEventListener('click', () => setWizardOpen(false));
  $('#wizard-skip')?.addEventListener('click', () => setWizardOpen(false));
  $('#wizard-prev')?.addEventListener('click', () => { if (wizardState.step > 0) setWizardStep(wizardState.step - 1); });
  $('#wizard-next')?.addEventListener('click', () => {
    if (wizardState.step < WIZARD_STEPS.length - 1) setWizardStep(wizardState.step + 1);
    else setWizardOpen(false);
  });
  $('#wizard-action')?.addEventListener('click', () => {
    wizardState.blinkDismissed = true;
    stopWizardBlinkOnly();
    WIZARD_STEPS[wizardState.step]?.action?.();
  });
  $('#wizard-nancy-view')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('astro:wizard-gesture', { detail: { clip: 'action_loop' } }));
  });
  $('#wizard-nancy-view')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('astro:wizard-gesture', { detail: { clip: 'action_loop' } }));
    }
  });
  window.addEventListener('astro:settings', () => { if (wizardState.open || wizardState.promptOpen) renderWizard(); });
  function showLaunch(){
    const m=metrics(),lift=liftoffOf(m),abort=lift.ok?abortOf(m):null,warnings=[];
    if(!lift.ok)warnings.push(`${capFirst(lift.status.toLowerCase())}: ${t('launch.msgNoPad',{detail:''}).trim()}`);
    m.stack.slice(1).filter(s=>s.issue).forEach(s=>warnings.push(s.issue==='thrust'?t('launch.risks.stageWeak',{stage:capFirst(stageName(s.key)),twr:U.decimal(s.twr,2),min:U.decimal(UPPER_TWR(),1)}):t('launch.risks.stageCantFire',{stage:capFirst(stageName(s.key))})));
    if(lift.ok&&m.twr<TWR_MIN())warnings.push(t('launch.risks.lowTwr',{min:U.decimal(TWR_MIN(),1)}));
    if(m.cost>m.budget)warnings.push(t('launch.risks.overBudget'));
    if(m.gen<m.draw)warnings.push(t('launch.risks.powerDeficit'));
    if(m.ready&&!m.orbit)warnings.push(t('launch.risks.noOrbit',{dv:U.velocityMs(m.dv),leo:U.velocityMs(m.leo)}));
    if(m.orbit&&!m.marsOk)warnings.push(t('launch.risks.noMars',{marsDv:U.velocityMs(m.marsDv),transfer:U.velocityMs(m.transfer)}));
    $('#launch-title').textContent=!lift.ok?t('launch.titleNoPad'):abort?(abort.reason==='no-orbit'?t('launch.titleNoOrbit'):t('launch.titleNoMars')):warnings.length?t('launch.titleRisks'):t('launch.titleReady');
    $('#launch-message').textContent=!lift.ok?t('launch.msgNoPad',{detail:lift.detail}):abort?t('launch.msgAbort',{warn:abort.warn}):warnings.length&&!LV().failures?t('launch.msgEasy'):warnings.length?t('launch.msgRisks'):t('launch.msgReady');
    const pc=playerCount();
    $('#launch-summary').innerHTML=[
      [t('launch.summary.crew'),t('launch.summary.crewVal',{players:pc,playerWord:pc>1?t('common.players'):t('common.player'),ai:crew.length-pc})],
      [t('launch.summary.site'),SITES_INFO[state.site].name],
      [t('launch.summary.difficulty'),t(`difficulty.${state.difficulty}.label`).toUpperCase()],
      [t('launch.summary.stages'),`${state.rocket.stages.length+2}`],
      [t('launch.summary.budgetRemaining'),money(m.budget-m.cost)],
      [t('launch.summary.liftoffMass'),tonnes(m.mass)],
      [t('launch.summary.twr'),m.ready?`${U.number(m.twr,{maximumFractionDigits:2})} · ${lift.ok?t('launch.summary.twrAscent',{twr:U.number(m.twr,{maximumFractionDigits:2}),sec:lift.seconds}).split(' · ')[1]:t('launch.summary.twrNoLiftoff')}`:t('launch.summary.twrNoIgnition')],
      [t('launch.summary.dvOrbit'),m.ready?`${U.velocityMs(m.dv)} / ${U.velocityMs(m.leo)}`:'—'],
      [t('launch.summary.marsTransfer'),m.orbit?`${U.velocityMs(m.marsDv)} / ${U.velocityMs(m.transfer)}`:'—'],
      [t('launch.summary.orbitalRefuel'),m.marsOk?(m.refuelKg>0?`${Math.ceil(m.refuelPct)}% · ${tonnes(m.refuelKg)}`:t('launch.summary.notNeeded')):'—'],
      [t('launch.summary.power'),`${number(m.gen)} / ${number(m.draw)} W`],
      [t('launch.summary.risks'),warnings.length?warnings.join('; '):t('common.allClear')]
    ].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('#launch-confirm').textContent=!lift.ok||abort?t('launch.btnLaunchAnyway'):warnings.length&&!LV().failures?t('launch.btnLaunchWarnings'):warnings.length?t('launch.btnLaunchRisks'):t('launch.btnLaunchMission');
    $('#launch-dialog').showModal();
  }
  function setupStars(){const canvas=$('#stars'),ctx=canvas.getContext('2d');if(!ctx)return;let stars=[];let width=0,height=0;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;function resize(){const ratio=Math.min(devicePixelRatio||1,2);width=canvas.clientWidth;height=canvas.clientHeight;canvas.width=width*ratio;canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);stars=Array.from({length:Math.min(150,Math.floor(width*height/8500))},(_,i)=>({x:((i*2819)%1009)/1009*width,y:((i*3877)%1013)/1013*height,r:.4+(i%5)*.25,phase:i*.63,c:['#FCE8A6','#f7dfff','#c9a6ff'][i%3]}));}function draw(time){ctx.clearRect(0,0,width,height);for(const star of stars){ctx.globalAlpha=.25+.45*(.5+.5*Math.sin(time*.0008+star.phase));const r=star.r*1.7;ctx.fillStyle=star.c;ctx.beginPath();ctx.moveTo(star.x,star.y-r);ctx.lineTo(star.x+r*.6,star.y);ctx.lineTo(star.x,star.y+r);ctx.lineTo(star.x-r*.6,star.y);ctx.fill();}ctx.globalAlpha=1;if(!reduce)requestAnimationFrame(draw);}resize();window.addEventListener('resize',resize);requestAnimationFrame(draw);}
  const WORLD_IDS=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
  const worldName = w => t(`orbit.worlds.${w}`);
  // Every planet can be picked; only Mars opens a mission in this prototype, the others show as unavailable.
  // The orbit map listens to astro:world (reticle, and the planet the planning background zooms into).
  state.world = state.world || 'mars';
  function selectWorld(w){
    state.world=w;
    $$('[data-world]').forEach(b=>{const on=b.dataset.world===w;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));const id=b.dataset.world,name=worldName(id);b.setAttribute('aria-label',id==='mars'?`${name}, ${t('orbit.selectedEyebrow').toLowerCase()}`:id==='earth'?`${name}, ${t('orbit.statusOrigin').toLowerCase()}`:`${name}, ${t('orbit.unavailableLower')}`);});
    const open=w==='mars',name=worldName(w);
    $('#objective-title').textContent=open?t('orbit.exploreMars'):name;
    $('#objective-description').textContent=open?t('orbit.marsDesc'):w==='earth'?t('orbit.earthDesc'):t('orbit.unavailableDesc',{name});
    $('#objective-profile').textContent=open?t('orbit.profileCrewed'):'—';
    $('#objective-constraint').textContent=open?t('orbit.constraintValue'):'—';
    $('#objective-status').textContent=open?t('orbit.statusReady'):w==='earth'?t('orbit.statusOrigin'):t('orbit.statusUnavailable');
    $('#objective-status').classList.toggle('locked',!open);
    renderLobbyStepper();
    window.dispatchEvent(new CustomEvent('astro:world',{detail:w}));
  }
  let zoomingToSite = false;
  function goToLandingSite(){
    if(net.isGuest || state.world !== 'mars' || zoomingToSite) return;
    if(state.lobbyStep === 'destination' && window.ASTRO_ZOOM_TO_PLANET){
      zoomingToSite = true;
      window.ASTRO_ZOOM_TO_PLANET().then(() => { zoomingToSite = false; setLobbyStep('site'); });
    }else{
      setLobbyStep('site');
    }
  }
  // The destination, the landing site and the difficulty are host controls; a guest only looks at the site details.
  $$('[data-world]').forEach(button=>button.addEventListener('click',()=>{
    if(net.isGuest)return;
    const w = button.dataset.world;
    selectWorld(w);
    syncSetup();
    if(w === 'mars' && state.lobbyStep === 'destination') goToLandingSite();
  }));
  function requestGameFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) return;
    try { Promise.resolve(req.call(root)).catch(() => {}); } catch {}
  }
  $('#play-button').addEventListener('click',()=>{
    requestGameFullscreen();
    const go=()=>{setLobbyStep(net.isGuest?'crew':net.isHost?'difficulty':'mode');showScreen('lobby');};
    window.ASTRO_LAUNCH?window.ASTRO_LAUNCH().then(go):go();
  });
  $('#leaderboard-button')?.addEventListener('click',()=>openLeaderboard());
  $('#leaderboard-back')?.addEventListener('click',()=>showScreen('menu'));
  $('#leaderboard-refresh')?.addEventListener('click',()=>loadLeaderboardScreen());
  $('#results-open-lb')?.addEventListener('click',()=>openLeaderboard(net.mode==='solo'?'solo':'server'));
  $('#settings-button')?.addEventListener('click',()=>{window.ASTRO_SETTINGS?.syncUI();showScreen('settings');});
  $('#settings-back')?.addEventListener('click',()=>showScreen('menu'));
  $('#lobby-back').addEventListener('click',()=>{
    if(net.isGuest)return;
    const i = LOBBY_STEPS.indexOf(state.lobbyStep);
    if(i > 0) setLobbyStep(LOBBY_STEPS[i - 1]);
    else showScreen('menu');
  });
  $('#mode-solo-btn').addEventListener('click',()=>{
    if(net.isHost)net.leave();
    setLobbyStep('difficulty');
  });
  $('#lobby-next').addEventListener('click',()=>{
    if(net.isGuest)return;
    if(state.lobbyStep==='difficulty')setLobbyStep('destination');
    else if(state.lobbyStep==='destination')goToLandingSite();
    else if(state.lobbyStep==='site')setLobbyStep('crew');
    else if(state.lobbyStep==='crew')showScreen('planner');
  });
  $('#lobby-change-difficulty').addEventListener('click',()=>{if(!net.isGuest)setLobbyStep('difficulty');});
  $$('#mars-pins [data-mars-pin]').forEach(pin=>pin.addEventListener('click',()=>{
    if(net.isGuest)return;
    selectSite(pin.dataset.marsPin,true);
  }));
  $$('#lobby-stepper [data-lobby-step]').forEach(tab=>tab.addEventListener('click',()=>{
    if(net.isGuest)return;
    setLobbyStep(tab.dataset.lobbyStep);
  }));
  $('#planner-back').addEventListener('click',()=>{setLobbyStep('crew');showScreen('lobby');});
  const setDifficulty=level=>{state.difficulty=level;renderDifficultyStep();renderBadge();renderLobbyStepper();renderTelemetry();};
  $('#launch-button').addEventListener('click',showLaunch);
  $('#launch-close').addEventListener('click',()=>$('#launch-dialog').close());
  // Launch: the pad and the countdown (web/launch.js), then the cockpit in the pilot's view. The pad already
  // showed the ignition, so the ascent (liftoff minigame) starts at once.
  // A rocket that cannot lift off (liftoffOf) plays its failure on the pad and goes straight to the debrief.
  $('#launch-confirm').addEventListener('click',()=>{
    $('#launch-dialog').close();
    const lift=DATA?liftoffOf(metrics()):{ok:true,accel:1};
    net.emit({k:'launch',lift}); // guests watch the same pad (and, if it never lifts off, the same debrief)
    let started=false;
    const go=()=>{if(started)return;started=true;const sim=window.ASTRO_SIM;if(!lift.ok){sim?.failLaunch(lift);return;}sim?.startFlight();if(sim?.flight)sim.flight.throttle=Math.max(sim.flight.throttle,.7);};
    if(window.ASTRO_LAUNCHPAD){
      try{Promise.resolve(window.ASTRO_LAUNCHPAD(lift)).then(go,err=>{console.warn('Launchpad fallback:',err);go();});}
      catch(err){console.warn('Launchpad sync fallback:',err);go();}
    }else{go();}
  });
  // Low-poly art: planets and terrain are flat-shaded triangles, like the 3D models.
  const RAMPS = {
    mars:['#3a0f1c','#8F241E','#b8391f','#E04F26','#EE7B57','#f6a07f'],
    marsDark:['#2a0c18','#4a1420','#6e1d1d','#8F241E','#a8361f','#c4502e'],
    ice:['#8a7a86','#c9b8b0','#e9dccb','#FCE8A6','#fff6dc','#ffffff'],
    ocean:['#0b1a3a','#123a6b','#1d5f9a','#2c86ba','#5fb8dc','#a8e6f0'],
    land:['#14261a','#24432a','#3d6b3a','#5f8f4a','#93b46a','#cfe0a0'],
    jupiter:['#2e2020','#5a3e33','#8c6a50','#b8936e','#dcc19a','#f4e2c4'],
    jupiterBand:['#2a1612','#4e2c22','#7a4632','#a5643f','#c98855','#e8b27a'],
    sun:['#8F241E','#E04F26','#F59E0B','#f8c14a','#FCE8A6','#fff7df'],
    rock:['#1a1022','#33263a','#4d3d4c','#6b5a62','#8e7c7c','#b3a196'],
    jezero:['#2a0f22','#4a1420','#8F241E','#b8391f','#E04F26','#EE7B57'],
    gale:['#24101f','#3f1d24','#6e3324','#9c5129','#c27a3a','#e0a35a'],
    ground:['#1D1128','#3a1424','#5e1d22','#8F241E','#b8391f','#E04F26'],
    mercury:['#2a2428','#4a4246','#6e6468','#948a88','#b8aea6','#d8d0c6'],
    venus:['#5a4a2a','#8c7442','#bfa065','#dcc288','#efdcab','#fbf0d0'],
    saturn:['#4a3b25','#7d6542','#b09460','#d4ba82','#ead6a6','#f8ecc9'],
    saturnBand:['#3e2f1e','#6b5236','#957650','#b89a6a','#d2b88a','#e8d6ae'],
    uranus:['#1c3d48','#2f6573','#4f97a5','#7cc2cc','#aee0e3','#dff5f5'],
    neptune:['#0d1a4a','#1a2f7a','#2b4fb0','#4672d4','#7c9fe8','#b9cdf6']
  };
  const random = seed => { let s = (seed * 9973) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const pick = (ramp, t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))];
  const poly = (pts, fill) => `<polygon points="${pts.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ')}" fill="${fill}" stroke="${fill}"/>`;
  // Triangle strip between two closed rings of different vertex counts.
  function zip(A, B) {
    const T = Math.PI * 2, base = Math.atan2(A[0][1], A[0][0]);
    const ang = p => ((Math.atan2(p[1], p[0]) - base) % T + T) % T;
    let start = 0; B.forEach((p, j) => { if (ang(p) < ang(B[start])) start = j; });
    const b = B.map((_, j) => B[(start + j) % B.length]), at = A.map(ang), bt = b.map(ang), tris = [];
    let i = 0, j = 0;
    while (i < A.length || j < b.length) {
      const nextA = i < A.length ? (i + 1 < A.length ? at[i + 1] : T) : Infinity;
      const nextB = j < b.length ? (j + 1 < b.length ? bt[j + 1] : T + bt[0]) : Infinity;
      if (nextA <= nextB) { tris.push([A[i % A.length], A[(i + 1) % A.length], b[j % b.length]]); i++; }
      else { tris.push([A[i % A.length], b[(j + 1) % b.length], b[j % b.length]]); j++; }
    }
    return tris;
  }
  // Sphere seen from the front: rings of vertices lifted onto the sphere, one flat colour per face.
  function facetPolys({ ramp, seed = 1, rings = [6, 12, 18], light = [-.55, -.6, .58], regions = [] }) {
    const rnd = random(seed), L = unit(light);
    const loops = rings.map((n, i) => {
      const last = i === rings.length - 1, r = (i + 1) / rings.length, off = rnd() * 6.283;
      return Array.from({ length: n }, (_, k) => {
        const a = off + (k + (last ? 0 : (rnd() - .5) * .5)) * 6.283 / n, rr = last ? 1 : r * (.9 + rnd() * .14);
        return [rr * Math.cos(a), rr * Math.sin(a)];
      });
    });
    const tris = loops[0].map((p, k, a) => [[0, 0], p, a[(k + 1) % a.length]]);
    for (let i = 0; i + 1 < loops.length; i++) tris.push(...zip(loops[i], loops[i + 1]));
    const lift = ([x, y]) => [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
    return `<g stroke-width=".008" stroke-linejoin="round">${tris.map(t => {
      const [a, b, c] = t.map(lift), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
      if (n[2] < 0) n = n.map(x => -x);
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
      const region = regions.find(r => r.test(cx, cy));
      return poly(t, pick(region ? region.ramp : ramp, Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) + (rnd() - .5) * .12));
    }).join('')}</g>`;
  }
  const facetPlanet = opts => `<svg viewBox="-1.02 -1.02 2.04 2.04" aria-hidden="true">${facetPolys(opts)}</svg>`;
  const PLANETS = {
    mars: { ramp: RAMPS.mars, regions: [{ test: (x, y) => y < -.8, ramp: RAMPS.ice }, { test: (x, y) => Math.sin(x * 4.2 + 1.3) * Math.cos(y * 3.1 - .4) > .42, ramp: RAMPS.marsDark }] },
    earth: { ramp: RAMPS.ocean, regions: [{ test: (x, y) => Math.abs(y) > .82, ramp: RAMPS.ice }, { test: (x, y) => Math.sin(x * 3.3 + .6) + Math.cos(y * 4.1 + x * 1.7) > .9, ramp: RAMPS.land }] },
    jupiter: { ramp: RAMPS.jupiter, regions: [{ test: (x, y) => Math.floor((y + 1) * 3.2) % 2 === 1, ramp: RAMPS.jupiterBand }] },
    mercury: { ramp: RAMPS.mercury },
    venus: { ramp: RAMPS.venus },
    saturn: { ramp: RAMPS.saturn, regions: [{ test: (x, y) => Math.floor((y + 1) * 3.6) % 2 === 1, ramp: RAMPS.saturnBand }] },
    uranus: { ramp: RAMPS.uranus },
    neptune: { ramp: RAMPS.neptune, regions: [{ test: (x, y) => Math.hypot(x + .3, y + .25) < .22, ramp: RAMPS.ocean }] }
  };
  // Landscape: rows of jittered vertices from a silhouette profile down to the bottom edge.
  function facetTerrain({ profile, ramp, seed = 1, w = 160, h = 100, cols = 12, rows = 5 }) {
    const rnd = random(seed);
    const top = x => { for (let k = 1; k < profile.length; k++) if (x <= profile[k][0]) { const [x0, y0] = profile[k - 1], [x1, y1] = profile[k]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return profile[profile.length - 1][1]; };
    const xs = Array.from({ length: cols + 1 }, (_, c) => c === 0 || c === cols ? c / cols : (c + (rnd() - .5) * .6) / cols);
    const grid = Array.from({ length: rows + 1 }, (_, r) => xs.map(x => {
      const y0 = top(x), t = Math.pow(r / rows, 1.5), jitter = r > 0 && r < rows ? (rnd() - .5) * .05 : 0;
      return [x * w, (y0 + (1 - y0) * t + jitter) * h];
    }));
    let out = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1];
      const pair = (r + c) % 2 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
      pair.forEach((t, k) => { out += poly(t, pick(ramp, .78 - r / rows * .5 + (k ? -.12 : .1) + (rnd() - .5) * .22)); });
    }
    return `<g stroke-width=".25" stroke-linejoin="round">${out}</g>`;
  }
  const SITES = {
    jezero: { ramp: RAMPS.jezero, seed: 4, profile: [[0, .34], [.12, .3], [.22, .38], [.35, .44], [.5, .46], [.65, .45], [.78, .39], [.9, .31], [1, .35]] },
    gale: { ramp: RAMPS.gale, seed: 9, profile: [[0, .52], [.15, .5], [.3, .47], [.42, .36], [.5, .22], [.58, .3], [.68, .42], [.82, .49], [1, .5]] }
  };
  // Landing site photo: the real HiRISE orthoimage around the landing point (assets/sites, tools/web/site-photos.mjs).
  // The big view marks the 512 m walkable terrain (centre third of the 1.5 km photo) and credits the source.
  const sitePhoto = (id, big) => `<img class="site-photo" src="assets/sites/${id}.png" alt="${big ? t('lobby.sitePhotoAlt', { name: SITES_INFO[id].name }) : ''}">`
    + (big ? `<span class="site-walk" aria-hidden="true"><small>${t('lobby.walkArea', { dist: U.distanceM(512, 0) })}</small></span><span class="site-credit">${t('lobby.siteCredit', { width: U.distanceKm(1.5, 1) })}</span>` : '');
  function menuMars() {
    const tilt = -14 * Math.PI / 180, at = t => { const x = 1.45 * Math.cos(t), y = .36 * Math.sin(t); return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]; };
    const arc = (t0, t1) => Array.from({ length: 13 }, (_, k) => at(t0 + (t1 - t0) * k / 12).map(v => v.toFixed(3)).join(',')).join(' ');
    const [px, py] = at(Math.PI * .8);
    return `<svg viewBox="-1.6 -1.6 3.2 3.2" aria-hidden="true"><polyline class="orbit-back" points="${arc(Math.PI, Math.PI * 2)}"/>${facetPolys({ ...PLANETS.mars, seed: 11, rings: [6, 12, 18, 24] })}<polyline points="${arc(0, Math.PI)}"/><g transform="translate(${px.toFixed(3)} ${py.toFixed(3)}) scale(.09)">${facetPolys({ ramp: RAMPS.rock, seed: 5, rings: [5, 9] })}</g></svg>`;
  }
  // Polygonal orbits plus a Hohmann-style transfer from Earth (r 26, 200°) to Mars arrival (r 38.5, 20°).
  function orbitRings() {
    const ring = (r, n) => `<polygon points="${Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return (50 + r * Math.cos(a)).toFixed(2) + ',' + (50 + r * Math.sin(a)).toFixed(2); }).join(' ')}"/>`;
    const r1 = 26, r2 = 38.5, e = (r2 - r1) / (r2 + r1), p = (r1 + r2) / 2 * (1 - e * e), th0 = 200 * Math.PI / 180;
    const transfer = Array.from({ length: 11 }, (_, k) => { const t = k / 10 * Math.PI, r = p / (1 + e * Math.cos(t)); return (50 + r * Math.cos(th0 + t)).toFixed(2) + ',' + (50 - r * Math.sin(th0 + t)).toFixed(2); }).join(' ');
    return `<svg class="orbit-rings" viewBox="0 0 100 100" aria-hidden="true">${ring(13.5, 14)}${ring(26, 20)}${ring(38.5, 26)}${ring(50, 32)}<polyline class="transfer" points="${transfer}"/></svg>`;
  }
  function paintArt() {
    $('.mars').innerHTML = menuMars();
    $('.orbit-system').insertAdjacentHTML('afterbegin', orbitRings());
    $('.orbit-sun').innerHTML = facetPlanet({ ramp: RAMPS.sun, seed: 7, rings: [6, 12], light: [0, 0, 1] });
    $('.earth .planet-disc').innerHTML = facetPlanet({ ...PLANETS.earth, seed: 2, rings: [5, 10, 15] });
    $('.mars-target .planet-disc').innerHTML = facetPlanet({ ...PLANETS.mars, seed: 8, rings: [6, 12, 17] });
    $('.jupiter .planet-disc').innerHTML = facetPlanet({ ...PLANETS.jupiter, seed: 6, rings: [6, 12, 18] });
    const marsFallback = $('#mars-globe-fallback');
    if (marsFallback) marsFallback.innerHTML = facetPlanet({ ...PLANETS.mars, seed: 8, rings: [6, 12, 18, 24] });
    $$('.site-thumb .thumb-art').forEach(el => { el.innerHTML = sitePhoto(el.parentElement.dataset.site); });
  }
  // ===========================================================================
  // PHASES 5–7 SIMULATION ENGINE & RAD SOUNDSCAPE (Cockpit -> Mars Surface -> Results)
  // ===========================================================================
  const SIM = (() => {
    const refuelTarget = () => flight.design?.refuelTarget ?? 100;
    const PUMP_STEP = 25; // game-balance: percentage points per transfer
    // All four flight phases are timed game-balance challenges. The stepper uses these
    // durations directly, so its fill and its remaining-time counter cannot diverge.
    // The liftoff lasts ASCENT.refS for the reference design and follows the liftoff TWR (ascentSeconds).
    const FLIGHT_PHASES = [
      { id: 'liftoff', duration: ASCENT.refS },
      { id: 'separation', duration: 60 },
      { id: 'docking', duration: 32 },
      { id: 'mars-burn', duration: 15 },
    ];
    const phaseDuration = step => (step === 0 && flight.liftoffSeconds) || (FLIGHT_PHASES[step]?.duration ?? 0);
    // Cockpit telemetry, consistent with the rocket that was built (metrics) and with the real order of a flight.
    // Ascent: x = Δv used / leo; speed = x × ORBIT.velMs (the ascent losses spread evenly over the climb) and
    // altitude = ORBIT.altKm × x^1.5 (game shape). Step 0 burns stage 1 dry (or all the way to orbit, if it gets
    // there alone); the first INSERT_S seconds of step 1 finish the climb with the stages above.
    // Landing: Perseverance's entry, descent and landing (Mars 2020) squeezed into the landing minigame.
    const INSERT_S = 6; // game-balance: seconds of upper-stage burn at the start of step 1
    // [seconds after entry, altitude km, speed m/s]. Real (references/experiments/mars-experiments.md): entry at 125 km
    // and 19,500 km/h; parachute at E+4:00, 11 km, 1,512 km/h; backshell off and powered descent from 2.1 km at E+5:50;
    // sky crane from 20 m at 2.7 km/h, 12 s before touchdown, ~7 min after entry. The rows in between are est.:
    // most of the speed goes around peak deceleration (~E+90 s).
    const EDL = [[0, 125, 5417], [60, 66, 4620], [90, 46, 2920], [120, 32, 1210], [150, 21, 590], [240, 11, 420],
      [300, 6, 160], [350, 2.1, 90], [408, 0.02, 0.75], [420, 0, 0]];
    const EDL_CHUTE = 240, EDL_POWERED = 350, EDL_END = 420;
    const DESCENT_RESERVE = 25; // game-balance: % left in the descent tanks at touchdown
    const RAD_MARS_UGY_DAY = 165; // real: quiet-window median, Curiosity RAD detector E (references/datasets/msl-rad)
    const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
    const edlAt = e => {
      const i = Math.max(1, EDL.findIndex(r => r[0] >= e)), [e0, h0, v0] = EDL[i - 1], [e1, h1, v1] = EDL[i];
      const k = (e - e0) / (e1 - e0);
      return [lerp(h0, h1, k), lerp(v0, v1, k)];
    };
    // Which stage burns when: stage 1 in step 0, the orbit stage (the one refuelled in orbit) in steps 1–2.
    function ascentPlan(d) {
      const firing = (d.stack || []).filter(s => s.m0 && s.prop), s1 = firing[0];
      if (!s1) return null;
      const k = d.refuelStage ? Math.max(0, firing.findIndex(s => s.key === d.refuelStage.key)) : firing.length - 1;
      const solo = d.orbit && k === 0, top = firing[k];
      return { s1, top, solo, burn1: solo ? s1.prop - d.orbitLeftKg : s1.prop, x0: solo ? 1 : Math.min(1, s1.dv / d.leo),
        topLeftPct: d.orbit ? (d.orbitLeftKg / top.prop) * 100 : 0, g0: rule('g0Ms2', 9.80665) };
    }
    function updateTelemetry(dt) {
      const f = flight, d = f.design, p = f.ascent, climb = x => { f.velMs = x * ORBIT.velMs; f.altKm = ORBIT.altKm * Math.pow(x, 1.5); };
      if (f.step === 0) {
        const g = f.liftoff, k = g ? g.t / g.duration : 0;
        if (p && g) climb(p.s1.isp * p.g0 * Math.log(p.s1.m0 / (p.s1.m0 - k * p.burn1)) / d.leo);
        else if (g) climb(0.35 * k); // Easy with no firing stage: a plain climb
        else { f.velMs = 0; f.altKm = 0; }
        f.propellant = p ? 100 - (k * p.burn1 / p.s1.prop) * 100 : 100;
      } else if (f.step === 1) {
        f.insertT = Math.min(INSERT_S, f.insertT + dt);
        const k = f.insertT / INSERT_S;
        climb(p ? lerp(p.x0, 1, k) : 1);
        f.propellant = !p ? 0 : p.top === p.s1 ? (p.solo ? p.topLeftPct : 0) : lerp(100, p.topLeftPct, k);
        f.throttle = k < 1 && p && !p.solo ? 1 : 0; // the upper stage burns to orbit, then the engines stop
      } else if (f.step === 2) {
        f.altKm = ORBIT.altKm; f.velMs = ORBIT.velMs; f.throttle = 0;
        f.propellant = Math.min(100, (p?.topLeftPct ?? 0) + f.refuelDone);
      } else if (f.step === 3) {
        const g = f.marsBurn, e = g ? (g.t / g.duration) * EDL_END : 0;
        [f.altKm, f.velMs] = edlAt(e);
        f.propellant = e < EDL_POWERED ? 100 : lerp(100, DESCENT_RESERVE, (e - EDL_POWERED) / (EDL_END - EDL_POWERED));
        f.throttle = e >= EDL_POWERED ? 0.6 : 0; // descent engines only fire after the backshell separates
        if (e >= EDL_CHUTE && !f.edlChuteDeployed) {
          f.edlChuteDeployed = true;
          logFlight(t('cockpit.logs.chuteDeployed', { alt: U.altitudeKm(11), vel: U.speedKmh(1512) }));
          radAudio.tone(820, 0.12, 'triangle', 0.06);
        }
      }
    }
    const tankLabel = () => flight.step === 3 ? t('cockpit.descentTank') : !flight.ascent ? t('cockpit.propellant')
      : flight.step === 0 ? t('cockpit.stage1Tank') : t('cockpit.stageTank', { stage: stageName(flight.ascent.top.key) });
    const clock = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.ceil(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
    const radAudio = {
      muted: false,
      bed: null,
      ctx: null,
      geigerTimer: null,
      ensureCtx() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
      },
      tone(freq, dur = 0.08, type = 'triangle', gain = 0.05) {
        if (this.muted) return;
        this.ensureCtx();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      },
      startSurfaceBed() {
        if (this.muted) return;
        try {
          if (!this.bed) {
            this.bed = new Audio('assets/audio/rad_surface_bed.wav');
            this.bed.loop = true;
            this.bed.volume = 0.35;
          }
          this.bed.play().catch(() => {});
        } catch { /* file:// or autoplay policy fallback */ }
        clearInterval(this.geigerTimer);
        this.geigerTimer = setInterval(() => {
          if (!this.muted && state.screen === 'surface' && Math.random() < 0.38) {
            this.tone(1400 + Math.random() * 500, 0.015, 'square', 0.018);
          }
        }, 420);
      },
      stopAll() {
        if (this.bed) { this.bed.pause(); this.bed.currentTime = 0; }
        clearInterval(this.geigerTimer);
      },
      toggleMute() {
        this.muted = !this.muted;
        if (this.muted) this.stopAll();
        else if (state.screen === 'surface') this.startSurfaceBed();
        $('#audio-toggle-cockpit').textContent = this.muted ? t('cockpit.audioOff') : t('cockpit.audioOn');
      }
    };
    $('#audio-toggle-cockpit').textContent = radAudio.muted ? t('cockpit.audioOff') : t('cockpit.audioOn');
    $('#audio-toggle-cockpit').addEventListener('click', () => radAudio.toggleMute());

    const flight = {
      active: false,
      step: 0, // 0=Liftoff & Max-Q, 1=Bus & Stage Sep, 2=Refuel & Solar Storm, 3=Mars EDL
      progress: 0,
      altKm: 0,
      velMs: 0,
      hull: 100,
      propellant: 100,
      throttle: 0.4,
      pitchX: 0,
      pitchY: 0,
      stability: 100,
      breakers: [false, false, false],
      stageSeparated: false,
      separationAdvancing: false,
      refuelDone: 0,
      stormShielded: false,
      edlChuteDeployed: false,
      score: 100,
      design: null,
      phaseElapsed: 0,
      phaseTimedOut: false,
      completedPhases: new Set(),
      docking: null,
      docked: false,
      marsBurn: null,
      keys: new Set(),
      raf: 0,
      lastTime: 0,
      sparksUntil: 0,
    };

    // Surface experiments: the MVP ground candidates of docs/minigames.md, one per crew member. The owner runs
    // the minigame next to its block and the experiment counts in the results. Real facts come from
    // references/experiments/minigames/*/README.md.
    const SURFACE_TASKS = [
      {
        id: 'H-S1', crew: 'helena',
        get title() { return t('surface.tasks.H-S1.title'); },
        get minigame() { return t('surface.tasks.H-S1.minigame'); },
        get mechanic() { return t('surface.tasks.H-S1.mechanic'); },
        get basis() { return t('surface.tasks.H-S1.basis'); },
        get desc() { return t('surface.tasks.H-S1.desc'); },
        get fact() { return t('surface.tasks.H-S1.fact', { dist: U.distanceKm(17, 0) }); },
      },
      {
        id: 'L-S1', crew: 'lucas',
        get title() { return t('surface.tasks.L-S1.title'); },
        get minigame() { return t('surface.tasks.L-S1.minigame'); },
        get mechanic() { return t('surface.tasks.L-S1.mechanic'); },
        get basis() { return t('surface.tasks.L-S1.basis'); },
        get desc() { return t('surface.tasks.L-S1.desc', { range: U.tempRangeC(780, 820), target: U.tempC(800), goal: U.massGrams(6.0, 1) }); },
        get fact() { return t('surface.tasks.L-S1.fact', { total: U.massGrams(122, 0), target: U.tempC(800) }); },
      },
      {
        id: 'O-S1', crew: 'oscar',
        get title() { return t('surface.tasks.O-S1.title'); },
        get minigame() { return t('surface.tasks.O-S1.minigame'); },
        get mechanic() { return t('surface.tasks.O-S1.mechanic'); },
        get basis() { return t('surface.tasks.O-S1.basis'); },
        get desc() { return t('surface.tasks.O-S1.desc'); },
        get fact() { return t('surface.tasks.O-S1.fact'); },
      },
      {
        id: 'M-S1', crew: 'maya',
        get title() { return t('surface.tasks.M-S1.title'); },
        get minigame() { return t('surface.tasks.M-S1.minigame'); },
        get mechanic() { return t('surface.tasks.M-S1.mechanic'); },
        get basis() { return t('surface.tasks.M-S1.basis'); },
        get desc() { return t('surface.tasks.M-S1.desc'); },
        get fact() { return t('surface.tasks.M-S1.fact'); },
      },
    ];

    // Surface state (rules). The 3D module walks the crew on the real terrain and reports back.
    const surf = { active: false, timerSec: 180, lastTick: 0, raf: 0, activeCrew: 'helena', tasks: SURFACE_TASKS, completed: new Set(), stranded: [] };

    const flightLog = []; // the lines on screen, newest first (also sent to the guests)
    function logFlight(msg) {
      flightLog.unshift(msg); flightLog.length = Math.min(flightLog.length, 7);
      renderFlightLog(flightLog);
    }
    function renderFlightLog(lines) {
      const box = $('#flight-log');
      if (!box) return;
      box.replaceChildren(...lines.map(text => { const line = document.createElement('div'); line.textContent = text; return line; }));
    }

    function captureDesign() {
      const r = state.rocket;
      const installed = new Set([r.booster.engine, r.booster.tank, ...r.stages.map(s => s.item), ...r.cabin].filter(Boolean));
      const m = DATA ? metrics() : { cost: 0, mass: 0, draw: 0, gen: 0, dv: 0, budget: budgetOf(state.difficulty), leo: 9400, twr: 0, ready: false, orbit: false, marsOk: false, refuelPct: 0 };
      return {
        ...m,
        // Share of the refuelling stage's tank to pump in orbit (metrics); a full tank when Mars is out of reach.
        refuelTarget: m.marsOk ? Math.ceil(m.refuelPct) : 100,
        refuelTank: m.marsOk && m.refuelStage ? stageName(m.refuelStage.key) : null,
        lowTwr: !m.ready || m.twr < TWR_MIN(), // facts for the debrief; the flags below are the in-flight trouble
        overweight: LV().penalties && (!m.ready || m.twr < TWR_MIN()),
        budgetPenalty: LV().penalties && m.cost > m.budget,
        finsDrift: r.booster.fins ? (spec(r.booster.fins).aeroDriftFactor ?? 1) : 1, // aerodynamic minigames: gust scale
        overBudget: m.cost > m.budget,
        powerDeficit: LV().penalties && m.gen < m.draw,
        lowDv: !m.orbit,
        hasHera: installed.has('cabin-hera-dosimetry'),
        hasShelter: installed.has('cabin-storm-shelter') || installed.has('hab-veggie-rad-astrorad'),
        hasCockpitUpgrade: installed.has('cabin-orion-cockpit') || installed.has('cabin-autonav-conjunction'),
        hasLoftid: installed.has('edl-aspire-loftid'),
        hasTrn: installed.has('edl-trn-medli2'),
        hasDrill: installed.has('drill-corer-cryo') || installed.has('sci-seis-caching'),
        hasSpec: installed.has('sci-pixl-sherloc-supercam') || installed.has('sci-hirise-sharad') || installed.has('truss-ingenuity'),
        hasDna: installed.has('cabin-msg-minion'),
        hasDish: installed.has('comm-dsoc-laser') || installed.has('comm-electra-marco') || installed.has('comm-rise-xband') || installed.has('cabin-scan-console'),
      };
    }

    function startFlight() {
      flight.design = captureDesign();
      flight.missionId = 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      flightLog.length = 0; remoteInput.clear();
      flight.liftoffSeconds = flight.design.ready && flight.design.twr >= TWR_BARE() ? ascentSeconds(flight.design.twr) : 0;
      flight.ascent = ascentPlan(flight.design);
      flight.insertT = 0;
      flight.landingShare = null;
      flight.active = true;
      flight.step = 0;
      flight.progress = 0;
      flight.altKm = 0;
      flight.velMs = 0;
      flight.hull = 100;
      flight.propellant = 100;
      flight.throttle = 0.35;
      flight.pitchX = 0;
      flight.pitchY = 0;
      flight.stability = 100;
      flight.liftoff = null;
      flight.hold = null;
      flight.breakers = [
        flight.design.powerDeficit,
        flight.design.powerDeficit || flight.design.overweight,
        false,
      ];
      flight.stageSeparated = false;
      flight.separationAdvancing = false;
      flight.refuelDone = 0;
      flight.stormShielded = false;
      flight.edlChuteDeployed = false;
      flight.score = 100 - (flight.design.budgetPenalty ? 12 : 0) - (flight.design.overweight ? 10 : 0);
      flight.sparksUntil = flight.design.powerDeficit || flight.design.overweight ? performance.now() + 2800 : 0;
      flight.phaseElapsed = 0;
      flight.phaseTimedOut = false;
      flight.completedPhases = new Set();
      flight.docking = null;
      flight.docked = false;
      flight.marsBurn = null;

      logFlight(t('cockpit.logs.deckOnline'));
      if (flight.design.ready) logFlight(t('cockpit.logs.twrClimb', { twr: U.decimal(flight.design.twr, 2), sec: phaseDuration(0) }));
      if (flight.design.overweight) logFlight(t('cockpit.logs.lowTwrAlert', { min: U.decimal(TWR_MIN(), 1) }));
      if (flight.design.powerDeficit) logFlight(t('cockpit.logs.powerAlert'));
      if (flight.design.budgetPenalty) logFlight(t('cockpit.logs.budgetAlert'));
      showScreen('cockpit');
      renderFlightUI();
      cancelAnimationFrame(flight.raf);
      flight.lastTime = performance.now();
      flight.raf = requestAnimationFrame(flightTick);
    }

    // Reusable mechanic "keep in range" (docs/minigames.md): a value drifts on its own and the player pushes it
    // back (input −1…1) to keep it inside the green band. The value has inertia, so corrections overshoot.
    // Stars come from the share of time spent inside the band (0–3, docs/minigames.md rule 3).
    // axes: 1 (a gauge) or 2 (a reticle: inside the band when the distance to the centre is ≤ band).
    // drift(t) and input return one number per axis.
    function createKeepInRange({ duration, band, limit, authority, damping = 1.5, drift, axes = 1 }) {
      const g = { t: 0, value: Array(axes).fill(0), rate: Array(axes).fill(0), inBand: 0, duration, band, limit, axes, error: 0, done: false };
      g.tick = (dt, input) => {
        if (g.done) return g;
        g.t = Math.min(duration, g.t + dt);
        const d = [].concat(drift(g.t, g.value)), u = [].concat(input);
        for (let k = 0; k < axes; k++) {
          g.rate[k] += ((d[k] || 0) + (u[k] || 0) * authority - g.rate[k] * damping) * dt;
          g.value[k] = Math.max(-limit, Math.min(limit, g.value[k] + g.rate[k] * dt));
          if (Math.abs(g.value[k]) === limit) g.rate[k] = 0;
        }
        g.error = Math.hypot(...g.value);
        if (g.error <= band) g.inBand += dt;
        g.done = g.t >= duration;
        return g;
      };
      g.share = () => (g.t ? g.inBand / g.t : 1);
      g.stars = () => { const k = g.share(); return k >= 0.85 ? 3 : k >= 0.65 ? 2 : k >= 0.4 ? 1 : 0; };
      return g;
    }

    // Liftoff (Helena, keep in range on the navball): hold the ascent program through Max-Q in pitch and yaw.
    // value = [pitch, yaw] error in degrees (pitch > 0 = nose high, yaw > 0 = nose right); the band is a circle.
    // Gusts grow at Max-Q and with a low TWR; fins damp them (design.finsDrift). All numbers are game-balance.
    // The climb lasts phaseDuration(0), set by the liftoff TWR; maxQ is the share of it where the gusts peak.
    const LIFTOFF = { band: 3, limit: 12, authority: 8, maxQ: [0.4, 0.67], throttle: 0.7 };
    const PORT_DOCK = { band: 0.18, scope: 1.0, zStart: 5.0, zLatch: 0.36 }; // game-balance: cabin docking capture radius (m), 2D scope half-range (m), initial and latch distances (m)
    function startLiftoff() {
      const d = flight.design, s1 = Math.random() * 100, s2 = Math.random() * 100, duration = phaseDuration(0);
      const gust = (d.overweight ? 1.6 : 1) * (d.finsDrift ?? 1); // low TWR: the stack wallows more
      return createKeepInRange({
        axes: 2, duration, band: LIFTOFF.band, limit: LIFTOFF.limit,
        authority: LIFTOFF.authority * (d.hasCockpitUpgrade ? 1.25 : 1),
        drift: t => {
          const u = t / duration, k = gust * (u > LIFTOFF.maxQ[0] && u < LIFTOFF.maxQ[1] ? 2.4 : 1); // gusts peak around Max-Q
          return [k * (3.2 * Math.sin(t * 0.9 + s1) + 2.6 * Math.sin(t * 2.3 + s1 * 1.7) + 1),
            k * (2.8 * Math.sin(t * 1.1 + s2) + 2.2 * Math.sin(t * 1.9 + s2 * 1.3))];
        },
      });
    }
    function finishLiftoff(g) {
      const stars = g.stars(), share = Math.round(g.share() * 100);
      flight.liftoffStars = stars;
      flight.score += (stars - 1) * 4;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      logFlight(t('cockpit.logs.meco', { pct: share, stars: starStr }));
      crewToast(t('cockpit.toasts.liftoffResult', { stars: starStr, pct: share }));
      const abort = flight.design.orbit ? null : abortOf(flight.design); // the stages ran dry short of orbit (not on Easy)
      if (abort) { abortMission(abort); return; }
      setFlightStep(1);
    }

    // After the orbital refuel: the transfer burn either reaches Mars or the crew comes home (abortOf).
    function toMars() {
      const abort = abortOf(flight.design);
      if (abort) abortMission(abort); else setFlightStep(3);
    }

    // Δv abort: the flight stops, the capsule comes down under parachutes into the sea (web/launch.js) and the
    // debrief shows the cause with an empty podium.
    function abortMission(info) {
      flight.active = false;
      cancelAnimationFrame(flight.raf);
      logFlight(`ABORT. ${info.detail}`);
      net.emit({ k: 'abort', info }); // guests play the same splashdown and debrief
      const debrief = () => failLaunch(info);
      if (window.ASTRO_SPLASHDOWN) window.ASTRO_SPLASHDOWN(info).then(debrief); else debrief();
    }

    // Phase 03: relative motion to the station, seen from the centre console's external camera.
    // The station is intentionally close to keep the MVP legible; values are game-balance.
    const DOCKING = { duration: 18, band: 0.18, limit: 1, authority: 1.35 };
    function startDocking() {
      const s1 = Math.random() * 100, s2 = Math.random() * 100;
      const consequence = flight.liftoffStars < 2 || !flight.stageSeparated ? 1.35 : 1;
      return createKeepInRange({
        axes: 2, ...DOCKING,
        drift: t => [
          consequence * (.36 * Math.sin(t * 1.35 + s1) + .18 * Math.sin(t * 2.8 + s1 * .7)),
          consequence * (.32 * Math.sin(t * 1.1 + s2) + .16 * Math.sin(t * 2.4 + s2 * 1.2)),
        ],
      });
    }
    function finishDocking(g) {
      const aligned = Math.round(g.share() * 100);
      flight.docked = true;
      flight.stability = aligned;
      flight.score += g.stars() * 3;
      logFlight(t('cockpit.logs.hardDock', { pct: aligned }));
      crewToast(t('cockpit.toasts.dockingSecure', { pct: aligned }));
      renderFlightUI();
    }

    // Phase 04 reuses the pilot mechanic with the response mirrored: the burn is observed
    // from behind the vehicle, so the player has to counter-steer in the opposite direction.
    const MARS_BURN = { duration: phaseDuration(3), band: LIFTOFF.band, limit: LIFTOFF.limit, authority: LIFTOFF.authority };
    function startMarsBurn() {
      const s1 = Math.random() * 100, s2 = Math.random() * 100;
      const transferPenalty = flight.docking?.stars() < 2 ? 1.25 : 1;
      return createKeepInRange({
        axes: 2, ...MARS_BURN,
        drift: t => [
          transferPenalty * (2.6 * Math.sin(t * .82 + s1) + 1.9 * Math.sin(t * 2.1 + s1 * 1.4)),
          transferPenalty * (2.2 * Math.sin(t * 1.16 + s2) + 1.7 * Math.sin(t * 2.5 + s2 * .8)),
        ],
      });
    }
    function finishMarsBurn(g, timedOut = false) {
      const share = Math.round(g.share() * 100), stars = g.stars();
      flight.score += (stars - 1) * 5 - (timedOut ? 8 : 0);
      flight.landingShare = share;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      logFlight(t('cockpit.logs.touchdown', { pct: share }));
      crewToast(t('cockpit.toasts.landingResult', { stars: starStr, pct: share }));
      finishFlightAndLand();
    }

    function triggerPhaseTransition() {
      for (const el of [$('#cockpit-viewport'), $('#cockpit-minigame')]) {
        if (!el) continue;
        el.classList.remove('is-transitioning');
        void el.offsetWidth;
        el.classList.add('is-transitioning');
        window.setTimeout(() => el.classList.remove('is-transitioning'), 600);
      }
    }

    function setFlightStep(nextStep) {
      flight.completedPhases.add(flight.step);
      flight.step = nextStep;
      flight.progress = 0;
      flight.phaseElapsed = 0;
      flight.phaseTimedOut = false;
      if (nextStep !== 1) flight.separationAdvancing = false;
      flight.input = null;
      flight.hold = null;
      triggerPhaseTransition();
      if (nextStep === 1) {
        const roughAscent = (flight.liftoffStars ?? 0) < 2;
        flight.portDock = {
          x: roughAscent ? 0.62 : 0.45,
          y: roughAscent ? -0.42 : -0.3,
          z: 5,
          fuel: 100,
          status: 'approach',
        };
        flight.breakers = [false, false, false];
        flight.sparksUntil = 0;
        logFlight(t(roughAscent ? 'cockpit.logs.roughAscent' : 'cockpit.logs.boosterSep'));
        radAudio.tone(520, 0.14, 'triangle', 0.05);
      } else if (nextStep === 2) {
        flight.docking = startDocking();
        flight.docked = false;
        flight.refuelDone = 0;
        logFlight(t('cockpit.logs.orbitAchieved', { target: refuelTarget() }));
        radAudio.tone(660, 0.12, 'triangle', 0.05);
      } else if (nextStep === 3) {
        flight.marsBurn = startMarsBurn();
        logFlight(t('cockpit.logs.tmiComplete', { alt: U.altitudeKm(125), vel: U.speedKmh(19500) }));
        radAudio.tone(520, 0.15, 'triangle', 0.05);
      }
      renderFlightUI();
    }

    // Every cockpit action passes here (buttons, keys, 3D clicks). In a room, only the crew member who owns the
    // action may do it (crewFor); a guest sends it to the host, which checks the seat the server stamped.
    function handleCockpitAction(actionId, arg) {
      const seats = crewFor(actionId);
      if (!canAct(seats)) { if (flight.active) toast(t('cockpit.toasts.onlyOwner', { names: crewNames(seats), verb: seats.length > 1 ? t('cockpit.toasts.doPlural') : t('cockpit.toasts.doSingular') })); return; }
      if (net.isGuest) { net.act('cockpit', actionId, arg); return; }
      applyCockpitAction(actionId, arg);
    }
    function applyCockpitAction(actionId, arg) {
      if (!flight.active) return;
      if (actionId === 'throttle_up') {
        flight.throttle = Math.min(1, flight.throttle + 0.35);
        radAudio.tone(240 + flight.throttle * 180, 0.09, 'triangle', 0.05);
        if (flight.step === 0) logFlight(t('cockpit.logs.throttlePushed', { pct: Math.round(flight.throttle * 100) }));
      } else if (actionId === 'steer') {
        const [dx, dy] = arg || [0, 0];
        const gain = flight.design.hasCockpitUpgrade ? 0.32 : 0.24;
        const g = flight.step === 0 ? flight.liftoff : flight.step === 2 && !flight.docked ? flight.docking : flight.step === 3 ? flight.marsBurn : null;
        if (g && !g.done) {
          g.value[1] = Math.max(-g.limit, Math.min(g.limit, g.value[1] + dx * g.band * 1.4));
          g.value[0] = Math.max(-g.limit, Math.min(g.limit, g.value[0] + dy * g.band * 1.4));
          g.rate[1] *= 0.45;
          g.rate[0] *= 0.45;
          g.error = Math.hypot(...g.value);
        } else if (flight.step === 1 && flight.portDock && flight.portDock.status === 'approach') {
          const d = flight.portDock;
          d.x = Math.max(-2, Math.min(2, d.x + dx * 0.28));
          d.y = Math.max(-2, Math.min(2, d.y + dy * 0.28));
          d.fuel = Math.max(0, d.fuel - (Math.abs(dx) + Math.abs(dy)) * 0.65);
        } else {
          flight.pitchX = Math.max(-1, Math.min(1, flight.pitchX + dx * gain));
          flight.pitchY = Math.max(-1, Math.min(1, flight.pitchY + dy * gain));
        }
        radAudio.tone(440, 0.04, 'sine', 0.03);
      } else if (actionId === 'stabilize') {
        const g = flight.step === 0 ? flight.liftoff : flight.step === 2 && !flight.docked ? flight.docking : flight.step === 3 ? flight.marsBurn : null;
        if (g && !g.done) {
          g.value = g.value.map(v => v * 0.65);
          g.rate = g.rate.map(v => v * 0.2);
          g.error = Math.hypot(...g.value);
          flight.stability = Math.min(100, flight.stability + 8);
          if (flight.step === 2) logFlight(t('cockpit.logs.trimFired'));
          radAudio.tone(540, 0.06, 'triangle', 0.04);
          renderFlightUI();
          return;
        }
        if (flight.step === 1 && flight.portDock && flight.portDock.status === 'approach') {
          const d = flight.portDock;
          d.x *= 0.72;
          d.y *= 0.72;
          if (Math.hypot(d.x, d.y) < 0.24) d.z = Math.max(0.35, d.z - 0.32);
          d.fuel = Math.max(0, d.fuel - 1.1);
          radAudio.tone(540, 0.06, 'triangle', 0.04);
          updateCockpitHUD();
          return;
        }
        flight.pitchX *= 0.25;
        flight.pitchY *= 0.25;
        flight.stability = Math.min(100, flight.stability + 12);
        radAudio.tone(540, 0.06, 'triangle', 0.04);
      } else if (actionId === 'breaker') {
        const idx = typeof arg === 'number' ? arg : flight.breakers.findIndex(Boolean);
        if (idx >= 0) {
          flight.breakers[idx] = false;
          logFlight(t('cockpit.logs.breakerReset', { idx: idx + 1 }));
          radAudio.tone(780, 0.07, 'triangle', 0.05);
        }
      } else if (actionId === 'stage_sep') {
        if (flight.step === 1 && flight.portDock && flight.portDock.status === 'approach') {
          const d = flight.portDock;
          d.x *= 0.65;
          d.y *= 0.65;
          if (Math.hypot(d.x, d.y) < 0.22) d.z = Math.max(0.35, d.z - 0.45);
          d.fuel = Math.max(0, d.fuel - 1.4);
          radAudio.tone(620, 0.08, 'triangle', 0.05);
          updateCockpitHUD();
          return;
        }
        if (flight.step === 1 && !flight.portDock && !flight.breakers.some(Boolean) && !flight.stageSeparated) {
          flight.stageSeparated = true;
          flight.separationAdvancing = true;
          logFlight(t('cockpit.logs.stageSep'));
          radAudio.tone(880, 0.14, 'triangle', 0.06);
          renderFlightUI();
          window.setTimeout(() => {
            if (flight.active && flight.step === 1 && flight.separationAdvancing) setFlightStep(2);
          }, 1800);
          return;
        }
        toast(t('cockpit.toasts.resetBreakers'));
      } else if (actionId === 'pump_fuel') {
        if (flight.step === 2 && flight.docked) {
          const target = refuelTarget();
          if (flight.refuelDone >= target) return;
          flight.refuelDone = Math.min(target, flight.refuelDone + PUMP_STEP);
          flight.progress = Math.min(100, (flight.refuelDone / target) * 100);
          logFlight(t('cockpit.logs.fuelTransfer', { done: flight.refuelDone, target }));
          radAudio.tone(500, 0.06, 'sine', 0.04);
        } else if (flight.step === 2) {
          toast(t('cockpit.toasts.holdDock'));
        }
      } else if (actionId === 'shield_storm') {
        flight.stormShielded = true;
        logFlight(t(flight.design.hasShelter ? 'cockpit.logs.shelterSealed' : 'cockpit.logs.waterBags'));
        radAudio.tone(740, 0.1, 'triangle', 0.05);
      } else if (actionId === 'edl_arm') {
        if (flight.step === 3 && !flight.edlChuteDeployed) {
          flight.edlChuteDeployed = true;
          const bonus = (flight.design.hasTrn || flight.design.hasLoftid) ? 18 : 6;
          flight.stability = Math.min(100, flight.stability + bonus);
          logFlight(t(flight.design.hasTrn || flight.design.hasLoftid ? 'cockpit.logs.edlFull' : 'cockpit.logs.edlBackup'));
          radAudio.tone(820, 0.12, 'triangle', 0.06);
        }
      } else if (actionId === 'complete_step') {
        if (flight.step === 2 && flight.docked && flight.refuelDone >= refuelTarget()) {
          toMars();
          return;
        }
      }
      renderFlightUI();
    }

    function finishFlightAndLand() {
      flight.active = false;
      cancelAnimationFrame(flight.raf);
      crewToast(t('cockpit.toasts.arrivedSite', { site: SITES_INFO[state.site].name }));
      startSurface();
    }

    function pilotInput() {
      const { keys: k, hold } = inputOf(), h = hold || {};
      return [
        (k.has('KeyW') || k.has('ArrowUp') || h.up ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') || h.down ? 1 : 0),
        (k.has('KeyD') || k.has('ArrowRight') || h.right ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') || h.left ? 1 : 0),
      ];
    }

    function timeOutFlightPhase() {
      if (flight.phaseTimedOut) return;
      flight.phaseTimedOut = true;
      if (flight.step === 1) {
        flight.score -= 10;
        flight.hull = Math.max(55, flight.hull - 12);
        flight.stageSeparated = true;
        logFlight(t('cockpit.logs.sepTimeout'));
        setFlightStep(2);
      } else if (flight.step === 2) {
        flight.score -= flight.docked ? 4 : 12;
        flight.docked = true;
        flight.refuelDone = refuelTarget();
        logFlight(t('cockpit.logs.dockTimeout'));
        toMars();
      }
    }

    function flightTick(now) {
      if (!flight.active || state.screen !== 'cockpit') return;
      const dt = Math.min(0.05, (now - flight.lastTime) / 1000);
      flight.lastTime = now;
      const keys = inputOf().keys; // mine and the remote pilot's, when we fly this step

      // Keyboard steering (disabled during step 1 3D camera translation)
      if (flight.step !== 1) {
        if (keys.has('ArrowLeft') || keys.has('KeyA')) flight.pitchX = Math.max(-1, flight.pitchX - dt * 1.4);
        if (keys.has('ArrowRight') || keys.has('KeyD')) flight.pitchX = Math.min(1, flight.pitchX + dt * 1.4);
        if (keys.has('ArrowUp') || keys.has('KeyW')) flight.pitchY = Math.max(-1, flight.pitchY - dt * 1.4);
        if (keys.has('ArrowDown') || keys.has('KeyS')) flight.pitchY = Math.min(1, flight.pitchY + dt * 1.4);
      }

      if (flight.step === 0) {
        if (!flight.liftoff && flight.throttle >= LIFTOFF.throttle) {
          flight.liftoff = startLiftoff();
          logFlight(t('cockpit.logs.liftoffHold', { sec: phaseDuration(0) }));
          renderFlightUI();
        }
        const g = flight.liftoff;
        if (g) {
          const [pitch, yaw] = pilotInput();
          flight.input = { up: pitch > 0, down: pitch < 0, right: yaw > 0, left: yaw < 0 };
          g.tick(dt, [pitch, yaw]);
          flight.phaseElapsed = g.t;
          flight.progress = (g.t / g.duration) * 100;
          flight.stability = Math.round(g.share() * 100);
          flight.pitchX = g.value[1] / g.limit; // the RHC leans with the error
          flight.pitchY = -g.value[0] / g.limit;
          if (g.error > g.limit * 0.75) flight.hull = Math.max(50, flight.hull - dt * 3); // off-program loads
          if (g.done) { finishLiftoff(g); }
        }
      } else if (flight.step === 1) {
        const d = flight.portDock, { keys: k, hold } = inputOf(), h = hold || {};
        if (d && d.status === 'approach') {
          flight.phaseElapsed += dt;
          const hasAny = (...codes) => codes.some(c => k.has(c)) ? 1 : 0;
          const x = (hasAny('ArrowRight', 'KeyD') || h.right ? 1 : 0) - (hasAny('ArrowLeft', 'KeyA') || h.left ? 1 : 0);
          const y = (hasAny('ArrowUp') || h.up ? 1 : 0) - (hasAny('ArrowDown') || h.down ? 1 : 0);
          const z = (hasAny('KeyE', 'KeyW') || h.forward ? 1 : 0) - (hasAny('KeyQ', 'KeyS') || h.back ? 1 : 0);
          d.input = { left: x < 0, right: x > 0, up: y > 0, down: y < 0, forward: z > 0, back: z < 0 };
          flight.input = d.input;
          const movement = Math.abs(x) + Math.abs(y) + Math.abs(z);
          const speed = .55; // game-balance: metres per second of relative translation
          d.x = Math.max(-2, Math.min(2, d.x + x * speed * dt));
          d.y = Math.max(-2, Math.min(2, d.y + y * speed * dt));
          d.z = Math.max(.35, Math.min(7, d.z - z * speed * dt));
          d.fuel = Math.max(0, d.fuel - movement * 3 * dt); // game-balance: percent per axis-second
          flight.pitchX = Math.max(-1, Math.min(1, d.x));
          flight.pitchY = Math.max(-1, Math.min(1, -d.y));
          flight.stability = Math.round(Math.max(0, 100 - Math.hypot(d.x, d.y) * 100));
          flight.progress = Math.max(0, Math.min(100, (5 - d.z) / 4.65 * 100));
          if (d.z <= .36 && Math.hypot(d.x, d.y) < .18) {
            d.status = 'success'; flight.stageSeparated = true; flight.score += 10;
            logFlight(t('cockpit.logs.hatchLatched'));
            radAudio.tone(880, 0.14, 'triangle', 0.06);
            crewToast(t('cockpit.toasts.dockingComplete')); renderFlightUI();
            window.setTimeout(() => { if (flight.active && flight.step === 1 && d.status === 'success') setFlightStep(2); }, 1400);
          } else if (d.fuel <= 0 || flight.phaseElapsed >= phaseDuration(1)) {
            d.status = 'failed'; flight.score -= 5;
            logFlight(t(d.fuel <= 0 ? 'cockpit.logs.rcsDepleted' : 'cockpit.logs.approachExpired'));
            radAudio.tone(240, 0.16, 'sawtooth', 0.06);
            crewToast(t('cockpit.toasts.dockingFailed')); renderFlightUI();
            window.setTimeout(() => { if (flight.active && flight.step === 1 && d.status === 'failed') setFlightStep(2); }, 1400);
          }
        }
      } else if (flight.step === 2) {
        flight.phaseElapsed += dt;
        const g = flight.docking;
        if (g && !flight.docked) {
          const [pitch, yaw] = pilotInput();
          flight.input = { up: pitch > 0, down: pitch < 0, right: yaw > 0, left: yaw < 0 };
          g.tick(dt, [pitch, yaw]);
          flight.stability = Math.round(g.share() * 100);
          flight.progress = Math.min(65, (g.t / g.duration) * 65);
          flight.pitchX = g.value[1] / g.limit;
          flight.pitchY = -g.value[0] / g.limit;
          if (g.done) finishDocking(g);
        } else if (flight.docked) {
          flight.progress = 65 + (refuelTarget() ? flight.refuelDone / refuelTarget() : 1) * 35;
        }
        if (flight.phaseElapsed >= phaseDuration(2)) { timeOutFlightPhase(); }
      } else if (flight.step === 3) {
        const g = flight.marsBurn;
        if (g) {
          const [pitch, yaw] = pilotInput();
          // Mirrored burn: the outside view reverses the correction axes.
          // Keep the pressed-state tied to the mirrored labels; the physics input below is inverted.
          flight.input = { up: pitch > 0, down: pitch < 0, right: yaw > 0, left: yaw < 0 };
          g.tick(dt, [pitch, yaw]);
          flight.phaseElapsed = g.t;
          flight.progress = (g.t / g.duration) * 100;
          flight.stability = Math.round(g.share() * 100);
          flight.pitchX = g.value[1] / g.limit;
          flight.pitchY = -g.value[0] / g.limit;
          if (g.error > g.limit * .75) flight.hull = Math.max(50, flight.hull - dt * 2);
          if (g.done) {
            finishMarsBurn(g);
            return;
          }
        }
        if (flight.phaseElapsed >= phaseDuration(3) && g) {
          finishMarsBurn(g, true);
          return;
        }
      }

      updateTelemetry(dt);
      window.dispatchEvent(new CustomEvent('astro:cockpit', { detail: flight }));
      updateCockpitHUD();
      syncFlight();
      flight.raf = requestAnimationFrame(flightTick);
    }

    function updateFlightStepper() {
      $$('#flight-stepper .flight-phase').forEach((el, idx) => {
        const active = idx === flight.step, done = idx < flight.step;
        const fill = done ? 100 : active ? Math.min(100, (flight.phaseElapsed / phaseDuration(idx)) * 100) : 0;
        el.classList.toggle('active', active);
        el.classList.toggle('done', done);
        el.style.setProperty('--phase-fill', `${fill}%`);
        el.setAttribute('aria-current', active ? 'step' : 'false');
        const readout = el.querySelector('[data-phase-time]');
        if (readout) readout.textContent = clock(done ? 0 : active ? phaseDuration(idx) - flight.phaseElapsed : phaseDuration(idx));
      });
    }

    function updateCockpitHUD() {
      updateFlightStepper();
      $('#flight-progress-val').textContent = Math.round(flight.progress) + '%';
      const dockFuel = $('#port-dock-fuel');
      if (dockFuel && flight.portDock) {
        const d = flight.portDock;
        const fuel = Math.max(0, d.fuel);
        dockFuel.style.width = `${fuel}%`;
        dockFuel.classList.toggle('amber', fuel <= 45 && fuel > 20);
        dockFuel.classList.toggle('danger', fuel <= 20);
        $('#port-dock-fuel-value').textContent = `${Math.ceil(fuel)}%`;
        $('#port-dock-distance').textContent = U.distanceM(d.z, 1);
        const err = Math.hypot(d.x, d.y);
        const aligned = err < PORT_DOCK.band;
        const offsetEl = $('#port-dock-offset');
        if (offsetEl) {
          offsetEl.textContent = aligned
            ? t('cockpit.cards.dockLocked', { dist: U.distanceM(err, 2) })
            : t('cockpit.cards.dockOffset', { dist: U.distanceM(err, 2) });
        }
        const dockMark = $('#kir-mark');
        if (dockMark && flight.step === 1) {
          const nx = Math.max(-1, Math.min(1, d.x / PORT_DOCK.scope));
          const ny = Math.max(-1, Math.min(1, d.y / PORT_DOCK.scope));
          dockMark.style.left = `${50 + nx * 50}%`;
          dockMark.style.top = `${50 - ny * 50}%`;
          dockMark.classList.toggle('out', !aligned);
        }
        const zProg = Math.max(0, Math.min(1, (PORT_DOCK.zStart - d.z) / (PORT_DOCK.zStart - PORT_DOCK.zLatch)));
        const ringEl = $('#port-dock-ring');
        if (ringEl) {
          const minPct = (PORT_DOCK.band / PORT_DOCK.scope) * 100;
          ringEl.style.width = `${(88 - (88 - minPct) * zProg).toFixed(1)}%`;
          ringEl.classList.toggle('aligned', aligned);
        }
        const zFill = $('#port-dock-z-fill');
        if (zFill) {
          zFill.style.width = `${(zProg * 100).toFixed(1)}%`;
          zFill.classList.toggle('aligned', aligned);
        }
      }
      $('#flight-alt-val').textContent = U.altitudeKm(flight.altKm);
      $('#flight-vel-val').textContent = flight.velMs < 10 ? U.velocityMs(flight.velMs, 1) : U.velocityMs(flight.velMs, 0);
      $('#flight-hull-val').textContent = `${Math.round(flight.propellant)}% / ${Math.round(flight.hull)}%`;
      $('#flight-hull-val').previousElementSibling.textContent = `${tankLabel()}${t('cockpit.hullSuffix')}`;
      const goalLabels = t('cockpit.goalLabels');
      const goal = flight.step === 1
        ? Math.round(Math.max(0, 100 - Math.hypot(flight.portDock?.x ?? 0, flight.portDock?.y ?? 0) * 100))
        : flight.step === 2 && flight.docking && !flight.docked
          ? Math.round(flight.docking.share() * 100)
          : flight.docked ? 100 : Math.round(flight.stability);
      $('#flight-goal-label').textContent = goalLabels[flight.step];
      $('#flight-goal-val').textContent = goal + '%';
      setBar('#flight-goal-fill', goal / 100, goal < 55 ? 'danger' : '');

      const g = flight.step === 0 ? flight.liftoff : flight.step === 3 ? flight.marsBurn : null, mark = $('#kir-mark');
      if (g && mark) {
        mark.style.left = `${50 + (g.value[1] / g.limit) * 50}%`;
        mark.style.top = `${50 - (g.value[0] / g.limit) * 50}%`;
        mark.classList.toggle('out', g.error > g.band);
        $('#kir-time').textContent = t(flight.step === 0 ? 'cockpit.cards.timeToMeco' : 'cockpit.cards.timeToTouchdown', { sec: Math.ceil(g.duration - g.t) });
        $('#kir-share').textContent = t('cockpit.cards.inBandPct', { pct: Math.round(g.share() * 100) });
        const st = g.stars(); $('#kir-stars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
      }
      if (flight.step === 2 && flight.docking && !flight.docked && mark) {
        mark.style.left = `${50 + (flight.docking.value[1] / flight.docking.limit) * 50}%`;
        mark.style.top = `${50 - (flight.docking.value[0] / flight.docking.limit) * 50}%`;
        mark.classList.toggle('out', flight.docking.error > flight.docking.band);
      }
      const activeInput = flight.step === 1 ? flight.portDock?.input : flight.input;
      $$('[data-hold]').forEach(b => b.classList.toggle('on', !!activeInput?.[b.dataset.hold]));
      const pip = $('#cockpit-pip');
      if (pip) {
        pip.style.translate = `calc(-50% + ${Math.round(flight.pitchX * 48)}px) calc(-50% + ${Math.round(flight.pitchY * 48)}px)`;
        pip.classList.toggle('danger', Math.hypot(flight.pitchX, flight.pitchY) > 0.55);
      }
      const hasAlert = flight.breakers.some(Boolean) || (flight.step === 2 && !flight.docked);
      $('#cockpit-badge').textContent = hasAlert ? t('cockpit.badgeAction') : t('cockpit.badgeNominal');
      $('#cockpit-alert-tag').textContent = hasAlert ? t('cockpit.alertActive') : t('cockpit.alertNominal');
      // Real RAD data exists only for the surface of Mars (Curiosity), so the tag appears on arrival.
      const rad = $('#cockpit-rad-tag');
      rad.style.display = flight.step === 3 ? '' : 'none';
      rad.textContent = t('cockpit.radTag', { val: RAD_MARS_UGY_DAY });
      const actionBtn = $('#cockpit-minigame [data-act="complete_step"]');
      if (actionBtn && flight.step === 2) actionBtn.disabled = !flight.docked || flight.refuelDone < refuelTarget();
      const dockReadout = $('#docking-monitor-readout'), docking = flight.docking;
      if (dockReadout && flight.step === 2 && docking) {
        const align = Math.round(Math.max(0, 100 - (docking.error / docking.limit) * 100));
        dockReadout.textContent = flight.docked ? t('cockpit.hardDock') : t('cockpit.alignPct', { pct: align });
        $('#docking-monitor').style.setProperty('--dock-x', `${docking.value[1] * 28}px`);
        $('#docking-monitor').style.setProperty('--dock-y', `${-docking.value[0] * 18}px`);
      }
    }

    function renderFlightUI() {
      updateFlightStepper();
      const titles = t('cockpit.phaseTitles');
      $('.cockpit-reticle')?.toggleAttribute('hidden', true);
      $('#cockpit-eyebrow').textContent = titles[flight.step][0];
      $('#cockpit-title').textContent = titles[flight.step][1];
      const exterior = $('#flight-exterior'), monitor = $('#docking-monitor');
      exterior?.toggleAttribute('hidden', true);
      exterior?.classList.toggle('is-separated', flight.stageSeparated);
      monitor?.toggleAttribute('hidden', true);

      const outcome = $('#port-dock-outcome');
      if (outcome) {
        const st = flight.step === 1 ? flight.portDock?.status : null;
        const done = st === 'success' || st === 'failed';
        outcome.hidden = !done;
        outcome.className = `dock-outcome${st === 'success' ? ' is-success' : st === 'failed' ? ' is-failed' : ''}`;
        outcome.innerHTML = st === 'success'
          ? `<span class="dock-outcome-mark" aria-hidden="true"><svg viewBox="0 0 36 36"><polyline points="7,19 15,27 29,10"/></svg></span><strong>${t('cockpit.dockComplete')}</strong>`
          : st === 'failed'
            ? `<span class="dock-outcome-mark" aria-hidden="true"><svg viewBox="0 0 36 36"><line x1="9" y1="9" x2="27" y2="27"/><line x1="27" y1="9" x2="9" y2="27"/></svg></span><strong>${t('cockpit.dockFailed')}</strong>`
            : '';
      }

      const box = $('#cockpit-minigame');
      if (flight.step === 0) {
        const g = flight.liftoff;
        box.innerHTML = `
          <span class="eyebrow">${t('cockpit.cards.helenaLiftoffEyebrow')}</span>
          <h4>${t('cockpit.cards.helenaLiftoffTitle')}</h4>
          <p>${g ? t('cockpit.cards.helenaLiftoffActive') : t('cockpit.cards.helenaLiftoffIdle', { pct: LIFTOFF.throttle * 100 })}${flight.design.ready ? t('cockpit.cards.helenaLiftoffTwr', { twr: U.decimal(flight.design.twr, 2), sec: phaseDuration(0), wallow: flight.design.overweight ? t('cockpit.cards.helenaLiftoffWallow') : '' }) : ''}${flight.design.finsDrift < 1 ? t('cockpit.cards.helenaLiftoffFins', { pct: Math.round((1 - flight.design.finsDrift) * 100) }) : ''}</p>
          <div class="kir-row">
            <div class="kir kir-2d" style="--band:${(LIFTOFF.band / LIFTOFF.limit) * 100}%"><div class="kir-band"></div><div class="kir-mark" id="kir-mark"></div><span class="kir-label top">${t('cockpit.cards.noseHigh')}</span><span class="kir-label bottom">${t('cockpit.cards.noseLow')}</span></div>
            <div class="kir-ctrl ${g ? 'kir-pad' : ''}">${g
              ? '<button class="button secondary up" type="button" data-hold="up">▲<kbd>W · ↑</kbd></button><button class="button secondary left" type="button" data-hold="left">◀<kbd>A · ←</kbd></button><button class="button secondary right" type="button" data-hold="right">▶<kbd>D · →</kbd></button><button class="button secondary down" type="button" data-hold="down">▼<kbd>S · ↓</kbd></button>'
              : `<button class="button primary" type="button" data-act="throttle_up">${t('cockpit.cards.throttleBtn', { pct: Math.round(flight.throttle * 100) })}</button>`}</div>
          </div>
          <div class="kir-stats"><span id="kir-time">${t('cockpit.cards.timeToMeco', { sec: phaseDuration(0) })}</span><span id="kir-share">—</span><span id="kir-stars">☆☆☆</span></div>`;
      } else if (flight.step === 1) {
        const dockActive = flight.portDock?.status === 'approach';
        box.innerHTML = `
          <span class="eyebrow">${t('cockpit.cards.helenaDockEyebrow')}</span>
          <h4>${t('cockpit.cards.helenaDockTitle')}</h4>
          <p>${t('cockpit.cards.helenaDockDesc')}</p>
          <div class="meter"><div class="meter-head"><span class="meter-label">${t('cockpit.cards.dockFuelLabel')}</span><strong id="port-dock-fuel-value">100%</strong></div><div class="meter-track"><div class="meter-fill" id="port-dock-fuel" style="width:100%"></div></div></div>
          <div class="docking-readout"><span id="port-dock-offset">${t('cockpit.cards.dockOffset', { dist: U.distanceM(0.54, 2) })}</span><strong id="port-dock-distance">${U.distanceM(PORT_DOCK.zStart, 1)}</strong></div>
          <div class="kir-row">
            <div class="kir kir-2d dock-kir${dockActive ? '' : ' is-disabled'}" style="--band:${(PORT_DOCK.band / PORT_DOCK.scope) * 100}%"><span class="dock-kir-axis x" aria-hidden="true"></span><span class="dock-kir-axis y" aria-hidden="true"></span><div class="dock-kir-ring" id="port-dock-ring" aria-hidden="true"></div><div class="kir-band"></div><div class="kir-mark" id="kir-mark"></div></div>
            <div class="kir-ctrl kir-pad"><button class="button secondary up" type="button" data-hold="up" ${dockActive ? '' : 'disabled'}>▲<kbd>↑</kbd></button><button class="button secondary left" type="button" data-hold="left" ${dockActive ? '' : 'disabled'}>◀<kbd>A · ←</kbd></button><button class="button secondary right" type="button" data-hold="right" ${dockActive ? '' : 'disabled'}>▶<kbd>D · →</kbd></button><button class="button secondary down" type="button" data-hold="down" ${dockActive ? '' : 'disabled'}>▼<kbd>↓</kbd></button></div>
          </div>
          <div class="dock-z-track" aria-hidden="true"><div class="dock-z-fill" id="port-dock-z-fill"></div></div>
          <div class="control-grid dock-depth-grid">
            <button class="button primary" type="button" data-hold="forward" ${dockActive ? '' : 'disabled'}>${t('cockpit.cards.dockForwardBtn')}</button>
            <button class="button secondary" type="button" data-hold="back" ${dockActive ? '' : 'disabled'}>${t('cockpit.cards.dockBackBtn')}</button>
          </div>
          <p>${flight.portDock?.status === 'failed' ? t('cockpit.cards.dockFailedMsg') : flight.portDock?.status === 'success' ? t('cockpit.cards.dockSuccessMsg') : t('cockpit.cards.dockHelpMsg', { dist: U.distanceM(PORT_DOCK.zLatch, 2) })}</p>`;
      } else if (flight.step === 2) {
        const g = flight.docking, aligned = g ? Math.round(g.share() * 100) : 0;
        box.innerHTML = `
          <span class="eyebrow">${t('cockpit.cards.oscarMayaEyebrow')}</span>
          <h4>${t('cockpit.cards.oscarMayaTitle')}</h4>
          <p>${flight.docked ? t('cockpit.cards.oscarMayaDockedDesc') : t('cockpit.cards.oscarMayaApproachDesc')}</p>
          <div class="docking-readout"><span>${flight.docked ? t('cockpit.cards.latchedReadout') : t('cockpit.cards.alignmentReadout', { pct: aligned })}</span><strong>${flight.docked ? `${flight.refuelDone}/${refuelTarget()}%` : t('cockpit.cards.approachTime', { sec: Math.ceil((g?.duration ?? 0) - (g?.t ?? 0)) })}</strong></div>
          ${!flight.docked ? `<div class="kir-row">
            <div class="kir kir-2d" style="--band:${(DOCKING.band / DOCKING.limit) * 100}%"><div class="kir-band"></div><div class="kir-mark" id="kir-mark"></div></div>
            <div class="kir-ctrl kir-pad"><button class="button secondary up" type="button" data-hold="up">▲<kbd>W · ↑</kbd></button><button class="button secondary left" type="button" data-hold="left">◀<kbd>A · ←</kbd></button><button class="button secondary right" type="button" data-hold="right">▶<kbd>D · →</kbd></button><button class="button secondary down" type="button" data-hold="down">▼<kbd>S · ↓</kbd></button></div>
          </div>` : ''}
          <div class="control-grid">
            <button class="button secondary" type="button" data-act="pump_fuel" ${flight.docked && flight.refuelDone < refuelTarget() ? '' : 'disabled'}>${t('cockpit.cards.transferBtn', { done: flight.refuelDone, target: refuelTarget() })}</button>
            <button class="button secondary" type="button" data-act="stabilize" ${flight.docked ? 'disabled' : ''}>${t('cockpit.cards.trimBtn')}</button>
          </div>
          <button class="button primary" type="button" data-act="complete_step" ${!flight.docked || flight.refuelDone < refuelTarget() ? 'disabled' : ''}>${t('cockpit.cards.continueMarsBtn')}</button>`;
      } else {
        const g = flight.marsBurn;
        box.innerHTML = `
          <span class="eyebrow">${t('cockpit.cards.helenaLandingEyebrow')}</span>
          <h4>${t('cockpit.cards.helenaLandingTitle')}</h4>
          <p>${t('cockpit.cards.helenaLandingDesc')}</p>
          <div class="kir-row">
            <div class="kir kir-2d" style="--band:${(MARS_BURN.band / MARS_BURN.limit) * 100}%"><div class="kir-band"></div><div class="kir-mark" id="kir-mark"></div><span class="kir-label top">${t('cockpit.cards.burnHigh')}</span><span class="kir-label bottom">${t('cockpit.cards.burnLow')}</span></div>
            <div class="kir-ctrl kir-pad"><button class="button secondary up" type="button" data-hold="up">▲<kbd>W · ↑</kbd></button><button class="button secondary left" type="button" data-hold="left">◀<kbd>A · ←</kbd></button><button class="button secondary right" type="button" data-hold="right">▶<kbd>D · →</kbd></button><button class="button secondary down" type="button" data-hold="down">▼<kbd>S · ↓</kbd></button></div>
          </div>
          <div class="control-grid">
            <button class="button secondary" type="button" data-act="edl_arm" ${flight.edlChuteDeployed ? 'disabled' : ''}>${t(flight.edlChuteDeployed ? 'cockpit.cards.edlDeployedBtn' : 'cockpit.cards.edlDeployBtn')}</button>
            <button class="button secondary" type="button" data-act="stabilize">${t('cockpit.cards.trimBtn')}</button>
          </div>
          <div class="kir-stats"><span id="kir-time">${t('cockpit.cards.timeToTouchdown', { sec: MARS_BURN.duration })}</span><span id="kir-share">—</span><span id="kir-stars">☆☆☆</span></div>`;
      }
      $$('[data-hold]', box).forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          try { btn.setPointerCapture(e.pointerId); } catch {}
          flight.hold = { [btn.dataset.hold]: true };
          sendInput();
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          btn.addEventListener(ev, () => { flight.hold = null; sendInput(); });
        }
      });
      const kirPad = $('.kir-2d', box);
      if (kirPad) {
        let kirDragging = false;
        const canDragKir = () => (flight.step !== 1 || flight.portDock?.status === 'approach') && (net.mode === 'solo' || canAct(STEP_CREW[flight.step] || []));
        const steerFromKir = e => {
          if (!canDragKir()) return;
          const r = kirPad.getBoundingClientRect();
          const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
          const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
          const h = {};
          if (nx > 0.16) h.right = true; else if (nx < -0.16) h.left = true;
          if (ny > 0.16) h.up = true; else if (ny < -0.16) h.down = true;
          flight.hold = Object.keys(h).length ? h : null;
          sendInput();
        };
        kirPad.addEventListener('pointerdown', e => {
          if (!canDragKir()) return;
          e.preventDefault();
          kirDragging = true;
          try { kirPad.setPointerCapture(e.pointerId); } catch {}
          steerFromKir(e);
        });
        kirPad.addEventListener('pointermove', e => { if (kirDragging) steerFromKir(e); });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          kirPad.addEventListener(ev, () => { if (kirDragging) { kirDragging = false; flight.hold = null; sendInput(); } });
        }
      }
      $$('[data-act]', box).forEach(btn => btn.addEventListener('click', () => {
        const idx = btn.dataset.idx !== undefined ? Number(btn.dataset.idx) : undefined;
        handleCockpitAction(btn.dataset.act, idx);
      }));
      // In a room, the crew member who flies this step has the controls; the others watch.
      const seats = STEP_CREW[flight.step] || [];
      if (net.mode !== 'solo' && !canAct(seats)) {
        $$('[data-act],[data-hold]', box).forEach(b => { b.disabled = true; });
        box.insertAdjacentHTML('beforeend', `<p class="mp-watch">${t('cockpit.cards.watchCrew', { names: crewNames(seats), verb: seats.length > 1 ? t('cockpit.cards.flyPlural') : t('cockpit.cards.flySingular') })}</p>`);
      }
      updateCockpitHUD();
      syncFlight(true);
    }

    // -------------------------------------------------------------------------
    // PHASE 7: MARS SURFACE EXPLORATION
    // -------------------------------------------------------------------------
    function startSurface() {
      flight.design ||= captureDesign();
      surf.active = true;
      surf.departing = false;
      surf.rushWarned = false;
      surf.timerSec = difficulty[state.difficulty].surfaceS;
      // Solo: the crew member open in the lobby. In a room, each player starts on their own seat (the host on its own).
      surf.activeCrew = net.mode !== 'solo' ? net.seat : state.detail.kind === 'crew' ? state.detail.id : 'maya';
      surf.completed = new Set();
      surf.stranded = [];
      surf.strandedIds = [];
      // The experiment spots come from this seed, so every screen places them alike (web/views.js, placeBlocks).
      surf.seed = Math.floor(Math.random() * 2 ** 31);
      surf.control = Object.fromEntries(crew.map(c => [c.id, net.peerOf(c.id)?.id ?? null])); // crew → peer id (null: AI)
      surf.loaded = new Set(); surf.startedAt = performance.now();
      showScreen('surface');
      radAudio.startSurfaceBed();
      window.dispatchEvent(new CustomEvent('astro:land', { detail: { site: state.site, crew: surf.activeCrew, seed: surf.seed } }));
      updateSurfaceTimer();
      syncSurface(true);
      cancelAnimationFrame(surf.raf);
      surf.lastTick = performance.now();
      surf.raf = requestAnimationFrame(surfaceTick);
    }

    // by: the peer that sent it (the host checks that it controls the experiment's owner); none: this screen.
    function completeSurfaceTask(id, by) {
      const task = surf.tasks.find(item => item.id === id);
      if (net.isGuest) { // the host confirms; the block shows done right away
        if (surf.active && task && task.crew === surf.activeCrew && !surf.completed.has(id)) { net.act('task', id); surf.completed.add(id); }
        return;
      }
      const owner = by ? surf.control?.[task?.crew] === by : task?.crew === surf.activeCrew;
      if (!surf.active || !task || !owner || surf.completed.has(id)) return;
      surf.completed.add(id);
      syncSurface(true);
      radAudio.tone(860, 0.14, 'triangle', 0.06);
      crewToast(surf.completed.size === surf.tasks.length ? t('surface.allDoneToast') : t('surface.taskDoneToast', { id, title: task.title, done: surf.completed.size, total: surf.tasks.length }));
      window.dispatchEvent(new CustomEvent('astro:surface', { detail: surf }));
    }

    function boardShipAndFinish(forcedTimeout = false) {
      if (surf.departing) return;
      surf.active = false;
      surf.departing = true;
      if ($('#minigame-dialog').open) $('#minigame-dialog').close();
      cancelAnimationFrame(surf.raf);
      radAudio.stopAll();
      radAudio.tone(240, 0.45, 'sawtooth', 0.07);
      // game-balance: on timeout, any crew member outside the lander boarding perimeter (6.5 m) is left behind on Mars.
      const reach = window.ASTRO_SURFACE?.boardSafeReach ?? 6.5;
      const left = forcedTimeout ? crew.filter(p => (window.ASTRO_SURFACE?.distanceToLander(p.id) ?? 0) > reach) : [];
      surf.strandedIds = left.map(p => p.id);
      surf.stranded = left.map(p => p.name);
      net.emit({ k: 'depart', forced: !!forcedTimeout, strandedIds: surf.strandedIds });
      const finish = () => { surf.departing = false; showResults(forcedTimeout); };
      if (window.ASTRO_SURFACE?.playDeparture) window.ASTRO_SURFACE.playDeparture(surf.strandedIds).then(finish);
      else finish();
    }

    // The launch window only counts down while the crew is walking (not paused, loading or in a minigame).
    function surfaceTick(now) {
      if (!surf.active || state.screen !== 'surface') return;
      const dt = Math.min(0.1, (now - surf.lastTick) / 1000);
      surf.lastTick = now;
      if (surfaceClockRuns()) surf.timerSec = Math.max(0, surf.timerSec - dt);
      if (surf.timerSec <= 10 && surf.timerSec > 0 && !surf.rushWarned) {
        surf.rushWarned = true;
        radAudio.tone(680, 0.22, 'sawtooth', 0.06);
        crewToast(t('surface.returnRushToast'));
      }
      syncSurface();
      if (surf.timerSec <= 0) {
        crewToast(t('surface.windowReached'));
        boardShipAndFinish(true);
        return;
      }
      updateSurfaceTimer();
      surf.raf = requestAnimationFrame(surfaceTick);
    }

    function updateSurfaceTimer() {
      const timerEl = $('#surface-timer'), m = Math.floor(surf.timerSec / 60), sec = Math.floor(surf.timerSec % 60);
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      timerEl.classList.toggle('urgent', surf.timerSec <= 30);
    }

    document.addEventListener('keydown', e => {
      if (state.screen === 'cockpit') {
        flight.keys.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault(); // steer, do not scroll the page
        if (!e.repeat && flight.step === 2 && flight.docked) {
          if (e.code === 'ArrowUp') handleCockpitAction('pump_fuel');
          if (e.code === 'ArrowRight') handleCockpitAction('complete_step');
        }
        if (e.code === 'Space' && e.repeat) { e.preventDefault(); return; }
        if (e.code === 'Space') { e.preventDefault(); if (flight.step !== 1) handleCockpitAction(flight.step === 0 ? 'throttle_up' : flight.step === 2 ? 'pump_fuel' : 'stabilize'); }
      }
    });
    document.addEventListener('keyup', e => flight.keys.delete(e.code));
    window.addEventListener('blur', () => { flight.keys.clear(); flight.hold = null; });

    // -------------------------------------------------------------------------
    // FINAL RESULTS, RANKING & ANIMATED PODIUM
    // -------------------------------------------------------------------------
    // The debrief screen serves both endings: the mission flown (showResults) or a rocket stuck on the pad (failLaunch).
    // failed: 'pad' (never left the pad), 'sea' (aborted, splashed down) or false (the mission flown).
    function setResultsMode(failed) {
      $('#results').classList.toggle('is-failed', !!failed);
      $('#results-retry').hidden = !failed;
      $('#results-eyebrow').textContent = failed === 'sea' ? t('results.eyebrowSea') : failed ? t('results.eyebrowPad') : t('results.eyebrowSuccess');
      $('#results-title').textContent = failed === 'sea' ? t('results.titleSea') : failed ? t('results.titlePad') : t('results.titleSuccess');
    }

    function showResults(forcedTimeout) {
      setResultsMode(false);
      const d = flight.design;
      if (!Array.isArray(surf.strandedIds) || (!surf.strandedIds.length && surf.stranded?.length)) {
        surf.strandedIds = crew.filter(c => surf.stranded?.includes(c.name) || surf.stranded?.includes(c.id)).map(c => c.id);
      }
      surf.stranded = surf.strandedIds.map(id => crew.find(c => c.id === id)?.name ?? id);
      const strandedSet = new Set(surf.strandedIds);
      const strandedCount = strandedSet.size;
      const tasksDone = surf.completed.size;
      const scienceBonus = (d.hasDrill ? 6 : 0) + (d.hasSpec ? 6 : 0) + (d.hasDna ? 6 : 0) + (d.hasDish ? 5 : 0);
      const edlBonus = (d.hasLoftid && d.hasTrn) ? 14 : (d.hasLoftid || d.hasTrn) ? 9 : 4;
      const timeBonus = Math.round(surf.timerSec * 0.08);

      // Each astronaut computes their individual score first. If an astronaut is left behind on Mars,
      // their score is zeroed (0 pts), and the team total is the sum of the astronauts' points plus shared flight/time bonuses,
      // so the team's score drops strictly through the stranded astronaut's lost points.
      const rawScores = {
        helena: Math.round(210 + flight.stability * 1.1 + edlBonus * 4 + (surf.completed.has('H-S1') ? 60 : 0)),
        lucas: Math.round(200 + (d.powerDeficit ? 10 : 45) + (surf.completed.has('L-S1') ? 130 : 25)),
        oscar: Math.round(195 + (d.hasDish ? 45 : 15) + (surf.completed.has('O-S1') ? 130 : 25)),
        maya: Math.round(200 + scienceBonus * 4 + (surf.completed.has('M-S1') ? 145 : 25)),
      };
      const helenaPts = strandedSet.has('helena') ? 0 : rawScores.helena;
      const lucasPts = strandedSet.has('lucas') ? 0 : rawScores.lucas;
      const oscarPts = strandedSet.has('oscar') ? 0 : rawScores.oscar;
      const mayaPts = strandedSet.has('maya') ? 0 : rawScores.maya;
      const lostFromStranded = (rawScores.helena - helenaPts) + (rawScores.lucas - lucasPts) + (rawScores.oscar - oscarPts) + (rawScores.maya - mayaPts);
      const crewSum = helenaPts + lucasPts + oscarPts + mayaPts;
      const total = Math.max(0, Math.round(crewSum + flight.score * 2.5 + timeBonus));
      const grade = total >= 1150 ? 'S+' : total >= 950 ? 'A' : total >= 740 ? 'B' : 'C';

      $('#results-rank-letter').textContent = grade;
      $('#results-score-text').textContent = t('results.totalScore', { pts: number(total), done: tasksDone, total: surf.tasks.length });
      $('#results-status-badge').textContent = strandedCount ? t('results.leftBehind', { names: surf.stranded.join(', ').toUpperCase() }) : t('results.allReturned');
      $('#results-headline').textContent = strandedCount ? t('results.headlinePartial') : grade === 'S+' ? t('results.headlineTriumph') : t('results.headlineComplete');
      $('#podium-site-tag').textContent = t('results.podiumTagSuccess', { site: SITES_INFO[state.site].name.toUpperCase(), grade });

      const positions = t('results.positions');
      const ranked = [
        { ...crew[0], pts: helenaPts, stranded: strandedSet.has('helena') },
        { ...crew[1], pts: lucasPts, stranded: strandedSet.has('lucas') },
        { ...crew[2], pts: oscarPts, stranded: strandedSet.has('oscar') },
        { ...crew[3], pts: mayaPts, stranded: strandedSet.has('maya') },
      ].sort((a, b) => (a.stranded !== b.stranded ? (a.stranded ? 1 : -1) : b.pts - a.pts)).map((c, idx) => ({
        ...c,
        pos: positions[idx],
        grade: c.stranded ? 'F' : c.pts >= 360 ? 'S+' : c.pts >= 310 ? 'A' : c.pts >= 240 ? 'B' : 'C',
      }));

      $('#results-leaderboard').innerHTML = ranked.map(r => `
        <div class="leader-row">
          <span class="leader-pos">${r.pos}</span>
          <span><b>${r.name}</b> <small class="muted">· ${r.role}</small>${r.stranded ? `<span class="tag is-ghost-tag">${t('results.ghostTag')}</span>` : ''}</span>
          <strong>${t('results.ptsSuffix', { pts: r.pts })}</strong>
          <span class="leader-grade">${r.grade}</span>
        </div>`).join('');

      $('#results-breakdown').innerHTML = [
        [t('results.breakdown.budgetTwr'), `${d.overBudget ? (d.budgetPenalty ? t('results.breakdown.exceeded') : t('results.breakdown.exceededWarn')) : t('results.breakdown.onBudget')} · ${d.lowTwr ? (d.overweight ? t('results.breakdown.lowTwrBuffet') : t('results.breakdown.lowTwrWarn')) : t('results.breakdown.twrNominal')}`],
        [t('results.breakdown.edlLanding'), t('results.breakdown.edlValue', { pct: flight.landingShare ?? 0, suite: hasEdlLabel(d) })],
        [t('results.breakdown.surfaceWindow'), forcedTimeout ? (strandedCount ? t('results.breakdown.timeoutStranded', { names: surf.stranded.join(', '), pts: lostFromStranded }) : t('results.breakdown.timeoutOk')) : t('results.breakdown.clearedMargin', { sec: Math.floor(surf.timerSec) })],
      ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');

      $('#podium-fallback').innerHTML = ranked.map((r, i) => `
        <div class="podium-col${r.stranded ? ' is-ghost' : ''}">
          ${astronaut(r, r.stranded)}
          <div class="podium-step${r.stranded ? ' is-ghost' : ''}" style="background:${r.color};padding-top:${(4 - i) * 10}px">${r.pos} · ${r.name.toUpperCase()} (${r.stranded ? t('results.podiumGhostSuffix') : r.grade})</div>
        </div>`).join('');

      // Guests run this same function on the host's numbers (it has no randomness).
      const missionId = flight.missionId || ('m-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
      net.emit({ k: 'results', missionId, forced: !!forcedTimeout, flight: flightSnapshot(), surf: { completed: [...surf.completed], stranded: surf.stranded, strandedIds: surf.strandedIds, timerSec: surf.timerSec } });
      showScreen('results');
      window.dispatchEvent(new CustomEvent('astro:results', { detail: { ranked, grade } }));

      const lbPlayers = net.mode === 'solo'
        ? [{ playerName: net.getPlayerName?.() || t('leaderboard.soloDefaultName'), seat: 'helena', score: helenaPts, grade: ranked.find(r => r.id === 'helena').grade, stranded: strandedSet.has('helena') }]
        : net.peers.map(p => {
            const member = ranked.find(r => r.id === p.seat);
            const pName = net.sanitizePlayerName?.(p.meta?.name) || '';
            return {
              playerName: pName.length >= 2 ? pName : (member?.name || capFirst(p.seat)),
              seat: p.seat,
              score: member?.pts ?? 0,
              grade: member?.grade ?? 'F',
              stranded: !!member?.stranded,
            };
          });
      const lbRecord = {
        id: missionId,
        roomCode: net.code || null,
        mode: net.mode === 'solo' ? 'solo' : 'multiplayer',
        site: state.site,
        difficulty: state.difficulty,
        grade,
        teamScore: total,
        tasksDone,
        tasksTotal: surf.tasks.length,
        strandedCount,
        players: lbPlayers,
        createdAt: Date.now(),
      };
      submitAndShowResultsLeaderboard(lbRecord);
    }

    // Mission failed: on the pad (liftoffOf: no ignition, or thrust below weight) or after a Δv abort (abortOf: no orbit,
    // or Mars out of reach) that ended in a splashdown. Nothing is scored and the podium stays empty.
    function failLaunch(lift) {
      const sea = Boolean(lift.sea || lift.reason === 'no-orbit' || lift.reason === 'no-mars' || lift.pad === 'SPLASHDOWN');
      flight.design = captureDesign();
      flight.active = false;
      cancelAnimationFrame(flight.raf);
      surf.active = false;
      surf.completed = new Set();
      surf.stranded = [];
      const d = flight.design;
      setResultsMode(sea ? 'sea' : 'pad');
      radAudio.tone(150, 0.6, 'sawtooth', 0.05);
      $('#results-rank-letter').textContent = 'F';
      $('#results-score-text').textContent = t('results.totalScore', { pts: 0, done: 0, total: surf.tasks.length });
      $('#results-status-badge').textContent = sea ? t('results.failedSeaBadge') : t('results.failedPadBadge');
      $('#results-headline').textContent = lift.title;
      $('#podium-site-tag').textContent = sea ? t('results.podiumTagSea', { title: lift.title.toUpperCase() }) : t('results.podiumTagPad', { pad: lift.pad });
      $('#results-leaderboard').innerHTML = `<p class="muted">${t('results.noRanking', { cause: sea ? t('results.causeAborted') : t('results.causePad') })}</p>`;
      $('#results-breakdown').innerHTML = [
        ...(sea ? [
          [t('results.breakdown.abort'), lift.detail],
          [t('results.breakdown.dvOrbit'), `${U.velocityMs(d.dv)} / ${U.velocityMs(d.leo)}`],
          [t('results.breakdown.marsTransfer'), d.orbit ? `${U.velocityMs(d.marsDv)} / ${U.velocityMs(d.transfer)}${t('results.breakdown.refuelledSuffix')}` : '—'],
        ] : [
          [t('results.breakdown.liftoff'), lift.detail],
          [t('results.breakdown.twr'), d.ready ? t('results.breakdown.twrNeeds', { twr: U.decimal(d.twr, 2), bare: U.decimal(TWR_BARE(), 1) }) : t('results.breakdown.noThrust')],
        ]),
        [t('results.breakdown.budget'), d.overBudget ? t('results.breakdown.exceeded') : t('results.breakdown.onBudget')],
        [t('results.breakdown.mars'), t('results.breakdown.marsNotReached', { total: surf.tasks.length })],
      ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
      $('#podium-fallback').innerHTML = t('results.positions').map((pos, i) => `
        <div class="podium-col"><div class="podium-step is-empty" style="padding-top:${(4 - i) * 10}px">${pos} · —</div></div>`).join('');
      showScreen('results');
      window.dispatchEvent(new CustomEvent('astro:results', { detail: { ranked: [], grade: 'F', failed: true } }));
      loadResultsLeaderboard(null, net.mode === 'solo' ? 'solo' : 'server');
    }

    function hasEdlLabel(d) {
      if (d.hasLoftid && d.hasTrn) return t('results.edlFull');
      if (d.hasLoftid || d.hasTrn) return t('results.edlCabin');
      return t('results.edlMinimal');
    }

    const clearMission = () => { net.setState('flight', null); net.setState('surface', null); };
    $('#results-retry').addEventListener('click', () => { clearMission(); showScreen('planner'); });
    $('#results-replay').addEventListener('click', () => {
      clearMission();
      state.rocket = defaultRocket();
      state.sel = { kind: 'booster' };
      state.tab = 'engine';
      setLobbyStep('crew');
      showScreen('lobby');
    });

    // ---- Multiplayer: flight, surface and results (docs/multiplayer.md, items 5–7) ---------------------------
    // The host runs the flight and the surface as in solo and sends snapshots; guests draw them and send their
    // actions and their steering. Who flies each step (acts and steers); a few switches belong to one specialist.
    const STEP_CREW = [['helena'], ['helena'], ['oscar', 'maya'], ['helena']];
    const ACTION_CREW = { breaker: ['lucas'], stage_sep: ['lucas'], shield_storm: ['maya'] };
    const crewFor = actionId => ACTION_CREW[actionId] || STEP_CREW[flight.step] || [];
    const canAct = seats => seats.some(seat => net.owns(seat)); // mine, or AI crew while I host (solo: everyone)
    const crewNames = seats => seats.map(id => crew.find(c => c.id === id)?.name ?? id).join(` ${t('common.and')} `);
    function crewToast(text) { toast(text); net.emit({ k: 'toast', text }); }

    // Steering: the keys and pad of whoever may fly the current step, here and on the guests' screens.
    const PILOT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const HOLDS = ['up', 'down', 'left', 'right', 'forward', 'back'];
    const remoteInput = new Map(); // seat → { keys: Set, hold }
    function setPilotHold(nextHold) {
      if (nextHold && typeof nextHold === 'object') {
        const clean = Object.fromEntries(HOLDS.filter(h => nextHold[h]).map(h => [h, true]));
        flight.hold = Object.keys(clean).length ? clean : null;
      } else {
        flight.hold = null;
      }
      sendInput();
    }
    function inputOf() {
      const seats = STEP_CREW[flight.step] || [], mine = canAct(seats);
      const keys = new Set(mine ? flight.keys : []);
      let hold = mine ? flight.hold : null;
      for (const [seat, input] of remoteInput) if (seats.includes(seat)) { input.keys.forEach(k => keys.add(k)); hold ||= input.hold; }
      return { keys, hold };
    }
    let sentInput = '';
    function sendInput() {
      if (!net.isGuest || state.screen !== 'cockpit') return;
      const keys = PILOT_KEYS.filter(k => flight.keys.has(k)), text = JSON.stringify([keys, flight.hold]);
      if (text === sentInput) return;
      sentInput = text;
      net.act('input', keys, flight.hold);
    }
    document.addEventListener('keydown', sendInput);
    document.addEventListener('keyup', sendInput);
    window.addEventListener('blur', sendInput);

    // Flight snapshot (host → guests, ~10 Hz and on every change of step or controls). The keep-in-range games
    // travel as plain numbers and get their share()/stars() back on the guest.
    const FLIGHT_FIELDS = ['active', 'step', 'progress', 'altKm', 'velMs', 'hull', 'propellant', 'throttle', 'pitchX', 'pitchY', 'stability', 'breakers',
      'stageSeparated', 'separationAdvancing', 'refuelDone', 'stormShielded', 'edlChuteDeployed', 'score', 'phaseElapsed', 'phaseTimedOut', 'docked',
      'liftoffStars', 'landingShare', 'liftoffSeconds', 'input', 'portDock'];
    const FLIGHT_SYNC_MS = 100; // game-balance: snapshot interval
    const kirOut = g => g && { t: g.t, value: g.value, rate: g.rate, inBand: g.inBand, duration: g.duration, band: g.band, limit: g.limit, error: g.error, done: g.done, axes: g.axes };
    const kirIn = o => o && { ...o, share() { return this.t ? this.inBand / this.t : 1; }, stars() { const k = this.share(); return k >= 0.85 ? 3 : k >= 0.65 ? 2 : k >= 0.4 ? 1 : 0; }, tick() { return this; } };
    function flightSnapshot() {
      const o = Object.fromEntries(FLIGHT_FIELDS.map(k => [k, flight[k] ?? null]));
      Object.assign(o, { liftoff: kirOut(flight.liftoff), docking: kirOut(flight.docking), marsBurn: kirOut(flight.marsBurn),
        completedPhases: [...flight.completedPhases], sparksIn: Math.max(0, (flight.sparksUntil || 0) - performance.now()), log: flightLog });
      return o;
    }
    let flightSentAt = 0;
    function syncFlight(force) {
      if (!net.isHost || !flight.active) return;
      const now = performance.now();
      if (!force && now - flightSentAt < FLIGHT_SYNC_MS) return;
      flightSentAt = now;
      net.setState('flight', flightSnapshot());
    }
    let guestFlight = false, shownLog = '';
    const flightUiKey = () => JSON.stringify([flight.step, !!flight.liftoff, flight.docked, flight.refuelDone, flight.stageSeparated, flight.edlChuteDeployed, flight.portDock?.status, flight.breakers, Math.round(flight.throttle * 100)]);
    function applyFlight(o) {
      if (!net.isGuest || !o) return;
      const first = !guestFlight;
      if (first) { // the host is in the cockpit: show it here, drawn from its snapshots
        guestFlight = true; guestSurface = false;
        flight.design = captureDesign(); // the same rocket and difficulty as the host's (state 'setup')
        flight.keys.clear(); flight.hold = null; sentInput = ''; shownLog = '';
        showScreen('cockpit');
      }
      const before = first ? '' : flightUiKey();
      for (const k of FLIGHT_FIELDS) flight[k] = o[k];
      flight.liftoff = kirIn(o.liftoff); flight.docking = kirIn(o.docking); flight.marsBurn = kirIn(o.marsBurn);
      flight.completedPhases = new Set(o.completedPhases || []);
      flight.sparksUntil = o.sparksIn ? performance.now() + o.sparksIn : 0;
      const log = (o.log || []).join('\n');
      if (log !== shownLog) { shownLog = log; renderFlightLog(o.log || []); }
      window.dispatchEvent(new CustomEvent('astro:cockpit', { detail: flight }));
      if (flightUiKey() !== before) renderFlightUI(); else updateCockpitHUD();
    }

    // Surface state (host → guests, 2 Hz and on every change): the seed of the experiment spots, the timer, what is
    // done and who controls each astronaut. The astronauts themselves travel as poses (web/views.js).
    const SURFACE_SYNC_MS = 500, LOAD_WAIT_MS = 20000; // game-balance
    let surfaceSentAt = 0;
    const surfaceSnapshot = () => ({ site: state.site, seed: surf.seed, timerSec: surf.timerSec, completed: [...surf.completed], control: surf.control, active: surf.active });
    function syncSurface(force) {
      if (!net.isHost || !surf.active) return;
      const now = performance.now();
      if (!force && now - surfaceSentAt < SURFACE_SYNC_MS) return;
      surfaceSentAt = now;
      net.setState('surface', surfaceSnapshot());
    }
    // The return window counts down while the crew can play: solo pauses it in minigames; in a room it never
    // pauses for one player's minigame, only until everyone has loaded the terrain (or LOAD_WAIT_MS).
    function surfaceClockRuns() {
      const view = window.ASTRO_SURFACE;
      if (net.mode === 'solo') return view?.running?.() ?? true;
      if (!(view?.loaded?.() ?? true)) return false;
      const waiting = net.peers.filter(p => p.online && !p.host && !surf.loaded.has(p.id));
      return !waiting.length || performance.now() - surf.startedAt > LOAD_WAIT_MS;
    }
    let guestSurface = false, shownControl = '';
    function applySurface(o) {
      if (!net.isGuest || !o?.seed) return;
      flight.active = false;
      surf.timerSec = o.timerSec; surf.completed = new Set(o.completed); surf.control = o.control; surf.active = o.active;
      if (!guestSurface) {
        guestSurface = true; shownControl = '';
        flight.design ||= captureDesign();
        surf.stranded = []; surf.seed = o.seed;
        surf.activeCrew = myCrew() || net.seat;
        if (SITES_INFO[o.site]) state.site = o.site;
        showScreen('surface');
        radAudio.startSurfaceBed();
        window.dispatchEvent(new CustomEvent('astro:land', { detail: { site: state.site, crew: surf.activeCrew, seed: o.seed } }));
      }
      updateSurfaceTimer();
      const control = JSON.stringify(o.control);
      if (control !== shownControl) { shownControl = control; window.dispatchEvent(new CustomEvent('astro:control')); }
    }
    // The astronaut I move: the one the control map gives me (solo: the one on screen).
    const myCrew = () => net.mode === 'solo' ? surf.activeCrew : Object.keys(surf.control || {}).find(id => surf.control[id] === net.you?.id) || null;
    // Keys 1–4 in a room: take an AI astronaut (the host decides, so two players never move the same one).
    function requestCrew(id) {
      if (net.isGuest) { net.act('control', id); return; }
      const error = grantCrew(id, net.you.id);
      if (error) toast(error); else window.dispatchEvent(new CustomEvent('astro:control'));
    }
    function grantCrew(id, peerId) {
      if (!surf.active || !surf.control || !(id in surf.control)) return t('surface.notNow');
      const holder = surf.control[id];
      if (holder && holder !== peerId) return t('surface.controlledByOther', { names: crewNames([id]) });
      for (const k of Object.keys(surf.control)) if (surf.control[k] === peerId) surf.control[k] = null;
      surf.control[id] = peerId;
      syncSurface(true);
      return null;
    }
    // Boarding in a room: only with every online player at the lander. The timer still leaves behind whoever is
    // far when it runs out (boardShipAndFinish).
    const BOARD_SLACK_M = 1.5; // game-balance: the host sees remote astronauts a little late
    function playersAway() {
      if (net.mode === 'solo') return [];
      const online = new Set(net.peers.filter(p => p.online).map(p => p.id)), reach = (window.ASTRO_SURFACE?.boardReach ?? 5) + BOARD_SLACK_M;
      return crew.filter(c => online.has(surf.control?.[c.id]) && (window.ASTRO_SURFACE?.distanceToLander(c.id) ?? 0) > reach).map(c => c.name);
    }
    function board(by) {
      if (net.isGuest) { net.act('board'); return; }
      if (!surf.active) return;
      const away = playersAway();
      if (away.length) { const text = t('surface.waitingCrew', { names: away.join(', ') }); if (by) net.send({ k: 'toast', text }, by); else toast(text); return; }
      boardShipAndFinish(false);
    }

    // Host: what the guests ask for. The server stamped the sender (from.id, from.seat).
    function onAct(data, from) {
      if (!net.isHost || !data || !Array.isArray(data.args)) return;
      const args = data.args, reply = text => net.send({ k: 'toast', text }, from.id);
      if (data.name === 'cockpit') {
        const [actionId, arg] = args;
        if (state.screen !== 'cockpit' || typeof actionId !== 'string' || !crewFor(actionId).includes(from.seat)) return;
        applyCockpitAction(actionId, arg);
      } else if (data.name === 'input') {
        const [keys, hold] = args;
        remoteInput.set(from.seat, { keys: new Set((Array.isArray(keys) ? keys : []).filter(k => PILOT_KEYS.includes(k))),
          hold: hold && typeof hold === 'object' ? Object.fromEntries(HOLDS.filter(h => hold[h]).map(h => [h, true])) : null });
      } else if (data.name === 'task') completeSurfaceTask(String(args[0]), from.id);
      else if (data.name === 'control') { const error = grantCrew(String(args[0]), from.id); if (error) reply(error); else window.dispatchEvent(new CustomEvent('astro:control')); }
      else if (data.name === 'board') board(from.id);
      else if (data.name === 'loaded' && surf.active) surf.loaded.add(from.id);
    }
    // Host: a player who left for good gives their astronaut back to the AI.
    function onPeers() {
      if (!net.isHost || !surf.active || !surf.control) return;
      const here = new Set(net.peers.map(p => p.id));
      let changed = false;
      for (const k of Object.keys(surf.control)) if (surf.control[k] && !here.has(surf.control[k])) { surf.control[k] = null; changed = true; }
      if (changed) { syncSurface(true); window.dispatchEvent(new CustomEvent('astro:control')); }
    }
    // Guest: the host's one-shot events.
    function onEvent(data) {
      if (!net.isGuest || !data) return;
      if (data.k === 'toast' && typeof data.text === 'string') toast(data.text);
      else if (data.k === 'launch') {
        const lift = data.lift || { ok: true, accel: 1 };
        const after = () => {
          if (!lift.ok && state.screen !== 'results') failLaunch(lift);
          else if (lift.ok && net.cached.flight) applyFlight(net.cached.flight);
        };
        if (window.ASTRO_LAUNCHPAD) Promise.resolve(window.ASTRO_LAUNCHPAD(lift)).then(after, after); else after();
      } else if (data.k === 'abort') {
        guestFlight = false; flight.active = false;
        const debrief = () => failLaunch(data.info || {});
        if (window.ASTRO_SPLASHDOWN) window.ASTRO_SPLASHDOWN(data.info || {}).then(debrief); else debrief();
      } else if (data.k === 'depart') {
        surf.active = false;
        if ($('#minigame-dialog').open) $('#minigame-dialog').close();
        radAudio.stopAll();
        radAudio.tone(240, 0.45, 'sawtooth', 0.07);
        window.ASTRO_SURFACE?.playDeparture?.(data.strandedIds || []);
      } else if (data.k === 'results') {
        guestFlight = false; guestSurface = false;
        flight.missionId = data.missionId || flight.missionId;
        for (const k of FLIGHT_FIELDS) if (data.flight && k in data.flight) flight[k] = data.flight[k];
        flight.active = false;
        surf.active = false;
        surf.completed = new Set(data.surf?.completed || []);
        surf.stranded = data.surf?.stranded || [];
        surf.strandedIds = data.surf?.strandedIds || [];
        surf.timerSec = data.surf?.timerSec ?? 0;
        if ($('#minigame-dialog').open) $('#minigame-dialog').close();
        radAudio.stopAll();
        showResults(data.forced);
      }
    }
    // Guest: the host left the cockpit or the surface (another mission, or the room closed).
    function leaveMission() { guestFlight = false; guestSurface = false; flight.active = false; surf.active = false; radAudio.stopAll(); }

    return { startFlight, failLaunch, handleCockpitAction, setPilotHold, startSurface, completeSurfaceTask, board: () => board(null), flight, surf,
      applyFlight, applySurface, onAct, onEvent, onPeers, leaveMission, requestCrew, myCrew,
      refreshUI: () => { if (flight.active) renderFlightUI(); },
      get isMuted() { return radAudio.muted; },
      surfaceLoaded: () => { if (net.isGuest) net.act('loaded'); } };
  })();
  window.ASTRO_SIM = SIM;
  // Shared with the 3D modules below.
  function renderBadge(){const lv=LV(),s=lv.surfaceS,badge=$('#modifier-badge');badge.textContent=`${lv.label.toUpperCase()} · ${t('lobby.badge',{budget:money(budgetOf(state.difficulty)),time:formatSurfaceClock(s),rules:lv.rules})}`;badge.title=lv.about;}
  window.ASTRO_ART={RAMPS,PLANETS};
  window.ASTRO={state,crew,sites:SITES_INFO,selectSite,toast,show:showScreen,showScreen,land:()=>SIM.startSurface(),data:()=>DATA,selectedKey:()=>moduleKey(state.sel),select:(key,tab)=>selectModule(key,tab),wizard:{open:(step=0)=>setWizardOpen(true,{step,gesture:true}),close:()=>setWizardOpen(false),goTo:step=>setWizardStep(step),isOpen:()=>wizardState.open},CREW_MODELS,COCKPIT_MODEL};
  // ---- Multiplayer: lobby, screens and the shared planner (docs/multiplayer.md, items 1–4; 5–7 live in SIM) ------
  // The host sends the mission setup (state 'setup') whenever it changes; guests copy it. Only what everyone must
  // agree on travels: the selection, the tab and the open details stay on each screen.
  const GUEST_SCREENS = ['menu','orbit','lobby','planner']; // screens a guest opens on the host's word alone
  let lastSetup='';
  function syncSetup(){
    if(!net.isHost)return;
    const setup={world:state.world,site:state.site,difficulty:state.difficulty,rocket:state.rocket},text=JSON.stringify(setup);
    if(text===lastSetup)return;
    lastSetup=text;net.setState('setup',setup);
  }
  // Guests copy the host's setup. A host that reloaded the page gets its own setup back from the room (force).
  function applySetup(s,force){
    if(!s||!(net.isGuest||force))return;
    if(WORLD_IDS.includes(s.world)&&s.world!==state.world)selectWorld(s.world);
    if(SITES_INFO[s.site])state.site=s.site;
    if(difficulty[s.difficulty]&&s.difficulty!==state.difficulty)setDifficulty(s.difficulty);
    if(s.rocket?.booster&&Array.isArray(s.rocket.stages)&&Array.isArray(s.rocket.cabin))state.rocket=s.rocket;
    fitSelection();renderLobby();renderPlanner();lockGuest();
  }
  // A guest follows the host's screen. The buttons that change screens or launch stay off, saying who decides.
  const HOST_BUTTONS=['#lobby-back','#lobby-next','#planner-back','#launch-button','#results-retry','#results-replay'];
  function lockGuest(){
    const guest=net.isGuest;let unlocked=false;
    HOST_BUTTONS.forEach(sel=>{const b=$(sel);if(!b)return;
      if(guest){if(b.dataset.label==null)b.dataset.label=b.innerHTML;b.disabled=true;b.textContent=t('common.waitingForHost');}
      else if(b.dataset.label!=null){b.innerHTML=b.dataset.label;b.disabled=false;delete b.dataset.label;unlocked=true;}});
    if(unlocked)selectWorld(state.world); // the objective button depends on the destination
    $$('#difficulty-buttons button,[data-world]').forEach(b=>b.toggleAttribute('aria-disabled',guest));
    document.body.classList.toggle('is-guest',guest);
    renderLobbyStepper();
  }
  // The pad, the cockpit, the surface and the debrief open from the host's events and snapshots (SIM), which carry
  // what those screens need; a guest who comes back mid-mission gets the last snapshot from the room.
  function guestScreen(phase){
    if(!net.isGuest||!phase)return;
    const screen = phase === 'orbit' ? 'lobby' : phase;
    if(GUEST_SCREENS.includes(screen)){SIM.leaveMission();if(screen==='lobby')state.lobbyStep='crew';if(screen!==state.screen)showScreen(screen);else renderLobbyStepper();return;}
    if(phase==='launchpad'&&state.screen!=='launchpad'&&state.screen!=='cockpit'){
      if(window.ASTRO_LAUNCHPAD)Promise.resolve(window.ASTRO_LAUNCHPAD({ok:true,accel:1})).then(()=>{if(net.cached.flight)SIM.applyFlight(net.cached.flight);},()=>{});
      else showScreen('launchpad');
      return;
    }
    if(phase==='cockpit'&&net.cached.flight)SIM.applyFlight(net.cached.flight);
    if(phase==='surface'&&net.cached.surface)SIM.applySurface(net.cached.surface);
  }
  let role='solo'; // the role in the room, kept after it closes
  net.on('welcome',m=>{
    lastSetup='';role=net.mode;
    if(net.isGuest){state.lobbyStep='crew';applySetup(net.cached.setup);guestScreen(net.phase);if(m.t!=='resumed')toast(t('lobby.room.joinedRoom',{code:net.code}));}
    else if(m.t==='resumed'){applySetup(net.cached.setup,true);if(GUEST_SCREENS.includes(net.phase)&&net.phase!==state.screen)showScreen(net.phase);else net.setPhase(state.screen);}
    else{net.setPhase(state.screen);syncSetup();}
    lockGuest();renderLobby();
  });
  net.on('peers',()=>{renderLobby();if(state.detail.kind==='crew')renderDetail();SIM.onPeers();});
  net.on('phase',guestScreen);
  net.on('state',(key,data)=>{
    if(key==='setup')applySetup(data);
    else if(key==='flight'&&net.phase==='cockpit')SIM.applyFlight(data);
    else if(key==='surface'&&net.phase==='surface')SIM.applySurface(data);
  });
  net.on('event',data=>SIM.onEvent(data));
  net.on('status',()=>renderRoom());
  net.on('closed',reason=>{
    lastSetup='';
    if(role==='guest'&&!GUEST_SCREENS.includes(state.screen)&&state.screen!=='results'){SIM.leaveMission();showScreen('menu');} // a guest mid-mission has nothing left to draw
    role='solo';
    browserState.status='idle';
    lockGuest();renderLobby();if(reason!=='left')toast(net.message(reason));
  });
  net.on('error',err=>{
    if(err?.code==='password-required'&&err.roomCode){joinRoomWithPrompt(err.roomCode,true,true);return;}
    toast(net.message(err));
  });
  // Host: a guest's planner action, checked against the list of rocket actions (the server stamps who sent it).
  net.on('act',(data,from)=>{
    if(!net.isHost||!data)return;
    if(data.name!=='rocket'){SIM.onAct(data,from);return;}
    const [name,...args]=Array.isArray(data.args)?data.args:[];
    if(!Object.hasOwn(ROCKET_ACTIONS,name))return;
    if(!['lobby','planner'].includes(state.screen))return; // the rocket is frozen once launched
    let error;
    try{error=ROCKET_ACTIONS[name](...args);}catch{error=t('planner.errors.changeFailed');}
    if(error){net.send({k:'toast',text:error},from.id);return;}
    fitSelection();renderPlanner();
  });
  net.on('msg',data=>{if(data?.k==='toast'&&typeof data.text==='string')toast(data.text);});

  window.addEventListener('astro:settings',()=>{
    HOST_BUTTONS.forEach(sel=>{const b=$(sel);if(b&&b.dataset.label!=null)delete b.dataset.label;});
    selectWorld(state.world);
    renderBadge();
    renderDifficultyStep();
    renderLobby();
    renderPlanner();
    lockGuest();
    const audioBtn=$('#audio-toggle-cockpit');
    if(audioBtn)audioBtn.textContent=SIM.isMuted?t('cockpit.audioOff'):t('cockpit.audioOn');
    SIM.refreshUI();
    browserState.status='idle';browserState.rooms=[];browserState.fetchedAt=0;
    if(state.screen==='lobby'&&state.lobbyStep==='mode')refreshRoomBrowser(true);
    if(state.screen==='leaderboard')loadLeaderboardScreen();
  });

  // ---- Leaderboards (Server SQLite Co-op + Local Solo localStorage) ----------------------------------------
  const lbState = { source: 'server', tab: 'missions', difficulty: 'all', site: 'all' };
  let lastSubmittedMissionId = '';

  function renderLeaderboardRows(entries, tab, highlightId = null) {
    const myLower = (net.getPlayerName?.() || '').toLowerCase();
    return entries.map((entry, idx) => {
      const rank = `#${idx + 1}`;
      if (tab === 'players') {
        const isMe = !!(myLower && String(entry.playerName || '').toLowerCase() === myLower);
        const seatName = crew.find(c => c.id === entry.lastSeat)?.name || capFirst(entry.lastSeat || '');
        return `<div class="lb-row${isMe ? ' lb-me' : ''}">
          <span class="leader-pos">${rank}</span>
          <div class="lb-main-col">
            <strong>${esc(entry.playerName)}</strong>
            <div class="lb-tags">
              ${isMe ? `<span class="tag is-you">${t('leaderboard.youTag')}</span>` : ''}
              <span class="tag">${esc(t('leaderboard.missionsCount', { count: entry.missions }))}</span>
              ${seatName ? `<span class="tag">${esc(seatName)}</span>` : ''}
            </div>
          </div>
          <span class="lb-score">${t('results.ptsSuffix', { pts: number(entry.bestScore) })}</span>
          <span class="leader-grade">${esc(entry.bestGrade)}</span>
        </div>`;
      }
      const players = Array.isArray(entry.players) ? entry.players : [];
      const isMe = !!(highlightId && entry.id === highlightId) || !!(myLower && players.some(p => String(p.playerName || '').toLowerCase() === myLower));
      const namesLine = players.map(p => p.playerName).join(' · ') || '—';
      const siteLabel = SITES_INFO[entry.site]?.name || entry.site || '';
      const diffLabel = difficulty[entry.difficulty]?.label || entry.difficulty || '';
      return `<div class="lb-row${isMe ? ' lb-me' : ''}">
        <span class="leader-pos">${rank}</span>
        <div class="lb-main-col">
          <strong>${esc(namesLine)}</strong>
          <div class="lb-tags">
            ${isMe ? `<span class="tag is-you">${t('leaderboard.youTag')}</span>` : ''}
            ${siteLabel ? `<span class="tag">${esc(siteLabel)}</span>` : ''}
            ${diffLabel ? `<span class="tag">${esc(diffLabel)}</span>` : ''}
            <span class="tag">${esc(t('leaderboard.tasksCount', { done: entry.tasksDone ?? 0, total: entry.tasksTotal ?? 4 }))}</span>
            ${entry.strandedCount ? `<span class="tag is-warn">${esc(t('leaderboard.strandedTag', { count: entry.strandedCount }))}</span>` : `<span class="tag">${t('leaderboard.allReturnedTag')}</span>`}
            ${entry.roomCode ? `<span class="tag">${esc(entry.roomCode)}</span>` : ''}
          </div>
        </div>
        <span class="lb-score">${t('results.ptsSuffix', { pts: number(entry.teamScore) })}</span>
        <span class="leader-grade">${esc(entry.grade)}</span>
      </div>`;
    }).join('');
  }

  async function loadResultsLeaderboard(highlightId, source) {
    const wrap = $('#results-server-lb-wrap'), list = $('#results-server-lb'), status = $('#results-server-lb-status'), title = $('#results-server-lb-title');
    if (!wrap || !list || !status || !title) return;
    title.textContent = source === 'solo' ? t('results.serverLb.titleSolo') : t('results.serverLb.titleServer');
    if (source === 'solo') {
      const res = net.getSoloLeaderboard?.({ tab: 'missions', limit: 5 }) || { entries: [] };
      status.hidden = res.entries.length > 0;
      status.textContent = res.entries.length ? '' : t('results.serverLb.empty');
      list.innerHTML = renderLeaderboardRows(res.entries, 'missions', highlightId);
      return;
    }
    status.hidden = false;
    status.textContent = t('results.serverLb.loading');
    list.innerHTML = '';
    try {
      const res = await net.getLeaderboard?.({ tab: 'missions', limit: 5 });
      const entries = res?.entries || [];
      status.hidden = entries.length > 0;
      status.textContent = entries.length ? '' : t('results.serverLb.empty');
      list.innerHTML = renderLeaderboardRows(entries, 'missions', highlightId);
    } catch {
      status.hidden = false;
      status.textContent = t('results.serverLb.offline');
    }
  }

  function submitAndShowResultsLeaderboard(record) {
    if (record.mode === 'solo') {
      if (lastSubmittedMissionId !== record.id) {
        lastSubmittedMissionId = record.id;
        net.recordSoloScore?.(record);
      }
      loadResultsLeaderboard(record.id, 'solo');
      return;
    }
    if (net.isHost) {
      if (lastSubmittedMissionId !== record.id) {
        lastSubmittedMissionId = record.id;
        net.submitScore?.(record).catch(() => null).finally(() => loadResultsLeaderboard(record.id, 'server'));
      } else {
        loadResultsLeaderboard(record.id, 'server');
      }
    } else {
      window.setTimeout(() => loadResultsLeaderboard(record.id, 'server'), 650);
    }
  }

  function syncLeaderboardControls() {
    $$('#lb-source [data-lb-source]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lbSource === lbState.source)));
    $$('#lb-tab [data-lb-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lbTab === lbState.tab)));
    const diffSel = $('#lb-filter-difficulty'), siteSel = $('#lb-filter-site');
    if (diffSel) diffSel.value = lbState.difficulty;
    if (siteSel) siteSel.value = lbState.site;
  }

  async function loadLeaderboardScreen() {
    syncLeaderboardControls();
    const list = $('#leaderboard-list'), status = $('#leaderboard-status');
    if (!list || !status) return;
    const opts = { tab: lbState.tab, difficulty: lbState.difficulty, site: lbState.site, limit: 25 };
    if (lbState.source === 'solo') {
      const res = net.getSoloLeaderboard?.(opts) || { entries: [] };
      const entries = res.entries || [];
      status.textContent = entries.length ? t('leaderboard.countSummary', { count: entries.length }) : t('leaderboard.emptySolo');
      list.innerHTML = renderLeaderboardRows(entries, lbState.tab);
      return;
    }
    status.textContent = t('leaderboard.loading');
    list.innerHTML = '';
    try {
      const res = await net.getLeaderboard?.(opts);
      const entries = res?.entries || [];
      status.textContent = entries.length ? t('leaderboard.countSummary', { count: entries.length }) : t('leaderboard.emptyServer');
      list.innerHTML = renderLeaderboardRows(entries, lbState.tab);
    } catch {
      status.textContent = t('leaderboard.offlineServer');
    }
  }

  function openLeaderboard(source = null) {
    if (source === 'solo' || source === 'server') lbState.source = source;
    showScreen('leaderboard');
    loadLeaderboardScreen();
  }

  $$('#lb-source [data-lb-source]').forEach(b => b.addEventListener('click', () => { lbState.source = b.dataset.lbSource; loadLeaderboardScreen(); }));
  $$('#lb-tab [data-lb-tab]').forEach(b => b.addEventListener('click', () => { lbState.tab = b.dataset.lbTab; loadLeaderboardScreen(); }));
  $('#lb-filter-difficulty')?.addEventListener('change', e => { lbState.difficulty = e.target.value; loadLeaderboardScreen(); });
  $('#lb-filter-site')?.addEventListener('change', e => { lbState.site = e.target.value; loadLeaderboardScreen(); });

  window.addEventListener('astro:lang', () => {
    selectWorld(state.world);
    renderLobby();
    renderBadge();
    renderPlanner();
    SIM.refreshUI?.();
    if (state.screen === 'leaderboard') loadLeaderboardScreen();
  });
  selectWorld(state.world);paintArt();renderLobby();renderBadge();renderPlanner();setupStars();lockGuest();net.start();
  if(!DATA)fetch('assets/models/parts/manifest.json').then(r=>r.json()).then(m=>{useData(m);renderBadge();renderDifficultyStep();renderPlanner();}).catch(()=>toast(t('planner.loadPartsError')));
})();
