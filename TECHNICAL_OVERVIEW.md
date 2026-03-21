# Starward Drift - Technical Overview

## Technology Stack

### Phaser 3 + TypeScript + Vite
- **Engine**: Phaser 3.90 (2D game framework)
- **Language**: TypeScript with strict mode
- **Build**: Vite 8 (dev server on port 3000, hot reload)
- **State Management**: Singleton GameState class with scene-based flow
- **Data**: TypeScript constants and interfaces (no external JSON data files yet)
- **UI**: HTML/CSS overlay panels for menus (Share Tech Mono font), Phaser canvas for game rendering
- **Dependencies**: Phaser only — no simplex-noise or seedrandom (custom SeededRandom implementation)

---

## Architecture — Current State

```
src/
  main.ts                    # Entry point, Phaser game config, scene registration
  GameState.ts               # Singleton game state (galaxy, player, jump logic)
  scenes/
    BootScene.ts              # Generates placeholder textures programmatically
    GalaxyMapScene.ts         # Star map with HTML side panel, zoom/pan/select
    SystemScene.ts            # In-system flight with thrust physics
    ShipInteriorScene.ts      # Side-on ship rooms, walk between modules
    PlanetSurfaceScene.ts     # Top-down 128x128 tile exploration with HTML panel
    TerminalScene.ts          # CLI interface with command parser
    StationScene.ts           # Station menu, trading, refuel, repair with HTML panel
    TransitionScene.ts        # Animated transitions (warp, land, takeoff, dock, undock)
  generation/
    GalaxyGenerator.ts        # Poisson disk sampling, connections, faction BFS
    SystemGenerator.ts        # Planet/asteroid/station generation per system
    NameGenerator.ts          # Syllable-combination name generation
  entities/
    Ship.ts                   # ShipModule, ModuleSlot, ShipData, ship templates, starter modules
    StarSystem.ts             # StarSystemData, PlanetData, StationData interfaces
    Player.ts                 # PlayerData, ship stat helpers, createNewPlayer()
  utils/
    SeededRandom.ts           # Mulberry32 PRNG with helpers (int, float, pick, weighted, shuffle, chance, fork)
    Constants.ts              # Dimensions, colors, type definitions, faction names
```

### Not yet created (planned in GAME_CONCEPT.md)
```
  scenes/
    RuinsScene.ts             # Side-on ruin exploration
    CombatScene.ts            # Real-time combat
    ShipyardScene.ts          # Ship modification/purchase UI
  generation/
    PlanetGenerator.ts        # (currently inline in PlanetSurfaceScene)
    RuinGenerator.ts          # Ruin room layouts
  entities/
    NPC.ts                    # NPC ships, traders, bounty targets
  systems/
    TradeSystem.ts            # (currently inline in StationScene)
    CombatSystem.ts
    MiningSystem.ts
    ReputationSystem.ts
    BountySystem.ts
    InventorySystem.ts
  terminal/
    TerminalEngine.ts         # (currently inline in TerminalScene)
    commands/                 # (currently inline in TerminalScene)
  ui/
    HUD.ts
    DialoguePanel.ts
  data/
    ship-modules.json
    commodities.json
    lore-fragments.json
```

---

## Procedural Generation — Implementation Details

### Galaxy Generation (GalaxyGenerator.ts)
- **Seed-based**: Single master seed, Mulberry32 PRNG
- **Algorithm**: Poisson disk sampling with minimum distance constraint for natural star placement
- **Scale**: ~300 star systems (GALAXY_SIZE constant), 4000px galaxy bounds
- **Connectivity**: Distance-threshold approach — each system connects to nearest 3-6 neighbours within range
- **Factions**: 6 factions, home systems spread evenly, BFS flood-fill with random priority for organic borders
- **Star types**: O/B/A/F/G/K/M weighted by distance from galactic center (hotter stars toward center)
- **System contents**: Generated eagerly for all systems at galaxy creation (using forked RNG per system)

### System Generation (SystemGenerator.ts)
- Planet count based on star type (e.g. G-class: 3-7, M-class: 1-4)
- Planet types weighted by orbital position (inner: rocky/volcanic, middle: lush/ocean, outer: ice/gas giant)
- Each planet has: type, orbit, size, atmosphere, landable/mineable flags, ruins/settlement chance, mineral deposits
- Asteroid belts: 0-2 per system with density and mineral richness
- Stations: 60% chance per system, random economy type, orbits near a planet

### Planet Surface (inline in PlanetSurfaceScene.ts)
- 128x128 tile grid, 16px tiles
- RNG-based terrain (not noise — simple probability per tile)
- Palette per planet type (ground colors, rock colors)
- Mineral clusters: 4-8 tiles per deposit, scattered around deposit coordinates
- Ruins entrance: single tile with surrounding ruin-colored ground
- Settlements: single tile with surrounding settlement-colored ground
- Spawn area cleared in center

### Name Generation (NameGenerator.ts)
- Syllable combination: prefix + optional middle + suffix
- 30% chance of catalog number suffix (e.g. "Altaris-42")
- Planet names: 50% chance Greek letter (Alpha, Beta...), else generated
- Station names: system name or prefix + type (Station, Outpost, Port, etc.)

---

## Key Implementation Details

### Scene Transitions (TransitionScene.ts)
- Generic transition scene accepting type, target scene, target data, and display text
- Types: warp (2.2s), land (1.8s), takeoff (1.8s), dock (1.4s), undock (1.4s)
- Warp: 300 stars with z-depth, streaking from center, speed acceleration curve, blue color shift
- Landing: upward particle stream, heat shield glow (sine-based intensity), surface rising from below
- Takeoff: reverse of landing — surface drops, engine glow, stars fade in
- Docking: station walls closing from top/bottom, blinking guide lights, approach stars slowing
- All transitions fade to black before starting target scene

