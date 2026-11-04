import { CONFIG } from '../config';
import { CAVE_MAP, isWallTile, TileType } from '../data/caveMap';
import {
  getTileWaterStatus,
  isDrySafeTile,
  isGapTile,
  isSafeSanctuaryChamberTile,
  LEVEL_GAP,
  TileWaterStatus,
} from '../data/levelData';
import { STRINGS } from '../strings';

/**
 * 5 phases across the 240 s tide cycle:
 * low -> rising -> high -> falling -> low
 */
export type TidePhase = 'low_1' | 'rising' | 'high' | 'falling' | 'low_2';

export interface TideState {
  /** Position in the 240 s tide cycle [0, TIDE_CYCLE_SEC) */
  tideClockSec: number;
  /** Single water level value in [0, 1] driven by time and saved in GameState */
  waterLevel: number;
  /** Current phase of the 5-phase tide cycle */
  phase: TidePhase;
  /** Seconds the player has continuously stood in flooded water (> 3 s wets inventory items) */
  wetExposureSec: number;
  /** Seconds the player has stood on a dry safe tile while carrying wet items (40 s dries them) */
  dryRecoverySec: number;
  /** True during the 20 s pre-flood warning window before the key route threshold (0.62) */
  warningActive: boolean;
  /** Normalized warning intensity in [0, 1] for distant rumble & faster dripping */
  warningIntensity: number;
  /** Whether the 20 s pre-flood subtitle has already been queued in the current cycle */
  warningSubtitleTriggeredThisCycle: boolean;
  /** Whether the high-tide route-split subtitle has been queued in the current cycle */
  highTideSubtitleTriggeredThisCycle: boolean;
  /** Whether the falling-tide route-reopened subtitle has been queued in the current cycle */
  recededSubtitleTriggeredThisCycle: boolean;
  /** Whether the one-time High-Ground Safe Room discovery subtitle has fired */
  safeRoomVisited: boolean;
  /** Accumulator for periodic BFS soft-lock checks */
  softLockCheckTimerSec: number;
  /** True if the player is trapped with no reachable exit or dry safe ground */
  isSoftLocked: boolean;
}

export interface TideStepEvents {
  triggerPreFloodWarningSubtitle: boolean;
  triggerHighTideFloodedSubtitle: boolean;
  triggerTideRecededSubtitle: boolean;
  triggerItemsWetSubtitle: boolean;
  triggerItemsDriedSubtitle: boolean;
  triggerSafeRoomDiscoverySubtitle: boolean;
  triggerSoftLockSubtitle: boolean;
  shouldWetInventoryItems: boolean;
  shouldDryInventoryItems: boolean;
  playerWaterStatus: TileWaterStatus;
  inSafeSanctuary: boolean;
}

/**
 * Pure helper computing `(waterLevel, phase, warningActive, warningIntensity)` from `tideClockSec`.
 * 5 phases in `TIDE_CYCLE_SEC` (240 s):
 * 1. `low_1`:   0 .. 35 s   -> waterLevel = 0.05
 * 2. `rising`:  35 .. 100 s -> smoothstep from 0.05 to 1.00
 * 3. `high`:    100 .. 145 s -> waterLevel = 1.00
 * 4. `falling`: 145 .. 210 s -> smoothstep from 1.00 to 0.05
 * 5. `low_2`:   210 .. 240 s -> waterLevel = 0.05
 */
