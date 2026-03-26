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

// ─── Variant tile generators ────────────────────────────
// Each room type gets 3 variants (v1, v2, v3) that look distinct from the base

function generateBridgeV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Navigation display — star chart style
  fill(p, 2, 2, 29, 18, ...darken(bg, 0.5));
  hLine(p, 2, 29, 2, ...darken(border, 0.7));
  hLine(p, 2, 29, 18, ...darken(border, 0.7));
  vLine(p, 2, 2, 18, ...darken(border, 0.7));
  vLine(p, 29, 2, 18, ...darken(border, 0.7));
  // Star dots
  const stars = [[8,6],[14,4],[22,8],[18,12],[6,14],[26,6],[10,10],[20,16]];
  for (const [sx, sy] of stars) {
    set(p, sx, sy, ...accent);
  }
  // Grid lines
  for (let x = 6; x <= 26; x += 5) vLine(p, x, 3, 17, ...darken(accent, 0.8));
  for (let y = 5; y <= 16; y += 4) hLine(p, 3, 28, y, ...darken(accent, 0.8));

  // Status panel below
  fill(p, 4, 20, 27, 26, ...darken(dark, 0.7));
  hLine(p, 4, 27, 20, ...brighten(dark, 0.1));
  for (let x = 6; x <= 24; x += 4) {
    set(p, x, 23, ...border);
    set(p, x + 1, 23, ...darken(border, 0.5));
  }
  // Comm indicator
  set(p, 10, 22, 50, 255, 50);
  set(p, 18, 22, ...accent);

  return p;
}

function generateBridgeV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Captain's chair back view
  fill(p, 10, 14, 21, 28, ...darken(dark, 0.65));
  hLine(p, 10, 21, 14, ...brighten(dark, 0.1));
  // Chair back
  fill(p, 11, 6, 20, 13, ...darken(dark, 0.7));
  hLine(p, 11, 20, 6, ...brighten(dark, 0.1));
  // Headrest
  fill(p, 13, 3, 18, 5, ...darken(dark, 0.6));

  // Side console (left)
  fill(p, 1, 18, 7, 26, ...darken(dark, 0.75));
  hLine(p, 1, 7, 18, ...brighten(dark, 0.1));
  set(p, 3, 20, ...accent);
  set(p, 5, 20, ...border);
  set(p, 3, 22, ...darken(accent, 0.5));

  // Side console (right)
  fill(p, 24, 18, 30, 26, ...darken(dark, 0.75));
  hLine(p, 24, 30, 18, ...brighten(dark, 0.1));
  set(p, 26, 20, ...accent);
  set(p, 28, 20, ...border);

  // Overhead lights
  for (let x = 4; x <= 27; x += 8) {
    fill(p, x, 0, x + 2, 1, ...darken(accent, 0.5));
  }

  return p;
}

function generateBridgeV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Multi-monitor wall — 3 small screens
  for (let i = 0; i < 3; i++) {
    const sx = 2 + i * 10;
    fill(p, sx, 2, sx + 8, 12, ...darken(bg, 0.5));
    hLine(p, sx, sx + 8, 2, ...darken(border, 0.7));
    hLine(p, sx, sx + 8, 12, ...darken(border, 0.7));
    vLine(p, sx, 2, 12, ...darken(border, 0.7));
    vLine(p, sx + 8, 2, 12, ...darken(border, 0.7));
    // Screen content
    for (let y = 4; y <= 10; y += 3) {
      hLine(p, sx + 1, sx + 6, y, ...darken(accent, 0.5 + i * 0.1));
    }
  }

  // Console shelf
  fill(p, 0, 15, TILE - 1, 18, ...darken(dark, 0.7));
  hLine(p, 0, TILE - 1, 15, ...brighten(dark, 0.1));

  // Keyboard/input area
  fill(p, 6, 19, 25, 22, ...darken(dark, 0.8));
  for (let x = 8; x <= 23; x += 2) {
    set(p, x, 20, ...darken(border, 0.5));
    set(p, x, 21, ...darken(border, 0.6));
  }

  // Floor cables
  hLine(p, 0, 8, 28, ...darken(accent, 0.3));
  hLine(p, 22, TILE - 1, 29, ...darken(accent, 0.3));

  return p;
}

function generateEngineV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Large pipe cluster (horizontal)
  for (let i = 0; i < 3; i++) {
    const py = 3 + i * 6;
    fill(p, 0, py, TILE - 1, py + 3, ...darken(border, 0.55 + i * 0.05));
    hLine(p, 0, TILE - 1, py, ...brighten(border, 0.1));
    hLine(p, 0, TILE - 1, py + 3, ...darken(border, 0.3));
    // Rivets along pipe
    for (let x = 4; x < TILE; x += 8) {
      set(p, x, py + 1, ...brighten(border, 0.15));
    }
  }

  // Valve wheel
  fill(p, 12, 22, 19, 29, ...darken(dark, 0.6));
  set(p, 15, 24, ...accent);
  set(p, 16, 24, ...accent);
  set(p, 15, 27, ...accent);
  set(p, 16, 27, ...accent);
  set(p, 13, 25, ...accent);
  set(p, 18, 26, ...accent);

  // Pressure readout
  fill(p, 24, 20, 30, 28, ...darken(bg, 0.5));
  hLine(p, 24, 30, 20, ...darken(border, 0.7));
  // Bar graph
  for (let y = 22; y <= 27; y++) {
    const w = 1 + ((y * 3) % 4);
    hLine(p, 25, 25 + w, y, ...darken(accent, 0.4 + (27 - y) * 0.1));
  }

  return p;
}

function generateEngineV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Turbine cross-section (circular)
  const cx = 16, cy = 14;
  for (let r = 10; r >= 2; r -= 2) {
    const col = darken(dark, 0.6 + (10 - r) * 0.03);
    for (let a = 0; a < 32; a++) {
      const ax = cx + Math.round(r * Math.cos(a * Math.PI / 16));
      const ay = cy + Math.round(r * Math.sin(a * Math.PI / 16));
      set(p, ax, ay, ...col);
    }
  }
  // Center glow
  set(p, cx, cy, ...accent);
  set(p, cx - 1, cy, ...darken(accent, 0.6));
  set(p, cx + 1, cy, ...darken(accent, 0.6));
  set(p, cx, cy - 1, ...darken(accent, 0.6));
  set(p, cx, cy + 1, ...darken(accent, 0.6));

  // Fan blades
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    for (let r = 3; r <= 9; r++) {
      const bx = cx + Math.round(r * Math.cos(angle));
      const by = cy + Math.round(r * Math.sin(angle));
      set(p, bx, by, ...brighten(border, 0.05));
    }
  }

  // Support bracket bottom
  fill(p, 6, 26, 25, 29, ...darken(dark, 0.6));
  hLine(p, 6, 25, 26, ...brighten(dark, 0.1));

  return p;
}

