// Animated GIF encoder, no dependencies. One global palette (median cut, up to 255 colours plus a transparent
// index); after the first frame only the rectangle that changed is stored, with unchanged pixels transparent, so
// interface clips (flat colours, small moving parts) stay small. LZW as in the GIF89a spec (after omggif's encoder).
//   encodeGif({ width, height, frames: [{ rgba, delayMs }], loop = 0 }) → Buffer
// `rgba`: width × height × 4 bytes (alpha ignored). Frames identical to the previous one only lengthen its delay.

const TRANSPARENT = 255;
const MAX_COLORS = 255;

// Colours reduced to 5 bits per channel: the histogram key and the lookup key of the palette.
const key15 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

function buildPalette(frames, width, height) {
  const counts = new Uint32Array(1 << 15);
  const step = frames.length > 60 ? 2 : 1; // every other frame is plenty for the colour statistics
  for (let f = 0; f < frames.length; f += step) {
    const px = frames[f].rgba;
    for (let i = 0; i < width * height * 4; i += 4) counts[key15(px[i], px[i + 1], px[i + 2])]++;
  }
  const bins = [];
  for (let k = 0; k < counts.length; k++) if (counts[k]) bins.push({ r: (k >> 10) & 31, g: (k >> 5) & 31, b: k & 31, n: counts[k], k });
  // Median cut over the 15-bit bins, weighted by pixel count.
  const boxOf = items => {
    const lo = [31, 31, 31], hi = [0, 0, 0];
    let n = 0;
    for (const it of items) {
      const c = [it.r, it.g, it.b];
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], c[a]); hi[a] = Math.max(hi[a], c[a]); }
      n += it.n;
    }
    const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const axis = ranges.indexOf(Math.max(...ranges));
    return { items, n, axis, range: ranges[axis] };
  };
  const boxes = [boxOf(bins)];
  while (boxes.length < MAX_COLORS) {
    let best = -1, score = 0;
    boxes.forEach((b, i) => { const s = b.range * Math.sqrt(b.n); if (b.items.length > 1 && s > score) { score = s; best = i; } });
    if (best < 0) break;
    const box = boxes[best], ax = ['r', 'g', 'b'][box.axis];
    box.items.sort((a, b) => a[ax] - b[ax]);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.items.length - 1; i++) { acc += box.items[i].n; if (acc >= box.n / 2) { cut = i + 1; break; } }
    boxes.splice(best, 1, boxOf(box.items.slice(0, cut)), boxOf(box.items.slice(cut)));
  }
  const palette = boxes.map(b => {
    let r = 0, g = 0, bl = 0;
    for (const it of b.items) { r += it.r * it.n; g += it.g * it.n; bl += it.b * it.n; }
    const s = 255 / 31 / b.n;
    return [Math.round(r * s), Math.round(g * s), Math.round(bl * s)];
  });
  // Every bin seen points straight at its box; any other key falls back to the nearest colour.
  const lut = new Int16Array(1 << 15).fill(-1);
  boxes.forEach((b, i) => { for (const it of b.items) lut[it.k] = i; });
  const lookup = (r, g, b) => {
    const k = key15(r, g, b);
    if (lut[k] < 0) {
      let best = 0, bd = Infinity;
      palette.forEach(([pr, pg, pb], i) => { const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < bd) { bd = d; best = i; } });
      lut[k] = best;
    }
    return lut[k];
  };
  return { palette, lookup };
}

function lzw(indices, minCodeSize) {
  const out = [];
  let cur = 0, bits = 0;
  const emit = (code, size) => {
    cur |= code << bits; bits += size;
    while (bits >= 8) { out.push(cur & 0xff); cur >>>= 8; bits -= 8; }
  };
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let codeSize = minCodeSize + 1, next = eoi + 1;
  let table = new Map();
  emit(clear, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k, code = table.get(key);
    if (code !== undefined) { prefix = code; continue; }
    emit(prefix, codeSize);
    if (next === 4096) {
      emit(clear, codeSize);
      next = eoi + 1; codeSize = minCodeSize + 1; table = new Map();
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix, codeSize);
  emit(eoi, codeSize);
  if (bits > 0) out.push(cur & 0xff);
  // Data sub-blocks of at most 255 bytes, then the block terminator.
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) { const part = out.slice(i, i + 255); blocks.push(part.length, ...part); }
  blocks.push(0);
  return blocks;
}

export function encodeGif({ width, height, frames, loop = 0 }) {
  if (!frames.length) throw new Error('encodeGif: no frames');
  const { palette, lookup } = buildPalette(frames, width, height);
  const bytes = [];
  const u16 = v => bytes.push(v & 0xff, (v >> 8) & 0xff);
  bytes.push(...Buffer.from('GIF89a'));
  u16(width); u16(height);
  bytes.push(0xf7, 0, 0); // global colour table of 256 entries, 8 bits per colour
  for (let i = 0; i < 256; i++) bytes.push(...(palette[i] || [0, 0, 0]));
  bytes.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01);
  u16(loop); bytes.push(0);

  // Indexed frames; identical ones merge into the previous delay.
  const indexed = [];
  for (const f of frames) {
    const idx = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < idx.length; i++, p += 4) idx[i] = lookup(f.rgba[p], f.rgba[p + 1], f.rgba[p + 2]);
    const prev = indexed.at(-1);
    if (prev && prev.idx.every((v, i) => v === idx[i])) { prev.delayMs += f.delayMs; continue; }
    indexed.push({ idx, delayMs: f.delayMs });
  }

  let carry = 0; // GIF delays are whole centiseconds: keep the rounding error so the clip keeps its length
  indexed.forEach((f, n) => {
    let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1;
    const prev = n ? indexed[n - 1].idx : null;
    if (prev) {
      x0 = width; y0 = height; x1 = -1; y1 = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (f.idx[i] !== prev[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y0 + y) * width + x0 + x;
      sub[y * w + x] = prev && f.idx[i] === prev[i] ? TRANSPARENT : f.idx[i];
    }
    const exact = f.delayMs / 10 + carry, cs = Math.max(2, Math.round(exact));
    carry = exact - cs;
    bytes.push(0x21, 0xf9, 0x04, (1 << 2) | (prev ? 1 : 0)); // disposal 1 (keep), transparency after frame 1
    u16(cs); bytes.push(TRANSPARENT, 0);
    bytes.push(0x2c); u16(x0); u16(y0); u16(w); u16(h); bytes.push(0);
    bytes.push(8, ...lzw(sub, 8));
  });
  bytes.push(0x3b);
  return Buffer.from(bytes);
}

// Box-filter downscale of an RGBA image (area average), for clips smaller than the captured frames.
export function downscale(rgba, width, height, outW, outH) {
  const out = new Uint8Array(outW * outH * 4), sx = width / outW, sy = height / outH;
  for (let oy = 0; oy < outH; oy++) for (let ox = 0; ox < outW; ox++) {
    const xa = Math.floor(ox * sx), xb = Math.max(xa + 1, Math.floor((ox + 1) * sx));
    const ya = Math.floor(oy * sy), yb = Math.max(ya + 1, Math.floor((oy + 1) * sy));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = ya; y < yb && y < height; y++) for (let x = xa; x < xb && x < width; x++) {
      const p = (y * width + x) * 4; r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; n++;
    }
    const o = (oy * outW + ox) * 4;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return out;
}
