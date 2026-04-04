import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { PlanetData } from '../entities/StarSystem';
import { SeededRandom } from '../utils/SeededRandom';
import { CargoItem, getCargoCapacity, getCargoUsed, getCaptainTitle } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import {
  LORE_FRAGMENTS, LoreFragment,
  TRAP_TYPES, TrapType,
  ENCOUNTER_TYPES, EncounterType,
  RUIN_LOOT, RuinLoot,
  RUINS_CHATTER,
} from '../data';

// ─── Constants ──────────────────────────────────────────

const MAP_SIZE = 48;
const TILE_SIZE = 16;
const PANEL_WIDTH = 240;
const MOVE_DELAY = 180; // slower than surface — cautious exploration

// BSP generation params
const MIN_ROOM_SIZE = 5;
const MAX_ROOM_SIZE = 10;
const MIN_SPLIT_SIZE = 12;
const CORRIDOR_WIDTH = 2;

// ─── Types ──────────────────────────────────────────────

type RuinTileType =
  | 'void'       // empty/unreachable
  | 'floor'      // walkable floor
  | 'wall'       // impassable wall
  | 'door'       // walkable door
  | 'trap'       // hidden trap
  | 'treasure'   // loot chest
  | 'lore'       // lore tablet
  | 'rubble'     // decorative obstacle
  | 'stairs_up'  // exit (back to surface)
  | 'stairs_down'// deeper level (future)
  | 'encounter'; // surprise encounter

interface RuinTile {
  type: RuinTileType;
  walkable: boolean;
  floorVariant?: number;    // 1-3 for floor tiles
  revealed?: boolean;       // fog of war (future)
  trapType?: TrapType;
  trapTriggered?: boolean;
  encounterType?: EncounterType;
  encounterCleared?: boolean;
  lootItem?: RuinLoot;
  lootCollected?: boolean;
  loreEntry?: LoreFragment;
  loreRead?: boolean;
  doorOpen?: boolean;
}

interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: { x: number; y: number; w: number; h: number };
}

// ─── Scene ──────────────────────────────────────────────

