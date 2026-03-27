// ─── CHARACTERS, CREW & ROLES ────────────────────────────
// Human-editable game content for named characters and ship crew.

import type { ShipClass } from '../entities/Ship';

/** First names per faction style */
export const FIRST_NAMES: Record<string, string[]> = {
  'Terran Accord': ["Marcus", "Elena", "Jace", "Sera", "Thomas", "Sarah", "David", "Claire"],
  'Krai Collective': ["Krix", "Vroth", "Zenna", "Thrak", "Grol", "Mora", "Zul", "Vax"],
  'Syndicate': ["Jinx", "Slate", "Raven", "Dex", "Viper", "Ghost", "Spike", "Ace"],
  'Luminari': ["Aelith", "Solenn", "Lirath", "Orien", "Elowen", "Thalric", "Valerius", "Lyra"],
  'Void Runners': ["Bolt", "Ash", "Flick", "Drift", "Spark", "Echo", "Static", "Dust"],
  'Independent': ["Sam", "Jo", "Casey", "Riley", "Alex", "Jordan", "Taylor", "Morgan"],
};

/** Surnames per faction style */
export const SURNAMES: Record<string, string[]> = {
  'Terran Accord': ["Vance", "Lund", "Rivers", "Sterling", "Hayes", "Wolfe", "Grant", "Foster"],
  'Krai Collective': ["Kraal", "Vorg", "Zul-Dara", "Thrak-Nor", "Grom", "Mokk", "Var", "Krix-Xen"],
  'Syndicate': ["Vale", "Black", "Kross", "Vane", "Stark", "Crane", "Sloane", "Reyes"],
  'Luminari': ["Sunspeaker", "Moonweaver", "Starlight", "Etheris", "Voidwalker", "Highborn", "Luminous", "Aethel"],
  'Void Runners': ["Skid", "Burner", "Jumper", "Cruiser", "Warp", "Nomad", "Rust", "Scav"],
  'Independent': ["Smith", "Miller", "Brown", "Jones", "Wilson", "Davis", "Taylor", "Anderson"],
};

/** Roles for NPCs encountered at stations */
export const NPC_ROLES = [
  'merchant',
  'mechanic',
  'bartender',
  'recruiter',
  'fence',
  'info_broker'
] as const;

export type NPCRole = (typeof NPC_ROLES)[number];

/** Roles for crew members on the player's ship */
export const CREW_ROLES = [
  'pilot',
  'engineer',
  'gunner',
  'scientist',
  'medic',
  'navigator'
] as const;

export type CrewRole = (typeof CREW_ROLES)[number];

/** Templates for procedural bios */
export const BIO_TEMPLATES = [
  "A {personality} {role} from {faction} who {background}.",
  "Former {background} now working as a {personality} {role}.",
  "This {faction} native is a {personality} {role} with a history in {background}.",
  "Known as a {personality} {role}, they spent years in {background} before joining the fleet.",
];

/** Personality traits for bio generation */
export const PERSONALITY_TRAITS = [
  "stoic", "cheerful", "grumpy", "ambitious", "reliable", "reckless", "cautious", "sharp",
  "loyal", "cynical", "idealistic", "quiet", "charismatic", "efficient", "eccentric", "brave"
];

/** Background stories for bio generation */
export const BACKGROUNDS = [
  "served in the planetary militia",
  "worked the asteroid mines for a decade",
  "escaped a debt-ridden colony",
  "was a high-stakes gambler on the station circuit",
  "studied at the grand naval academy",
  "survived a deep-space pirate raid",
  "specialized in experimental warp tech",
  "was a freelance scout in the outer rim",
  "managed a hydroponics farm on a barren moon",
  "served as a tactical officer in the last border skirmish"
];

/** Maximum crew capacity per ship class */
export const CREW_CAPACITY: Record<ShipClass, number> = {
  scout: 2,
  freighter: 4,
  corvette: 5,
  gunship: 6,
  explorer: 3
};

/** Salary range per crew role (credits per jump) */
export const CREW_SALARY_RANGE: Record<CrewRole, { min: number, max: number }> = {
  pilot: { min: 40, max: 100 },
  engineer: { min: 35, max: 90 },
  gunner: { min: 45, max: 110 },
  scientist: { min: 50, max: 120 },
  medic: { min: 40, max: 95 },
  navigator: { min: 45, max: 105 }
};

/** Palettes for skin tones (CSS-friendly colors) */
export const PORTRAIT_PALETTES = {
  skin: [
    "#f5d1c5", // Pale
    "#e8beac", // Fair
    "#d29b83", // Tan
    "#b87352", // Rich
    "#8d5524", // Deep Brown
    "#c68642", // Medium
    "#e0ac69", // Golden
    "#f1c27d"  // Light Gold
  ],
  hair: [
    "#090806", // Black
    "#2c1608", // Dark Brown
    "#714120", // Brown
    "#a56b46", // Light Brown
    "#e5c8a8", // Blonde
    "#debc99", // Sandy
    "#b55239", // Auburn
    "#91331f", // Red
    "#ffffff", // White
    "#777777"  // Grey
  ]
};
