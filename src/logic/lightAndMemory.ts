import { CONFIG } from '../config';
import { isWallTile, TileType } from '../data/caveMap';
import { ItemCondition } from '../data/levelData';
import {
  consumeFirstMatchingItem,
  consumeFromInventoryEntry,
  countItemsOfKind,
  InventoryState,
} from './survivalAndInventory';

export type LightSourceKind = 'match' | 'candle';

export type MatchStatusMessageKey =
  | 'ALREADY_LIT'
  | 'NO_MATCHES'
  | 'WET_MATCH'
  | 'WET_CANDLE'
  | null;

export interface MatchLightState {
  matchesRemaining: number;
  isLit: boolean;
  activeSource: LightSourceKind;
  burnTimeRemaining: number;
  maxBurnDuration: number;
  flickerClock: number;
  currentReach: number;
  currentIntensity: number;
  currentFogDensity: number;
  statusMessageKey: MatchStatusMessageKey;
  statusMessageTimer: number;
}

export type StrikeMatchEvent =
  | 'struck'
  | 'candle_lit'
  | 'already_lit'
  | 'wet_match'
  | 'wet_candle'
  | 'empty';

export interface TileFaceDescriptor {
  faceId: number;
  col: number;
  row: number;
  /** World-space sample coordinate (in walkable space) used for distance & LOS check */
  sampleX: number;
  sampleZ: number;
  /** Outward 2D normal on XZ plane (0,0 for floor/ceiling/props; unit normal for wall faces) */
  normalX: number;
  normalZ: number;
  /** Contiguous vertex slice in the merged cave BufferGeometry */
  vertexStart: number;
  vertexCount: number;
}

export interface SurfaceMemoryState {
  /** 1 byte per faceId: 0 = unseen, 1 = remembered */
  remembered: Uint8Array;
  rememberedCount: number;
}

export function createInitialMatchLightState(): MatchLightState {
  return {
    matchesRemaining: CONFIG.INITIAL_MATCHES,
    isLit: false,
    activeSource: 'match',
    burnTimeRemaining: 0,
    maxBurnDuration: CONFIG.MATCH_BURN_DURATION_SEC,
    flickerClock: 0,
    currentReach: CONFIG.DARK_GLOW_REACH,
    currentIntensity: CONFIG.DARK_GLOW_INTENSITY,
    currentFogDensity: CONFIG.FOG_DENSITY_DARK,
    statusMessageKey: null,
    statusMessageTimer: 0,
  };
}

export function createSurfaceMemoryState(totalFaces: number): SurfaceMemoryState {
  return {
    remembered: new Uint8Array(totalFaces),
    rememberedCount: 0,
  };
}

function computeLightDurationForSource(
  source: LightSourceKind,
  condition: ItemCondition
): { burnTime: number; maxDuration: number; reach: number; intensity: number } {
  const maxDuration =
    source === 'candle'
      ? CONFIG.CANDLE_BURN_DURATION_SEC
      : CONFIG.MATCH_BURN_DURATION_SEC;
  const factor =
    condition === 'damaged' ? CONFIG.DAMAGED_LIGHT_DURATION_FACTOR : 1.0;
  const reach =
    source === 'candle' ? CONFIG.CANDLE_REACH_FULL : CONFIG.MATCH_REACH_FULL;
  const intensity =
    source === 'candle'
      ? CONFIG.CANDLE_LIGHT_INTENSITY
      : CONFIG.MATCH_LIGHT_INTENSITY;
  return {
    burnTime: maxDuration * factor,
    maxDuration,
    reach,
    intensity,
  };
}

/**
 * Handles pressing [F] to strike a match from the player's inventory.
 * - If already lit: does nothing to the flame/matches and shows a Vietnamese message.
 * - If unlit and player has dry/damaged matches: consumes 1 match and lights it for 25s (7m -> 3.5m).
 * - If unlit and player only has wet matches: refuses to light and shows a Vietnamese wet-match message.
 * - If unlit and player has 0 matches: shows out-of-matches message.
 */
