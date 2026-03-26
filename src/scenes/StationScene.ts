import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { FACTION_NAMES } from '../utils/Constants';
import { StationData } from '../entities/StarSystem';
import { getCargoCapacity, getCargoUsed } from '../entities/Player';
import { SeededRandom } from '../utils/SeededRandom';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { TRADE_GOODS, TRADE_PREFIXES, ECONOMY_MODIFIERS, TradeGood } from '../data/trade';
import { saveGame } from '../utils/SaveSystem';

interface MarketListing {
  good: TradeGood;
  cargoId: string;
  displayName: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
}

export class StationScene extends Phaser.Scene {
  private state!: GameState;
  private station!: StationData;
  private market: MarketListing[] = [];
  private selectedIndex = 0;
  private mode: 'menu' | 'market' | 'refuel' | 'repair' = 'menu';

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

    const frame = getFrameManager();
    frame.enterGameplay(`Station: ${this.station.name}`);
    frame.setThemeFromShip(this.state.player.ship);
    frame.setNav([
      { id: 'station', label: 'Station', active: true },
      { id: 'undock', label: 'Undock', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'undock') this.undock();
    });

    // No side panel — use center overlay
    frame.hidePanel();
    frame.showCenterOverlay();

    this.cameras.main.setBackgroundColor(0x080818);

    this.renderCenter();
    this.bindClickHandlers();

    getAudioManager().setAmbience('station');

    // Keyboard input
    this.input.keyboard!.on('keydown-ESC', () => this.handleEsc());
    this.input.keyboard!.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard!.on('keydown-W', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-S', () => this.navigate(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.select());
    this.input.keyboard!.on('keydown-B', () => this.tryBuy());
    this.input.keyboard!.on('keydown-V', () => this.trySell());
    this.input.keyboard!.on('keydown-R', () => this.handleR());
  }

  shutdown(): void {
    getFrameManager().hideCenterOverlay();
  }

  // ─── MARKET GENERATION ──────────────────────────────────

  private generateMarket(): void {
    const system = this.state.getCurrentSystem();
    const rng = new SeededRandom(system.id * 777 + this.station.factionIndex);
    const econMod = ECONOMY_MODIFIERS[this.station.economy] ?? {};

    this.market = TRADE_GOODS.map(good => {
      const modifier = econMod[good.category] ?? 0;
      const variance = rng.float(-0.15, 0.15);

      let displayName = good.name;
      let cargoId = good.id;
      let prefixMod = 0;
      if (good.category !== 'mineral') {
        const prefix = TRADE_PREFIXES[rng.int(0, TRADE_PREFIXES.length - 1)];
        displayName = `${prefix.label} ${good.name}`;
        cargoId = `${prefix.label.toLowerCase().replace(/\s+/g, '_')}:${good.id}`;
        prefixMod = prefix.mod;
      }

      const priceMult = 1 + modifier + variance + prefixMod;
      const buyPrice = Math.max(1, Math.round(good.basePrice * priceMult));
      const sellPrice = Math.max(1, Math.round(buyPrice * 0.75));
      const stock = rng.int(0, 50);
      return { good, cargoId, displayName, buyPrice, sellPrice, stock };
    });
  }

  // ─── RENDER ─────────────────────────────────────────────

  private renderCenter(): void {
    const frame = getFrameManager();
    const ship = this.state.player.ship;
    const cargoUsed = getCargoUsed(this.state.player.cargo);
    const cargoMax = getCargoCapacity(ship);

    frame.updateStatus(ship.hull, ship.fuel, cargoUsed, cargoMax, this.state.player.credits);

    let html = '';

    // Station header
    html += `<div class="station-header">`;
    html += `<div class="station-name">${this.station.name}</div>`;
    html += `<div class="station-info">${this.station.economy} Economy &bull; ${FACTION_NAMES[this.station.factionIndex]}</div>`;
    html += `</div>`;

    // Ship summary bar
    const hullPct = Math.round((ship.hull.current / ship.hull.max) * 100);
    const fuelPct = Math.round((ship.fuel.current / ship.fuel.max) * 100);
    const hullCls = hullPct < 25 ? 'bad' : hullPct < 50 ? 'warn' : '';
    const fuelCls = fuelPct < 25 ? 'bad' : fuelPct < 50 ? 'warn' : '';

    html += `<div class="ship-summary">`;
    html += `<div class="ship-stat"><span class="stat-label">Credits</span><span class="stat-value good">${this.state.player.credits.toLocaleString()} CR</span></div>`;
    html += `<div class="ship-stat"><span class="stat-label">Cargo</span><span class="stat-value">${cargoUsed}/${cargoMax}</span></div>`;
    html += `<div class="ship-stat"><span class="stat-label">Fuel</span><span class="stat-value ${fuelCls}">${Math.floor(ship.fuel.current)}/${ship.fuel.max}</span></div>`;
    html += `<div class="ship-stat"><span class="stat-label">Hull</span><span class="stat-value ${hullCls}">${Math.floor(ship.hull.current)}/${ship.hull.max}</span></div>`;
    html += `</div>`;

    // Mode-specific content
    if (this.mode === 'menu') {
      html += this.renderMenu();
    } else if (this.mode === 'market') {
      html += this.renderMarket();
    } else if (this.mode === 'refuel') {
      html += this.renderRefuel();
    } else if (this.mode === 'repair') {
      html += this.renderRepair();
    }

    // Cargo hold
    if (this.state.player.cargo.length > 0) {
      html += `<div class="center-section-title">Cargo Hold</div>`;
      html += `<div class="cargo-list">`;
      for (const item of this.state.player.cargo) {
        const isTradable = TRADE_GOODS.some(g => g.id === item.id || g.id === item.baseGoodId);
        html += `<div class="cargo-row"><span class="cargo-name">${item.name}</span><span class="cargo-qty">x${item.quantity}${isTradable ? '' : ' (N/T)'}</span></div>`;
      }
      html += `</div>`;
    }

    frame.setCenterContent(html);
    this.bindClickHandlers();
  }

