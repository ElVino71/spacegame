import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, SYSTEM_BOUNDS } from '../utils/Constants';
import { StarSystemData, PlanetData, AsteroidBeltData } from '../entities/StarSystem';
import { getShipSpeed, getCargoCapacity, getCargoUsed } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { NPCShipData, generateNPCShips, updateNPCShip, pickNewWaypoint } from '../entities/NPCShip';
import { getNPCChatterPool } from '../data/npcChatter';
import { FACTION_NAMES } from '../data/factions';
import { SeededRandom } from '../utils/SeededRandom';

export class SystemScene extends Phaser.Scene {
  private state!: GameState;
  private system!: StarSystemData;

  // Graphics layers
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private orbitGraphics!: Phaser.GameObjects.Graphics;
  private objectGraphics!: Phaser.GameObjects.Graphics;
  private shipSprite!: Phaser.GameObjects.Image;
  private uiGraphics!: Phaser.GameObjects.Graphics;

  // UI texts
  private infoText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;

  // Ship movement
  private shipX = 0;
  private shipY = -200;
  private shipAngle = 0;
  private shipVx = 0;
  private shipVy = 0;
  private thrust = 0;
  private turnRate = 0;

  // Selection
  private nearestPlanet: PlanetData | null = null;
  private nearStation = false;

  // Cursors
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  // Asteroids
  private asteroids: { x: number; y: number; size: number; angle: number; orbitRadius: number; orbitSpeed: number; orbitAngle: number }[] = [];

  // NPC ships
  private npcShips: NPCShipData[] = [];
  private npcSprites: Phaser.GameObjects.Image[] = [];
  private npcRng!: SeededRandom;
  private nearestNPC: NPCShipData | null = null;
  private npcChatterCooldown = 0;

  // Audio
  private thrustSfxCooldown = 0;

  // Data passed from planet/station return
  private returnData: { fromPlanetId?: number; fromStation?: boolean } | null = null;

  constructor() {
    super({ key: 'SystemScene' });
  }

  init(data?: { fromPlanetId?: number; fromStation?: boolean }): void {
    this.returnData = data && (data.fromPlanetId !== undefined || data.fromStation) ? data : null;
  }

  create(): void {
    this.state = getGameState();
    this.system = this.state.getCurrentSystem();

    // Position ship — near the body we returned from, or default
    if (this.returnData?.fromPlanetId !== undefined) {
      const planet = this.system.planets.find(p => p.id === this.returnData!.fromPlanetId);
      if (planet) {
        const px = Math.cos(planet.orbitAngle) * planet.orbitRadius;
        const py = Math.sin(planet.orbitAngle) * planet.orbitRadius;
        const offset = planet.size + 40;
        this.shipX = px + offset;
        this.shipY = py;
      } else {
        this.shipX = 0;
        this.shipY = -200;
      }
    } else if (this.returnData?.fromStation && this.system.station) {
      const st = this.system.station;
      const sx = Math.cos(st.orbitAngle) * st.orbitRadius;
      const sy = Math.sin(st.orbitAngle) * st.orbitRadius;
      this.shipX = sx + 40;
      this.shipY = sy;
    } else {
      // Arriving from a jump — spawn at the edge of the system so the player
      // has to explore to find planets/stations.
      const maxOrbit = this.getMaxOrbitRadius();
      const arrivalRadius = maxOrbit + 300; // just inside camera bounds (maxOrbit + 400)
      const arrivalAngle = (this.system.planets.length > 0
        ? this.system.planets[0].orbitAngle + Math.PI  // opposite side from first planet
        : Math.PI * 1.5);  // default: top of system
      this.shipX = Math.cos(arrivalAngle) * arrivalRadius;
      this.shipY = Math.sin(arrivalAngle) * arrivalRadius;
    }
    this.shipVx = 0;
    this.shipVy = 0;
    // Point ship toward the center of the system
    this.shipAngle = Math.atan2(-this.shipY, -this.shipX);

    // Setup frame
    const frame = getFrameManager();
    frame.enterGameplay(`System: ${this.system.name}`);
    frame.setThemeFromShip(this.state.player.ship);
    frame.setNav([
      { id: 'system', label: 'System', active: true },
      { id: 'map', label: 'Galaxy Map', shortcut: 'M' },
      { id: 'ship', label: 'Ship', shortcut: 'TAB' },
      { id: 'terminal', label: 'Terminal', shortcut: 'T' },
    ], (id) => {
      switch (id) {
        case 'map': this.scene.start('GalaxyMapScene'); break;
        case 'ship': this.scene.start('ShipInteriorScene'); break;
        case 'terminal': this.scene.start('TerminalScene'); break;
      }
    });

    // Camera — fully reset to avoid stale zoom/scroll from previous scene run
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x050510);
    cam.stopFollow();
    cam.setZoom(1);
    cam.setScroll(0, 0);
    cam.setAlpha(1);
    cam.clearAlpha();
    cam.resetFX();
    const maxOrbit = this.getMaxOrbitRadius();
    const bounds = maxOrbit + 400;
    cam.setBounds(-bounds, -bounds, bounds * 2, bounds * 2);
    cam.centerOn(this.shipX, this.shipY);

