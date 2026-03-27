# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev       # Vite dev server on port 3000 with hot reload
npm run build     # TypeScript type-check + Vite production build (dist/)
npm run preview   # Preview production build
npx tsc --noEmit  # Type-check only (no emit)
```

No test framework is configured. TypeScript strict mode is enabled.

## Architecture

**Starward Drift** is a 2D space exploration/trading game built with Phaser 3.90 + TypeScript + Vite. All rendering is Phaser canvas; all UI text/panels are HTML/CSS overlays managed by FrameManager.

### Three Singletons

- **GameState** (`src/GameState.ts`): Holds galaxy array (~300 systems), player data (ship, cargo, credits, reputation), handles jump logic and discovery tracking. Access via `getGameState()`.
- **FrameManager** (`src/ui/FrameManager.ts`): Persistent HTML/CSS overlay with top nav bar, bottom status bar, left info panel, themed borders/decorations. Survives scene transitions. Access via `getFrameManager()`.
- **AudioManager** (`src/audio/AudioManager.ts`): Web Audio API procedural SFX synthesis (no audio files) + per-scene ambient drones. Access via `getAudioManager()`.

### Scene Flow

```
BootScene → GalaxyMapScene ↔ SystemScene ↔ PlanetSurfaceScene
                ↕                ↕              ↕
          ShipInteriorScene  StationScene    (liftoff)
                ↕
          TerminalScene
```

All scene-to-scene transitions go through **TransitionScene** (warp/land/takeoff/dock/undock animations). Every scene calls `frame.enterGameplay()` on create and manages its own panel/nav setup.

### Scene Integration Pattern

```typescript
// Scenes with left sidebar (most scenes):
create() {
  const frame = getFrameManager();
  frame.enterGameplay('Title');
  frame.showPanel(PANEL_WIDTH);     // left sidebar
  frame.setNav([...], callback);    // top tabs
  frame.updateStatus(hull, fuel, cargoUsed, cargoMax, credits);
  getAudioManager().setAmbience('scene_name');
}
shutdown() {
  getFrameManager().hidePanel();
}

