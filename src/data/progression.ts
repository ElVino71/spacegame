// ─── PROGRESSION DATA ──────────────────────────────────────
// Ranks, nicknames, and stat tracking for player progression.

/** All tracked player stats */
export interface PlayerStats {
  jumps: number;
  landings: number;
  trades: number;
  minerals_mined: number;
  lore_discovered: number;
  ships_attacked: number;
  ships_destroyed: number;
  stations_docked: number;
  ruins_explored: number;
  settlements_visited: number;
  credits_earned: number;
  crew_hired: number;
}

export function createEmptyStats(): PlayerStats {
  return {
    jumps: 0,
    landings: 0,
    trades: 0,
    minerals_mined: 0,
    lore_discovered: 0,
    ships_attacked: 0,
    ships_destroyed: 0,
    stations_docked: 0,
    ruins_explored: 0,
    settlements_visited: 0,
    credits_earned: 0,
    crew_hired: 0,
  };
}

// ─── RANKS ─────────────────────────────────────────────────
// Based on total activity points (sum of weighted stats).
// Navy-inspired with a sci-fi twist.

export interface RankTier {
  title: string;
  minXP: number;
}

/** Ranks in ascending order. Player gets the highest they qualify for. */
export const RANKS: RankTier[] = [
  { title: 'Void Cadet',       minXP: 0 },
  { title: 'Ensign',           minXP: 15 },
  { title: 'Lieutenant',       minXP: 50 },
  { title: 'Star Captain',     minXP: 120 },
  { title: 'Commander',        minXP: 250 },
  { title: 'Commodore',        minXP: 450 },
  { title: 'Rear Admiral',     minXP: 750 },
  { title: 'Viceroy',          minXP: 1200 },
  { title: 'Grand Admiral',    minXP: 2000 },
  { title: 'Sovereign',        minXP: 3500 },
];

/** XP weight per stat point — some actions are worth more than others */
export const STAT_XP_WEIGHTS: Record<keyof PlayerStats, number> = {
  jumps: 1,
  landings: 2,
  trades: 2,
  minerals_mined: 1,
  lore_discovered: 5,
  ships_attacked: 3,
  ships_destroyed: 5,
  stations_docked: 1,
  ruins_explored: 4,
  settlements_visited: 2,
  credits_earned: 0.01,  // lots of credits, so low weight
  crew_hired: 3,
};

// ─── NICKNAMES ─────────────────────────────────────────────
// Each nickname is tied to a "stat category" — the dominant playstyle
// determines which nickname pool is used. Multiple tiers per category
// so your nickname evolves as you lean further into a playstyle.

export type NicknameCategory =
  | 'explorer'    // jumps + landings + settlements_visited
  | 'trader'      // trades + credits_earned
  | 'warrior'     // ships_attacked + ships_destroyed
  | 'scholar'     // lore_discovered + ruins_explored
  | 'miner'       // minerals_mined
  | 'social'      // crew_hired + stations_docked
  ;

export interface NicknameEntry {
  name: string;
  minScore: number;
}

/** How to compute each category score from raw stats */
export const NICKNAME_CATEGORY_FORMULAS: Record<NicknameCategory, (s: PlayerStats) => number> = {
  explorer: (s) => s.jumps + s.landings * 2 + s.settlements_visited * 2,
  trader:   (s) => s.trades * 2 + s.credits_earned * 0.005,
  warrior:  (s) => s.ships_attacked * 2 + s.ships_destroyed * 5,
  scholar:  (s) => s.lore_discovered * 5 + s.ruins_explored * 3,
  miner:    (s) => s.minerals_mined * 2,
  social:   (s) => s.crew_hired * 3 + s.stations_docked,
};

/** Nickname pools per category — tiered so the name evolves.
 *  Player gets the highest-tier name they qualify for in their dominant category.
 *  Semi-humorous options mixed with cool ones. */
