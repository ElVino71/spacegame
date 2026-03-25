import { ShipData, SHIP_TEMPLATES, STARTER_MODULES, STARTER_SHIP_NAME, STARTER_CREDITS, STARTER_SHIP_CLASS, ShipModule } from './Ship';

export interface CargoItem {
  id: string;
  name: string;
  quantity: number;
  value: number; // price per unit at time of acquisition
  baseGoodId?: string; // links back to TradeGood.id for prefixed variants
}

export interface PlayerData {
  ship: ShipData;
  credits: number;
  cargo: CargoItem[];
  currentSystemId: number;
  reputation: Record<number, number>; // factionIndex -> -100 to 100
  discoveredSystems: Set<number>;
  visitedSystems: Set<number>;
  loreFragments: string[];
}

export function createNewPlayer(): PlayerData {
  const template = SHIP_TEMPLATES[STARTER_SHIP_CLASS];

  const slots = template.slots.map(s => ({ ...s, module: null as ShipModule | null }));

  // Install starter modules
  for (const mod of STARTER_MODULES) {
    const slot = slots.find(s => s.type === mod.type && s.module === null);
    if (slot) {
      slot.module = { ...mod };
    }
  }

  const ship: ShipData = {
    ...template,
    name: STARTER_SHIP_NAME,
    slots,
    hull: { ...template.hull },
    fuel: { ...template.fuel },
    x: 0,
    y: 0,
    angle: 0,
    vx: 0,
    vy: 0,
  };

  return {
    ship,
    credits: STARTER_CREDITS,
    cargo: [],
    currentSystemId: 0,
    reputation: { 0: 20, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    discoveredSystems: new Set([0]),
    visitedSystems: new Set([0]),
    loreFragments: [],
  };
}

export function getShipSpeed(ship: ShipData): number {
  const engine = ship.slots.find(s => s.type === 'engine' && s.module)?.module;
  return engine?.stats.speed ?? 50;
}

export function getJumpRange(ship: ShipData): number {
  const engine = ship.slots.find(s => s.type === 'engine' && s.module)?.module;
  return engine?.stats.jumpRange ?? 40;
}

export function getCargoCapacity(ship: ShipData): number {
  return ship.slots
    .filter(s => s.type === 'cargo' && s.module)
    .reduce((total, s) => total + (s.module?.stats.capacity ?? 0), 0);
}

export function getCargoUsed(cargo: CargoItem[]): number {
  return cargo.reduce((total, item) => total + item.quantity, 0);
}

export function getSensorRange(ship: ShipData): number {
  const sensor = ship.slots.find(s => s.type === 'sensor' && s.module)?.module;
  return sensor?.stats.range ?? 100;
}

export function getShieldCapacity(ship: ShipData): number {
  const shield = ship.slots.find(s => s.type === 'shield' && s.module)?.module;
  return shield?.stats.capacity ?? 0;
}
