# Current Work Plan: Tile-Based Frame Rework

## Goal
Replace the simple 3-tile-per-theme frame border with a richer tile-based system using 32×32 tiles with multiple variants per theme, composited into strips for visual variety.

## Design Decisions
- **Tile size**: 32×32 actual pixels (was 16×16 at 2× scale)
- **Strip approach**: Edge tiles composited into strips (256×32 horizontal, 32×256 vertical) containing 8 tiles with a mix of 3-4 variant types. CSS `background-repeat` handles tiling.
- **Corner**: Single 32×32 tile per theme, CSS transforms for other corners (unchanged approach)
- **Variant mix per strip**: Sequence `[base, varA, base, varB, base, accent, base, varA]` — base tile appears 4× for consistency, variants add visual interest

## Theme Tile Flavors
- **Retro-scifi**: Circuit traces (base), data bus lines (var), chip connector pads (var), LED indicator strip (accent)
- **Biological**: Undulating membrane (base), vein clusters (var), spore pods (var), nerve node with synapse (accent)
- **Steampunk**: Brass strip with rivets (base), overlapping plate seam (var), gear teeth (var), pressure gauge (accent)
- **Military**: Armor plate with bolts (base), hazard stripe section (var), vent slats (var), stencil markings (accent)
- **Alien**: Crystal lattice strip (base), energy conduit nodes (var), lattice web strands (var), prismatic shard (accent)

## Files Changed

### 1. `scripts/generate-frame-tiles.js` — DONE
- Full rewrite with 32×32 tiles, 4 H variants + 4 V variants + 1 corner per theme
- Strip compositing at bottom of file
- Output: corner_tl.png (32×32), edge_h.png (256×32), edge_v.png (32×256) per theme

### 2. `src/ui/frame.css` — DONE
- Update `--frame-tile-size: 32px` (already 32px, no change needed)
- Update edge background-size to `256px 32px` for horizontal, `32px 256px` for vertical
- Remove `image-rendering: crisp-edges` double declaration (keep pixelated)
- Verify all positioning still works with 32px corners

### 3. `src/ui/FrameManager.ts` — DONE
- Update `applyFrameTiles()` method:
  - Edge background-size must match strip dimensions (256×32 / 32×256)
  - Corner background-size stays 32×32
  - File paths unchanged (corner_tl.png, edge_h.png, edge_v.png)

### 4. Generate & Test — DONE
- Run `node scripts/generate-frame-tiles.js`
- Run `npx tsc --noEmit` to verify TypeScript
- Run `npm run dev` and check visually

## Rollback
Previous generator was simple (626 lines). Git history has the old version.
