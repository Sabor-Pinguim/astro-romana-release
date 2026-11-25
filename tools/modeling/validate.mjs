// Validates every model listed in assets/models/manifest.json:
//   1. Khronos glTF Validator (spec errors fail the run)
//   2. Project rules: rig pivots, required clips, FX anchors, triangle budget,
//      no textures, size and ground placement (avatars, parts); radius, relief,
//      palette and site anchors (celestial bodies).
//
//   npm run models:validate
import './lib/node-polyfills.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BODY_MATERIALS } from './lib/palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS_DIR = path.join(ROOT, 'assets/models');

const HELMET_TOP_RANGE = [1.75, 1.95]; // meters: body height = top of the helmet (or of the head, without one) in the rest pose
const MAX_TOTAL_HEIGHT = 2.4; // meters, including accessories such as antennas
const GROUND_TOLERANCE = 0.01; // the lowest point must sit on y = 0
const MAX_MESHES = 50; // ≈ draw calls per avatar (see AGENTS.md §5.3)
const MAX_BYTES = 400 * 1024;

function parseGlb(file, buffer) {
  return new Promise((resolve, reject) => {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    new GLTFLoader().parse(arrayBuffer, '', resolve, (e) => reject(new Error(`${file}: ${e.message ?? e}`)));
  });
}

async function validateModel(entry, conventions) {
  const problems = [];
  const file = path.join(MODELS_DIR, entry.file);
  const bytes = await readFile(file);

  // 1. Khronos validator.
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: entry.file, maxIssues: 50 });
  for (const message of report.issues.messages) {
    if (message.severity === 0) problems.push(`glTF error ${message.code}: ${message.message} (${message.pointer ?? ''})`);
  }

  // 2. Project rules.
  const gltf = await parseGlb(entry.file, bytes);
  const scene = gltf.scene;
  const names = new Set();
  scene.traverse((o) => names.add(o.name));

  for (const pivot of conventions.pivots) {
    if (!names.has(pivot)) problems.push(`missing rig pivot "${pivot}"`);
  }
  const clipNames = gltf.animations.map((a) => a.name);
  for (const clip of conventions.requiredClips) {
    if (!clipNames.includes(clip)) problems.push(`missing animation "${clip}"`);
  }
  for (const fx of entry.fx ?? []) {
    if (!names.has(fx.anchor)) problems.push(`FX anchor "${fx.anchor}" listed in manifest but not in the model`);
    for (const clip of fx.clips ?? []) {
      if (!clipNames.includes(clip)) problems.push(`FX "${fx.anchor}" references unknown clip "${clip}"`);
    }
  }

  let triangles = 0;
  let meshes = 0;
  let textures = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const value of Object.values(o.material)) if (value?.isTexture) textures++;
  });
  if (triangles > entry.budget.triangles) problems.push(`${triangles} triangles > budget ${entry.budget.triangles}`);
  if (meshes > MAX_MESHES) problems.push(`${meshes} meshes > ${MAX_MESHES}`);
  if (bytes.byteLength > MAX_BYTES) problems.push(`${(bytes.byteLength / 1024).toFixed(0)} KB > ${MAX_BYTES / 1024} KB`);
  if (textures > 0) problems.push(`${textures} textures found; avatars use flat palette colors only`);

  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const height = bounds.max.y - bounds.min.y;
  if (height > MAX_TOTAL_HEIGHT) problems.push(`total height ${height.toFixed(2)} m > ${MAX_TOTAL_HEIGHT} m`);
  if (Math.abs(bounds.min.y) > GROUND_TOLERANCE) problems.push(`feet at y = ${bounds.min.y.toFixed(3)}, expected 0`);

  const helmet = scene.getObjectByName('Head_Helmet');
  const top = helmet ? 'helmet top' : 'head top';
  const head = helmet ?? scene.getObjectByName('Head');
  const helmetTop = head ? new THREE.Box3().setFromObject(head).max.y : NaN;
  if (!(helmetTop >= HELMET_TOP_RANGE[0] && helmetTop <= HELMET_TOP_RANGE[1])) {
    problems.push(`${top} at ${helmetTop.toFixed(2)} m, expected ${HELMET_TOP_RANGE.join('–')} m`);
  }

  return {
    problems,
    summary: `${triangles} tris, ${meshes} meshes, ${clipNames.length} clips, ` +
      `${top} ${helmetTop.toFixed(2)} m, total ${height.toFixed(2)} m, ` +
      `${report.issues.numWarnings} warnings, ${report.issues.numInfos} infos`,
  };
}

