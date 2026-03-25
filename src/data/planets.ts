// ─── PLANET TYPES, GENERATION & BIOME DATA ──────────────
// Human-editable game content. Tweak biomes, mineral rarity, planet properties here.

import type { PlanetType } from '../utils/Constants';

// ─── Planet generation configs ──────────────────────────

export interface PlanetTypeConfig {
  type: PlanetType;
  landable: boolean;
  mineable: boolean;
  atmospheres: ('none' | 'thin' | 'breathable' | 'toxic' | 'crushing')[];
  ruinChance: number;
  settlementChance: number;
  minSize: number;
  maxSize: number;
}

export const PLANET_CONFIGS: PlanetTypeConfig[] = [
  { type: 'rocky',       landable: true,  mineable: true,  atmospheres: ['none', 'thin'],                   ruinChance: 0.3,  settlementChance: 0.2,  minSize: 8,  maxSize: 16 },
  { type: 'desert',      landable: true,  mineable: true,  atmospheres: ['thin', 'none'],                   ruinChance: 0.35, settlementChance: 0.15, minSize: 10, maxSize: 18 },
  { type: 'ice',         landable: true,  mineable: true,  atmospheres: ['none', 'thin'],                   ruinChance: 0.25, settlementChance: 0.1,  minSize: 8,  maxSize: 15 },
  { type: 'lush',        landable: true,  mineable: false, atmospheres: ['breathable'],                     ruinChance: 0.2,  settlementChance: 0.6,  minSize: 12, maxSize: 22 },
  { type: 'volcanic',    landable: true,  mineable: true,  atmospheres: ['toxic', 'thin'],                  ruinChance: 0.15, settlementChance: 0.05, minSize: 10, maxSize: 18 },
  { type: 'gas_giant',   landable: false, mineable: true,  atmospheres: ['crushing'],                       ruinChance: 0,    settlementChance: 0,    minSize: 25, maxSize: 45 },
  { type: 'ocean',       landable: true,  mineable: false, atmospheres: ['breathable', 'thin'],             ruinChance: 0.2,  settlementChance: 0.3,  minSize: 14, maxSize: 24 },
  { type: 'barren_moon', landable: true,  mineable: true,  atmospheres: ['none'],                           ruinChance: 0.2,  settlementChance: 0.05, minSize: 5,  maxSize: 10 },
];

/** Color palettes per planet type — one is picked at random per planet */
export const PLANET_COLORS: Record<PlanetType, number[]> = {
  rocky:       [0x888888, 0x996644, 0xaa8866, 0x776655],
  desert:      [0xddaa55, 0xcc9944, 0xbb8833, 0xeebb66],
  ice:         [0xaaddff, 0x88bbdd, 0xcceeff, 0x99ccee],
  lush:        [0x44aa44, 0x338833, 0x55bb55, 0x66cc66],
  volcanic:    [0xcc4422, 0xdd5533, 0xaa3311, 0xff6644],
  gas_giant:   [0xddaa77, 0xcc8855, 0xee9966, 0xbb7744],
  ocean:       [0x2266aa, 0x3377bb, 0x1155aa, 0x4488cc],
  barren_moon: [0x666666, 0x777777, 0x555555, 0x888888],
};

/** Minerals that can be found on planet surfaces */
export const MINERAL_TYPES: string[] = [
  'Iron', 'Copper', 'Titanium', 'Platinum', 'Crystals', 'Uranium', 'Helium-3', 'Rare Earth',
];

// ─── Biome configs (flora/fauna per planet type) ────────

export interface BiomeConfig {
  floraChance: number;   // 0-1 probability of flora on a ground tile
  faunaChance: number;   // 0-1 probability of fauna on a ground tile
  flora: string[];       // available flora types for this biome
  fauna: string[];       // available fauna types for this biome
}

/** Controls what life appears on each planet type's surface */
export const BIOME_CONFIGS: Record<string, BiomeConfig> = {
  lush: {
    floraChance: 0.15, faunaChance: 0.04,
    flora: ['tree_1', 'tree_2', 'bush_1', 'bush_2', 'flower', 'moss', 'vine'],
    fauna: ['critter_1', 'critter_2', 'grazer', 'predator', 'flyer', 'insect'],
  },
  desert: {
    floraChance: 0.04, faunaChance: 0.01,
    flora: ['cactus', 'bush_1'],
    fauna: ['critter_1', 'insect'],
  },
  ice: {
    floraChance: 0.05, faunaChance: 0.015,
    flora: ['crystal_plant', 'moss'],
    fauna: ['critter_2', 'grazer'],
  },
  volcanic: {
    floraChance: 0.03, faunaChance: 0.005,
    flora: ['mushroom', 'crystal_plant'],
    fauna: ['insect'],
  },
  ocean: {
    floraChance: 0.08, faunaChance: 0.03,
    flora: ['moss', 'vine', 'flower'],
    fauna: ['critter_1', 'critter_2', 'flyer'],
  },
  rocky: {
    floraChance: 0.04, faunaChance: 0.01,
    flora: ['moss', 'bush_1', 'mushroom'],
    fauna: ['critter_1', 'insect'],
  },
  barren_moon: {
    floraChance: 0, faunaChance: 0,
    flora: [], fauna: [],
  },
  gas_giant: {
    floraChance: 0, faunaChance: 0,
    flora: [], fauna: [],
  },
};
