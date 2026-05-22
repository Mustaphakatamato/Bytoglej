const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG encoder ───────────────────────────────────────────────
function crc32(buf) {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tb  = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}
function makePng(width, height, pixelFn) {
  const sig  = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const rowLen = width * 4 + 1;
  const raw    = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const off = y * rowLen + 1 + x * 4;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b; raw[off+3] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ── Colours ───────────────────────────────────────────────────
const PAPER = [246, 242, 234, 255]; // #F6F2EA
const INK   = [ 22,  34,  28, 255]; // #16221C
const GREEN = [ 42, 125,  79, 255]; // #2A7D4F
const TRANSP = [0, 0, 0, 0];

// ── Bitmap glyphs  (8 wide × 11 tall, bold style) ─────────────
// Each row: left→right, 1 = filled pixel
const G = {
  b: [
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,1,1,1,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  y: [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,1,0,0],
    [0,1,0,0,1,0,0,0],
    [0,0,1,1,0,0,0,0],
    [0,0,0,1,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  t: [
    [0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [1,1,1,1,1,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [0,0,0,1,1,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  '&': [
    [0,0,1,1,1,0,0,0],
    [0,1,0,0,0,1,0,0],
    [0,1,0,0,0,1,0,0],
    [0,0,1,1,0,0,0,0],
    [0,1,0,0,1,0,1,0],
    [1,0,0,0,0,1,1,0],
    [1,0,0,0,0,1,0,0],
    [0,1,0,0,1,0,0,0],
    [0,0,1,1,0,0,1,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  l: [
    [1,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0],
    [0,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  e: [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,1,1,1,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,1,1,1,1,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [0,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  g: [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,1,1,1,1,0,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,1,0,0],
    [0,1,1,1,1,1,0,0],
    [0,0,0,0,0,1,0,0],
    [1,0,0,0,0,1,0,0],
    [0,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  '.': [
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
};

// Widths (how many columns each glyph actually uses)
const GW = { b:5, y:6, t:5, '&':7, l:4, e:5, g:6, '.':3 };
const GH = 11;
const GLYPH_GAP = 1; // columns between glyphs

// ── Draw "byt &leg." layout onto pixel buffer ─────────────────
// Returns colour [r,g,b,a] for pixel (x,y) inside a `size` × `size` canvas
function logoPixel(px, py, size) {
  // Scale: fit two lines of text with margins
  const margin  = Math.round(size * 0.08);
  const scale   = Math.max(1, Math.floor((size - margin * 2) / 52)); // 52 ≈ max line width in glyph units

  const lineH   = GH * scale;
  const lineGap = Math.round(scale * 2.5);
  const totalH  = lineH * 2 + lineGap;
  const topY    = Math.round((size - totalH) / 2);

  // Line 1: "byt"
  const line1 = ['b','y','t'];
  // Line 2: "&leg."
  const line2 = ['&','l','e','g','.'];

  function lineWidth(chars) {
    return chars.reduce((s,c,i) => s + GW[c] * scale + (i < chars.length-1 ? GLYPH_GAP * scale : 0), 0);
  }

  const l1w   = lineWidth(line1);
  const l2w   = lineWidth(line2);
  const startX = margin;

  function hitTest(chars, lineStartY, colourFn) {
    let cx = startX;
    for (const ch of chars) {
      const glyph = G[ch];
      const gw    = GW[ch];
      for (let gy = 0; gy < GH; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          if (!glyph[gy][gx]) continue;
          const x0 = cx + gx * scale;
          const y0 = lineStartY + gy * scale;
          if (px >= x0 && px < x0 + scale && py >= y0 && py < y0 + scale) {
            return colourFn(ch);
          }
        }
      }
      cx += (gw + GLYPH_GAP) * scale;
    }
    return null;
  }

  // Line 1 colour: all INK
  let hit = hitTest(line1, topY, () => INK);
  if (hit) return hit;

  // Line 2: '&' → GREEN, rest → INK
  hit = hitTest(line2, topY + lineH + lineGap, ch => ch === '&' ? GREEN : INK);
  if (hit) return hit;

  return PAPER;
}

// ── Generate icons ────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public', 'icons');

const configs = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true  },
  { name: 'icon-maskable-512.png', size: 512, maskable: true  },
  { name: 'apple-touch-icon.png',  size: 180, maskable: false },
];

for (const { name, size, maskable } of configs) {
  const buf = makePng(size, size, (x, y, w, h) => {
    if (!maskable) {
      // Rounded corners: clip to rounded square
      const r  = size * 0.18;
      const cx = size / 2, cy = size / 2;
      const rx = Math.abs(x - cx) - (size/2 - r);
      const ry = Math.abs(y - cy) - (size/2 - r);
      if (rx > 0 && ry > 0 && Math.sqrt(rx*rx + ry*ry) > r) return TRANSP;
    }
    return logoPixel(x, y, size);
  });
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`✓  ${name}  (${size}×${size})`);
}
console.log('Done.');
