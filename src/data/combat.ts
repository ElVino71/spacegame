// ─── COMBAT DATA ──────────────────────────────────────────
// Weapon configs, combat chatter, maneuver definitions, and balance constants.

// ─── WEAPON TYPES ─────────────────────────────────────────

export type WeaponType = 'laser' | 'missile' | 'kinetic' | 'emp';

export interface WeaponVisualConfig {
  color: number;
  trailColor: number;
  projectileSpeed: number;
  projectileSize: number;
  trailLength: number;
  hitFlashColor: number;
}

export const WEAPON_VISUALS: Record<WeaponType, WeaponVisualConfig> = {
  laser: {
    color: 0xff3333,
    trailColor: 0xff6666,
    projectileSpeed: 600,
    projectileSize: 2,
    trailLength: 12,
    hitFlashColor: 0xff4444,
  },
  missile: {
    color: 0xffaa00,
    trailColor: 0xff6600,
    projectileSpeed: 300,
    projectileSize: 4,
    trailLength: 8,
    hitFlashColor: 0xff8800,
  },
  kinetic: {
    color: 0xcccccc,
    trailColor: 0x888888,
    projectileSpeed: 500,
    projectileSize: 2,
    trailLength: 4,
    hitFlashColor: 0xffffff,
  },
  emp: {
    color: 0x4488ff,
    trailColor: 0x2266dd,
    projectileSpeed: 450,
    projectileSize: 3,
    trailLength: 10,
    hitFlashColor: 0x66aaff,
  },
};

// ─── NPC WEAPON LOADOUTS BY SHIP CLASS ────────────────────

export interface NPCWeaponDef {
  damage: number;
  fireRate: number;   // shots per second
  range: number;
  type: WeaponType;
}

export const NPC_WEAPON_LOADOUTS: Record<string, NPCWeaponDef[]> = {
  scout:     [{ damage: 8, fireRate: 2.5, range: 220, type: 'laser' }],
  corvette:  [
    { damage: 12, fireRate: 2.0, range: 250, type: 'laser' },
    { damage: 15, fireRate: 1.0, range: 300, type: 'missile' },
  ],
  gunship:   [
    { damage: 15, fireRate: 2.0, range: 250, type: 'kinetic' },
    { damage: 18, fireRate: 1.5, range: 280, type: 'laser' },
    { damage: 20, fireRate: 0.8, range: 320, type: 'missile' },
  ],
  freighter: [{ damage: 6, fireRate: 1.5, range: 180, type: 'kinetic' }],
  explorer:  [{ damage: 10, fireRate: 2.0, range: 200, type: 'emp' }],
};

// ─── NPC COMBAT STATS BY SHIP CLASS ──────────────────────

export interface NPCCombatStatsDef {
  hullMax: number;
  shieldMax: number;
  shieldRecharge: number;  // per second
  engineSpeed: number;
  evasion: number;         // 0-1 base evasion chance modifier
}

export const NPC_COMBAT_STATS: Record<string, NPCCombatStatsDef> = {
  scout:     { hullMax: 60,  shieldMax: 30,  shieldRecharge: 3, engineSpeed: 120, evasion: 0.25 },
  corvette:  { hullMax: 100, shieldMax: 60,  shieldRecharge: 5, engineSpeed: 100, evasion: 0.15 },
  gunship:   { hullMax: 150, shieldMax: 80,  shieldRecharge: 4, engineSpeed: 70,  evasion: 0.08 },
  freighter: { hullMax: 120, shieldMax: 40,  shieldRecharge: 2, engineSpeed: 50,  evasion: 0.05 },
  explorer:  { hullMax: 80,  shieldMax: 50,  shieldRecharge: 4, engineSpeed: 90,  evasion: 0.20 },
};

// ─── MANEUVER DEFINITIONS ─────────────────────────────────

export type ManeuverType = 'orbit' | 'charge' | 'strafe' | 'retreat' | 'evade';

export interface ManeuverDef {
  duration: number;       // base seconds
  speedMultiplier: number; // applied to engine speed
  turnRate: number;       // radians per second
}

export const MANEUVER_DEFS: Record<ManeuverType, ManeuverDef> = {
  orbit:   { duration: 4.0, speedMultiplier: 0.8, turnRate: 1.5 },
  charge:  { duration: 2.0, speedMultiplier: 1.3, turnRate: 2.0 },
  strafe:  { duration: 3.0, speedMultiplier: 1.0, turnRate: 1.8 },
  retreat: { duration: 3.5, speedMultiplier: 1.1, turnRate: 1.2 },
  evade:   { duration: 1.5, speedMultiplier: 1.4, turnRate: 3.0 },
};

// Maneuver weights by behavior: [orbit, charge, strafe, retreat, evade]
export const MANEUVER_WEIGHTS: Record<string, Record<ManeuverType, number>> = {
  pirate:  { orbit: 2, charge: 4, strafe: 3, retreat: 1, evade: 1 },
  patrol:  { orbit: 3, charge: 2, strafe: 3, retreat: 1, evade: 2 },
  trader:  { orbit: 1, charge: 0, strafe: 1, retreat: 4, evade: 3 },
  player:  { orbit: 3, charge: 2, strafe: 3, retreat: 1, evade: 2 },
};

