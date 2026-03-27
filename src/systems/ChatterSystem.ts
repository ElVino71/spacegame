import Phaser from 'phaser';
import { getFrameManager } from '../ui/FrameManager';
import { getGameState } from '../GameState';
import { IDLE_BANTER, SYSTEM_CHATTER, SURFACE_CHATTER, STATION_CHATTER, CREW_CHATTER, ChatterEntry, CrewChatterTemplate } from '../data/chatter';

export class ChatterSystem {
  private static instance: ChatterSystem | null = null;
  private scene: Phaser.Scene | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private lastChatterTime: number = 0;
  private minInterval: number = 15000; // 15 seconds
  private maxInterval: number = 45000; // 45 seconds
  private extraChatter: string[] = [];

  static getInstance(): ChatterSystem {
    if (!ChatterSystem.instance) {
      ChatterSystem.instance = new ChatterSystem();
    }
    return ChatterSystem.instance;
  }

  private constructor() {}

  /** Attach to a scene to start the chatter timer. Optional extra lines for scene-specific chatter. */
  attach(scene: Phaser.Scene, extraLines?: string[]): void {
    this.stop();
    this.scene = scene;
    this.extraChatter = extraLines || [];
    this.scheduleNextChatter();
  }

  /** Stop chatter (e.g. when entering terminal) */
  stop(): void {
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }
    this.scene = null;
  }

  private scheduleNextChatter(): void {
    if (!this.scene) return;

    const delay = Phaser.Math.Between(this.minInterval, this.maxInterval);
    this.timer = this.scene.time.delayedCall(delay, () => {
      this.triggerChatter();
      this.scheduleNextChatter();
    });
  }

  private triggerChatter(): void {
    if (!this.scene) return;

    const sceneKey = this.scene.scene.key;
    const pool: ChatterEntry[] = [...IDLE_BANTER];

    // Context-aware additions
    if (sceneKey === 'SystemScene') {
      pool.push(...SYSTEM_CHATTER);
    } else if (sceneKey === 'PlanetSurfaceScene') {
      pool.push(...SURFACE_CHATTER);
    } else if (sceneKey === 'StationScene') {
      pool.push(...STATION_CHATTER);
    }

    // Add any extra scene-specific chatter lines
    if (this.extraChatter.length > 0) {
      pool.push(...this.extraChatter.map(text => ({ text, weight: 2, color: '#aa88cc' })));
    }

    // Add crew-specific chatter if crew exists
    const crew = getGameState().player.crew || [];
    if (crew.length > 0) {
      const crewEntries = this.resolveCrewChatter(crew);
      pool.push(...crewEntries);
    }

    if (pool.length === 0) return;

    // Weighted random selection
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let random = Math.random() * totalWeight;

    let selected: ChatterEntry = pool[0];
    for (const entry of pool) {
      if (random < entry.weight) {
        selected = entry;
        break;
      }
      random -= entry.weight;
    }

    getFrameManager().addChatter(selected.text, selected.color);
  }

  private resolveCrewChatter(crew: { name: string; role: string; morale: number; assignedRoom?: string }[]): ChatterEntry[] {
    const entries: ChatterEntry[] = [];

    for (const template of CREW_CHATTER) {
      // Filter by role if specified
      const eligible = template.role
        ? crew.filter(c => c.role === template.role)
        : crew;

      for (const member of eligible) {
        // Filter by morale range
        if (template.moraleMin !== undefined && member.morale < template.moraleMin) continue;
        if (template.moraleMax !== undefined && member.morale > template.moraleMax) continue;

        // Resolve room label
        const roomName = (member.assignedRoom || 'bridge').replace(/_/g, ' ');

        entries.push({
          text: template.text
            .replace(/\{name\}/g, member.name.split(' ')[0]) // Use first name only
            .replace(/\{role\}/g, member.role)
            .replace(/\{room\}/g, roomName),
          weight: template.weight,
          color: template.color,
        });
      }
    }

    return entries;
  }
}

export function getChatterSystem(): ChatterSystem {
  return ChatterSystem.getInstance();
}
