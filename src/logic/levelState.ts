import { CONFIG } from '../config';
import {
  InteractableKind,
  ItemCondition,
  LEVEL_GAP,
  LEVEL_INTERACTABLES,
  LevelInteractableDef,
  PickupItemType,
} from '../data/levelData';
import { STRINGS } from '../strings';
import { MatchLightState } from './lightAndMemory';
import {
  addItemToInventory,
  consumeFirstMatchingItem,
  countItemsOfKind,
  DroppedWorldItem,
  hasItemInInventory,
  InventoryState,
} from './survivalAndInventory';

export type SubtitleKey =
  | 'SUB_INTRO'
  | 'SUB_PICKUP_MATCHES'
  | 'SUB_PICKUP_MATCHES_WET'
  | 'SUB_PICKUP_CANDLE'
  | 'SUB_PICKUP_ROPE'
  | 'SUB_PICKUP_FOOD'
  | 'SUB_PICKUP_WATER'
  | 'SUB_INVENTORY_FULL'
  | 'SUB_WET_MATCH_FAIL'
  | 'SUB_WET_CANDLE_FAIL'
  | 'SUB_CANDLE_LIT'
  | 'SUB_CANDLE_WET_OUT'
  | 'SUB_USE_FOOD'
  | 'SUB_USE_WATER'
  | 'SUB_USE_ROPE_HINT'
  | 'SUB_USE_ARTIFACT_HINT'
  | 'SUB_DROP_ITEM'
  | 'SUB_VITAL_ZERO_WARNING'
  | 'SUB_GAP_NO_ROPE'
  | 'SUB_ANCHOR_NO_ROPE'
  | 'SUB_GAP_HAVE_ROPE'
  | 'SUB_ROPE_TIED'
  | 'SUB_ROPE_ALREADY_TIED'
  | 'SUB_PICKUP_ARTIFACT'
  | 'SUB_EXIT_NO_ARTIFACT'
  | 'SUB_TIDE_WARNING_20S'
  | 'SUB_TIDE_HIGH_FLOODED'
  | 'SUB_TIDE_RECEDED'
  | 'SUB_ITEMS_BECAME_WET'
  | 'SUB_ITEMS_DRIED'
  | 'SUB_SAFE_ROOM_ENTER'
  | 'SUB_SOFTLOCK_DETECTED';

export type PromptKey =
  | 'PROMPT_PICKUP_MATCHES'
  | 'PROMPT_PICKUP_CANDLE'
  | 'PROMPT_PICKUP_ROPE'
  | 'PROMPT_PICKUP_FOOD'
  | 'PROMPT_PICKUP_WATER'
  | 'PROMPT_TIE_ROPE'
  | 'PROMPT_INSPECT_ANCHOR'
  | 'PROMPT_INSPECT_GAP'
  | 'PROMPT_PICKUP_ARTIFACT'
  | 'PROMPT_USE_EXIT';

export type ObjectiveKey =
  | 'OBJ_FIND_ROPE'
  | 'OBJ_TIE_ROPE'
  | 'OBJ_FIND_ARTIFACT'
  | 'OBJ_RETURN_EXIT';

export type InteractionAudioEvent =
  | 'pickup'
  | 'tie_rope'
  | 'artifact'
  | 'win'
  | null;

export interface SubtitleQueueState {
  activeKey: SubtitleKey | null;
  remainingSec: number;
  cooldownSec: number;
  queue: readonly SubtitleKey[];
}

export interface LevelProgressState {
  collectedIds: readonly string[];
  droppedItems: readonly DroppedWorldItem[];
  nextDropSeq: number;
  hasRope: boolean;
  ropeTied: boolean;
  hasArtifact: boolean;
  hasWon: boolean;
  foodCount: number;
  waterCount: number;
  gapApproachHintTriggered: boolean;
}

export function createInitialSubtitleQueue(): SubtitleQueueState {
  return {
    activeKey: 'SUB_INTRO',
    remainingSec: CONFIG.SUBTITLE_DURATION_SEC,
    cooldownSec: 0,
    queue: [],
  };
}

export function createInitialLevelProgress(): LevelProgressState {
  return {
    collectedIds: [],
    droppedItems: [],
    nextDropSeq: 1,
    hasRope: false,
    ropeTied: false,
    hasArtifact: false,
    hasWon: false,
    foodCount: 0,
    waterCount: CONFIG.INITIAL_WATER_BOTTLES,
    gapApproachHintTriggered: false,
  };
}

