import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'INITIALIZING SYSTEMS...', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00ff88',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(COLORS.ui.primary, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder textures programmatically
    this.createPlaceholderTextures();
  }

  create(): void {
    this.scene.start('GalaxyMapScene');
  }

  private createPlaceholderTextures(): void {
    // Player ship (top-down triangle)
    const shipGfx = this.make.graphics({ x: 0, y: 0 });
    shipGfx.fillStyle(0x00ff88);
    shipGfx.fillTriangle(16, 0, 0, 32, 32, 32);
    shipGfx.fillStyle(0x00aa55);
    shipGfx.fillTriangle(16, 4, 4, 28, 28, 28);
    shipGfx.generateTexture('ship_player', 32, 32);
    shipGfx.destroy();

    // Star glow
    const starGfx = this.make.graphics({ x: 0, y: 0 });
    starGfx.fillStyle(0xffffff, 0.8);
    starGfx.fillCircle(16, 16, 16);
    starGfx.fillStyle(0xffffff, 0.3);
    starGfx.fillCircle(16, 16, 24);
    starGfx.generateTexture('star_glow', 48, 48);
    starGfx.destroy();

    // Station icon
    const stationGfx = this.make.graphics({ x: 0, y: 0 });
    stationGfx.fillStyle(0xaaaaaa);
    stationGfx.fillRect(4, 4, 24, 24);
    stationGfx.fillStyle(0x666666);
    stationGfx.fillRect(8, 8, 16, 16);
    stationGfx.fillStyle(0x00aaff);
    stationGfx.fillRect(10, 10, 12, 12);
    stationGfx.generateTexture('station', 32, 32);
    stationGfx.destroy();

    // Asteroid
    const asteroidGfx = this.make.graphics({ x: 0, y: 0 });
    asteroidGfx.fillStyle(0x887766);
    asteroidGfx.fillCircle(8, 8, 7);
    asteroidGfx.fillStyle(0x665544);
    asteroidGfx.fillCircle(6, 6, 3);
    asteroidGfx.generateTexture('asteroid', 16, 16);
    asteroidGfx.destroy();

    // Pixel for particles and lines
    const pixelGfx = this.make.graphics({ x: 0, y: 0 });
    pixelGfx.fillStyle(0xffffff);
    pixelGfx.fillRect(0, 0, 2, 2);
    pixelGfx.generateTexture('pixel', 2, 2);
    pixelGfx.destroy();
  }
}
