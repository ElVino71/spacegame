/**
 * Generate 32×32 frame border tile PNGs for each theme.
 *
 * Run:  node scripts/generate-frame-tiles.js
 *
 * Outputs to assets/tiles/frame/{theme}/ — 3 files per theme:
 *   corner_tl.png  — 32×32 top-left corner (other corners via CSS flip)
 *   edge_h.png     — 256×32 horizontal strip (8 varied tiles composited)
 *   edge_v.png     — 32×256 vertical strip (8 varied tiles composited)
 *
 * Each edge strip contains a mix of 3-4 tile variants for visual variety.
 * Tiles are 32×32 actual size, displayed with image-rendering: pixelated.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 32;
const STRIP_TILES = 8; // tiles per strip
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tiles', 'frame');

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

// ─── Pixel helpers ──────────────────────────────────────

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

/** Parse hex color string to [r, g, b] */
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

function mix([r1, g1, b1], [r2, g2, b2], t) {
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

/** Composite a single 32×32 tile onto a strip at tile index position */
function blitToStrip(strip, stripW, tile, tileIdx, horizontal) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const srcI = (y * TILE + x) * 4;
      let dx, dy;
      if (horizontal) {
        dx = tileIdx * TILE + x;
        dy = y;
      } else {
        dx = x;
        dy = tileIdx * TILE + y;
      }
      const dstI = (dy * stripW + dx) * 4;
      strip[dstI] = tile[srcI];
      strip[dstI + 1] = tile[srcI + 1];
      strip[dstI + 2] = tile[srcI + 2];
      strip[dstI + 3] = tile[srcI + 3];
    }
  }
}

// ─── Theme definitions ──────────────────────────────────

const THEMES = {
  'retro-scifi': {
    border: hex('#00ff88'),
    accent: hex('#00aaff'),
    bg: hex('#0a0a1a'),
    dark: hex('#006633'),
    mid: hex('#00cc66'),
  },
  'biological': {
    border: hex('#cc66aa'),
    accent: hex('#ff88cc'),
    bg: hex('#0d0a12'),
    dark: hex('#663355'),
    mid: hex('#995577'),
  },
  'steampunk': {
    border: hex('#cc9933'),
    accent: hex('#ffcc44'),
    bg: hex('#1a1208'),
    dark: hex('#886622'),
    mid: hex('#aa7722'),
  },
  'military': {
    border: hex('#ff8800'),
    accent: hex('#888888'),
    bg: hex('#0a0c0e'),
    dark: hex('#334455'),
    mid: hex('#556677'),
  },
  'alien': {
    border: hex('#6644ff'),
    accent: hex('#88aaff'),
    bg: hex('#060812'),
    dark: hex('#332288'),
    mid: hex('#5533cc'),
  },
};


// ═══════════════════════════════════════════════════════════
// RETRO-SCIFI: Circuit board traces, data buses, LED indicators
// ═══════════════════════════════════════════════════════════

function retroCorner(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;
  const [mr, mg, mb] = c.mid;

  // Outer L-bracket: 4px thick along top and left
  fill(p, 0, 0, 31, 3, br, bg, bb);
  fill(p, 0, 4, 3, 31, br, bg, bb);
  // Inner shadow edge
  hLine(p, 4, 31, 4, dr, dg, db);
  vLine(p, 4, 4, 31, dr, dg, db);
  // Second inner line (darker)
  hLine(p, 5, 31, 5, ...darken(c.dark, 0.6));
  vLine(p, 5, 5, 31, ...darken(c.dark, 0.6));

  // Bright corner junction — white LED
  fill(p, 0, 0, 1, 1, 255, 255, 255);
  set(p, 2, 0, ...brighten(c.border, 0.5));
  set(p, 0, 2, ...brighten(c.border, 0.5));

  // Circuit trace detail — inner tick marks along top edge
  for (let x = 8; x < 30; x += 6) {
    set(p, x, 3, ar, ag, ab);
    set(p, x + 1, 3, ar, ag, ab);
    set(p, x, 4, mr, mg, mb);
  }
  // Tick marks along left edge
  for (let y = 8; y < 30; y += 6) {
    set(p, 3, y, ar, ag, ab);
    set(p, 3, y + 1, ar, ag, ab);
    set(p, 4, y, mr, mg, mb);
  }

  // Inner corner chip detail — small square
  fill(p, 6, 6, 9, 9, dr, dg, db);
  set(p, 7, 7, mr, mg, mb);
  set(p, 8, 8, ar, ag, ab);

  // Diagonal trace from corner chip
  for (let i = 0; i < 5; i++) {
    set(p, 10 + i, 10 + i, dr, dg, db);
  }

  return p;
}

// Edge H variant 1: Basic circuit trace with scanline dashes
function retroEdgeH1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;

  // Main border strip — 4px tall
  fill(p, 0, 0, 31, 2, br, bg, bb);
  hLine(p, 0, 31, 3, dr, dg, db);
  hLine(p, 0, 31, 4, ...darken(c.dark, 0.6));

  // Scanline dashes — bright segments
  for (let x = 0; x < 32; x += 6) {
    set(p, x, 0, ...brighten(c.border, 0.4));
    set(p, x + 1, 0, ...brighten(c.border, 0.3));
  }
  return p;
}

// Edge H variant 2: Data bus with parallel traces
function retroEdgeH2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;

  // Main border
  fill(p, 0, 0, 31, 2, br, bg, bb);
  hLine(p, 0, 31, 3, dr, dg, db);
  hLine(p, 0, 31, 4, ...darken(c.dark, 0.6));

  // Data bus — two thin parallel lines below main border
  for (let x = 0; x < 32; x += 2) {
    set(p, x, 6, dr, dg, db, 120);
    set(p, x, 8, dr, dg, db, 80);
  }
  // LED indicator dot
  set(p, 15, 1, ar, ag, ab);
  set(p, 16, 1, ar, ag, ab);
  return p;
}

