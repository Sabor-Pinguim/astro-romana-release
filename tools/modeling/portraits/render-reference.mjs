// Recolor the approved RGB PNG without changing its silhouette or facets.
// Pure Node PNG reader/writer for this fixed source format (8-bit RGB).
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync, deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = await readFile(path.join(root, 'references/art/nancy-difficulty-concept.png'));
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
if (!source.subarray(0,8).equals(signature)) throw new Error('Expected PNG source');
let width, height, depth, type, offset = 8;
const compressed = [];
while (offset < source.length) {
  const length = source.readUInt32BE(offset), tag = source.toString('ascii', offset+4, offset+8);
  const data = source.subarray(offset+8, offset+8+length);
  if (tag === 'IHDR') { width=data.readUInt32BE(0); height=data.readUInt32BE(4); depth=data[8]; type=data[9]; }
  if (tag === 'IDAT') compressed.push(data);
  offset += length + 12;
  if (tag === 'IEND') break;
}
if (depth !== 8 || type !== 2 || width !== 1774 || height !== 887) throw new Error('Unexpected concept PNG format');
const raw = inflateSync(Buffer.concat(compressed)), pixels = Buffer.alloc(width*height*3);
const stride = width*3;
function paeth(a,b,c) {
  const p=a+b-c, da=Math.abs(p-a), db=Math.abs(p-b), dc=Math.abs(p-c);
  return da<=db && da<=dc ? a : db<=dc ? b : c;
}
for (let y=0, src=0; y<height; y++) {
  const filter=raw[src++];
  for (let x=0; x<stride; x++) {
    const left=x>=3 ? pixels[y*stride+x-3] : 0;
    const above=y ? pixels[(y-1)*stride+x] : 0;
    const upperLeft=y && x>=3 ? pixels[(y-1)*stride+x-3] : 0;
    const prediction=[0,left,above,Math.floor((left+above)/2),paeth(left,above,upperLeft)][filter];
    if (prediction === undefined) throw new Error(`Unsupported PNG filter ${filter}`);
    pixels[y*stride+x]=(raw[src++]+prediction)&255;
  }
}
const crcTable = new Uint32Array(256);
for(let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; crcTable[n]=c>>>0; }
function chunk(tag,data) {
  const out=Buffer.alloc(data.length+12); out.writeUInt32BE(data.length,0); out.write(tag,4,'ascii'); data.copy(out,8);
  let crc=0xffffffff; for(let i=4;i<8+data.length;i++) crc=crcTable[(crc^out[i])&255]^(crc>>>8);
  out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length); return out;
}
function clamp(v) { return Math.max(0,Math.min(255,Math.round(v))); }
const panels=[['easy',0,585,[.43,1.03,1.05]],['normal',594,1179,[1.16,.79,.34]],['hard',1187,1774,[1.15,.53,.64]]];
for(const [name,left,right,palette] of panels) {
  const cropWidth=right-left, rowBytes=cropWidth*4;
  const rgba=Buffer.alloc((rowBytes+1)*height);
  for(let y=0;y<height;y++) for(let x=0;x<cropWidth;x++) {
    const si=(y*width+left+x)*3, di=y*(rowBytes+1)+1+x*4;
    const r=pixels[si],g=pixels[si+1],b=pixels[si+2];
    const star=Math.min(r,g,b)>205 && Math.max(r,g,b)-Math.min(r,g,b)<35;
    const light=.2126*r+.7152*g+.0722*b;
    for(let c=0;c<3;c++) rgba[di+c]=star?[245,242,252][c]:clamp(light*palette[c]);
    rgba[di+3]=star?255:clamp(2.4*g-.7*r-19);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(cropWidth,0); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  const png=Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(path.join(root,`assets/models/portraits/nancy-${name}.png`),png);
}
