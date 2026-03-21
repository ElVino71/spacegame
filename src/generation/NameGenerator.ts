import { SeededRandom } from '../utils/SeededRandom';

const PREFIXES = [
  'Al', 'Be', 'Cor', 'Del', 'Er', 'Fa', 'Gal', 'Hel', 'Ix', 'Jen',
  'Kel', 'Lyr', 'Mir', 'Nex', 'Or', 'Pho', 'Qua', 'Rig', 'Sol', 'Tar',
  'Ul', 'Vec', 'Wyr', 'Xen', 'Yar', 'Zel', 'Ash', 'Bri', 'Cyn', 'Dra',
  'Eth', 'Fyn', 'Gry', 'Hav', 'Ith', 'Jor', 'Kra', 'Lyn', 'Mor', 'Nav',
];

const MIDDLES = [
  'ta', 'ra', 'na', 'si', 'lo', 've', 'ma', 'ri', 'go', 'de',
  'pha', 'thi', 'zo', 'ka', 'mi', 'nu', 'pe', 'sa', 'ti', 'wa',
  '', '', '', '', // empty for shorter names
];

const SUFFIXES = [
  'ris', 'tus', 'nia', 'xis', 'lon', 'mir', 'ven', 'cor', 'dex', 'pho',
  'gen', 'nar', 'tos', 'lux', 'zar', 'ium', 'ora', 'eth', 'wyn', 'thar',
  'is', 'on', 'ar', 'us', 'ia', 'ax', 'en', 'os',
];

const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

const PLANET_PREFIXES = [
  'Ter', 'Gor', 'Pla', 'Neb', 'Cry', 'Vol', 'Oce', 'Dun',
  'Syl', 'Ash', 'Fro', 'Haz', 'Lum', 'Sto', 'Ven', 'Ari',
];

const STATION_TYPES = ['Station', 'Outpost', 'Port', 'Hub', 'Dock', 'Waypoint', 'Beacon'];

export function generateSystemName(rng: SeededRandom): string {
  const prefix = rng.pick(PREFIXES);
  const middle = rng.pick(MIDDLES);
  const suffix = rng.pick(SUFFIXES);

  // Sometimes add a catalog number
  if (rng.chance(0.3)) {
    return `${prefix}${middle}${suffix}-${rng.int(1, 99)}`;
  }
  return `${prefix}${middle}${suffix}`;
}

export function generatePlanetName(systemName: string, index: number, rng: SeededRandom): string {
  if (rng.chance(0.5) && index < GREEK.length) {
    return `${systemName} ${GREEK[index]}`;
  }
  const prefix = rng.pick(PLANET_PREFIXES);
  const suffix = rng.pick(SUFFIXES);
  return `${prefix}${suffix}`;
}

export function generateStationName(systemName: string, rng: SeededRandom): string {
  const stationType = rng.pick(STATION_TYPES);
  if (rng.chance(0.5)) {
    return `${systemName} ${stationType}`;
  }
  const prefix = rng.pick(PREFIXES);
  return `${prefix} ${stationType}`;
}
