(async () => {
// 3D views built from the generated GLBs (assets/models): the Saturn V flying on the menu,
// the selected crew member in the lobby and the rocket the crew is building in the planner.
// Models come from index.models.js (works from file://) or, when served, straight from the folder.
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new GLTFLoader(), cache = new Map();
function loadGLTF(path) {
  if (!cache.has(path)) cache.set(path, (async () => {
    const b64 = window.ASTRO_GLB?.[path];
    let data;
    if (b64) { const bin = atob(b64); data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i); data = data.buffer; }
    else data = await (await fetch('assets/models/' + path)).arrayBuffer();
    return loader.parseAsync(data, '');
  })());
  return cache.get(path);
}
const loadGLB = path => loadGLTF(path).then(gltf => gltf.scene.clone(true));
// One renderer per view, lit like the rest of the identity: cream key light, purple fill, Mars-orange rim.
function makeView(container, { fov = 30, append = false } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 1, .05, 400);
  scene.add(new THREE.AmbientLight(0xb48cf0, .9));
  // Soft room reflections so metallic parts (engines, structure) are not black.
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .5;
  const key = new THREE.DirectionalLight(0xfce8a6, 2.4); key.position.set(-4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xe04f26, 1.8); rim.position.set(5, 1, -4); scene.add(rim);
  container[append ? 'append' : 'prepend'](renderer.domElement);
  const view = { renderer, scene, camera, width: 0, height: 0, onResize: null };
  const syncSize = () => {
    view.width = container.clientWidth; view.height = container.clientHeight;
    if (!view.width || !view.height) return;
    renderer.setSize(view.width, view.height, false);
    camera.aspect = view.width / view.height; camera.updateProjectionMatrix();
    view.onResize?.();
  };
  syncSize();
  new ResizeObserver(syncSize).observe(container);
  view.syncSize = syncSize;
  return view;
}
const isActive = id => document.getElementById(id)?.classList.contains('active');

// Menu: Saturn V in flight + secret 3D Gentoo Penguin easter egg bursting from the SVG Mars.
(async () => {
  const art = document.querySelector('#menu .space-art'), view = art && makeView(art, { fov: 28, append: true });
  if (!view) return;
  view.renderer.domElement.classList.add('saturn-canvas');
  const { scene, camera } = view;

  function toFlat(geo) {
    const out = geo.index ? geo.toNonIndexed() : geo;
    out.computeVertexNormals();
    return out;
  }

  function buildLowPolyPenguin() {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x162033, roughness: .72, metalness: .06, flatShading: true });
    const wingTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x334155, emissiveIntensity: .35, roughness: .52, flatShading: true });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334155, emissiveIntensity: .42, roughness: .48, metalness: .02, flatShading: true });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: .55, flatShading: true });
    const footMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: .6, flatShading: true });
    const handMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: .5, metalness: .08, flatShading: true });
    const handCreaseMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: .55, flatShading: true });

    const part = (geo, mat, pos, rot, scale) => {
      const m = new THREE.Mesh(toFlat(geo), mat);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (scale) m.scale.set(...scale);
      return m;
    };

    // Body (pushed back slightly) + proud white tuxedo belly + wedge tail & orange webbed feet
    group.add(part(new THREE.CylinderGeometry(.28, .38, .86, 8), darkMat, [0, -.06, -.04]));
    group.add(part(new THREE.IcosahedronGeometry(.37, 1), darkMat, [0, -.42, -.04], null, [1, .46, .88]));
    group.add(part(new THREE.CylinderGeometry(.25, .35, .78, 7), whiteMat, [0, -.07, .16], null, [.96, 1, .72]));
    group.add(part(new THREE.IcosahedronGeometry(.33, 1), whiteMat, [0, -.40, .17], null, [.92, .44, .65]));
    group.add(part(new THREE.ConeGeometry(.14, .34, 4), darkMat, [0, -.46, -.36], [-Math.PI * .62, Math.PI * .25, 0], [1, 1, .5]));

    [-1, 1].forEach(s => {
      const foot = new THREE.Group();
      foot.position.set(s * .17, -.58, .13);
      foot.rotation.y = s * .24;
      foot.add(part(new THREE.CylinderGeometry(.11, .14, .06, 5), footMat, [0, 0, .06], null, [.95, 1, 1.45]));
      foot.add(part(new THREE.ConeGeometry(.07, .12, 3), beakMat, [0, -.01, .21], [Math.PI * .5, 0, 0], [1.2, 1, .35]));
      group.add(foot);
    });

    // Head, iconic Gentoo white crown bonnet & prominent red-orange beak
    group.add(part(new THREE.IcosahedronGeometry(.32, 1), darkMat, [0, .54, 0], null, [1, .95, .95]));
    group.add(part(new THREE.TorusGeometry(.265, .085, 5, 8, Math.PI), whiteMat, [0, .60, .06], [-.25, 0, 0], [1.06, .96, 1.25]));
    [-1, 1].forEach(s => {
      group.add(part(new THREE.BoxGeometry(.13, .08, .08), whiteMat, [s * .18, .63, .21], [0, s * .25, -s * .28]));
    });
    group.add(part(new THREE.ConeGeometry(.095, .28, 4), beakMat, [0, .48, .39], [Math.PI * .53, Math.PI * .25, 0], [1.1, 1, .82]));
    group.add(part(new THREE.BoxGeometry(.032, .028, .20), darkMat, [0, .52, .38], [.08, 0, 0]));

    // Eyes with blazing multi-cone low-poly fire jets
    const eyeFlames = [];
    const flameColors = [0xea580c, 0xf59e0b, 0xfef08a];
    const flameSizes = [[.078, .34, .15], [.054, .24, .11], [.030, .15, .07]];
    [-1, 1].forEach(s => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(s * .14, .56, .295);
      eyeGroup.rotation.y = s * .28;
      eyeGroup.add(part(new THREE.CylinderGeometry(.066, .066, .03, 7), whiteMat, [0, 0, 0], [Math.PI * .5, 0, 0]));
      eyeGroup.add(part(new THREE.CylinderGeometry(.042, .042, .036, 7), darkMat, [0, 0, .006], [Math.PI * .5, 0, 0]));

      const flamePivot = new THREE.Group();
      flamePivot.position.set(0, .01, .03);
      flamePivot.rotation.set(.92, 0, -s * .16);
      flameSizes.forEach(([r, h, yOff], idx) => {
        const cone = new THREE.Mesh(
          toFlat(new THREE.ConeGeometry(r, h, 5)),
          new THREE.MeshBasicMaterial({ color: flameColors[idx], side: THREE.DoubleSide }),
        );
        cone.position.y = yOff;
        flamePivot.add(cone);
      });
      eyeGroup.add(flamePivot);
      eyeFlames.push(flamePivot);
      group.add(eyeGroup);
    });

    const eyeLight = new THREE.PointLight(0xff6b1a, 1.8, 4.5, 1.6);
    eyeLight.position.set(0, .65, .85);
    group.add(eyeLight);

    // Flippers raised in the "Absolute Cinema" open-hands pose
    const hands = [];
    [-1, 1].forEach(s => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * .34, .22, .04);
      shoulder.rotation.set(.26, 0, -s * .45);
      shoulder.add(part(new THREE.BoxGeometry(.36, .10, .15), darkMat, [s * .17, 0, 0], [0, 0, s * .15]));
      shoulder.add(part(new THREE.BoxGeometry(.34, .03, .05), wingTrimMat, [s * .17, -.045, .07], [0, 0, s * .15]));

      const elbow = new THREE.Group();
      elbow.position.set(s * .36, .03, .02);
      elbow.rotation.set(-.18, 0, s * .56);
      elbow.add(part(new THREE.BoxGeometry(.09, .24, .12), darkMat, [0, .12, 0]));

      // Low-poly open hand (palm facing +Z, thumb inward toward head, 4 fanned fingers up)
      const hand = new THREE.Group();
      hand.position.set(0, .27, .02);
      hand.rotation.set(0, -s * .12, -s * .14);
      hand.add(part(new THREE.BoxGeometry(.16, .16, .055), handMat, [0, 0, 0]));
      hand.add(part(new THREE.BoxGeometry(.10, .025, .062), handCreaseMat, [0, -.01, .004], [0, 0, s * .25]));
      [-1.5, -.5, .5, 1.5].forEach((slot, idx) => {
        const len = idx === 1 || idx === 2 ? .145 : .12;
        hand.add(part(
          new THREE.BoxGeometry(.032, len, .042),
          handMat,
          [slot * .042, .078 + len * .42, 0],
          [0, 0, -slot * .08],
        ));
      });
      // Thumb facing inward toward the penguin
      hand.add(part(new THREE.BoxGeometry(.038, .105, .045), handMat, [-s * .10, .01, .01], [0, 0, s * .68]));
      elbow.add(hand);
      shoulder.add(elbow);
      group.add(shoulder);
      hands.push({ s, shoulder, baseZ: -s * .45 });
    });

    return { group, eyeFlames, eyeLight, hands };
  }

  const penguin = buildLowPolyPenguin();
  penguin.group.visible = false;
  scene.add(penguin.group);

  camera.position.set(0, 0, 30);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // Saturn V in foreground (loaded asynchronously so the penguin easter egg never blocks on it)
  let flight = null, spin = null, plume = null, saturnBody = null, saturnHeight = 1;
  const home = new THREE.Vector3(), tilt = -.42;
  let scale = 1, launch = null, breakup = null, respawn = null, wasActive = true, penguinSeq = null;
  let lastPointerX = -1, lastPointerY = -1;

  const pointerNdc = new THREE.Vector2(), rectTmp = new THREE.Vector3();
  addEventListener('pointermove', e => { lastPointerX = e.clientX; lastPointerY = e.clientY; }, { passive: true });

  function isMarsHovered() {
    if (!isActive('menu') || lastPointerX < 0) return false;
    const marsEl = document.querySelector('#menu .mars');
    if (!marsEl) return false;
    const r = marsEl.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return Math.hypot(lastPointerX - cx, lastPointerY - cy) <= Math.min(r.width, r.height) * .34;
  }

  function screenToWorld(clientX, clientY, targetZ) {
    const rect = view.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return new THREE.Vector3(0, 0, targetZ);
    camera.updateMatrixWorld();
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    rectTmp.set(pointerNdc.x, pointerNdc.y, .5).unproject(camera).sub(camera.position).normalize();
    const dist = (targetZ - camera.position.z) / (rectTmp.z || -1);
    const out = camera.position.clone().addScaledVector(rectTmp, dist);
    return Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z)
      ? out
      : new THREE.Vector3(0, 0, targetZ);
  }

  view.onResize = () => {
    const H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), W = H * camera.aspect, narrow = camera.aspect < .9;
    home.set(narrow ? W * .2 : W * .07, narrow ? H * .22 : -H * .02, 0);
    scale = (narrow ? .36 : .56) * H / saturnHeight;
  };

  window.ASTRO_LAUNCH = () => new Promise(resolve => {
    if (reduce || !view.width || breakup) return resolve();
    launch = { start: performance.now(), resolve, done: false };
  });

  function clearBreakup() {
    if (!breakup) return;
    scene.remove(breakup.group);
    breakup.disposables.forEach(d => d.dispose?.());
    breakup = null;
    if (flight) flight.visible = true;
  }

  window.ASTRO_LAUNCH_BREAKUP = () => new Promise(resolve => {
    if (reduce || !view.width || !flight || !saturnBody) return resolve();
    if (launch) { launch.done = true; launch = null; }
    clearBreakup();
    flight.updateWorldMatrix(true, true);
    const group = new THREE.Group();
    const pieces = [];
    const disposables = [];
    const origin = new THREE.Vector3();
    flight.getWorldPosition(origin);

    // Clone every mesh in the Saturn V so each stage/fin/engine breaks apart and tumbles with gravity.
    saturnBody.traverse(node => {
      if (!node.isMesh) return;
      const clone = node.clone();
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
      node.matrixWorld.decompose(pos, quat, scl);
      clone.position.copy(pos);
      clone.quaternion.copy(quat);
      clone.scale.copy(scl);
      group.add(clone);
      const out = pos.clone().sub(origin);
      if (out.lengthSq() < 1e-4) out.set((Math.random() - .5) * 2, Math.random(), (Math.random() - .5) * 2);
      out.normalize();
      pieces.push({
        mesh: clone,
        vel: new THREE.Vector3(
          out.x * (1.8 + Math.random() * 3.2) + (Math.random() - .5) * 1.4,
          out.y * (1.4 + Math.random() * 2.6) + 1.2 + Math.random() * 2.2,
          out.z * (1 + Math.random() * 2) + (Math.random() - .5) * 1,
        ),
        rot: new THREE.Vector3((Math.random() - .5) * 4.5, (Math.random() - .5) * 4.5, (Math.random() - .5) * 4.5),
      });
    });

    // Extra low-poly faceted shards & fiery sparks for a dramatic breakup.
    const shardGeo = new THREE.OctahedronGeometry(.28, 0);
    const shardColors = [0xe8e4ec, 0x2a2634, 0xE04F26, 0xF59E0B, 0xFCE8A6];
    const shardMats = shardColors.map(c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .75, metalness: .1 }));
    disposables.push(shardGeo, ...shardMats);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(shardGeo, shardMats[i % shardMats.length]);
      m.position.copy(origin).add(new THREE.Vector3((Math.random() - .5) * 2.2, (Math.random() - .5) * 4.2, (Math.random() - .5) * 1.4));
      m.scale.setScalar(.55 + Math.random() * 1.15);
      group.add(m);
      pieces.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - .5) * 6.5, 1.2 + Math.random() * 3.8, (Math.random() - .5) * 2.5),
        rot: new THREE.Vector3((Math.random() - .5) * 6.5, (Math.random() - .5) * 6.5, (Math.random() - .5) * 6.5),
      });
    }

    const flashGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: .9 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(origin);
    group.add(flash);
    disposables.push(flashGeo, flashMat);

    flight.visible = false;
    scene.add(group);
    breakup = { start: performance.now(), last: performance.now(), group, pieces, flash, flashMat, disposables, resolve, done: false };
  });

  window.ASTRO_MENU_MARS = {
    isHovered: isMarsHovered,
    triggerPenguin({ getTargetRect, onImpact, onDone } = {}) {
      if (!view.width || !view.height) view.syncSize?.();
      if (reduce || !view.width) {
        onImpact?.();
        onDone?.();
        return;
      }
      const marsEl = document.querySelector('#menu .mars');
      let startWorld = new THREE.Vector3(8, 0, -10);
      if (marsEl) {
        const mr = marsEl.getBoundingClientRect();
        startWorld = screenToWorld(mr.left + mr.width * .5, mr.top + mr.height * .5, -10);
        marsEl.classList.remove('is-bursting');
        void marsEl.offsetWidth;
        marsEl.classList.add('is-bursting');
        setTimeout(() => marsEl.classList.remove('is-bursting'), 450);
      }
      art.classList.add('is-penguin-front');
      penguinSeq = {
        start: performance.now(),
        startWorld,
        getTargetRect,
        onImpact,
        onDone,
        impacted: false,
        targetWorld: null,
      };
      penguin.group.visible = true;
    },
  };

  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInCubic = x => x * x * x;
  const up = new THREE.Vector3();

  function frame(now) {
    requestAnimationFrame(frame);
    const active = isActive('menu');
    if (active && !wasActive) {
      launch = null;
      respawn = null;
      if (breakup) { const r = breakup.resolve; clearBreakup(); r?.(); }
      if (penguinSeq) {
        penguin.group.visible = false;
        art.classList.remove('is-penguin-front');
        const cancelled = penguinSeq;
        penguinSeq = null;
        cancelled.onDone?.();
      }
    }
    wasActive = active;
    if (!active || !view.width) return;
    const t = reduce ? 0 : now / 1000;

    if (penguinSeq) {
      const e = (now - penguinSeq.start) / 1000;
      const heroPos = new THREE.Vector3(0, 0, 21.5);
      if (e < 1.25) {
        const k = easeOutCubic(e / 1.25);
        penguin.group.position.lerpVectors(penguinSeq.startWorld, heroPos, k);
        penguin.group.scale.setScalar(THREE.MathUtils.lerp(.25, 1.38, k));
        penguin.group.rotation.set(0, (1 - k) * Math.PI * 10, Math.sin(e * 12) * .12 * (1 - k));
      } else if (e < 1.95) {
        const k = (e - 1.25) / .70;
        penguin.group.position.copy(heroPos);
        penguin.group.position.y += Math.sin(k * Math.PI * 2) * .12;
        penguin.group.scale.setScalar(1.38 + Math.sin(k * Math.PI) * .18);
        penguin.group.rotation.set(-.06, Math.sin(k * Math.PI * 2) * .18, 0);
      } else if (e < 2.65) {
        if (!penguinSeq.targetWorld) {
          const rect = penguinSeq.getTargetRect?.();
          penguinSeq.targetWorld = rect
            ? screenToWorld(rect.left + rect.width * .5, rect.top + rect.height * .5, 14)
            : new THREE.Vector3(-4, -3, 14);
        }
        const k = easeInCubic((e - 1.95) / .70);
        penguin.group.position.lerpVectors(heroPos, penguinSeq.targetWorld, k);
        penguin.group.scale.setScalar(THREE.MathUtils.lerp(1.42, .32, k));
        penguin.group.rotation.set(k * .75, k * Math.PI * 8, -k * .45);
      } else {
        penguin.group.visible = false;
        art.classList.remove('is-penguin-front');
        const seq = penguinSeq;
        penguinSeq = null;
        if (!seq.impacted) {
          seq.impacted = true;
          seq.onImpact?.();
        }
        seq.onDone?.();
      }

      // Animate eye flames & "Absolute Cinema" hand pump while visible
      penguin.eyeFlames.forEach((f, idx) => {
        const flick = .86 + Math.sin(t * 42 + idx * 2.1) * .22 + Math.random() * .2;
        f.scale.set(1 + Math.random() * .16, flick, 1 + Math.random() * .16);
      });
      penguin.eyeLight.intensity = 1.6 + Math.random() * 1.1;
      penguin.hands.forEach(({ s, shoulder, baseZ }) => {
        shoulder.rotation.z = baseZ + s * Math.sin(t * 9) * .08;
      });
    }

    // Saturn V breakup easter egg
    if (breakup) {
      const dt = Math.min(.05, Math.max(0, (now - breakup.last) / 1000));
      breakup.last = now;
      const e = (now - breakup.start) / 1000;
      for (const p of breakup.pieces) {
        p.vel.y -= 9.5 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.rot.x * dt;
        p.mesh.rotation.y += p.rot.y * dt;
        p.mesh.rotation.z += p.rot.z * dt;
      }
      if (e < .5) {
        const k = e / .5;
        breakup.flash.scale.setScalar(1 + k * 2.4);
        breakup.flashMat.opacity = .9 * (1 - k);
      } else {
        breakup.flash.visible = false;
      }
      if (e > 3.6 && !breakup.done) {
        breakup.done = true;
        const r = breakup.resolve;
        clearBreakup();
        respawn = { start: now, duration: .95 };
        r?.();
      }
    }

    // Saturn V (when loaded)
    if (flight && spin && plume && !breakup) {
      flight.rotation.set(-.12, 0, tilt);
      spin.rotation.y = t * .25;
      flight.scale.setScalar(scale);
      flight.position.copy(home);
      flight.position.y += Math.sin(t * 1.3) * .12;
      let burn = 1;
      if (respawn) {
        const k = Math.min(1, (now - respawn.start) / (respawn.duration * 1000));
        const ease = easeOutCubic(k);
        up.set(0, 1, -.35).normalize().applyQuaternion(flight.quaternion);
        flight.position.addScaledVector(up, -14 * (1 - ease));
        flight.scale.setScalar(scale * (.55 + .45 * ease));
        burn = 1 + (1 - ease) * .9;
        if (k >= 1) respawn = null;
      } else if (launch) {
        const e = (now - launch.start) / 1000;
        up.set(0, 1, -.55).normalize().applyQuaternion(flight.quaternion);
        flight.position.addScaledVector(up, 26 * e * e);
        burn = 1 + e * 2.2;
        if (e > 1.05 && !launch.done) { launch.done = true; launch.resolve(); }
      }
      plume.scale.set(1 + Math.random() * .08, burn * (1 + Math.random() * .18), 1 + Math.random() * .08);
    }
    view.renderer.render(scene, camera);
  }
  view.onResize();
  requestAnimationFrame(frame);

  loadGLB('rocket/saturn_v_lowpoly.glb').then(body => {
    saturnBody = body;
    saturnHeight = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).y || 1;
    body.position.y = -saturnHeight / 2;
    const f = new THREE.Group(), sp = new THREE.Group();
    sp.add(body);
    const pl = new THREE.Group();
    pl.position.y = -saturnHeight / 2;
    [[.62, 3.4, 0xe04f26, .5], [.42, 2.4, 0xf59e0b, .7], [.2, 1.4, 0xfce8a6, .95]].forEach(([r, h, color, opacity]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.rotation.x = Math.PI; cone.position.y = -h / 2;
      pl.add(cone);
    });
    sp.add(pl);
    f.add(sp);
    scene.add(f);
    flight = f; spin = sp; plume = pl;
    view.onResize();
  }).catch(err => console.warn('Saturn V not shown:', err));
})().catch(err => console.warn('Menu 3D scene not shown:', err));

