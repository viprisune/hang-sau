import { CONFIG } from '../config';
import {
  ItemCondition,
  LEVEL_INTERACTABLES,
  PickupItemType,
} from '../data/levelData';
import {
  getObjectiveKey,
  LevelProgressState,
  ObjectiveKey,
  syncLevelWithInventory,
} from './levelState';
import {
  LightSourceKind,
  MatchLightState,
  SurfaceMemoryState,
} from './lightAndMemory';
import { PlayerMovementState } from './movement';
import {
  addItemToInventory,
  countItemsOfKind,
  createInitialSurvivalState,
  DroppedWorldItem,
  getItemMetadata,
  InventoryItemEntry,
  InventoryState,
  SurvivalState,
} from './survivalAndInventory';
import {
  computeTideFromClock,
  createInitialTideState,
  TideState,
} from './tideSystem';

/**
 * Single serializable GameState object for HANG SÂU (Schema Version 3).
 */
export interface GameState {
  version: number;
  elapsedSec: number;
  player: {
    x: number;
    z: number;
    yaw: number;
    pitch: number;
  };
  light: {
    matchesRemaining: number;
    isLit: boolean;
    activeSource: LightSourceKind;
    burnTimeRemaining: number;
    maxBurnDuration: number;
    flickerClock: number;
    currentReach: number;
    currentIntensity: number;
    currentFogDensity: number;
  };
  items: {
    hasRope: boolean;
    hasArtifact: boolean;
    foodCount: number;
    waterCount: number;
    extra?: Record<string, number>;
  };
  inventory: InventoryState;
  survival: SurvivalState;
  collectedIds: string[];
  droppedItems: DroppedWorldItem[];
  nextDropSeq: number;
  ropeState: {
    ropeTied: boolean;
    gapApproachHintTriggered: boolean;
  };
  objective: ObjectiveKey;
  rememberedFaceIds: number[];
  tides: TideState;
  extensions?: Record<string, unknown>;
}

export type SaveLoadStatus = 'empty' | 'ok' | 'corrupt' | 'wrong_version';

export interface LoadSaveResult {
  status: SaveLoadStatus;
  state: GameState | null;
}

const VALID_OBJECTIVES: ReadonlySet<ObjectiveKey> = new Set<ObjectiveKey>([
  'OBJ_FIND_ROPE',
  'OBJ_TIE_ROPE',
  'OBJ_FIND_ARTIFACT',
  'OBJ_RETURN_EXIT',
]);

const VALID_PICKUP_KINDS: ReadonlySet<PickupItemType> =
  new Set<PickupItemType>([
    'matches',
    'candle',
    'rope',
    'food',
    'water_bottle',
    'artifact',
  ]);

const VALID_CONDITIONS: ReadonlySet<ItemCondition> = new Set<ItemCondition>([
  'dry',
  'wet',
  'damaged',
]);

const KNOWN_INTERACTABLE_IDS: ReadonlySet<string> = new Set<string>(
  LEVEL_INTERACTABLES.map((item) => item.id)
);

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Stepwise version migration table: `MIGRATIONS[v]` upgrades a save object
 * from schema version `v` to `v + 1`.
 * - `MIGRATIONS[1]` upgrades Milestone 4 (v1) saves to Milestone 5 (v2).
 * - `MIGRATIONS[2]` upgrades Milestone 5 (v2) saves to Milestone 6 (v3) by
 *   attaching a valid `tides: TideState` driven by `elapsedSec` or existing `tides`.
 */
