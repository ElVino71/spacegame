import { ThemeId, ThemeDefinition, THEMES } from './themes';

export interface FrameNavItem {
  id: string;
  label: string;
  shortcut?: string;
  active?: boolean;
  enabled?: boolean;
}

export class FrameManager {
  private static instance: FrameManager | null = null;
  private currentTheme: ThemeId = 'retro-scifi';
  private frameEl!: HTMLElement;
  private topBarEl!: HTMLElement;
  private bottomBarEl!: HTMLElement;
  private leftPanelEl!: HTMLElement;
  private sceneTitleEl!: HTMLElement;
  private navEl!: HTMLElement;
  private alertEl!: HTMLElement;
  private statusHullEl!: HTMLElement;
  private statusFuelEl!: HTMLElement;
  private statusCargoEl!: HTMLElement;
  private statusCreditsEl!: HTMLElement;
  private centerOverlayEl!: HTMLElement;
  private chatterWindowEl!: HTMLElement;
  private modalOverlayEl!: HTMLElement;
  private cornerEls: HTMLElement[] = [];
  private edgeEls!: HTMLElement[];
  private initialized = false;

  static getInstance(): FrameManager {
    if (!FrameManager.instance) {
      FrameManager.instance = new FrameManager();
    }
    return FrameManager.instance;
  }

  init(): void {
    if (this.initialized) return;
    this.buildDOM();
    this.applyTheme(this.currentTheme);
    this.initialized = true;
  }

  private buildDOM(): void {
    // Create the frame wrapper
    this.frameEl = document.createElement('div');
    this.frameEl.id = 'game-frame';
    this.frameEl.innerHTML = `
      <!-- Corner decorations -->
      <div class="frame-corner frame-corner-tl"></div>
      <div class="frame-corner frame-corner-tr"></div>
      <div class="frame-corner frame-corner-bl"></div>
      <div class="frame-corner frame-corner-br"></div>

      <!-- Edge decorations -->
      <div class="frame-edge frame-edge-top"></div>
      <div class="frame-edge frame-edge-bottom"></div>
      <div class="frame-edge frame-edge-left"></div>
      <div class="frame-edge frame-edge-right"></div>

      <!-- Top bar -->
      <div class="frame-top-bar">
        <div class="frame-scene-title"></div>
        <div class="frame-nav"></div>
        <div class="frame-alert"></div>
      </div>

      <!-- Bottom bar -->
      <div class="frame-bottom-bar">
        <div class="frame-status-item">
          <span class="frame-status-label">HULL</span>
          <div class="frame-status-bar"><div class="frame-status-fill hull-fill"></div></div>
          <span class="frame-status-value hull-value">--</span>
        </div>
        <div class="frame-status-item">
          <span class="frame-status-label">FUEL</span>
          <div class="frame-status-bar"><div class="frame-status-fill fuel-fill"></div></div>
          <span class="frame-status-value fuel-value">--</span>
        </div>
        <div class="frame-status-item">
          <span class="frame-status-label">CARGO</span>
          <div class="frame-status-bar"><div class="frame-status-fill cargo-fill"></div></div>
          <span class="frame-status-value cargo-value">--</span>
        </div>
        <div class="frame-status-divider"></div>
        <div class="frame-status-item credits-item">
          <span class="frame-status-label">CR</span>
          <span class="frame-status-value credits-value">--</span>
        </div>
      </div>

      <!-- Left panel (scene content) -->
      <div class="frame-left-panel">
        <div class="frame-panel-content"></div>
      </div>

      <!-- Center overlay (for full-screen UI like station) -->
      <div class="frame-center-overlay">
        <div class="frame-center-content"></div>
      </div>

      <!-- Canvas container -->
      <div class="frame-canvas-area"></div>

      <!-- Chatter Window (Bottom Right) -->
      <div class="frame-chatter-window"></div>

      <!-- Modal overlay for lore/messages that need dismissal -->
      <div class="frame-modal-overlay">
        <div class="frame-modal">
          <div class="frame-modal-title"></div>
          <div class="frame-modal-body"></div>
          <div class="frame-modal-hint">Press SPACE to close</div>
        </div>
      </div>
    `;

    document.body.appendChild(this.frameEl);

    // Cache references
    this.topBarEl = this.frameEl.querySelector('.frame-top-bar')!;
    this.bottomBarEl = this.frameEl.querySelector('.frame-bottom-bar')!;
    this.leftPanelEl = this.frameEl.querySelector('.frame-left-panel')!;
    this.sceneTitleEl = this.frameEl.querySelector('.frame-scene-title')!;
    this.navEl = this.frameEl.querySelector('.frame-nav')!;
    this.alertEl = this.frameEl.querySelector('.frame-alert')!;
    this.statusHullEl = this.frameEl.querySelector('.hull-fill')!;
    this.statusFuelEl = this.frameEl.querySelector('.fuel-fill')!;
    this.statusCargoEl = this.frameEl.querySelector('.cargo-fill')!;
    this.statusCreditsEl = this.frameEl.querySelector('.credits-value')!;
    this.centerOverlayEl = this.frameEl.querySelector('.frame-center-overlay')!;
    this.chatterWindowEl = this.frameEl.querySelector('.frame-chatter-window')!;
    this.modalOverlayEl = this.frameEl.querySelector('.frame-modal-overlay')!;
    this.cornerEls = Array.from(this.frameEl.querySelectorAll('.frame-corner'));
    this.edgeEls = Array.from(this.frameEl.querySelectorAll('.frame-edge'));

    // Move the Phaser canvas into the frame
    const canvas = document.querySelector('canvas');
    if (canvas) {
      this.frameEl.querySelector('.frame-canvas-area')!.appendChild(canvas);
    }
  }

