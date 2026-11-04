import { CONFIG } from '../config';
import { isWallTile, TileType } from '../data/caveMap';
import {
   isGapTile,
  ItemCondition,
  PickupItemType,
} from '../data/levelData';
import { STRINGS } from '../strings';

export interface SurvivalState {
  health: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  thirst: number;
  /** Seconds spent continuously with hunger <= 0 or thirst <= 0 */
  zeroVitalTimerSec: number;
  /** Seconds spent continuously in darkness (!isLit) */
  darknessTimerSec: number;
  /** True once health reaches 0 */
  isCollapsed: boolean;
  /** Whether the one-time subtitle warning for hitting 0 hunger/thirst has fired */
  vitalZeroWarned: boolean;
}

export interface InventoryItemEntry {
  /** Unique slot entry ID */
  id: string;
  kind: PickupItemType;
  quantity: number;
  condition: ItemCondition;
  slotCost: number;
  maxStack: number;
}

export interface InventoryState {
  items: readonly InventoryItemEntry[];
  nextEntrySeq: number;
}

export interface DroppedWorldItem {
  id: string;
  kind: PickupItemType;
  quantity: number;
  condition: ItemCondition;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface ItemMetadata {
  kind: PickupItemType;
  nameKey: keyof typeof STRINGS;
  descKey: keyof typeof STRINGS;
  slotCost: number;
  maxStack: number;
}

const ITEM_METADATA: Record<PickupItemType, ItemMetadata> = {
  matches: {
    kind: 'matches',
    nameKey: 'ITEM_NAME_MATCHES',
    descKey: 'ITEM_DESC_MATCHES',
    slotCost: CONFIG.DEFAULT_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_MATCHES,
  },
  candle: {
    kind: 'candle',
    nameKey: 'ITEM_NAME_CANDLE',
    descKey: 'ITEM_DESC_CANDLE',
    slotCost: CONFIG.DEFAULT_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_CANDLE,
  },
  food: {
    kind: 'food',
    nameKey: 'ITEM_NAME_FOOD',
    descKey: 'ITEM_DESC_FOOD',
    slotCost: CONFIG.DEFAULT_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_FOOD,
  },
  water_bottle: {
    kind: 'water_bottle',
    nameKey: 'ITEM_NAME_WATER',
    descKey: 'ITEM_DESC_WATER',
    slotCost: CONFIG.DEFAULT_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_WATER,
  },
  rope: {
    kind: 'rope',
    nameKey: 'ITEM_NAME_ROPE',
    descKey: 'ITEM_DESC_ROPE',
    slotCost: CONFIG.ROPE_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_ROPE,
  },
  artifact: {
    kind: 'artifact',
    nameKey: 'ITEM_NAME_ARTIFACT',
    descKey: 'ITEM_DESC_ARTIFACT',
    slotCost: CONFIG.DEFAULT_SLOT_COST,
    maxStack: CONFIG.STACK_MAX_ARTIFACT,
  },
};

export function getItemMetadata(kind: PickupItemType): ItemMetadata {
  return ITEM_METADATA[kind];
}

export function getConditionLabel(condition: ItemCondition): string {
  switch (condition) {
    case 'dry':
      return STRINGS.CONDITION_DRY;
    case 'wet':
      return STRINGS.CONDITION_WET;
    case 'damaged':
      return STRINGS.CONDITION_DAMAGED;
  }
}

export function createInitialSurvivalState(): SurvivalState {
  return {
    health: CONFIG.HEALTH_MAX,
    stamina: CONFIG.STAMINA_MAX,
    maxStamina: CONFIG.STAMINA_MAX,
    hunger: CONFIG.HUNGER_MAX,
    thirst: CONFIG.THIRST_MAX,
    zeroVitalTimerSec: 0,
    darknessTimerSec: 0,
    isCollapsed: false,
    vitalZeroWarned: false,
  };
}

/**
 * Creates the player's starting 12-slot inventory:
 * - 5 dry matches (1 slot)
 * - 1 dry water bottle (1 slot, giving ~10 minutes balance before critical thirst/hunger)
 */
export function createInitialInventoryState(): InventoryState {
  let state: InventoryState = {
    items: [],
    nextEntrySeq: 1,
  };
  if (CONFIG.INITIAL_MATCHES > 0) {
    state = addItemToInventory(
      state,
      'matches',
      CONFIG.INITIAL_MATCHES,
      'dry'
    ).inventory;
  }
  if (CONFIG.INITIAL_WATER_BOTTLES > 0) {
    state = addItemToInventory(
      state,
      'water_bottle',
      CONFIG.INITIAL_WATER_BOTTLES,
      'dry'
    ).inventory;
  }
  return state;
}

/**
 * Returns true if the player has enough stamina to run (cannot run below 10).
 */
export function canPlayerRun(survival: SurvivalState): boolean {
  return (
    !survival.isCollapsed && survival.stamina >= CONFIG.STAMINA_MIN_TO_RUN
  );
}

/**
 * Advances hunger, thirst, max-stamina penalty, health drain after 60s at 0 vital,
 * stamina drain/recovery, and darkness timer.
 * Pure logic function free of Three.js imports.
 */
export function stepSurvivalState(
  state: SurvivalState,
  rawDeltaSeconds: number,
  isMoving: boolean,
  isRunning: boolean,
  isLit: boolean,
  inShallowWater = false
): {
  state: SurvivalState;
  justHitVitalZero: boolean;
} {
  const dt = Math.min(Math.max(rawDeltaSeconds, 0), CONFIG.MAX_DELTA_SEC);
  if (dt <= 0 || state.isCollapsed) {
    return { state, justHitVitalZero: false };
  }

  // Hunger -1 per 6 s, Thirst -1 per 4 s
  const hungerDecay = dt / CONFIG.HUNGER_DECAY_SECONDS_PER_POINT;
  const thirstDecay = dt / CONFIG.THIRST_DECAY_SECONDS_PER_POINT;

  const hunger = Math.max(0, state.hunger - hungerDecay);
  const thirst = Math.max(0, state.thirst - thirstDecay);

  const isVitalZero = hunger <= 0 || thirst <= 0;
  const maxStamina = isVitalZero
    ? CONFIG.STAMINA_MAX * CONFIG.ZERO_VITAL_STAMINA_MULTIPLIER
    : CONFIG.STAMINA_MAX;

  let zeroVitalTimerSec = state.zeroVitalTimerSec;
  let health = state.health;
  let vitalZeroWarned = state.vitalZeroWarned;
  let justHitVitalZero = false;

  if (isVitalZero) {
    if (!vitalZeroWarned) {
      vitalZeroWarned = true;
      justHitVitalZero = true;
    }
    zeroVitalTimerSec += dt;
    if (zeroVitalTimerSec >= CONFIG.ZERO_VITAL_HEALTH_GRACE_SEC) {
      health = Math.max(
        0,
        health - CONFIG.ZERO_VITAL_HEALTH_LOSS_PER_SEC * dt
      );
    }
  } else {
    zeroVitalTimerSec = 0;
    vitalZeroWarned = false;
  }

  // Stamina update: running -20/s (extra cost in shallow water);
  // walking: +12/s on dry ground, or -SHALLOW_WALK_STAMINA_DRAIN_PER_SEC when wading through shallow water;
  // standing: +25/s
  let stamina = state.stamina;
  if (isMoving && isRunning) {
    const mult = inShallowWater ? CONFIG.SHALLOW_RUN_STAMINA_MULTIPLIER : 1.0;
    stamina -= CONFIG.STAMINA_RUN_DRAIN_PER_SEC * mult * dt;
  } else if (isMoving) {
    if (inShallowWater) {
      stamina -= CONFIG.SHALLOW_WALK_STAMINA_DRAIN_PER_SEC * dt;
    } else {
      stamina += CONFIG.STAMINA_WALK_RECOVERY_PER_SEC * dt;
    }
  } else {
    stamina += CONFIG.STAMINA_IDLE_RECOVERY_PER_SEC * dt;
  }
  stamina = Math.max(0, Math.min(maxStamina, stamina));

  // Track continuous time in darkness for heartbeat audio (starts after 10 s in darkness, fades when light returns)
  let darknessTimerSec = state.darknessTimerSec;
  if (!isLit) {
    darknessTimerSec += dt;
  } else {
    darknessTimerSec = 0;
  }

  const isCollapsed = health <= 0;

  return {
    state: {
      health,
      stamina,
      maxStamina,
      hunger,
      thirst,
      zeroVitalTimerSec,
      darknessTimerSec,
      isCollapsed,
      vitalZeroWarned,
    },
    justHitVitalZero,
  };
}

export function restoreHunger(
  state: SurvivalState,
  condition: ItemCondition
): SurvivalState {
  const amount =
    condition === 'dry'
      ? CONFIG.FOOD_HUNGER_RESTORE
      : CONFIG.FOOD_DAMAGED_RESTORE;
  const hunger = Math.min(CONFIG.HUNGER_MAX, state.hunger + amount);
  const isVitalZero = hunger <= 0 || state.thirst <= 0;
  return {
    ...state,
    hunger,
    maxStamina: isVitalZero
      ? CONFIG.STAMINA_MAX * CONFIG.ZERO_VITAL_STAMINA_MULTIPLIER
      : CONFIG.STAMINA_MAX,
    zeroVitalTimerSec: isVitalZero ? state.zeroVitalTimerSec : 0,
    vitalZeroWarned: isVitalZero ? state.vitalZeroWarned : false,
  };
}

export function restoreThirst(
  state: SurvivalState,
  condition: ItemCondition
): SurvivalState {
  const amount =
    condition === 'dry'
      ? CONFIG.WATER_THIRST_RESTORE
      : CONFIG.WATER_DAMAGED_RESTORE;
  const thirst = Math.min(CONFIG.THIRST_MAX, state.thirst + amount);
  const isVitalZero = state.hunger <= 0 || thirst <= 0;
  return {
    ...state,
    thirst,
    maxStamina: isVitalZero
      ? CONFIG.STAMINA_MAX * CONFIG.ZERO_VITAL_STAMINA_MULTIPLIER
      : CONFIG.STAMINA_MAX,
    zeroVitalTimerSec: isVitalZero ? state.zeroVitalTimerSec : 0,
    vitalZeroWarned: isVitalZero ? state.vitalZeroWarned : false,
  };
}

/**
 * Total slots currently occupied in the 12-slot inventory.
 * Each stack entry occupies `entry.slotCost` slots (1 for normal items, 2 for rope).
 */
export function getUsedInventorySlots(inventory: InventoryState): number {
  let used = 0;
  for (const item of inventory.items) {
    used += item.slotCost;
  }
  return used;
}

export function getFreeInventorySlots(inventory: InventoryState): number {
  return Math.max(0, CONFIG.INVENTORY_MAX_SLOTS - getUsedInventorySlots(inventory));
}

/**
 * Checks whether `quantity` of `(kind, condition)` can fit in the 12-slot inventory.
 */
export function canAddItemToInventory(
  inventory: InventoryState,
  kind: PickupItemType,
  quantity: number,
  condition: ItemCondition
): boolean {
  if (quantity <= 0) return true;
  const meta = getItemMetadata(kind);

  let remainingToFit = quantity;
  for (const entry of inventory.items) {
    if (
      entry.kind === kind &&
      entry.condition === condition &&
      entry.quantity < entry.maxStack
    ) {
      remainingToFit -= entry.maxStack - entry.quantity;
      if (remainingToFit <= 0) {
        return true;
      }
    }
  }

  const newStacksNeeded = Math.ceil(remainingToFit / meta.maxStack);
  const additionalSlotsNeeded = newStacksNeeded * meta.slotCost;
  return getFreeInventorySlots(inventory) >= additionalSlotsNeeded;
}

/**
 * Attempts to add `quantity` of `(kind, condition)` to the 12-slot inventory.
 * If it does not fit, returns `{ inventory, added: false }` without modifying the inventory.
 */
export function addItemToInventory(
  inventory: InventoryState,
  kind: PickupItemType,
  quantity: number,
  condition: ItemCondition
): {
  inventory: InventoryState;
  added: boolean;
} {
  if (!canAddItemToInventory(inventory, kind, quantity, condition)) {
    return { inventory, added: false };
  }

  const meta = getItemMetadata(kind);
  let remaining = quantity;
  let nextSeq = inventory.nextEntrySeq;
  const nextItems: InventoryItemEntry[] = inventory.items.map((item) => ({
    ...item,
  }));

  // First fill existing partial stacks of the same kind + condition
  for (const entry of nextItems) {
    if (remaining <= 0) break;
    if (
      entry.kind === kind &&
      entry.condition === condition &&
      entry.quantity < entry.maxStack
    ) {
      const space = entry.maxStack - entry.quantity;
      const addNow = Math.min(space, remaining);
      entry.quantity += addNow;
      remaining -= addNow;
    }
  }

  // Create new slot entries for any remaining quantity
  while (remaining > 0) {
    const addNow = Math.min(meta.maxStack, remaining);
    nextItems.push({
      id: `inv_${nextSeq++}`,
      kind,
      quantity: addNow,
      condition,
      slotCost: meta.slotCost,
      maxStack: meta.maxStack,
    });
    remaining -= addNow;
  }

  return {
    inventory: {
      items: nextItems,
      nextEntrySeq: nextSeq,
    },
    added: true,
  };
}

/**
 * Consumes `count` units from a specific inventory entry by `entryId`.
 */
export function consumeFromInventoryEntry(
  inventory: InventoryState,
  entryId: string,
  count = 1
): {
  inventory: InventoryState;
  consumedItem: InventoryItemEntry | null;
} {
  const idx = inventory.items.findIndex((it) => it.id === entryId);
  if (idx === -1) {
    return { inventory, consumedItem: null };
  }
  const target = inventory.items[idx];
  if (target.quantity < count) {
    return { inventory, consumedItem: null };
  }

  const nextItems: InventoryItemEntry[] = [];
  for (let i = 0; i < inventory.items.length; i++) {
    if (i !== idx) {
      nextItems.push(inventory.items[i]);
    } else if (target.quantity > count) {
      nextItems.push({
        ...target,
        quantity: target.quantity - count,
      });
    }
  }

  return {
    inventory: {
      ...inventory,
      items: nextItems,
    },
    consumedItem: target,
  };
}

/**
 * Consumes 1 item of `kind` matching the predicate (e.g., dry/damaged matches or rope).
 */
export function consumeFirstMatchingItem(
  inventory: InventoryState,
  kind: PickupItemType,
  predicate?: (item: InventoryItemEntry) => boolean
): {
  inventory: InventoryState;
  consumedItem: InventoryItemEntry | null;
} {
  const found = inventory.items.find(
    (it) => it.kind === kind && (!predicate || predicate(it))
  );
  if (!found) {
    return { inventory, consumedItem: null };
  }
  return consumeFromInventoryEntry(inventory, found.id, 1);
}

export function countItemsOfKind(
  inventory: InventoryState,
  kind: PickupItemType,
  onlyDryOrDamaged = false
): number {
  let total = 0;
  for (const item of inventory.items) {
    if (item.kind !== kind) continue;
    if (onlyDryOrDamaged && item.condition === 'wet') continue;
    total += item.quantity;
  }
  return total;
}

export function hasItemInInventory(
  inventory: InventoryState,
  kind: PickupItemType
): boolean {
  return inventory.items.some((it) => it.kind === kind && it.quantity > 0);
}

/**
 * Returns true if the inventory currently holds any wet items (such as wet matches or candles).
 */
export function hasAnyWetItemsInInventory(inventory: InventoryState): boolean {
  return inventory.items.some((it) => it.condition === 'wet' && it.quantity > 0);
}

/**
 * Returns true if the inventory holds any dry matches or candles that can become wet.
 */
export function hasAnyDrySensitiveItemsInInventory(
  inventory: InventoryState
): boolean {
  return inventory.items.some(
    (it) =>
      it.condition === 'dry' &&
      (it.kind === 'matches' || it.kind === 'candle') &&
      it.quantity > 0
  );
}

/**
 * Re-packs inventory items after a condition change (e.g., dry -> wet or wet -> dry)
 * so stacks of identical `(kind, condition)` merge cleanly without exceeding 12 slots.
 */
function repackInventory(
  entries: readonly InventoryItemEntry[],
  nextEntrySeq: number
): InventoryState {
  let state: InventoryState = {
    items: [],
    nextEntrySeq,
  };
  for (const entry of entries) {
    const res = addItemToInventory(
      state,
      entry.kind,
      entry.quantity,
      entry.condition
    );
    if (res.added) {
      state = res.inventory;
    } else {
      state = {
        items: [...state.items, { ...entry }],
        nextEntrySeq: state.nextEntrySeq,
      };
    }
  }
  return state;
}

/**
 * Marks dry matches and candles in the player's inventory as `'wet'` after > 3 s in water.
 */
export function wetInventoryItems(inventory: InventoryState): {
  inventory: InventoryState;
  changed: boolean;
} {
  let changed = false;
  const updated = inventory.items.map((it) => {
    if (
      it.condition === 'dry' &&
      (it.kind === 'matches' || it.kind === 'candle')
    ) {
      changed = true;
      return {
        ...it,
        condition: 'wet' as ItemCondition,
      };
    }
    return it;
  });

  if (!changed) {
    return { inventory, changed: false };
  }
  return {
    inventory: repackInventory(updated, inventory.nextEntrySeq),
    changed: true,
  };
}

/**
 * Dries all `'wet'` items in the player's inventory back to `'dry'` after 40 s in a dry safe area.
 */
export function dryInventoryItems(inventory: InventoryState): {
  inventory: InventoryState;
  changed: boolean;
} {
  let changed = false;
  const updated = inventory.items.map((it) => {
    if (it.condition === 'wet') {
      changed = true;
      return {
        ...it,
        condition: 'dry' as ItemCondition,
      };
    }
    return it;
  });

  if (!changed) {
    return { inventory, changed: false };
  }
  return {
    inventory: repackInventory(updated, inventory.nextEntrySeq),
    changed: true,
  };
}

/**
 * Drops an inventory entry onto the cave floor in front of the player,
 * clamping to walkable non-wall, non-pit space so it never lands inside a wall or chasm.
 */
export function dropInventoryEntryToWorld(
  inventory: InventoryState,
  entryId: string,
  playerX: number,
  playerZ: number,
  playerYaw: number,
  map: readonly (readonly TileType[])[],
  nextDropSeq: number
): {
  inventory: InventoryState;
  droppedItem: DroppedWorldItem | null;
} {
  const idx = inventory.items.findIndex((it) => it.id === entryId);
  if (idx === -1) {
    return { inventory, droppedItem: null };
  }

  const target = inventory.items[idx];
  // For matches, drop up to PICKUP_MATCHES_COUNT (or remaining stack); for other items drop 1 unit
  const dropQty =
    target.kind === 'matches'
      ? Math.min(target.quantity, CONFIG.PICKUP_MATCHES_COUNT)
      : 1;

  const { inventory: nextInv } = consumeFromInventoryEntry(
    inventory,
    entryId,
    dropQty
  );

  const sinYaw = Math.sin(playerYaw);
  const cosYaw = Math.cos(playerYaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;

  const ts = CONFIG.TILE_SIZE;
  let dropX = playerX + fwdX * CONFIG.DROP_ITEM_FORWARD_OFFSET;
  let dropZ = playerZ + fwdZ * CONFIG.DROP_ITEM_FORWARD_OFFSET;

  const candCol = Math.floor(dropX / ts);
  const candRow = Math.floor(dropZ / ts);

  // If the forward point lands in a wall or gap tile, place right at the player's feet with a small jitter
  if (isWallTile(map, candCol, candRow) || isGapTile(candCol, candRow)) {
    const jitterAngle = (nextDropSeq * 1.618) % (Math.PI * 2);
    dropX = playerX + Math.cos(jitterAngle) * 0.22;
    dropZ = playerZ + Math.sin(jitterAngle) * 0.22;
  } else {
    // Keep safe margin from adjacent wall edges
    const margin = 0.35;
    if (isWallTile(map, candCol - 1, candRow)) {
      dropX = Math.max(dropX, candCol * ts + margin);
    }
    if (isWallTile(map, candCol + 1, candRow)) {
      dropX = Math.min(dropX, (candCol + 1) * ts - margin);
    }
    if (isWallTile(map, candCol, candRow - 1)) {
      dropZ = Math.max(dropZ, candRow * ts + margin);
    }
    if (isWallTile(map, candCol, candRow + 1)) {
      dropZ = Math.min(dropZ, (candRow + 1) * ts - margin);
    }
  }

  const droppedItem: DroppedWorldItem = {
    id: `dropped_${nextDropSeq}`,
    kind: target.kind,
    quantity: dropQty,
    condition: target.condition,
    x: dropX,
    y: 0,
    z: dropZ,
    yaw: playerYaw + 0.3 * (nextDropSeq % 5),
  };

  return {
    inventory: nextInv,
    droppedItem,
  };
}