export function computeTideFromClock(rawClockSec: number): {
  tideClockSec: number;
  waterLevel: number;
  phase: TidePhase;
  warningActive: boolean;
  warningIntensity: number;
} {
  const cycle = CONFIG.TIDE_CYCLE_SEC;
  const tideClockSec = ((rawClockSec % cycle) + cycle) % cycle;

  const lowFloor = 0.05;
  let waterLevel = lowFloor;
  let phase: TidePhase = 'low_1';

  if (tideClockSec < CONFIG.TIDE_LOW_1_END_SEC) {
    phase = 'low_1';
    waterLevel = lowFloor;
  } else if (tideClockSec < CONFIG.TIDE_RISING_END_SEC) {
    phase = 'rising';
    const u =
      (tideClockSec - CONFIG.TIDE_LOW_1_END_SEC) /
      (CONFIG.TIDE_RISING_END_SEC - CONFIG.TIDE_LOW_1_END_SEC);
    const smooth = u * u * (3 - 2 * u);
    waterLevel = lowFloor + (1.0 - lowFloor) * smooth;
  } else if (tideClockSec < CONFIG.TIDE_HIGH_END_SEC) {
    phase = 'high';
    waterLevel = 1.0;
  } else if (tideClockSec < CONFIG.TIDE_FALLING_END_SEC) {
    phase = 'falling';
    const u =
      (tideClockSec - CONFIG.TIDE_HIGH_END_SEC) /
      (CONFIG.TIDE_FALLING_END_SEC - CONFIG.TIDE_HIGH_END_SEC);
    const smooth = u * u * (3 - 2 * u);
    waterLevel = 1.0 - (1.0 - lowFloor) * smooth;
  } else {
    phase = 'low_2';
    waterLevel = lowFloor;
  }

  // Exact clock time during 'rising' when waterLevel reaches TIDE_KEY_ROUTE_THRESHOLD (0.62):
  // smoothstep(u) = (0.62 - 0.05) / 0.95 = 0.60 -> u ≈ 0.567 -> t ≈ 35 + 0.567 * 65 = 71.85 s
  const risingDuration = CONFIG.TIDE_RISING_END_SEC - CONFIG.TIDE_LOW_1_END_SEC;
  const keyRouteFloodClockSec =
    CONFIG.TIDE_LOW_1_END_SEC + 0.567 * risingDuration;
  const warningStartClockSec =
    keyRouteFloodClockSec - CONFIG.TIDE_WARNING_LEAD_SEC;

  let warningActive = false;
  let warningIntensity = 0;

  if (
    tideClockSec >= warningStartClockSec &&
    tideClockSec <= keyRouteFloodClockSec + 6.0
  ) {
    warningActive = true;
    if (tideClockSec <= keyRouteFloodClockSec) {
      warningIntensity = Math.min(
        1,
        Math.max(
          0.2,
          (tideClockSec - warningStartClockSec) / CONFIG.TIDE_WARNING_LEAD_SEC
        )
      );
    } else {
      warningIntensity = Math.max(
        0,
        1 - (tideClockSec - keyRouteFloodClockSec) / 6.0
      );
    }
  } else if (phase === 'rising' || phase === 'high') {
    // Subtle ambient subterranean rumble while tide is high or rising
    warningIntensity = phase === 'high' ? 0.35 : 0.22;
  }

  return {
    tideClockSec,
    waterLevel,
    phase,
    warningActive,
    warningIntensity,
  };
}

export function createInitialTideState(): TideState {
  const computed = computeTideFromClock(0);
  return {
    tideClockSec: computed.tideClockSec,
    waterLevel: computed.waterLevel,
    phase: computed.phase,
    wetExposureSec: 0,
    dryRecoverySec: 0,
    warningActive: computed.warningActive,
    warningIntensity: computed.warningIntensity,
    warningSubtitleTriggeredThisCycle: false,
    highTideSubtitleTriggeredThisCycle: false,
    recededSubtitleTriggeredThisCycle: false,
    safeRoomVisited: false,
    softLockCheckTimerSec: 0,
    isSoftLocked: false,
  };
}

export function getTidePhaseLabel(phase: TidePhase): string {
  switch (phase) {
    case 'low_1':
      return STRINGS.TIDE_PHASE_LOW_1;
    case 'rising':
      return STRINGS.TIDE_PHASE_RISING;
    case 'high':
      return STRINGS.TIDE_PHASE_HIGH;
    case 'falling':
      return STRINGS.TIDE_PHASE_FALLING;
    case 'low_2':
      return STRINGS.TIDE_PHASE_LOW_2;
  }
}

/**
 * Dev-only debug helper (triggered by KeyT when F3 debug overlay is visible):
 * jumps `tideClockSec` to the start of the next phase in the 5-phase cycle.
 */
export function jumpToNextTidePhase(state: TideState): TideState {
  let nextClock = 0;
  switch (state.phase) {
    case 'low_1':
      nextClock = CONFIG.TIDE_LOW_1_END_SEC + 0.1;
      break;
    case 'rising':
      nextClock = CONFIG.TIDE_RISING_END_SEC + 0.1;
      break;
    case 'high':
      nextClock = CONFIG.TIDE_HIGH_END_SEC + 0.1;
      break;
    case 'falling':
      nextClock = CONFIG.TIDE_FALLING_END_SEC + 0.1;
      break;
    case 'low_2':
      nextClock = 0;
      break;
  }
  const computed = computeTideFromClock(nextClock);
  return {
    ...state,
    tideClockSec: computed.tideClockSec,
    waterLevel: computed.waterLevel,
    phase: computed.phase,
    warningActive: computed.warningActive,
    warningIntensity: computed.warningIntensity,
    warningSubtitleTriggeredThisCycle: false,
    highTideSubtitleTriggeredThisCycle: false,
    recededSubtitleTriggeredThisCycle: false,
    isSoftLocked: false,
  };
}