function generateEngineV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Exhaust manifold — vertical pipes with connectors
  for (let i = 0; i < 4; i++) {
    const px = 4 + i * 7;
    fill(p, px, 2, px + 3, 24, ...darken(border, 0.55));
    vLine(p, px, 2, 24, ...brighten(border, 0.08));
    vLine(p, px + 3, 2, 24, ...darken(border, 0.35));
    // Cross-connectors
    if (i < 3) {
      fill(p, px + 4, 10, px + 6, 12, ...darken(dark, 0.5));
      fill(p, px + 4, 18, px + 6, 20, ...darken(dark, 0.5));
    }
  }

  // Steam vents at top
  for (let x = 5; x <= 25; x += 7) {
    set(p, x, 1, ...darken(accent, 0.4));
    set(p, x + 1, 0, ...darken(accent, 0.3));
  }

  // Temperature gauge
  fill(p, 2, 26, 29, 30, ...darken(dark, 0.65));
  hLine(p, 2, 29, 26, ...brighten(dark, 0.1));
  // Temp bar
  hLine(p, 4, 20, 28, ...darken(accent, 0.5));
  hLine(p, 4, 14, 28, ...accent);

  return p;
}

function generateWeaponsV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Missile rack (vertical tubes)
  for (let i = 0; i < 4; i++) {
    const mx = 4 + i * 7;
    fill(p, mx, 2, mx + 4, 20, ...darken(dark, 0.6));
    vLine(p, mx, 2, 20, ...brighten(dark, 0.1));
    vLine(p, mx + 4, 2, 20, ...darken(dark, 0.4));
    // Missile tip
    fill(p, mx + 1, 3, mx + 3, 4, ...darken(border, 0.6));
    set(p, mx + 2, 2, 255, 60, 60);
    // Missile body
    fill(p, mx + 1, 5, mx + 3, 18, ...darken(border, 0.5));
    // Fin
    set(p, mx, 16, ...darken(border, 0.7));
    set(p, mx + 4, 16, ...darken(border, 0.7));
  }

  // Launch control panel
  fill(p, 2, 22, 29, 28, ...darken(dark, 0.7));
  hLine(p, 2, 29, 22, ...brighten(dark, 0.1));
  // Buttons
  for (let x = 5; x <= 26; x += 5) {
    set(p, x, 25, 255, 60, 60);
    set(p, x + 1, 25, ...darken(border, 0.5));
  }

  return p;
}

function generateWeaponsV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Ammo storage locker
  fill(p, 2, 2, 14, 28, ...darken(dark, 0.65));
  hLine(p, 2, 14, 2, ...brighten(dark, 0.1));
  vLine(p, 2, 2, 28, ...brighten(dark, 0.05));
  // Shelves with ammo boxes
  for (let y = 6; y <= 26; y += 5) {
    hLine(p, 3, 13, y, ...darken(dark, 0.5));
    // Ammo boxes
    fill(p, 4, y - 3, 7, y - 1, ...darken(border, 0.5));
    fill(p, 9, y - 4, 12, y - 1, ...darken(border, 0.45));
    set(p, 5, y - 2, 255, 200, 0); // hazard mark
  }

  // Targeting computer (right)
  fill(p, 18, 4, 29, 20, ...darken(bg, 0.5));
  hLine(p, 18, 29, 4, ...darken(border, 0.7));
  hLine(p, 18, 29, 20, ...darken(border, 0.7));
  vLine(p, 18, 4, 20, ...darken(border, 0.7));
  vLine(p, 29, 4, 20, ...darken(border, 0.7));
  // Targeting reticle
  set(p, 23, 12, ...accent);
  hLine(p, 20, 26, 12, ...darken(accent, 0.4));
  vLine(p, 23, 7, 17, ...darken(accent, 0.4));

  return p;
}

function generateWeaponsV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Weapon workbench
  fill(p, 0, 16, TILE - 1, 20, ...darken(dark, 0.65));
  hLine(p, 0, TILE - 1, 16, ...brighten(dark, 0.1));
  // Tools on bench
  hLine(p, 4, 10, 15, ...darken(border, 0.6));
  set(p, 4, 14, ...darken(border, 0.5));
  hLine(p, 14, 22, 15, ...darken(border, 0.55));
  set(p, 22, 14, ...accent);

  // Wall-mounted weapon display
  for (let i = 0; i < 3; i++) {
    const wy = 3 + i * 4;
    fill(p, 3, wy, 28, wy + 1, ...darken(dark, 0.55));
    // Weapon silhouette
    hLine(p, 5 + i * 2, 24 - i, wy, ...darken(border, 0.6));
    set(p, 24 - i, wy, ...accent);
  }

  // Bench legs
  vLine(p, 2, 21, 28, ...darken(dark, 0.5));
  vLine(p, 29, 21, 28, ...darken(dark, 0.5));

  return p;
}

function generateShieldsV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Power conduit array — vertical columns with energy arcs
  for (let i = 0; i < 3; i++) {
    const cx = 5 + i * 10;
    fill(p, cx, 2, cx + 3, 28, ...darken(dark, 0.6));
    vLine(p, cx, 2, 28, ...brighten(dark, 0.1));
    vLine(p, cx + 3, 2, 28, ...darken(dark, 0.4));
    // Energy nodes
    for (let y = 5; y <= 25; y += 5) {
      set(p, cx + 1, y, ...accent);
      set(p, cx + 2, y, ...accent);
    }
  }
  // Arcs between columns
  for (let y = 8; y <= 22; y += 7) {
    hLine(p, 9, 14, y, ...darken(accent, 0.4));
    hLine(p, 19, 24, y, ...darken(accent, 0.4));
  }

  return p;
}

