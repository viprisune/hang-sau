import { CONFIG } from '../config';
import { TileCoord } from './caveMap';

export type ItemCondition = 'dry' | 'wet' | 'damaged';

export type PickupItemType =
  | 'matches'
  | 'candle'
  | 'rope'
  | 'food'
  | 'water_bottle'
  | 'artifact';

export type InteractableKind =
  | PickupItemType
  | 'gap'
  | 'rope_anchor'
  | 'exit';

export interface LevelInteractableDef {
  id: string;
  kind: InteractableKind;
  /** World X position in metres */
  x: number;
  /** World Y base height in metres */
  y: number;
  /** World Z position in metres */
  z: number;
  /** Rotation around Y axis in radians */
  yaw: number;
  /** Optional item condition for pickups (defaults to 'dry') */
  condition?: ItemCondition;
  /** Optional stack quantity for pickups (e.g. 3 matches in a matchbox) */
  quantity?: number;
}

export interface GapDefinition {
  id: string;
  /** Pit tiles in the cave map where the floor drops into an abyss */
  tiles: readonly TileCoord[];
  /** World-space bounds of the impassable gap */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Pit depth in metres below floor level (y = 0) */
  depth: number;
  /** X coordinate of the narrow rope crossing route center */
  bridgeCenterX: number;
  /** Half-width of the narrow crossing lane unlocked when the rope is tied */
  bridgeHalfWidth: number;
  /** North anchor point (where the player ties the rope) */
  northAnchor: { x: number; y: number; z: number };
  /** South anchor point on the far side of the gap */
  southAnchor: { x: number; y: number; z: number };
}

const ts = CONFIG.TILE_SIZE;

/**
 * Dangerous gap (Vực sâu) spanning the 3-tile-wide southern choke point
 * at row 23, cols 19..21 (x = 38.0..44.0m, z = 46.0..48.0m) separating
 * the main West Chamber from the secluded Southern Side Chamber where the
 * hidden artifact rests.
 */
export const LEVEL_GAP: GapDefinition = {
  id: 'gap_chasm',
  tiles: [
    { col: 19, row: 23 },
    { col: 20, row: 23 },
    { col: 21, row: 23 },
  ],
  minX: 19 * ts,
  maxX: 22 * ts,
  minZ: 23 * ts,
  maxZ: 24 * ts,
  depth: CONFIG.GAP_DEPTH,
  bridgeCenterX: 20.5 * ts,
  bridgeHalfWidth: CONFIG.GAP_NARROW_ROUTE_HALF_WIDTH,
  northAnchor: {
    x: 20.5 * ts - 0.52,
    y: 0.45,
    z: 23 * ts - 0.24,
  },
  southAnchor: {
    x: 20.5 * ts - 0.52,
    y: 0.45,
    z: 24 * ts + 0.24,
  },
};

/**
 * Returns true if the given tile coordinate is part of the sunken gap pit.
 */
export function isGapTile(col: number, row: number): boolean {
  for (let i = 0; i < LEVEL_GAP.tiles.length; i++) {
    const t = LEVEL_GAP.tiles[i];
    if (t.col === col && t.row === row) return true;
  }
  return false;
}

/**
 * All interactables for the level:
 * - Pickups: matches (dry & wet), candles, water_bottle, food (dry & damaged), rope
 * - Obstacles & mechanisms: gap, rope_anchor
 * - Goal objects: artifact (in side chamber beyond the gap), exit (at cave entrance)
 */
