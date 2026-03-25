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

// Re-export data constants from centralized data directory
export { SHIP_TEMPLATES, STARTER_MODULES, STARTER_SHIP_NAME, STARTER_CREDITS, STARTER_SHIP_CLASS } from '../data/ships';
