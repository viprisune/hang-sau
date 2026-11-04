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
  CAMERA_FAR: 28.0,

  // Mouse look & comfort settings
  DEFAULT_MOUSE_SENSITIVITY: 1.0,
  MIN_MOUSE_SENSITIVITY: 0.2,
  MAX_MOUSE_SENSITIVITY: 3.0,
  MOUSE_SENSITIVITY_STEP: 0.1,
  BASE_LOOK_RAD_PER_PX: 0.0022,
  MAX_PITCH_RAD: Math.PI / 2 - 0.08,

  // Head-bob & camera sway parameters
  DEFAULT_HEAD_BOB: true,
  HEAD_BOB_WALK_FREQ: 7.5,
  HEAD_BOB_RUN_FREQ: 11.5,
  HEAD_BOB_WALK_AMP_Y: 0.035,
  HEAD_BOB_RUN_AMP_Y: 0.065,
  HEAD_BOB_AMP_X: 0.018,
  HEAD_BOB_SMOOTHING: 10.0,
  CAMERA_SWAY_ROLL_RAD: 0.014,
  CAMERA_SWAY_RUN_MULTIPLIER: 1.45,

  // Player movement speeds (m/s)
  WALK_SPEED: 1.8,
  RUN_SPEED: 3.2,

  // Player collision radius & anti-tunneling sub-step (metres)
  PLAYER_RADIUS: 0.45,
  MAX_DELTA_SEC: 0.1,
  MAX_STEP_DISTANCE: 0.08,

  // Renderer exposure
  TONE_MAPPING_EXPOSURE: 1.4,

  // Darkness, Fog & Ambient Light (Milestone 2: nearly black cave)
  FOG_COLOR: 0x05080d,
  FOG_DENSITY_DARK: 0.36,
  FOG_DENSITY_LIT: 0.17,
  FOG_LERP_SPEED: 3.5,
  AMBIENT_LIGHT_COLOR: 0x243246,
  AMBIENT_LIGHT_INTENSITY: 0.03,

  // Match & Candle PointLight parameters
  INITIAL_MATCHES: 5,
  MATCH_BURN_DURATION_SEC: 25.0,
  MATCH_SHRINK_WINDOW_SEC: 5.0,
  MATCH_LIGHT_COLOR: 0xffb45a,
  MATCH_REACH_FULL: 7.0,
  MATCH_REACH_MIN: 3.5,
  MATCH_LIGHT_INTENSITY: 5.0,
  MATCH_LIGHT_DECAY: 1.4,
  MATCH_FLICKER_SPEED_1: 6.7,
  MATCH_FLICKER_SPEED_2: 14.3,
  MATCH_FLICKER_SPEED_3: 27.1,
  MATCH_FLICKER_AMP: 0.18,
  MATCH_DYING_FLICKER_AMP: 0.34,
  MATCH_OFFSET_FORWARD: 0.18,
  MATCH_OFFSET_RIGHT: 0.16,
  MATCH_OFFSET_DOWN: -0.12,
  MATCH_WALL_MIN_CLEARANCE: 0.56,
  MATCH_WALL_GRAZE_LIFT_Y: 0.16,

  // Candle parameters (90 s burn, 9 m reach, can go out when wet)
  CANDLE_BURN_DURATION_SEC: 90.0,
  CANDLE_SHRINK_WINDOW_SEC: 8.0,
  CANDLE_LIGHT_COLOR: 0xffc46b,
  CANDLE_REACH_FULL: 9.0,
  CANDLE_REACH_MIN: 4.5,
  CANDLE_LIGHT_INTENSITY: 5.3,
  CANDLE_FLICKER_AMP: 0.11,
  DAMAGED_LIGHT_DURATION_FACTOR: 0.6,

  // Survival stats, rates & limits (Milestone 5)
  HEALTH_MAX: 100,
  HUNGER_MAX: 100,
  THIRST_MAX: 100,
  STAMINA_MAX: 100,
  HUNGER_DECAY_SECONDS_PER_POINT: 6.0, // -1 per 6 s (10 min for 100 -> 0)
  THIRST_DECAY_SECONDS_PER_POINT: 4.0, // -1 per 4 s
  ZERO_VITAL_STAMINA_MULTIPLIER: 0.5, // At 0 hunger or thirst: max stamina halves
  ZERO_VITAL_HEALTH_GRACE_SEC: 60.0, // Health loss starts after 60 s at 0 hunger/thirst
  ZERO_VITAL_HEALTH_LOSS_PER_SEC: 1.5,
  STAMINA_RUN_DRAIN_PER_SEC: 20.0, // Running -20/s
  STAMINA_WALK_RECOVERY_PER_SEC: 12.0, // Recovery +12/s walking
  STAMINA_IDLE_RECOVERY_PER_SEC: 25.0, // Recovery +25/s standing
  STAMINA_MIN_TO_RUN: 10.0, // Cannot run below 10
  FOOD_HUNGER_RESTORE: 45,
  FOOD_DAMAGED_RESTORE: 25,
  WATER_THIRST_RESTORE: 50,
  WATER_DAMAGED_RESTORE: 30,

  // Inventory limits & slot costs (12 slots; rope takes 2 slots)
  INVENTORY_MAX_SLOTS: 12,
  ROPE_SLOT_COST: 2,
  DEFAULT_SLOT_COST: 1,
  STACK_MAX_MATCHES: 10,
  STACK_MAX_CANDLE: 2,
  STACK_MAX_FOOD: 2,
  STACK_MAX_WATER: 1,
  STACK_MAX_ROPE: 1,
  STACK_MAX_ARTIFACT: 1,
  INITIAL_WATER_BOTTLES: 1,

  // Faint proximity glow when unlit (~1.5m reach so screen is never 100% black)
  DARK_GLOW_COLOR: 0x3b4d66,
  DARK_GLOW_REACH: 1.5,
  DARK_GLOW_INTENSITY: 0.55,
  DARK_GLOW_DECAY: 1.9,

  // Surface memory (line-of-sight per tile face, fog-exempt tint)
  MEMORY_MAX_REACH_FACTOR: 0.95,
  MEMORY_LOS_STEP_METRES: 0.12,
  REMEMBERED_COLOR_BOOST: 0.32,
  REMEMBERED_POST_FOG_FLOOR: 0.16,

  // Status message & Subtitle durations (seconds)
  STATUS_MESSAGE_DURATION_SEC: 2.2,
  SUBTITLE_DURATION_SEC: 4.2,
  SUBTITLE_GAP_SEC: 0.2,

  // Interaction & Level mechanics (Milestone 3)
  INTERACTION_RANGE: 2.0,
  PICKUP_MATCHES_COUNT: 3,
  GAP_DEPTH: 5.5,
  GAP_NARROW_ROUTE_HALF_WIDTH: 0.68,
  GAP_APPROACH_HINT_DIST: 1.4,
  DROP_ITEM_FORWARD_OFFSET: 0.65,

  // Tide System & Water Gameplay (Milestone 6: 240 s cycle, 5 phases)
  TIDE_CYCLE_SEC: 240.0,
  TIDE_LOW_1_END_SEC: 35.0, // 0..35s: Low
  TIDE_RISING_END_SEC: 100.0, // 35..100s: Rising (65s)
  TIDE_HIGH_END_SEC: 145.0, // 100..145s: High (45s)
  TIDE_FALLING_END_SEC: 210.0, // 145..210s: Falling (65s), 210..240s: Low (30s)
  TIDE_KEY_ROUTE_THRESHOLD: 0.62, // Water level where key corridors flood deep & split map
  TIDE_WARNING_LEAD_SEC: 20.0, // Warn 20 s before key route floods
  SHALLOW_SPEED_MULTIPLIER: 0.62, // Slower movement in shallow water
  SHALLOW_RUN_STAMINA_MULTIPLIER: 1.65, // Extra stamina cost running in shallow water
  SHALLOW_WALK_STAMINA_DRAIN_PER_SEC: 4.5, // Extra stamina cost wading in shallow water
  ITEM_WET_EXPOSURE_SEC: 3.0, // Items in water > 3 s become wet
  ITEM_DRY_RECOVERY_SEC: 40.0, // Wet matches/items dry after 40 s in a dry safe area
  WATER_BASE_Y: -0.52, // Water plane Y at waterLevel = 0
  WATER_RISE_HEIGHT: 0.48, // Water rises 0.48m (to -0.04m at waterLevel = 1.0)
  SAFE_ROOM_ELEVATION: 0.22, // Elevated dry High-Ground Safe Room floor height (+0.22m)
  WATER_COLOR: 0x1d3b44, // Translucent low-poly water colour #1d3b44
  WATER_EMISSIVE_COLOR: 0x0c1e24,
  WATER_OPACITY: 0.78,
  WATER_RIPPLE_AMP: 0.02,
  WATER_RIPPLE_SPEED: 1.75,
  CHECKPOINT_SAVE_INTERVAL_SEC: 8.0,

  // Save / Load & Autosave (Milestone 4, 5, 6: bumped to v3 with v1->v2->v3 migration)
  SAVE_STORAGE_KEY: 'hang_sau_game_state',
  SAVE_SCHEMA_VERSION: 3,
  AUTOSAVE_INTERVAL_SEC: 10.0,

  // Post-effect overlay (vignette + native-resolution 256x256 tiled film grain)
  VIGNETTE_OPACITY: 0.6,
  GRAIN_OPACITY: 0.035,
  GRAIN_SIZE_PX: 256,
  GRAIN_FPS: 12,

  // Procedural Web Audio parameters
  DEFAULT_MASTER_VOLUME: 0.8,
  MIN_MASTER_VOLUME: 0.0,
  MAX_MASTER_VOLUME: 1.0,
  MASTER_VOLUME_STEP: 0.05,
  DEFAULT_MUTED: false,
  WIND_BASE_GAIN: 0.085,
  WIND_FILTER_FREQ_HZ: 135,
  WIND_LFO_FREQ_HZ: 0.18,
  WIND_LFO_DEPTH_HZ: 42,
  DRIP_MIN_INTERVAL_SEC: 1.8,
  DRIP_MAX_INTERVAL_SEC: 5.2,
  DRIP_GAIN: 0.16,
  DRIP_MIN_FREQ_HZ: 950,
  DRIP_MAX_FREQ_HZ: 1650,
  FOOTSTEP_WALK_INTERVAL_SEC: 0.52,
  FOOTSTEP_RUN_INTERVAL_SEC: 0.33,
  FOOTSTEP_GAIN_WALK: 0.14,
  FOOTSTEP_GAIN_RUN: 0.22,
  MATCH_STRIKE_GAIN: 0.26,
  MATCH_BURNOUT_GAIN: 0.15,
  PICKUP_SOUND_GAIN: 0.2,
  ROPE_TIE_SOUND_GAIN: 0.25,
  CONSUME_SOUND_GAIN: 0.18,
  DROP_SOUND_GAIN: 0.16,
  TIDE_RUMBLE_MAX_GAIN: 0.17,
  TIDE_WARNING_DRIP_RATE_MULT: 2.6,
  WATER_SPLASH_STEP_GAIN: 0.16,

  // Subtle stamina breathing & darkness heartbeat audio
  BREATH_STAMINA_THRESHOLD: 78.0,
  BREATH_MIN_INTERVAL_SEC: 0.78,
  BREATH_MAX_INTERVAL_SEC: 1.95,
  BREATH_MAX_GAIN: 0.11,
  HEARTBEAT_DARKNESS_DELAY_SEC: 10.0,
  HEARTBEAT_FADE_IN_SEC: 6.0,
  HEARTBEAT_FADE_OUT_SEC: 2.2,
  HEARTBEAT_INTERVAL_SEC: 0.86,
  HEARTBEAT_MAX_GAIN: 0.14,

  // Desaturated cold low-poly palette + low-poly interactable colors
  COLORS: {
    BACKGROUND: 0x05080d,
    WALL_BASE: 0x4a5568,
    WALL_VARIATION: 0.06,
    FLOOR_BASE: 0x3b4452,
    FLOOR_ENTRANCE: 0x273536,
    FLOOR_VARIATION: 0.05,
    CEILING_BASE: 0x2c3441,
    CEILING_VARIATION: 0.05,
    PROP_ROCK_BASE: 0x56627a,
    PROP_ROCK_TIP: 0x6c7a92,
    REMEMBERED_TINT: 0x243447,
    PIT_WALL_BASE: 0x222936,
    PIT_BOTTOM_BASE: 0x0c1017,
    ITEM_MATCHBOX_BODY: 0x8c4a32,
    ITEM_MATCHBOX_TOP: 0xd6b588,
    ITEM_CANDLE_WAX: 0xd8ceb8,
    ITEM_CANDLE_HOLDER: 0x5c5346,
    ITEM_ROPE_COIL: 0x9c8253,
    ITEM_ROPE_WRAP: 0x5c492b,
    ITEM_FOOD_BODY: 0x6e7852,
    ITEM_FOOD_BAND: 0x998a64,
    ITEM_WATER_BODY: 0x466d7d,
    ITEM_WATER_CAP: 0x263842,
    ITEM_ANCHOR_STONE: 0x5a667a,
    ITEM_ANCHOR_IRON: 0x7c5844,
    ITEM_ARTIFACT_PEDESTAL: 0x475263,
    ITEM_ARTIFACT_GOLD: 0xc49a45,
    ITEM_ARTIFACT_CORE: 0x4ca696,
    ITEM_EXIT_ROPE: 0xa89065,
    ITEM_EXIT_SHAFT: 0x4a6670,
  },
} as const;

export interface ComfortSettings {
  mouseSensitivity: number;
  fov: number;
  headBob: boolean;
  masterVolume: number;
  muted: boolean;
}