export function tryStrikeMatchWithInventory(
  state: MatchLightState,
  inventory: InventoryState
): {
  state: MatchLightState;
  inventory: InventoryState;
  event: StrikeMatchEvent;
} {
  if (state.isLit) {
    return {
      state: {
        ...state,
        statusMessageKey: 'ALREADY_LIT',
        statusMessageTimer: CONFIG.STATUS_MESSAGE_DURATION_SEC,
      },
      inventory,
      event: 'already_lit',
    };
  }

  // Prefer dry matches first, then damaged matches
  let consumed = consumeFirstMatchingItem(
    inventory,
    'matches',
    (it) => it.condition === 'dry'
  );
  if (!consumed.consumedItem) {
    consumed = consumeFirstMatchingItem(
      inventory,
      'matches',
      (it) => it.condition === 'damaged'
    );
  }

  if (consumed.consumedItem) {
    const nextInv = consumed.inventory;
    const totalMatchesLeft = countItemsOfKind(nextInv, 'matches', false);
    const params = computeLightDurationForSource(
      'match',
      consumed.consumedItem.condition
    );
    return {
      state: {
        ...state,
        matchesRemaining: totalMatchesLeft,
        isLit: true,
        activeSource: 'match',
        burnTimeRemaining: params.burnTime,
        maxBurnDuration: params.maxDuration,
        currentReach: params.reach,
        currentIntensity: params.intensity,
        statusMessageKey: null,
        statusMessageTimer: 0,
      },
      inventory: nextInv,
      event: 'struck',
    };
  }

  // Check if player has wet matches that cannot be lit
  const totalMatches = countItemsOfKind(inventory, 'matches', false);
  if (totalMatches > 0) {
    return {
      state: {
        ...state,
        matchesRemaining: totalMatches,
        statusMessageKey: 'WET_MATCH',
        statusMessageTimer: CONFIG.STATUS_MESSAGE_DURATION_SEC,
      },
      inventory,
      event: 'wet_match',
    };
  }

  return {
    state: {
      ...state,
      matchesRemaining: 0,
      statusMessageKey: 'NO_MATCHES',
      statusMessageTimer: CONFIG.STATUS_MESSAGE_DURATION_SEC,
    },
    inventory,
    event: 'empty',
  };
}

/**
 * Lights a specific match or candle entry from the [I] Inventory screen.
 */
export function tryLightInventoryEntry(
  state: MatchLightState,
  inventory: InventoryState,
  entryId: string
): {
  state: MatchLightState;
  inventory: InventoryState;
  event: StrikeMatchEvent;
} {
  const entry = inventory.items.find((it) => it.id === entryId);
  if (!entry || (entry.kind !== 'matches' && entry.kind !== 'candle')) {
    return { state, inventory, event: 'empty' };
  }

  if (entry.condition === 'wet') {
    const key: MatchStatusMessageKey =
      entry.kind === 'candle' ? 'WET_CANDLE' : 'WET_MATCH';
    return {
      state: {
        ...state,
        statusMessageKey: key,
        statusMessageTimer: CONFIG.STATUS_MESSAGE_DURATION_SEC,
      },
      inventory,
      event: entry.kind === 'candle' ? 'wet_candle' : 'wet_match',
    };
  }

  if (state.isLit) {
    return {
      state: {
        ...state,
        statusMessageKey: 'ALREADY_LIT',
        statusMessageTimer: CONFIG.STATUS_MESSAGE_DURATION_SEC,
      },
      inventory,
      event: 'already_lit',
    };
  }

  const consumed = consumeFromInventoryEntry(inventory, entryId, 1);
  if (!consumed.consumedItem) {
    return { state, inventory, event: 'empty' };
  }

  const source: LightSourceKind =
    entry.kind === 'candle' ? 'candle' : 'match';
  const params = computeLightDurationForSource(source, entry.condition);
  const totalMatchesLeft = countItemsOfKind(
    consumed.inventory,
    'matches',
    false
  );

  return {
    state: {
      ...state,
      matchesRemaining: totalMatchesLeft,
      isLit: true,
      activeSource: source,
      burnTimeRemaining: params.burnTime,
      maxBurnDuration: params.maxDuration,
      currentReach: params.reach,
      currentIntensity: params.intensity,
      statusMessageKey: null,
      statusMessageTimer: 0,
    },
    inventory: consumed.inventory,
    event: source === 'candle' ? 'candle_lit' : 'struck',
  };
}

/**
 * Advances match or candle timer, irregular flame flicker, reach decay in the final window,
 * and fog density interpolation. Also extinguishes a lit candle if `isWet` is true.
 */
