export interface ShipModule {
  id: string;
  type: ModuleType;
  name: string;
  tier: number;
  stats: Record<string, number>;
  size: number;
}

export type ModuleType = 'engine' | 'weapon' | 'shield' | 'cargo' | 'sensor' | 'computer' | 'mining' | 'hull' | 'life_support';

export interface ModuleSlot {
  type: ModuleType;
  maxSize: number;
  module: ShipModule | null;
}

export type ShipClass = 'scout' | 'freighter' | 'corvette' | 'gunship' | 'explorer';

export interface ShipData {
  class: ShipClass;
  name: string;
  slots: ModuleSlot[];
  hull: { current: number; max: number };
  fuel: { current: number; max: number };
  x: number;
  y: number;
  angle: number;  // radians
  vx: number;
  vy: number;
}

export const SHIP_TEMPLATES: Record<ShipClass, Omit<ShipData, 'x' | 'y' | 'angle' | 'vx' | 'vy' | 'name'>> = {
  scout: {
    class: 'scout',
    hull: { current: 80, max: 80 },
    fuel: { current: 100, max: 100 },
    slots: [
      { type: 'engine', maxSize: 2, module: null },
      { type: 'weapon', maxSize: 1, module: null },
      { type: 'shield', maxSize: 1, module: null },
      { type: 'cargo', maxSize: 2, module: null },
      { type: 'sensor', maxSize: 2, module: null },
      { type: 'computer', maxSize: 1, module: null },
    ],
  },
  freighter: {
    class: 'freighter',
    hull: { current: 120, max: 120 },
    fuel: { current: 150, max: 150 },
    slots: [
      { type: 'engine', maxSize: 2, module: null },
      { type: 'weapon', maxSize: 1, module: null },
      { type: 'shield', maxSize: 1, module: null },
      { type: 'cargo', maxSize: 4, module: null },
      { type: 'cargo', maxSize: 4, module: null },
      { type: 'cargo', maxSize: 4, module: null },
      { type: 'sensor', maxSize: 1, module: null },
      { type: 'computer', maxSize: 1, module: null },
    ],
  },
  corvette: {
    class: 'corvette',
    hull: { current: 100, max: 100 },
    fuel: { current: 120, max: 120 },
    slots: [
      { type: 'engine', maxSize: 3, module: null },
      { type: 'weapon', maxSize: 2, module: null },
      { type: 'weapon', maxSize: 2, module: null },
      { type: 'shield', maxSize: 2, module: null },
      { type: 'cargo', maxSize: 3, module: null },
      { type: 'sensor', maxSize: 2, module: null },
      { type: 'computer', maxSize: 2, module: null },
    ],
  },
  gunship: {
    class: 'gunship',
    hull: { current: 150, max: 150 },
    fuel: { current: 100, max: 100 },
    slots: [
      { type: 'engine', maxSize: 3, module: null },
      { type: 'weapon', maxSize: 3, module: null },
      { type: 'weapon', maxSize: 3, module: null },
      { type: 'weapon', maxSize: 2, module: null },
      { type: 'shield', maxSize: 3, module: null },
      { type: 'cargo', maxSize: 2, module: null },
      { type: 'sensor', maxSize: 1, module: null },
      { type: 'computer', maxSize: 1, module: null },
      { type: 'hull', maxSize: 3, module: null },
    ],
  },
  explorer: {
    class: 'explorer',
    hull: { current: 90, max: 90 },
    fuel: { current: 180, max: 180 },
    slots: [
      { type: 'engine', maxSize: 3, module: null },
      { type: 'weapon', maxSize: 1, module: null },
      { type: 'shield', maxSize: 2, module: null },
      { type: 'cargo', maxSize: 3, module: null },
      { type: 'sensor', maxSize: 3, module: null },
      { type: 'computer', maxSize: 3, module: null },
      { type: 'mining', maxSize: 2, module: null },
      { type: 'life_support', maxSize: 2, module: null },
    ],
  },
};

export const STARTER_MODULES: ShipModule[] = [
  { id: 'engine_basic', type: 'engine', name: 'Ion Drive Mk1', tier: 1, stats: { speed: 150, jumpRange: 80, fuelEfficiency: 1.0 }, size: 1 },
  { id: 'weapon_laser_basic', type: 'weapon', name: 'Pulse Laser Mk1', tier: 1, stats: { damage: 10, fireRate: 3, range: 200, energyCost: 5 }, size: 1 },
  { id: 'shield_basic', type: 'shield', name: 'Deflector Mk1', tier: 1, stats: { capacity: 50, rechargeRate: 5 }, size: 1 },
  { id: 'cargo_basic', type: 'cargo', name: 'Cargo Pod Mk1', tier: 1, stats: { capacity: 20 }, size: 1 },
  { id: 'sensor_basic', type: 'sensor', name: 'Scanner Mk1', tier: 1, stats: { range: 300, detail: 1 }, size: 1 },
  { id: 'computer_basic', type: 'computer', name: 'NavComp Mk1', tier: 1, stats: { hackBonus: 0, autoNav: 0 }, size: 1 },
];