// Edge H variant 3: Chip connector pads
function retroEdgeH3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;
  const [mr, mg, mb] = c.mid;

  fill(p, 0, 0, 31, 2, br, bg, bb);
  hLine(p, 0, 31, 3, dr, dg, db);
  hLine(p, 0, 31, 4, ...darken(c.dark, 0.6));

  // Connector pads — small rectangles hanging off the border
  fill(p, 4, 3, 7, 7, dr, dg, db);
  set(p, 5, 4, mr, mg, mb);
  set(p, 6, 5, ar, ag, ab);

  fill(p, 20, 3, 23, 7, dr, dg, db);
  set(p, 21, 4, mr, mg, mb);
  set(p, 22, 5, ar, ag, ab);

  // Trace between pads
  hLine(p, 8, 19, 5, dr, dg, db, 100);
  return p;
}

// Edge H variant 4: Accent — LED strip segment
function retroEdgeH4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;

  fill(p, 0, 0, 31, 2, br, bg, bb);
  hLine(p, 0, 31, 3, dr, dg, db);
  hLine(p, 0, 31, 4, ...darken(c.dark, 0.6));

  // Bright LED indicators across the top
  for (let x = 2; x < 30; x += 4) {
    set(p, x, 1, ...brighten(c.accent, 0.6));
    set(p, x + 1, 1, ar, ag, ab);
    set(p, x, 0, ...brighten(c.border, 0.3));
  }
  return p;
}

// Vertical variants (rotated equivalents)
function retroEdgeV1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;

  fill(p, 0, 0, 2, 31, br, bg, bb);
  vLine(p, 3, 0, 31, dr, dg, db);
  vLine(p, 4, 0, 31, ...darken(c.dark, 0.6));

  for (let y = 0; y < 32; y += 6) {
    set(p, 0, y, ...brighten(c.border, 0.4));
    set(p, 0, y + 1, ...brighten(c.border, 0.3));
  }
  return p;
}

function retroEdgeV2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;

  fill(p, 0, 0, 2, 31, br, bg, bb);
  vLine(p, 3, 0, 31, dr, dg, db);
  vLine(p, 4, 0, 31, ...darken(c.dark, 0.6));

  for (let y = 0; y < 32; y += 2) {
    set(p, 6, y, dr, dg, db, 120);
    set(p, 8, y, dr, dg, db, 80);
  }
  set(p, 1, 15, ar, ag, ab);
  set(p, 1, 16, ar, ag, ab);
  return p;
}

function retroEdgeV3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;
  const [mr, mg, mb] = c.mid;

  fill(p, 0, 0, 2, 31, br, bg, bb);
  vLine(p, 3, 0, 31, dr, dg, db);
  vLine(p, 4, 0, 31, ...darken(c.dark, 0.6));

  fill(p, 3, 4, 7, 7, dr, dg, db);
  set(p, 4, 5, mr, mg, mb);
  set(p, 5, 6, ar, ag, ab);

  fill(p, 3, 20, 7, 23, dr, dg, db);
  set(p, 4, 21, mr, mg, mb);
  set(p, 5, 22, ar, ag, ab);

  vLine(p, 5, 8, 19, dr, dg, db, 100);
  return p;
}

function retroEdgeV4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;

  fill(p, 0, 0, 2, 31, br, bg, bb);
  vLine(p, 3, 0, 31, dr, dg, db);
  vLine(p, 4, 0, 31, ...darken(c.dark, 0.6));

  for (let y = 2; y < 30; y += 4) {
    set(p, 1, y, ...brighten(c.accent, 0.6));
    set(p, 1, y + 1, ar, ag, ab);
    set(p, 0, y, ...brighten(c.border, 0.3));
  }
  return p;
}


// ═══════════════════════════════════════════════════════════
// BIOLOGICAL: Organic membrane, veins, spores, nerve nodes
// ═══════════════════════════════════════════════════════════

function bioCorner(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  // Organic blob in corner — larger at 32px
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const dx = x - 8, dy = y - 8;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 9) {
        if (dist < 4) {
          set(p, x, y, ar, ag, ab, 240);
        } else if (dist < 6) {
          set(p, x, y, ...mix(c.accent, c.border, 0.5), 220);
        } else {
          set(p, x, y, br, bg, bb, 200);
        }
      }
    }
  }

  // Nucleus highlights
  set(p, 4, 4, ...brighten(c.accent, 0.7));
  set(p, 5, 5, ...brighten(c.accent, 0.5));
  set(p, 6, 3, ...brighten(c.accent, 0.4));
  // Nucleus dark spots
  set(p, 7, 7, dr, dg, db);
  set(p, 8, 6, dr, dg, db);

  // Vein tendril extending right
  for (let x = 16; x < 32; x++) {
    const y = 3 + Math.round(Math.sin(x * 0.4) * 1.5);
    set(p, x, y, br, bg, bb);
    set(p, x, y + 1, mr, mg, mb, 180);
    set(p, x, y + 2, dr, dg, db, 100);
  }
  // Secondary thinner vein right
  for (let x = 18; x < 32; x++) {
    const y = 8 + Math.round(Math.sin(x * 0.6 + 1) * 1);
    set(p, x, y, mr, mg, mb, 140);
  }

  // Vein tendril extending down
  for (let y = 16; y < 32; y++) {
    const x = 3 + Math.round(Math.sin(y * 0.4) * 1.5);
    set(p, x, y, br, bg, bb);
    set(p, x + 1, y, mr, mg, mb, 180);
    set(p, x + 2, y, dr, dg, db, 100);
  }
  // Secondary thinner vein down
  for (let y = 18; y < 32; y++) {
    const x = 8 + Math.round(Math.sin(y * 0.6 + 1) * 1);
    set(p, x, y, mr, mg, mb, 140);
  }

  // Spore dots near corner
  set(p, 14, 14, dr, dg, db, 160);
  set(p, 12, 16, dr, dg, db, 120);

  return p;
}

