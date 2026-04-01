import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { PlanetData } from '../entities/StarSystem';
import { SeededRandom } from '../utils/SeededRandom';
import { CargoItem, getCargoCapacity, getCargoUsed } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { BIOME_CONFIGS } from '../data/planets';

const MAP_SIZE = 128;
const TILE_SIZE = 16;
const PANEL_WIDTH = 240;
const MOVE_DELAY = 150; // ms between tile moves
const ROVER_CARGO_MAX = 5;

interface POIMarker {
  x: number;
  y: number;
  type: 'mineral' | 'ruin' | 'settlement';
  color: number;
}

interface SurfaceTile {
  type: 'ground' | 'rock' | 'mineral' | 'ruin_entrance' | 'settlement' | 'water' | 'lava' | 'flora' | 'fauna';
  color: number;
  walkable: boolean;
  mineralType?: string;
  textureKey?: string; // which tile_* texture to use
  groundVariant?: number; // 1-3 for ground tiles
  floraType?: string; // e.g. 'tree_1', 'bush_2', 'cactus'
  faunaType?: string; // e.g. 'critter_1', 'grazer', 'predator'
}


export class PlanetSurfaceScene extends Phaser.Scene {
  private state!: GameState;
  private planet!: PlanetData;
  private tiles: SurfaceTile[][] = [];
  private mapRT!: Phaser.GameObjects.RenderTexture;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerX = MAP_SIZE / 2;
  private playerY = MAP_SIZE / 2;
  private lastMoveTime = 0;
  private roverCargo: CargoItem[] = [];
  private roverHull = { current: 50, max: 50 };

  // Scanner
  private scannerGfx!: Phaser.GameObjects.Graphics;
  private poiMarkers: POIMarker[] = [];
  private scannerAngle = 0;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

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
    this.roverCargo = [];
    this.roverHull = { current: 50, max: 50 };

    // Setup frame
    const frame = getFrameManager();
    frame.enterGameplay(`Surface: ${this.planet.name}`);
    frame.setHullLabel('ROVER');
    frame.setThemeFromShip(this.state.player.ship);
    frame.showPanel(PANEL_WIDTH);
    this.setupPanelContent();
    frame.setNav([
      { id: 'surface', label: 'Surface', active: true },
      { id: 'liftoff', label: 'Lift Off', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'liftoff') this.liftoff();
    });

