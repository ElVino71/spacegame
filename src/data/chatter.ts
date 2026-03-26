// ─── CHATTER DATA ──────────────────────────────────────────
// Human-editable game content for the bottom-right chatter window.

export interface ChatterEntry {
  text: string;
  weight: number;
  color?: string; // Optional CSS color or theme class like 'good', 'warn', 'bad'
}

/** General banter that can happen anywhere */
export const IDLE_BANTER: ChatterEntry[] = [
  { text: "Life support systems: OPTIMAL", weight: 1 },
  { text: "Recycling coffee grounds... 98% efficiency reached.", weight: 1 },
  { text: "Internal sensors detect minor hull vibration. Compensating.", weight: 1 },
  { text: "Computer: Scanning for local subspace anomalies... none found.", weight: 1 },
  { text: "Reminder: Scheduled maintenance for deck 4 in 12 hours.", weight: 1 },
  { text: "Ship AI: I'm feeling particularly efficient today, Captain.", weight: 1 },
  { text: "Warning: High levels of sarcasm detected in bridge comms.", weight: 0.5, color: "warn" },
  { text: "Did you hear that? Probably just the heat shields settling.", weight: 1 },
  { text: "Fuel injectors aligned. Reactor pulse steady.", weight: 1 },
  { text: "Hydraulics pressurized. Ready for maneuvers.", weight: 1 },
];

/** Chatter specifically when in a Star System (SystemScene) */
export const SYSTEM_CHATTER: ChatterEntry[] = [
  { text: "Long-range scanners picking up stellar wind fluctuations.", weight: 1 },
  { text: "Gravitational wells mapped. Navigation computer synced.", weight: 1 },
  { text: "Standard orbital debris detected. Non-hazardous.", weight: 1 },
  { text: "Monitoring solar flare activity... within safe margins.", weight: 1 },
  { text: "Local radio static is unusually rhythmic here.", weight: 1 },
  { text: "Picking up faint automated beacon from a distant moon.", weight: 1 },
  { text: "Radiation levels: Nominal for this spectral type.", weight: 1 },
];

/** Chatter when on a Planet Surface (PlanetSurfaceScene) */
export const SURFACE_CHATTER: ChatterEntry[] = [
  { text: "Atmospheric sensors active. Composition logged.", weight: 1 },
  { text: "Rover suspension adjusting for local gravity.", weight: 1 },
  { text: "Seismic activity detected... minor tremor.", weight: 1 },
  { text: "External temperature stabilized within cabin.", weight: 1 },
  { text: "Scanning for interesting geological formations.", weight: 1 },
  { text: "Dust levels rising. Cleaning external optics.", weight: 1 },
  { text: "Local wind speeds gusting to 15 knots.", weight: 1 },
  { text: "Bio-scanners active. Searching for signs of life.", weight: 1 },
];

/** Chatter when near or on a Station (StationScene) */
export const STATION_CHATTER: ChatterEntry[] = [
  { text: "Station comms: 'Welcome to our sector, traveler.'", weight: 1 },
  { text: "Docking clamps engaged. Magnetic seals holding.", weight: 1 },
  { text: "Local market prices updated in database.", weight: 1 },
  { text: "Scanning station structural integrity... looks solid.", weight: 1 },
  { text: "Intercepting local traffic control chatter... busy today.", weight: 1 },
  { text: "Station personnel: 'Keep it legal, Captain.'", weight: 1 },
];
