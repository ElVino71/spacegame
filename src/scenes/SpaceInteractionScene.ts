import Phaser from 'phaser';
import { getGameState } from '../GameState';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../utils/Constants';
import { NPCShipData } from '../entities/NPCShip';
import { getCargoUsed, getCargoCapacity } from '../entities/Player';
import {
  CombatState, createCombatState, updateCombat, attemptFlee, getFleeChance,
} from '../systems/CombatSystem';
import {
  WEAPON_VISUALS, COMBAT_CHATTER, CombatChatterPool, COMBAT_LOOT, COMBAT_ARENA,
  LOOT_CARGO_POOL, LOOT_MODULE_POOL, PIRATE_BOUNTIES, BATTLE_SUMMARY,
} from '../data/combat';
import { FACTION_NAMES } from '../data/factions';
import { ShipModule } from '../entities/Ship';
import { CargoItem } from '../entities/Player';

type InteractionMode = 'hostile' | 'neutral';

interface SceneData {
  npc: NPCShipData;
  mode: InteractionMode;
}

export class SpaceInteractionScene extends Phaser.Scene {
  private npc!: NPCShipData;
  private mode!: InteractionMode;
  private combatState!: CombatState;
  private inCombat = false;
  private combatEnded = false;

  // Graphics
  private graphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private stars: { x: number; y: number; brightness: number }[] = [];

  // HUD elements (Phaser text for real-time combat overlay)
  private playerHullBar!: Phaser.GameObjects.Graphics;
  private enemyHullBar!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private fleeText!: Phaser.GameObjects.Text;

