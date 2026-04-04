// ─── COMBAT SYSTEM ────────────────────────────────────────
// AI-controlled ship combat engine. Both player and NPC ships are AI-driven.
// Handles maneuvers, weapon fire, projectiles, damage, shields, and flee.

import { NPCShipData } from '../entities/NPCShip';
import { ShipData } from '../entities/Ship';
import { CrewMember } from '../entities/Character';
import { getShipSpeed, getShieldCapacity, getWeaponDamageBonus } from '../entities/Player';
import {
  WeaponType, WEAPON_VISUALS, COMBAT_CONSTANTS, FLEE_CONSTANTS,
  MANEUVER_DEFS, MANEUVER_WEIGHTS, ManeuverType, NPCWeaponDef,
  COMBAT_ARENA,
} from '../data/combat';

// ─── TYPES ────────────────────────────────────────────────

export type BattleStatus = 'active' | 'player_won' | 'player_lost' | 'player_fled';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  owner: 'player' | 'enemy';
  type: WeaponType;
  lifetime: number;
}

export interface ShipManeuver {
  type: ManeuverType;
  timer: number;
  orbitAngle?: number; // for orbit maneuver
}

export interface CombatShip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  shieldRecharge: number;
  engineSpeed: number;
  evasion: number;
  weapons: CombatWeapon[];
  maneuver: ShipManeuver;
  behavior: string; // for maneuver weight selection
  damageBonus: number; // multiplier
}

export interface CombatWeapon {
  damage: number;
  fireRate: number;
  range: number;
  type: WeaponType;
  cooldown: number; // seconds until next shot
}

export interface CombatEvent {
  type: 'hit_shield' | 'hit_hull' | 'miss' | 'ship_destroyed' | 'shield_down' | 'flee_attempt' | 'flee_success' | 'flee_fail';
  x: number;
  y: number;
  target: 'player' | 'enemy';
  damage?: number;
  weaponType?: WeaponType;
}

export interface CombatState {
  player: CombatShip;
  enemy: CombatShip;
  projectiles: Projectile[];
  status: BattleStatus;
  events: CombatEvent[]; // consumed by scene each frame
  fleeAttempts: number;
  fleeCooldown: number;
  elapsed: number;
}

// ─── INITIALIZATION ───────────────────────────────────────

export function createCombatState(
  playerShip: ShipData,
  crew: CrewMember[],
  npc: NPCShipData,
): CombatState {
  const playerSpeed = getShipSpeed(playerShip, crew);
  const playerShieldMax = getShieldCapacity(playerShip);
  const damageBonus = getWeaponDamageBonus(crew);

  // Build player weapons from ship modules
  const playerWeapons: CombatWeapon[] = [];
  for (const slot of playerShip.slots) {
    if (slot.type === 'weapon' && slot.module) {
      const m = slot.module;
      const wType = guessWeaponType(m.id);
      playerWeapons.push({
        damage: m.stats.damage ?? 10,
        fireRate: m.stats.fireRate ?? 2,
        range: m.stats.range ?? 200,
        type: wType,
        cooldown: 0,
      });
    }
  }
  // Fallback if no weapons
  if (playerWeapons.length === 0) {
    playerWeapons.push({ damage: 5, fireRate: 1.5, range: 150, type: 'kinetic', cooldown: 0 });
  }

  const enemyWeapons: CombatWeapon[] = npc.weapons.map(w => ({
    ...w,
    cooldown: Math.random() * (1 / w.fireRate), // stagger initial fire
  }));

  return {
    player: {
      x: COMBAT_ARENA.playerStartX,
      y: COMBAT_ARENA.playerStartY,
      vx: 0, vy: 0,
      angle: 0,
      hull: playerShip.hull.current,
      hullMax: playerShip.hull.max,
      shield: playerShieldMax,
      shieldMax: playerShieldMax,
      shieldRecharge: getPlayerShieldRecharge(playerShip, crew),
      engineSpeed: playerSpeed,
      evasion: getPlayerEvasion(crew),
      weapons: playerWeapons,
      maneuver: { type: 'orbit', timer: 0 },
      behavior: 'player',
      damageBonus,
    },
    enemy: {
      x: COMBAT_ARENA.enemyStartX,
      y: COMBAT_ARENA.enemyStartY,
      vx: 0, vy: 0,
      angle: Math.PI,
      hull: npc.hull,
      hullMax: npc.hullMax,
      shield: npc.shieldCurrent,
      shieldMax: npc.shieldMax,
      shieldRecharge: npc.shieldRecharge,
      engineSpeed: npc.engineSpeed,
      evasion: npc.evasion,
      weapons: enemyWeapons,
      maneuver: { type: 'charge', timer: 0 },
      behavior: npc.behavior,
      damageBonus: 1,
    },
    projectiles: [],
    status: 'active',
    events: [],
    fleeAttempts: 0,
    fleeCooldown: 0,
    elapsed: 0,
  };
}