// Scenes with center overlay (e.g. StationScene):
create() {
  const frame = getFrameManager();
  frame.enterGameplay('Title');
  frame.hidePanel();
  frame.showCenterOverlay();
  frame.setCenterContent(html);     // full-width HTML UI
}
shutdown() {
  getFrameManager().hideCenterOverlay();
}
```

### Planet Surface Tiles

Tile-based planet surfaces use 16×16 PNG sprites loaded from `assets/tiles/`. Three generation scripts produce placeholder art:

- `scripts/generate-tiles.js` — base terrain tiles (ground variants, rock, mineral, ruin, settlement, water, lava, rover)
- `scripts/generate-bio-tiles.js` — flora (10 types in `assets/tiles/flora/`) and fauna (6 types in `assets/tiles/fauna/`)

All tiles are drawn in neutral tones and tinted per-planet-type at runtime. Flora/fauna distribution is biome-specific (lush planets get dense vegetation + diverse fauna; barren moons get nothing; desert gets cactus + sparse insects, etc.) defined in `BIOME_CONFIGS` in PlanetSurfaceScene.

### Frame Border Tiles

The game frame uses 32×32 procedurally generated tile PNGs displayed at 3× (96px) with `image-rendering: pixelated`. One generator script produces themed border art:

- `scripts/generate-frame-tiles.js` — 5 themes × 3 files each:
  - `corner_tl.png` (32×32) — corner piece, CSS-flipped for other corners
  - `edge_h.png` (256×32) — 8-tile horizontal strip with 4 variant types composited
  - `edge_v.png` (32×256) — 8-tile vertical strip with 4 variant types composited

CSS uses `--frame-tile-size: 96px` for tile display and `--frame-content-inset: 18px` for content positioning (bars, panels sit just inside the visible border, not 96px in).

### Ship Interior Tiles

The Ship Interior scene is a side-view cross-section with rooms connected by walkable corridors. Player walks left/right on the floor only (1D horizontal movement). Each room has themed 32×32 tile backgrounds displayed at 2× scale in Phaser:

- `scripts/generate-room-tiles.js` — 5 themes × 50 tiles each in `assets/tiles/rooms/{theme}/`:
  - `floor.png`, `wall.png`, `corridor.png` — structural tiles
  - `bg_bridge.png`, `bg_engine.png`, `bg_weapons.png`, `bg_shields.png`, `bg_cargo.png`, `bg_sensors.png`, `bg_computer.png`, `bg_mining.png`, `bg_life_support.png`, `bg_hull.png` — room-specific backgrounds
  - `bg_{type}_v1.png`, `bg_{type}_v2.png`, `bg_{type}_v3.png` — 3 visual variants per room type (33 variant tiles total, including corridor variants)
  - `deco_porthole.png`, `deco_pipes.png`, `deco_panel.png`, `deco_vent.png` — generic decoration tiles usable in any room

Tile selection per position is seeded (galaxy seed + ship name) so each ship has a unique but persistent interior look. Each tile position has a 40% chance of being a variant, and wall-adjacent positions have a 15% chance of being a decoration tile (porthole, pipes, panel, vent).

Room types map to ship module slot types. Falls back to graphics-drawn decorations if tiles aren't loaded. Theme selection uses the ship's stored `theme`.

### Rover & Surface Cargo

The player explores planet surfaces in a rover vehicle (sprite rotates with movement direction). The rover has 5 cargo slots separate from ship cargo. Mined minerals go to rover cargo; on liftoff, rover cargo transfers to ship cargo automatically.

### Procedural Generation

Everything is seeded via `SeededRandom` (Mulberry32). Galaxy seed → per-system fork → deterministic planets/stations/surfaces. Galaxy uses Poisson disk placement, faction BFS territory assignment, distance-threshold connectivity.

### Centralized Game Data (`src/data/`)

All human-editable game content lives in `src/data/` for easy tweaking:

- `trade.ts` — Trade goods, price prefixes (e.g. "Exotic", "Bootleg"), economy modifiers
- `ships.ts` — Ship templates (hull/fuel/slots per class), starter modules, starter values
- `planets.ts` — Planet configs (landable/mineable/atmosphere/ruin chance), color palettes, mineral types, biome configs (flora/fauna per planet type)
- `factions.ts` — Faction names
- `names.ts` — Name generation word lists (system/planet/station syllables)
- `misc.ts` — Jokes, flavour text
- `index.ts` — Barrel re-exports

Source files import from `src/data/` for content and keep only structural types/interfaces locally. Non-mineral trade goods get seeded prefixes per station that modify display name and price.

### Data Model

- **ShipData**: Typed module slots (engine/weapon/shield/cargo/sensor/computer/mining/hull/life_support), each with a max size constraint. Modules have flexible `stats: Record<string, number>`.
- **StarSystemData**: Star type, planets (with orbit physics), asteroid belts, optional station. Index in galaxy array = system ID.
- **PlayerData**: Ship, credits, cargo items, current system ID, faction reputation, discovered/visited system sets.

### UI Approach

All game UI text uses HTML/CSS panels (not Phaser text objects) — Phaser's pixelArt mode makes text look janky. Use FrameManager's panel system with CSS classes: `.section`, `.section-title`, `.row`, `.label`, `.value`, `.action`, and color classes `.good`/`.warn`/`.bad` that map to theme variables.

### Theme System

5 visual themes (retro-scifi, biological, steampunk, military, alien) defined in `src/ui/themes.ts` with 25+ CSS custom properties each. Ships store their current theme in `ship.theme`, which is used to apply the UI theme and select ship interior tiles. Switchable at runtime via terminal `theme` command (updates `ship.theme`).

### Audio System

All SFX are synthesized procedurally (oscillators, filters, noise). No audio files needed. Per-scene ambient atmospheres crossfade on scene change. Volume controllable via terminal `audio` command. Browser autoplay policy handled by deferring AudioContext creation to first user interaction.

## Key Conventions

- **Seeded RNG everywhere**: Use `rng.fork(id)` for deterministic sub-generators, never `Math.random()` for game content.
- **Camera viewport offset**: Scenes with left panels offset `cameras.main.setViewport(PANEL_WIDTH, 0, ...)`.
- **Frame lifecycle**: Always call `frame.hidePanel()` in `shutdown()` or `create()` if the scene doesn't use the panel. The panel persists across scene transitions.
- **Phaser text positioning**: UI text using `setScrollFactor(0)` must be placed at (30, 30) or further from edges to clear the 96px frame border tiles.
- **Constants**: Game dimensions (1280x720), colors, type arrays in `src/utils/Constants.ts`. Game content data (trade goods, ships, planets, names, factions) in `src/data/`.
- **Data directory rule**: All new game content data (arrays of items, word lists, config tables, lore entries, bios, stat tables, etc.) **must** go in `src/data/`. Scene and entity files should only contain logic — never inline content data. If adding a new content domain (e.g. lore, NPCs, quests), create a new file in `src/data/` and add it to the barrel export in `src/data/index.ts`.

## Key Rules

I want claude to update the documents after each major step has been done, or more simply just keep the documents up to date.
I want claude to make a file for the current planned piece of work before the work starts, so if we run out of tokens, we can review this file
to continue the work. Update this plan file as we continue, and clear it when its done, check if the @PLAN.md has anything in that is unfinished before
we start anything new.
Use and update @GAME_CONCEPT.md to check of key design goals.