// ─── DAMAGE & ACCURACY CONSTANTS ──────────────────────────

export const COMBAT_CONSTANTS = {
  baseAccuracy: 0.7,
  accuracyDistanceFalloff: 0.001,  // per pixel of distance
  accuracySpeedPenalty: 0.002,     // per pixel/s of target speed
  shieldAbsorption: 1.0,           // shields absorb 100% of damage
  empShieldBypass: 0.8,            // EMP bypasses 80% of shields
  missileShieldBonus: 0.5,         // missiles do 50% extra to shields
};

// ─── FLEE CONSTANTS ───────────────────────────────────────

export const FLEE_CONSTANTS = {
  baseChance: 0.3,
  speedRatioMultiplier: 0.4,  // (playerSpeed / enemySpeed) * this
  penaltyPerAttempt: 0.1,
  cooldownSeconds: 5,
  pilotSkillBonus: 0.03,      // per piloting stat point
};

// ─── COMBAT CHATTER ───────────────────────────────────────

export interface CombatChatterEntry {
  text: string;
  color: string;
  weight: number;
}

export type CombatChatterPool = 'taunt' | 'damage_taken' | 'shield_down' | 'flee_taunt' | 'victory' | 'defeat' | 'player_flee';

export const COMBAT_CHATTER: Record<CombatChatterPool, CombatChatterEntry[]> = {
  taunt: [
    { text: 'You picked the wrong system, pilot!', color: '#ff4444', weight: 3 },
    { text: 'Your cargo is mine now!', color: '#ff4444', weight: 2 },
    { text: 'Prepare to be boarded!', color: '#ff6644', weight: 2 },
    { text: 'This sector belongs to us!', color: '#ff4444', weight: 2 },
    { text: 'Surrender your goods or be destroyed!', color: '#ff6644', weight: 3 },
    { text: 'Easy pickings...', color: '#ff4444', weight: 1 },
    { text: 'Another victim for the void!', color: '#ff4444', weight: 1 },
  ],
  damage_taken: [
    { text: 'Hull breach! Rerouting power!', color: '#ffaa00', weight: 3 },
    { text: 'Shields failing!', color: '#ffaa00', weight: 3 },
    { text: 'Direct hit! Systems damaged!', color: '#ff6600', weight: 2 },
    { text: 'They got through our shields!', color: '#ffaa00', weight: 2 },
    { text: 'Taking heavy fire!', color: '#ff6600', weight: 2 },
  ],
  shield_down: [
    { text: 'Shields are down!', color: '#ff6600', weight: 3 },
    { text: 'No shields! Evasive maneuvers!', color: '#ff4444', weight: 2 },
    { text: 'Shield generator offline!', color: '#ff6600', weight: 2 },
  ],
  flee_taunt: [
    { text: 'Running away? Smart choice.', color: '#ffcc00', weight: 3 },
    { text: "You can't outrun us forever!", color: '#ff4444', weight: 2 },
    { text: "That's right, run!", color: '#ffcc00', weight: 2 },
    { text: "We'll find you again, pilot!", color: '#ff4444', weight: 2 },
  ],
  victory: [
    { text: 'Target destroyed. Scanning for salvage...', color: '#00ff88', weight: 3 },
    { text: 'Hostile eliminated.', color: '#00ff88', weight: 3 },
    { text: "That's one less pirate in the void.", color: '#00ff88', weight: 2 },
    { text: 'Combat systems standing down.', color: '#00ccff', weight: 2 },
  ],
  defeat: [
    { text: 'Hull critical! All hands brace!', color: '#ff0000', weight: 3 },
    { text: 'Systems failing... emergency protocols!', color: '#ff0000', weight: 3 },
    { text: 'Mayday! Mayday!', color: '#ff0000', weight: 2 },
  ],
  player_flee: [
    { text: 'Engaging emergency thrust!', color: '#00ccff', weight: 3 },
    { text: 'Attempting to break away!', color: '#ffcc00', weight: 3 },
    { text: 'Diverting all power to engines!', color: '#00ccff', weight: 2 },
  ],
};

// ─── LOOT TABLES ──────────────────────────────────────────

export const COMBAT_LOOT = {
  pirate: { creditsMin: 50, creditsMax: 300, cargoChance: 0.6, moduleChance: 0.12, reputationGain: 5 },
  trader: { creditsMin: 100, creditsMax: 500, cargoChance: 0.8, moduleChance: 0.08, reputationGain: -15 },
  patrol: { creditsMin: 20, creditsMax: 100, cargoChance: 0.3, moduleChance: 0.15, reputationGain: -25 },
};

