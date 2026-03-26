import { PlayerData } from '../entities/Player';
import { StarSystemData } from '../entities/StarSystem';
import { GameState, newGame } from '../GameState';

const SAVE_KEY = 'starward_drift_save';

export interface SaveData {
  seed: number;
  player: {
    ship: PlayerData['ship'];
    credits: number;
    cargo: PlayerData['cargo'];
    currentSystemId: number;
    reputation: PlayerData['reputation'];
    discoveredSystems: number[];
    visitedSystems: number[];
    loreFragments: string[];
  };
  galaxy: StarSystemData[];
}

export function saveGame(state: GameState): void {
  const saveData: SaveData = {
    seed: state.seed,
    player: {
      ship: state.player.ship,
      credits: state.player.credits,
      cargo: state.player.cargo,
      currentSystemId: state.player.currentSystemId,
      reputation: state.player.reputation,
      discoveredSystems: Array.from(state.player.discoveredSystems),
      visitedSystems: Array.from(state.player.visitedSystems),
      loreFragments: state.player.loreFragments,
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
    state.player = {
      ...data.player,
      discoveredSystems: new Set(data.player.discoveredSystems),
      visitedSystems: new Set(data.player.visitedSystems),
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
