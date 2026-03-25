// ─── TRADE GOODS & MARKET DATA ──────────────────────────
// Human-editable game content. Tweak prices, add goods, adjust prefixes here.

export interface TradeGood {
  id: string;
  name: string;
  basePrice: number;
  category: string;
}

/** All tradeable goods available at stations */
export const TRADE_GOODS: TradeGood[] = [
  // Basic supplies
  { id: 'food',        name: 'Food Rations',     basePrice: 20,  category: 'basic' },
  { id: 'water',       name: 'Purified Water',   basePrice: 15,  category: 'basic' },
  { id: 'med',         name: 'Medical Supplies',  basePrice: 50,  category: 'basic' },
  { id: 'fuel_cells',  name: 'Fuel Cells',        basePrice: 45,  category: 'basic' },
  // Minerals (mined from planets — no prefix applied)
  { id: 'Iron',        name: 'Iron Ore',          basePrice: 30,  category: 'mineral' },
  { id: 'Copper',      name: 'Copper Ore',        basePrice: 40,  category: 'mineral' },
  { id: 'Titanium',    name: 'Titanium',          basePrice: 80,  category: 'mineral' },
  { id: 'Platinum',    name: 'Platinum',          basePrice: 150, category: 'mineral' },
  { id: 'Crystals',    name: 'Crystals',          basePrice: 120, category: 'mineral' },
  { id: 'Uranium',     name: 'Uranium',           basePrice: 180, category: 'mineral' },
  { id: 'Helium-3',    name: 'Helium-3',          basePrice: 140, category: 'mineral' },
  { id: 'Rare Earth',  name: 'Rare Earth',        basePrice: 170, category: 'mineral' },
  // Tech
  { id: 'electronics', name: 'Electronics',       basePrice: 90,  category: 'tech' },
  { id: 'components',  name: 'Ship Components',   basePrice: 110, category: 'tech' },
  // Military
  { id: 'weapons',     name: 'Weapons',           basePrice: 130, category: 'military' },
  // Luxury & rare
  { id: 'luxury',      name: 'Luxury Goods',      basePrice: 200, category: 'luxury' },
  { id: 'artifacts',   name: 'Alien Artifacts',   basePrice: 300, category: 'rare' },
];

/**
 * Prefixes applied to non-mineral goods at each station.
 * Each station seeds a random prefix per good, modifying its price.
 * Positive mod = more expensive, negative = cheaper.
 */
export const TRADE_PREFIXES: { label: string; mod: number }[] = [
  // Premium / exotic
  { label: 'Exotic',       mod: 0.25 },
  { label: 'Premium',      mod: 0.20 },
  { label: 'Vintage',      mod: 0.30 },
  { label: 'Artisanal',    mod: 0.15 },
  { label: 'Luxury',       mod: 0.35 },
  { label: 'Sexy',       mod: 0.05 },
  // Lore
  { label: 'Ancient',       mod: 0.20 },
  { label: 'Mythical',       mod: 0.20 },
  // Sci-fi / tech
  { label: 'Atomic',       mod: 0.18 },
  { label: 'Nano-Infused', mod: 0.22 },
  { label: 'Synthetic',    mod: -0.10 },
  { label: 'Quantum',      mod: 0.28 },
  { label: 'Recycled',     mod: -0.25 },
  // Sketchy / fun
  { label: 'Bootleg',      mod: -0.30 },
  { label: 'Suspicious',   mod: -0.20 },
  { label: 'Questionable', mod: -0.15 },
  { label: 'Black Market', mod: -0.10 },
  { label: 'Erotic',       mod: 0.15 },
  // Flavourful
  { label: 'Military-Grade', mod: 0.20 },
  { label: 'Homemade',     mod: -0.18 },
  { label: 'Contraband',   mod: 0.15 },
  { label: 'Irradiated',   mod: -0.22 },
  { label: 'Blessed',      mod: 0.12 },
  { label: 'Cursed',       mod: -0.12 },
  { label: 'Pirated',      mod: -0.15 },
  { label: 'Prototype',    mod: 0.30 },
  { label: 'Expired',      mod: -0.35 },
  { label: 'Smuggled',     mod: 0.10 },
  { label: 'Deep-Space',   mod: 0.15 },
  { label: 'Fermented',    mod: 0.05 },
  { label: 'Dehydrated',   mod: -0.08 },
  { label: 'Volatile',     mod: 0.18 },
];

/** Price multipliers per economy type per trade category */
export const ECONOMY_MODIFIERS: Record<string, Record<string, number>> = {
  agricultural: { basic: -0.3, mineral: 0.1, tech: 0.2, military: 0.15, luxury: 0.1, rare: 0 },
  industrial:   { basic: 0.1, mineral: -0.2, tech: -0.15, military: -0.1, luxury: 0.2, rare: 0 },
  mining:       { basic: 0.15, mineral: -0.35, tech: 0.1, military: 0.1, luxury: 0.2, rare: -0.1 },
  military:     { basic: 0.05, mineral: 0.1, tech: -0.1, military: -0.3, luxury: 0.3, rare: 0.1 },
  research:     { basic: 0.1, mineral: 0.15, tech: -0.25, military: 0.2, luxury: -0.1, rare: -0.2 },
  outpost:      { basic: 0.3, mineral: 0.2, tech: 0.3, military: 0.2, luxury: -0.2, rare: 0 },
};