  private renderMenu(): string {
    const items = [
      { label: 'Trade Goods', desc: 'Buy and sell commodities' },
      { label: 'Refuel Ship', desc: 'Replenish fuel reserves' },
      { label: 'Repair Hull', desc: 'Fix structural damage' },
      { label: 'Save & Exit', desc: 'Save progress and return to title' },
      { label: 'Undock', desc: 'Return to system space' },
    ];

    let html = `<div class="center-section-title">Station Services</div>`;
    for (let i = 0; i < items.length; i++) {
      const sel = i === this.selectedIndex ? ' selected' : '';
      html += `<div class="menu-item${sel}" data-menu-idx="${i}">`;
      html += `${sel ? '&#9654; ' : ''}${items[i].label}`;
      html += `<div class="menu-desc">${items[i].desc}</div>`;
      html += `</div>`;
    }
    html += `<div class="controls-hint">UP/DOWN to navigate &bull; ENTER to select</div>`;
    return html;
  }

  private renderMarket(): string {
    let html = `<div class="center-section-title">Trade Market <span style="font-size:10px;color:var(--frame-text-muted);letter-spacing:0">[B]uy [V]sell [ESC]back</span></div>`;
    html += `<table class="market-table">`;
    html += `<tr><th>Good</th><th class="right">Buy</th><th class="right">Sell</th><th class="right">Stock</th><th class="right">Owned</th></tr>`;

    for (let i = 0; i < this.market.length; i++) {
      const listing = this.market[i];
      const sel = i === this.selectedIndex ? ' selected' : '';
      const ownedQty = this.state.player.cargo
        .filter(c => c.id === listing.cargoId || c.id === listing.good.id || c.baseGoodId === listing.good.id)
        .reduce((sum, c) => sum + c.quantity, 0);

      html += `<tr class="${sel}" data-market-idx="${i}">`;
      html += `<td class="good-name">${listing.displayName}</td>`;
      html += `<td class="right">${listing.buyPrice} CR</td>`;
      html += `<td class="right">${listing.sellPrice} CR</td>`;
      html += `<td class="right">${listing.stock}</td>`;
      html += `<td class="right">${ownedQty > 0 ? ownedQty : '-'}</td>`;
      html += `</tr>`;
    }

    html += `</table>`;
    html += `<div class="controls-hint">UP/DOWN to select &bull; [B] Buy &bull; [V] Sell &bull; ESC back</div>`;
    return html;
  }

  private renderRefuel(): string {
    const ship = this.state.player.ship;
    const fuelNeeded = ship.fuel.max - ship.fuel.current;
    const fuelCost = Math.ceil(fuelNeeded * 0.5);
    const canAfford = this.state.player.credits >= fuelCost;

    let html = `<div class="center-section-title">Refuel Ship</div>`;
    html += `<div class="service-panel">`;
    html += `<div class="row"><span class="label">Current Fuel</span><span class="value">${Math.floor(ship.fuel.current)} / ${ship.fuel.max}</span></div>`;
    html += `<div class="row"><span class="label">Fuel Needed</span><span class="value">${Math.ceil(fuelNeeded)}</span></div>`;
    html += `<div class="row"><span class="label">Cost</span><span class="value ${canAfford ? 'good' : 'bad'}">${fuelCost} CR</span></div>`;
    html += `</div>`;
    html += `<div class="controls-hint">[R] Refuel &bull; ESC back</div>`;
    return html;
  }

