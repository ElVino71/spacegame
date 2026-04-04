import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';
import { PlanetData } from '../entities/StarSystem';
import { SeededRandom } from '../utils/SeededRandom';
import { CargoItem, getCargoCapacity, getCargoUsed, getCrewCapacity, getCaptainTitle } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { TRADE_GOODS, TRADE_PREFIXES, TradeGood } from '../data/trade';
import { SHOP_TEMPLATES, BAR_TEMPLATES, ARTEFACT_SHOP_TEMPLATES, MODULE_CATALOG, ModuleForSale, ShopDef } from '../data/settlements';
import { RUIN_LOOT, ARTEFACT_PRICE_MULTIPLIERS } from '../data/ruins';
import { CharacterGenerator } from '../generation/CharacterGenerator';
import { CrewMember } from '../entities/Character';
import { PortraitRenderer } from '../ui/PortraitRenderer';

// ─── Constants ──────────────────────────────────────────

const MAP_SIZE = 32;
const TILE_SIZE = 16;
const PANEL_WIDTH = 240;
const MOVE_DELAY = 150;

// ─── Types ──────────────────────────────────────────────

type SettlementTileType =
  | 'road' | 'road_cross' | 'plaza'
  | 'building_wall' | 'building_floor' | 'building_door'
  | 'shop_trade' | 'shop_modules' | 'shop_bar' | 'shop_artefacts'
  | 'fence' | 'lamp' | 'void';

interface SettlementTile {
  type: SettlementTileType;
  walkable: boolean;
  shopDef?: ShopDef;
}

interface MarketListing {
  good: TradeGood;
  cargoId: string;
  displayName: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
}

// ─── Scene ──────────────────────────────────────────────

export class SettlementScene extends Phaser.Scene {
  private state!: GameState;
  private planet!: PlanetData;
  private tiles: SettlementTile[][] = [];
  private mapRT!: Phaser.GameObjects.RenderTexture;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerX = 0;
  private playerY = 0;
  private lastMoveTime = 0;

