/**
 * Centralized tunable configuration for HANG SÂU.
 */
export const CONFIG = {
  // Map & Tile dimensions
  TILE_SIZE: 32,
  MAP_COLS: 60,
  MAP_ROWS: 40,

  // Canvas viewport dimensions
  VIEWPORT_WIDTH: 960,
  VIEWPORT_HEIGHT: 640,

  // Player movement speeds (px/s)
  WALK_SPEED: 90,
  RUN_SPEED: 150,

  // Player collision & visual dimensions (px)
  // Half-size 10px = 20x20px bounding box, fitting comfortably inside 32px narrow corridors
  PLAYER_HALF_SIZE: 10,
  PLAYER_RADIUS: 10,

  // Collision sub-stepping to prevent tunneling through walls
  MAX_DELTA_SEC: 0.1,
  MAX_STEP_DISTANCE: 4,

  // Camera behavior
  CAMERA_LERP: 0.12,

  // Procedural colors
  COLORS: {
    BACKGROUND: 0x0c0d10,
    WALL_BASE: 0x1c1f26,
    WALL_HIGHLIGHT: 0x282c37,
    WALL_BORDER: 0x12141a,
    FLOOR_BASE: 0x323640,
    FLOOR_ALT: 0x2e323b,
    FLOOR_SPECK: 0x3d424f,
    ENTRANCE_FLOOR: 0x3b4842,
    ENTRANCE_ACCENT: 0x526b5c,
    PLAYER_FILL: 0xe2a03f,
    PLAYER_STROKE: 0xfef3c7,
    PLAYER_DIRECTION: 0xffffff,
  },
} as const;