/**
 * Checks via Breadth-First Search (BFS) on the tile grid whether the player at `(playerX, playerZ)`
 * can reach EITHER the cave entrance/exit (`col 3..4, row 4..5`) OR any permanently dry safe tile
 * (`isDrySafeTile(col, row)`) where they can safely wait for the tide to fall.
 *
 * Returns `true` if the player is soft-locked (trapped in water or isolated with no reachable safe ground).
 */
export function checkPlayerSoftLocked(
  map: readonly (readonly TileType[])[],
  playerX: number,
  playerZ: number,
  waterLevel: number,
  ropeTied: boolean
): boolean {
  const ts = CONFIG.TILE_SIZE;
  const startCol = Math.floor(playerX / ts);
  const startRow = Math.floor(playerZ / ts);

  if (isWallTile(map, startCol, startRow)) {
    return true;
  }

  // If the player is standing in deep water and no immediate cardinal neighbor is passable, they are trapped
  const queue: { col: number; row: number }[] = [{ col: startCol, row: startRow }];
  const visited = new Set<string>([`${startCol},${startRow}`]);

  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;

    // Reached exit tile or any permanently dry safe tile? Not soft-locked!
    const currWater = getTileWaterStatus(curr.col, curr.row, waterLevel);
    if (currWater === 'dry' && isDrySafeTile(curr.col, curr.row)) {
      return false;
    }

    for (const { dc, dr } of dirs) {
      const nc = curr.col + dc;
      const nr = curr.row + dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;

      if (isWallTile(map, nc, nr)) continue;

      // Gap tiles are only traversable along col 20 when ropeTied is true
      if (isGapTile(nc, nr)) {
        if (!ropeTied || nc !== 20) continue;
      }

      // Narrow corridor rockfall at col 28, row 16 blocks passage east of col 27 on row 16
      if (nr === 16 && nc === 28) {
        continue;
      }

      // Deep flooded tiles cannot be entered
      const nextWater = getTileWaterStatus(nc, nr, waterLevel);
      if (nextWater === 'deep') continue;

      visited.add(key);
      queue.push({ col: nc, row: nr });
    }
  }

  // Also check if the player's current tile is already deep water
  const startStatus = getTileWaterStatus(startCol, startRow, waterLevel);
  if (startStatus === 'deep') {
    return true;
  }

  return true;
}

/**
 * Advances the tide cycle, evaluates 20 s pre-flood warnings, tracks wetting (> 3 s in water)
 * and drying (40 s in a dry safe area), and checks for soft-lock states.
 * Pure logic module with zero Three.js dependencies.
 */
