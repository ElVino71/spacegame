import { SeededRandom } from '../utils/SeededRandom';
import { 
  FIRST_NAMES, SURNAMES, BIO_TEMPLATES, PERSONALITY_TRAITS, BACKGROUNDS, 
  CREW_SALARY_RANGE, CrewRole, NPCRole, NPC_ROLES, CREW_ROLES, PORTRAIT_PALETTES 
} from '../data/characters';
import { FACTION_NAMES } from '../data/factions';
import { PortraitSeed, CharacterStats, CrewMember, StationNPC } from '../entities/Character';

export class CharacterGenerator {
  
  static generateCharacterName(rng: SeededRandom, factionIndex: number): string {
    const factionName = FACTION_NAMES[factionIndex] || 'Independent';
    const firstPool = FIRST_NAMES[factionName] || FIRST_NAMES['Independent'];
    const lastPool = SURNAMES[factionName] || SURNAMES['Independent'];
    
    return `${rng.pick(firstPool)} ${rng.pick(lastPool)}`;
  }

  static generatePortraitSeed(rng: SeededRandom): PortraitSeed {
    // Hair variant index shared across all 3 hair tiles (top, left, right)
    const hairVariant = rng.int(0, 7); 
    
    return {
      skinTone: rng.int(0, PORTRAIT_PALETTES.skin.length - 1),
      hairColor: rng.int(0, PORTRAIT_PALETTES.hair.length - 1),
      faceShape: rng.int(0, 5),
      mouth: rng.int(0, 3),
      hair: hairVariant,
      eyes: rng.int(0, 5), // Often tied to faceShape in tiles, but we keep separate seed
      nose: rng.int(0, 5),
      ears: rng.int(0, 3),
      chin: rng.int(0, 3),
      accessory: rng.int(0, 10), // 0-5 might be nothing, 6-10 some accessory
    };
  }

  static generateStats(rng: SeededRandom, role: CrewRole | NPCRole): CharacterStats {
    const stats: CharacterStats = {
      piloting: rng.int(1, 5),
      engineering: rng.int(1, 5),
      combat: rng.int(1, 5),
      science: rng.int(1, 5),
      charisma: rng.int(1, 5),
    };

    // Role influences primary stat weighting
    switch (role) {
      case 'pilot': stats.piloting += rng.int(3, 5); break;
      case 'engineer': stats.engineering += rng.int(3, 5); break;
      case 'gunner': stats.combat += rng.int(3, 5); break;
      case 'scientist': stats.science += rng.int(3, 5); break;
      case 'medic': stats.science += rng.int(2, 4); stats.charisma += rng.int(1, 3); break;
      case 'navigator': stats.piloting += rng.int(2, 4); stats.science += rng.int(2, 4); break;
      case 'merchant': stats.charisma += rng.int(3, 5); break;
      case 'mechanic': stats.engineering += rng.int(3, 5); break;
      case 'recruiter': stats.charisma += rng.int(2, 4); break;
    }

    // Clamp stats to 10
    (Object.keys(stats) as (keyof CharacterStats)[]).forEach(k => {
      stats[k] = Math.min(10, stats[k]);
    });

    return stats;
  }

  static generateBio(rng: SeededRandom, factionIndex: number, role: string): string {
    const faction = FACTION_NAMES[factionIndex] || 'Independent';
    const trait = rng.pick(PERSONALITY_TRAITS);
    const background = rng.pick(BACKGROUNDS);
    const template = rng.pick(BIO_TEMPLATES);

    return template
      .replace('{personality}', trait)
      .replace('{role}', role)
      .replace('{faction}', faction)
      .replace('{background}', background);
  }

  static generateCrewMember(rng: SeededRandom, factionIndex: number, role?: CrewRole): CrewMember {
    const r = role || rng.pick([...CREW_ROLES]);
    const name = this.generateCharacterName(rng, factionIndex);
    const salary = rng.int(CREW_SALARY_RANGE[r].min, CREW_SALARY_RANGE[r].max);

    return {
      id: `crew_${rng.int(10000, 99999)}`,
      name,
      portraitSeed: this.generatePortraitSeed(rng),
      role: r,
      stats: this.generateStats(rng, r),
      morale: 100,
      salary,
      bio: this.generateBio(rng, factionIndex, r),
      factionOrigin: FACTION_NAMES[factionIndex] || 'Independent',
    };
  }

  static generateStationNPCs(systemId: number, stationName: string, galaxySeed: number): StationNPC[] {
    // Deterministic per station
    const stationSeed = galaxySeed ^ (systemId * 31337) ^ hashString(stationName);
    const rng = new SeededRandom(stationSeed);
    
    const npcs: StationNPC[] = [];
    const count = rng.int(3, 5);
    
    // Always a merchant
    npcs.push(this.generateNPC(rng.fork(1), 'merchant', systemId % FACTION_NAMES.length));
    
    // Fill rest with random roles
    const otherRoles: NPCRole[] = ['mechanic', 'bartender', 'recruiter', 'fence', 'info_broker'];
    rng.shuffle(otherRoles);
    
    for (let i = 1; i < count; i++) {
      const role = otherRoles[i - 1] || 'bartender';
      npcs.push(this.generateNPC(rng.fork(i + 1), role, (systemId + i) % FACTION_NAMES.length));
    }

    return npcs;
  }

  private static generateNPC(rng: SeededRandom, role: NPCRole, factionIndex: number): StationNPC {
    return {
      id: `npc_${rng.int(10000, 99999)}`,
      name: this.generateCharacterName(rng, factionIndex),
      portraitSeed: this.generatePortraitSeed(rng),
      role,
      factionIndex,
      bio: this.generateBio(rng, factionIndex, role),
      stats: this.generateStats(rng, role),
    };
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash >>> 0;
}
