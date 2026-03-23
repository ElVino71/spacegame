# Starward Drift - Game Concept Document

## Core Vision
A 2D space exploration, trading, and combat game inspired by Starflight 2. The player captains a customizable ship, exploring a procedurally generated galaxy of star systems, landing on planets, discovering ancient ruins, trading goods, and engaging in combat. The game blends open-ended exploration with progression through ship upgrades and story discovery.

---

## Game Screens & Views

### 1. Galaxy Map (Top-Down) — IMPLEMENTED
- Zoomed-out view of star systems as nodes with faction-colored rings
- Fixed HTML side panel showing ship status, current location, and selected target info
- Player selects destination and jumps between connected systems (consumes fuel)
- Shows discovered/visited systems, jump lane connections, faction territories
- Jump range circle overlay shows reachable systems from current position
- Scroll to zoom, drag to pan, click to select
- Animated warp transition when jumping between systems

### 2. System View (Top-Down) — IMPLEMENTED
- Shows the sun at center, orbiting planets, asteroid belts
- Player flies ship freely with WASD (thrust-based physics with drag)
- Planets orbit the star in real-time
- Can approach planets to land (SPACE) or stations to dock (SPACE)
- Animated landing/docking transitions when interacting
- HUD shows hull, fuel, speed, credits

### 3. Ship Interior (Side-On 2D) — IMPLEMENTED
- Cross-section view of the ship showing rooms matching installed modules
- Rooms generated from ship's module slot configuration (bridge, engine room, cargo bay, etc.)
- Player character (stick figure) walks between rooms with WASD
- Each room displays its module stats in the info panel
- Bridge shows overall ship status
- Access terminal with T key

### 4. Planet Surface (Top-Down) — IMPLEMENTED
- 128x128 tile-based exploration map
- Terrain generated per planet type with appropriate color palettes (rocky, desert, ice, lush, volcanic, ocean, barren moon)
- Points of interest: mineral deposit clusters, ruins entrances, settlements
- Player moves tile-by-tile with WASD
- Fixed HTML side panel showing planet info, player status, and current tile details
- SPACE to interact with minerals/ruins/settlements
- Animated takeoff transition when leaving (ESC)

### 5. Ruins / Dungeons (Side-On 2D) — NOT YET IMPLEMENTED
- Entered from planet surface when discovering ruins
- Platformer-lite exploration of ancient structures
- Puzzles, traps, loot, and lore fragments
- Some ruins require specific equipment to access deeper areas
- Boss encounters or guardians protecting valuable tech

### 6. Ship Computer Terminal — IMPLEMENTED
- Full-screen terminal interface with CRT-style scanline effect
- Player types commands; output rendered with monospace text
- Commands: help, status, scan, cargo, nav, systems, codex, theme, clear, exit
- Scan shows full system breakdown (planets, minerals, stations)
- Nav shows connected systems with distances and fuel costs
- Theme command: `theme next` cycles themes, `theme <name>` sets specific theme
- Easter egg commands (joke, hello)
- Blinking cursor, command history

### 7. Station Interface — IMPLEMENTED
- Entered when docking at a space station (with docking transition)
- Menu-driven interface: Trade Goods, Refuel, Repair Hull, Undock
- HTML side panel shows station info, ship status, market listings, cargo hold
- 15 trade commodities with prices affected by station economy type
- Economy types modify buy/sell prices (e.g. mining stations sell minerals cheap)
- Buy (B) and sell (V) individual units of cargo
- Refuel and hull repair services

### 8. Scene Transitions — IMPLEMENTED
- Warp: Star-streak effect with blue shift, central glow (~2.2s)
- Landing: Atmospheric reentry with heat shield glow, surface approaching (~1.8s)
- Takeoff: Surface recedes, engine glow, stars appear (~1.8s)
- Docking: Station walls close in with guide lights (~1.4s)
- Undocking: Reverse dock animation (~1.4s)

### NOT YET IMPLEMENTED: Shipyard / Ship Modification Screen
- Dedicated screen for buying/selling/swapping ship modules
- Visual preview of ship cross-section with modules
- Available at space stations

---

## Core Gameplay Systems