function generateShieldsV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Shield emitter dish (side view)
  fill(p, 4, 6, 27, 24, ...darken(dark, 0.65));
  // Parabolic curve
  for (let y = 6; y <= 24; y++) {
    const dy = y - 15;
    const x = 4 + Math.floor(dy * dy / 12);
    set(p, x, y, ...brighten(border, 0.1));
    set(p, x + 1, y, ...darken(border, 0.5));
  }
  // Emitter focus point
  set(p, 20, 14, ...accent);
  set(p, 20, 15, ...accent);
  set(p, 20, 16, ...accent);
  set(p, 21, 15, ...brighten(accent, 0.3));
  // Energy beam
  for (let x = 22; x <= 28; x++) {
    set(p, x, 15, ...darken(accent, 0.3 + (x - 22) * 0.05));
  }

  // Control panel
  fill(p, 2, 26, 12, 30, ...darken(dark, 0.7));
  set(p, 4, 28, ...border);
  set(p, 6, 28, ...accent);
  set(p, 8, 28, 50, 255, 50);

  return p;
}

function generateShieldsV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Capacitor bank
  for (let i = 0; i < 4; i++) {
    const cx = 3 + i * 7;
    fill(p, cx, 4, cx + 4, 22, ...darken(border, 0.45));
    vLine(p, cx, 4, 22, ...brighten(border, 0.05));
    vLine(p, cx + 4, 4, 22, ...darken(border, 0.25));
    // Top cap
    fill(p, cx, 2, cx + 4, 3, ...darken(dark, 0.5));
    hLine(p, cx, cx + 4, 2, ...brighten(dark, 0.15));
    // Charge level indicator
    const chargeH = 4 + (i * 3) % 8;
    for (let y = 22 - chargeH; y <= 21; y++) {
      hLine(p, cx + 1, cx + 3, y, ...darken(accent, 0.4));
    }
  }

  // Base plate
  fill(p, 0, 24, TILE - 1, 26, ...darken(dark, 0.6));
  hLine(p, 0, TILE - 1, 24, ...brighten(dark, 0.1));

  // Warning label
  set(p, 14, 28, 255, 200, 0);
  set(p, 15, 28, 255, 200, 0);
  set(p, 16, 28, 255, 200, 0);

  return p;
}

function generateCargoV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Stacked barrels
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const bx = 3 + col * 9;
      const by = 4 + row * 14;
      fill(p, bx, by, bx + 6, by + 10, ...darken(dark, 0.6 + col * 0.03));
      vLine(p, bx, by, by + 10, ...brighten(dark, 0.08));
      vLine(p, bx + 6, by, by + 10, ...darken(dark, 0.4));
      // Barrel bands
      hLine(p, bx, bx + 6, by + 2, ...darken(border, 0.5));
      hLine(p, bx + 6, bx + 6, by + 2, ...darken(border, 0.5));
      hLine(p, bx, bx + 6, by + 8, ...darken(border, 0.5));
      // Hazard dot
      if (col === 1) set(p, bx + 3, by + 5, 255, 200, 0);
    }
  }

  return p;
}

function generateCargoV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Cargo net (mesh pattern)
  for (let x = 0; x < TILE; x += 4) {
    vLine(p, x, 0, TILE - 1, ...darken(dark, 0.5));
  }
  for (let y = 0; y < TILE; y += 4) {
    hLine(p, 0, TILE - 1, y, ...darken(dark, 0.5));
  }

  // Large container behind net
  fill(p, 4, 4, 27, 26, ...darken(dark, 0.7));
  hLine(p, 4, 27, 4, ...brighten(dark, 0.1));
  vLine(p, 4, 4, 26, ...brighten(dark, 0.05));
  // Label strip
  fill(p, 8, 12, 23, 16, ...darken(border, 0.45));
  hLine(p, 9, 22, 14, ...darken(accent, 0.5));
  // Lock mechanism
  fill(p, 14, 20, 17, 23, ...darken(border, 0.6));
  set(p, 15, 21, ...accent);

  return p;
}

function generateCargoV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Pallet with stacked boxes
  fill(p, 2, 26, 29, 29, ...darken(dark, 0.55)); // pallet
  // Bottom row — 3 crates
  for (let i = 0; i < 3; i++) {
    const bx = 3 + i * 9;
    fill(p, bx, 16, bx + 7, 25, ...darken(dark, 0.65 + i * 0.03));
    hLine(p, bx, bx + 7, 16, ...brighten(dark, 0.1));
    vLine(p, bx, 16, 25, ...brighten(dark, 0.05));
    set(p, bx + 3, 20, ...border);
  }
  // Top row — 2 crates
  for (let i = 0; i < 2; i++) {
    const bx = 7 + i * 10;
    fill(p, bx, 8, bx + 6, 15, ...darken(border, 0.45 + i * 0.05));
    hLine(p, bx, bx + 6, 8, ...brighten(border, 0.05));
    set(p, bx + 3, 11, 255, 200, 0);
  }
  // Strap across
  for (let y = 5; y <= 28; y += 2) {
    set(p, 15, y, ...darken(border, 0.6));
  }

  return p;
}

function generateSensorsV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Antenna array — multiple vertical antennas
  for (let i = 0; i < 5; i++) {
    const ax = 4 + i * 6;
    const ah = 16 + (i % 3) * 3;
    vLine(p, ax, 28 - ah, 28, ...darken(border, 0.6));
    // Tip
    set(p, ax, 28 - ah, ...accent);
    // Cross elements
    hLine(p, ax - 1, ax + 1, 28 - ah + 3, ...darken(border, 0.5));
  }

  // Base unit
  fill(p, 2, 24, 29, 29, ...darken(dark, 0.65));
  hLine(p, 2, 29, 24, ...brighten(dark, 0.1));
  // Status LEDs
  for (let x = 5; x <= 26; x += 3) {
    set(p, x, 26, ...(x % 6 === 5 ? accent : border));
  }

  return p;
}