    // Camera — offset viewport for the panel
    this.cameras.main.setBackgroundColor(0x0a0a0a);
    const mapPixels = MAP_SIZE * TILE_SIZE;
    this.cameras.main.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, mapPixels, mapPixels);
    this.cameras.main.setZoom(2);

    // Map render texture
    const mapPixelsW = MAP_SIZE * TILE_SIZE;
    this.mapRT = this.add.renderTexture(0, 0, mapPixelsW, mapPixelsW).setOrigin(0, 0).setDepth(0);
    this.generateSurface();
    this.collectPOIs();
    this.drawMap();

    // Player sprite
    this.playerSprite = this.add.image(0, 0, 'tile_rover').setOrigin(0.5, 0.5).setDepth(1);

    // Scanner overlay — use a separate unzoomed camera so the scanner isn't scaled by the 2x map zoom
    this.scannerGfx = this.add.graphics().setDepth(10);
    this.scannerAngle = 0;
    const uiCam = this.cameras.add(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    uiCam.setScroll(0, 0);
    // Main camera ignores scanner, UI camera ignores everything else
    this.cameras.main.ignore(this.scannerGfx);
    uiCam.ignore([this.mapRT, this.playerSprite]);

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

    this.input.keyboard!.on('keydown-ESC', () => this.liftoff());
    this.input.keyboard!.on('keydown-SPACE', () => this.interact());
    this.input.keyboard!.on('keydown-ENTER', () => this.enterPOI());

    getAudioManager().setAmbience('planet_surface');

    this.updatePanel();
    getChatterSystem().attach(this);
  }

  shutdown(): void {
    const frame = getFrameManager();
    frame.hidePanel();
    getChatterSystem().stop();
  }

  update(time: number, delta: number): void {
    this.handleMovement(time);
    this.drawPlayer();
    this.drawScanner(delta);
  }

  // ─── FRAME PANEL ──────────────────────────────────────

  private setupPanelContent(): void {
    const frame = getFrameManager();
    frame.setPanelContent(`
      <div class="section" id="panel-planet"></div>
      <div class="section" id="panel-status"></div>
      <div class="section" id="panel-rover-cargo"></div>
      <div class="section" id="panel-tile"></div>
      <div style="flex:1"></div>
      <div class="section controls" id="panel-controls"></div>
    `);

    document.getElementById('panel-controls')!.innerHTML =
      `<span>WASD/Arrows</span> Move<br>` +
      `<span>SPACE</span> Interact<br>` +
      `<span>ENTER</span> Enter<br>` +
      `<span>ESC</span> Lift off`;
  }

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private updatePanel(): void {
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    // Update bottom bar — show rover hull, not ship hull
    const frame = getFrameManager();
    frame.updateStatus(this.roverHull, ship.fuel, cargoUsed, cargoMax, this.state.player.credits);

    // Planet info
    const panelPlanet = document.getElementById('panel-planet')!;
    panelPlanet.innerHTML =
      `<div class="section-title">${this.planet.name}</div>` +
      this.row('Type', this.planet.type.replace('_', ' ')) +
      this.row('Atmosphere', this.planet.atmosphere) +
      this.row('Minerals', `${this.planet.minerals.length} deposits`) +
      (this.planet.hasRuins ? this.row('Anomaly', 'Detected', 'warn') : '') +
      (this.planet.hasSettlement ? this.row('Settlement', 'Present', 'good') : '');

    // Player status
    const roverUsed = this.roverCargo.reduce((t, i) => t + i.quantity, 0);
    const panelStatus = document.getElementById('panel-status')!;
    const roverPct = Math.floor((this.roverHull.current / this.roverHull.max) * 100);
    const roverCls = roverPct > 50 ? 'good' : roverPct > 25 ? 'warn' : 'bad';
    panelStatus.innerHTML =
      `<div class="section-title">Rover Status</div>` +
      this.row('Rover Hull', `${this.roverHull.current}/${this.roverHull.max}`, roverCls) +
      this.row('Ship Cargo', `${cargoUsed}/${cargoMax}`) +
      this.row('Credits', `${this.state.player.credits} CR`, 'good') +
      this.row('Position', `${this.playerX}, ${this.playerY}`);

    // Rover cargo
    const panelRover = document.getElementById('panel-rover-cargo')!;
    let roverHtml = `<div class="section-title">Rover Cargo (${roverUsed}/${ROVER_CARGO_MAX})</div>`;
    if (this.roverCargo.length === 0) {
      roverHtml += `<div class="label">Empty</div>`;
    } else {
      for (const item of this.roverCargo) {
        roverHtml += this.row(item.name, `×${item.quantity}`, 'warn');
      }
    }
    panelRover.innerHTML = roverHtml;

    // Current tile
    this.updateTilePanel();
  }

  private updateTilePanel(): void {
    const tile = this.tiles[this.playerY]?.[this.playerX];
    if (!tile) return;

    const panelTile = document.getElementById('panel-tile');
    if (!panelTile) return;

    let html = `<div class="section-title">Ground</div>`;

    switch (tile.type) {
      case 'mineral': {
        html += this.row('Type', 'Mineral Deposit', 'warn');
        if (tile.mineralType) html += this.row('Mineral', tile.mineralType);
        const rUsed = this.roverCargo.reduce((t, i) => t + i.quantity, 0);
        if (rUsed >= ROVER_CARGO_MAX) {
          html += `<div class="action muted">Rover cargo full</div>`;
        } else {
          html += `<div class="action">[SPACE] Mine deposit</div>`;
        }
        break;
      }
      case 'ruin_entrance':
        html += this.row('Type', 'Ancient Ruins', 'warn');
        html += `<div class="action">[ENTER] Enter ruins</div>`;
        break;
      case 'settlement':
        html += this.row('Type', 'Settlement', 'good');
        html += `<div class="action">[ENTER] Enter settlement</div>`;
        break;
      case 'rock':
        html += this.row('Type', 'Rock Formation');
        break;
      case 'flora':
        html += this.row('Type', 'Alien Flora', 'good');
        html += this.row('Species', (tile.floraType ?? 'unknown').replace('_', ' '));
        break;
      case 'fauna':
        html += this.row('Type', 'Alien Fauna', 'warn');
        html += this.row('Species', (tile.faunaType ?? 'unknown').replace('_', ' '));
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

    panelTile.innerHTML = html;

    // Also update position in status
    const panelStatus = document.getElementById('panel-status');
    if (panelStatus) {
      const posRow = panelStatus.querySelector('.row:last-child .value');
      if (posRow) posRow.textContent = `${this.playerX}, ${this.playerY}`;
    }
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

      // Rotate rover sprite to face movement direction
      if (dx === 1) this.playerSprite.setAngle(90);       // East
      else if (dx === -1) this.playerSprite.setAngle(-90); // West
      else if (dy === -1) this.playerSprite.setAngle(0);   // North (default)
      else if (dy === 1) this.playerSprite.setAngle(180);  // South

      getAudioManager().playSfx('rover_move');
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

  /** Map tile type → texture key */
  private getTileTexture(tile: SurfaceTile): string {
    switch (tile.type) {
      case 'ground':         return `tile_ground_${tile.groundVariant ?? 1}`;
      case 'rock':           return 'tile_rock';
      case 'mineral':        return 'tile_mineral';
      case 'ruin_entrance':  return 'tile_ruin';
      case 'settlement':     return 'tile_settlement';
      case 'water':          return 'tile_water';
      case 'lava':           return 'tile_lava';
      case 'flora':          return `flora_${tile.floraType ?? 'bush_1'}`;
      case 'fauna':          return `fauna_${tile.faunaType ?? 'critter_1'}`;
    }
  }

  /** Whether this tile type should be tinted with the planet palette color */
  private isTintable(type: string): boolean {
    return type === 'ground' || type === 'rock' || type === 'flora' || type === 'fauna';
  }

  private drawMap(): void {
    this.mapRT.clear();
    // Use a temporary sprite for stamping tiles
    const stamp = this.make.image({ x: 0, y: 0, key: 'tile_ground_1' }, false);
    stamp.setOrigin(0, 0);

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.tiles[y][x];

        // For tiles with transparency, draw ground underneath first
        if (tile.type === 'flora' || tile.type === 'fauna' || tile.type === 'rock') {
          stamp.setTexture(`tile_ground_${(tile.groundVariant ?? 1)}`);
          stamp.setPosition(x * TILE_SIZE, y * TILE_SIZE);
          stamp.setTint(tile.color);
          this.mapRT.draw(stamp);
        }

        const texKey = this.getTileTexture(tile);
        stamp.setTexture(texKey);
        stamp.setPosition(x * TILE_SIZE, y * TILE_SIZE);

        if (this.isTintable(tile.type)) {
          stamp.setTint(tile.color);
        } else {
          stamp.clearTint();
        }

        this.mapRT.draw(stamp);
      }
    }

    stamp.destroy();
  }

  private drawPlayer(): void {
    this.playerSprite.setPosition(this.playerX * TILE_SIZE + TILE_SIZE / 2, this.playerY * TILE_SIZE + TILE_SIZE / 2);
  }

  private redrawTile(x: number, y: number): void {
    const tile = this.tiles[y][x];
    const stamp = this.make.image({ x: 0, y: 0, key: this.getTileTexture(tile) }, false);
    stamp.setOrigin(0, 0);
    stamp.setPosition(x * TILE_SIZE, y * TILE_SIZE);

    // Draw ground underneath tiles with transparency
    if (tile.type === 'flora' || tile.type === 'fauna' || tile.type === 'rock') {
      stamp.setTexture(`tile_ground_${(tile.groundVariant ?? 1)}`);
      stamp.setTint(tile.color);
      this.mapRT.draw(stamp);
      stamp.setTexture(this.getTileTexture(tile));
    }

    if (this.isTintable(tile.type)) {
      stamp.setTint(tile.color);
    }

    this.mapRT.draw(stamp);
    stamp.destroy();
  }

  // ─── INTERACTION ────────────────────────────────────────

  private interact(): void {
    const tile = this.tiles[this.playerY][this.playerX];

    if (tile.type === 'mineral') {
      const roverUsed = this.roverCargo.reduce((t, i) => t + i.quantity, 0);
      if (roverUsed >= ROVER_CARGO_MAX) {
        getFrameManager().showAlert('Rover cargo full!', 'warn');
        return;
      }
      getAudioManager().playSfx('mine');
      // Add mineral to rover cargo
      const mineralName = tile.mineralType || 'Unknown Ore';
      const existing = this.roverCargo.find(c => c.id === mineralName);
      if (existing) {
        existing.quantity++;
      } else {
        this.roverCargo.push({ id: mineralName, name: mineralName, quantity: 1, value: 50 });
      }
      tile.type = 'ground';
      tile.color = 0x555544;
      tile.groundVariant = 2;
      this.redrawTile(this.playerX, this.playerY);
      // Remove mined mineral from scanner POIs
      const idx = this.poiMarkers.findIndex(p => p.x === this.playerX && p.y === this.playerY);
      if (idx >= 0) this.poiMarkers.splice(idx, 1);
      this.updatePanel();
    }
  }

  private enterPOI(): void {
    const tile = this.tiles[this.playerY][this.playerX];

    if (tile.type === 'ruin_entrance') {
      getAudioManager().playSfx('land');
      const frame = getFrameManager();
      frame.hidePanel();
      this.scene.start('TransitionScene', {
        type: 'land',
        targetScene: 'RuinsScene',
        targetData: { planet: this.planet },
        text: 'DESCENDING INTO RUINS...',
      });
    } else if (tile.type === 'settlement') {
      getAudioManager().playSfx('land');
      const frame = getFrameManager();
      frame.hidePanel();
      this.scene.start('TransitionScene', {
        type: 'land',
        targetScene: 'SettlementScene',
        targetData: { planet: this.planet },
        text: 'ENTERING SETTLEMENT...',
      });
    }
  }

  private liftoff(): void {
    // Transfer rover cargo to ship cargo
    for (const item of this.roverCargo) {
      const existing = this.state.player.cargo.find(c => c.id === item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        this.state.player.cargo.push({ ...item });
      }
    }
    this.roverCargo = [];

    getAudioManager().playSfx('takeoff');
    const frame = getFrameManager();
    frame.hidePanel();
    this.scene.start('TransitionScene', {
      type: 'takeoff',
      targetScene: 'SystemScene',
      targetData: { fromPlanetId: this.planet.id },
      text: `LAUNCHING FROM ${this.planet.name.toUpperCase()}...`,
    });
  }

  // ─── SCANNER ─────────────────────────────────────────────

  private collectPOIs(): void {
    this.poiMarkers = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.tiles[y][x];
        if (tile.type === 'mineral') {
          this.poiMarkers.push({ x, y, type: 'mineral', color: 0xffdd00 });
        } else if (tile.type === 'ruin_entrance') {
          this.poiMarkers.push({ x, y, type: 'ruin', color: 0xaa44ff });
        } else if (tile.type === 'settlement') {
          this.poiMarkers.push({ x, y, type: 'settlement', color: 0x00ddff });
        }
      }
    }
  }

  private drawScanner(delta: number): void {
    const gfx = this.scannerGfx;
    gfx.clear();

    const viewW = GAME_WIDTH - PANEL_WIDTH;
    const radius = 40;
    const cx = viewW - radius - 24;
    const cy = radius + 24;

    // Background circle
    gfx.fillStyle(0x000000, 0.5);
    gfx.fillCircle(cx, cy, radius);
    gfx.lineStyle(1, 0x33ff66, 0.6);
    gfx.strokeCircle(cx, cy, radius);

    // Inner rings
    gfx.lineStyle(1, 0x33ff66, 0.15);
    gfx.strokeCircle(cx, cy, radius * 0.5);
    gfx.lineStyle(1, 0x33ff66, 0.1);
    gfx.strokeCircle(cx, cy, radius * 0.25);

    // Crosshairs
    gfx.lineStyle(1, 0x33ff66, 0.15);
    gfx.lineBetween(cx - radius, cy, cx + radius, cy);
    gfx.lineBetween(cx, cy - radius, cx, cy + radius);

    // Sweep line
    this.scannerAngle += delta * 0.002;
    if (this.scannerAngle > Math.PI * 2) this.scannerAngle -= Math.PI * 2;
    const sweepX = cx + Math.cos(this.scannerAngle) * radius;
    const sweepY = cy + Math.sin(this.scannerAngle) * radius;
    gfx.lineStyle(1, 0x33ff66, 0.4);
    gfx.lineBetween(cx, cy, sweepX, sweepY);

    // Sweep trail (fading arc)
    for (let i = 1; i <= 8; i++) {
      const trailAngle = this.scannerAngle - i * 0.08;
      const alpha = 0.25 * (1 - i / 8);
      const tx = cx + Math.cos(trailAngle) * radius;
      const ty = cy + Math.sin(trailAngle) * radius;
      gfx.lineStyle(1, 0x33ff66, alpha);
      gfx.lineBetween(cx, cy, tx, ty);
    }

    // Scanner range in tiles — POIs within this range show as blips
    const scanRange = 60;
    // Unique POIs: cluster minerals by proximity, keep individual ruins/settlements
    const uniquePOIs = this.getUniquePOIs();

    // Player center dot
    gfx.fillStyle(0x33ff66, 0.9);
    gfx.fillCircle(cx, cy, 2);

    // Draw blips for POIs
    for (const poi of uniquePOIs) {
      const dx = poi.x - this.playerX;
      const dy = poi.y - this.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) continue; // skip if on top of player

      const angle = Math.atan2(dy, dx);

      // Map distance to radial position on scanner
      // Closer POIs appear nearer to center, farther ones near the edge
      const normDist = Math.min(dist / scanRange, 1);
      const blipR = normDist * (radius - 4) + 3;

      const bx = cx + Math.cos(angle) * blipR;
      const by = cy + Math.sin(angle) * blipR;

      // Size and alpha based on distance (closer = bigger & brighter)
      const alpha = dist > scanRange ? 0.25 : 0.4 + 0.6 * (1 - normDist);
      const size = dist > scanRange ? 1.5 : 2 + 2 * (1 - normDist);

      gfx.fillStyle(poi.color, alpha);
      gfx.fillCircle(bx, by, size);
    }

    // Label
    gfx.fillStyle(0x33ff66, 0.5);
    // Small "SCAN" text would need Phaser text — skip for clean look
  }

  /** Cluster nearby mineral POIs so the scanner isn't cluttered */
  private getUniquePOIs(): POIMarker[] {
    const result: POIMarker[] = [];
    const mineralClusters: { x: number; y: number; count: number }[] = [];

    for (const poi of this.poiMarkers) {
      if (poi.type !== 'mineral') {
        result.push(poi);
        continue;
      }
      // Try to merge into existing cluster
      let merged = false;
      for (const cluster of mineralClusters) {
        const dx = poi.x - cluster.x;
        const dy = poi.y - cluster.y;
        if (dx * dx + dy * dy < 36) { // within 6 tiles
          cluster.x = (cluster.x * cluster.count + poi.x) / (cluster.count + 1);
          cluster.y = (cluster.y * cluster.count + poi.y) / (cluster.count + 1);
          cluster.count++;
          merged = true;
          break;
        }
      }
      if (!merged) {
        mineralClusters.push({ x: poi.x, y: poi.y, count: 1 });
      }
    }

    for (const cluster of mineralClusters) {
      result.push({ x: Math.round(cluster.x), y: Math.round(cluster.y), type: 'mineral', color: 0xffdd00 });
    }

    return result;
  }

  // ─── GENERATION ─────────────────────────────────────────

  private generateSurface(): void {
    const system = this.state.getCurrentSystem();
    const rng = new SeededRandom(system.id * 1000 + this.planet.id);
    this.tiles = [];

    // Rock colors are derived from ground colors (darkened by ~40%)
    const darken = (c: number) => {
      const r = Math.floor(((c >> 16) & 0xff) * 0.6);
      const g = Math.floor(((c >> 8) & 0xff) * 0.6);
      const b = Math.floor((c & 0xff) * 0.6);
      return (r << 16) | (g << 8) | b;
    };

    const groundPalettes: Record<string, number[]> = {
      rocky:       [0x666655, 0x777766, 0x555544],
      desert:      [0xccaa55, 0xbbaa44, 0xddbb66],
      ice:         [0xaaccee, 0x99bbdd, 0xbbddff],
      lush:        [0x338833, 0x449944, 0x337733],
      volcanic:    [0x553322, 0x442211, 0x664433],
      ocean:       [0x2255aa, 0x3366bb, 0x1144aa],
      barren_moon: [0x555555, 0x666666, 0x444444],
      gas_giant:   [0x555555, 0x666666, 0x444444],
    };

    const ground = groundPalettes[this.planet.type] ?? groundPalettes.rocky;
    const rock = ground.map(darken);
    const palette = { ground, rock };

    for (let y = 0; y < MAP_SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        const noise = rng.next();
        let tile: SurfaceTile;

        if (noise < 0.05) {
          tile = { type: 'rock', color: rng.pick(palette.rock), walkable: false };
        } else if (noise < 0.08 && this.planet.type === 'volcanic') {
          tile = { type: 'lava', color: 0xff3300, walkable: false };
        } else if (noise < 0.08 && this.planet.type === 'ocean') {
          tile = { type: 'water', color: 0x1144aa, walkable: false };
        } else {
          const variant = rng.int(1, 3) as 1 | 2 | 3;
          tile = { type: 'ground', color: rng.pick(palette.ground), walkable: true, groundVariant: variant };

          // Scatter flora/fauna on ground tiles based on biome
          const biome = BIOME_CONFIGS[this.planet.type] ?? BIOME_CONFIGS.rocky;
          const bioRoll = rng.next();
          if (biome.flora.length > 0 && bioRoll < biome.floraChance) {
            const floraType = rng.pick(biome.flora);
            tile = { type: 'flora', color: rng.pick(palette.ground), walkable: true, floraType, groundVariant: variant };
          } else if (biome.fauna.length > 0 && bioRoll < biome.floraChance + biome.faunaChance) {
            const faunaType = rng.pick(biome.fauna);
            tile = { type: 'fauna', color: rng.pick(palette.ground), walkable: true, faunaType, groundVariant: variant };
          }
        }

        this.tiles[y][x] = tile;
      }
    }

    // Minerals
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
