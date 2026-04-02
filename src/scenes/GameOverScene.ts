import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { deleteSave } from '../utils/SaveSystem';

export class GameOverScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: number }[] = [];
  private elapsed: number = 0;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(): void {
    // Delete save so player can't continue
    deleteSave();

    const frame = getFrameManager();
    frame.enterMinimal();
    frame.hidePanel();
    frame.showCenterOverlay();

    this.graphics = this.add.graphics();
    this.elapsed = 0;
    this.particles = [];

    // Spawn explosion debris particles
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 80;
      this.particles.push({
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 2 + Math.random() * 4,
        size: 1 + Math.random() * 3,
        color: [0xff4444, 0xff8800, 0xffcc00, 0xff2200, 0xaa0000][Math.floor(Math.random() * 5)],
      });
    }

    // Show UI after a short delay for dramatic effect
    this.time.delayedCall(1500, () => this.showGameOverUI());

    getAudioManager().setAmbience('transition');
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta;
    this.drawScene(delta);
  }

  private drawScene(delta: number): void {
    const dt = delta / 1000;
    this.graphics.clear();
    this.graphics.fillStyle(0x000000, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw drifting debris particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.life += dt;

      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (alpha <= 0) continue;

      this.graphics.fillStyle(p.color, alpha * 0.8);
      this.graphics.fillCircle(p.x, p.y, p.size * alpha);
    }

    // Faint red glow at center
    const glowAlpha = Math.max(0, 0.15 - this.elapsed * 0.00005);
    this.graphics.fillStyle(0xff2200, glowAlpha);
    this.graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 80);
  }

  private showGameOverUI(): void {
    const frame = getFrameManager();

    frame.setCenterContent(`
      <div style="text-align:center;padding:60px 40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:var(--frame-font-heading);">
        <h1 style="font-size:72px;margin-bottom:10px;color:#ff4444;text-shadow:0 0 30px #ff0000,0 0 60px #aa0000;letter-spacing:8px;">GAME OVER</h1>
        <div style="margin-bottom:40px;color:#aa6666;letter-spacing:3px;font-size:16px;">YOUR SHIP HAS BEEN DESTROYED</div>
        <div style="color:#666;font-style:italic;font-size:13px;max-width:400px;line-height:1.6;margin-bottom:50px;">
          The void claims another vessel. Your wreckage drifts silently among the stars, 
          a testament to the dangers of the frontier.
        </div>
        <button id="btn-title" class="action" style="padding:15px 40px;font-size:18px;cursor:pointer;width:280px;">RETURN TO TITLE</button>
      </div>
    `);

    const goTitle = () => {
      this.input.keyboard!.off('keydown-SPACE', goTitle);
      frame.hideCenterOverlay();
      this.scene.start('TitleScene');
    };

    frame.getCenterContentEl().querySelector('#btn-title')?.addEventListener('click', goTitle);
    this.input.keyboard!.on('keydown-SPACE', goTitle);
  }

  shutdown(): void {
    this.particles = [];
  }
}
