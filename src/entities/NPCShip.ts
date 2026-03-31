import { SeededRandom } from '../utils/SeededRandom';
import { StarSystemData } from './StarSystem';


export type NPCBehavior = 'patrol' | 'trader' | 'pirate';

export interface NPCShipData {
  id: number;
  name: string;
  shipClass: string;
  factionIndex: number;
  behavior: NPCBehavior;

  // Position & movement
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;

  // AI state
  targetX: number;
  targetY: number;
  waitTimer: number;       // seconds to idle at a waypoint
  aggroRange: number;      // how close before pirate engages
  hailed: boolean;         // already triggered proximity chatter this encounter
}

// Simple NPC name generator
const NPC_SHIP_PREFIXES = ['ISS', 'CSV', 'HMS', 'KCS', 'VRS', 'SS'];
const NPC_SHIP_NAMES = [
  'Wanderer', 'Horizon', 'Defiant', 'Serenity', 'Marauder', 'Prospector',
  'Sentinel', 'Nomad', 'Raptor', 'Falcon', 'Corsair', 'Pilgrim',
  'Spectre', 'Vanguard', 'Drifter', 'Stalker', 'Pathfinder', 'Recluse',
  'Tempest', 'Harbinger', 'Vagrant', 'Eclipse', 'Phantom', 'Reaver',
];

/** Generate NPC ships for a star system, seeded deterministically */
export function generateNPCShips(system: StarSystemData, galaxySeed: number): NPCShipData[] {
  const rng = new SeededRandom(galaxySeed).fork(system.id * 7919);
  const ships: NPCShipData[] = [];

  // Number of ships: 0-4, more likely in systems with stations
  const hasStation = system.station !== null;
  const maxShips = hasStation ? 4 : 2;
  const count = rng.int(hasStation ? 1 : 0, maxShips);

  for (let i = 0; i < count; i++) {
    const shipRng = rng.fork(i * 3571);

    // Determine behavior — pirates more common in low-faction or independent systems
    const isIndependent = system.factionIndex === 5;
    let behavior: NPCBehavior;
    const roll = shipRng.next();
    if (roll < (isIndependent ? 0.4 : 0.15)) {
      behavior = 'pirate';
    } else if (roll < (hasStation ? 0.7 : 0.4)) {
      behavior = 'trader';
    } else {
      behavior = 'patrol';
    }

    // Faction: pirates are often independent or Void Runners, others match system
    let factionIndex = system.factionIndex;
    if (behavior === 'pirate') {
      factionIndex = shipRng.chance(0.5) ? 4 : 5; // Void Runners or Independent
    }

    // Ship class based on behavior
    const classOptions = behavior === 'pirate'
      ? ['scout', 'corvette', 'gunship']
      : behavior === 'trader'
        ? ['freighter', 'scout']
        : ['corvette', 'scout', 'explorer'];
    const shipClass = shipRng.pick(classOptions);

    // Name
    const prefix = NPC_SHIP_PREFIXES[factionIndex] || 'SS';
    const name = `${prefix} ${shipRng.pick(NPC_SHIP_NAMES)}`;

    // Speed based on class
    const baseSpeed = shipClass === 'freighter' ? 40 : shipClass === 'gunship' ? 55 : 60;
    const speed = baseSpeed + shipRng.float(-10, 10);

    // Spawn position — orbit around a random point in the system
    const maxOrbit = Math.max(500, ...system.planets.map(p => p.orbitRadius + 100));
    const spawnAngle = shipRng.float(0, Math.PI * 2);
    const spawnRadius = shipRng.float(200, maxOrbit);
    const x = Math.cos(spawnAngle) * spawnRadius;
    const y = Math.sin(spawnAngle) * spawnRadius;

    // Initial target — pick a random point to head toward
    const targetAngle = shipRng.float(0, Math.PI * 2);
    const targetRadius = shipRng.float(150, maxOrbit);

    ships.push({
      id: i,
      name,
      shipClass,
      factionIndex,
      behavior,
      x, y,
      angle: spawnAngle + Math.PI, // face inward
      vx: 0, vy: 0,
      speed,
      targetX: Math.cos(targetAngle) * targetRadius,
      targetY: Math.sin(targetAngle) * targetRadius,
      waitTimer: 0,
      aggroRange: behavior === 'pirate' ? 250 : 0,
      hailed: false,
    });
  }

  return ships;
}

/** Pick a new random waypoint for an NPC ship */
export function pickNewWaypoint(ship: NPCShipData, system: StarSystemData, rng: SeededRandom): void {
  const maxOrbit = Math.max(500, ...system.planets.map(p => p.orbitRadius + 100));

  if (ship.behavior === 'trader' && system.station) {
    // Traders move between station and planets
    if (rng.chance(0.5) && system.planets.length > 0) {
      const planet = rng.pick(system.planets);
      const px = Math.cos(planet.orbitAngle) * planet.orbitRadius;
      const py = Math.sin(planet.orbitAngle) * planet.orbitRadius;
      ship.targetX = px + rng.float(-40, 40);
      ship.targetY = py + rng.float(-40, 40);
    } else {
      const st = system.station;
      const sx = Math.cos(st.orbitAngle) * st.orbitRadius;
      const sy = Math.sin(st.orbitAngle) * st.orbitRadius;
      ship.targetX = sx + rng.float(-30, 30);
      ship.targetY = sy + rng.float(-30, 30);
    }
  } else if (ship.behavior === 'patrol') {
    // Patrol in a wide arc
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(200, maxOrbit);
    ship.targetX = Math.cos(angle) * radius;
    ship.targetY = Math.sin(angle) * radius;
  } else {
    // Pirates lurk in asteroid belts or outer system
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(maxOrbit * 0.5, maxOrbit);
    ship.targetX = Math.cos(angle) * radius;
    ship.targetY = Math.sin(angle) * radius;
  }

  ship.waitTimer = rng.float(2, 6);
}

/** Update NPC ship AI and movement for one frame */
export function updateNPCShip(
  ship: NPCShipData,
  dt: number,
  playerX: number,
  playerY: number,
  system: StarSystemData,
  rng: SeededRandom,
): void {
  // Pirates: check if player is in aggro range
  let tx = ship.targetX;
  let ty = ship.targetY;

  if (ship.behavior === 'pirate') {
    const dxp = playerX - ship.x;
    const dyp = playerY - ship.y;
    const distToPlayer = Math.sqrt(dxp * dxp + dyp * dyp);
    if (distToPlayer < ship.aggroRange) {
      // Chase the player
      tx = playerX;
      ty = playerY;
    }
  }

  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 30) {
    // Arrived at waypoint — wait, then pick new one
    ship.waitTimer -= dt;
    ship.vx *= 0.95;
    ship.vy *= 0.95;
    if (ship.waitTimer <= 0) {
      pickNewWaypoint(ship, system, rng);
    }
  } else {
    // Steer toward target
    const targetAngle = Math.atan2(dy, dx);

    // Smooth rotation toward target
    let angleDiff = targetAngle - ship.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.5 * dt);

    // Accelerate
    const accel = ship.speed * 0.8;
    ship.vx += Math.cos(ship.angle) * accel * dt;
    ship.vy += Math.sin(ship.angle) * accel * dt;

    // Clamp speed
    const currentSpeed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (currentSpeed > ship.speed) {
      ship.vx = (ship.vx / currentSpeed) * ship.speed;
      ship.vy = (ship.vy / currentSpeed) * ship.speed;
    }
  }

  // Apply drag
  ship.vx *= 0.99;
  ship.vy *= 0.99;

  // Move
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}
