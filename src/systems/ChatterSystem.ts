import Phaser from 'phaser';
import { getFrameManager } from '../ui/FrameManager';
import { getGameState } from '../GameState';
import { IDLE_BANTER, SYSTEM_CHATTER, SURFACE_CHATTER, STATION_CHATTER, ChatterEntry } from '../data/chatter';

export class ChatterSystem {
  private static instance: ChatterSystem | null = null;
  private scene: Phaser.Scene | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private lastChatterTime: number = 0;
  private minInterval: number = 15000; // 15 seconds
  private maxInterval: number = 45000; // 45 seconds

  static getInstance(): ChatterSystem {
    if (!ChatterSystem.instance) {
      ChatterSystem.instance = new ChatterSystem();
    }
    return ChatterSystem.instance;
  }

  private constructor() {}

  /** Attach to a scene to start the chatter timer */
  attach(scene: Phaser.Scene): void {
    this.stop();
    this.scene = scene;
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
}

export function getChatterSystem(): ChatterSystem {
  return ChatterSystem.getInstance();
}
