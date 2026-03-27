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

/** Crew chatter templates — {name} and {role} are resolved at runtime */
export interface CrewChatterTemplate {
  text: string;
  weight: number;
  color?: string;
  role?: string; // If set, only triggers for crew with this role
  moraleMin?: number; // Minimum morale to trigger (0-100)
  moraleMax?: number; // Maximum morale to trigger (0-100)
}

export const CREW_CHATTER: CrewChatterTemplate[] = [
  // Generic crew lines
  { text: "{name} reports all systems nominal from {room}.", weight: 1 },
  { text: "{name}: 'Another day, another jump, Captain.'", weight: 1 },
  { text: "{name} is humming quietly at their station.", weight: 0.5 },
  { text: "{name}: 'Standing by, Captain.'", weight: 1 },
  { text: "{name} stretches and adjusts their console.", weight: 0.5 },

  // Role-specific lines
  { text: "{name}: 'Engines are purring like a kitten, Captain.'", weight: 1.5, role: 'engineer' },
  { text: "{name}: 'I've optimized the fuel injector timing. Should save us a few drops.'", weight: 1, role: 'engineer' },
  { text: "{name} is elbow-deep in a maintenance panel.", weight: 0.8, role: 'engineer' },

  { text: "{name}: 'Course is steady. No drift detected.'", weight: 1.5, role: 'pilot' },
  { text: "{name}: 'Ready for maneuvers on your command.'", weight: 1, role: 'pilot' },
  { text: "{name} adjusts the flight stick with practiced ease.", weight: 0.8, role: 'pilot' },

  { text: "{name}: 'Weapons primed and locked, Captain.'", weight: 1.5, role: 'gunner' },
  { text: "{name}: 'Keeping the targeting array calibrated. Just in case.'", weight: 1, role: 'gunner' },
  { text: "{name} is polishing a sidearm at their station.", weight: 0.8, role: 'gunner' },

  { text: "{name}: 'Fascinating readings on the long-range sensors.'", weight: 1.5, role: 'scientist' },
  { text: "{name}: 'I'm cataloguing some interesting spectral anomalies.'", weight: 1, role: 'scientist' },
  { text: "{name} is scribbling notes on a datapad.", weight: 0.8, role: 'scientist' },

  { text: "{name}: 'Crew vitals are all green, Captain.'", weight: 1.5, role: 'medic' },
  { text: "{name}: 'Remind me to restock the med supplies at the next station.'", weight: 1, role: 'medic' },
  { text: "{name} is reorganizing the first aid kit. Again.", weight: 0.8, role: 'medic' },

  { text: "{name}: 'I've plotted three possible routes from here.'", weight: 1.5, role: 'navigator' },
  { text: "{name}: 'Star charts are up to date, Captain.'", weight: 1, role: 'navigator' },
  { text: "{name} is studying a holographic star map intently.", weight: 0.8, role: 'navigator' },

  // Morale-dependent lines
  { text: "{name}: 'Love this ship. Love this crew. Life is good.'", weight: 1.2, moraleMin: 80, color: 'good' },
  { text: "{name} is whistling a cheerful tune.", weight: 0.8, moraleMin: 70 },
  { text: "{name}: 'Not a bad gig, all things considered.'", weight: 1, moraleMin: 50, moraleMax: 80 },
  { text: "{name} sighs and stares at the bulkhead.", weight: 1, moraleMax: 40, color: 'warn' },
  { text: "{name}: 'When's the last time we got paid on time?'", weight: 1.2, moraleMax: 30, color: 'warn' },
  { text: "{name}: 'I didn't sign up for this...'", weight: 1.5, moraleMax: 20, color: 'bad' },
];