function generateSensorsV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Oscilloscope display
  fill(p, 3, 2, 28, 20, ...darken(bg, 0.5));
  hLine(p, 3, 28, 2, ...darken(border, 0.7));
  hLine(p, 3, 28, 20, ...darken(border, 0.7));
  vLine(p, 3, 2, 20, ...darken(border, 0.7));
  vLine(p, 28, 2, 20, ...darken(border, 0.7));
  // Sine wave
  const wave = [11, 8, 6, 5, 6, 8, 11, 14, 16, 17, 16, 14, 11, 8, 6, 5, 6, 8, 11, 14, 16, 17, 16, 14];
  for (let i = 0; i < wave.length && i + 4 <= 27; i++) {
    set(p, 4 + i, wave[i], ...accent);
  }
  // Grid
  for (let x = 8; x <= 24; x += 5) vLine(p, x, 3, 19, ...darken(accent, 0.85));
  hLine(p, 4, 27, 11, ...darken(accent, 0.85));

  // Knobs below display
  for (let x = 6; x <= 25; x += 6) {
    fill(p, x, 23, x + 2, 25, ...darken(dark, 0.55));
    set(p, x + 1, 24, ...border);
  }

  return p;
}

function generateSensorsV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Radar sweep display (circular)
  const cx = 15, cy = 14;
  // Outer ring
  for (let a = 0; a < 32; a++) {
    const ax = cx + Math.round(10 * Math.cos(a * Math.PI / 16));
    const ay = cy + Math.round(10 * Math.sin(a * Math.PI / 16));
    set(p, ax, ay, ...darken(border, 0.6));
  }
  // Inner ring
  for (let a = 0; a < 24; a++) {
    const ax = cx + Math.round(5 * Math.cos(a * Math.PI / 12));
    const ay = cy + Math.round(5 * Math.sin(a * Math.PI / 12));
    set(p, ax, ay, ...darken(border, 0.7));
  }
  // Crosshairs
  hLine(p, cx - 11, cx + 11, cy, ...darken(accent, 0.8));
  vLine(p, cx, cy - 11, cy + 11, ...darken(accent, 0.8));
  // Sweep line
  for (let r = 1; r <= 10; r++) {
    const sx = cx + Math.round(r * Math.cos(0.7));
    const sy = cy - Math.round(r * Math.sin(0.7));
    set(p, sx, sy, ...accent);
  }
  // Blips
  set(p, cx + 3, cy - 6, ...accent);
  set(p, cx - 5, cy + 2, ...accent);

  // Equipment below
  fill(p, 4, 26, 27, 30, ...darken(dark, 0.65));
  hLine(p, 4, 27, 26, ...brighten(dark, 0.1));

  return p;
}

function generateComputerV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Data tape reels (retro mainframe look)
  for (let i = 0; i < 2; i++) {
    const cx = 8 + i * 16;
    const cy = 10;
    // Reel circle
    for (let a = 0; a < 24; a++) {
      const ax = cx + Math.round(6 * Math.cos(a * Math.PI / 12));
      const ay = cy + Math.round(6 * Math.sin(a * Math.PI / 12));
      set(p, ax, ay, ...darken(border, 0.6));
    }
    // Hub
    set(p, cx, cy, ...darken(dark, 0.5));
    set(p, cx - 1, cy, ...darken(dark, 0.5));
    set(p, cx + 1, cy, ...darken(dark, 0.5));
    set(p, cx, cy - 1, ...darken(dark, 0.5));
    set(p, cx, cy + 1, ...darken(dark, 0.5));
    // Spokes
    for (let r = 2; r <= 5; r++) {
      set(p, cx + r, cy, ...darken(dark, 0.55));
      set(p, cx - r, cy, ...darken(dark, 0.55));
    }
  }

  // Tape between reels
  hLine(p, 14, 18, 10, ...darken(border, 0.5));
  hLine(p, 14, 18, 11, ...darken(border, 0.5));

  // Front panel with blinkenlights
  fill(p, 2, 20, 29, 28, ...darken(dark, 0.65));
  hLine(p, 2, 29, 20, ...brighten(dark, 0.1));
  for (let x = 4; x <= 27; x += 2) {
    const col = (x % 4 === 0) ? accent : ((x % 6 === 2) ? [255, 50, 50] : border);
    set(p, x, 23, ...col);
    set(p, x, 25, ...darken(col, 0.5));
  }

  return p;
}

function generateComputerV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Terminal with text output
  fill(p, 2, 2, 29, 22, ...darken(bg, 0.5));
  hLine(p, 2, 29, 2, ...darken(border, 0.7));
  hLine(p, 2, 29, 22, ...darken(border, 0.7));
  vLine(p, 2, 2, 22, ...darken(border, 0.7));
  vLine(p, 29, 2, 22, ...darken(border, 0.7));
  // Text lines
  const lineLens = [20, 15, 22, 8, 18, 12, 24, 10, 16];
  for (let i = 0; i < lineLens.length; i++) {
    const y = 4 + i * 2;
    if (y > 20) break;
    hLine(p, 4, 4 + Math.min(lineLens[i], 24), y, ...darken(accent, 0.5));
  }
  // Cursor
  fill(p, 4, 20, 6, 20, ...accent);

  // Keyboard
  fill(p, 4, 24, 27, 28, ...darken(dark, 0.7));
  for (let y = 25; y <= 27; y++) {
    for (let x = 5; x <= 26; x += 2) {
      set(p, x, y, ...darken(border, 0.45));
    }
  }

  return p;
}

function generateComputerV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Cable management panel — dense wiring
  fill(p, 0, 0, TILE - 1, 3, ...darken(dark, 0.6));
  fill(p, 0, 28, TILE - 1, TILE - 1, ...darken(dark, 0.6));

  // Vertical cable runs
  const cableColors = [accent, border, darken(accent, 0.5), darken(border, 0.6)];
  for (let i = 0; i < 8; i++) {
    const cx = 3 + i * 4;
    const col = cableColors[i % cableColors.length];
    vLine(p, cx, 4, 27, ...col);
  }
  // Cable ties
  for (let y = 8; y <= 24; y += 8) {
    hLine(p, 2, 29, y, ...darken(dark, 0.5));
  }

  // Junction box
  fill(p, 12, 12, 19, 20, ...darken(dark, 0.65));
  hLine(p, 12, 19, 12, ...brighten(dark, 0.1));
  set(p, 15, 15, ...accent);
  set(p, 16, 17, ...border);

  return p;
}

