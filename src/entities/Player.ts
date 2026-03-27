import { ShipData, SHIP_TEMPLATES, STARTER_MODULES, STARTER_SHIP_NAME, STARTER_CREDITS, STARTER_SHIP_CLASS, ShipModule } from './Ship';
import { CrewMember } from './Character';
import { CREW_CAPACITY } from '../data/characters';

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
  crew: CrewMember[];
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
    theme: template.theme,
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
    crew: [],
  };
}

export function getCrewCapacity(ship: ShipData): number {
  return CREW_CAPACITY[ship.class] || 0;
}

export function getShipSpeed(ship: ShipData, crew: CrewMember[] = []): number {
  const engine = ship.slots.find(s => s.type === 'engine' && s.module)?.module;
  const baseSpeed = engine?.stats.speed ?? 50;

  // Pilot in bridge bonus
  const pilot = crew.find(c => c.role === 'pilot' && (!c.assignedRoom || c.assignedRoom === 'bridge'));
  const pilotBonus = pilot ? (pilot.stats.piloting * 0.05) : 0; // up to 50% bonus
  
  return baseSpeed * (1 + pilotBonus);
}

export function getJumpRange(ship: ShipData, crew: CrewMember[] = []): number {
  const engine = ship.slots.find(s => s.type === 'engine' && s.module)?.module;
  const baseRange = engine?.stats.jumpRange ?? 40;

  // Navigator bonus
  const nav = crew.find(c => c.role === 'navigator');
  const navBonus = nav ? (nav.stats.piloting * 0.03) : 0; // up to 30% bonus

  return baseRange * (1 + navBonus);
}

export function getCargoCapacity(ship: ShipData): number {
  return ship.slots
    .filter(s => s.type === 'cargo' && s.module)
    .reduce((total, s) => total + (s.module?.stats.capacity ?? 0), 0);
}

export function getCargoUsed(cargo: CargoItem[]): number {
  return cargo.reduce((total, item) => total + item.quantity, 0);
}

export function getSensorRange(ship: ShipData, crew: CrewMember[] = []): number {
  const sensor = ship.slots.find(s => s.type === 'sensor' && s.module)?.module;
  const baseRange = sensor?.stats.range ?? 100;

  // Scientist bonus
  const scientist = crew.find(c => c.role === 'scientist');
  const sciBonus = scientist ? (scientist.stats.science * 0.05) : 0;

  return baseRange * (1 + sciBonus);
}

export function getShieldCapacity(ship: ShipData): number {
  const shield = ship.slots.find(s => s.type === 'shield' && s.module)?.module;
  return shield?.stats.capacity ?? 0;
}
