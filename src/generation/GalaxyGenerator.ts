import { SeededRandom } from '../utils/SeededRandom';
import { StarSystemData } from '../entities/StarSystem';
import { GALAXY_SIZE, GALAXY_BOUNDS, STAR_TYPES, StarType, COLORS } from '../utils/Constants';
import { generateSystemName } from './NameGenerator';
import { generateSystem } from './SystemGenerator';

interface Point { x: number; y: number; }

/**
 * Poisson disk sampling for natural-looking star placement.
 */
function poissonDiskSample(rng: SeededRandom, width: number, height: number, minDist: number, maxAttempts: number = 30): Point[] {
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid: (Point | null)[] = new Array(gridW * gridH).fill(null);
  const points: Point[] = [];
  const active: Point[] = [];

  function gridIndex(x: number, y: number): number {
    return Math.floor(y / cellSize) * gridW + Math.floor(x / cellSize);
  }

  // Start with a random point
  const start: Point = { x: rng.float(0, width), y: rng.float(0, height) };
  points.push(start);
  active.push(start);
  grid[gridIndex(start.x, start.y)] = start;

  while (active.length > 0 && points.length < GALAXY_SIZE) {
    const idx = Math.floor(rng.next() * active.length);
    const point = active[idx];
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rng.float(0, Math.PI * 2);
      const dist = rng.float(minDist, minDist * 2);
      const nx = point.x + Math.cos(angle) * dist;
      const ny = point.y + Math.sin(angle) * dist;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const gi = gridIndex(nx, ny);
      const gx = Math.floor(nx / cellSize);
      const gy = Math.floor(ny / cellSize);

      let tooClose = false;
      for (let dy = -2; dy <= 2 && !tooClose; dy++) {
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          const cx = gx + dx;
          const cy = gy + dy;
          if (cx < 0 || cx >= gridW || cy < 0 || cy >= gridH) continue;
          const neighbor = grid[cy * gridW + cx];
          if (neighbor) {
            const ddx = neighbor.x - nx;
            const ddy = neighbor.y - ny;
            if (ddx * ddx + ddy * ddy < minDist * minDist) {
              tooClose = true;
            }
          }
        }
      }

      if (!tooClose) {
        const np: Point = { x: nx, y: ny };
        points.push(np);
        active.push(np);
        grid[gi] = np;
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return points;
}

/**
 * Connect nearby systems using a distance threshold approach.
 * Each system connects to its closest neighbours within range.
 */
function buildConnections(systems: StarSystemData[], maxDist: number): void {
  for (let i = 0; i < systems.length; i++) {
    const a = systems[i];
    const nearby: { index: number; dist: number }[] = [];

    for (let j = 0; j < systems.length; j++) {
      if (i === j) continue;
      const b = systems[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        nearby.push({ index: j, dist });
      }
    }

    // Sort by distance and keep closest 3-6
    nearby.sort((a, b) => a.dist - b.dist);
    const keep = Math.min(nearby.length, 3 + Math.floor(nearby.length * 0.2));
    for (let k = 0; k < keep; k++) {
      const j = nearby[k].index;
      if (!a.connections.includes(j)) a.connections.push(j);
      if (!systems[j].connections.includes(i)) systems[j].connections.push(i);
    }
  }
}

/**
 * Assign factions to systems based on region seeds.
 */
function assignFactions(systems: StarSystemData[], rng: SeededRandom, factionCount: number): void {
  // Pick faction home systems spread across galaxy
  const homes: number[] = [];
  const step = Math.floor(systems.length / factionCount);
  for (let f = 0; f < factionCount; f++) {
    homes.push(f * step);
  }

  // Flood fill from homes
  const assigned = new Set<number>();
  const queue: { systemIdx: number; factionIdx: number; depth: number }[] = [];

  for (let f = 0; f < homes.length; f++) {
    queue.push({ systemIdx: homes[f], factionIdx: f, depth: 0 });
  }

  // BFS with random priority
  while (queue.length > 0) {
    // Pick randomly from front portion for organic borders
    const pickRange = Math.min(queue.length, 5);
    const pickIdx = Math.floor(rng.next() * pickRange);
    const { systemIdx, factionIdx, depth } = queue.splice(pickIdx, 1)[0];

    if (assigned.has(systemIdx)) continue;
    assigned.add(systemIdx);
    systems[systemIdx].factionIndex = factionIdx;

    for (const conn of systems[systemIdx].connections) {
      if (!assigned.has(conn)) {
        queue.push({ systemIdx: conn, factionIdx, depth: depth + 1 });
      }
    }
  }

  // Any unassigned become independent (faction 5)
  for (const sys of systems) {
    if (sys.factionIndex === -1) sys.factionIndex = factionCount - 1;
  }
}

function pickStarType(rng: SeededRandom, distFromCenter: number): StarType {
  // Hotter/rarer stars more likely near center
  const centerBias = 1 - distFromCenter;
  const weights = [
    0.02 + centerBias * 0.05,  // O - very rare
    0.05 + centerBias * 0.08,  // B
    0.10 + centerBias * 0.05,  // A
    0.15,                       // F
    0.25,                       // G
    0.25,                       // K
    0.30 - centerBias * 0.10,  // M - most common
  ];
  return rng.weighted([...STAR_TYPES], weights);
}

export function generateGalaxy(seed: number): StarSystemData[] {
  const rng = new SeededRandom(seed);

  // Generate star positions
  const minDist = GALAXY_BOUNDS / Math.sqrt(GALAXY_SIZE) * 0.8;
  const points = poissonDiskSample(rng, GALAXY_BOUNDS, GALAXY_BOUNDS, minDist);

  // Center the galaxy around 0,0
  const halfBounds = GALAXY_BOUNDS / 2;

  // Create system data
  const systems: StarSystemData[] = points.map((p, i) => {
    const x = p.x - halfBounds;
    const y = p.y - halfBounds;
    const distFromCenter = Math.sqrt(x * x + y * y) / halfBounds;
    const sysRng = rng.fork(i);
    const starType = pickStarType(sysRng, distFromCenter);
    const starRadii: Record<StarType, number> = { O: 30, B: 25, A: 20, F: 18, G: 16, K: 14, M: 12 };

    return {
      id: i,
      name: generateSystemName(sysRng),
      x,
      y,
      starType,
      starRadius: starRadii[starType],
      factionIndex: -1,
      connections: [],
      discovered: false,
      visited: false,
      planets: [],
      asteroidBelts: [],
      station: null,
    };
  });

  // Build jump lane connections
  buildConnections(systems, minDist * 2.5);

  // Assign factions
  assignFactions(systems, rng, 6);

  // Generate system contents (planets, stations, etc.)
  for (let i = 0; i < systems.length; i++) {
    const sysRng = rng.fork(i + 10000);
    generateSystem(systems[i], sysRng);
  }

  // Mark starting system
  systems[0].discovered = true;
  systems[0].visited = true;

  // Discover neighbours of starting system
  for (const conn of systems[0].connections) {
    systems[conn].discovered = true;
  }

  return systems;
}
