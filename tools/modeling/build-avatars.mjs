// Builds the four low-poly astronaut avatars as GLB files plus a manifest.json that the
// model viewer (tools/model-viewer) and the game (index.html) read.
//
//   npm run models:build          # all characters
//   npm run models:build -- maya  # only some characters
//
// Output: assets/models/characters/<id>.glb and assets/models/manifest.json
import './lib/node-polyfills.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createAvatar, PIVOT_NAMES } from './lib/avatar.mjs';
import { buildClip, idlePose, walkPose, wavePose, salutePose } from './lib/animations.mjs';
import { FX_PRESETS } from './lib/fx-presets.mjs';
import characters from './characters/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'assets/models');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

export const TRIANGLE_BUDGET = 3000;
export const REQUIRED_CLIPS = ['idle_loop', 'walk_loop', 'wave', 'salute', 'action_loop'];

// Real reference photos (NASA Image and Video Library, public domain).
const REFERENCES = [
  { id: 'as17-134-20425', note: 'Apollo 17: Harrison Schmitt com ancinho de coleta, mochila com antena', url: 'https://images.nasa.gov/details/as17-134-20425' },
  { id: 'NHQ201910150003', note: 'xEMU (2019): capacete bolha, mochila azul-marinho com borda vermelha, anel de quadril', url: 'https://images.nasa.gov/details/NHQ201910150003' },
  { id: 'axemu-axiom-suitcover-20230621-dgb-axp00653', note: 'AxEMU (Artemis): faixa azul na perna, pontas das luvas cinza', url: 'https://images.nasa.gov/details/axemu-axiom-suitcover-20230621-dgb-axp00653' },
  { id: 'jsc2024e055570', note: 'EMU (ISS): luzes e câmeras nas laterais do capacete, anel do pescoço', url: 'https://images.nasa.gov/details/jsc2024e055570' },
  { id: 'iss069e003918', note: 'EMU (ISS): módulo de display no peito, painéis da mochila', url: 'https://images.nasa.gov/details/iss069e003918' },
];

function countTriangles(root) {
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

async function buildCharacter(character, exporter) {
  const avatar = createAvatar({ id: character.id, accent: character.accent, visor: character.visor });
  character.build(avatar);

  const footDust = { preset: 'footdust', clips: ['walk_loop'] };
  avatar.anchor('FX_Foot_L', 'Foot_L', { p: [0, -0.11, 0.04] }, footDust);
  avatar.anchor('FX_Foot_R', 'Foot_R', { p: [0, -0.11, 0.04] }, footDust);

  const root = avatar.finish();

  const clips = [
    buildClip(avatar, 'idle_loop', { duration: 3.0, samples: 12, pose: idlePose }),
    buildClip(avatar, 'walk_loop', { duration: 1.1, samples: 16, pose: walkPose }),
    buildClip(avatar, 'wave', { duration: 2.2, samples: 33, pose: wavePose }),
    buildClip(avatar, 'salute', { duration: 2.2, samples: 33, pose: salutePose }),
    buildClip(avatar, 'action_loop', character.action),
  ];

  const glb = await exporter.parseAsync(root, { binary: true, trs: true, onlyVisible: true, animations: clips });
  const file = `characters/${character.id}.glb`;
  await mkdir(path.join(OUT_DIR, 'characters'), { recursive: true });
  await writeFile(path.join(OUT_DIR, file), Buffer.from(glb));

  const stats = countTriangles(root);
  if (stats.triangles > TRIANGLE_BUDGET) {
    throw new Error(`${character.id}: ${stats.triangles} triangles exceeds the budget of ${TRIANGLE_BUDGET}`);
  }

  return {
    id: character.id,
    name: character.name,
    role: character.role,
    accent: character.accent,
    file,
    summary: character.summary,
    equipment: character.equipment,
    animations: character.animations,
    fx: avatar.fx,
    budget: { triangles: TRIANGLE_BUDGET },
    stats: { ...stats, bytes: glb.byteLength },
  };
}

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? characters.filter((c) => only.includes(c.id)) : characters;
  if (only.length && selected.length !== only.length) {
    throw new Error(`Unknown character id. Known: ${characters.map((c) => c.id).join(', ')}`);
  }

  // Keep entries of characters and parts that were not rebuilt this run.
  let previousManifest = {};
  try {
    previousManifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    // first build
  }
  const previous = previousManifest.models ?? [];

  const exporter = new GLTFExporter();
  const built = [];
  for (const character of selected) {
    const entry = await buildCharacter(character, exporter);
    built.push(entry);
    console.log(
      `✔ ${entry.id.padEnd(7)} ${String(entry.stats.triangles).padStart(5)} tris  ` +
        `${String(entry.stats.meshes).padStart(3)} meshes  ${(entry.stats.bytes / 1024).toFixed(1)} KB  → ${entry.file}`,
    );
  }

  const models = characters
    .map((c) => built.find((m) => m.id === c.id) ?? previous.find((m) => m.id === c.id))
    .filter(Boolean);

  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: 'tools/modeling/build-avatars.mjs',
    conventions: {
      units: 'meters',
      up: '+Y',
      forward: '+Z',
      origin: 'between the feet, on the ground',
      pivots: PIVOT_NAMES,
      requiredClips: REQUIRED_CLIPS,
      fxAnchorPrefix: 'FX_',
      ...(previousManifest.conventions?.engineOrigin ? { engineOrigin: previousManifest.conventions.engineOrigin } : {}),
      ...(previousManifest.conventions?.tankOrigin ? { tankOrigin: previousManifest.conventions.tankOrigin } : {}),
      ...(previousManifest.conventions?.equipmentOrigin ? { equipmentOrigin: previousManifest.conventions.equipmentOrigin } : {}),
      ...(previousManifest.conventions?.cabinOrigin ? { cabinOrigin: previousManifest.conventions.cabinOrigin } : {}),
    },
    fxPresets: FX_PRESETS,
    references: REFERENCES,
    models,
    ...(previousManifest.missionRules ? { missionRules: previousManifest.missionRules } : {}),
    ...(previousManifest.parts ? { parts: previousManifest.parts } : {}),
    ...(previousManifest.bodies ? { bodyConventions: previousManifest.bodyConventions, bodies: previousManifest.bodies } : {}),
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✔ manifest → ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
