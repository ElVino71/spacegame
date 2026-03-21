# Starward Drift - Technical Overview

## Technology Stack

### Recommended: Phaser 3 + TypeScript
- **Engine**: Phaser 3 (mature 2D game framework, huge ecosystem)
- **Language**: TypeScript (type safety, better tooling for a project this size)
- **Build**: Vite (fast dev server, simple config)
- **State Management**: Custom ECS-lite or simple scene-based state
- **Data**: JSON files for game data, localStorage or IndexedDB for saves
- **UI**: Phaser DOM elements or a lightweight overlay (e.g., vanilla HTML/CSS panels for terminal, menus)

### Why Phaser 3
- Purpose-built for 2D games in the browser
- Handles sprites, tilemaps, physics, cameras, input, audio out of the box
- Scene system maps well to the game's multiple screens
- Large community, plenty of examples for every feature needed
- Can be packaged as desktop app via Electron/Tauri later if desired

### Alternative Considered: Godot
- More powerful but heavier; better if you want to ship native binaries
- GDScript or C# instead of TypeScript
- Could be a migration target later if browser performance becomes limiting

---

## Architecture Overview

```
src/
  main.ts                  # Entry point, Phaser game config
  scenes/
    BootScene.ts            # Asset preloading
    GalaxyMapScene.ts       # Star system map navigation
    SystemScene.ts          # In-system flight, encounters
    ShipInteriorScene.ts    # Side-on ship cross-section
    PlanetSurfaceScene.ts   # Top-down planet exploration
    RuinsScene.ts           # Side-on ruin exploration
    TerminalScene.ts        # Ship computer interface
    ShipyardScene.ts        # Ship modification UI
    CombatScene.ts          # Real-time combat (could be overlay on SystemScene)
  generation/
    GalaxyGenerator.ts      # Procedural galaxy layout
    SystemGenerator.ts      # Star system contents
    PlanetGenerator.ts      # Surface terrain and POIs
    RuinGenerator.ts        # Ruin room layouts
    NameGenerator.ts        # Procedural names for systems, planets, NPCs
  entities/
    Ship.ts                 # Player ship state and module slots
    Planet.ts               # Planet data model
    StarSystem.ts           # System data model
    NPC.ts                  # NPC ships, traders, bounty targets
    Player.ts               # Player state, inventory, reputation
  systems/
    TradeSystem.ts          # Economy simulation, price calculation
    CombatSystem.ts         # Damage, shields, weapons logic
    MiningSystem.ts         # Resource extraction mechanics
    ReputationSystem.ts     # Faction standing tracking
    BountySystem.ts         # Bounty generation and tracking
    InventorySystem.ts      # Cargo and item management
  terminal/
    TerminalEngine.ts       # Command parser and response handler
    commands/               # Individual terminal commands
      nav.ts
      cargo.ts
      scan.ts
      status.ts
      hack.ts
      codex.ts
  data/
    ship-modules.json       # Module definitions (engines, weapons, etc.)
    commodities.json        # Trade goods definitions
    planet-templates.json   # Planet type templates
    faction-data.json       # Faction definitions
    lore-fragments.json     # Ruin lore text pieces
  ui/
    HUD.ts                  # In-game overlay (fuel, shields, hull)
    DialoguePanel.ts        # NPC conversation UI
    TradePanel.ts           # Buy/sell interface
    ShipDesigner.ts         # Module drag-and-drop UI
  utils/
    SeededRandom.ts         # Deterministic RNG for procedural gen
    SaveManager.ts          # Save/load game state
    MathHelpers.ts          # Distance, angle, interpolation utils
```

---

## Procedural Generation Strategy

### Galaxy Generation
- **Seed-based**: Single master seed generates entire galaxy deterministically
- **Algorithm**: Poisson disk sampling for star placement (natural-looking distribution)
- **Connectivity**: Delaunay triangulation for jump routes, pruned for gameplay (not everything connected to everything)
- **Regions**: Voronoi cells assign faction territory
- **Star types**: Weighted random based on position (e.g., denser/hotter stars toward galactic center)
- **Scale**: ~200-500 star systems (enough variety, manageable generation)

### System Generation
- Star type determines planet count and type distribution
- Orbital slots filled using weighted probability tables
- Asteroid belts placed in gaps between planets
- Stations placed based on faction presence and economy type
- Each system generated on first visit from its seed (galaxy seed + system index)

### Planet Surface Generation
- Tile-based top-down maps using wave function collapse or noise-based terrain
- Planet type determines tile palette (rock, sand, ice, grass, lava, etc.)
- POI placement: minerals via noise thresholds, ruins via low probability scatter, settlements near flat terrain
- Generated and cached on first landing

### Ruin Generation
- Room-based dungeon generation (BSP tree or graph-based)
- Side-on view: rooms connected by corridors, vertical shafts
- Difficulty scales with distance from starting area of galaxy
- Loot tables weighted by ruin tier
- Puzzles drawn from a template pool, parameterized per instance

### Name Generation
- Markov chain or syllable-combination for alien-sounding names
- Consistent naming per faction/region (e.g., faction A has harsh consonants, faction B has flowing vowels)
- Seeded per entity for determinism