function guessWeaponType(moduleId: string): WeaponType {
  if (moduleId.includes('laser') || moduleId.includes('pulse')) return 'laser';
  if (moduleId.includes('missile') || moduleId.includes('torpedo')) return 'missile';
  if (moduleId.includes('emp') || moduleId.includes('ion')) return 'emp';
  return 'kinetic';
}

function getPlayerShieldRecharge(ship: ShipData, crew: CrewMember[]): number {
  const shield = ship.slots.find(s => s.type === 'shield' && s.module)?.module;
  const baseRecharge = shield?.stats.rechargeRate ?? 3;
  const engineer = crew.find(c => c.role === 'engineer' && (c.assignedRoom === 'shields' || c.assignedRoom === 'engine'));
  const bonus = engineer ? (engineer.stats.engineering * 0.03) : 0;
  return baseRecharge * (1 + bonus);
}

function getPlayerEvasion(crew: CrewMember[]): number {
  const pilot = crew.find(c => c.role === 'pilot' && (!c.assignedRoom || c.assignedRoom === 'bridge'));
  return pilot ? 0.1 + (pilot.stats.piloting * 0.02) : 0.1;
}

// ─── UPDATE TICK ──────────────────────────────────────────

export function updateCombat(state: CombatState, dt: number): void {
  if (state.status !== 'active') return;

  state.elapsed += dt;
  state.events = []; // clear events each tick

  // Update flee cooldown
  if (state.fleeCooldown > 0) state.fleeCooldown -= dt;

  // Update maneuvers & movement
  updateShipAI(state, state.player, state.enemy, dt);
  updateShipAI(state, state.enemy, state.player, dt);

  // Recharge shields
  rechargeShield(state.player, dt);
  rechargeShield(state.enemy, dt);

  // Fire weapons
  fireWeapons(state, state.player, state.enemy, 'player', dt);
  fireWeapons(state, state.enemy, state.player, 'enemy', dt);

  // Update projectiles
  updateProjectiles(state, dt);

  // Clamp positions to arena
  clampToArena(state.player);
  clampToArena(state.enemy);

  // Check win/lose
  if (state.enemy.hull <= 0) {
    state.status = 'player_won';
    state.events.push({ type: 'ship_destroyed', x: state.enemy.x, y: state.enemy.y, target: 'enemy' });
  } else if (state.player.hull <= 0) {
    state.status = 'player_lost';
    state.events.push({ type: 'ship_destroyed', x: state.player.x, y: state.player.y, target: 'player' });
  }
}

// ─── FLEE ─────────────────────────────────────────────────

