import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GALAXY_BOUNDS, FACTION_NAMES, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { StarSystemData } from '../entities/StarSystem';
import { getJumpRange, getShieldCapacity, getCargoCapacity, getCargoUsed, getShipSpeed } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';

const PANEL_WIDTH = 260;

export class GalaxyMapScene extends Phaser.Scene {
  private state!: GameState;
  private starGraphics!: Phaser.GameObjects.Graphics;
  private connectionGraphics!: Phaser.GameObjects.Graphics;
  private selectedSystem: StarSystemData | null = null;
  private hoveredSystem: StarSystemData | null = null;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor() {
    super({ key: 'GalaxyMapScene' });
  }

  create(): void {
    this.state = getGameState();

    // Setup frame
    const frame = getFrameManager();
    frame.enterGameplay('Galaxy Map');
    frame.setThemeFromShip(this.state.player.ship.class);
    frame.showPanel(PANEL_WIDTH);
    this.setupPanelContent();
    this.setupNav();

    // Camera setup — offset viewport past the panel
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(
      -GALAXY_BOUNDS / 2 - 200, -GALAXY_BOUNDS / 2 - 200,
      GALAXY_BOUNDS + 400, GALAXY_BOUNDS + 400
    );

    // Center on current system
    const currentSystem = this.state.getCurrentSystem();
    this.cameras.main.setZoom(0.8);
    this.cameras.main.scrollX = currentSystem.x - this.cameras.main.width / (2 * this.cameras.main.zoom);
    this.cameras.main.scrollY = currentSystem.y - this.cameras.main.height / (2 * this.cameras.main.zoom);

    this.createStarfield();

    this.connectionGraphics = this.add.graphics();
    this.starGraphics = this.add.graphics();

    this.setupInput();
    this.drawGalaxy();
    this.updateUI();

    getAudioManager().setAmbience('galaxy_map');
  }

  shutdown(): void {
    const frame = getFrameManager();
    frame.hidePanel();
  }

  update(): void {
    this.updateHover();
  }

  // ─── FRAME SETUP ──────────────────────────────────────

  private setupPanelContent(): void {
    const frame = getFrameManager();
    frame.setPanelContent(`
      <div class="section" id="panel-ship"></div>
      <div class="section" id="panel-location"></div>
      <div class="section" id="panel-target"></div>
      <div style="flex:1"></div>
      <div class="section controls" id="panel-controls"></div>
    `);

    // Setup controls
    const controls = document.getElementById('panel-controls')!;
    controls.innerHTML =
      `<span>Click</span> Select system<br>` +
      `<span>ENTER</span> Jump to selected<br>` +
      `<span>SPACE</span> Enter system<br>` +
      `<span>Scroll</span> Zoom<br>` +
      `<span>Drag</span> Pan map<br>` +
      `<span>ESC</span> Deselect`;
  }

  private setupNav(): void {
    const frame = getFrameManager();
    frame.setNav([
      { id: 'map', label: 'Map', active: true },
      { id: 'system', label: 'System', shortcut: 'SPACE' },
      { id: 'ship', label: 'Ship', shortcut: 'TAB' },
      { id: 'terminal', label: 'Terminal', shortcut: 'T' },
    ], (id) => {
      switch (id) {
        case 'system': this.enterSystem(); break;
        case 'ship': this.scene.start('ShipInteriorScene'); break;
        case 'terminal': this.scene.start('TerminalScene'); break;
      }
    });
  }

  // ─── STARFIELD ──────────────────────────────────────────