// Lobby: the selected crew member (avatar GLB): idle loop, a wave when picked again.
(async () => {
  const box = document.getElementById('detail-view'), view = box && makeView(box, { fov: 24 });
  if (!view) return;
  const AVATARS = { helena: 'characters/helena.glb', lucas: 'characters/lucas.glb', oscar: 'characters/oscar.glb', maya: 'characters/maya.glb' };
  const { scene, camera } = view, holder = new THREE.Group();
  scene.add(holder);
  let mixer = null, idle = null, wave = null, current = null, last = performance.now(), token = 0;
  view.onResize = () => { const d = 1.3 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect * 1.1); camera.position.set(0, 1.15, d); camera.lookAt(0, .95, 0); };
  async function show(id) {
    if (!AVATARS[id]) return;
    if (id === current) { if (wave && idle) { wave.reset().play(); wave.crossFadeFrom(idle, .2, false); } return; }
    current = id;
    const mine = ++token, gltf = await loadGLTF(AVATARS[id]);
    if (mine !== token) return;
    const model = gltf.scene.clone(true);
    model.traverse(o => { if (o.name.startsWith('Prop_')) o.visible = false; });
    holder.clear(); holder.add(model);
    mixer = new THREE.AnimationMixer(model);
    const clip = name => THREE.AnimationClip.findByName(gltf.animations, name);
    idle = clip('idle_loop') && mixer.clipAction(clip('idle_loop'));
    wave = clip('wave') && mixer.clipAction(clip('wave'));
    if (wave) { wave.setLoop(THREE.LoopOnce, 1); wave.clampWhenFinished = false; }
    mixer.addEventListener('finished', () => idle?.reset().fadeIn(.2).play());
    idle?.play();
  }
  window.addEventListener('astro:detail', e => { if (e.detail.kind === 'crew') show(e.detail.id); });
  if (window.ASTRO?.state.detail.kind === 'crew') show(window.ASTRO.state.detail.id);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!isActive('lobby') || !view.width || box.classList.contains('site')) return;
    if (!reduce) { mixer?.update(dt); holder.rotation.y = Math.sin(now / 2500) * .45; }
    view.renderer.render(scene, camera);
  }
  view.onResize();
  requestAnimationFrame(frame);
})().catch(err => console.warn('Avatar not shown:', err));

// Planner Wizard: Dr. Nancy Grace Roman 3D instructor (characters/nancy.glb) standing beside the chalkboard.
// Plays wave on welcome, action_loop (tapping her wooden ruler on her palm like a teacher) on lessons, and salute when ready.
(async () => {
  const box = document.getElementById('wizard-nancy-view');
  const view = box && makeView(box, { fov: 26 });
  if (!view) return;
  const { scene, camera, renderer } = view;
  const holder = new THREE.Group();
  scene.add(holder);
  let loaded = false, loading = false, mixer = null, clips = {}, activeClip = null, holdTimer = 0, last = performance.now();

  view.onResize = () => {
    const aspect = Math.max(0.65, camera.aspect || 1);
    const d = 1.28 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1.05, aspect * 1.05);
    camera.position.set(0.05, 1.38, d);
    camera.lookAt(0, 1.24, 0);
  };

  function playGesture(name) {
    if (!mixer || !clips.idle_loop) return;
    const target = clips[name] || clips.idle_loop;
    if (!target) return;
    if (name === 'action_loop') {
      holdTimer = 2.6;
      if (activeClip !== target) {
        target.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        if (activeClip) target.crossFadeFrom(activeClip, 0.22, false);
        activeClip = target;
      }
      return;
    }
    holdTimer = 0;
    if (name === 'wave' || name === 'salute') {
      target.reset().setLoop(THREE.LoopOnce, 1);
      target.clampWhenFinished = false;
      target.play();
      if (activeClip && activeClip !== target) target.crossFadeFrom(activeClip, 0.2, false);
      activeClip = target;
      return;
    }
    if (activeClip !== clips.idle_loop) {
      clips.idle_loop.reset().play();
      if (activeClip) clips.idle_loop.crossFadeFrom(activeClip, 0.25, false);
      activeClip = clips.idle_loop;
    }
  }

  async function ensureLoaded(initialClip) {
    if (loaded || loading) { if (loaded && initialClip) playGesture(initialClip); return; }
    loading = true;
    try {
      const gltf = await loadGLTF('characters/nancy.glb');
      const model = gltf.scene.clone(true);
      holder.clear();
      holder.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const name of ['idle_loop', 'wave', 'salute', 'action_loop']) {
        const c = THREE.AnimationClip.findByName(gltf.animations, name);
        if (c) clips[name] = mixer.clipAction(c);
      }
      mixer.addEventListener('finished', () => {
        if (clips.idle_loop) {
          clips.idle_loop.reset().fadeIn(0.22).play();
          activeClip = clips.idle_loop;
        }
      });
      if (clips.idle_loop) {
        clips.idle_loop.play();
        activeClip = clips.idle_loop;
      }
      box.classList.add('is-3d');
      loaded = true;
      view.onResize();
      if (initialClip) playGesture(initialClip);
    } catch (err) {
      console.warn('Nancy 3D instructor not shown:', err);
    } finally {
      loading = false;
    }
  }

  window.addEventListener('astro:wizard', e => {
    if (!e.detail?.open) return;
    ensureLoaded(e.detail.clip || null);
  });
  window.addEventListener('astro:wizard-gesture', e => {
    if (!loaded) ensureLoaded(e.detail?.clip || 'action_loop');
    else playGesture(e.detail?.clip || 'action_loop');
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dock = document.getElementById('rocket-wizard');
    if (!loaded || !isActive('planner') || !dock || dock.hidden || !view.width) return;
    if (!reduce) {
      if (holdTimer > 0) {
        holdTimer -= dt;
        if (holdTimer <= 0 && activeClip === clips.action_loop && clips.idle_loop) {
          clips.idle_loop.reset().play();
          clips.idle_loop.crossFadeFrom(clips.action_loop, 0.25, false);
          activeClip = clips.idle_loop;
        }
      }
      mixer?.update(dt);
      holder.rotation.y = -0.18 + Math.sin(now / 2600) * 0.22;
    }
    renderer.render(scene, camera);
  }
  view.onResize();
  requestAnimationFrame(frame);
})().catch(err => console.warn('Nancy wizard view disabled:', err));

// Menu easter egg: full-body Dr. Nancy Grace Roman 3D notice (characters/nancy.glb) when the Saturn V is broken.
(() => {
  const box = document.getElementById('menu-nancy-view');
  const notice = document.getElementById('menu-nancy-notice');
  if (!box || !notice) return;
  let view = null, mixer = null, actions = null, loaded = false, loading = false, last = performance.now();

  async function ensureLoaded() {
    if (loaded || loading) return;
    loading = true;
    try {
      view = makeView(box, { fov: 28 });
      if (!view) return;
      const { scene, camera } = view;
      const gltf = await loadGLTF('characters/nancy.glb');
      const model = gltf.scene.clone(true);
      const b = new THREE.Box3().setFromObject(model);
      const h = Math.max(.01, b.getSize(new THREE.Vector3()).y);
      model.position.set(0, -b.min.y - h * .5, 0);
      model.rotation.y = .18;
      scene.add(model);
      camera.position.set(0, .06, h * 2.25);
      camera.lookAt(0, 0, 0);
      mixer = new THREE.AnimationMixer(model);
      actions = Object.fromEntries((gltf.animations || []).map(c => [c.name, mixer.clipAction(c)]));
      (actions.action_loop || actions.wave || actions.idle)?.play();
      loaded = true;
      view.syncSize?.();
      function tick(now) {
        requestAnimationFrame(tick);
        const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
        last = now;
        if (notice.hidden || !view.width) return;
        if (!reduce && mixer) mixer.update(dt);
        view.renderer.render(scene, camera);
      }
      requestAnimationFrame(tick);
    } catch (err) {
      console.warn('Menu Nancy 3D notice unavailable:', err);
    } finally {
      loading = false;
    }
  }

  window.ASTRO_MENU_NANCY = {
    show() {
      void ensureLoaded().then(() => {
        view?.syncSize?.();
        if (actions?.wave) {
          actions.wave.reset().setLoop(THREE.LoopOnce, 1).play();
        }
      });
    },
  };
})();

// Lobby Step 04: interactive 3D low-poly Mars globe with real Martian geography and accurate crater markers.
(async () => {
  const box = document.getElementById('mars-globe-view'), art = window.ASTRO_ART, ui = window.ASTRO;
  const view = box && art && ui && makeView(box, { fov: 30 });
  if (!view) return;
  box.classList.add('is-3d');
  const { scene, camera, renderer } = view;
  const globe = new THREE.Group();
  scene.add(globe);
  // Fit Mars cleanly inside the box regardless of aspect ratio, with a smooth zoom-in when entering Step 04.
  let baseZ = 5.1, camZ = 5.1;
  view.onResize = () => {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.5, camera.aspect));
    baseZ = Math.max(1.55 / Math.tan(vHalf), 1.55 / Math.tan(hHalf));
    if (camZ < baseZ) camZ = baseZ;
  };
  camera.position.set(0, 0.12, baseZ);
  camera.lookAt(0, 0, 0);

  // Planetocentric coordinates (+Y north pole, +Z lat 0°/lon 0°, +X 90° E — AGENTS.md section 5.8).
  const latLonVec = (latDeg, lonDeg, r = 1) => {
    const lat = THREE.MathUtils.degToRad(latDeg), lon = THREE.MathUtils.degToRad(lonDeg);
    return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
  };
  const angDistDeg = (lat1, lon1, lat2, lon2) => {
    const p1 = latLonVec(lat1, lon1, 1), p2 = latLonVec(lat2, lon2, 1);
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(p1.dot(p2), -1, 1)));
  };

  // Real major Martian albedo & topographic regions (planetocentric lat/lon, East positive):
  // Syrtis Major sits immediately WSW of Jezero (18.4°N, 77.5°E); Isidis Planitia is to its SE;
  // Hellas Basin is south of Syrtis Major; Gale (4.6°S, 137.4°E) sits on the dichotomy boundary south of Elysium.
  const DARK_MARIA = [
    { lat: 8.4, lon: 69.5, r: 16 },   // Syrtis Major
    { lat: -18, lon: 138, r: 22 },    // Terra Cimmeria / southern highlands south of Gale
    { lat: -24, lon: 168, r: 20 },    // Mare Sirenum
    { lat: 48, lon: -21, r: 24 },     // Acidalia Planitia
    { lat: -14, lon: -59, r: 15 },    // Valles Marineris
    { lat: -22, lon: -32, r: 20 },    // Mare Erythraeum
    { lat: 46, lon: 115, r: 18 },     // Utopia Planitia
  ];
  const BRIGHT_REGIONS = [
    { lat: 12.9, lon: 87.0, r: 11 },  // Isidis Planitia (adjacent to Jezero)
    { lat: -42.4, lon: 70.5, r: 20 }, // Hellas Planitia
    { lat: 24.8, lon: 147.2, r: 15 }, // Elysium Planitia / Mons
    { lat: 18.6, lon: -133.8, r: 20 },// Olympus Mons / Tharsis
    { lat: 22, lon: 30, r: 22 },      // Arabia Terra
  ];

  // Faceted Mars mesh shaded from real latitude/longitude albedo regions.
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const pos = geo.attributes.position;
  let s = 17; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const colors = [], c = new THREE.Color(), v = new THREE.Vector3(), w = new THREE.Vector3();
  const { mars: marsRamp, marsDark, ice } = art.RAMPS;
  for (let i = 0; i < pos.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(w.fromBufferAttribute(pos, i + k));
    v.normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)));
    const lon = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z));
    let hex;
    if (lat > 79 || lat < -81) {
      hex = ice[3 + Math.floor(rnd() * 3)];
    } else if (DARK_MARIA.some(m => angDistDeg(lat, lon, m.lat, m.lon) < m.r)) {
      hex = marsDark[2 + Math.floor(rnd() * 3)];
    } else if (BRIGHT_REGIONS.some(b => angDistDeg(lat, lon, b.lat, b.lon) < b.r)) {
      hex = marsRamp[3 + Math.floor(rnd() * 3)];
    } else {
      hex = marsRamp[1 + Math.floor(rnd() * 4)];
    }
    c.set(hex);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const marsMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  globe.add(marsMesh);

  // Subtle faceted atmosphere rim and orbital survey ring.
  const atmos = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 2),
    new THREE.MeshBasicMaterial({ color: 0xe04f26, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
  );
  globe.add(atmos);
  const orbitRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => {
      const a = k / 48 * Math.PI * 2;
      return new THREE.Vector3(1.28 * Math.cos(a), 0, 1.28 * Math.sin(a));
    })),
    new THREE.LineBasicMaterial({ color: 0x9b5de5, transparent: true, opacity: 0.35 })
  );
  orbitRing.rotation.set(0.32, 0, -0.22);
  scene.add(orbitRing);

  // 3D crater beacons on the exact planetocentric surface coordinates + linked HTML pins.
  const markers = [], hitTargets = [], upAxis = new THREE.Vector3(0, 1, 0);
  for (const [id, site] of Object.entries(ui.sites || {})) {
    if (site.lat == null || site.lon == null) continue;
    const normal = latLonVec(site.lat, site.lon, 1).normalize();
    const anchor = new THREE.Group();
    anchor.position.copy(normal).multiplyScalar(1.012);
    anchor.quaternion.setFromUnitVectors(upAxis, normal);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 6), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    anchor.add(ring);

    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfce8a6, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.11, 6), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.015;
    anchor.add(pulse);

    const coreMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b, flatShading: true });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), coreMat);
    core.position.y = 0.055;
    anchor.add(core);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.siteId = id;
    anchor.add(hit);
    hitTargets.push(hit);

    globe.add(anchor);
    const pin = box.querySelector(`[data-mars-pin="${id}"]`);
    markers.push({ id, site, anchor, ring, ringMat, pulse, pulseMat, core, coreMat, pin });
  }

  let rotY = -THREE.MathUtils.degToRad((ui.sites?.[ui.state.site]?.lon) ?? 77.4508);
  let rotX = THREE.MathUtils.degToRad(((ui.sites?.[ui.state.site]?.lat) ?? 18.4447));
  let targetY = null, targetX = null, holdUntil = 0, dragging = false, moved = false, hovered = false;
  let lastX = 0, lastY = 0;

  function focusSite(id) {
    const s = ui.sites?.[id];
    if (!s || s.lat == null || s.lon == null) return;
    const rawY = -THREE.MathUtils.degToRad(s.lon);
    const diff = Math.atan2(Math.sin(rawY - rotY), Math.cos(rawY - rotY));
    targetY = rotY + diff;
    targetX = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(s.lat), -0.85, 0.85);
    holdUntil = performance.now() + 2600;
  }
  window.addEventListener('astro:site', e => {
    if (e.detail?.focus) focusSite(e.detail.id);
    if (e.detail?.arrive && !reduce) camZ = baseZ * 1.55; // zoom-in arrival into Mars orbit
  });

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  box.addEventListener('pointerenter', () => { hovered = true; });
  box.addEventListener('pointerleave', () => { hovered = false; dragging = false; });
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    dragging = true; moved = false; targetY = null; targetX = null;
    lastX = e.clientX; lastY = e.clientY;
    box.setPointerCapture?.(e.pointerId);
  });
  box.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.hypot(dx, dy) > 4) moved = true;
    rotY += dx * 0.008;
    rotX = THREE.MathUtils.clamp(rotX + dy * 0.006, -0.9, 0.9);
    lastX = e.clientX; lastY = e.clientY;
    holdUntil = performance.now() + 2200;
  });
  box.addEventListener('pointerup', e => {
    const wasDrag = moved;
    dragging = false;
    if (wasDrag || e.target.closest('button')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    if (hits.length) {
      const id = hits[0].object.userData.siteId;
      if (id && !window.ASTRO_NET?.isGuest) ui.selectSite?.(id, true);
    }
  });

  const worldPos = new THREE.Vector3(), proj = new THREE.Vector3(), camDir = new THREE.Vector3();
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const stepEl = document.getElementById('lobby-step-site');
    if (!isActive('lobby') || !stepEl || stepEl.hidden || !view.width) return;

    camZ += (baseZ - camZ) * Math.min(1, dt * 6.5);
    camera.position.set(0, 0.12, camZ);
    camera.lookAt(0, 0, 0);

    if (targetY !== null && targetX !== null) {
      const k = Math.min(1, dt * 5.5);
      rotY += (targetY - rotY) * k;
      rotX += (targetX - rotX) * k;
      if (Math.abs(targetY - rotY) < 0.005 && Math.abs(targetX - rotX) < 0.005) { targetY = null; targetX = null; }
    } else if (!reduce && !dragging && !hovered && now > holdUntil) {
      rotY += dt * 0.22;
    }

    globe.rotation.set(rotX, rotY, 0);
    globe.updateMatrixWorld(true);
    const t = now / 1000;
    const selectedId = ui.state.site;

    for (const m of markers) {
      const isSel = m.id === selectedId;
      m.ringMat.color.setHex(isSel ? 0xf59e0b : 0xfce8a6);
      m.coreMat.color.setHex(isSel ? 0xf59e0b : 0xe04f26);
      m.pulse.visible = isSel;
      if (isSel && !reduce) {
        const p = 1 + 0.35 * Math.sin(t * 3.8);
        m.pulse.scale.setScalar(p);
        m.pulseMat.opacity = 0.7 - 0.35 * Math.sin(t * 3.8);
        m.core.rotation.y = t * 2.2;
      }
      if (m.pin) {
        m.anchor.getWorldPosition(worldPos);
        camDir.copy(camera.position).sub(worldPos).normalize();
        const front = worldPos.clone().normalize().dot(camDir);
        proj.copy(worldPos).project(camera);
        const x = (proj.x + 1) * 0.5 * view.width;
        const y = (1 - proj.y) * 0.5 * view.height;
        m.pin.style.left = `${x}px`;
        m.pin.style.top = `${y - 18}px`;
        m.pin.classList.toggle('back-side', front < 0.05);
        m.pin.style.zIndex = front < 0.05 ? '1' : '3';
      }
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})().catch(err => console.warn('Mars globe not shown:', err));