export const LEVEL_INTERACTABLES: readonly LevelInteractableDef[] = [
  // Exit shaft & climbing rope at the Cave Entrance (Spawn is at col 4, row 5 -> x=9, z=11)
  {
    id: 'cave_exit',
    kind: 'exit',
    x: 3.5 * ts,
    y: 0,
    z: 4.5 * ts,
    yaw: 0.4,
  },

  // Pickup 1: Dry Matches box on a stone slab in the entrance passage
  {
    id: 'pickup_matches_1',
    kind: 'matches',
    x: 7.5 * ts,
    y: 0,
    z: 5.5 * ts,
    yaw: 0.35,
    condition: 'dry',
    quantity: CONFIG.PICKUP_MATCHES_COUNT,
  },

  // Pickup 2: Wax Candle on a rock ledge in the upper winding passage
  {
    id: 'pickup_candle_1',
    kind: 'candle',
    x: 9.5 * ts,
    y: 0,
    z: 6.5 * ts,
    yaw: -0.2,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 3: Water bottle in the winding passage bend
  {
    id: 'pickup_water_1',
    kind: 'water_bottle',
    x: 10.5 * ts,
    y: 0,
    z: 8.5 * ts,
    yaw: -0.6,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 4: Food ration pack at the threshold entering Chamber 1
  {
    id: 'pickup_food_1',
    kind: 'food',
    x: 13.5 * ts,
    y: 0,
    z: 12.5 * ts,
    yaw: 0.8,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 5: Extra matches box (dry) in the northern alcove of Chamber 1
  {
    id: 'pickup_matches_2',
    kind: 'matches',
    x: 19.5 * ts,
    y: 0,
    z: 11.5 * ts,
    yaw: -0.4,
    condition: 'dry',
    quantity: CONFIG.PICKUP_MATCHES_COUNT,
  },

  // Pickup 6: Damp / wet matches box near dripping stalactites in West Chamber
  {
    id: 'pickup_matches_wet',
    kind: 'matches',
    x: 16.5 * ts,
    y: 0,
    z: 19.5 * ts,
    yaw: 0.55,
    condition: 'wet',
    quantity: CONFIG.PICKUP_MATCHES_COUNT,
  },

  // Pickup 7: Second Wax Candle near the southern rim of West Chamber
  {
    id: 'pickup_candle_2',
    kind: 'candle',
    x: 21.5 * ts,
    y: 0,
    z: 20.5 * ts,
    yaw: 0.15,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 8: Coiled climbing rope at the mouth of the low-ceiling East Narrow Corridor (2 slots)
  {
    id: 'pickup_rope',
    kind: 'rope',
    x: 26.5 * ts,
    y: 0,
    z: 16.5 * ts,
    yaw: 0.2,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 9: Second Water bottle at the eastern end of the Narrow Corridor
  {
    id: 'pickup_water_2',
    kind: 'water_bottle',
    x: 38.5 * ts,
    y: 0,
    z: 16.5 * ts,
    yaw: -0.35,
    condition: 'dry',
    quantity: 1,
  },

  // Pickup 10: Damaged Food ration pack in the East Chamber
  {
    id: 'pickup_food_2',
    kind: 'food',
    x: 42.5 * ts,
    y: 0,
    z: 13.5 * ts,
    yaw: 0.65,
    condition: 'damaged',
    quantity: 1,
  },

  // Rope Anchor post & iron ring on the North rim of the dangerous gap
  {
    id: 'gap_rope_anchor',
    kind: 'rope_anchor',
    x: LEVEL_GAP.northAnchor.x,
    y: 0,
    z: LEVEL_GAP.northAnchor.z,
    yaw: 0,
  },

  // Dangerous Gap inspect target right at the pit lip
  {
    id: 'gap_chasm',
    kind: 'gap',
    x: 20.5 * ts,
    y: 0,
    z: 23.25 * ts,
    yaw: 0,
  },

  // Hidden Artifact on an ancient stone pedestal in the Side Chamber beyond the gap
  {
    id: 'hidden_artifact',
    kind: 'artifact',
    x: 20.5 * ts,
    y: 0,
    z: 25.5 * ts,
    yaw: 0,
    condition: 'dry',
    quantity: 1,
  },
];

export type FloodDepthKind = 'shallow' | 'deep';

export type TileWaterStatus = 'dry' | 'shallow' | 'deep';

export interface FloodableTileDef {
  col: number;
  row: number;
  /** Water level in [0, 1] at which water covers this tile */
  threshold: number;
  /** 'shallow' slows movement & increases stamina drain; 'deep' is impassable when flooded */
  depthKind: FloodDepthKind;
}

/**
 * Generates the level's floodable tiles with thresholds in [0, 1] and shallow/deep classifications:
 * - Low Entrance Basin (row 12, cols 12..15): floods deep at 0.62, forcing players onto the High Northern Ridge (row 10, cols 12..17).
 * - West Chamber Central Basin (rows 13..16, cols 15..25): floods shallow (0.32..0.46) as tide rises.
 * - East Narrow Corridor (row 16, cols 27..37): floods shallow at 0.42 (cols 27..28, where the rope sits) and deep at 0.60 (cols 29..37).
 * - Central & East Pillar Passages (rows 17..19, cols 19..21 and cols 24..26): flood deep at 0.62, while the West Ledge Bypass (rows 17..20, cols 14..16) stays shallow/passable until the Southern Chasm Trench.
 * - Southern Chasm Trench (row 21, cols 16..24): floods deep at 0.64 (with shallow warning margins on rows 20 and 22), splitting the North Cave (Entrance + Safe Room + West Ledge) from the South Chasm & Artifact Side Chamber at high tide.
 */
function buildFloodableTiles(): readonly FloodableTileDef[] {
  const list: FloodableTileDef[] = [];
  const seen = new Set<string>();

  const addTile = (
    col: number,
    row: number,
    threshold: number,
    depthKind: FloodDepthKind
  ) => {
    if (isGapTile(col, row)) return;
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ col, row, threshold, depthKind });
  };

  // 1. Low Entrance Basin shortcut (row 12, cols 12..15) -> deep at key route threshold 0.62
  for (let col = 12; col <= 15; col++) {
    addTile(col, 12, 0.62, 'deep');
  }
  // Shallow transition aprons around the Low Entrance Basin
  addTile(11, 11, 0.50, 'shallow');
  addTile(12, 11, 0.48, 'shallow');
  addTile(13, 11, 0.48, 'shallow');
  addTile(13, 13, 0.48, 'shallow');
  addTile(14, 13, 0.46, 'shallow');

  // 2. West Chamber Central Basin (rows 13..16, cols 15..26) -> shallow wading pools
  for (let row = 13; row <= 16; row++) {
    for (let col = 15; col <= 26; col++) {
      // Skip wall pillars inside Chamber 1
      if (
        (row === 13 && (col === 18 || col === 19 || col === 23 || col === 24)) ||
        (row === 14 && (col === 23 || col === 24))
      ) {
        continue;
      }
      // Deeper toward the center of the basin (threshold 0.32..0.45)
      const distFromCenter = Math.hypot(col - 20.5, row - 15.0);
      const threshold =
        distFromCenter < 2.6 ? 0.32 : distFromCenter < 4.2 ? 0.38 : 0.45;
      addTile(col, row, threshold, 'shallow');
    }
  }

  // 3. East Narrow Corridor (row 16, cols 27..37)
  // Mouth where the rope rests (cols 27..28) floods shallow at 0.42; deeper interior floods deep at 0.60
  addTile(27, 16, 0.42, 'shallow');
  addTile(28, 16, 0.44, 'shallow');
  for (let col = 29; col <= 37; col++) {
    addTile(col, 16, 0.60, 'deep');
  }

  // 4. Central & East Pillar Passages (rows 17..19)
  // Central passage (cols 19..21) and East passage (cols 24..26) flood deep at 0.62
  for (let row = 17; row <= 19; row++) {
    for (let col = 19; col <= 21; col++) {
      addTile(col, row, 0.62, 'deep');
    }
    for (let col = 24; col <= 26; col++) {
      if (row === 19 && col === 26) continue; // wall tile
      addTile(col, row, 0.62, 'deep');
    }
  }

  // West Ledge Bypass (rows 17..19, cols 14..16) -> outer col 14 stays dry, cols 15..16 flood shallow at 0.52
  for (let row = 17; row <= 19; row++) {
    addTile(15, row, 0.52, 'shallow');
    addTile(16, row, 0.46, 'shallow');
  }
  addTile(17, 19, 0.48, 'shallow');
  addTile(18, 19, 0.50, 'shallow');

  // 5. Southern Chasm Trench (rows 20..22) — splits the North Cave from the South Chasm & Artifact Chamber at high tide
  for (let col = 15; col <= 25; col++) {
    addTile(col, 20, 0.48, 'shallow');
  }
  for (let col = 16; col <= 24; col++) {
    // Row 21 across the entire chamber width floods DEEP at threshold 0.62 (CONFIG.TIDE_KEY_ROUTE_THRESHOLD)
    addTile(col, 21, CONFIG.TIDE_KEY_ROUTE_THRESHOLD, 'deep');
  }
  for (let col = 18; col <= 22; col++) {
    // Row 22 (just north of the rope anchor) floods shallow at 0.54
    addTile(col, 22, 0.54, 'shallow');
  }

  return list;
}

export const FLOODABLE_TILES: readonly FloodableTileDef[] =
  buildFloodableTiles();

const FLOODABLE_TILE_MAP: ReadonlyMap<string, FloodableTileDef> = new Map(
  FLOODABLE_TILES.map((t) => [`${t.col},${t.row}`, t])
);

/**
 * Returns the FloodableTileDef at `(col, row)`, or undefined if the tile is permanently dry.
 */
export function getFloodableTile(
  col: number,
  row: number
): FloodableTileDef | undefined {
  return FLOODABLE_TILE_MAP.get(`${col},${row}`);
}

/**
 * Returns true if `(col, row)` is inside the elevated High-Ground Safe Room
 * (rows 9..11, cols 18..22) or its connecting High Northern Ridge (row 10, cols 12..17).
 */
export function isSafeRoomTile(col: number, row: number): boolean {
  if (row >= 9 && row <= 11 && col >= 18 && col <= 22) {
    return true;
  }
  if (row === 10 && col >= 12 && col <= 17) {
    return true;
  }
  return false;
}

/**
 * Returns true if `(col, row)` is right inside the High-Ground Safe Room sanctuary chamber
 * (rows 9..11, cols 18..22) so we can show the safe-room badge/subtitle.
 */
export function isSafeSanctuaryChamberTile(col: number, row: number): boolean {
  return row >= 9 && row <= 11 && col >= 18 && col <= 22;
}

/**
 * Evaluates whether a tile is `'dry'`, `'shallow'`, or `'deep'` at the given `waterLevel` in `[0, 1]`.
 */
export function getTileWaterStatus(
  col: number,
  row: number,
  waterLevel: number
): TileWaterStatus {
  const def = FLOODABLE_TILE_MAP.get(`${col},${row}`);
  if (!def) return 'dry';
  if (waterLevel >= def.threshold) {
    return def.depthKind;
  }
  return 'dry';
}

/**
 * Returns true if `(col, row)` is a permanently dry safe area where the player can wait out
 * high tide and dry wet matches/items (never floods even at `waterLevel = 1.0`).
 */
export function isDrySafeTile(col: number, row: number): boolean {
  if (isGapTile(col, row)) return false;
  return !FLOODABLE_TILE_MAP.has(`${col},${row}`);
}

/**
 * World-space Y height of the water plane for a given `waterLevel` in `[0, 1]`.
 */
export function getWaterSurfaceY(waterLevel: number): number {
  const clamped = Math.max(0, Math.min(1, waterLevel));
  return CONFIG.WATER_BASE_Y + clamped * CONFIG.WATER_RISE_HEIGHT;
}

/**
 * Physical floor elevation Y (in metres) for a tile `(col, row)`:
 * - High-Ground Safe Room & Northern Ridge (`isSafeRoomTile`): `+CONFIG.SAFE_ROOM_ELEVATION` (`+0.22 m`)
 * - Permanently dry tiles: `0.0 m`
 * - Floodable tiles: `CONFIG.WATER_BASE_Y + def.threshold * CONFIG.WATER_RISE_HEIGHT - depthOffset`
 *   so the translucent water plane visibly crosses the floor surface at `waterLevel === def.threshold`.
 */
export function getTileFloorElevation(col: number, row: number): number {
  if (isGapTile(col, row)) {
    return -CONFIG.GAP_DEPTH;
  }
  if (isSafeRoomTile(col, row)) {
    return CONFIG.SAFE_ROOM_ELEVATION;
  }
  const floodDef = FLOODABLE_TILE_MAP.get(`${col},${row}`);
  if (!floodDef) {
    return 0;
  }
  const surfaceAtThreshold =
    CONFIG.WATER_BASE_Y + floodDef.threshold * CONFIG.WATER_RISE_HEIGHT;
  // Deep trenches sit slightly lower so their floor clearly drops beneath the water plane
  const basinDrop = floodDef.depthKind === 'deep' ? 0.14 : 0.03;
  return surfaceAtThreshold - basinDrop;
}