  // Effects
  private hitFlashes: { x: number; y: number; color: number; timer: number }[] = [];
  private explosionParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];
  private smokeTrails: { ship: 'player' | 'enemy'; timer: number }[] = [];

  // Chatter
  private chatterCooldown = 0;
  private lastChatterPool: CombatChatterPool | null = null;

  // End state
  private endTimer = 0;
  private aftermathShown = false;

  constructor() {
    super({ key: 'SpaceInteractionScene' });
  }

  init(data: SceneData): void {
    this.npc = data.npc;
    this.mode = data.mode;
    this.inCombat = false;
    this.combatEnded = false;
    this.hitFlashes = [];
    this.explosionParticles = [];
    this.smokeTrails = [];
    this.chatterCooldown = 0;
    this.lastChatterPool = null;
    this.endTimer = 0;
    this.aftermathShown = false;
  }

  create(): void {
    const frame = getFrameManager();
    const title = this.mode === 'hostile' ? 'Combat' : 'Encounter';
    frame.enterGameplay(title);

    this.cameras.main.setViewport(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x050510);

    this.graphics = this.add.graphics();

    // Starfield background
    this.stars = [];
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        brightness: 0.2 + Math.random() * 0.8,
      });
    }

    // Ship sprites
    this.playerSprite = this.add.image(0, 0, 'ship_player').setDepth(5).setScale(1.2);
    const factionColor = (COLORS.factions as number[])[this.npc.factionIndex] ?? 0xaaaaaa;
    this.enemySprite = this.add.image(0, 0, 'ship_npc').setDepth(5).setScale(1.0).setTint(factionColor);

    // HUD bars
    this.playerHullBar = this.add.graphics().setDepth(10).setScrollFactor(0);
    this.enemyHullBar = this.add.graphics().setDepth(10).setScrollFactor(0);

    this.hudText = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '14px',
      color: '#00ff88',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(10).setScrollFactor(0);

    this.fleeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '13px',
      color: '#ffcc00',
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(10).setScrollFactor(0);

    // Initialize combat state
    const state = getGameState();
    this.combatState = createCombatState(state.player.ship, state.player.crew || [], this.npc);

    if (this.mode === 'hostile') {
      this.startCombat();
    } else {
      this.showNeutralUI();
    }

    // Input
    this.input.keyboard!.on('keydown-F', () => this.tryFlee());
    this.input.keyboard!.on('keydown-ESC', () => { if (!this.aftermathShown) this.exitToSystem(); });

    // Update bottom bar
    this.updateBottomBar();

    getAudioManager().setAmbience('system_flight');
  }

  private startCombat(): void {
    this.inCombat = true;
    this.combatEnded = false;
    getFrameManager().setSceneTitle('Combat');

    // Hide center overlay if it was showing neutral UI
    getFrameManager().hideCenterOverlay();

    // Opening taunt
    this.triggerChatter('taunt');
  }

  private showNeutralUI(): void {
    const frame = getFrameManager();
    frame.showCenterOverlay();

    const factionName = FACTION_NAMES[this.npc.factionIndex] || 'Unknown';
    const html = `
      <div class="section">
        <div class="section-title">Ship Encountered</div>
        <div class="row"><span class="label">Name:</span> <span class="value">${this.npc.name}</span></div>
        <div class="row"><span class="label">Class:</span> <span class="value">${this.npc.shipClass}</span></div>
        <div class="row"><span class="label">Faction:</span> <span class="value">${factionName}</span></div>
        <div class="row"><span class="label">Behavior:</span> <span class="value">${this.npc.behavior}</span></div>
        <div class="row"><span class="label">Hull:</span> <span class="value">${this.npc.hull}/${this.npc.hullMax}</span></div>
        <div class="row"><span class="label">Shields:</span> <span class="value">${this.npc.shieldCurrent}/${this.npc.shieldMax}</span></div>
      </div>
      <div class="section" style="margin-top: 16px;">
        <div class="section-title">Actions</div>
        <div class="action" id="btn-attack" style="cursor:pointer; padding: 8px; margin: 4px 0;">⚔ ATTACK [A]</div>
        ${this.npc.behavior === 'trader' ? '<div class="action" id="btn-trade" style="cursor:pointer; padding: 8px; margin: 4px 0;">💰 TRADE [T]</div>' : ''}
        <div class="action" id="btn-exit" style="cursor:pointer; padding: 8px; margin: 4px 0;">← EXIT [ESC]</div>
      </div>
    `;
    frame.setCenterContent(html);

    // Bind buttons
    const contentEl = frame.getCenterContentEl();
    contentEl.querySelector('#btn-attack')?.addEventListener('click', () => this.startCombat());
    contentEl.querySelector('#btn-trade')?.addEventListener('click', () => this.openTrade());
    contentEl.querySelector('#btn-exit')?.addEventListener('click', () => this.exitToSystem());

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-A', () => {
      if (!this.inCombat) this.startCombat();
    });
    this.input.keyboard!.on('keydown-T', () => {
      if (!this.inCombat && this.npc.behavior === 'trader') this.openTrade();
    });
  }

  private openTrade(): void {
    // Simple trade — for now just show a message and exit
    const frame = getFrameManager();
    frame.setCenterContent(`
      <div class="section">
        <div class="section-title">Trading with ${this.npc.name}</div>
        <div class="row"><span class="value">The trader has nothing of interest right now.</span></div>
        <div class="action" id="btn-back" style="cursor:pointer; padding: 8px; margin-top: 16px;">← BACK [ESC]</div>
      </div>
    `);
    frame.getCenterContentEl().querySelector('#btn-back')?.addEventListener('click', () => this.exitToSystem());
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.graphics.clear();
    this.drawStarfield();

    if (this.inCombat && !this.combatEnded) {
      updateCombat(this.combatState, dt);
      this.processCombatEvents();
      this.updateCombatChatter(dt);
    }

    // Draw ships at combat state positions (scaled to screen)
    const sx = GAME_WIDTH / COMBAT_ARENA.width;
    const sy = GAME_HEIGHT / COMBAT_ARENA.height;

    this.playerSprite.setPosition(
      this.combatState.player.x * sx,
      this.combatState.player.y * sy,
    );
    this.playerSprite.setRotation(this.combatState.player.angle + Math.PI / 2);

    this.enemySprite.setPosition(
      this.combatState.enemy.x * sx,
      this.combatState.enemy.y * sy,
    );
    this.enemySprite.setRotation(this.combatState.enemy.angle + Math.PI / 2);

    // Draw projectiles
    this.drawProjectiles(sx, sy);

    // Draw effects
    this.updateEffects(dt, sx, sy);

    // Draw smoke trails for damaged ships
    this.drawDamageSmoke(sx, sy);

    // Draw shield bubbles
    this.drawShieldBubbles(sx, sy);

    // Update HUD
    this.drawHUD();

    // Handle combat end
    if (this.inCombat && !this.combatEnded && this.combatState.status !== 'active') {
      this.onCombatEnd();
    }

    // End timer — show aftermath after delay instead of auto-exit
    if (this.combatEnded && !this.aftermathShown) {
      this.endTimer += dt;
      if (this.endTimer > 2.5) {
        this.showAftermath();
      }
    }
  }

  shutdown(): void {
    getFrameManager().hideCenterOverlay();
  }

  // ─── DRAWING ────────────────────────────────────────────

  private drawStarfield(): void {
    for (const star of this.stars) {
      const alpha = star.brightness * 0.6;
      const color = Phaser.Display.Color.GetColor(
        Math.floor(200 * star.brightness),
        Math.floor(200 * star.brightness),
        Math.floor(255 * star.brightness),
      );
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(star.x, star.y, star.brightness > 0.7 ? 1.5 : 1);
    }
  }

  private drawProjectiles(sx: number, sy: number): void {
    for (const p of this.combatState.projectiles) {
      const visual = WEAPON_VISUALS[p.type];
      const px = p.x * sx;
      const py = p.y * sy;

      // Trail
      const trailLen = visual.trailLength;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const nx = speed > 0 ? -p.vx / speed : 0;
      const ny = speed > 0 ? -p.vy / speed : 0;

      this.graphics.lineStyle(visual.projectileSize, visual.trailColor, 0.4);
      this.graphics.beginPath();
      this.graphics.moveTo(px, py);
      this.graphics.lineTo(px + nx * trailLen * sx, py + ny * trailLen * sy);
      this.graphics.strokePath();

      // Projectile head
      this.graphics.fillStyle(visual.color, 1);
      this.graphics.fillCircle(px, py, visual.projectileSize);
    }
  }

  private drawShieldBubbles(sx: number, sy: number): void {
    const drawBubble = (ship: typeof this.combatState.player, x: number, y: number) => {
      if (ship.shield > 0 && ship.shieldMax > 0) {
        const pct = ship.shield / ship.shieldMax;
        const alpha = 0.1 + pct * 0.2;
        this.graphics.lineStyle(1.5, 0x4488ff, alpha);
        this.graphics.strokeCircle(x, y, 22 + pct * 8);
      }
    };
    drawBubble(this.combatState.player, this.combatState.player.x * sx, this.combatState.player.y * sy);
    drawBubble(this.combatState.enemy, this.combatState.enemy.x * sx, this.combatState.enemy.y * sy);
  }

  private drawDamageSmoke(sx: number, sy: number): void {
    const drawSmoke = (ship: typeof this.combatState.player, x: number, y: number) => {
      const hullPct = ship.hull / ship.hullMax;
      if (hullPct < 0.5) {
        const intensity = 1 - hullPct / 0.5;
        for (let i = 0; i < Math.floor(intensity * 4); i++) {
          const ox = (Math.random() - 0.5) * 20;
          const oy = (Math.random() - 0.5) * 20;
          const alpha = 0.1 + Math.random() * intensity * 0.3;
          const color = hullPct < 0.25 ? 0xff4400 : 0x888888;
          this.graphics.fillStyle(color, alpha);
          this.graphics.fillCircle(x + ox, y + oy, 1 + Math.random() * 3);
        }
      }
    };
    drawSmoke(this.combatState.player, this.combatState.player.x * sx, this.combatState.player.y * sy);
    drawSmoke(this.combatState.enemy, this.combatState.enemy.x * sx, this.combatState.enemy.y * sy);
  }

  private updateEffects(dt: number, sx: number, sy: number): void {
    // Hit flashes
    for (let i = this.hitFlashes.length - 1; i >= 0; i--) {
      const f = this.hitFlashes[i];
      f.timer -= dt;
      if (f.timer <= 0) { this.hitFlashes.splice(i, 1); continue; }
      const alpha = f.timer / 0.3;
      this.graphics.fillStyle(f.color, alpha);
      this.graphics.fillCircle(f.x * sx, f.y * sy, 6 + (1 - alpha) * 10);
    }

    // Explosion particles
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const p = this.explosionParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) { this.explosionParticles.splice(i, 1); continue; }
      const alpha = p.life / 1.5;
      this.graphics.fillStyle(p.color, alpha);
      this.graphics.fillCircle(p.x * sx, p.y * sy, 1 + alpha * 3);
    }
  }

  private drawHUD(): void {
    const cs = this.combatState;
    const barW = 150;
    const barH = 8;

    // Player HUD (left side)
    this.playerHullBar.clear();
    this.drawBar(this.playerHullBar, 40, 60, barW, barH, cs.player.hull, cs.player.hullMax, 0x00ff44, 'HULL');
    this.drawBar(this.playerHullBar, 40, 80, barW, barH, cs.player.shield, cs.player.shieldMax, 0x4488ff, 'SHLD');

    // Enemy HUD (right side)
    this.enemyHullBar.clear();
    const ex = GAME_WIDTH - 40 - barW;
    this.drawBar(this.enemyHullBar, ex, 60, barW, barH, cs.enemy.hull, cs.enemy.hullMax, 0xff4444, 'HULL');
    this.drawBar(this.enemyHullBar, ex, 80, barW, barH, cs.enemy.shield, cs.enemy.shieldMax, 0x4488ff, 'SHLD');

    // Ship names
    this.hudText.setText(
      this.inCombat
        ? `${getGameState().player.ship.name}  vs  ${this.npc.name} (${this.npc.shipClass})`
        : `Encounter: ${this.npc.name}`
    );

    // Flee info
    if (this.inCombat && !this.combatEnded) {
      const pilot = (getGameState().player.crew || []).find(c => c.role === 'pilot');
      const pilotSkill = pilot?.stats.piloting ?? 0;
      const chance = getFleeChance(cs, pilotSkill);
      const pct = Math.round(chance * 100);
      const cooldownLeft = Math.max(0, Math.ceil(cs.fleeCooldown));
      this.fleeText.setText(
        cooldownLeft > 0
          ? `FLEE [F] — ${pct}% — cooldown ${cooldownLeft}s`
          : `FLEE [F] — ${pct}% chance`
      );
      this.fleeText.setVisible(true);
    } else {
      this.fleeText.setVisible(false);
    }
  }

  private drawBar(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, current: number, max: number, color: number, label: string): void {
    // Background
    gfx.fillStyle(0x111122, 0.8);
    gfx.fillRect(x, y, w, h);
    // Fill
    const pct = Math.max(0, current / max);
    gfx.fillStyle(color, 0.8);
    gfx.fillRect(x, y, w * pct, h);
    // Border
    gfx.lineStyle(1, 0x334455, 0.6);
    gfx.strokeRect(x, y, w, h);
  }

  // ─── COMBAT EVENTS ──────────────────────────────────────

  private processCombatEvents(): void {
    for (const evt of this.combatState.events) {
      switch (evt.type) {
        case 'hit_shield':
          this.hitFlashes.push({ x: evt.x, y: evt.y, color: 0x4488ff, timer: 0.3 });
          getAudioManager().playSfx('combat_hit');
          break;
        case 'hit_hull':
          this.hitFlashes.push({ x: evt.x, y: evt.y, color: 0xff6600, timer: 0.3 });
          getAudioManager().playSfx('combat_hit');
          break;
        case 'shield_down':
          this.triggerChatter('shield_down');
          break;
        case 'ship_destroyed':
          this.spawnExplosion(evt.x, evt.y);
          break;
        case 'flee_success':
          getAudioManager().playSfx('combat_flee');
          this.triggerChatter('player_flee');
          break;
        case 'flee_fail':
          getAudioManager().playSfx('combat_hit');
          break;
      }
    }
  }

  private spawnExplosion(x: number, y: number): void {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 120;
      this.explosionParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 1.0,
        color: [0xff4400, 0xffaa00, 0xff6600, 0xffcc00, 0xff2200][Math.floor(Math.random() * 5)],
      });
    }
  }

  // ─── CHATTER ────────────────────────────────────────────

  private updateCombatChatter(dt: number): void {
    this.chatterCooldown -= dt;
    if (this.chatterCooldown > 0) return;

    const cs = this.combatState;
    const playerHullPct = cs.player.hull / cs.player.hullMax;
    const enemyHullPct = cs.enemy.hull / cs.enemy.hullMax;

    // Trigger damage chatter
    if (playerHullPct < 0.4 && this.lastChatterPool !== 'damage_taken') {
      this.triggerChatter('damage_taken');
    } else if (enemyHullPct < 0.4 && this.lastChatterPool !== 'damage_taken') {
      this.triggerChatter('damage_taken');
    }
  }

  private triggerChatter(pool: CombatChatterPool): void {
    if (this.chatterCooldown > 0) return;

    const entries = COMBAT_CHATTER[pool];
    if (!entries || entries.length === 0) return;

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = entries[0];
    for (const entry of entries) {
      if (roll < entry.weight) { selected = entry; break; }
      roll -= entry.weight;
    }

    getFrameManager().addChatter(selected.text, selected.color);
    getAudioManager().playSfx('ui_select');
    this.chatterCooldown = 6;
    this.lastChatterPool = pool;
  }

  // ─── FLEE ───────────────────────────────────────────────

  private tryFlee(): void {
    if (!this.inCombat || this.combatEnded) return;
    const pilot = (getGameState().player.crew || []).find(c => c.role === 'pilot');
    const pilotSkill = pilot?.stats.piloting ?? 0;
    attemptFlee(this.combatState, pilotSkill);
  }

  // ─── COMBAT END ─────────────────────────────────────────

  private onCombatEnd(): void {
    this.combatEnded = true;
    this.endTimer = 0;

    const status = this.combatState.status;

    if (status === 'player_won') {
      this.triggerChatter('victory');
      getAudioManager().playSfx('combat_victory');
      this.enemySprite.setVisible(false);
    } else if (status === 'player_lost') {
      this.triggerChatter('defeat');
      this.playerSprite.setVisible(false);
    } else if (status === 'player_fled') {
      this.triggerChatter('flee_taunt');
    }

    const msg = status === 'player_won' ? 'VICTORY'
      : status === 'player_lost' ? 'DEFEATED'
      : 'ESCAPED';
    this.fleeText.setText(msg);
    this.fleeText.setColor(status === 'player_won' ? '#00ff88' : status === 'player_lost' ? '#ff4444' : '#ffcc00');
    this.fleeText.setVisible(true);
  }

  private showAftermath(): void {
    if (this.aftermathShown) return;
    this.aftermathShown = true;
    this.fleeText.setVisible(false);

    const state = getGameState();
    const status = this.combatState.status;

    // Apply hull damage to game state
    state.player.ship.hull.current = Math.max(1, Math.round(this.combatState.player.hull));

    // Generate battle summary
    const summary = this.generateBattleSummary();

    // Calculate loot, bounty, reputation
    let creditsGained = 0;
    let bountyCredits = 0;
    let bountyLabel = '';
    let repChange = 0;
    const cargoLoot: CargoItem[] = [];
    let moduleLoot: ShipModule | null = null;

    if (status === 'player_won') {
      const lootTable = COMBAT_LOOT[this.npc.behavior as keyof typeof COMBAT_LOOT] || COMBAT_LOOT.pirate;
      creditsGained = lootTable.creditsMin + Math.floor(Math.random() * (lootTable.creditsMax - lootTable.creditsMin));
      state.player.credits += creditsGained;

      // Reputation
      repChange = lootTable.reputationGain;
      if (repChange !== 0) {
        const fIdx = this.npc.factionIndex;
        state.player.reputation[fIdx] = (state.player.reputation[fIdx] || 0) + repChange;
        state.player.reputation[fIdx] = Math.max(-100, Math.min(100, state.player.reputation[fIdx]));
      }

      // Cargo loot
      if (Math.random() < lootTable.cargoChance) {
        const numItems = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numItems; i++) {
          const pool = LOOT_CARGO_POOL[Math.floor(Math.random() * LOOT_CARGO_POOL.length)];
          const qty = 1 + Math.floor(Math.random() * 5);
          cargoLoot.push({ id: pool.id, name: pool.name, quantity: qty, value: pool.baseValue });
        }
        // Add to player cargo
        const capacity = getCargoCapacity(state.player.ship);
        const used = getCargoUsed(state.player.cargo);
        let spaceLeft = capacity - used;
        for (const item of cargoLoot) {
          if (spaceLeft <= 0) break;
          const addQty = Math.min(item.quantity, spaceLeft);
          const existing = state.player.cargo.find(c => c.id === item.id);
          if (existing) {
            existing.quantity += addQty;
          } else {
            state.player.cargo.push({ ...item, quantity: addQty });
          }
          spaceLeft -= addQty;
        }
      }

      // Module loot (rare)
      if (Math.random() < lootTable.moduleChance) {
        const src = LOOT_MODULE_POOL[Math.floor(Math.random() * LOOT_MODULE_POOL.length)];
        const cleanStats: Record<string, number> = {};
        for (const [k, v] of Object.entries(src.stats)) { cleanStats[k] = v; }
        moduleLoot = { id: src.id, type: src.type, name: src.name, tier: src.tier, stats: cleanStats, size: src.size };
        // Try to install in an empty matching slot
        const emptySlot = state.player.ship.slots.find(s => s.type === moduleLoot!.type && s.module === null && s.maxSize >= moduleLoot!.size);
        if (emptySlot) {
          emptySlot.module = moduleLoot;
        }
        // If no slot, player still sees it but it's "stored" (shown in aftermath)
      }

      // Pirate bounty
      if (this.npc.behavior === 'pirate') {
        const bountyDef = PIRATE_BOUNTIES[this.npc.shipClass] || PIRATE_BOUNTIES.scout;
        bountyCredits = bountyDef.min + Math.floor(Math.random() * (bountyDef.max - bountyDef.min));
        bountyLabel = bountyDef.label;
        state.player.credits += bountyCredits;
      }
    } else if (status === 'player_lost') {
      state.player.ship.hull.current = Math.round(state.player.ship.hull.max * 0.1);
      if (state.player.cargo.length > 0) {
        const loseCount = Math.min(state.player.cargo.length, 1 + Math.floor(Math.random() * 3));
        for (let i = 0; i < loseCount; i++) {
          const idx = Math.floor(Math.random() * state.player.cargo.length);
          state.player.cargo[idx].quantity = Math.max(0, state.player.cargo[idx].quantity - Math.floor(Math.random() * 5 + 1));
          if (state.player.cargo[idx].quantity <= 0) {
            state.player.cargo.splice(idx, 1);
          }
        }
      }
    }

    // Build aftermath HTML
    const frame = getFrameManager();
    frame.showCenterOverlay();

    const titleColor = status === 'player_won' ? '#00ff88' : status === 'player_lost' ? '#ff4444' : '#ffcc00';
    const titleText = status === 'player_won' ? '⚔ VICTORY ⚔' : status === 'player_lost' ? '💀 DEFEATED 💀' : '🚀 ESCAPED 🚀';

    let lootHtml = '';
    if (status === 'player_won') {
      lootHtml += `<div class="row"><span class="label">Salvage Credits:</span><span class="value good">+${creditsGained} cr</span></div>`;

      if (bountyCredits > 0) {
        lootHtml += `<div class="row"><span class="label">${bountyLabel}:</span><span class="value good">+${bountyCredits} cr</span></div>`;
      }

      if (cargoLoot.length > 0) {
        lootHtml += `<div class="section-title" style="margin-top:8px;">Cargo Recovered</div>`;
        for (const item of cargoLoot) {
          lootHtml += `<div class="row"><span class="label">${item.name}</span><span class="value">×${item.quantity}</span></div>`;
        }
      }

      if (moduleLoot) {
        lootHtml += `<div class="section-title" style="margin-top:8px;">Module Found!</div>`;
        lootHtml += `<div class="row"><span class="label" style="color:#ffcc00;">★ ${moduleLoot.name}</span><span class="value">Tier ${moduleLoot.tier} ${moduleLoot.type}</span></div>`;
        const installed = state.player.ship.slots.some(s => s.module?.id === moduleLoot!.id);
        lootHtml += `<div class="row"><span class="value" style="font-size:11px;color:#888;">${installed ? 'Auto-installed in empty slot' : 'No compatible empty slot — module lost'}</span></div>`;
      }

      if (repChange !== 0) {
        const fName = FACTION_NAMES[this.npc.factionIndex] || 'Unknown';
        const repClass = repChange > 0 ? 'good' : 'bad';
        const repSign = repChange > 0 ? '+' : '';
        lootHtml += `<div class="row" style="margin-top:6px;"><span class="label">Reputation (${fName}):</span><span class="value ${repClass}">${repSign}${repChange}</span></div>`;
      }
    } else if (status === 'player_lost') {
      lootHtml += `<div class="row"><span class="value bad">Hull critically damaged — emergency systems engaged.</span></div>`;
      lootHtml += `<div class="row"><span class="value bad">Some cargo was lost in the wreckage.</span></div>`;
    } else {
      lootHtml += `<div class="row"><span class="value warn">You escaped with your ship intact, though not unscathed.</span></div>`;
    }

    frame.setCenterContent(`
      <div class="section" style="max-width:520px;margin:0 auto;">
        <div class="section-title" style="color:${titleColor};font-size:18px;text-align:center;margin-bottom:12px;">${titleText}</div>
        <div style="color:#aaa;font-style:italic;line-height:1.5;margin-bottom:14px;font-size:12px;">${summary}</div>
        <div style="border-top:1px solid #333;padding-top:10px;">
          ${lootHtml}
        </div>
        <div class="action" id="btn-dismiss" style="cursor:pointer;padding:10px;margin-top:16px;text-align:center;font-size:14px;">CONTINUE [SPACE]</div>
      </div>
    `);

    const dismiss = () => {
      this.input.keyboard!.off('keydown-SPACE', dismiss);
      frame.hideCenterOverlay();
      if (this.combatState.status === 'player_lost') {
        this.scene.start('GameOverScene');
      } else {
        this.exitToSystem();
      }
    };

    frame.getCenterContentEl().querySelector('#btn-dismiss')?.addEventListener('click', dismiss);
    this.input.keyboard!.on('keydown-SPACE', dismiss);

    this.updateBottomBar();
  }

  private generateBattleSummary(): string {
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const shipName = getGameState().player.ship.name;
    const npcClass = this.npc.shipClass;
    const npcBehavior = this.npc.behavior;

    const opening = pick(BATTLE_SUMMARY.openings);
    const playerDesc = pick(BATTLE_SUMMARY.playerDescriptors).replace('{shipName}', shipName);
    const enemyDesc = pick(BATTLE_SUMMARY.enemyDescriptors)
      .replace('{class}', npcClass)
      .replace('{behavior}', npcBehavior);
    const verb = pick(BATTLE_SUMMARY.combatVerbs);

    const status = this.combatState.status;
    let closing: string;
    if (status === 'player_won') {
      closing = pick(BATTLE_SUMMARY.victoryClosings);
    } else if (status === 'player_lost') {
      closing = pick(BATTLE_SUMMARY.defeatClosings);
    } else {
      closing = pick(BATTLE_SUMMARY.fleeClosings);
    }

    return `${opening} ${playerDesc} ${verb} ${enemyDesc}. ${closing}`;
  }

  private exitToSystem(): void {
    this.scene.start('TransitionScene', {
      type: 'undock',
      targetScene: 'SystemScene',
      text: 'DISENGAGING...',
    });
  }

  private updateBottomBar(): void {
    const ship = getGameState().player.ship;
    const frame = getFrameManager();
    frame.updateStatus(
      ship.hull, ship.fuel,
      getCargoUsed(getGameState().player.cargo),
      getCargoCapacity(ship),
      getGameState().player.credits,
    );
  }
}