/**
 * Synchronizes derived item flags on LevelProgressState with the live 12-slot inventory.
 */
export function syncLevelWithInventory(
  level: LevelProgressState,
  inventory: InventoryState
): LevelProgressState {
  return {
    ...level,
    hasRope: level.ropeTied || hasItemInInventory(inventory, 'rope'),
    hasArtifact: hasItemInInventory(inventory, 'artifact'),
    foodCount: countItemsOfKind(inventory, 'food', false),
    waterCount: countItemsOfKind(inventory, 'water_bottle', false),
  };
}

export function enqueueSubtitle(
  state: SubtitleQueueState,
  key: SubtitleKey,
  immediateIfHint = false
): SubtitleQueueState {
  if (state.activeKey === key) {
    return {
      ...state,
      remainingSec: CONFIG.SUBTITLE_DURATION_SEC,
    };
  }

  if (immediateIfHint || state.activeKey === null) {
    const filteredQueue = state.queue.filter((k) => k !== key);
    return {
      activeKey: key,
      remainingSec: CONFIG.SUBTITLE_DURATION_SEC,
      cooldownSec: 0,
      queue: filteredQueue,
    };
  }

  const lastQueued =
    state.queue.length > 0
      ? state.queue[state.queue.length - 1]
      : state.activeKey;
  if (lastQueued === key) {
    return state;
  }

  return {
    ...state,
    queue: [...state.queue, key],
  };
}

export function stepSubtitleQueue(
  state: SubtitleQueueState,
  rawDeltaSeconds: number
): SubtitleQueueState {
  const dt = Math.min(Math.max(rawDeltaSeconds, 0), CONFIG.MAX_DELTA_SEC);
  if (dt <= 0) return state;

  if (state.activeKey !== null) {
    const nextRemaining = state.remainingSec - dt;
    if (nextRemaining > 0) {
      return {
        ...state,
        remainingSec: nextRemaining,
      };
    }

    return {
      activeKey: null,
      remainingSec: 0,
      cooldownSec: state.queue.length > 0 ? CONFIG.SUBTITLE_GAP_SEC : 0,
      queue: state.queue,
    };
  }

  if (state.queue.length > 0) {
    const nextCooldown = state.cooldownSec - dt;
    if (nextCooldown > 0) {
      return {
        ...state,
        cooldownSec: nextCooldown,
      };
    }
    const [nextKey, ...rest] = state.queue;
    return {
      activeKey: nextKey,
      remainingSec: CONFIG.SUBTITLE_DURATION_SEC,
      cooldownSec: 0,
      queue: rest,
    };
  }

  return state;
}

export function isInteractableCollected(
  level: LevelProgressState,
  id: string
): boolean {
  return level.collectedIds.includes(id);
}

export function findInteractableById(
  id: string
): LevelInteractableDef | undefined {
  return LEVEL_INTERACTABLES.find((item) => item.id === id);
}

export function findDroppedItemById(
  level: LevelProgressState,
  id: string
): DroppedWorldItem | undefined {
  return level.droppedItems.find((item) => item.id === id);
}

export function getObjectiveKey(level: LevelProgressState): ObjectiveKey {
  if (level.hasArtifact) {
    return 'OBJ_RETURN_EXIT';
  }
  if (level.ropeTied) {
    return 'OBJ_FIND_ARTIFACT';
  }
  if (level.hasRope) {
    return 'OBJ_TIE_ROPE';
  }
  return 'OBJ_FIND_ROPE';
}

export function getObjectiveText(level: LevelProgressState): string {
  return STRINGS[getObjectiveKey(level)];
}

export function getPromptKeyForPickupKind(kind: PickupItemType): PromptKey {
  switch (kind) {
    case 'matches':
      return 'PROMPT_PICKUP_MATCHES';
    case 'candle':
      return 'PROMPT_PICKUP_CANDLE';
    case 'rope':
      return 'PROMPT_PICKUP_ROPE';
    case 'food':
      return 'PROMPT_PICKUP_FOOD';
    case 'water_bottle':
      return 'PROMPT_PICKUP_WATER';
    case 'artifact':
      return 'PROMPT_PICKUP_ARTIFACT';
  }
}

/**
 * Determines the Vietnamese interaction prompt key (`[E] ...`) when an interactable
 * is hit by the center-screen raycast within 2.0 metres.
 */