async function validatePortrait(entry) {
  const bytes = await readFile(path.join(MODELS_DIR, entry.file));
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: entry.file, maxIssues: 50 });
  const problems = report.issues.messages.filter(issue => issue.severity === 0).map(issue => `${issue.code}: ${issue.message}`);
  const gltf = await parseGlb(entry.file, bytes);
  let triangles = 0, meshes = 0, textures = 0;
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    for (const value of Object.values(o.material)) if (value?.isTexture) textures++;
  });
  if (triangles > 3000) problems.push(`${triangles} triangles > portrait budget 3000`);
  if (meshes > 50) problems.push(`${meshes} meshes > portrait budget 50`);
  if (bytes.length > MAX_BYTES) problems.push(`${bytes.length} bytes > portrait budget ${MAX_BYTES}`);
  if (textures) problems.push(`${textures} textures found`);
  return { problems, summary: `${triangles} tris, ${meshes} meshes, ${(bytes.length / 1024).toFixed(1)} KB` };
}

const DEFAULT_PART_MESH_BUDGET = {
  engines: 10,
  tanks: 8,
  equipment: 12,
  cabin: 12,
  structures: 8,
};

async function validatePart(entry, manifest) {
  const problems = [];
  const file = path.join(MODELS_DIR, entry.file);
  const bytes = await readFile(file);

  // 1. Khronos validator.
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: entry.file, maxIssues: 50 });
  for (const message of report.issues.messages) {
    if (message.severity === 0) problems.push(`glTF error ${message.code}: ${message.message} (${message.pointer ?? ''})`);
  }

  // 2. Project rules.
  const gltf = await parseGlb(entry.file, bytes);
  const scene = gltf.scene;
  const names = new Set();
  const fxNodes = new Map();
  scene.traverse((o) => {
    if (o.name) {
      names.add(o.name);
      if (o.name.startsWith('FX_')) fxNodes.set(o.name, o);
    }
  });

  if (!names.has('Attach_Top')) problems.push('missing Attach_Top anchor');
  if (['tanks', 'equipment', 'cabin', 'cockpit', 'structures'].includes(entry.category) && !names.has('Attach_Bottom')) {
    problems.push('missing Attach_Bottom anchor');
  }
  if (entry.category === 'engines' && !names.has('FX_Exhaust')) {
    problems.push('missing FX_Exhaust anchor');
  }
  if (entry.category === 'cockpit') {
    for (const reqNode of [
      'Camera_Pilot',
      'Joystick_RHC',
      'Controller_THC',
      'Throttle_Lever',
      'Breaker_Bank',
      'Stage_Sep_Switch',
      'EDL_Arm_Switch',
      'Abort_Button',
      'Alarm_Master_Red',
      'Alarm_Caution_Amber',
      'FX_Sparks_Left',
      'FX_Sparks_Right',
      // The 4-seat cabin (Orion layout): a camera per seat, the panel frame and the lower-seat displays.
      'Camera_Seat_1',
      'Camera_Seat_2',
      'Camera_Seat_3',
      'Camera_Seat_4',
      'Seat_1',
      'Seat_2',
      'Seat_3',
      'Seat_4',
      'Panel_Frame',
      'Screen_Seat_3',
      'Screen_Seat_4',
    ]) {
      if (!names.has(reqNode)) problems.push(`missing cockpit node "${reqNode}"`);
    }
  }

  for (const fx of entry.fx ?? []) {
    if (!names.has(fx.anchor)) problems.push(`FX anchor "${fx.anchor}" listed in manifest but not in the model`);
    if (fx.preset && !manifest.fxPresets?.[fx.preset]) {
      problems.push(`FX "${fx.anchor}" references unknown preset "${fx.preset}"`);
    }
  }
  for (const [anchorName, node] of fxNodes) {
    const preset = node.userData?.fx;
    if (preset && !manifest.fxPresets?.[preset]) {
      problems.push(`FX node "${anchorName}" carries unknown preset "${preset}"`);
    }
  }

  let triangles = 0;
  let meshes = 0;
  let textures = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const value of Object.values(o.material)) if (value?.isTexture) textures++;
  });

  const triBudget = entry.budget?.triangles ?? 1500;
  const meshBudget = entry.budget?.meshes ?? DEFAULT_PART_MESH_BUDGET[entry.category] ?? 12;
  if (triangles > triBudget) problems.push(`${triangles} triangles > budget ${triBudget}`);
  if (meshes > meshBudget) problems.push(`${meshes} meshes > budget ${meshBudget}`);
  if (bytes.byteLength > MAX_BYTES) problems.push(`${(bytes.byteLength / 1024).toFixed(0)} KB > ${MAX_BYTES / 1024} KB`);
  if (textures > 0) problems.push(`${textures} textures found; parts use flat palette colors only`);

  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  if (entry.category === 'equipment') {
    if (size.x > 0.76 + 1e-4) problems.push(`width ${size.x.toFixed(3)} m > 0.76 m`);
    if (size.y > 0.78 + 1e-4) problems.push(`height ${size.y.toFixed(3)} m > 0.78 m`);
    if (size.z > 0.76 + 1e-4) problems.push(`depth ${size.z.toFixed(3)} m > 0.76 m`);
    if (Math.abs(bounds.min.y) > GROUND_TOLERANCE) {
      problems.push(`base at y = ${bounds.min.y.toFixed(3)} m, expected 0`);
    }
  } else if (entry.category === 'cabin') {
    if (size.x > 0.70 + 1e-4) problems.push(`width ${size.x.toFixed(3)} m > 0.70 m`);
    if (size.y > 0.74 + 1e-4) problems.push(`height ${size.y.toFixed(3)} m > 0.74 m`);
    if (size.z > 0.60 + 1e-4) problems.push(`depth ${size.z.toFixed(3)} m > 0.60 m`);
    if (Math.abs(bounds.min.y) > GROUND_TOLERANCE) {
      problems.push(`base at y = ${bounds.min.y.toFixed(3)} m, expected 0`);
    }
  } else if (entry.category === 'cockpit') {
    // Crew cabin with 4 reclined seats, two over two (references/parts/cockpit/cockpit-pilot/README.md).
    if (size.x > 2.40 + 1e-4) problems.push(`width ${size.x.toFixed(3)} m > 2.40 m`);
    if (size.y > 2.30 + 1e-4) problems.push(`height ${size.y.toFixed(3)} m > 2.30 m`);
    if (size.z > 2.30 + 1e-4) problems.push(`depth ${size.z.toFixed(3)} m > 2.30 m`);
    if (Math.abs(bounds.min.y) > GROUND_TOLERANCE) {
      problems.push(`base at y = ${bounds.min.y.toFixed(3)} m, expected 0`);
    }
  }

  // 3. Game specs validation (AGENTS.md §4 & §8).
  const s = entry.specs;
  if (!s) {
    problems.push('missing specs block');
  } else {
    if (!(typeof s.massDryKg === 'number' && s.massDryKg >= 0)) problems.push('specs.massDryKg must be >= 0');
    if (!(typeof s.costM === 'number' && s.costM > 0)) problems.push('specs.costM must be > 0');
    if (typeof s.powerW !== 'number') problems.push('specs.powerW must be a number');
    if (!s.sources || Object.keys(s.sources).length === 0) problems.push('specs.sources must document value origins');
    if (entry.category === 'engines') {
      if (!(s.thrustVacKn > 0)) problems.push('engine specs.thrustVacKn must be > 0');
      if (!(s.ispVacS > 0)) problems.push('engine specs.ispVacS must be > 0');
    } else if (entry.category === 'tanks') {
      if (!(s.propellantMassKg > 0)) problems.push('tank specs.propellantMassKg must be > 0');
    }
  }

  return {
    problems,
    summary: `${triangles} tris, ${meshes} meshes, ` +
      `${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m, ` +
      `${s ? `${s.massDryKg} kg, $${s.costM}M, ` : ''}${report.issues.numWarnings} warnings`,
  };
}