// Edge H variant 1: Undulating membrane with pores
function bioEdgeH1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  for (let x = 0; x < 32; x++) {
    const baseY = 2 + Math.round(Math.sin(x * 0.35) * 1.2);
    set(p, x, baseY - 2, dr, dg, db, 80);
    set(p, x, baseY - 1, mr, mg, mb, 160);
    set(p, x, baseY, br, bg, bb);
    set(p, x, baseY + 1, br, bg, bb);
    set(p, x, baseY + 2, mr, mg, mb, 180);
    set(p, x, baseY + 3, dr, dg, db, 100);
  }
  // Pore holes
  set(p, 8, 3, 0, 0, 0, 0);
  set(p, 22, 2, 0, 0, 0, 0);
  return p;
}

// Edge H variant 2: Vein cluster
function bioEdgeH2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;
  const [ar, ag, ab] = c.accent;

  // Main membrane
  for (let x = 0; x < 32; x++) {
    const baseY = 2 + Math.round(Math.sin(x * 0.3 + 0.5) * 1);
    set(p, x, baseY - 1, mr, mg, mb, 140);
    set(p, x, baseY, br, bg, bb);
    set(p, x, baseY + 1, br, bg, bb);
    set(p, x, baseY + 2, dr, dg, db, 160);
  }
  // Branching vein below membrane
  for (let x = 4; x < 28; x++) {
    const y = 6 + Math.round(Math.sin(x * 0.5) * 1.5);
    set(p, x, y, mr, mg, mb, 120);
    if (x % 7 === 0) {
      set(p, x, y + 1, dr, dg, db, 100);
      set(p, x, y + 2, dr, dg, db, 60);
    }
  }
  // Blood cell
  set(p, 14, 7, ar, ag, ab, 180);
  return p;
}

// Edge H variant 3: Spore pods
function bioEdgeH3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;
  const [ar, ag, ab] = c.accent;

  // Membrane
  for (let x = 0; x < 32; x++) {
    const baseY = 2 + Math.round(Math.sin(x * 0.25 + 1) * 0.8);
    set(p, x, baseY, br, bg, bb);
    set(p, x, baseY + 1, br, bg, bb);
    set(p, x, baseY + 2, dr, dg, db, 160);
  }
  // Spore pod — small organic bump
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2.5) {
        const cx = 10 + dx, cy = 6 + dy;
        set(p, cx, cy, ...mix(c.border, c.accent, dist / 3), 200);
      }
    }
  }
  set(p, 10, 6, ar, ag, ab, 230); // nucleus
  // Smaller spore
  set(p, 24, 5, mr, mg, mb, 200);
  set(p, 25, 5, br, bg, bb, 180);
  set(p, 24, 6, br, bg, bb, 180);
  return p;
}

// Edge H variant 4: Nerve node with synapse flash
function bioEdgeH4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;
  const [ar, ag, ab] = c.accent;

  for (let x = 0; x < 32; x++) {
    const baseY = 2 + Math.round(Math.sin(x * 0.3 + 2) * 1);
    set(p, x, baseY, br, bg, bb);
    set(p, x, baseY + 1, br, bg, bb);
    set(p, x, baseY + 2, dr, dg, db, 140);
  }
  // Nerve node — bright spot with radiating lines
  set(p, 16, 2, ...brighten(c.accent, 0.6));
  set(p, 15, 2, ar, ag, ab);
  set(p, 17, 2, ar, ag, ab);
  set(p, 16, 1, ar, ag, ab);
  // Synapse traces
  for (let i = 1; i < 5; i++) {
    set(p, 16 - i * 2, 4 + i, dr, dg, db, 140 - i * 25);
    set(p, 16 + i * 2, 4 + i, dr, dg, db, 140 - i * 25);
  }
  return p;
}

// Bio vertical variants
function bioEdgeV1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  for (let y = 0; y < 32; y++) {
    const baseX = 2 + Math.round(Math.sin(y * 0.35) * 1.2);
    set(p, baseX - 2, y, dr, dg, db, 80);
    set(p, baseX - 1, y, mr, mg, mb, 160);
    set(p, baseX, y, br, bg, bb);
    set(p, baseX + 1, y, br, bg, bb);
    set(p, baseX + 2, y, mr, mg, mb, 180);
    set(p, baseX + 3, y, dr, dg, db, 100);
  }
  set(p, 3, 8, 0, 0, 0, 0);
  set(p, 2, 22, 0, 0, 0, 0);
  return p;
}

function bioEdgeV2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;
  const [ar, ag, ab] = c.accent;

  for (let y = 0; y < 32; y++) {
    const baseX = 2 + Math.round(Math.sin(y * 0.3 + 0.5) * 1);
    set(p, baseX - 1, y, mr, mg, mb, 140);
    set(p, baseX, y, br, bg, bb);
    set(p, baseX + 1, y, br, bg, bb);
    set(p, baseX + 2, y, dr, dg, db, 160);
  }
  for (let y = 4; y < 28; y++) {
    const x = 6 + Math.round(Math.sin(y * 0.5) * 1.5);
    set(p, x, y, mr, mg, mb, 120);
  }
  set(p, 7, 14, ar, ag, ab, 180);
  return p;
}

function bioEdgeV3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;
  const [ar, ag, ab] = c.accent;

  for (let y = 0; y < 32; y++) {
    const baseX = 2 + Math.round(Math.sin(y * 0.25 + 1) * 0.8);
    set(p, baseX, y, br, bg, bb);
    set(p, baseX + 1, y, br, bg, bb);
    set(p, baseX + 2, y, dr, dg, db, 160);
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2.5) {
        set(p, 6 + dx, 10 + dy, ...mix(c.border, c.accent, dist / 3), 200);
      }
    }
  }
  set(p, 6, 10, ar, ag, ab, 230);
  set(p, 5, 24, mr, mg, mb, 200);
  set(p, 5, 25, br, bg, bb, 180);
  return p;
}

