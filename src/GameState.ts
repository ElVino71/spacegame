import { StarSystemData } from './entities/StarSystem';
import { PlayerData, createNewPlayer } from './entities/Player';
import { generateGalaxy } from './generation/GalaxyGenerator';

export class GameState {
  seed: number;
  galaxy: StarSystemData[];
  player: PlayerData;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.galaxy = generateGalaxy(this.seed);
    this.player = createNewPlayer();
  }

  getCurrentSystem(): StarSystemData {
    return this.galaxy[this.player.currentSystemId];
  }

  discoverSystem(id: number): void {
    this.player.discoveredSystems.add(id);
    this.galaxy[id].discovered = true;
  }

  visitSystem(id: number): void {
    this.player.visitedSystems.add(id);
    this.galaxy[id].visited = true;
    this.discoverSystem(id);

    // Discover connected systems
    for (const conn of this.galaxy[id].connections) {
      this.discoverSystem(conn);
    }
  }

  jumpToSystem(targetId: number): boolean {
    const current = this.getCurrentSystem();
    if (!current.connections.includes(targetId)) return false;

    // Check fuel
    const target = this.galaxy[targetId];
    const dx = current.x - target.x;
    const dy = current.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fuelCost = dist * 0.05;

    if (this.player.ship.fuel.current < fuelCost) return false;

    this.player.ship.fuel.current -= fuelCost;
    this.player.currentSystemId = targetId;
    this.visitSystem(targetId);
    return true;
  }
}

// Singleton instance
let gameState: GameState | null = null;

export function getGameState(): GameState {
  if (!gameState) {
    gameState = new GameState();
  }
  return gameState;
}

export function newGame(seed?: number): GameState {
  gameState = new GameState(seed);
  return gameState;
}

export function setGameState(state: GameState): void {
  gameState = state;
}
