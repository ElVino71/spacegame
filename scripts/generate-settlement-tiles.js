/**
 * Generate placeholder 16×16 tile PNGs for settlement interiors.
 *
 * Run:  node scripts/generate-settlement-tiles.js
 *
 * Outputs to assets/tiles/settlement/. Edit the PNGs in any pixel-art editor.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 16;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles', 'settlement');

// ─── Minimal PNG encoder (same as generate-tiles.js) ────

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

// ─── Pixel helpers ──────────────────────────────────────

function createCanvas() { return new Uint8Array(TILE * TILE * 4); }

function setPixel(pixels, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
}

function fill(pixels, r, g, b, a = 255) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(pixels, x, y, r, g, b, a);
}

function noise(v, range) {
  return Math.max(0, Math.min(255, v + Math.floor(Math.random() * range * 2 - range)));
}

function rect(pixels, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(pixels, x, y, r, g, b, a);
}

// ─── Tile generators ────────────────────────────────────

const tiles = {};

// Road — flat grey with subtle line markings
tiles['road'] = () => {
  const p = createCanvas();
  fill(p, 100, 100, 95);
  // Subtle texture
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(p, x, y, noise(100, 8), noise(100, 8), noise(95, 8));
  return p;
};

// Road crossroads — road with cross markings
tiles['road_cross'] = () => {
  const p = createCanvas();
  fill(p, 100, 100, 95);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(p, x, y, noise(100, 8), noise(100, 8), noise(95, 8));
  // Cross lines
  for (let i = 0; i < TILE; i++) {
    setPixel(p, 7, i, 120, 120, 110);
    setPixel(p, 8, i, 120, 120, 110);
    setPixel(p, i, 7, 120, 120, 110);
    setPixel(p, i, 8, 120, 120, 110);
  }
  return p;
};

// Building wall — solid darker block
tiles['building_wall'] = () => {
  const p = createCanvas();
  fill(p, 70, 65, 60);
  // Brick-like pattern
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x++)
      setPixel(p, x, y, 55, 50, 45);
    const offset = (y % 8 === 0) ? 0 : 4;
    for (let x = offset; x < TILE; x += 8)
      for (let dy = 0; dy < 4 && y + dy < TILE; dy++)
        setPixel(p, x, y + dy, 55, 50, 45);
  }
  return p;
};

// Building floor — lighter interior
tiles['building_floor'] = () => {
  const p = createCanvas();
  fill(p, 130, 125, 115);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(p, x, y, noise(130, 6), noise(125, 6), noise(115, 6));
  // Tile grid lines
  for (let i = 0; i < TILE; i += 8) {
    for (let j = 0; j < TILE; j++) {
      setPixel(p, i, j, 115, 110, 100);
      setPixel(p, j, i, 115, 110, 100);
    }
  }
  return p;
};

// Building door — darker frame with lighter center
tiles['building_door'] = () => {
  const p = createCanvas();
  fill(p, 100, 100, 95); // road base
  // Door frame
  rect(p, 4, 0, 11, 15, 60, 55, 50);
  // Door panel
  rect(p, 5, 1, 10, 14, 140, 120, 80);
  // Handle
  setPixel(p, 9, 8, 180, 170, 100);
  return p;
};

// Shop trade — building with trade symbol (crate icon)
tiles['shop_trade'] = () => {
  const p = createCanvas();
  fill(p, 130, 125, 115); // floor base
  // Crate symbol
  rect(p, 4, 4, 11, 11, 160, 140, 80);
  rect(p, 5, 5, 10, 10, 140, 120, 60);
  // Cross on crate
  for (let i = 5; i <= 10; i++) {
    setPixel(p, 7, i, 100, 80, 40);
    setPixel(p, 8, i, 100, 80, 40);
    setPixel(p, i, 7, 100, 80, 40);
    setPixel(p, i, 8, 100, 80, 40);
  }
  return p;
};

// Shop modules — building with gear/wrench symbol
tiles['shop_modules'] = () => {
  const p = createCanvas();
  fill(p, 130, 125, 115); // floor base
  // Gear symbol (simplified)
  rect(p, 6, 4, 9, 11, 140, 150, 170);
  rect(p, 4, 6, 11, 9, 140, 150, 170);
  rect(p, 6, 6, 9, 9, 100, 110, 130);
  // Center dot
  setPixel(p, 7, 7, 180, 190, 200);
  setPixel(p, 8, 7, 180, 190, 200);
  setPixel(p, 7, 8, 180, 190, 200);
  setPixel(p, 8, 8, 180, 190, 200);
  return p;
};

// Plaza — open paved area
tiles['plaza'] = () => {
  const p = createCanvas();
  fill(p, 115, 112, 105);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(p, x, y, noise(115, 5), noise(112, 5), noise(105, 5));
  // Decorative pattern
  setPixel(p, 4, 4, 130, 128, 120);
  setPixel(p, 11, 4, 130, 128, 120);
  setPixel(p, 4, 11, 130, 128, 120);
  setPixel(p, 11, 11, 130, 128, 120);
  return p;
};

// Fence — barrier
tiles['fence'] = () => {
  const p = createCanvas();
  // Transparent base
  fill(p, 0, 0, 0, 0);
  // Fence posts
  for (let x = 0; x < TILE; x += 4) {
    rect(p, x, 4, x + 1, 12, 90, 80, 60);
  }
  // Horizontal bars
  for (let x = 0; x < TILE; x++) {
    setPixel(p, x, 6, 100, 90, 70);
    setPixel(p, x, 10, 100, 90, 70);
  }
  return p;
};

// Lamp — street light
tiles['lamp'] = () => {
  const p = createCanvas();
  fill(p, 100, 100, 95); // road base
  // Pole
  rect(p, 7, 3, 8, 13, 80, 80, 85);
  // Light
  rect(p, 5, 1, 10, 3, 200, 200, 150);
  setPixel(p, 6, 2, 240, 240, 180);
  setPixel(p, 9, 2, 240, 240, 180);
  return p;
};

// Player (person sprite — reuse from ruins but distinct)
tiles['person'] = () => {
  const p = createCanvas();
  fill(p, 0, 0, 0, 0);
  // Head
  rect(p, 6, 1, 9, 4, 180, 160, 140);
  // Body
  rect(p, 6, 5, 9, 10, 100, 140, 180);
  // Legs
  rect(p, 6, 11, 7, 14, 80, 80, 100);
  rect(p, 8, 11, 9, 14, 80, 80, 100);
  return p;
};

// ─── Write files ────────────────────────────────────────

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

let count = 0;
for (const [name, gen] of Object.entries(tiles)) {
  const pixels = gen();
  const png = createPNG(TILE, TILE, pixels);
  const filePath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(filePath, png);
  count++;
}

console.log(`Generated ${count} settlement tiles in ${OUT_DIR}`);