export function stepMatchLight(
  state: MatchLightState,
  rawDeltaSeconds: number,
  isCandleWet = false
): {
  state: MatchLightState;
  burnedOut: boolean;
  wetExtinguished: boolean;
} {
  const dt = Math.min(Math.max(rawDeltaSeconds, 0), CONFIG.MAX_DELTA_SEC);
  if (dt <= 0) {
    return { state, burnedOut: false, wetExtinguished: false };
  }

  let statusMessageTimer = Math.max(0, state.statusMessageTimer - dt);
  let statusMessageKey = statusMessageTimer > 0 ? state.statusMessageKey : null;

  let isLit = state.isLit;
  let burnTimeRemaining = state.burnTimeRemaining;
  let flickerClock = state.flickerClock;
  let currentReach: number = CONFIG.DARK_GLOW_REACH;
  let currentIntensity: number = CONFIG.DARK_GLOW_INTENSITY;
  let burnedOut = false;
  let wetExtinguished = false;

  if (isLit) {
    // Candle can go out when wet
    if (state.activeSource === 'candle' && isCandleWet) {
      isLit = false;
      burnTimeRemaining = 0;
      burnedOut = true;
      wetExtinguished = true;
      currentReach = CONFIG.DARK_GLOW_REACH;
      currentIntensity = CONFIG.DARK_GLOW_INTENSITY;
    } else {
      burnTimeRemaining -= dt;
      flickerClock += dt;

      if (burnTimeRemaining <= 0) {
        isLit = false;
        burnTimeRemaining = 0;
        burnedOut = true;
        currentReach = CONFIG.DARK_GLOW_REACH;
        currentIntensity = CONFIG.DARK_GLOW_INTENSITY;
      } else {
        const isCandle = state.activeSource === 'candle';
        const fullReach = isCandle
          ? CONFIG.CANDLE_REACH_FULL
          : CONFIG.MATCH_REACH_FULL;
        const minReach = isCandle
          ? CONFIG.CANDLE_REACH_MIN
          : CONFIG.MATCH_REACH_MIN;
        const shrinkWindow = isCandle
          ? CONFIG.CANDLE_SHRINK_WINDOW_SEC
          : CONFIG.MATCH_SHRINK_WINDOW_SEC;
        const baseIntensity = isCandle
          ? CONFIG.CANDLE_LIGHT_INTENSITY
          : CONFIG.MATCH_LIGHT_INTENSITY;
        const baseFlickerAmp = isCandle
          ? CONFIG.CANDLE_FLICKER_AMP
          : CONFIG.MATCH_FLICKER_AMP;

        let baseReach: number = fullReach;
        let dyingFactor = 0;
        if (burnTimeRemaining <= shrinkWindow) {
          const ratio = Math.max(
            0,
            Math.min(1, burnTimeRemaining / shrinkWindow)
          );
          baseReach = minReach + (fullReach - minReach) * ratio;
          dyingFactor = 1 - ratio;
        }

        // Irregular multi-frequency flame flicker
        const w1 = Math.sin(flickerClock * CONFIG.MATCH_FLICKER_SPEED_1);
        const w2 = Math.sin(flickerClock * CONFIG.MATCH_FLICKER_SPEED_2 + 1.7);
        const w3 = Math.cos(flickerClock * CONFIG.MATCH_FLICKER_SPEED_3 + 3.1);
        const wave = w1 * 0.5 + w2 * 0.32 + w3 * 0.18;

        const amp =
          baseFlickerAmp +
          (CONFIG.MATCH_DYING_FLICKER_AMP - baseFlickerAmp) * dyingFactor;

        currentIntensity = Math.max(
          0.6,
          baseIntensity * (1 + wave * amp) * (1 - dyingFactor * 0.25)
        );
        currentReach = Math.max(minReach * 0.85, baseReach * (1 + wave * 0.045));
      }
    }
  }

  const targetFog = isLit ? CONFIG.FOG_DENSITY_LIT : CONFIG.FOG_DENSITY_DARK;
  const fogBlend = 1 - Math.exp(-CONFIG.FOG_LERP_SPEED * dt);
  const currentFogDensity =
    state.currentFogDensity + (targetFog - state.currentFogDensity) * fogBlend;

  return {
    state: {
      matchesRemaining: state.matchesRemaining,
      isLit,
      activeSource: state.activeSource,
      burnTimeRemaining,
      maxBurnDuration: state.maxBurnDuration,
      flickerClock,
      currentReach,
      currentIntensity,
      currentFogDensity,
      statusMessageKey,
      statusMessageTimer,
    },
    burnedOut,
    wetExtinguished,
  };
}

/**
 * Checks 2D line-of-sight on the tile grid from the player `(playerX, playerZ)`
 * to a candidate tile face's sample point `(face.sampleX, face.sampleZ)`.
 * Never allows rays to pass through solid walls or diagonal wall corners.
 */
export function hasTileLineOfSight(
  map: readonly (readonly TileType[])[],
  playerX: number,
  playerZ: number,
  face: TileFaceDescriptor
): boolean {
  const toPlayerX = playerX - face.sampleX;
  const toPlayerZ = playerZ - face.sampleZ;

  // For directional wall faces, require the face normal to point toward the player
  if (face.normalX !== 0 || face.normalZ !== 0) {
    const dot = toPlayerX * face.normalX + toPlayerZ * face.normalZ;
    if (dot <= 0.02) {
      return false;
    }
  }

  const dx = face.sampleX - playerX;
  const dz = face.sampleZ - playerZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return true;

  const ts = CONFIG.TILE_SIZE;
  const steps = Math.max(1, Math.ceil(dist / CONFIG.MEMORY_LOS_STEP_METRES));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  let prevCol = Math.floor(playerX / ts);
  let prevRow = Math.floor(playerZ / ts);

  for (let i = 1; i <= steps; i++) {
    const sx = playerX + stepX * i;
    const sz = playerZ + stepZ * i;
    const col = Math.floor(sx / ts);
    const row = Math.floor(sz / ts);

    if (isWallTile(map, col, row)) {
      return false;
    }

    // Prevent diagonal corner leaking between two touching wall tiles
    if (col !== prevCol && row !== prevRow) {
      if (isWallTile(map, prevCol, row) && isWallTile(map, col, prevRow)) {
        return false;
      }
    }

    prevCol = col;
    prevRow = row;
  }

  return true;
}

