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
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      set(p, x, y, r, g, b, a);
}

// ─── Tile Generation ─────────────────────────────────────

function saveTile(pixels, part, index) {
  const dir = path.join(OUT_DIR, part);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, `${part}_${index}.png`);
  fs.writeFileSync(filename, createPNG(TILE, TILE, pixels));
}

// Generate 6 face variants (face shape + eyes + nose)
for (let i = 0; i < 6; i++) {
  const p = createCanvas();
  // Base face color (neutral grey for tinting)
  fill(p, 4, 0, 27, 31, 180, 180, 180); 
  
  // Eyes
  const ey = 12 + (i % 2);
  set(p, 10, ey, 40, 40, 40);
  set(p, 21, ey, 40, 40, 40);
  
  // Nose
  const ny = 18;
  fill(p, 15, ny, 16, ny + 2, 140, 140, 140);
  
  saveTile(p, 'face', i);
}

// Generate 4 mouth variants
for (let i = 0; i < 4; i++) {
  const p = createCanvas();
  fill(p, 4, 0, 27, 10, 180, 180, 180); // upper chin area
  
  const my = 5;
  if (i === 0) fill(p, 12, my, 19, my, 80, 80, 80); // flat
  if (i === 1) { set(p, 11, my, 80, 80, 80); fill(p, 12, my+1, 19, my+1, 80, 80, 80); set(p, 20, my, 80, 80, 80); } // smile
  if (i === 2) { fill(p, 12, my, 19, my, 80, 80, 80); set(p, 12, my+1, 80, 80, 80); set(p, 19, my+1, 80, 80, 80); } // smirk
  if (i === 3) fill(p, 14, my, 17, my+1, 60, 60, 60); // small o
  
  saveTile(p, 'mouth', i);
}

// Generate 8 hair variants (top, left, right)
for (let i = 0; i < 8; i++) {
  // Hair Top
  const pt = createCanvas();
  if (i > 0) {
    fill(pt, 2, 10, 29, 31, 100, 100, 100); // base hair
    if (i === 1) fill(pt, 10, 5, 21, 10, 100, 100, 100); // bowl
    if (i === 2) { fill(pt, 14, 2, 17, 10, 100, 100, 100); } // mohawk
    if (i === 3) { fill(pt, 4, 8, 12, 15, 100, 100, 100); fill(pt, 19, 8, 27, 15, 100, 100, 100); } // tufts
  }
  saveTile(pt, 'hair_top', i);

  // Hair Left
  const pl = createCanvas();
  if (i > 0) {
    fill(pl, 28, 0, 31, 31, 100, 100, 100);
    if (i === 4) fill(pl, 20, 10, 28, 25, 100, 100, 100); // side bushy
  }
  saveTile(pl, 'hair_left', i);

  // Hair Right
  const pr = createCanvas();
  if (i > 0) {
    fill(pr, 0, 0, 3, 31, 100, 100, 100);
    if (i === 4) fill(pr, 3, 10, 11, 25, 100, 100, 100); // side bushy
  }
  saveTile(pr, 'hair_right', i);
}

// Generate 4 ear variants (left, right)
for (let i = 0; i < 4; i++) {
  const pl = createCanvas();
  fill(pl, 28, 10, 31, 20, 160, 160, 160); // base ear
  if (i === 1) set(pl, 27, 15, 160, 160, 160); // pointy
  saveTile(pl, 'ear_left', i);

  const pr = createCanvas();
  fill(pr, 0, 10, 3, 20, 160, 160, 160);
  if (i === 1) set(pr, 4, 15, 160, 160, 160);
  saveTile(pr, 'ear_right', i);
}

// Generate 4 chin variants (left, right)
for (let i = 0; i < 4; i++) {
  const pl = createCanvas();
  fill(pl, 28, 0, 31, 10, 180, 180, 180);
  if (i === 1) fill(pl, 20, 0, 27, 5, 180, 180, 180); // wider chin
  saveTile(pl, 'chin_left', i);

  const pr = createCanvas();
  fill(pr, 0, 0, 3, 10, 180, 180, 180);
  if (i === 1) fill(pr, 4, 0, 11, 5, 180, 180, 180);
  saveTile(pr, 'chin_right', i);
}

console.log('Portrait tiles generated in assets/tiles/portraits/');
