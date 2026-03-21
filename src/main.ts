import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GalaxyMapScene } from './scenes/GalaxyMapScene';
import { SystemScene } from './scenes/SystemScene';
import { ShipInteriorScene } from './scenes/ShipInteriorScene';
import { PlanetSurfaceScene } from './scenes/PlanetSurfaceScene';
import { TerminalScene } from './scenes/TerminalScene';
import { StationScene } from './scenes/StationScene';
import { TransitionScene } from './scenes/TransitionScene';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/Constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#0a0a1a',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [
    BootScene,
    GalaxyMapScene,
    SystemScene,
    ShipInteriorScene,
    PlanetSurfaceScene,
    TerminalScene,
    StationScene,
    TransitionScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