/**
 * Evaluates which previously unseen tile faces become visible to the player while
 * a match is actively burning, respecting reach and tile-grid line of sight.
 * Returns only the newly marked `faceId` list so the renderer updates only changed buffer slices.
 */
export function updateRememberedTileFaces(
  memory: SurfaceMemoryState,
  faces: readonly TileFaceDescriptor[],
  map: readonly (readonly TileType[])[],
  playerX: number,
  playerZ: number,
  isLit: boolean,
  currentReach: number
): number[] {
  if (!isLit) {
    return [];
  }

  const maxDist = currentReach * CONFIG.MEMORY_MAX_REACH_FACTOR;
  const maxDistSq = maxDist * maxDist;
  const newlyRemembered: number[] = [];

  for (let i = 0; i < faces.length; i++) {
    if (memory.remembered[i] === 1) continue;

    const face = faces[i];
    const dx = face.sampleX - playerX;
    const dz = face.sampleZ - playerZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > maxDistSq) continue;

    if (hasTileLineOfSight(map, playerX, playerZ, face)) {
      memory.remembered[i] = 1;
      memory.rememberedCount++;
      newlyRemembered.push(i);
    }
  }

  return newlyRemembered;
}

/**
 * Computes subtle camera roll sway when walking or running, respecting the head-bob toggle.
 */
export function computeCameraSwayRoll(
  bobPhase: number,
  isMoving: boolean,
  isRunning: boolean,
  headBobEnabled: boolean
): number {
  if (!headBobEnabled || !isMoving) {
    return 0;
  }
  const mult = isRunning ? CONFIG.CAMERA_SWAY_RUN_MULTIPLIER : 1.0;
  return Math.sin(bobPhase) * CONFIG.CAMERA_SWAY_ROLL_RAD * mult;
}

/**
 * Computes the world-space position of the player's match PointLight.
 * If the player stands flush against a wall, pushes the light back/aside from the
 * wall to maintain `CONFIG.MATCH_WALL_MIN_CLEARANCE` and lifts it slightly so
 * close-range low-poly rock facets retain oblique shading instead of blowing out.
 */
export function computeMatchLightPosition(
  map: readonly (readonly TileType[])[],
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  yaw: number
): { x: number; y: number; z: number } {
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let lx =
    eyeX +
    fwdX * CONFIG.MATCH_OFFSET_FORWARD +
    rightX * CONFIG.MATCH_OFFSET_RIGHT;
  let ly = eyeY + CONFIG.MATCH_OFFSET_DOWN;
  let lz =
    eyeZ +
    fwdZ * CONFIG.MATCH_OFFSET_FORWARD +
    rightZ * CONFIG.MATCH_OFFSET_RIGHT;

  const ts = CONFIG.TILE_SIZE;
  const clearance = CONFIG.MATCH_WALL_MIN_CLEARANCE;
  const clearanceSq = clearance * clearance;
  const centerCol = Math.floor(lx / ts);
  const centerRow = Math.floor(lz / ts);

  let maxProximityFactor = 0;

  for (let row = centerRow - 1; row <= centerRow + 1; row++) {
    for (let col = centerCol - 1; col <= centerCol + 1; col++) {
      if (!isWallTile(map, col, row)) continue;

      const minX = col * ts;
      const maxX = (col + 1) * ts;
      const minZ = row * ts;
      const maxZ = (row + 1) * ts;

      const nearestX = Math.max(minX, Math.min(lx, maxX));
      const nearestZ = Math.max(minZ, Math.min(lz, maxZ));
      const ox = lx - nearestX;
      const oz = lz - nearestZ;
      const distSq = ox * ox + oz * oz;

      if (distSq < clearanceSq && distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const push = clearance - dist;
        lx += (ox / dist) * push;
        lz += (oz / dist) * push;

        const proximity = 1 - dist / clearance;
        if (proximity > maxProximityFactor) {
          maxProximityFactor = proximity;
        }
      }
    }
  }

  if (maxProximityFactor > 0) {
    ly += maxProximityFactor * CONFIG.MATCH_WALL_GRAZE_LIFT_Y;
  }

  return { x: lx, y: ly, z: lz };
}