const MIGRATIONS: Record<
  number,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {
  1: (v1) => {
    const rawLight = isRecord(v1.light) ? v1.light : {};
    const rawItems = isRecord(v1.items) ? v1.items : {};
    const rawRopeState = isRecord(v1.ropeState) ? v1.ropeState : {};

    const matchesRemaining = isFiniteNumber(rawLight.matchesRemaining)
      ? Math.max(0, Math.floor(rawLight.matchesRemaining))
      : CONFIG.INITIAL_MATCHES;
    const hasRope = Boolean(rawItems.hasRope);
    const ropeTied = Boolean(rawRopeState.ropeTied);
    const hasArtifact = Boolean(rawItems.hasArtifact);
    const foodCount = isFiniteNumber(rawItems.foodCount)
      ? Math.max(0, Math.floor(rawItems.foodCount))
      : 0;
    const waterCount = isFiniteNumber(rawItems.waterCount)
      ? Math.max(0, Math.floor(rawItems.waterCount))
      : 0;

    let migratedInv: InventoryState = {
      items: [],
      nextEntrySeq: 1,
    };

    if (matchesRemaining > 0) {
      migratedInv = addItemToInventory(
        migratedInv,
        'matches',
        matchesRemaining,
        'dry'
      ).inventory;
    }
    if (hasRope && !ropeTied) {
      migratedInv = addItemToInventory(
        migratedInv,
        'rope',
        1,
        'dry'
      ).inventory;
    }
    if (hasArtifact) {
      migratedInv = addItemToInventory(
        migratedInv,
        'artifact',
        1,
        'dry'
      ).inventory;
    }
    if (foodCount > 0) {
      migratedInv = addItemToInventory(
        migratedInv,
        'food',
        foodCount,
        'dry'
      ).inventory;
    }
    if (waterCount > 0) {
      migratedInv = addItemToInventory(
        migratedInv,
        'water_bottle',
        waterCount,
        'dry'
      ).inventory;
    }

    const initialSurvival = createInitialSurvivalState();
    const existingSurvival = isRecord(v1.survival) ? v1.survival : {};

    return {
      ...v1,
      version: 2,
      light: {
        ...rawLight,
        activeSource: 'match',
        maxBurnDuration: CONFIG.MATCH_BURN_DURATION_SEC,
      },
      inventory: migratedInv,
      survival: {
        ...initialSurvival,
        ...(isFiniteNumber(existingSurvival.health)
          ? { health: existingSurvival.health }
          : {}),
        ...(isFiniteNumber(existingSurvival.stamina)
          ? { stamina: existingSurvival.stamina }
          : {}),
        ...(isFiniteNumber(existingSurvival.hunger)
          ? { hunger: existingSurvival.hunger }
          : {}),
        ...(isFiniteNumber(existingSurvival.thirst)
          ? { thirst: existingSurvival.thirst }
          : {}),
      },
      droppedItems: [],
      nextDropSeq: 1,
    };
  },
  2: (v2) => {
    const initialTide = createInitialTideState();
    const rawTides = isRecord(v2.tides) ? v2.tides : {};
    const clockFromSave = isFiniteNumber(rawTides.tideClockSec)
      ? rawTides.tideClockSec
      : isFiniteNumber(rawTides.tideTimerSec)
        ? rawTides.tideTimerSec
        : 0;
    const computed = computeTideFromClock(clockFromSave);

    return {
      ...v2,
      version: 3,
      tides: {
        ...initialTide,
        tideClockSec: computed.tideClockSec,
        waterLevel: isFiniteNumber(rawTides.waterLevel)
          ? Math.max(0, Math.min(1, rawTides.waterLevel))
          : computed.waterLevel,
        phase: computed.phase,
        warningActive: computed.warningActive,
        warningIntensity: computed.warningIntensity,
      },
    };
  },
};

/**
 * Validates and migrates a raw parsed JSON value into a verified `GameState`.
 */
