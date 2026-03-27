# Plan: Character & Crew System (COMPLETED)

All phases of the Character & Crew System have been implemented.

## Completed Features
- **Data Foundation:** `src/data/characters.ts` and `src/entities/Character.ts` define the model.
- **Generation:** `src/generation/CharacterGenerator.ts` handles deterministic character creation.
- **Visuals:** `scripts/generate-portrait-tiles.js` generates portrait components; `src/ui/PortraitRenderer.ts` composites them with CSS tinting.
- **Station Integration:** NPCs appear at stations with portraits and bios. Recruitment system added.
- **Ship Integration:** Crew members are visible in the ship interior and their info is displayed in the UI panel.
- **Mechanics:** Crew salary is deducted on jump; crew stats provide bonuses to ship speed, jump range, and sensor range.

## Next Steps
- Implement room reassignment for crew members.
- Add more character-driven events and chatter.
- Expand crew roles to include combat and repair bonuses.