export function stepTideSystem(
  state: TideState,
  rawDeltaSeconds: number,
  playerX: number,
  playerZ: number,
  hasWetItems: boolean,
  hasDrySensitiveItems: boolean,
  ropeTied: boolean,
  map: readonly (readonly TileType[])[] = CAVE_MAP
): {
  state: TideState;
  events: TideStepEvents;
} {
  const dt = Math.min(Math.max(rawDeltaSeconds, 0), CONFIG.MAX_DELTA_SEC);
  const ts = CONFIG.TILE_SIZE;
  const playerCol = Math.floor(playerX / ts);
  const playerRow = Math.floor(playerZ / ts);

  const prevClock = state.tideClockSec;
  const prevWaterLevel = state.waterLevel;
  const nextRawClock = prevClock + dt;
  const wrappedCycle = nextRawClock >= CONFIG.TIDE_CYCLE_SEC;

  const computed = computeTideFromClock(nextRawClock);

  let warningSubtitleTriggeredThisCycle = wrappedCycle
    ? false
    : state.warningSubtitleTriggeredThisCycle;
  let highTideSubtitleTriggeredThisCycle = wrappedCycle
    ? false
    : state.highTideSubtitleTriggeredThisCycle;
  let recededSubtitleTriggeredThisCycle = wrappedCycle
    ? false
    : state.recededSubtitleTriggeredThisCycle;

  let triggerPreFloodWarningSubtitle = false;
  let triggerHighTideFloodedSubtitle = false;
  let triggerTideRecededSubtitle = false;

  if (computed.warningActive && !warningSubtitleTriggeredThisCycle) {
    warningSubtitleTriggeredThisCycle = true;
    triggerPreFloodWarningSubtitle = true;
  }

  if (
    prevWaterLevel < CONFIG.TIDE_KEY_ROUTE_THRESHOLD &&
    computed.waterLevel >= CONFIG.TIDE_KEY_ROUTE_THRESHOLD &&
    !highTideSubtitleTriggeredThisCycle
  ) {
    highTideSubtitleTriggeredThisCycle = true;
    triggerHighTideFloodedSubtitle = true;
  }

  if (
    prevWaterLevel >= CONFIG.TIDE_KEY_ROUTE_THRESHOLD &&
    computed.waterLevel < CONFIG.TIDE_KEY_ROUTE_THRESHOLD &&
    computed.phase === 'falling' &&
    !recededSubtitleTriggeredThisCycle
  ) {
    recededSubtitleTriggeredThisCycle = true;
    triggerTideRecededSubtitle = true;
  }

  const playerWaterStatus = getTileWaterStatus(
    playerCol,
    playerRow,
    computed.waterLevel
  );
  const inWater = playerWaterStatus === 'shallow' || playerWaterStatus === 'deep';
  const onDrySafeGround =
    playerWaterStatus === 'dry' && isDrySafeTile(playerCol, playerRow);
  const inSafeSanctuary = isSafeSanctuaryChamberTile(playerCol, playerRow);

  let safeRoomVisited = state.safeRoomVisited;
  let triggerSafeRoomDiscoverySubtitle = false;
  if (inSafeSanctuary && !safeRoomVisited) {
    safeRoomVisited = true;
    triggerSafeRoomDiscoverySubtitle = true;
  }

  // Wetting (> 3 s in water) and Drying (40 s in a dry safe area)
  let wetExposureSec = state.wetExposureSec;
  let dryRecoverySec = state.dryRecoverySec;
  let shouldWetInventoryItems = false;
  let shouldDryInventoryItems = false;
  let triggerItemsWetSubtitle = false;
  let triggerItemsDriedSubtitle = false;

  if (inWater) {
    wetExposureSec += dt;
    dryRecoverySec = 0;
    if (wetExposureSec >= CONFIG.ITEM_WET_EXPOSURE_SEC) {
      shouldWetInventoryItems = true;
      if (hasDrySensitiveItems) {
        triggerItemsWetSubtitle = true;
      }
      wetExposureSec = CONFIG.ITEM_WET_EXPOSURE_SEC;
    }
  } else {
    wetExposureSec = Math.max(0, wetExposureSec - dt * 1.5);
    if (onDrySafeGround && hasWetItems) {
      dryRecoverySec += dt;
      if (dryRecoverySec >= CONFIG.ITEM_DRY_RECOVERY_SEC) {
        shouldDryInventoryItems = true;
        triggerItemsDriedSubtitle = true;
        dryRecoverySec = 0;
      }
    } else if (!hasWetItems) {
      dryRecoverySec = 0;
    }
  }

  // Soft-lock check every 1.0 s (or immediately if standing in deep water)
  let softLockCheckTimerSec = state.softLockCheckTimerSec + dt;
  let isSoftLocked = state.isSoftLocked;
  let triggerSoftLockSubtitle = false;

  if (softLockCheckTimerSec >= 1.0 || playerWaterStatus === 'deep') {
    softLockCheckTimerSec = 0;
    const nowSoftLocked = checkPlayerSoftLocked(
      map,
      playerX,
      playerZ,
      computed.waterLevel,
      ropeTied
    );
    if (nowSoftLocked && !isSoftLocked) {
      triggerSoftLockSubtitle = true;
    }
    isSoftLocked = nowSoftLocked;
  }

  // Keep LEVEL_GAP referenced for completeness of level obstacle checks
  void LEVEL_GAP;

  return {
    state: {
      tideClockSec: computed.tideClockSec,
      waterLevel: computed.waterLevel,
      phase: computed.phase,
      wetExposureSec,
      dryRecoverySec,
      warningActive: computed.warningActive,
      warningIntensity: computed.warningIntensity,
      warningSubtitleTriggeredThisCycle,
      highTideSubtitleTriggeredThisCycle,
      recededSubtitleTriggeredThisCycle,
      safeRoomVisited,
      softLockCheckTimerSec,
      isSoftLocked,
    },
    events: {
      triggerPreFloodWarningSubtitle,
      triggerHighTideFloodedSubtitle,
      triggerTideRecededSubtitle,
      triggerItemsWetSubtitle,
      triggerItemsDriedSubtitle,
      triggerSafeRoomDiscoverySubtitle,
      triggerSoftLockSubtitle,
      shouldWetInventoryItems,
      shouldDryInventoryItems,
      playerWaterStatus,
      inSafeSanctuary,
    },
  };
}