function generateMiningV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Ore crusher machine
  fill(p, 4, 4, 27, 18, ...darken(dark, 0.65));
  hLine(p, 4, 27, 4, ...brighten(dark, 0.1));
  vLine(p, 4, 4, 18, ...brighten(dark, 0.05));
  // Crusher teeth
  for (let x = 8; x <= 23; x += 3) {
    fill(p, x, 10, x + 1, 13, ...darken(border, 0.6));
    set(p, x, 13, ...brighten(border, 0.1));
  }
  // Hopper opening
  fill(p, 10, 5, 21, 9, ...darken(bg, 0.4));

  // Ore chunks below
  set(p, 12, 20, ...accent);
  set(p, 15, 21, ...brighten(border, 0.15));
  set(p, 18, 20, ...accent);
  set(p, 10, 22, ...brighten(border, 0.1));
  set(p, 20, 22, ...accent);

  // Collection bin
  fill(p, 8, 24, 23, 29, ...darken(dark, 0.6));
  hLine(p, 8, 23, 24, ...brighten(dark, 0.1));

  return p;
}

function generateMiningV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Mining laser assembly
  fill(p, 12, 2, 19, 6, ...darken(dark, 0.6));
  hLine(p, 12, 19, 2, ...brighten(dark, 0.1));
  // Laser barrel
  fill(p, 14, 7, 17, 20, ...darken(border, 0.55));
  vLine(p, 14, 7, 20, ...brighten(border, 0.08));
  vLine(p, 17, 7, 20, ...darken(border, 0.35));
  // Laser tip glow
  set(p, 15, 21, ...accent);
  set(p, 16, 21, ...accent);
  set(p, 15, 22, ...brighten(accent, 0.3));

  // Power coupling (left)
  fill(p, 2, 8, 10, 14, ...darken(dark, 0.65));
  hLine(p, 2, 10, 8, ...brighten(dark, 0.1));
  set(p, 5, 11, ...accent);
  hLine(p, 11, 13, 11, ...darken(accent, 0.4));

  // Coolant tank (right)
  fill(p, 22, 6, 28, 20, ...darken(border, 0.45));
  vLine(p, 22, 6, 20, ...brighten(border, 0.05));
  vLine(p, 28, 6, 20, ...darken(border, 0.3));
  // Coolant level
  for (let y = 12; y <= 19; y++) {
    hLine(p, 23, 27, y, ...darken(accent, 0.5));
  }

  // Base
  fill(p, 0, 26, TILE - 1, 29, ...darken(dark, 0.6));

  return p;
}

function generateMiningV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Smelter furnace
  fill(p, 6, 4, 25, 22, ...darken(dark, 0.65));
  hLine(p, 6, 25, 4, ...brighten(dark, 0.1));
  vLine(p, 6, 4, 22, ...brighten(dark, 0.05));
  // Furnace opening
  fill(p, 10, 8, 21, 16, ...darken(bg, 0.4));
  // Fire glow
  for (let y = 12; y <= 15; y++) {
    hLine(p, 12, 19, y, 255, Math.floor(100 + (15 - y) * 30), 0, 120);
  }
  set(p, 15, 13, 255, 200, 50, 200);

  // Chimney/exhaust
  fill(p, 14, 0, 17, 3, ...darken(dark, 0.55));

  // Ingot molds (below)
  for (let i = 0; i < 3; i++) {
    const ix = 8 + i * 7;
    fill(p, ix, 24, ix + 4, 28, ...darken(border, 0.5));
    hLine(p, ix, ix + 4, 24, ...brighten(border, 0.1));
    set(p, ix + 2, 26, ...accent);
  }

  return p;
}

function generateLifeSupportV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Air recycler unit — large box with fan
  fill(p, 4, 4, 27, 24, ...darken(dark, 0.65));
  hLine(p, 4, 27, 4, ...brighten(dark, 0.1));
  // Fan grille
  fill(p, 8, 8, 23, 20, ...darken(bg, 0.45));
  // Fan blades
  const fcx = 15, fcy = 14;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + 0.3;
    for (let r = 2; r <= 5; r++) {
      const fx = fcx + Math.round(r * Math.cos(angle));
      const fy = fcy + Math.round(r * Math.sin(angle));
      set(p, fx, fy, ...darken(border, 0.6));
    }
  }
  set(p, fcx, fcy, ...darken(dark, 0.5));

  // Duct connections
  fill(p, 0, 10, 3, 14, ...darken(dark, 0.55));
  fill(p, 28, 10, TILE - 1, 14, ...darken(dark, 0.55));

  // Status
  set(p, 6, 22, 50, 255, 50);
  set(p, 8, 22, ...accent);

  return p;
}

function generateLifeSupportV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Water purifier — pipes and tanks
  // Main tank
  fill(p, 10, 4, 21, 22, ...darken(border, 0.45));
  vLine(p, 10, 4, 22, ...brighten(border, 0.05));
  vLine(p, 21, 4, 22, ...darken(border, 0.3));
  fill(p, 11, 2, 20, 3, ...darken(border, 0.45));
  // Water level
  for (let y = 10; y <= 21; y++) {
    hLine(p, 11, 20, y, 20, 60, 180, 80);
  }
  // Input pipe
  fill(p, 0, 8, 9, 10, ...darken(dark, 0.55));
  hLine(p, 0, 9, 8, ...brighten(dark, 0.1));
  // Output pipe
  fill(p, 22, 14, TILE - 1, 16, ...darken(dark, 0.55));
  hLine(p, 22, TILE - 1, 14, ...brighten(dark, 0.1));

  // Pump motor
  fill(p, 3, 20, 8, 28, ...darken(dark, 0.65));
  hLine(p, 3, 8, 20, ...brighten(dark, 0.1));
  set(p, 5, 24, ...accent);

  return p;
}

function generateLifeSupportV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // CO2 scrubber array
  for (let i = 0; i < 3; i++) {
    const sx = 2 + i * 10;
    fill(p, sx, 4, sx + 7, 20, ...darken(dark, 0.65));
    hLine(p, sx, sx + 7, 4, ...brighten(dark, 0.1));
    // Filter elements
    for (let y = 6; y <= 18; y += 3) {
      fill(p, sx + 1, y, sx + 6, y + 1, ...darken(border, 0.45));
    }
    // Status LED
    set(p, sx + 3, 5, ...(i === 1 ? [255, 200, 0] : [50, 255, 50]));
  }

  // Monitoring panel
  fill(p, 4, 22, 27, 28, ...darken(dark, 0.7));
  hLine(p, 4, 27, 22, ...brighten(dark, 0.1));
  // O2/CO2 readout bars
  hLine(p, 6, 18, 24, ...darken(accent, 0.4));
  hLine(p, 6, 12, 24, ...accent); // O2 level
  hLine(p, 6, 8, 26, 255, 60, 60, 180); // CO2 level

  // Ductwork
  fill(p, 0, 0, TILE - 1, 2, ...darken(dark, 0.55));

  return p;
}

