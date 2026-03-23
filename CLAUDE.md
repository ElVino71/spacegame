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
```

### Planet Surface Tiles

Tile-based planet surfaces use 16×16 PNG sprites loaded from `assets/tiles/`. Three generation scripts produce placeholder art:

- `scripts/generate-tiles.js` — base terrain tiles (ground variants, rock, mineral, ruin, settlement, water, lava, player)
- `scripts/generate-bio-tiles.js` — flora (10 types in `assets/tiles/flora/`) and fauna (6 types in `assets/tiles/fauna/`)

All tiles are drawn in neutral tones and tinted per-planet-type at runtime. Flora/fauna distribution is biome-specific (lush planets get dense vegetation + diverse fauna; barren moons get nothing; desert gets cactus + sparse insects, etc.) defined in `BIOME_CONFIGS` in PlanetSurfaceScene.

### Procedural Generation

Everything is seeded via `SeededRandom` (Mulberry32). Galaxy seed → per-system fork → deterministic planets/stations/surfaces. Galaxy uses Poisson disk placement, faction BFS territory assignment, distance-threshold connectivity.

### Data Model

- **ShipData**: Typed module slots (engine/weapon/shield/cargo/sensor/computer/mining/hull/life_support), each with a max size constraint. Modules have flexible `stats: Record<string, number>`.
- **StarSystemData**: Star type, planets (with orbit physics), asteroid belts, optional station. Index in galaxy array = system ID.
- **PlayerData**: Ship, credits, cargo items, current system ID, faction reputation, discovered/visited system sets.

### UI Approach

All game UI text uses HTML/CSS panels (not Phaser text objects) — Phaser's pixelArt mode makes text look janky. Use FrameManager's panel system with CSS classes: `.section`, `.section-title`, `.row`, `.label`, `.value`, `.action`, and color classes `.good`/`.warn`/`.bad` that map to theme variables.

### Theme System

5 visual themes (retro-scifi, biological, steampunk, military, alien) defined in `src/ui/themes.ts` with 25+ CSS custom properties each. Ships auto-map to themes via `SHIP_THEME_MAP`. Switchable at runtime via terminal `theme` command or `frame.applyTheme()`.

### Audio System

All SFX are synthesized procedurally (oscillators, filters, noise). No audio files needed. Per-scene ambient atmospheres crossfade on scene change. Volume controllable via terminal `audio` command. Browser autoplay policy handled by deferring AudioContext creation to first user interaction.

## Key Conventions

- **Seeded RNG everywhere**: Use `rng.fork(id)` for deterministic sub-generators, never `Math.random()` for game content.
- **Camera viewport offset**: Scenes with left panels offset `cameras.main.setViewport(PANEL_WIDTH, 0, ...)`.
- **Frame lifecycle**: Always call `frame.hidePanel()` in `shutdown()` if panel was shown.
- **Constants**: Game dimensions (1280x720), colors, faction names, type arrays all in `src/utils/Constants.ts`.

I want claude to update the documents after each major step has been done, or more simply just keep the documents up to date.