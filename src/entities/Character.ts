import { CrewRole, NPCRole } from '../data/characters';

export interface PortraitSeed {
  skinTone: number;
  hairColor: number;
  faceShape: number;
  mouth: number;
  hair: number;
  eyes: number;
  nose: number;
  ears: number;
  chin: number;
  accessory: number;
}

export interface CharacterStats {
  piloting: number;
  engineering: number;
  combat: number;
  science: number;
  charisma: number;
}

export interface CrewMember {
  id: string;
  name: string;
  portraitSeed: PortraitSeed;
  role: CrewRole;
  stats: CharacterStats;
  morale: number; // 0-100
  salary: number;
  bio: string;
  factionOrigin: string;
  assignedRoom?: string;
}

export interface StationNPC {
  id: string;
  name: string;
  portraitSeed: PortraitSeed;
  role: NPCRole;
  factionIndex: number;
  bio: string;
  stats: CharacterStats;
}
