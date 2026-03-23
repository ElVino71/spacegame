/**
 * Generate placeholder 16×16 flora & fauna tile PNGs.
 *
 * Run:  node scripts/generate-bio-tiles.js
 *
 * Outputs to assets/tiles/flora/ and assets/tiles/fauna/.
 * These are tinted at runtime per planet type — draw them in
 * neutral/light colors so tinting works well.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 16;

// ─── Minimal PNG encoder ────────────────────────────────

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = y * (1 + width * 4) + 1 + x * 4;
      raw[d] = pixels[s]; raw[d+1] = pixels[s+1]; raw[d+2] = pixels[s+2]; raw[d+3] = pixels[s+3];
    }
  }
  const idatChunk = makeChunk('IDAT', zlib.deflateSync(raw));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}

// ─── Pixel helpers ──────────────────────────────────────

function px() { return new Uint8Array(TILE * TILE * 4); }
function set(p, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  p[i] = r; p[i+1] = g; p[i+2] = b; p[i+3] = a;
}
function clear(p) { p.fill(0); }
function noise(v, r) { return Math.max(0, Math.min(255, v + Math.floor(Math.random() * r * 2 - r))); }

// ─── FLORA ──────────────────────────────────────────────

const flora = {};

// Alien tree — tall trunk with canopy (tintable, neutral green-gray)
flora['tree_1'] = () => {
  const p = px(); clear(p);
  // Trunk
  for (let y = 7; y < 15; y++) { set(p, 7, y, 140, 120, 100); set(p, 8, y, 130, 110, 90); }
  // Canopy — round blob
  for (let y = 1; y < 9; y++)
    for (let x = 3; x < 13; x++) {
      const dx = x - 7.5, dy = y - 4.5;
      if (dx*dx + dy*dy < 18) set(p, x, y, noise(180, 15), noise(200, 15), noise(170, 15));
    }
  // Highlight
  set(p, 5, 3, 210, 230, 200); set(p, 6, 2, 220, 240, 210);
  return p;
};

// Alien tree variant — spindly with fronds
flora['tree_2'] = () => {
  const p = px(); clear(p);
  // Thin trunk
  for (let y = 5; y < 15; y++) set(p, 8, y, 150, 130, 110);
  // Fronds spreading out
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI/2;
    for (let r = 1; r < 6; r++) {
      const fx = Math.round(8 + Math.cos(angle) * r);
      const fy = Math.round(4 + Math.sin(angle) * r * 0.7);
      set(p, fx, fy, noise(170, 12), noise(190, 12), noise(160, 12));
    }
  }
  // Tips
  set(p, 3, 3, 200, 220, 190); set(p, 13, 3, 200, 220, 190);
  set(p, 5, 1, 210, 230, 200); set(p, 11, 1, 210, 230, 200);
  return p;
};

// Bush — small low shrub
flora['bush_1'] = () => {
  const p = px(); clear(p);
  for (let y = 7; y < 14; y++)
    for (let x = 3; x < 13; x++) {
      const dx = x - 8, dy = y - 10;
      if (dx*dx*0.7 + dy*dy < 12) set(p, x, y, noise(160, 15), noise(180, 15), noise(150, 15));
    }
  set(p, 5, 8, 190, 210, 180); set(p, 10, 9, 190, 210, 180);
  return p;
};

// Bush variant — spiky
flora['bush_2'] = () => {
  const p = px(); clear(p);
  // Base
  for (let y = 9; y < 14; y++)
    for (let x = 4; x < 12; x++)
      set(p, x, y, noise(150, 12), noise(170, 12), noise(140, 12));
  // Spikes
  const spikes = [[5,5],[7,4],[9,3],[11,5],[8,6],[6,7],[10,7]];
  for (const [sx, sy] of spikes) {
    set(p, sx, sy, noise(180, 10), noise(200, 10), noise(170, 10));
    set(p, sx, sy+1, noise(160, 10), noise(180, 10), noise(150, 10));
  }
  return p;
};

// Alien mushroom — bulbous cap on stalk
flora['mushroom'] = () => {
  const p = px(); clear(p);
  // Stalk
  for (let y = 9; y < 15; y++) { set(p, 7, y, 200, 190, 180); set(p, 8, y, 190, 180, 170); }
  // Cap
  for (let y = 3; y < 10; y++)
    for (let x = 3; x < 13; x++) {
      const dx = x - 7.5, dy = (y - 6) * 1.5;
      if (dx*dx + dy*dy < 18) set(p, x, y, noise(200, 15), noise(170, 15), noise(190, 15));
    }
  // Spots on cap
  set(p, 5, 5, 240, 220, 235); set(p, 9, 6, 240, 220, 235);
  set(p, 7, 4, 230, 210, 225); set(p, 6, 7, 240, 220, 235);
  // Glow underneath
  set(p, 6, 9, 220, 200, 215); set(p, 9, 9, 220, 200, 215);
  return p;
};

// Crystal plant — geometric crystalline growth
flora['crystal_plant'] = () => {
  const p = px(); clear(p);
  // Main crystal shard
  for (let y = 2; y < 14; y++) {
    const w = y < 8 ? Math.max(1, 4 - Math.abs(y - 5)) : Math.max(1, 4 - Math.abs(y - 11));
    for (let dx = -w; dx <= w; dx++)
      set(p, 7 + dx, y, noise(200, 15), noise(210, 15), noise(230, 15));
  }
  // Side shards
  for (let y = 5; y < 11; y++) set(p, 4, y, noise(180, 10), noise(190, 10), noise(220, 10));
  for (let y = 4; y < 10; y++) set(p, 11, y, noise(180, 10), noise(190, 10), noise(220, 10));
  // Sparkle
  set(p, 7, 3, 255, 255, 255); set(p, 4, 6, 240, 245, 255); set(p, 11, 5, 240, 245, 255);
  return p;
};

// Cactus — tall desert plant
flora['cactus'] = () => {
  const p = px(); clear(p);
  // Main body
  for (let y = 3; y < 15; y++) {
    set(p, 7, y, noise(160, 10), noise(180, 10), noise(150, 10));
    set(p, 8, y, noise(150, 10), noise(170, 10), noise(140, 10));
  }
  // Left arm
  for (let x = 4; x < 7; x++) set(p, x, 7, noise(155, 10), noise(175, 10), noise(145, 10));
  for (let y = 5; y < 8; y++) set(p, 4, y, noise(155, 10), noise(175, 10), noise(145, 10));
  // Right arm
  for (let x = 9; x < 12; x++) set(p, x, 9, noise(155, 10), noise(175, 10), noise(145, 10));
  for (let y = 7; y < 10; y++) set(p, 11, y, noise(155, 10), noise(175, 10), noise(145, 10));
  // Spines
  set(p, 6, 4, 220, 220, 200); set(p, 9, 5, 220, 220, 200);
  set(p, 3, 6, 220, 220, 200); set(p, 12, 8, 220, 220, 200);
  return p;
};

// Flower — colorful blossom
flora['flower'] = () => {
  const p = px(); clear(p);
  // Stem
  for (let y = 8; y < 15; y++) set(p, 8, y, noise(140, 10), noise(170, 10), noise(130, 10));
  set(p, 7, 12, noise(150, 10), noise(180, 10), noise(140, 10)); // leaf
  set(p, 6, 11, noise(150, 10), noise(180, 10), noise(140, 10));
  // Petals (neutral — will be tinted)
  const petals = [[8,4],[6,5],[10,5],[6,7],[10,7],[8,8],[7,4],[9,4],[7,8],[9,8]];
  for (const [fx, fy] of petals)
    set(p, fx, fy, noise(210, 15), noise(200, 15), noise(210, 15));
  // Center
  set(p, 8, 6, 240, 230, 200); set(p, 7, 6, 240, 230, 200);
  set(p, 8, 5, 230, 220, 190); set(p, 7, 5, 230, 220, 190);
  return p;
};

// Moss/lichen — low ground cover
flora['moss'] = () => {
  const p = px(); clear(p);
  for (let y = 8; y < 16; y++)
    for (let x = 1; x < 15; x++) {
      if (Math.random() > 0.4)
        set(p, x, y, noise(150, 20), noise(175, 20), noise(140, 20));
    }
  // Thicker clumps
  for (let y = 10; y < 14; y++)
    for (let x = 4; x < 12; x++) {
      if (Math.random() > 0.3)
        set(p, x, y, noise(160, 15), noise(185, 15), noise(150, 15));
    }
  return p;
};

// Vine — climbing tendril
flora['vine'] = () => {
  const p = px(); clear(p);
  let x = 8;
  for (let y = 0; y < 16; y++) {
    x += Math.floor(Math.random() * 3) - 1;
    x = Math.max(3, Math.min(12, x));
    set(p, x, y, noise(150, 12), noise(180, 12), noise(140, 12));
    set(p, x+1, y, noise(140, 12), noise(170, 12), noise(130, 12));
    // Leaf buds
    if (y % 4 === 0) {
      const side = y % 8 === 0 ? -1 : 1;
      set(p, x + side*2, y, noise(170, 10), noise(200, 10), noise(160, 10));
      set(p, x + side*2, y-1, noise(180, 10), noise(210, 10), noise(170, 10));
    }
  }
  return p;
};

// ─── FAUNA ──────────────────────────────────────────────

const fauna = {};

// Small critter — beetle-like
fauna['critter_1'] = () => {
  const p = px(); clear(p);
  // Body
  for (let y = 7; y < 12; y++)
    for (let x = 5; x < 11; x++) {
      const dx = x - 8, dy = y - 9;
      if (dx*dx + dy*dy < 10) set(p, x, y, noise(170, 15), noise(155, 15), noise(140, 15));
    }
  // Shell pattern
  set(p, 7, 8, 200, 180, 160); set(p, 9, 8, 200, 180, 160);
  set(p, 8, 9, 190, 170, 150);
  // Legs
  set(p, 4, 9, 140, 130, 120); set(p, 4, 10, 140, 130, 120);
  set(p, 11, 9, 140, 130, 120); set(p, 11, 10, 140, 130, 120);
  // Antennae
  set(p, 6, 6, 160, 150, 140); set(p, 10, 6, 160, 150, 140);
  set(p, 5, 5, 170, 160, 150); set(p, 11, 5, 170, 160, 150);
  // Eyes
  set(p, 6, 7, 220, 220, 200); set(p, 10, 7, 220, 220, 200);
  return p;
};

// Small critter variant — slug-like
fauna['critter_2'] = () => {
  const p = px(); clear(p);
  // Elongated body
  for (let x = 3; x < 13; x++) {
    const w = x < 8 ? 2 : 1;
    for (let dy = -w; dy <= w; dy++)
      set(p, x, 9 + dy, noise(180, 12), noise(170, 12), noise(155, 12));
  }
  // Eye stalks
  set(p, 3, 7, 190, 180, 165); set(p, 3, 6, 220, 220, 210);
  set(p, 5, 7, 190, 180, 165); set(p, 5, 6, 220, 220, 210);
  // Trail
  set(p, 13, 9, 150, 160, 170, 100); set(p, 14, 9, 140, 150, 160, 60);
  return p;
};

// Grazer — medium quadruped
fauna['grazer'] = () => {
  const p = px(); clear(p);
  // Body
  for (let y = 5; y < 10; y++)
    for (let x = 3; x < 12; x++)
      set(p, x, y, noise(175, 12), noise(165, 12), noise(155, 12));
  // Head
  for (let y = 3; y < 7; y++)
    for (let x = 1; x < 5; x++)
      set(p, x, y, noise(185, 10), noise(175, 10), noise(165, 10));
  // Legs
  for (let y = 10; y < 14; y++) {
    set(p, 4, y, 155, 145, 135); set(p, 5, y, 155, 145, 135);
    set(p, 9, y, 155, 145, 135); set(p, 10, y, 155, 145, 135);
  }
  // Eye
  set(p, 2, 4, 220, 220, 210);
  // Tail
  set(p, 12, 5, 165, 155, 145); set(p, 13, 4, 170, 160, 150);
  return p;
};

// Predator — larger, more angular
fauna['predator'] = () => {
  const p = px(); clear(p);
  // Body
  for (let y = 5; y < 11; y++)
    for (let x = 4; x < 13; x++)
      set(p, x, y, noise(160, 12), noise(145, 12), noise(140, 12));
  // Head — angular
  for (let y = 3; y < 8; y++)
    for (let x = 1; x < 5; x++)
      set(p, x, y, noise(170, 10), noise(155, 10), noise(150, 10));
  // Jaw
  set(p, 1, 7, 150, 135, 130); set(p, 2, 7, 150, 135, 130);
  // Teeth
  set(p, 1, 6, 230, 230, 220); set(p, 2, 6, 230, 230, 220);
  // Eyes — menacing
  set(p, 2, 4, 240, 200, 180); set(p, 3, 4, 240, 200, 180);
  // Legs
  for (let y = 11; y < 14; y++) {
    set(p, 5, y, 145, 130, 125); set(p, 6, y, 145, 130, 125);
    set(p, 10, y, 145, 130, 125); set(p, 11, y, 145, 130, 125);
  }
  // Tail
  set(p, 13, 6, 155, 140, 135); set(p, 14, 5, 160, 145, 140);
  // Stripe pattern
  set(p, 6, 6, 180, 165, 160); set(p, 8, 7, 180, 165, 160); set(p, 10, 6, 180, 165, 160);
  return p;
};

// Flyer — winged creature
fauna['flyer'] = () => {
  const p = px(); clear(p);
  // Body
  for (let y = 6; y < 10; y++)
    for (let x = 6; x < 10; x++)
      set(p, x, y, noise(180, 12), noise(170, 12), noise(165, 12));
  // Left wing
  for (let x = 1; x < 7; x++) {
    const wy = 7 - Math.abs(x - 4) * 0.5;
    set(p, x, Math.floor(wy), noise(190, 12), noise(185, 12), noise(180, 12));
    set(p, x, Math.floor(wy) + 1, noise(180, 12), noise(175, 12), noise(170, 12));
  }
  // Right wing
  for (let x = 9; x < 15; x++) {
    const wy = 7 - Math.abs(x - 12) * 0.5;
    set(p, x, Math.floor(wy), noise(190, 12), noise(185, 12), noise(180, 12));
    set(p, x, Math.floor(wy) + 1, noise(180, 12), noise(175, 12), noise(170, 12));
  }
  // Head
  set(p, 7, 5, 195, 185, 180); set(p, 8, 5, 195, 185, 180);
  // Eyes
  set(p, 7, 5, 230, 220, 200); set(p, 8, 5, 230, 220, 200);
  // Tail
  set(p, 7, 10, 170, 160, 155); set(p, 8, 10, 170, 160, 155);
  set(p, 8, 11, 165, 155, 150);
  return p;
};

// Insect — small multi-legged
fauna['insect'] = () => {
  const p = px(); clear(p);
  // Body segments
  for (const [bx, by] of [[7,7],[8,8],[9,9],[10,10]]) {
    set(p, bx, by, noise(175, 12), noise(165, 12), noise(150, 12));
    set(p, bx+1, by, noise(170, 12), noise(160, 12), noise(145, 12));
  }
  // Legs (3 pairs)
  const legs = [[7,7],[8,8],[10,10]];
  for (const [lx, ly] of legs) {
    set(p, lx-2, ly-1, 155, 145, 130); set(p, lx-1, ly, 155, 145, 130);
    set(p, lx+3, ly-1, 155, 145, 130); set(p, lx+2, ly, 155, 145, 130);
  }
  // Head
  set(p, 6, 6, 185, 175, 160); set(p, 6, 5, 185, 175, 160);
  // Antennae
  set(p, 5, 4, 165, 155, 140); set(p, 4, 3, 170, 160, 145);
  set(p, 7, 4, 165, 155, 140); set(p, 8, 3, 170, 160, 145);
  // Eyes
  set(p, 5, 5, 220, 210, 190); set(p, 7, 5, 220, 210, 190);
  return p;
};

// ─── Write files ────────────────────────────────────────

const floraDir = path.join(__dirname, '..', 'assets', 'tiles', 'flora');
const faunaDir = path.join(__dirname, '..', 'assets', 'tiles', 'fauna');
fs.mkdirSync(floraDir, { recursive: true });
fs.mkdirSync(faunaDir, { recursive: true });

let count = 0;
for (const [name, gen] of Object.entries(flora)) {
  fs.writeFileSync(path.join(floraDir, `${name}.png`), createPNG(TILE, TILE, gen()));
  count++;
}
for (const [name, gen] of Object.entries(fauna)) {
  fs.writeFileSync(path.join(faunaDir, `${name}.png`), createPNG(TILE, TILE, gen()));
  count++;
}

console.log(`Generated ${count} biology tiles:`);
console.log('\nFlora (assets/tiles/flora/):');
for (const name of Object.keys(flora)) console.log(`  - ${name}.png`);
console.log('\nFauna (assets/tiles/fauna/):');
for (const name of Object.keys(fauna)) console.log(`  - ${name}.png`);
console.log('\nAll tiles are tinted per planet type at runtime.');
