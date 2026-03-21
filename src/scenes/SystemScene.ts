import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, SYSTEM_BOUNDS } from '../utils/Constants';
import { StarSystemData, PlanetData, AsteroidBeltData } from '../entities/StarSystem';
import { getShipSpeed } from '../entities/Player';

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
  private systemTitle!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
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

  constructor() {
    super({ key: 'SystemScene' });
  }

  create(): void {
    this.state = getGameState();
    this.system = this.state.getCurrentSystem();

    // Reset ship position
    this.shipX = 0;
    this.shipY = -200;
    this.shipVx = 0;
    this.shipVy = 0;
    this.shipAngle = 0;

    // Camera
    this.cameras.main.setBackgroundColor(0x050510);
    const maxOrbit = this.getMaxOrbitRadius();
    const bounds = maxOrbit + 400;
    this.cameras.main.setBounds(-bounds, -bounds, bounds * 2, bounds * 2);
    this.cameras.main.startFollow(
      { x: this.shipX, y: this.shipY } as any,
      false, 0.1, 0.1
    );
    this.cameras.main.setZoom(1);

    // Background starfield
    this.bgGraphics = this.add.graphics().setDepth(-2);
    this.createStarfield();

    // Drawing layers
    this.orbitGraphics = this.add.graphics().setDepth(0);
    this.objectGraphics = this.add.graphics().setDepth(1);

    // Ship sprite
    this.shipSprite = this.add.image(this.shipX, this.shipY, 'ship_player')
      .setDepth(5).setScale(1);

    // Generate asteroid positions
    this.generateAsteroids();

    // Draw static elements (orbits)
    this.drawOrbits();

    // UI
    this.systemTitle = this.add.text(640, 10, this.system.name, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
      backgroundColor: '#111122cc', padding: { x: 12, y: 6 },
    }).setScrollFactor(0).setDepth(100).setOrigin(0.5, 0);

    this.infoText = this.add.text(10, 10, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#00ff88',
      backgroundColor: '#111122cc', padding: { x: 8, y: 6 },
      wordWrap: { width: 280 },
    }).setScrollFactor(0).setDepth(100);

    this.instructionText = this.add.text(640, 690, 'WASD/Arrows to fly | SPACE to interact | M for galaxy map | TAB for ship view', {
      fontFamily: 'monospace', fontSize: '12px', color: '#666688',
    }).setScrollFactor(0).setDepth(100).setOrigin(0.5, 1);

    this.speedText = this.add.text(1270, 10, '', {
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
    this.input.keyboard!.on('keydown-SPACE', () => this.interact());

    // Zoom
    this.input.on('wheel', (_p: any, _gameObjects: any[], _deltaX: number, deltaY: number) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom + (deltaY > 0 ? -0.1 : 0.1), 0.3, 3));
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.handleShipMovement(dt);
    this.updatePlanetPositions(dt);
    this.drawDynamicObjects();
    this.updateNearestObject();
    this.updateUI();
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

    // Planet orbit paths
    for (const planet of this.system.planets) {
      this.orbitGraphics.lineStyle(1, 0x334455, 0.2);
      this.orbitGraphics.strokeCircle(0, 0, planet.orbitRadius);
    }

    // Asteroid belt regions
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

      // Planet body
      this.objectGraphics.fillStyle(planet.color, 1);
      this.objectGraphics.fillCircle(px, py, planet.size);

      // Atmosphere glow for breathable
      if (planet.atmosphere === 'breathable') {
        this.objectGraphics.lineStyle(2, 0x88ccff, 0.3);
        this.objectGraphics.strokeCircle(px, py, planet.size + 3);
      }

      // Highlight if nearest
      if (this.nearestPlanet?.id === planet.id) {
        this.objectGraphics.lineStyle(2, COLORS.ui.primary, 0.6);
        this.objectGraphics.strokeCircle(px, py, planet.size + 6);
      }

      // Name label
      if (this.cameras.main.zoom > 0.7) {
        // We'll skip text objects for planets for now - would need object pooling
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
  }

  private handleShipMovement(dt: number): void {
    const speed = getShipSpeed(this.state.player.ship);
    const acceleration = speed * 1.5;
    const maxSpeed = speed;
    const rotSpeed = 3.5;
    const drag = 0.98;

    // Rotation
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.shipAngle -= rotSpeed * dt;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.shipAngle += rotSpeed * dt;
    }

    // Thrust
    this.thrust = 0;
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.thrust = acceleration;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.thrust = -acceleration * 0.5;
    }

    // Apply thrust in ship's facing direction
    this.shipVx += Math.sin(this.shipAngle) * this.thrust * dt;
    this.shipVy += -Math.cos(this.shipAngle) * this.thrust * dt;

    // Speed cap
    const currentSpeed = Math.sqrt(this.shipVx * this.shipVx + this.shipVy * this.shipVy);
    if (currentSpeed > maxSpeed) {
      this.shipVx = (this.shipVx / currentSpeed) * maxSpeed;
      this.shipVy = (this.shipVy / currentSpeed) * maxSpeed;
    }

    // Drag
    this.shipVx *= drag;
    this.shipVy *= drag;

    // Update position
    this.shipX += this.shipVx * dt;
    this.shipY += this.shipVy * dt;

    // Update sprite
    this.shipSprite.setPosition(this.shipX, this.shipY);
    this.shipSprite.setRotation(this.shipAngle);

    // Camera follow
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

  private updateNearestObject(): void {
    const interactRange = 50;
    this.nearestPlanet = null;
    this.nearStation = false;
    let closestDist = Infinity;

    // Check planets
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

    // Check station
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
      }
    }
  }

  private interact(): void {
    if (this.nearestPlanet && this.nearestPlanet.landable) {
      this.scene.start('TransitionScene', {
        type: 'land',
        targetScene: 'PlanetSurfaceScene',
        targetData: { planet: this.nearestPlanet },
        text: `LANDING ON ${this.nearestPlanet.name.toUpperCase()}...`,
      });
    } else if (this.nearStation && this.system.station) {
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

    this.speedText.setText(
      `HULL: ${Math.floor(hull.current)}/${hull.max}\n` +
      `FUEL: ${Math.floor(fuel.current)}/${fuel.max}\n` +
      `SPEED: ${Math.floor(speed)}\n` +
      `CR: ${this.state.player.credits}`
    );

    if (this.nearestPlanet) {
      const p = this.nearestPlanet;
      let info = `${p.name}\n`;
      info += `Type: ${p.type.replace('_', ' ')}\n`;
      info += `Atmosphere: ${p.atmosphere}\n`;
      if (p.landable) info += `[SPACE] Land on planet\n`;
      else info += `Cannot land\n`;
      if (p.hasRuins) info += `Anomalous readings detected\n`;
      if (p.hasSettlement) info += `Settlement detected\n`;
      if (p.minerals.length > 0) info += `Minerals: ${p.minerals.map(m => m.type).join(', ')}\n`;
      this.infoText.setText(info);
    } else if (this.nearStation) {
      const st = this.system.station!;
      this.infoText.setText(`${st.name}\nEconomy: ${st.economy}\n\n[SPACE] Dock at station`);
    } else {
      this.infoText.setText(`System: ${this.system.name}\nPlanets: ${this.system.planets.length}`);
    }
  }
}
