/**
 * Generate placeholder 16×16 tile PNGs for planet surfaces.
 *
 * Run:  node scripts/generate-tiles.js
 *
 * Outputs to assets/tiles/. Edit the PNGs in any pixel-art editor
 * (Aseprite, Piskel, GIMP, etc.) to replace with your own art.
 * The game loads these files at boot.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 16;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles');

// ─── Minimal PNG encoder (no dependencies) ──────────────

function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values (width * height * 4)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT — filter each row with filter type 0 (None)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter byte
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

  // IEND
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

function createCanvas() {
  return new Uint8Array(TILE * TILE * 4);
}

function setPixel(pixels, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function fill(pixels, r, g, b, a = 255) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      setPixel(pixels, x, y, r, g, b, a);
}

function noise(v, range) {
  return Math.max(0, Math.min(255, v + Math.floor(Math.random() * range * 2 - range)));
}

// ─── Tile generators ────────────────────────────────────

const tiles = {};

// --- Ground variants (neutral gray tones — tinted by game per planet type) ---
tiles['ground_1'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(160, 15);
      setPixel(p, x, y, v, v, v);
    }
  return p;
};

tiles['ground_2'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(150, 20);
      setPixel(p, x, y, v, v, v);
    }
  // Add small pebbles
  for (let i = 0; i < 4; i++) {
    const px = Math.floor(Math.random() * 14) + 1;
    const py = Math.floor(Math.random() * 14) + 1;
    const v = noise(120, 10);
    setPixel(p, px, py, v, v, v);
  }
  return p;
};

tiles['ground_3'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(140, 12);
      setPixel(p, x, y, v, v, v);
    }
  // Subtle cracks
  const cx = 4 + Math.floor(Math.random() * 8);
  for (let y = 3; y < 13; y++) {
    const v = noise(100, 8);
    setPixel(p, cx + (y % 3 === 0 ? 1 : 0), y, v, v, v);
  }
  return p;
};

// --- Rock (obstacle) ---
tiles['rock'] = () => {
  const p = createCanvas();
  fill(p, 0, 0, 0, 0); // transparent background
  // Rock shape
  for (let y = 3; y < 14; y++)
    for (let x = 2; x < 14; x++) {
      const dx = x - 8, dy = y - 8;
      if (dx * dx + dy * dy < 38) {
        const v = noise(100, 15);
        setPixel(p, x, y, v, v, v);
      }
    }
  // Highlight
  for (let y = 4; y < 7; y++)
    for (let x = 4; x < 8; x++) {
      const dx = x - 6, dy = y - 5;
      if (dx * dx + dy * dy < 5) {
        const v = noise(130, 10);
        setPixel(p, x, y, v, v, v);
      }
    }
  // Dark bottom edge
  for (let x = 4; x < 12; x++) {
    const v = noise(70, 8);
    setPixel(p, x, 13, v, v, v);
  }
  return p;
};

// --- Mineral deposit (golden sparkle) ---
tiles['mineral'] = () => {
  const p = createCanvas();
  // Base ground
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(140, 10);
      setPixel(p, x, y, v, v - 20, v - 40);
    }
  // Crystal formations
  const crystals = [[4, 4], [7, 6], [10, 3], [5, 10], [11, 9], [8, 12]];
  for (const [cx, cy] of crystals) {
    setPixel(p, cx, cy, 255, 230, 50);
    setPixel(p, cx, cy - 1, 255, 255, 100);
    setPixel(p, cx + 1, cy, 220, 200, 30);
    setPixel(p, cx, cy + 1, 200, 180, 20);
  }
  // Sparkle pixels
  setPixel(p, 3, 7, 255, 255, 200);
  setPixel(p, 12, 5, 255, 255, 180);
  setPixel(p, 9, 13, 255, 255, 220);
  return p;
};

// --- Ruin entrance (ancient purple stone) ---
tiles['ruin'] = () => {
  const p = createCanvas();
  fill(p, 40, 20, 50);
  // Doorway
  for (let y = 3; y < 15; y++) {
    setPixel(p, 5, y, 80, 50, 100);
    setPixel(p, 10, y, 80, 50, 100);
  }
  for (let x = 5; x <= 10; x++) {
    setPixel(p, x, 3, 80, 50, 100);
    setPixel(p, x, 4, 80, 50, 100);
  }
  // Dark interior
  for (let y = 5; y < 15; y++)
    for (let x = 6; x < 10; x++)
      setPixel(p, x, y, 15, 5, 25);
  // Glowing glyphs
  setPixel(p, 3, 6, 180, 100, 255);
  setPixel(p, 12, 6, 180, 100, 255);
  setPixel(p, 3, 10, 140, 80, 220);
  setPixel(p, 12, 10, 140, 80, 220);
  // Top symbol
  setPixel(p, 7, 1, 200, 130, 255);
  setPixel(p, 8, 1, 200, 130, 255);
  setPixel(p, 7, 2, 160, 100, 220);
  setPixel(p, 8, 2, 160, 100, 220);
  return p;
};

// --- Settlement (small structures) ---
tiles['settlement'] = () => {
  const p = createCanvas();
  // Ground
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(80, 8);
      setPixel(p, x, y, v - 20, v - 10, v + 20);
    }
  // Building
  for (let y = 3; y < 12; y++)
    for (let x = 4; x < 12; x++)
      setPixel(p, x, y, 100, 120, 150);
  // Roof
  for (let x = 3; x < 13; x++) {
    setPixel(p, x, 2, 120, 140, 170);
    setPixel(p, x, 3, 110, 130, 160);
  }
  // Door
  setPixel(p, 7, 10, 40, 60, 90);
  setPixel(p, 8, 10, 40, 60, 90);
  setPixel(p, 7, 11, 40, 60, 90);
  setPixel(p, 8, 11, 40, 60, 90);
  // Window (lit)
  setPixel(p, 5, 6, 200, 220, 255);
  setPixel(p, 6, 6, 200, 220, 255);
  setPixel(p, 10, 6, 200, 220, 255);
  setPixel(p, 9, 6, 200, 220, 255);
  // Light indicator
  setPixel(p, 7, 0, 0, 180, 255);
  setPixel(p, 8, 0, 0, 180, 255);
  return p;
};

// --- Water ---
tiles['water'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const wave = Math.sin((x + y * 0.5) * 0.8) * 15;
      const r = 15 + Math.floor(wave);
      const g = 50 + Math.floor(wave * 1.5);
      const b = noise(160, 15);
      setPixel(p, x, y, Math.max(0, r), Math.max(0, g), b);
    }
  // Highlights
  setPixel(p, 3, 4, 100, 150, 220);
  setPixel(p, 4, 4, 120, 170, 240);
  setPixel(p, 10, 9, 100, 150, 220);
  setPixel(p, 11, 9, 110, 160, 230);
  return p;
};

// --- Lava ---
tiles['lava'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const heat = Math.sin((x * 0.6 + y * 0.4) * 1.2) * 0.5 + 0.5;
      const r = 180 + Math.floor(heat * 75);
      const g = 40 + Math.floor(heat * 80);
      const b = noise(5, 10);
      setPixel(p, x, y, Math.min(255, r), Math.min(255, g), Math.max(0, b));
    }
  // Hot spots
  setPixel(p, 5, 5, 255, 255, 100);
  setPixel(p, 6, 5, 255, 240, 80);
  setPixel(p, 10, 11, 255, 255, 120);
  setPixel(p, 3, 12, 255, 230, 60);
  // Dark cooling crust edges
  setPixel(p, 0, 0, 80, 20, 5);
  setPixel(p, 15, 15, 90, 25, 5);
  setPixel(p, 15, 0, 70, 15, 5);
  setPixel(p, 0, 15, 85, 22, 5);
  return p;
};

// --- Player character (top-down view) ---
tiles['player'] = () => {
  const p = createCanvas();
  fill(p, 0, 0, 0, 0); // transparent
  // Body (green suit)
  for (let y = 4; y < 14; y++)
    for (let x = 5; x < 11; x++)
      setPixel(p, x, y, 0, 200, 100);
  // Head
  for (let y = 2; y < 6; y++)
    for (let x = 6; x < 10; x++)
      setPixel(p, x, y, 0, 230, 120);
  // Visor
  setPixel(p, 7, 3, 100, 200, 255);
  setPixel(p, 8, 3, 100, 200, 255);
  setPixel(p, 7, 4, 80, 180, 240);
  setPixel(p, 8, 4, 80, 180, 240);
  // Arms
  setPixel(p, 4, 7, 0, 180, 90);
  setPixel(p, 4, 8, 0, 180, 90);
  setPixel(p, 11, 7, 0, 180, 90);
  setPixel(p, 11, 8, 0, 180, 90);
  // Boots
  setPixel(p, 6, 13, 0, 150, 70);
  setPixel(p, 7, 13, 0, 150, 70);
  setPixel(p, 8, 13, 0, 150, 70);
  setPixel(p, 9, 13, 0, 150, 70);
  setPixel(p, 6, 14, 60, 60, 60);
  setPixel(p, 7, 14, 60, 60, 60);
  setPixel(p, 8, 14, 60, 60, 60);
  setPixel(p, 9, 14, 60, 60, 60);
  return p;
};

// ─── Write files ────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const [name, generator] of Object.entries(tiles)) {
  const pixels = generator();
  const png = createPNG(TILE, TILE, pixels);
  const filePath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(filePath, png);
  count++;
}

console.log(`Generated ${count} tile PNGs in ${OUT_DIR}`);
console.log('Tile list:');
for (const name of Object.keys(tiles)) {
  console.log(`  - ${name}.png (${TILE}×${TILE})`);
}
console.log('\nEdit these files in any pixel art editor to customize!');
console.log('Ground tiles (ground_1/2/3, rock) are tinted by the game per planet type.');
console.log('Special tiles (mineral, ruin, settlement, water, lava) use their own colors.');
