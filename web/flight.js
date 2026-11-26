(async () => {
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

(() => {
  const loader = new GLTFLoader();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const CREW_IDS = ['helena', 'lucas', 'oscar', 'maya'];
  const CREW_COLORS = {
    helena: '#ff7847',
    lucas: '#52b7ff',
    oscar: '#f6c445',
    maya: '#4be08a',
  };
  const DEFAULT_MARS_RAMP = ['#5d291a', '#7c3621', '#9c4328', '#bb5330', '#d26a3b'];

  const bufCache = new Map();
  async function loadGLBBytes(relPath) {
    if (bufCache.has(relPath)) return bufCache.get(relPath);
    const b64 = window.ASTRO_GLB?.[relPath];
    let buf;
    if (b64) {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      buf = u8.buffer;
    } else {
      const res = await fetch(`assets/models/${relPath}`);
      if (!res.ok) throw new Error(`Failed to fetch ${relPath}: ${res.status}`);
      buf = await res.arrayBuffer();
    }
    bufCache.set(relPath, buf);
    return buf;
  }

  async function parseFreshGLB(relPath) {
    const buf = await loadGLBBytes(relPath);
    return loader.parseAsync(buf.slice(0), '');
  }

  function makeViewport(container, { fov = 50, clearColor = 0x050912, clearAlpha = 1 } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: clearAlpha < 1, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 240);
    renderer.setSize(w, h, false);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;';
    container.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(fov, w / h, 0.05, 300);

    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      }
    };
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    container.classList.add('is-3d');
    return { renderer, scene, camera, resize };
  }

  function addStandardStudioLights(scene, { warmRim = 0xff7038 } = {}) {
    scene.add(new THREE.AmbientLight(0xd9e3f5, 0.42));
    const key = new THREE.DirectionalLight(0xfff4e2, 2.2);
    key.position.set(4, 7, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(warmRim, 0.95);
    rim.position.set(-5, 3, -6);
    scene.add(rim);
  }

  function createFacetedMarsPlanet(radius = 8.5) {
    const geo = new THREE.IcosahedronGeometry(radius, 2); // already non-indexed
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const idx = Math.abs(Math.floor((cy * 1.3 + cx * 0.7) * 2)) % DEFAULT_MARS_RAMP.length;
      c.set(DEFAULT_MARS_RAMP[idx]);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r;
        colors[(i + k) * 3 + 1] = c.g;
        colors[(i + k) * 3 + 2] = c.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0.04, flatShading: true
    }));
  }

  function createStarfield(count = 550, minR = 45, maxR = 120) {
    const pos = new Float32Array(count * 3);
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const r = minR + rnd() * (maxR - minR);
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(phi);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeaf0ff, size: 0.35, sizeAttenuation: true }));
  }

  function findClip(clips, names) {
    for (const n of names) {
      const exact = clips.find(c => c.name === n);
      if (exact) return exact;
    }
    for (const n of names) {
      const pref = clips.find(c => c.name.startsWith(n));
      if (pref) return pref;
    }
    return clips[0] || null;
  }

  function playClip(actor, clipName, fade = 0.22) {
    if (!actor?.mixer) return;
    const action = actor.actions[clipName];
    if (!action || actor.current === action) return;
    if (actor.current) actor.current.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    actor.current = action;
  }

  function cloneAlarmMaterials(node) {
    const mats = [];
    if (!node) return mats;
    node.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        mats.push(child.material);
      }
    });
    return mats;
  }

  // ---------------------------------------------------------------------------
  // 1. FIRST-PERSON COCKPIT (#cockpit-viewport)
  // ---------------------------------------------------------------------------
  async function initCockpit() {
    const section = document.getElementById('cockpit');
    const container = document.getElementById('cockpit-viewport');
    if (!section || !container) return;

    const { renderer, scene, camera } = makeViewport(container, { fov: 62, clearColor: 0x030710 });
    addStandardStudioLights(scene, { warmRim: 0x5aaeff });
    const consoleGlow = new THREE.PointLight(0x52d6ff, 1.4, 3.5);
    consoleGlow.position.set(0, 1.45, 0.35); // under the overhead panel, lighting its face
    scene.add(consoleGlow);

    const stars = createStarfield(600, 35, 110);
    scene.add(stars);
    const marsPlanet = createFacetedMarsPlanet(7.5);
    marsPlanet.position.set(4.5, 4.2, -26);
    scene.add(marsPlanet);

    const gltf = await parseFreshGLB(window.ASTRO?.COCKPIT_MODEL || 'rocket/cockpit_pilot.glb');
    const root = gltf.scene;
    scene.add(root);
    // Orion cabin (tools/modeling/parts/cockpit.mjs): the panel hangs over the reclined crew; its frame comes from
    // the model, so the screens below follow it.
    root.updateMatrixWorld(true);
    const panelFrame = root.getObjectByName('Panel_Frame');
    const PANEL_O = panelFrame ? panelFrame.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, .86, -.7);
    const panelTilt = panelFrame ? panelFrame.rotation.x : -35 * Math.PI / 180;

    // The centre display shares the GLB's screen dimensions and panel tilt.
    const dockingTarget = new THREE.WebGLRenderTarget(512, 354);
    dockingTarget.texture.colorSpace = THREE.SRGBColorSpace;
    const centreScreen = new THREE.Mesh(new THREE.PlaneGeometry(.34, .235),
      new THREE.MeshBasicMaterial({ map: dockingTarget.texture, toneMapped: false }));
    centreScreen.rotation.x = panelTilt;
    centreScreen.position.copy(PANEL_O).add(new THREE.Vector3(0, .065, .068).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
    centreScreen.visible = false;
    root.add(centreScreen);

    // A separate 3D docking camera is rendered into the centre screen's texture.
    const dockingScene = new THREE.Scene(); dockingScene.background = new THREE.Color('#050e1b');
    dockingScene.add(new THREE.HemisphereLight(0xcdeaff, 0x263346, 2));
    const dockLight = new THREE.DirectionalLight(0xffffff, 2.2); dockLight.position.set(3, 5, 5); dockingScene.add(dockLight);
    dockingScene.add(createStarfield(180, 12, 36));
    const dockingCamera = new THREE.PerspectiveCamera(48, 512 / 354, .05, 50);
    dockingScene.add(dockingCamera);

    const hatch = new THREE.Group(); dockingScene.add(hatch);
    const metal = new THREE.MeshStandardMaterial({ color: 0xb6c4c9, roughness: .55, metalness: .55, flatShading: true });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x344b5e, roughness: .7, flatShading: true });
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xdce6e9, roughness: .5, metalness: .35, flatShading: true });
    const targetRingMat = new THREE.MeshBasicMaterial({ color: 0x7edac2 });
    const bullseyeMat = new THREE.MeshBasicMaterial({ color: 0xfce8a6 });

    // Endurance-style rotating ring station structure around the central docking hub
    const stationRing = new THREE.Mesh(new THREE.TorusGeometry(2.35, .09, 6, 24), darkMetal);
    stationRing.position.z = -.38;
    hatch.add(stationRing);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(.44, .28, .32), i % 2 ? metal : moduleMat);
      pod.position.set(Math.sin(a) * 2.35, Math.cos(a) * 2.35, -.38);
      pod.rotation.z = -a;
      hatch.add(pod);
      if (i % 3 === 0) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.35, .12), darkMetal);
        strut.position.set(Math.sin(a) * 1.68, Math.cos(a) * 1.68, -.28);
        strut.rotation.z = -a;
        hatch.add(strut);
      }
    }

    // Central pressurized docking adapter & concentric alignment targets (visible down to z = 0.35 m)
    const outer = new THREE.Mesh(new THREE.TorusGeometry(1.05, .12, 6, 16), metal); hatch.add(outer);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(.72, .06, 6, 16), darkMetal); inner.position.z = .06; hatch.add(inner);
    const midGuide = new THREE.Mesh(new THREE.TorusGeometry(.42, .022, 6, 16), metal); midGuide.position.z = .03; hatch.add(midGuide);
    const captureRing = new THREE.Mesh(new THREE.TorusGeometry(.18, .012, 6, 24), targetRingMat); captureRing.position.z = .04; hatch.add(captureRing);
    const bullseyeRing = new THREE.Mesh(new THREE.TorusGeometry(.055, .008, 6, 16), bullseyeMat); bullseyeRing.position.z = .045; hatch.add(bullseyeRing);
    const door = new THREE.Mesh(new THREE.CircleGeometry(.68, 12), metal); door.position.z = -.02; hatch.add(door);
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(.045, .62, .03), darkMetal);
      const a = i * Math.PI / 4; spoke.position.set(Math.sin(a) * .35, Math.cos(a) * .35, .01); spoke.rotation.z = -a; hatch.add(spoke);
    }

    // Foreground cabin hatch collar & crosshair attached to dockingCamera (moves with the ship in 3D)
    const cabinCollar = new THREE.Group();
    cabinCollar.position.z = -.28;
    const cabinFrameMat = new THREE.MeshBasicMaterial({ color: 0x1e2d3d });
    const cabinReticleMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    cabinCollar.add(new THREE.Mesh(new THREE.RingGeometry(.115, .16, 16), cabinFrameMat));
    cabinCollar.add(new THREE.Mesh(new THREE.RingGeometry(.038, .044, 16), cabinReticleMat));
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(.024, .004), cabinReticleMat);
      const a = i * Math.PI / 2;
      tick.position.set(Math.cos(a) * .062, Math.sin(a) * .062, .001);
      tick.rotation.z = a;
      cabinCollar.add(tick);
    }
    dockingCamera.add(cabinCollar);
    dockingCamera.position.set(0.45, -0.3, 5);
    dockingCamera.lookAt(0.45, -0.3, 0);
    const centreMaterial = centreScreen.material;
    centreMaterial.map = dockingTarget.texture;
    renderer.setRenderTarget(dockingTarget);
    renderer.render(dockingScene, dockingCamera);
    renderer.setRenderTarget(null);

    // Dedicated displays: cover the model's static graphics until their phase is active.
    function panelScreen(x) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 354;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.34, .235), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      mesh.rotation.x = panelTilt;
      mesh.position.copy(PANEL_O).add(new THREE.Vector3(x, .065, .068).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
      root.add(mesh);
      return { canvas, texture, mesh, ctx: canvas.getContext('2d') };
    }
    const rightScreen = panelScreen(.5);

    // 3D highlight border around the active monitor (0=left, 1=centre, 2=right)
    const monitorHighlights = [-0.5, 0, 0.5].map((u, idx) => {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, toneMapped: false });
      const sw = 0.34, sh = 0.235, t = 0.012, d = 0.006;
      const top = new THREE.Mesh(new THREE.BoxGeometry(sw + t * 2, t, d), mat);
      top.position.y = (sh + t) / 2;
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(sw + t * 2, t, d), mat);
      bottom.position.y = -(sh + t) / 2;
      const left = new THREE.Mesh(new THREE.BoxGeometry(t, sh, d), mat);
      left.position.x = -(sw + t) / 2;
      const right = new THREE.Mesh(new THREE.BoxGeometry(t, sh, d), mat);
      right.position.x = (sw + t) / 2;
      group.add(top, bottom, left, right);
      group.rotation.x = panelTilt;
      const w = idx === 0 ? 0.064 : idx === 1 ? 0.070 : 0.092;
      group.position.copy(PANEL_O).add(new THREE.Vector3(u, 0.065, w).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
      group.visible = idx === 0;
      group.userData.mat = mat;
      root.add(group);
      return group;
    });

    function drawMissionScreen(f) {
      const { ctx, canvas, texture } = rightScreen, w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#071423'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8da9bd';
      for (let i = 0; i < 32; i++) ctx.fillRect((i * 137 + 23) % w, (i * 83 + 17) % h, 2, 2);
      ctx.fillStyle = '#b8d9e9'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText(window.ASTRO_I18N?.t(f.docked ? 'cockpit.screens.hardDock' : 'cockpit.screens.dockingCamera') ?? '', 18, 30);
      const g = f.docking, x = 256 + (g?.value[1] || 0) * 100, y = 177 - (g?.value[0] || 0) * 70;
      ctx.strokeStyle = '#8ac5d0'; ctx.lineWidth = 5; ctx.strokeRect(190, 105, 132, 144);
      ctx.beginPath(); ctx.moveTo(30, 177); ctx.lineTo(190, 177); ctx.moveTo(322, 177); ctx.lineTo(482, 177); ctx.stroke();
      ctx.fillStyle = '#dce6e5'; ctx.beginPath(); ctx.moveTo(x, y - 35); ctx.lineTo(x + 26, y + 25); ctx.lineTo(x - 26, y + 25); ctx.closePath(); ctx.fill();
      texture.needsUpdate = true;
    }
    centreScreen.visible = true;
    drawMissionScreen({ docked: false, docking: null });

    // Four reclined seats, two over two (Orion layout): Helena and Lucas under the panel, Oscar and Maya below with a
    // display on the back of the seat above. Each seat has its camera (Camera_Seat_n, aimed at that seat's screens). In
    // a room everyone looks from their own seat; solo follows whoever is acting (SIM.cockpitCrew: the step's crew, Lucas
    // on a tripped breaker, the crew member playing an orbit experiment), and keys 1–4 look from another seat until the
    // next task.
    const seatCams = CREW_IDS.map((id, i) => {
      const a = root.getObjectByName(`Camera_Seat_${i + 1}`) || root.getObjectByName('Camera_Pilot');
      const t = a?.userData?.target;
      return {
        pos: a ? a.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.18, 0.38),
        target: Array.isArray(t) ? root.localToWorld(new THREE.Vector3(...t)) : new THREE.Vector3(0, 0.86, -0.55),
      };
    });
    const baseCamPos = new THREE.Vector3(), lookTarget = new THREE.Vector3();
    const SEAT_FOV = root.getObjectByName('Camera_Seat_1')?.userData?.fov || camera.fov;
    const seated = {}; // crew id → avatar model
    let soloSeat = null, seatCrew = null, lastActing;
    const actingCrew = () => (window.ASTRO_SIM?.flight?.active && window.ASTRO_SIM.cockpitCrew?.()) || null;
    const orbitalManual = f => {
      const net = window.ASTRO_NET;
      return f?.orbitalPreview !== 'spectator' && (!net || net.mode === 'solo' || net.seat === 'helena')
        && f?.step === 2 && f.emergencyStep === 2 && f.orbitalEmergency?.stage === 'control';
    };
    const viewCrew = () => {
      if (orbitalManual(window.ASTRO_SIM?.flight)) return 'helena';
      const net = window.ASTRO_NET;
      if (net && net.mode !== 'solo' && CREW_IDS.includes(net.seat)) return net.seat;
      const acting = actingCrew();
      if (acting !== lastActing) { lastActing = acting; soloSeat = null; } // a new task takes the camera back
      return soloSeat || (CREW_IDS.includes(acting) ? acting : 'helena');
    };
    const viewTag = document.getElementById('cockpit-view-tag');
    function updateViewTag() {
      if (!viewTag) return;
      const T = window.ASTRO_I18N?.t, member = window.ASTRO?.crew?.find(p => p.id === seatCrew);
      const base = (T ? T('cockpit.viewTag') : viewTag.textContent).split(' · ')[0];
      viewTag.textContent = member ? `${base} · ${member.name} · ${member.role}`.toUpperCase() : base;
    }
    window.addEventListener('astro:lang', updateViewTag);
    // Looking around from the seat (the pointer handlers are further down): the head turns within LOOK limits around
    // the seat's own view so players can look across/behind at each other; recentring eases back.
    const LOOK = { yaw: 155 * Math.PI / 180, up: 75 * Math.PI / 180, down: 68 * Math.PI / 180, ease: 0.22 };
    const look = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0, drag: null, lastTap: 0 };
    const crewLook = Object.fromEntries(CREW_IDS.map(id => [id, { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0, remoteAt: 0 }]));
    const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const tmpQuat = new THREE.Quaternion();
    let lastLookSentAt = 0, lastSentYaw = 0, lastSentPitch = 0;
    if (window.ASTRO_NET?.on) {
      window.ASTRO_NET.on('msg', m => {
        if (m?.kind === 'cockpit_look' && crewLook[m.seat] && m.seat !== seatCrew) {
          crewLook[m.seat].goalYaw = THREE.MathUtils.clamp(Number(m.yaw) || 0, -LOOK.yaw, LOOK.yaw);
          crewLook[m.seat].goalPitch = THREE.MathUtils.clamp(Number(m.pitch) || 0, -LOOK.down, LOOK.up);
          crewLook[m.seat].remoteAt = performance.now();
        }
      });
    }
    const lookDir = new THREE.Vector3(), lookPoint = new THREE.Vector3();
    function setLook(yaw, pitch, instant = false) {
      look.goalYaw = THREE.MathUtils.clamp(yaw, -LOOK.yaw, LOOK.yaw);
      look.goalPitch = THREE.MathUtils.clamp(pitch, -LOOK.down, LOOK.up);
      if (instant || reducedMotion) { look.yaw = look.goalYaw; look.pitch = look.goalPitch; }
    }
    function aimCamera() { // the seat's view direction turned by the look angles (yaw about +Y: positive turns left)
      lookDir.subVectors(lookTarget, baseCamPos).normalize();
      const theta = Math.atan2(lookDir.x, lookDir.z) + look.yaw;
      const phi = THREE.MathUtils.clamp(Math.asin(lookDir.y) + look.pitch, -1.45, 1.45);
      lookPoint.set(Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)).add(camera.position);
      camera.lookAt(lookPoint);
    }

    // Changing seats dips the view to black for a moment (a cut with reduced motion).
    const SEAT_FADE_MS = 170;
    renderer.domElement.style.transition = `opacity ${SEAT_FADE_MS}ms ease`;
    let fadeTimer = 0;
    function applySeat(instant = false) {
      const id = viewCrew();
      if (id !== seatCrew && seatCrew && !instant && !reducedMotion) {
        if (!fadeTimer) {
          renderer.domElement.style.opacity = '0';
          fadeTimer = window.setTimeout(() => { fadeTimer = 0; placeCamera(viewCrew()); renderer.domElement.style.opacity = '1'; }, SEAT_FADE_MS);
        }
        return;
      }
      placeCamera(id);
    }
    function placeCamera(id) {
      const cam = seatCams[CREW_IDS.indexOf(id)];
      renderer.clippingPlanes = [];
      if (camera.fov !== SEAT_FOV) { camera.fov = SEAT_FOV; camera.updateProjectionMatrix(); }
      baseCamPos.copy(cam.pos);
      lookTarget.copy(cam.target);
      if (id !== seatCrew) setLook(0, 0, true);
      camera.position.copy(baseCamPos);
      aimCamera();
      for (const [cid, model] of Object.entries(seated)) model.visible = cid !== id; // your own suit would fill the view
      if (id === seatCrew) return;
      seatCrew = id;
      updateViewTag();
    }
    applySeat(true);
    window.addEventListener('keydown', e => {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n < 0 || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !section.classList.contains('active')) return;
      if ((window.ASTRO_NET && window.ASTRO_NET.mode !== 'solo') || document.querySelector('dialog[open]')) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      viewCrew(); // note the current task first, so the key holds until the next one
      soloSeat = CREW_IDS[n];
      applySeat();
    });
    window.ASTRO_COCKPIT = {
      get seat() { return seatCrew; },
      get view() { return { yaw: look.goalYaw * 180 / Math.PI, pitch: look.goalPitch * 180 / Math.PI }; },
      seats: CREW_IDS.slice(),
      goTo(seat) { // 1–4 or a crew id (tests and solo; a room keeps each player on their own seat)
        const id = typeof seat === 'number' ? CREW_IDS[seat - 1] : seat;
        if (CREW_IDS.includes(id)) { viewCrew(); soloSeat = id; applySeat(true); }
        return seatCrew;
      },
      peek(pos, target, clip, fov) { // tests and renders: look from any point, with the whole crew, until the seat changes;
        // clip = [nx, ny, nz, d] (or a list of them) keeps the side of each plane its normal points to (a cutaway)
        const planes = !clip ? [] : Array.isArray(clip[0]) ? clip : [clip];
        renderer.clippingPlanes = planes.map(([x, y, z, d]) => new THREE.Plane(new THREE.Vector3(x, y, z), d));
        for (const model of Object.values(seated)) model.visible = true;
        baseCamPos.set(...pos); lookTarget.set(...target);
        setLook(0, 0, true);
        if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
        camera.position.copy(baseCamPos); aimCamera();
      },
      look(yawDeg = 0, pitchDeg = 0) { // tests: turn the head (degrees; positive yaw turns left, positive pitch up)
        setLook(yawDeg * Math.PI / 180, pitchDeg * Math.PI / 180, true);
        aimCamera();
        return { yaw: look.yaw * 180 / Math.PI, pitch: look.pitch * 180 / Math.PI };
      },
    };

    // The crew in their seats: Seat_n is the Hips pivot of the seated avatar and carries the seated pose (degrees,
    // relative to the rig rest). Orion crew fly in launch suits, so the PLSS backpack (and anything hung on it) is left
    // out: triangles of the torso behind BACKPACK_Z.
    const BACKPACK_Z = -0.25;
    function dropBackpack(torso) {
      const v = new THREE.Vector3(), getters = ['getX', 'getY', 'getZ', 'getW'];
      for (const mesh of torso ? torso.children : []) {
        const src = mesh.geometry, pos = src?.attributes.position;
        if (!mesh.isMesh || !pos || src.index) continue;
        const keep = [];
        for (let i = 0; i < pos.count; i += 3) {
          let z = 0;
          for (let k = 0; k < 3; k++) z += v.fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrix).z;
          if (z / 3 >= BACKPACK_Z) keep.push(i);
        }
        if (keep.length * 3 === pos.count) continue;
        const geo = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(src.attributes)) {
          const n = attr.itemSize, out = new Float32Array(keep.length * 3 * n);
          keep.forEach((first, t) => {
            for (let k = 0; k < 3; k++) for (let c = 0; c < n; c++) out[(t * 3 + k) * n + c] = attr[getters[c]](first + k);
          });
          geo.setAttribute(name, new THREE.BufferAttribute(out, n, attr.normalized));
        }
        mesh.geometry = geo;
      }
    }
    await Promise.all(CREW_IDS.map(async (id, i) => {
      const anchor = root.getObjectByName(`Seat_${i + 1}`);
      if (!anchor) return;
      try {
        const model = (await parseFreshGLB(window.ASTRO?.CREW_MODELS?.[id] || `characters/${id}.glb`)).scene;
        model.updateMatrixWorld(true);
        const hips = model.getObjectByName('Hips');
        if (hips) model.position.sub(hips.getWorldPosition(new THREE.Vector3()));
        model.traverse(o => { if (o.name.startsWith('Prop_')) o.visible = false; });
        dropBackpack(model.getObjectByName('Torso'));
        for (const [name, r] of Object.entries(anchor.userData?.pose || {})) {
          const pivot = model.getObjectByName(name);
          if (pivot && Array.isArray(r)) pivot.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.map(d => d * Math.PI / 180))));
        }
        anchor.add(model);
        model.visible = id !== seatCrew;
        seated[id] = model;
      } catch (err) {
        console.warn(`[cockpit] ${id} not seated:`, err);
      }
    }));

    // Displays of the lower seats (Screen_Seat_3/4): Oscar watches the flight telemetry and the link, Maya the crew's
    // pulses and the radiation. Graphics only (no figures): the labels reuse the crew and cockpit strings. When the
    // step is theirs (step 2), the display shows the task: Oscar the docking view of the right display, Maya the
    // propellant transfer; it is framed in amber and works like the right display.
    const lowerScreens = CREW_IDS.map((id, i) => {
      const anchor = root.getObjectByName(`Screen_Seat_${i + 1}`);
      if (!anchor) return null;
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 348;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const { w = 0.28, h = 0.19 } = anchor.userData || {};
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      mesh.userData.holdHalf = [w * 0.41, h * 0.425]; // the share of the screen that steers fully, like the panel displays
      anchor.add(mesh);
      const frameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, toneMapped: false });
      const frame = new THREE.Group(), t = 0.01;
      for (const [fw, fh, x, y] of [[w + 2 * t, t, 0, (h + t) / 2], [w + 2 * t, t, 0, -(h + t) / 2], [t, h, -(w + t) / 2, 0], [t, h, (w + t) / 2, 0]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.004), frameMat);
        bar.position.set(x, y, 0.002);
        frame.add(bar);
      }
      frame.visible = false;
      anchor.add(frame);
      return { id, canvas, texture, ctx: canvas.getContext('2d'), mesh, frame, frameMat, task: false };
    }).filter(Boolean);
    function updateLowerTasks(f, pulse) {
      const acting = actingCrew();
      for (const s of lowerScreens) {
        s.task = !!f && f.step === 2 && !f.orbit?.active && acting === s.id;
        s.frame.visible = s.task;
        s.frameMat.opacity = pulse;
        s.mesh.userData.onCockpitClick = s.task ? rightScreenAction : null;
        s.mesh.userData.cockpitRole = s.task ? 'monitor_right' : null;
        const map = s.task && s.id === 'oscar' ? rightScreen.texture : s.texture;
        if (s.mesh.material.map !== map) { s.mesh.material.map = map; s.mesh.material.needsUpdate = true; }
      }
    }
    let lowerDrawnAt = -1;

    // Brownout (power deficit, web/app.js): while a breaker is out, the displays dim and flicker (steady dim with
    // reduced motion). The model's lit screens share the Display material; the drawn ones are basic materials.
    const BROWNOUT_LEVEL = { dim: 0.5, off: 0.08, steady: 0.35 }; // game: share of the normal brightness
    const displayMats = [];
    root.traverse(o => { if (o.isMesh && o.material?.name === 'Display' && !displayMats.includes(o.material)) displayMats.push(o.material); });
    const displayGlow = displayMats.map(m => m.emissiveIntensity);
    let screenLevel = 1;
    function setScreenLevel(level) {
      if (level === screenLevel) return;
      screenLevel = level;
      displayMats.forEach((m, i) => { m.emissiveIntensity = displayGlow[i] * level; });
      for (const m of [centreScreen.material, rightScreen.mesh.material, ...lowerScreens.map(s => s.mesh.material)]) m.color.setScalar(level);
    }
    function drawLowerScreens(now, f) {
      const T = window.ASTRO_I18N?.t || (k => k), crewInfo = window.ASTRO?.crew || [];
      const tm = reducedMotion ? 0 : now / 1000, prog = Math.max(0, Math.min(1, (f?.progress || 0) / 100));
      for (const s of lowerScreens) {
        const { ctx, canvas, texture } = s, W = canvas.width, H = canvas.height;
        const me = crewInfo.find(p => p.id === s.id), accent = me?.color || CREW_COLORS[s.id];
        ctx.fillStyle = '#061220'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 6);
        ctx.font = 'bold 19px sans-serif'; ctx.fillText(me ? `${me.name} · ${me.role}`.toUpperCase() : s.id, 16, 32);
        ctx.fillStyle = '#8fb3c9'; ctx.font = 'bold 16px sans-serif';
        if (s.task && s.id === 'maya') {
          // Propellant transfer: the same figures as the cockpit card (game values).
          const done = f?.refuelDone || 0, target = f?.design?.refuelTarget ?? 100, share = Math.min(1, done / Math.max(1, target));
          ctx.fillText(T('cockpit.cards.latchedReadout').toUpperCase(), 16, 62);
          ctx.fillStyle = '#1d3346'; ctx.fillRect(16, 96, W - 32, 96);
          ctx.fillStyle = accent; ctx.fillRect(16, 96, (W - 32) * share, 96);
          ctx.fillStyle = '#061220';
          for (let k = 1; k < 10; k++) ctx.fillRect(16 + ((W - 32) * k) / 10 - 1, 96, 2, 96);
          ctx.fillStyle = '#e8f4fb'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(`${done}/${target}%`, 16, 262);
          for (let p = 0; p < 6; p++) { ctx.fillStyle = (Math.floor(tm * 4) + p) % 6 === 0 ? '#f6c445' : '#2a465c'; ctx.fillRect(16 + p * 30, 300, 22, 14); }
        } else if (s.id === 'oscar') {
          ctx.fillText(T('cockpit.telemetryTitle').toUpperCase(), 16, 62);
          // Link bars, a scrolling carrier and the mission progress.
          const lit = 3 + Math.round(1.5 + Math.sin(tm * 0.7) * 1.5);
          for (let b = 0; b < 6; b++) { ctx.fillStyle = b < lit ? '#5fe0c0' : '#1d3346'; ctx.fillRect(W - 120 + b * 17, 64 - b * 7, 12, 10 + b * 7); }
          ctx.strokeStyle = '#1d3346'; ctx.lineWidth = 1;
          for (let gx = 16; gx < W - 16; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 92); ctx.lineTo(gx, 250); ctx.stroke(); }
          ctx.strokeStyle = '#52b7ff'; ctx.lineWidth = 3; ctx.beginPath();
          for (let x = 16; x <= W - 16; x += 4) {
            const y = 171 + Math.sin(x * 0.045 - tm * 3) * 34 * (0.6 + 0.4 * Math.sin(x * 0.011 + tm * 0.5)) + Math.sin(x * 0.21 + tm * 7) * 5;
            x === 16 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.fillStyle = '#1d3346'; ctx.fillRect(16, 280, W - 32, 22);
          ctx.fillStyle = accent; ctx.fillRect(16, 280, (W - 32) * prog, 22);
          for (let p = 0; p < 4; p++) { ctx.fillStyle = (Math.floor(tm * 2) + p) % 4 === 0 ? '#f6c445' : '#2a465c'; ctx.fillRect(16 + p * 30, 316, 22, 14); }
        } else {
          // One pulse line per crew member and a radiation strip.
          ctx.fillText(T('results.breakdown.radLabel').toUpperCase(), 16, H - 52);
          crewInfo.forEach((p, r) => {
            const y0 = 78 + r * 50;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(26, y0, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c7d8e4'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(p.name.toUpperCase(), 42, y0 + 5);
            ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath();
            for (let x = 140; x <= W - 16; x += 3) {
              const ph = ((x - 140) / 90 + tm * (1.1 + r * 0.07)) % 1;
              const y = y0 - (ph > 0.42 && ph < 0.47 ? 18 : ph > 0.47 && ph < 0.51 ? -10 : ph > 0.6 && ph < 0.7 ? 4 : 0);
              x === 140 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
          });
          ctx.fillStyle = '#1d3346'; ctx.fillRect(16, H - 38, W - 32, 20);
          for (let k = 0; k < 26; k++) {
            const x = 16 + ((k * 97 + Math.floor(tm * 9) * 31) % (W - 40));
            ctx.fillStyle = k % 5 ? '#4be08a' : '#f6c445'; ctx.fillRect(x, H - 36, 4, 16);
          }
        }
        texture.needsUpdate = true;
      }
      lowerDrawnAt = now;
    }
    drawLowerScreens(performance.now(), null);

    const throttlePivot = root.getObjectByName('Throttle_Lever');
    const stickRHC = root.getObjectByName('Joystick_RHC');
    const stickTHC = root.getObjectByName('Controller_THC');
    const breakerBank = root.getObjectByName('Breaker_Bank');
    const stageSwitch = root.getObjectByName('Stage_Sep_Switch');
    const edlSwitch = root.getObjectByName('EDL_Arm_Switch');
    const abortBtn = root.getObjectByName('Abort_Button');
    const alarmRedMats = cloneAlarmMaterials(root.getObjectByName('Alarm_Master_Red'));
    const alarmAmberMats = cloneAlarmMaterials(root.getObjectByName('Alarm_Caution_Amber'));

    // Invisible 3D hit-plane over the left monitor (Navball display unit) for direct 3D touch/click steering
    const leftScreenHit = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.25),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    leftScreenHit.rotation.x = panelTilt;
    leftScreenHit.position.copy(PANEL_O).add(new THREE.Vector3(-0.5, 0.065, 0.095).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
    root.add(leftScreenHit);

    // Navball: the ball turns so its horizon line reaches the green brackets (20° on the ball) at the band edge.
    const navball = root.getObjectByName('Navball');
    const navBase = navball ? navball.quaternion.clone() : null, navQ = new THREE.Quaternion(), navGoal = new THREE.Quaternion(), navE = new THREE.Euler();
    const throttleBaseRot = throttlePivot ? throttlePivot.rotation.x : 0;
    const rhcBaseRot = stickRHC ? stickRHC.rotation.clone() : new THREE.Euler();
    const thcBaseRot = stickTHC ? stickTHC.rotation.clone() : new THREE.Euler();

    // Tag clickable & draggable 3D cockpit meshes (monitors, navball, sticks, levers, switches)
    const interactiveMeshes = [];
    const tagPivot = (obj, actionFn, role = null) => {
      if (!obj) return;
      obj.traverse(ch => {
        if (ch.isMesh) {
          ch.userData.onCockpitClick = actionFn;
          if (role) ch.userData.cockpitRole = role;
          interactiveMeshes.push(ch);
        }
      });
    };

    const setHold = h => {
      if (window.ASTRO_SIM?.setPilotHold) window.ASTRO_SIM.setPilotHold(h);
      else if (window.ASTRO_SIM?.flight) window.ASTRO_SIM.flight.hold = h;
    };

    tagPivot(throttlePivot, () => {
      const f = window.ASTRO_SIM?.flight;
      if (!f) return;
      if (f.step === 0) window.ASTRO_SIM?.handleCockpitAction('throttle_up');
      else if (f.step === 1 || orbitalManual(f)) window.ASTRO_SIM?.handleCockpitAction('stabilize');
      else if (f.step === 2) {
        if (f.docked && f.refuelDone >= (f.design?.refuelTarget ?? 100)) window.ASTRO_SIM?.handleCockpitAction('complete_step');
        else if (f.docked) window.ASTRO_SIM?.handleCockpitAction('pump_fuel');
        else window.ASTRO_SIM?.handleCockpitAction('stabilize');
      } else if (f.step === 3) {
        if (!f.edlChuteDeployed) window.ASTRO_SIM?.handleCockpitAction('edl_arm');
        else window.ASTRO_SIM?.handleCockpitAction('stabilize');
      }
    }, 'throttle');

    tagPivot(stickRHC, () => window.ASTRO_SIM?.handleCockpitAction('stabilize'), 'stick_rhc');
    tagPivot(stickTHC, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 2 && f.docked) {
        if (f.refuelDone >= (f.design?.refuelTarget ?? 100)) window.ASTRO_SIM?.handleCockpitAction('complete_step');
        else window.ASTRO_SIM?.handleCockpitAction('pump_fuel');
      } else {
        window.ASTRO_SIM?.handleCockpitAction('stabilize');
      }
    }, 'stick_thc');

    tagPivot(breakerBank, () => {
      const f = window.ASTRO_SIM?.flight;
      const tripped = f?.breakers ? f.breakers.findIndex(Boolean) : 0;
      window.ASTRO_SIM?.handleCockpitAction('breaker', tripped >= 0 ? tripped : 0);
    });
    tagPivot(stageSwitch, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 2 && f.docked) window.ASTRO_SIM?.handleCockpitAction('complete_step');
      else window.ASTRO_SIM?.handleCockpitAction('stage_sep');
    });
    tagPivot(edlSwitch, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 3 && !f.edlChuteDeployed) window.ASTRO_SIM?.handleCockpitAction('edl_arm');
      else window.ASTRO_SIM?.handleCockpitAction('stabilize');
    });
    tagPivot(abortBtn, () => window.ASTRO_SIM?.handleCockpitAction('stabilize'));

    // Make all 3 display units + navball clickable and holdable in 3D to steer/operate their minigames
    tagPivot(navball, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 0 && !f.liftoff) window.ASTRO_SIM?.handleCockpitAction('throttle_up');
      else window.ASTRO_SIM?.handleCockpitAction('stabilize');
    }, 'monitor_left');
    tagPivot(leftScreenHit, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 0 && !f.liftoff) window.ASTRO_SIM?.handleCockpitAction('throttle_up');
      else window.ASTRO_SIM?.handleCockpitAction('stabilize');
    }, 'monitor_left');
    tagPivot(centreScreen, () => window.ASTRO_SIM?.handleCockpitAction('stabilize'), 'monitor_centre');
    function rightScreenAction() {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 2 && f.docked) {
        if (f.refuelDone >= (f.design?.refuelTarget ?? 100)) window.ASTRO_SIM?.handleCockpitAction('complete_step');
        else window.ASTRO_SIM?.handleCockpitAction('pump_fuel');
      } else {
        window.ASTRO_SIM?.handleCockpitAction('stabilize');
      }
    }
    tagPivot(rightScreen.mesh, rightScreenAction, 'monitor_right');
    interactiveMeshes.push(...lowerScreens.map(s => s.mesh)); // live only while they show a task (updateLowerTasks)

    // Spark particles for FX_Sparks_Left & FX_Sparks_Right
    const sparkAnchors = ['FX_Sparks_Left', 'FX_Sparks_Right']
      .map(n => root.getObjectByName(n))
      .filter(Boolean);
    const sparkCount = 48;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVel = Array.from({ length: sparkCount }, () => new THREE.Vector3());
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffb347, size: 0.032, transparent: true, opacity: 0.95 });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    sparkPoints.visible = false;
    sparkPoints.frustumCulled = false;
    scene.add(sparkPoints);

    function resetSpark(i) {
      const anchor = sparkAnchors.length ? sparkAnchors[i % sparkAnchors.length] : null;
      const wp = anchor ? anchor.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(i % 2 ? 0.42 : -0.42, 0.92, -0.35);
      sparkPos[i * 3] = wp.x;
      sparkPos[i * 3 + 1] = wp.y;
      sparkPos[i * 3 + 2] = wp.z;
      sparkVel[i].set((Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 1.3, (Math.random() - 0.3) * 1.1);
    }
    for (let i = 0; i < sparkCount; i++) resetSpark(i);

    // Raycast interaction + direct 3D hold/drag steering on monitors, joysticks and throttle
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoverOffset = new THREE.Vector2(0, 0);
    let active3DControl = null;

    function compute3DHold(ctrl, e, hit) {
      const f = window.ASTRO_SIM?.flight;
      if (!f) return null;
      const role = ctrl.role;
      let dx = 0, dy = 0;
      if (role.startsWith('monitor_') && hit) {
        const own = hit.object.userData.holdHalf;
        const targetMesh = own ? hit.object : role === 'monitor_left' ? leftScreenHit : role === 'monitor_centre' ? centreScreen : rightScreen.mesh;
        const [hx, hy] = own || [0.14, 0.10];
        const local = targetMesh.worldToLocal(hit.point.clone());
        dx = THREE.MathUtils.clamp(local.x / hx, -1, 1);
        dy = THREE.MathUtils.clamp(local.y / hy, -1, 1);
      } else {
        const r = renderer.domElement.getBoundingClientRect();
        dx = THREE.MathUtils.clamp(((e.clientX - ctrl.startX) / Math.max(1, r.width)) * 7.5, -1, 1);
        dy = THREE.MathUtils.clamp((-(e.clientY - ctrl.startY) / Math.max(1, r.height)) * 7.5, -1, 1);
      }

      // Auto-guidance assist when holding near the center of a 3D monitor or joystick without dragging
      if (Math.hypot(dx, dy) < 0.22) {
        if ((f.step === 1 || orbitalManual(f)) && f.portDock?.status === 'approach') {
          const d = f.portDock, h = {};
          if (d.x > 0.07) h.left = true; else if (d.x < -0.07) h.right = true;
          if (d.y > 0.07) h.down = true; else if (d.y < -0.07) h.up = true;
          if (Math.hypot(d.x, d.y) < 0.22 || role === 'stick_thc' || role === 'throttle') h.forward = true;
          return h;
        }
        const g = f.step === 0 ? f.liftoff : f.step === 2 && !f.docked ? f.docking : f.step === 3 ? f.marsBurn : null;
        if (g && !g.done) {
          const h = {};
          if (g.value[0] > 0.18) h.down = true; else if (g.value[0] < -0.18) h.up = true;
          if (g.value[1] > 0.18) h.left = true; else if (g.value[1] < -0.18) h.right = true;
          return h;
        }
      }

      const h = {};
      if (dx > 0.18) h.right = true; else if (dx < -0.18) h.left = true;
      if (dy > 0.18) h.up = true; else if (dy < -0.18) h.down = true;
      if ((f.step === 1 || orbitalManual(f)) && (role === 'stick_thc' || role === 'throttle')) {
        if (dy >= -0.18) h.forward = true; else h.back = true;
      } else if ((f.step === 1 || orbitalManual(f)) && role === 'monitor_centre' && Math.hypot(f.portDock?.x ?? 1, f.portDock?.y ?? 1) < 0.2) {
        h.forward = true;
      }
      return Object.keys(h).length ? h : null;
    }

    // Looking around: drag on the view, off the controls (or with the right button anywhere), and the head turns the
    // way the pointer moves, at the Mars surface's speeds (web/views.js). The cursor stays free, since the cockpit is
    // played by clicking (3D controls, the cards beside the view, the minigames). Double click or tap, or C, recentres.
    const LOOK_SPEED = { mouse: 0.004, touch: 0.006 };
    const canvasEl = renderer.domElement;
    const turnLook = (dx, dy, k) => setLook(look.goalYaw - dx * k, look.goalPitch - dy * k, true); // right turns right

    function raycastCockpit(e) {
      const r = canvasEl.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(interactiveMeshes, false).filter(h => h.object.userData.onCockpitClick || h.object.userData.cockpitRole);
    }
    function startLook(e) {
      look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
      try { canvasEl.setPointerCapture(e.pointerId); } catch {}
      canvasEl.style.cursor = 'grabbing';
    }

    canvasEl.addEventListener('contextmenu', e => e.preventDefault()); // the right button looks around
    canvasEl.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button === 2) { startLook(e); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const hits = raycastCockpit(e);
      if (!hits.length) {
        const now = performance.now();
        if (now - look.lastTap < 320) { setLook(0, 0); look.lastTap = 0; return; } // double click or tap: recentre
        look.lastTap = now;
        startLook(e);
        return;
      }
      const hit = hits[0];
      const obj = hit.object;
      const role = obj.userData.cockpitRole;
      if (obj.userData.onCockpitClick) obj.userData.onCockpitClick();
      if (role) {
        e.preventDefault();
        try { canvasEl.setPointerCapture(e.pointerId); } catch {}
        active3DControl = { role, startX: e.clientX, startY: e.clientY };
        setHold(compute3DHold(active3DControl, e, hit));
        canvasEl.style.cursor = 'grabbing';
      }
    });

    canvasEl.addEventListener('pointermove', e => {
      if (look.drag && e.pointerId === look.drag.id) {
        turnLook(e.clientX - look.drag.x, e.clientY - look.drag.y, look.drag.touch ? LOOK_SPEED.touch : LOOK_SPEED.mouse);
        look.drag.x = e.clientX;
        look.drag.y = e.clientY;
        return;
      }
      const hits = raycastCockpit(e);
      if ((window.ASTRO_SIM?.flight?.step === 1 || orbitalManual(window.ASTRO_SIM?.flight)) && !active3DControl) {
        hoverOffset.set(0, 0);
      } else if (!active3DControl) {
        hoverOffset.set(pointer.x * 0.04, pointer.y * 0.025);
      }
      if (active3DControl) {
        setHold(compute3DHold(active3DControl, e, hits[0] || null));
        canvasEl.style.cursor = 'grabbing';
        return;
      }
      canvasEl.style.cursor = hits.length ? 'pointer' : 'grab';
    });

    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvasEl.addEventListener(ev, e => {
        if (look.drag && e.pointerId === look.drag.id) look.drag = null;
        if (active3DControl) {
          active3DControl = null;
          setHold(null);
        }
        canvasEl.style.cursor = 'grab';
      });
    }
    window.addEventListener('keydown', e => {
      if (e.code !== 'KeyC' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !section.classList.contains('active')) return;
      if (document.querySelector('dialog[open]') || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      setLook(0, 0);
    });

    let lastT = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!section.classList.contains('active')) {
        lastT = now;
        soloSeat = null; // the next cockpit opens on the seat of whoever acts
        return;
      }
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const f = window.ASTRO_SIM?.flight;
      let sx = 0, sy = 0; // camera shake
      if (viewCrew() !== seatCrew) applySeat(); // the next task, or a room seat that arrived after the cockpit opened
      if (lowerScreens.length && now - lowerDrawnAt > (reducedMotion ? 1000 : 100)) drawLowerScreens(now, f);

      if (f) {
        const activeMonitor = (f.orbit?.active || f.cutscene) ? -1 : (f.step === 1 || orbitalManual(f) ? 1 : f.step === 2 ? 2 : 0);
        const pulse = reducedMotion ? 0.95 : 0.72 + 0.28 * Math.sin(now * 0.006);
        monitorHighlights.forEach((hl, idx) => {
          hl.visible = idx === activeMonitor;
          if (hl.visible) hl.userData.mat.opacity = pulse;
        });
        updateLowerTasks(f, pulse);
        const brownout = Array.isArray(f.breakers) && f.breakers.some(Boolean);
        setScreenLevel(!brownout ? 1 : reducedMotion ? BROWNOUT_LEVEL.steady
          : Math.sin(now * 0.031) + Math.sin(now * 0.017 + 1.3) > 0.9 ? BROWNOUT_LEVEL.off : BROWNOUT_LEVEL.dim);
        if (f.step === 0 || ((f.step === 1 || orbitalManual(f)) && f.portDock)) {
          const d = f.step === 1 || orbitalManual(f) ? f.portDock : { x: 0.45, y: -0.3, z: 5 };
          dockingCamera.position.set(d.x, d.y, d.z); dockingCamera.lookAt(d.x, d.y, 0);
          cabinReticleMat.color.setHex(Math.hypot(d.x, d.y) < .18 ? 0x7edac2 : 0xf59e0b);
          hatch.rotation.z += reducedMotion ? 0 : dt * .18;
          cabinCollar.rotation.z = reducedMotion ? 0 : hatch.rotation.z * .35;
          renderer.setRenderTarget(dockingTarget); renderer.render(dockingScene, dockingCamera); renderer.setRenderTarget(null);
        }
        centreMaterial.map = dockingTarget.texture;
        if (f.step === 2 && !orbitalManual(f)) drawMissionScreen(f);
        // Animate cockpit controls from live flight state
        if (throttlePivot) {
          throttlePivot.rotation.x = THREE.MathUtils.lerp(throttlePivot.rotation.x, throttleBaseRot - (f.throttle || 0) * 0.65, 0.14);
        }
        if (navball) {
          navball.visible = true;
          // [pitch, yaw] error / band × 20°: at the band edge the target on the ball reaches the green brackets.
          const g = f.step === 0 ? f.liftoff : f.step === 3 ? f.marsBurn : null, ep = g ? g.value[0] / g.band : 0, ey = g ? g.value[1] / g.band : 0;
          const deg = e => THREE.MathUtils.clamp(e * 20, -70, 70) * Math.PI / 180;
          const roll = g ? Math.sin(now * 0.0011) * 0.04 * Math.min(3, Math.hypot(ep, ey)) : 0;
          if (g) {
            navQ.setFromEuler(navE.set(deg(ep), -deg(ey), roll)); // nose high → target drops; nose right → target moves left
            navball.quaternion.slerp(navGoal.copy(navBase).multiply(navQ), 0.3);
          }
        }
        if (stickRHC) {
          stickRHC.rotation.z = THREE.MathUtils.lerp(stickRHC.rotation.z, rhcBaseRot.z - (f.pitchX || 0) * 0.18, 0.18);
          stickRHC.rotation.x = THREE.MathUtils.lerp(stickRHC.rotation.x, rhcBaseRot.x + (f.pitchY || 0) * 0.18, 0.18);
        }
        if (stickTHC) {
          const inp = (f.step === 1 || orbitalManual(f) ? f.portDock?.input : f.input) || {};
          const tx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
          const ty = (inp.up || inp.forward ? 1 : 0) - (inp.down || inp.back ? 1 : 0);
          stickTHC.rotation.z = THREE.MathUtils.lerp(stickTHC.rotation.z, thcBaseRot.z - tx * 0.16, 0.2);
          stickTHC.rotation.x = THREE.MathUtils.lerp(stickTHC.rotation.x, thcBaseRot.x - ty * 0.16, 0.2);
        }
        if (stageSwitch) {
          stageSwitch.rotation.x = THREE.MathUtils.lerp(stageSwitch.rotation.x, f.stageSeparated ? -0.65 : 0.25, 0.16);
        }
        if (edlSwitch) {
          edlSwitch.rotation.x = THREE.MathUtils.lerp(edlSwitch.rotation.x, f.edlChuteDeployed ? -0.65 : 0.25, 0.16);
        }

        // Exterior planet & stars motion according to flight progress. Mars only shows up on arrival: the
        // liftoff and both dockings happen at Earth.
        marsPlanet.visible = f.step === 3 || !!f.orbit?.active; // also during the Mars orbit experiments
        const prog = Math.max(0, Math.min(1, (f.progress || 0) / 100));
        const marsScale = 0.6 + prog * 1.45;
        marsPlanet.scale.setScalar(marsScale);
        marsPlanet.position.set(4.5 - prog * 3.8, 4.2 - prog * 3.1, -26 + prog * 9);
        if (!reducedMotion) {
          marsPlanet.rotation.y += dt * 0.08;
          stars.rotation.x += dt * (0.01 + (f.throttle || 0) * 0.03);
        }

        // Master alarm & sparks
        const hasBreaker = Array.isArray(f.breakers) && f.breakers.some(Boolean);
        const offAxis = Math.hypot(f.pitchX || 0, f.pitchY || 0) > 18;
        const sparking = now < (f.sparksUntil || 0);
        const blinkRed = (hasBreaker || sparking) && Math.sin(now * 0.014) > 0;
        const blinkAmber = offAxis && Math.sin(now * 0.009) > 0;

        for (const m of alarmRedMats) {
          if (m.emissive) m.emissive.setHex(blinkRed ? 0xff2b2b : 0x2a0606);
          m.emissiveIntensity = blinkRed ? 2.4 : 0.3;
        }
        for (const m of alarmAmberMats) {
          if (m.emissive) m.emissive.setHex(blinkAmber ? 0xf6b73c : 0x2c1c04);
          m.emissiveIntensity = blinkAmber ? 2.0 : 0.3;
        }

        sparkPoints.visible = sparking || hasBreaker;
        if (sparkPoints.visible) {
          for (let i = 0; i < sparkCount; i++) {
            sparkVel[i].y -= 3.71 * dt;
            sparkPos[i * 3] += sparkVel[i].x * dt;
            sparkPos[i * 3 + 1] += sparkVel[i].y * dt;
            sparkPos[i * 3 + 2] += sparkVel[i].z * dt;
            if (sparkPos[i * 3 + 1] < 0.25) resetSpark(i);
          }
          sparkGeo.attributes.position.needsUpdate = true;
        }

        // Camera vibration from engine thrust / parachute opening
        if (!reducedMotion && ((f.throttle || 0) > 0.55 || f.edlChuteDeployed || sparking)) {
          const amp = sparking ? 0.014 : f.edlChuteDeployed ? 0.011 : 0.006 * (f.throttle || 0);
          sx = (Math.random() - 0.5) * amp;
          sy = (Math.random() - 0.5) * amp;
        }
        // Pogo (low TWR, web/app.js): the heavy stack shakes along its axis in the second half of the climb.
        if (!reducedMotion && f.design?.overweight && f.step === 0 && f.liftoff && (f.progress || 0) > 50) sy += Math.sin(now * 0.035) * 0.01;
      }
      const k = reducedMotion ? 1 : 1 - Math.pow(1 - LOOK.ease, dt * 60);
      look.yaw += (look.goalYaw - look.yaw) * k;
      look.pitch += (look.goalPitch - look.pitch) * k;
      camera.position.set(baseCamPos.x + hoverOffset.x + sx, baseCamPos.y + hoverOffset.y + sy, baseCamPos.z);
      aimCamera();
      // Sync local player's head/torso look in multiplayer rooms (~12 Hz when moving)
      if (seatCrew && crewLook[seatCrew]) {
        crewLook[seatCrew].yaw = look.yaw;
        crewLook[seatCrew].pitch = look.pitch;
        crewLook[seatCrew].goalYaw = look.goalYaw;
        crewLook[seatCrew].goalPitch = look.goalPitch;
        const net = window.ASTRO_NET;
        if (net && net.mode !== 'solo' && now - lastLookSentAt > 85 && (Math.abs(look.yaw - lastSentYaw) > 0.02 || Math.abs(look.pitch - lastSentPitch) > 0.02)) {
          lastLookSentAt = now; lastSentYaw = look.yaw; lastSentPitch = look.pitch;
          net.send?.({ kind: 'cockpit_look', seat: seatCrew, yaw: +look.yaw.toFixed(3), pitch: +look.pitch.toFixed(3) });
        }
      }
      // Animate every seated crew member's torso and head (remote players mirror their real look; AI seats glance naturally)
      const tSec = now * 0.001;
      for (let i = 0; i < CREW_IDS.length; i++) {
        const cid = CREW_IDS[i], model = seated[cid];
        if (!model) continue;
        const cl = crewLook[cid];
        if (cid !== seatCrew) {
          const isRemote = cl.remoteAt > 0 && (now - cl.remoteAt) < 12000;
          if (!isRemote && !reducedMotion) {
            // Subtle lifelike glances toward crewmates & instruments
            const phase = tSec * 0.55 + i * 1.9;
            cl.goalYaw = Math.sin(phase) * 0.36 + Math.sin(phase * 0.43) * 0.22;
            cl.goalPitch = Math.sin(phase * 0.71 + 1.1) * 0.14;
          }
          cl.yaw += (cl.goalYaw - cl.yaw) * Math.min(1, dt * 7);
          cl.pitch += (cl.goalPitch - cl.pitch) * Math.min(1, dt * 7);
        }
        const torso = model.getObjectByName('Torso');
        const head = model.getObjectByName('Head');
        if (torso) {
          torso.userData.lookBase ||= torso.quaternion.clone();
          const tYaw = THREE.MathUtils.clamp(cl.yaw * 0.32, -0.49, 0.49);
          const tPitch = THREE.MathUtils.clamp(-cl.pitch * 0.22, -0.24, 0.24);
          const tRoll = THREE.MathUtils.clamp(-cl.yaw * 0.08, -0.14, 0.14);
          tmpEuler.set(tPitch, tYaw, tRoll, 'YXZ');
          torso.quaternion.copy(torso.userData.lookBase).multiply(tmpQuat.setFromEuler(tmpEuler));
        }
        if (head) {
          head.userData.lookBase ||= head.quaternion.clone();
          const hYaw = THREE.MathUtils.clamp(cl.yaw * 0.68, -1.18, 1.18);
          const hPitch = THREE.MathUtils.clamp(-cl.pitch * 0.78, -0.72, 0.72);
          tmpEuler.set(hPitch, hYaw, 0, 'YXZ');
          head.quaternion.copy(head.userData.lookBase).multiply(tmpQuat.setFromEuler(tmpEuler));
        }
      }
      if (seated.helena) {
        const input = orbitalManual(f) ? f.portDock?.input || {} : {};
        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const climb = (input.up ? 1 : 0) - (input.down ? 1 : 0);
        const depth = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
        for (const [name, angle] of [['UpperArm_L', steer * .14], ['UpperArm_R', climb * .14], ['LowerArm_L', depth * .16], ['LowerArm_R', depth * .16]]) {
          const arm = seated.helena.getObjectByName(name);
          if (!arm) continue;
          arm.userData.orbitalBase ||= arm.quaternion.clone();
          arm.quaternion.copy(arm.userData.orbitalBase).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle));
        }
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // 3. ANIMATED 3D PODIUM (#podium-viewport)
  // ---------------------------------------------------------------------------
  let latestRanking = null;
  window.addEventListener('astro:results', e => { latestRanking = e.detail?.ranked; });

  async function initPodium() {
    const section = document.getElementById('results');
    const container = document.getElementById('podium-viewport');
    if (!section || !container) return;

    const { renderer, scene, camera } = makeViewport(container, { fov: 44, clearColor: 0x0b1019 });
    addStandardStudioLights(scene, { warmRim: 0xf6b73c });

    // Slot coordinates for 1st, 2nd, 3rd, 4th places (x, height, z)
    const SLOTS = [
      { x: -0.35, h: 0.92, z: 0.25, col: 0xf6b73c }, // 1st Gold
      { x: -1.75, h: 0.64, z: 0.05, col: 0xc8d3e0 }, // 2nd Silver
      { x: 1.05, h: 0.44, z: 0.05, col: 0xd97a4a },  // 3rd Bronze
      { x: 2.35, h: 0.22, z: -0.25, col: 0x5c6b82 }, // 4th Slate
    ];

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1c2536, roughness: 0.65, metalness: 0.25, flatShading: true });
    for (const s of SLOTS) {
      const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.62, s.h, 6).toNonIndexed(), baseMat);
      colMesh.position.set(s.x, s.h * 0.5, s.z);
      const capMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.56, 0.07, 6).toNonIndexed(),
        new THREE.MeshStandardMaterial({ color: s.col, emissive: s.col, emissiveIntensity: 0.3, roughness: 0.35, flatShading: true })
      );
      capMesh.position.set(s.x, s.h + 0.035, s.z);
      scene.add(colMesh, capMesh);
    }

    // Faceted legless ghost tail (👻) attached to Hips when a crew member is left behind on Mars.
    function createGhostTail(colorHex) {
      const geo = new THREE.ConeGeometry(0.24, 0.68, 7, 4, false);
      geo.rotateX(Math.PI); // tip pointing down
      geo.translate(0, -0.32, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const t = Math.max(0, Math.min(1, (-y) / 0.68)); // 0 at waist, 1 at tail tip
        const ang = Math.atan2(x, z);
        const wave = Math.sin(ang * 3) * 0.045 * t;
        pos.setX(i, x * (1 + 0.15 * Math.sin(t * Math.PI)) + Math.sin(t * 4) * 0.035);
        pos.setY(i, y + wave);
        pos.setZ(i, z * (1 + 0.15 * Math.sin(t * Math.PI)) - Math.pow(t, 1.6) * 0.14);
      }
      const nonIdx = geo.toNonIndexed();
      nonIdx.computeVertexNormals();
      const col = new THREE.Color(colorHex || '#8ae8ff').lerp(new THREE.Color(0xc8f4ff), 0.55);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: new THREE.Color(0x6ad4ff),
        emissiveIntensity: 0.42,
        roughness: 0.25,
        metalness: 0.05,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(nonIdx, mat);
      mesh.name = 'GhostTail';
      mesh.visible = false;
      return mesh;
    }

    const actors = {};
    await Promise.all(CREW_IDS.map(async id => {
      const rel = window.ASTRO?.CREW_MODELS?.[id] || `characters/${id}.glb`;
      const gltf = await parseFreshGLB(rel);
      const model = gltf.scene;
      scene.add(model);
      const hips = model.getObjectByName('Hips') || model;
      const legL = model.getObjectByName('UpperLeg_L');
      const legR = model.getObjectByName('UpperLeg_R');
      const ghostTail = createGhostTail(CREW_COLORS[id]);
      hips.add(ghostTail);
      const meshMats = [];
      const gearMeshes = [];
      model.traverse(child => {
        if (child.name.startsWith('Prop_')) {
          child.visible = false;
          gearMeshes.push(child);
          return;
        }
        if (!child.isMesh || child === ghostTail) return;
        // Hide equipment/backpack/pouches/LEDs on ghosts so only the clean legless suit & helmet silhouette remains.
        if (/_(Pack|Bag|LedGreen|LedRed|LedAmber|Screen|Display)$/.test(child.name)) {
          gearMeshes.push(child);
        }
        const origMat = child.material;
        const ghostMat = origMat.clone();
        ghostMat.transparent = true;
        ghostMat.opacity = 0.42;
        ghostMat.depthWrite = false;
        if (ghostMat.color) ghostMat.color.lerp(new THREE.Color(0xc8f4ff), 0.55);
        if (ghostMat.emissive) {
          ghostMat.emissive.setHex(0x6ad4ff);
          ghostMat.emissiveIntensity = 0.4;
        }
        meshMats.push({ mesh: child, origMat, ghostMat });
      });
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      const idle = findClip(gltf.animations, ['idle_loop', 'idle']);
      const action = findClip(gltf.animations, ['action_loop', 'action']);
      const wave = findClip(gltf.animations, ['wave']);
      if (idle) actions.idle = mixer.clipAction(idle);
      if (action) actions.action = mixer.clipAction(action);
      if (wave) {
        actions.wave = mixer.clipAction(wave);
        actions.wave.setLoop(THREE.LoopRepeat, Infinity);
      }
      const actor = { id, model, mixer, actions, current: null, legL, legR, ghostTail, meshMats, gearMeshes, isGhost: false, slotH: 0.5, rankIdx: 0 };
      playClip(actor, 'idle', 0);
      actors[id] = actor;
    }));

    function applyRanking(ranked) {
      // An empty ranking (launch failure: the crew never flew) leaves the podium empty.
      const empty = Array.isArray(ranked) && !ranked.length;
      for (const id of CREW_IDS) if (actors[id]) actors[id].model.visible = !empty;
      if (empty) return;
      const list = Array.isArray(ranked) && ranked.length
        ? ranked
        : CREW_IDS.map((id, i) => ({ id, pos: i + 1, stranded: false }));
      list.forEach((entry, idx) => {
        const slot = SLOTS[Math.min(idx, SLOTS.length - 1)];
        const actor = actors[entry.id];
        if (!actor) return;
        const isGhost = Boolean(entry.stranded);
        actor.isGhost = isGhost;
        actor.slotH = slot.h;
        actor.rankIdx = idx;
        if (actor.legL) actor.legL.visible = !isGhost;
        if (actor.legR) actor.legR.visible = !isGhost;
        if (actor.ghostTail) actor.ghostTail.visible = isGhost;
        for (const g of actor.gearMeshes) {
          g.visible = g.name.startsWith('Prop_') ? false : !isGhost;
        }
        for (const m of actor.meshMats) {
          m.mesh.material = isGhost ? m.ghostMat : m.origMat;
        }
        actor.model.position.set(slot.x, slot.h + (isGhost ? 0.25 : 0.07), slot.z);
        actor.model.rotation.y = (0.15 - idx * 0.08);
        playClip(actor, isGhost ? 'wave' : idx === 0 ? 'wave' : idx === 1 ? 'action' : 'idle', 0.25);
      });
    }
    applyRanking(latestRanking);
    window.addEventListener('astro:results', e => applyRanking(e.detail?.ranked));

    let lastT = performance.now();
    let angle = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!section.classList.contains('active')) {
        lastT = now;
        return;
      }
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      for (const id of CREW_IDS) {
        const actor = actors[id];
        if (!actor) continue;
        actor.mixer.update(dt);
        if (actor.isGhost && !reducedMotion) {
          actor.model.position.y = actor.slotH + 0.26 + Math.sin(now * 0.0032 + actor.rankIdx * 1.3) * 0.07;
          if (actor.ghostTail) actor.ghostTail.rotation.z = Math.sin(now * 0.0045 + actor.rankIdx) * 0.14;
        }
      }
      if (!reducedMotion) angle += dt * 0.35;
      const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
      const aspect = Math.max(camera.aspect || 1, 0.5);
      const distH = 3.15 / (tanHalfV * aspect) + 0.85;
      const distV = 1.9 / tanHalfV + 0.85;
      const camZ = Math.max(5.8, distH, distV);
      camera.position.set(0.3 + Math.sin(angle) * 0.4, 2.35 + (camZ - 5.8) * 0.14, camZ);
      camera.lookAt(0.3, 1.42, 0);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  let podiumReady = false;
  const ensurePodium = () => {
    if (podiumReady) return;
    podiumReady = true;
    initPodium().catch(err => console.warn('3D podium fallback active:', err));
  };
  initCockpit().catch(err => console.warn('3D cockpit fallback active:', err));
  window.addEventListener('astro:results', ensurePodium);
  if (document.getElementById('results')?.classList.contains('active')) ensurePodium();
})();

})().catch(error => console.warn('flight 3D unavailable:', error));
