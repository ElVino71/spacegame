// ─── RUINS DATA ────────────────────────────────────────
// Lore fragments, trap types, encounter types, and loot tables for ruins exploration.

// ─── Lore Fragments ────────────────────────────────────
// Each ruin has a seeded selection of lore entries. Discovering all fragments
// across multiple ruins builds up the precursor story in the codex.

export interface LoreFragment {
  id: string;
  title: string;
  text: string;
  category: 'history' | 'technology' | 'warning' | 'poetry' | 'record';
}

export const LORE_FRAGMENTS: LoreFragment[] = [
  // History
  { id: 'lore_h1', title: 'The Builders', category: 'history',
    text: 'We came from the third star. We built across a thousand worlds. We were the Architects of the Lattice.' },
  { id: 'lore_h2', title: 'The Great Network', category: 'history',
    text: 'Each node connected to the next through fold-space anchors. A galaxy linked in an instant. We called it the Lattice.' },
  { id: 'lore_h3', title: 'The Sundering', category: 'history',
    text: 'The Lattice collapsed in a single pulse. Every anchor burned simultaneously. Billions were stranded between stars.' },
  { id: 'lore_h4', title: 'The Exodus', category: 'history',
    text: 'Those who survived fled to the edges. They buried what they could not carry. They sealed what they could not destroy.' },
  { id: 'lore_h5', title: 'The Silence', category: 'history',
    text: 'After the Sundering, no signal crossed the void for ten thousand years. The galaxy forgot us. Perhaps that was wise.' },
  { id: 'lore_h6', title: 'First Contact', category: 'history',
    text: 'We were not alone. They came from the dark between galaxies. They did not speak. They consumed.' },

  // Technology
  { id: 'lore_t1', title: 'Fold-Space Mechanics', category: 'technology',
    text: 'The anchors bent space through crystalline resonance. A perfect lattice of atoms, vibrating at frequencies that tore reality open.' },
  { id: 'lore_t2', title: 'The Living Machines', category: 'technology',
    text: 'Our greatest achievement: engines that grew, healed, and evolved. They required no fuel — only purpose.' },
  { id: 'lore_t3', title: 'Guardian Protocol', category: 'technology',
    text: 'We left sentinels to guard our vaults. Simple minds, but relentless. They will not distinguish friend from foe.' },
  { id: 'lore_t4', title: 'Energy Lattice', category: 'technology',
    text: 'Power drawn from the stars themselves, channeled through subspace conduits. An inexhaustible river of energy — until it wasn\'t.' },

  // Warnings
  { id: 'lore_w1', title: 'Do Not Open', category: 'warning',
    text: 'SEALED BY ORDER OF THE COUNCIL. What lies beneath must not be awakened. If you read this, leave. Now.' },
  { id: 'lore_w2', title: 'The Watchers', category: 'warning',
    text: 'They see through the walls. They hear through the stone. If you have come this far, they already know.' },
  { id: 'lore_w3', title: 'Contamination Notice', category: 'warning',
    text: 'WARNING: Bioactive residue detected. The organisms here adapt to threats. Prolonged exposure is inadvisable.' },
  { id: 'lore_w4', title: 'Final Warning', category: 'warning',
    text: 'The deeper chambers contain resonance amplifiers. Activating them will draw attention from things best left undisturbed.' },

  // Poetry/cultural
  { id: 'lore_p1', title: 'Song of the Void', category: 'poetry',
    text: 'Between the stars we danced / On bridges made of light / Until the dark reached up / And swallowed every night.' },
  { id: 'lore_p2', title: 'The Gardener\'s Lament', category: 'poetry',
    text: 'I planted seeds on barren worlds / And watched them reach for suns / That burned too bright, too fast, too far / My garden comes undone.' },

  // Records
  { id: 'lore_r1', title: 'Supply Manifest', category: 'record',
    text: 'Received: 400 units crystalline substrate. Shipped: 12 guardian cores. Note: production falling behind. Workers report nightmares.' },
  { id: 'lore_r2', title: 'Research Log 7', category: 'record',
    text: 'Subject continues to phase in and out of local spacetime. Containment field holds but fluctuates. Recommend termination of experiment.' },
  { id: 'lore_r3', title: 'Distress Signal', category: 'record',
    text: 'To any vessel: Anchor 7719 has destabilized. Evacuate sector. Do not attempt repair. The resonance is... wrong.' },
  { id: 'lore_r4', title: 'Last Entry', category: 'record',
    text: 'The doors are sealed. Power is failing. If anyone finds this, know that we tried. We tried so hard. Tell them we were sorry.' },
];

// ─── Trap Types ────────────────────────────────────────

export interface TrapType {
  id: string;
  name: string;
  damage: number; // hull damage (as suit damage)
  description: string;
  triggerText: string;
}

export const TRAP_TYPES: TrapType[] = [
  { id: 'pressure_plate', name: 'Pressure Plate', damage: 5,
    description: 'A concealed pressure-sensitive tile.',
    triggerText: 'A hidden mechanism clicks beneath your feet! Darts fire from the walls!' },
  { id: 'gas_vent', name: 'Gas Vent', damage: 8,
    description: 'Corroded pipes leaking toxic gas.',
    triggerText: 'Toxic gas erupts from vents in the floor! Your suit filters struggle to compensate!' },
  { id: 'energy_discharge', name: 'Energy Discharge', damage: 10,
    description: 'An ancient energy conduit that arcs when disturbed.',
    triggerText: 'An arc of crackling energy leaps from the walls! Your suit absorbs the shock!' },
  { id: 'pit_trap', name: 'Pit Trap', damage: 12,
    description: 'A false floor concealing a deep shaft.',
    triggerText: 'The floor gives way! You tumble into a shallow pit before catching yourself!' },
  { id: 'guardian_beam', name: 'Guardian Beam', damage: 15,
    description: 'A still-active security laser grid.',
    triggerText: 'A beam of intense light sweeps across the corridor! Your suit\'s plating scorches!' },
];