  // --- Theme ---

  applyTheme(themeId: ThemeId): void {
    this.currentTheme = themeId;
    const theme = THEMES[themeId];
    const root = document.documentElement;

    // Remove old theme class, add new
    document.body.className = '';
    document.body.classList.add(`theme-${themeId}`);

    // Set CSS custom properties
    root.style.setProperty('--frame-bg-primary', theme.bgPrimary);
    root.style.setProperty('--frame-bg-secondary', theme.bgSecondary);
    root.style.setProperty('--frame-border-color', theme.borderColor);
    root.style.setProperty('--frame-border-glow', theme.borderGlow);
    root.style.setProperty('--frame-accent-primary', theme.accentPrimary);
    root.style.setProperty('--frame-accent-secondary', theme.accentSecondary);
    root.style.setProperty('--frame-text-primary', theme.textPrimary);
    root.style.setProperty('--frame-text-secondary', theme.textSecondary);
    root.style.setProperty('--frame-text-muted', theme.textMuted);
    root.style.setProperty('--frame-good', theme.good);
    root.style.setProperty('--frame-warn', theme.warn);
    root.style.setProperty('--frame-bad', theme.bad);
    root.style.setProperty('--frame-bar-hull', theme.barHull);
    root.style.setProperty('--frame-bar-fuel', theme.barFuel);
    root.style.setProperty('--frame-bar-cargo', theme.barCargo);
    root.style.setProperty('--frame-border-width', theme.borderWidth);
    root.style.setProperty('--frame-border-style', theme.borderStyle);
    root.style.setProperty('--frame-corner-radius', theme.cornerRadius);
    root.style.setProperty('--frame-font-primary', theme.fontPrimary);
    root.style.setProperty('--frame-font-heading', theme.fontHeading);
    root.style.setProperty('--frame-glow-intensity', theme.glowIntensity);
    root.style.setProperty('--frame-scanline-opacity', theme.scanlineOpacity);
    root.style.setProperty('--frame-animation-speed', theme.animationSpeed);

    // Set tile-based border images
    this.applyFrameTiles(themeId);
  }

  private applyFrameTiles(themeId: ThemeId): void {
    const basePath = `assets/tiles/frame/${themeId}`;
    const cornerUrl = `url('${basePath}/corner_tl.png')`;
    const edgeHUrl = `url('${basePath}/edge_h.png')`;
    const edgeVUrl = `url('${basePath}/edge_v.png')`;

    for (const el of this.cornerEls) {
      el.style.backgroundImage = cornerUrl;
      el.style.backgroundSize = '96px 96px';
    }
    for (const el of this.edgeEls) {
      if (el.classList.contains('frame-edge-top') || el.classList.contains('frame-edge-bottom')) {
        el.style.backgroundImage = edgeHUrl;
        el.style.backgroundSize = '768px 96px';
      } else {
        el.style.backgroundImage = edgeVUrl;
        el.style.backgroundSize = '96px 768px';
      }
    }
  }

