import Phaser from 'phaser';
import { CONFIG } from '../config';
import {
  CAVE_MAP,
  PLAYER_SPAWN_TILE,
  TileType,
  tileToWorldCenter,
} from '../data/caveMap';
import {
  MovementInput,
  PlayerMovementState,
  stepPlayerMovement,
} from '../logic/movement';
import { STRINGS } from '../strings';

interface CaveKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
  SHIFT: Phaser.Input.Keyboard.Key;
  F3: Phaser.Input.Keyboard.Key;
}

export class CaveScene extends Phaser.Scene {
  private playerState!: PlayerMovementState;
  private playerShape!: Phaser.GameObjects.Container;
  private keys?: CaveKeys;
  private debugVisible = false;
  private debugContainer!: Phaser.GameObjects.Container;
  private debugText!: Phaser.GameObjects.Text;
  private windowKeyHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super({ key: 'CaveScene' });
  }

  create(): void {
    const worldWidth = CONFIG.MAP_COLS * CONFIG.TILE_SIZE;
    const worldHeight = CONFIG.MAP_ROWS * CONFIG.TILE_SIZE;

    // 1. Render procedural cave map
    this.renderCaveMap();

    // 2. Initialize player state at entrance spawn tile
    const spawnPos = tileToWorldCenter(PLAYER_SPAWN_TILE);
    this.playerState = {
      x: spawnPos.x,
      y: spawnPos.y,
      vx: 0,
      vy: 0,
      speed: 0,
      facingAngle: 0,
      isMoving: false,
      isRunning: false,
    };

    // 3. Create player visual shape (simple circle + direction indicator)
    this.playerShape = this.createPlayerVisual(
      this.playerState.x,
      this.playerState.y
    );

    // 4. Configure smooth bounded camera following player
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(
      this.playerShape,
      true,
      CONFIG.CAMERA_LERP,
      CONFIG.CAMERA_LERP
    );

    // 5. Setup keyboard controls (WASD, Arrows, Shift, F3)
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        F3: Phaser.Input.Keyboard.KeyCodes.F3,
      }) as CaveKeys;
    }

    // Prevent browser default Find-in-Page on F3 and toggle debug overlay reliably
    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F3' || e.code === 'F3') {
        e.preventDefault();
        this.toggleDebugOverlay();
      }
    };
    window.addEventListener('keydown', this.windowKeyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.windowKeyHandler) {
        window.removeEventListener('keydown', this.windowKeyHandler);
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      if (this.windowKeyHandler) {
        window.removeEventListener('keydown', this.windowKeyHandler);
      }
    });

    // 6. Create F3 debug overlay (hidden by default)
    this.createDebugOverlay();
  }

  update(_time: number, deltaMs: number): void {
    const input = this.readMovementInput();
    const deltaSeconds = deltaMs / 1000;

    this.playerState = stepPlayerMovement(
      this.playerState,
      input,
      deltaSeconds,
      CAVE_MAP
    );

    this.playerShape.setPosition(this.playerState.x, this.playerState.y);
    this.playerShape.setRotation(this.playerState.facingAngle);

    if (this.debugVisible) {
      this.updateDebugOverlay();
    }
  }

  private readMovementInput(): MovementInput {
    if (!this.keys) {
      return { up: false, down: false, left: false, right: false, run: false };
    }

    return {
      up: this.keys.W.isDown || this.keys.UP.isDown,
      down: this.keys.S.isDown || this.keys.DOWN.isDown,
      left: this.keys.A.isDown || this.keys.LEFT.isDown,
      right: this.keys.D.isDown || this.keys.RIGHT.isDown,
      run: this.keys.SHIFT.isDown,
    };
  }

  private renderCaveMap(): void {
    const g = this.add.graphics();
    const ts = CONFIG.TILE_SIZE;

    for (let row = 0; row < CONFIG.MAP_ROWS; row++) {
      for (let col = 0; col < CONFIG.MAP_COLS; col++) {
        const tile = CAVE_MAP[row][col];
        const x = col * ts;
        const y = row * ts;

        if (tile === TileType.WALL) {
          // Base dark stone wall
          g.fillStyle(CONFIG.COLORS.WALL_BASE, 1);
          g.fillRect(x, y, ts, ts);

          // Procedural stone bevel highlight on top/left if adjacent to floor
          g.fillStyle(CONFIG.COLORS.WALL_HIGHLIGHT, 1);
          g.fillRect(x + 2, y + 2, ts - 4, ts - 4);

          // Subtle grid rock seam
          g.lineStyle(1, CONFIG.COLORS.WALL_BORDER, 0.85);
          g.strokeRect(x, y, ts, ts);
        } else if (tile === TileType.ENTRANCE) {
          // Cave entrance floor with subtle mossy daylight tint
          g.fillStyle(CONFIG.COLORS.ENTRANCE_FLOOR, 1);
          g.fillRect(x, y, ts, ts);

          g.lineStyle(1, CONFIG.COLORS.ENTRANCE_ACCENT, 0.35);
          g.strokeRect(x, y, ts, ts);
        } else {
          // Walkable cave floor with alternating subtle stone variation
          const isAlt = (row + col) % 2 === 0;
          g.fillStyle(
            isAlt ? CONFIG.COLORS.FLOOR_BASE : CONFIG.COLORS.FLOOR_ALT,
            1
          );
          g.fillRect(x, y, ts, ts);

          // Deterministic pebble/speck detail
          if ((row * 13 + col * 7) % 5 === 0) {
            g.fillStyle(CONFIG.COLORS.FLOOR_SPECK, 0.6);
            g.fillRect(x + 8, y + 10, 3, 3);
          } else if ((row * 17 + col * 11) % 7 === 0) {
            g.fillStyle(CONFIG.COLORS.FLOOR_SPECK, 0.5);
            g.fillRect(x + 20, y + 22, 2, 2);
          }
        }
      }
    }
  }

  private createPlayerVisual(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const r = CONFIG.PLAYER_RADIUS;

    // Outer stroke & circular explorer body
    g.lineStyle(2, CONFIG.COLORS.PLAYER_STROKE, 1);
    g.fillStyle(CONFIG.COLORS.PLAYER_FILL, 1);
    g.fillCircle(0, 0, r);
    g.strokeCircle(0, 0, r);

    // Direction pointer line showing facing direction
    g.lineStyle(2.5, CONFIG.COLORS.PLAYER_DIRECTION, 1);
    g.beginPath();
    g.moveTo(2, 0);
    g.lineTo(r + 2, 0);
    g.strokePath();

    const container = this.add.container(x, y, [g]);
    container.setDepth(10);
    return container;
  }

  private createDebugOverlay(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x090b0e, 0.85);
    bg.lineStyle(1, 0x334155, 1);
    bg.fillRoundedRect(0, 0, 260, 108, 6);
    bg.strokeRoundedRect(0, 0, 260, 108, 6);

    this.debugText = this.add.text(12, 10, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      lineSpacing: 5,
    });

    this.debugContainer = this.add.container(12, 12, [bg, this.debugText]);
    this.debugContainer.setScrollFactor(0);
    this.debugContainer.setDepth(100);
    this.debugContainer.setVisible(this.debugVisible);
  }

  private toggleDebugOverlay(): void {
    this.debugVisible = !this.debugVisible;
    if (this.debugContainer) {
      this.debugContainer.setVisible(this.debugVisible);
      if (this.debugVisible) {
        this.updateDebugOverlay();
      }
    }
  }

  private updateDebugOverlay(): void {
    const fps = Math.round(this.game.loop.actualFps);
    const pxX = this.playerState.x.toFixed(1);
    const pxY = this.playerState.y.toFixed(1);
    const tileCol = Math.floor(this.playerState.x / CONFIG.TILE_SIZE);
    const tileRow = Math.floor(this.playerState.y / CONFIG.TILE_SIZE);
    const speed = Math.round(this.playerState.speed);
    const moveLabel = !this.playerState.isMoving
      ? STRINGS.DEBUG_STATE_IDLE
      : this.playerState.isRunning
        ? STRINGS.DEBUG_STATE_RUN
        : STRINGS.DEBUG_STATE_WALK;

    this.debugText.setText([
      STRINGS.DEBUG_TITLE,
      `${STRINGS.DEBUG_FPS}: ${fps}`,
      `${STRINGS.DEBUG_POS_PX}: X=${pxX}, Y=${pxY}`,
      `${STRINGS.DEBUG_POS_TILE}: (${tileCol}, ${tileRow})`,
      `${STRINGS.DEBUG_SPEED}: ${speed} px/s (${moveLabel})`,
    ]);
  }
}
