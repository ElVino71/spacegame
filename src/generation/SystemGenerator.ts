import { SeededRandom } from '../utils/SeededRandom';
import { StarSystemData, PlanetData, AsteroidBeltData, StationData } from '../entities/StarSystem';
import { PlanetType, ECONOMY_TYPES } from '../utils/Constants';
import { generatePlanetName, generateStationName } from './NameGenerator';

const PLANET_COLORS: Record<PlanetType, number[]> = {
  rocky:       [0x888888, 0x996644, 0xaa8866, 0x776655],
  desert:      [0xddaa55, 0xcc9944, 0xbb8833, 0xeebb66],
  ice:         [0xaaddff, 0x88bbdd, 0xcceeff, 0x99ccee],
  lush:        [0x44aa44, 0x338833, 0x55bb55, 0x66cc66],
  volcanic:    [0xcc4422, 0xdd5533, 0xaa3311, 0xff6644],
  gas_giant:   [0xddaa77, 0xcc8855, 0xee9966, 0xbb7744],
  ocean:       [0x2266aa, 0x3377bb, 0x1155aa, 0x4488cc],
  barren_moon: [0x666666, 0x777777, 0x555555, 0x888888],
};

interface PlanetTypeConfig {
  type: PlanetType;
  landable: boolean;
  mineable: boolean;
  atmospheres: ('none' | 'thin' | 'breathable' | 'toxic' | 'crushing')[];
  ruinChance: number;
  settlementChance: number;
  minSize: number;
  maxSize: number;
}

const PLANET_CONFIGS: PlanetTypeConfig[] = [
  { type: 'rocky',       landable: true,  mineable: true,  atmospheres: ['none', 'thin'],                   ruinChance: 0.3,  settlementChance: 0.2, minSize: 8,  maxSize: 16 },
  { type: 'desert',      landable: true,  mineable: true,  atmospheres: ['thin', 'none'],                   ruinChance: 0.35, settlementChance: 0.15, minSize: 10, maxSize: 18 },
  { type: 'ice',         landable: true,  mineable: true,  atmospheres: ['none', 'thin'],                   ruinChance: 0.25, settlementChance: 0.1, minSize: 8,  maxSize: 15 },
  { type: 'lush',        landable: true,  mineable: false, atmospheres: ['breathable'],                     ruinChance: 0.2,  settlementChance: 0.6, minSize: 12, maxSize: 22 },
  { type: 'volcanic',    landable: true,  mineable: true,  atmospheres: ['toxic', 'thin'],                  ruinChance: 0.15, settlementChance: 0.05, minSize: 10, maxSize: 18 },
  { type: 'gas_giant',   landable: false, mineable: true,  atmospheres: ['crushing'],                       ruinChance: 0,    settlementChance: 0,   minSize: 25, maxSize: 45 },
  { type: 'ocean',       landable: true,  mineable: false, atmospheres: ['breathable', 'thin'],             ruinChance: 0.2,  settlementChance: 0.3, minSize: 14, maxSize: 24 },
  { type: 'barren_moon', landable: true,  mineable: true,  atmospheres: ['none'],                           ruinChance: 0.2,  settlementChance: 0.05, minSize: 5,  maxSize: 10 },
];

const MINERAL_TYPES = ['Iron', 'Copper', 'Titanium', 'Platinum', 'Crystals', 'Uranium', 'Helium-3', 'Rare Earth'];

function pickPlanetType(rng: SeededRandom, orbitIndex: number, totalOrbits: number): PlanetTypeConfig {
  // Inner orbits: rocky/desert/volcanic. Middle: lush/ocean. Outer: ice/gas_giant/barren
  const position = orbitIndex / totalOrbits;

  let weights: number[];
  if (position < 0.3) {
    // Inner
    weights = [0.3, 0.25, 0.05, 0.05, 0.25, 0.0, 0.05, 0.05];
  } else if (position < 0.6) {
    // Middle - habitable zone
    weights = [0.15, 0.1, 0.05, 0.3, 0.05, 0.1, 0.2, 0.05];
  } else {
    // Outer
    weights = [0.05, 0.05, 0.25, 0.0, 0.0, 0.35, 0.0, 0.3];
  }

  return rng.weighted(PLANET_CONFIGS, weights);
}

function generateMinerals(rng: SeededRandom, planet: PlanetTypeConfig): PlanetData['minerals'] {
  if (!planet.mineable) return [];

  const count = rng.int(1, 4);
  const minerals: PlanetData['minerals'] = [];

  for (let i = 0; i < count; i++) {
    minerals.push({
      type: rng.pick(MINERAL_TYPES),
      amount: rng.int(10, 100),
      x: rng.float(0, 1), // normalized position, placed on actual surface map later
      y: rng.float(0, 1),
    });
  }

  return minerals;
}

export function generateSystem(system: StarSystemData, rng: SeededRandom): void {
  // Number of planets based on star type
  const planetCounts: Record<string, [number, number]> = {
    O: [1, 3], B: [1, 4], A: [2, 5], F: [2, 6],
    G: [3, 7], K: [2, 6], M: [1, 4],
  };

  const [minP, maxP] = planetCounts[system.starType] ?? [2, 5];
  const numPlanets = rng.int(minP, maxP);

  // Generate planets
  let orbitRadius = rng.float(150, 250);
  for (let i = 0; i < numPlanets; i++) {
    const config = pickPlanetType(rng, i, numPlanets);
    const size = rng.int(config.minSize, config.maxSize);

    const planet: PlanetData = {
      id: i,
      name: generatePlanetName(system.name, i, rng),
      type: config.type,
      orbitRadius,
      orbitAngle: rng.float(0, Math.PI * 2),
      orbitSpeed: rng.float(0.02, 0.08) / (1 + i * 0.3), // outer planets orbit slower
      size,
      landable: config.landable,
      mineable: config.mineable,
      hasRuins: rng.chance(config.ruinChance),
      hasSettlement: rng.chance(config.settlementChance),
      atmosphere: rng.pick(config.atmospheres),
      color: rng.pick(PLANET_COLORS[config.type]),
      minerals: generateMinerals(rng, config),
    };

    system.planets.push(planet);
    orbitRadius += rng.float(120, 250) + size * 3;
  }

  // Asteroid belts (0-2)
  const numBelts = rng.int(0, 2);
  for (let i = 0; i < numBelts; i++) {
    system.asteroidBelts.push({
      orbitRadius: rng.float(200, orbitRadius * 0.8),
      density: rng.int(15, 40),
      mineralRichness: rng.float(0.3, 1.0),
    });
  }

  // Station (60% chance)
  if (rng.chance(0.6)) {
    const stationOrbit = system.planets.length > 0
      ? system.planets[rng.int(0, system.planets.length - 1)].orbitRadius + 40
      : rng.float(200, 400);

    system.station = {
      name: generateStationName(system.name, rng),
      orbitRadius: stationOrbit,
      orbitAngle: rng.float(0, Math.PI * 2),
      economy: rng.pick([...ECONOMY_TYPES]),
      factionIndex: system.factionIndex,
    };
  }
}