// Planner: the rocket the crew is building. Hull modules carry Attach_* nodes (the mounting points);
// engines hang from Attach_Engines in the real cluster pattern, the tank stands on Attach_Tank,
// one equipment module stands on each stage's Attach_Bay and up to 4 cabin modules sit on the cabin deck.
// Empty mounting points glow amber and can be clicked; "+" buttons in the gaps insert a stage.
(async () => {
  const blueprint = document.querySelector('.blueprint'), ui = window.ASTRO;
  if (!ui) return;
  const HULL = { booster: 'parts/structures/booster-thrust-section.glb', stage: 'parts/structures/stage-module.glb', cabin: 'parts/structures/crew-cabin.glb' };
  // Two versions of each hull: open here (the front half, node `Closed`, hidden so the bay shows) and closed
  // for outside views (launch pad), where the equipment is stowed inside and not loaded.
  const hullOf = async (file, closed) => {
    const h = await loadGLB(file);
    for (const n of ['Closed', 'Stowed_Front']) { const o = h.getObjectByName(n); if (o) o.visible = closed; }
    return h;
  };
  const CABIN_SLOTS = [[-.28, .24], [.28, .24], [-.28, .80], [.28, .80]]; // x, y on the enlarged cabin decks
  const GAP = .36, TANK_CAP = 3.2;
  const padMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: .8, depthWrite: false });
  const lineMat = new THREE.LineBasicMaterial({ color: 0xfce8a6 }), selMat = new THREE.LineBasicMaterial({ color: 0xf59e0b });
  const polygon = (r, n, mat) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, (_, k) => new THREE.Vector3(r * Math.cos(k * 2 * Math.PI / n), 0, r * Math.sin(k * 2 * Math.PI / n)))), mat);
  function mountPoint(r, info) {
    const g = new THREE.Group(), pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .014, 6), padMat);
    pad.userData.mount = info; g.add(pad, polygon(r * 1.4, 6, lineMat));
    g.userData.pulse = true;
    return g;
  }
  const attach = (hull, name, fallback) => hull.getObjectByName(name)?.position.y ?? fallback;
  const fitWidth = (obj, width) => { const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); obj.scale.setScalar(width / Math.max(s.x, s.z)); };
  const ring = (n, r, off = 0) => Array.from({ length: n }, (_, k) => [r * Math.cos(off + k * 2 * Math.PI / n), r * Math.sin(off + k * 2 * Math.PI / n)]);
  // Engine positions (x, z) and engine width inside the Ø 0.96 thrust plate, by cluster size (specs.defaultClusterCount).
  function cluster(n) {
    if (n === 1) return { w: .5, at: [[0, 0]] };
    if (n === 3) return { w: .32, at: ring(3, .22, Math.PI / 2) };
    if (n === 4) return { w: .3, at: ring(4, .22, Math.PI / 4) };
    if (n === 9) return { w: .22, at: [[0, 0], ...ring(8, .32)] };
    if (n === 33) return { w: .11, at: [...ring(3, .08), ...ring(10, .22), ...ring(20, .4)] };
    return { w: .8 / Math.sqrt(n), at: ring(n, .3) };
  }
  // Long tanks are squeezed so the whole stack fits the view (soft cap on the scaled height).
  const softCap = h => TANK_CAP * (1 - Math.exp(-h / TANK_CAP));

  async function booster(r, parts, module = 'booster') {
    const g = new THREE.Group(), hull = await loadGLB(HULL.booster);
    g.userData.module = module; g.add(hull);
    // Fins (Main Booster only) share the thrust section's origin: they bolt straight onto the skirt.
    if (module === 'booster' && r.booster.fins && parts[r.booster.fins]?.file) g.add(await loadGLB(parts[r.booster.fins].file));
    const engineY = attach(hull, 'Attach_Engines', 0), tankY = attach(hull, 'Attach_Tank', .5);
    let top = tankY;
    if (r.booster.engine && parts[r.booster.engine]?.file) {
      const { w, at } = cluster(parts[r.booster.engine].specs?.defaultClusterCount || 1);
      for (const [x, z] of at) { const e = await loadGLB(parts[r.booster.engine].file); fitWidth(e, w); e.position.set(x, engineY, z); g.add(e); }
    } else { const m = mountPoint(.24, { module, tab: 'engine' }); m.position.y = engineY - .03; g.add(m); }
    if (r.booster.tank && parts[r.booster.tank]?.file) {
      const t = await loadGLB(parts[r.booster.tank].file), size = new THREE.Box3().setFromObject(t).getSize(new THREE.Vector3());
      const s = .96 / Math.max(size.x, size.z), h = size.y * s, capped = softCap(h);
      t.scale.set(s, s * capped / h, s); t.position.y = tankY; g.add(t);
      top = tankY + capped;
    } else { const m = mountPoint(.32, { module, tab: 'tank' }); m.position.y = tankY + .02; g.add(m); }
    g.userData.top = top;
    return g;
  }
  async function stage(r, i, parts, closed = false) {
    if (r.stages[i].type === 'booster') return booster({ booster: r.stages[i] }, parts, `stage-${i}`);
    const g = new THREE.Group(), hull = await hullOf(HULL.stage, closed), key = `stage-${i}`, item = r.stages[i].item;
    g.userData.module = key; g.add(hull);
    const bay = attach(hull, 'Attach_Bay', .1);
    if (closed) { /* equipment stowed inside the closed bay */ }
    else if (item && parts[item]?.file) { const e = await loadGLB(parts[item].file); e.position.y = bay; g.add(e); }
    else { const m = mountPoint(.16, { module: key }); m.position.y = bay + .01; g.add(m); }
    g.userData.top = attach(hull, 'Attach_Top', 1);
    return g;
  }
  async function cabin(r, parts, closed = false) {
    const g = new THREE.Group();
    g.userData.module = 'cabin'; g.add(await hullOf(HULL.cabin, closed));
    for (let k = 0; k < (closed ? 0 : CABIN_SLOTS.length); k++) {
      const [x, y] = CABIN_SLOTS[k], id = r.cabin[k];
      if (id && parts[id]?.file) { const e = await loadGLB(parts[id].file); e.scale.setScalar(.58); e.position.set(x, y, 0); g.add(e); }
      else { const m = mountPoint(.09, { module: 'cabin' }); m.position.set(x, y + .01, 0); g.add(m); }
    }
    g.userData.top = new THREE.Box3().setFromObject(g).max.y;
    return g;
  }

  // Launch pad (web/launch.js) and other outside views: the same assembly, closed, stacked without gaps,
  // mounting points or selection rings. Exposed even if the planner's own WebGL view cannot initialize.
  window.ASTRO_BUILD_ROCKET = async () => {
    const data = ui.data(), parts = data?.parts || {}, r = ui.state.rocket;
    const groups = await Promise.all([booster(r, parts), ...r.stages.map((_, i) => stage(r, i, parts, true)), cabin(r, parts, true)]);
    const rocket = new THREE.Group();
    let y = 0;
    for (const g of groups) {
      g.traverse(o => { if (o.userData.pulse) o.visible = false; });
      g.position.y = y; rocket.add(g); y += g.userData.top;
    }
    const cab = groups[groups.length - 1], mark = cab.getObjectByName('View_Window') ?? new THREE.Object3D(); // the pilot's windows
    if (!mark.parent) { mark.position.y = cab.userData.top / 2; cab.add(mark); }
    rocket.updateMatrixWorld(true);
    const minY = new THREE.Box3().setFromObject(rocket).min.y;
    rocket.userData = { height: y, minY, cabin: mark, cabinMid: cab.position.y + cab.userData.top / 2 };
    return rocket;
  };

  const view = blueprint && makeView(blueprint, { fov: 26 });
  if (!view) return;
  blueprint.classList.add('is-3d');
  const { scene, camera, renderer } = view, overlay = blueprint.querySelector('#stack-overlay');
  const leadersSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leadersSvg.setAttribute('class', 'stack-leaders');
  leadersSvg.setAttribute('aria-hidden', 'true');
  blueprint.appendChild(leadersSvg);
  const stack = new THREE.Group(); scene.add(stack);

  let key = '', build = 0, layout = [], gaps = [], focusKey = null;
  const center = new THREE.Vector3();
  const cameraCenter = new THREE.Vector3();
  let distance = 10, cameraDistance = 10;
  const zoomButton = document.getElementById('rocket-overview');
  const navigation = document.getElementById('rocket-navigation');
  const upButton = document.getElementById('rocket-up'), downButton = document.getElementById('rocket-down');
  const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
  function updateZoomControls() {
    const index = layout.findIndex(item => item.key === focusKey);
    const zoomed = focusKey !== null;
    zoomButton.textContent = zoomed ? t('planner.zoomOut') : t('planner.zoomIn');
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    navigation.hidden = !zoomed;
    upButton.disabled = index < 0 || index >= layout.length - 1;
    downButton.disabled = index <= 0;
  }
  window.addEventListener('astro:settings', updateZoomControls);
  window.addEventListener('astro:focus-module', e => { focusKey = e.detail; updateZoomControls(); });
  window.addEventListener('astro:stage-removed', e => { if (focusKey !== null) focusKey = e.detail; updateZoomControls(); });
  zoomButton.addEventListener('click', () => { focusKey = focusKey === null ? ui.selectedKey() : null; updateZoomControls(); });
  function moveFocus(delta) {
    const index = layout.findIndex(item => item.key === focusKey);
    const next = layout[index + delta];
    if (next) ui.select(next.key);
  }
  upButton.addEventListener('click', () => moveFocus(1));
  downButton.addEventListener('click', () => moveFocus(-1));
  async function rebuild() {
    const data = ui.data();
    if (!data) return;
    const r = ui.state.rocket, selected = ui.selectedKey(), next = JSON.stringify([r, selected]);
    if (next === key) return;
    key = next;
    const id = ++build;
    const groups = await Promise.all([booster(r, data.parts), ...r.stages.map((_, i) => stage(r, i, data.parts)), cabin(r, data.parts)]);
    if (id !== build) return;
    stack.clear(); layout = []; gaps = [];
    let y = 0;
    groups.forEach((g, i) => {
      if (i > 0) { gaps.push({ insert: i - 1, y: y + GAP / 2 }); y += GAP; }
      g.position.y = y; stack.add(g);
      const top = g.userData.top;
      layout.push({ key: g.userData.module, mid: y + top / 2, height: top });
      if (g.userData.module === selected) { const ringR = g.userData.module === 'cabin' ? .86 : .66; [0, top].forEach(h => { const p = polygon(ringR, 12, selMat); p.position.y = y + h; stack.add(p); }); }
      y += top;
    });
    const box = new THREE.Box3().setFromObject(stack), size = box.getSize(new THREE.Vector3());
    box.getCenter(center);
    distance = (size.y * .66) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    center.y -= size.y * .02; // room for the label above and the tags below
    if (focusKey !== null && !layout.some(item => item.key === focusKey)) focusKey = ui.selectedKey();
    updateZoomControls();
  }
  window.addEventListener('astro:rocket', rebuild);
  rebuild();

  // Clicks: a mounting point selects its module and catalog tab; anything else selects its module.
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    for (const hit of ray.intersectObjects(stack.children, true)) {
      if (hit.object.userData.mount) return hit.object.userData.mount;
      let o = hit.object; while (o && !o.userData.module) o = o.parent;
      if (o) return { module: o.userData.module };
    }
    return null;
  }
  renderer.domElement.addEventListener('click', e => { const hit = pick(e); if (hit) ui.select(hit.module, hit.tab); });
  renderer.domElement.addEventListener('pointermove', e => { renderer.domElement.style.cursor = pick(e) ? 'pointer' : ''; });

  const v = new THREE.Vector3();
  const toY = y => { v.set(0, y, 0).project(camera); return (1 - v.y) / 2 * view.height; };
  function frame(now) {
    requestAnimationFrame(frame);
    if (!isActive('planner') || !view.width || !layout.length) return;
    const t = reduce ? 0 : now / 1000;
    stack.rotation.y = Math.sin(t * .35) * .75; // swing, but keep the open side of the cutaways in view
    stack.traverse(o => { if (o.userData.pulse) o.scale.setScalar(1 + Math.sin(t * 4) * .12); });
    const focused = layout.find(item => item.key === focusKey);
    const targetCenter = focused ? new THREE.Vector3(0, focused.mid, 0) : center;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const targetDistance = focused ? Math.min(distance, Math.max(focused.height * .8, 1.2 / Math.min(camera.aspect, 1)) / Math.tan(halfFov)) : distance;
    const blend = reduce ? 1 : .12;
    cameraCenter.lerp(targetCenter, blend);
    cameraDistance += (targetDistance - cameraDistance) * blend;
    camera.position.set(0, cameraCenter.y + cameraDistance * .2, cameraDistance);
    camera.lookAt(cameraCenter);
    // Labels sit beside their module; "+" buttons sit in the gaps on the rocket axis.
    v.set(0, 0, 0).project(camera);
    const axisX = (v.x + 1) / 2 * view.width;
    let leaderMarkup = '';
    for (const { key: k, mid } of layout) {
      const el = overlay.querySelector(`[data-module="${k}"]`);
      if (!el) continue;
      const hidden = focused && k !== focusKey;
      el.style.display = hidden ? 'none' : '';
      const midY = toY(mid);
      const topPx = Math.max(52, Math.min(view.height - 96, midY - el.offsetHeight / 2));
      el.style.top = topPx + 'px';
      el.classList.add('placed');
      if (!hidden && el.offsetWidth > 0) {
        const elMidY = topPx + el.offsetHeight / 2;
        const onLeft = (el.offsetLeft + el.offsetWidth / 2) < axisX;
        const x1 = onLeft ? (el.offsetLeft + el.offsetWidth) : el.offsetLeft;
        const x2 = axisX + (onLeft ? -14 : 14);
        const sel = el.classList.contains('selected') || el.getAttribute('aria-pressed') === 'true';
        const cls = sel ? 'leader-line is-selected' : 'leader-line';
        if ((onLeft && x2 > x1 + 6) || (!onLeft && x1 > x2 + 6)) {
          leaderMarkup += `<line class="${cls}" x1="${x1.toFixed(1)}" y1="${elMidY.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${midY.toFixed(1)}"/><circle class="${cls}" cx="${x2.toFixed(1)}" cy="${midY.toFixed(1)}" r="2.6"/>`;
        }
      }
    }
    leadersSvg.innerHTML = leaderMarkup;
    for (const { insert, y } of gaps) {
      const el = overlay.querySelector(`[data-insert="${insert}"]`);
      if (!el) continue;
      const screenY = toY(y);
      el.style.display = screenY >= 30 && screenY <= view.height - 30 ? '' : 'none';
      el.style.left = axisX + 'px'; el.style.top = screenY + 'px';
      el.classList.add('placed');
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // The orbital camera follows the same alignment values and transfer progress as the controls.
  (() => {
    const host = document.getElementById('orbital-dock-scene');
    if (!host) return;
    document.body.append(host);
    let view, earth, ship, tanker, collar, plume, jets = [], state, wasActive = false, unavailable = false;
    let captureAt = 0, departureAt = 0, pulseUntil = 0, lastInput = '';
    const orbitEye = new THREE.Vector3(0, 1.2, 10.5), orbitLook = new THREE.Vector3(0, .15, 0);
    const cabinFocus = new THREE.Vector3(), cabinEye = new THREE.Vector3(), cameraLook = new THREE.Vector3();
    const shipTarget = new THREE.Vector3();
    let lastFrame = 0;
    const pilotView = () => {
      const net = window.ASTRO_NET;
      return !net || net.mode === 'solo' || net.seat === 'helena';
    };
    const mat = (color, metalness = .2) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .68, metalness });
    const hull = mat(0xd9e3e1), shadow = mat(0x25394b), foil = mat(0xd7aa54), steel = mat(0x81929e, .65);
    const glow = color => new THREE.MeshBasicMaterial({ color });
    function piece(group, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); group.add(mesh);
      return mesh;
    }
    function makeTanker() {
      const g = new THREE.Group();
      // Two insulated cryogenic tanks, a service spine, radiators, and a forward capture collar.
      piece(g, new THREE.CylinderGeometry(.45, .45, 2.65, 10), hull, 0, 0, 0, 0, 0, Math.PI / 2);
      piece(g, new THREE.CylinderGeometry(.48, .48, 1.05, 10), foil, -.6, 0, 0, 0, 0, Math.PI / 2);
      piece(g, new THREE.CylinderGeometry(.49, .49, .13, 10), steel, 0, 0, 0, 0, 0, Math.PI / 2);
      piece(g, new THREE.CylinderGeometry(.49, .49, .13, 10), steel, -1.12, 0, 0, 0, 0, Math.PI / 2);
      piece(g, new THREE.BoxGeometry(2.6, .12, .16), shadow, -.05, -.48, 0);
      for (const s of [-1, 1]) {
        piece(g, new THREE.BoxGeometry(1.4, .04, .52), shadow, -.1, s * .83, 0, 0, 0, s * .1);
        piece(g, new THREE.BoxGeometry(.26, .15, .3), steel, -.9, s * .46, 0);
        piece(g, new THREE.OctahedronGeometry(.065, 0), glow(s > 0 ? 0x7edac2 : 0xe04f26), -.95, s * .53, .23);
      }
      piece(g, new THREE.CylinderGeometry(.32, .32, .16, 12), steel, 1.38, 0, 0, 0, 0, Math.PI / 2);
      piece(g, new THREE.TorusGeometry(.29, .045, 5, 12), hull, 1.49, 0, 0, 0, Math.PI / 2);
      collar = new THREE.Group(); collar.position.x = 1.55; g.add(collar);
      piece(collar, new THREE.TorusGeometry(.27, .025, 5, 12), foil, 0, 0, 0, 0, Math.PI / 2);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        piece(collar, new THREE.BoxGeometry(.12, .07, .07), steel, .04, Math.cos(a) * .27, Math.sin(a) * .27);
      }
      return g;
    }
    async function makeShip() {
      const built = await window.ASTRO_BUILD_ROCKET?.();
      if (!built) return null;
      // The main booster has separated before orbital operations.
      if (built.children.length > 1) built.children[0].visible = false;
      // The launch escape tower is gone by Earth orbit; expose the cabin's modeled docking collar.
      const cabinHull = built.children.at(-1);
      cabinHull?.traverse(o => {
        if (o.isMesh && o.position.y > 2.2) o.visible = false;
      });
      const box = new THREE.Box3().setFromObject(built), size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const model = new THREE.Group();
      built.position.sub(center);
      const body = new THREE.Group();
      body.scale.setScalar(4.8 / Math.max(size.y, .01));
      body.rotation.z = Math.PI / 2;
      body.add(built);
      model.add(body);
      body.updateMatrixWorld(true);
      const dockFace = new THREE.Box3().setFromObject(body);
      model.userData.dockX = 1.55 - 1.75 - dockFace.min.x;
      model.userData.cabinFocus = new THREE.Vector3(dockFace.min.x + .35, 0, 0);
      plume = piece(model, new THREE.ConeGeometry(.16, .65, 6), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .7 }), dockFace.max.x + .26, 0, 0, 0, 0, -Math.PI / 2);
      plume.visible = false;
      for (const s of [-1, 1]) {
        const jet = piece(model, new THREE.ConeGeometry(.05, .22, 5), new THREE.MeshBasicMaterial({ color: 0xa4e9ff, transparent: true, opacity: .75 }), .65, s * .2, 0, 0, 0, s * Math.PI / 2);
        jet.visible = false; jets.push(jet);
      }
      return model;
    }
    function stars(scene) {
      const positions = [];
      let seed = 73;
      const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 120; i++) positions.push((rand() - .5) * 24, (rand() - .5) * 12, -11 - rand() * 6);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfce8a6, size: .045 })));
    }
    async function start() {
      if (view) return;
      view = makeView(host, { fov: 38 });
      if (!view) {
        unavailable = true;
        return;
      }
      view.renderer.domElement.classList.add('orbital-dock-canvas');
      stars(view.scene);
      tanker = makeTanker(); tanker.position.set(-1.75, .35, 0); view.scene.add(tanker);
      ship = await makeShip();
      if (ship) view.scene.add(ship);
      if (ship) host.classList.add('has-docking-model');
      const model = await loadGLB('bodies/earth.glb');
      const box = new THREE.Box3().setFromObject(model), scale = 12 / Math.max(box.getSize(new THREE.Vector3()).y / 2, .01);
      model.scale.setScalar(scale); model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(scale));
      earth = new THREE.Group(); earth.add(model); earth.position.set(0, -13.6, -5.5); view.scene.add(earth);
      view.camera.position.set(0, 1.2, 10.5); view.camera.lookAt(0, .15, 0);
      requestAnimationFrame(frame);
    }
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (!view || host.hidden || !isActive('cockpit') || !ship || !state) return;
      const g = state.docking;
      const refuel = state.cutscene?.kind === 'refuel' ? state.cutscene : null;
      const emergencyApproach = state.orbitalEmergency;
      const manual = !refuel && emergencyApproach?.stage === 'control' ? state.portDock : null;
      const progress = state.docked ? 1 : refuel
        ? THREE.MathUtils.smoothstep(refuel.t, 0, refuel.approach || 1)
        : THREE.MathUtils.smoothstep(emergencyApproach?.stage === 'approach' ? emergencyApproach.elapsed : 2.4, 0, 4);
      if (state.docked && !captureAt) captureAt = now;
      if (!state.docked) captureAt = 0;
      const capture = captureAt ? Math.min(1, (now - captureAt) / 1100) : 0;
      const soft = Math.min(1, capture * 2), hard = Math.max(0, capture * 2 - 1);
      const approachGap = 1.75 * (1 - THREE.MathUtils.smoothstep(2.4, 0, 4));
      const gap = manual ? approachGap * (1 - state.progress / 65) : 1.75 * (1 - progress);
      const relative = state.docked ? .05 * (1 - soft) : gap;
      shipTarget.set(ship.userData.dockX + relative + (state.docked ? .04 * Math.sin(soft * Math.PI) : 0),
        .35 + (state.docked ? 0 : manual ? manual.y * .3 : (g?.value?.[0] || 0) * .075),
        state.docked ? 0 : manual ? manual.x * .3 : (g?.value?.[1] || 0) * .075);
      if (manual && !reduce) ship.position.lerp(shipTarget, 1 - Math.exp(-14 * dt));
      else ship.position.copy(shipTarget);
      ship.rotation.y = state.docked ? 0 : (g?.value?.[1] || 0) * .018;
      ship.rotation.z = state.docked ? 0 : (g?.value?.[0] || 0) * .012;
      collar.position.x = 1.55 - .09 * soft + .09 * hard;
      const input = state.input || {};
      const activeInput = [input.up, input.down, input.left, input.right].some(Boolean);
      const inputKey = JSON.stringify(input);
      if (activeInput && inputKey !== lastInput) pulseUntil = now + 130;
      lastInput = inputKey;
      jets.forEach((jet, i) => { jet.visible = !reduce && now < pulseUntil && (i ? input.down || input.right : input.up || input.left); });
      if (plume) plume.visible = departureAt > 0 && now - departureAt < 1500 && !reduce;
      if (departureAt) {
        const away = Math.min(3, (now - departureAt) / 700);
        ship.position.x += away;
        tanker.position.x = -1.75 - away * .15;
      }
      if (earth && !reduce) earth.rotation.y += .00005;
      const emergency = state.orbitalEmergency;
      const progressToCabin = !reduce && pilotView() && emergency?.stage === 'zoom'
        ? THREE.MathUtils.smoothstep(emergency.elapsed, 0, 1.65) : 0;
      cabinFocus.copy(ship.userData.cabinFocus);
      ship.localToWorld(cabinFocus);
      cabinEye.copy(cabinFocus).addScaledVector(orbitEye, .065);
      view.camera.position.lerpVectors(orbitEye, cabinEye, progressToCabin);
      view.camera.lookAt(cameraLook.lerpVectors(orbitLook, cabinFocus, progressToCabin));
      view.renderer.render(view.scene, view.camera);
    }
    window.addEventListener('astro:cockpit', e => {
      state = e.detail;
      const emergency = state?.orbitalEmergency;
      const refuel = state?.cutscene?.kind === 'refuel';
      const manualIntro = !state?.cutscene && ['approach', 'warning', 'zoom'].includes(emergency?.stage);
      const spectator = !pilotView();
      const manualSpectating = spectator && !state?.cutscene && emergency?.stage === 'control';
      const active = !!(state?.active && state.step === 2 && (refuel || manualIntro || manualSpectating));
      const stage = document.getElementById('mars-cutscene-stage');
      const parent = refuel && active && stage ? stage : document.body;
      if (host.parentElement !== parent) parent.append(host);
      host.classList.toggle('in-refuel-cutscene', !!refuel);
      host.hidden = !active;
      if (unavailable) document.getElementById('docking-monitor')?.toggleAttribute('hidden', emergency?.stage !== 'control');
      host.classList.toggle('is-zooming', !spectator && emergency?.stage === 'zoom');
      const warning = document.getElementById('orbital-emergency');
      if (warning) warning.hidden = !active || spectator || !manualIntro || emergency.stage === 'approach';
      const message = document.getElementById('orbital-emergency-message');
      if (message && active && emergency?.stage === 'warning') {
        const key = emergency.reason === 'shortfall' ? 'cockpit.emergency.shortfall' : 'cockpit.emergency.highDemand';
        const full = Array.from(window.ASTRO_I18N?.t(key) ?? '').slice(0, 80);
        if (warning?.getAttribute('aria-label') !== full.join('')) warning?.setAttribute('aria-label', full.join(''));
        message.textContent = full.slice(0, reduce ? full.length : Math.floor((emergency.elapsed || 0) * 38)).join('');
      }
      if (active && !wasActive && !unavailable) { captureAt = 0; departureAt = 0; tanker && (tanker.position.x = -1.75); void start(); }
      wasActive = active;
      const label = document.getElementById('orbital-dock-status');
      if (label) label.hidden = !!refuel || (!spectator && ['warning', 'zoom'].includes(emergency?.stage));
      if (label && active) label.textContent = window.ASTRO_I18N?.t(
        state.docked ? (state.refuelDone > 0 ? (state.design?.refuelTank ? 'cockpit.orbitalTransferTank' : 'cockpit.orbitalTransfer') : 'cockpit.orbitalCapture') : 'cockpit.orbitalApproach',
        { pct: Math.round(state.docked ? state.refuelDone : state.progress || 0), tank: state.design?.refuelTank || '' }
      ) ?? '';
    });
    window.addEventListener('astro:orbital-departure', () => { departureAt = performance.now(); });
  })();

  // Flight 3D cutscenes: ethereal low-poly nebula + dense starfield backdrop, shared by:
  // - 'refuel': low-poly Earth GLB (bodies/earth.glb) rising on the bottom horizon
  // - 'mars': faceted Mars and its two moons on the right, closed custom spacecraft on the left
  (() => {
    const host = document.getElementById('mars-cutscene-stage');
    if (!host) return;
    let mView = null, mActive = false, mKind = 'mars', mStart = 0, mDur = 15, mRaf = 0;
    let marsMesh = null, marsSystem = null, moonOrbits = [], earthGrp = null, upperGrp = null, lowerGrp = null, nebulaGrp = null;
    let signalRings = [], starLayers = [], sparkles = [];
    const camRefuel = new THREE.Vector3(0, 0.35, 9.2);
    const lookRefuel = new THREE.Vector3(0, -0.45, -2.5);
    const camStart = new THREE.Vector3(0, 0.85, 11);
    const lookStart = new THREE.Vector3(0.25, -0.25, -2);
    const camEnd = new THREE.Vector3(-0.55, 0.95, 8);
    const lookEnd = new THREE.Vector3(0.05, 0.2, -2);
    const curCam = new THREE.Vector3(), curLook = new THREE.Vector3();

    function buildEtherealSpace(scene) {
      // Multi-layered dense starfield with varied cosmic colors (cream, cyan, gold, lavender)
      const makeStars = (count, palette, size, rMin, rMax, seed, opacity = 0.92) => {
        let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const pos = new Float32Array(count * 3), cols = new Float32Array(count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < count; i++) {
          const a = rnd() * Math.PI * 2, u = rnd() * 2 - 1, r = rMin + rnd() * (rMax - rMin), k = Math.sqrt(1 - u * u);
          pos[i * 3] = r * k * Math.cos(a);
          pos[i * 3 + 1] = r * u;
          pos[i * 3 + 2] = r * k * Math.sin(a) - 12;
          c.set(palette[Math.floor(rnd() * palette.length)]);
          cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        return new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size, transparent: true, opacity, depthWrite: false }));
      };
      const layer1 = makeStars(1600, ['#ffffff', '#fce8a6', '#a8d4ff', '#d8b8ff'], 0.11, 36, 86, 41, 0.85);
      const layer2 = makeStars(750, ['#ffe49e', '#7fd8ff', '#f3c6ff', '#ffffff'], 0.2, 30, 72, 97, 0.95);
      const layer3 = makeStars(220, ['#fff6d6', '#67d4ff', '#ffbe76'], 0.3, 28, 60, 173, 0.95);
      starLayers = [layer1, layer2, layer3];
      scene.add(layer1, layer2, layer3);

      // Ethereal low-poly faceted nebula / galaxy clouds (radial ellipses with soft edge falloff, no hard rectangles)
      nebulaGrp = new THREE.Group();
      const nebSpecs = [
        [15, 5.2, '#2b1e7a', 0.24, -2, 2.5, -24, 0.42],
        [12, 3.8, '#6c3cff', 0.20, 0.5, 1.8, -22, 0.44],
        [8.5, 2.5, '#c96bff', 0.16, 1.2, 2.1, -20.5, 0.46],
        [10, 3.2, '#1fa2ff', 0.14, -3.5, 0.2, -23, 0.38],
        [6.0, 1.8, '#ffd2f4', 0.14, 1.5, 2.2, -19.5, 0.45],
      ];
      nebSpecs.forEach(([rx, ry, col, op, x, y, z, rz], idx) => {
        const geo = new THREE.CircleGeometry(1, 20).toNonIndexed();
        const p = geo.attributes.position, cols = [];
        let s = 31 + idx * 17; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const base = new THREE.Color(col), c = new THREE.Color();
        for (let i = 0; i < p.count; i += 3) {
          const mx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
          const my = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
          const falloff = Math.max(0, 1 - Math.hypot(mx, my));
          c.copy(base).multiplyScalar(falloff * falloff * (0.75 + rnd() * 0.5));
          for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          vertexColors: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        }));
        mesh.scale.set(rx, ry, 1);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rz;
        nebulaGrp.add(mesh);
      });

      // Bright 4-point diamond sparkle stars scattered along the nebula
      sparkles = [];
      let ss = 211; const srnd = () => (ss = (ss * 16807) % 2147483647) / 2147483647;
      const spGeo = new THREE.OctahedronGeometry(0.16, 0);
      for (let i = 0; i < 28; i++) {
        const sp = new THREE.Mesh(spGeo, new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0x9ee8ff : i % 3 === 1 ? 0xfff3c4 : 0xe5b8ff,
          transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.position.set((srnd() - 0.5) * 28, (srnd() - 0.5) * 14, -18 - srnd() * 12);
        sp.scale.set(0.35, 1.35, 0.35);
        sp.userData.phase = srnd() * Math.PI * 2;
        nebulaGrp.add(sp);
        sparkles.push(sp);
      }
      scene.add(nebulaGrp);
    }

    function buildMars(scene) {
      // Huge faceted Mars with polar caps and warm atmospheric rim
      const ramp = window.ASTRO_ART?.PLANETS?.mars?.ramp || ['#6d2c1b', '#8e3a22', '#b84b28', '#d96638', '#eb8854'];
      const geo = new THREE.IcosahedronGeometry(2.9, 3);
      const p = geo.attributes.position, cols = [];
      let s = 19; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const c = new THREE.Color(), tri = new THREE.Vector3(), tmp = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) {
        tri.set(0, 0, 0);
        for (let k = 0; k < 3; k++) tri.add(tmp.fromBufferAttribute(p, i + k));
        tri.normalize();
        const isPole = Math.abs(tri.y) > 0.87;
        c.set(isPole ? '#efe6db' : ramp[Math.min(ramp.length - 1, Math.floor(rnd() * ramp.length))]);
        for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      marsMesh = new THREE.Group();
      marsMesh.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
      marsMesh.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.07, 2),
        new THREE.MeshBasicMaterial({ color: 0xe04f26, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
      ));
      marsMesh.rotation.z = THREE.MathUtils.degToRad(25.2);
      marsSystem = new THREE.Group();
      marsSystem.position.set(4.0, -0.75, -6.5);
      marsSystem.add(marsMesh);
      // Cinematic spacing is compressed so both orbits fit the frame. Phobos is larger,
      // closer and moves roughly four times faster than Deimos (NASA Mars Moons: Facts).
      const orbitTiltZ = THREE.MathUtils.degToRad(-12);
      const cosZ = Math.cos(orbitTiltZ), sinZ = Math.sin(orbitTiltZ);
      const moonPos = (r, a) => {
        const lx = r * Math.cos(a), ly = r * .24 * Math.sin(a), lz = r * .97 * Math.sin(a);
        return new THREE.Vector3(lx * cosZ - ly * sinZ, lx * sinZ + ly * cosZ, lz);
      };
      moonOrbits = [
        { radius: 3.65, size: .2, phase: 2.1, speed: .12, color: 0x968c84 },
        { radius: 4.65, size: .13, phase: 5.3, speed: .03, color: 0xb6aaa0 },
      ].map(spec => {
        const points = Array.from({ length: 97 }, (_, i) => moonPos(spec.radius, i * Math.PI * 2 / 96));
        const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.slice(0, -1)),
          new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: .24, gapSize: .16, transparent: true, opacity: .82 }));
        orbit.computeLineDistances();
        const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.size, 1),
          new THREE.MeshLambertMaterial({ color: spec.color, flatShading: true }));
        marsSystem.add(orbit, moon);
        return { ...spec, moon, posAt: a => moonPos(spec.radius, a) };
      });
      scene.add(marsSystem);
    }

    async function ensureEarth(scene) {
      if (earthGrp) return earthGrp;
      earthGrp = new THREE.Group();
      const model = await loadGLB('bodies/earth.glb');
      const box = new THREE.Box3().setFromObject(model);
      const radius = Math.max(0.001, box.getSize(new THREE.Vector3()).y / 2);
      const targetR = 16.5; // large radius so only the sweeping horizon curve spans the full bottom edge
      model.scale.setScalar(targetR / radius);
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(targetR / radius));
      earthGrp.add(model);
      // Crisp glowing cyan-blue atmospheric limb hugging the horizon
      earthGrp.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(targetR * 1.032, 3),
        new THREE.MeshBasicMaterial({ color: 0x45caff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
      ));
      earthGrp.position.set(0, -17.4, -5.2);
      earthGrp.rotation.set(0.28, -1.15, THREE.MathUtils.degToRad(14));
      scene.add(earthGrp);
      return earthGrp;
    }

    async function populateRocket(scene) {
      if (upperGrp) { scene.remove(upperGrp); upperGrp = null; }
      if (lowerGrp) { scene.remove(lowerGrp); lowerGrp = null; }
      signalRings = [];
      const data = ui.data();
      if (!data) return;
      const r = ui.state.rocket;
      const groups = await Promise.all([booster(r, data.parts), ...r.stages.map((_, i) => stage(r, i, data.parts, true)), cabin(r, data.parts, true)]);

      // Detached lower booster/stages vs upper spacecraft + cabin
      lowerGrp = new THREE.Group();
      upperGrp = new THREE.Group();
      const splitIdx = Math.max(1, groups.length - 1);
      let yLow = 0, yUp = 0;
      groups.forEach((g, i) => {
        const top = g.userData.top || 1;
        if (i < splitIdx) {
          g.position.y = yLow; lowerGrp.add(g); yLow += top + GAP * 0.4;
        } else {
          g.position.y = yUp; upperGrp.add(g); yUp += top + GAP * 0.4;
        }
      });

      const scale = 0.21;
      upperGrp.scale.setScalar(scale);
      upperGrp.position.set(-1.45, 0.62, 0.4);
      upperGrp.rotation.set(0.18, -0.55, -1.18);

      lowerGrp.scale.setScalar(scale * 0.92);
      lowerGrp.position.set(-3.1, 0.15, -0.35);
      lowerGrp.rotation.set(0.32, -0.35, -1.32);

      // Pulsing telemetry signal rings radiating from the detached upper module
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.16, 0.21, 24),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf2a900 : 0x1fa2ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        ring.position.set(0, yUp * 0.72, 0);
        ring.rotation.x = Math.PI / 2;
        ring.userData.phase = i / 4;
        upperGrp.add(ring);
        signalRings.push(ring);
      }
      scene.add(lowerGrp, upperGrp);
    }

    function tick(now) {
      if (!mActive || !mView) return;
      mRaf = requestAnimationFrame(tick);
      const elapsed = Math.max(0, (now - mStart) / 1000);
      const p = Math.min(1, elapsed / mDur);
      if (starLayers[0]) starLayers[0].rotation.y = elapsed * 0.005;
      if (starLayers[1]) starLayers[1].rotation.y = -elapsed * 0.008;
      if (starLayers[2]) starLayers[2].rotation.x = elapsed * 0.004;
      if (nebulaGrp) nebulaGrp.rotation.z = Math.sin(elapsed * 0.15) * 0.025;
      if (marsSystem?.visible) for (const orbit of moonOrbits) {
        const a = orbit.phase + (reduce ? 0 : elapsed * orbit.speed);
        orbit.moon.position.copy(orbit.posAt(a));
        orbit.moon.rotation.y = a;
      }
      for (const sp of sparkles) {
        const tw = 0.55 + 0.45 * Math.sin(elapsed * 2.6 + sp.userData.phase);
        sp.material.opacity = 0.35 + tw * 0.65;
        sp.scale.set(0.28 * tw + 0.12, 1.1 * tw + 0.35, 0.28 * tw + 0.12);
      }

      if (mKind === 'refuel') {
        if (earthGrp) earthGrp.rotation.y = -1.15 + elapsed * 0.035;
        mView.camera.position.copy(camRefuel);
        mView.camera.lookAt(lookRefuel);
      } else if (mKind === 'landing') {
        if (marsMesh) marsMesh.rotation.y = elapsed * 0.035;
        if (upperGrp) {
          upperGrp.position.set(-2.8 + p * 3.5, 1.6 - p * 2.1, 0.4);
          upperGrp.rotation.z = -1.18 * (1 - p);
          upperGrp.rotation.x = 0.18 * (1 - p);
        }
        mView.camera.position.copy(camStart);
        mView.camera.lookAt(lookStart);
      } else {
        if (marsMesh) marsMesh.rotation.y = elapsed * 0.09;
        if (upperGrp) {
          upperGrp.position.x = -1.65 + p * 0.32;
          upperGrp.position.y = 0.56 + Math.sin(elapsed * 1.4) * 0.04 + p * 0.08;
          upperGrp.rotation.x = 0.18 + Math.sin(elapsed * 0.9) * 0.05;
        }
        if (lowerGrp) {
          lowerGrp.position.x = -3.1 - p * 0.58;
          lowerGrp.position.y = 0.15 - p * 0.28;
          lowerGrp.rotation.z = -1.32 - elapsed * 0.18;
        }
        for (const ring of signalRings) {
          const ph = (ring.userData.phase + elapsed * 0.65) % 1;
          const sc = 1 + ph * 8.5;
          ring.scale.setScalar(sc);
          ring.position.y = (ring.userData.baseY ?? (ring.userData.baseY = ring.position.y)) + ph * 1.8;
          ring.material.opacity = (1 - ph) * 0.85;
        }
        // Smooth zoom-in toward the detached spacecraft in the final 42% of the cutscene
        const zRaw = Math.max(0, Math.min(1, (p - 0.58) / 0.42));
        const zEase = reduce ? 1 : zRaw * zRaw * (3 - 2 * zRaw);
        curCam.lerpVectors(camStart, camEnd, zEase);
        curLook.lerpVectors(lookStart, lookEnd, zEase);
        mView.camera.position.copy(curCam);
        mView.camera.lookAt(curLook);
      }
      mView.renderer.render(mView.scene, mView.camera);
    }

    window.addEventListener('astro:mars-cutscene', async e => {
      const active = !!e.detail?.active;
      if (!active) {
        mActive = false;
        cancelAnimationFrame(mRaf);
        return;
      }
      mKind = e.detail?.kind || 'mars';
      mDur = e.detail?.duration || 15;
      mActive = true;
      if (!mView) {
        mView = makeView(host, { fov: 34 });
        if (!mView) return;
        host.classList.add('is-3d');
        buildEtherealSpace(mView.scene);
        buildMars(mView.scene);
      }
      if (mKind === 'refuel') {
        await ensureEarth(mView.scene);
        if (earthGrp) earthGrp.visible = true;
        if (marsSystem) marsSystem.visible = false;
        if (upperGrp) upperGrp.visible = false;
        if (lowerGrp) lowerGrp.visible = false;
      } else {
        if (earthGrp) earthGrp.visible = false;
        if (marsSystem) marsSystem.visible = true;
        await populateRocket(mView.scene);
        if (upperGrp) upperGrp.visible = true;
        if (lowerGrp) lowerGrp.visible = mKind !== 'landing';
        if (mKind === 'landing') signalRings.forEach(ring => { ring.visible = false; });
      }
      if (!mActive) return;
      mStart = performance.now();
      cancelAnimationFrame(mRaf);
      mRaf = requestAnimationFrame(tick);
    });
  })();
})().catch(err => console.warn('3D rocket not shown:', err));