export function getInteractionPromptKey(
  targetId: string | null,
  level: LevelProgressState
): PromptKey | null {
  if (!targetId || level.hasWon) return null;

  const dropped = findDroppedItemById(level, targetId);
  if (dropped) {
    return getPromptKeyForPickupKind(dropped.kind);
  }

  if (isInteractableCollected(level, targetId)) return null;

  const def = findInteractableById(targetId);
  if (!def) return null;

  switch (def.kind) {
    case 'matches':
    case 'candle':
    case 'rope':
    case 'food':
    case 'water_bottle':
    case 'artifact':
      return getPromptKeyForPickupKind(def.kind);
    case 'rope_anchor':
      if (level.ropeTied) return null;
      return level.hasRope ? 'PROMPT_TIE_ROPE' : 'PROMPT_INSPECT_ANCHOR';
    case 'gap':
      if (level.ropeTied) return null;
      return 'PROMPT_INSPECT_GAP';
    case 'exit':
      return 'PROMPT_USE_EXIT';
    default:
      return null;
  }
}

export function getInteractionPromptText(
  targetId: string | null,
  level: LevelProgressState
): string | null {
  const key = getInteractionPromptKey(targetId, level);
  return key ? STRINGS[key] : null;
}

export function isPickupKind(kind: InteractableKind): kind is PickupItemType {
  return (
    kind === 'matches' ||
    kind === 'candle' ||
    kind === 'rope' ||
    kind === 'food' ||
    kind === 'water_bottle' ||
    kind === 'artifact'
  );
}

function getPickupSubtitleKey(
  kind: PickupItemType,
  condition: ItemCondition
): SubtitleKey {
  switch (kind) {
    case 'matches':
      return condition === 'wet'
        ? 'SUB_PICKUP_MATCHES_WET'
        : 'SUB_PICKUP_MATCHES';
    case 'candle':
      return 'SUB_PICKUP_CANDLE';
    case 'rope':
      return 'SUB_PICKUP_ROPE';
    case 'food':
      return 'SUB_PICKUP_FOOD';
    case 'water_bottle':
      return 'SUB_PICKUP_WATER';
    case 'artifact':
      return 'SUB_PICKUP_ARTIFACT';
  }
}

/**
 * Executes `[E]` interaction on the currently targeted interactable (within 2m).
 * If picking up an item and the 12-slot inventory is full, leaves the item in the world
 * and queues a Vietnamese subtitle message (`SUB_INVENTORY_FULL`).
 * Pure logic function free of Three.js imports.
 */