    // Background starfield
    this.bgGraphics = this.add.graphics().setDepth(-2);
    this.createStarfield();

    // Drawing layers
    this.orbitGraphics = this.add.graphics().setDepth(0);
    this.objectGraphics = this.add.graphics().setDepth(1);

    // Ship sprite
    this.shipSprite = this.add.image(this.shipX, this.shipY, 'ship_player')
      .setDepth(5).setScale(0.6);

    // Generate asteroid positions
    this.generateAsteroids();

    // Generate NPC ships
    this.npcShips = generateNPCShips(this.system, this.state.seed);
    this.npcRng = new SeededRandom(this.state.seed).fork(this.system.id * 4271);
    this.npcSprites = this.npcShips.map(npc => {
      const factionColor = (COLORS.factions as number[])[npc.factionIndex] ?? 0xaaaaaa;
      const sprite = this.add.image(npc.x, npc.y, 'ship_npc')
        .setDepth(4)
        .setScale(0.5)
        .setTint(factionColor);
      return sprite;
    });
    this.npcChatterCooldown = 0;

    // Draw static elements (orbits)
    this.drawOrbits();

    // UI
    this.infoText = this.add.text(30, 30, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#00ff88',
      backgroundColor: '#111122cc', padding: { x: 8, y: 6 },
      wordWrap: { width: 280 },
    }).setScrollFactor(0).setDepth(100);

    this.speedText = this.add.text(1250, 30, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffcc00',
      backgroundColor: '#111122cc', padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    this.input.keyboard!.on('keydown-M', () => this.scene.start('GalaxyMapScene'));
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.scene.start('ShipInteriorScene');
    });
    this.input.keyboard!.on('keydown-ENTER', () => this.interact());
    this.input.keyboard!.on('keydown-T', () => this.scene.start('TerminalScene'));

    // Zoom
    this.input.on('wheel', (_p: any, _gameObjects: any[], _deltaX: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom + (deltaY > 0 ? -0.1 : 0.1), 0.3, 3));
    });

    // Initial status update
    this.updateBottomBar();

    getAudioManager().setAmbience('system_flight');
    getChatterSystem().attach(this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.handleShipMovement(dt);
    this.updatePlanetPositions(dt);
    this.updateNPCShips(dt);
    this.drawDynamicObjects();
    this.updateNearestObject();
    this.updateUI();
  }

  shutdown(): void {
    getChatterSystem().stop();
  }

  private updateBottomBar(): void {
    const ship = this.state.player.ship;
    const frame = getFrameManager();
    frame.updateStatus(
      ship.hull, ship.fuel,
      getCargoUsed(this.state.player.cargo),
      getCargoCapacity(ship),
      this.state.player.credits
    );
  }

  private getMaxOrbitRadius(): number {
    let max = 500;
    for (const p of this.system.planets) {
      max = Math.max(max, p.orbitRadius + p.size + 50);
    }
    return max;
  }

  private createStarfield(): void {
    const bounds = this.getMaxOrbitRadius() + 400;
    for (let i = 0; i < 400; i++) {
      const x = (Math.random() - 0.5) * bounds * 2;
      const y = (Math.random() - 0.5) * bounds * 2;
      this.bgGraphics.fillStyle(0xffffff, 0.1 + Math.random() * 0.3);
      this.bgGraphics.fillRect(x, y, 1, 1);
    }
  }

  private generateAsteroids(): void {
    this.asteroids = [];
    for (const belt of this.system.asteroidBelts) {
      for (let i = 0; i < belt.density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radiusVariance = belt.orbitRadius + (Math.random() - 0.5) * 60;
        this.asteroids.push({
          x: 0, y: 0,
          size: 2 + Math.random() * 4,
          angle: Math.random() * Math.PI * 2,
          orbitRadius: radiusVariance,
          orbitSpeed: (0.005 + Math.random() * 0.01) * (Math.random() < 0.5 ? 1 : -1),
          orbitAngle: angle,
        });
      }
    }
  }

  private drawOrbits(): void {
    this.orbitGraphics.clear();

    for (const planet of this.system.planets) {
      this.orbitGraphics.lineStyle(1, 0x334455, 0.2);
      this.orbitGraphics.strokeCircle(0, 0, planet.orbitRadius);
    }

    for (const belt of this.system.asteroidBelts) {
      this.orbitGraphics.lineStyle(1, 0x554433, 0.15);
      this.orbitGraphics.strokeCircle(0, 0, belt.orbitRadius - 30);
      this.orbitGraphics.strokeCircle(0, 0, belt.orbitRadius + 30);
    }
  }

  private drawDynamicObjects(): void {
    this.objectGraphics.clear();

    // Star at center
    const starColor = (COLORS.stars as any)[this.system.starType] ?? 0xffffff;
    this.objectGraphics.fillStyle(starColor, 0.3);
    this.objectGraphics.fillCircle(0, 0, this.system.starRadius * 1.5);
    this.objectGraphics.fillStyle(starColor, 0.7);
    this.objectGraphics.fillCircle(0, 0, this.system.starRadius);
    this.objectGraphics.fillStyle(0xffffff, 0.9);
    this.objectGraphics.fillCircle(0, 0, this.system.starRadius * 0.6);

    // Planets
    for (const planet of this.system.planets) {
      const px = Math.cos(planet.orbitAngle) * planet.orbitRadius;
      const py = Math.sin(planet.orbitAngle) * planet.orbitRadius;

      this.objectGraphics.fillStyle(planet.color, 1);
      this.objectGraphics.fillCircle(px, py, planet.size);

      if (planet.atmosphere === 'breathable') {
        this.objectGraphics.lineStyle(2, 0x88ccff, 0.3);
        this.objectGraphics.strokeCircle(px, py, planet.size + 3);
      }

      if (this.nearestPlanet?.id === planet.id) {
        this.objectGraphics.lineStyle(2, COLORS.ui.primary, 0.6);
        this.objectGraphics.strokeCircle(px, py, planet.size + 6);
      }
    }

    // Station
    if (this.system.station) {
      const st = this.system.station;
      const sx = Math.cos(st.orbitAngle) * st.orbitRadius;
      const sy = Math.sin(st.orbitAngle) * st.orbitRadius;
      this.objectGraphics.fillStyle(0xaaaaaa, 1);
      this.objectGraphics.fillRect(sx - 6, sy - 6, 12, 12);
      this.objectGraphics.fillStyle(0x00aaff, 0.8);
      this.objectGraphics.fillRect(sx - 3, sy - 3, 6, 6);

      if (this.nearStation) {
        this.objectGraphics.lineStyle(2, COLORS.ui.secondary, 0.6);
        this.objectGraphics.strokeCircle(sx, sy, 14);
      }
    }

    // Asteroids
    for (const ast of this.asteroids) {
      ast.x = Math.cos(ast.orbitAngle) * ast.orbitRadius;
      ast.y = Math.sin(ast.orbitAngle) * ast.orbitRadius;
      this.objectGraphics.fillStyle(0x887766, 0.7);
      this.objectGraphics.fillCircle(ast.x, ast.y, ast.size);
    }

    // NPC ship selection rings & behavior indicators
    for (const npc of this.npcShips) {
      const factionColor = (COLORS.factions as number[])[npc.factionIndex] ?? 0xaaaaaa;

      // Small faction-colored dot under the ship for visibility
      this.objectGraphics.fillStyle(factionColor, 0.3);
      this.objectGraphics.fillCircle(npc.x, npc.y, 12);

      // Selection ring when nearby
      if (this.nearestNPC?.id === npc.id) {
        this.objectGraphics.lineStyle(2, factionColor, 0.7);
        this.objectGraphics.strokeCircle(npc.x, npc.y, 18);
      }

      // Pirate aggro indicator — red dashed ring
      if (npc.behavior === 'pirate') {
        const dx = this.shipX - npc.x;
        const dy = this.shipY - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < npc.aggroRange) {
          this.objectGraphics.lineStyle(1, 0xff4444, 0.4);
          this.objectGraphics.strokeCircle(npc.x, npc.y, 20);
        }
      }
    }
  }

  private handleShipMovement(dt: number): void {
    const speed = getShipSpeed(this.state.player.ship, this.state.player.crew || []);
    const acceleration = speed * 1.5;
    const maxSpeed = speed;
    const rotSpeed = 3.5;
    const drag = 0.98;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.shipAngle -= rotSpeed * dt;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.shipAngle += rotSpeed * dt;
    }

    this.thrust = 0;
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.thrust = acceleration;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.thrust = -acceleration * 0.5;
    }

    // Engine thrust SFX
    if (this.thrust !== 0) {
      this.thrustSfxCooldown -= dt;
      if (this.thrustSfxCooldown <= 0) {
        getAudioManager().playSfx('engine_thrust');
        this.thrustSfxCooldown = 0.12;
      }
    } else {
      this.thrustSfxCooldown = 0;
    }

    this.shipVx += Math.sin(this.shipAngle) * this.thrust * dt;
    this.shipVy += -Math.cos(this.shipAngle) * this.thrust * dt;

    const currentSpeed = Math.sqrt(this.shipVx * this.shipVx + this.shipVy * this.shipVy);
    if (currentSpeed > maxSpeed) {
      this.shipVx = (this.shipVx / currentSpeed) * maxSpeed;
      this.shipVy = (this.shipVy / currentSpeed) * maxSpeed;
    }

    this.shipVx *= drag;
    this.shipVy *= drag;

    this.shipX += this.shipVx * dt;
    this.shipY += this.shipVy * dt;

    this.shipSprite.setPosition(this.shipX, this.shipY);
    this.shipSprite.setRotation(this.shipAngle);

    this.cameras.main.centerOn(this.shipX, this.shipY);
  }

  private updatePlanetPositions(dt: number): void {
    for (const planet of this.system.planets) {
      planet.orbitAngle += planet.orbitSpeed * dt;
    }
    for (const ast of this.asteroids) {
      ast.orbitAngle += ast.orbitSpeed * dt;
    }
  }

  private updateNPCShips(dt: number): void {
    const hailRange = 180;

    for (let i = 0; i < this.npcShips.length; i++) {
      const npc = this.npcShips[i];
      const sprite = this.npcSprites[i];

      updateNPCShip(npc, dt, this.shipX, this.shipY, this.system, this.npcRng.fork(npc.id));

      // Update sprite position and rotation (offset by PI/2 because sprite points up)
      sprite.setPosition(npc.x, npc.y);
      sprite.setRotation(npc.angle + Math.PI / 2);

      // Proximity chatter
      const dx = this.shipX - npc.x;
      const dy = this.shipY - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hailRange && !npc.hailed && this.npcChatterCooldown <= 0) {
        this.triggerNPCChatter(npc);
        npc.hailed = true;
        this.npcChatterCooldown = 8; // seconds between NPC chatters
      }

      // Reset hailed flag when player moves away
      if (dist > hailRange * 2) {
        npc.hailed = false;
      }
    }

    if (this.npcChatterCooldown > 0) {
      this.npcChatterCooldown -= dt;
    }
  }

  private triggerNPCChatter(npc: NPCShipData): void {
    const pool = npc.behavior === 'pirate'
      ? getNPCChatterPool('pirate')
      : getNPCChatterPool(npc.behavior);

    if (pool.length === 0) return;

    // Weighted random selection
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = pool[0];
    for (const entry of pool) {
      if (roll < entry.weight) {
        selected = entry;
        break;
      }
      roll -= entry.weight;
    }

    const factionName = FACTION_NAMES[npc.factionIndex] || 'Unknown';
    const text = selected.text
      .replace(/\{name\}/g, npc.name)
      .replace(/\{faction\}/g, factionName);

    getFrameManager().addChatter(text, selected.color);
    getAudioManager().playSfx('ui_select');
  }

  private updateNearestObject(): void {
    const interactRange = 50;
    const npcInfoRange = 120;
    this.nearestPlanet = null;
    this.nearStation = false;
    this.nearestNPC = null;
    let closestDist = Infinity;

    for (const planet of this.system.planets) {
      const px = Math.cos(planet.orbitAngle) * planet.orbitRadius;
      const py = Math.sin(planet.orbitAngle) * planet.orbitRadius;
      const dx = this.shipX - px;
      const dy = this.shipY - py;
      const dist = Math.sqrt(dx * dx + dy * dy) - planet.size;
      if (dist < interactRange && dist < closestDist) {
        this.nearestPlanet = planet;
        closestDist = dist;
      }
    }

    if (this.system.station) {
      const st = this.system.station;
      const sx = Math.cos(st.orbitAngle) * st.orbitRadius;
      const sy = Math.sin(st.orbitAngle) * st.orbitRadius;
      const dx = this.shipX - sx;
      const dy = this.shipY - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < interactRange && dist < closestDist) {
        this.nearestPlanet = null;
        this.nearStation = true;
        closestDist = dist;
      }
    }

    // Check NPC ships (only show info, no interaction yet)
    for (const npc of this.npcShips) {
      const dx = this.shipX - npc.x;
      const dy = this.shipY - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < npcInfoRange && !this.nearestPlanet && !this.nearStation) {
        this.nearestNPC = npc;
      }
    }
  }

  private interact(): void {
    if (this.nearestPlanet && this.nearestPlanet.landable) {
      getAudioManager().playSfx('land');
      this.scene.start('TransitionScene', {
        type: 'land',
        targetScene: 'PlanetSurfaceScene',
        targetData: { planet: this.nearestPlanet },
        text: `LANDING ON ${this.nearestPlanet.name.toUpperCase()}...`,
      });
    } else if (this.nearStation && this.system.station) {
      getAudioManager().playSfx('dock');
      this.scene.start('TransitionScene', {
        type: 'dock',
        targetScene: 'StationScene',
        targetData: { station: this.system.station },
        text: `DOCKING AT ${this.system.station.name.toUpperCase()}...`,
      });
    }
  }

  private updateUI(): void {
    const fuel = this.state.player.ship.fuel;
    const hull = this.state.player.ship.hull;
    const speed = Math.sqrt(this.shipVx * this.shipVx + this.shipVy * this.shipVy);

    // Update bottom bar periodically
    this.updateBottomBar();

    this.speedText.setText(
      `SPEED: ${Math.floor(speed)}`
    );

    if (this.nearestPlanet) {
      const p = this.nearestPlanet;
      let info = `${p.name}\n`;
      info += `Type: ${p.type.replace('_', ' ')}\n`;
      info += `Atmosphere: ${p.atmosphere}\n`;
      if (p.landable) info += `[ENTER] Land on planet\n`;
      else info += `Cannot land\n`;
      if (p.hasRuins) info += `Anomalous readings detected\n`;
      if (p.hasSettlement) info += `Settlement detected\n`;
      if (p.minerals.length > 0) info += `Minerals: ${p.minerals.map(m => m.type).join(', ')}\n`;
      this.infoText.setText(info);
    } else if (this.nearStation) {
      const st = this.system.station!;
      this.infoText.setText(`${st.name}\nEconomy: ${st.economy}\n\n[ENTER] Dock at station`);
    } else if (this.nearestNPC) {
      const npc = this.nearestNPC;
      const faction = FACTION_NAMES[npc.factionIndex] || 'Unknown';
      const behaviorLabel = npc.behavior === 'pirate' ? 'HOSTILE' : npc.behavior === 'trader' ? 'Trader' : 'Patrol';
      let info = `${npc.name}\n`;
      info += `Class: ${npc.shipClass}\n`;
      info += `Faction: ${faction}\n`;
      info += `Status: ${behaviorLabel}\n`;
      this.infoText.setText(info);
    } else {
      this.infoText.setText(`System: ${this.system.name}\nPlanets: ${this.system.planets.length}`);
    }
  }
}