export function attemptFlee(state: CombatState, pilotSkill: number): boolean {
  if (state.fleeCooldown > 0 || state.status !== 'active') return false;

  state.fleeAttempts++;
  const speedRatio = state.player.engineSpeed / Math.max(1, state.enemy.engineSpeed);
  const chance = Math.min(0.95, Math.max(0.05,
    FLEE_CONSTANTS.baseChance
    + speedRatio * FLEE_CONSTANTS.speedRatioMultiplier
    - (state.fleeAttempts - 1) * FLEE_CONSTANTS.penaltyPerAttempt
    + pilotSkill * FLEE_CONSTANTS.pilotSkillBonus
  ));

  const success = Math.random() < chance;

  if (success) {
    state.status = 'player_fled';
    state.events.push({ type: 'flee_success', x: state.player.x, y: state.player.y, target: 'player' });
  } else {
    state.fleeCooldown = FLEE_CONSTANTS.cooldownSeconds;
    state.events.push({ type: 'flee_fail', x: state.player.x, y: state.player.y, target: 'player' });
    // Enemy gets free shots — reduce all weapon cooldowns
    for (const w of state.enemy.weapons) {
      w.cooldown = 0;
    }
  }

  return success;
}

export function getFleeChance(state: CombatState, pilotSkill: number): number {
  const speedRatio = state.player.engineSpeed / Math.max(1, state.enemy.engineSpeed);
  return Math.min(0.95, Math.max(0.05,
    FLEE_CONSTANTS.baseChance
    + speedRatio * FLEE_CONSTANTS.speedRatioMultiplier
    - state.fleeAttempts * FLEE_CONSTANTS.penaltyPerAttempt
    + pilotSkill * FLEE_CONSTANTS.pilotSkillBonus
  ));
}

// ─── AI MANEUVER SYSTEM ───────────────────────────────────

function updateShipAI(state: CombatState, ship: CombatShip, opponent: CombatShip, dt: number): void {
  ship.maneuver.timer -= dt;

  if (ship.maneuver.timer <= 0) {
    pickManeuver(ship, opponent);
  }

  executeManeuver(ship, opponent, dt);
}

function pickManeuver(ship: CombatShip, opponent: CombatShip): void {
  const weights = MANEUVER_WEIGHTS[ship.behavior] || MANEUVER_WEIGHTS.player;
  const hullPct = ship.hull / ship.hullMax;
  const dx = opponent.x - ship.x;
  const dy = opponent.y - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Adjust weights based on situation
  const adjusted: Record<string, number> = {};
  for (const [m, w] of Object.entries(weights)) {
    let weight = w;
    if (m === 'retreat' && hullPct < 0.3) weight *= 3;
    if (m === 'evade' && hullPct < 0.5) weight *= 2;
    if (m === 'charge' && dist > 400) weight *= 2;
    if (m === 'charge' && dist < 150) weight *= 0.3;
    if (m === 'orbit' && dist < 100) weight *= 0.5;
    if (m === 'retreat' && hullPct > 0.7) weight *= 0.3;
    adjusted[m] = weight;
  }

  // Weighted random selection
  const total = Object.values(adjusted).reduce((s, v) => s + v, 0);
  let roll = Math.random() * total;
  let chosen: ManeuverType = 'orbit';
  for (const [m, w] of Object.entries(adjusted)) {
    if (roll < w) { chosen = m as ManeuverType; break; }
    roll -= w;
  }

  const def = MANEUVER_DEFS[chosen];
  ship.maneuver = {
    type: chosen,
    timer: def.duration * (0.8 + Math.random() * 0.4),
    orbitAngle: Math.random() * Math.PI * 2,
  };
}