  private renderRepair(): string {
    const ship = this.state.player.ship;
    const dmg = ship.hull.max - ship.hull.current;
    const cost = Math.ceil(dmg * 2);
    const canAfford = this.state.player.credits >= cost;

    let html = `<div class="center-section-title">Repair Hull</div>`;
    html += `<div class="service-panel">`;
    html += `<div class="row"><span class="label">Current Hull</span><span class="value">${Math.floor(ship.hull.current)} / ${ship.hull.max}</span></div>`;
    html += `<div class="row"><span class="label">Damage</span><span class="value">${Math.ceil(dmg)}</span></div>`;
    html += `<div class="row"><span class="label">Repair Cost</span><span class="value ${canAfford ? 'good' : 'bad'}">${cost} CR</span></div>`;
    html += `</div>`;
    html += `<div class="controls-hint">[ENTER] Repair &bull; ESC back</div>`;
    return html;
  }

  // ─── CLICK HANDLERS ──────────────────────────────────────

  private bindClickHandlers(): void {
    const frame = getFrameManager();
    const el = frame.getCenterContentEl();

    // Menu item clicks
    el.querySelectorAll('.menu-item[data-menu-idx]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt((item as HTMLElement).dataset.menuIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_confirm');
        this.select();
      });
    });

    // Market row clicks
    el.querySelectorAll('tr[data-market-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.marketIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_navigate');
        this.renderCenter();
      });
    });
  }

  // ─── NAVIGATION ─────────────────────────────────────────

  private navigate(dir: number): void {
    let max = 5;
    if (this.mode === 'market') max = this.market.length;
    if (max === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + max) % max;
    getAudioManager().playSfx('ui_navigate');
    this.renderCenter();
  }

  private select(): void {
    getAudioManager().playSfx('ui_confirm');
    if (this.mode === 'menu') {
      switch (this.selectedIndex) {
        case 0: this.mode = 'market'; this.selectedIndex = 0; break;
        case 1: this.mode = 'refuel'; break;
        case 2: this.mode = 'repair'; this.selectedIndex = 0; this.repairHull(); return;
        case 3: 
          saveGame(this.state);
          this.scene.start('TitleScene');
          return;
        case 4: this.undock(); return;
      }
    } else if (this.mode === 'market') {
      this.tryBuy();
    } else if (this.mode === 'repair') {
      this.repairHull();
      return;
    }
    this.renderCenter();
  }

  private handleEsc(): void {
    if (this.mode !== 'menu') {
      this.mode = 'menu';
      this.selectedIndex = 0;
      this.renderCenter();
    } else {
      this.undock();
    }
  }

  private handleR(): void {
    if (this.mode === 'refuel' || this.mode === 'menu') {
      this.refuel();
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

    this.renderCenter();
  }

  private trySell(): void {
    if (this.mode !== 'market') return;
    const listing = this.market[this.selectedIndex];
    if (!listing) return;

    const owned = this.state.player.cargo.find(c =>
      c.id === listing.cargoId ||
      c.id === listing.good.id ||
      c.baseGoodId === listing.good.id
    );
    if (!owned || owned.quantity <= 0) return;

    this.state.player.credits += listing.sellPrice;
    listing.stock++;
    owned.quantity--;
    getAudioManager().playSfx('trade_sell');

    if (owned.quantity <= 0) {
      this.state.player.cargo = this.state.player.cargo.filter(c => c.quantity > 0);
    }

    this.renderCenter();
  }

  private refuel(): void {
    const ship = this.state.player.ship;
    const fuelNeeded = ship.fuel.max - ship.fuel.current;
    if (fuelNeeded <= 0) return;
    const cost = Math.ceil(fuelNeeded * 0.5);
    if (this.state.player.credits < cost) return;

    this.state.player.credits -= cost;
    ship.fuel.current = ship.fuel.max;
    getAudioManager().playSfx('refuel');
    this.renderCenter();
  }

  private repairHull(): void {
    const ship = this.state.player.ship;
    const dmg = ship.hull.max - ship.hull.current;
    if (dmg <= 0) return;
    const cost = Math.ceil(dmg * 2);
    if (this.state.player.credits < cost) return;

    this.state.player.credits -= cost;
    ship.hull.current = ship.hull.max;
    getAudioManager().playSfx('repair');
    this.renderCenter();
  }

  private undock(): void {
    getAudioManager().playSfx('undock');
    getFrameManager().hideCenterOverlay();
    this.scene.start('TransitionScene', {
      type: 'undock',
      targetScene: 'SystemScene',
      targetData: { fromStation: true },
      text: `UNDOCKING FROM ${this.station.name.toUpperCase()}...`,
    });
  }
}