  private createStarfield(): void {
    const gfx = this.add.graphics().setDepth(-1);
    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * GALAXY_BOUNDS * 1.5;
      const y = (Math.random() - 0.5) * GALAXY_BOUNDS * 1.5;
      gfx.fillStyle(0xffffff, 0.1 + Math.random() * 0.4);
      gfx.fillRect(x, y, Math.random() < 0.9 ? 1 : 2, 1);
    }
  }

  // ─── GALAXY DRAW ────────────────────────────────────────

  private drawGalaxy(): void {
    this.connectionGraphics.clear();
    this.starGraphics.clear();

    const currentSystem = this.state.getCurrentSystem();
    const jumpRange = getJumpRange(this.state.player.ship);

    // Connections
    const drawn = new Set<string>();
    for (const system of this.state.galaxy) {
      if (!system.discovered) continue;
      for (const connId of system.connections) {
        const conn = this.state.galaxy[connId];
        if (!conn.discovered) continue;
        const key = Math.min(system.id, connId) + '-' + Math.max(system.id, connId);
        if (drawn.has(key)) continue;
        drawn.add(key);

        const isCurrent = system.id === currentSystem.id || connId === currentSystem.id;
        this.connectionGraphics.lineStyle(1, isCurrent ? COLORS.ui.primary : 0x445566, isCurrent ? 0.4 : 0.15);
        this.connectionGraphics.lineBetween(system.x, system.y, conn.x, conn.y);
      }
    }

    // Jump range
    this.connectionGraphics.lineStyle(1, COLORS.ui.primary, 0.2);
    this.connectionGraphics.strokeCircle(currentSystem.x, currentSystem.y, jumpRange * 3);

    // Stars
    for (const system of this.state.galaxy) {
      if (!system.discovered) continue;
      this.drawStar(system, system.id === currentSystem.id);
    }
  }

  private drawStar(system: StarSystemData, isCurrent: boolean): void {
    const color = (COLORS.stars as any)[system.starType] ?? 0xffffff;
    const factionColor = COLORS.factions[system.factionIndex] ?? 0x888888;
    const radius = isCurrent ? 8 : system.visited ? 5 : 4;

    this.starGraphics.lineStyle(2, factionColor, 0.3);
    this.starGraphics.strokeCircle(system.x, system.y, radius + 4);

    this.starGraphics.fillStyle(color, system.visited ? 1 : 0.6);
    this.starGraphics.fillCircle(system.x, system.y, radius);

    if (isCurrent) {
      this.starGraphics.lineStyle(2, COLORS.ui.primary, 0.8);
      this.starGraphics.strokeCircle(system.x, system.y, radius + 8);
    }
    if (this.selectedSystem?.id === system.id && !isCurrent) {
      this.starGraphics.lineStyle(2, COLORS.ui.secondary, 0.8);
      this.starGraphics.strokeCircle(system.x, system.y, radius + 8);
    }
    if (system.station && system.visited) {
      this.starGraphics.fillStyle(0x00aaff, 0.6);
      this.starGraphics.fillRect(system.x + radius + 2, system.y - 2, 4, 4);
    }
  }

  // ─── INPUT ──────────────────────────────────────────────

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < PANEL_WIDTH) return;
      this.isDragging = false;
      this.dragStart = { x: pointer.x, y: pointer.y };
      this.camStart = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || pointer.x < PANEL_WIDTH) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.isDragging = true;
      if (this.isDragging) {
        const zoom = this.cameras.main.zoom;
        this.cameras.main.scrollX = this.camStart.x - dx / zoom;
        this.cameras.main.scrollY = this.camStart.y - dy / zoom;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging && pointer.x >= PANEL_WIDTH) this.handleClick(pointer);
      this.isDragging = false;
    });

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _go: any[], _dx: number, deltaY: number) => {
      if (pointer.x < PANEL_WIDTH) return;
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom + (deltaY > 0 ? -0.15 : 0.15), 0.3, 4));
    });

    this.input.keyboard!.on('keydown-ENTER', () => this.tryJump());
    this.input.keyboard!.on('keydown-SPACE', () => this.enterSystem());
    this.input.keyboard!.on('keydown-ESC', () => {
      this.selectedSystem = null;
      this.drawGalaxy();
      this.updateUI();
    });
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cr = 15 / this.cameras.main.zoom;
    let closest: StarSystemData | null = null;
    let closestDist = Infinity;

    for (const sys of this.state.galaxy) {
      if (!sys.discovered) continue;
      const dist = Math.hypot(sys.x - wp.x, sys.y - wp.y);
      if (dist < cr && dist < closestDist) { closest = sys; closestDist = dist; }
    }

    this.selectedSystem = closest;
    if (closest) getAudioManager().playSfx('ui_select');
    this.drawGalaxy();
    this.updateUI();
  }

  private updateHover(): void {
    const pointer = this.input.activePointer;
    if (pointer.x < PANEL_WIDTH) return;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hr = 15 / this.cameras.main.zoom;
    let closest: StarSystemData | null = null;
    let closestDist = Infinity;

    for (const sys of this.state.galaxy) {
      if (!sys.discovered) continue;
      const dist = Math.hypot(sys.x - wp.x, sys.y - wp.y);
      if (dist < hr && dist < closestDist) { closest = sys; closestDist = dist; }
    }

    if (closest !== this.hoveredSystem) {
      this.hoveredSystem = closest;
      this.updateUI();
    }
  }

  // ─── HTML UI ────────────────────────────────────────────

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private bar(cls: string, pct: number): string {
    return `<div class="bar-bg"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>`;
  }

  private updateUI(): void {
    const current = this.state.getCurrentSystem();
    const ship = this.state.player.ship;
    const fuel = ship.fuel;
    const hull = ship.hull;
    const hullPct = Math.floor((hull.current / hull.max) * 100);
    const fuelPct = Math.floor((fuel.current / fuel.max) * 100);
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);
    const cargoPct = cargoMax > 0 ? Math.floor((cargoUsed / cargoMax) * 100) : 0;

    // Update bottom bar status
    const frame = getFrameManager();
    frame.updateStatus(hull, fuel, cargoUsed, cargoMax, this.state.player.credits);

    // Ship section
    const panelShip = document.getElementById('panel-ship');
    if (panelShip) {
      panelShip.innerHTML =
        `<div class="section-title">${ship.name}</div>` +
        this.row('Class', ship.class) +
        this.row('Hull', `${Math.floor(hull.current)}/${hull.max}`) +
        this.bar('hull', hullPct) +
        this.row('Fuel', `${Math.floor(fuel.current)}/${fuel.max}`) +
        this.bar('fuel', fuelPct) +
        this.row('Shields', `${getShieldCapacity(ship)}`) +
        this.row('Speed', `${getShipSpeed(ship)}`) +
        this.row('Cargo', `${cargoUsed}/${cargoMax}`) +
        this.bar('cargo', cargoPct) +
        this.row('Credits', `${this.state.player.credits} CR`, 'good');
    }

    // Location section
    const faction = FACTION_NAMES[current.factionIndex] ?? 'Unknown';
    const panelLocation = document.getElementById('panel-location');
    if (panelLocation) {
      panelLocation.innerHTML =
        `<div class="section-title">Location</div>` +
        this.row('System', current.name) +
        this.row('Star', `${current.starType}-class`) +
        this.row('Faction', faction) +
        this.row('Planets', `${current.planets.length}`) +
        this.row('Belts', `${current.asteroidBelts.length}`) +
        this.row('Station', current.station ? current.station.name : 'None') +
        this.row('Jump Rng', `${getJumpRange(ship)}`);
    }

    // Target section
    const panelTarget = document.getElementById('panel-target');
    if (!panelTarget) return;

    const sys = this.selectedSystem ?? this.hoveredSystem;
    if (sys && sys.id !== current.id) {
      const dist = Math.hypot(current.x - sys.x, current.y - sys.y);
      const fuelCost = dist * 0.05;
      const isConnected = current.connections.includes(sys.id);
      const canJump = isConnected && fuel.current >= fuelCost;
      const sysFaction = FACTION_NAMES[sys.factionIndex] ?? 'Unknown';

      let actionHtml: string;
      if (this.selectedSystem) {
        if (!isConnected) actionHtml = `<div class="action warn">No jump lane</div>`;
        else if (!canJump) actionHtml = `<div class="action warn">Insufficient fuel!</div>`;
        else actionHtml = `<div class="action">[ENTER] Jump to system</div>`;
      } else {
        actionHtml = `<div class="action muted">Click to select</div>`;
      }

      panelTarget.innerHTML =
        `<div class="section-title">${this.selectedSystem ? 'Selected' : 'Hover'}</div>` +
        this.row('System', sys.name) +
        this.row('Star', `${sys.starType}-class`) +
        this.row('Faction', sysFaction) +
        this.row('Planets', `${sys.planets.length}`) +
        this.row('Status', sys.visited ? 'Visited' : 'Unexplored') +
        (sys.station ? this.row('Station', sys.station.name) : '') +
        this.row('Distance', `${Math.floor(dist)} ly`) +
        this.row('Fuel cost', `${fuelCost.toFixed(1)}`, canJump ? 'good' : 'bad') +
        this.row('Route', isConnected ? 'Connected' : 'No lane', isConnected ? 'good' : 'bad') +
        actionHtml;
    } else if (sys && sys.id === current.id) {
      panelTarget.innerHTML =
        `<div class="section-title">Selected</div>` +
        `<div class="row"><span class="label">Current system</span></div>` +
        `<div class="action">[SPACE] Enter system</div>`;
    } else {
      panelTarget.innerHTML =
        `<div class="section-title">Target</div>` +
        `<div class="action muted">No system selected</div>` +
        `<div class="action muted" style="margin-top:6px">Click a star to view info</div>`;
    }
  }

  // ─── ACTIONS ────────────────────────────────────────────

  private tryJump(): void {
    if (!this.selectedSystem || this.selectedSystem.id === this.state.player.currentSystemId) return;
    const targetName = this.selectedSystem.name;
    if (this.state.jumpToSystem(this.selectedSystem.id)) {
      getAudioManager().playSfx('warp_start');
      this.selectedSystem = null;
      const frame = getFrameManager();
      frame.hidePanel();
      this.scene.start('TransitionScene', {
        type: 'warp',
        targetScene: 'SystemScene',
        text: `WARPING TO ${targetName.toUpperCase()}...`,
      });
    }
  }

  private enterSystem(): void {
    const frame = getFrameManager();
    frame.hidePanel();
    this.scene.start('SystemScene');
  }
}
