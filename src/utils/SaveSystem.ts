import { PlayerData, DiscoveredLore } from '../entities/Player';
import { StarSystemData } from '../entities/StarSystem';
import { CrewMember } from '../entities/Character';
import { GameState, newGame } from '../GameState';
import { PlayerStats, createEmptyStats } from '../data/progression';

const SAVE_KEY = 'starward_drift_save';

export interface SaveData {
  seed: number;
  player: {
    captainName?: string;
    ship: PlayerData['ship'];
    credits: number;
    cargo: PlayerData['cargo'];
    currentSystemId: number;
    reputation: PlayerData['reputation'];
    discoveredSystems: number[];
    visitedSystems: number[];
    loreFragments: DiscoveredLore[] | string[];
    crew?: CrewMember[];
    stats?: PlayerStats;
  };
  galaxy: StarSystemData[];
}

export function saveGame(state: GameState): void {
  const saveData: SaveData = {
    seed: state.seed,
    player: {
      captainName: state.player.captainName,
      ship: state.player.ship,
      credits: state.player.credits,
      cargo: state.player.cargo,
      currentSystemId: state.player.currentSystemId,
      reputation: state.player.reputation,
      discoveredSystems: Array.from(state.player.discoveredSystems),
      visitedSystems: Array.from(state.player.visitedSystems),
      loreFragments: state.player.loreFragments,
      crew: state.player.crew || [],
      stats: state.player.stats,
    },
    galaxy: state.galaxy,
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

export function loadGame(): GameState | null {
  const rawData = localStorage.getItem(SAVE_KEY);
  if (!rawData) return null;

  try {
    const data: SaveData = JSON.parse(rawData);
    
    // Reconstruct GameState
    const state = newGame(data.seed);
    state.galaxy = data.galaxy;
    // Migrate old string[] lore to DiscoveredLore[] (old saves lose lore data)
    const rawLore = data.player.loreFragments || [];
    const loreFragments: DiscoveredLore[] = rawLore.length > 0 && typeof rawLore[0] === 'string'
      ? [] : rawLore as DiscoveredLore[];

    state.player = {
      ...data.player,
      captainName: data.player.captainName || 'Unknown',
      discoveredSystems: new Set(data.player.discoveredSystems),
      visitedSystems: new Set(data.player.visitedSystems),
      crew: data.player.crew || [],
      loreFragments,
      stats: data.player.stats || createEmptyStats(),
    };

    return state;
  } catch (e) {
    console.error('Failed to load save data:', e);
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