  getTheme(): ThemeDefinition {
    return THEMES[this.currentTheme];
  }

  getThemeId(): ThemeId {
    return this.currentTheme;
  }

  setThemeFromShip(ship: { theme: ThemeId }): void {
    this.applyTheme(ship.theme);
  }

  cycleTheme(): ThemeId {
    const ids = Object.keys(THEMES) as ThemeId[];
    const idx = ids.indexOf(this.currentTheme);
    const next = ids[(idx + 1) % ids.length];
    this.applyTheme(next);
    return next;
  }

  // --- Scene Title ---

  setSceneTitle(title: string): void {
    this.sceneTitleEl.textContent = title;
  }

  // --- Navigation ---

  setNav(items: FrameNavItem[], onClick?: (id: string) => void): void {
    this.navEl.innerHTML = items.map(item => {
      const classes = [
        'frame-nav-item',
        item.active ? 'active' : '',
        item.enabled === false ? 'disabled' : '',
      ].filter(Boolean).join(' ');
      const shortcut = item.shortcut ? `<span class="frame-nav-shortcut">[${item.shortcut}]</span>` : '';
      return `<div class="${classes}" data-nav-id="${item.id}">${item.label}${shortcut}</div>`;
    }).join('');

    if (onClick) {
      this.navEl.querySelectorAll('.frame-nav-item:not(.disabled)').forEach(el => {
        el.addEventListener('click', () => {
          const id = (el as HTMLElement).dataset.navId!;
          onClick(id);
        });
      });
    }
  }

  clearNav(): void {
    this.navEl.innerHTML = '';
  }

  // --- Alert ---

  showAlert(text: string, type: 'info' | 'warn' | 'danger' = 'info', durationMs: number = 3000): void {
    this.alertEl.textContent = text;
    this.alertEl.className = `frame-alert frame-alert-${type}`;
    this.alertEl.classList.add('visible');
    setTimeout(() => this.alertEl.classList.remove('visible'), durationMs);
  }

  clearAlert(): void {
    this.alertEl.classList.remove('visible');
    this.alertEl.textContent = '';
  }

  // --- Modal (dismissible popup) ---

  showModal(title: string, body: string, hint: string = 'Press SPACE to close'): void {
    this.modalOverlayEl.querySelector('.frame-modal-title')!.textContent = title;
    this.modalOverlayEl.querySelector('.frame-modal-body')!.textContent = body;
    this.modalOverlayEl.querySelector('.frame-modal-hint')!.textContent = hint;
    this.modalOverlayEl.classList.add('visible');
  }

  hideModal(): void {
    this.modalOverlayEl.classList.remove('visible');
  }

  isModalVisible(): boolean {
    return this.modalOverlayEl.classList.contains('visible');
  }

  // --- Bottom Bar Status ---

  updateStatus(hull: { current: number; max: number }, fuel: { current: number; max: number }, cargoUsed: number, cargoMax: number, credits: number): void {
    const hullPct = Math.round((hull.current / hull.max) * 100);
    const fuelPct = Math.round((fuel.current / fuel.max) * 100);
    const cargoPct = cargoMax > 0 ? Math.round((cargoUsed / cargoMax) * 100) : 0;

    this.statusHullEl.style.width = hullPct + '%';
    this.statusHullEl.className = 'frame-status-fill hull-fill' +
      (hullPct < 25 ? ' critical' : hullPct < 50 ? ' low' : '');

    this.statusFuelEl.style.width = fuelPct + '%';
    this.statusFuelEl.className = 'frame-status-fill fuel-fill' +
      (fuelPct < 25 ? ' critical' : fuelPct < 50 ? ' low' : '');

    this.statusCargoEl.style.width = cargoPct + '%';

    // Update text values
    const hullValEl = this.frameEl.querySelector('.hull-value')!;
    const fuelValEl = this.frameEl.querySelector('.fuel-value')!;
    const cargoValEl = this.frameEl.querySelector('.cargo-value')!;
    hullValEl.textContent = `${Math.round(hull.current)}/${hull.max}`;
    fuelValEl.textContent = `${Math.round(fuel.current)}/${fuel.max}`;
    cargoValEl.textContent = `${cargoUsed}/${cargoMax}`;
    this.statusCreditsEl.textContent = credits.toLocaleString();
  }

