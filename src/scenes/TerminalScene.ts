import Phaser from 'phaser';
import { getGameState, GameState } from '../GameState';
import { COLORS, FACTION_NAMES } from '../utils/Constants';
import { getCargoCapacity, getCargoUsed, getShieldCapacity, getJumpRange, getShipSpeed } from '../entities/Player';
import { getFrameManager } from '../ui/FrameManager';
import { getAudioManager } from '../audio/AudioManager';
import { JOKES } from '../data/misc';

interface TerminalLine {
  text: string;
  color: string;
}

export class TerminalScene extends Phaser.Scene {
  private state!: GameState;
  private lines: TerminalLine[] = [];
  private inputBuffer = '';
  private outputContainer!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private cursorBlink = true;
  private maxVisibleLines = 30;
  private typingQueue: TerminalLine[] = [];
  private currentTypingLine: { text: string; color: string; index: number } | null = null;
  private typingTimer: Phaser.Time.TimerEvent | null = null;
  private isTyping = false;

  constructor() {
    super({ key: 'TerminalScene' });
  }

  create(): void {
    this.state = getGameState();
    this.cameras.main.setBackgroundColor(0x0a0a0a);

    // Setup frame — minimal with just the border, terminal fills the screen
    const frame = getFrameManager();
    frame.enterGameplay('Ship Terminal');
    frame.hidePanel();
    frame.setNav([
      { id: 'terminal', label: 'Terminal', active: true },
      { id: 'ship', label: 'Ship', shortcut: 'ESC' },
    ], (id) => {
      if (id === 'ship') this.scene.start('ShipInteriorScene');
    });

    // Update bottom bar
    const ship = this.state.player.ship;
    frame.updateStatus(
      ship.hull, ship.fuel,
      getCargoUsed(this.state.player.cargo),
      getCargoCapacity(ship),
      this.state.player.credits
    );

    // Terminal border
    const gfx = this.add.graphics();
    gfx.lineStyle(2, COLORS.ui.primary, 0.4);
    gfx.strokeRoundedRect(20, 10, 1240, 660, 8);
    gfx.fillStyle(0x0a0a12, 0.95);
    gfx.fillRoundedRect(22, 12, 1236, 656, 6);

    // Scanline effect overlay
    for (let y = 14; y < 666; y += 3) {
      gfx.fillStyle(0x000000, 0.06);
      gfx.fillRect(22, y, 1236, 1);
    }

    // Header
    this.add.text(640, 24, '[ SHIPBOARD COMPUTER - NavComp OS v3.7.1 ]', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00ff88',
    }).setOrigin(0.5, 0);

