/**
 * Generate 32×32 room interior tile PNGs for each theme.
 *
 * Run:  node scripts/generate-room-tiles.js
 *
 * Outputs to assets/tiles/rooms/{theme}/ — 13 files per theme:
 *   floor.png         — floor tile (metal plating with grating)
 *   wall.png          — wall/ceiling tile (paneled walls)
 *   bg_bridge.png     — bridge background (consoles, screens)
 *   bg_engine.png     — engine room (pipes, machinery)
 *   bg_weapons.png    — weapons bay (racks, ammo)
 *   bg_shields.png    — shield generator (energy coils)
 *   bg_cargo.png      — cargo bay (crates, shelves)
 *   bg_sensors.png    — sensor array (dishes, readouts)
 *   bg_computer.png   — computer core (server racks)
 *   bg_mining.png     — mining bay (drills, ore bins)
 *   bg_life_support.png — life support (tanks, filters)
 *   bg_hull.png       — hull plating (armor panels)
 *   corridor.png      — corridor connecting rooms
 *
 * Tiles are 32×32 actual size, displayed with image-rendering: pixelated.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 32;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles', 'rooms');

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

function createCanvas(w, h) {
  return new Uint8Array((w || TILE) * (h || TILE) * 4);
}

function setPixel(p, w, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= w || y < 0 || y >= (p.length / 4 / w)) return;
  const i = (y * w + x) * 4;
  p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = a;
}

function set(p, x, y, r, g, b, a = 255) {
  setPixel(p, TILE, x, y, r, g, b, a);
}

function fill(p, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      set(p, x, y, r, g, b, a);
}

function fillAll(p, r, g, b, a = 255) {
  fill(p, 0, 0, TILE - 1, TILE - 1, r, g, b, a);
}

function hLine(p, x1, x2, y, r, g, b, a = 255) {
  for (let x = x1; x <= x2; x++) set(p, x, y, r, g, b, a);
}

function vLine(p, x, y1, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) set(p, x, y, r, g, b, a);
}

function hex(str) {
  const v = parseInt(str.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function darken([r, g, b], f) {
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
}

function brighten([r, g, b], f) {
  return [
    Math.round(r + (255 - r) * f),
    Math.round(g + (255 - g) * f),
    Math.round(b + (255 - b) * f),
  ];
}

// ─── Theme definitions ───────────────────────────────────

const THEMES = {
  'retro-scifi': { border: '#00ff88', accent: '#00aaff', bg: '#0a0a1a', dark: '#006633' },
  'biological':  { border: '#cc66aa', accent: '#ff88cc', bg: '#0d0a12', dark: '#663355' },
  'steampunk':   { border: '#cc9933', accent: '#ffcc44', bg: '#1a1208', dark: '#665522' },
  'military':    { border: '#88aa66', accent: '#ccdd88', bg: '#0a0c08', dark: '#445533' },
  'alien':       { border: '#6644ff', accent: '#88aaff', bg: '#060812', dark: '#332277' },
};

// ─── Tile generators ─────────────────────────────────────

function generateFloor(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  const plateColor = brighten(bg, 0.25);
  const grateColor = brighten(bg, 0.15);
  const rivetColor = brighten(border, 0.1);
  const shadowColor = darken(bg, 0.7);

  // Base plate
  fillAll(p, ...plateColor);

  // Horizontal grating lines every 4 pixels
  for (let y = 3; y < TILE; y += 4) {
    hLine(p, 0, TILE - 1, y, ...grateColor);
  }

  // Vertical grating lines every 8 pixels
  for (let x = 7; x < TILE; x += 8) {
    vLine(p, x, 0, TILE - 1, ...grateColor);
  }

  // Plate edge highlight at top
  hLine(p, 0, TILE - 1, 0, ...brighten(plateColor, 0.15));
  // Plate edge shadow at bottom
  hLine(p, 0, TILE - 1, TILE - 1, ...shadowColor);

  // Rivets at intersections
  for (let y = 3; y < TILE; y += 8) {
    for (let x = 7; x < TILE; x += 8) {
      set(p, x, y, ...rivetColor);
      set(p, x + 1, y, ...darken(rivetColor, 0.7));
      set(p, x, y + 1, ...darken(rivetColor, 0.7));
    }
  }

  // Drainage slot
  fill(p, 14, 15, 17, 16, ...shadowColor);
  fill(p, 15, 15, 16, 16, ...darken(bg, 0.4));

  return p;
}

function generateWall(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  const panelColor = brighten(bg, 0.18);
  const edgeLight = brighten(bg, 0.35);
  const edgeDark = darken(bg, 0.6);

  // Base wall
  fillAll(p, ...panelColor);

  // Panel divisions — 2 panels side by side
  // Left panel
  fill(p, 1, 1, 14, 28, ...panelColor);
  // Right panel
  fill(p, 17, 1, 30, 28, ...panelColor);

  // Panel borders — beveled look
  // Left panel highlight (top, left)
  hLine(p, 1, 14, 1, ...edgeLight);
  vLine(p, 1, 1, 28, ...edgeLight);
  // Left panel shadow (bottom, right)
  hLine(p, 1, 14, 28, ...edgeDark);
  vLine(p, 14, 1, 28, ...edgeDark);

  // Right panel highlight
  hLine(p, 17, 30, 1, ...edgeLight);
  vLine(p, 17, 1, 28, ...edgeLight);
  // Right panel shadow
  hLine(p, 17, 30, 28, ...edgeDark);
  vLine(p, 30, 1, 28, ...edgeDark);

  // Divider strip between panels
  vLine(p, 15, 0, TILE - 1, ...edgeDark);
  vLine(p, 16, 0, TILE - 1, ...edgeLight);

  // Top molding
  hLine(p, 0, TILE - 1, 0, ...brighten(border, 0.05));

  // Bottom baseboard
  fill(p, 0, 29, TILE - 1, TILE - 1, ...darken(dark, 0.7));
  hLine(p, 0, TILE - 1, 29, ...brighten(dark, 0.1));

  // Small vent on left panel
  for (let y = 12; y <= 18; y += 2) {
    hLine(p, 4, 10, y, ...darken(bg, 0.5));
  }

  return p;
}

function generateBridge(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Console desk surface (lower half)
  fill(p, 0, 18, TILE - 1, 24, ...darken(dark, 0.8));
  hLine(p, 0, TILE - 1, 18, ...brighten(dark, 0.15));
  hLine(p, 0, TILE - 1, 24, ...darken(dark, 0.5));

  // Main screen (upper area)
  fill(p, 4, 2, 27, 14, ...darken(bg, 0.5));
  // Screen border
  hLine(p, 3, 28, 1, ...darken(border, 0.7));
  hLine(p, 3, 28, 15, ...darken(border, 0.7));
  vLine(p, 3, 1, 15, ...darken(border, 0.7));
  vLine(p, 28, 1, 15, ...darken(border, 0.7));
  // Screen content — scan lines
  for (let y = 3; y <= 13; y += 2) {
    hLine(p, 5, 26, y, ...darken(accent, 0.6));
  }
  // Blip on screen
  set(p, 16, 8, ...accent);
  set(p, 17, 8, ...accent);
  set(p, 16, 9, ...accent);

  // Console buttons row
  for (let x = 3; x <= 28; x += 3) {
    const btnColor = (x % 6 === 0) ? accent : border;
    set(p, x, 20, ...btnColor);
    set(p, x + 1, 20, ...darken(btnColor, 0.7));
    set(p, x, 21, ...darken(btnColor, 0.7));
  }

  // Small indicator lights on desk
  set(p, 5, 22, ...border);
  set(p, 8, 22, 255, 50, 50);  // red warning
  set(p, 11, 22, ...accent);
  set(p, 14, 22, ...border);

  // Desk legs
  vLine(p, 2, 25, TILE - 1, ...darken(dark, 0.6));
  vLine(p, 29, 25, TILE - 1, ...darken(dark, 0.6));

  return p;
}

function generateEngine(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Main engine cylinder (center)
  fill(p, 10, 4, 21, 27, ...darken(dark, 0.7));
  // Cylinder highlight
  vLine(p, 10, 4, 27, ...brighten(dark, 0.1));
  vLine(p, 21, 4, 27, ...darken(dark, 0.4));
  // Cylinder bands
  for (let y = 6; y <= 26; y += 5) {
    hLine(p, 9, 22, y, ...brighten(border, 0.05));
    hLine(p, 9, 22, y + 1, ...darken(dark, 0.5));
  }

  // Horizontal pipes (left side)
  fill(p, 0, 8, 8, 10, ...darken(border, 0.6));
  hLine(p, 0, 8, 8, ...brighten(border, 0.1));
  // Pipe rivets
  set(p, 2, 9, ...brighten(border, 0.2));
  set(p, 6, 9, ...brighten(border, 0.2));

  // Horizontal pipes (right side)
  fill(p, 23, 14, TILE - 1, 16, ...darken(border, 0.6));
  hLine(p, 23, TILE - 1, 14, ...brighten(border, 0.1));

  // Vertical exhaust pipe
  fill(p, 3, 18, 6, TILE - 1, ...darken(dark, 0.6));
  vLine(p, 3, 18, TILE - 1, ...brighten(dark, 0.1));

  // Steam/glow from engine
  set(p, 15, 28, ...accent);
  set(p, 16, 29, ...accent);
  set(p, 14, 29, ...darken(accent, 0.6));
  set(p, 17, 28, ...darken(accent, 0.6));

  // Pressure gauge (top right)
  fill(p, 25, 2, 29, 6, ...darken(bg, 0.5));
  hLine(p, 25, 29, 2, ...darken(border, 0.7));
  hLine(p, 25, 29, 6, ...darken(border, 0.7));
  vLine(p, 25, 2, 6, ...darken(border, 0.7));
  vLine(p, 29, 2, 6, ...darken(border, 0.7));
  // Gauge needle
  set(p, 27, 3, ...accent);
  set(p, 28, 4, ...accent);

  return p;
}

function generateWeapons(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Weapon rack (left wall)
  fill(p, 1, 2, 4, 28, ...darken(dark, 0.6));
  vLine(p, 1, 2, 28, ...brighten(dark, 0.1));
  vLine(p, 4, 2, 28, ...darken(dark, 0.4));
  // Weapons on rack (horizontal bars)
  for (let y = 5; y <= 25; y += 5) {
    hLine(p, 5, 12, y, ...darken(border, 0.7));
    hLine(p, 5, 12, y + 1, ...darken(border, 0.5));
    // Weapon tip glow
    set(p, 12, y, ...accent);
  }

  // Ammo crates (bottom right)
  fill(p, 18, 20, 28, 26, ...darken(dark, 0.7));
  hLine(p, 18, 28, 20, ...brighten(dark, 0.1));
  hLine(p, 18, 28, 23, ...darken(dark, 0.5));
  vLine(p, 23, 20, 26, ...darken(dark, 0.5));
  // Ammo markings
  set(p, 20, 22, 255, 60, 60);
  set(p, 25, 22, 255, 60, 60);

  // Targeting display (upper right)
  fill(p, 20, 2, 29, 12, ...darken(bg, 0.5));
  hLine(p, 20, 29, 2, ...darken(border, 0.7));
  hLine(p, 20, 29, 12, ...darken(border, 0.7));
  vLine(p, 20, 2, 12, ...darken(border, 0.7));
  vLine(p, 29, 2, 12, ...darken(border, 0.7));
  // Crosshair
  hLine(p, 22, 27, 7, ...darken(accent, 0.6));
  vLine(p, 24, 4, 10, ...darken(accent, 0.6));
  set(p, 24, 7, ...accent);

  // Floor ammo belt
  hLine(p, 6, 16, 28, ...darken(dark, 0.5));
  for (let x = 7; x <= 15; x += 2) {
    set(p, x, 27, ...darken(border, 0.6));
    set(p, x, 28, ...darken(border, 0.8));
  }

  return p;
}

function generateShields(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Central shield generator (hexagonal-ish shape)
  fill(p, 10, 8, 21, 24, ...darken(dark, 0.7));
  // Tapered top
  fill(p, 12, 5, 19, 7, ...darken(dark, 0.7));
  // Tapered bottom
  fill(p, 12, 25, 19, 27, ...darken(dark, 0.7));

  // Energy coils — concentric rings
  for (let r = 3; r <= 7; r += 2) {
    const cx = 16, cy = 16;
    const coilColor = darken(accent, 0.5 + (r - 3) * 0.1);
    // Draw simple diamond shape for each ring
    for (let i = 0; i <= r; i++) {
      set(p, cx + i, cy - r + i, ...coilColor);
      set(p, cx - i, cy - r + i, ...coilColor);
      set(p, cx + i, cy + r - i, ...coilColor);
      set(p, cx - i, cy + r - i, ...coilColor);
    }
  }

  // Center glow
  set(p, 15, 15, ...accent);
  set(p, 16, 15, ...accent);
  set(p, 15, 16, ...accent);
  set(p, 16, 16, ...accent);
  set(p, 16, 17, ...brighten(accent, 0.3));
  set(p, 15, 17, ...brighten(accent, 0.3));

  // Power conduits (left and right)
  vLine(p, 5, 10, 22, ...darken(border, 0.6));
  vLine(p, 6, 10, 22, ...darken(border, 0.8));
  vLine(p, 25, 10, 22, ...darken(border, 0.6));
  vLine(p, 26, 10, 22, ...darken(border, 0.8));
  // Conduit connectors to generator
  hLine(p, 7, 9, 16, ...darken(accent, 0.5));
  hLine(p, 22, 24, 16, ...darken(accent, 0.5));

  // Energy sparks
  set(p, 8, 12, ...accent);
  set(p, 24, 20, ...accent);
  set(p, 3, 16, ...darken(accent, 0.4));

  return p;
}

function generateCargo(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Shelf rack (background)
  fill(p, 0, 0, TILE - 1, 2, ...darken(dark, 0.6));
  fill(p, 0, 14, TILE - 1, 16, ...darken(dark, 0.6));
  // Shelf brackets
  vLine(p, 0, 0, 16, ...darken(dark, 0.5));
  vLine(p, TILE - 1, 0, 16, ...darken(dark, 0.5));

  // Top shelf crates
  // Crate 1
  fill(p, 2, 3, 9, 13, ...darken(dark, 0.7));
  hLine(p, 2, 9, 3, ...brighten(dark, 0.1));
  vLine(p, 2, 3, 13, ...brighten(dark, 0.05));
  hLine(p, 2, 9, 8, ...darken(dark, 0.5));
  // Label
  set(p, 5, 6, ...accent);
  set(p, 6, 6, ...accent);

  // Crate 2
  fill(p, 11, 5, 18, 13, ...darken(border, 0.5));
  hLine(p, 11, 18, 5, ...brighten(border, 0.05));
  hLine(p, 11, 18, 9, ...darken(border, 0.3));
  // Hazard marking
  set(p, 14, 7, 255, 200, 0);
  set(p, 15, 7, 255, 200, 0);

  // Crate 3 (small)
  fill(p, 21, 8, 27, 13, ...darken(dark, 0.65));
  hLine(p, 21, 27, 8, ...brighten(dark, 0.1));

  // Bottom area — floor crates (stacked)
  // Large crate
  fill(p, 3, 18, 15, 28, ...darken(dark, 0.75));
  hLine(p, 3, 15, 18, ...brighten(dark, 0.1));
  vLine(p, 3, 18, 28, ...brighten(dark, 0.05));
  hLine(p, 3, 15, 23, ...darken(dark, 0.5));
  vLine(p, 9, 18, 28, ...darken(dark, 0.5));
  // Crate labels
  set(p, 6, 21, ...border);
  set(p, 12, 21, ...border);

  // Small crate on top
  fill(p, 5, 15, 11, 17, ...darken(border, 0.5));

  // Barrel (right side)
  fill(p, 20, 20, 25, 28, ...darken(dark, 0.65));
  vLine(p, 20, 20, 28, ...brighten(dark, 0.1));
  vLine(p, 25, 20, 28, ...darken(dark, 0.4));
  hLine(p, 20, 25, 22, ...darken(border, 0.5));
  hLine(p, 20, 25, 26, ...darken(border, 0.5));

  return p;
}

function generateSensors(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Satellite dish (upper left) — parabolic shape
  // Dish body
  fill(p, 2, 4, 14, 6, ...darken(border, 0.6));
  fill(p, 4, 3, 12, 3, ...darken(border, 0.6));
  fill(p, 4, 7, 12, 7, ...darken(border, 0.6));
  fill(p, 6, 2, 10, 2, ...darken(border, 0.7));
  // Dish highlight
  hLine(p, 4, 12, 3, ...brighten(border, 0.1));
  // Feed horn
  vLine(p, 8, 8, 12, ...darken(dark, 0.6));
  set(p, 8, 8, ...accent);

  // Readout display (right side)
  fill(p, 18, 2, 29, 16, ...darken(bg, 0.5));
  hLine(p, 18, 29, 2, ...darken(border, 0.7));
  hLine(p, 18, 29, 16, ...darken(border, 0.7));
  vLine(p, 18, 2, 16, ...darken(border, 0.7));
  vLine(p, 29, 2, 16, ...darken(border, 0.7));

  // Waveform display
  const wave = [10, 8, 6, 9, 12, 7, 5, 8, 11, 9];
  for (let i = 0; i < wave.length; i++) {
    set(p, 19 + i, wave[i], ...accent);
    if (i > 0) {
      const prev = wave[i - 1];
      const step = prev < wave[i] ? 1 : -1;
      for (let y = prev; y !== wave[i]; y += step) {
        set(p, 19 + i, y, ...darken(accent, 0.6));
      }
    }
  }

  // Frequency bars at bottom of display
  for (let x = 19; x <= 28; x++) {
    const h = 1 + ((x * 7 + 3) % 4);
    for (let dy = 0; dy < h; dy++) {
      set(p, x, 15 - dy, ...darken(border, 0.5 + dy * 0.1));
    }
  }

  // Equipment rack (bottom)
  fill(p, 2, 20, 28, 29, ...darken(dark, 0.65));
  hLine(p, 2, 28, 20, ...brighten(dark, 0.1));
  // Rack modules
  for (let x = 4; x <= 26; x += 4) {
    fill(p, x, 22, x + 2, 27, ...darken(bg, 0.5));
    set(p, x + 1, 23, ...accent);
    set(p, x + 1, 25, ...darken(border, 0.5));
  }

  // Cables
  vLine(p, 14, 12, 19, ...darken(accent, 0.4));
  set(p, 13, 15, ...darken(accent, 0.4));
  set(p, 12, 16, ...darken(accent, 0.4));

  return p;
}

function generateComputer(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Server rack 1 (left)
  fill(p, 1, 2, 10, 29, ...darken(dark, 0.65));
  vLine(p, 1, 2, 29, ...brighten(dark, 0.1));
  vLine(p, 10, 2, 29, ...darken(dark, 0.4));
  hLine(p, 1, 10, 2, ...brighten(dark, 0.15));
  // Server modules
  for (let y = 4; y <= 27; y += 4) {
    fill(p, 2, y, 9, y + 2, ...darken(bg, 0.5));
    hLine(p, 2, 9, y, ...darken(border, 0.5));
    // Blinking lights
    set(p, 3, y + 1, ...accent);
    set(p, 5, y + 1, ...border);
    set(p, 7, y + 1, (y % 8 === 0) ? 255 : 30, (y % 8 === 0) ? 50 : 200, 50);
  }

  // Server rack 2 (center)
  fill(p, 12, 2, 20, 29, ...darken(dark, 0.7));
  vLine(p, 12, 2, 29, ...brighten(dark, 0.1));
  vLine(p, 20, 2, 29, ...darken(dark, 0.4));
  hLine(p, 12, 20, 2, ...brighten(dark, 0.15));
  for (let y = 4; y <= 27; y += 4) {
    fill(p, 13, y, 19, y + 2, ...darken(bg, 0.5));
    hLine(p, 13, 19, y, ...darken(border, 0.5));
    set(p, 14, y + 1, ...accent);
    set(p, 16, y + 1, ...border);
    set(p, 18, y + 1, (y % 8 === 4) ? 255 : 30, (y % 8 === 4) ? 50 : 200, 50);
  }

  // Access terminal (right)
  fill(p, 23, 8, 30, 20, ...darken(bg, 0.5));
  hLine(p, 23, 30, 8, ...darken(border, 0.7));
  hLine(p, 23, 30, 20, ...darken(border, 0.7));
  vLine(p, 23, 8, 20, ...darken(border, 0.7));
  vLine(p, 30, 8, 20, ...darken(border, 0.7));
  // Screen text lines
  for (let y = 10; y <= 18; y += 2) {
    const len = 3 + (y % 4);
    hLine(p, 24, 24 + len, y, ...darken(accent, 0.5));
  }
  // Cursor blink
  set(p, 24, 18, ...accent);

  // Cable bundle (floor)
  hLine(p, 10, 12, 28, ...darken(accent, 0.3));
  hLine(p, 10, 12, 29, ...darken(accent, 0.3));

  return p;
}

function generateMining(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Mining drill (center-left, vertical)
  vLine(p, 8, 2, 22, ...darken(border, 0.7));
  vLine(p, 9, 2, 22, ...darken(border, 0.6));
  vLine(p, 10, 2, 22, ...darken(border, 0.7));
  // Drill head (triangular)
  set(p, 9, 23, ...brighten(border, 0.1));
  set(p, 8, 24, ...darken(border, 0.6));
  set(p, 9, 24, ...brighten(border, 0.2));
  set(p, 10, 24, ...darken(border, 0.6));
  set(p, 9, 25, ...accent);
  // Drill mount
  fill(p, 5, 2, 13, 4, ...darken(dark, 0.65));
  hLine(p, 5, 13, 2, ...brighten(dark, 0.1));

  // Ore bins (right side)
  // Bin 1
  fill(p, 18, 16, 25, 24, ...darken(dark, 0.65));
  hLine(p, 18, 25, 16, ...brighten(dark, 0.1));
  vLine(p, 18, 16, 24, ...brighten(dark, 0.05));
  vLine(p, 25, 16, 24, ...darken(dark, 0.4));
  // Ore chunks in bin
  set(p, 20, 22, ...accent);
  set(p, 22, 21, ...brighten(border, 0.15));
  set(p, 21, 23, ...accent);
  set(p, 23, 22, ...brighten(border, 0.15));

  // Bin 2 (smaller)
  fill(p, 18, 6, 25, 13, ...darken(dark, 0.65));
  hLine(p, 18, 25, 6, ...brighten(dark, 0.1));
  // Ore
  set(p, 20, 11, ...accent);
  set(p, 22, 10, ...accent);

  // Conveyor belt (bottom)
  fill(p, 0, 27, TILE - 1, 29, ...darken(dark, 0.5));
  for (let x = 2; x < TILE; x += 4) {
    vLine(p, x, 27, 29, ...darken(dark, 0.3));
  }
  hLine(p, 0, TILE - 1, 27, ...brighten(dark, 0.1));

  // Support struts
  vLine(p, 2, 5, 26, ...darken(dark, 0.55));
  vLine(p, 28, 5, 26, ...darken(dark, 0.55));

  return p;
}

function generateLifeSupport(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  // Dark background
  fillAll(p, ...darken(bg, 0.8));

  // Oxygen tank (left, tall cylinder)
  fill(p, 3, 4, 8, 26, ...darken(border, 0.5));
  vLine(p, 3, 4, 26, ...brighten(border, 0.05));
  vLine(p, 8, 4, 26, ...darken(border, 0.3));
  // Tank top dome
  fill(p, 4, 2, 7, 3, ...darken(border, 0.5));
  hLine(p, 4, 7, 2, ...brighten(border, 0.1));
  // Tank bottom
  fill(p, 4, 27, 7, 28, ...darken(border, 0.4));
  // Pressure gauge
  set(p, 5, 10, ...accent);
  set(p, 6, 10, ...accent);
  // Fill level indicator
  for (let y = 14; y <= 24; y++) {
    const col = y < 20 ? darken(accent, 0.4) : darken(accent, 0.7);
    hLine(p, 4, 7, y, ...col);
  }

  // Second tank (right, shorter)
  fill(p, 22, 10, 27, 26, ...darken(border, 0.5));
  vLine(p, 22, 10, 26, ...brighten(border, 0.05));
  vLine(p, 27, 10, 26, ...darken(border, 0.3));
  fill(p, 23, 8, 26, 9, ...darken(border, 0.5));
  hLine(p, 23, 26, 8, ...brighten(border, 0.1));
  // Fill level
  for (let y = 16; y <= 24; y++) {
    hLine(p, 23, 26, y, ...darken(accent, 0.5));
  }

  // Air filter unit (center)
  fill(p, 11, 8, 19, 22, ...darken(dark, 0.65));
  hLine(p, 11, 19, 8, ...brighten(dark, 0.1));
  // Filter grille
  for (let y = 10; y <= 20; y += 2) {
    hLine(p, 12, 18, y, ...darken(bg, 0.4));
  }
  // Status light
  set(p, 15, 9, 50, 255, 50);

  // Connecting pipes
  hLine(p, 9, 10, 15, ...darken(border, 0.5));
  hLine(p, 20, 21, 18, ...darken(border, 0.5));

  // Ductwork (top)
  fill(p, 0, 0, TILE - 1, 1, ...darken(dark, 0.55));
  for (let x = 3; x < TILE; x += 6) {
    fill(p, x, 0, x + 2, 1, ...darken(dark, 0.45));
  }

  return p;
}

function generateHull(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);

  // Base hull color
  const hullColor = darken(dark, 0.75);
  fillAll(p, ...hullColor);

  // Armor plate pattern — large plates with seams
  // Horizontal seams
  hLine(p, 0, TILE - 1, 7, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 8, ...brighten(hullColor, 0.1));
  hLine(p, 0, TILE - 1, 15, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 16, ...brighten(hullColor, 0.1));
  hLine(p, 0, TILE - 1, 23, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 24, ...brighten(hullColor, 0.1));

  // Vertical seams (offset per row for brick pattern)
  vLine(p, 10, 0, 7, ...darken(hullColor, 0.6));
  vLine(p, 11, 0, 7, ...brighten(hullColor, 0.1));
  vLine(p, 26, 0, 7, ...darken(hullColor, 0.6));
  vLine(p, 27, 0, 7, ...brighten(hullColor, 0.1));

  vLine(p, 5, 8, 15, ...darken(hullColor, 0.6));
  vLine(p, 6, 8, 15, ...brighten(hullColor, 0.1));
  vLine(p, 20, 8, 15, ...darken(hullColor, 0.6));
  vLine(p, 21, 8, 15, ...brighten(hullColor, 0.1));

  vLine(p, 10, 16, 23, ...darken(hullColor, 0.6));
  vLine(p, 11, 16, 23, ...brighten(hullColor, 0.1));
  vLine(p, 26, 16, 23, ...darken(hullColor, 0.6));
  vLine(p, 27, 16, 23, ...brighten(hullColor, 0.1));

  vLine(p, 5, 24, TILE - 1, ...darken(hullColor, 0.6));
  vLine(p, 6, 24, TILE - 1, ...brighten(hullColor, 0.1));
  vLine(p, 20, 24, TILE - 1, ...darken(hullColor, 0.6));
  vLine(p, 21, 24, TILE - 1, ...brighten(hullColor, 0.1));

  // Rivets at plate corners
  const rivetColor = brighten(border, 0.05);
  const rivetPositions = [
    [10, 7], [26, 7], [5, 15], [20, 15],
    [10, 23], [26, 23], [5, 7], [20, 7],
    [10, 15], [26, 15], [5, 23], [20, 23],
  ];
  for (const [rx, ry] of rivetPositions) {
    set(p, rx, ry, ...rivetColor);
    set(p, rx + 1, ry, ...darken(rivetColor, 0.7));
  }

  // Subtle surface scratches
  set(p, 15, 4, ...brighten(hullColor, 0.15));
  set(p, 16, 4, ...brighten(hullColor, 0.15));
  set(p, 17, 5, ...brighten(hullColor, 0.1));
  set(p, 3, 19, ...brighten(hullColor, 0.15));
  set(p, 4, 20, ...brighten(hullColor, 0.1));

  return p;
}

function generateCorridor(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);

  const wallColor = brighten(bg, 0.15);
  const floorColor = brighten(bg, 0.22);

  // Background
  fillAll(p, ...darken(bg, 0.8));

  // Ceiling (top section)
  fill(p, 0, 0, TILE - 1, 5, ...wallColor);
  hLine(p, 0, TILE - 1, 5, ...darken(wallColor, 0.7));
  // Ceiling light
  fill(p, 12, 1, 19, 3, ...darken(accent, 0.5));
  fill(p, 13, 2, 18, 2, ...accent);
  hLine(p, 12, 19, 4, ...darken(dark, 0.6));

  // Floor (bottom section)
  fill(p, 0, 26, TILE - 1, TILE - 1, ...floorColor);
  hLine(p, 0, TILE - 1, 26, ...brighten(floorColor, 0.1));
  // Floor grating
  for (let x = 3; x < TILE; x += 4) {
    vLine(p, x, 27, 30, ...darken(floorColor, 0.7));
  }

  // Wall panels (sides)
  // Left wall panel edge
  fill(p, 0, 6, 2, 25, ...darken(wallColor, 0.8));
  vLine(p, 2, 6, 25, ...darken(wallColor, 0.6));

  // Right wall panel edge
  fill(p, 29, 6, TILE - 1, 25, ...darken(wallColor, 0.8));
  vLine(p, 29, 6, 25, ...darken(wallColor, 0.6));

  // Corridor stripes on walls
  hLine(p, 0, 2, 12, ...darken(border, 0.5));
  hLine(p, 0, 2, 20, ...darken(border, 0.5));
  hLine(p, 29, TILE - 1, 12, ...darken(border, 0.5));
  hLine(p, 29, TILE - 1, 20, ...darken(border, 0.5));

  // Pipe running along top
  hLine(p, 0, TILE - 1, 7, ...darken(dark, 0.6));
  hLine(p, 0, TILE - 1, 8, ...darken(dark, 0.5));
  // Pipe brackets
  for (let x = 6; x < TILE; x += 10) {
    vLine(p, x, 6, 9, ...darken(dark, 0.5));
  }

  // Door frame suggestion (center)
  vLine(p, 10, 6, 25, ...darken(border, 0.5));
  vLine(p, 21, 6, 25, ...darken(border, 0.5));
  hLine(p, 10, 21, 6, ...darken(border, 0.5));

  return p;
}

// ─── Main generation ─────────────────────────────────────

const TILE_GENERATORS = {
  'floor':           generateFloor,
  'wall':            generateWall,
  'bg_bridge':       generateBridge,
  'bg_engine':       generateEngine,
  'bg_weapons':      generateWeapons,
  'bg_shields':      generateShields,
  'bg_cargo':        generateCargo,
  'bg_sensors':      generateSensors,
  'bg_computer':     generateComputer,
  'bg_mining':       generateMining,
  'bg_life_support': generateLifeSupport,
  'bg_hull':         generateHull,
  'corridor':        generateCorridor,
};

let totalFiles = 0;

for (const [themeName, colors] of Object.entries(THEMES)) {
  const themeDir = path.join(OUT_DIR, themeName);
  fs.mkdirSync(themeDir, { recursive: true });

  for (const [tileName, generator] of Object.entries(TILE_GENERATORS)) {
    const pixels = generator(colors);
    const png = createPNG(TILE, TILE, pixels);
    const filePath = path.join(themeDir, `${tileName}.png`);
    fs.writeFileSync(filePath, png);
    totalFiles++;
  }

  console.log(`  ✓ ${themeName}: ${Object.keys(TILE_GENERATORS).length} tiles`);
}

console.log(`\nDone! Generated ${totalFiles} room tiles in ${OUT_DIR}`);
