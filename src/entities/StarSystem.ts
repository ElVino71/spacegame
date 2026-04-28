import { StarType, PlanetType, EconomyType } from '../utils/Constants';

export interface GalaxyTile {
  type: 'empty' | 'nebula' | 'dust';
  factionIndex: number;
  variation: number;
}

export interface GalaxyData {
  systems: StarSystemData[];
  tiles: GalaxyTile[][];
  gridSize: number;
}

export interface StarSystemData {
  id: number;
  name: string;
  x: number;       // galaxy map position
  y: number;
  starType: StarType;
  starRadius: number;
  factionIndex: number;
  connections: number[];  // indices of connected systems
  discovered: boolean;
  visited: boolean;
  planets: PlanetData[];
  asteroidBelts: AsteroidBeltData[];
  station: StationData | null;
}

export interface PlanetData {
  id: number;
  name: string;
  type: PlanetType;
  orbitRadius: number;   // distance from star in system view
  orbitAngle: number;    // current angle (radians)
  orbitSpeed: number;    // radians per second
  size: number;          // visual radius
  landable: boolean;
  mineable: boolean;
  hasRuins: boolean;
  hasSettlement: boolean;
  atmosphere: 'none' | 'thin' | 'breathable' | 'toxic' | 'crushing';
  color: number;
  minerals: MineralDeposit[];
}

export interface MineralDeposit {
  type: string;
  amount: number;
  x: number;  // surface position
  y: number;
}

export interface AsteroidBeltData {
  orbitRadius: number;
  density: number;    // number of asteroids
  mineralRichness: number; // 0-1
}

export interface StationData {
  name: string;
  orbitRadius: number;
  orbitAngle: number;
  economy: EconomyType;
  factionIndex: number;
}
