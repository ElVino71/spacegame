import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, FACTION_NAMES, ECONOMY_TYPES } from '../utils/Constants';
import { StationData } from '../entities/StarSystem';
import { getCargoCapacity, getCargoUsed, CargoItem } from '../entities/Player';
import { SeededRandom } from '../utils/SeededRandom';

const PANEL_WIDTH = 340;

interface TradeGood {
  id: string;
  name: string;
  basePrice: number;
  category: string;
}

interface MarketListing {
  good: TradeGood;
  buyPrice: number;   // price to buy from station
  sellPrice: number;  // price station pays you
  stock: number;
}

const TRADE_GOODS: TradeGood[] = [
  { id: 'food',        name: 'Food Rations',     basePrice: 20,  category: 'basic' },
  { id: 'water',       name: 'Purified Water',   basePrice: 15,  category: 'basic' },
  { id: 'med',         name: 'Medical Supplies',  basePrice: 50,  category: 'basic' },
  { id: 'iron',        name: 'Iron Ore',          basePrice: 30,  category: 'mineral' },
  { id: 'copper',      name: 'Copper Ore',        basePrice: 40,  category: 'mineral' },
  { id: 'titanium',    name: 'Titanium',          basePrice: 80,  category: 'mineral' },
  { id: 'platinum',    name: 'Platinum',          basePrice: 150, category: 'mineral' },
  { id: 'crystals',    name: 'Crystals',          basePrice: 120, category: 'mineral' },
  { id: 'electronics', name: 'Electronics',       basePrice: 90,  category: 'tech' },
  { id: 'components',  name: 'Ship Components',   basePrice: 110, category: 'tech' },
  { id: 'weapons',     name: 'Weapons',           basePrice: 130, category: 'military' },
  { id: 'luxury',      name: 'Luxury Goods',      basePrice: 200, category: 'luxury' },
  { id: 'fuel_cells',  name: 'Fuel Cells',        basePrice: 45,  category: 'basic' },
  { id: 'artifacts',   name: 'Alien Artifacts',   basePrice: 300, category: 'rare' },
  { id: 'rare_earth',  name: 'Rare Earth',        basePrice: 170, category: 'mineral' },
];

// Economy type affects prices: negative = cheaper to buy, positive = more expensive
const ECONOMY_MODIFIERS: Record<string, Record<string, number>> = {
  agricultural: { basic: -0.3, mineral: 0.1, tech: 0.2, military: 0.15, luxury: 0.1, rare: 0 },
  industrial:   { basic: 0.1, mineral: -0.2, tech: -0.15, military: -0.1, luxury: 0.2, rare: 0 },
  mining:       { basic: 0.15, mineral: -0.35, tech: 0.1, military: 0.1, luxury: 0.2, rare: -0.1 },
  military:     { basic: 0.05, mineral: 0.1, tech: -0.1, military: -0.3, luxury: 0.3, rare: 0.1 },
  research:     { basic: 0.1, mineral: 0.15, tech: -0.25, military: 0.2, luxury: -0.1, rare: -0.2 },
  outpost:      { basic: 0.3, mineral: 0.2, tech: 0.3, military: 0.2, luxury: -0.2, rare: 0 },
};

export class StationScene extends Phaser.Scene {
  private state!: GameState;
  private station!: StationData;
  private market: MarketListing[] = [];
  private selectedIndex = 0;
  private mode: 'market' | 'refuel' | 'menu' = 'menu';

  // HTML panel
  private panelEl!: HTMLElement;

  constructor() {
    super({ key: 'StationScene' });
  }

  init(data: { station: StationData }): void {
    this.station = data.station;
  }