### HTML Panel System
- Single `#ui-panel` div in index.html, shown/hidden per scene
- Each scene rebuilds panel innerHTML on create (sections replaced, not accumulated)
- Panel width varies by scene (260px galaxy map, 240px planet surface, 340px station)
- CSS classes for consistent styling: `.section`, `.section-title`, `.row`, `.label`, `.value`, `.action`
- Color classes: `.good` (green), `.warn` (yellow), `.bad` (red)
- Progress bars for hull/fuel/cargo (CSS `.bar-bg` / `.bar-fill`)

### Ship System (Ship.ts)
- Template-based: SHIP_TEMPLATES defines slots per ship class
- ModuleSlot has type constraint and maxSize
- ShipModule has stats as Record<string, number> for flexibility
- STARTER_MODULES auto-installed into first matching empty slot
- Helper functions: getShipSpeed, getJumpRange, getCargoCapacity, getShieldCapacity

### GameState (GameState.ts)
- Singleton pattern via getGameState() / newGame()
- Owns galaxy array and player data
- Jump logic: checks connection exists, calculates fuel cost from distance, deducts fuel
- Discovery: visiting a system discovers all connected systems

### Trading (inline in StationScene.ts)
- TRADE_GOODS: 15 items with id, name, basePrice, category
- ECONOMY_MODIFIERS: per-economy-type multipliers per category
- Market generated on dock: base price * (1 + economy modifier + seeded variance)
- Sell price = 75% of buy price
- Stock is random per station (seeded)
- Player cargo stored as CargoItem[] on PlayerData

### Terminal (TerminalScene.ts)
- Command parsing: split input on spaces, switch on first word
- Commands: help, status/stat, scan [planets|asteroids], cargo, nav [routes|range], systems/sys, codex [list], clear/cls, exit/quit, hello/hi, joke
- Output stored as TerminalLine[] with text and color
- Renders last 30 lines
- CRT effect: scanline overlay drawn in create()

### System View Flight (SystemScene.ts)
- Thrust-based physics: acceleration in facing direction, velocity capped, drag applied each frame
- Rotation with A/D, thrust with W/S (reverse thrust at 50% power)
- Interaction range: 50px from planet edge or station center
- Nearest object tracked each frame for highlight ring and info display
- Planet orbit angles update each frame

---

## Rendering Approach

### Current Art: Programmatic Placeholders (BootScene.ts)
- Ship: green triangle generated as texture
- Star glow: white circle with alpha falloff
- Station: gray square with blue center
- Asteroid: brown circle
- Pixel: 2x2 white square for particles
- All generated via Phaser Graphics → generateTexture()
- **Ready to be replaced with PNG sprite assets** — just swap `generateTexture` calls for `this.load.image` calls

### Camera System
- Galaxy map: viewport offset by panel width (260px), zoom 0.3-4x, scroll/drag pan
- System view: follows player ship via centerOn(), zoom 0.3-3x
- Ship interior: no camera offset, full screen
- Planet surface: viewport offset by panel width (240px), zoom 2x, centered on player
- Terminal: full screen, no scrolling
- Station: full screen with panel

---

## Development Phase Status

### Phase 1: Foundation — COMPLETE
- [x] Project setup (Phaser 3.90 + TypeScript + Vite 8)
- [x] Galaxy generation (Poisson disk, factions, connections)
- [x] System generation (planets, asteroids, stations)
- [x] Galaxy map screen (HTML panel, zoom/pan/select, jump)
- [x] System view (fly between planets with thrust physics)
- [x] Basic ship model with module slots and stats
- [x] Scene transitions (warp, land, takeoff, dock, undock)

### Phase 2: Core Loops — PARTIALLY COMPLETE
- [x] Planet surface generation and top-down exploration (128x128 tiles)
- [x] Ship interior view with rooms matching modules
- [x] Trading system (buy/sell at stations, economy-based pricing)
- [x] Station services (refuel, repair)
- [ ] Mining (asteroid mining from ship, proper mineral collection with cargo)
- [ ] Basic combat (weapons, shields, damage)

### Phase 3: Depth — PARTIALLY COMPLETE
- [x] Terminal/computer interface with commands
- [ ] Ship modification at shipyards (buy/sell modules)
- [ ] Bounty hunting system
- [ ] Ruin generation and side-on exploration
- [ ] Faction reputation affecting gameplay

### Phase 4: Polish — NOT STARTED
- [ ] Sound and music
- [ ] UI polish and animations
- [ ] Balancing (economy, combat, progression)
- [ ] Save/load system
- [ ] Tutorial / early game guidance

### Phase 5: Content — NOT STARTED
- [ ] Lore fragments and overarching story
- [ ] More ship modules and tier progression
- [ ] Events and encounters variety
- [ ] NPC ships (traders, pirates, patrols)
- [ ] Easter eggs and hidden content

---

## Data Flow

```
Master Seed (random at game start)
  → GalaxyGenerator (star positions, types, factions, connections)
    → SystemGenerator (planets, asteroids, stations per system — all generated upfront)
      → PlanetSurfaceScene (terrain tiles — generated on landing from system+planet seed)

Player Actions
  → Modify PlayerData (credits, cargo, fuel, hull, position, reputation, discoveries)
  → Modify StarSystemData (discovered/visited flags)
  → NOT YET: Save = PlayerData + world deltas + master seed
```

---

## Dependencies
- **phaser**: ^3.90.0 (game engine)
- **typescript**: ^5.9.3 (dev)
- **vite**: ^8.0.1 (dev)
- No other runtime dependencies — SeededRandom is custom, no noise library needed yet
