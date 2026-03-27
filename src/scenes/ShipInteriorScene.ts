import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { ModuleSlot, ModuleType } from '../entities/Ship';
import { getCargoCapacity, getCargoUsed, getRepairDiscount, getFuelEfficiency } from '../entities/Player';
import { CrewMember } from '../entities/Character';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { TRADE_GOODS } from '../data/trade';
import { SeededRandom, hashString } from '../utils/SeededRandom';
import { PortraitRenderer } from '../ui/PortraitRenderer';

const PANEL_WIDTH = 340;
const TILE_SIZE = 32;
const TILE_SCALE = 2;
const SCALED_TILE = TILE_SIZE * TILE_SCALE;
const ROOM_HEIGHT_TILES = 3;   // room is 3 tiles tall
const CORRIDOR_WIDTH_TILES = 2; // corridor is 2 tiles wide between rooms
const FLOOR_Y_TILE = ROOM_HEIGHT_TILES - 1; // floor is the bottom tile row
const PLAYER_SPEED = 200;

interface Room {
  x: number;           // world x in pixels
  y: number;           // world y in pixels
  widthTiles: number;
  heightTiles: number;
  widthPx: number;
  heightPx: number;
  label: string;
  type: string;        // 'bridge', 'engine', 'weapons', etc.
  slot: ModuleSlot | null;
  color: number;
}

interface CrewSpriteData {
  gfx: Phaser.GameObjects.Graphics;
  x: number;           // current world x
  targetX: number;     // wandering target x
  roomX: number;       // room left edge
  roomRight: number;   // room right edge
  floorY: number;      // floor y position
  role: string;
  speed: number;
  waitTimer: number;   // seconds until next move
  facingRight: boolean;
  walkFrame: number;
  walkTimer: number;
}

export class ShipInteriorScene extends Phaser.Scene {
  private state!: GameState;
  private rooms: Room[] = [];
  private playerX = 0;       // world x position
  private floorWorldY = 0;   // world y of floor surface
  private playerSprite!: Phaser.GameObjects.Graphics;
  private roomRT!: Phaser.GameObjects.RenderTexture;
  private currentRoom: Room | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private facingRight = true;
  private walkFrame = 0;
  private walkTimer = 0;
  private themeId = 'retro-scifi';
  private roomLabels: Phaser.GameObjects.Text[] = [];
  private crewData: CrewSpriteData[] = [];
  private crewManageMode = false;
  private crewManageIndex = 0;

  private returnScene: string = 'SystemScene';
  private returnData: Record<string, unknown> = {};

  constructor() {
    super({ key: 'ShipInteriorScene' });
  }

  init(data?: { returnScene?: string; stationData?: unknown }): void {
    if (data?.returnScene) {
      this.returnScene = data.returnScene;
      this.returnData = data.returnScene === 'StationScene' && data.stationData
        ? { station: data.stationData } : {};
    } else {
      this.returnScene = 'SystemScene';
      this.returnData = {};
    }
  }

