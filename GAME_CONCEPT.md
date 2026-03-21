# Starward Drift - Game Concept Document

## Core Vision
A 2D space exploration, trading, and combat game inspired by Starflight 2. The player captains a customizable ship, exploring a procedurally generated galaxy of star systems, landing on planets, discovering ancient ruins, trading goods, and engaging in combat. The game blends open-ended exploration with progression through ship upgrades and story discovery.

---

## Game Screens & Views

### 1. Galaxy Map (Top-Down)
- Zoomed-out view of star systems as nodes/icons
- Player plots course between systems by selecting destinations
- Shows known/discovered systems, trade routes, faction territories
- Fuel range overlay shows reachable systems from current position
- Systems revealed through exploration, buying star charts, or finding data in ruins

### 2. System View (Top-Down)
- Entered when arriving at a star system
- Shows the sun, orbiting planets, asteroid belts, gas giants
- Player can fly ship freely between objects in the system
- Encounters (pirates, traders, patrols) happen here
- Can scan planets/asteroids from orbit before committing to land/mine

### 3. Ship Interior (Side-On 2D)
- Cross-section view of the ship showing rooms/modules
- Rooms correspond to installed systems: bridge, engine room, cargo bay, weapons bay, crew quarters, shield generator room, computer terminal room
- Player character can walk between rooms
- Visual representation of ship condition (damage shown on rooms)
- Crew members visible at their stations

### 4. Planet Surface (Top-Down)
- Exploration view when landed on a planet
- Player drives a surface vehicle or walks around
- Terrain varies by planet type: rocky, ice, desert, lush, volcanic
- Points of interest: mineral deposits, ruins entrances, settlements, wreckage
- Hazards based on atmosphere/temperature (require suit upgrades)

### 5. Ruins / Dungeons (Side-On 2D)
- Entered from planet surface when discovering ruins
- Platformer-lite exploration of ancient structures
- Puzzles, traps, loot, and lore fragments
- Some ruins require specific equipment to access deeper areas
- Boss encounters or guardians protecting valuable tech

### 6. Ship Computer Terminal
- Full-screen terminal interface with command-line interaction
- Player types commands to interact with ship systems
- Functions: navigation calculations, cargo manifest, ship status, distress signal decoding, encyclopedia/codex, mission log
- Hackable - can decode found data chips, crack encrypted transmissions
- Personality/AI companion that responds conversationally
- Easter eggs and hidden commands

### 7. Shipyard / Station Interface
- Ship design and modification screen
- Drag-and-drop or menu-based module placement
- Buy/sell/swap ship components
- Visual preview of ship cross-section with modules
- Available at space stations and certain planet settlements

---

## Core Gameplay Systems

### Trading
- Commodities vary in price between systems based on economy type
- Economy types: agricultural, industrial, mining, military, research, outpost
- Supply/demand simulation - prices shift based on player actions and events
- Illegal goods (contraband) with high risk/reward
- Trade route discovery through exploration and NPC tips
- Commodity types: food, minerals, tech components, luxury goods, medical supplies, weapons, alien artifacts, fuel

### Combat
- Real-time 2D combat in system view
- Shield management (directional shields if upgraded)
- Multiple weapon types: lasers, missiles, kinetic, EMP
- Ship agility affected by engine type and cargo weight
- Disable vs destroy options (boarding for loot, or bounty collection)
- Flee option with engine-dependent success chance

### Bounty Hunting
- Bounty board available at stations
- Targets range from petty pirates to dangerous faction leaders
- Must track targets across systems using clues
- Alive captures worth more than destroyed targets
- Reputation affects available bounties

### Mining
- Asteroids: approach and mine from ship with mining laser
- Planet surface: deploy mining equipment at mineral deposits
- Different mineral types with varying values
- Some minerals needed for crafting/upgrades
- Gas giants: scoop fuel and rare gases with specialized equipment

### Exploration & Discovery
- Uncharted systems with unique features
- Ruins containing lore about an ancient civilization
- Assembling the lore reveals larger story/mystery
- Derelict ships to board and salvage
- Anomalies: wormholes, nebulae with special properties, space creatures

---

## Ship Systems & Progression

### Ship Classes (upgradeable or purchasable)
- **Scout**: Fast, small cargo, light weapons. Cheap starter ship
- **Freighter**: Slow, massive cargo, minimal weapons. Trading focus
- **Corvette**: Balanced speed/weapons/cargo. All-rounder
- **Gunship**: Heavy weapons, good shields, small cargo. Combat focus
- **Explorer**: Good sensors, decent cargo, medium speed. Exploration focus

### Swappable/Upgradeable Modules
- **Engines**: Affects speed, fuel efficiency, system jump range
- **Shields**: Energy shields with capacity and recharge stats; directional variants
- **Weapons**: Hardpoints for different weapon types; limited by ship class
- **Cargo Bays**: Expandable storage; trade-off with other module space
- **Sensors**: Scan range, detail level, ability to detect hidden things
- **Life Support**: Required for certain atmospheres and long voyages
- **Mining Equipment**: Laser miners, gas scoops, surface drills
- **Computer Core**: Affects terminal capabilities, hacking success, auto-navigation
- **Hull Plating**: Armor that absorbs damage after shields fail
- **Surface Vehicle**: For planet exploration; upgradeable separately

---

## Planet Types & Properties

| Type | Landable | Mineable | Atmosphere | Notes |
|------|----------|----------|------------|-------|
| Rocky | Yes | Yes | Varies | Most common, may have ruins |
| Desert | Yes | Yes | Thin | Mineral-rich, harsh conditions |
| Ice | Yes | Yes | None/Thin | Subsurface deposits, ancient frozen ruins |
| Lush | Yes | Some | Breathable | Settlements, trading posts |
| Volcanic | Yes (with gear) | Yes | Toxic | Rare minerals, dangerous |
| Gas Giant | No (orbit only) | Gas scoop | Crushing | Fuel harvesting, rare gases |
| Ocean | Limited | Limited | Varies | Floating platforms, underwater ruins? |
| Barren Moon | Yes | Yes | None | Low gravity, easy mining |

### Sun Types
- Yellow dwarf, Red giant, Blue giant, White dwarf, Binary systems, Neutron star
- Sun type affects system generation (planet types, number, hazards)

---

## Procedural Generation Scope
- Galaxy layout: star positions, types, connections
- System contents: number/type of planets, asteroid belts, stations
- Planet surfaces: terrain, mineral placement, ruin locations, settlements
- Ruin interiors: room layouts, puzzles, loot tables
- NPC names, ship loadouts, trade prices, bounty targets
- Events and encounters

---

## Factions & NPCs
- Multiple factions controlling regions of space
- Reputation system per faction (hostile to allied)
- Faction-specific goods, missions, and ships
- Independent traders, pirates, bounty hunters as dynamic NPCs
- Alien races with unique tech and trade goods

---

## Story / Lore Framework
- Ancient precursor civilization left ruins across the galaxy
- Fragments of their story found in ruins (text logs, artifacts, murals)
- Assembling the full picture reveals a threat or opportunity
- Player choice in how to use the knowledge
- Not a linear story - discovery-driven narrative

---

## Open Questions / Future Ideas
- Crew recruitment and management?
- Base building on planets?
- Multiplayer / async elements?
- Crafting system beyond ship modules?
- Dynamic faction wars that reshape territory?
- Procedural mission generation?
