/**
 * Centralized tunable configuration for HANG SÂU (3D First-Person).
 */
export const CONFIG = {
  // Map & World scale (1 tile = 2.0 metres)
  TILE_SIZE: 2.0,
  MAP_COLS: 60,
  MAP_ROWS: 40,

  // Cave vertical dimensions (metres)
  CEILING_HEIGHT: 2.8,
  CORRIDOR_CEILING_HEIGHT: 2.0,
  EYE_HEIGHT: 1.6,

  // First-person camera parameters
  DEFAULT_FOV: 72,
  MIN_FOV: 60,
  MAX_FOV: 90,
  CAMERA_NEAR: 0.08,
  CAMERA_FAR: 24.0,

  // Mouse look & comfort settings
  DEFAULT_MOUSE_SENSITIVITY: 1.0,
  MIN_MOUSE_SENSITIVITY: 0.2,
  MAX_MOUSE_SENSITIVITY: 3.0,
  MOUSE_SENSITIVITY_STEP: 0.1,
  BASE_LOOK_RAD_PER_PX: 0.0022,
  MAX_PITCH_RAD: Math.PI / 2 - 0.08,

  // Head-bob parameters
  DEFAULT_HEAD_BOB: true,
  HEAD_BOB_WALK_FREQ: 7.5,
  HEAD_BOB_RUN_FREQ: 11.5,
  HEAD_BOB_WALK_AMP_Y: 0.035,
  HEAD_BOB_RUN_AMP_Y: 0.065,
  HEAD_BOB_AMP_X: 0.018,
  HEAD_BOB_SMOOTHING: 10.0,

  // Player movement speeds (m/s)
  WALK_SPEED: 1.8,
  RUN_SPEED: 3.2,

  // Player collision radius & anti-tunneling sub-step (metres)
  PLAYER_RADIUS: 0.3,
  MAX_DELTA_SEC: 0.1,
  MAX_STEP_DISTANCE: 0.08,

  // Atmosphere: Cold dark fog & dim ambient lighting only (no flame yet)
  FOG_COLOR: 0x06090e,
  FOG_DENSITY: 0.19,
  AMBIENT_LIGHT_COLOR: 0x2a3748,
  AMBIENT_LIGHT_INTENSITY: 1.4,
  HEMI_SKY_COLOR: 0x435770,
  HEMI_GROUND_COLOR: 0x121821,
  HEMI_LIGHT_INTENSITY: 1.75,

  // Desaturated cold low-poly palette
  COLORS: {
    BACKGROUND: 0x06090e,
    WALL_BASE: 0x262f3d,
    WALL_VARIATION: 0.06,
    FLOOR_BASE: 0x1d242f,
    FLOOR_ENTRANCE: 0x273536,
    FLOOR_VARIATION: 0.05,
    CEILING_BASE: 0x161c26,
    CEILING_VARIATION: 0.05,
    PROP_ROCK_BASE: 0x2c3646,
    PROP_ROCK_TIP: 0x3b485c,
  },
} as const;

export interface ComfortSettings {
  mouseSensitivity: number;
  fov: number;
  headBob: boolean;
}