function generateHullV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  const hullColor = darken(dark, 0.75);
  fillAll(p, ...hullColor);

  // Heavy reinforcement plates — X-brace pattern
  // Main plate
  hLine(p, 0, TILE - 1, 15, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 16, ...brighten(hullColor, 0.1));
  // X-brace
  for (let i = 0; i < TILE; i++) {
    set(p, i, i, ...brighten(hullColor, 0.12));
    set(p, i, TILE - 1 - i, ...brighten(hullColor, 0.12));
  }
  // Corner bolts
  const boltColor = brighten(border, 0.05);
  for (const [bx, by] of [[3, 3], [28, 3], [3, 28], [28, 28]]) {
    set(p, bx, by, ...boltColor);
    set(p, bx + 1, by, ...darken(boltColor, 0.7));
    set(p, bx, by + 1, ...darken(boltColor, 0.7));
  }

  return p;
}

function generateHullV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  const hullColor = darken(dark, 0.75);
  fillAll(p, ...hullColor);

  // Porthole in hull plate
  // Plate seams
  hLine(p, 0, TILE - 1, 0, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, TILE - 1, ...brighten(hullColor, 0.08));
  vLine(p, 0, 0, TILE - 1, ...darken(hullColor, 0.6));
  vLine(p, TILE - 1, 0, TILE - 1, ...brighten(hullColor, 0.08));

  // Porthole — circular window
  const cx = 16, cy = 16;
  for (let a = 0; a < 32; a++) {
    const ax = cx + Math.round(8 * Math.cos(a * Math.PI / 16));
    const ay = cy + Math.round(8 * Math.sin(a * Math.PI / 16));
    set(p, ax, ay, ...brighten(hullColor, 0.15));
  }
  // Inner ring
  for (let a = 0; a < 24; a++) {
    const ax = cx + Math.round(6 * Math.cos(a * Math.PI / 12));
    const ay = cy + Math.round(6 * Math.sin(a * Math.PI / 12));
    set(p, ax, ay, ...darken(hullColor, 0.5));
  }
  // Window (dark space)
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy <= 20) {
        set(p, cx + dx, cy + dy, 5, 5, 20, 200);
      }
    }
  }
  // Star through window
  set(p, cx - 2, cy - 1, 200, 200, 255, 180);
  set(p, cx + 3, cy + 2, 180, 180, 240, 150);

  return p;
}

function generateHullV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  const accent = hex(colors.accent);
  const hullColor = darken(dark, 0.75);
  fillAll(p, ...hullColor);

  // Damaged/patched hull section
  // Base seams (standard hull pattern)
  hLine(p, 0, TILE - 1, 10, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 11, ...brighten(hullColor, 0.1));
  hLine(p, 0, TILE - 1, 22, ...darken(hullColor, 0.6));
  hLine(p, 0, TILE - 1, 23, ...brighten(hullColor, 0.1));

  // Weld patch
  fill(p, 8, 4, 24, 18, ...brighten(hullColor, 0.06));
  // Weld seam (bright line around patch)
  hLine(p, 8, 24, 4, ...brighten(border, 0.08));
  hLine(p, 8, 24, 18, ...brighten(border, 0.08));
  vLine(p, 8, 4, 18, ...brighten(border, 0.08));
  vLine(p, 24, 4, 18, ...brighten(border, 0.08));
  // Weld spots
  set(p, 10, 4, ...brighten(border, 0.15));
  set(p, 16, 4, ...brighten(border, 0.15));
  set(p, 22, 4, ...brighten(border, 0.15));

  // Dent marks
  set(p, 14, 10, ...brighten(hullColor, 0.18));
  set(p, 15, 11, ...brighten(hullColor, 0.15));
  set(p, 18, 14, ...brighten(hullColor, 0.12));

  return p;
}

function generateCorridorV1(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  const wallColor = brighten(bg, 0.15);
  const floorColor = brighten(bg, 0.22);
  fillAll(p, ...darken(bg, 0.8));

  // Emergency light corridor
  fill(p, 0, 0, TILE - 1, 5, ...wallColor);
  hLine(p, 0, TILE - 1, 5, ...darken(wallColor, 0.7));

  // Red emergency strip (wall-mounted)
  hLine(p, 0, TILE - 1, 12, 255, 40, 40, 100);
  hLine(p, 0, TILE - 1, 13, 255, 40, 40, 60);

  // Floor
  fill(p, 0, 26, TILE - 1, TILE - 1, ...floorColor);
  hLine(p, 0, TILE - 1, 26, ...brighten(floorColor, 0.1));

  // Wall panels
  fill(p, 0, 6, 2, 25, ...darken(wallColor, 0.8));
  fill(p, 29, 6, TILE - 1, 25, ...darken(wallColor, 0.8));

  // Fire extinguisher on wall
  fill(p, 0, 16, 2, 22, 200, 40, 40, 120);
  set(p, 1, 15, ...darken(dark, 0.5));

  // Overhead pipe
  hLine(p, 0, TILE - 1, 7, ...darken(dark, 0.6));
  hLine(p, 0, TILE - 1, 8, ...darken(dark, 0.5));

  return p;
}