const RADIUS_TOLERANCE = 1e-4; // body radii

async function validateBody(entry) {
  const problems = [];
  const bytes = await readFile(path.join(MODELS_DIR, entry.file));

  // 1. Khronos validator.
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: entry.file, maxIssues: 50 });
  for (const message of report.issues.messages) {
    if (message.severity === 0) problems.push(`glTF error ${message.code}: ${message.message} (${message.pointer ?? ''})`);
  }

  // 2. Project rules: one root node, palette materials only, radius 1 plus exaggerated relief.
  const gltf = await parseGlb(entry.file, bytes);
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  if (scene.children.length !== 1 || scene.children[0].name !== entry.nodeName) {
    problems.push(`expected one root node named "${entry.nodeName}"`);
  }

  const maxRadius = 1 + (entry.reliefExaggeration * entry.maxHeightMeters) / entry.radiusMeters + RADIUS_TOLERANCE;
  let triangles = 0;
  let meshes = 0;
  let textures = 0;
  let minR = Infinity;
  let maxR = 0;
  const p = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const position = o.geometry.attributes.position;
    triangles += (o.geometry.index ? o.geometry.index.count : position.count) / 3;
    if (!BODY_MATERIALS.includes(o.material.name)) problems.push(`material "${o.material.name}" is not in the body palette`);
    for (const value of Object.values(o.material)) if (value?.isTexture) textures++;
    for (let i = 0; i < position.count; i++) {
      const r = p.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld).length();
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
  });
  if (triangles > entry.budget.triangles) problems.push(`${triangles} triangles > budget ${entry.budget.triangles}`);
  if (meshes > entry.budget.meshes) problems.push(`${meshes} meshes > budget ${entry.budget.meshes}`);
  if (bytes.byteLength > entry.budget.bytes) {
    problems.push(`${(bytes.byteLength / 1024).toFixed(0)} KB > ${(entry.budget.bytes / 1024).toFixed(0)} KB`);
  }
  if (textures > 0) problems.push(`${textures} textures found; bodies use flat palette colors only`);
  if (minR < 1 - RADIUS_TOLERANCE) problems.push(`vertex below the surface: radius ${minR.toFixed(5)} < 1`);
  if (maxR > maxRadius) problems.push(`vertex radius ${maxR.toFixed(5)} > ${maxRadius.toFixed(5)} (relief × max height)`);

  for (const site of entry.sites ?? []) {
    const node = scene.getObjectByName(site.node);
    if (!node) {
      problems.push(`site anchor "${site.node}" listed in manifest but not in the model`);
      continue;
    }
    const r = node.getWorldPosition(p).length();
    if (r < 1 - 2e-3 || r > maxRadius) problems.push(`site "${site.node}" at radius ${r.toFixed(4)}, off the surface`);
  }

  return {
    problems,
    summary: `${triangles} tris, ${meshes} meshes, radius ${minR.toFixed(4)}–${maxR.toFixed(4)}, ` +
      `${(bytes.byteLength / 1024).toFixed(0)} KB, ${report.issues.numWarnings} warnings`,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(MODELS_DIR, 'manifest.json'), 'utf8'));
  let failed = 0;
  for (const entry of manifest.models) {
    const { problems, summary } = await validateModel(entry, manifest.conventions);
    if (problems.length) {
      failed++;
      console.log(`✘ ${entry.id}: ${summary}`);
      for (const p of problems) console.log(`    - ${p}`);
    } else {
      console.log(`✔ ${entry.id}: ${summary}`);
    }
  }
  for (const entry of manifest.portraits ?? []) {
    const { problems, summary } = await validatePortrait(entry);
    if (problems.length) {
      failed++;
      console.log(`✘ [portrait] ${entry.id}: ${summary}`);
      for (const p of problems) console.log(`    - ${p}`);
    } else console.log(`✔ [portrait] ${entry.id}: ${summary}`);
  }
  for (const entry of manifest.parts ?? []) {
    const { problems, summary } = await validatePart(entry, manifest);
    if (problems.length) {
      failed++;
      console.log(`✘ [${entry.category}] ${entry.id}: ${summary}`);
      for (const p of problems) console.log(`    - ${p}`);
    } else {
      console.log(`✔ [${entry.category}] ${entry.id}: ${summary}`);
    }
  }
  for (const entry of manifest.bodies ?? []) {
    const { problems, summary } = await validateBody(entry);
    if (problems.length) {
      failed++;
      console.log(`✘ [body] ${entry.id}: ${summary}`);
      for (const p of problems) console.log(`    - ${p}`);
    } else {
      console.log(`✔ [body] ${entry.id}: ${summary}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} model(s) failed validation`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
