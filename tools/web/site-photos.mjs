// Real satellite photo of each landing site for the lobby: the HiRISE orthoimage (USGS STAC, CC0) of the
// same stereo pair as the terrain, centred on the landing point, wider than the walkable terrain so the
// player sees the surroundings. Grayscale (HiRISE RED band), north up, stretched 1st–99th percentile.
// Writes assets/sites/<id>.png and assets/sites/manifest.json. Reads the sites from tools/terrain/sites.mjs.
// Usage: NODE_OPTIONS=--use-system-ca node tools/web/site-photos.mjs [site ...]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITES, STAC_API } from '../terrain/sites.mjs';
import { borderPoints, fillHoles, openCog, pickLevel, readWindow, regionFromWindow, sampleGrid } from '../terrain/lib/raster.mjs';
import { createSiteFrame, projectionFromProjjson } from '../terrain/lib/mars.mjs';
import { encodePng } from '../terrain/lib/png.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'assets/sites');
const LANDING_SITES = ['jezero', 'gale']; // the sites the lobby offers
// game: 3× the walkable terrain (512 m), 640 px (2.4 m per pixel).
const PHOTO = { sizeM: 1536, pixels: 640, maxHoleFraction: 0.02 };

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function stretch(values) {
  const sorted = Float32Array.from(values.filter((v) => !Number.isNaN(v))).sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.ceil(sorted.length * 0.99) - 1];
  return Uint8Array.from(values, (v) => Math.round(255 * Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)))));
}

async function photo(site) {
  const item = await getJson(`${STAC_API}/collections/${site.collection}/items/${site.item}`);
  const frame = createSiteFrame(site.center, projectionFromProjjson(item.properties['proj:projjson']));
  const ortho = Object.values(item.assets).find((a) => a.title === `Orthoimage: ${site.ortho}`);
  if (!ortho) throw new Error(`${site.id}: orthoimage ${site.ortho} not found`);
  const cog = await openCog(ortho.href);
  const texelM = PHOTO.sizeM / PHOTO.pixels;
  const region = regionFromWindow(await readWindow(cog, pickLevel(cog, texelM / 2), borderPoints(frame, PHOTO.sizeM)));
  const grid = sampleGrid(region, frame, PHOTO.pixels, PHOTO.sizeM, true); // row 0 = north edge
  const holes = grid.invalid / grid.values.length;
  if (holes > PHOTO.maxHoleFraction) throw new Error(`${site.id}: ${(holes * 100).toFixed(1)}% of the photo has no data`);
  fillHoles(grid.values, PHOTO.pixels);
  const file = `${site.id}.png`;
  await writeFile(path.join(OUT, file), encodePng(PHOTO.pixels, PHOTO.pixels, 1, stretch(grid.values)));
  console.log(`✔ ${file}: ${PHOTO.sizeM} m, ${texelM.toFixed(1)} m/pixel, ${(holes * 100).toFixed(2)}% filled`);
  return {
    id: site.id, file, sizeM: PHOTO.sizeM, pixels: PHOTO.pixels, walkableM: site.sizeM, center: site.center,
    source: { license: 'CC0-1.0', catalog: `${STAC_API}/collections/${site.collection}/items/${site.item}`, orthoimage: site.ortho, url: ortho.href },
  };
}

const only = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const sites = [];
for (const site of SITES.filter((s) => LANDING_SITES.includes(s.id) && (!only.length || only.includes(s.id)))) sites.push(await photo(site));
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  generator: 'tools/web/site-photos.mjs',
  note: 'HiRISE RED orthoimage, grayscale, north up, 1st–99th percentile stretch; the walkable terrain is the centre square of walkableM',
  sites,
}, null, 2) + '\n');
