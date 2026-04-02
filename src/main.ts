import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GalaxyMapScene } from './scenes/GalaxyMapScene';
import { SystemScene } from './scenes/SystemScene';
import { ShipInteriorScene } from './scenes/ShipInteriorScene';
import { PlanetSurfaceScene } from './scenes/PlanetSurfaceScene';
import { TerminalScene } from './scenes/TerminalScene';
import { StationScene } from './scenes/StationScene';
import { TransitionScene } from './scenes/TransitionScene';
import { RuinsScene } from './scenes/RuinsScene';
import { SettlementScene } from './scenes/SettlementScene';
import { SpaceInteractionScene } from './scenes/SpaceInteractionScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/Constants';
import { getFrameManager } from './ui/FrameManager';

// Initialize the frame system first
const frame = getFrameManager();
frame.init();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: frame.getCanvasArea(),
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
    TitleScene,
    GalaxyMapScene,
    SystemScene,
    ShipInteriorScene,
    PlanetSurfaceScene,
    TerminalScene,
    StationScene,
    RuinsScene,
    SettlementScene,
    SpaceInteractionScene,
    GameOverScene,
    TransitionScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