// Planner catalog: render each part's 3D GLB once into an offscreen studio view (cached in window.ASTRO_THUMBS),
// then dispose the temporary WebGL context so it never counts against the browser's active context limit.
(async () => {
  const thumbs = window.ASTRO_THUMBS;
  if (!thumbs) return;
  let renderer = null, scene = null, camera = null, holder = null, envTex = null;
  function ensureThumbStudio() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { renderer = null; return false; }
    renderer.setPixelRatio(1);
    renderer.setSize(144, 144, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    scene.add(new THREE.AmbientLight(0xb48cf0, 0.95));
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xfce8a6, 2.4); key.position.set(-4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xe04f26, 1.8); rim.position.set(5, 1, -4); scene.add(rim);
    holder = new THREE.Group();
    scene.add(holder);
    return true;
  }
  function releaseThumbStudio() {
    if (!renderer) return;
    envTex?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer = null; scene = null; camera = null; holder = null; envTex = null;
  }

  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
  async function renderPartThumb(p) {
    if (!ensureThumbStudio()) return null;
    const obj = await loadGLB(p.file);
    holder.clear();
    holder.rotation.set(0, 0, 0);
    box.setFromObject(obj);
    box.getSize(size);
    const maxXZ = Math.max(size.x, size.z, 0.01);
    if (p.category === 'tanks' && size.y > maxXZ * 2.2) {
      obj.scale.y *= (maxXZ * 2.2) / size.y;
      obj.updateMatrixWorld(true);
      box.setFromObject(obj);
    }
    box.getCenter(center);
    obj.position.sub(center);
    holder.add(obj);
    holder.rotation.set(0.24, -0.58, p.category === 'tanks' ? 0.32 : 0.06);
    holder.updateMatrixWorld(true);
    box.setFromObject(holder).getSize(size);
    const half = Math.max(size.x, size.y, 0.1) * 0.56;
    const dist = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + size.z * 0.55;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  let running = false, again = false;
  async function syncCatalogThumbs() {
    if (running) { again = true; return; }
    running = true;
    let renderedNew = false;
    try {
      do {
        again = false;
        const data = window.ASTRO?.data?.();
        if (!data) break;
        const slots = [...document.querySelectorAll('#parts-list [data-part-thumb]')];
        for (const slot of slots) {
          const id = slot.dataset.partThumb, p = data.parts?.[id];
          if (!p?.file) continue;
          let url = thumbs.get(id);
          if (!url) {
            url = await renderPartThumb(p);
            if (url) { thumbs.set(id, url); renderedNew = true; }
          }
          if (url) {
            document.querySelectorAll(`#parts-list [data-part-thumb="${CSS.escape(id)}"]`).forEach(el => {
              if (!el.querySelector('img')) el.innerHTML = `<img src="${url}" alt="">`;
            });
          }
        }
      } while (again);
    } finally {
      if (renderedNew) releaseThumbStudio();
      running = false;
    }
  }
  window.addEventListener('astro:catalog', syncCatalogThumbs);
  syncCatalogThumbs();
})().catch(err => console.warn('Catalog 3D thumbnails disabled:', err));
// Surface: the landing site in 3D. The ground is the real HiRISE terrain of the chosen site
// (assets/terrain, built by tools/terrain; index.terrain.<site>.js when opened from disk).
// First-person walk with the crew member's own suit in view when looking down (V: chase camera).
// One block per crew member marks a surface experiment (window.ASTRO_SIM.surf.tasks) at a random spot;
// its owner walks there and runs the minigame (placeholder for now). The rules (launch window timer,
// boarding, results) live in ASTRO_SIM; this module moves the crew and reports back.
(() => {
  const root = document.getElementById('surface'), ui = window.ASTRO, sim = () => window.ASTRO_SIM;
  if (!root || !ui) return;
  const t = (key, opts) => window.ASTRO_I18N?.t(key, opts) ?? key;
  const U = window.ASTRO_UNITS || { distanceM: (m, d = 0) => `${d > 0 ? Number(m).toFixed(d) : Math.round(m)} m` };
  const $s = id => document.getElementById(id);
  const viewEl = $s('surface-view'), startEl = $s('surface-start'), promptEl = $s('surface-prompt'), dlg = $s('minigame-dialog');
  const MARS_G = 3.71; // m/s², Mars surface gravity (same value as tools/modeling/lib/fx-presets.mjs)
  // game-balance: walk/run speed (m/s), jump speed, reach to a block or the lander, and where the blocks
  // land (close enough to visit all four within the launch window).
  // Radiation dose from the solar storm (web/app.js, docs/rocket-consequences.md): that crew member moves slower.
  const DOSE_SPEED = 0.7; // game-balance: share of the normal walking and running speed
  const doseOf = id => (window.ASTRO?.state.run?.consequences?.irradiated === id ? DOSE_SPEED : 1);
  const WALK = 2.2, RUN = 4.6, JUMP = 2.6, REACH = 3.2, BOARD_REACH = 5, BOARD_SAFE_R = 6.5, SPOT_MIN = 20, SPOT_MAX = 75, SPOT_GAP = 28;
  // Where each crew member stands after touchdown (m, south of the lander) and where NPCs rush to board in the final 10 s.
  const CREW_START = { helena: [-5.4, 6.6], lucas: [-1.8, 7.5], oscar: [2.1, 7.5], maya: [5.7, 6.3] };
  const CREW_BOARD = { helena: [-1.8, 2.8], lucas: [-0.7, 3.2], oscar: [0.7, 3.2], maya: [1.8, 2.8] };
  const STRIDE = 1.33; // m/s that matches walk_loop (1.1 s cycle, two ~0.73 m steps)
  // game: the photo is a grayscale stretch; this gain on the manifest tint makes it read as warm Mars ground under the game lights.
  const GROUND_GAIN = [3, 2, 1.25];
  // game: haze. With a horizon ring (manifest `horizon`), exp² by distance from the eye: clear for the first ~10 km,
  // HAZE_AT_EDGE at the ring's far edge so it melts into the sky; without one, a short fog hides the terrain edge.
  const HAZE_AT_EDGE = .97, EDGE_FOG = [45, 230], NO_RING_FAR = 1200;
  const radialFog = shader => { // fog by distance, not view depth: the ring edge stays hidden at the screen sides too
    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#ifdef USE_FOG\n  vFogDepth = length(mvPosition.xyz);\n#endif');
  };
  const tasks = () => sim()?.surf.tasks ?? [];
  const isDone = id => !!sim()?.surf.completed.has(id);
  const touch = matchMedia('(pointer: coarse)').matches, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const s = { site: null, crew: null, emote: null, emoteCam: false, mode: 'first', yaw: 0, pitch: -.1, bodyYaw: 0, speed: 0, vy: 0, grounded: true, jump: false,
    pos: new THREE.Vector3(), keys: new Set(), stick: null, look: null, drag: null, ready: false, prompt: '' };
  let world = null;

  const hiddenMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); // still casts a shadow
  const flat = (color, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  function initWorld() {
    let renderer;
    // Logarithmic depth: the horizon ring reaches 100 km while the suit is 5 cm from the eye.
    try { renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true }); } catch { return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    viewEl.prepend(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, 1, .05, NO_RING_FAR);
    camera.rotation.order = 'YXZ';
    // Daytime Mars sky (game colors): butterscotch at the horizon, darker overhead; faceted dome.
    const horizon = new THREE.Color(0xd8a07c), zenith = new THREE.Color(0x7a4c46);
    const skyGeo = new THREE.IcosahedronGeometry(900, 2), sp = skyGeo.attributes.position, colors = [];
    for (let k = 0; k < sp.count; k++) { const c = horizon.clone().lerp(zenith, Math.pow(Math.max(0, sp.getY(k) / 900), .55)); colors.push(c.r, c.g, c.b); }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; scene.add(sky);
    scene.fog = new THREE.Fog(horizon, ...EDGE_FOG);
    scene.add(new THREE.HemisphereLight(0xf3c9a0, 0x4a2418, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .03;
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 180 });
    scene.add(sun, sun.target);
    const skirt = new THREE.Mesh(new THREE.CircleGeometry(1500, 6).rotateX(-Math.PI / 2), flat(0x6b3b28, 1));
    scene.add(skirt);
    const lander = makeLander(); scene.add(lander);
    const w = { renderer, scene, camera, sky, sun, skirt, lander, sunDir: new THREE.Vector3(0, 1, 0), terrain: null, hf: null,
      blocks: [], colliders: [], avatars: new Map(), avatar: null, width: 0, height: 0 };
    new ResizeObserver(() => {
      w.width = viewEl.clientWidth; w.height = viewEl.clientHeight;
      if (!w.width || !w.height) return;
      renderer.setSize(w.width, w.height, false); camera.aspect = w.width / w.height; camera.updateProjectionMatrix();
    }).observe(viewEl);
    bindInput(renderer.domElement);
    return w;
  }

  // The landed vehicle at the site center: the enlarged Crew Cabin / Mars Lander capsule with deployed legs and ladder.
  function makeLander() {
    const g = new THREE.Group(), steel = flat(0x9ea4ad, .45, .75), titanium = flat(0x8f9196, .4, .8),
      foil = flat(0xd4a72c, .3, .9), dark = flat(0x1e2024, .55), nozzleMat = flat(0x3a3633, .6, .6);
    const addTo = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    const add = (geo, mat, x, y, z) => addTo(g, geo, mat, x, y, z);
    const strutTo = (parent, geo, mat, a, b) => {
      const dir = b.clone().sub(a), m = addTo(parent, geo(dir.length()), mat, 0, 0, 0);
      m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    };
    g.userData.ready = loadGLB('parts/structures/crew-cabin.glb').then(hull => {
      for (const n of ['Stowed_Back', 'Stowed_Front']) { const o = hull.getObjectByName(n); if (o) o.visible = false; }
      const closed = hull.getObjectByName('Closed'); if (closed) closed.visible = true;
      hull.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      hull.scale.setScalar(2.05);
      hull.position.y = .65;
      g.add(hull);
    });
    // Under-hull heatshield base, thermal collar & descent engine nozzle.
    add(new THREE.CylinderGeometry(1.48, 1.32, .16, 12), dark, 0, 1.05, 0);
    add(new THREE.CylinderGeometry(.36, .42, .18, 10), foil, 0, .98, 0);
    add(new THREE.ConeGeometry(.58, .72, 10), nozzleMat, 0, .68, 0).rotation.x = Math.PI;
    // Four deployed landing legs with primary telescopic struts, A-frame braces & hexagonal footpads.
    // Each leg lives in a hinged pivot group at its upper hull mount so it folds upward during liftoff.
    const legs = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const yaw = new THREE.Group();
      yaw.rotation.y = a;
      const leg = new THREE.Group();
      leg.position.set(0, 1.24, 1.48);
      yaw.add(leg);
      g.add(yaw);
      const top = new THREE.Vector3(0, 0, 0.02);
      const low = new THREE.Vector3(0, -0.22, -0.10);
      const foot = new THREE.Vector3(0, -1.16, 1.00);
      const mid = top.clone().add(foot).multiplyScalar(.5);
      strutTo(leg, len => new THREE.CylinderGeometry(.06, .07, len, 6), steel, top, foot);
      strutTo(leg, len => new THREE.CylinderGeometry(.045, .045, len, 5), titanium, low, mid);
      addTo(leg, new THREE.CylinderGeometry(.28, .34, .09, 6), steel, foot.x, foot.y - .035, foot.z);
      legs.push(leg);
    }
    // Boarding ladder on +Z leading up to the crew hatch threshold, hinged at the threshold so it retracts on liftoff.
    const ladder = new THREE.Group();
    ladder.position.set(0, 2.06, 1.50);
    g.add(ladder);
    addTo(ladder, new THREE.BoxGeometry(.56, .04, .22), titanium, 0, 0, 0.06);
    for (const sx of [-.24, .24]) strutTo(ladder, len => new THREE.CylinderGeometry(.024, .024, len, 6), steel, new THREE.Vector3(sx, 0, 0), new THREE.Vector3(sx, -2.02, 0.68));
    for (let i = 0; i < 7; i++) {
      const u = (i + .6) / 7.2, y = -2.02 * u, z = 0.68 * u;
      const rung = addTo(ladder, new THREE.CylinderGeometry(.016, .016, .48, 5), steel, 0, y, z);
      rung.rotation.z = Math.PI / 2;
    }
    // Engine exhaust plume & point light for the timeout ascent sequence.
    const plume = new THREE.Group();
    plume.position.set(0, .32, 0);
    for (const [r, h, col, op] of [[.52, 2.8, 0xe04f26, .55], [.34, 2.0, 0xf59e0b, .72], [.16, 1.2, 0xfce8a6, .95]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      cone.rotation.x = Math.PI;
      cone.position.y = -h * .5;
      plume.add(cone);
    }
    plume.visible = false;
    g.add(plume);
    const engineLight = new THREE.PointLight(0xf59e0b, 0, 28, 1.6);
    engineLight.position.set(0, .1, 0);
    g.add(engineLight);
    g.userData.plume = plume;
    g.userData.engineLight = engineLight;
    g.userData.legs = legs;
    g.userData.ladder = ladder;
    g.userData.setGear = (retract = 0) => {
      const e = clamp(retract, 0, 1), s = e * e * (3 - 2 * e);
      for (const leg of legs) {
        leg.rotation.x = -s * 1.38;
        leg.scale.set(1, 1 - s * 0.25, 1 - s * 0.25);
      }
      ladder.rotation.x = -s * 1.48;
      ladder.scale.set(1, 1 - s * 0.55, 1 - s * 0.45);
      ladder.visible = e < 0.98;
    };
    return g;
  }

  // Experiment marker: hex plinth, a block in the owner's color, a floating gem and a light beam seen from afar.
  function makeBlock(exp, color) {
    const g = new THREE.Group(), tone = new THREE.Color(color), dark = flat(0x281147, .9), mat = flat(tone, .75);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, .4, 6), dark); plinth.position.y = .1;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat); block.position.y = .85; block.rotation.y = Math.PI / 4;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, .16, 1.14), dark); band.position.y = 1.05; band.rotation.y = Math.PI / 4;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshBasicMaterial({ color: 0xfce8a6 })); gem.position.y = 2.2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 60, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.y = 31;
    for (const m of [plinth, block, band]) m.castShadow = m.receiveShadow = true;
    g.add(plinth, block, band, gem, beam);
    g.userData = { exp, gem, beam, tag: null };
    return g;
  }

  // Terrain: the GLB comes from index.terrain.<site>.js (a <script> works on file://).
  const terrains = new Map();
  function fetchTerrain(id) {
    if (!terrains.has(id)) terrains.set(id, (async () => {
      if (!window.ASTRO_TERRAIN?.[id]) await new Promise((ok, fail) => {
        const tag = document.createElement('script');
        tag.src = `index.terrain.${id}.js`; tag.onload = ok; tag.onerror = () => fail(new Error(`index.terrain.${id}.js missing (npm run web:models)`));
        document.head.append(tag);
      });
      const entry = window.ASTRO_TERRAIN?.[id];
      if (!entry?.glb) throw new Error(`no terrain for ${id}`);
      const bin = atob(entry.glb), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      delete entry.glb;
      const gltf = await loader.parseAsync(bytes.buffer, '');
      // "Terrain": the walkable HiRISE crop. "Horizon" (optional): the land around it out to tens of km.
      const mesh = gltf.scene.getObjectByName('Terrain'), ring = gltf.scene.getObjectByName('Horizon') ?? null;
      mesh.receiveShadow = true;
      const { color, map } = mesh.material;
      color.setRGB(color.r * GROUND_GAIN[0], color.g * GROUND_GAIN[1], color.b * GROUND_GAIN[2]);
      if (map) map.anisotropy = world.renderer.capabilities.getMaxAnisotropy(); // keeps the photo sharp at grazing angles
      addGroundDetail(mesh.material, entry.site.sizeM);
      if (ring) { // its texture already carries the relief shading (real sun, 200 m DEM): light it as level ground
        const m = ring.material, n = ring.geometry.attributes.position.count;
        ring.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        m.color.setRGB(m.color.r * GROUND_GAIN[0], m.color.g * GROUND_GAIN[1], m.color.b * GROUND_GAIN[2]);
        if (m.map) m.map.anisotropy = world.renderer.capabilities.getMaxAnisotropy();
        m.flatShading = false; m.onBeforeCompile = radialFog; m.needsUpdate = true;
      }
      const hf = heightField(mesh);
      gltf.scene.add(scatterRocks(hf, entry.site.id));
      return { info: entry.site, scene: gltf.scene, hf, ring };
    })().catch(err => { terrains.delete(id); throw err; }));
    return terrains.get(id);
  }
  // The photo has 0.5 m pixels, too coarse at walking distance: a tiled grain (3 m tiles) multiplies it
  // up close and averages out with distance (mipmaps). Game art, not data.
  let grain = null;
  function addGroundDetail(material, sizeM) {
    if (!grain) {
      const N = 256, data = new Uint8Array(N * N * 4), rnd = (i, seed) => { const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
      const octave = (cells, seed) => (x, y) => { // tileable value noise
        const fx = x / N * cells, fy = y / N * cells, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
        const at = (a, b) => rnd(((b % cells) * cells) + (a % cells), seed);
        return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
      };
      const layers = [[octave(6, 1), .4], [octave(24, 2), .35], [octave(96, 3), .25]];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const g = Math.round(255 * layers.reduce((sum, [f, w]) => sum + f(x, y) * w, 0)), k = (y * N + x) * 4;
        data[k] = data[k + 1] = data[k + 2] = g; data[k + 3] = 255;
      }
      grain = new THREE.DataTexture(data, N, N);
      grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.magFilter = THREE.LinearFilter; grain.minFilter = THREE.LinearMipmapLinearFilter;
      grain.generateMipmaps = true; grain.anisotropy = world.renderer.capabilities.getMaxAnisotropy(); grain.needsUpdate = true;
    }
    material.onBeforeCompile = shader => {
      radialFog(shader);
      shader.uniforms.grainMap = { value: grain }; shader.uniforms.grainRepeat = { value: sizeM / 3 };
      shader.fragmentShader = 'uniform sampler2D grainMap;\nuniform float grainRepeat;\n' + shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n  diffuseColor.rgb *= 0.55 + 0.9 * texture2D(grainMap, vMapUv * grainRepeat).r;');
    };
  }
  // Loose rocks (game art): same spots every time for a site, so the ground has scale when walking.
  function scatterRocks(hf, seedText) {
    let seed = [...seedText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const COUNT = 900, rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), flat(0xffffff, .95), COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), lim = hf.half - 6;
    for (let i = 0; i < COUNT; i++) {
      const size = rand() < .06 ? .5 + rand() * .7 : .06 + Math.pow(rand(), 2) * .35;
      p.set((rand() * 2 - 1) * lim, 0, (rand() * 2 - 1) * lim); p.y = hf.at(p.x, p.z) - size * .25;
      sc.set(size * (.8 + rand() * .5), size * (.45 + rand() * .3), size * (.8 + rand() * .5));
      rocks.setMatrixAt(i, m.compose(p, q.setFromEuler(e.set(rand() * .6, rand() * Math.PI * 2, rand() * .6)), sc));
      rocks.setColorAt(i, c.setRGB(.2 + rand() * .1, .1 + rand() * .05, .06 + rand() * .03));
    }
    rocks.castShadow = rocks.receiveShadow = true;
    return rocks;
  }
  // Ground height by bilinear lookup in the mesh grid: row-major from the north-west corner,
  // same layout as tools/terrain/lib/terrain-mesh.mjs (cheaper than a raycast on 129k triangles).
  function heightField(mesh) {
    const p = mesh.geometry.attributes.position, n = Math.round(Math.sqrt(p.count));
    const x0 = p.getX(0), z0 = p.getZ(0), step = p.getX(1) - x0, h = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) h[k] = p.getY(k);
    const at = (x, z) => {
      const fx = clamp((x - x0) / step, 0, n - 1.0001), fz = clamp((z - z0) / step, 0, n - 1.0001);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
      return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + n] * (1 - u) + h[k + n + 1] * u) * v;
    };
    const slope = (x, z) => Math.hypot(at(x + 1, z) - at(x - 1, z), at(x, z + 1) - at(x, z - 1)) / 2;
    return { at, slope, half: (n - 1) * step / 2 };
  }

  async function loadCrew(id) {
    if (world.avatars.has(id)) return world.avatars.get(id);
    const gltf = await loadGLTF(`characters/${id}.glb`), body = gltf.scene.clone(true); // pivot rig, no skinning
    const mixer = new THREE.AnimationMixer(body), clip = name => gltf.animations.find(a => a.name === name);
    const idle = mixer.clipAction(clip('idle_loop')), walk = mixer.clipAction(clip('walk_loop'));
    const wave = mixer.clipAction(clip('wave')), saluteClip = clip('salute') || clip('wave'), salute = mixer.clipAction(saluteClip);
    const action = mixer.clipAction(clip('action_loop'));
    idle.play(); walk.play(); walk.setEffectiveWeight(0);
    wave.setLoop(THREE.LoopOnce, 1);
    salute.setLoop(THREE.LoopOnce, 1);
    const props = [];
    body.traverse(o => {
      if (o.isMesh) o.castShadow = true;
      if (o.name.startsWith('Prop_')) { o.visible = false; props.push(o); }
    });
    const head = body.getObjectByName('Head'), helmet = [];
    head.traverse(o => { if (o.isMesh) { o.userData.mat = o.material; helmet.push(o); } });
    body.updateMatrixWorld(true);
    const idx = world.avatars.size;
    const a = { id, body, mixer, idle, walk, wave, salute, action, props, emoteAction: null, emoteW: 0, actW: 0, head, helmet, walkW: 0,
      upperArmL: body.getObjectByName('UpperArm_L'), lowerArmL: body.getObjectByName('LowerArm_L'),
      upperArmR: body.getObjectByName('UpperArm_R'), lowerArmR: body.getObjectByName('LowerArm_R'),
      torso: body.getObjectByName('Torso'),
      eyeY: head.getWorldPosition(new THREE.Vector3()).y, pos: new THREE.Vector3(), bodyYaw: 0,
      ai: { state: 'idle', last: 'idle', timer: 1.5 + idx * 0.9, tx: 0, tz: 0, waveCd: 0 } };
    mixer.addEventListener('finished', e => {
      if (e.action !== wave && e.action !== salute) return;
      if (world.avatar?.id === id && (s.emote?.kind === 'wave' || s.emote?.kind === 'salute')) endEmote();
      else if (world.avatar?.id !== id && (a.ai.state === 'wave' || a.ai.state === 'salute')) {
        wave.stop(); salute.stop();
        idle.setEffectiveWeight(1);
        a.ai.state = 'idle'; a.ai.timer = 1.8 + Math.random() * 2;
      }
    });
    world.avatars.set(id, a); world.scene.add(body);
    return a;
  }
  // Every crew member stands on the surface; the player controls one (keys 1–4), while others run simple autonomous AI.
  async function useCrew(id) {
    endEmote();
    const prev = world.avatar;
    s.crew = id; renderCrewBar();
    const a = await loadCrew(id);
    if (s.crew !== id) return;
    if (prev && prev !== a) {
      prev.pos.copy(s.pos); prev.bodyYaw = s.bodyYaw;
      prev.action.stop(); prev.wave.stop(); prev.salute.stop();
      prev.emoteAction = null; prev.emoteW = 0; prev.actW = 0;
      for (const p of prev.props) p.visible = false;
      prev.ai = { state: 'idle', last: 'idle', timer: 2 + Math.random() * 2, tx: prev.pos.x, tz: prev.pos.z, waveCd: 3 };
    }
    a.action.stop(); a.wave.stop(); a.salute.stop();
    a.emoteAction = null; a.emoteW = 0; a.actW = 0;
    for (const p of a.props) p.visible = false;
    a.ai.state = 'idle';
    for (const o of [prev, a]) if (o) { o.net = null; o.wasRemote = false; } // poses from before the switch are stale
    world.avatar = a;
    s.pos.copy(a.pos); s.bodyYaw = a.bodyYaw; s.yaw = a.bodyYaw - Math.PI; s.vy = 0; s.grounded = true;
    if (sim()) sim().surf.activeCrew = id;
    applyMode(); s.prompt = '';
  }
  const clampPitch = () => { s.pitch = s.mode === 'first' ? clamp(s.pitch, -1.45, 1.2) : clamp(s.pitch, -1, .45); };
  function applyMode() {
    for (const a of world.avatars.values()) for (const m of a.helmet) m.material = a === world.avatar && s.mode === 'first' ? hiddenMat : m.userData.mat;
    clampPitch();
  }
  function setMode(mode) { s.mode = mode; applyMode(); }

  function setTerrain(t) {
    const { info, hf } = t;
    if (world.terrain) world.scene.remove(world.terrain);
    world.terrain = t.scene; world.hf = hf; world.scene.add(t.scene);
    const az = info.sun.azimuthDeg * Math.PI / 180, el = info.sun.elevationDeg * Math.PI / 180; // sun of the photo (HiRISE label)
    world.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    world.skirt.position.y = info.elevation.minM - info.elevation.centerM - .4;
    world.skirt.material.color.setRGB(info.tint[0] * .2, info.tint[1] * .2, info.tint[2] * .2);
    // With a horizon ring the real land continues past the edge: no skirt, haze out to the ring's far edge.
    const reach = t.ring ? info.horizon.radiusM : 0;
    world.skirt.visible = !t.ring;
    const haze = world.scene.fog.color;
    world.scene.fog = t.ring ? new THREE.FogExp2(haze, Math.sqrt(-Math.log(1 - HAZE_AT_EDGE)) / reach) : new THREE.Fog(haze, ...EDGE_FOG);
    world.camera.far = t.ring ? reach * 1.05 : NO_RING_FAR; world.camera.updateProjectionMatrix();
  }

  // The spots come from a seed (the host's, in a room), so every screen puts the blocks in the same places.
  const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function placeBlocks(seed) {
    const { hf, scene } = world, tags = $s('surface-tags'), spots = [], lim = hf.half - 24, rand = seeded(seed ?? Math.floor(Math.random() * 2 ** 31));
    for (const b of world.blocks) scene.remove(b);
    tags.innerHTML = ''; world.blocks = []; world.colliders = [{ x: 0, z: 0, r: 2.9 }];
    for (const exp of tasks()) {
      let spot = null;
      for (let t = 0; t < 300 && !spot; t++) {
        const r = SPOT_MIN + rand() * (SPOT_MAX - SPOT_MIN), a = rand() * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
        const ok = Math.abs(x) < lim && Math.abs(z) < lim && hf.slope(x, z) < .2 && spots.every(p => Math.hypot(p.x - x, p.z - z) > SPOT_GAP);
        if (ok || t === 299) spot = { x, z };
      }
      spots.push(spot);
      const owner = ui.crew.find(c => c.id === exp.crew), block = makeBlock(exp, owner.color);
      block.position.set(spot.x, hf.at(spot.x, spot.z), spot.z);
      const tag = document.createElement('span');
      tag.className = 'surface-tag'; tag.style.setProperty('--crew', owner.color);
      tags.append(tag); block.userData.tag = tag;
      scene.add(block); world.blocks.push(block); world.colliders.push({ x: spot.x, z: spot.z, r: 1.6 });
    }
    function renderSurfaceGoals() {
      $s('surface-goals').innerHTML = tasks().map(e => { const o = ui.crew.find(c => c.id === e.crew);
        return `<li data-goal="${e.id}" style="--crew:${o.color}"><span class="goal-chip"></span><span class="goal-name"><strong>${e.id} · ${e.title}</strong><small>${o.name}</small></span><span class="goal-dist"></span><span class="goal-arrow"></span></li>`; }).join('');
    }
    renderSurfaceGoals();
  }

  // In a room, an astronaut another player moves cannot be taken.
  function renderCrewBar() {
    const control = sim()?.surf.control || {};
    $s('surface-crew').innerHTML = ui.crew.map((c, i) => { const other = mp() && c.id !== s.crew && !!control[c.id] && control[c.id] !== net().you.id;
      return `<button type="button" data-crew="${c.id}" style="--crew:${c.color}" aria-pressed="${c.id === s.crew}" ${other ? 'disabled' : ''}>${c.name}<small>${other ? t('common.player') : touch ? '' : t('surface.keyHint', { n: i + 1 })}</small></button>`; }).join('');
  }
  $s('surface-crew').addEventListener('click', e => { const b = e.target.closest('[data-crew]'); if (b && world) switchCrew(b.dataset.crew); });
  function switchCrew(id) {
    if (id === s.crew) return;
    if (mp()) { sim()?.requestCrew(id); return; } // the host hands out the AI astronauts (astro:control below)
    useCrew(id).then(() => ui.toast(t('surface.nowControlling', { name: ui.crew.find(c => c.id === id).name })));
  }
  window.addEventListener('astro:control', () => {
    if (!world || !s.ready || !mp()) return;
    const mine = sim()?.myCrew();
    if (mine && mine !== s.crew) useCrew(mine).then(() => ui.toast(t('surface.nowControlling', { name: ui.crew.find(c => c.id === mine).name })));
    else renderCrewBar();
  });

  function showStart(kicker, title, keys) {
    $s('surface-start-kicker').textContent = kicker; $s('surface-start-title').textContent = title;
    $s('surface-keys').innerHTML = keys; startEl.hidden = false;
  }
  function fail(message) { root.classList.add('surface-fail'); showStart(t('surface.surfaceLabel'), message, t('surface.failFallbackHint')); }

  async function land({ site, crew, seed }) {
    root.classList.remove('surface-fail');
    if (!world) world = initWorld();
    const info = ui.sites[site];
    if (!world) return fail(t('surface.needWebgl'));
    s.ready = false; s.site = site;
    showStart(t('surface.touchdown'), t('surface.loadingSite', { name: info.name }), '');
    try {
      const [terrain] = await Promise.all([fetchTerrain(site), world.lander.userData.ready]);
      if (s.site !== site) return;
      setTerrain(terrain);
      s.departing = null;
      world.lander.position.set(0, terrain.hf.at(0, 0), 0);
      world.lander.userData.setGear?.(0);
      if (world.lander.userData.plume) world.lander.userData.plume.visible = false;
      if (world.lander.userData.engineLight) world.lander.userData.engineLight.intensity = 0;
      world.camera.fov = 72; world.camera.updateProjectionMatrix();
      placeBlocks(seed); buildCompass();
      await Promise.all(ui.crew.map(c => loadCrew(c.id)));
      let idx = 0;
      for (const [id, [x, z]] of Object.entries(CREW_START)) {
        const a = world.avatars.get(id);
        a.body.visible = true;
        a.pos.set(x, terrain.hf.at(x, z), z); a.bodyYaw = 0;
        a.body.rotation.set(0, 0, 0);
        a.action.stop(); a.wave.stop(); a.salute.stop(); a.emoteAction = null; a.emoteW = 0; a.actW = 0; a.walkW = 0;
        for (const p of a.props) p.visible = false;
        a.ai = { state: 'idle', last: 'idle', timer: 1.2 + idx++ * 0.85, tx: x, tz: z, waveCd: 1.5 };
      }
      world.avatar = null; s.pitch = -.1;
      await useCrew(crew);
      const first = world.blocks.find(b => b.userData.exp.crew === crew)?.position ?? world.blocks[0].position;
      s.yaw = Math.atan2(-(first.x - s.pos.x), -(first.z - s.pos.z)); s.bodyYaw = s.yaw + Math.PI;
      s.ready = true;
      startEl.hidden = true;
      ui.toast(window.ASTRO_I18N.t(touch ? 'surface.touchHint' : 'surface.desktopHint'));
      if (mp()) { for (const p of net().poses) takePose(p.data); sim()?.surfaceLoaded?.(); renderCrewBar(); }
    } catch (err) {
      console.warn('Surface not shown:', err);
      fail(window.ASTRO_I18N.t('surface.terrainError', { name: info?.name ?? site }));
    }
  }
  window.addEventListener('astro:land', e => land(e.detail));

  // Emote wheel: the animations every avatar has (AGENTS.md §5.5). Hold Q, aim with the mouse and release;
  // or click/tap the emotes button and pick. In first person the camera steps back while the emote plays.
  const ACTION_EMOTE = {
    helena: ['🪛', () => t('surface.emoteLabels.helena')],
    lucas: ['💻', () => t('surface.emoteLabels.lucas')],
    oscar: ['📡', () => t('surface.emoteLabels.oscar')],
    maya: ['🧪', () => t('surface.emoteLabels.maya')],
  };
  const wheelEl = $s('emote-wheel');
  const emotes = () => [
    ['wave', '👋', t('surface.emoteLabels.wave')],
    ['salute', '🫡', t('surface.emoteLabels.salute')],
    ...(ACTION_EMOTE[s.crew] ? [['action', ACTION_EMOTE[s.crew][0], ACTION_EMOTE[s.crew][1]()]] : []),
    ['walk', '🚶', t('surface.emoteLabels.walk')],
    ['idle', '🧍', t('surface.emoteLabels.idle')],
  ];
  // Controls: hold Q, aim (mouse direction, arrows/WASD) and release Q; or click a slot, a digit, Enter/Space/E,
  // or a click while the mouse is captured. Esc, Q again (when opened by the button) or a click outside cancels.
  // The list is fixed while the wheel is open, so the picked index always names the slot on screen.
  const wheel = { open: false, hold: false, pick: -1, x: 0, y: 0, list: [] };
  const WHEEL_DEAD_PX = 18, WHEEL_AIM_PX = 60; // UI feel: dead zone and the cap on the captured-mouse aim vector (px)
  const wheelButtons = () => [...wheelEl.querySelectorAll('button')];
  function setPick(i) {
    wheel.pick = i;
    wheelButtons().forEach((b, j) => b.classList.toggle('on', j === i));
    $s('emote-name').textContent = i >= 0 ? wheel.list[i][2] : t('surface.emotesTitle');
  }
  function pickToward(dx, dy) { // a direction from the centre picks the nearest slot (slot 0 at the top, clockwise)
    if (Math.hypot(dx, dy) < WHEEL_DEAD_PX) return;
    const n = wheel.list.length, ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    setPick(Math.round(ang / (Math.PI * 2 / n)) % n);
  }
  function openWheel(hold) {
    if (!world?.avatar || dlg.open || s.departing) return;
    wheel.list = emotes();
    wheelButtons().forEach(b => b.remove());
    wheel.list.forEach(([kind, icon, label], i) => wheelEl.insertAdjacentHTML('beforeend', `<button type="button" role="menuitem" data-emote="${kind}" style="--a:${i * 360 / wheel.list.length}deg">${icon}<small>${label}</small></button>`));
    Object.assign(wheel, { open: true, hold, x: 0, y: 0 });
    setPick(-1);
    wheelEl.hidden = false; s.keys.clear(); s.drag = null;
  }
  function closeWheel(play) {
    if (!wheel.open) return;
    const kind = wheel.list[wheel.pick]?.[0];
    wheel.open = false; wheel.hold = false; wheelEl.hidden = true;
    if (play && kind) playEmote(kind);
  }
  function aimWheel(dx, dy) { // captured mouse: add up the motion, capped so turning back answers at once
    wheel.x += dx; wheel.y += dy;
    const r = Math.hypot(wheel.x, wheel.y);
    if (r > WHEEL_AIM_PX) { wheel.x *= WHEEL_AIM_PX / r; wheel.y *= WHEEL_AIM_PX / r; }
    pickToward(wheel.x, wheel.y);
  }
  function aimWheelAt(x, y) { // free cursor: the direction from the wheel's centre, even with the cursor outside it
    const r = wheelEl.getBoundingClientRect();
    pickToward(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
  }
  const WHEEL_KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowRight: [1, 0], KeyD: [1, 0], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0] };
  function wheelKey(e) { // keys while the wheel is open; everything else stays blocked so the astronaut does not move
    if (e.code === 'Escape') return closeWheel(false);
    const dir = WHEEL_KEYS[e.code];
    if (dir) { e.preventDefault(); return pickToward(dir[0] * 100, dir[1] * 100); }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); return closeWheel(true); }
    const n = +(/^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1] ?? 0);
    if (n && n <= wheel.list.length) { e.preventDefault(); setPick(n - 1); closeWheel(true); }
  }
  wheelEl.addEventListener('pointerover', e => { // hovering a slot picks it (touch, pen, and a mouse over the wheel)
    const b = e.target.closest('[data-emote]');
    if (b) setPick(wheelButtons().indexOf(b));
  });
  wheelEl.addEventListener('click', e => {
    const b = e.target.closest('[data-emote]');
    if (b) { setPick(wheelButtons().indexOf(b)); closeWheel(true); }
    else if (!wheel.hold) closeWheel(false); // a tap on the wheel's empty middle cancels
  });
  $s('surface-emote').addEventListener('click', () => (wheel.open ? closeWheel(false) : openWheel(false)));
  const goalsBox = $s('surface-goals-box'), goalsToggle = $s('surface-goals-toggle');
  function syncTouchLabels() {
    if (touch) $s('surface-emote').textContent = t('surface.emotesTitle');
  }
  syncTouchLabels();
  window.addEventListener('astro:lang', syncTouchLabels);
  if (goalsBox && goalsToggle) {
    const setGoalsCollapsed = collapsed => {
      goalsBox.classList.toggle('is-collapsed', collapsed);
      goalsToggle.setAttribute('aria-expanded', String(!collapsed));
    };
    if (matchMedia('(max-height:500px) and (orientation:landscape)').matches) setGoalsCollapsed(true);
    goalsToggle.addEventListener('click', () => setGoalsCollapsed(!goalsBox.classList.contains('is-collapsed')));
  }
  function playEmote(kind) {
    const a = world?.avatar;
    if (!a) return;
    endEmote();
    if (kind === 'idle') return;
    s.emote = { kind };
    for (const p of a.props) p.visible = (kind === 'action');
    if (kind === 'wave' || kind === 'salute' || kind === 'action') { a.emoteAction = a[kind]; a.emoteAction.reset().play(); }
    if (s.mode === 'first') { s.emoteCam = true; setMode('third'); }
  }
  function endEmote() {
    if (!s.emote) return;
    const a = world?.avatar;
    if (a) for (const p of a.props) p.visible = false;
    s.emote = null;
    if (s.emoteCam) { s.emoteCam = false; setMode('first'); }
  }

  // Compass strip: ±90° around the view heading; cardinal points, 15° ticks, the lander and each experiment.
  const compassEl = $s('surface-compass-strip');
  let compassItems = [];
  function buildCompass() {
    if (!world) return;
    const CARDINAL = t('surface.cardinals');
    compassEl.innerHTML = Array.from({ length: 24 }, (_, i) => i * 15).map(d => d % 45
      ? `<span class="cmp-tick" data-deg="${d}"></span>`
      : `<span class="cmp-card${d ? '' : ' north'}" data-deg="${d}">${CARDINAL[d / 45]}</span>`).join('')
      + `<span class="cmp-mark lander" title="${t('surface.landerTitle')}"></span>`
      + world.blocks.map(b => `<span class="cmp-mark" data-mark="${b.userData.exp.id}" style="--crew:${ui.crew.find(c => c.id === b.userData.exp.crew).color}"></span>`).join('');
    compassItems = [...compassEl.children].map(el => ({ el, deg: el.dataset.deg == null ? null : +el.dataset.deg,
      at: el.classList.contains('lander') ? new THREE.Vector3() : world.blocks.find(b => b.userData.exp.id === el.dataset.mark)?.position, id: el.dataset.mark }));
  }
  function updateCompass() {
    const heading = ((-s.yaw * 180 / Math.PI) % 360 + 360) % 360, half = compassEl.clientWidth / 2;
    for (const it of compassItems) {
      const bearing = it.deg ?? (Math.atan2(it.at.x - s.pos.x, -(it.at.z - s.pos.z)) * 180 / Math.PI + 360) % 360;
      const d = ((bearing - heading + 540) % 360) - 180;
      it.el.hidden = Math.abs(d) > 90;
      if (!it.el.hidden) it.el.style.left = `${half + d / 90 * (half - 8)}px`;
      if (it.id) it.el.classList.toggle('done', isDone(it.id));
    }
    $s('surface-compass-readout').textContent = t('surface.hdg', { deg: String(Math.round(heading) % 360).padStart(3, '0') });
  }

  // Input: keyboard + mouse look (a click on the view captures the mouse, Esc frees it; drag only when the
  // browser refuses the lock), touch stick + look.
  function bindInput(canvas) {
    const live = () => isActive('surface') && s.ready && !dlg.open;
    addEventListener('keydown', e => {
      if (!live() || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.code === 'KeyQ') { if (!e.repeat) { if (!wheel.open) openWheel(true); else if (!wheel.hold) closeWheel(false); } return; }
      if (wheel.open) return wheelKey(e);
      s.keys.add(e.code);
      if (e.code === 'Space') { s.jump = true; e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyE' || e.code === 'Enter') interact();
      if (e.code === 'KeyV') setMode(s.mode === 'first' ? 'third' : 'first');
      const n = /^Digit([1-4])$/.exec(e.code)?.[1];
      if (n) switchCrew(ui.crew[n - 1].id);
    });
    addEventListener('keyup', e => { s.keys.delete(e.code); if (e.code === 'KeyQ' && wheel.open && wheel.hold) closeWheel(true); });
    // Leaving the window while holding Q never sends its keyup: drop the wheel instead of leaving it stuck open.
    addEventListener('blur', () => { s.keys.clear(); if (wheel.open && wheel.hold) closeWheel(false); });
    const turn = (dx, dy, k) => { s.yaw -= dx * k; s.pitch -= dy * k; clampPitch(); };
    // Chrome can send a lone, huge movement right after locking and now and then while locked. Drop only that
    // outlier: a fast turn grows over several events and is kept. (A flat 200 px cut froze the view on quick
    // turns, more so at low frame rates, where the browser merges a whole frame of motion into one event.)
    const SPIKE_PX = 200, SPIKE_RATIO = 4;
    let settle = false, lastMove = 0;
    document.addEventListener('pointerlockchange', () => {
      settle = true;
      if (document.pointerLockElement === canvas) s.drag = null;
    });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        const m = Math.max(Math.abs(e.movementX), Math.abs(e.movementY)), before = lastMove;
        if (!m) return; // Chrome also sends zero moves when the page changes under the cursor (HUD, tags)
        lastMove = m;
        if (settle || (m > SPIKE_PX && m > before * SPIKE_RATIO + 40)) { settle = false; return; }
        if (wheel.open) return aimWheel(e.movementX, e.movementY);
        turn(e.movementX, e.movementY, .0022);
      }
      else if (wheel.open) aimWheelAt(e.clientX, e.clientY); // the view does not turn while the wheel is up
      else if (s.drag) { turn(e.clientX - s.drag.x, e.clientY - s.drag.y, .004); s.drag = { x: e.clientX, y: e.clientY }; }
    });
    canvas.addEventListener('mousedown', e => {
      // Wheel open: with the mouse captured (hidden cursor) a click confirms the aimed slot; a free click outside cancels.
      if (wheel.open) { if (e.button === 0) closeWheel(document.pointerLockElement === canvas); return; }
      if (e.button !== 0 || document.pointerLockElement === canvas) return;
      s.drag = { x: e.clientX, y: e.clientY };
      if (!touch && live()) try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* drag to look instead */ }
    });
    addEventListener('mouseup', () => { s.drag = null; });
    const stickEl = $s('surface-stick');
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !live()) return;
      if (wheel.open) { closeWheel(false); return; } // a tap outside the wheel closes it instead of moving

      const r = viewEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < r.width * .45 && !s.stick) {
        s.stick = { id: e.pointerId, ox: x, oy: y, x: 0, y: 0 };
        stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.classList.add('on');
      } else if (!s.look) s.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    });
    canvas.addEventListener('pointermove', e => {
      if (s.stick?.id === e.pointerId) {
        const r = viewEl.getBoundingClientRect(), dx = e.clientX - r.left - s.stick.ox, dy = e.clientY - r.top - s.stick.oy, len = Math.hypot(dx, dy), k = Math.min(1, len / 50) / (len || 1);
        s.stick.x = dx * k; s.stick.y = -dy * k;
        stickEl.firstElementChild.style.translate = `${s.stick.x * 33}px ${-s.stick.y * 33}px`;
      } else if (s.look?.id === e.pointerId) { turn(e.clientX - s.look.x, e.clientY - s.look.y, .006); s.look.x = e.clientX; s.look.y = e.clientY; }
    });
    const release = e => {
      if (s.stick?.id === e.pointerId) { s.stick = null; stickEl.classList.remove('on'); stickEl.style.left = ''; stickEl.style.top = ''; stickEl.firstElementChild.style.translate = ''; }
      if (s.look?.id === e.pointerId) s.look = null;
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    $s('surface-jump').addEventListener('pointerdown', () => { s.jump = true; });
  }
  $s('surface-camera').addEventListener('click', () => { if (world?.avatar) setMode(s.mode === 'first' ? 'third' : 'first'); });
  const release = () => { if (document.pointerLockElement) document.exitPointerLock(); s.keys.clear(); };
  $s('surface-board').addEventListener('click', () => { release(); sim()?.board(); });
  promptEl.addEventListener('click', interact);

  // Experiments: the owner runs the minigame next to the block. web/experiment-run.js mounts it in #minigame-dialog
  // (stage, completion card, auto close) and the rules record the stars (sim().completeSurfaceTask).
  const nearBlock = () => world.blocks.find(b => Math.hypot(b.position.x - s.pos.x, b.position.z - s.pos.z) <= REACH) ?? null;
  const nearLander = () => Math.hypot(s.pos.x, s.pos.z) <= BOARD_REACH;
  function interact() {
    if (!world || !s.ready) return;
    const b = nearBlock();
    if (!b) { if (nearLander()) { release(); sim()?.board(); } return; }
    const e = b.userData.exp;
    if (isDone(e.id)) return;
    if (e.crew !== s.crew) return;
    const run = sim()?.surf.run;
    if (!run || !window.ASTRO_RUN) return;
    const owner = ui.crew.find(c => c.id === e.crew);
    if (document.pointerLockElement) document.exitPointerLock();
    s.keys.clear();
    window.ASTRO_RUN.playInDialog({ run, id: e.id, crewName: owner.name, onFinish: result => finishExperiment(e.id, result) });
  }
  $s('minigame-close').addEventListener('click', () => dlg.close());
  function markDone(b) { b.userData.done = true; b.userData.beam.visible = false; b.userData.gem.material.color.set(0x7edac2); b.userData.tag.classList.add('done'); }
  function finishExperiment(id, result) {
    if (!id || isDone(id)) return;
    sim()?.completeSurfaceTask(id, undefined, result?.stars ?? 0); s.prompt = '';
    const b = world.blocks.find(x => x.userData.exp.id === id);
    if (b && isDone(id)) markDone(b);
  }
  dlg.addEventListener('click', event => {
    if (event.target !== dlg) return;
    const bounds = dlg.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dlg.close();
  });

  const fwd = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3(), toNpc = new THREE.Vector3();
  const stepYaw = (cur, target, alpha) => cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur)) * Math.min(1, alpha);
  function pickNpcTarget(o, active) {
    const hf = world.hf, lim = hf.half - 16;
    const ownBlock = world.blocks.find(b => b.userData.exp.crew === o.id);
    for (let attempt = 0; attempt < 32; attempt++) {
      let tx, tz;
      if (ownBlock && attempt < 12 && Math.random() < 0.45) {
        const ang = Math.random() * Math.PI * 2, d = 3.2 + Math.random() * 4.5;
        tx = ownBlock.position.x + Math.sin(ang) * d;
        tz = ownBlock.position.z + Math.cos(ang) * d;
      } else {
        const nearShip = o.id === 'helena' && attempt < 18 && Math.random() < 0.45;
        const r = nearShip ? 5.2 + Math.random() * 4.0 : 12 + Math.random() * 26;
        const ang = Math.random() * Math.PI * 2;
        tx = Math.sin(ang) * r; tz = Math.cos(ang) * r;
      }
      if (Math.abs(tx) >= lim || Math.abs(tz) >= lim || hf.slope(tx, tz) >= 0.35) continue;
      if (Math.hypot(tx - o.pos.x, tz - o.pos.z) < 3.0) continue;
      if (world.colliders.some(c => Math.hypot(tx - c.x, tz - c.z) < c.r + 1.0)) continue;
      let crowded = false;
      for (const other of world.avatars.values()) {
        if (other === o) continue;
        const op = other === active ? s.pos : other.pos;
        if (Math.hypot(tx - op.x, tz - op.z) < 1.2) { crowded = true; break; }
      }
      if (!crowded) return [tx, tz];
    }
    return [o.pos.x, o.pos.z];
  }
  const NO_KEYS = new Set();
  // input false: my minigame is open in a room; my astronaut stands still while the others keep moving.
  function step(dt, input = true) {
    const k = input ? s.keys : NO_KEYS, a = world.avatar, hf = world.hf;
    let ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let iy = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (s.stick && input) { ix += s.stick.x; iy += s.stick.y; }
    const len = Math.min(1, Math.hypot(ix, iy)), run = k.has('ShiftLeft') || k.has('ShiftRight') || (s.stick && len > .92);
    const speed = len > .08 ? len * (run ? RUN : WALK) * doseOf(s.crew) : 0, sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    let mx = 0, mz = 0;
    if (speed) { const n = Math.hypot(ix, iy); mx = (-sin * iy + cos * ix) / n * speed; mz = (-cos * iy - sin * ix) / n * speed; }
    const lim = hf.half - 8;
    s.pos.x = clamp(s.pos.x + mx * dt, -lim, lim); s.pos.z = clamp(s.pos.z + mz * dt, -lim, lim);
    const mates = [...world.avatars.values()].filter(o => o !== a).map(o => ({ x: o.pos.x, z: o.pos.z, r: .7 }));
    for (const c of [...world.colliders, ...mates]) {
      const dx = s.pos.x - c.x, dz = s.pos.z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r && d > 1e-4) { s.pos.x = c.x + dx / d * c.r; s.pos.z = c.z + dz / d * c.r; }
    }
    s.speed = speed;
    const ground = hf.at(s.pos.x, s.pos.z);
    if (s.grounded && s.jump && input) { s.vy = JUMP; s.grounded = false; }
    s.jump = false;
    if (s.grounded) s.pos.y = ground;
    else { s.vy -= MARS_G * dt; s.pos.y += s.vy * dt; if (s.pos.y <= ground) { s.pos.y = ground; s.vy = 0; s.grounded = true; } }
    // First person: the body faces the view. Chase camera: it turns toward where it walks.
    const target = s.mode === 'first' ? s.yaw + Math.PI : speed ? Math.atan2(mx, mz) : s.bodyYaw;
    const d = Math.atan2(Math.sin(target - s.bodyYaw), Math.cos(target - s.bodyYaw));
    s.bodyYaw += s.mode === 'first' ? d : d * Math.min(1, dt * 10);
    a.body.position.copy(s.pos); a.body.rotation.y = s.bodyYaw;
    if (s.emote && (speed || !s.grounded)) endEmote();
    const marching = s.emote?.kind === 'walk', walking = marching || (s.grounded && speed > 0) ? 1 : 0;
    a.walkW += (walking - a.walkW) * Math.min(1, dt * 8);
    a.emoteW += ((s.emote && a.emoteAction ? 1 : 0) - a.emoteW) * Math.min(1, dt * 10);
    if (!s.emote && a.emoteAction && a.emoteW < .02) { a.emoteAction.stop(); a.emoteAction = null; a.emoteW = 0; }
    a.walk.setEffectiveWeight(a.walkW * (1 - a.emoteW)); a.idle.setEffectiveWeight((1 - a.walkW) * (1 - a.emoteW));
    a.emoteAction?.setEffectiveWeight(a.emoteW);
    a.walk.timeScale = marching ? 1 : clamp(speed / STRIDE, .6, 2.6);
    const showPlayerProps = s.emote?.kind === 'action';
    for (const p of a.props) p.visible = showPlayerProps;
    a.mixer.update(reduce && !speed && !s.emote ? 0 : dt);
    world.camera.getWorldDirection(camDir);
    const timeLeft = sim()?.surf.timerSec ?? 999, rushing = timeLeft <= 10 && timeLeft > 0;
    for (const o of world.avatars.values()) { // teammates wander, work in role animations, and wave back when looked at while stopped
      if (o === a) continue;
      if (driverOf(o.id) !== 'ai') { followRemote(o, dt); poseAvatar(o, dt); continue; } // another screen moves it
      if (o.wasRemote) { o.wasRemote = false; o.ai = { state: 'idle', last: 'idle', timer: 1.5, tx: o.pos.x, tz: o.pos.z, waveCd: 3 }; o.wave.stop(); o.salute.stop(); }
      if (rushing) {
        const [bx, bz] = CREW_BOARD[o.id] || [0, 3.2];
        o.ai.tx = bx; o.ai.tz = bz;
        const bdist = Math.hypot(bx - o.pos.x, bz - o.pos.z);
        if (o.ai.state === 'wave' || o.ai.state === 'salute' || o.ai.state === 'action') { o.wave.stop(); o.salute.stop(); o.action.stop(); o.actW = 0; }
        o.ai.state = bdist > 0.65 ? 'walk' : 'idle';
        o.ai.timer = 15;
      }
      o.ai.waveCd = Math.max(0, o.ai.waveCd - dt);
      if (!rushing && !reduce && (o.ai.state === 'idle' || o.ai.state === 'action') && o.ai.waveCd <= 0) {
        const pdist = Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z);
        if (pdist > 1.0 && pdist < 18) {
          toNpc.set(o.pos.x, o.pos.y + 1.35, o.pos.z).sub(world.camera.position).normalize();
          if (camDir.dot(toNpc) > 0.94) {
            o.action.stop(); o.actW = 0;
            o.wave.reset().setEffectiveWeight(1).play();
            o.ai.state = 'wave'; o.ai.timer = 2.35; o.ai.waveCd = 8;
          }
        }
      }
      o.ai.timer -= dt;
      if (o.ai.state === 'wave') {
        o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(s.pos.x - o.pos.x, s.pos.z - o.pos.z), dt * 7);
        o.walkW = 0; o.actW = 0;
        o.idle.setEffectiveWeight(0); o.walk.setEffectiveWeight(0); o.action.setEffectiveWeight(0); o.wave.setEffectiveWeight(1);
        if (o.ai.timer <= 0) { o.wave.stop(); o.idle.setEffectiveWeight(1); o.ai.state = 'idle'; o.ai.timer = 1.8 + Math.random() * 2; }
      } else {
        if (o.ai.state === 'action') {
          if (o.id === 'helena' && Math.hypot(o.pos.x, o.pos.z) < 8) {
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(-o.pos.x, -o.pos.z), dt * 6);
          }
          if (o.ai.timer <= 0) {
            o.ai.state = 'idle'; o.ai.last = 'action'; o.ai.timer = 1.5 + Math.random() * 2.2;
          }
        } else if (o.ai.state === 'idle') {
          if (rushing) {
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(-o.pos.x, -o.pos.z), dt * 8);
          } else if (!reduce && o.ai.timer <= 0) {
            if (o.ai.last !== 'action' && Math.random() < 0.55) {
              o.ai.state = 'action'; o.ai.timer = 4.5 + Math.random() * 3.5; o.action.reset().play();
            } else {
              const [tx, tz] = pickNpcTarget(o, a);
              o.ai.state = 'walk'; o.ai.tx = tx; o.ai.tz = tz; o.ai.timer = 8;
            }
          }
        } else if (o.ai.state === 'walk') {
          const spd = (rushing ? WALK : WALK * 0.68) * doseOf(o.id), dx = o.ai.tx - o.pos.x, dz = o.ai.tz - o.pos.z, dist = Math.hypot(dx, dz);
          const stepDist = Math.min(dist, spd * dt);
          let nx = clamp(o.pos.x + (dist > 1e-4 ? dx / dist : 0) * stepDist, -lim, lim);
          let nz = clamp(o.pos.z + (dist > 1e-4 ? dz / dist : 0) * stepDist, -lim, lim);
          let blocked = false;
          for (const c of world.colliders) {
            const cx = nx - c.x, cz = nz - c.z, cd = Math.hypot(cx, cz), minR = c.r + (rushing ? 0.35 : 0.6);
            if (cd < minR && cd > 1e-4) { nx = c.x + cx / cd * minR; nz = c.z + cz / cd * minR; blocked = !rushing; }
          }
          for (const other of world.avatars.values()) {
            if (other === o) continue;
            const op = other === a ? s.pos : other.pos;
            const cx = nx - op.x, cz = nz - op.z, cd = Math.hypot(cx, cz), minR = 0.85;
            if (cd < minR && cd > 1e-4) { nx = op.x + cx / cd * minR; nz = op.z + cz / cd * minR; blocked = !rushing; }
          }
          if (dist < (rushing ? 0.65 : 0.45) || (!rushing && (o.ai.timer <= 0 || blocked))) {
            if (blocked) { o.pos.x = nx; o.pos.z = nz; o.pos.y = hf.at(nx, nz); }
            if (!rushing && Math.random() < 0.75) {
              o.ai.state = 'action'; o.ai.timer = 4.5 + Math.random() * 3.5; o.action.reset().play();
            } else {
              o.ai.state = 'idle'; o.ai.last = 'walk'; o.ai.timer = 1.8 + Math.random() * 2;
            }
          } else {
            o.pos.x = nx; o.pos.z = nz; o.pos.y = hf.at(nx, nz);
            o.bodyYaw = stepYaw(o.bodyYaw, Math.atan2(dx, dz), dt * (rushing ? 11 : 8));
          }
        }
        const targetWalk = o.ai.state === 'walk' ? 1 : 0;
        const targetAct = o.ai.state === 'action' ? 1 : 0;
        o.walkW += (targetWalk - o.walkW) * Math.min(1, dt * 8);
        o.actW += (targetAct - o.actW) * Math.min(1, dt * 8);
        if (!targetAct && o.actW < 0.02) { o.action.stop(); o.actW = 0; }
        o.walk.setEffectiveWeight(o.walkW * (1 - o.actW));
        o.idle.setEffectiveWeight((1 - o.walkW) * (1 - o.actW));
        o.action.setEffectiveWeight(o.actW);
        o.walk.timeScale = (rushing ? WALK : WALK * 0.68) * doseOf(o.id) / STRIDE;
      }
      poseAvatar(o, dt);
    }
  }
  function poseAvatar(o, dt) {
    const showProps = o.ai.state === 'action';
    for (const p of o.props) p.visible = showProps;
    o.body.position.copy(o.pos); o.body.rotation.y = o.bodyYaw;
    o.mixer.update(reduce ? 0 : dt);
  }

  // ---- Multiplayer (docs/multiplayer.md, item 6) ------------------------------------------------------------
  // Each screen moves its own astronaut; the host also moves the AI ones. Everyone sends the astronauts it moves
  // as poses (~10 Hz) and draws the others from theirs.
  const net = () => window.ASTRO_NET, mp = () => !!net() && net().mode !== 'solo';
  const POSE_MS = 100, POSE_IDLE_MS = 1000, SNAP_M = 5, FOLLOW_RATE = 10; // game-balance
  // 'me', 'ai' (solo, or the host for crew no player moves) or 'player' (drawn from the poses of another screen).
  function driverOf(id) {
    if (world?.avatar?.id === id) return 'me';
    if (!mp()) return 'ai';
    if (net().isGuest) return 'player';
    const peer = sim()?.surf.control?.[id];
    return peer && peer !== net().you.id ? 'player' : 'ai';
  }
  function takePose(data) {
    for (const [id, p] of Object.entries(data?.av || {})) {
      const o = world?.avatars.get(id);
      if (o && driverOf(id) === 'player' && [p.x, p.y, p.z, p.yaw].every(Number.isFinite)) o.net = p;
    }
  }
  window.ASTRO_NET?.on('pose', data => { if (s.ready) takePose(data); });
  // Glide toward the last pose; a jump of more than SNAP_M (a teleport) lands at once.
  function followRemote(o, dt) {
    if (!o.wasRemote) { o.wasRemote = true; o.net = null; } // just handed to another screen: wait for its poses
    const t = o.net;
    if (t) {
      const far = Math.hypot(t.x - o.pos.x, t.z - o.pos.z) > SNAP_M, f = far ? 1 : 1 - Math.exp(-dt * FOLLOW_RATE);
      o.pos.x += (t.x - o.pos.x) * f; o.pos.y += (t.y - o.pos.y) * f; o.pos.z += (t.z - o.pos.z) * f;
      o.bodyYaw = far ? t.yaw : stepYaw(o.bodyYaw, t.yaw, dt * 10);
      const anim = ['idle', 'walk', 'wave', 'salute', 'action'].includes(t.anim) ? t.anim : 'idle';
      if (anim !== o.ai.state) {
        if (anim === 'wave') { o.action.stop(); o.salute.stop(); o.wave.reset().play(); } else o.wave.stop();
        if (anim === 'salute') { o.action.stop(); o.wave.stop(); o.salute.reset().play(); } else o.salute.stop();
        if (anim === 'action') o.action.reset().play();
        o.ai.state = anim;
      }
    }
    const waveW = o.ai.state === 'wave' ? 1 : 0, saluteW = o.ai.state === 'salute' ? 1 : 0, rest = 1 - Math.max(waveW, saluteW);
    o.walkW += ((o.ai.state === 'walk' ? 1 : 0) - o.walkW) * Math.min(1, dt * 8);
    o.actW += ((o.ai.state === 'action' ? 1 : 0) - o.actW) * Math.min(1, dt * 8);
    if (o.ai.state !== 'action' && o.actW < .02) { o.action.stop(); o.actW = 0; }
    o.walk.setEffectiveWeight(o.walkW * (1 - o.actW) * rest); o.idle.setEffectiveWeight((1 - o.walkW) * (1 - o.actW) * rest);
    o.action.setEffectiveWeight(o.actW * rest); o.wave.setEffectiveWeight(waveW); o.salute.setEffectiveWeight(saluteW);
    o.walk.timeScale = clamp((t?.spd || STRIDE) / STRIDE, .6, 2.6);
  }
  const r2 = v => Math.round(v * 100) / 100;
  let poseClock = 0, poseText = '', poseSentAt = 0;
  function sendPoses(now) {
    const a = world.avatar, av = {}, kind = s.emote?.kind;
    av[a.id] = { x: r2(s.pos.x), y: r2(s.pos.y), z: r2(s.pos.z), yaw: r2(s.bodyYaw),
      anim: kind === 'wave' || kind === 'salute' || kind === 'action' ? kind : kind === 'walk' || s.speed > 0 ? 'walk' : 'idle', spd: r2(kind === 'walk' ? STRIDE : s.speed) };
    if (net().isHost) for (const o of world.avatars.values()) {
      if (o !== a && driverOf(o.id) === 'ai') av[o.id] = { x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z), yaw: r2(o.bodyYaw), anim: o.ai.state, spd: o.ai.state === 'walk' ? r2(WALK * .68) : 0 };
    }
    const text = JSON.stringify(av);
    if (text === poseText && now - poseSentAt < POSE_IDLE_MS) return;
    poseText = text; poseSentAt = now;
    net().pose({ av });
  }
  function placeCamera() {
    const { camera, avatar: a } = world;
    fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    if (s.mode === 'first') {
      a.body.updateMatrixWorld(true);
      if (reduce) eye.set(s.pos.x, s.pos.y + a.eyeY, s.pos.z); else a.head.getWorldPosition(eye);
      // Eyes in front of the suit; further forward when looking down, so the chest, legs and feet come into view.
      camera.position.copy(eye).addScaledVector(fwd, .3 + .22 * Math.max(0, -Math.sin(s.pitch))); camera.position.y += .14;
      camera.rotation.set(s.pitch, s.yaw, 0);
    } else {
      look.copy(s.pos); look.y += 1.45;
      const cp = Math.cos(s.pitch);
      camera.position.copy(look).add(tmp.set(Math.sin(s.yaw) * cp, -Math.sin(s.pitch), Math.cos(s.yaw) * cp).multiplyScalar(4.4));
      camera.position.y = Math.max(camera.position.y, world.hf.at(camera.position.x, camera.position.z) + .4);
      camera.lookAt(look);
    }
  }
  function updateHud() {
    let nearestId = null, nearestDist = Infinity;
    for (const b of world.blocks) {
      const e = b.userData.exp, li = document.querySelector(`[data-goal="${e.id}"]`), dx = b.position.x - s.pos.x, dz = b.position.z - s.pos.z, dist = Math.hypot(dx, dz);
      const done = isDone(e.id);
      if (!done && dist < nearestDist) { nearestDist = dist; nearestId = e.id; }
      li.classList.toggle('done', done); li.classList.toggle('here', dist <= REACH);
      if (done && !b.userData.done) markDone(b); // also when another player finished it
      li.querySelector('.goal-dist').textContent = done ? t('surface.done') : U.distanceM(dist, 0);
      li.querySelector('.goal-arrow').style.rotate = `${Math.atan2(dx, -dz) + s.yaw}rad`; // bearing from north, relative to the view
    }
    if (!nearestId && world.blocks.length) nearestId = world.blocks[0].userData.exp.id;
    for (const b of world.blocks) {
      const e = b.userData.exp;
      document.querySelector(`[data-goal="${e.id}"]`)?.classList.toggle('is-nearest', e.id === nearestId);
    }
    const surf = sim()?.surf;
    $s('surface-count').textContent = t('surface.countDone', { done: surf?.completed.size ?? 0, total: tasks().length });
    const b = nearBlock(), e = b?.userData.exp, owner = e && ui.crew.find(c => c.id === e.crew);
    const state = e ? (isDone(e.id) ? 'done' : e.crew === s.crew ? 'run' : 'locked') : nearLander() ? 'board' : '';
    const key = state + (e?.id ?? '') + s.crew;
    if (key === s.prompt) return;
    s.prompt = key; promptEl.hidden = !state; promptEl.disabled = state === 'locked' || state === 'done';
    if (!state) return;
    promptEl.className = 'surface-prompt' + (state === 'run' || state === 'board' ? '' : ' ' + state);
    const keyLabel = t(touch ? 'surface.tapAction' : 'surface.keyAction');
    promptEl.textContent = state === 'board' ? t('surface.promptBoard', { key: keyLabel, done: surf?.completed.size ?? 0, total: tasks().length })
      : state === 'done' ? t('surface.promptDone', { id: e.id, title: e.title })
      : state === 'run' ? t('surface.promptRun', { key: keyLabel, id: e.id, title: e.title })
      : t('surface.promptLocked', { id: e.id, name: owner.name });
  }
  const v = new THREE.Vector3();
  function placeTags(now) {
    const { camera } = world;
    for (const b of world.blocks) {
      const { tag, gem, beam, exp } = b.userData, dist = Math.hypot(b.position.x - s.pos.x, b.position.z - s.pos.z);
      if (!reduce) { gem.rotation.y = now / 700; gem.position.y = 2.2 + Math.sin(now / 500 + b.position.x) * .12; beam.material.opacity = .22 + .1 * Math.sin(now / 400); }
      v.copy(b.position); v.y += 2.8; v.project(camera);
      const show = v.z < 1 && dist < 260;
      tag.hidden = !show;
      if (!show) continue;
      tag.textContent = isDone(exp.id) ? `${exp.id} ✓` : `${exp.id} · ${U.distanceM(dist, 0)}`;
      tag.style.transform = `translate(${(v.x + 1) / 2 * world.width}px, ${(1 - v.y) / 2 * world.height}px)`;
    }
  }
  window.addEventListener('astro:settings', () => {
    syncTouchLabels();
    const banner = document.querySelector('#minigame-dialog .minigame-complete strong'); // card from web/experiment-run.js
    if (banner) banner.textContent = t('minigames.completeBanner');
    if (!world || !s.ready) return;
    $s('surface-goals').innerHTML = tasks().map(e => { const o = ui.crew.find(c => c.id === e.crew);
      return `<li data-goal="${e.id}" style="--crew:${o.color}"><span class="goal-chip"></span><span class="goal-name"><strong>${e.id} · ${e.title}</strong><small>${o.name}</small></span><span class="goal-dist"></span><span class="goal-arrow"></span></li>`; }).join('');
    buildCompass();
    renderCrewBar();
    s.prompt = '';
    updateHud();
  });

  // Two-stage rocket departure cutscene:
  // Stage 1 (0..2.1s): ground camera watching the lander ignite and lift off into the Martian sky.
  // Stage 2 (2.1..5.2s): camera attached to the rising rocket hull looking down at any crew members left behind waving both arms.
  function playDeparture(strandedIds = []) {
    return new Promise(resolve => {
      if (!world || !s.ready || !world.hf) { resolve(); return; }
      if (document.pointerLockElement === world.renderer.domElement) document.exitPointerLock();
      if (dlg.open) dlg.close();
      closeWheel(false);
      endEmote();
      const strandedSet = new Set(strandedIds);
      let idx = 0;
      for (const [id, a] of world.avatars) {
        for (const m of a.helmet) m.material = m.userData.mat;
        for (const p of a.props) p.visible = false;
        a.action.stop(); a.wave.stop(); a.salute.stop();
        a.walk.setEffectiveWeight(0); a.idle.setEffectiveWeight(1);
        if (!strandedSet.has(id)) {
          a.body.visible = false;
          continue;
        }
        a.body.visible = true;
        if (a === world.avatar) a.pos.copy(s.pos);
        // Bring far-off stranded astronauts near the pad perimeter (8..11 m) as if they ran up just too late, so the rocket camera frames them clearly.
        const d = Math.hypot(a.pos.x, a.pos.z);
        if (d > 12 || d < 4.5) {
          const baseAng = d > 0.5 ? Math.atan2(a.pos.x, a.pos.z) : (idx - 0.5) * 0.55;
          const targetR = 7.8 + idx * 1.4;
          a.pos.x = Math.sin(baseAng) * targetR;
          a.pos.z = Math.cos(baseAng) * targetR;
        }
        a.pos.y = world.hf.at(a.pos.x, a.pos.z);
        a.bodyYaw = Math.atan2(-a.pos.x, -a.pos.z);
        a.body.position.copy(a.pos);
        a.body.rotation.set(0, a.bodyYaw, 0);
        idx++;
      }
      const groundY = world.hf.at(0, 0);
      s.departing = { t: 0, duration: 5.2, switchAt: 2.1, groundY, stranded: [...strandedSet], resolve };
    });
  }

  let last = performance.now(), hudClock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    // Leaving the surface (timer, results) must give the mouse back.
    if (world && document.pointerLockElement === world.renderer.domElement && !isActive('surface')) document.exitPointerLock();
    if (!world || !s.ready || !world.avatar || !isActive('surface') || !world.width) return;
    if (s.departing) {
      const d = s.departing;
      d.t += dt;
      const climb = Math.max(0, d.t - 0.25);
      const rocketY = d.groundY + climb * climb * 2.5;
      world.lander.position.set((Math.random() - .5) * .03, rocketY, (Math.random() - .5) * .03);
      // Retract the boarding ladder and fold up the landing legs as the lander lifts off the pad.
      world.lander.userData.setGear?.((d.t - 0.15) / 1.55);
      const plume = world.lander.userData.plume, engineLight = world.lander.userData.engineLight;
      if (plume) {
        plume.visible = true;
        const flicker = .88 + Math.sin(now * .06) * .18;
        plume.scale.set(flicker, .85 + Math.cos(now * .08) * .25, flicker);
      }
      if (engineLight) engineLight.intensity = 22 + Math.sin(now * .05) * 6;
      let fx = 0, fy = d.groundY, fz = 7.5;
      if (d.stranded.length) {
        let sx = 0, sy = 0, sz = 0;
        d.stranded.forEach((id, i) => {
          const a = world.avatars.get(id);
          if (!a) return;
          a.idle.setEffectiveWeight(1); a.walk.setEffectiveWeight(0);
          a.mixer.update(dt);
          // Raise and wave BOTH arms furiously while looking up at the departing rocket.
          const phase = now * 0.016 + i * 1.4, wL = Math.sin(phase) * 0.55, wR = Math.sin(phase + 0.35) * 0.55;
          if (a.upperArmL) a.upperArmL.rotation.set(-2.55, 0, 0.52 + wL);
          if (a.lowerArmL) a.lowerArmL.rotation.set(-0.35, 0, wL * 0.65);
          if (a.upperArmR) a.upperArmR.rotation.set(-2.55, 0, -0.52 - wR);
          if (a.lowerArmR) a.lowerArmR.rotation.set(-0.35, 0, -wR * 0.65);
          if (a.head) a.head.rotation.x = -0.58;
          const hop = reduce ? 0 : Math.max(0, Math.sin(now * 0.012 + i * 1.7)) * 0.22;
          const gy = world.hf.at(a.pos.x, a.pos.z);
          a.bodyYaw = Math.atan2(-a.pos.x, -a.pos.z);
          a.body.position.set(a.pos.x, gy + hop, a.pos.z);
          a.body.rotation.set(0, a.bodyYaw, 0);
          sx += a.pos.x; sy += gy; sz += a.pos.z;
        });
        fx = sx / d.stranded.length; fy = sy / d.stranded.length; fz = sz / d.stranded.length;
      }
      const { camera } = world;
      for (const b of world.blocks) if (b.userData.tag) b.userData.tag.hidden = true;
      promptEl.hidden = false; promptEl.disabled = true;
      promptEl.className = 'surface-prompt locked';
      if (d.t < d.switchAt) {
        // Stage 1: ground camera watching the rocket ignite and climb into the Martian sky.
        camera.fov = 66; camera.updateProjectionMatrix();
        camera.position.set(-10.5, d.groundY + 1.8, 12.5);
        camera.lookAt(0, rocketY + 2.2, 0);
        promptEl.textContent = t('surface.departingStandby');
      } else {
        // Stage 2: camera mounted on the rising rocket hull looking down at the stranded astronauts waving their arms.
        const fDist = Math.hypot(fx, fz) || 1, dirX = fx / fDist, dirZ = fz / fDist;
        const camProg = clamp((d.t - d.switchAt) / (d.duration - d.switchAt), 0, 1);
        camera.fov = 56 - camProg * 18; camera.updateProjectionMatrix();
        camera.position.set(dirX * 2.05, rocketY + 0.55, dirZ * 2.05);
        camera.lookAt(fx * 0.88, fy + 1.05, fz * 0.88);
        const strandedNames = d.stranded.map(id => ui.crew.find(c => c.id === id)?.name ?? id).join(', ');
        promptEl.textContent = d.stranded.length ? t('surface.departingStranded', { names: strandedNames }) : t('surface.departingStandby');
      }
      world.sky.position.copy(camera.position);
      world.sun.target.position.set(0, d.groundY, 0);
      world.sun.position.set(0, d.groundY, 0).addScaledVector(world.sunDir, 90);
      world.renderer.render(world.scene, camera);
      if (d.t >= d.duration) {
        const done = d.resolve;
        s.departing = null;
        if (plume) plume.visible = false;
        if (engineLight) engineLight.intensity = 0;
        world.lander.userData.setGear?.(0);
        camera.fov = 72; camera.updateProjectionMatrix();
        for (const a of world.avatars.values()) a.body.visible = true;
        done();
      }
      return;
    }
    if (!dlg.open) step(dt); else if (mp()) step(dt, false);
    if (mp() && (poseClock += dt * 1000) >= POSE_MS) { poseClock = 0; sendPoses(now); }
    placeCamera();
    world.sky.position.copy(world.camera.position);
    world.sun.target.position.copy(s.pos); world.sun.position.copy(s.pos).addScaledVector(world.sunDir, 90);
    placeTags(now); updateCompass();
    if ((hudClock += dt) > .12) { hudClock = 0; updateHud(); }
    world.renderer.render(world.scene, world.camera);
  }
  requestAnimationFrame(frame);
  // Test and debug hook (Playwright, console): state, and a teleport next to a block.
  window.ASTRO_SURFACE = { state: s, world: () => world, emote: kind => playEmote(kind), wheel: open => (open ? openWheel(false) : closeWheel(false)),
    running: () => !!(s.ready && startEl.hidden && !dlg.open && !s.departing), loaded: () => !!(s.ready && startEl.hidden),
    boardReach: BOARD_REACH, boardSafeReach: BOARD_SAFE_R, playDeparture,
    distanceToLander(id) { const a = world?.avatars.get(id); if (!a) return 0; const p = a === world.avatar ? s.pos : a.pos; return Math.hypot(p.x, p.z); },
    goTo(id) { const b = world?.blocks.find(x => x.userData.exp.id === id); if (b) { s.pos.x = b.position.x + 2.2; s.pos.z = b.position.z + 1.2; s.yaw = Math.atan2(-(b.position.x - s.pos.x), -(b.position.z - s.pos.z)); s.grounded = false; } } };
  // index.html#surface or #surface-gale opens the surface directly (quick testing).
  const direct = /^#surface(?:-(\w+))?$/.exec(location.hash);
  if (direct) { if (ui.sites[direct[1]]) ui.state.site = direct[1]; ui.land(); }
})();

})().catch(error => console.warn('views 3D unavailable:', error));