function generateCorridorV2(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  const wallColor = brighten(bg, 0.15);
  const floorColor = brighten(bg, 0.22);
  fillAll(p, ...darken(bg, 0.8));

  // Ceiling
  fill(p, 0, 0, TILE - 1, 5, ...wallColor);
  hLine(p, 0, TILE - 1, 5, ...darken(wallColor, 0.7));
  // Ventilation grate in ceiling
  fill(p, 8, 1, 23, 4, ...darken(bg, 0.4));
  for (let x = 9; x <= 22; x += 2) {
    vLine(p, x, 1, 4, ...darken(wallColor, 0.6));
  }

  // Floor
  fill(p, 0, 26, TILE - 1, TILE - 1, ...floorColor);
  hLine(p, 0, TILE - 1, 26, ...brighten(floorColor, 0.1));

  // Walls
  fill(p, 0, 6, 2, 25, ...darken(wallColor, 0.8));
  fill(p, 29, 6, TILE - 1, 25, ...darken(wallColor, 0.8));

  // Wall panel with sign
  fill(p, 29, 10, TILE - 1, 18, ...darken(dark, 0.6));
  set(p, 30, 13, ...accent);
  set(p, 30, 15, ...accent);

  // Cable tray along wall
  for (let y = 8; y <= 24; y += 4) {
    hLine(p, 0, 2, y, ...darken(accent, 0.3));
  }

  // Overhead pipes (double)
  hLine(p, 0, TILE - 1, 7, ...darken(dark, 0.6));
  hLine(p, 0, TILE - 1, 9, ...darken(dark, 0.55));

  return p;
}

function generateCorridorV3(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  const wallColor = brighten(bg, 0.15);
  const floorColor = brighten(bg, 0.22);
  fillAll(p, ...darken(bg, 0.8));

  // Ceiling
  fill(p, 0, 0, TILE - 1, 5, ...wallColor);
  hLine(p, 0, TILE - 1, 5, ...darken(wallColor, 0.7));
  // Ceiling light (different position)
  fill(p, 4, 1, 11, 3, ...darken(accent, 0.5));
  fill(p, 5, 2, 10, 2, ...accent);

  // Floor
  fill(p, 0, 26, TILE - 1, TILE - 1, ...floorColor);
  hLine(p, 0, TILE - 1, 26, ...brighten(floorColor, 0.1));
  // Floor marking stripe
  hLine(p, 6, 25, 27, ...darken(border, 0.4));

  // Walls
  fill(p, 0, 6, 2, 25, ...darken(wallColor, 0.8));
  fill(p, 29, 6, TILE - 1, 25, ...darken(wallColor, 0.8));

  // Access panel on left wall (openable)
  fill(p, 0, 14, 2, 22, ...darken(dark, 0.55));
  hLine(p, 0, 2, 14, ...brighten(dark, 0.1));
  set(p, 1, 18, ...border);

  // Pipe junction
  hLine(p, 0, TILE - 1, 7, ...darken(dark, 0.6));
  vLine(p, 20, 7, 12, ...darken(dark, 0.6));
  hLine(p, 20, TILE - 1, 12, ...darken(dark, 0.55));

  return p;
}

// ─── Decoration tile generators (generic, any room) ─────

function generateDecoPorthole(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Wall panel base
  const panelColor = brighten(bg, 0.18);
  fill(p, 0, 0, TILE - 1, TILE - 1, ...panelColor);

  // Porthole — circular window
  const cx = 16, cy = 15;
  // Outer frame
  for (let a = 0; a < 32; a++) {
    const ax = cx + Math.round(10 * Math.cos(a * Math.PI / 16));
    const ay = cy + Math.round(10 * Math.sin(a * Math.PI / 16));
    set(p, ax, ay, ...brighten(border, 0.05));
  }
  for (let a = 0; a < 32; a++) {
    const ax = cx + Math.round(9 * Math.cos(a * Math.PI / 16));
    const ay = cy + Math.round(9 * Math.sin(a * Math.PI / 16));
    set(p, ax, ay, ...darken(dark, 0.5));
  }
  // Window (space view)
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      if (dx * dx + dy * dy <= 56) {
        set(p, cx + dx, cy + dy, 3, 3, 15, 220);
      }
    }
  }
  // Stars visible through window
  set(p, cx - 3, cy - 2, 220, 220, 255, 200);
  set(p, cx + 2, cy + 3, 200, 200, 240, 180);
  set(p, cx - 1, cy + 4, 180, 200, 255, 160);
  set(p, cx + 4, cy - 3, 240, 240, 255, 190);

  // Bolts around frame
  for (let a = 0; a < 8; a++) {
    const bx = cx + Math.round(11 * Math.cos(a * Math.PI / 4));
    const by = cy + Math.round(11 * Math.sin(a * Math.PI / 4));
    set(p, bx, by, ...brighten(border, 0.1));
  }

  // Wall panel seams
  hLine(p, 0, TILE - 1, 0, ...brighten(panelColor, 0.1));
  hLine(p, 0, TILE - 1, TILE - 1, ...darken(panelColor, 0.7));

  return p;
}

function generateDecoPipes(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Dense pipe cluster (horizontal + vertical)
  // Horizontal pipes
  for (let i = 0; i < 4; i++) {
    const py = 3 + i * 8;
    fill(p, 0, py, TILE - 1, py + 2, ...darken(border, 0.5 + i * 0.03));
    hLine(p, 0, TILE - 1, py, ...brighten(border, 0.08));
    hLine(p, 0, TILE - 1, py + 2, ...darken(border, 0.3));
    // Rivets
    for (let x = 5; x < TILE; x += 10) {
      set(p, x, py + 1, ...brighten(border, 0.12));
    }
  }

  // Vertical pipe crossing over
  fill(p, 14, 0, 17, TILE - 1, ...darken(dark, 0.55));
  vLine(p, 14, 0, TILE - 1, ...brighten(dark, 0.1));
  vLine(p, 17, 0, TILE - 1, ...darken(dark, 0.35));
  // Clamps
  for (let y = 6; y < TILE; y += 8) {
    hLine(p, 13, 18, y, ...darken(dark, 0.4));
  }

  // Valve
  fill(p, 20, 14, 24, 18, ...darken(dark, 0.6));
  set(p, 22, 16, ...accent);

  // Drip stain
  set(p, 16, 26, ...darken(accent, 0.7));
  set(p, 16, 28, ...darken(accent, 0.8));

  return p;
}