function executeManeuver(ship: CombatShip, opponent: CombatShip, dt: number): void {
  const def = MANEUVER_DEFS[ship.maneuver.type];
  const speed = ship.engineSpeed * def.speedMultiplier;
  const turnRate = def.turnRate;

  const dx = opponent.x - ship.x;
  const dy = opponent.y - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleToOpponent = Math.atan2(dy, dx);

  let targetAngle = angleToOpponent;

  switch (ship.maneuver.type) {
    case 'orbit': {
      // Circle the opponent
      ship.maneuver.orbitAngle = (ship.maneuver.orbitAngle ?? 0) + dt * 1.2;
      const orbitDist = 180;
      const orbitX = opponent.x + Math.cos(ship.maneuver.orbitAngle) * orbitDist;
      const orbitY = opponent.y + Math.sin(ship.maneuver.orbitAngle) * orbitDist;
      targetAngle = Math.atan2(orbitY - ship.y, orbitX - ship.x);
      break;
    }
    case 'charge':
      targetAngle = angleToOpponent;
      break;
    case 'strafe': {
      // Move perpendicular while facing opponent
      const perpAngle = angleToOpponent + (Math.sin(ship.maneuver.orbitAngle ?? 0) > 0 ? Math.PI / 2 : -Math.PI / 2);
      ship.maneuver.orbitAngle = (ship.maneuver.orbitAngle ?? 0) + dt * 0.8;
      targetAngle = perpAngle;
      break;
    }
    case 'retreat':
      targetAngle = angleToOpponent + Math.PI; // away from opponent
      break;
    case 'evade': {
      // Zigzag away
      const zigzag = Math.sin(ship.maneuver.orbitAngle ?? 0) * Math.PI / 3;
      ship.maneuver.orbitAngle = (ship.maneuver.orbitAngle ?? 0) + dt * 5;
      targetAngle = angleToOpponent + Math.PI + zigzag;
      break;
    }
  }

  // Smooth rotation
  let angleDiff = targetAngle - ship.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);

  // Accelerate in facing direction
  const accel = speed * 2;
  ship.vx += Math.cos(ship.angle) * accel * dt;
  ship.vy += Math.sin(ship.angle) * accel * dt;

  // Clamp speed
  const currentSpeed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
  if (currentSpeed > speed) {
    ship.vx = (ship.vx / currentSpeed) * speed;
    ship.vy = (ship.vy / currentSpeed) * speed;
  }

  // Apply drag
  ship.vx *= 0.98;
  ship.vy *= 0.98;

  // Move
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}

function clampToArena(ship: CombatShip): void {
  // Soft circular boundary — ships decelerate smoothly as they approach the edge
  // so they never visibly "bump" anything
  const cx = COMBAT_ARENA.width / 2;
  const cy = COMBAT_ARENA.height / 2;
  const radius = 280;
  const softZone = 120; // wide deceleration zone for very gradual slowdown

  const dx = ship.x - cx;
  const dy = ship.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > radius - softZone && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;

    // How deep into the soft zone (0 = just entered, 1 = at boundary)
    const t = Math.min(1, (dist - (radius - softZone)) / softZone);

    // 1) Kill outward velocity component — stronger the closer to edge
    const outwardSpeed = ship.vx * nx + ship.vy * ny; // dot product
    if (outwardSpeed > 0) {
      // Dampen outward velocity: at t=0 remove 30%, at t=1 remove 100%
      const dampen = 0.3 + t * 0.7;
      ship.vx -= nx * outwardSpeed * dampen;
      ship.vy -= ny * outwardSpeed * dampen;
    }

    // 2) Gentle inward drift so ships ease back toward center
    const pullStrength = t * t * 80; // quadratic ramp — subtle near inner edge, firm near outer
    ship.vx -= nx * pullStrength * 0.016;
    ship.vy -= ny * pullStrength * 0.016;

    // 3) Safety clamp (should rarely trigger now)
    if (dist > radius) {
      ship.x = cx + nx * radius;
      ship.y = cy + ny * radius;
    }
  }
}

// ─── WEAPONS ──────────────────────────────────────────────