function bioEdgeV4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [ar, ag, ab] = c.accent;

  for (let y = 0; y < 32; y++) {
    const baseX = 2 + Math.round(Math.sin(y * 0.3 + 2) * 1);
    set(p, baseX, y, br, bg, bb);
    set(p, baseX + 1, y, br, bg, bb);
    set(p, baseX + 2, y, dr, dg, db, 140);
  }
  set(p, 2, 16, ...brighten(c.accent, 0.6));
  set(p, 2, 15, ar, ag, ab);
  set(p, 2, 17, ar, ag, ab);
  set(p, 1, 16, ar, ag, ab);
  for (let i = 1; i < 5; i++) {
    set(p, 4 + i, 16 - i * 2, dr, dg, db, 140 - i * 25);
    set(p, 4 + i, 16 + i * 2, dr, dg, db, 140 - i * 25);
  }
  return p;
}


// ═══════════════════════════════════════════════════════════
// STEAMPUNK: Brass plates, rivets, gears, pressure gauges
// ═══════════════════════════════════════════════════════════

function steamCorner(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  // Fill corner plate
  fill(p, 0, 0, 22, 22, dr, dg, db);

  // Plate border (bright edge)
  hLine(p, 0, 22, 0, br, bg, bb);
  hLine(p, 0, 22, 1, ...brighten(c.border, 0.2));
  vLine(p, 0, 0, 22, br, bg, bb);
  vLine(p, 1, 0, 22, ...brighten(c.border, 0.2));

  // Inner edge highlight
  hLine(p, 2, 20, 2, ...brighten(c.dark, 0.25));
  vLine(p, 2, 2, 20, ...brighten(c.dark, 0.25));

  // Groove shadow lines at plate edge
  hLine(p, 4, 22, 21, ...darken(c.dark, 0.5));
  hLine(p, 4, 22, 22, ...darken(c.dark, 0.4));
  vLine(p, 21, 4, 22, ...darken(c.dark, 0.5));
  vLine(p, 22, 4, 22, ...darken(c.dark, 0.4));

  // Big rivet at (6, 6)
  fill(p, 5, 5, 9, 9, br, bg, bb);
  set(p, 6, 6, ar, ag, ab); // highlight
  set(p, 7, 6, ...brighten(c.accent, 0.3));
  set(p, 8, 8, ...darken(c.border, 0.6));
  set(p, 9, 9, ...darken(c.border, 0.5));

  // Small rivet at (15, 15)
  fill(p, 14, 14, 17, 17, br, bg, bb);
  set(p, 15, 15, ar, ag, ab);
  set(p, 16, 16, ...darken(c.border, 0.6));

  // Gear teeth along outer edges extending beyond plate
  for (let i = 24; i < 32; i += 4) {
    fill(p, i, 0, i + 1, 3, mr, mg, mb);
    set(p, i, 0, br, bg, bb);
  }
  for (let i = 24; i < 32; i += 4) {
    fill(p, 0, i, 3, i + 1, mr, mg, mb);
    set(p, 0, i, br, bg, bb);
  }

  // Corner bright highlight
  set(p, 0, 0, ...brighten(c.border, 0.5));

  return p;
}

// Edge H variant 1: Plain brass strip with rivets
function steamEdgeH1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  // Metal strip — 5px tall
  hLine(p, 0, 31, 0, br, bg, bb);
  fill(p, 0, 1, 31, 2, ...brighten(c.dark, 0.25));
  fill(p, 0, 3, 31, 4, dr, dg, db);
  hLine(p, 0, 31, 5, ...darken(c.dark, 0.5));

  // Rivets every ~8px
  for (let x = 4; x < 32; x += 8) {
    set(p, x, 3, ar, ag, ab);
    set(p, x + 1, 3, ...brighten(c.accent, 0.2));
    set(p, x, 4, ...darken(c.border, 0.6));
  }
  return p;
}

// Edge H variant 2: Overlapping plate seam
function steamEdgeH2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  hLine(p, 0, 31, 0, br, bg, bb);
  fill(p, 0, 1, 31, 2, ...brighten(c.dark, 0.25));
  fill(p, 0, 3, 31, 4, dr, dg, db);
  hLine(p, 0, 31, 5, ...darken(c.dark, 0.5));

  // Plate overlap seam — diagonal notch
  for (let i = 0; i < 6; i++) {
    const x = 13 + i;
    set(p, x, 2, ...darken(c.dark, 0.4));
    set(p, x, 3, ...darken(c.dark, 0.3));
  }
  // Seam rivets
  set(p, 13, 2, ar, ag, ab);
  set(p, 19, 2, ar, ag, ab);

  return p;
}

// Edge H variant 3: Gear teeth
function steamEdgeH3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  hLine(p, 0, 31, 0, br, bg, bb);
  fill(p, 0, 1, 31, 2, ...brighten(c.dark, 0.25));
  fill(p, 0, 3, 31, 4, dr, dg, db);
  hLine(p, 0, 31, 5, ...darken(c.dark, 0.5));

  // Gear teeth protrusions
  for (let x = 2; x < 30; x += 8) {
    fill(p, x, 5, x + 3, 8, mr, mg, mb);
    hLine(p, x, x + 3, 5, br, bg, bb);
    set(p, x, 6, br, bg, bb);
    set(p, x + 3, 8, ...darken(c.dark, 0.4));
  }
  return p;
}

// Edge H variant 4: Pressure gauge
function steamEdgeH4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  hLine(p, 0, 31, 0, br, bg, bb);
  fill(p, 0, 1, 31, 2, ...brighten(c.dark, 0.25));
  fill(p, 0, 3, 31, 4, dr, dg, db);
  hLine(p, 0, 31, 5, ...darken(c.dark, 0.5));

  // Small circular gauge
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 2.5 && dist < 3.5) {
        set(p, 16 + dx, 8 + dy, br, bg, bb);
      }
    }
  }
  // Gauge needle
  set(p, 16, 7, ar, ag, ab);
  set(p, 15, 6, ar, ag, ab);
  // Gauge center
  set(p, 16, 8, ...brighten(c.accent, 0.4));

  return p;
}

// Steam vertical variants
function steamEdgeV1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  fill(p, 1, 0, 2, 31, ...brighten(c.dark, 0.25));
  fill(p, 3, 0, 4, 31, dr, dg, db);
  vLine(p, 5, 0, 31, ...darken(c.dark, 0.5));

  for (let y = 4; y < 32; y += 8) {
    set(p, 3, y, ar, ag, ab);
    set(p, 3, y + 1, ...brighten(c.accent, 0.2));
    set(p, 4, y, ...darken(c.border, 0.6));
  }
  return p;
}