export function validateAndMigrateGameState(raw: unknown): LoadSaveResult {
  if (!isRecord(raw)) {
    return { status: 'corrupt', state: null };
  }

  const rawVersion = raw.version;
  if (!isFiniteNumber(rawVersion) || !Number.isInteger(rawVersion)) {
    return { status: 'corrupt', state: null };
  }

  if (rawVersion < 1 || rawVersion > CONFIG.SAVE_SCHEMA_VERSION) {
    return { status: 'wrong_version', state: null };
  }

  let working: Record<string, unknown> = { ...raw };
  let currentVer = rawVersion;

  while (currentVer < CONFIG.SAVE_SCHEMA_VERSION) {
    const migrator = MIGRATIONS[currentVer];
    if (!migrator) {
      return { status: 'wrong_version', state: null };
    }
    try {
      working = migrator(working);
      currentVer = Number(working.version);
    } catch {
      return { status: 'corrupt', state: null };
    }
  }

  // Validate elapsedSec
  if (!isFiniteNumber(working.elapsedSec) || working.elapsedSec < 0) {
    return { status: 'corrupt', state: null };
  }

  // Validate player
  if (!isRecord(working.player)) {
    return { status: 'corrupt', state: null };
  }
  const { x, z, yaw, pitch } = working.player;
  const maxWorldX = CONFIG.MAP_COLS * CONFIG.TILE_SIZE;
  const maxWorldZ = CONFIG.MAP_ROWS * CONFIG.TILE_SIZE;
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(z) ||
    !isFiniteNumber(yaw) ||
    !isFiniteNumber(pitch) ||
    x <= 0 ||
    x >= maxWorldX ||
    z <= 0 ||
    z >= maxWorldZ
  ) {
    return { status: 'corrupt', state: null };
  }

  // Validate light
  if (!isRecord(working.light)) {
    return { status: 'corrupt', state: null };
  }
  const {
    matchesRemaining,
    isLit,
    burnTimeRemaining,
    flickerClock,
    currentReach,
    currentIntensity,
    currentFogDensity,
  } = working.light;
  const activeSource: LightSourceKind =
    working.light.activeSource === 'candle' ? 'candle' : 'match';
  const maxBurnDuration = isFiniteNumber(working.light.maxBurnDuration)
    ? working.light.maxBurnDuration
    : activeSource === 'candle'
      ? CONFIG.CANDLE_BURN_DURATION_SEC
      : CONFIG.MATCH_BURN_DURATION_SEC;

  if (
    !isFiniteNumber(matchesRemaining) ||
    matchesRemaining < 0 ||
    typeof isLit !== 'boolean' ||
    !isFiniteNumber(burnTimeRemaining) ||
    burnTimeRemaining < 0 ||
    !isFiniteNumber(flickerClock) ||
    !isFiniteNumber(currentReach) ||
    !isFiniteNumber(currentIntensity) ||
    !isFiniteNumber(currentFogDensity)
  ) {
    return { status: 'corrupt', state: null };
  }

  // Validate items
  if (!isRecord(working.items)) {
    return { status: 'corrupt', state: null };
  }
  const { hasRope, hasArtifact, foodCount, waterCount } = working.items;
  if (
    typeof hasRope !== 'boolean' ||
    typeof hasArtifact !== 'boolean' ||
    !isFiniteNumber(foodCount) ||
    foodCount < 0 ||
    !isFiniteNumber(waterCount) ||
    waterCount < 0
  ) {
    return { status: 'corrupt', state: null };
  }

  // Validate inventory
  if (!isRecord(working.inventory) || !Array.isArray(working.inventory.items)) {
    return { status: 'corrupt', state: null };
  }
  const validatedInvItems: InventoryItemEntry[] = [];
  let usedSlots = 0;
  for (const rawEntry of working.inventory.items) {
    if (!isRecord(rawEntry)) {
      return { status: 'corrupt', state: null };
    }
    const id = rawEntry.id;
    const kind = rawEntry.kind as PickupItemType;
    const quantity = rawEntry.quantity;
    const condition = rawEntry.condition as ItemCondition;
    if (
      typeof id !== 'string' ||
      !VALID_PICKUP_KINDS.has(kind) ||
      !isFiniteNumber(quantity) ||
      quantity <= 0 ||
      !VALID_CONDITIONS.has(condition)
    ) {
      return { status: 'corrupt', state: null };
    }
    const meta = getItemMetadata(kind);
    if (usedSlots + meta.slotCost > CONFIG.INVENTORY_MAX_SLOTS) {
      continue;
    }
    usedSlots += meta.slotCost;
    validatedInvItems.push({
      id,
      kind,
      quantity: Math.min(meta.maxStack, Math.floor(quantity)),
      condition,
      slotCost: meta.slotCost,
      maxStack: meta.maxStack,
    });
  }
  const nextEntrySeq =
    isFiniteNumber(working.inventory.nextEntrySeq) &&
    working.inventory.nextEntrySeq >= 1
      ? Math.floor(working.inventory.nextEntrySeq)
      : validatedInvItems.length + 1;

  const validatedInventory: InventoryState = {
    items: validatedInvItems,
    nextEntrySeq,
  };

  // Validate survival
  if (!isRecord(working.survival)) {
    return { status: 'corrupt', state: null };
  }
  const rawSurv = working.survival;
  if (
    !isFiniteNumber(rawSurv.health) ||
    !isFiniteNumber(rawSurv.stamina) ||
    !isFiniteNumber(rawSurv.hunger) ||
    !isFiniteNumber(rawSurv.thirst)
  ) {
    return { status: 'corrupt', state: null };
  }
  const hunger = Math.max(0, Math.min(CONFIG.HUNGER_MAX, rawSurv.hunger));
  const thirst = Math.max(0, Math.min(CONFIG.THIRST_MAX, rawSurv.thirst));
  const isVitalZero = hunger <= 0 || thirst <= 0;
  const maxStamina = isVitalZero
    ? CONFIG.STAMINA_MAX * CONFIG.ZERO_VITAL_STAMINA_MULTIPLIER
    : CONFIG.STAMINA_MAX;
  const health = Math.max(0, Math.min(CONFIG.HEALTH_MAX, rawSurv.health));
  const stamina = Math.max(0, Math.min(maxStamina, rawSurv.stamina));
  const zeroVitalTimerSec = isFiniteNumber(rawSurv.zeroVitalTimerSec)
    ? Math.max(0, rawSurv.zeroVitalTimerSec)
    : 0;
  const darknessTimerSec = isFiniteNumber(rawSurv.darknessTimerSec)
    ? Math.max(0, rawSurv.darknessTimerSec)
    : 0;

  if (health <= 0) {
    // Do not restore a dead/collapsed save
    return { status: 'corrupt', state: null };
  }

  const validatedSurvival: SurvivalState = {
    health,
    stamina,
    maxStamina,
    hunger,
    thirst,
    zeroVitalTimerSec,
    darknessTimerSec,
    isCollapsed: false,
    vitalZeroWarned: Boolean(rawSurv.vitalZeroWarned),
  };

  // Validate collectedIds
  if (!Array.isArray(working.collectedIds)) {
    return { status: 'corrupt', state: null };
  }
  const collectedIds: string[] = [];
  for (const item of working.collectedIds) {
    if (typeof item !== 'string') {
      return { status: 'corrupt', state: null };
    }
    if (KNOWN_INTERACTABLE_IDS.has(item) && !collectedIds.includes(item)) {
      collectedIds.push(item);
    }
  }

  // Validate droppedItems
  const droppedItems: DroppedWorldItem[] = [];
  if (working.droppedItems !== undefined) {
    if (!Array.isArray(working.droppedItems)) {
      return { status: 'corrupt', state: null };
    }
    for (const rawDrop of working.droppedItems) {
      if (!isRecord(rawDrop)) {
        return { status: 'corrupt', state: null };
      }
      const dId = rawDrop.id;
      const dKind = rawDrop.kind as PickupItemType;
      const dQty = rawDrop.quantity;
      const dCond = rawDrop.condition as ItemCondition;
      const dx = rawDrop.x;
      const dz = rawDrop.z;
      const dyaw = isFiniteNumber(rawDrop.yaw) ? rawDrop.yaw : 0;
      if (
        typeof dId !== 'string' ||
        !VALID_PICKUP_KINDS.has(dKind) ||
        !isFiniteNumber(dQty) ||
        dQty <= 0 ||
        !VALID_CONDITIONS.has(dCond) ||
        !isFiniteNumber(dx) ||
        !isFiniteNumber(dz) ||
        dx <= 0 ||
        dx >= maxWorldX ||
        dz <= 0 ||
        dz >= maxWorldZ
      ) {
        return { status: 'corrupt', state: null };
      }
      droppedItems.push({
        id: dId,
        kind: dKind,
        quantity: Math.floor(dQty),
        condition: dCond,
        x: dx,
        y: 0,
        z: dz,
        yaw: dyaw,
      });
    }
  }

  const nextDropSeq =
    isFiniteNumber(working.nextDropSeq) && working.nextDropSeq >= 1
      ? Math.floor(working.nextDropSeq)
      : droppedItems.length + 1;

  // Validate ropeState
  if (!isRecord(working.ropeState)) {
    return { status: 'corrupt', state: null };
  }
  const { ropeTied, gapApproachHintTriggered } = working.ropeState;
  if (
    typeof ropeTied !== 'boolean' ||
    typeof gapApproachHintTriggered !== 'boolean'
  ) {
    return { status: 'corrupt', state: null };
  }

  // Validate objective
  if (
    typeof working.objective !== 'string' ||
    !VALID_OBJECTIVES.has(working.objective as ObjectiveKey)
  ) {
    return { status: 'corrupt', state: null };
  }

  // Validate optional rememberedFaceIds
  const rememberedFaceIds: number[] = [];
  if (working.rememberedFaceIds !== undefined) {
    if (!Array.isArray(working.rememberedFaceIds)) {
      return { status: 'corrupt', state: null };
    }
    for (const fId of working.rememberedFaceIds) {
      if (isFiniteNumber(fId) && Number.isInteger(fId) && fId >= 0) {
        rememberedFaceIds.push(fId);
      }
    }
  }

  // Validate tides (required in v3)
  if (!isRecord(working.tides)) {
    return { status: 'corrupt', state: null };
  }
  const rawTides = working.tides;
  if (
    !isFiniteNumber(rawTides.waterLevel) ||
    rawTides.waterLevel < 0 ||
    rawTides.waterLevel > 1
  ) {
    return { status: 'corrupt', state: null };
  }
  const tideClockSec = isFiniteNumber(rawTides.tideClockSec)
    ? rawTides.tideClockSec
    : 0;
  const computedTide = computeTideFromClock(tideClockSec);
  const validatedTides: TideState = {
    tideClockSec: computedTide.tideClockSec,
    waterLevel: Math.max(0, Math.min(1, rawTides.waterLevel)),
    phase: computedTide.phase,
    wetExposureSec: isFiniteNumber(rawTides.wetExposureSec)
      ? Math.max(0, rawTides.wetExposureSec)
      : 0,
    dryRecoverySec: isFiniteNumber(rawTides.dryRecoverySec)
      ? Math.max(0, rawTides.dryRecoverySec)
      : 0,
    warningActive: computedTide.warningActive,
    warningIntensity: computedTide.warningIntensity,
    warningSubtitleTriggeredThisCycle: Boolean(
      rawTides.warningSubtitleTriggeredThisCycle
    ),
    highTideSubtitleTriggeredThisCycle: Boolean(
      rawTides.highTideSubtitleTriggeredThisCycle
    ),
    recededSubtitleTriggeredThisCycle: Boolean(
      rawTides.recededSubtitleTriggeredThisCycle
    ),
    safeRoomVisited: Boolean(rawTides.safeRoomVisited),
    softLockCheckTimerSec: 0,
    isSoftLocked: false,
  };

  const baseLevel: LevelProgressState = syncLevelWithInventory(
    {
      collectedIds,
      droppedItems,
      nextDropSeq,
      hasRope,
      ropeTied,
      hasArtifact,
      hasWon: false,
      foodCount: Math.floor(foodCount),
      waterCount: Math.floor(waterCount),
      gapApproachHintTriggered,
    },
    validatedInventory
  );

  const syncedMatchesCount = countItemsOfKind(
    validatedInventory,
    'matches',
    false
  );

  const validatedState: GameState = {
    version: CONFIG.SAVE_SCHEMA_VERSION,
    elapsedSec: working.elapsedSec,
    player: {
      x,
      z,
      yaw,
      pitch: Math.max(
        -CONFIG.MAX_PITCH_RAD,
        Math.min(CONFIG.MAX_PITCH_RAD, pitch)
      ),
    },
    light: {
      matchesRemaining: syncedMatchesCount,
      isLit: isLit && burnTimeRemaining > 0,
      activeSource,
      burnTimeRemaining: isLit ? burnTimeRemaining : 0,
      maxBurnDuration,
      flickerClock,
      currentReach,
      currentIntensity,
      currentFogDensity,
    },
    items: {
      hasRope: baseLevel.hasRope,
      hasArtifact: baseLevel.hasArtifact,
      foodCount: baseLevel.foodCount,
      waterCount: baseLevel.waterCount,
      ...(isRecord(working.items.extra)
        ? { extra: working.items.extra as Record<string, number> }
        : {}),
    },
    inventory: validatedInventory,
    survival: validatedSurvival,
    collectedIds,
    droppedItems,
    nextDropSeq,
    ropeState: {
      ropeTied,
      gapApproachHintTriggered,
    },
    objective: getObjectiveKey(baseLevel),
    rememberedFaceIds,
    tides: validatedTides,
    ...(isRecord(working.extensions)
      ? { extensions: working.extensions as Record<string, unknown> }
      : {}),
  };

  return {
    status: 'ok',
    state: validatedState,
  };
}

