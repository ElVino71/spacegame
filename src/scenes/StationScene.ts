import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { FACTION_NAMES } from '../data/factions';
import { StationData } from '../entities/StarSystem';
import { CargoItem, getCargoCapacity, getCargoUsed, getCrewCapacity, getRepairDiscount } from '../entities/Player';
import { SeededRandom } from '../utils/SeededRandom';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { getChatterSystem } from '../systems/ChatterSystem';
import { TRADE_GOODS, TRADE_PREFIXES, ECONOMY_MODIFIERS, TradeGood } from '../data/trade';
import { RUIN_LOOT, ARTEFACT_PRICE_MULTIPLIERS } from '../data/ruins';
import { NPC_ROLES, CREW_ROLES } from '../data/characters';
import { saveGame } from '../utils/SaveSystem';
import { CharacterGenerator } from '../generation/CharacterGenerator';
import { StationNPC, CrewMember } from '../entities/Character';
import { PortraitRenderer } from '../ui/PortraitRenderer';

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
  private npcs: StationNPC[] = [];
  private hirelings: CrewMember[] = [];
  private selectedIndex = 0;
  private mode: 'menu' | 'market' | 'refuel' | 'repair' | 'recruitment' | 'artefacts' = 'menu';

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
    this.npcs = CharacterGenerator.generateStationNPCs(this.state.player.currentSystemId, this.station.name, this.state.seed);
    this.generateHirelings();

    const frame = getFrameManager();
    frame.enterGameplay(`Station: ${this.station.name}`);
    frame.setThemeFromShip(this.state.player.ship);
    frame.setNav([
      { id: 'station', label: 'Station', active: true },
      { id: 'ship', label: 'Ship' },
      { id: 'terminal', label: 'Terminal' },
      { id: 'undock', label: 'Undock', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'undock') this.undock();
      if (id === 'ship') this.scene.start('ShipInteriorScene', { returnScene: 'StationScene', stationData: this.station });
      if (id === 'terminal') this.scene.start('TerminalScene', { returnScene: 'StationScene', stationData: this.station });
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
    this.input.keyboard!.on('keydown-V', () => { if (this.mode === 'artefacts') this.sellArtefact(); else this.trySell(); });
    this.input.keyboard!.on('keydown-R', () => this.handleR());

    getChatterSystem().attach(this);
  }

  shutdown(): void {
    getFrameManager().hideCenterOverlay();
    getChatterSystem().stop();
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

  private generateHirelings(): void {
    const system = this.state.getCurrentSystem();
    const rng = new SeededRandom(system.id * 888 + this.state.seed);
    const hasRecruiter = this.npcs.some(n => n.role === 'recruiter');
    const count = hasRecruiter ? rng.int(2, 3) : rng.int(0, 1);
    
    this.hirelings = [];
    for (let i = 0; i < count; i++) {
      this.hirelings.push(CharacterGenerator.generateCrewMember(rng.fork(i), this.station.factionIndex));
    }
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
    } else if (this.mode === 'recruitment') {
      html += this.renderRecruitment();
    } else if (this.mode === 'artefacts') {
      html += this.renderArtefacts();
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
    const services = [
      { id: 'market', label: 'Trade Goods', desc: 'Buy and sell commodities', npc: this.npcs.find(n => n.role === 'merchant') },
      { id: 'refuel', label: 'Refuel Ship', desc: 'Replenish fuel reserves', npc: this.npcs.find(n => n.role === 'bartender' || n.role === 'merchant') },
      { id: 'repair', label: 'Repair Hull', desc: 'Fix structural damage', npc: this.npcs.find(n => n.role === 'mechanic') },
      { id: 'artefacts', label: 'Artefact Dealer', desc: 'Sell ancient relics and artefacts', npc: this.npcs.find(n => n.role === 'fence') },
    ];

    const recruiter = this.npcs.find(n => n.role === 'recruiter');
    if (recruiter || this.hirelings.length > 0) {
      services.push({ id: 'recruitment', label: 'Recruitment', desc: 'Hire new crew members', npc: recruiter });
    }

    const items = [
      ...services,
      { id: 'save', label: 'Save & Exit', desc: 'Save progress and return to title', npc: undefined },
      { id: 'undock', label: 'Undock', desc: 'Return to system space', npc: undefined },
    ];

    let html = `<div class="center-section-title">Station Services</div>`;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sel = i === this.selectedIndex ? ' selected' : '';
      html += `<div class="menu-item${sel}" data-menu-idx="${i}">`;
      
      html += `<div style="display:flex; align-items:center;">`;
      if (item.npc) {
        html += `<div style="margin-right:10px; border:1px solid var(--frame-border); background:rgba(0,0,0,0.3)">`;
        html += PortraitRenderer.renderPortrait(item.npc.portraitSeed, 48);
        html += `</div>`;
      }
      
      html += `<div>`;
      html += `<div class="menu-label">${sel ? '&#9654; ' : ''}${item.label}</div>`;
      if (item.npc) {
        html += `<div class="menu-npc-name" style="font-size:10px; color:var(--frame-text-good)">${item.npc.name} (${item.npc.role})</div>`;
      }
      html += `<div class="menu-desc">${item.desc}</div>`;
      html += `</div>`;
      
      html += `</div>`;
      html += `</div>`;
    }
    html += `<div class="controls-hint">UP/DOWN to navigate &bull; ENTER to select</div>`;
    return html;
  }

  private renderRecruitment(): string {
    let html = `<div class="center-section-title">Crew Recruitment</div>`;
    
    if (this.hirelings.length === 0) {
      html += `<div class="service-panel"><div class="row">No candidates available at this time.</div></div>`;
    } else {
      const capacity = getCrewCapacity(this.state.player.ship);
      const currentCrew = (this.state.player.crew || []).length;
      
      html += `<div class="crew-capacity-info" style="margin-bottom:10px; font-size:12px;">Ship Capacity: ${currentCrew} / ${capacity}</div>`;

      for (let i = 0; i < this.hirelings.length; i++) {
        const c = this.hirelings[i];
        const sel = i === this.selectedIndex ? ' selected' : '';
        const canAfford = this.state.player.credits >= 500; // Sign-on bonus
        
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
          html += `<div class="action-btn" style="margin-top:10px; background:var(--frame-bg-active); padding:4px; font-size:10px; text-align:center;">[ENTER] HIRE</div>`;
        }
        html += `</div>`;

        html += `</div>`;
      }
    }
    
    html += `<div class="controls-hint">UP/DOWN to select &bull; ENTER to hire &bull; ESC back</div>`;
    return html;
  }

  private renderMarket(): string {
    let html = `<div class="center-section-title">Trade Market</div>`;
    html += `<table class="market-table">`;
    html += `<tr><th>Good</th><th class="right">Buy</th><th class="right">Sell</th><th class="right">Stock</th><th class="right">Owned</th><th></th></tr>`;

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
    const discount = getRepairDiscount(this.state.player.crew || []);
    const baseCost = Math.ceil(dmg * 2);
    const cost = Math.ceil(dmg * 2 * discount);
    const canAfford = this.state.player.credits >= cost;
    const hasDiscount = discount < 1;

    let html = `<div class="center-section-title">Repair Hull</div>`;
    html += `<div class="service-panel">`;
    html += `<div class="row"><span class="label">Current Hull</span><span class="value">${Math.floor(ship.hull.current)} / ${ship.hull.max}</span></div>`;
    html += `<div class="row"><span class="label">Damage</span><span class="value">${Math.ceil(dmg)}</span></div>`;
    if (hasDiscount) {
      html += `<div class="row"><span class="label">Base Cost</span><span class="value" style="text-decoration:line-through;opacity:0.5">${baseCost} CR</span></div>`;
      html += `<div class="row"><span class="label">Engineer Discount</span><span class="value good">-${Math.round((1 - discount) * 100)}%</span></div>`;
    }
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

    // Hireling clicks
    el.querySelectorAll('.menu-item[data-hire-idx]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt((item as HTMLElement).dataset.hireIdx!, 10);
        this.selectedIndex = idx;
        getAudioManager().playSfx('ui_confirm');
        this.tryHire(this.hirelings[idx]);
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

    // Market buy buttons
    el.querySelectorAll('button[data-buy-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.buyIdx!, 10);
        this.selectedIndex = idx;
        this.tryBuy();
      });
    });

    // Market sell buttons
    el.querySelectorAll('button[data-sell-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((btn as HTMLElement).dataset.sellIdx!, 10);
        this.selectedIndex = idx;
        this.trySell();
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

    // Artefact row click to select
    el.querySelectorAll('[data-artefact-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt((row as HTMLElement).dataset.artefactIdx!, 10);
        this.selectedIndex = idx;
        this.renderCenter();
      });
    });
  }

  // ─── NAVIGATION ─────────────────────────────────────────

  private navigate(dir: number): void {
    let max = 5;
    if (this.mode === 'menu') {
      const recruiter = this.npcs.find(n => n.role === 'recruiter');
      // menu items: market, refuel, repair, artefacts, [recruitment], save, undock
      max = (recruiter || this.hirelings.length > 0) ? 7 : 6;
    }
    if (this.mode === 'market') max = this.market.length;
    if (this.mode === 'artefacts') max = this.getArtefactCargo().length;
    if (this.mode === 'recruitment') max = this.hirelings.length;
    if (max === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + max) % max;
    getAudioManager().playSfx('ui_navigate');
    this.renderCenter();
  }

  private select(): void {
    getAudioManager().playSfx('ui_confirm');
    if (this.mode === 'menu') {
      const recruiter = this.npcs.find(n => n.role === 'recruiter');
      const hasRecruitOption = (recruiter || this.hirelings.length > 0);
      
      // Build ordered list of service IDs matching renderMenu order
      const menuIds = ['market', 'refuel', 'repair', 'artefacts'];
      if (hasRecruitOption) menuIds.push('recruitment');
      menuIds.push('save', 'undock');

      const selectedId = menuIds[this.selectedIndex];
      switch (selectedId) {
        case 'market': this.mode = 'market'; this.selectedIndex = 0; break;
        case 'refuel': this.mode = 'refuel'; break;
        case 'repair': this.mode = 'repair'; this.selectedIndex = 0; this.repairHull(); return;
        case 'artefacts': this.mode = 'artefacts'; this.selectedIndex = 0; break;
        case 'recruitment': this.mode = 'recruitment'; this.selectedIndex = 0; break;
        case 'save': 
          saveGame(this.state);
          this.scene.start('TitleScene');
          return;
        case 'undock': this.undock(); return;
      }
    } else if (this.mode === 'market') {
      this.tryBuy();
    } else if (this.mode === 'artefacts') {
      this.sellArtefact();
    } else if (this.mode === 'repair') {
      this.repairHull();
      return;
    } else if (this.mode === 'recruitment') {
      if (this.hirelings[this.selectedIndex]) {
        this.tryHire(this.hirelings[this.selectedIndex]);
      }
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
    const discount = getRepairDiscount(this.state.player.crew || []);
    const cost = Math.ceil(dmg * 2 * discount);
    if (this.state.player.credits < cost) return;

    this.state.player.credits -= cost;
    ship.hull.current = ship.hull.max;
    getAudioManager().playSfx('repair');
    this.renderCenter();
  }

  private tryHire(candidate: CrewMember): void {
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
    this.hirelings = this.hirelings.filter(h => h.id !== candidate.id);

    getFrameManager().showAlert(`${candidate.name} joined the crew!`, 'info');
    getAudioManager().playSfx('ui_confirm');
    
    if (this.hirelings.length === 0) {
      this.mode = 'menu';
      this.selectedIndex = 0;
    } else {
      this.selectedIndex = Math.min(this.selectedIndex, this.hirelings.length - 1);
    }
    this.renderCenter();
  }

  // ─── ARTEFACT HELPERS ──────────────────────────────────

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

  private renderArtefacts(): string {
    let html = `<div class="center-section-title">Artefact Dealer</div>`;
    const artefacts = this.getArtefactCargo();

    if (artefacts.length === 0) {
      html += `<div class="service-panel"><div class="row">You have no artefacts to sell. Explore ruins to find ancient relics!</div></div>`;
    } else {
      html += `<div class="market-table">`;
      html += `<div class="market-header"><span class="col-name">Artefact</span><span class="col-rarity">Rarity</span><span class="col-price">Price</span><span class="col-qty">Qty</span><span class="col-action"></span></div>`;
      for (let i = 0; i < artefacts.length; i++) {
        const a = artefacts[i];
        const sel = i === this.selectedIndex ? ' selected' : '';
        const rarityClass = a.loot.rarity === 'rare' ? 'good' : a.loot.rarity === 'uncommon' ? 'warn' : '';
        html += `<div class="market-row${sel}" data-artefact-idx="${i}">`;
        html += `<span class="col-name">${a.loot.name}</span>`;
        html += `<span class="col-rarity ${rarityClass}">${a.loot.rarity}</span>`;
        html += `<span class="col-price good">${a.sellPrice} CR</span>`;
        html += `<span class="col-qty">x${a.item.quantity}</span>`;
        html += `<span class="col-action"><button class="sell-btn" data-artefact-sell="${i}">Sell [V]</button></span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `<div class="controls-hint">UP/DOWN to navigate &bull; V to sell &bull; ESC to go back</div>`;
    return html;
  }

  private sellArtefact(): void {
    if (this.mode !== 'artefacts') return;
    const artefacts = this.getArtefactCargo();
    const entry = artefacts[this.selectedIndex];
    if (!entry) return;

    this.state.player.credits += entry.sellPrice;
    entry.item.quantity--;
    getAudioManager().playSfx('trade_sell');

    if (entry.item.quantity <= 0) {
      this.state.player.cargo = this.state.player.cargo.filter(c => c.quantity > 0);
    }

    // Adjust selected index if list shrunk
    const newArtefacts = this.getArtefactCargo();
    if (this.selectedIndex >= newArtefacts.length) {
      this.selectedIndex = Math.max(0, newArtefacts.length - 1);
    }

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
