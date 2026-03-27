import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const frame = getFrameManager();
    frame.enterMinimal();

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

    // Load tile PNGs (editable by user in assets/tiles/)
    const tileNames = ['ground_1', 'ground_2', 'ground_3', 'rock', 'mineral', 'ruin', 'settlement', 'water', 'lava', 'player', 'rover'];
    for (const name of tileNames) {
      this.load.image(`tile_${name}`, `assets/tiles/${name}.png`);
    }

    // Load flora tiles
    const floraNames = ['tree_1', 'tree_2', 'bush_1', 'bush_2', 'mushroom', 'crystal_plant', 'cactus', 'flower', 'moss', 'vine'];
    for (const name of floraNames) {
      this.load.image(`flora_${name}`, `assets/tiles/flora/${name}.png`);
    }

    // Load fauna tiles
    const faunaNames = ['critter_1', 'critter_2', 'grazer', 'predator', 'flyer', 'insect'];
    for (const name of faunaNames) {
      this.load.image(`fauna_${name}`, `assets/tiles/fauna/${name}.png`);
    }

    // Load ruins interior tiles
    const ruinsTileNames = [
      'floor_1', 'floor_2', 'floor_3', 'wall',
      'door_closed', 'door_open',
      'trap', 'trap_triggered',
      'treasure', 'treasure_open',
      'lore', 'lore_read',
      'rubble', 'stairs_up', 'stairs_down',
      'encounter', 'encounter_cleared',
    ];
    for (const name of ruinsTileNames) {
      this.load.image(`ruins_${name}`, `assets/tiles/ruins/${name}.png`);
    }

    // Load settlement tiles
    const settlementTileNames = [
      'road', 'road_cross', 'building_wall', 'building_floor', 'building_door',
      'shop_trade', 'shop_modules', 'plaza', 'fence', 'lamp', 'person',
    ];
    for (const name of settlementTileNames) {
      this.load.image(`settlement_${name}`, `assets/tiles/settlement/${name}.png`);
    }

    // Load room interior tiles (per theme)
    const themes = ['retro-scifi', 'biological', 'steampunk', 'military', 'alien'];
    const roomTileNames = [
      'floor', 'wall', 'corridor',
      'bg_bridge', 'bg_engine', 'bg_weapons', 'bg_shields', 'bg_cargo',
      'bg_sensors', 'bg_computer', 'bg_mining', 'bg_life_support', 'bg_hull',
    ];
    // Variant tiles (3 per room bg type + corridor)
    const roomBgTypes = [
      'bg_bridge', 'bg_engine', 'bg_weapons', 'bg_shields', 'bg_cargo',
      'bg_sensors', 'bg_computer', 'bg_mining', 'bg_life_support', 'bg_hull',
      'corridor',
    ];
    const variantNames = roomBgTypes.flatMap(bg =>
      [1, 2, 3].map(v => `${bg}_v${v}`)
    );
    // Generic decoration tiles
    const decoNames = ['deco_porthole', 'deco_pipes', 'deco_panel', 'deco_vent'];
    const allRoomTiles = [...roomTileNames, ...variantNames, ...decoNames];
    for (const theme of themes) {
      for (const name of allRoomTiles) {
        this.load.image(`room_${theme}_${name}`, `assets/tiles/rooms/${theme}/${name}.png`);
      }
    }

    // Load portrait tiles
    const portraitParts = ['face', 'mouth', 'hair_top', 'hair_left', 'hair_right', 'ear_left', 'ear_right', 'chin_left', 'chin_right'];
    const partCounts: Record<string, number> = {
      face: 6, mouth: 4, hair_top: 8, hair_left: 8, hair_right: 8, ear_left: 4, ear_right: 4, chin_left: 4, chin_right: 4
    };
    for (const part of portraitParts) {
      const count = partCounts[part];
      for (let i = 0; i < count; i++) {
        this.load.image(`portrait_${part}_${i}`, `assets/tiles/portraits/${part}/${part}_${i}.png`);
      }
    }
  }

  create(): void {
    // Initialize audio on first user interaction (required by browsers)
    const initAudio = () => {
      getAudioManager();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    this.scene.start('TitleScene');
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
