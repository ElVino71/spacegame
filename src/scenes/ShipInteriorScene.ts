import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS } from '../utils/Constants';
import { ModuleSlot, ModuleType } from '../entities/Ship';

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  slot: ModuleSlot | null;
  color: number;
}

export class ShipInteriorScene extends Phaser.Scene {
  private state!: GameState;
  private graphics!: Phaser.GameObjects.Graphics;
  private rooms: Room[] = [];
  private playerX = 0;
  private playerY = 0;
  private selectedRoom: Room | null = null;
  private infoText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: 'ShipInteriorScene' });
  }

  create(): void {
    this.state = getGameState();
    this.cameras.main.setBackgroundColor(0x0a0a15);

    this.graphics = this.add.graphics();

    // Build rooms from ship modules
    this.buildRooms();

    // Place player in bridge
    this.playerX = this.rooms[0].x + this.rooms[0].width / 2;
    this.playerY = this.rooms[0].y + this.rooms[0].height - 20;

    // UI
    this.infoText = this.add.text(10, 10, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#00ff88',
      backgroundColor: '#111122cc', padding: { x: 8, y: 6 },
      wordWrap: { width: 300 },
    }).setScrollFactor(0).setDepth(100);

    this.instructionText = this.add.text(640, 690, 'WASD/Arrows to move | SPACE to interact with room | TAB to return to ship | T for terminal', {
      fontFamily: 'monospace', fontSize: '12px', color: '#666688',
    }).setScrollFactor(0).setDepth(100).setOrigin(0.5, 1);

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
    this.input.keyboard!.on('keydown-T', () => {
      this.scene.start('TerminalScene');
    });
    this.input.keyboard!.on('keydown-M', () => {
      this.scene.start('GalaxyMapScene');
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.handleMovement(dt);
    this.findCurrentRoom();
    this.draw();
    this.updateUI();
  }

  private buildRooms(): void {
    this.rooms = [];
    const ship = this.state.player.ship;
    const roomHeight = 100;
    const floorY = 400;

    // Module type to room visual config
    const roomConfig: Record<ModuleType, { label: string; color: number; width: number }> = {
      engine:       { label: 'Engine Room',       color: 0x553311, width: 120 },
      weapon:       { label: 'Weapons Bay',       color: 0x551111, width: 100 },
      shield:       { label: 'Shield Generator',  color: 0x113355, width: 100 },
      cargo:        { label: 'Cargo Bay',          color: 0x333322, width: 130 },
      sensor:       { label: 'Sensor Array',       color: 0x115533, width: 100 },
      computer:     { label: 'Computer Core',      color: 0x222244, width: 110 },
      mining:       { label: 'Mining Bay',         color: 0x443322, width: 110 },
      hull:         { label: 'Hull Plating',       color: 0x444444, width: 80 },
      life_support: { label: 'Life Support',       color: 0x224433, width: 100 },
    };

    // Always start with bridge
    let xOffset = 100;

    // Bridge (not a module slot)
    this.rooms.push({
      x: xOffset, y: floorY - roomHeight, width: 140, height: roomHeight,
      label: 'Bridge', slot: null, color: 0x223344,
    });
    xOffset += 150;

    // Rooms from module slots (deduplicated by type for display, but show all)
    const seenTypes = new Set<string>();
    for (const slot of ship.slots) {
      const config = roomConfig[slot.type];
      // Merge same-type slots visually (bigger room)
      if (seenTypes.has(slot.type)) {
        const existing = this.rooms.find(r => r.slot?.type === slot.type);
        if (existing) {
          existing.width += 40;
        }
        continue;
      }
      seenTypes.add(slot.type);

      this.rooms.push({
        x: xOffset, y: floorY - roomHeight, width: config.width, height: roomHeight,
        label: config.label, slot, color: config.color,
      });
      xOffset += config.width + 10;
    }

    // Center the ship
    const totalWidth = xOffset;
    const offsetX = (1280 - totalWidth) / 2;
    for (const room of this.rooms) {
      room.x += offsetX;
    }
  }

  private handleMovement(dt: number): void {
    const speed = 200;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= speed * dt;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += speed * dt;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= speed * dt;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += speed * dt;

    // Constrain to rooms (simple AABB)
    const newX = this.playerX + dx;
    const newY = this.playerY + dy;

    for (const room of this.rooms) {
      if (newX >= room.x + 10 && newX <= room.x + room.width - 10 &&
          newY >= room.y + 10 && newY <= room.y + room.height - 10) {
        this.playerX = newX;
        this.playerY = newY;
        return;
      }
    }

    // Allow horizontal movement through doorways (same Y level)
    for (const room of this.rooms) {
      if (newX >= room.x + 10 && newX <= room.x + room.width - 10 &&
          this.playerY >= room.y + 10 && this.playerY <= room.y + room.height - 10) {
        this.playerX = newX;
        return;
      }
    }
  }

  private findCurrentRoom(): void {
    this.selectedRoom = null;
    for (const room of this.rooms) {
      if (this.playerX >= room.x && this.playerX <= room.x + room.width &&
          this.playerY >= room.y && this.playerY <= room.y + room.height) {
        this.selectedRoom = room;
        break;
      }
    }
  }

  private draw(): void {
    this.graphics.clear();

    // Ship hull outline
    const firstRoom = this.rooms[0];
    const lastRoom = this.rooms[this.rooms.length - 1];
    const hullLeft = firstRoom.x - 30;
    const hullRight = lastRoom.x + lastRoom.width + 30;
    const hullTop = firstRoom.y - 40;
    const hullBottom = firstRoom.y + firstRoom.height + 20;

    // Hull shape
    this.graphics.lineStyle(2, 0x445566, 0.6);
    this.graphics.strokeRoundedRect(hullLeft, hullTop, hullRight - hullLeft, hullBottom - hullTop, 16);

    // Rooms
    for (const room of this.rooms) {
      const isSelected = room === this.selectedRoom;
      const alpha = isSelected ? 0.8 : 0.4;

      // Room floor/walls
      this.graphics.fillStyle(room.color, alpha);
      this.graphics.fillRect(room.x, room.y, room.width, room.height);

      // Room border
      this.graphics.lineStyle(1, isSelected ? COLORS.ui.primary : 0x556677, isSelected ? 0.8 : 0.5);
      this.graphics.strokeRect(room.x, room.y, room.width, room.height);

      // Door openings between rooms
      this.graphics.fillStyle(0x0a0a15, 1);
    }

    // Room labels
    // (Using graphics text positioning would be complex - use DOM text objects instead in future)

    // Player character (simple figure)
    this.graphics.fillStyle(COLORS.ui.primary, 1);
    // Head
    this.graphics.fillCircle(this.playerX, this.playerY - 12, 5);
    // Body
    this.graphics.lineStyle(2, COLORS.ui.primary, 1);
    this.graphics.lineBetween(this.playerX, this.playerY - 7, this.playerX, this.playerY + 5);
    // Legs
    this.graphics.lineBetween(this.playerX, this.playerY + 5, this.playerX - 5, this.playerY + 15);
    this.graphics.lineBetween(this.playerX, this.playerY + 5, this.playerX + 5, this.playerY + 15);
    // Arms
    this.graphics.lineBetween(this.playerX, this.playerY - 3, this.playerX - 6, this.playerY + 4);
    this.graphics.lineBetween(this.playerX, this.playerY - 3, this.playerX + 6, this.playerY + 4);

    // Room name labels (draw as graphics text isn't great, we'll add text objects)
    // For now the info panel shows room details
  }

  private updateUI(): void {
    if (this.selectedRoom) {
      const room = this.selectedRoom;
      let info = `[ ${room.label} ]\n\n`;

      if (room.slot?.module) {
        const mod = room.slot.module;
        info += `Module: ${mod.name}\n`;
        info += `Tier: ${mod.tier}\n`;
        for (const [key, val] of Object.entries(mod.stats)) {
          info += `${key}: ${val}\n`;
        }
      } else if (room.slot) {
        info += `Empty slot\n`;
        info += `Accepts: ${room.slot.type}\n`;
        info += `Max size: ${room.slot.maxSize}\n`;
      } else if (room.label === 'Bridge') {
        info += `Ship: ${this.state.player.ship.name}\n`;
        info += `Class: ${this.state.player.ship.class}\n`;
        info += `Hull: ${this.state.player.ship.hull.current}/${this.state.player.ship.hull.max}\n`;
        info += `\n[T] Access ship terminal`;
      }

      this.infoText.setText(info);
    } else {
      this.infoText.setText('Walk to a room to inspect it');
    }
  }
}