  // Shop state
  private shopActive = false;
  private activeShop: ShopDef | null = null;
  private shopMode: 'menu' | 'trade' | 'modules' | 'bar' | 'artefacts' = 'menu';
  private market: MarketListing[] = [];
  private moduleStock: ModuleForSale[] = [];
  private hirelings: CrewMember[] = [];
  private selectedIndex = 0;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super({ key: 'SettlementScene' });
  }

  init(data: { planet: PlanetData }): void {
    this.planet = data.planet;
  }

  create(): void {
    this.state = getGameState();
    this.lastMoveTime = 0;
    this.shopActive = false;
    this.activeShop = null;
    this.shopMode = 'menu';

    const frame = getFrameManager();
    frame.enterGameplay(`Settlement: ${this.planet.name}`);
    frame.setThemeFromShip(this.state.player.ship);
    frame.showPanel(PANEL_WIDTH);
    this.setupPanelContent();
    frame.setNav([
      { id: 'settlement', label: 'Settlement', active: true },
      { id: 'exit', label: 'Exit', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'exit') this.exitSettlement();
    });

    this.cameras.main.setBackgroundColor(0x0a0a12);
    const mapPixels = MAP_SIZE * TILE_SIZE;
    this.cameras.main.setViewport(PANEL_WIDTH, 0, GAME_WIDTH - PANEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, mapPixels, mapPixels);
    this.cameras.main.setZoom(2);

    this.mapRT = this.add.renderTexture(0, 0, mapPixels, mapPixels).setOrigin(0, 0).setDepth(0);
    this.generateSettlement();
    this.drawMap();

    this.playerSprite = this.add.image(0, 0, 'settlement_person').setOrigin(0.5, 0.5).setDepth(1);
    this.centerCamera();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.shopActive) {
        this.closeShop();
      } else {
        this.exitSettlement();
      }
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (!this.shopActive) this.interact();
    });
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.shopActive) this.shopSelect();
    });
    this.input.keyboard!.on('keydown-UP', () => { if (this.shopActive) this.shopNavigate(-1); });
    this.input.keyboard!.on('keydown-DOWN', () => { if (this.shopActive) this.shopNavigate(1); });
    this.input.keyboard!.on('keydown-B', () => { if (this.shopActive) this.tryBuy(); });
    this.input.keyboard!.on('keydown-V', () => { if (this.shopActive) this.trySell(); });

    getAudioManager().setAmbience('station');
    this.updatePanel();
    getChatterSystem().attach(this);
  }

  shutdown(): void {
    const frame = getFrameManager();
    frame.hidePanel();
    if (this.shopActive) frame.hideCenterOverlay();
    getChatterSystem().stop();
  }

  update(time: number): void {
    if (!this.shopActive) {
      this.handleMovement(time);
    }
    this.drawPlayer();
  }

  // ─── FRAME PANEL ──────────────────────────────────────

  private setupPanelContent(): void {
    const frame = getFrameManager();
    frame.setPanelContent(`
      <div class="section" id="panel-settlement"></div>
    `);
  }

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private updatePanel(): void {
    const el = document.getElementById('panel-settlement');
    if (!el) return;

    const ship = this.state.player.ship;
    let html = `<div class="section-title">Settlement</div>`;
    html += this.row('Planet', this.planet.name);
    html += this.row('Credits', `${this.state.player.credits} CR`);
    html += this.row('Cargo', `${getCargoUsed(this.state.player.cargo)}/${getCargoCapacity(ship)}`);

    const tile = this.tiles[this.playerY]?.[this.playerX];
    if (tile) {
      html += `<div class="section-title" style="margin-top:8px">Location</div>`;
      if (tile.type === 'building_door' && tile.shopDef) {
        html += this.row('Building', tile.shopDef.name, 'good');
        html += this.row('Type', tile.shopDef.type === 'trade' ? 'Trade Goods' : tile.shopDef.type === 'bar' ? 'Bar' : 'Ship Modules');
        html += `<div class="action">[ENTER] Enter shop</div>`;
      } else if (tile.type === 'road' || tile.type === 'road_cross') {
        html += this.row('Area', 'Road');
      } else if (tile.type === 'plaza') {
        html += this.row('Area', 'Town Square');
      } else {
        html += this.row('Area', 'Settlement');
      }
    }

    html += `<div class="section-title" style="margin-top:8px">Controls</div>`;
    html += `<div class="action">WASD/Arrows: Move</div>`;
    html += `<div class="action">ENTER: Enter</div>`;
    html += `<div class="action">ESC: Leave</div>`;

    el.innerHTML = html;

    getFrameManager().updateStatus(
      ship.hull, ship.fuel,
      getCargoUsed(this.state.player.cargo), getCargoCapacity(ship),
      this.state.player.credits, getCaptainTitle(this.state.player)
    );
  }

  // ─── MOVEMENT ─────────────────────────────────────────

  private handleMovement(time: number): void {
    if (time - this.lastMoveTime < MOVE_DELAY) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;
    if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) return;
    if (!this.tiles[ny][nx].walkable) return;

    this.playerX = nx;
    this.playerY = ny;
    this.lastMoveTime = time;
    getAudioManager().playSfx('footstep');
    this.centerCamera();
    this.updatePanel();
  }

  private centerCamera(): void {
    const px = this.playerX * TILE_SIZE + TILE_SIZE / 2;
    const py = this.playerY * TILE_SIZE + TILE_SIZE / 2;
    this.cameras.main.centerOn(px, py);
  }

  // ─── RENDERING ────────────────────────────────────────

  private getTileTexture(tile: SettlementTile): string {
    switch (tile.type) {
      case 'road':           return 'settlement_road';
      case 'road_cross':     return 'settlement_road_cross';
      case 'plaza':          return 'settlement_plaza';
      case 'building_wall':  return 'settlement_building_wall';
      case 'building_floor': return 'settlement_building_floor';
      case 'building_door':  return 'settlement_building_door';
      case 'shop_trade':     return 'settlement_shop_trade';
      case 'shop_modules':   return 'settlement_shop_modules';
      case 'shop_bar':        return 'settlement_shop_bar';
      case 'shop_artefacts': return 'settlement_shop_trade';
      case 'fence':          return 'settlement_fence';
      case 'lamp':           return 'settlement_lamp';
      default:               return 'settlement_road';
    }
  }

  private drawMap(): void {
    this.mapRT.clear();
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = this.tiles[y][x];
        if (tile.type === 'void') continue;
        const tex = this.getTileTexture(tile);
        if (this.textures.exists(tex)) {
          this.mapRT.drawFrame(tex, undefined, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
  }

  private drawPlayer(): void {
    this.playerSprite.setPosition(
      this.playerX * TILE_SIZE + TILE_SIZE / 2,
      this.playerY * TILE_SIZE + TILE_SIZE / 2
    );
  }

  // ─── INTERACTION ──────────────────────────────────────

  private interact(): void {
    const tile = this.tiles[this.playerY]?.[this.playerX];
    if (!tile) return;

    if (tile.type === 'building_door' && tile.shopDef) {
      this.openShop(tile.shopDef);
    }
  }

  // ─── SHOP SYSTEM ──────────────────────────────────────

  private openShop(shop: ShopDef): void {
    this.shopActive = true;
    this.activeShop = shop;
    this.selectedIndex = 0;

    if (shop.type === 'trade') {
      this.shopMode = 'trade';
      this.generateShopMarket();
    } else if (shop.type === 'modules') {
      this.shopMode = 'modules';
      this.generateModuleStock();
    } else if (shop.type === 'artefacts') {
      this.shopMode = 'artefacts';
    } else {
      this.shopMode = 'bar';
      this.generateHirelings();
    }

    const frame = getFrameManager();
    frame.showCenterOverlay();
    this.renderShop();
    this.bindShopClicks();
  }

  private closeShop(): void {
    this.shopActive = false;
    this.activeShop = null;
    const frame = getFrameManager();
    frame.hideCenterOverlay();
    this.updatePanel();
  }

  private generateShopMarket(): void {
    const seed = this.state.seed * 5000 + this.planet.id * 311;
    const rng = new SeededRandom(seed);

    // Settlement shops have a smaller selection (6-8 goods)
    const count = rng.int(6, 8);
    const shuffled = [...TRADE_GOODS].sort(() => rng.next() - 0.5).slice(0, count);

    this.market = shuffled.map(good => {
      const variance = rng.float(-0.2, 0.2);
      let displayName = good.name;
      let cargoId = good.id;
      let prefixMod = 0;

      if (good.category !== 'mineral') {
        const prefix = TRADE_PREFIXES[rng.int(0, TRADE_PREFIXES.length - 1)];
        displayName = `${prefix.label} ${good.name}`;
        cargoId = `${prefix.label.toLowerCase().replace(/[\s-]/g, '_')}_${good.id}`;
        prefixMod = prefix.mod;
      }

      const buyPrice = Math.max(1, Math.round(good.basePrice * (1 + variance + prefixMod) * 1.1)); // slightly more expensive than stations
      const sellPrice = Math.max(1, Math.round(buyPrice * 0.7));
      const stock = rng.int(2, 12);

      return { good, cargoId, displayName, buyPrice, sellPrice, stock };
    });
  }

  private generateModuleStock(): void {
    const seed = this.state.seed * 6000 + this.planet.id * 419;
    const rng = new SeededRandom(seed);

    // Pick 4-6 modules from catalog
    const count = rng.int(4, 6);
    const shuffled = [...MODULE_CATALOG].sort(() => rng.next() - 0.5).slice(0, count);

    // Apply price variance
    this.moduleStock = shuffled.map(item => ({
      module: { ...item.module },
      price: Math.round(item.price * (1 + rng.float(-0.15, 0.25))),
    }));
  }

  private generateHirelings(): void {
    const seed = this.state.seed * 7000 + this.planet.id * 631;
    const rng = new SeededRandom(seed);
    this.hirelings = [];
    const count = rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      this.hirelings.push(CharacterGenerator.generateCrewMember(rng.fork(i), 0));
    }
    // Remove any already-hired crew
    const crewIds = new Set((this.state.player.crew || []).map(c => c.id));
    this.hirelings = this.hirelings.filter(h => !crewIds.has(h.id));
  }

  private renderBar(): string {
    const shop = this.activeShop!;
    let html = `<div class="center-section-title">${shop.name}</div>`;
    html += `<div class="center-section-subtitle">${shop.desc}</div>`;

    if (this.hirelings.length === 0) {
      html += `<div class="service-panel"><div class="row">No candidates available at this time.</div></div>`;
    } else {
      const capacity = getCrewCapacity(this.state.player.ship);
      const currentCrew = (this.state.player.crew || []).length;
      html += `<div style="margin-bottom:10px; font-size:12px;">Ship Crew Capacity: ${currentCrew} / ${capacity}</div>`;

      for (let i = 0; i < this.hirelings.length; i++) {
        const c = this.hirelings[i];
        const sel = i === this.selectedIndex ? ' selected' : '';
        const canAfford = this.state.player.credits >= 500;

        html += `<div class="menu-item${sel}" data-hire-idx="${i}" style="display:flex; padding:10px; margin-bottom:5px;">`;
        html += `<div style="margin-right:15px; border:1px solid var(--frame-border)">`;
        html += PortraitRenderer.renderPortrait(c.portraitSeed, 80);
        html += `</div>`;

        html += `<div style="flex:1">`;
        html += `<div class="menu-label" style="font-size:16px">${c.name}</div>`;
        html += `<div style="color:var(--frame-text-good); font-size:12px; margin-bottom:4px;">${c.role.toUpperCase()}</div>`;
        html += `<div class="menu-desc" style="font-size:11px; font-style:italic; margin-bottom:8px;">"${c.bio}"</div>`;

        html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; font-size:10px;">`;
        html += `<div>PIL: ${c.stats.piloting}</div>`;
        html += `<div>ENG: ${c.stats.engineering}</div>`;
        html += `<div>COM: ${c.stats.combat}</div>`;
        html += `<div>SCI: ${c.stats.science}</div>`;
        html += `</div>`;
        html += `</div>`;

        html += `<div style="text-align:right; width:100px;">`;
        html += `<div style="font-size:12px; margin-bottom:5px;">Bonus: <span class="${canAfford ? 'good' : 'bad'}">500 CR</span></div>`;
        html += `<div style="font-size:12px;">Salary: ${c.salary} CR</div>`;
        if (sel) {
          html += `<div class="action-btn" style="margin-top:10px; background:var(--frame-bg-active); padding:4px; font-size:10px; text-align:center;">[SPACE] HIRE</div>`;
        }
        html += `</div>`;

        html += `</div>`;
      }
    }

    html += `<div class="controls-hint">UP/DOWN to select &bull; ENTER to hire &bull; ESC back</div>`;
    return html;
  }

  private tryHire(): void {
    if (this.shopMode !== 'bar') return;
    const candidate = this.hirelings[this.selectedIndex];
    if (!candidate) return;

    const capacity = getCrewCapacity(this.state.player.ship);
    if (!this.state.player.crew) this.state.player.crew = [];
    if (this.state.player.crew.length >= capacity) {
      getFrameManager().showAlert('Crew capacity full!', 'danger');
      getAudioManager().playSfx('ui_deny');
      return;
    }

    const cost = 500;
    if (this.state.player.credits < cost) {
      getFrameManager().showAlert('Not enough credits!', 'danger');
      getAudioManager().playSfx('ui_deny');
      return;
    }

    this.state.player.credits -= cost;
    this.state.player.crew.push(candidate);
    this.state.player.stats.crew_hired++;
    this.hirelings = this.hirelings.filter(h => h.id !== candidate.id);

    getFrameManager().showAlert(`${candidate.name} joined the crew!`, 'info');
    getAudioManager().playSfx('ui_confirm');

    if (this.hirelings.length === 0) {
      this.selectedIndex = 0;
    } else {
      this.selectedIndex = Math.min(this.selectedIndex, this.hirelings.length - 1);
    }
    this.renderShop();
  }

  private renderShop(): void {
    const frame = getFrameManager();
    let html = '';

    if (this.shopMode === 'trade') {
      html = this.renderTradeShop();
    } else if (this.shopMode === 'modules') {
      html = this.renderModuleShop();
    } else if (this.shopMode === 'artefacts') {
      html = this.renderArtefactShop();
    } else if (this.shopMode === 'bar') {
      html = this.renderBar();
    }

    frame.setCenterContent(html);
    this.bindShopClicks();
  }

  private renderTradeShop(): string {
    const shop = this.activeShop!;
    let html = `<div class="center-section-title">${shop.name}</div>`;
    html += `<div class="center-section-subtitle">${shop.desc}</div>`;
    html += `<div class="row"><span class="label">Credits</span><span class="value good">${this.state.player.credits} CR</span></div>`;
    html += `<div class="row"><span class="label">Cargo</span><span class="value">${getCargoUsed(this.state.player.cargo)}/${getCargoCapacity(this.state.player.ship)}</span></div>`;

    html += `<table class="market-table"><thead><tr>`;
    html += `<th>Good</th><th class="right">Buy</th><th class="right">Sell</th><th class="right">Stock</th><th class="right">Owned</th><th>Actions</th>`;
    html += `</tr></thead>`;

    for (let i = 0; i < this.market.length; i++) {
      const listing = this.market[i];
      const sel = i === this.selectedIndex ? ' selected' : '';
      const ownedQty = this.state.player.cargo
        .filter(c => c.id === listing.cargoId || c.id === listing.good.id || c.baseGoodId === listing.good.id)
        .reduce((sum, c) => sum + c.quantity, 0);

      const canBuy = listing.stock > 0 && this.state.player.credits >= listing.buyPrice && getCargoUsed(this.state.player.cargo) < getCargoCapacity(this.state.player.ship);
      const canSell = ownedQty > 0;

      html += `<tr class="${sel}" data-market-idx="${i}">`;
      html += `<td class="good-name">${listing.displayName}</td>`;
      html += `<td class="right">${listing.buyPrice} CR</td>`;
      html += `<td class="right">${listing.sellPrice} CR</td>`;
      html += `<td class="right">${listing.stock}</td>`;
      html += `<td class="right">${ownedQty > 0 ? ownedQty : '-'}</td>`;
      html += `<td class="market-actions">`;
      html += `<button class="market-btn buy-btn${canBuy ? '' : ' disabled'}" data-buy-idx="${i}" title="Buy one">+</button>`;
      html += `<button class="market-btn sell-btn${canSell ? '' : ' disabled'}" data-sell-idx="${i}" title="Sell one">&minus;</button>`;
      html += `</td>`;
      html += `</tr>`;
    }

    html += `</table>`;
    html += `<div class="controls-hint">Click + to buy &bull; &minus; to sell &bull; ESC back</div>`;
    return html;
  }

  private renderModuleShop(): string {
    const shop = this.activeShop!;
    const ship = this.state.player.ship;
    let html = `<div class="center-section-title">${shop.name}</div>`;
    html += `<div class="center-section-subtitle">${shop.desc}</div>`;
    html += `<div class="row"><span class="label">Credits</span><span class="value good">${this.state.player.credits} CR</span></div>`;

    html += `<table class="market-table"><thead><tr>`;
    html += `<th>Module</th><th class="right">Type</th><th class="right">Tier</th><th class="right">Size</th><th class="right">Price</th><th>Action</th>`;
    html += `</tr></thead>`;

    for (let i = 0; i < this.moduleStock.length; i++) {
      const item = this.moduleStock[i];
      const sel = i === this.selectedIndex ? ' selected' : '';
      const canAfford = this.state.player.credits >= item.price;

      // Check if there's a compatible empty slot
      const compatSlot = ship.slots.find(s => s.type === item.module.type && !s.module && s.maxSize >= item.module.size);
      const canInstall = canAfford && !!compatSlot;

      html += `<tr class="${sel}" data-module-idx="${i}">`;
      html += `<td class="good-name">${item.module.name}</td>`;
      html += `<td class="right">${item.module.type}</td>`;
      html += `<td class="right">T${item.module.tier}</td>`;
      html += `<td class="right">${item.module.size}</td>`;
      html += `<td class="right ${canAfford ? 'good' : 'bad'}">${item.price} CR</td>`;
      html += `<td class="market-actions">`;
      if (canInstall) {
        html += `<button class="market-btn buy-btn" data-mod-buy-idx="${i}" title="Buy & install">Buy</button>`;
      } else if (!canAfford) {
        html += `<span class="bad">Can't afford</span>`;
      } else {
        html += `<span class="warn">No slot</span>`;
      }
      html += `</td>`;
      html += `</tr>`;
    }

    html += `</table>`;

    // Show current ship slots
    html += `<div class="center-section-title" style="margin-top:12px">Ship Slots</div>`;
    html += `<table class="market-table"><thead><tr><th>Slot</th><th>Max Size</th><th>Current Module</th></tr></thead>`;
    for (const slot of ship.slots) {
      html += `<tr>`;
      html += `<td>${slot.type}</td>`;
      html += `<td class="right">${slot.maxSize}</td>`;
      html += `<td>${slot.module ? `${slot.module.name} (T${slot.module.tier})` : '<span class="warn">Empty</span>'}</td>`;
      html += `</tr>`;
    }
    html += `</table>`;

    html += `<div class="controls-hint">Click Buy to purchase &bull; ESC back</div>`;
    return html;
  }

  private getArtefactCargo(): { item: CargoItem; loot: (typeof RUIN_LOOT)[number]; sellPrice: number }[] {
    const results: { item: CargoItem; loot: (typeof RUIN_LOOT)[number]; sellPrice: number }[] = [];
    for (const cargo of this.state.player.cargo) {
      const loot = RUIN_LOOT.find(l => l.id === cargo.id);
      if (loot) {
        const mult = ARTEFACT_PRICE_MULTIPLIERS[loot.rarity] ?? 1;
        results.push({ item: cargo, loot, sellPrice: Math.round(loot.value * mult) });
      }
    }
    return results;
  }

  private renderArtefactShop(): string {
    const shop = this.activeShop!;
    let html = `<div class="center-section-title">${shop.name}</div>`;
    html += `<div class="center-section-subtitle">${shop.desc}</div>`;
    html += `<div class="row"><span class="label">Credits</span><span class="value good">${this.state.player.credits} CR</span></div>`;

    const artefacts = this.getArtefactCargo();
    if (artefacts.length === 0) {
      html += `<div class="service-panel"><div class="row">You have no artefacts to sell. Explore ruins to find ancient relics!</div></div>`;
    } else {
      html += `<table class="market-table"><thead><tr>`;
      html += `<th>Artefact</th><th class="right">Rarity</th><th class="right">Price</th><th class="right">Qty</th><th>Action</th>`;
      html += `</tr></thead>`;
      for (let i = 0; i < artefacts.length; i++) {
        const a = artefacts[i];
        const sel = i === this.selectedIndex ? ' selected' : '';
        const rarityClass = a.loot.rarity === 'rare' ? 'good' : a.loot.rarity === 'uncommon' ? 'warn' : '';
        html += `<tr class="${sel}" data-artefact-idx="${i}">`;
        html += `<td class="good-name">${a.loot.name}</td>`;
        html += `<td class="right ${rarityClass}">${a.loot.rarity}</td>`;
        html += `<td class="right good">${a.sellPrice} CR</td>`;
        html += `<td class="right">x${a.item.quantity}</td>`;
        html += `<td class="market-actions"><button class="market-btn sell-btn" data-artefact-sell="${i}" title="Sell one">&minus;</button></td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    }

    html += `<div class="controls-hint">Click &minus; to sell &bull; ESC back</div>`;
    return html;
  }

  private sellArtefact(): void {
    if (this.shopMode !== 'artefacts') return;
    const artefacts = this.getArtefactCargo();
    const entry = artefacts[this.selectedIndex];
    if (!entry) return;

    this.state.player.credits += entry.sellPrice;
    this.state.player.stats.trades++;
    this.state.player.stats.credits_earned += entry.sellPrice;
    entry.item.quantity--;
    getAudioManager().playSfx('trade_sell');

    if (entry.item.quantity <= 0) {
      this.state.player.cargo = this.state.player.cargo.filter(c => c.quantity > 0);
    }

    const newArtefacts = this.getArtefactCargo();
    if (this.selectedIndex >= newArtefacts.length) {
      this.selectedIndex = Math.max(0, newArtefacts.length - 1);
    }

    this.renderShop();
    this.updatePanel();
  }

  private bindShopClicks(): void {
    const frame = getFrameManager();
    const el = frame.getCenterContentEl();

    // Trade buy/sell buttons
    el.querySelectorAll('button[data-buy-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.buyIdx!, 10);
        this.selectedIndex = idx;
        this.tryBuy();
      });
    });

    el.querySelectorAll('button[data-sell-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.sellIdx!, 10);
        this.selectedIndex = idx;
        this.trySell();
      });
    });

    // Module buy buttons
    el.querySelectorAll('button[data-mod-buy-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.modBuyIdx!, 10);
        this.selectedIndex = idx;
        this.tryBuyModule();
      });
    });

    // Row clicks for selection
    el.querySelectorAll('tr[data-market-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.marketIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_navigate');
        this.renderShop();
      });
    });

    el.querySelectorAll('tr[data-module-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.moduleIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_navigate');
        this.renderShop();
      });
    });

    // Bar hire clicks
    el.querySelectorAll('[data-hire-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.hireIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_navigate');
        this.renderShop();
      });
    });

    // Artefact sell buttons
    el.querySelectorAll('button[data-artefact-sell]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.artefactSell!, 10);
        this.selectedIndex = idx;
        this.sellArtefact();
      });
    });

    // Artefact row clicks
    el.querySelectorAll('tr[data-artefact-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.artefactIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_navigate');
        this.renderShop();
      });
    });
  }

  private shopNavigate(dir: number): void {
    const max = this.shopMode === 'trade' ? this.market.length : this.shopMode === 'modules' ? this.moduleStock.length : this.shopMode === 'artefacts' ? this.getArtefactCargo().length : this.hirelings.length;
    if (max === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + max) % max;
    getAudioManager().playSfx('ui_navigate');
    this.renderShop();
  }

  private shopSelect(): void {
    if (this.shopMode === 'trade') {
      this.tryBuy();
    } else if (this.shopMode === 'modules') {
      this.tryBuyModule();
    } else if (this.shopMode === 'artefacts') {
      this.sellArtefact();
    } else if (this.shopMode === 'bar') {
      this.tryHire();
    }
  }

  private tryBuy(): void {
    if (this.shopMode !== 'trade') return;
    const listing = this.market[this.selectedIndex];
    if (!listing || listing.stock <= 0) return;
    if (this.state.player.credits < listing.buyPrice) return;
    if (getCargoUsed(this.state.player.cargo) >= getCargoCapacity(this.state.player.ship)) return;

    this.state.player.credits -= listing.buyPrice;
    listing.stock--;
    this.state.player.stats.trades++;
    getAudioManager().playSfx('trade_buy');

    const existing = this.state.player.cargo.find(c => c.id === listing.cargoId);
    if (existing) {
      existing.quantity++;
    } else {
      this.state.player.cargo.push({
        id: listing.cargoId,
        name: listing.displayName,
        quantity: 1,
        value: listing.buyPrice,
        baseGoodId: listing.good.id,
      });
    }

    this.renderShop();
    this.updatePanel();
  }

  private trySell(): void {
    if (this.shopMode !== 'trade') return;
    const listing = this.market[this.selectedIndex];
    if (!listing) return;

    const owned = this.state.player.cargo.find(c =>
      c.id === listing.cargoId ||
      c.id === listing.good.id ||
      c.baseGoodId === listing.good.id
    );
    if (!owned || owned.quantity <= 0) return;

    this.state.player.credits += listing.sellPrice;
    this.state.player.stats.trades++;
    this.state.player.stats.credits_earned += listing.sellPrice;
    listing.stock++;
    owned.quantity--;
    getAudioManager().playSfx('trade_sell');

    if (owned.quantity <= 0) {
      this.state.player.cargo = this.state.player.cargo.filter(c => c.quantity > 0);
    }

    this.renderShop();
    this.updatePanel();
  }

  private tryBuyModule(): void {
    if (this.shopMode !== 'modules') return;
    const item = this.moduleStock[this.selectedIndex];
    if (!item) return;
    if (this.state.player.credits < item.price) return;

    const ship = this.state.player.ship;
    const slot = ship.slots.find(s => s.type === item.module.type && !s.module && s.maxSize >= item.module.size);
    if (!slot) return;

    this.state.player.credits -= item.price;
    slot.module = { ...item.module };
    getAudioManager().playSfx('trade_buy');

    // Remove from stock
    this.moduleStock.splice(this.selectedIndex, 1);
    if (this.selectedIndex >= this.moduleStock.length) {
      this.selectedIndex = Math.max(0, this.moduleStock.length - 1);
    }

    this.renderShop();
    this.updatePanel();
    getFrameManager().showAlert(`Installed ${item.module.name}!`, 'info');
  }

  // ─── EXIT ─────────────────────────────────────────────

  private exitSettlement(): void {
    getAudioManager().playSfx('footstep');
    const frame = getFrameManager();
    frame.hidePanel();

    this.scene.start('TransitionScene', {
      type: 'takeoff',
      targetScene: 'PlanetSurfaceScene',
      targetData: { planet: this.planet },
      text: 'LEAVING SETTLEMENT...',
    });
  }

  // ─── GENERATION ───────────────────────────────────────

  private generateSettlement(): void {
    const seed = this.state.seed * 8000 + this.planet.id * 523;
    const rng = new SeededRandom(seed);

    // Initialize all as void
    this.tiles = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        this.tiles[y][x] = { type: 'void', walkable: false };
      }
    }

    // Town layout: grid of roads with buildings between them
    const roadSpacing = 6;
    const margin = 3;

    // Lay roads in a grid pattern
    for (let y = margin; y < MAP_SIZE - margin; y++) {
      for (let x = margin; x < MAP_SIZE - margin; x++) {
        const onHRoad = (y - margin) % roadSpacing === 0;
        const onVRoad = (x - margin) % roadSpacing === 0;

        if (onHRoad && onVRoad) {
          this.tiles[y][x] = { type: 'road_cross', walkable: true };
        } else if (onHRoad || onVRoad) {
          this.tiles[y][x] = { type: 'road', walkable: true };
        }
      }
    }

    // Fill blocks between roads with buildings
    const blocks: { x: number; y: number; w: number; h: number }[] = [];
    for (let by = margin; by < MAP_SIZE - margin - roadSpacing; by += roadSpacing) {
      for (let bx = margin; bx < MAP_SIZE - margin - roadSpacing; bx += roadSpacing) {
        blocks.push({ x: bx + 1, y: by + 1, w: roadSpacing - 1, h: roadSpacing - 1 });
      }
    }

    // Decide which blocks are buildings vs plazas
    const shuffledBlocks = [...blocks].sort(() => rng.next() - 0.5);

    // Pick 1-2 shops + always a bar
    const shopCount = rng.int(1, 2);
    const tradeShops = SHOP_TEMPLATES.filter(s => s.type === 'trade');
    const moduleShops = SHOP_TEMPLATES.filter(s => s.type === 'modules');

    const shops: ShopDef[] = [];
    // Always one trade shop
    shops.push(tradeShops[rng.int(0, tradeShops.length - 1)]);
    if (shopCount > 1) {
      // Second shop is modules
      shops.push(moduleShops[rng.int(0, moduleShops.length - 1)]);
    }
    // ~30% chance of an artefact dealer
    if (rng.next() < 0.3) {
      shops.push(ARTEFACT_SHOP_TEMPLATES[rng.int(0, ARTEFACT_SHOP_TEMPLATES.length - 1)]);
    }
    // Always a bar
    shops.push(BAR_TEMPLATES[rng.int(0, BAR_TEMPLATES.length - 1)]);

    let shopIdx = 0;
    let plazaPlaced = false;

    for (let bi = 0; bi < shuffledBlocks.length; bi++) {
      const block = shuffledBlocks[bi];

      if (!plazaPlaced && bi === 1) {
        // Make one block a plaza
        for (let dy = 0; dy < block.h; dy++) {
          for (let dx = 0; dx < block.w; dx++) {
            const tx = block.x + dx;
            const ty = block.y + dy;
            if (tx < MAP_SIZE && ty < MAP_SIZE) {
              this.tiles[ty][tx] = { type: 'plaza', walkable: true };
            }
          }
        }
        // Add a lamp in center
        const cx = block.x + Math.floor(block.w / 2);
        const cy = block.y + Math.floor(block.h / 2);
        if (cx < MAP_SIZE && cy < MAP_SIZE) {
          this.tiles[cy][cx] = { type: 'lamp', walkable: false };
        }
        plazaPlaced = true;
        continue;
      }

      if (bi >= shuffledBlocks.length - 2 && block.w < 3) continue;

      // Fill block with building
      const isShop = shopIdx < shops.length && bi < shops.length + 2;

      for (let dy = 0; dy < block.h; dy++) {
        for (let dx = 0; dx < block.w; dx++) {
          const tx = block.x + dx;
          const ty = block.y + dy;
          if (tx >= MAP_SIZE || ty >= MAP_SIZE) continue;

          const isEdge = dx === 0 || dx === block.w - 1 || dy === 0 || dy === block.h - 1;
          if (isEdge) {
            this.tiles[ty][tx] = { type: 'building_wall', walkable: false };
          } else {
            this.tiles[ty][tx] = { type: 'building_floor', walkable: false };
            if (isShop && dx === Math.floor(block.w / 2) && dy === Math.floor(block.h / 2)) {
              const shopType = shops[shopIdx].type;
              this.tiles[ty][tx] = {
                type: shopType === 'trade' ? 'shop_trade' : shopType === 'modules' ? 'shop_modules' : shopType === 'artefacts' ? 'shop_artefacts' : 'shop_bar',
                walkable: false,
              };
            }
          }
        }
      }

      // Place door on south wall facing road
      const doorX = block.x + Math.floor(block.w / 2);
      const doorY = block.y + block.h - 1;
      if (doorX < MAP_SIZE && doorY < MAP_SIZE) {
        if (isShop && shopIdx < shops.length) {
          this.tiles[doorY][doorX] = { type: 'building_door', walkable: true, shopDef: shops[shopIdx] };
          shopIdx++;
        } else {
          this.tiles[doorY][doorX] = { type: 'building_door', walkable: true };
        }
      }
    }

    // Place player at center road intersection
    const centerRoadX = margin;
    const centerRoadY = margin;
    // Find nearest road tile to center
    const mid = Math.floor(MAP_SIZE / 2);
    let bestDist = Infinity;
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const t = this.tiles[y][x];
        if (t.walkable && (t.type === 'road' || t.type === 'road_cross' || t.type === 'plaza')) {
          const d = Math.abs(x - mid) + Math.abs(y - mid);
          if (d < bestDist) {
            bestDist = d;
            this.playerX = x;
            this.playerY = y;
          }
        }
      }
    }

    // Add some fence and lamp decorations along roads
    for (let y = margin; y < MAP_SIZE - margin; y++) {
      for (let x = margin; x < MAP_SIZE - margin; x++) {
        if (this.tiles[y][x].type !== 'void') continue;
        // Check if adjacent to road
        const adjRoad = (
          (x > 0 && (this.tiles[y][x - 1].type === 'road' || this.tiles[y][x - 1].type === 'road_cross')) ||
          (x < MAP_SIZE - 1 && (this.tiles[y][x + 1].type === 'road' || this.tiles[y][x + 1].type === 'road_cross'))
        );
        if (adjRoad && rng.next() < 0.15) {
          this.tiles[y][x] = { type: 'fence', walkable: false };
        }
      }
    }
  }
}