/** Possible cargo loot drops from defeated ships */
export const LOOT_CARGO_POOL = [
  { id: 'fuel_cells', name: 'Fuel Cells', baseValue: 45 },
  { id: 'electronics', name: 'Electronics', baseValue: 90 },
  { id: 'components', name: 'Ship Components', baseValue: 110 },
  { id: 'weapons', name: 'Weapons', baseValue: 130 },
  { id: 'med', name: 'Medical Supplies', baseValue: 50 },
  { id: 'luxury', name: 'Luxury Goods', baseValue: 200 },
  { id: 'Crystals', name: 'Crystals', baseValue: 120 },
  { id: 'Platinum', name: 'Platinum', baseValue: 150 },
  { id: 'artifacts', name: 'Alien Artifacts', baseValue: 300 },
];

/** Possible module loot drops (rare) */
export const LOOT_MODULE_POOL = [
  { id: 'weapon_laser_mk2', type: 'weapon' as const, name: 'Pulse Laser Mk2', tier: 2, stats: { damage: 18, fireRate: 3.5, range: 240, energyCost: 8 }, size: 1 },
  { id: 'weapon_kinetic_mk1', type: 'weapon' as const, name: 'Railgun Mk1', tier: 1, stats: { damage: 14, fireRate: 2, range: 220, energyCost: 6 }, size: 1 },
  { id: 'shield_mk2', type: 'shield' as const, name: 'Deflector Mk2', tier: 2, stats: { capacity: 80, rechargeRate: 8 }, size: 1 },
  { id: 'engine_mk2', type: 'engine' as const, name: 'Ion Drive Mk2', tier: 2, stats: { speed: 200, jumpRange: 100, fuelEfficiency: 0.9 }, size: 1 },
  { id: 'sensor_mk2', type: 'sensor' as const, name: 'Scanner Mk2', tier: 2, stats: { range: 400, detail: 2 }, size: 1 },
  { id: 'cargo_mk2', type: 'cargo' as const, name: 'Cargo Pod Mk2', tier: 2, stats: { capacity: 35 }, size: 1 },
  { id: 'mining_mk1', type: 'mining' as const, name: 'Mining Laser Mk1', tier: 1, stats: { miningSpeed: 2, yield: 1.2 }, size: 1 },
  { id: 'hull_plating_mk1', type: 'hull' as const, name: 'Hull Plating Mk1', tier: 1, stats: { armor: 20, hullBonus: 30 }, size: 1 },
];

/** Bounty rewards for pirate kills, scaled by ship class */
export const PIRATE_BOUNTIES: Record<string, { min: number; max: number; label: string }> = {
  scout:     { min: 80,  max: 200,  label: 'Minor Pirate Bounty' },
  corvette:  { min: 150, max: 400,  label: 'Pirate Bounty' },
  gunship:   { min: 300, max: 700,  label: 'Major Pirate Bounty' },
  freighter: { min: 100, max: 250,  label: 'Smuggler Bounty' },
  explorer:  { min: 120, max: 300,  label: 'Raider Bounty' },
};

/** Flowery battle summary adjectives and phrases */
export const BATTLE_SUMMARY = {
  openings: [
    'The void erupted in fire as',
    'Weapons blazed across the darkness as',
    'The silence of space shattered when',
    'Stars bore witness as',
    'In a flash of light and fury,',
    'The cosmos trembled as',
  ],
  playerDescriptors: [
    'your vessel',
    'the {shipName}',
    'your trusty {shipName}',
    'your battle-scarred ship',
  ],
  enemyDescriptors: [
    'the hostile {class}',
    'the enemy {class}',
    'the {behavior} {class}',
    'a rogue {class}',
  ],
  combatVerbs: [
    'exchanged devastating volleys with',
    'clashed fiercely with',
    'engaged in a deadly dance with',
    'traded fire relentlessly with',
    'dueled across the void with',
  ],
  victoryClosings: [
    'The enemy vessel buckled under the onslaught, its hull splitting apart in a brilliant explosion.',
    'With a final, decisive strike, the hostile ship erupted into a shower of debris and flame.',
    'The enemy\'s reactor went critical, painting the void in a blinding flash of destruction.',
    'Sparks and shrapnel scattered as the defeated ship broke apart, its threat extinguished forever.',
    'The hostile vessel crumpled like tin foil, its remains drifting silently into the endless dark.',
  ],
  defeatClosings: [
    'Your ship shuddered violently as critical systems failed one by one.',
    'Alarms screamed as the hull gave way — emergency protocols barely kept you alive.',
    'The battle was lost. Your crippled vessel limped away from the wreckage.',
  ],
  fleeClosings: [
    'With engines screaming, you broke away from the engagement and vanished into the void.',
    'Discretion proved the better part of valor as you escaped into the darkness.',
    'Your ship surged forward, leaving the hostile behind in a trail of exhaust.',
  ],
};

// ─── ARENA DIMENSIONS ─────────────────────────────────────

export const COMBAT_ARENA = {
  width: 1200,
  height: 700,
  playerStartX: 450,
  playerStartY: 350,
  enemyStartX: 750,
  enemyStartY: 350,
};
