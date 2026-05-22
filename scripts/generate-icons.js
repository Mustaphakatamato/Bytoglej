const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

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

function makePng(size, pixelFn) {
  const sig  = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const rowLen = size * 4 + 1;
  const raw    = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const off = y * rowLen + 1 + x * 4;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b; raw[off+3] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// Brand colours
const GREEN  = [42, 125, 79];
const WHITE  = [255, 255, 255];
const TRANSP = [0, 0, 0, 0];

// Bitmap glyphs 5-wide × 7-tall for "B", "&", "L"
const GLYPHS = {
  B: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  '&': [
    [0,1,1,0,0],
    [1,0,0,1,0],
    [1,0,0,1,0],
    [0,1,1,0,0],
    [1,0,0,1,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  L: [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
};

// Draw "B&L" centred inside a circle on a green background
function iconPixel(x, y, size, maskable = false) {
  const cx = size / 2, cy = size / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!maskable) {
    // Rounded square: clip corners
    const r = size * 0.18;
    const inset = size * 0.06;
    const rx = Math.abs(x - cx) - (size/2 - inset - r);
    const ry = Math.abs(y - cy) - (size/2 - inset - r);
    const inCorner = rx > 0 && ry > 0;
    if (inCorner && Math.sqrt(rx*rx + ry*ry) > r) return TRANSP;
  }

  // White inner circle
  const circleR = size * 0.36;
  if (dist < circleR) {
    // Draw "B&L" text inside the white circle using bitmap font
    const scale  = Math.floor(size / 64); // pixel size of each font pixel
    const gw     = 5, gh = 7;
    const chars  = ['B', '&', 'L'];
    const gap    = 1;
    const totalW = chars.length * gw * scale + (chars.length - 1) * gap * scale;
    const totalH = gh * scale;
    const textX  = Math.round(cx - totalW / 2);
    const textY  = Math.round(cy - totalH / 2);

    for (let ci = 0; ci < chars.length; ci++) {
      const glyph  = GLYPHS[chars[ci]];
      const charX  = textX + ci * (gw + gap) * scale;
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          if (!glyph[gy][gx]) continue;
          const px0 = charX + gx * scale;
          const py0 = textY + gy * scale;
          if (x >= px0 && x < px0 + scale && y >= py0 && y < py0 + scale) {
            return [...GREEN, 255];
          }
        }
      }
    }
    return [...WHITE, 255];
  }

  // Green background
  return [...GREEN, 255];
}

const out = path.join(__dirname, '..', 'public', 'icons');

const configs = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true  },
  { name: 'icon-maskable-512.png', size: 512, maskable: true  },
  { name: 'apple-touch-icon.png',  size: 180, maskable: false },
];

for (const { name, size, maskable } of configs) {
  const buf = makePng(size, (x, y, s) => iconPixel(x, y, s, maskable));
  fs.writeFileSync(path.join(out, name), buf);
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log('Icons generated successfully.');