// ─── Encounter Types ───────────────────────────────────

export interface EncounterType {
  id: string;
  name: string;
  damage: number; // damage if you fight
  description: string;
  fightText: string;
  fleeText: string;
  reward?: { type: 'credits' | 'item'; value: number; name?: string };
}

export const ENCOUNTER_TYPES: EncounterType[] = [
  { id: 'guardian_drone', name: 'Guardian Drone', damage: 10,
    description: 'A hovering sentinel, still patrolling after millennia.',
    fightText: 'The drone fires a burst of energy! You take cover and return fire, disabling it.',
    fleeText: 'You duck back around the corner as the drone\'s searchlight sweeps past.',
    reward: { type: 'credits', value: 100 } },
  { id: 'crystal_spider', name: 'Crystal Spider', damage: 8,
    description: 'A biomechanical construct that skitters across the walls.',
    fightText: 'The spider leaps! You dodge and crush it underfoot. Crystalline fragments scatter.',
    fleeText: 'You back away slowly as the spider clicks its mandibles, retreating to its web.',
    reward: { type: 'credits', value: 75 } },
  { id: 'shadow_wraith', name: 'Shadow Wraith', damage: 15,
    description: 'A dark shape that phases through walls, drawn to warmth.',
    fightText: 'The wraith shrieks as your suit light intensifies! It dissolves into wisps of shadow.',
    fleeText: 'You sprint back the way you came as the temperature drops around you.',
    reward: { type: 'credits', value: 150 } },
  { id: 'ruin_swarm', name: 'Nano-Swarm', damage: 12,
    description: 'A cloud of ancient nanobots, still following their last directive.',
    fightText: 'You activate your suit\'s EM pulse, disrupting the swarm. Dead nanobots rain down like dust.',
    fleeText: 'The swarm drifts past, following currents you can\'t see. You slip away unnoticed.',
    reward: { type: 'credits', value: 120 } },
  { id: 'stone_sentinel', name: 'Stone Sentinel', damage: 20,
    description: 'A massive golem of carved rock, awakened by your presence.',
    fightText: 'The sentinel swings! You dodge and find a weak point in its chest rune, shattering it.',
    fleeText: 'You run as the floor shakes with each of its thunderous steps, barely escaping.',
    reward: { type: 'credits', value: 200 } },
];

// ─── Loot Tables ───────────────────────────────────────

export interface RuinLoot {
  id: string;
  name: string;
  value: number; // sell value in credits
  rarity: 'common' | 'uncommon' | 'rare';
  description: string;
}

export const RUIN_LOOT: RuinLoot[] = [
  // Common
  { id: 'ancient_coin', name: 'Ancient Coin', value: 25, rarity: 'common',
    description: 'A small disc of unknown alloy, stamped with unfamiliar symbols.' },
  { id: 'crystal_shard', name: 'Crystal Shard', value: 40, rarity: 'common',
    description: 'A fragment of resonant crystal, still warm to the touch.' },
  { id: 'metal_fragment', name: 'Metal Fragment', value: 30, rarity: 'common',
    description: 'A piece of impossibly light metal. Its alloy is unknown to modern science.' },
  { id: 'ceramic_tile', name: 'Inscribed Tile', value: 35, rarity: 'common',
    description: 'A small ceramic tile covered in micro-etched symbols.' },

  // Uncommon
  { id: 'data_crystal', name: 'Data Crystal', value: 100, rarity: 'uncommon',
    description: 'A crystalline storage medium containing encoded information.' },
  { id: 'energy_cell', name: 'Ancient Energy Cell', value: 120, rarity: 'uncommon',
    description: 'A power cell that still holds a faint charge after millennia.' },
  { id: 'nano_vial', name: 'Nano-Repair Vial', value: 80, rarity: 'uncommon',
    description: 'A sealed vial of repair nanobots. Partially functional.' },
  { id: 'star_map', name: 'Star Map Fragment', value: 150, rarity: 'uncommon',
    description: 'A section of a holographic star map showing systems long renamed.' },

  // Rare
  { id: 'lattice_key', name: 'Lattice Key', value: 300, rarity: 'rare',
    description: 'A crystalline key that hums with residual fold-space energy.' },
  { id: 'guardian_core', name: 'Guardian Core', value: 400, rarity: 'rare',
    description: 'The processing core of a guardian construct. Incredibly advanced.' },
  { id: 'precursor_artifact', name: 'Precursor Artifact', value: 500, rarity: 'rare',
    description: 'An object of unknown purpose, radiating faint energy. Museums would pay dearly for this.' },
];

// ─── Ruin Chatter ──────────────────────────────────────
// Scene-specific chatter lines for the ruins

export const RUINS_CHATTER: string[] = [
  'The walls seem to hum with residual energy...',
  'Dust motes hang motionless in the stale air.',
  'Strange symbols glow faintly on the ceiling above.',
  'Your footsteps echo through ancient corridors.',
  'The air tastes of copper and ozone.',
  'Something skitters in the darkness beyond your light.',
  'A low vibration resonates through the floor.',
  'The architecture here defies conventional physics.',
  'Temperature readings fluctuate wildly in this area.',
  'Your suit detects trace amounts of unknown elements.',
  'The silence here is absolute. Unsettling.',
  'Faint scratching sounds come from behind the walls.',
  'This place has been sealed for millennia...',
  'Crystalline growths catch your suit light, refracting rainbows.',
  'The builders of this place were not human.',
];
