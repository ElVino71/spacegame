// ─── NAME GENERATION WORD LISTS ─────────────────────────
// Human-editable game content. Add/remove syllables to change the flavour of generated names.

/** First syllable of star system names */
export const SYSTEM_PREFIXES = [
  'Al', 'Be', 'Cor', 'Del', 'Er', 'Fa', 'Gal', 'Hel', 'Ix', 'Jen',
  'Kel', 'Lyr', 'Mir', 'Nex', 'Or', 'Pho', 'Qua', 'Rig', 'Sol', 'Tar',
  'Ul', 'Vec', 'Wyr', 'Xen', 'Yar', 'Zel', 'Ash', 'Bri', 'Cyn', 'Dra',
  'Eth', 'Fyn', 'Gry', 'Hav', 'Ith', 'Jor', 'Kra', 'Lyn', 'Mor', 'Nav',
];

/** Optional middle syllable (empty strings give shorter names) */
export const SYSTEM_MIDDLES = [
  'ta', 'ra', 'na', 'si', 'lo', 've', 'ma', 'ri', 'go', 'de',
  'pha', 'thi', 'zo', 'ka', 'mi', 'nu', 'pe', 'sa', 'ti', 'wa',
  '', '', '', '', // empty for shorter names
];

/** Final syllable of system and planet names */
export const NAME_SUFFIXES = [
  'ris', 'tus', 'nia', 'xis', 'lon', 'mir', 'ven', 'cor', 'dex', 'pho',
  'gen', 'nar', 'tos', 'lux', 'zar', 'ium', 'ora', 'eth', 'wyn', 'thar',
  'is', 'on', 'ar', 'us', 'ia', 'ax', 'en', 'os',
];

/** Greek letters used for numbered planets (e.g. "Solaris Alpha") */
export const GREEK_LETTERS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

/** First syllable of planet-specific names */
export const PLANET_PREFIXES = [
  'Ter', 'Gor', 'Pla', 'Neb', 'Cry', 'Vol', 'Oce', 'Dun',
  'Syl', 'Ash', 'Fro', 'Haz', 'Lum', 'Sto', 'Ven', 'Ari',
];

/** Station type suffixes (e.g. "Solaris Station", "Kel Outpost") */
export const STATION_TYPES = ['Station', 'Outpost', 'Port', 'Hub', 'Dock', 'Waypoint', 'Beacon'];
