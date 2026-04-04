# Agent Learnings

## NPC Ships Pattern
- NPC sprites use white base texture (`ship_npc`) tinted with `COLORS.factions[factionIndex]` at runtime
- NPC AI uses simple waypoint steering (pick target → rotate toward → accelerate → arrive → wait → repeat)
- Pirates override waypoint to chase player when within `aggroRange`
- Proximity chatter uses cooldown (8s) to avoid spam; `hailed` flag resets when player moves away
- Data file (`src/data/npcChatter.ts`) uses local type alias to avoid circular imports from entities

## Combat System Pattern
- Combat engine (`src/systems/CombatSystem.ts`) is pure logic — no Phaser dependency, takes dt and returns events
- Scene consumes `CombatEvent[]` each frame for visual/audio effects (hit flashes, explosions, SFX)
- Player ship is AI-controlled in combat (same maneuver system as NPC), boosted by crew skills
- Weapon type derived from module ID string matching (`guessWeaponType`) — laser/missile/kinetic/emp
- Combat data (weapons, stats, chatter, maneuvers) lives in `src/data/combat.ts` per data directory rule
- NPCShipData extended with combat fields; `encounterCooldown` prevents re-trigger after flee
- SystemScene triggers encounters: pirates auto-trigger when in aggroRange, player uses ENTER for neutral

## Artefact Trading Pattern
- Ruin loot items (RUIN_LOOT in `src/data/ruins.ts`) are added to player cargo with their `id` matching the loot table
- Artefact traders match cargo items to RUIN_LOOT by id, apply rarity-based price multipliers (ARTEFACT_PRICE_MULTIPLIERS)
- Station artefact dealer always available (uses 'fence' NPC role); settlement artefact shop has ~30% spawn chance
- New shop types added to settlements via ShopType union and ARTEFACT_SHOP_TEMPLATES in `src/data/settlements.ts`

## Progression System Pattern
- All progression data (ranks, nicknames, stat weights) in `src/data/progression.ts` per data directory rule
- `PlayerStats` tracked on `PlayerData.stats`, incremented inline at each action's hook point
- Stat hooks added directly in scene methods (tryBuy, trySell, interact, etc.) — no event system needed
- `getCaptainTitle(player)` helper in `Player.ts` computes the full display title
- Captain title passed as optional 6th param to `FrameManager.updateStatus()` for bottom bar display
- Save system uses optional fields with fallback defaults for backward compatibility with old saves
- `newGame()` accepts optional `captainName` parameter, flows through `GameState` → `createNewPlayer()`
