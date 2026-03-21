import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { PlanetData } from '../entities/StarSystem';
import { SeededRandom } from '../utils/SeededRandom';
import { getCargoCapacity, getCargoUsed } from '../entities/Player';

const MAP_SIZE = 128;
const TILE_SIZE = 16;
const PANEL_WIDTH = 240;
const MOVE_DELAY = 100; // ms between tile moves

interface SurfaceTile {
  type: 'ground' | 'rock' | 'mineral' | 'ruin_entrance' | 'settlement' | 'water' | 'lava';
  color: number;
  walkable: boolean;
  mineralType?: string;
}

export class PlanetSurfaceScene extends Phaser.Scene {
  private state!: GameState;
  private planet!: PlanetData;
  private tiles: SurfaceTile[][] = [];
  private mapGraphics!: Phaser.GameObjects.Graphics;
  private playerGraphics!: Phaser.GameObjects.Graphics;
  private playerX = MAP_SIZE / 2;
  private playerY = MAP_SIZE / 2;
  private lastMoveTime = 0;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  // HTML panel
  private panelEl!: HTMLElement;
  private panelPlanet!: HTMLElement;
  private panelStatus!: HTMLElement;
  private panelTile!: HTMLElement;
  private panelControls!: HTMLElement;

  constructor() {
    super({ key: 'PlanetSurfaceScene' });
  }

  init(data: { planet: PlanetData }): void {
    this.planet = data.planet;
  }

  create(): void {
    this.state = getGameState();
    this.playerX = MAP_SIZE / 2;
    this.playerY = MAP_SIZE / 2;
    this.lastMoveTime = 0;

    // HTML panel
    this.setupPanel();

    // Camera — offset viewport for the panel
    this.cameras.main.setBackgroundColor(0x0a0a0a);
    const mapPixels = MAP_SIZE * TILE_SIZE;
    this.cameras.main.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, mapPixels, mapPixels);
    this.cameras.main.setZoom(2);

    // Map layer (drawn once, updated only when tiles change)
    this.mapGraphics = this.add.graphics().setDepth(0);
    this.generateSurface();
    this.drawMap();

    // Player layer (redrawn each frame)
    this.playerGraphics = this.add.graphics().setDepth(1);

    // Center camera
    this.centerCamera();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    this.input.keyboard!.on('keydown-ESC', () => {
      this.hidePanel();
      this.scene.start('TransitionScene', {
        type: 'takeoff',
        targetScene: 'SystemScene',
        text: `LAUNCHING FROM ${this.planet.name.toUpperCase()}...`,
      });
    });
    this.input.keyboard!.on('keydown-SPACE', () => this.interact());

