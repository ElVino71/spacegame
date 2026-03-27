/**
 * Generate 32×32 portrait component PNGs.
 *
 * Run: node scripts/generate-portrait-tiles.js
 *
 * Outputs to assets/tiles/portraits/{part}/{part}_{n}.png
 *
 * Grid layout (3×3 of 32×32 = 96×96 composite):
 * [hair_left ] [hair_top  ] [hair_right]
 * [ear_left  ] [face      ] [ear_right ]
 * [chin_left ] [mouth     ] [chin_right]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 32;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles', 'portraits');

// ─── Minimal PNG encoder ─────────────────────────────────

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      raw[dstIdx] = pixels[srcIdx];
      raw[dstIdx + 1] = pixels[srcIdx + 1];
      raw[dstIdx + 2] = pixels[srcIdx + 2];
      raw[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  const compressed = zlib.deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuffer, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

// ─── Pixel helpers ───────────────────────────────────────

function createCanvas() {
  return new Uint8Array(TILE * TILE * 4);
}

function set(p, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = a;
}

function fill(p, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      set(p, x, y, r, g, b, a);
    }
  }
}

function lineH(p, x1, x2, y, r, g, b, a = 255) {
  for (let x = x1; x <= x2; x++) set(p, x, y, r, g, b, a);
}

function lineV(p, x, y1, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) set(p, x, y, r, g, b, a);
}

function mirrorCopy(src, dst, offsetX = 0) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const si = (y * TILE + x) * 4;
      const a = src[si + 3];
      if (!a) continue;
      const dx = TILE - 1 - x + offsetX;
      if (dx < 0 || dx >= TILE) continue;
      const di = (y * TILE + dx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = a;
    }
  }
}

function saveTile(pixels, part, index) {
  const dir = path.join(OUT_DIR, part);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, `${part}_${index}.png`);
  fs.writeFileSync(filename, createPNG(TILE, TILE, pixels));
}

// ─── Palette ─────────────────────────────────────────────

const C = {
  skinBase: [178, 178, 178],
  skinShadow: [132, 132, 132],
  skinDeep: [88, 88, 88],
  skinHighlight: [214, 214, 214],
  hairBase: [108, 108, 108],
  hairShadow: [68, 68, 68],
  hairHighlight: [156, 156, 156],
  detail: [42, 42, 42],
  soft: [96, 96, 96],
  light: [230, 230, 230],
  metal: [160, 160, 160],
  metalDark: [84, 84, 84],
};

// ─── Portrait drawing helpers ────────────────────────────

function drawFaceBase(p, variant) {
  fill(p, 4, 0, 27, 31, ...C.skinBase);

  lineH(p, 4, 27, 0, ...C.skinShadow);
  lineH(p, 4, 27, 31, ...C.skinShadow);
  lineV(p, 4, 0, 31, ...C.skinShadow);
  lineV(p, 27, 0, 31, ...C.skinShadow);

  fill(p, 7, 2, 24, 4, ...C.skinHighlight);
  fill(p, 8, 24, 23, 28, ...C.skinShadow);

  if (variant === 1) {
    fill(p, 4, 0, 5, 31, ...C.skinDeep);
    fill(p, 26, 0, 27, 31, ...C.skinDeep);
  }
  if (variant === 2) {
    fill(p, 6, 0, 8, 31, ...C.skinShadow);
    fill(p, 23, 0, 25, 31, ...C.skinShadow);
    fill(p, 10, 2, 21, 3, ...C.skinHighlight);
  }
  if (variant === 3) {
    fill(p, 4, 0, 27, 2, ...C.skinHighlight);
    fill(p, 6, 22, 25, 31, ...C.skinDeep);
  }
  if (variant === 4) {
    fill(p, 4, 5, 6, 23, ...C.skinShadow);
    fill(p, 25, 5, 27, 23, ...C.skinShadow);
    fill(p, 9, 26, 22, 28, ...C.skinDeep);
  }
  if (variant === 5) {
    fill(p, 9, 1, 22, 5, ...C.skinHighlight);
    fill(p, 10, 24, 21, 27, ...C.skinShadow);
    set(p, 8, 22, ...C.skinDeep);
    set(p, 23, 22, ...C.skinDeep);
  }
}

function drawEyes(p, variant) {
  const eyeY = variant === 2 ? 13 : 12;

  lineH(p, 8, 12, eyeY - 1, ...C.skinShadow);
  lineH(p, 19, 23, eyeY - 1, ...C.skinShadow);

  set(p, 10, eyeY, ...C.detail);
  set(p, 11, eyeY, ...C.detail);
  set(p, 20, eyeY, ...C.detail);
  set(p, 21, eyeY, ...C.detail);

  set(p, 9, eyeY, ...C.light);
  set(p, 19, eyeY, ...C.light);

  if (variant === 1) {
    lineH(p, 8, 12, eyeY, ...C.detail);
    lineH(p, 19, 23, eyeY, ...C.detail);
  }
  if (variant === 3) {
    set(p, 12, eyeY + 1, ...C.detail);
    set(p, 19, eyeY + 1, ...C.detail);
  }
  if (variant === 4) {
    set(p, 9, eyeY + 1, ...C.skinShadow);
    set(p, 22, eyeY + 1, ...C.skinShadow);
  }
  if (variant === 5) {
    lineH(p, 8, 11, eyeY - 1, ...C.detail);
    lineH(p, 20, 23, eyeY - 1, ...C.detail);
    set(p, 11, eyeY + 1, ...C.skinShadow);
    set(p, 20, eyeY + 1, ...C.skinShadow);
  }
}

function drawNose(p, variant) {
  fill(p, 15, 15, 16, 20, ...C.skinShadow);
  fill(p, 14, 16, 14, 18, ...C.skinHighlight);
  set(p, 16, 20, ...C.skinDeep);
  set(p, 17, 20, ...C.skinDeep);

  if (variant === 1) {
    fill(p, 15, 15, 16, 21, ...C.skinShadow);
    set(p, 17, 19, ...C.skinDeep);
  }
  if (variant === 2) {
    fill(p, 15, 16, 16, 19, ...C.skinDeep);
    set(p, 14, 17, ...C.skinHighlight);
  }
  if (variant === 3) {
    fill(p, 15, 15, 15, 20, ...C.skinShadow);
    fill(p, 16, 16, 16, 20, ...C.skinHighlight);
  }
  if (variant === 4) {
    set(p, 14, 18, ...C.skinShadow);
    set(p, 15, 19, ...C.skinShadow);
    set(p, 16, 20, ...C.skinShadow);
    set(p, 17, 21, ...C.skinDeep);
  }
}

function drawCheeksAndAge(p, variant) {
  set(p, 8, 18, ...C.skinHighlight);
  set(p, 23, 18, ...C.skinHighlight);
  set(p, 8, 21, ...C.skinShadow);
  set(p, 23, 21, ...C.skinShadow);

  if (variant === 1 || variant === 4) {
    lineV(p, 9, 17, 20, ...C.skinShadow);
    lineV(p, 22, 17, 20, ...C.skinShadow);
  }

  if (variant === 3 || variant === 5) {
    lineH(p, 9, 12, 10, ...C.skinShadow);
    lineH(p, 19, 22, 10, ...C.skinShadow);
  }

  if (variant === 5) {
    set(p, 11, 22, ...C.skinDeep);
    set(p, 20, 22, ...C.skinDeep);
  }
}

function drawMouthBase(p) {
  fill(p, 4, 0, 27, 10, ...C.skinBase);
  lineH(p, 4, 27, 10, ...C.skinShadow);
  fill(p, 7, 0, 24, 2, ...C.skinHighlight);
}

function drawHairTop(style) {
  const p = createCanvas();

  if (style === 0) return p;

  if (style === 1) {
    fill(p, 3, 9, 28, 31, ...C.hairBase);
    fill(p, 6, 4, 25, 10, ...C.hairBase);
    fill(p, 7, 5, 24, 7, ...C.hairHighlight);
  }

  if (style === 2) {
    fill(p, 6, 12, 25, 31, ...C.hairBase);
    fill(p, 13, 2, 18, 17, ...C.hairBase);
    fill(p, 14, 4, 17, 8, ...C.hairHighlight);
  }

  if (style === 3) {
    fill(p, 4, 10, 12, 31, ...C.hairBase);
    fill(p, 19, 10, 27, 31, ...C.hairBase);
    fill(p, 8, 5, 23, 15, ...C.hairBase);
    fill(p, 10, 6, 21, 8, ...C.hairHighlight);
  }

  if (style === 4) {
    fill(p, 2, 11, 29, 31, ...C.hairBase);
    for (let x = 4; x <= 26; x += 4) {
      lineV(p, x, 7, 14, ...C.hairShadow);
    }
    fill(p, 4, 6, 27, 11, ...C.hairHighlight);
  }

  if (style === 5) {
    fill(p, 4, 9, 27, 31, ...C.hairBase);
    fill(p, 9, 3, 22, 9, ...C.hairBase);
    fill(p, 11, 4, 20, 5, ...C.hairHighlight);
    fill(p, 6, 13, 9, 31, ...C.hairShadow);
    fill(p, 22, 13, 25, 31, ...C.hairShadow);
  }

  if (style === 6) {
    fill(p, 3, 12, 28, 31, ...C.hairBase);
    fill(p, 5, 7, 26, 12, ...C.hairBase);
    lineH(p, 6, 25, 8, ...C.hairHighlight);
    lineH(p, 8, 20, 6, ...C.hairHighlight);
    fill(p, 21, 7, 26, 16, ...C.hairShadow);
  }

  if (style === 7) {
    fill(p, 5, 11, 26, 31, ...C.hairBase);
    fill(p, 7, 5, 24, 11, ...C.hairBase);
    lineH(p, 8, 23, 6, ...C.hairHighlight);
    fill(p, 4, 8, 10, 15, ...C.hairShadow);
    fill(p, 21, 8, 27, 15, ...C.hairShadow);
  }

  lineH(p, 3, 28, 31, ...C.hairShadow);
  return p;
}

function drawHairLeft(style) {
  const p = createCanvas();

  if (style === 0) return p;

  fill(p, 27, 0, 31, 31, ...C.hairBase);
  fill(p, 29, 0, 31, 31, ...C.hairShadow);
  lineV(p, 27, 2, 29, ...C.hairHighlight);

  if (style === 1) {
    fill(p, 23, 7, 28, 18, ...C.hairBase);
  }
  if (style === 2) {
    fill(p, 26, 0, 31, 16, ...C.hairBase);
  }
  if (style === 3) {
    fill(p, 22, 10, 28, 24, ...C.hairBase);
    fill(p, 24, 22, 30, 31, ...C.hairShadow);
  }
  if (style === 4) {
    fill(p, 20, 8, 28, 27, ...C.hairBase);
    fill(p, 22, 15, 30, 31, ...C.hairShadow);
  }
  if (style === 5) {
    fill(p, 24, 0, 31, 12, ...C.hairBase);
    fill(p, 25, 13, 29, 31, ...C.hairShadow);
  }
  if (style === 6) {
    fill(p, 23, 4, 28, 17, ...C.hairBase);
    fill(p, 22, 18, 26, 26, ...C.hairShadow);
  }
  if (style === 7) {
    fill(p, 21, 5, 28, 13, ...C.hairBase);
    fill(p, 24, 14, 31, 28, ...C.hairShadow);
  }

  return p;
}

function drawHairRight(style) {
  const left = drawHairLeft(style);
  const p = createCanvas();
  mirrorCopy(left, p);
  return p;
}

function drawEarLeft(variant) {
  const p = createCanvas();

  fill(p, 28, 10, 31, 21, ...C.skinBase);
  lineV(p, 28, 11, 20, ...C.skinShadow);
  lineV(p, 31, 11, 20, ...C.skinDeep);
  lineV(p, 29, 12, 19, ...C.skinHighlight);

  if (variant === 1) {
    set(p, 27, 14, ...C.skinBase);
    set(p, 27, 15, ...C.skinBase);
  }

  if (variant === 2) {
    fill(p, 24, 12, 27, 19, ...C.metalDark);
    lineH(p, 24, 27, 12, ...C.metal);
    lineH(p, 24, 27, 19, ...C.metal);
    set(p, 25, 15, ...C.light);
  }

  if (variant === 3) {
    fill(p, 25, 13, 27, 18, ...C.detail);
    lineH(p, 24, 27, 15, ...C.metal);
    set(p, 24, 15, ...C.metal);
  }

  return p;
}

function drawEarRight(variant) {
  const left = drawEarLeft(variant);
  const p = createCanvas();
  mirrorCopy(left, p);
  return p;
}

function drawChinLeft(variant) {
  const p = createCanvas();

  fill(p, 28, 0, 31, 10, ...C.skinBase);
  lineV(p, 28, 0, 10, ...C.skinShadow);
  lineV(p, 31, 0, 10, ...C.skinDeep);
  lineH(p, 28, 31, 10, ...C.skinDeep);

  if (variant === 1) {
    fill(p, 21, 0, 27, 5, ...C.skinBase);
    fill(p, 21, 4, 27, 5, ...C.skinShadow);
  }

  if (variant === 2) {
    fill(p, 24, 4, 31, 10, ...C.skinShadow);
    set(p, 23, 6, ...C.skinBase);
    set(p, 23, 7, ...C.skinBase);
  }

  if (variant === 3) {
    fill(p, 24, 0, 31, 10, ...C.detail);
    lineH(p, 24, 31, 0, ...C.soft);
    lineH(p, 24, 31, 10, ...C.soft);
  }

  return p;
}

function drawChinRight(variant) {
  const left = drawChinLeft(variant);
  const p = createCanvas();
  mirrorCopy(left, p);
  return p;
}

function drawMouthVariant(variant) {
  const p = createCanvas();
  drawMouthBase(p);

  if (variant === 0) {
    lineH(p, 11, 20, 5, ...C.detail);
    set(p, 12, 6, ...C.soft);
    set(p, 19, 6, ...C.soft);
  }

  if (variant === 1) {
    set(p, 11, 5, ...C.detail);
    lineH(p, 12, 19, 6, ...C.detail);
    set(p, 20, 5, ...C.detail);
    set(p, 13, 7, ...C.soft);
    set(p, 18, 7, ...C.soft);
  }

  if (variant === 2) {
    lineH(p, 12, 19, 5, ...C.detail);
    set(p, 12, 6, ...C.detail);
    set(p, 19, 6, ...C.soft);
  }

  if (variant === 3) {
    fill(p, 14, 4, 17, 6, ...C.detail);
    set(p, 15, 7, ...C.soft);
    set(p, 16, 7, ...C.soft);
  }

  return p;
}

function drawFaceVariant(variant) {
  const p = createCanvas();
  drawFaceBase(p, variant);
  drawEyes(p, variant);
  drawNose(p, variant);
  drawCheeksAndAge(p, variant);

  if (variant === 2) {
    lineH(p, 13, 18, 23, ...C.skinShadow);
  }
  if (variant === 3) {
    set(p, 11, 15, ...C.skinShadow);
    set(p, 20, 15, ...C.skinShadow);
  }
  if (variant === 4) {
    lineH(p, 10, 12, 22, ...C.skinDeep);
    lineH(p, 19, 21, 22, ...C.skinDeep);
  }
  if (variant === 5) {
    set(p, 9, 16, ...C.skinDeep);
    set(p, 22, 16, ...C.skinDeep);
    set(p, 15, 23, ...C.skinHighlight);
    set(p, 16, 23, ...C.skinHighlight);
  }

  return p;
}

// ─── Tile Generation ─────────────────────────────────────

for (let i = 0; i < 6; i++) {
  saveTile(drawFaceVariant(i), 'face', i);
}

for (let i = 0; i < 4; i++) {
  saveTile(drawMouthVariant(i), 'mouth', i);
}

for (let i = 0; i < 8; i++) {
  saveTile(drawHairTop(i), 'hair_top', i);
  saveTile(drawHairLeft(i), 'hair_left', i);
  saveTile(drawHairRight(i), 'hair_right', i);
}

for (let i = 0; i < 4; i++) {
  saveTile(drawEarLeft(i), 'ear_left', i);
  saveTile(drawEarRight(i), 'ear_right', i);
}

for (let i = 0; i < 4; i++) {
  saveTile(drawChinLeft(i), 'chin_left', i);
  saveTile(drawChinRight(i), 'chin_right', i);
}

console.log('Portrait tiles generated in assets/tiles/portraits/');