function steamEdgeV2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  fill(p, 1, 0, 2, 31, ...brighten(c.dark, 0.25));
  fill(p, 3, 0, 4, 31, dr, dg, db);
  vLine(p, 5, 0, 31, ...darken(c.dark, 0.5));

  for (let i = 0; i < 6; i++) {
    set(p, 2, 13 + i, ...darken(c.dark, 0.4));
    set(p, 3, 13 + i, ...darken(c.dark, 0.3));
  }
  set(p, 2, 13, ar, ag, ab);
  set(p, 2, 19, ar, ag, ab);
  return p;
}

function steamEdgeV3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  vLine(p, 0, 0, 31, br, bg, bb);
  fill(p, 1, 0, 2, 31, ...brighten(c.dark, 0.25));
  fill(p, 3, 0, 4, 31, dr, dg, db);
  vLine(p, 5, 0, 31, ...darken(c.dark, 0.5));

  for (let y = 2; y < 30; y += 8) {
    fill(p, 5, y, 8, y + 3, mr, mg, mb);
    vLine(p, 5, y, y + 3, br, bg, bb);
    set(p, 6, y, br, bg, bb);
    set(p, 8, y + 3, ...darken(c.dark, 0.4));
  }
  return p;
}

function steamEdgeV4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  fill(p, 1, 0, 2, 31, ...brighten(c.dark, 0.25));
  fill(p, 3, 0, 4, 31, dr, dg, db);
  vLine(p, 5, 0, 31, ...darken(c.dark, 0.5));

  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 2.5 && dist < 3.5) {
        set(p, 8 + dx, 16 + dy, br, bg, bb);
      }
    }
  }
  set(p, 7, 16, ar, ag, ab);
  set(p, 6, 15, ar, ag, ab);
  set(p, 8, 16, ...brighten(c.accent, 0.4));
  return p;
}


// ═══════════════════════════════════════════════════════════
// MILITARY: Armor panels, bolts, hazard stripes, vent slats
// ═══════════════════════════════════════════════════════════

function milCorner(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border; // orange
  const [ar, ag, ab] = c.accent; // gray
  const [dr, dg, db] = c.dark;

  // Armor plate fill
  fill(p, 0, 0, 23, 23, dr, dg, db);

  // Orange outer edge (3px)
  hLine(p, 0, 23, 0, br, bg, bb);
  hLine(p, 0, 23, 1, ...brighten(c.border, 0.15));
  hLine(p, 0, 23, 2, ...darken(c.border, 0.7));
  vLine(p, 0, 0, 23, br, bg, bb);
  vLine(p, 1, 0, 23, ...brighten(c.border, 0.15));
  vLine(p, 2, 0, 23, ...darken(c.border, 0.7));

  // Bright corner
  set(p, 0, 0, ...brighten(c.border, 0.5));

  // Diagonal hazard stripe
  for (let i = 0; i < 12; i++) {
    const x = 4 + i, y = 14 - i;
    if (x < 24 && y >= 3 && y < 24) {
      set(p, x, y, br, bg, bb);
      if (y + 1 < 24) set(p, x, y + 1, ...darken(c.border, 0.5));
    }
  }
  // Second stripe
  for (let i = 0; i < 8; i++) {
    const x = 8 + i, y = 20 - i;
    if (x < 24 && y >= 3 && y < 24) {
      set(p, x, y, br, bg, bb, 160);
    }
  }

  // Bolt head at (7, 7) — larger
  fill(p, 6, 6, 10, 10, ar, ag, ab);
  set(p, 7, 7, ...brighten(c.accent, 0.4));
  set(p, 8, 7, ...brighten(c.accent, 0.3));
  set(p, 9, 9, ...darken(c.accent, 0.5));
  set(p, 10, 10, ...darken(c.accent, 0.4));
  // Bolt slot
  set(p, 8, 8, ...darken(c.dark, 0.3));

  // Plate edge shadow
  hLine(p, 4, 23, 22, ...darken(c.dark, 0.4));
  hLine(p, 4, 23, 23, ...darken(c.dark, 0.3));
  vLine(p, 22, 4, 23, ...darken(c.dark, 0.4));
  vLine(p, 23, 4, 23, ...darken(c.dark, 0.3));

  // Stencil marking — small "07" near edge
  set(p, 16, 17, ar, ag, ab, 100);
  set(p, 17, 17, ar, ag, ab, 100);
  set(p, 19, 17, ar, ag, ab, 100);
  set(p, 20, 17, ar, ag, ab, 100);

  return p;
}

// Edge H variant 1: Armor plate with bolts
function milEdgeH1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  hLine(p, 0, 31, 0, br, bg, bb);
  hLine(p, 0, 31, 1, ...brighten(c.border, 0.15));
  hLine(p, 0, 31, 2, ...darken(c.border, 0.7));
  fill(p, 0, 3, 31, 5, dr, dg, db);
  hLine(p, 0, 31, 6, ...darken(c.dark, 0.4));

  // Bolts
  for (let x = 6; x < 32; x += 10) {
    set(p, x, 4, ar, ag, ab);
    set(p, x + 1, 4, ...brighten(c.accent, 0.2));
    set(p, x, 5, ...darken(c.accent, 0.5));
  }
  return p;
}

// Edge H variant 2: Hazard stripe section
function milEdgeH2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;

  hLine(p, 0, 31, 0, br, bg, bb);
  hLine(p, 0, 31, 1, ...brighten(c.border, 0.15));
  hLine(p, 0, 31, 2, ...darken(c.border, 0.7));
  fill(p, 0, 3, 31, 5, dr, dg, db);
  hLine(p, 0, 31, 6, ...darken(c.dark, 0.4));

  // Diagonal hazard dashes
  for (let x = 0; x < 32; x += 8) {
    for (let i = 0; i < 4; i++) {
      set(p, x + i, 3 + i, br, bg, bb, 180);
      if (3 + i + 1 <= 5) set(p, x + i, 4 + i, ...darken(c.border, 0.6), 120);
    }
  }
  return p;
}

