// ─── NPC SHIP CHATTER DATA ──────────────────────────────────────
// Proximity-triggered radio chatter from NPC ships in the system.
// {name} = ship name, {faction} = faction name

import { ChatterEntry } from './chatter';

type NPCBehavior = 'patrol' | 'trader' | 'pirate';

export interface NPCChatterPool {
  hail: ChatterEntry[];        // first encounter / general proximity
  hostile: ChatterEntry[];     // pirate threats
  friendly: ChatterEntry[];    // trader/patrol greetings
}

/** Chatter when a patrol ship is nearby */
export const PATROL_CHATTER: ChatterEntry[] = [
  { text: "📡 {name}: Routine patrol. Carry on, Captain.", weight: 2, color: '#88aaff' },
  { text: "📡 {name}: {faction} patrol — this sector is secure.", weight: 2, color: '#88aaff' },
  { text: "📡 {name}: Maintain your heading. We're watching.", weight: 1, color: '#88aaff' },
  { text: "📡 {name}: All ships, be advised — increased pirate activity in outer systems.", weight: 1, color: '#88aaff' },
  { text: "📡 {name}: Running sensor sweep. Don't mind us.", weight: 1, color: '#88aaff' },
  { text: "📡 {name}: Safe travels, Captain. {faction} keeps the lanes clear.", weight: 1, color: '#88aaff' },
];

/** Chatter when a trader ship is nearby */
export const TRADER_CHATTER: ChatterEntry[] = [
  { text: "📡 {name}: Hail, Captain! Looking to trade?", weight: 2, color: '#88ff88' },
  { text: "📡 {name}: Hauling cargo for {faction}. Good margins this run.", weight: 2, color: '#88ff88' },
  { text: "📡 {name}: Fair winds out here today. Markets are up at the station.", weight: 1, color: '#88ff88' },
  { text: "📡 {name}: Watch those asteroid belts — lost a hull plate last time.", weight: 1, color: '#88ff88' },
  { text: "📡 {name}: If you're headed stationward, fuel cells are cheap today.", weight: 1, color: '#88ff88' },
  { text: "📡 {name}: Need supplies? Station's got good stock right now.", weight: 1, color: '#88ff88' },
];

/** Chatter when a pirate ship is nearby */
export const PIRATE_CHATTER: ChatterEntry[] = [
  { text: "📡 {name}: Well well... what do we have here?", weight: 2, color: '#ff6644' },
  { text: "📡 {name}: Nice ship. Be a shame if something happened to it.", weight: 2, color: '#ff6644' },
  { text: "📡 {name}: Drop your cargo and we might let you leave.", weight: 1, color: '#ff6644' },
  { text: "📡 {name}: Running dark out here, Captain? Smart... but not smart enough.", weight: 1, color: '#ff6644' },
  { text: "📡 {name}: Don't bother calling for help. No one's coming.", weight: 1, color: '#ff6644' },
  { text: "📡 {name}: You're in our space now. Pay the toll or pay the price.", weight: 1, color: '#ff6644' },
  { text: "📡 {name}: *static* ...easy target... *static*", weight: 1, color: '#ff4444' },
  { text: "📡 {name}: Your cargo manifest looks... interesting.", weight: 1, color: '#ff6644' },
];

/** Chatter when a pirate is actively chasing */
export const PIRATE_AGGRO_CHATTER: ChatterEntry[] = [
  { text: "📡 {name}: Nowhere to run, Captain!", weight: 2, color: '#ff4444' },
  { text: "📡 {name}: Engines won't save you!", weight: 1, color: '#ff4444' },
  { text: "📡 {name}: This'll be over quick!", weight: 1, color: '#ff4444' },
];

/** Get the appropriate chatter pool for a behavior type */
export function getNPCChatterPool(behavior: NPCBehavior): ChatterEntry[] {
  switch (behavior) {
    case 'patrol': return PATROL_CHATTER;
    case 'trader': return TRADER_CHATTER;
    case 'pirate': return PIRATE_CHATTER;
  }
}