export const NICKNAME_POOLS: Record<NicknameCategory, NicknameEntry[]> = {
  explorer: [
    { name: 'Wanderer',       minScore: 0 },
    { name: 'Dusty',          minScore: 15 },
    { name: 'Restless',       minScore: 40 },
    { name: 'Crusty',         minScore: 80 },
    { name: 'Far-Flung',      minScore: 150 },
    { name: 'Starstrider',    minScore: 300 },
    { name: 'The Untethered', minScore: 600 },
  ],
  trader: [
    { name: 'Haggler',        minScore: 0 },
    { name: 'Penny-Pincher',  minScore: 15 },
    { name: 'Wheeler-Dealer', minScore: 40 },
    { name: 'Moneybags',      minScore: 80 },
    { name: 'The Merchant',   minScore: 150 },
    { name: 'Goldfinger',     minScore: 300 },
    { name: 'Tycoon',         minScore: 600 },
  ],
  warrior: [
    { name: 'Scrappy',        minScore: 0 },
    { name: 'Trigger-Happy',  minScore: 15 },
    { name: 'Evil',           minScore: 40 },
    { name: 'Brutal',         minScore: 80 },
    { name: 'Notorious',      minScore: 150 },
    { name: 'Dread',          minScore: 300 },
    { name: 'The Annihilator', minScore: 600 },
  ],
  scholar: [
    { name: 'Bookworm',       minScore: 0 },
    { name: 'Nosy',           minScore: 15 },
    { name: 'The Curious',    minScore: 40 },
    { name: 'Sage',           minScore: 80 },
    { name: 'Lorekeeper',     minScore: 150 },
    { name: 'Oracle',         minScore: 300 },
    { name: 'The Enlightened', minScore: 600 },
  ],
  miner: [
    { name: 'Pebble-Picker',  minScore: 0 },
    { name: 'Grubby',         minScore: 15 },
    { name: 'Rock-Hound',     minScore: 40 },
    { name: 'Ore-Breath',     minScore: 80 },
    { name: 'Deep Digger',    minScore: 150 },
    { name: 'Motherlode',     minScore: 300 },
    { name: 'The Excavator',  minScore: 600 },
  ],
  social: [
    { name: 'Chatty',         minScore: 0 },
    { name: 'Schmoozer',      minScore: 15 },
    { name: 'The Networker',  minScore: 40 },
    { name: 'Silver-Tongue',  minScore: 80 },
    { name: 'The Diplomat',   minScore: 150 },
    { name: 'Beloved',        minScore: 300 },
    { name: 'The Charismatic', minScore: 600 },
  ],
};

// ─── PROGRESSION FUNCTIONS ─────────────────────────────────

/** Calculate total XP from player stats */
export function calculateTotalXP(stats: PlayerStats): number {
  let total = 0;
  for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
    total += stats[key] * STAT_XP_WEIGHTS[key];
  }
  return Math.floor(total);
}

/** Get the player's current rank title */
export function getCurrentRank(stats: PlayerStats): RankTier {
  const xp = calculateTotalXP(stats);
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXP) rank = r;
  }
  return rank;
}

/** Get the next rank (or null if max) */
export function getNextRank(stats: PlayerStats): RankTier | null {
  const xp = calculateTotalXP(stats);
  for (const r of RANKS) {
    if (xp < r.minXP) return r;
  }
  return null;
}

/** Get the player's dominant category and nickname */
export function getCurrentNickname(stats: PlayerStats): { category: NicknameCategory; nickname: string } {
  // Find dominant category
  let bestCategory: NicknameCategory = 'explorer';
  let bestScore = -1;

  for (const cat of Object.keys(NICKNAME_CATEGORY_FORMULAS) as NicknameCategory[]) {
    const score = NICKNAME_CATEGORY_FORMULAS[cat](stats);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // Get highest-tier nickname in that category
  const pool = NICKNAME_POOLS[bestCategory];
  let nickname = pool[0].name;
  for (const entry of pool) {
    if (bestScore >= entry.minScore) nickname = entry.name;
  }

  return { category: bestCategory, nickname };
}

/** Build the full display title: Rank 'Nickname' Name */
export function getPlayerTitle(captainName: string, stats: PlayerStats): string {
  const rank = getCurrentRank(stats);
  const { nickname } = getCurrentNickname(stats);
  return `${rank.title} '${nickname}' ${captainName}`;
}

/** Short version for tight spaces: Rank Name */
export function getPlayerRankName(captainName: string, stats: PlayerStats): string {
  const rank = getCurrentRank(stats);
  return `${rank.title} ${captainName}`;
}