---

## Key Technical Challenges & Solutions

### 1. Multiple View Types
**Challenge**: Game has top-down, side-on, and UI-only screens.
**Solution**: Phaser's Scene system. Each view is a separate scene. Scenes can run in parallel (e.g., HUD scene overlays system scene). Scene transitions handle cleanup and state passing.

### 2. Ship Module System
**Challenge**: Ships have variable module slots affecting gameplay across multiple systems.
**Solution**: Component-based ship model. Ship has typed slots (engine, weapon[], shield, cargo[], sensor, etc.). Each module is a data object with stats. Systems query ship modules when calculating outcomes. Ship interior scene reads module list to render rooms.

```typescript
interface ShipModule {
  id: string;
  type: 'engine' | 'weapon' | 'shield' | 'cargo' | 'sensor' | 'computer' | 'mining' | 'hull';
  name: string;
  tier: number;
  stats: Record<string, number>;
  size: number; // slot units consumed
}

interface Ship {
  class: ShipClass;
  slots: { type: string; maxSize: number; module: ShipModule | null }[];
  hull: { current: number; max: number };
  fuel: { current: number; max: number };
}
```

### 3. Terminal / Computer Interface
**Challenge**: Interactive text terminal with typed commands, conversational AI feel.
**Solution**: Custom terminal engine. Command parser splits input into command + args. Each command is a handler function. Output rendered as styled text with typewriter effect. History buffer for scrollback. Hidden commands for easter eggs.

```typescript
// Terminal command registration
terminal.register('scan', {
  description: 'Scan current system or target',
  usage: 'scan [target]',
  execute: (args, gameState) => { /* return terminal output lines */ }
});
```

### 4. Economy Simulation
**Challenge**: Prices should feel dynamic and responsive.
**Solution**: Base prices per commodity per economy type. Modified by: distance from production center, random per-system variance (seeded), supply/demand shift from player trades (decays over time), and random events. Prices recalculated each time player docks.

### 5. Save System
**Challenge**: Procedural world is large but must be resumable.
**Solution**: Save only player state + delta from procedural baseline. Galaxy regenerates from seed. Save stores: player position, inventory, ship state, discovered systems, faction reputations, completed events, modified prices, visited ruins state. Compact JSON in IndexedDB.

### 6. Combat
**Challenge**: Real-time 2D combat that feels tactical.
**Solution**: Physics-lite system (no full rigid body sim). Ships have velocity, turn rate, weapon arcs. Shield segments (front/rear or directional). AI behaviors: aggressive, evasive, fleeing. Combat in system scene with camera zoom. Pause-to-plan option for accessibility.

---

## Rendering Approach

### Art Style Suggestion
- Pixel art, 16x16 or 32x32 tile base
- Clean, readable at multiple zoom levels
- Palette-swap planets/ships for variety with minimal assets
- Particle effects for engines, weapons, explosions
- Parallax starfield backgrounds

### Camera System
- Galaxy map: fixed zoom with scroll/drag
- System view: follows player ship, zoom in/out
- Ship interior: scrolls horizontally with ship length
- Planet surface: follows player vehicle, bounded to map
- Ruins: follows player character, room-based scrolling

---

## Performance Considerations
- Only generate system details when entered (lazy generation)
- Planet surfaces generated on landing, cached for session
- Off-screen entities culled from rendering
- Galaxy map renders only visible region
- Save data compressed before storage
- Object pooling for projectiles and particles

---

## Development Phases

### Phase 1: Foundation
- Project setup (Phaser + TypeScript + Vite)
- Galaxy generation and map screen
- System generation and system view (fly between planets)
- Basic ship model with stats
- Scene transitions

### Phase 2: Core Loops
- Planet surface generation and top-down exploration
- Ship interior view with rooms matching modules
- Trading system (buy/sell at stations)
- Mining (asteroids and planet surface)
- Basic combat (weapons, shields, destruction)

### Phase 3: Depth
- Terminal/computer interface with commands
- Ship modification at shipyards
- Bounty hunting system
- Ruin generation and side-on exploration
- Faction reputation

### Phase 4: Polish
- Sound and music
- UI polish and animations
- Balancing (economy, combat, progression)
- Save/load system
- Tutorial / early game guidance

### Phase 5: Content
- Lore fragments and overarching story
- More ship classes and modules
- More planet types and biomes
- Events and encounters variety
- Easter eggs and hidden content

---

## Data Flow Summary

```
Master Seed
  -> GalaxyGenerator (star positions, types, factions)
    -> SystemGenerator (planets, asteroids, stations per system)
      -> PlanetGenerator (terrain, POIs per planet)
        -> RuinGenerator (rooms, loot per ruin)

Player Actions
  -> Modify Player State (inventory, position, reputation)
  -> Modify World Deltas (prices, discovered locations, completed events)
  -> Save = Player State + World Deltas + Master Seed
```

---

## Third-Party Libraries (Minimal)
- **Phaser 3**: Game engine
- **simplex-noise**: Terrain generation
- **seedrandom**: Deterministic RNG
- Everything else custom to keep dependencies light