function fireWeapons(state: CombatState, ship: CombatShip, target: CombatShip, owner: 'player' | 'enemy', dt: number): void {
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  for (const weapon of ship.weapons) {
    weapon.cooldown -= dt;
    if (weapon.cooldown <= 0 && dist <= weapon.range) {
      weapon.cooldown = 1 / weapon.fireRate;

      const visual = WEAPON_VISUALS[weapon.type];
      const angleToTarget = Math.atan2(dy, dx);
      // Add slight inaccuracy
      const spread = 0.08;
      const fireAngle = angleToTarget + (Math.random() - 0.5) * spread;

      state.projectiles.push({
        x: ship.x + Math.cos(ship.angle) * 15,
        y: ship.y + Math.sin(ship.angle) * 15,
        vx: Math.cos(fireAngle) * visual.projectileSpeed,
        vy: Math.sin(fireAngle) * visual.projectileSpeed,
        damage: weapon.damage * ship.damageBonus,
        owner,
        type: weapon.type,
        lifetime: 2.0,
      });
    }
  }
}

// ─── PROJECTILES ──────────────────────────────────────────

function updateProjectiles(state: CombatState, dt: number): void {
  const hitRadius = 20;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.lifetime -= dt;

    if (p.lifetime <= 0 || p.x < -50 || p.x > COMBAT_ARENA.width + 50 || p.y < -50 || p.y > COMBAT_ARENA.height + 50) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Check hit
    const target = p.owner === 'player' ? state.enemy : state.player;
    const targetLabel: 'player' | 'enemy' = p.owner === 'player' ? 'enemy' : 'player';
    const tdx = p.x - target.x;
    const tdy = p.y - target.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

    if (tdist < hitRadius) {
      // Accuracy/evasion check
      const targetSpeed = Math.sqrt(target.vx * target.vx + target.vy * target.vy);
      const accuracy = COMBAT_CONSTANTS.baseAccuracy
        - tdist * COMBAT_CONSTANTS.accuracyDistanceFalloff
        - targetSpeed * COMBAT_CONSTANTS.accuracySpeedPenalty;
      const hitChance = accuracy * (1 - target.evasion);

      if (Math.random() < hitChance) {
        applyDamage(state, target, targetLabel, p.damage, p.type);
      } else {
        state.events.push({ type: 'miss', x: p.x, y: p.y, target: targetLabel, weaponType: p.type });
      }

      state.projectiles.splice(i, 1);
    }
  }
}

function applyDamage(state: CombatState, target: CombatShip, targetLabel: 'player' | 'enemy', damage: number, weaponType: WeaponType): void {
  let remainingDamage = damage;

  if (target.shield > 0) {
    let shieldDamage = remainingDamage;

    // EMP bypasses shields
    if (weaponType === 'emp') {
      shieldDamage = remainingDamage * (1 - COMBAT_CONSTANTS.empShieldBypass);
      const bypassDamage = remainingDamage * COMBAT_CONSTANTS.empShieldBypass;
      target.hull = Math.max(0, target.hull - bypassDamage);
    }

    // Missiles do bonus to shields
    if (weaponType === 'missile') {
      shieldDamage *= (1 + COMBAT_CONSTANTS.missileShieldBonus);
    }

    const absorbed = Math.min(target.shield, shieldDamage);
    target.shield -= absorbed;
    remainingDamage = shieldDamage - absorbed;

    if (target.shield <= 0) {
      target.shield = 0;
      state.events.push({ type: 'shield_down', x: target.x, y: target.y, target: targetLabel });
    }

    if (absorbed > 0) {
      state.events.push({ type: 'hit_shield', x: target.x, y: target.y, target: targetLabel, damage: absorbed, weaponType });
    }
  }

  if (remainingDamage > 0 && weaponType !== 'emp') {
    target.hull = Math.max(0, target.hull - remainingDamage);
    state.events.push({ type: 'hit_hull', x: target.x, y: target.y, target: targetLabel, damage: remainingDamage, weaponType });
  }
}

function rechargeShield(ship: CombatShip, dt: number): void {
  if (ship.shield < ship.shieldMax) {
    ship.shield = Math.min(ship.shieldMax, ship.shield + ship.shieldRecharge * dt);
  }
}