// Edge H variant 3: Vent slats
function milEdgeH3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  hLine(p, 0, 31, 0, br, bg, bb);
  hLine(p, 0, 31, 1, ...brighten(c.border, 0.15));
  hLine(p, 0, 31, 2, ...darken(c.border, 0.7));
  fill(p, 0, 3, 31, 5, dr, dg, db);
  hLine(p, 0, 31, 6, ...darken(c.dark, 0.4));

  // Vent slats
  for (let x = 4; x < 28; x += 3) {
    set(p, x, 7, ...darken(c.dark, 0.3));
    set(p, x, 8, 0, 0, 0, 180);
    set(p, x, 9, ...darken(c.dark, 0.3));
  }
  // Vent frame
  hLine(p, 3, 28, 6, ar, ag, ab, 100);
  hLine(p, 3, 28, 10, ar, ag, ab, 80);
  return p;
}

// Edge H variant 4: Stencil markings
function milEdgeH4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  hLine(p, 0, 31, 0, br, bg, bb);
  hLine(p, 0, 31, 1, ...brighten(c.border, 0.15));
  hLine(p, 0, 31, 2, ...darken(c.border, 0.7));
  fill(p, 0, 3, 31, 5, dr, dg, db);
  hLine(p, 0, 31, 6, ...darken(c.dark, 0.4));

  // Stenciled text marks (abstract dashes)
  for (let x = 5; x < 12; x++) {
    set(p, x, 4, ar, ag, ab, 80);
  }
  set(p, 5, 3, ar, ag, ab, 80);
  set(p, 8, 3, ar, ag, ab, 80);
  set(p, 11, 3, ar, ag, ab, 80);
  set(p, 5, 5, ar, ag, ab, 80);
  set(p, 8, 5, ar, ag, ab, 80);
  set(p, 11, 5, ar, ag, ab, 80);

  // Warning triangle
  set(p, 22, 3, br, bg, bb, 140);
  set(p, 21, 5, br, bg, bb, 140);
  set(p, 23, 5, br, bg, bb, 140);
  hLine(p, 21, 23, 5, br, bg, bb, 140);
  set(p, 22, 4, ar, ag, ab, 120);
  return p;
}

// Military vertical variants
function milEdgeV1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  vLine(p, 1, 0, 31, ...brighten(c.border, 0.15));
  vLine(p, 2, 0, 31, ...darken(c.border, 0.7));
  fill(p, 3, 0, 5, 31, dr, dg, db);
  vLine(p, 6, 0, 31, ...darken(c.dark, 0.4));

  for (let y = 6; y < 32; y += 10) {
    set(p, 4, y, ar, ag, ab);
    set(p, 4, y + 1, ...brighten(c.accent, 0.2));
    set(p, 5, y, ...darken(c.accent, 0.5));
  }
  return p;
}

function milEdgeV2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  vLine(p, 1, 0, 31, ...brighten(c.border, 0.15));
  vLine(p, 2, 0, 31, ...darken(c.border, 0.7));
  fill(p, 3, 0, 5, 31, dr, dg, db);
  vLine(p, 6, 0, 31, ...darken(c.dark, 0.4));

  for (let y = 0; y < 32; y += 8) {
    for (let i = 0; i < 4; i++) {
      set(p, 3 + i, y + i, br, bg, bb, 180);
    }
  }
  return p;
}

function milEdgeV3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  vLine(p, 1, 0, 31, ...brighten(c.border, 0.15));
  vLine(p, 2, 0, 31, ...darken(c.border, 0.7));
  fill(p, 3, 0, 5, 31, dr, dg, db);
  vLine(p, 6, 0, 31, ...darken(c.dark, 0.4));

  for (let y = 4; y < 28; y += 3) {
    set(p, 7, y, ...darken(c.dark, 0.3));
    set(p, 8, y, 0, 0, 0, 180);
    set(p, 9, y, ...darken(c.dark, 0.3));
  }
  vLine(p, 6, 3, 28, ar, ag, ab, 100);
  vLine(p, 10, 3, 28, ar, ag, ab, 80);
  return p;
}

function milEdgeV4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  vLine(p, 0, 0, 31, br, bg, bb);
  vLine(p, 1, 0, 31, ...brighten(c.border, 0.15));
  vLine(p, 2, 0, 31, ...darken(c.border, 0.7));
  fill(p, 3, 0, 5, 31, dr, dg, db);
  vLine(p, 6, 0, 31, ...darken(c.dark, 0.4));

  for (let y = 5; y < 12; y++) {
    set(p, 4, y, ar, ag, ab, 80);
  }
  set(p, 3, 5, ar, ag, ab, 80);
  set(p, 3, 8, ar, ag, ab, 80);
  set(p, 5, 5, ar, ag, ab, 80);
  set(p, 5, 8, ar, ag, ab, 80);

  set(p, 3, 22, br, bg, bb, 140);
  set(p, 5, 22, br, bg, bb, 140);
  vLine(p, 3, 22, 24, br, bg, bb, 140);
  set(p, 4, 23, ar, ag, ab, 120);
  return p;
}


// ═══════════════════════════════════════════════════════════
// ALIEN: Crystal facets, energy nodes, lattice webs, prisms
// ═══════════════════════════════════════════════════════════

