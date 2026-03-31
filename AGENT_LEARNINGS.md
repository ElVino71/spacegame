# Agent Learnings

## NPC Ships Pattern
- NPC sprites use white base texture (`ship_npc`) tinted with `COLORS.factions[factionIndex]` at runtime
- NPC AI uses simple waypoint steering (pick target → rotate toward → accelerate → arrive → wait → repeat)
- Pirates override waypoint to chase player when within `aggroRange`
- Proximity chatter uses cooldown (8s) to avoid spam; `hailed` flag resets when player moves away
- Data file (`src/data/npcChatter.ts`) uses local type alias to avoid circular imports from entities