/**
 * Builds a serializable `GameState` snapshot from the live game state.
 */
export function buildGameStateSnapshot(
  player: PlayerMovementState,
  match: MatchLightState,
  level: LevelProgressState,
  inventory: InventoryState,
  survival: SurvivalState,
  tides: TideState,
  surfaceMemory: SurfaceMemoryState,
  elapsedSec: number
): GameState {
  const rememberedFaceIds: number[] = [];
  for (let i = 0; i < surfaceMemory.remembered.length; i++) {
    if (surfaceMemory.remembered[i] === 1) {
      rememberedFaceIds.push(i);
    }
  }

  return {
    version: CONFIG.SAVE_SCHEMA_VERSION,
    elapsedSec,
    player: {
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      pitch: player.pitch,
    },
    light: {
      matchesRemaining: match.matchesRemaining,
      isLit: match.isLit,
      activeSource: match.activeSource,
      burnTimeRemaining: match.burnTimeRemaining,
      maxBurnDuration: match.maxBurnDuration,
      flickerClock: match.flickerClock,
      currentReach: match.currentReach,
      currentIntensity: match.currentIntensity,
      currentFogDensity: match.currentFogDensity,
    },
    items: {
      hasRope: level.hasRope,
      hasArtifact: level.hasArtifact,
      foodCount: level.foodCount,
      waterCount: level.waterCount,
    },
    inventory: {
      items: inventory.items.map((it) => ({ ...it })),
      nextEntrySeq: inventory.nextEntrySeq,
    },
    survival: { ...survival },
    collectedIds: [...level.collectedIds],
    droppedItems: level.droppedItems.map((d) => ({ ...d })),
    nextDropSeq: level.nextDropSeq,
    ropeState: {
      ropeTied: level.ropeTied,
      gapApproachHintTriggered: level.gapApproachHintTriggered,
    },
    objective: getObjectiveKey(level),
    rememberedFaceIds,
    tides: { ...tides },
  };
}