export class RuinsScene extends Phaser.Scene {
  private state!: GameState;
  private planet!: PlanetData;
  private tiles: RuinTile[][] = [];
  private mapRT!: Phaser.GameObjects.RenderTexture;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerX = 0;
  private playerY = 0;
  private lastMoveTime = 0;
  private ruinLoot: CargoItem[] = [];
  private discoveredLore: LoreFragment[] = [];
  private encounterActive = false;
  private currentEncounter: EncounterType | null = null;
  private suitIntegrity = { current: 100, max: 100 };

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: 'RuinsScene' });
  }

  init(data: { planet: PlanetData }): void {
    this.planet = data.planet;
  }

  create(): void {
    this.state = getGameState();
    this.lastMoveTime = 0;
    this.ruinLoot = [];
    this.discoveredLore = [];
    this.encounterActive = false;
    this.currentEncounter = null;
    this.suitIntegrity = { current: 100, max: 100 };

    // Setup frame
    const frame = getFrameManager();
    frame.enterGameplay(`Ruins: ${this.planet.name}`);
    frame.setHullLabel('SUIT');
    frame.setThemeFromShip(this.state.player.ship);
    frame.showPanel(PANEL_WIDTH);
    this.setupPanelContent();
    frame.setNav([
      { id: 'ruins', label: 'Ruins', active: true },
      { id: 'exit', label: 'Exit', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'exit') this.exitRuins();
    });

    // Camera
    this.cameras.main.setBackgroundColor(0x050508);
    const mapPixels = MAP_SIZE * TILE_SIZE;
    this.cameras.main.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, mapPixels, mapPixels);
    this.cameras.main.setZoom(2);

    // Map render texture
    this.mapRT = this.add.renderTexture(0, 0, mapPixels, mapPixels).setOrigin(0, 0).setDepth(0);
    this.generateRuins();
    this.drawMap();

    // Player sprite — person, not rover
    this.playerSprite = this.add.image(0, 0, 'tile_player').setOrigin(0.5, 0.5).setDepth(1);
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
      if (getFrameManager().isModalVisible() && !this.encounterActive) {
        getFrameManager().hideModal();
      } else if (!this.encounterActive) {
        this.exitRuins();
      }
    });
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (getFrameManager().isModalVisible() && !this.encounterActive) {
        getFrameManager().hideModal();
      } else if (!this.encounterActive) {
        this.interactItem();
      }
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (!this.encounterActive) {
        this.enterExit();
      }
    });

    getAudioManager().setAmbience('ship_interior'); // reuse interior ambience for now
    this.updatePanel();
    getChatterSystem().attach(this, RUINS_CHATTER);
  }

  shutdown(): void {
    const frame = getFrameManager();
    frame.hideModal();
    frame.hidePanel();
    getChatterSystem().stop();
  }

  update(time: number): void {
    if (!this.encounterActive && !getFrameManager().isModalVisible()) {
      this.handleMovement(time);
    }
    this.drawPlayer();
  }

  // ─── FRAME PANEL ──────────────────────────────────────

  private setupPanelContent(): void {
    const frame = getFrameManager();
    frame.setPanelContent(`
      <div class="section" id="panel-ruin"></div>
      <div class="section" id="panel-status"></div>
      <div class="section" id="panel-loot"></div>
      <div class="section" id="panel-tile"></div>
      <div style="flex:1"></div>
      <div class="section controls" id="panel-controls"></div>
    `);

    document.getElementById('panel-controls')!.innerHTML =
      `<span>WASD/Arrows</span> Move<br>` +
      `<span>SPACE</span> Interact<br>` +
      `<span>ENTER</span> Enter/Exit<br>` +
      `<span>ESC</span> Exit`;
  }

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private updatePanel(): void {
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    const frame = getFrameManager();
    // Show suit integrity in the bottom bar HULL slot
    frame.updateStatus(this.suitIntegrity, ship.fuel, cargoUsed, cargoMax, this.state.player.credits, getCaptainTitle(this.state.player));

    // Ruin info
    const panelRuin = document.getElementById('panel-ruin');
    if (panelRuin) {
      panelRuin.innerHTML =
        `<div class="section-title">Ancient Ruins</div>` +
        this.row('Planet', this.planet.name) +
        this.row('Depth', 'Level 1') +
        this.row('Lore Found', `${this.discoveredLore.length}`);
    }

    // Player status
    const panelStatus = document.getElementById('panel-status');
    if (panelStatus) {
      const suitPct = Math.floor((this.suitIntegrity.current / this.suitIntegrity.max) * 100);
      const suitCls = suitPct > 50 ? 'good' : suitPct > 25 ? 'warn' : 'bad';
      panelStatus.innerHTML =
        `<div class="section-title">Suit Status</div>` +
        this.row('Integrity', `${this.suitIntegrity.current}/${this.suitIntegrity.max}`, suitCls) +
        this.row('Position', `${this.playerX}, ${this.playerY}`);
    }

    // Loot collected
    const panelLoot = document.getElementById('panel-loot');
    if (panelLoot) {
      let lootHtml = `<div class="section-title">Salvage</div>`;
      if (this.ruinLoot.length === 0) {
        lootHtml += `<div class="label">Nothing found yet</div>`;
      } else {
        for (const item of this.ruinLoot) {
          lootHtml += `<div class="row"><span class="label">${item.name}</span><span class="value">${item.value} CR</span></div>`;
        }
      }
      panelLoot.innerHTML = lootHtml;
    }

    // Current tile info
    const panelTile = document.getElementById('panel-tile');
    if (panelTile) {
      const tile = this.tiles[this.playerY]?.[this.playerX];
      if (tile) {
        let tileInfo = `<div class="section-title">Current Tile</div>`;
        switch (tile.type) {
          case 'stairs_up':
            tileInfo += this.row('Type', 'Stairs Up', 'good');
            tileInfo += `<div class="label">Press ENTER to exit</div>`;
            break;
          case 'stairs_down':
            tileInfo += this.row('Type', 'Stairs Down', 'warn');
            tileInfo += `<div class="label">Deeper levels...</div>`;
            break;
          case 'treasure':
            if (!tile.lootCollected) {
              tileInfo += this.row('Type', 'Treasure', 'good');
              tileInfo += `<div class="label">Press SPACE to search</div>`;
            } else {
              tileInfo += this.row('Type', 'Empty Chest');
            }
            break;
          case 'lore':
            if (!tile.loreRead) {
              tileInfo += this.row('Type', 'Ancient Tablet', 'warn');
              tileInfo += `<div class="label">Press SPACE to read</div>`;
            } else {
              tileInfo += this.row('Type', 'Tablet (Read)');
            }
            break;
          case 'door':
            tileInfo += this.row('Type', tile.doorOpen ? 'Open Door' : 'Door');
            break;
          default:
            tileInfo += this.row('Type', tile.type.replace('_', ' '));
        }
        panelTile.innerHTML = tileInfo;
      }
    }

  }

  // ─── MOVEMENT ─────────────────────────────────────────

  private handleMovement(time: number): void {
    if (time - this.lastMoveTime < MOVE_DELAY) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;
    else return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) return;
    const tile = this.tiles[ny][nx];
    if (!tile.walkable) return;

    // Rotate player sprite based on direction
    if (dx === 1) this.playerSprite.setAngle(90);
    else if (dx === -1) this.playerSprite.setAngle(-90);
    else if (dy === -1) this.playerSprite.setAngle(0);
    else if (dy === 1) this.playerSprite.setAngle(180);

    this.playerX = nx;
    this.playerY = ny;
    this.lastMoveTime = time;

    getAudioManager().playSfx('footstep');

    // Open doors on approach
    if (tile.type === 'door' && !tile.doorOpen) {
      tile.doorOpen = true;
      this.redrawTile(nx, ny);
    }

    // Trigger traps
    if (tile.type === 'trap' && !tile.trapTriggered) {
      this.triggerTrap(tile);
    }

    // Trigger encounters
    if (tile.type === 'encounter' && !tile.encounterCleared) {
      this.triggerEncounter(tile);
    }

    this.centerCamera();
    this.updatePanel();
  }

  private centerCamera(): void {
    this.cameras.main.centerOn(
      this.playerX * TILE_SIZE + TILE_SIZE / 2,
      this.playerY * TILE_SIZE + TILE_SIZE / 2
    );
  }

  // ─── DRAWING ──────────────────────────────────────────

  private getTileTexture(tile: RuinTile): string {
    switch (tile.type) {
      case 'void':
        return 'ruins_wall'; // shouldn't be visible, but fallback
      case 'floor':
        return `ruins_floor_${tile.floorVariant ?? 1}`;
      case 'wall':
        return 'ruins_wall';
      case 'door':
        return tile.doorOpen ? 'ruins_door_open' : 'ruins_door_closed';
      case 'trap':
        return tile.trapTriggered ? 'ruins_trap_triggered' : 'ruins_trap';
      case 'treasure':
        return tile.lootCollected ? 'ruins_treasure_open' : 'ruins_treasure';
      case 'lore':
        return tile.loreRead ? 'ruins_lore_read' : 'ruins_lore';
      case 'rubble':
        return 'ruins_rubble';
      case 'stairs_up':
        return 'ruins_stairs_up';
      case 'stairs_down':
        return 'ruins_stairs_down';
      case 'encounter':
        return tile.encounterCleared ? 'ruins_encounter_cleared' : 'ruins_encounter';
    }
  }

  private drawMap(): void {
    this.mapRT.clear();
    const stamp = this.make.image({ x: 0, y: 0, key: 'ruins_floor_1' }, false);
    stamp.setOrigin(0, 0);

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.tiles[y][x];
        if (tile.type === 'void') continue; // leave black

        const texKey = this.getTileTexture(tile);
        stamp.setTexture(texKey);
        stamp.setPosition(x * TILE_SIZE, y * TILE_SIZE);
        stamp.clearTint();
        this.mapRT.draw(stamp);
      }
    }

    stamp.destroy();
  }

  private drawPlayer(): void {
    this.playerSprite.setPosition(
      this.playerX * TILE_SIZE + TILE_SIZE / 2,
      this.playerY * TILE_SIZE + TILE_SIZE / 2
    );
  }

  private redrawTile(x: number, y: number): void {
    const tile = this.tiles[y][x];
    const stamp = this.make.image({ x: 0, y: 0, key: this.getTileTexture(tile) }, false);
    stamp.setOrigin(0, 0);
    stamp.setPosition(x * TILE_SIZE, y * TILE_SIZE);
    stamp.clearTint();
    this.mapRT.draw(stamp);
    stamp.destroy();
  }

  // ─── INTERACTION ──────────────────────────────────────

  private interact(): void {
    this.interactItem();
  }

  private interactItem(): void {
    const tile = this.tiles[this.playerY][this.playerX];

    if (tile.type === 'treasure' && !tile.lootCollected) {
      this.collectTreasure(tile);
    } else if (tile.type === 'lore' && !tile.loreRead) {
      this.readLore(tile);
    }
  }

  private enterExit(): void {
    const tile = this.tiles[this.playerY][this.playerX];

    if (tile.type === 'stairs_up') {
      this.exitRuins();
    }
  }

  private collectTreasure(tile: RuinTile): void {
    if (!tile.lootItem) return;
    tile.lootCollected = true;

    const item = tile.lootItem;
    const existing = this.ruinLoot.find(c => c.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.ruinLoot.push({ id: item.id, name: item.name, quantity: 1, value: item.value });
    }

    getAudioManager().playSfx('mine');
    getFrameManager().showAlert(`Found: ${item.name} (${item.value} CR)`, 'info', 5000);

    this.redrawTile(this.playerX, this.playerY);
    this.updatePanel();
  }

  private readLore(tile: RuinTile): void {
    if (!tile.loreEntry) return;
    tile.loreRead = true;

    this.discoveredLore.push(tile.loreEntry);
    this.state.player.stats.lore_discovered++;

    // Persist to player's lore collection (deduplicate by id)
    const known = this.state.player.loreFragments;
    if (!known.find(f => f.id === tile.loreEntry!.id)) {
      const system = this.state.galaxy[this.state.player.currentSystemId];
      known.push({
        ...tile.loreEntry,
        discoveredAt: {
          systemName: system.name,
          planetName: this.planet.name,
          timestamp: Date.now(),
        },
      });
    }

    getAudioManager().playSfx('ui_select');

    // Show lore in a dismissible modal so the player can read it
    getFrameManager().showModal(tile.loreEntry.title, tile.loreEntry.text);

    this.redrawTile(this.playerX, this.playerY);
    this.updatePanel();
  }

  // ─── TRAPS ────────────────────────────────────────────

  private triggerTrap(tile: RuinTile): void {
    tile.trapTriggered = true;
    const trap = tile.trapType!;

    // Apply damage to suit integrity
    this.suitIntegrity.current = Math.max(0, this.suitIntegrity.current - trap.damage);

    getAudioManager().playSfx('ui_deny');
    getFrameManager().showAlert(trap.triggerText, 'danger');

    this.redrawTile(this.playerX, this.playerY);
    this.updatePanel();

    // Check for suit failure
    if (this.suitIntegrity.current <= 0) {
      getFrameManager().showAlert('Your suit integrity has failed! Emergency teleport activated.', 'danger');
      this.suitIntegrity.current = 1;
      this.time.delayedCall(2000, () => this.exitRuins());
    }
  }

  // ─── ENCOUNTERS ───────────────────────────────────────

  private triggerEncounter(tile: RuinTile): void {
    this.encounterActive = true;
    this.currentEncounter = tile.encounterType!;
    const enc = tile.encounterType!;

    getAudioManager().playSfx('ui_deny');

    const frame = getFrameManager();
    const dmgCls = enc.damage >= 15 ? 'bad' : '';
    frame.showModalHtml(`${enc.name}`, `
      <div class="encounter-desc">${enc.description}</div>
      <div class="encounter-stats">
        <div class="stat">Threat: <span class="stat-val ${dmgCls}">${enc.damage} damage</span></div>
        ${enc.reward ? `<div class="stat">Reward: <span class="stat-val">${enc.reward.value} CR</span></div>` : ''}
      </div>
      <div class="encounter-buttons">
        <button class="encounter-btn fight" id="enc-fight">Fight</button>
        <button class="encounter-btn flee" id="enc-flee">Flee</button>
      </div>
    `);

    // Bind button clicks
    document.getElementById('enc-fight')!.addEventListener('click', () => this.resolveEncounter('fight'));
    document.getElementById('enc-flee')!.addEventListener('click', () => this.resolveEncounter('flee'));

    this.updatePanel();
  }

  private resolveEncounter(action: 'fight' | 'flee'): void {
    if (!this.currentEncounter) return;
    const tile = this.tiles[this.playerY][this.playerX];
    const enc = this.currentEncounter;
    const frame = getFrameManager();

    if (action === 'fight') {
      // Take damage to suit integrity
      const dmg = enc.damage;
      this.suitIntegrity.current = Math.max(0, this.suitIntegrity.current - dmg);

      getAudioManager().playSfx('combat_hit');

      tile.encounterCleared = true;
      this.redrawTile(this.playerX, this.playerY);

      // Build narrative
      let rewardText = '';
      if (enc.reward && enc.reward.type === 'credits') {
        this.state.player.credits += enc.reward.value;
        rewardText = `<div class="encounter-outcome win">+${enc.reward.value} CR recovered from the wreckage.</div>`;
      }

      const suitFailed = this.suitIntegrity.current <= 0;
      if (suitFailed) {
        this.suitIntegrity.current = 1;
      }

      const dmgText = dmg > 0
        ? `<div class="encounter-outcome loss">Suit integrity: -${dmg} (${this.suitIntegrity.current}/${this.suitIntegrity.max} remaining)</div>`
        : '';

      // Show outcome with victory sound after a beat
      this.time.delayedCall(300, () => {
        getAudioManager().playSfx('combat_victory');
        frame.showModalHtml('Victory', `
          <div class="encounter-narrative">${enc.fightText}</div>
          ${dmgText}
          ${rewardText}
          ${suitFailed ? '<div class="encounter-outcome loss">CRITICAL: Suit integrity failed! Emergency teleport activated.</div>' : ''}
          <div class="encounter-buttons">
            <button class="encounter-btn dismiss" id="enc-dismiss">Continue</button>
          </div>
        `);

        document.getElementById('enc-dismiss')!.addEventListener('click', () => {
          frame.hideModal();
          this.encounterActive = false;
          this.currentEncounter = null;
          this.updatePanel();
          if (suitFailed) {
            this.time.delayedCall(500, () => this.exitRuins());
          }
        });
      });
    } else {
      getAudioManager().playSfx('combat_flee');

      frame.showModalHtml('Fled', `
        <div class="encounter-narrative">${enc.fleeText}</div>
        <div class="encounter-outcome fled">You escaped without injury.</div>
        <div class="encounter-buttons">
          <button class="encounter-btn dismiss" id="enc-dismiss">Continue</button>
        </div>
      `);

      document.getElementById('enc-dismiss')!.addEventListener('click', () => {
        frame.hideModal();
        this.encounterActive = false;
        this.currentEncounter = null;
        this.updatePanel();
      });
    }
  }

  // ─── EXIT ─────────────────────────────────────────────

  private exitRuins(): void {
    // Transfer loot to ship cargo
    for (const item of this.ruinLoot) {
      const existing = this.state.player.cargo.find(c => c.id === item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        this.state.player.cargo.push({ ...item });
      }
    }
    this.ruinLoot = [];

    getAudioManager().playSfx('footstep');
    const frame = getFrameManager();
    frame.hidePanel();

    this.scene.start('TransitionScene', {
      type: 'takeoff',
      targetScene: 'PlanetSurfaceScene',
      targetData: { planet: this.planet },
      text: 'ASCENDING TO SURFACE...',
    });
  }

  // ─── GENERATION ───────────────────────────────────────

  private generateRuins(): void {
    const seed = this.state.seed * 10000 + this.planet.id * 137;
    const rng = new SeededRandom(seed);

    // Initialize all as void
    this.tiles = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        this.tiles[y][x] = { type: 'void', walkable: false };
      }
    }

    // BSP room generation
    const root: BSPNode = { x: 1, y: 1, w: MAP_SIZE - 2, h: MAP_SIZE - 2 };
    this.splitBSP(root, rng, 0);

    // Collect all rooms
    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    this.collectRooms(root, rooms);

    // Carve rooms into the map
    for (const room of rooms) {
      this.carveRoom(room, rng);
    }

    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
      this.carveCorridor(rooms[i], rooms[i + 1], rng);
    }

    // Place walls around all floor tiles
    this.placeWalls();

    // Place features
    if (rooms.length > 0) {
      // Entry stairs in first room
      const entryRoom = rooms[0];
      const sx = entryRoom.x + Math.floor(entryRoom.w / 2);
      const sy = entryRoom.y + Math.floor(entryRoom.h / 2);
      this.tiles[sy][sx] = { type: 'stairs_up', walkable: true };
      this.playerX = sx;
      this.playerY = sy;

      // Exit stairs in last room (for future deeper levels)
      if (rooms.length > 1) {
        const exitRoom = rooms[rooms.length - 1];
        const ex = exitRoom.x + Math.floor(exitRoom.w / 2);
        const ey = exitRoom.y + Math.floor(exitRoom.h / 2);
        this.tiles[ey][ex] = { type: 'stairs_down', walkable: true };
      }

      // Place doors at corridor-room junctions
      this.placeDoors(rooms, rng);

      // Place traps in corridors (15% of corridor floor tiles)
      this.placeTraps(rng);

      // Place lore tablets (1-3 per ruin)
      const loreCount = rng.int(1, Math.min(3, rooms.length - 1));
      this.placeLore(rooms, rng, loreCount);

      // Place treasure (1-3 per ruin)
      const treasureCount = rng.int(1, Math.min(3, rooms.length - 1));
      this.placeTreasure(rooms, rng, treasureCount);

      // Place encounters (1-2 per ruin)
      const encounterCount = rng.int(1, Math.min(2, rooms.length - 1));
      this.placeEncounters(rooms, rng, encounterCount);

      // Scatter some rubble for atmosphere
      this.placeRubble(rng);
    }
  }

  private splitBSP(node: BSPNode, rng: SeededRandom, depth: number): void {
    if (node.w < MIN_SPLIT_SIZE * 2 && node.h < MIN_SPLIT_SIZE * 2) {
      // Leaf — create room
      const roomW = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.w - 2));
      const roomH = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.h - 2));
      const roomX = node.x + rng.int(1, node.w - roomW - 1);
      const roomY = node.y + rng.int(1, node.h - roomH - 1);
      node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
      return;
    }

    if (depth > 6) {
      // Max depth — create room
      const roomW = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.w - 2));
      const roomH = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.h - 2));
      const roomX = node.x + rng.int(1, Math.max(1, node.w - roomW - 1));
      const roomY = node.y + rng.int(1, Math.max(1, node.h - roomH - 1));
      node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
      return;
    }

    // Decide split direction
    const splitH = node.w > node.h ? true : node.h > node.w ? false : rng.next() > 0.5;

    if (splitH) {
      if (node.w < MIN_SPLIT_SIZE * 2) {
        // Can't split horizontally, make a room
        const roomW = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.w - 2));
        const roomH = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.h - 2));
        const roomX = node.x + rng.int(1, Math.max(1, node.w - roomW - 1));
        const roomY = node.y + rng.int(1, Math.max(1, node.h - roomH - 1));
        node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
        return;
      }
      const split = node.x + rng.int(MIN_SPLIT_SIZE, node.w - MIN_SPLIT_SIZE);
      node.left = { x: node.x, y: node.y, w: split - node.x, h: node.h };
      node.right = { x: split, y: node.y, w: node.x + node.w - split, h: node.h };
    } else {
      if (node.h < MIN_SPLIT_SIZE * 2) {
        const roomW = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.w - 2));
        const roomH = rng.int(MIN_ROOM_SIZE, Math.min(MAX_ROOM_SIZE, node.h - 2));
        const roomX = node.x + rng.int(1, Math.max(1, node.w - roomW - 1));
        const roomY = node.y + rng.int(1, Math.max(1, node.h - roomH - 1));
        node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
        return;
      }
      const split = node.y + rng.int(MIN_SPLIT_SIZE, node.h - MIN_SPLIT_SIZE);
      node.left = { x: node.x, y: node.y, w: node.w, h: split - node.y };
      node.right = { x: node.x, y: split, w: node.w, h: node.y + node.h - split };
    }

    this.splitBSP(node.left!, rng, depth + 1);
    this.splitBSP(node.right!, rng, depth + 1);
  }

  private collectRooms(node: BSPNode, rooms: { x: number; y: number; w: number; h: number }[]): void {
    if (node.room) {
      rooms.push(node.room);
    }
    if (node.left) this.collectRooms(node.left, rooms);
    if (node.right) this.collectRooms(node.right, rooms);
  }

  private carveRoom(room: { x: number; y: number; w: number; h: number }, rng: SeededRandom): void {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
          this.tiles[y][x] = {
            type: 'floor',
            walkable: true,
            floorVariant: rng.int(1, 3),
          };
        }
      }
    }
  }

  private carveCorridor(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
    rng: SeededRandom
  ): void {
    // Center of each room
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    // L-shaped corridor: go horizontal then vertical (or vice versa)
    if (rng.next() > 0.5) {
      this.carveHLine(ax, bx, ay, rng);
      this.carveVLine(ay, by, bx, rng);
    } else {
      this.carveVLine(ay, by, ax, rng);
      this.carveHLine(ax, bx, by, rng);
    }
  }

  private carveHLine(x1: number, x2: number, y: number, rng: SeededRandom): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = 0; dy < CORRIDOR_WIDTH; dy++) {
        const cy = y + dy;
        if (x >= 0 && x < MAP_SIZE && cy >= 0 && cy < MAP_SIZE && this.tiles[cy][x].type === 'void') {
          this.tiles[cy][x] = { type: 'floor', walkable: true, floorVariant: rng.int(1, 3) };
        }
      }
    }
  }

  private carveVLine(y1: number, y2: number, x: number, rng: SeededRandom): void {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = 0; dx < CORRIDOR_WIDTH; dx++) {
        const cx = x + dx;
        if (cx >= 0 && cx < MAP_SIZE && y >= 0 && y < MAP_SIZE && this.tiles[y][cx].type === 'void') {
          this.tiles[y][cx] = { type: 'floor', walkable: true, floorVariant: rng.int(1, 3) };
        }
      }
    }
  }

  private placeWalls(): void {
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.tiles[y][x].type !== 'void') continue;
        // Check if any neighbor is floor-like
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < MAP_SIZE && nx >= 0 && nx < MAP_SIZE) {
              const neighbor = this.tiles[ny][nx];
              if (neighbor.type === 'floor' || neighbor.type === 'stairs_up' || neighbor.type === 'stairs_down') {
                this.tiles[y][x] = { type: 'wall', walkable: false };
                break;
              }
            }
          }
          if (this.tiles[y][x].type === 'wall') break;
        }
      }
    }
  }

  private placeDoors(rooms: { x: number; y: number; w: number; h: number }[], rng: SeededRandom): void {
    // Find corridor-room junction points (floor tiles adjacent to room edges)
    for (const room of rooms) {
      // Check each edge of the room for corridor connections
      const edges: [number, number][] = [];

      // Top and bottom edges
      for (let x = room.x; x < room.x + room.w; x++) {
        if (room.y - 1 >= 0 && this.tiles[room.y - 1][x]?.type === 'floor') {
          edges.push([x, room.y]);
        }
        const by = room.y + room.h;
        if (by < MAP_SIZE && this.tiles[by][x]?.type === 'floor') {
          edges.push([x, by - 1]);
        }
      }
      // Left and right edges
      for (let y = room.y; y < room.y + room.h; y++) {
        if (room.x - 1 >= 0 && this.tiles[y][room.x - 1]?.type === 'floor') {
          edges.push([room.x, y]);
        }
        const rx = room.x + room.w;
        if (rx < MAP_SIZE && this.tiles[y][rx]?.type === 'floor') {
          edges.push([rx - 1, y]);
        }
      }

      // Place doors at some junction points (50% chance per edge)
      for (const [dx, dy] of edges) {
        if (rng.next() < 0.5 && this.tiles[dy][dx].type === 'floor') {
          this.tiles[dy][dx] = {
            type: 'door',
            walkable: true,
            doorOpen: false,
          };
        }
      }
    }
  }

  private placeTraps(rng: SeededRandom): void {
    // Place traps on some corridor floors (not in rooms proper)
    let trapCount = 0;
    const maxTraps = rng.int(3, 7);

    for (let y = 0; y < MAP_SIZE && trapCount < maxTraps; y++) {
      for (let x = 0; x < MAP_SIZE && trapCount < maxTraps; x++) {
        const tile = this.tiles[y][x];
        if (tile.type !== 'floor') continue;
        // Only in narrow areas (corridor-like: few floor neighbors)
        let floorNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny2 = y + dy, nx2 = x + dx;
            if (ny2 >= 0 && ny2 < MAP_SIZE && nx2 >= 0 && nx2 < MAP_SIZE &&
                this.tiles[ny2][nx2].walkable) {
              floorNeighbors++;
            }
          }
        // Corridors tend to have 2-4 walkable neighbors
        if (floorNeighbors >= 2 && floorNeighbors <= 4 && rng.next() < 0.08) {
          const trapType = TRAP_TYPES[rng.int(0, TRAP_TYPES.length - 1)];
          this.tiles[y][x] = {
            type: 'trap',
            walkable: true,
            trapType,
            trapTriggered: false,
          };
          trapCount++;
        }
      }
    }
  }

  private placeLore(
    rooms: { x: number; y: number; w: number; h: number }[],
    rng: SeededRandom,
    count: number
  ): void {
    // Shuffle lore and pick from it
    const shuffled = [...LORE_FRAGMENTS].sort(() => rng.next() - 0.5);
    let placed = 0;

    for (let i = 1; i < rooms.length && placed < count; i++) {
      const room = rooms[i];
      // Place in a corner of the room
      const lx = room.x + (rng.next() > 0.5 ? 1 : room.w - 2);
      const ly = room.y + (rng.next() > 0.5 ? 1 : room.h - 2);
      if (lx >= 0 && lx < MAP_SIZE && ly >= 0 && ly < MAP_SIZE && this.tiles[ly][lx].type === 'floor') {
        this.tiles[ly][lx] = {
          type: 'lore',
          walkable: true,
          loreEntry: shuffled[placed],
          loreRead: false,
        };
        placed++;
      }
    }
  }

  private placeTreasure(
    rooms: { x: number; y: number; w: number; h: number }[],
    rng: SeededRandom,
    count: number
  ): void {
    let placed = 0;
    // Pick loot items based on rarity
    for (let i = rooms.length - 1; i >= 1 && placed < count; i--) {
      const room = rooms[i];
      const tx = room.x + rng.int(1, room.w - 2);
      const ty = room.y + rng.int(1, room.h - 2);
      if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE && this.tiles[ty][tx].type === 'floor') {
        // Weighted loot selection: common 60%, uncommon 30%, rare 10%
        const roll = rng.next();
        let pool: RuinLoot[];
        if (roll < 0.6) {
          pool = RUIN_LOOT.filter(l => l.rarity === 'common');
        } else if (roll < 0.9) {
          pool = RUIN_LOOT.filter(l => l.rarity === 'uncommon');
        } else {
          pool = RUIN_LOOT.filter(l => l.rarity === 'rare');
        }
        const loot = pool[rng.int(0, pool.length - 1)];

        this.tiles[ty][tx] = {
          type: 'treasure',
          walkable: true,
          lootItem: loot,
          lootCollected: false,
        };
        placed++;
      }
    }
  }

  private placeEncounters(
    rooms: { x: number; y: number; w: number; h: number }[],
    rng: SeededRandom,
    count: number
  ): void {
    let placed = 0;
    // Place encounters in middle rooms (not first/last)
    const midRooms = rooms.slice(1, -1);
    for (let i = 0; i < midRooms.length && placed < count; i++) {
      if (rng.next() < 0.5) continue; // skip some rooms
      const room = midRooms[i];
      const ex = room.x + Math.floor(room.w / 2);
      const ey = room.y + Math.floor(room.h / 2);
      if (ex >= 0 && ex < MAP_SIZE && ey >= 0 && ey < MAP_SIZE && this.tiles[ey][ex].type === 'floor') {
        const encounter = ENCOUNTER_TYPES[rng.int(0, ENCOUNTER_TYPES.length - 1)];
        this.tiles[ey][ex] = {
          type: 'encounter',
          walkable: true,
          encounterType: encounter,
          encounterCleared: false,
        };
        placed++;
      }
    }
  }

  private placeRubble(rng: SeededRandom): void {
    // Scatter rubble along walls for atmosphere
    let rubbleCount = 0;
    const maxRubble = rng.int(5, 12);

    for (let y = 1; y < MAP_SIZE - 1 && rubbleCount < maxRubble; y++) {
      for (let x = 1; x < MAP_SIZE - 1 && rubbleCount < maxRubble; x++) {
        if (this.tiles[y][x].type !== 'floor') continue;
        // Check if adjacent to a wall
        let nearWall = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (this.tiles[y + dy]?.[x + dx]?.type === 'wall') nearWall = true;
          }
        if (nearWall && rng.next() < 0.04) {
          this.tiles[y][x] = { type: 'rubble', walkable: false };
          rubbleCount++;
        }
      }
    }
  }
}