    this.updatePanel();
  }

  shutdown(): void {
    this.hidePanel();
  }

  update(time: number): void {
    this.handleMovement(time);
    this.drawPlayer();
  }

  // ─── HTML PANEL ─────────────────────────────────────────

  private setupPanel(): void {
    this.panelEl = document.getElementById('ui-panel')!;

    // Reuse the same panel div, replace section contents
    this.panelEl.innerHTML = `
      <div class="section" id="panel-planet"></div>
      <div class="section" id="panel-status"></div>
      <div class="section" id="panel-tile"></div>
      <div class="spacer"></div>
      <div class="section controls" id="panel-controls"></div>
    `;
    this.panelEl.style.width = PANEL_WIDTH + 'px';
    this.panelEl.classList.add('visible');

    this.panelPlanet = document.getElementById('panel-planet')!;
    this.panelStatus = document.getElementById('panel-status')!;
    this.panelTile = document.getElementById('panel-tile')!;
    this.panelControls = document.getElementById('panel-controls')!;

    this.panelControls.innerHTML =
      `<span>WASD/Arrows</span> Move<br>` +
      `<span>SPACE</span> Interact<br>` +
      `<span>ESC</span> Lift off`;
  }

  private hidePanel(): void {
    this.panelEl?.classList.remove('visible');
    // Restore panel width for galaxy map
    if (this.panelEl) this.panelEl.style.width = '260px';
  }

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private updatePanel(): void {
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    // Planet info
    this.panelPlanet.innerHTML =
      `<div class="section-title">${this.planet.name}</div>` +
      this.row('Type', this.planet.type.replace('_', ' ')) +
      this.row('Atmosphere', this.planet.atmosphere) +
      this.row('Minerals', `${this.planet.minerals.length} deposits`) +
      (this.planet.hasRuins ? this.row('Anomaly', 'Detected', 'warn') : '') +
      (this.planet.hasSettlement ? this.row('Settlement', 'Present', 'good') : '');

    // Player status
    this.panelStatus.innerHTML =
      `<div class="section-title">Status</div>` +
      this.row('Hull', `${Math.floor(ship.hull.current)}/${ship.hull.max}`) +
      this.row('Cargo', `${cargoUsed}/${cargoMax}`) +
      this.row('Credits', `${this.state.player.credits} CR`, 'good') +
      this.row('Position', `${this.playerX}, ${this.playerY}`);

    // Current tile
    this.updateTilePanel();
  }

  private updateTilePanel(): void {
    const tile = this.tiles[this.playerY]?.[this.playerX];
    if (!tile) return;

    let html = `<div class="section-title">Ground</div>`;

    switch (tile.type) {
      case 'mineral':
        html += this.row('Type', 'Mineral Deposit', 'warn');
        if (tile.mineralType) html += this.row('Mineral', tile.mineralType);
        html += `<div class="action">[SPACE] Mine deposit</div>`;
        break;
      case 'ruin_entrance':
        html += this.row('Type', 'Ancient Ruins', 'warn');
        html += `<div class="action">[SPACE] Enter ruins</div>`;
        break;
      case 'settlement':
        html += this.row('Type', 'Settlement', 'good');
        html += `<div class="action">[SPACE] Enter settlement</div>`;
        break;
      case 'rock':
        html += this.row('Type', 'Rock Formation');
        break;
      case 'water':
        html += this.row('Type', 'Water');
        break;
      case 'lava':
        html += this.row('Type', 'Lava Flow', 'bad');
        break;
      default:
        html += this.row('Terrain', 'Clear ground');
        break;
    }

    this.panelTile.innerHTML = html;

    // Also update position in status
    const posRow = this.panelStatus.querySelector('.row:last-child .value');
    if (posRow) posRow.textContent = `${this.playerX}, ${this.playerY}`;
  }

  // ─── MOVEMENT ───────────────────────────────────────────

  private handleMovement(time: number): void {
    if (time - this.lastMoveTime < MOVE_DELAY) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const newX = this.playerX + dx;
    const newY = this.playerY + dy;

    if (newX >= 0 && newX < MAP_SIZE && newY >= 0 && newY < MAP_SIZE && this.tiles[newY][newX].walkable) {
      this.playerX = newX;
      this.playerY = newY;
      this.lastMoveTime = time;
      this.centerCamera();
      this.updateTilePanel();
    }
  }

  private centerCamera(): void {
    const px = this.playerX * TILE_SIZE + TILE_SIZE / 2;
    const py = this.playerY * TILE_SIZE + TILE_SIZE / 2;
    this.cameras.main.centerOn(px, py);
  }

  // ─── DRAWING ────────────────────────────────────────────

  private drawMap(): void {
    this.mapGraphics.clear();
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.tiles[y][x];
        this.mapGraphics.fillStyle(tile.color, 1);
        this.mapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawPlayer(): void {
    this.playerGraphics.clear();
    const px = this.playerX * TILE_SIZE;
    const py = this.playerY * TILE_SIZE;

    // Shadow/outline
    this.playerGraphics.fillStyle(0x000000, 0.5);
    this.playerGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Player
    this.playerGraphics.fillStyle(COLORS.ui.primary, 1);
    this.playerGraphics.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }

  private redrawTile(x: number, y: number): void {
    const tile = this.tiles[y][x];
    this.mapGraphics.fillStyle(tile.color, 1);
    this.mapGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  // ─── INTERACTION ────────────────────────────────────────

  private interact(): void {
    const tile = this.tiles[this.playerY][this.playerX];

    if (tile.type === 'mineral') {
      tile.type = 'ground';
      tile.color = 0x555544;
      this.redrawTile(this.playerX, this.playerY);
      this.updateTilePanel();
    } else if (tile.type === 'ruin_entrance') {
      // TODO: Enter ruins scene
    } else if (tile.type === 'settlement') {
      // TODO: Settlement/trade interface
    }
  }

  // ─── GENERATION ─────────────────────────────────────────

  private generateSurface(): void {
    const system = this.state.getCurrentSystem();
    const rng = new SeededRandom(system.id * 1000 + this.planet.id);
    this.tiles = [];

    const palettes: Record<string, { ground: number[]; rock: number[]; }> = {
      rocky:       { ground: [0x666655, 0x777766, 0x555544], rock: [0x444433, 0x333322] },
      desert:      { ground: [0xccaa55, 0xbbaa44, 0xddbb66], rock: [0x998833, 0x887722] },
      ice:         { ground: [0xaaccee, 0x99bbdd, 0xbbddff], rock: [0x6699bb, 0x5588aa] },
      lush:        { ground: [0x338833, 0x449944, 0x337733], rock: [0x225522, 0x556644] },
      volcanic:    { ground: [0x553322, 0x442211, 0x664433], rock: [0x331100, 0x220000] },
      ocean:       { ground: [0x2255aa, 0x3366bb, 0x1144aa], rock: [0x336633, 0x447744] },
      barren_moon: { ground: [0x555555, 0x666666, 0x444444], rock: [0x333333, 0x222222] },
      gas_giant:   { ground: [0x555555, 0x666666, 0x444444], rock: [0x333333, 0x222222] },
    };

    const palette = palettes[this.planet.type] ?? palettes.rocky;

    for (let y = 0; y < MAP_SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        const noise = rng.next();
        let tile: SurfaceTile;

        if (noise < 0.12) {
          tile = { type: 'rock', color: rng.pick(palette.rock), walkable: false };
        } else if (noise < 0.15 && this.planet.type === 'volcanic') {
          tile = { type: 'lava', color: 0xff3300, walkable: false };
        } else if (noise < 0.15 && this.planet.type === 'ocean') {
          tile = { type: 'water', color: 0x1144aa, walkable: false };
        } else {
          tile = { type: 'ground', color: rng.pick(palette.ground), walkable: true };
        }

        this.tiles[y][x] = tile;
      }
    }

    // Minerals — bigger clusters on a bigger map
    const mineralTypes = ['Iron', 'Copper', 'Titanium', 'Platinum', 'Crystals', 'Uranium', 'Helium-3', 'Rare Earth'];
    for (const mineral of this.planet.minerals) {
      const cx = Math.floor(mineral.x * (MAP_SIZE - 8)) + 4;
      const cy = Math.floor(mineral.y * (MAP_SIZE - 8)) + 4;
      const clusterSize = rng.int(4, 8);

      for (let i = 0; i < clusterSize; i++) {
        const ox = cx + rng.int(-3, 3);
        const oy = cy + rng.int(-3, 3);
        if (ox >= 0 && ox < MAP_SIZE && oy >= 0 && oy < MAP_SIZE) {
          this.tiles[oy][ox] = {
            type: 'mineral', color: 0xffdd00 - rng.int(0, 0x002200),
            walkable: true, mineralType: mineral.type,
          };
        }
      }
    }

    // Ruins entrance
    if (this.planet.hasRuins) {
      const rx = rng.int(20, MAP_SIZE - 20);
      const ry = rng.int(20, MAP_SIZE - 20);
      this.tiles[ry][rx] = { type: 'ruin_entrance', color: 0x8844cc, walkable: true };
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = rx + dx;
          const ty = ry + dy;
          if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE && this.tiles[ty][tx].type === 'ground') {
            this.tiles[ty][tx] = { type: 'ground', color: 0x664488, walkable: true };
          }
        }
      }
    }

    // Settlement
    if (this.planet.hasSettlement) {
      const sx = rng.int(20, MAP_SIZE - 20);
      const sy = rng.int(20, MAP_SIZE - 20);
      this.tiles[sy][sx] = { type: 'settlement', color: 0x00aaff, walkable: true };
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = sx + dx;
          const ty = sy + dy;
          if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE && this.tiles[ty][tx].type === 'ground') {
            this.tiles[ty][tx] = { type: 'ground', color: 0x336688, walkable: true };
          }
        }
      }
    }

    // Clear spawn area
    const cx = MAP_SIZE / 2;
    const cy = MAP_SIZE / 2;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const t = this.tiles[cy + dy][cx + dx];
        t.walkable = true;
        t.type = 'ground';
        t.color = palette.ground[0];
      }
    }
  }
}