### Trading — IMPLEMENTED (Basic)
- 15 commodities: food, water, medical supplies, ores (iron, copper, titanium, platinum), crystals, electronics, ship components, weapons, luxury goods, fuel cells, alien artifacts, rare earth
- Economy types affect prices: agricultural, industrial, mining, military, research, outpost
- Each economy type has category modifiers (e.g. mining stations buy minerals cheap, sell tech expensive)
- Per-station seeded price variance for variety
- Buy/sell at station market interface

### Trading — NOT YET IMPLEMENTED
- Supply/demand simulation (prices shift based on player trades)
- Illegal goods (contraband) with risk/reward
- Trade route discovery through NPC tips

### Combat — NOT YET IMPLEMENTED
- Real-time 2D combat in system view
- Shield management (directional shields if upgraded)
- Multiple weapon types: lasers, missiles, kinetic, EMP
- Ship agility affected by engine type and cargo weight
- Disable vs destroy options (boarding for loot, or bounty collection)
- Flee option with engine-dependent success chance

### Bounty Hunting — NOT YET IMPLEMENTED
- Bounty board available at stations
- Targets range from petty pirates to dangerous faction leaders
- Must track targets across systems using clues
- Alive captures worth more than destroyed targets
- Reputation affects available bounties

### Mining — PARTIALLY IMPLEMENTED
- Planet surface: mineral deposits appear as tile clusters, can be collected with SPACE
- NOT YET: Asteroid mining from ship with mining laser
- NOT YET: Gas giant fuel scooping
- NOT YET: Minerals feeding into crafting/upgrade system

### Exploration & Discovery — PARTIALLY IMPLEMENTED
- Procedural galaxy with ~300 star systems
- Systems discovered when visited or connected to a visited system
- Planet surfaces with procedural terrain and POIs
- NOT YET: Ruin exploration and lore fragment collection
- NOT YET: Derelict ships to board and salvage
- NOT YET: Anomalies (wormholes, nebulae, space creatures)

---

## Ship Systems & Progression

### Ship Classes — IMPLEMENTED (Data Only)
- **Scout**: Fast, small cargo, light weapons. Starter ship (80 hull, 100 fuel)
- **Freighter**: Slow, massive cargo (3 cargo slots), minimal weapons (120 hull, 150 fuel)
- **Corvette**: Balanced speed/weapons/cargo, two weapon slots (100 hull, 120 fuel)
- **Gunship**: Heavy weapons (3 weapon slots), good shields, small cargo (150 hull, 100 fuel)
- **Explorer**: Good sensors, computer, mining, life support (90 hull, 180 fuel)

### Module Types — IMPLEMENTED (Data Only)
- **Engines**: speed, jumpRange, fuelEfficiency stats
- **Shields**: capacity, rechargeRate stats
- **Weapons**: damage, fireRate, range, energyCost stats
- **Cargo Bays**: capacity stat
- **Sensors**: range, detail stats
- **Computer Core**: hackBonus, autoNav stats
- **Mining Equipment**: (slot defined, no starter module)
- **Hull Plating**: (slot defined, no starter module)
- **Life Support**: (slot defined, no starter module)

### NOT YET IMPLEMENTED
- Buying/selling ships at shipyards
- Module marketplace
- Module tier progression beyond starter gear
- Surface vehicle for planet exploration

---

## Planet Types & Properties — IMPLEMENTED

| Type | Landable | Mineable | Atmosphere | Notes |
|------|----------|----------|------------|-------|
| Rocky | Yes | Yes | None/Thin | Most common, may have ruins |
| Desert | Yes | Yes | None/Thin | Mineral-rich |
| Ice | Yes | Yes | None/Thin | May have ruins |
| Lush | Yes | No | Breathable | Higher settlement chance |
| Volcanic | Yes | Yes | Toxic/Thin | Lava tiles on surface |
| Gas Giant | No | Yes (gas scoop) | Crushing | Orbit only |
| Ocean | Yes | No | Breathable/Thin | Water tiles on surface |
| Barren Moon | Yes | Yes | None | Small size |

### Sun Types — IMPLEMENTED
- O (blue), B (blue-white), A (white), F (yellow-white), G (yellow/sol-like), K (orange), M (red)
- Star type affects planet count and type distribution
- Hotter/rarer stars more likely near galactic center

---

