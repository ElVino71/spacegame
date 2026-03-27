/**
 * Generate placeholder 16x16 tile PNGs for ruins interiors.
 *
 * Run:  node scripts/generate-ruins-tiles.js
 *
 * Outputs to assets/tiles/ruins/
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 16;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles', 'ruins');

// ─── Minimal PNG encoder (same as generate-tiles.js) ─────

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
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

// --- Floor variant 1: smooth stone ---
tiles['floor_1'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(55, 8);
      setPixel(p, x, y, v - 5, v - 3, v + 10);
    }
  // Subtle tile grid lines
  for (let x = 0; x < TILE; x++) {
    setPixel(p, x, 0, 40, 38, 50);
    setPixel(p, x, 15, 40, 38, 50);
  }
  for (let y = 0; y < TILE; y++) {
    setPixel(p, 0, y, 40, 38, 50);
    setPixel(p, 15, y, 40, 38, 50);
  }
  return p;
};

// --- Floor variant 2: cracked stone ---
tiles['floor_2'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(50, 10);
      setPixel(p, x, y, v - 3, v - 2, v + 8);
    }
  // Cracks
  for (let i = 3; i < 12; i++) {
    setPixel(p, i, 7, 30, 25, 35);
    setPixel(p, i + 1, 8, 30, 25, 35);
  }
  setPixel(p, 5, 6, 30, 25, 35);
  setPixel(p, 10, 9, 30, 25, 35);
  return p;
};

// --- Floor variant 3: mossy stone ---
tiles['floor_3'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 8);
      setPixel(p, x, y, v - 5, v, v + 5);
    }
  // Moss patches (greenish)
  for (let i = 0; i < 6; i++) {
    const mx = Math.floor(Math.random() * 14) + 1;
    const my = Math.floor(Math.random() * 14) + 1;
    setPixel(p, mx, my, 30, 55, 25);
    setPixel(p, mx + 1, my, 25, 50, 22);
  }
  return p;
};

// --- Wall: solid ancient stone block ---
tiles['wall'] = () => {
  const p = createCanvas();
  // Dark stone fill
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(35, 5);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Brick mortar lines
  for (let x = 0; x < TILE; x++) {
    setPixel(p, x, 0, 25, 22, 30);
    setPixel(p, x, 7, 25, 22, 30);
    setPixel(p, x, 15, 25, 22, 30);
  }
  // Vertical mortar (offset between rows)
  for (let y = 1; y < 7; y++) {
    setPixel(p, 7, y, 25, 22, 30);
  }
  for (let y = 8; y < 15; y++) {
    setPixel(p, 3, y, 25, 22, 30);
    setPixel(p, 11, y, 25, 22, 30);
  }
  // Subtle glyph/carving highlight on some bricks
  setPixel(p, 10, 3, 50, 40, 65);
  setPixel(p, 11, 3, 50, 40, 65);
  setPixel(p, 10, 4, 45, 38, 60);
  return p;
};

// --- Door: ancient stone door with glyph ---
tiles['door_closed'] = () => {
  const p = createCanvas();
  // Door body (dark brownish-purple stone)
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(45, 5);
      setPixel(p, x, y, v + 5, v - 8, v + 10);
    }
  // Door frame (lighter)
  for (let y = 0; y < TILE; y++) {
    setPixel(p, 0, y, 60, 50, 75);
    setPixel(p, 1, y, 60, 50, 75);
    setPixel(p, 14, y, 60, 50, 75);
    setPixel(p, 15, y, 60, 50, 75);
  }
  for (let x = 0; x < TILE; x++) {
    setPixel(p, x, 0, 60, 50, 75);
    setPixel(p, x, 1, 60, 50, 75);
  }
  // Central glyph (glowing)
  setPixel(p, 7, 6, 140, 80, 220);
  setPixel(p, 8, 6, 140, 80, 220);
  setPixel(p, 7, 7, 160, 100, 240);
  setPixel(p, 8, 7, 160, 100, 240);
  setPixel(p, 6, 7, 120, 70, 200);
  setPixel(p, 9, 7, 120, 70, 200);
  setPixel(p, 7, 8, 140, 80, 220);
  setPixel(p, 8, 8, 140, 80, 220);
  // Handle/keystone
  setPixel(p, 7, 10, 80, 70, 60);
  setPixel(p, 8, 10, 80, 70, 60);
  return p;
};

// --- Door open: walkable opening ---
tiles['door_open'] = () => {
  const p = createCanvas();
  // Dark opening (floor visible through)
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(50, 6);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Door frame sides
  for (let y = 0; y < TILE; y++) {
    setPixel(p, 0, y, 60, 50, 75);
    setPixel(p, 1, y, 55, 45, 70);
    setPixel(p, 14, y, 55, 45, 70);
    setPixel(p, 15, y, 60, 50, 75);
  }
  for (let x = 0; x < TILE; x++) {
    setPixel(p, x, 0, 60, 50, 75);
    setPixel(p, x, 1, 55, 45, 70);
  }
  // Faded glyph (dim, door is open)
  setPixel(p, 7, 6, 60, 45, 80);
  setPixel(p, 8, 6, 60, 45, 80);
  return p;
};

// --- Trap: pressure plate (looks like floor but with subtle seam) ---
tiles['trap'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(55, 8);
      setPixel(p, x, y, v - 5, v - 3, v + 10);
    }
  // Subtle square seam (slightly different shade)
  for (let i = 3; i < 13; i++) {
    setPixel(p, i, 3, 48, 42, 55);
    setPixel(p, i, 12, 48, 42, 55);
    setPixel(p, 3, i, 48, 42, 55);
    setPixel(p, 12, i, 48, 42, 55);
  }
  // Tiny hole (gas vent / arrow slit)
  setPixel(p, 7, 7, 20, 15, 25);
  setPixel(p, 8, 7, 20, 15, 25);
  setPixel(p, 7, 8, 20, 15, 25);
  setPixel(p, 8, 8, 20, 15, 25);
  return p;
};

// --- Trap triggered: visible damage ---
tiles['trap_triggered'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(50, 8);
      setPixel(p, x, y, v, v - 5, v + 5);
    }
  // Cracked open plate
  for (let i = 3; i < 13; i++) {
    setPixel(p, i, 3, 60, 30, 25);
    setPixel(p, i, 12, 60, 30, 25);
    setPixel(p, 3, i, 60, 30, 25);
    setPixel(p, 12, i, 60, 30, 25);
  }
  // Open hole with residue
  for (let y = 6; y < 10; y++)
    for (let x = 6; x < 10; x++)
      setPixel(p, x, y, 15, 10, 20);
  // Warning color residue
  setPixel(p, 5, 5, 120, 40, 20);
  setPixel(p, 10, 5, 120, 40, 20);
  setPixel(p, 5, 10, 120, 40, 20);
  setPixel(p, 10, 10, 120, 40, 20);
  return p;
};

// --- Treasure chest ---
tiles['treasure'] = () => {
  const p = createCanvas();
  // Floor underneath
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 6);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Chest body (brown/wood)
  for (let y = 6; y < 13; y++)
    for (let x = 4; x < 12; x++)
      setPixel(p, x, y, 100, 65, 30);
  // Chest lid (darker)
  for (let x = 4; x < 12; x++) {
    setPixel(p, x, 5, 80, 50, 20);
    setPixel(p, x, 6, 90, 55, 25);
  }
  // Metal bands
  for (let x = 4; x < 12; x++) {
    setPixel(p, x, 8, 150, 140, 60);
  }
  // Lock/clasp (gold)
  setPixel(p, 7, 8, 220, 200, 80);
  setPixel(p, 8, 8, 220, 200, 80);
  setPixel(p, 7, 9, 200, 180, 60);
  setPixel(p, 8, 9, 200, 180, 60);
  // Glow
  setPixel(p, 7, 4, 255, 220, 100);
  setPixel(p, 8, 4, 255, 220, 100);
  return p;
};

// --- Treasure chest opened ---
tiles['treasure_open'] = () => {
  const p = createCanvas();
  // Floor underneath
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 6);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Chest body (brown/wood)
  for (let y = 7; y < 13; y++)
    for (let x = 4; x < 12; x++)
      setPixel(p, x, y, 80, 50, 22);
  // Open lid (tilted back)
  for (let x = 4; x < 12; x++) {
    setPixel(p, x, 4, 70, 45, 18);
    setPixel(p, x, 5, 75, 48, 20);
  }
  // Empty inside (dark)
  for (let y = 7; y < 12; y++)
    for (let x = 5; x < 11; x++)
      setPixel(p, x, y, 30, 20, 10);
  return p;
};

// --- Lore tablet: ancient stone with glowing glyphs ---
tiles['lore'] = () => {
  const p = createCanvas();
  // Floor underneath
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 6);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Stone tablet/pedestal
  for (let y = 4; y < 13; y++)
    for (let x = 4; x < 12; x++)
      setPixel(p, x, y, 60, 55, 75);
  // Glowing glyph lines
  for (let x = 5; x < 11; x++) {
    setPixel(p, x, 6, 130, 80, 220);
    setPixel(p, x, 9, 110, 70, 200);
  }
  setPixel(p, 6, 7, 120, 75, 210);
  setPixel(p, 9, 7, 120, 75, 210);
  setPixel(p, 6, 10, 100, 65, 190);
  setPixel(p, 9, 10, 100, 65, 190);
  // Top glow
  setPixel(p, 7, 3, 180, 120, 255);
  setPixel(p, 8, 3, 180, 120, 255);
  return p;
};

// --- Lore tablet read (dimmed) ---
tiles['lore_read'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 6);
      setPixel(p, x, y, v - 5, v - 3, v + 8);
    }
  // Stone tablet (darker, no glow)
  for (let y = 4; y < 13; y++)
    for (let x = 4; x < 12; x++)
      setPixel(p, x, y, 50, 45, 60);
  // Faded glyphs
  for (let x = 5; x < 11; x++) {
    setPixel(p, x, 6, 60, 50, 75);
    setPixel(p, x, 9, 55, 48, 70);
  }
  return p;
};

// --- Rubble: impassable debris ---
tiles['rubble'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(48, 10);
      setPixel(p, x, y, v - 3, v - 2, v + 6);
    }
  // Scattered rocks
  const rocks = [[3,4], [7,3], [11,5], [5,9], [9,10], [6,6], [10,8], [4,12], [8,13]];
  for (const [rx, ry] of rocks) {
    const v = noise(70, 15);
    setPixel(p, rx, ry, v - 5, v - 3, v + 5);
    setPixel(p, rx + 1, ry, v - 8, v - 5, v + 3);
    setPixel(p, rx, ry + 1, v - 10, v - 7, v);
  }
  // Dust
  setPixel(p, 2, 7, 65, 60, 55);
  setPixel(p, 13, 6, 65, 60, 55);
  return p;
};

// --- Stairs up (return to surface) ---
tiles['stairs_up'] = () => {
  const p = createCanvas();
  // Base floor
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(55, 5);
      setPixel(p, x, y, v - 5, v - 3, v + 10);
    }
  // Stair steps (ascending, lighter toward top)
  for (let step = 0; step < 5; step++) {
    const y = 12 - step * 2;
    const brightness = 50 + step * 15;
    for (let x = 4; x < 12; x++) {
      setPixel(p, x, y, brightness - 5, brightness, brightness + 10);
      setPixel(p, x, y + 1, brightness - 10, brightness - 5, brightness + 5);
    }
  }
  // Light from above (yellow glow at top)
  for (let x = 5; x < 11; x++) {
    setPixel(p, x, 1, 200, 180, 100);
    setPixel(p, x, 2, 160, 140, 80);
  }
  // Arrow indicator pointing up
  setPixel(p, 7, 0, 255, 240, 150);
  setPixel(p, 8, 0, 255, 240, 150);
  return p;
};

// --- Stairs down (deeper level) ---
tiles['stairs_down'] = () => {
  const p = createCanvas();
  // Base floor
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(55, 5);
      setPixel(p, x, y, v - 5, v - 3, v + 10);
    }
  // Stair steps (descending, darker toward bottom)
  for (let step = 0; step < 5; step++) {
    const y = 2 + step * 2;
    const brightness = 70 - step * 10;
    for (let x = 4; x < 12; x++) {
      setPixel(p, x, y, brightness - 5, brightness, brightness + 10);
      setPixel(p, x, y + 1, brightness - 10, brightness - 5, brightness + 5);
    }
  }
  // Darkness below
  for (let x = 5; x < 11; x++) {
    setPixel(p, x, 13, 15, 10, 20);
    setPixel(p, x, 14, 10, 5, 15);
  }
  // Arrow indicator pointing down
  setPixel(p, 7, 15, 100, 60, 180);
  setPixel(p, 8, 15, 100, 60, 180);
  return p;
};

// --- Encounter marker: skull/danger spot ---
tiles['encounter'] = () => {
  const p = createCanvas();
  // Floor
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(52, 6);
      setPixel(p, x, y, v - 3, v - 5, v + 5);
    }
  // Bones/debris (subtle danger signs)
  setPixel(p, 4, 10, 180, 170, 150);
  setPixel(p, 5, 10, 180, 170, 150);
  setPixel(p, 6, 11, 170, 160, 140);
  setPixel(p, 10, 12, 175, 165, 145);
  setPixel(p, 11, 11, 180, 170, 150);
  // Scratch marks on floor
  for (let i = 0; i < 3; i++) {
    setPixel(p, 3 + i, 5 + i, 40, 30, 35);
    setPixel(p, 10 + i, 4 + i, 40, 30, 35);
  }
  // Faint red stain
  setPixel(p, 7, 7, 80, 25, 20);
  setPixel(p, 8, 7, 75, 22, 18);
  setPixel(p, 7, 8, 70, 20, 18);
  setPixel(p, 8, 8, 65, 18, 15);
  return p;
};

// --- Encounter cleared ---
tiles['encounter_cleared'] = () => {
  const p = createCanvas();
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = noise(54, 6);
      setPixel(p, x, y, v - 4, v - 3, v + 8);
    }
  // Scattered remains (muted)
  setPixel(p, 4, 10, 90, 85, 75);
  setPixel(p, 10, 12, 88, 83, 73);
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

console.log(`Generated ${count} ruins tile PNGs in ${OUT_DIR}`);
console.log('Tile list:');
for (const name of Object.keys(tiles)) {
  console.log(`  - ${name}.png (${TILE}x${TILE})`);
}
