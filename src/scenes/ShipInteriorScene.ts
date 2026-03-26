import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { ModuleSlot, ModuleType } from '../entities/Ship';
import { getCargoCapacity, getCargoUsed } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { TRADE_GOODS } from '../data/trade';
import { SeededRandom, hashString } from '../utils/SeededRandom';

const PANEL_WIDTH = 340;
const TILE_SIZE = 32;
const TILE_SCALE = 2;
const SCALED_TILE = TILE_SIZE * TILE_SCALE;
const ROOM_HEIGHT_TILES = 5;   // room is 5 tiles tall
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

  constructor() {
    super({ key: 'ShipInteriorScene' });
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
    frame.setNav([
      { id: 'ship', label: 'Ship', active: true },
      { id: 'system', label: 'System', shortcut: 'TAB' },
      { id: 'terminal', label: 'Terminal', shortcut: 'T' },
      { id: 'map', label: 'Galaxy Map', shortcut: 'M' },
    ], (id) => {
      switch (id) {
        case 'system': this.scene.start('SystemScene'); break;
        case 'terminal': this.scene.start('TerminalScene'); break;
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

    // Place player in bridge center
    const bridge = this.rooms[0];
    this.playerX = bridge.x + bridge.widthPx / 2;
    this.floorWorldY = bridge.y + (FLOOR_Y_TILE * SCALED_TILE);

    // Player sprite (graphics-based stick figure)
    this.playerSprite = this.add.graphics().setDepth(10);

    // Setup camera - offset for panel, follow player horizontally
    const cam = this.cameras.main;
    cam.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    cam.setBounds(
      this.rooms[0].x - 100,
      this.rooms[0].y - 80,
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
      this.scene.start('SystemScene');
    });
    this.input.keyboard!.on('keydown-T', () => this.scene.start('TerminalScene'));
    this.input.keyboard!.on('keydown-M', () => this.scene.start('GalaxyMapScene'));
    this.input.keyboard!.on('keydown-ENTER', () => this.interactWithRoom());

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
    cam.scrollY = this.rooms[0].y - 80;
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

    let html = '';

    if (this.currentRoom) {
      const room = this.currentRoom;
      html += `<div class="section">`;
      html += `<div class="section-title">${room.label}</div>`;

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

    switch (this.currentRoom.type) {
      case 'bridge':
        this.scene.start('TerminalScene');
        break;
      case 'cargo':
        // TODO: cargo jettison UI
        break;
    }
  }
}