function alienCorner(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  // Large crystal body — irregular faceted shape
  const crystalShape = [];
  for (let y = 0; y < 20; y++) {
    const width = Math.max(0, 20 - y - Math.floor(y * 0.3));
    for (let x = 0; x < width; x++) {
      crystalShape.push([x, y]);
    }
  }
  for (const [x, y] of crystalShape) {
    set(p, x, y, br, bg, bb);
  }

  // Facet highlights
  set(p, 0, 0, ...brighten(c.accent, 0.8)); // sparkle
  set(p, 1, 0, ...brighten(c.accent, 0.5));
  set(p, 2, 0, ar, ag, ab);
  set(p, 0, 1, ...brighten(c.accent, 0.5));
  set(p, 0, 2, ar, ag, ab);

  // Inner facet line (darker fracture)
  for (let i = 0; i < 10; i++) {
    set(p, 3 + i, 3 + i, dr, dg, db);
    if (i < 8) set(p, 4 + i, 3 + i, ...darken(c.dark, 0.8));
  }

  // Secondary fracture
  for (let i = 0; i < 6; i++) {
    set(p, 2 + i, 6 + i * 2, mr, mg, mb, 180);
  }

  // Crystal extension stubs along top edge
  for (let x = 18; x < 30; x += 4) {
    set(p, x, 0, br, bg, bb);
    set(p, x + 1, 0, br, bg, bb);
    set(p, x, 1, mr, mg, mb, 180);
    set(p, x + 1, 1, dr, dg, db, 120);
  }
  // Along left edge
  for (let y = 18; y < 30; y += 4) {
    set(p, 0, y, br, bg, bb);
    set(p, 0, y + 1, br, bg, bb);
    set(p, 1, y, mr, mg, mb, 180);
    set(p, 1, y + 1, dr, dg, db, 120);
  }

  // Energy glow near inner facet
  set(p, 6, 6, ar, ag, ab, 200);
  set(p, 5, 7, ar, ag, ab, 140);
  set(p, 7, 5, ar, ag, ab, 140);

  return p;
}

// Edge H variant 1: Crystal lattice strip
function alienEdgeH1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  // Crystalline strip — 3px with faceted look
  for (let x = 0; x < 32; x++) {
    set(p, x, 0, br, bg, bb);
    set(p, x, 1, ...mix(c.border, c.dark, 0.3));
    set(p, x, 2, br, bg, bb);
  }
  // Crystal protrusions
  for (let base = 3; base < 30; base += 8) {
    set(p, base, 3, br, bg, bb);
    set(p, base + 1, 3, br, bg, bb);
    set(p, base, 4, dr, dg, db, 180);
    set(p, base + 1, 4, ...mix(c.dark, c.accent, 0.3), 160);
  }
  // Facet shimmer
  set(p, 5, 0, ar, ag, ab);
  set(p, 16, 0, ...brighten(c.accent, 0.5));
  set(p, 27, 0, ar, ag, ab);
  return p;
}

// Edge H variant 2: Energy conduit with pulsing nodes
function alienEdgeH2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  for (let x = 0; x < 32; x++) {
    set(p, x, 0, br, bg, bb);
    set(p, x, 1, mr, mg, mb);
    set(p, x, 2, br, bg, bb);
  }

  // Energy node
  set(p, 15, 1, ...brighten(c.accent, 0.7));
  set(p, 14, 0, ar, ag, ab);
  set(p, 16, 0, ar, ag, ab);
  set(p, 14, 2, ar, ag, ab);
  set(p, 16, 2, ar, ag, ab);

  // Energy flow lines
  for (let x = 0; x < 12; x += 2) {
    set(p, x, 1, ar, ag, ab, 80 + x * 8);
  }
  for (let x = 18; x < 32; x += 2) {
    set(p, x, 1, ar, ag, ab, 80 + (32 - x) * 8);
  }
  return p;
}

// Edge H variant 3: Lattice web
function alienEdgeH3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [dr, dg, db] = c.dark;
  const [mr, mg, mb] = c.mid;

  for (let x = 0; x < 32; x++) {
    set(p, x, 0, br, bg, bb);
    set(p, x, 1, ...mix(c.border, c.dark, 0.3));
    set(p, x, 2, br, bg, bb);
  }

  // Lattice strands hanging down
  for (let x = 4; x < 30; x += 6) {
    for (let y = 3; y < 8; y++) {
      const sway = Math.round(Math.sin((y - 3) * 0.8 + x * 0.3) * 1);
      set(p, x + sway, y, mr, mg, mb, 180 - (y - 3) * 30);
    }
  }
  return p;
}

// Edge H variant 4: Prismatic shard
function alienEdgeH4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  for (let x = 0; x < 32; x++) {
    set(p, x, 0, br, bg, bb);
    set(p, x, 1, ...mix(c.border, c.dark, 0.3));
    set(p, x, 2, br, bg, bb);
  }

  // Prismatic shard jutting from edge
  const shardPixels = [
    [12, 3], [13, 3], [14, 3],
    [12, 4], [13, 4], [14, 4], [15, 4],
    [13, 5], [14, 5], [15, 5],
    [13, 6], [14, 6],
    [14, 7],
  ];
  for (const [x, y] of shardPixels) {
    set(p, x, y, br, bg, bb);
  }
  // Shard highlights
  set(p, 12, 3, ...brighten(c.accent, 0.5));
  set(p, 13, 4, ar, ag, ab);
  set(p, 14, 6, dr, dg, db);
  // Fracture line
  set(p, 13, 5, dr, dg, db);

  return p;
}

// Alien vertical variants
function alienEdgeV1(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  for (let y = 0; y < 32; y++) {
    set(p, 0, y, br, bg, bb);
    set(p, 1, y, ...mix(c.border, c.dark, 0.3));
    set(p, 2, y, br, bg, bb);
  }
  for (let base = 3; base < 30; base += 8) {
    set(p, 3, base, br, bg, bb);
    set(p, 3, base + 1, br, bg, bb);
    set(p, 4, base, dr, dg, db, 180);
    set(p, 4, base + 1, ...mix(c.dark, c.accent, 0.3), 160);
  }
  set(p, 0, 5, ar, ag, ab);
  set(p, 0, 16, ...brighten(c.accent, 0.5));
  set(p, 0, 27, ar, ag, ab);
  return p;
}

