export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const GALAXY_SIZE = 300; // number of star systems
export const GALAXY_BOUNDS = 4000; // pixel extent of galaxy map

export const SYSTEM_BOUNDS = 3000; // pixel extent of a star system view

export const COLORS = {
  background: 0x0a0a1a,
  stars: {
    O: 0x9bb0ff,  // blue
    B: 0xaabfff,  // blue-white
    A: 0xd5e0ff,  // white
    F: 0xf8f7ff,  // yellow-white
    G: 0xfff4e8,  // yellow (sol-like)
    K: 0xffd2a1,  // orange
    M: 0xffcc6f,  // red
  },
  ui: {
    primary: 0x00ff88,
    secondary: 0x00aaff,
    warning: 0xffaa00,
    danger: 0xff4444,
    text: 0xcccccc,
    textBright: 0xffffff,
    panel: 0x111122,
    panelBorder: 0x334455,
  },
  factions: [
    0x00ff88, // green
    0xff6644, // red-orange
    0x44aaff, // blue
    0xffcc00, // gold
    0xcc44ff, // purple
    0xff4488, // pink
  ],
};

export const STAR_TYPES = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const;
export type StarType = typeof STAR_TYPES[number];

export const PLANET_TYPES = [
  'rocky', 'desert', 'ice', 'lush', 'volcanic', 'gas_giant', 'ocean', 'barren_moon'
] as const;
export type PlanetType = typeof PLANET_TYPES[number];

export const ECONOMY_TYPES = [
  'agricultural', 'industrial', 'mining', 'military', 'research', 'outpost'
] as const;
export type EconomyType = typeof ECONOMY_TYPES[number];

export const FACTION_NAMES = [
  'Terran Accord',
  'Krai Collective',
  'Syndicate',
  'Luminari',
  'Void Runners',
  'Independent',
] as const;
