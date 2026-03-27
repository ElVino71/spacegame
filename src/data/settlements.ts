// ─── SETTLEMENT DATA ────────────────────────────────────
// Human-editable game content for planet surface settlements.

import type { ShipModule } from '../entities/Ship';
import type { ChatterEntry } from './chatter';

// ─── Shop Types ─────────────────────────────────────────

export type ShopType = 'trade' | 'modules';

export interface ShopDef {
  type: ShopType;
  name: string;
  desc: string;
}

/** Possible shop configurations for settlements */
export const SHOP_TEMPLATES: ShopDef[] = [
  { type: 'trade', name: 'General Store', desc: 'Buy and sell commodities' },
  { type: 'trade', name: 'Trading Post', desc: 'Frontier goods exchange' },
  { type: 'trade', name: 'Supply Depot', desc: 'Essential supplies and materials' },
  { type: 'modules', name: 'Ship Outfitter', desc: 'Ship modules and upgrades' },
  { type: 'modules', name: 'Tech Workshop', desc: 'Custom ship components' },
  { type: 'modules', name: 'Parts Dealer', desc: 'Salvaged and new ship parts' },
];

// ─── Module Catalog ─────────────────────────────────────

export interface ModuleForSale {
  module: ShipModule;
  price: number;
}

/** All modules available for purchase at module shops. Shops pick a seeded subset. */
export const MODULE_CATALOG: ModuleForSale[] = [
  // ── Engines ──
  { module: { id: 'engine_mk1', type: 'engine', name: 'Ion Drive Mk1', tier: 1, stats: { speed: 150, jumpRange: 80, fuelEfficiency: 1.0 }, size: 1 }, price: 800 },
  { module: { id: 'engine_mk2', type: 'engine', name: 'Plasma Drive Mk2', tier: 2, stats: { speed: 220, jumpRange: 120, fuelEfficiency: 0.85 }, size: 2 }, price: 2500 },
  { module: { id: 'engine_mk3', type: 'engine', name: 'Fusion Drive Mk3', tier: 3, stats: { speed: 300, jumpRange: 160, fuelEfficiency: 0.7 }, size: 3 }, price: 6000 },

  // ── Weapons ──
  { module: { id: 'weapon_laser_mk1', type: 'weapon', name: 'Pulse Laser Mk1', tier: 1, stats: { damage: 10, fireRate: 3, range: 200, energyCost: 5 }, size: 1 }, price: 600 },
  { module: { id: 'weapon_laser_mk2', type: 'weapon', name: 'Beam Laser Mk2', tier: 2, stats: { damage: 20, fireRate: 2.5, range: 280, energyCost: 8 }, size: 2 }, price: 2000 },
  { module: { id: 'weapon_missile_mk2', type: 'weapon', name: 'Missile Rack Mk2', tier: 2, stats: { damage: 35, fireRate: 1.5, range: 350, energyCost: 12 }, size: 2 }, price: 3000 },
  { module: { id: 'weapon_cannon_mk3', type: 'weapon', name: 'Railgun Mk3', tier: 3, stats: { damage: 50, fireRate: 1, range: 400, energyCost: 20 }, size: 3 }, price: 7000 },

  // ── Shields ──
  { module: { id: 'shield_mk1', type: 'shield', name: 'Deflector Mk1', tier: 1, stats: { capacity: 50, rechargeRate: 5 }, size: 1 }, price: 700 },
  { module: { id: 'shield_mk2', type: 'shield', name: 'Barrier Mk2', tier: 2, stats: { capacity: 100, rechargeRate: 10 }, size: 2 }, price: 2200 },
  { module: { id: 'shield_mk3', type: 'shield', name: 'Fortress Shield Mk3', tier: 3, stats: { capacity: 180, rechargeRate: 18 }, size: 3 }, price: 5500 },

  // ── Cargo ──
  { module: { id: 'cargo_mk1', type: 'cargo', name: 'Cargo Pod Mk1', tier: 1, stats: { capacity: 20 }, size: 1 }, price: 400 },
  { module: { id: 'cargo_mk2', type: 'cargo', name: 'Cargo Bay Mk2', tier: 2, stats: { capacity: 40 }, size: 2 }, price: 1200 },
  { module: { id: 'cargo_mk3', type: 'cargo', name: 'Freight Hold Mk3', tier: 3, stats: { capacity: 70 }, size: 3 }, price: 3000 },

  // ── Sensors ──
  { module: { id: 'sensor_mk1', type: 'sensor', name: 'Scanner Mk1', tier: 1, stats: { range: 300, detail: 1 }, size: 1 }, price: 500 },
  { module: { id: 'sensor_mk2', type: 'sensor', name: 'Deep Scanner Mk2', tier: 2, stats: { range: 500, detail: 2 }, size: 2 }, price: 1800 },
  { module: { id: 'sensor_mk3', type: 'sensor', name: 'Omniscanner Mk3', tier: 3, stats: { range: 800, detail: 3 }, size: 3 }, price: 4500 },

  // ── Computer ──
  { module: { id: 'computer_mk1', type: 'computer', name: 'NavComp Mk1', tier: 1, stats: { hackBonus: 0, autoNav: 0 }, size: 1 }, price: 500 },
  { module: { id: 'computer_mk2', type: 'computer', name: 'TacComp Mk2', tier: 2, stats: { hackBonus: 15, autoNav: 1 }, size: 2 }, price: 1800 },
  { module: { id: 'computer_mk3', type: 'computer', name: 'QuantumCore Mk3', tier: 3, stats: { hackBonus: 30, autoNav: 2 }, size: 3 }, price: 5000 },

  // ── Mining ──
  { module: { id: 'mining_mk1', type: 'mining', name: 'Mining Laser Mk1', tier: 1, stats: { yield: 1.0, speed: 1.0 }, size: 1 }, price: 600 },
  { module: { id: 'mining_mk2', type: 'mining', name: 'Plasma Drill Mk2', tier: 2, stats: { yield: 1.5, speed: 1.5 }, size: 2 }, price: 2000 },

  // ── Hull ──
  { module: { id: 'hull_mk1', type: 'hull', name: 'Armor Plating Mk1', tier: 1, stats: { hullBonus: 20, damageReduction: 5 }, size: 1 }, price: 800 },
  { module: { id: 'hull_mk2', type: 'hull', name: 'Composite Armor Mk2', tier: 2, stats: { hullBonus: 50, damageReduction: 12 }, size: 2 }, price: 2500 },
  { module: { id: 'hull_mk3', type: 'hull', name: 'Nano-Armor Mk3', tier: 3, stats: { hullBonus: 90, damageReduction: 20 }, size: 3 }, price: 6000 },

  // ── Life Support ──
  { module: { id: 'life_support_mk1', type: 'life_support', name: 'Basic Life Support', tier: 1, stats: { crewBonus: 1, moraleBoost: 5 }, size: 1 }, price: 500 },
  { module: { id: 'life_support_mk2', type: 'life_support', name: 'Advanced Life Support Mk2', tier: 2, stats: { crewBonus: 2, moraleBoost: 12 }, size: 2 }, price: 1800 },
];

// ─── Settlement Chatter ─────────────────────────────────

export const SETTLEMENT_CHATTER: ChatterEntry[] = [
  { text: "Local settlers eye the rover with curiosity.", weight: 1 },
  { text: "The smell of cooking drifts from a nearby building.", weight: 1 },
  { text: "A child waves from a doorway.", weight: 0.8 },
  { text: "Settlement comms: 'Welcome, traveler. Trade is open.'", weight: 1 },
  { text: "Dust swirls between the prefab structures.", weight: 1 },
  { text: "A merchant is haggling loudly with a local farmer.", weight: 0.8 },
  { text: "Power generators hum steadily in the background.", weight: 1 },
  { text: "Atmospheric processors working overtime today.", weight: 0.8 },
  { text: "Local security patrol nods as you pass.", weight: 1 },
  { text: "A cargo drone buzzes overhead, delivering supplies.", weight: 0.8 },
];