function alienEdgeV2(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [mr, mg, mb] = c.mid;

  for (let y = 0; y < 32; y++) {
    set(p, 0, y, br, bg, bb);
    set(p, 1, y, mr, mg, mb);
    set(p, 2, y, br, bg, bb);
  }
  set(p, 1, 15, ...brighten(c.accent, 0.7));
  set(p, 0, 14, ar, ag, ab);
  set(p, 0, 16, ar, ag, ab);
  set(p, 2, 14, ar, ag, ab);
  set(p, 2, 16, ar, ag, ab);
  for (let y = 0; y < 12; y += 2) {
    set(p, 1, y, ar, ag, ab, 80 + y * 8);
  }
  for (let y = 18; y < 32; y += 2) {
    set(p, 1, y, ar, ag, ab, 80 + (32 - y) * 8);
  }
  return p;
}

function alienEdgeV3(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [mr, mg, mb] = c.mid;

  for (let y = 0; y < 32; y++) {
    set(p, 0, y, br, bg, bb);
    set(p, 1, y, ...mix(c.border, c.dark, 0.3));
    set(p, 2, y, br, bg, bb);
  }
  for (let y = 4; y < 30; y += 6) {
    for (let x = 3; x < 8; x++) {
      const sway = Math.round(Math.sin((x - 3) * 0.8 + y * 0.3) * 1);
      set(p, x, y + sway, mr, mg, mb, 180 - (x - 3) * 30);
    }
  }
  return p;
}

function alienEdgeV4(c) {
  const p = createCanvas();
  const [br, bg, bb] = c.border;
  const [ar, ag, ab] = c.accent;
  const [dr, dg, db] = c.dark;

  for (let y = 0; y < 32; y++) {
    set(p, 0, y, br, bg, bb);
    set(p, 1, y, ...mix(c.border, c.dark, 0.3));
    set(p, 2, y, br, bg, bb);
  }

  const shardPixels = [
    [3, 12], [3, 13], [3, 14],
    [4, 12], [4, 13], [4, 14], [4, 15],
    [5, 13], [5, 14], [5, 15],
    [6, 13], [6, 14],
    [7, 14],
  ];
  for (const [x, y] of shardPixels) {
    set(p, x, y, br, bg, bb);
  }
  set(p, 3, 12, ...brighten(c.accent, 0.5));
  set(p, 4, 13, ar, ag, ab);
  set(p, 6, 14, dr, dg, db);
  set(p, 5, 13, dr, dg, db);
  return p;
}


// ═══════════════════════════════════════════════════════════
// Generator dispatch & strip compositing
// ═══════════════════════════════════════════════════════════

const generators = {
  'retro-scifi': {
    corner: retroCorner,
    edgeH: [retroEdgeH1, retroEdgeH2, retroEdgeH3, retroEdgeH4],
    edgeV: [retroEdgeV1, retroEdgeV2, retroEdgeV3, retroEdgeV4],
  },
  'biological': {
    corner: bioCorner,
    edgeH: [bioEdgeH1, bioEdgeH2, bioEdgeH3, bioEdgeH4],
    edgeV: [bioEdgeV1, bioEdgeV2, bioEdgeV3, bioEdgeV4],
  },
  'steampunk': {
    corner: steamCorner,
    edgeH: [steamEdgeH1, steamEdgeH2, steamEdgeH3, steamEdgeH4],
    edgeV: [steamEdgeV1, steamEdgeV2, steamEdgeV3, steamEdgeV4],
  },
  'military': {
    corner: milCorner,
    edgeH: [milEdgeH1, milEdgeH2, milEdgeH3, milEdgeH4],
    edgeV: [milEdgeV1, milEdgeV2, milEdgeV3, milEdgeV4],
  },
  'alien': {
    corner: alienCorner,
    edgeH: [alienEdgeH1, alienEdgeH2, alienEdgeH3, alienEdgeH4],
    edgeV: [alienEdgeV1, alienEdgeV2, alienEdgeV3, alienEdgeV4],
  },
};

// Tile sequence for the 8-tile strips — mix of variants for visual interest
// Indices into the edgeH/edgeV arrays (0-3)
const STRIP_SEQUENCE = [0, 1, 0, 2, 0, 3, 0, 1];

// ─── Write files ────────────────────────────────────────

let count = 0;
for (const [themeId, colors] of Object.entries(THEMES)) {
  const dir = path.join(OUT_DIR, themeId);
  fs.mkdirSync(dir, { recursive: true });

  const gen = generators[themeId];

  // Corner tile (32×32)
  const cornerPixels = gen.corner(colors);
  const cornerPath = path.join(dir, 'corner_tl.png');
  fs.writeFileSync(cornerPath, createPNG(TILE, TILE, cornerPixels));
  count++;

  // Horizontal edge strip (256×32)
  const stripW = STRIP_TILES * TILE;
  const stripH = TILE;
  const hStrip = new Uint8Array(stripW * stripH * 4);

  for (let i = 0; i < STRIP_TILES; i++) {
    const variantIdx = STRIP_SEQUENCE[i];
    const tile = gen.edgeH[variantIdx](colors);
    blitToStrip(hStrip, stripW, tile, i, true);
  }

  const edgeHPath = path.join(dir, 'edge_h.png');
  fs.writeFileSync(edgeHPath, createPNG(stripW, stripH, hStrip));
  count++;

  // Vertical edge strip (32×256)
  const vStripW = TILE;
  const vStripH = STRIP_TILES * TILE;
  const vStrip = new Uint8Array(vStripW * vStripH * 4);

  for (let i = 0; i < STRIP_TILES; i++) {
    const variantIdx = STRIP_SEQUENCE[i];
    const tile = gen.edgeV[variantIdx](colors);
    blitToStrip(vStrip, vStripW, tile, i, false);
  }

  const edgeVPath = path.join(dir, 'edge_v.png');
  fs.writeFileSync(edgeVPath, createPNG(vStripW, vStripH, vStrip));
  count++;
}

console.log(`Generated ${count} frame tile files in ${OUT_DIR}`);
for (const themeId of Object.keys(THEMES)) {
  console.log(`  ${themeId}/: corner_tl.png (${TILE}×${TILE}), edge_h.png (${STRIP_TILES * TILE}×${TILE}), edge_v.png (${TILE}×${STRIP_TILES * TILE})`);
}
