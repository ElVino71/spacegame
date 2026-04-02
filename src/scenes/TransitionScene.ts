import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../utils/Constants';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';

export type TransitionType = 'warp' | 'land' | 'takeoff' | 'dock' | 'undock' | 'encounter';

interface TransitionConfig {
  type: TransitionType;
  targetScene: string;
  targetData?: any;
  text?: string;
}

const WARP_DURATION = 2200;
const LAND_DURATION = 1800;

export class TransitionScene extends Phaser.Scene {
  private config!: TransitionConfig;
  private graphics!: Phaser.GameObjects.Graphics;
  private stars: { x: number; y: number; z: number; speed: number }[] = [];
  private elapsed = 0;

  constructor() {
    super({ key: 'TransitionScene' });
  }

  init(data: TransitionConfig): void {
    this.config = data;
    this.elapsed = 0;
  }

  create(): void {
    // Frame: minimal mode (border visible, no bars/panel)
    const frame = getFrameManager();
    frame.enterMinimal();

    // Fade out ambient music during transitions
    getAudioManager().stopAmbience(0.5);

    this.cameras.main.setViewport(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x000000);
    this.graphics = this.add.graphics();

    // Generate star particles for warp effect
    this.stars = [];
    const starCount = this.config.type === 'warp' ? 300 : 150;
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * GAME_WIDTH * 2,
        y: (Math.random() - 0.5) * GAME_HEIGHT * 2,
        z: Math.random() * 1000,
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    // Status text
    const label = this.config.text ?? this.getDefaultText();
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, label, {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '14px',
      color: '#00ff88',
    }).setOrigin(0.5).setAlpha(0.8).setDepth(10);

