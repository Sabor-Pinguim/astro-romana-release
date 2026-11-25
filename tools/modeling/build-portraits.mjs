// Decorative low-poly reliefs traced from the approved Nancy concept in
// references/art/nancy-difficulty-concept.png. Facet coordinates and brightness
// live in portraits/nancy-facets.json; only the difficulty color palette changes.
import './lib/node-polyfills.mjs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'assets/models/portraits');
const manifestPath = path.join(root, 'assets/models/manifest.json');
const facets = JSON.parse(await readFile(new URL('./portraits/nancy-facets.json', import.meta.url), 'utf8'));
const levels = {
  easy: { name: 'Young Nancy Grace Roman', palette: ['#143b43','#267b83','#49abb0','#8bd2d0','#d8f2eb'] },
  normal: { name: 'Adult Nancy Grace Roman', palette: ['#4d3218','#87571f','#bd842f','#eab85d','#fce6ac'] },
  hard: { name: 'Mature Nancy Grace Roman', palette: ['#4f202b','#883040','#b64a59','#e18186','#f4c5b6'] },
};
// Nodes follow the approved concept's sparse star-map routes. Coordinates use
// the same normalized panel space as nancy-facets.json.
const constellation = [
  [[-.82,.5],[-.59,.9]], [[-.59,.9],[-.26,.95]], [[-.26,.95],[.15,.82]], [[.15,.82],[.75,.66]],
  [[-.82,.5],[-.6,.18]], [[-.6,.18],[-.18,.26]], [[-.18,.26],[.29,.48]], [[.29,.48],[.75,.66]],
  [[-.6,.18],[-.47,-.08]], [[-.47,-.08],[-.05,.04]], [[-.05,.04],[.4,-.18]],
  [[-.47,-.08],[-.74,-.45]], [[-.74,-.45],[-.31,-.49]], [[-.31,-.49],[.13,-.4]],
  [[.13,-.4],[.4,-.18]], [[-.31,-.49],[-.34,-.9]], [[-.34,-.9],[.22,-.8]],
  [[.22,-.8],[.6,-.48]], [[.6,-.48],[.4,-.18]],
];
const nodes = [...new Map(constellation.flat().map(p => [p.join(','),p])).values()];
function colorFor(def, tone) {
  const position = Math.max(0, Math.min(3.999, tone * 4));
  const index = Math.floor(position);
  return new THREE.Color(def.palette[index]).lerp(new THREE.Color(def.palette[index + 1]), position - index);
}
function faceMesh(triangles, def) {
  const positions = [], colors = [];
  for (const [x1,y1,x2,y2,x3,y3,tone] of triangles) {
    const color = colorFor(def,tone);
    for (const [x,y] of [[x1,y1],[x2,y2],[x3,y3]]) {
      positions.push(x,y,.02 + tone * .035);
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.84,side:THREE.DoubleSide,depthWrite:false}));
}
function lines(pairs, color, z = .11) {
  const positions = pairs.flatMap(([a,b])=>[a[0],a[1],z,b[0],b[1],z]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.86,depthTest:false}));
}
function makeModel(id,def) {
  const group = new THREE.Group();
  group.name = `NancyPortrait_${id}`;
  group.add(faceMesh(facets[id],def));
  if(id !== 'easy') {
    const frame = new THREE.MeshBasicMaterial({color:def.palette[0],side:THREE.DoubleSide});
    for(const [x,y,r] of [[-.38,.22,.12],[-.69,.22,.067]]) {
      const rim = new THREE.Mesh(new THREE.RingGeometry(r-.014,r,12),frame);
      rim.position.set(x,y,.13);
      group.add(rim);
    }
    group.add(lines([[[ -.26,.3],[.18,.29]],[[-.5,.26],[-.62,.24]]],def.palette[0],.13));
  }
  group.add(lines(constellation,'#f5f2fc'));
  const nodeGeometry = new THREE.OctahedronGeometry(.012,0);
  const nodeMaterial = new THREE.MeshBasicMaterial({color:'#f5f2fc'});
  for(const [x,y] of nodes) {
    const node = new THREE.Mesh(nodeGeometry,nodeMaterial);
    node.position.set(x,y,.12);
    group.add(node);
  }
  return group;
}
function makeSvg(id,def) {
  const polys = facets[id].map(([x1,y1,x2,y2,x3,y3,tone])=>{
    const color = `#${colorFor(def,tone).getHexString()}`;
    return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${color}" opacity=".84"/>`;
  }).join('');
  const paths = constellation.map(([a,b])=>`<path d="M${a.join(' ')} L${b.join(' ')}"/>`).join('');
  const stars = nodes.map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".012"/>`).join('');
  const glasses = id === 'easy' ? '' : `<g fill="none" stroke="${def.palette[0]}" stroke-width=".014"><circle cx="-.38" cy=".22" r=".114"/><circle cx="-.69" cy=".22" r=".06"/><path d="M-.26 .3 L.18 .29"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.05 -1.05 2.1 2.1" aria-hidden="true"><g transform="scale(1 -1)">${polys}${glasses}<g fill="none" stroke="#f5f2fc" stroke-width=".005" opacity=".86">${paths}</g><g fill="#f5f2fc">${stars}</g></g></svg>\n`;
}
async function main() {
  await mkdir(out,{recursive:true});
  const exporter = new GLTFExporter(), entries = [];
  for(const [id,def] of Object.entries(levels)) {
    const model = makeModel(id,def);
    const glb = await exporter.parseAsync(model,{binary:true,onlyVisible:true});
    const file = `portraits/nancy-${id}.glb`;
    await writeFile(path.join(out,`nancy-${id}.glb`),Buffer.from(glb));
    await writeFile(path.join(out,`nancy-${id}.svg`),makeSvg(id,def));
    let triangles = 0, meshes = 0;
    model.traverse(o => { if(o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count)/3; } });
    entries.push({id:`nancy-${id}`,name:def.name,file,svg:`portraits/nancy-${id}.svg`,reference:'references/art/nancy-difficulty-concept.png',stats:{triangles,meshes,bytes:glb.byteLength}});
    console.log(`✔ ${file}: ${triangles} triangles, ${meshes} meshes, ${(glb.byteLength/1024).toFixed(1)} KB`);
  }
  const manifest = JSON.parse(await readFile(manifestPath,'utf8'));
  manifest.portraits = entries;
  await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