function generateDecoPanel(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Wall-mounted control panel
  const panelColor = brighten(bg, 0.18);
  fill(p, 0, 0, TILE - 1, TILE - 1, ...panelColor);

  // Main panel inset
  fill(p, 3, 3, 28, 28, ...darken(dark, 0.65));
  hLine(p, 3, 28, 3, ...brighten(dark, 0.1));
  vLine(p, 3, 3, 28, ...brighten(dark, 0.05));

  // Small display
  fill(p, 5, 5, 18, 12, ...darken(bg, 0.5));
  hLine(p, 5, 18, 5, ...darken(border, 0.7));
  hLine(p, 5, 18, 12, ...darken(border, 0.7));
  vLine(p, 5, 5, 12, ...darken(border, 0.7));
  vLine(p, 18, 5, 12, ...darken(border, 0.7));
  // Readout text
  hLine(p, 7, 14, 7, ...darken(accent, 0.5));
  hLine(p, 7, 12, 9, ...darken(accent, 0.5));
  hLine(p, 7, 16, 11, ...accent);

  // Button cluster (right side)
  for (let y = 6; y <= 11; y += 2) {
    for (let x = 21; x <= 26; x += 3) {
      const col = (y + x) % 4 === 0 ? accent : border;
      set(p, x, y, ...col);
      set(p, x + 1, y, ...darken(col, 0.6));
    }
  }

  // Toggle switches (bottom)
  for (let x = 6; x <= 24; x += 4) {
    vLine(p, x, 16, 20, ...darken(dark, 0.5));
    set(p, x, 16, ...brighten(border, 0.1));
  }

  // Warning label
  fill(p, 6, 23, 16, 26, ...darken(dark, 0.7));
  hLine(p, 7, 15, 24, 255, 200, 0, 120);

  // Seams
  hLine(p, 0, TILE - 1, 0, ...brighten(panelColor, 0.1));
  hLine(p, 0, TILE - 1, TILE - 1, ...darken(panelColor, 0.7));

  return p;
}

function generateDecoVent(colors) {
  const p = createCanvas();
  const bg = hex(colors.bg);
  const border = hex(colors.border);
  const accent = hex(colors.accent);
  const dark = hex(colors.dark);
  fillAll(p, ...darken(bg, 0.8));

  // Wall base
  const panelColor = brighten(bg, 0.18);
  fill(p, 0, 0, TILE - 1, TILE - 1, ...panelColor);

  // Large vent grille
  fill(p, 4, 4, 27, 27, ...darken(bg, 0.4));
  // Frame
  hLine(p, 3, 28, 3, ...brighten(border, 0.05));
  hLine(p, 3, 28, 28, ...darken(border, 0.3));
  vLine(p, 3, 3, 28, ...brighten(border, 0.05));
  vLine(p, 28, 3, 28, ...darken(border, 0.3));

  // Horizontal slats
  for (let y = 6; y <= 25; y += 3) {
    fill(p, 5, y, 26, y + 1, ...darken(dark, 0.5));
    hLine(p, 5, 26, y, ...brighten(dark, 0.1));
  }

  // Dust/grime at bottom
  for (let x = 6; x <= 25; x += 2) {
    set(p, x, 26, ...darken(dark, 0.6));
  }

  // Corner screws
  for (const [sx, sy] of [[5, 5], [26, 5], [5, 26], [26, 26]]) {
    set(p, sx, sy, ...brighten(border, 0.1));
  }

  // Seams
  hLine(p, 0, TILE - 1, 0, ...brighten(panelColor, 0.1));
  hLine(p, 0, TILE - 1, TILE - 1, ...darken(panelColor, 0.7));

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

// Variant tiles (3 per room type + corridor)
const VARIANT_GENERATORS = {
  'bg_bridge_v1': generateBridgeV1,
  'bg_bridge_v2': generateBridgeV2,
  'bg_bridge_v3': generateBridgeV3,
  'bg_engine_v1': generateEngineV1,
  'bg_engine_v2': generateEngineV2,
  'bg_engine_v3': generateEngineV3,
  'bg_weapons_v1': generateWeaponsV1,
  'bg_weapons_v2': generateWeaponsV2,
  'bg_weapons_v3': generateWeaponsV3,
  'bg_shields_v1': generateShieldsV1,
  'bg_shields_v2': generateShieldsV2,
  'bg_shields_v3': generateShieldsV3,
  'bg_cargo_v1': generateCargoV1,
  'bg_cargo_v2': generateCargoV2,
  'bg_cargo_v3': generateCargoV3,
  'bg_sensors_v1': generateSensorsV1,
  'bg_sensors_v2': generateSensorsV2,
  'bg_sensors_v3': generateSensorsV3,
  'bg_computer_v1': generateComputerV1,
  'bg_computer_v2': generateComputerV2,
  'bg_computer_v3': generateComputerV3,
  'bg_mining_v1': generateMiningV1,
  'bg_mining_v2': generateMiningV2,
  'bg_mining_v3': generateMiningV3,
  'bg_life_support_v1': generateLifeSupportV1,
  'bg_life_support_v2': generateLifeSupportV2,
  'bg_life_support_v3': generateLifeSupportV3,
  'bg_hull_v1': generateHullV1,
  'bg_hull_v2': generateHullV2,
  'bg_hull_v3': generateHullV3,
  'corridor_v1': generateCorridorV1,
  'corridor_v2': generateCorridorV2,
  'corridor_v3': generateCorridorV3,
};

// Generic decoration tiles
const DECO_GENERATORS = {
  'deco_porthole': generateDecoPorthole,
  'deco_pipes': generateDecoPipes,
  'deco_panel': generateDecoPanel,
  'deco_vent': generateDecoVent,
};

let totalFiles = 0;

for (const [themeName, colors] of Object.entries(THEMES)) {
  const themeDir = path.join(OUT_DIR, themeName);
  fs.mkdirSync(themeDir, { recursive: true });

  const allGenerators = { ...TILE_GENERATORS, ...VARIANT_GENERATORS, ...DECO_GENERATORS };

  for (const [tileName, generator] of Object.entries(allGenerators)) {
    const pixels = generator(colors);
    const png = createPNG(TILE, TILE, pixels);
    const filePath = path.join(themeDir, `${tileName}.png`);
    fs.writeFileSync(filePath, png);
    totalFiles++;
  }

  const count = Object.keys(allGenerators).length;
  console.log(`  ✓ ${themeName}: ${count} tiles (${Object.keys(TILE_GENERATORS).length} base + ${Object.keys(VARIANT_GENERATORS).length} variants + ${Object.keys(DECO_GENERATORS).length} deco)`);
}

console.log(`\nDone! Generated ${totalFiles} room tiles in ${OUT_DIR}`);