  create(): void {
    this.state = getGameState();
    this.selectedIndex = 0;
    this.mode = 'menu';

    this.generateMarket();
    this.setupPanel();
    this.renderPanel();

    // Background
    this.cameras.main.setBackgroundColor(0x080818);

    // Station visual (simple interior view)
    const gfx = this.add.graphics();
    const cx = GAME_WIDTH / 2 + PANEL_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Station structure
    gfx.lineStyle(2, 0x445566, 0.6);
    gfx.strokeRoundedRect(cx - 250, cy - 200, 500, 400, 12);
    gfx.fillStyle(0x111128, 0.8);
    gfx.fillRoundedRect(cx - 248, cy - 198, 496, 396, 10);

    // Station name
    this.add.text(cx, cy - 170, this.station.name, {
      fontFamily: 'monospace', fontSize: '20px', color: '#00aaff',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 145, `Economy: ${this.station.economy} | Faction: ${FACTION_NAMES[this.station.factionIndex]}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#667788',
    }).setOrigin(0.5);

    // Docking bay visual
    gfx.fillStyle(0x0a0a20, 1);
    gfx.fillRect(cx - 200, cy - 110, 400, 280);
    gfx.lineStyle(1, 0x334455, 0.5);
    gfx.strokeRect(cx - 200, cy - 110, 400, 280);

    // Welcome text
    this.add.text(cx, cy - 90, 'DOCKING BAY - WELCOME CAPTAIN', {
      fontFamily: 'monospace', fontSize: '11px', color: '#00ff88',
    }).setOrigin(0.5);

    // Menu items rendered in center
    this.add.text(cx, cy + 190, 'Navigate with UP/DOWN | ENTER to select | ESC to undock', {
      fontFamily: 'monospace', fontSize: '11px', color: '#445566',
    }).setOrigin(0.5);

    // Input
    this.input.keyboard!.on('keydown-ESC', () => this.handleEsc());
    this.input.keyboard!.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard!.on('keydown-W', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-S', () => this.navigate(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.select());
    this.input.keyboard!.on('keydown-B', () => this.tryBuy());
    this.input.keyboard!.on('keydown-V', () => this.trySell());
    this.input.keyboard!.on('keydown-R', () => this.refuel());
  }

  shutdown(): void {
    this.panelEl?.classList.remove('visible');
  }

  // ─── MARKET GENERATION ──────────────────────────────────

  private generateMarket(): void {
    const system = this.state.getCurrentSystem();
    const rng = new SeededRandom(system.id * 777 + this.station.factionIndex);
    const econMod = ECONOMY_MODIFIERS[this.station.economy] ?? {};

    this.market = TRADE_GOODS.map(good => {
      const modifier = econMod[good.category] ?? 0;
      const variance = rng.float(-0.15, 0.15);
      const priceMult = 1 + modifier + variance;
      const buyPrice = Math.max(1, Math.round(good.basePrice * priceMult));
      const sellPrice = Math.max(1, Math.round(buyPrice * 0.75));
      const stock = rng.int(0, 50);
      return { good, buyPrice, sellPrice, stock };
    });
  }

  // ─── HTML PANEL ─────────────────────────────────────────

  private setupPanel(): void {
    this.panelEl = document.getElementById('ui-panel')!;
    this.panelEl.innerHTML = `<div id="station-panel" style="height:100%;display:flex;flex-direction:column;"></div>`;
    this.panelEl.style.width = PANEL_WIDTH + 'px';
    this.panelEl.classList.add('visible');
  }

  private row(label: string, value: string, cls = ''): string {
    return `<div class="row"><span class="label">${label}</span><span class="value ${cls}">${value}</span></div>`;
  }

  private renderPanel(): void {
    const el = document.getElementById('station-panel')!;
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    let html = `<div class="section">`;
    html += `<div class="section-title">${this.station.name}</div>`;
    html += this.row('Economy', this.station.economy);
    html += this.row('Faction', FACTION_NAMES[this.station.factionIndex]);
    html += `</div>`;

    html += `<div class="section">`;
    html += `<div class="section-title">Your Ship</div>`;
    html += this.row('Credits', `${this.state.player.credits} CR`, 'good');
    html += this.row('Cargo', `${cargoUsed}/${cargoMax}`);
    html += this.row('Fuel', `${Math.floor(ship.fuel.current)}/${ship.fuel.max}`);
    html += this.row('Hull', `${Math.floor(ship.hull.current)}/${ship.hull.max}`);
    html += `</div>`;

    if (this.mode === 'menu') {
      const items = ['Trade Goods', 'Refuel Ship', 'Repair Hull', 'Undock'];
      html += `<div class="section">`;
      html += `<div class="section-title">Services</div>`;
      for (let i = 0; i < items.length; i++) {
        const sel = i === this.selectedIndex;
        html += `<div style="padding:4px 6px;margin:2px 0;background:${sel ? '#1a2a3a' : 'transparent'};color:${sel ? '#00ff88' : '#aabbaa'};border-left:${sel ? '2px solid #00ff88' : '2px solid transparent'}">`;
        html += `${sel ? '> ' : '  '}${items[i]}</div>`;
      }
      html += `</div>`;
    } else if (this.mode === 'market') {
      html += `<div class="section">`;
      html += `<div class="section-title">Market</div>`;
      html += `<div style="font-size:10px;color:#556677;margin-bottom:4px">[B]uy  [V]sell  [ESC]back</div>`;

      for (let i = 0; i < this.market.length; i++) {
        const listing = this.market[i];
        const sel = i === this.selectedIndex;
        const owned = this.state.player.cargo.find(c => c.id === listing.good.id);
        const ownedQty = owned ? owned.quantity : 0;

        html += `<div style="padding:3px 6px;margin:1px 0;background:${sel ? '#1a2a3a' : 'transparent'};border-left:${sel ? '2px solid #00ff88' : '2px solid transparent'};font-size:11px">`;
        html += `<div style="color:${sel ? '#ffffff' : '#aabbaa'}">${listing.good.name}</div>`;
        html += `<div class="row" style="font-size:10px"><span class="label">Buy: ${listing.buyPrice} CR</span><span class="label">Sell: ${listing.sellPrice} CR</span></div>`;
        html += `<div class="row" style="font-size:10px"><span class="label">Stock: ${listing.stock}</span><span class="label">Owned: ${ownedQty}</span></div>`;
        html += `</div>`;
      }
      html += `</div>`;
    } else if (this.mode === 'refuel') {
      const fuelNeeded = ship.fuel.max - ship.fuel.current;
      const fuelCost = Math.ceil(fuelNeeded * 0.5);
      html += `<div class="section">`;
      html += `<div class="section-title">Refuel</div>`;
      html += this.row('Fuel needed', `${Math.ceil(fuelNeeded)}`);
      html += this.row('Cost', `${fuelCost} CR`, this.state.player.credits >= fuelCost ? 'good' : 'bad');
      html += `<div class="action" style="margin-top:8px">[R] Refuel  [ESC] Back</div>`;
      html += `</div>`;
    }

    // Cargo manifest
    if (this.state.player.cargo.length > 0) {
      html += `<div class="section">`;
      html += `<div class="section-title">Cargo Hold</div>`;
      for (const item of this.state.player.cargo) {
        html += this.row(item.name, `x${item.quantity}`);
      }
      html += `</div>`;
    }

    el.innerHTML = html;
  }

  // ─── NAVIGATION ─────────────────────────────────────────

  private navigate(dir: number): void {
    let max = 4; // menu items
    if (this.mode === 'market') max = this.market.length;
    this.selectedIndex = (this.selectedIndex + dir + max) % max;
    this.renderPanel();
  }

  private select(): void {
    if (this.mode === 'menu') {
      switch (this.selectedIndex) {
        case 0: this.mode = 'market'; this.selectedIndex = 0; break;
        case 1: this.mode = 'refuel'; break;
        case 2: this.repairHull(); break;
        case 3: this.undock(); return;
      }
    } else if (this.mode === 'market') {
      this.tryBuy();
    }
    this.renderPanel();
  }

  private handleEsc(): void {
    if (this.mode !== 'menu') {
      this.mode = 'menu';
      this.selectedIndex = 0;
      this.renderPanel();
    } else {
      this.undock();
    }
  }

  // ─── ACTIONS ────────────────────────────────────────────

  private tryBuy(): void {
    if (this.mode !== 'market') return;
    const listing = this.market[this.selectedIndex];
    if (!listing || listing.stock <= 0) return;
    if (this.state.player.credits < listing.buyPrice) return;

    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(this.state.player.ship);
    if (cargoUsed >= cargoMax) return;

    this.state.player.credits -= listing.buyPrice;
    listing.stock--;

    const existing = this.state.player.cargo.find(c => c.id === listing.good.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.state.player.cargo.push({
        id: listing.good.id,
        name: listing.good.name,
        quantity: 1,
        value: listing.good.basePrice,
      });
    }

    this.renderPanel();
  }

  private trySell(): void {
    if (this.mode !== 'market') return;
    const listing = this.market[this.selectedIndex];
    if (!listing) return;

    const owned = this.state.player.cargo.find(c => c.id === listing.good.id);
    if (!owned || owned.quantity <= 0) return;

    this.state.player.credits += listing.sellPrice;
    listing.stock++;
    owned.quantity--;

    if (owned.quantity <= 0) {
      this.state.player.cargo = this.state.player.cargo.filter(c => c.quantity > 0);
    }

    this.renderPanel();
  }

  private refuel(): void {
    const ship = this.state.player.ship;
    const fuelNeeded = ship.fuel.max - ship.fuel.current;
    if (fuelNeeded <= 0) return;
    const cost = Math.ceil(fuelNeeded * 0.5);
    if (this.state.player.credits < cost) return;

    this.state.player.credits -= cost;
    ship.fuel.current = ship.fuel.max;
    this.renderPanel();
  }

  private repairHull(): void {
    const ship = this.state.player.ship;
    const dmg = ship.hull.max - ship.hull.current;
    if (dmg <= 0) return;
    const cost = Math.ceil(dmg * 2);
    if (this.state.player.credits < cost) return;

    this.state.player.credits -= cost;
    ship.hull.current = ship.hull.max;
    this.renderPanel();
  }

  private undock(): void {
    this.panelEl.classList.remove('visible');
    this.scene.start('TransitionScene', {
      type: 'undock',
      targetScene: 'SystemScene',
      text: `UNDOCKING FROM ${this.station.name.toUpperCase()}...`,
    });
  }
}