    // Output area
    this.outputContainer = this.add.text(40, 50, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#00dd77',
      wordWrap: { width: 1180 },
      lineSpacing: 4,
    });

    // Input line
    this.inputText = this.add.text(40, 640, '> ', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00ff88',
    });

    // Blinking cursor
    this.time.addEvent({
      delay: 500,
      callback: () => { this.cursorBlink = !this.cursorBlink; this.updateInput(); },
      loop: true,
    });

    // Boot message
    this.printLine('NavComp OS booting...', '#00aa55');
    this.printLine('Systems nominal. All modules online.', '#00aa55');
    this.printLine('');
    this.printLine('Type "help" for available commands.', '#00ff88');
    this.printLine('');

    // Keyboard input
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.scene.start('ShipInteriorScene');
        return;
      }
      if (event.key === 'Enter') {
        getAudioManager().playSfx('terminal_execute');
        this.executeCommand(this.inputBuffer.trim());
        this.inputBuffer = '';
      } else if (event.key === 'Backspace') {
        getAudioManager().playSfx('terminal_key');
        this.inputBuffer = this.inputBuffer.slice(0, -1);
      } else if (event.key.length === 1) {
        getAudioManager().playSfx('terminal_key');
        this.inputBuffer += event.key;
      }
      this.updateInput();
    });

    getAudioManager().setAmbience('terminal');

    this.updateOutput();
  }

  private printLine(text: string, color: string = '#00dd77'): void {
    if (text === '') {
      this.lines.push({ text: '', color });
      this.updateOutput();
      return;
    }
    this.typingQueue.push({ text, color });
    this.processTypingQueue();
  }

  private processTypingQueue(): void {
    if (this.isTyping || this.typingQueue.length === 0) return;

    this.isTyping = true;
    const nextLine = this.typingQueue.shift()!;
    this.currentTypingLine = { ...nextLine, index: 0 };
    
    // Add an empty line to 'lines' that we will fill character by character
    this.lines.push({ text: '', color: nextLine.color });

    this.typingTimer = this.time.addEvent({
      delay: 15, // 15ms per character
      callback: this.typeNextCharacter,
      callbackScope: this,
      loop: true
    });
  }

  private typeNextCharacter(): void {
    if (!this.currentTypingLine) return;

    const { text, index } = this.currentTypingLine;
    if (index < text.length) {
      // Add one character to the last line in our lines array
      this.lines[this.lines.length - 1].text += text[index];
      this.currentTypingLine.index++;
      
      // Play sound every few characters or every character? Let's try every character first.
      // Space shouldn't make sound? Maybe it should.
      if (text[index] !== ' ') {
        getAudioManager().playSfx('terminal_key');
      }

      this.updateOutput();
    } else {
      // Finished typing this line
      if (this.typingTimer) {
        this.typingTimer.destroy();
        this.typingTimer = null;
      }
      this.currentTypingLine = null;
      this.isTyping = false;
      
      // Check for more lines in queue
      this.processTypingQueue();
    }
  }

  private updateOutput(): void {
    const visible = this.lines.slice(-this.maxVisibleLines);
    this.outputContainer.setText(visible.map(l => l.text).join('\n'));
  }

  private updateInput(): void {
    const cursor = this.cursorBlink ? '_' : ' ';
    this.inputText.setText(`> ${this.inputBuffer}${cursor}`);
  }

  private executeCommand(input: string): void {
    if (!input) return;

    this.printLine(`> ${input}`, '#00ff88');

    const [cmd, ...args] = input.toLowerCase().split(' ');

    switch (cmd) {
      case 'help':
        this.cmdHelp();
        break;
      case 'status':
      case 'stat':
        this.cmdStatus();
        break;
      case 'scan':
        this.cmdScan(args);
        break;
      case 'cargo':
        this.cmdCargo();
        break;
      case 'nav':
        this.cmdNav(args);
        break;
      case 'systems':
      case 'sys':
        this.cmdSystems();
        break;
      case 'codex':
        this.cmdCodex(args);
        break;
      case 'theme':
        this.cmdTheme(args);
        break;
      case 'audio':
      case 'sound':
        this.cmdAudio(args);
        break;
      case 'clear':
      case 'cls':
        this.lines = [];
        this.typingQueue = [];
        if (this.typingTimer) {
          this.typingTimer.destroy();
          this.typingTimer = null;
        }
        this.currentTypingLine = null;
        this.isTyping = false;
        this.updateOutput();
        break;
      case 'exit':
      case 'quit':
        this.scene.start('ShipInteriorScene');
        break;
      case 'hello':
      case 'hi':
        this.printLine('Hello, Captain. How can I assist you today?');
        break;
      case 'joke':
        this.cmdJoke();
        break;
      default:
        getAudioManager().playSfx('terminal_error');
        this.printLine(`Unknown command: "${cmd}". Type "help" for available commands.`, '#ff6644');
    }

    this.printLine('');
  }

  private cmdHelp(): void {
    this.printLine('=== AVAILABLE COMMANDS ===', '#00aaff');
    this.printLine('  status   - Ship status overview');
    this.printLine('  scan     - Scan current system (scan planets / scan asteroids)');
    this.printLine('  cargo    - View cargo manifest');
    this.printLine('  nav      - Navigation info (nav routes / nav range)');
    this.printLine('  systems  - Ship module status');
    this.printLine('  codex    - Lore database (codex list / codex <id>)');
    this.printLine('  theme    - Cycle cockpit theme (theme next / theme <name>)');
    this.printLine('  audio    - Audio controls (audio mute / audio vol <0-100>)');
    this.printLine('  clear    - Clear terminal');
    this.printLine('  exit     - Exit terminal');
  }

  private cmdTheme(args: string[]): void {
    const frame = getFrameManager();
    if (!args[0] || args[0] === 'next') {
      const newTheme = frame.cycleTheme();
      this.printLine(`Cockpit theme changed to: ${newTheme}`, '#ffcc00');
    } else {
      const validThemes = ['retro-scifi', 'biological', 'steampunk', 'military', 'alien'];
      if (validThemes.includes(args[0])) {
        frame.applyTheme(args[0] as any);
        this.printLine(`Cockpit theme set to: ${args[0]}`, '#ffcc00');
      } else {
        this.printLine(`Unknown theme: "${args[0]}"`, '#ff6644');
        this.printLine(`Available: ${validThemes.join(', ')}`);
      }
    }
  }

  private cmdStatus(): void {
    const ship = this.state.player.ship;
    const system = this.state.getCurrentSystem();

    this.printLine('=== SHIP STATUS ===', '#00aaff');
    this.printLine(`  Ship:     ${ship.name} (${ship.class})`);
    this.printLine(`  Hull:     ${Math.floor(ship.hull.current)}/${ship.hull.max}`);
    this.printLine(`  Shields:  ${getShieldCapacity(ship)}`);
    this.printLine(`  Fuel:     ${Math.floor(ship.fuel.current)}/${ship.fuel.max}`);
    this.printLine(`  Speed:    ${getShipSpeed(ship)}`);
    this.printLine(`  Cargo:    ${getCargoUsed(this.state.player.cargo)}/${getCargoCapacity(ship)}`);
    this.printLine(`  Credits:  ${this.state.player.credits}`);
    this.printLine('');
    this.printLine(`  Location: ${system.name}`);
    this.printLine(`  Star:     ${system.starType}-class`);
    this.printLine(`  Faction:  ${FACTION_NAMES[system.factionIndex]}`);
  }

  private cmdScan(args: string[]): void {
    const system = this.state.getCurrentSystem();

    if (args[0] === 'planets' || !args[0]) {
      this.printLine(`=== SCAN: ${system.name} ===`, '#00aaff');
      this.printLine(`  Star: ${system.starType}-class (radius ${system.starRadius})`);
      this.printLine(`  Bodies: ${system.planets.length} planets, ${system.asteroidBelts.length} asteroid belts`);
      this.printLine('');

      for (const planet of system.planets) {
        let status = planet.landable ? 'LANDABLE' : 'NO LANDING';
        if (planet.hasRuins) status += ' | ANOMALY';
        if (planet.hasSettlement) status += ' | SETTLEMENT';
        this.printLine(`  ${planet.name}`, '#ffcc00');
        this.printLine(`    Type: ${planet.type.replace('_', ' ')} | Atmo: ${planet.atmosphere} | ${status}`);
        if (planet.minerals.length > 0) {
          this.printLine(`    Minerals: ${planet.minerals.map(m => m.type).join(', ')}`);
        }
      }

      if (system.station) {
        this.printLine('');
        this.printLine(`  Station: ${system.station.name}`, '#00aaff');
        this.printLine(`    Economy: ${system.station.economy} | Faction: ${FACTION_NAMES[system.station.factionIndex]}`);
      }
    }

    if (args[0] === 'asteroids') {
      this.printLine('=== ASTEROID SCAN ===', '#00aaff');
      if (system.asteroidBelts.length === 0) {
        this.printLine('  No asteroid belts detected.');
      }
      for (let i = 0; i < system.asteroidBelts.length; i++) {
        const belt = system.asteroidBelts[i];
        this.printLine(`  Belt ${i + 1}: density ${belt.density}, mineral richness ${(belt.mineralRichness * 100).toFixed(0)}%`);
      }
    }
  }

  private cmdCargo(): void {
    const ship = this.state.player.ship;
    const cargo = this.state.player.cargo;

    this.printLine('=== CARGO MANIFEST ===', '#00aaff');
    this.printLine(`  Capacity: ${getCargoUsed(cargo)}/${getCargoCapacity(ship)}`);

    if (cargo.length === 0) {
      this.printLine('  Cargo bay is empty.');
    } else {
      for (const item of cargo) {
        this.printLine(`  ${item.name}: ${item.quantity} (${item.value} CR/unit)`);
      }
    }
  }

  private cmdNav(args: string[]): void {
    const system = this.state.getCurrentSystem();
    const jumpRange = getJumpRange(this.state.player.ship);

    if (args[0] === 'routes' || !args[0]) {
      this.printLine('=== NAVIGATION ===', '#00aaff');
      this.printLine(`  Current: ${system.name}`);
      this.printLine(`  Jump range: ${jumpRange}`);
      this.printLine('');
      this.printLine('  Connected systems:');

      for (const connId of system.connections) {
        const conn = this.state.galaxy[connId];
        const dx = system.x - conn.x;
        const dy = system.y - conn.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const fuelCost = dist * 0.05;
        const status = conn.discovered
          ? (conn.visited ? 'VISITED' : 'CHARTED')
          : 'UNKNOWN';
        const reachable = this.state.player.ship.fuel.current >= fuelCost ? '' : ' [INSUFFICIENT FUEL]';

        this.printLine(`  - ${conn.discovered ? conn.name : '???'} (dist: ${Math.floor(dist)}, fuel: ${fuelCost.toFixed(1)}) [${status}]${reachable}`);
      }
    }

    if (args[0] === 'range') {
      this.printLine(`  Jump range: ${jumpRange}`);
      this.printLine(`  Current fuel: ${Math.floor(this.state.player.ship.fuel.current)}/${this.state.player.ship.fuel.max}`);
    }
  }

  private cmdSystems(): void {
    this.printLine('=== SHIP MODULES ===', '#00aaff');
    for (const slot of this.state.player.ship.slots) {
      if (slot.module) {
        this.printLine(`  [${slot.type.toUpperCase()}] ${slot.module.name} (T${slot.module.tier}, size ${slot.module.size}/${slot.maxSize})`);
      } else {
        this.printLine(`  [${slot.type.toUpperCase()}] EMPTY (max size ${slot.maxSize})`, '#666666');
      }
    }
  }

  private cmdCodex(args: string[]): void {
    const frags = this.state.player.loreFragments;

    if (args[0] === 'list' || !args[0]) {
      this.printLine('=== CODEX ===', '#00aaff');
      if (frags.length === 0) {
        this.printLine('  No lore fragments discovered yet.');
        this.printLine('  Explore ruins to find ancient knowledge.');
      } else {
        for (let i = 0; i < frags.length; i++) {
          this.printLine(`  [${i + 1}] ${frags[i].slice(0, 60)}...`);
        }
      }
    }
  }

  private cmdAudio(args: string[]): void {
    const audio = getAudioManager();
    if (!args[0] || args[0] === 'status') {
      this.printLine('=== AUDIO STATUS ===', '#00aaff');
      this.printLine(`  Master: ${audio.muted ? 'MUTED' : Math.round(audio.masterVolume * 100) + '%'}`);
      this.printLine(`  SFX:    ${Math.round(audio.sfxVolume * 100)}%`);
      this.printLine(`  Music:  ${Math.round(audio.musicVolume * 100)}%`);
    } else if (args[0] === 'mute') {
      const muted = audio.toggleMute();
      this.printLine(muted ? 'Audio muted.' : 'Audio unmuted.', '#ffcc00');
    } else if (args[0] === 'vol' || args[0] === 'volume') {
      const val = parseInt(args[1]);
      if (isNaN(val) || val < 0 || val > 100) {
        this.printLine('Usage: audio vol <0-100>', '#ff6644');
      } else {
        audio.masterVolume = val / 100;
        this.printLine(`Master volume set to ${val}%`, '#ffcc00');
      }
    } else if (args[0] === 'sfx') {
      const val = parseInt(args[1]);
      if (isNaN(val) || val < 0 || val > 100) {
        this.printLine('Usage: audio sfx <0-100>', '#ff6644');
      } else {
        audio.sfxVolume = val / 100;
        this.printLine(`SFX volume set to ${val}%`, '#ffcc00');
      }
    } else if (args[0] === 'music') {
      const val = parseInt(args[1]);
      if (isNaN(val) || val < 0 || val > 100) {
        this.printLine('Usage: audio music <0-100>', '#ff6644');
      } else {
        audio.musicVolume = val / 100;
        this.printLine(`Music volume set to ${val}%`, '#ffcc00');
      }
    } else {
      this.printLine('Usage: audio [status|mute|vol|sfx|music] [0-100]', '#ff6644');
    }
  }

  private cmdJoke(): void {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    this.printLine(joke, '#ffcc00');
  }
}