    const duration = this.getDuration();
    this.time.delayedCall(duration, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(this.config.targetScene, this.config.targetData);
      });
    });
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta;
    this.graphics.clear();

    switch (this.config.type) {
      case 'warp': this.drawWarp(delta); break;
      case 'land': this.drawLanding(delta); break;
      case 'takeoff': this.drawTakeoff(delta); break;
      case 'dock': this.drawDock(delta); break;
      case 'undock': this.drawTakeoff(delta); break;
      case 'encounter': this.drawWarp(delta); break;
    }
  }

  private getDuration(): number {
    switch (this.config.type) {
      case 'warp': return WARP_DURATION;
      case 'land': return LAND_DURATION;
      case 'takeoff': return LAND_DURATION;
      case 'dock': return 1400;
      case 'undock': return 1400;
      case 'encounter': return 1200;
    }
  }

  private getDefaultText(): string {
    switch (this.config.type) {
      case 'warp': return 'ENGAGING WARP DRIVE...';
      case 'land': return 'ENTERING ATMOSPHERE...';
      case 'takeoff': return 'LAUNCHING FROM SURFACE...';
      case 'dock': return 'DOCKING SEQUENCE INITIATED...';
      case 'undock': return 'UNDOCKING...';
      case 'encounter': return 'CONTACT!';
    }
  }

  // ─── WARP EFFECT ────────────────────────────────────────

  private drawWarp(delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const progress = Math.min(this.elapsed / WARP_DURATION, 1);

    const speedMult = Math.sin(progress * Math.PI) * 8 + 0.5;

    this.graphics.fillStyle(0x000022, 0.02);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const star of this.stars) {
      star.z -= star.speed * speedMult * delta * 0.8;
      if (star.z <= 1) {
        star.z = 800 + Math.random() * 200;
        star.x = (Math.random() - 0.5) * GAME_WIDTH * 2;
        star.y = (Math.random() - 0.5) * GAME_HEIGHT * 2;
      }

      const sx = cx + star.x / star.z * 400;
      const sy = cy + star.y / star.z * 400;

      if (sx < -10 || sx > GAME_WIDTH + 10 || sy < -10 || sy > GAME_HEIGHT + 10) continue;

      const prevZ = star.z + star.speed * speedMult * delta * 0.8;
      const px = cx + star.x / prevZ * 400;
      const py = cy + star.y / prevZ * 400;

      const brightness = Math.min(1, 800 / star.z);
      const blueShift = Math.min(speedMult / 6, 1);
      const r = Math.floor(200 * brightness * (1 - blueShift * 0.6));
      const g = Math.floor(220 * brightness * (1 - blueShift * 0.3));
      const b = Math.floor(255 * brightness);
      const color = (r << 16) | (g << 8) | b;

      this.graphics.lineStyle(1 + brightness, color, brightness * 0.9);
      this.graphics.lineBetween(sx, sy, px, py);
    }

    const glowAlpha = 0.05 + speedMult * 0.02;
    this.graphics.fillStyle(0x4488ff, glowAlpha);
    this.graphics.fillCircle(cx, cy, 80 + speedMult * 15);
    this.graphics.fillStyle(0xaaccff, glowAlpha * 0.5);
    this.graphics.fillCircle(cx, cy, 30 + speedMult * 5);
  }

  // ─── LANDING EFFECT ─────────────────────────────────────

  private drawLanding(delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const progress = Math.min(this.elapsed / LAND_DURATION, 1);

    const heatPhase = Math.min(progress * 2, 1);
    const descentPhase = Math.max((progress - 0.3) / 0.7, 0);

    for (const star of this.stars) {
      star.y += star.speed * delta * (2 + heatPhase * 6);
      if (star.y > GAME_HEIGHT + 20) {
        star.y = -20;
        star.x = Math.random() * GAME_WIDTH;
      }

      const streakLen = 3 + heatPhase * 15;

      if (heatPhase > 0.2 && heatPhase < 0.9) {
        const heat = Math.sin((heatPhase - 0.2) / 0.7 * Math.PI);
        const r = Math.floor(255 * heat);
        const g = Math.floor(140 * heat * 0.6);
        const b = Math.floor(50 * heat * 0.2);
        const color = (r << 16) | (g << 8) | b;
        this.graphics.lineStyle(1, color, heat * 0.4 * star.speed);
        this.graphics.lineBetween(star.x, star.y, star.x, star.y - streakLen);
      } else {
        this.graphics.lineStyle(1, 0xffffff, 0.2 * star.speed);
        this.graphics.lineBetween(star.x, star.y, star.x, star.y - streakLen * 0.3);
      }
    }

    if (heatPhase > 0.2 && heatPhase < 0.9) {
      const heat = Math.sin((heatPhase - 0.2) / 0.7 * Math.PI);
      this.graphics.fillStyle(0xff6622, heat * 0.15);
      this.graphics.fillCircle(cx, cy - 40, 60 + heat * 30);
      this.graphics.fillStyle(0xff4400, heat * 0.08);
      this.graphics.fillCircle(cx, cy - 40, 100 + heat * 40);
    }

    if (descentPhase > 0) {
      const surfaceY = GAME_HEIGHT + 100 - descentPhase * 250;
      this.graphics.fillStyle(0x334422, 0.6 * descentPhase);
      this.graphics.fillRect(0, surfaceY, GAME_WIDTH, GAME_HEIGHT - surfaceY + 200);
      this.graphics.lineStyle(2, 0x556633, 0.3 * descentPhase);
      this.graphics.lineBetween(0, surfaceY, GAME_WIDTH, surfaceY);

      for (let i = 0; i < 8; i++) {
        const lx = (i / 8) * GAME_WIDTH + descentPhase * 30;
        this.graphics.lineStyle(1, 0x445522, 0.2 * descentPhase);
        this.graphics.lineBetween(lx, surfaceY + 20, lx + 40, surfaceY + 100);
      }
    }

    this.graphics.fillStyle(0x88aaaa, 0.6);
    this.graphics.fillRect(cx - 10, cy - 45, 20, 25);
    this.graphics.fillTriangle(cx, cy + 5, cx - 15, cy - 20, cx + 15, cy - 20);
  }

  // ─── TAKEOFF EFFECT ─────────────────────────────────────

  private drawTakeoff(delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const progress = Math.min(this.elapsed / LAND_DURATION, 1);

    const ascentPhase = Math.min(progress * 1.5, 1);
    const exitPhase = Math.max((progress - 0.5) / 0.5, 0);

    if (ascentPhase < 1) {
      const surfaceY = GAME_HEIGHT - 150 + ascentPhase * 300;
      this.graphics.fillStyle(0x334422, 0.6 * (1 - ascentPhase));
      this.graphics.fillRect(0, surfaceY, GAME_WIDTH, GAME_HEIGHT - surfaceY + 200);
      this.graphics.lineStyle(2, 0x556633, 0.3 * (1 - ascentPhase));
      this.graphics.lineBetween(0, surfaceY, GAME_WIDTH, surfaceY);
    }

    for (const star of this.stars) {
      star.y -= star.speed * delta * (1 + ascentPhase * 4);
      if (star.y < -20) {
        star.y = GAME_HEIGHT + 20;
        star.x = Math.random() * GAME_WIDTH;
      }

      const streakLen = 2 + ascentPhase * 8;
      this.graphics.lineStyle(1, 0xffffff, 0.15 + exitPhase * 0.2);
      this.graphics.lineBetween(star.x, star.y, star.x, star.y + streakLen);
    }

    const engineGlow = 0.3 + ascentPhase * 0.5;
    this.graphics.fillStyle(0xff8833, engineGlow * 0.3);
    this.graphics.fillCircle(cx, cy + 20, 20 + ascentPhase * 15);
    this.graphics.fillStyle(0xffcc66, engineGlow * 0.2);
    this.graphics.fillCircle(cx, cy + 15, 8 + ascentPhase * 5);

    this.graphics.fillStyle(0x88aaaa, 0.6);
    this.graphics.fillTriangle(cx, cy - 50, cx - 15, cy - 20, cx + 15, cy - 20);
    this.graphics.fillRect(cx - 10, cy - 20, 20, 25);

    if (exitPhase > 0) {
      this.graphics.fillStyle(0xffffff, exitPhase * 0.3);
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 137.5) % GAME_WIDTH);
        const sy = ((i * 89.3) % GAME_HEIGHT);
        this.graphics.fillRect(sx, sy, 1, 1);
      }
    }
  }

  // ─── DOCK EFFECT ────────────────────────────────────────

  private drawDock(delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const progress = Math.min(this.elapsed / 1400, 1);

    const gateOpen = 1 - progress;

    this.graphics.fillStyle(0x223344, 0.8);
    this.graphics.fillRect(0, 0, GAME_WIDTH, cy - 120 * gateOpen);
    this.graphics.fillRect(0, cy + 120 * gateOpen, GAME_WIDTH, GAME_HEIGHT);

    const blink = Math.sin(this.elapsed * 0.01) > 0;
    for (let i = 0; i < 6; i++) {
      const lx = GAME_WIDTH * (i + 0.5) / 6;
      this.graphics.fillStyle(blink ? 0x00ff44 : 0x004411, 0.6);
      this.graphics.fillCircle(lx, cy - 120 * gateOpen, 3);
      this.graphics.fillCircle(lx, cy + 120 * gateOpen, 3);
    }

    this.graphics.lineStyle(1, 0x00ff88, 0.1 + progress * 0.2);
    this.graphics.lineBetween(cx - 100, 0, cx - 30, cy);
    this.graphics.lineBetween(cx + 100, 0, cx + 30, cy);

    for (const star of this.stars) {
      star.z -= star.speed * delta * 0.3 * gateOpen;
      if (star.z <= 1) star.z = 500;

      const sx = cx + star.x / star.z * 300;
      const sy = cy + star.y / star.z * 300;
      if (sx < 0 || sx > GAME_WIDTH || sy < 0 || sy > GAME_HEIGHT) continue;

      this.graphics.fillStyle(0xffffff, 0.3 * gateOpen);
      this.graphics.fillRect(sx, sy, 1, 1);
    }
  }
}
