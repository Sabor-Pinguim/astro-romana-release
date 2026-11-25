// Builds the 52 low-poly rocket parts (13 engines + 8 tanks + 16 equipment + 12 cabin + 1 cockpit + 2 structures) as GLB files plus
// assets/models/parts/manifest.json and updates the `parts` section of
// assets/models/manifest.json.
//
//   npm run models:build:parts             # all 52 parts
//   npm run models:build:parts -- raptor   # only selected parts
//
// Output: assets/models/parts/<engines|tanks|equipment|cabin|cockpit|structures>/<id>.glb
import './lib/node-polyfills.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { FX_PRESETS } from './lib/fx-presets.mjs';
import allParts from './parts/index.mjs';
import { PART_SPECS, MISSION_RULES } from './parts/specs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS_DIR = path.join(ROOT, 'assets/models');
const MANIFEST = path.join(MODELS_DIR, 'manifest.json');
const PARTS_MANIFEST = path.join(MODELS_DIR, 'parts/manifest.json');

function countStats(root) {
  let triangles = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return { triangles, meshes };
}

const COCKPIT_PIVOT_NAMES = new Set([
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
]);

function collectNodeNames(root) {
  const names = [];
  root.traverse((o) => {
    if (
      o.name &&
      (o.name.startsWith('Attach_') ||
        o.name === 'Gimbal' ||
        o.name.startsWith('FX_') ||
        COCKPIT_PIVOT_NAMES.has(o.name))
    ) {
      names.push(o.name);
    }
  });
  return names;
}

async function buildPart(def, exporter) {
  const built = def.build();
  const root = built.finish();
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const glb = await exporter.parseAsync(root, { binary: true, trs: true, onlyVisible: true });
  const file = `parts/${def.category}/${def.id}.glb`;
  const outPath = path.join(MODELS_DIR, file);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(glb));
  if (def.id === 'cockpit-pilot') {
    const rocketCopy = path.join(MODELS_DIR, 'rocket/cockpit_pilot.glb');
    await mkdir(path.dirname(rocketCopy), { recursive: true });
    await writeFile(rocketCopy, Buffer.from(glb));
  }

  const stats = countStats(root);
  if (stats.triangles > built.budget.triangles) {
    throw new Error(`${def.id}: ${stats.triangles} triangles exceeds budget ${built.budget.triangles}`);
  }
  if (stats.meshes > built.budget.meshes) {
    throw new Error(`${def.id}: ${stats.meshes} meshes exceeds budget ${built.budget.meshes}`);
  }
  const specs = PART_SPECS[def.id];
  if (!specs) {
    throw new Error(`${def.id}: missing game specs in tools/modeling/parts/specs.mjs`);
  }

  return {
    id: def.id,
    name: def.displayName,
    nodeName: def.name,
    category: def.category,
    tier: def.tier,
    vehicle: def.vehicle,
    role: def.role,
    file,
    summary: def.summary,
    originNote: def.originNote,
    requiredNodes: collectNodeNames(root),
    fx: built.fx,
    dimensions: {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3)),
      minY: Number(bounds.min.y.toFixed(3)),
      maxY: Number(bounds.max.y.toFixed(3)),
    },
    specs,
    budget: built.budget,
    stats: { ...stats, bytes: glb.byteLength },
    references: def.references,
  };
}

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? allParts.filter((p) => only.includes(p.id)) : allParts;
  if (only.length && selected.length !== only.length) {
    throw new Error(`Unknown part id. Known: ${allParts.map((p) => p.id).join(', ')}`);
  }

  let existingManifest = {};
  try {
    existingManifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    // first build
  }
  // Parts not rebuilt keep their entry: from the main manifest, or from parts/manifest.json
  // when another generator rewrote the main one without the `parts` key.
  let previousParts = existingManifest.parts ?? [];
  if (!previousParts.length) {
    try {
      previousParts = JSON.parse(await readFile(PARTS_MANIFEST, 'utf8')).parts ?? [];
    } catch {
      // first build
    }
  }

  const exporter = new GLTFExporter();
  const builtEntries = [];
  for (const def of selected) {
    const entry = await buildPart(def, exporter);
    builtEntries.push(entry);
    console.log(
      `✔ ${entry.id.padEnd(22)} ${String(entry.stats.triangles).padStart(5)} tris  ` +
        `${String(entry.stats.meshes).padStart(2)} meshes  ${(entry.stats.bytes / 1024).toFixed(1).padStart(5)} KB  → ${entry.file}`,
    );
  }

  const parts = allParts
    .map((p) => builtEntries.find((m) => m.id === p.id) ?? previousParts.find((m) => m.id === p.id))
    .filter(Boolean);

  const generatedAt = new Date().toISOString();

  await mkdir(path.join(MODELS_DIR, 'parts'), { recursive: true });
  await writeFile(
    PARTS_MANIFEST,
    `${JSON.stringify(
      {
        generatedAt,
        generator: 'tools/modeling/build-parts.mjs',
        conventions: {
          units: 'meters',
          up: '+Y',
          forward: '+Z',
          engineOrigin: 'top mounting interface (hangs below y = 0)',
          tankOrigin: 'bottom interface (stands above y = 0)',
          equipmentOrigin: 'bottom mounting plate (stands on y = 0 inside cutaway stage bay)',
          cabinOrigin: 'bottom mounting deck (stands on y = 0 inside cutaway cabin bay)',
          cockpitOrigin: 'cabin floor centre (minY = 0); the crew face -Z; Camera_Seat_1..4 at the eyes of the 4 reclined seats (Camera_Pilot = seat 1)',
          structureOrigin: 'bottom interface (y = 0); Ø 1.00 m normalized builder modules with Attach_* mounting points',
          fxAnchorPrefix: 'FX_',
        },
        fxPresets: FX_PRESETS,
        missionRules: MISSION_RULES,
        parts,
      },
      null,
      2,
    )}\n`,
  );

  const mergedManifest = {
    ...existingManifest,
    generatedAt,
    fxPresets: FX_PRESETS,
    missionRules: MISSION_RULES,
    parts,
  };
  await writeFile(MANIFEST, `${JSON.stringify(mergedManifest, null, 2)}\n`);
  console.log(`✔ manifest → ${path.relative(ROOT, MANIFEST)} (${parts.length} parts)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
