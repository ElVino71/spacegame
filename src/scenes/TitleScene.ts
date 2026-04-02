import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../utils/Constants';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { newGame, setGameState } from '../GameState';
import { hasSave, loadGame } from '../utils/SaveSystem';

export class TitleScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private stars: any[] = [];
  private elapsed: number = 0;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const frame = getFrameManager();
    frame.enterMinimal();
    frame.hidePanel();
    frame.showCenterOverlay();

    this.graphics = this.add.graphics();
    
    // Create starfield for warp effect
    for (let i = 0; i < 400; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * GAME_WIDTH * 2,
        y: (Math.random() - 0.5) * GAME_HEIGHT * 2,
        z: Math.random() * 1000,
        speed: 0.5 + Math.random() * 2,
      });
    }

    this.setupUI();
    getAudioManager().setAmbience('transition');
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta;
    this.drawWarp(delta);
  }

  private setupUI(): void {
    const frame = getFrameManager();
    const saveExists = hasSave();

    const html = `
      <div class="title-container" style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; font-family: var(--frame-font-heading);">
        <h1 style="font-size: 80px; margin-bottom: 20px; color: var(--frame-border-color); text-shadow: 0 0 20px var(--frame-border-glow); letter-spacing: 10px;">STARWARD DRIFT</h1>
        <div style="margin-bottom: 60px; color: var(--frame-text-secondary); letter-spacing: 4px; font-size: 18px;">A 2D SPACE EXPLORATION & TRADING ADVENTURE</div>
        
        <div class="menu-options" style="display: flex; flex-direction: column; gap: 20px; width: 300px;">
          <button id="new-game-btn" class="action" style="padding: 15px 30px; font-size: 20px; width: 100%; cursor: pointer;">START NEW GAME</button>
          <button id="continue-btn" class="action ${saveExists ? '' : 'disabled'}" style="padding: 15px 30px; font-size: 20px; width: 100%; cursor: pointer;" ${saveExists ? '' : 'disabled'}>CONTINUE GAME</button>
        </div>
        
        <div style="margin-top: 60px; font-size: 14px; color: var(--frame-border-color); opacity: 0.7; letter-spacing: 2px;">By ElVino</div>
        <div style="margin-top: 20px; font-size: 12px; color: var(--frame-text-muted); opacity: 0.5;">
          &copy; 2026 STARWARD DRIFT - ALPHA BUILD
        </div>
      </div>
    `;

    frame.setCenterContent(html);

    const container = frame.getCenterContentEl();
    const newGameBtn = container.querySelector('#new-game-btn');
    const continueBtn = container.querySelector('#continue-btn');

    newGameBtn?.addEventListener('click', () => {
      newGame();
      this.scene.start('GalaxyMapScene');
    });

    if (saveExists) {
      continueBtn?.addEventListener('click', () => {
        const state = loadGame();
        if (state) {
          setGameState(state);
          this.scene.start('GalaxyMapScene');
        }
      });
    }
  }

  private drawWarp(delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const speedMult = 2.0; // Steady warp speed for title

    this.graphics.clear();
    this.graphics.fillStyle(0x000011, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const star of this.stars) {
      star.z -= star.speed * speedMult * delta * 0.1;
      if (star.z <= 1) {
        star.z = 1000;
        star.x = (Math.random() - 0.5) * GAME_WIDTH * 2;
        star.y = (Math.random() - 0.5) * GAME_HEIGHT * 2;
      }

      const sx = cx + star.x / star.z * 400;
      const sy = cy + star.y / star.z * 400;

      if (sx < -10 || sx > GAME_WIDTH + 10 || sy < -10 || sy > GAME_HEIGHT + 10) continue;

      const prevZ = star.z + star.speed * speedMult * delta * 0.1;
      const px = cx + star.x / prevZ * 400;
      const py = cy + star.y / prevZ * 400;

      const brightness = Math.min(1, 800 / star.z);
      this.graphics.lineStyle(1 + brightness, 0x44aaff, brightness * 0.5);
      this.graphics.lineBetween(sx, sy, px, py);
    }
    
    // Core glow
    const glowAlpha = 0.05;
    this.graphics.fillStyle(0x4488ff, glowAlpha);
    this.graphics.fillCircle(cx, cy, 100);
    this.graphics.fillStyle(0xaaccff, glowAlpha * 0.5);
    this.graphics.fillCircle(cx, cy, 40);
  }
}
