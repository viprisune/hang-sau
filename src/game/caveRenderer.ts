import * as THREE from 'three';
import { ComfortSettings, CONFIG } from '../config';
import {
  CAVE_MAP,
  PLAYER_INITIAL_YAW,
  PLAYER_SPAWN_TILE,
  tileToWorldCenter,
} from '../data/caveMap';
import {
  getTileFloorElevation,
  getTileWaterStatus,
  isDrySafeTile,
  isSafeSanctuaryChamberTile,
} from '../data/levelData';
import { createCaveAudioEngine } from '../audio/caveAudio';
import { buildCaveMesh } from './caveGeometry';
import { buildInteractableScene } from './interactableMeshes';
import { buildWaterSurfaceMesh } from './waterMesh';
import {
  checkGapEdgeProximityHint,
  createInitialLevelProgress,
  createInitialSubtitleQueue,
  enqueueSubtitle,
  executeInteraction,
  getInteractionPromptKey,
  getObjectiveKey,
  LevelProgressState,
  ObjectiveKey,
  PromptKey,
  stepSubtitleQueue,
  SubtitleKey,
  SubtitleQueueState,
  syncLevelWithInventory,
} from '../logic/levelState';
import {
  computeCameraSwayRoll,
  computeMatchLightPosition,
  createInitialMatchLightState,
  createSurfaceMemoryState,
  LightSourceKind,
  MatchLightState,
  MatchStatusMessageKey,
  stepMatchLight,
  SurfaceMemoryState,
  tryLightInventoryEntry,
  tryStrikeMatchWithInventory,
  updateRememberedTileFaces,
} from '../logic/lightAndMemory';
import {
  applyMouseLook,
  MovementInput,
  PlayerMovementState,
  stepPlayerMovement,
} from '../logic/movement';
import {
  buildGameStateSnapshot,
  GameState,
  saveGameStateToStorage,
} from '../logic/saveGame';
import {
  canPlayerRun,
  consumeFromInventoryEntry,
  countItemsOfKind,
  createInitialInventoryState,
  createInitialSurvivalState,
  dropInventoryEntryToWorld,
  dryInventoryItems,
  getUsedInventorySlots,
  hasAnyDrySensitiveItemsInInventory,
  hasAnyWetItemsInInventory,
  InventoryItemEntry,
  InventoryState,
  restoreHunger,
  restoreThirst,
  stepSurvivalState,
  SurvivalState,
  wetInventoryItems,
} from '../logic/survivalAndInventory';
import {
  createInitialTideState,
  jumpToNextTidePhase,
  stepTideSystem,
  TidePhase,
  TideState,
} from '../logic/tideSystem';

export interface DebugMetrics {
  fps: number;
  x: number;
  y: number;
  z: number;
  col: number;
  row: number;
  speed: number;
  isMoving: boolean;
  isRunning: boolean;
  drawCalls: number;
  waterLevel: number;
  tidePhase: TidePhase;
  tideClockSec: number;
}

export interface HudLightSnapshot {
  matchesRemaining: number;
  candlesRemaining: number;
  isLit: boolean;
  activeSource: LightSourceKind;
  burnTimeRemaining: number;
  maxBurnDuration: number;
  statusMessageKey: MatchStatusMessageKey;
  promptKey: PromptKey | null;
  subtitleKey: SubtitleKey | null;
  objectiveKey: ObjectiveKey;
  hasRope: boolean;
  ropeTied: boolean;
  hasArtifact: boolean;
  foodCount: number;
  waterCount: number;
  hasWon: boolean;
  isCollapsed: boolean;
  health: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  thirst: number;
  inventoryItems: readonly InventoryItemEntry[];
  usedSlots: number;
  maxSlots: number;
  waterLevel: number;
  tidePhase: TidePhase;
  tideWarningActive: boolean;
  wetExposureSec: number;
  dryRecoverySec: number;
  hasWetItems: boolean;
  inShallowWater: boolean;
  inSafeSanctuary: boolean;
  isSoftLocked: boolean;
}

export interface CaveRendererCallbacks {
  onDebugUpdate: (metrics: DebugMetrics) => void;
  onHudUpdate: (hud: HudLightSnapshot) => void;
  onToggleDebug: () => void;
  onPauseChange: (isPaused: boolean) => void;
  onInventoryOpenChange: (isOpen: boolean) => void;
  onPointerLockFallback: () => void;
  onPointerLockStateChange: (locked: boolean) => void;
}

export interface CaveRendererController {
  updateSettings: (settings: ComfortSettings) => void;
  setPaused: (paused: boolean, requestLockOnResume?: boolean) => void;
  setInventoryOpen: (open: boolean, requestLockOnClose?: boolean) => void;
  useInventoryItem: (entryId: string) => void;
  dropInventoryItem: (entryId: string) => void;
  jumpTidePhase: () => void;
  reloadLastCheckpoint: () => void;
  restartLevel: (requestLock?: boolean) => void;
  requestPointerLock: () => void;
  dispose: () => void;
}

/**
 * Initializes the Three.js WebGLRenderer, PerspectiveCamera, 3D low-poly cave mesh,
 * level interactable meshes, translucent low-poly water plane (#1d3b44), center-screen
 * raycast, survival & 12-slot inventory, tide cycle, and Web Audio.
 */