  // --- Left Panel ---

  setPanelContent(html: string): void {
    const content = this.leftPanelEl.querySelector('.frame-panel-content')!;
    content.innerHTML = html;
  }

  getPanelContentEl(): HTMLElement {
    return this.leftPanelEl.querySelector('.frame-panel-content')!;
  }

  showPanel(width?: number): void {
    this.leftPanelEl.classList.add('visible');
    if (width) {
      this.leftPanelEl.style.width = width + 'px';
    }
  }

  hidePanel(): void {
    this.leftPanelEl.classList.remove('visible');
  }

  // --- Center Overlay ---

  setCenterContent(html: string): void {
    const content = this.centerOverlayEl.querySelector('.frame-center-content')!;
    content.innerHTML = html;
  }

  getCenterContentEl(): HTMLElement {
    return this.centerOverlayEl.querySelector('.frame-center-content')!;
  }

  showCenterOverlay(): void {
    this.centerOverlayEl.classList.add('visible');
  }

  hideCenterOverlay(): void {
    this.centerOverlayEl.classList.remove('visible');
  }

  // --- Visibility ---

  showTopBar(): void { this.topBarEl.classList.add('visible'); }
  hideTopBar(): void { this.topBarEl.classList.remove('visible'); }
  showBottomBar(): void { this.bottomBarEl.classList.add('visible'); }
  hideBottomBar(): void { this.bottomBarEl.classList.remove('visible'); }

  showFrame(): void {
    this.frameEl.classList.add('active');
  }

  hideFrame(): void {
    this.frameEl.classList.remove('active');
  }

  private chatterTypingQueue: { text: string; color?: string; el: HTMLElement }[] = [];
  private isChatterTyping = false;

  addChatter(text: string, color?: string): void {
    const lineEl = document.createElement('div');
    lineEl.className = 'chatter-line' + (color ? ` ${color}` : '');
    this.chatterWindowEl.appendChild(lineEl);

    // Keep only last 3 lines
    while (this.chatterWindowEl.children.length > 3) {
      this.chatterWindowEl.removeChild(this.chatterWindowEl.firstChild!);
    }

    this.chatterTypingQueue.push({ text, color, el: lineEl });
    if (!this.isChatterTyping) {
      this.processChatterQueue();
    }
  }

  private async processChatterQueue(): Promise<void> {
    if (this.chatterTypingQueue.length === 0) {
      this.isChatterTyping = false;
      return;
    }

    this.isChatterTyping = true;
    const { text, el } = this.chatterTypingQueue.shift()!;

    el.classList.add('chatter-cursor');
    for (let i = 0; i <= text.length; i++) {
      el.textContent = text.slice(0, i);
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    }
    el.classList.remove('chatter-cursor');

    // Wait a bit before next line if queue is empty
    if (this.chatterTypingQueue.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.processChatterQueue();
  }

  showChatter(): void { this.chatterWindowEl.classList.add('visible'); }
  hideChatter(): void { this.chatterWindowEl.classList.remove('visible'); }

  /** Show the full frame with all bars - typical for gameplay scenes */
  enterGameplay(sceneTitle: string): void {
    this.showFrame();
    this.showTopBar();
    this.showBottomBar();
    this.showChatter();
    this.hidePanel();
    this.hideCenterOverlay();
    this.setSceneTitle(sceneTitle);
  }

  /** Minimal frame - border only, no bars (for transitions, boot) */
  enterMinimal(): void {
    this.showFrame();
    this.hideTopBar();
    this.hideBottomBar();
    this.hidePanel();
    this.hideCenterOverlay();
    this.hideChatter();
  }

  // --- Canvas area access (for Phaser parent) ---

  getCanvasArea(): HTMLElement {
    return this.frameEl.querySelector('.frame-canvas-area')!;
  }
}

/** Convenience singleton accessor */
export function getFrameManager(): FrameManager {
  return FrameManager.getInstance();
}