export function executeInteraction(
  targetId: string | null,
  level: LevelProgressState,
  matchState: MatchLightState,
  inventory: InventoryState,
  subtitles: SubtitleQueueState
): {
  level: LevelProgressState;
  matchState: MatchLightState;
  inventory: InventoryState;
  subtitles: SubtitleQueueState;
  audioEvent: InteractionAudioEvent;
} {
  if (!targetId || level.hasWon) {
    return { level, matchState, inventory, subtitles, audioEvent: null };
  }

  // 1. Check if interacting with a dropped item on the cave floor
  const dropped = findDroppedItemById(level, targetId);
  if (dropped) {
    const addRes = addItemToInventory(
      inventory,
      dropped.kind,
      dropped.quantity,
      dropped.condition
    );
    if (!addRes.added) {
      return {
        level,
        matchState,
        inventory,
        subtitles: enqueueSubtitle(subtitles, 'SUB_INVENTORY_FULL', true),
        audioEvent: null,
      };
    }

    const nextInventory = addRes.inventory;
    const nextLevel = syncLevelWithInventory(
      {
        ...level,
        droppedItems: level.droppedItems.filter((it) => it.id !== dropped.id),
      },
      nextInventory
    );
    const nextMatch: MatchLightState = {
      ...matchState,
      matchesRemaining: countItemsOfKind(nextInventory, 'matches', false),
    };
    const subKey = getPickupSubtitleKey(dropped.kind, dropped.condition);
    return {
      level: nextLevel,
      matchState: nextMatch,
      inventory: nextInventory,
      subtitles: enqueueSubtitle(subtitles, subKey, true),
      audioEvent: dropped.kind === 'artifact' ? 'artifact' : 'pickup',
    };
  }

  // 2. Static level interactables
  if (isInteractableCollected(level, targetId)) {
    return { level, matchState, inventory, subtitles, audioEvent: null };
  }

  const def = findInteractableById(targetId);
  if (!def) {
    return { level, matchState, inventory, subtitles, audioEvent: null };
  }

  if (isPickupKind(def.kind)) {
    const qty =
      def.quantity ??
      (def.kind === 'matches' ? CONFIG.PICKUP_MATCHES_COUNT : 1);
    const cond: ItemCondition = def.condition ?? 'dry';

    const addRes = addItemToInventory(inventory, def.kind, qty, cond);
    if (!addRes.added) {
      // Full inventory: leave item in the world and show subtitle message
      return {
        level,
        matchState,
        inventory,
        subtitles: enqueueSubtitle(subtitles, 'SUB_INVENTORY_FULL', true),
        audioEvent: null,
      };
    }

    const nextInventory = addRes.inventory;
    const nextLevel = syncLevelWithInventory(
      {
        ...level,
        collectedIds: [...level.collectedIds, def.id],
      },
      nextInventory
    );
    const nextMatch: MatchLightState = {
      ...matchState,
      matchesRemaining: countItemsOfKind(nextInventory, 'matches', false),
    };
    const subKey = getPickupSubtitleKey(def.kind, cond);
    return {
      level: nextLevel,
      matchState: nextMatch,
      inventory: nextInventory,
      subtitles: enqueueSubtitle(subtitles, subKey, true),
      audioEvent: def.kind === 'artifact' ? 'artifact' : 'pickup',
    };
  }

  switch (def.kind) {
    case 'rope_anchor': {
      if (level.ropeTied) {
        return {
          level,
          matchState,
          inventory,
          subtitles: enqueueSubtitle(subtitles, 'SUB_ROPE_ALREADY_TIED', true),
          audioEvent: null,
        };
      }
      if (!hasItemInInventory(inventory, 'rope')) {
        return {
          level,
          matchState,
          inventory,
          subtitles: enqueueSubtitle(subtitles, 'SUB_ANCHOR_NO_ROPE', true),
          audioEvent: null,
        };
      }
      const consumedRope = consumeFirstMatchingItem(inventory, 'rope');
      const nextInventory = consumedRope.inventory;
      const nextLevel = syncLevelWithInventory(
        {
          ...level,
          ropeTied: true,
        },
        nextInventory
      );
      const nextSubs = enqueueSubtitle(subtitles, 'SUB_ROPE_TIED', true);
      return {
        level: nextLevel,
        matchState,
        inventory: nextInventory,
        subtitles: nextSubs,
        audioEvent: 'tie_rope',
      };
    }

    case 'gap': {
      if (level.ropeTied) {
        return { level, matchState, inventory, subtitles, audioEvent: null };
      }
      const hintKey: SubtitleKey = level.hasRope
        ? 'SUB_GAP_HAVE_ROPE'
        : 'SUB_GAP_NO_ROPE';
      return {
        level,
        matchState,
        inventory,
        subtitles: enqueueSubtitle(subtitles, hintKey, true),
        audioEvent: null,
      };
    }

    case 'exit': {
      if (!level.hasArtifact) {
        return {
          level,
          matchState,
          inventory,
          subtitles: enqueueSubtitle(subtitles, 'SUB_EXIT_NO_ARTIFACT', true),
          audioEvent: null,
        };
      }
      const nextLevel: LevelProgressState = {
        ...level,
        hasWon: true,
      };
      return {
        level: nextLevel,
        matchState,
        inventory,
        subtitles,
        audioEvent: 'win',
      };
    }
  }
}

/**
 * Checks if the player walks right up to the impassable gap edge without the rope,
 * automatically queueing a subtitle hint the first time they reach the chasm rim.
 */
export function checkGapEdgeProximityHint(
  playerX: number,
  playerZ: number,
  level: LevelProgressState,
  subtitles: SubtitleQueueState
): {
  level: LevelProgressState;
  subtitles: SubtitleQueueState;
} {
  if (level.ropeTied || level.gapApproachHintTriggered) {
    return { level, subtitles };
  }

  const inXSpan =
    playerX >= LEVEL_GAP.minX - 0.5 && playerX <= LEVEL_GAP.maxX + 0.5;
  const distToNorthLip = Math.abs(playerZ - LEVEL_GAP.minZ);

  if (inXSpan && distToNorthLip <= CONFIG.GAP_APPROACH_HINT_DIST) {
    const key: SubtitleKey = level.hasRope
      ? 'SUB_GAP_HAVE_ROPE'
      : 'SUB_GAP_NO_ROPE';
    return {
      level: {
        ...level,
        gapApproachHintTriggered: true,
      },
      subtitles: enqueueSubtitle(subtitles, key, false),
    };
  }

  return { level, subtitles };
}