export function createCaveRenderer(
  container: HTMLElement,
  initialSettings: ComfortSettings,
  initialSavedState: GameState | null,
  callbacks: CaveRendererCallbacks
): CaveRendererController {
  let settings: ComfortSettings = { ...initialSettings };
  let isPaused = false;
  let isInventoryOpen = false;
  let isPointerLocked = false;
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  // 1. WebGLRenderer (no real-time shadow maps, ACES tone mapping)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.TONE_MAPPING_EXPOSURE;
  renderer.domElement.className = 'block w-full h-full outline-none';
  container.appendChild(renderer.domElement);

  // 2. Scene & Exponential Fog
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.BACKGROUND);
  const sceneFog = new THREE.FogExp2(
    CONFIG.FOG_COLOR,
    initialSavedState?.light.currentFogDensity ?? CONFIG.FOG_DENSITY_DARK
  );
  scene.fog = sceneFog;

  // 3. First-Person PerspectiveCamera
  const camera = new THREE.PerspectiveCamera(
    settings.fov,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR
  );
  camera.rotation.order = 'YXZ';

  // 4. Lighting: Strictly 1 AmbientLight (0.03) + 1 Dynamic PointLight
  const ambientLight = new THREE.AmbientLight(
    CONFIG.AMBIENT_LIGHT_COLOR,
    CONFIG.AMBIENT_LIGHT_INTENSITY
  );
  scene.add(ambientLight);

  const playerPointLight = new THREE.PointLight(
    CONFIG.DARK_GLOW_COLOR,
    CONFIG.DARK_GLOW_INTENSITY,
    CONFIG.DARK_GLOW_REACH,
    CONFIG.DARK_GLOW_DECAY
  );
  scene.add(playerPointLight);

  const matchLightColor = new THREE.Color(CONFIG.MATCH_LIGHT_COLOR);
  const candleLightColor = new THREE.Color(CONFIG.CANDLE_LIGHT_COLOR);
  const darkGlowColor = new THREE.Color(CONFIG.DARK_GLOW_COLOR);

  // 5. Build merged low-poly cave mesh + surface memory descriptors
  const caveBundle = buildCaveMesh();
  scene.add(caveBundle.mesh);

  // 6. Build low-poly interactables + rope bridge meshes
  const interactableBundle = buildInteractableScene();
  scene.add(interactableBundle.rootGroup);

  // 7. Build translucent low-poly water plane (#1d3b44)
  const waterBundle = buildWaterSurfaceMesh();
  scene.add(waterBundle.mesh);

  // 8. Center-screen Raycaster (<= 2.0m interaction range)
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.05;
  raycaster.far = CONFIG.INTERACTION_RANGE;
  const screenCenterNDC = new THREE.Vector2(0, 0);

  // 9. Procedural Web Audio engine
  const audio = createCaveAudioEngine(settings.masterVolume, settings.muted);

  // 10. Player, Light, Memory, Level, Inventory, Survival, Tide & Subtitle state
  const spawnWorld = tileToWorldCenter(PLAYER_SPAWN_TILE);
  let playerState: PlayerMovementState = {
    x: initialSavedState ? initialSavedState.player.x : spawnWorld.x,
    z: initialSavedState ? initialSavedState.player.z : spawnWorld.z,
    vx: 0,
    vz: 0,
    speed: 0,
    yaw: initialSavedState ? initialSavedState.player.yaw : PLAYER_INITIAL_YAW,
    pitch: initialSavedState ? initialSavedState.player.pitch : 0,
    bobPhase: 0,
    bobOffsetX: 0,
    bobOffsetY: 0,
    isMoving: false,
    isRunning: false,
  };

  let inventoryState: InventoryState = initialSavedState
    ? {
        items: initialSavedState.inventory.items.map((it) => ({ ...it })),
        nextEntrySeq: initialSavedState.inventory.nextEntrySeq,
      }
    : createInitialInventoryState();

  let survivalState: SurvivalState = initialSavedState
    ? { ...initialSavedState.survival }
    : createInitialSurvivalState();

  let tideState: TideState = initialSavedState
    ? { ...initialSavedState.tides }
    : createInitialTideState();

  let matchState: MatchLightState = initialSavedState
    ? {
        ...createInitialMatchLightState(),
        matchesRemaining: countItemsOfKind(inventoryState, 'matches', false),
        isLit: initialSavedState.light.isLit,
        activeSource: initialSavedState.light.activeSource,
        burnTimeRemaining: initialSavedState.light.burnTimeRemaining,
        maxBurnDuration: initialSavedState.light.maxBurnDuration,
        flickerClock: initialSavedState.light.flickerClock,
        currentReach: initialSavedState.light.currentReach,
        currentIntensity: initialSavedState.light.currentIntensity,
        currentFogDensity: initialSavedState.light.currentFogDensity,
      }
    : createInitialMatchLightState();

  let surfaceMemory: SurfaceMemoryState = createSurfaceMemoryState(
    caveBundle.faces.length
  );

  // Restore remembered tile faces if loading from a save
  if (
    initialSavedState &&
    initialSavedState.rememberedFaceIds &&
    initialSavedState.rememberedFaceIds.length > 0
  ) {
    const validIds: number[] = [];
    for (const faceId of initialSavedState.rememberedFaceIds) {
      if (
        faceId >= 0 &&
        faceId < caveBundle.faces.length &&
        surfaceMemory.remembered[faceId] === 0
      ) {
        surfaceMemory.remembered[faceId] = 1;
        surfaceMemory.rememberedCount++;
        validIds.push(faceId);
      }
    }
    if (validIds.length > 0) {
      caveBundle.markFacesRemembered(validIds);
    }
  }

  let levelState: LevelProgressState = initialSavedState
    ? syncLevelWithInventory(
        {
          collectedIds: [...initialSavedState.collectedIds],
          droppedItems: initialSavedState.droppedItems.map((d) => ({ ...d })),
          nextDropSeq: initialSavedState.nextDropSeq,
          hasRope: initialSavedState.items.hasRope,
          ropeTied: initialSavedState.ropeState.ropeTied,
          hasArtifact: initialSavedState.items.hasArtifact,
          hasWon: false,
          foodCount: initialSavedState.items.foodCount,
          waterCount: initialSavedState.items.waterCount,
          gapApproachHintTriggered:
            initialSavedState.ropeState.gapApproachHintTriggered,
        },
        inventoryState
      )
    : syncLevelWithInventory(createInitialLevelProgress(), inventoryState);

  let subtitleState: SubtitleQueueState = initialSavedState
    ? {
        activeKey: null,
        remainingSec: 0,
        cooldownSec: 0,
        queue: [],
      }
    : createInitialSubtitleQueue();

  let currentTargetId: string | null = null;
  let elapsedSec = initialSavedState ? initialSavedState.elapsedSec : 0;
  let autosaveTimerSec = 0;
  let checkpointTimerSec = 0;
  let currentInShallowWater = false;
  let currentInSafeSanctuary = false;

  // Sync 3D meshes immediately so restored saves rebuild the world accurately
  interactableBundle.syncWithLevelState(levelState, elapsedSec);
  waterBundle.update(tideState.waterLevel, elapsedSec);

  const buildSnapshotNow = (): GameState => {
    return buildGameStateSnapshot(
      playerState,
      matchState,
      levelState,
      inventoryState,
      survivalState,
      tideState,
      surfaceMemory,
      elapsedSec
    );
  };

  // Last safe dry checkpoint in memory for soft-lock recovery
  let lastSafeCheckpoint: GameState = buildSnapshotNow();

  const saveCurrentGameState = () => {
    if (levelState.hasWon || survivalState.isCollapsed) return;
    const snapshot = buildSnapshotNow();
    saveGameStateToStorage(snapshot);
  };

  const applyCheckpointState = (snap: GameState) => {
    playerState = {
      x: snap.player.x,
      z: snap.player.z,
      vx: 0,
      vz: 0,
      speed: 0,
      yaw: snap.player.yaw,
      pitch: snap.player.pitch,
      bobPhase: 0,
      bobOffsetX: 0,
      bobOffsetY: 0,
      isMoving: false,
      isRunning: false,
    };
    inventoryState = {
      items: snap.inventory.items.map((it) => ({ ...it })),
      nextEntrySeq: snap.inventory.nextEntrySeq,
    };
    survivalState = { ...snap.survival };
    tideState = {
      ...snap.tides,
      isSoftLocked: false,
      softLockCheckTimerSec: 0,
    };
    matchState = {
      ...createInitialMatchLightState(),
      matchesRemaining: countItemsOfKind(inventoryState, 'matches', false),
      isLit: snap.light.isLit,
      activeSource: snap.light.activeSource,
      burnTimeRemaining: snap.light.burnTimeRemaining,
      maxBurnDuration: snap.light.maxBurnDuration,
      flickerClock: snap.light.flickerClock,
      currentReach: snap.light.currentReach,
      currentIntensity: snap.light.currentIntensity,
      currentFogDensity: snap.light.currentFogDensity,
    };
    levelState = syncLevelWithInventory(
      {
        collectedIds: [...snap.collectedIds],
        droppedItems: snap.droppedItems.map((d) => ({ ...d })),
        nextDropSeq: snap.nextDropSeq,
        hasRope: snap.items.hasRope,
        ropeTied: snap.ropeState.ropeTied,
        hasArtifact: snap.items.hasArtifact,
        hasWon: false,
        foodCount: snap.items.foodCount,
        waterCount: snap.items.waterCount,
        gapApproachHintTriggered: snap.ropeState.gapApproachHintTriggered,
      },
      inventoryState
    );
    elapsedSec = snap.elapsedSec;
    autosaveTimerSec = 0;
    checkpointTimerSec = 0;
    interactableBundle.syncWithLevelState(levelState, elapsedSec);
    waterBundle.update(tideState.waterLevel, elapsedSec);
    saveGameStateToStorage(snap);
  };

  const inputState: MovementInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
  };

  const clearMovementInputs = () => {
    inputState.forward = false;
    inputState.backward = false;
    inputState.left = false;
    inputState.right = false;
    inputState.run = false;
    isDraggingLook = false;
  };

  const isSimulationPaused = () =>
    isPaused ||
    document.hidden ||
    levelState.hasWon ||
    survivalState.isCollapsed;

  const syncCameraTransform = () => {
    const ts = CONFIG.TILE_SIZE;
    const camCol = Math.floor(playerState.x / ts);
    const camRow = Math.floor(playerState.z / ts);
    const floorElev = getTileFloorElevation(camCol, camRow);
    const waterDip = currentInShallowWater ? -0.05 : 0;

    const sinYaw = Math.sin(playerState.yaw);
    const cosYaw = Math.cos(playerState.yaw);
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    const eyeX = playerState.x + rightX * playerState.bobOffsetX;
    const eyeY =
      floorElev + waterDip + CONFIG.EYE_HEIGHT + playerState.bobOffsetY;
    const eyeZ = playerState.z + rightZ * playerState.bobOffsetX;

    camera.position.set(eyeX, eyeY, eyeZ);
    camera.rotation.y = playerState.yaw;
    camera.rotation.x = playerState.pitch;
    camera.rotation.z = computeCameraSwayRoll(
      playerState.bobPhase,
      playerState.isMoving,
      playerState.isRunning,
      settings.headBob
    );

    const lightPos = computeMatchLightPosition(
      CAVE_MAP,
      eyeX,
      eyeY,
      eyeZ,
      playerState.yaw
    );
    playerPointLight.position.set(lightPos.x, lightPos.y, lightPos.z);

    if (matchState.isLit) {
      playerPointLight.color.copy(
        matchState.activeSource === 'candle'
          ? candleLightColor
          : matchLightColor
      );
      playerPointLight.intensity = matchState.currentIntensity;
      playerPointLight.distance = matchState.currentReach;
      playerPointLight.decay = CONFIG.MATCH_LIGHT_DECAY;
    } else {
      playerPointLight.color.copy(darkGlowColor);
      playerPointLight.intensity = CONFIG.DARK_GLOW_INTENSITY;
      playerPointLight.distance = CONFIG.DARK_GLOW_REACH;
      playerPointLight.decay = CONFIG.DARK_GLOW_DECAY;
    }

    sceneFog.density = matchState.currentFogDensity;
  };

  /**
   * Casts a ray from the exact screen center (0, 0) up to 2.0m (`CONFIG.INTERACTION_RANGE`)
   * against all visible interactable hit volumes.
   */
  const updateRaycastTarget = () => {
    if (levelState.hasWon || survivalState.isCollapsed || isInventoryOpen) {
      currentTargetId = null;
      return;
    }
    camera.updateMatrixWorld();
    raycaster.setFromCamera(screenCenterNDC, camera);
    const hits = raycaster.intersectObjects(
      interactableBundle.hitMeshes,
      false
    );

    let bestId: string | null = null;
    for (let i = 0; i < hits.length; i++) {
      const obj = hits[i].object;
      if (!obj.visible) continue;
      const id = obj.userData.interactableId as string | undefined;
      if (!id) continue;

      const promptKey = getInteractionPromptKey(id, levelState);
      if (promptKey !== null) {
        bestId = id;
        break;
      }
    }
    currentTargetId = bestId;
  };

  const emitHudSnapshot = () => {
    const promptKey = getInteractionPromptKey(currentTargetId, levelState);
    const objectiveKey = getObjectiveKey(levelState);
    const candlesRemaining = countItemsOfKind(inventoryState, 'candle', false);
    const hasWetItems = hasAnyWetItemsInInventory(inventoryState);

    callbacks.onHudUpdate({
      matchesRemaining: matchState.matchesRemaining,
      candlesRemaining,
      isLit: matchState.isLit,
      activeSource: matchState.activeSource,
      burnTimeRemaining: matchState.burnTimeRemaining,
      maxBurnDuration: matchState.maxBurnDuration,
      statusMessageKey: matchState.statusMessageKey,
      promptKey,
      subtitleKey: subtitleState.activeKey,
      objectiveKey,
      hasRope: levelState.hasRope,
      ropeTied: levelState.ropeTied,
      hasArtifact: levelState.hasArtifact,
      foodCount: levelState.foodCount,
      waterCount: levelState.waterCount,
      hasWon: levelState.hasWon,
      isCollapsed: survivalState.isCollapsed,
      health: survivalState.health,
      stamina: survivalState.stamina,
      maxStamina: survivalState.maxStamina,
      hunger: survivalState.hunger,
      thirst: survivalState.thirst,
      inventoryItems: inventoryState.items,
      usedSlots: getUsedInventorySlots(inventoryState),
      maxSlots: CONFIG.INVENTORY_MAX_SLOTS,
      waterLevel: tideState.waterLevel,
      tidePhase: tideState.phase,
      tideWarningActive: tideState.warningActive,
      wetExposureSec: tideState.wetExposureSec,
      dryRecoverySec: tideState.dryRecoverySec,
      hasWetItems,
      inShallowWater: currentInShallowWater,
      inSafeSanctuary: currentInSafeSanctuary,
      isSoftLocked: tideState.isSoftLocked,
    });
  };

  syncCameraTransform();
  updateRaycastTarget();
  emitHudSnapshot();

  // Pointer Lock helpers
  const requestPointerLock = () => {
    if (
      isPaused ||
      isInventoryOpen ||
      levelState.hasWon ||
      survivalState.isCollapsed
    ) {
      return;
    }
    audio.startIfNeeded();
    const el = renderer.domElement;
    if (document.pointerLockElement === el) return;
    try {
      const promise = el.requestPointerLock() as unknown as
        | Promise<void>
        | undefined;
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          callbacks.onPointerLockFallback();
        });
      }
    } catch {
      callbacks.onPointerLockFallback();
    }
  };

  const exitPointerLockIfActive = () => {
    if (document.pointerLockElement === renderer.domElement) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore exitPointerLock errors
      }
    }
  };

  const applyPauseState = (nextPaused: boolean, requestLockOnResume = false) => {
    isPaused = nextPaused;
    if (isPaused) {
      clearMovementInputs();
      exitPointerLockIfActive();
    } else if (requestLockOnResume && !isInventoryOpen) {
      requestPointerLock();
    }
    audio.setSuspended(isSimulationPaused());
    callbacks.onPauseChange(isPaused);
  };

  const applyInventoryOpenState = (
    nextOpen: boolean,
    requestLockOnClose = false
  ) => {
    if (levelState.hasWon || survivalState.isCollapsed || isPaused) return;
    isInventoryOpen = nextOpen;
    if (isInventoryOpen) {
      clearMovementInputs();
      exitPointerLockIfActive();
    } else if (requestLockOnClose) {
      requestPointerLock();
    }
    callbacks.onInventoryOpenChange(isInventoryOpen);
    emitHudSnapshot();
  };

  const useInventoryItem = (entryId: string) => {
    if (levelState.hasWon || survivalState.isCollapsed) return;
    audio.startIfNeeded();
    const entry = inventoryState.items.find((it) => it.id === entryId);
    if (!entry) return;

    if (entry.kind === 'food') {
      const consumed = consumeFromInventoryEntry(inventoryState, entryId, 1);
      if (!consumed.consumedItem) return;
      inventoryState = consumed.inventory;
      survivalState = restoreHunger(
        survivalState,
        consumed.consumedItem.condition
      );
      levelState = syncLevelWithInventory(levelState, inventoryState);
      subtitleState = enqueueSubtitle(subtitleState, 'SUB_USE_FOOD', true);
      audio.playConsume();
      saveCurrentGameState();
      emitHudSnapshot();
    } else if (entry.kind === 'water_bottle') {
      const consumed = consumeFromInventoryEntry(inventoryState, entryId, 1);
      if (!consumed.consumedItem) return;
      inventoryState = consumed.inventory;
      survivalState = restoreThirst(
        survivalState,
        consumed.consumedItem.condition
      );
      levelState = syncLevelWithInventory(levelState, inventoryState);
      subtitleState = enqueueSubtitle(subtitleState, 'SUB_USE_WATER', true);
      audio.playConsume();
      saveCurrentGameState();
      emitHudSnapshot();
    } else if (entry.kind === 'matches' || entry.kind === 'candle') {
      const res = tryLightInventoryEntry(matchState, inventoryState, entryId);
      matchState = res.state;
      inventoryState = res.inventory;
      levelState = syncLevelWithInventory(levelState, inventoryState);
      if (res.event === 'struck') {
        audio.playMatchStrike();
        saveCurrentGameState();
      } else if (res.event === 'candle_lit') {
        audio.playMatchStrike();
        subtitleState = enqueueSubtitle(subtitleState, 'SUB_CANDLE_LIT', true);
        saveCurrentGameState();
      } else if (res.event === 'wet_match') {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_WET_MATCH_FAIL',
          true
        );
      } else if (res.event === 'wet_candle') {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_WET_CANDLE_FAIL',
          true
        );
      }
      emitHudSnapshot();
    } else if (entry.kind === 'rope') {
      if (
        currentTargetId === 'gap_rope_anchor' &&
        !levelState.ropeTied
      ) {
        const result = executeInteraction(
          'gap_rope_anchor',
          levelState,
          matchState,
          inventoryState,
          subtitleState
        );
        levelState = result.level;
        matchState = result.matchState;
        inventoryState = result.inventory;
        subtitleState = result.subtitles;
        if (result.audioEvent === 'tie_rope') {
          audio.playRopeTie();
        }
        interactableBundle.syncWithLevelState(levelState, elapsedSec);
        saveCurrentGameState();
        applyInventoryOpenState(false, true);
      } else {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_USE_ROPE_HINT',
          true
        );
        emitHudSnapshot();
      }
    } else if (entry.kind === 'artifact') {
      subtitleState = enqueueSubtitle(
        subtitleState,
        'SUB_USE_ARTIFACT_HINT',
        true
      );
      emitHudSnapshot();
    }
  };

  const dropInventoryItem = (entryId: string) => {
    if (levelState.hasWon || survivalState.isCollapsed) return;
    audio.startIfNeeded();
    const res = dropInventoryEntryToWorld(
      inventoryState,
      entryId,
      playerState.x,
      playerState.z,
      playerState.yaw,
      CAVE_MAP,
      levelState.nextDropSeq
    );
    if (!res.droppedItem) return;

    inventoryState = res.inventory;
    levelState = syncLevelWithInventory(
      {
        ...levelState,
        droppedItems: [...levelState.droppedItems, res.droppedItem],
        nextDropSeq: levelState.nextDropSeq + 1,
      },
      inventoryState
    );
    matchState = {
      ...matchState,
      matchesRemaining: countItemsOfKind(inventoryState, 'matches', false),
    };
    subtitleState = enqueueSubtitle(subtitleState, 'SUB_DROP_ITEM', true);
    audio.playDrop();
    interactableBundle.syncWithLevelState(levelState, elapsedSec);
    saveCurrentGameState();
    emitHudSnapshot();
  };

  const jumpTidePhase = () => {
    tideState = jumpToNextTidePhase(tideState);
    waterBundle.update(tideState.waterLevel, elapsedSec);
    syncCameraTransform();
    emitHudSnapshot();
  };

  const reloadLastCheckpoint = () => {
    applyCheckpointState(lastSafeCheckpoint);
    subtitleState = enqueueSubtitle(subtitleState, 'SUB_TIDE_RECEDED', true);
    syncCameraTransform();
    updateRaycastTarget();
    emitHudSnapshot();
  };

  const restartLevel = (requestLock = true) => {
    const startCenter = tileToWorldCenter(PLAYER_SPAWN_TILE);
    playerState = {
      x: startCenter.x,
      z: startCenter.z,
      vx: 0,
      vz: 0,
      speed: 0,
      yaw: PLAYER_INITIAL_YAW,
      pitch: 0,
      bobPhase: 0,
      bobOffsetX: 0,
      bobOffsetY: 0,
      isMoving: false,
      isRunning: false,
    };
    inventoryState = createInitialInventoryState();
    survivalState = createInitialSurvivalState();
    tideState = createInitialTideState();
    matchState = createInitialMatchLightState();
    surfaceMemory = createSurfaceMemoryState(caveBundle.faces.length);
    caveBundle.resetRememberedFaces();
    levelState = syncLevelWithInventory(
      createInitialLevelProgress(),
      inventoryState
    );
    subtitleState = createInitialSubtitleQueue();
    currentTargetId = null;
    elapsedSec = 0;
    autosaveTimerSec = 0;
    checkpointTimerSec = 0;
    currentInShallowWater = false;
    currentInSafeSanctuary = false;
    isInventoryOpen = false;
    callbacks.onInventoryOpenChange(false);

    interactableBundle.syncWithLevelState(levelState, elapsedSec);
    waterBundle.update(tideState.waterLevel, elapsedSec);
    lastSafeCheckpoint = buildSnapshotNow();
    saveCurrentGameState();
    syncCameraTransform();
    updateRaycastTarget();
    emitHudSnapshot();
    applyPauseState(false, requestLock);
  };

  // DOM Event Listeners
  const onPointerLockChange = () => {
    const locked = document.pointerLockElement === renderer.domElement;
    const wasLocked = isPointerLocked;
    isPointerLocked = locked;
    callbacks.onPointerLockStateChange(locked);

    if (
      wasLocked &&
      !locked &&
      !isPaused &&
      !isInventoryOpen &&
      !levelState.hasWon &&
      !survivalState.isCollapsed
    ) {
      applyPauseState(true, false);
    }
  };

  const onPointerLockError = () => {
    callbacks.onPointerLockFallback();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      clearMovementInputs();
    }
    audio.setSuspended(isSimulationPaused());
  };

  const onWindowBlur = () => {
    clearMovementInputs();
  };

  const onCanvasMouseDown = (e: MouseEvent) => {
    if (
      isPaused ||
      isInventoryOpen ||
      levelState.hasWon ||
      survivalState.isCollapsed ||
      e.button !== 0
    ) {
      return;
    }
    audio.startIfNeeded();
    if (!isPointerLocked) {
      requestPointerLock();
      isDraggingLook = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    }
  };

  const onWindowMouseUp = () => {
    isDraggingLook = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (
      isPaused ||
      isInventoryOpen ||
      levelState.hasWon ||
      survivalState.isCollapsed
    ) {
      return;
    }

    if (isPointerLocked) {
      const nextAngles = applyMouseLook(
        playerState.yaw,
        playerState.pitch,
        e.movementX,
        e.movementY,
        settings.mouseSensitivity
      );
      playerState.yaw = nextAngles.yaw;
      playerState.pitch = nextAngles.pitch;
    } else if (isDraggingLook) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      const nextAngles = applyMouseLook(
        playerState.yaw,
        playerState.pitch,
        dx,
        dy,
        settings.mouseSensitivity
      );
      playerState.yaw = nextAngles.yaw;
      playerState.pitch = nextAngles.pitch;
    }
  };

  const setKeyFlag = (code: string, pressed: boolean): boolean => {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        inputState.forward = pressed;
        return true;
      case 'KeyS':
      case 'ArrowDown':
        inputState.backward = pressed;
        return true;
      case 'KeyA':
      case 'ArrowLeft':
        inputState.left = pressed;
        return true;
      case 'KeyD':
      case 'ArrowRight':
        inputState.right = pressed;
        return true;
      case 'ShiftLeft':
      case 'ShiftRight':
        inputState.run = pressed;
        return true;
      default:
        return false;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F3') {
      e.preventDefault();
      callbacks.onToggleDebug();
      return;
    }

    if (e.code === 'Escape') {
      if (levelState.hasWon || survivalState.isCollapsed) return;
      e.preventDefault();
      if (isInventoryOpen) {
        applyInventoryOpenState(false, true);
        return;
      }
      if (isPointerLocked) {
        applyPauseState(true, false);
      } else {
        applyPauseState(!isPaused, isPaused);
      }
      return;
    }

    if (e.code === 'KeyI' && !e.repeat) {
      if (isPaused || levelState.hasWon || survivalState.isCollapsed) return;
      e.preventDefault();
      audio.startIfNeeded();
      applyInventoryOpenState(!isInventoryOpen, isInventoryOpen);
      return;
    }

    // [R] reloads the last safe checkpoint when soft-locked by high tide
    if (
      e.code === 'KeyR' &&
      !e.repeat &&
      tideState.isSoftLocked &&
      !isPaused &&
      !isInventoryOpen &&
      !levelState.hasWon &&
      !survivalState.isCollapsed
    ) {
      e.preventDefault();
      reloadLastCheckpoint();
      return;
    }

    if (
      isPaused ||
      isInventoryOpen ||
      levelState.hasWon ||
      survivalState.isCollapsed
    ) {
      return;
    }

    if (e.code === 'KeyF' && !e.repeat) {
      e.preventDefault();
      audio.startIfNeeded();
      const strike = tryStrikeMatchWithInventory(matchState, inventoryState);
      matchState = strike.state;
      inventoryState = strike.inventory;
      levelState = syncLevelWithInventory(levelState, inventoryState);
      if (strike.event === 'struck') {
        audio.playMatchStrike();
        saveCurrentGameState();
      } else if (strike.event === 'wet_match') {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_WET_MATCH_FAIL',
          true
        );
      }
      emitHudSnapshot();
      return;
    }

    if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      audio.startIfNeeded();
      updateRaycastTarget();
      if (currentTargetId) {
        const prevCollectedLen = levelState.collectedIds.length;
        const prevDroppedLen = levelState.droppedItems.length;
        const prevRopeTied = levelState.ropeTied;

        const result = executeInteraction(
          currentTargetId,
          levelState,
          matchState,
          inventoryState,
          subtitleState
        );
        levelState = result.level;
        matchState = result.matchState;
        inventoryState = result.inventory;
        subtitleState = result.subtitles;

        if (result.audioEvent === 'pickup') {
          audio.playPickup();
        } else if (result.audioEvent === 'tie_rope') {
          audio.playRopeTie();
        } else if (result.audioEvent === 'artifact') {
          audio.playArtifactPickup();
        } else if (result.audioEvent === 'win') {
          audio.playArtifactPickup();
          clearMovementInputs();
          exitPointerLockIfActive();
        }

        interactableBundle.syncWithLevelState(levelState, elapsedSec);

        // Autosave on key events (item pickup, drop pickup, or rope tied)
        if (
          !levelState.hasWon &&
          (levelState.collectedIds.length !== prevCollectedLen ||
            levelState.droppedItems.length !== prevDroppedLen ||
            levelState.ropeTied !== prevRopeTied)
        ) {
          saveCurrentGameState();
        }

        updateRaycastTarget();
        emitHudSnapshot();
      }
      return;
    }

    if (setKeyFlag(e.code, true)) {
      e.preventDefault();
      audio.startIfNeeded();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    setKeyFlag(e.code, false);
  };

  const onResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onWindowBlur);
  renderer.domElement.addEventListener('mousedown', onCanvasMouseDown);
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onResize);

  // Main Animation & Simulation Loop
  let animationFrameId = 0;
  let lastTimestamp = performance.now();
  let hudTimerSec = 0;
  let fpsTimerSec = 0;
  let frameCounter = 0;
  let currentFps = 60;

  const animate = (now: number) => {
    animationFrameId = window.requestAnimationFrame(animate);

    const rawDeltaSec = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    const clampedDelta = Math.min(Math.max(rawDeltaSec, 0), CONFIG.MAX_DELTA_SEC);

    if (!isSimulationPaused()) {
      elapsedSec += clampedDelta;

      const ts = CONFIG.TILE_SIZE;
      const preCol = Math.floor(playerState.x / ts);
      const preRow = Math.floor(playerState.z / ts);
      const preWaterStatus = getTileWaterStatus(
        preCol,
        preRow,
        tideState.waterLevel
      );
      const preInShallow =
        preWaterStatus === 'shallow' || preWaterStatus === 'deep';

      // 1. Step player movement (only allow running when stamina >= 10; keep still if inventory is open)
      const allowedToRun = canPlayerRun(survivalState);
      if (!isInventoryOpen) {
        playerState = stepPlayerMovement(
          playerState,
          inputState,
          clampedDelta,
          CAVE_MAP,
          settings.headBob,
          levelState.ropeTied,
          allowedToRun,
          tideState.waterLevel
        );
      } else {
        playerState = {
          ...playerState,
          vx: 0,
          vz: 0,
          speed: 0,
          isMoving: false,
          isRunning: false,
        };
      }

      const postCol = Math.floor(playerState.x / ts);
      const postRow = Math.floor(playerState.z / ts);
      const postWaterStatus = getTileWaterStatus(
        postCol,
        postRow,
        tideState.waterLevel
      );
      const postInWater =
        postWaterStatus === 'shallow' || postWaterStatus === 'deep';
      currentInShallowWater = postInWater;
      currentInSafeSanctuary = isSafeSanctuaryChamberTile(postCol, postRow);

      // 2. Step survival stats (hunger, thirst, stamina with extra shallow-water cost, health drain after 60s at 0, darkness timer)
      const survStep = stepSurvivalState(
        survivalState,
        clampedDelta,
        playerState.isMoving,
        playerState.isRunning,
        matchState.isLit,
        postInWater || preInShallow
      );
      survivalState = survStep.state;
      if (survStep.justHitVitalZero) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_VITAL_ZERO_WARNING',
          true
        );
      }
      if (survivalState.isCollapsed) {
        clearMovementInputs();
        exitPointerLockIfActive();
        if (isInventoryOpen) {
          isInventoryOpen = false;
          callbacks.onInventoryOpenChange(false);
        }
        emitHudSnapshot();
      }

      // 3. Step Tide System (240 s 5-phase cycle, 20 s pre-flood warning, > 3 s wetting, 40 s drying, BFS soft-lock check)
      const hasWetItems = hasAnyWetItemsInInventory(inventoryState);
      const hasDrySensitiveItems =
        hasAnyDrySensitiveItemsInInventory(inventoryState);
      const tideRes = stepTideSystem(
        tideState,
        clampedDelta,
        playerState.x,
        playerState.z,
        hasWetItems,
        hasDrySensitiveItems,
        levelState.ropeTied,
        CAVE_MAP
      );
      tideState = tideRes.state;
      const tEvents = tideRes.events;

      if (tEvents.triggerPreFloodWarningSubtitle) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_TIDE_WARNING_20S',
          true
        );
      }
      if (tEvents.triggerHighTideFloodedSubtitle) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_TIDE_HIGH_FLOODED',
          true
        );
      }
      if (tEvents.triggerTideRecededSubtitle) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_TIDE_RECEDED',
          false
        );
      }
      if (tEvents.triggerSafeRoomDiscoverySubtitle) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_SAFE_ROOM_ENTER',
          false
        );
      }
      if (tEvents.triggerSoftLockSubtitle) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_SOFTLOCK_DETECTED',
          true
        );
      }

      if (tEvents.shouldWetInventoryItems) {
        const wetRes = wetInventoryItems(inventoryState);
        if (wetRes.changed) {
          inventoryState = wetRes.inventory;
          levelState = syncLevelWithInventory(levelState, inventoryState);
          matchState = {
            ...matchState,
            matchesRemaining: countItemsOfKind(
              inventoryState,
              'matches',
              false
            ),
          };
          if (tEvents.triggerItemsWetSubtitle) {
            subtitleState = enqueueSubtitle(
              subtitleState,
              'SUB_ITEMS_BECAME_WET',
              true
            );
          }
        }
      }

      if (tEvents.shouldDryInventoryItems) {
        const dryRes = dryInventoryItems(inventoryState);
        if (dryRes.changed) {
          inventoryState = dryRes.inventory;
          levelState = syncLevelWithInventory(levelState, inventoryState);
          matchState = {
            ...matchState,
            matchesRemaining: countItemsOfKind(
              inventoryState,
              'matches',
              false
            ),
          };
          if (tEvents.triggerItemsDriedSubtitle) {
            subtitleState = enqueueSubtitle(
              subtitleState,
              'SUB_ITEMS_DRIED',
              true
            );
          }
        }
      }

      // Update last safe checkpoint periodically while standing on a dry safe tile and not soft-locked
      if (
        postWaterStatus === 'dry' &&
        isDrySafeTile(postCol, postRow) &&
        !tideState.isSoftLocked
      ) {
        checkpointTimerSec += clampedDelta;
        if (checkpointTimerSec >= CONFIG.CHECKPOINT_SAVE_INTERVAL_SEC) {
          checkpointTimerSec = 0;
          lastSafeCheckpoint = buildSnapshotNow();
        }
      }

      // 4. Step match / candle timer & flame flicker (candle extinguishes if wetExposureSec >= 3s)
      const isCandleWetNow =
        tideState.wetExposureSec >= CONFIG.ITEM_WET_EXPOSURE_SEC;
      const lightStep = stepMatchLight(
        matchState,
        clampedDelta,
        isCandleWetNow
      );
      matchState = lightStep.state;
      if (lightStep.burnedOut) {
        audio.playMatchBurnout();
      }
      if (lightStep.wetExtinguished) {
        subtitleState = enqueueSubtitle(
          subtitleState,
          'SUB_CANDLE_WET_OUT',
          true
        );
      }

      // 5. Update line-of-sight surface memory per tile face while flame burns
      const newlyRememberedFaces = updateRememberedTileFaces(
        surfaceMemory,
        caveBundle.faces,
        CAVE_MAP,
        playerState.x,
        playerState.z,
        matchState.isLit,
        matchState.currentReach
      );
      if (newlyRememberedFaces.length > 0) {
        caveBundle.markFacesRemembered(newlyRememberedFaces);
      }

      // 6. Check gap edge proximity hint & step subtitle queue
      const gapCheck = checkGapEdgeProximityHint(
        playerState.x,
        playerState.z,
        levelState,
        subtitleState
      );
      levelState = gapCheck.level;
      subtitleState = stepSubtitleQueue(gapCheck.subtitles, clampedDelta);

      // 7. Sync interactables & translucent low-poly water plane
      interactableBundle.syncWithLevelState(levelState, elapsedSec);
      waterBundle.update(tideState.waterLevel, elapsedSec);

      // 8. Step procedural Web Audio (wind, drips, footsteps + splashes, stamina breathing, darkness heartbeat, tide rumble)
      audio.update(
        clampedDelta,
        playerState.isMoving,
        playerState.isRunning,
        survivalState.stamina,
        survivalState.darknessTimerSec,
        matchState.isLit,
        tideState.warningIntensity,
        postInWater
      );

      // 9. Periodic 10-second autosave
      autosaveTimerSec += clampedDelta;
      if (autosaveTimerSec >= CONFIG.AUTOSAVE_INTERVAL_SEC) {
        autosaveTimerSec = 0;
        saveCurrentGameState();
      }
    }

    syncCameraTransform();
    updateRaycastTarget();
    renderer.render(scene, camera);

    // Update HUD snapshot at ~15 Hz
    hudTimerSec += clampedDelta;
    if (hudTimerSec >= 0.065) {
      hudTimerSec = 0;
      emitHudSnapshot();
    }

    // Update F3 debug metrics at ~4 Hz
    frameCounter++;
    fpsTimerSec += rawDeltaSec;
    if (fpsTimerSec >= 0.25) {
      currentFps = Math.round(frameCounter / fpsTimerSec);
      frameCounter = 0;
      fpsTimerSec = 0;

      const col = Math.floor(playerState.x / CONFIG.TILE_SIZE);
      const row = Math.floor(playerState.z / CONFIG.TILE_SIZE);

      callbacks.onDebugUpdate({
        fps: currentFps,
        x: playerState.x,
        y: camera.position.y,
        z: playerState.z,
        col,
        row,
        speed: playerState.speed,
        isMoving: playerState.isMoving,
        isRunning: playerState.isRunning,
        drawCalls: renderer.info.render.calls,
        waterLevel: tideState.waterLevel,
        tidePhase: tideState.phase,
        tideClockSec: tideState.tideClockSec,
      });
    }
  };

  animationFrameId = window.requestAnimationFrame(animate);

  return {
    updateSettings(nextSettings: ComfortSettings) {
      settings = { ...nextSettings };
      if (camera.fov !== settings.fov) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }
      audio.setVolume(settings.masterVolume, settings.muted);
    },
    setPaused(paused: boolean, requestLockOnResume = false) {
      applyPauseState(paused, requestLockOnResume);
    },
    setInventoryOpen(open: boolean, requestLockOnClose = false) {
      applyInventoryOpenState(open, requestLockOnClose);
    },
    useInventoryItem,
    dropInventoryItem,
    jumpTidePhase,
    reloadLastCheckpoint,
    restartLevel,
    requestPointerLock,
    dispose() {
      window.cancelAnimationFrame(animationFrameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      renderer.domElement.removeEventListener('mousedown', onCanvasMouseDown);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);

      exitPointerLockIfActive();
      audio.dispose();
      interactableBundle.dispose();
      waterBundle.dispose();
      caveBundle.geometry.dispose();
      caveBundle.material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