/**
 * Loads and validates `GameState` from `localStorage` under `CONFIG.SAVE_STORAGE_KEY`.
 * Wrapped in try/catch so restricted storage never throws.
 * If corrupt or wrong version, removes or ignores the invalid entry and returns the status.
 */
export function loadGameStateFromStorage(): LoadSaveResult {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { status: 'empty', state: null };
    }
    const rawJson = window.localStorage.getItem(CONFIG.SAVE_STORAGE_KEY);
    if (rawJson === null || rawJson.trim() === '') {
      return { status: 'empty', state: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      try {
        window.localStorage.removeItem(CONFIG.SAVE_STORAGE_KEY);
      } catch {
        // ignore storage removal errors
      }
      return { status: 'corrupt', state: null };
    }

    const result = validateAndMigrateGameState(parsed);
    if (result.status === 'corrupt' || result.status === 'wrong_version') {
      try {
        window.localStorage.removeItem(CONFIG.SAVE_STORAGE_KEY);
      } catch {
        // ignore storage removal errors
      }
    }
    return result;
  } catch {
    return { status: 'empty', state: null };
  }
}

/**
 * Saves `GameState` to `localStorage` under `CONFIG.SAVE_STORAGE_KEY`, wrapped in try/catch.
 */
export function saveGameStateToStorage(state: GameState): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(CONFIG.SAVE_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears the saved `GameState` from `localStorage`, wrapped in try/catch.
 */
export function clearGameStateFromStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(CONFIG.SAVE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