  create(): void {
    this.state = getGameState();
    this.cameras.main.setBackgroundColor(0x050510);

    // Determine theme from ship class
    this.themeId = this.getShipTheme();

    // Setup frame
    const frame = getFrameManager();
    frame.enterGameplay('Ship Interior');
    frame.showPanel(PANEL_WIDTH);
    const isStation = this.returnScene === 'StationScene';
    const navItems: { id: string; label: string; active?: boolean; shortcut?: string }[] = [
      { id: 'ship', label: 'Ship', active: true },
    ];
    if (isStation) {
      navItems.push({ id: 'station', label: 'Station', shortcut: 'TAB' });
    } else {
      navItems.push({ id: 'system', label: 'System', shortcut: 'TAB' });
    }
    navItems.push({ id: 'terminal', label: 'Terminal', shortcut: 'T' });
    if (!isStation) {
      navItems.push({ id: 'map', label: 'Galaxy Map', shortcut: 'M' });
    }
    frame.setNav(navItems, (id) => {
      switch (id) {
        case 'system': this.scene.start('SystemScene'); break;
        case 'station': this.scene.start('StationScene', this.returnData); break;
        case 'terminal': this.scene.start('TerminalScene', { returnScene: this.returnScene, stationData: this.returnData.station }); break;
        case 'map': this.scene.start('GalaxyMapScene'); break;
      }
    });

    // Update bottom bar
    const ship = this.state.player.ship;
    frame.updateStatus(
      ship.hull, ship.fuel,
      getCargoUsed(this.state.player.cargo),
      getCargoCapacity(ship),
      this.state.player.credits
    );

    // Build room layout
    this.buildRooms();

    // Create render texture for all room tiles
    this.drawRoomTiles();

    // Draw room labels
    this.drawRoomLabels();

    // Create crew sprites
    this.createCrewSprites();

    // Place player in bridge center
    const bridge = this.rooms[0];
    this.playerX = bridge.x + bridge.widthPx / 2;
    this.floorWorldY = bridge.y + (FLOOR_Y_TILE * SCALED_TILE);

    // Player sprite (graphics-based stick figure)
    this.playerSprite = this.add.graphics().setDepth(10);

    // Setup camera - offset for panel, follow player horizontally
    const cam = this.cameras.main;
    cam.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    const shipMidY = this.rooms[0].y + (ROOM_HEIGHT_TILES * SCALED_TILE) / 2;
    cam.setBounds(
      this.rooms[0].x - 100,
      shipMidY - GAME_HEIGHT / 2,
      this.getTotalShipWidth() + 200,
      GAME_HEIGHT
    );

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      if (!this.crewManageMode) {
        if (isStation) this.scene.start('StationScene', this.returnData);
        else this.scene.start('SystemScene');
      }
    });
    this.input.keyboard!.on('keydown-T', () => {
      if (!this.crewManageMode) this.scene.start('TerminalScene', { returnScene: this.returnScene, stationData: this.returnData.station });
    });
    this.input.keyboard!.on('keydown-M', () => {
      if (!this.crewManageMode && !isStation) this.scene.start('GalaxyMapScene');
    });
    this.input.keyboard!.on('keydown-ENTER', () => this.interactWithRoom());
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.crewManageMode) this.exitCrewManageMode();
    });
    this.input.keyboard!.on('keydown-UP', () => {
      if (this.crewManageMode) this.navigateCrewList(-1);
    });
    this.input.keyboard!.on('keydown-DOWN', () => {
      if (this.crewManageMode) this.navigateCrewList(1);
    });
    this.input.keyboard!.on('keydown-W', () => {
      if (this.crewManageMode) this.navigateCrewList(-1);
    });
    this.input.keyboard!.on('keydown-S', () => {
      if (this.crewManageMode) this.navigateCrewList(1);
    });

    getAudioManager().setAmbience('ship_interior');

    // Initial panel
    this.updatePanel();
    getChatterSystem().attach(this);
  }

  shutdown(): void {
    getFrameManager().hidePanel();
    getChatterSystem().stop();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.handleMovement(dt);
    this.findCurrentRoom();
    this.drawPlayer(dt);
    this.updateCrew(dt);
    this.updateCamera();
    this.updatePanel();
  }

  // ─── LAYOUT ─────────────────────────────────────────────

  private getShipTheme(): string {
    return this.state.player.ship.theme;
  }

  private buildRooms(): void {
    this.rooms = [];
    const ship = this.state.player.ship;

    const roomConfig: Record<ModuleType, { label: string; type: string; color: number; widthTiles: number }> = {
      engine:       { label: 'Engine Room',       type: 'engine',       color: 0x553311, widthTiles: 6 },
      weapon:       { label: 'Weapons Bay',       type: 'weapons',      color: 0x551111, widthTiles: 5 },
      shield:       { label: 'Shield Generator',  type: 'shields',      color: 0x113355, widthTiles: 5 },
      cargo:        { label: 'Cargo Bay',          type: 'cargo',        color: 0x333322, widthTiles: 7 },
      sensor:       { label: 'Sensor Array',       type: 'sensors',      color: 0x115533, widthTiles: 5 },
      computer:     { label: 'Computer Core',      type: 'computer',     color: 0x222244, widthTiles: 5 },
      mining:       { label: 'Mining Bay',         type: 'mining',       color: 0x443322, widthTiles: 6 },
      hull:         { label: 'Hull Plating',       type: 'hull',         color: 0x444444, widthTiles: 4 },
      life_support: { label: 'Life Support',       type: 'life_support', color: 0x224433, widthTiles: 5 },
    };

    // The ship Y position - center the cross-section vertically
    const shipTopY = GAME_HEIGHT / 2 - (ROOM_HEIGHT_TILES * SCALED_TILE) / 2;
    let xOffset = 0;

    // Bridge is always first
    const bridgeWidth = 7;
    this.rooms.push({
      x: xOffset, y: shipTopY,
      widthTiles: bridgeWidth, heightTiles: ROOM_HEIGHT_TILES,
      widthPx: bridgeWidth * SCALED_TILE, heightPx: ROOM_HEIGHT_TILES * SCALED_TILE,
      label: 'Bridge', type: 'bridge', slot: null, color: 0x223344,
    });
    xOffset += bridgeWidth * SCALED_TILE + CORRIDOR_WIDTH_TILES * SCALED_TILE;

    // Add rooms for each unique module type
    const seenTypes = new Set<string>();
    for (const slot of ship.slots) {
      if (seenTypes.has(slot.type)) continue;
      seenTypes.add(slot.type);

      const config = roomConfig[slot.type];
      this.rooms.push({
        x: xOffset, y: shipTopY,
        widthTiles: config.widthTiles, heightTiles: ROOM_HEIGHT_TILES,
        widthPx: config.widthTiles * SCALED_TILE, heightPx: ROOM_HEIGHT_TILES * SCALED_TILE,
        label: config.label, type: config.type, slot, color: config.color,
      });
      xOffset += config.widthTiles * SCALED_TILE + CORRIDOR_WIDTH_TILES * SCALED_TILE;
    }
  }

  private getTotalShipWidth(): number {
    if (this.rooms.length === 0) return 0;
    const last = this.rooms[this.rooms.length - 1];
    return last.x + last.widthPx;
  }

  // ─── TILE RENDERING ────────────────────────────────────

  private drawRoomTiles(): void {
    const totalWidth = this.getTotalShipWidth() + 200;
    const totalHeight = GAME_HEIGHT;

    this.roomRT = this.add.renderTexture(0, 0, totalWidth, totalHeight).setOrigin(0, 0).setDepth(0);

    const hasRoomTiles = this.textures.exists(`room_${this.themeId}_floor`);

    if (hasRoomTiles) {
      this.drawWithTiles();
    } else {
      this.drawWithGraphics();
    }
  }

  /** Pick a tile key for a given room position using seeded RNG */
  private pickTileKey(rng: SeededRandom, baseKey: string, isWallTile: boolean): string {
    const roll = rng.next();

    if (isWallTile) {
      // Wall tiles: 15% chance of a decoration tile (porthole, pipes, panel, vent)
      if (roll < 0.15) {
        const decoTypes = ['deco_porthole', 'deco_pipes', 'deco_panel', 'deco_vent'];
        const decoIdx = Math.floor(rng.next() * decoTypes.length);
        const decoKey = `room_${this.themeId}_${decoTypes[decoIdx]}`;
        if (this.textures.exists(decoKey)) return decoKey;
      }
    }

    // 40% chance of a variant (v1/v2/v3), 60% base tile
    if (roll < 0.60) {
      return baseKey;
    }
    const variantIdx = 1 + Math.floor(rng.next() * 3); // 1, 2, or 3
    const variantKey = `${baseKey}_v${variantIdx}`;
    return this.textures.exists(variantKey) ? variantKey : baseKey;
  }

  private drawWithTiles(): void {
    const stamp = this.make.image({ x: 0, y: 0, key: `room_${this.themeId}_floor` }, false);
    stamp.setOrigin(0, 0);
    stamp.setScale(TILE_SCALE);

    // Create seeded RNG from galaxy seed + ship name for deterministic tile selection
    const shipSeed = this.state.seed ^ hashString(this.state.player.ship.name);
    const tileRng = new SeededRandom(shipSeed);

    for (const room of this.rooms) {
      const bgKey = `room_${this.themeId}_bg_${room.type}`;
      const floorKey = `room_${this.themeId}_floor`;
      const wallKey = `room_${this.themeId}_wall`;

      for (let ty = 0; ty < room.heightTiles; ty++) {
        for (let tx = 0; tx < room.widthTiles; tx++) {
          const wx = room.x + tx * SCALED_TILE;
          const wy = room.y + ty * SCALED_TILE;

          if (ty === FLOOR_Y_TILE) {
            // Floor row — always use base floor tile
            stamp.setTexture(floorKey);
          } else if (this.textures.exists(bgKey)) {
            // Pick room bg tile or variant/deco using seeded RNG
            const isWallTile = ty === 0 || ty === FLOOR_Y_TILE - 1;
            const tileKey = this.pickTileKey(tileRng, bgKey, isWallTile);
            stamp.setTexture(tileKey);
          } else {
            stamp.setTexture(wallKey);
          }

          stamp.setPosition(wx, wy);
          this.roomRT.draw(stamp);
        }
      }

      // Draw corridors between rooms
      const corridorKey = `room_${this.themeId}_corridor`;
      const nextRoom = this.rooms[this.rooms.indexOf(room) + 1];
      if (nextRoom) {
        const corrX = room.x + room.widthPx;
        for (let ct = 0; ct < CORRIDOR_WIDTH_TILES; ct++) {
          const wx = corrX + ct * SCALED_TILE;
          if (this.textures.exists(corridorKey)) {
            // Pick corridor variant
            const tileKey = this.pickTileKey(tileRng, corridorKey, false);
            stamp.setTexture(tileKey);
          } else {
            stamp.setTexture(floorKey);
          }
          stamp.setPosition(wx, room.y + FLOOR_Y_TILE * SCALED_TILE);
          this.roomRT.draw(stamp);
        }
      }
    }

    stamp.destroy();
  }

  private drawWithGraphics(): void {
    // Fallback: draw rooms with simple graphics if tiles aren't loaded
    const gfx = this.add.graphics().setDepth(0);

    for (const room of this.rooms) {
      // Room background
      gfx.fillStyle(room.color, 0.5);
      gfx.fillRect(room.x, room.y, room.widthPx, room.heightPx);

      // Floor highlight
      gfx.fillStyle(0x888888, 0.3);
      gfx.fillRect(room.x, room.y + FLOOR_Y_TILE * SCALED_TILE, room.widthPx, SCALED_TILE);

      // Room border
      gfx.lineStyle(2, 0x445566, 0.6);
      gfx.strokeRect(room.x, room.y, room.widthPx, room.heightPx);

      // Corridor floor between rooms
      const idx = this.rooms.indexOf(room);
      const nextRoom = this.rooms[idx + 1];
      if (nextRoom) {
        const corrX = room.x + room.widthPx;
        const corrW = CORRIDOR_WIDTH_TILES * SCALED_TILE;
        const corrY = room.y + FLOOR_Y_TILE * SCALED_TILE;

        // Corridor floor
        gfx.fillStyle(0x333333, 0.4);
        gfx.fillRect(corrX, corrY, corrW, SCALED_TILE);

        // Corridor walls (top and bottom border lines)
        gfx.lineStyle(1, 0x445566, 0.4);
        gfx.lineBetween(corrX, corrY, corrX + corrW, corrY);
        gfx.lineBetween(corrX, corrY + SCALED_TILE, corrX + corrW, corrY + SCALED_TILE);
      }

      // Draw room-specific decorations
      this.drawRoomDecor(gfx, room);
    }

    // Draw hull outline around everything
    const firstRoom = this.rooms[0];
    const lastRoom = this.rooms[this.rooms.length - 1];
    const hullLeft = firstRoom.x - 20;
    const hullRight = lastRoom.x + lastRoom.widthPx + 20;
    const hullTop = firstRoom.y - 20;
    const hullBottom = firstRoom.y + firstRoom.heightPx + 20;

    gfx.lineStyle(2, 0x445566, 0.6);
    gfx.strokeRoundedRect(hullLeft, hullTop, hullRight - hullLeft, hullBottom - hullTop, 12);
  }

  private drawRoomDecor(gfx: Phaser.GameObjects.Graphics, room: Room): void {
    const cx = room.x + room.widthPx / 2;
    const floorTop = room.y + FLOOR_Y_TILE * SCALED_TILE;

    // Draw simple iconic shapes per room type
    switch (room.type) {
      case 'bridge': {
        // Console desk
        gfx.fillStyle(0x334455, 0.7);
        gfx.fillRect(cx - 40, floorTop - 30, 80, 25);
        // Screen
        gfx.fillStyle(0x004488, 0.6);
        gfx.fillRect(cx - 30, floorTop - 65, 60, 30);
        gfx.lineStyle(1, 0x0088ff, 0.5);
        gfx.strokeRect(cx - 30, floorTop - 65, 60, 30);
        break;
      }
      case 'engine': {
        // Engine cylinders
        for (let i = 0; i < 3; i++) {
          const ex = room.x + 30 + i * 60;
          gfx.fillStyle(0x554422, 0.6);
          gfx.fillRect(ex, floorTop - 50, 30, 45);
          gfx.lineStyle(1, 0x887744, 0.5);
          gfx.strokeRect(ex, floorTop - 50, 30, 45);
        }
        break;
      }
      case 'cargo': {
        // Crates
        const crateColors = [0x665533, 0x556644, 0x664433];
        for (let i = 0; i < 4; i++) {
          const bx = room.x + 20 + i * 70;
          const bh = 25 + (i % 2) * 15;
          gfx.fillStyle(crateColors[i % crateColors.length], 0.6);
          gfx.fillRect(bx, floorTop - bh, 40, bh);
          gfx.lineStyle(1, 0x888866, 0.4);
          gfx.strokeRect(bx, floorTop - bh, 40, bh);
        }
        break;
      }
      case 'weapons': {
        // Weapon racks
        for (let i = 0; i < 3; i++) {
          const wx = room.x + 25 + i * 55;
          gfx.fillStyle(0x553333, 0.5);
          gfx.fillRect(wx, room.y + 20, 8, floorTop - room.y - 25);
          // Weapon shapes
          gfx.fillStyle(0x884444, 0.6);
          gfx.fillRect(wx - 8, room.y + 40 + i * 30, 24, 6);
        }
        break;
      }
      case 'shields': {
        // Energy coil
        gfx.lineStyle(2, 0x3366ff, 0.4);
        gfx.strokeCircle(cx, floorTop - 40, 25);
        gfx.strokeCircle(cx, floorTop - 40, 15);
        gfx.fillStyle(0x4488ff, 0.3);
        gfx.fillCircle(cx, floorTop - 40, 8);
        break;
      }
      case 'sensors': {
        // Dish
        gfx.lineStyle(2, 0x44aa66, 0.5);
        gfx.beginPath();
        gfx.arc(cx, floorTop - 30, 25, -Math.PI * 0.8, -Math.PI * 0.2);
        gfx.strokePath();
        gfx.fillStyle(0x44aa66, 0.3);
        gfx.fillCircle(cx, floorTop - 30, 5);
        break;
      }
      case 'computer': {
        // Server racks
        for (let i = 0; i < 3; i++) {
          const rx = room.x + 20 + i * 55;
          gfx.fillStyle(0x333355, 0.6);
          gfx.fillRect(rx, room.y + 15, 30, floorTop - room.y - 20);
          // Blinking lights
          for (let ly = 0; ly < 4; ly++) {
            gfx.fillStyle(ly % 2 === 0 ? 0x00ff88 : 0x0088ff, 0.6);
            gfx.fillCircle(rx + 15, room.y + 30 + ly * 20, 2);
          }
        }
        break;
      }
      case 'mining': {
        // Drill shape
        gfx.fillStyle(0x665544, 0.6);
        gfx.fillRect(cx - 15, floorTop - 55, 30, 50);
        gfx.fillStyle(0x887766, 0.5);
        gfx.fillTriangle(cx, floorTop - 70, cx - 10, floorTop - 55, cx + 10, floorTop - 55);
        break;
      }
      case 'life_support': {
        // Tanks
        for (let i = 0; i < 2; i++) {
          const tx = room.x + 30 + i * 80;
          gfx.fillStyle(0x336644, 0.5);
          gfx.fillRoundedRect(tx, floorTop - 55, 25, 50, 6);
          gfx.lineStyle(1, 0x55aa77, 0.4);
          gfx.strokeRoundedRect(tx, floorTop - 55, 25, 50, 6);
        }
        break;
      }
      case 'hull': {
        // Armor panels
        for (let i = 0; i < 3; i++) {
          const px = room.x + 15 + i * 45;
          gfx.fillStyle(0x555555, 0.5);
          gfx.fillRect(px, room.y + 20, 30, floorTop - room.y - 25);
          gfx.lineStyle(1, 0x777777, 0.3);
          gfx.strokeRect(px, room.y + 20, 30, floorTop - room.y - 25);
        }
        break;
      }
    }
  }

  private drawRoomLabels(): void {
    this.roomLabels = [];
    for (const room of this.rooms) {
      const label = this.add.text(
        room.x + room.widthPx / 2,
        room.y + 10,
        room.label.toUpperCase(),
        {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#667788',
          align: 'center',
        }
      ).setOrigin(0.5, 0).setDepth(5);
      this.roomLabels.push(label);
    }
  }

  // ─── MOVEMENT ──────────────────────────────────────────

  private handleMovement(dt: number): void {
    if (this.crewManageMode) return; // No movement during crew management

    let dx = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      dx = -PLAYER_SPEED * dt;
      this.facingRight = false;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      dx = PLAYER_SPEED * dt;
      this.facingRight = true;
    }

    if (dx === 0) return;

    const newX = this.playerX + dx;

    // Check if new position is walkable (on floor of a room or corridor)
    if (this.isWalkable(newX)) {
      this.playerX = newX;
    }
  }

  private isWalkable(x: number): boolean {
    // The entire walkable span is from the first room's left edge
    // to the last room's right edge, including all corridors between.
    // Rooms and corridors are laid out contiguously:
    //   [room0][corridor][room1][corridor][room2]...
    const first = this.rooms[0];
    const last = this.rooms[this.rooms.length - 1];
    const margin = 8;
    return x >= first.x + margin && x <= last.x + last.widthPx - margin;
  }

  private findCurrentRoom(): void {
    this.currentRoom = null;
    for (const room of this.rooms) {
      if (this.playerX >= room.x && this.playerX <= room.x + room.widthPx) {
        this.currentRoom = room;
        return;
      }
    }
  }

  // ─── PLAYER DRAWING ────────────────────────────────────

  private drawPlayer(dt: number): void {
    const gfx = this.playerSprite;
    gfx.clear();

    const isMoving = this.cursors.left.isDown || this.cursors.right.isDown ||
                     this.wasd.A.isDown || this.wasd.D.isDown;

    if (isMoving) {
      this.walkTimer += dt;
      if (this.walkTimer > 0.15) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    const px = this.playerX;
    const py = this.floorWorldY; // feet on floor surface
    const dir = this.facingRight ? 1 : -1;

    // Leg offsets for walk animation
    const legAnims = [
      { l: -3, r: 3 },   // standing / stride 0
      { l: -5, r: 5 },   // stride 1
      { l: -2, r: 2 },   // stride 2
      { l: 5, r: -5 },   // stride 3
    ];
    const leg = legAnims[this.walkFrame];

    // Head
    gfx.fillStyle(COLORS.ui.primary, 1);
    gfx.fillCircle(px, py - 28, 5);

    // Body
    gfx.lineStyle(2, COLORS.ui.primary, 1);
    gfx.lineBetween(px, py - 23, px, py - 10);

    // Arms
    gfx.lineBetween(px, py - 20, px + dir * 8, py - 15);
    gfx.lineBetween(px, py - 20, px - dir * 4, py - 14);

    // Legs
    gfx.lineBetween(px, py - 10, px + leg.l, py);
    gfx.lineBetween(px, py - 10, px + leg.r, py);
  }

  private updateCamera(): void {
    const cam = this.cameras.main;
    const viewWidth = GAME_WIDTH - PANEL_WIDTH;
    const targetX = this.playerX - viewWidth / 2;
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetX, 0.1);
    const shipMidY = this.rooms[0].y + (ROOM_HEIGHT_TILES * SCALED_TILE) / 2;
    cam.scrollY = shipMidY - GAME_HEIGHT / 2;
  }

  // ─── PANEL UI ──────────────────────────────────────────

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private updatePanel(): void {
    const frame = getFrameManager();
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    frame.updateStatus(ship.hull, ship.fuel, cargoUsed, cargoMax, this.state.player.credits);

    // Crew management mode takes over the panel
    if (this.crewManageMode && this.currentRoom) {
      frame.setPanelContent(this.buildCrewManagePanel());
      return;
    }

    let html = '';

    if (this.currentRoom) {
      const room = this.currentRoom;
      html += `<div class="section">`;
      html += `<div class="section-title">${room.label}</div>`;

      // Crew in this room
      const crewInRoom = (this.state.player.crew || []).filter(c => {
        const assigned = c.assignedRoom || 'bridge';
        return assigned.toLowerCase() === room.type.toLowerCase();
      });

      if (crewInRoom.length > 0) {
        for (const c of crewInRoom) {
          html += `<div class="crew-card" style="display:flex; margin-bottom:10px; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">`;
          html += `<div style="margin-right:10px; border:1px solid var(--frame-border); background:rgba(0,0,0,0.3)">`;
          html += PortraitRenderer.renderPortrait(c.portraitSeed, 48);
          html += `</div>`;
          html += `<div>`;
          html += `<div style="font-size:12px; font-weight:bold;">${c.name}</div>`;
          html += `<div style="font-size:9px; color:var(--frame-text-good); margin-bottom:3px;">${c.role.toUpperCase()}</div>`;
          html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:2px; font-size:8px; opacity:0.8;">`;
          html += `<div>PIL: ${c.stats.piloting}</div><div>ENG: ${c.stats.engineering}</div>`;
          html += `<div>COM: ${c.stats.combat}</div><div>SCI: ${c.stats.science}</div>`;
          html += `</div>`;
          html += `</div>`;
          html += `</div>`;
        }
        html += `<div class="action">[ENTER] Manage Crew</div>`;
        html += `</div><div class="section">`;
      }

      if (room.type === 'bridge') {
        html += this.row('Ship', ship.name);
        html += this.row('Class', ship.class);
        html += this.row('Hull', `${Math.floor(ship.hull.current)}/${ship.hull.max}`);
        html += this.row('Fuel', `${Math.floor(ship.fuel.current)}/${ship.fuel.max}`);
        html += `</div>`;
        html += `<div class="section">`;
        html += `<div class="action">[T] Access Terminal</div>`;
        html += `<div class="action">[M] Galaxy Map</div>`;
        html += `<div class="action">[TAB] System View</div>`;
        html += `</div>`;
      } else if (room.type === 'cargo') {
        html += this.row('Capacity', `${cargoUsed}/${cargoMax}`);
        html += `</div>`;

        if (this.state.player.cargo.length > 0) {
          html += `<div class="section">`;
          html += `<div class="section-title">Manifest</div>`;
          for (const item of this.state.player.cargo) {
            const isTradable = TRADE_GOODS.some(g => g.id === item.id || g.id === item.baseGoodId);
            html += this.row(item.name, `x${item.quantity}${isTradable ? '' : ' (N/T)'}`);
          }
          html += `</div>`;
          html += `<div class="section">`;
          html += `<div class="action">[ENTER] Jettison selected</div>`;
          html += `</div>`;
        } else {
          html += `<div class="section">`;
          html += `<div style="color:var(--frame-text-muted)">Cargo bay is empty</div>`;
          html += `</div>`;
        }
      } else if (room.slot) {
        // Module room
        const slots = ship.slots.filter(s => s.type === room.slot!.type);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          if (slot.module) {
            const mod = slot.module;
            html += this.row('Module', mod.name);
            html += this.row('Tier', `${mod.tier}`);
            for (const [key, val] of Object.entries(mod.stats)) {
              const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              html += this.row(displayKey, `${val}`);
            }
          } else {
            html += this.row('Slot', 'Empty');
            html += this.row('Max Size', `${slot.maxSize}`);
          }
          if (i < slots.length - 1) {
            html += `<hr style="border-color:var(--frame-text-muted);opacity:0.2;margin:6px 0">`;
          }
        }
        html += `</div>`;
      } else {
        html += `</div>`;
      }
    } else {
      // In corridor
      html += `<div class="section">`;
      html += `<div class="section-title">Corridor</div>`;
      html += `<div style="color:var(--frame-text-muted)">Walk to a room to interact</div>`;
      html += `</div>`;
    }

    // Controls
    html += `<div class="section">`;
    html += `<div class="controls">`;
    html += `<span>A/D</span> or <span>←/→</span> Walk<br>`;
    html += `<span>ENTER</span> Interact<br>`;
    html += `<span>T</span> Terminal | <span>M</span> Map | <span>TAB</span> System`;
    html += `</div>`;
    html += `</div>`;

    frame.setPanelContent(html);
  }

  // ─── INTERACTIONS ──────────────────────────────────────

  private interactWithRoom(): void {
    if (!this.currentRoom) return;

    if (this.crewManageMode) {
      // In crew manage mode, ENTER assigns the selected crew member to this room
      this.assignSelectedCrew();
      return;
    }

    // Check if there's crew to manage or if we should open crew management
    const crew = this.state.player.crew || [];
    if (crew.length > 0) {
      this.enterCrewManageMode();
      return;
    }

    // Fallback interactions for rooms with no crew
    switch (this.currentRoom.type) {
      case 'bridge':
        this.scene.start('TerminalScene');
        break;
    }
  }

  private enterCrewManageMode(): void {
    this.crewManageMode = true;
    this.crewManageIndex = 0;
    this.updatePanel();
  }

  private exitCrewManageMode(): void {
    this.crewManageMode = false;
    this.crewManageIndex = 0;
    // Refresh crew sprites to reflect new assignments
    this.createCrewSprites();
    this.updatePanel();
  }

  private assignSelectedCrew(): void {
    if (!this.currentRoom) return;
    const crew = this.state.player.crew || [];
    if (crew.length === 0) return;

    const member = crew[this.crewManageIndex];
    if (!member) return;

    const currentAssignment = member.assignedRoom || 'bridge';
    const targetRoom = this.currentRoom.type;

    if (currentAssignment.toLowerCase() === targetRoom.toLowerCase()) {
      // Already assigned here — unassign back to bridge
      member.assignedRoom = 'bridge';
    } else {
      member.assignedRoom = targetRoom;
    }

    // Refresh sprites and panel
    this.createCrewSprites();
    this.updatePanel();
  }

  private navigateCrewList(direction: number): void {
    const crew = this.state.player.crew || [];
    if (crew.length === 0) return;
    this.crewManageIndex = (this.crewManageIndex + direction + crew.length) % crew.length;
    this.updatePanel();
  }

  private getRoomBonusHint(roomType: string, member: CrewMember): string {
    const role = member.role;
    if (roomType === 'bridge' && role === 'pilot') {
      const bonus = Math.round(member.stats.piloting * 5);
      return `<span class="good">+${bonus}% ship speed</span>`;
    }
    if (roomType === 'engine' && role === 'engineer') {
      const fuelBonus = Math.round(member.stats.engineering * 1.5);
      const repairBonus = Math.round(member.stats.engineering * 3);
      return `<span class="good">-${fuelBonus}% fuel, -${repairBonus}% repair</span>`;
    }
    if (roomType === 'weapons' && role === 'gunner') {
      const bonus = Math.round(member.stats.combat * 5);
      return `<span class="good">+${bonus}% weapon damage</span>`;
    }
    if (roomType === 'sensors' && role === 'scientist') {
      const bonus = Math.round(member.stats.science * 5);
      return `<span class="good">+${bonus}% sensor range</span>`;
    }
    if (roomType === 'hull' && role === 'engineer') {
      const bonus = Math.round(member.stats.engineering * 3);
      return `<span class="good">-${bonus}% repair cost</span>`;
    }
    if (roomType === 'life_support' && role === 'medic') {
      return `<span class="good">+1 morale/jump</span>`;
    }
    return '';
  }

  private buildCrewManagePanel(): string {
    const room = this.currentRoom!;
    const crew = this.state.player.crew || [];
    let html = '';

    html += `<div class="section">`;
    html += `<div class="section-title">Crew Management</div>`;
    html += `<div style="font-size:10px; color:var(--frame-text-muted); margin-bottom:8px;">Assign crew to: <strong>${room.label}</strong></div>`;
    html += `</div>`;

    for (let i = 0; i < crew.length; i++) {
      const c = crew[i];
      const assigned = c.assignedRoom || 'bridge';
      const isHere = assigned.toLowerCase() === room.type.toLowerCase();
      const isSelected = i === this.crewManageIndex;
      const bonusHint = this.getRoomBonusHint(room.type, c);

      const borderColor = isSelected ? 'var(--frame-border-highlight, var(--frame-border))' : 'rgba(255,255,255,0.1)';
      const bgColor = isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
      const selector = isSelected ? '▶ ' : '  ';

      html += `<div class="section" style="padding:8px; margin-bottom:4px; border:1px solid ${borderColor}; background:${bgColor};">`;
      html += `<div style="display:flex; align-items:center;">`;
      html += `<div style="margin-right:8px; border:1px solid var(--frame-border); background:rgba(0,0,0,0.3)">`;
      html += PortraitRenderer.renderPortrait(c.portraitSeed, 40);
      html += `</div>`;
      html += `<div style="flex:1;">`;
      html += `<div style="font-size:11px; font-weight:bold;">${selector}${c.name}</div>`;
      html += `<div style="font-size:9px; color:var(--frame-text-good);">${c.role.toUpperCase()}</div>`;

      // Find the room label for current assignment
      const assignedRoom = this.rooms.find(r => r.type.toLowerCase() === assigned.toLowerCase());
      const assignedLabel = assignedRoom ? assignedRoom.label : 'Bridge';
      html += `<div style="font-size:9px; color:var(--frame-text-muted);">Assigned: ${assignedLabel}${isHere ? ' ✓' : ''}</div>`;

      if (isSelected && bonusHint) {
        html += `<div style="font-size:9px; margin-top:2px;">${bonusHint}</div>`;
      }

      html += `</div>`;
      html += `</div>`;
      html += `</div>`;
    }

    html += `<div class="section">`;
    html += `<div class="controls">`;
    html += `<span>W/S</span> or <span>↑/↓</span> Select crew<br>`;
    html += `<span>ENTER</span> Assign to room<br>`;
    html += `<span>ESC</span> Close`;
    html += `</div>`;
    html += `</div>`;

    return html;
  }

  private createCrewSprites(): void {
    // Clear old sprites
    this.crewData.forEach(s => s.gfx.destroy());
    this.crewData = [];

    const crew = this.state.player.crew || [];
    const rng = new SeededRandom(hashString(this.state.player.ship.name) + 42);

    for (const c of crew) {
      const assigned = c.assignedRoom || 'bridge';
      const room = this.rooms.find(r => r.type.toLowerCase() === assigned.toLowerCase()) || this.rooms[0];

      const gfx = this.add.graphics().setDepth(5);
      const margin = 20;
      const roomLeft = room.x + margin;
      const roomRight = room.x + room.widthPx - margin;
      const wx = rng.int(roomLeft, roomRight);
      const floorY = room.y + (FLOOR_Y_TILE * SCALED_TILE);

      const data: CrewSpriteData = {
        gfx,
        x: wx,
        targetX: wx,
        roomX: roomLeft,
        roomRight,
        floorY,
        role: c.role,
        speed: 20 + rng.int(0, 20),
        waitTimer: rng.float(1, 4),
        facingRight: rng.next() > 0.5,
        walkFrame: 0,
        walkTimer: 0,
      };

      this.drawCrewMember(data);
      this.crewData.push(data);
    }
  }

  private updateCrew(dt: number): void {
    for (const c of this.crewData) {
      if (c.waitTimer > 0) {
        // Standing still
        c.waitTimer -= dt;
        if (c.waitTimer <= 0) {
          // Pick a new target within the room
          const range = c.roomRight - c.roomX;
          c.targetX = c.roomX + Math.random() * range;
        }
      } else {
        // Walk toward target
        const dx = c.targetX - c.x;
        if (Math.abs(dx) < 2) {
          // Arrived — wait before next move
          c.x = c.targetX;
          c.waitTimer = 2 + Math.random() * 4;
          c.walkFrame = 0;
        } else {
          c.facingRight = dx > 0;
          c.x += Math.sign(dx) * c.speed * dt;
          c.walkTimer += dt;
          if (c.walkTimer > 0.2) {
            c.walkTimer = 0;
            c.walkFrame = (c.walkFrame + 1) % 2;
          }
        }
      }
      this.drawCrewMember(c);
    }
  }

  private drawCrewMember(c: CrewSpriteData): void {
    const gfx = c.gfx;
    const x = c.x;
    const y = c.floorY;
    gfx.clear();

    // Role color
    let color = 0xcccccc;
    switch (c.role.toLowerCase()) {
      case 'pilot': color = 0x00ffff; break;
      case 'engineer': color = 0xffaa00; break;
      case 'gunner': color = 0xff3333; break;
      case 'scientist': color = 0x33ff33; break;
      case 'medic': color = 0xffffff; break;
      case 'navigator': color = 0xaaaaff; break;
    }

    // Leg sway for walking animation
    const legSway = c.walkFrame === 1 ? 3 : 0;
    const dir = c.facingRight ? 1 : -1;

    gfx.lineStyle(2, color, 1);
    // Body
    gfx.lineBetween(x, y - 24, x, y - 10);
    // Arms — slight swing when walking
    const armSwing = c.walkFrame === 1 ? 2 * dir : 0;
    gfx.lineBetween(x - 6 + armSwing, y - 20, x + 6 + armSwing, y - 20);
    // Legs — stride when walking
    gfx.lineBetween(x, y - 10, x - 5 + legSway * dir, y);
    gfx.lineBetween(x, y - 10, x + 5 - legSway * dir, y);
    // Head
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y - 28, 4);
  }
}
