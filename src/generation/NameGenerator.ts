import { SeededRandom } from '../utils/SeededRandom';
import { SYSTEM_PREFIXES, SYSTEM_MIDDLES, NAME_SUFFIXES, GREEK_LETTERS, PLANET_PREFIXES, STATION_TYPES } from '../data/names';

export function generateSystemName(rng: SeededRandom): string {
  const prefix = rng.pick(SYSTEM_PREFIXES);
  const middle = rng.pick(SYSTEM_MIDDLES);
  const suffix = rng.pick(NAME_SUFFIXES);

  // Sometimes add a catalog number
  if (rng.chance(0.3)) {
    return `${prefix}${middle}${suffix}-${rng.int(1, 99)}`;
  }
  return `${prefix}${middle}${suffix}`;
}

export function generatePlanetName(systemName: string, index: number, rng: SeededRandom): string {
  if (rng.chance(0.5) && index < GREEK_LETTERS.length) {
    return `${systemName} ${GREEK_LETTERS[index]}`;
  }
  const prefix = rng.pick(PLANET_PREFIXES);
  const suffix = rng.pick(NAME_SUFFIXES);
  return `${prefix}${suffix}`;
}

export function generateStationName(systemName: string, rng: SeededRandom): string {
  const stationType = rng.pick(STATION_TYPES);
  if (rng.chance(0.5)) {
    return `${systemName} ${stationType}`;
  }
  const prefix = rng.pick(SYSTEM_PREFIXES);
  return `${prefix} ${stationType}`;
}