## Procedural Generation — IMPLEMENTED
- **Galaxy**: Seed-based, Poisson disk sampling for star placement, distance-based connections, BFS faction territory assignment
- **Systems**: Planet count/types based on star type, weighted orbital placement, asteroid belts, stations (60% chance)
- **Planet surfaces**: 128x128 tile maps, palette per planet type, mineral clusters, ruins/settlement placement
- **Names**: Syllable-combination system with prefixes/middles/suffixes, Greek letter planet names
- **Economy**: Per-station price generation from economy type modifiers + seeded variance

### NOT YET IMPLEMENTED
- Ruin interior generation
- NPC ship generation
- Dynamic events and encounters

---

## Factions — IMPLEMENTED (Basic)
- 6 factions: Terran Accord, Krai Collective, Syndicate, Luminari, Void Runners, Independent
- Territory assigned via BFS flood-fill from home systems
- Faction shown on galaxy map (colored rings) and station info
- Reputation tracking per faction (-100 to 100) in player data

### NOT YET IMPLEMENTED
- Reputation affecting prices, missions, access
- Faction-specific goods and ships
- NPC ships with faction allegiance
- Dynamic faction relations

---

## Story / Lore Framework — NOT YET IMPLEMENTED
- Ancient precursor civilization left ruins across the galaxy
- Fragments of their story found in ruins (text logs, artifacts, murals)
- Assembling the full picture reveals a threat or opportunity
- Player choice in how to use the knowledge
- Not a linear story - discovery-driven narrative
- Codex system exists in terminal (empty, awaiting content)

---

## UI Approach — IMPLEMENTED

### Unified Themed Frame System
A persistent HTML/CSS frame wraps the entire game canvas, providing a cockpit-like bounding box around the screen. The frame is visible at all times (including transitions and boot) and adapts its visual style to match the current ship's theme.

**Frame Structure:**
- **Outer border** with themed corner decorations and animated edge patterns
- **Top bar**: Scene title, navigation tabs (clickable + keyboard shortcuts), alert area
- **Bottom bar**: Persistent ship status — hull, fuel, cargo bars + credits display
- **Left panel**: Slide-in scene-specific content (replaces old fixed side panels)
- **Canvas area**: Phaser game renders inside the frame

**Navigation:**
- Top bar nav tabs provide consistent access to Map, System, Ship, Terminal across scenes
- Each tab shows its keyboard shortcut
- Active scene highlighted, clickable for scene switching

### Theming System — IMPLEMENTED
5 visual themes driven by CSS custom properties, each with unique character:

| Theme | Ship Class | Colors | Corner Decor | Edge Decor | Special Effects |
|-------|-----------|--------|-------------|------------|-----------------|
| **Retro Sci-Fi** | Scout | Green/cyan on dark | Sharp L-brackets with glow | Scrolling scanlines | CRT scanline overlay, neon glow |
| **Biological** | — | Pink/purple/amber | Pulsing organic nodes | Flowing vein patterns | Breathing border pulse, soft glow |
| **Steampunk** | Freighter | Gold/copper/brown | Spinning gear icons | Rivet dot patterns | Double border, inner line |
| **Military** | Corvette, Gunship | Orange/gray on dark | Solid hazard squares | Diagonal hazard stripes | Outer warning stripe band |
| **Alien** | Explorer | Violet/cyan/white | Rotating diamond shapes | Crystal shimmer bars | Prismatic border color shift |

- Theme auto-applied based on ship class (`SHIP_THEME_MAP` in `themes.ts`)
- Can be manually cycled via terminal command: `theme next` or `theme <name>`
- All UI elements (panel borders, text colors, bar fills, selection highlights) respond to theme
- Smooth CSS transitions when switching themes

### UI Technology
- Share Tech Mono font for clean sci-fi aesthetic
- Phaser canvas for game rendering, HTML/CSS overlay for all UI text and menus
- CSS custom properties (`--frame-*`) drive all theming — 25+ variables per theme
- Panel content uses `.section`, `.section-title`, `.row`, `.label`, `.value`, `.action` classes
- Color classes: `.good`, `.warn`, `.bad` map to theme-appropriate colors
- Progress bars for hull/fuel/cargo with theme-colored fills and critical/low animations

---

## Open Questions / Future Ideas
- Crew recruitment and management?
- Base building on planets?
- Multiplayer / async elements?
- Crafting system beyond ship modules?
- Dynamic faction wars that reshape territory?
- Procedural mission generation?
- Save/load system (architecture designed but not implemented)
