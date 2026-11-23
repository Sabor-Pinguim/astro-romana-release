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
    consoleGlow.position.set(0, 1.05, -0.2);
    scene.add(consoleGlow);

    const stars = createStarfield(600, 35, 110);
    scene.add(stars);
    const marsPlanet = createFacetedMarsPlanet(7.5);
    marsPlanet.position.set(4.5, 4.2, -26);
    scene.add(marsPlanet);

    const gltf = await parseFreshGLB(window.ASTRO?.COCKPIT_MODEL || 'rocket/cockpit_pilot.glb');
    const root = gltf.scene;
    scene.add(root);

    // The centre display shares the GLB's screen dimensions and panel tilt.
    const dockingTarget = new THREE.WebGLRenderTarget(512, 354);
    dockingTarget.texture.colorSpace = THREE.SRGBColorSpace;
    const centreScreen = new THREE.Mesh(new THREE.PlaneGeometry(.34, .235),
      new THREE.MeshBasicMaterial({ map: dockingTarget.texture, toneMapped: false }));
    const panelTilt = -35 * Math.PI / 180;
    centreScreen.rotation.x = panelTilt;
    centreScreen.position.set(0, .86, -.7).add(new THREE.Vector3(0, .065, .068).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
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
      mesh.position.set(0, .86, -.7).add(new THREE.Vector3(x, .065, .09).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
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
      group.position.set(0, 0.86, -0.7).add(new THREE.Vector3(u, 0.065, w).applyAxisAngle(new THREE.Vector3(1, 0, 0), panelTilt));
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
      ctx.fillText(f.docked ? 'HARD-DOCK' : 'DOCKING CAMERA', 18, 30);
      const g = f.docking, x = 256 + (g?.value[1] || 0) * 100, y = 177 - (g?.value[0] || 0) * 70;
      ctx.strokeStyle = '#8ac5d0'; ctx.lineWidth = 5; ctx.strokeRect(190, 105, 132, 144);
      ctx.beginPath(); ctx.moveTo(30, 177); ctx.lineTo(190, 177); ctx.moveTo(322, 177); ctx.lineTo(482, 177); ctx.stroke();
      ctx.fillStyle = '#dce6e5'; ctx.beginPath(); ctx.moveTo(x, y - 35); ctx.lineTo(x + 26, y + 25); ctx.lineTo(x - 26, y + 25); ctx.closePath(); ctx.fill();
      texture.needsUpdate = true;
    }
    centreScreen.visible = true;
    drawMissionScreen({ docked: false, docking: null });

    const camAnchor = root.getObjectByName('Camera_Pilot');
    const baseCamPos = camAnchor
      ? camAnchor.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(0, 1.18, 0.38);
    const lookTarget = new THREE.Vector3(0, 0.86, -0.55);
    camera.position.copy(baseCamPos);
    camera.lookAt(lookTarget);

    const throttlePivot = root.getObjectByName('Throttle_Lever');
    const stickRHC = root.getObjectByName('Joystick_RHC');
    const stickTHC = root.getObjectByName('Controller_THC');
    const breakerBank = root.getObjectByName('Breaker_Bank');
    const stageSwitch = root.getObjectByName('Stage_Sep_Switch');
    const edlSwitch = root.getObjectByName('EDL_Arm_Switch');
    const alarmRedMats = cloneAlarmMaterials(root.getObjectByName('Alarm_Master_Red'));
    const alarmAmberMats = cloneAlarmMaterials(root.getObjectByName('Alarm_Caution_Amber'));

    // Navball: the ball turns so its horizon line reaches the green brackets (20° on the ball) at the band edge.
    const navball = root.getObjectByName('Navball');
    const navBase = navball ? navball.quaternion.clone() : null, navQ = new THREE.Quaternion(), navGoal = new THREE.Quaternion(), navE = new THREE.Euler();
    const throttleBaseRot = throttlePivot ? throttlePivot.rotation.x : 0;
    const rhcBaseRot = stickRHC ? stickRHC.rotation.clone() : new THREE.Euler();

    // Tag clickable meshes with their cockpit action
    const interactiveMeshes = [];
    const tagPivot = (obj, actionFn) => {
      if (!obj) return;
      obj.traverse(ch => {
        if (ch.isMesh) {
          ch.userData.onCockpitClick = actionFn;
          interactiveMeshes.push(ch);
        }
      });
    };
    tagPivot(throttlePivot, () => window.ASTRO_SIM?.handleCockpitAction('throttle_up'));
    tagPivot(stickRHC, () => window.ASTRO_SIM?.handleCockpitAction('stabilize'));
    tagPivot(stickTHC, () => {
      const f = window.ASTRO_SIM?.flight;
      if (f?.step === 2 && !f.docked) window.ASTRO_SIM?.handleCockpitAction('stabilize');
      else window.ASTRO_SIM?.handleCockpitAction('pump_fuel');
    });
    tagPivot(breakerBank, () => {
      const f = window.ASTRO_SIM?.flight;
      const tripped = f?.breakers ? f.breakers.findIndex(Boolean) : 0;
      window.ASTRO_SIM?.handleCockpitAction('breaker', tripped >= 0 ? tripped : 0);
    });
    tagPivot(stageSwitch, () => window.ASTRO_SIM?.handleCockpitAction('stage_sep'));
    tagPivot(edlSwitch, () => window.ASTRO_SIM?.handleCockpitAction('stabilize'));

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

    // Raycast interaction + slight head-look on pointer move
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoverOffset = new THREE.Vector2(0, 0);

    renderer.domElement.addEventListener('pointermove', e => {
      if (window.ASTRO_SIM?.flight?.step === 1) {
        hoverOffset.set(0, 0);
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      hoverOffset.set(pointer.x * 0.04, pointer.y * 0.025);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
    });

    renderer.domElement.addEventListener('click', e => {
      if (window.ASTRO_SIM?.flight?.step === 1) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length && hits[0].object.userData.onCockpitClick) {
        hits[0].object.userData.onCockpitClick();
      }
    });

    let lastT = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!section.classList.contains('active')) {
        lastT = now;
        return;
      }
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const f = window.ASTRO_SIM?.flight;

      if (f) {
        const activeMonitor = f.step === 1 ? 1 : f.step === 2 ? 2 : 0;
        const pulse = reducedMotion ? 0.95 : 0.72 + 0.28 * Math.sin(now * 0.006);
        monitorHighlights.forEach((hl, idx) => {
          hl.visible = idx === activeMonitor;
          if (hl.visible) hl.userData.mat.opacity = pulse;
        });
        if (f.step === 0 || (f.step === 1 && f.portDock)) {
          const d = f.step === 1 ? f.portDock : { x: 0.45, y: -0.3, z: 5 };
          dockingCamera.position.set(d.x, d.y, d.z); dockingCamera.lookAt(d.x, d.y, 0);
          cabinReticleMat.color.setHex(Math.hypot(d.x, d.y) < .18 ? 0x7edac2 : 0xf59e0b);
          hatch.rotation.z += reducedMotion ? 0 : dt * .18;
          cabinCollar.rotation.z = reducedMotion ? 0 : hatch.rotation.z * .35;
          renderer.setRenderTarget(dockingTarget); renderer.render(dockingScene, dockingCamera); renderer.setRenderTarget(null);
        }
        centreMaterial.map = dockingTarget.texture;
        if (f.step === 2) drawMissionScreen(f);
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
          stickRHC.rotation.z = THREE.MathUtils.lerp(stickRHC.rotation.z, rhcBaseRot.z - (f.pitchX || 0) * 0.014, 0.15);
          stickRHC.rotation.x = THREE.MathUtils.lerp(stickRHC.rotation.x, rhcBaseRot.x + (f.pitchY || 0) * 0.014, 0.15);
        }
        if (stageSwitch) {
          stageSwitch.rotation.x = THREE.MathUtils.lerp(stageSwitch.rotation.x, f.stageSeparated ? -0.65 : 0.25, 0.16);
        }
        if (edlSwitch) {
          edlSwitch.rotation.x = THREE.MathUtils.lerp(edlSwitch.rotation.x, f.edlChuteDeployed ? -0.65 : 0.25, 0.16);
        }

        // Exterior planet & stars motion according to flight progress. Mars only shows up on arrival: the
        // liftoff and both dockings happen at Earth.
        marsPlanet.visible = f.step === 3;
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
        let sx = 0, sy = 0;
        if (!reducedMotion && ((f.throttle || 0) > 0.55 || f.edlChuteDeployed || sparking)) {
          const amp = sparking ? 0.014 : f.edlChuteDeployed ? 0.011 : 0.006 * (f.throttle || 0);
          sx = (Math.random() - 0.5) * amp;
          sy = (Math.random() - 0.5) * amp;
        }
        camera.position.set(baseCamPos.x + hoverOffset.x + sx, baseCamPos.y + hoverOffset.y + sy, baseCamPos.z);
        camera.lookAt(lookTarget);
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
      camera.position.set(0.3 + Math.sin(angle) * 0.55, 2.35, 5.4);
      camera.lookAt(0.3, 1.35, 0);
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
