import { useEffect, useRef, useState } from 'react';
import { ComfortSettings, CONFIG } from './config';
import {
  CaveRendererController,
  createCaveRenderer,
  DebugMetrics,
  HudLightSnapshot,
} from './game/caveRenderer';
import { getProceduralItemIcon } from './game/itemIcons';
import {
  clearGameStateFromStorage,
  GameState,
  loadGameStateFromStorage,
  LoadSaveResult,
} from './logic/saveGame';
import {
  countItemsOfKind,
  createInitialInventoryState,
  getConditionLabel,
  getItemMetadata,
  getUsedInventorySlots,
  hasAnyWetItemsInInventory,
  InventoryItemEntry,
} from './logic/survivalAndInventory';
import { getTidePhaseLabel } from './logic/tideSystem';
import { STRINGS } from './strings';

const DEFAULT_SETTINGS: ComfortSettings = {
  mouseSensitivity: CONFIG.DEFAULT_MOUSE_SENSITIVITY,
  fov: CONFIG.DEFAULT_FOV,
  headBob: CONFIG.DEFAULT_HEAD_BOB,
  masterVolume: CONFIG.DEFAULT_MASTER_VOLUME,
  muted: CONFIG.DEFAULT_MUTED,
};

/**
 * Lightweight fullscreen vignette and native-resolution 256x256 tiled film-grain overlay.
 * Pauses grain animation while the Esc menu is open or the browser tab is hidden.
 */
function AtmospherePostOverlay({ isPaused }: { isPaused: boolean }) {
  const grainDivRef = useRef<HTMLDivElement | null>(null);
  const [grainDataUrl, setGrainDataUrl] = useState<string>('');

  useEffect(() => {
    const size = CONFIG.GRAIN_SIZE_PX;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Fine monochromatic film grain centered around mid-grey (128) for soft-light blend
      const v = (96 + Math.random() * 64) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    setGrainDataUrl(offscreen.toDataURL('image/png'));
  }, []);

  useEffect(() => {
    const size = CONFIG.GRAIN_SIZE_PX;
    const shiftGrain = () => {
      if (isPaused || document.hidden || !grainDivRef.current) return;
      const ox = (Math.random() * size) | 0;
      const oy = (Math.random() * size) | 0;
      grainDivRef.current.style.backgroundPosition = `${ox}px ${oy}px`;
    };

    const intervalMs = Math.round(1000 / CONFIG.GRAIN_FPS);
    const timer = window.setInterval(shiftGrain, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPaused]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* Native-size 256x256 tiled fine film grain */}
      {grainDataUrl && (
        <div
          ref={grainDivRef}
          style={{
            backgroundImage: `url(${grainDataUrl})`,
            backgroundRepeat: 'repeat',
            backgroundSize: `${CONFIG.GRAIN_SIZE_PX}px ${CONFIG.GRAIN_SIZE_PX}px`,
            opacity: CONFIG.GRAIN_OPACITY,
            mixBlendMode: 'soft-light',
          }}
          className="absolute inset-0"
        />
      )}
      {/* Dark oppressive radial vignette */}
      <div
        style={{
          opacity: CONFIG.VIGNETTE_OPACITY,
          background:
            'radial-gradient(circle at center, transparent 38%, rgba(2, 4, 9, 0.72) 74%, rgba(1, 2, 6, 0.96) 100%)',
        }}
        className="absolute inset-0"
      />
    </div>
  );
}

function CaveViewport({
  initialSavedState,
  onExitToMainMenu,
}: {
  initialSavedState: GameState | null;
  onExitToMainMenu: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CaveRendererController | null>(null);

  const [settings, setSettings] = useState<ComfortSettings>(DEFAULT_SETTINGS);
  const [isPaused, setIsPaused] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [pointerLockFallback, setPointerLockFallback] = useState(false);
  const [hud, setHud] = useState<HudLightSnapshot>(() => {
    const fallbackInv =
      initialSavedState?.inventory ?? createInitialInventoryState();
    return {
      matchesRemaining:
        initialSavedState?.light.matchesRemaining ?? CONFIG.INITIAL_MATCHES,
      candlesRemaining: countItemsOfKind(fallbackInv, 'candle', false),
      isLit: initialSavedState?.light.isLit ?? false,
      activeSource: initialSavedState?.light.activeSource ?? 'match',
      burnTimeRemaining: initialSavedState?.light.burnTimeRemaining ?? 0,
      maxBurnDuration:
        initialSavedState?.light.maxBurnDuration ??
        CONFIG.MATCH_BURN_DURATION_SEC,
      statusMessageKey: null,
      promptKey: null,
      subtitleKey: initialSavedState ? null : 'SUB_INTRO',
      objectiveKey: initialSavedState?.objective ?? 'OBJ_FIND_ROPE',
      hasRope: initialSavedState?.items.hasRope ?? false,
      ropeTied: initialSavedState?.ropeState.ropeTied ?? false,
      hasArtifact: initialSavedState?.items.hasArtifact ?? false,
      foodCount: initialSavedState?.items.foodCount ?? 0,
      waterCount:
        initialSavedState?.items.waterCount ?? CONFIG.INITIAL_WATER_BOTTLES,
      hasWon: false,
      isCollapsed: false,
      health: initialSavedState?.survival.health ?? CONFIG.HEALTH_MAX,
      stamina: initialSavedState?.survival.stamina ?? CONFIG.STAMINA_MAX,
      maxStamina: initialSavedState?.survival.maxStamina ?? CONFIG.STAMINA_MAX,
      hunger: initialSavedState?.survival.hunger ?? CONFIG.HUNGER_MAX,
      thirst: initialSavedState?.survival.thirst ?? CONFIG.THIRST_MAX,
      inventoryItems: fallbackInv.items,
      usedSlots: getUsedInventorySlots(fallbackInv),
      maxSlots: CONFIG.INVENTORY_MAX_SLOTS,
      waterLevel: initialSavedState?.tides.waterLevel ?? 0.05,
      tidePhase: initialSavedState?.tides.phase ?? 'low_1',
      tideWarningActive: initialSavedState?.tides.warningActive ?? false,
      wetExposureSec: initialSavedState?.tides.wetExposureSec ?? 0,
      dryRecoverySec: initialSavedState?.tides.dryRecoverySec ?? 0,
      hasWetItems: hasAnyWetItemsInInventory(fallbackInv),
      inShallowWater: false,
      inSafeSanctuary: false,
      isSoftLocked: false,
    };
  });
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    fps: 60,
    x: initialSavedState?.player.x ?? 0,
    y: CONFIG.EYE_HEIGHT,
    z: initialSavedState?.player.z ?? 0,
    col: 4,
    row: 5,
    speed: 0,
    isMoving: false,
    isRunning: false,
    drawCalls: 1,
    waterLevel: initialSavedState?.tides.waterLevel ?? 0.05,
    tidePhase: initialSavedState?.tides.phase ?? 'low_1',
    tideClockSec: initialSavedState?.tides.tideClockSec ?? 0,
  });

  // Dev-only debug key [T] to jump tide phase, strictly active ONLY when F3 debug overlay is visible
  useEffect(() => {
    if (!debugVisible) return;
    const onDebugKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !e.repeat) {
        e.preventDefault();
        controllerRef.current?.jumpTidePhase();
      }
    };
    window.addEventListener('keydown', onDebugKeyDown);
    return () => {
      window.removeEventListener('keydown', onDebugKeyDown);
    };
  }, [debugVisible]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Guard against duplicate canvases under React StrictMode
    if (controllerRef.current) {
      controllerRef.current.dispose();
      controllerRef.current = null;
    }

    const controller = createCaveRenderer(
      container,
      DEFAULT_SETTINGS,
      initialSavedState,
      {
        onDebugUpdate: (metrics) => {
          setDebugMetrics(metrics);
        },
        onHudUpdate: (nextHud) => {
          setHud(nextHud);
        },
        onToggleDebug: () => {
          setDebugVisible((prev) => !prev);
        },
        onPauseChange: (paused) => {
          setIsPaused(paused);
        },
        onInventoryOpenChange: (open) => {
          setIsInventoryOpen(open);
        },
        onPointerLockFallback: () => {
          setPointerLockFallback(true);
        },
        onPointerLockStateChange: (locked) => {
          setPointerLocked(locked);
        },
      }
    );

    controllerRef.current = controller;

    // Attempt initial pointer lock after starting from button click
    controller.requestPointerLock();

    return () => {
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
    };
  }, [initialSavedState]);

  const updateComfortSettings = (next: ComfortSettings) => {
    setSettings(next);
    controllerRef.current?.updateSettings(next);
  };

  const handleResume = () => {
    setIsPaused(false);
    controllerRef.current?.setPaused(false, true);
  };

  const handleRestart = () => {
    setIsPaused(false);
    setIsInventoryOpen(false);
    setSelectedItemId(null);
    setInspectedItemId(null);
    controllerRef.current?.restartLevel(true);
  };

  const handleOpenSettings = () => {
    setIsPaused(true);
    setIsInventoryOpen(false);
    controllerRef.current?.setPaused(true, false);
  };

  const handleToggleInventory = (open: boolean) => {
    setIsInventoryOpen(open);
    controllerRef.current?.setInventoryOpen(open, !open);
  };

  const handleResetDefaults = () => {
    updateComfortSettings(DEFAULT_SETTINGS);
  };

  // Resolve active selected item in the 12-slot inventory
  const selectedItem: InventoryItemEntry | null =
    hud.inventoryItems.find((it) => it.id === selectedItemId) ??
    hud.inventoryItems[0] ??
    null;

  const moveStateLabel = !debugMetrics.isMoving
    ? STRINGS.DEBUG_STATE_IDLE
    : debugMetrics.isRunning
      ? STRINGS.DEBUG_STATE_RUN
      : STRINGS.DEBUG_STATE_WALK;

  const flameFraction = hud.isLit
    ? Math.max(
        0,
        Math.min(1, hud.burnTimeRemaining / Math.max(1, hud.maxBurnDuration))
      )
    : 0;
  const shrinkWindow =
    hud.activeSource === 'candle'
      ? CONFIG.CANDLE_SHRINK_WINDOW_SEC
      : CONFIG.MATCH_SHRINK_WINDOW_SEC;
  const isFlameDying = hud.isLit && hud.burnTimeRemaining <= shrinkWindow;

  const statusMessageText =
    hud.statusMessageKey === 'ALREADY_LIT'
      ? STRINGS.MSG_MATCH_ALREADY_LIT
      : hud.statusMessageKey === 'NO_MATCHES'
        ? STRINGS.MSG_NO_MATCHES_LEFT
        : hud.statusMessageKey === 'WET_MATCH'
          ? STRINGS.MSG_WET_MATCH
          : hud.statusMessageKey === 'WET_CANDLE'
            ? STRINGS.MSG_WET_CANDLE
            : null;

  const promptText = hud.promptKey ? STRINGS[hud.promptKey] : null;
  const subtitleText = hud.subtitleKey ? STRINGS[hud.subtitleKey] : null;
  const objectiveText = STRINGS[hud.objectiveKey];

  const isStaminaHalved = hud.maxStamina < CONFIG.STAMINA_MAX - 0.1;
  const emptySlotCount = Math.max(0, hud.maxSlots - hud.usedSlots);

  return (
    <div className="font-vn-sans relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated empty mount container for Three.js WebGL canvas */}
      <div ref={mountRef} className="w-full h-full cursor-none" />

      {/* Lightweight Vignette + Film Grain Post-Effect */}
      <AtmospherePostOverlay
        isPaused={isPaused || hud.hasWon || hud.isCollapsed}
      />

      {/* Center Screen Crosshair Dot + <=2m Raycast Interaction Hint */}
      {!isPaused && !isInventoryOpen && !hud.hasWon && !hud.isCollapsed && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            <div
              className={`rounded-full transition-all duration-100 ${
                promptText
                  ? 'h-2 w-2 bg-amber-300 ring-4 ring-amber-400/25'
                  : 'h-1.5 w-1.5 bg-slate-200/65'
              }`}
            />
            {promptText && (
              <div className="font-vn-sans mt-3 rounded border border-amber-400/45 bg-slate-950/90 px-3 py-1 text-xs font-medium text-amber-200 shadow-lg whitespace-nowrap">
                {promptText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top-Right HUD Objective Tracker */}
      {!hud.hasWon && !hud.isCollapsed && (
        <div className="font-vn-sans pointer-events-none absolute top-4 right-4 z-20 max-w-xs rounded-md border border-slate-800/85 bg-slate-950/85 px-3.5 py-2.5 text-slate-200 shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
            {STRINGS.HUD_OBJECTIVE_LABEL}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">
            {objectiveText}
          </p>
          {(hud.hasRope || hud.hasArtifact) && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-800/80 pt-2 text-[11px]">
              {hud.hasRope && (
                <span className="rounded bg-slate-800/90 px-2 py-0.5 text-slate-300">
                  {hud.ropeTied
                    ? STRINGS.HUD_BADGE_ROPE_TIED
                    : STRINGS.HUD_BADGE_ROPE}
                </span>
              )}
              {hud.hasArtifact && (
                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-medium text-amber-300">
                  {STRINGS.HUD_BADGE_ARTIFACT}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Centered Vietnamese Match / Candle Status Notice */}
      {statusMessageText && !isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div
          role="status"
          aria-live="polite"
          className="font-vn-sans pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-md border border-amber-500/40 bg-slate-950/90 px-4 py-2 text-sm font-medium text-amber-200 shadow-lg whitespace-nowrap"
        >
          {statusMessageText}
        </div>
      )}

      {/* Queued & Timed Bottom Vietnamese Subtitle Bar (Inner Monologue & Hints) */}
      {subtitleText && !isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div
          role="status"
          aria-live="polite"
          className="font-vn-sans pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 text-center"
        >
          <div className="inline-block rounded-md border border-slate-800/90 bg-slate-950/90 px-4 py-2 text-sm leading-relaxed text-slate-100 shadow-xl">
            {subtitleText}
          </div>
        </div>
      )}

      {/* Soft-Lock Recovery Banner: offered when the player is trapped with no reachable exit or safe ground */}
      {hud.isSoftLocked && !isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div
          role="alert"
          className="font-vn-sans pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4"
        >
          <div className="rounded-lg border border-amber-500/60 bg-slate-950/95 p-4 text-center shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {STRINGS.SOFTLOCK_TITLE}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              {STRINGS.SOFTLOCK_DESC}
            </p>
            <button
              type="button"
              onClick={() => controllerRef.current?.reloadLastCheckpoint()}
              className="mt-3 w-full cursor-pointer rounded-md bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            >
              {STRINGS.SOFTLOCK_RELOAD_BUTTON}
            </button>
          </div>
        </div>
      )}

      {/* Bottom-Left HUD: Light Timer + Thin Survival Bars + Tide & Wet/Dry Status */}
      {!hud.hasWon && !hud.isCollapsed && (
        <div className="font-vn-sans pointer-events-none absolute bottom-5 left-5 z-20 w-60 rounded-md border border-slate-800/80 bg-slate-950/85 px-3.5 py-2.5 text-slate-200 shadow-lg space-y-2.5">
          {/* Light & Matches Row */}
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-300">
                {STRINGS.HUD_MATCHES_LABEL}:{' '}
                <span className="font-vn-mono font-semibold text-amber-400 tabular-nums">
                  {hud.matchesRemaining}
                </span>
                {hud.candlesRemaining > 0 && (
                  <span className="ml-2 text-slate-400">
                    · {STRINGS.HUD_CANDLE_LABEL}:{' '}
                    <span className="font-vn-mono font-semibold text-amber-300 tabular-nums">
                      {hud.candlesRemaining}
                    </span>
                  </span>
                )}
              </span>
              <span className="font-vn-mono text-[11px] text-slate-400 tabular-nums">
                {hud.isLit
                  ? `${hud.burnTimeRemaining.toFixed(1)}s`
                  : STRINGS.HUD_STRIKE_HINT}
              </span>
            </div>

            {/* Thin Flame Timer Bar */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
              <div
                style={{
                  width: `${(flameFraction * 100).toFixed(1)}%`,
                  backgroundColor: isFlameDying
                    ? '#ea580c'
                    : hud.activeSource === 'candle'
                      ? '#ffc46b'
                      : '#ffb45a',
                }}
                className="h-full transition-[width] duration-75"
              />
            </div>
          </div>

          {/* Thin Survival Bars: Health, Stamina, Hunger, Thirst */}
          <div className="space-y-1.5 border-t border-slate-800/80 pt-2 text-[11px]">
            {/* Health */}
            <div>
              <div className="flex justify-between text-slate-400">
                <span>{STRINGS.HUD_HEALTH_LABEL}</span>
                <span className="font-vn-mono tabular-nums text-slate-300">
                  {Math.ceil(hud.health)}
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, hud.health)).toFixed(1)}%`,
                  }}
                  className="h-full bg-rose-500/90 transition-[width] duration-100"
                />
              </div>
            </div>

            {/* Stamina (shows halved max cap when starving/dehydrated) */}
            <div>
              <div className="flex justify-between text-slate-400">
                <span>
                  {STRINGS.HUD_STAMINA_LABEL}
                  {isStaminaHalved && (
                    <span className="ml-1 text-[10px] text-amber-400">
                      (50%)
                    </span>
                  )}
                </span>
                <span className="font-vn-mono tabular-nums text-slate-300">
                  {Math.round(hud.stamina)}/{Math.round(hud.maxStamina)}
                </span>
              </div>
              <div className="relative mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, hud.stamina)).toFixed(1)}%`,
                  }}
                  className={`h-full transition-[width] duration-75 ${
                    hud.stamina < CONFIG.STAMINA_MIN_TO_RUN
                      ? 'bg-red-500/80'
                      : 'bg-emerald-400/85'
                  }`}
                />
                {isStaminaHalved && (
                  <div className="absolute top-0 right-0 h-full w-1/2 bg-slate-800/90 border-l border-amber-500/60" />
                )}
              </div>
            </div>

            {/* Hunger & Thirst side-by-side */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>{STRINGS.HUD_HUNGER_LABEL}</span>
                  <span
                    className={`font-vn-mono tabular-nums ${
                      hud.hunger <= 0 ? 'text-red-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {Math.ceil(hud.hunger)}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, hud.hunger)).toFixed(1)}%`,
                    }}
                    className="h-full bg-amber-500/85 transition-[width] duration-100"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400">
                  <span>{STRINGS.HUD_THIRST_LABEL}</span>
                  <span
                    className={`font-vn-mono tabular-nums ${
                      hud.thirst <= 0 ? 'text-red-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {Math.ceil(hud.thirst)}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, hud.thirst)).toFixed(1)}%`,
                    }}
                    className="h-full bg-sky-400/85 transition-[width] duration-100"
                  />
                </div>
              </div>
            </div>

            {/* Tide Phase & Water Level Bar (0..100%) */}
            <div className="border-t border-slate-800/80 pt-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  {STRINGS.HUD_TIDE_LABEL}:{' '}
                  <strong
                    className={
                      hud.tideWarningActive
                        ? 'text-amber-300'
                        : hud.tidePhase === 'high'
                          ? 'text-cyan-300'
                          : 'text-slate-200'
                    }
                  >
                    {getTidePhaseLabel(hud.tidePhase)}
                  </strong>
                </span>
                <span className="font-vn-mono tabular-nums text-slate-300">
                  {Math.round(hud.waterLevel * 100)}%
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, hud.waterLevel * 100)).toFixed(1)}%`,
                    backgroundColor: hud.tideWarningActive
                      ? '#f59e0b'
                      : '#2d6a78',
                  }}
                  className="h-full transition-[width] duration-150"
                />
              </div>

              {/* Shallow water or Safe Room status badges */}
              {hud.inShallowWater && (
                <div className="mt-1.5 rounded border border-cyan-500/40 bg-cyan-950/50 px-2 py-0.5 text-[10px] text-cyan-200">
                  {STRINGS.HUD_WATER_SHALLOW_BADGE}
                </div>
              )}
              {!hud.inShallowWater && hud.inSafeSanctuary && (
                <div className="mt-1.5 rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-200">
                  {STRINGS.HUD_SAFE_ROOM_BADGE}
                </div>
              )}

              {/* Wet Exposure progress (> 3 s in water wets items) */}
              {hud.wetExposureSec > 0.08 &&
                hud.wetExposureSec < CONFIG.ITEM_WET_EXPOSURE_SEC && (
                  <div className="mt-1.5">
                    <div className="flex justify-between text-[10px] text-sky-300">
                      <span>{STRINGS.HUD_WET_EXPOSURE_LABEL}</span>
                      <span className="font-vn-mono tabular-nums">
                        {hud.wetExposureSec.toFixed(1)}s /{' '}
                        {CONFIG.ITEM_WET_EXPOSURE_SEC.toFixed(0)}s
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            (hud.wetExposureSec / CONFIG.ITEM_WET_EXPOSURE_SEC) *
                              100
                          ).toFixed(1)}%`,
                        }}
                        className="h-full bg-sky-400 transition-[width] duration-75"
                      />
                    </div>
                  </div>
                )}

              {/* Drying progress (40 s in dry safe area dries wet items) */}
              {hud.hasWetItems && hud.dryRecoverySec > 0.1 && (
                <div className="mt-1.5">
                  <div className="flex justify-between text-[10px] text-amber-300">
                    <span>{STRINGS.HUD_DRYING_PROGRESS_LABEL}</span>
                    <span className="font-vn-mono tabular-nums">
                      {Math.floor(hud.dryRecoverySec)}s /{' '}
                      {CONFIG.ITEM_DRY_RECOVERY_SEC.toFixed(0)}s
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (hud.dryRecoverySec / CONFIG.ITEM_DRY_RECOVERY_SEC) *
                            100
                        ).toFixed(1)}%`,
                      }}
                      className="h-full bg-amber-400 transition-[width] duration-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* F3 Debug Overlay (includes dev-only [T] tide phase jump) */}
      {debugVisible && (
        <aside
          aria-live="polite"
          className="font-vn-mono pointer-events-none absolute top-4 left-4 z-20 rounded-md border border-slate-700/80 bg-slate-950/90 px-3.5 py-2.5 text-xs text-slate-200 tabular-nums shadow-lg space-y-0.5"
        >
          <div className="font-semibold text-amber-400 mb-1">
            {STRINGS.DEBUG_TITLE}
          </div>
          <div>
            {STRINGS.DEBUG_FPS}: {debugMetrics.fps}
          </div>
          <div>
            {STRINGS.DEBUG_POS}: X={debugMetrics.x.toFixed(2)}, Y=
            {debugMetrics.y.toFixed(2)}, Z={debugMetrics.z.toFixed(2)}
          </div>
          <div>
            {STRINGS.DEBUG_TILE}: ({debugMetrics.col}, {debugMetrics.row})
          </div>
          <div>
            {STRINGS.DEBUG_SPEED}: {debugMetrics.speed.toFixed(2)} m/s (
            {moveStateLabel})
          </div>
          <div>
            {STRINGS.DEBUG_DRAW_CALLS}: {debugMetrics.drawCalls}
          </div>
          <div>
            {STRINGS.DEBUG_TIDE_LABEL}:{' '}
            {getTidePhaseLabel(debugMetrics.tidePhase)} ·{' '}
            {(debugMetrics.waterLevel * 100).toFixed(0)}% (
            {debugMetrics.tideClockSec.toFixed(0)}s/{CONFIG.TIDE_CYCLE_SEC}s)
          </div>
          <div className="pt-1 text-[11px] text-amber-300">
            {STRINGS.DEBUG_TIDE_JUMP_HINT}
          </div>
        </aside>
      )}

      {/* Pointer Lock Fallback Hint (when inside restricted preview iframe) */}
      {pointerLockFallback &&
        !isPaused &&
        !isInventoryOpen &&
        !hud.hasWon &&
        !hud.isCollapsed && (
          <div className="font-vn-sans pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-950/95 px-4 py-2 text-xs text-slate-300 shadow-lg max-w-xl">
            <span>{STRINGS.DRAG_LOOK_FALLBACK_HINT}</span>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 whitespace-nowrap rounded bg-amber-500 px-2.5 py-1 font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              {STRINGS.OPEN_NEW_TAB_LABEL}
            </a>
          </div>
        )}

      {/* Discreet bottom-right Inventory [I] & Pause [Esc] buttons */}
      {!isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div className="font-vn-sans pointer-events-auto absolute bottom-5 right-5 z-20 flex items-center gap-3 rounded-md border border-slate-800/90 bg-slate-950/85 px-3.5 py-1.5 text-xs text-slate-400">
          {!pointerLocked && !pointerLockFallback && !isInventoryOpen && (
            <>
              <span className="text-slate-300">{STRINGS.CLICK_TO_LOCK_HINT}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <button
            type="button"
            onClick={() => handleToggleInventory(!isInventoryOpen)}
            className="cursor-pointer font-medium text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
          >
            {STRINGS.HUD_INVENTORY_HINT} ({hud.usedSlots}/{hud.maxSlots})
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="cursor-pointer font-medium text-slate-200 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            {STRINGS.SETTINGS_BUTTON_LABEL}
          </button>
        </div>
      )}

      {/* 12-Slot Inventory Modal (Press I to open/close; releases pointer lock while open) */}
      {isInventoryOpen && !isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div className="font-vn-sans pointer-events-auto absolute inset-0 z-25 flex items-center justify-center bg-slate-950/80 p-4">
          <section className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-amber-400">
                  {STRINGS.INV_TITLE}
                </h2>
                <p className="text-xs text-slate-400">
                  {STRINGS.INV_SLOTS_LABEL}:{' '}
                  <span className="font-vn-mono font-semibold text-slate-200">
                    {hud.usedSlots} / {hud.maxSlots}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleInventory(false)}
                className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {STRINGS.INV_CLOSE_BUTTON}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
              {/* 12-Slot Grid (4 cols x 3 rows; rope spans 2 slots) */}
              <div className="md:col-span-7">
                <div className="grid grid-cols-4 gap-2.5">
                  {hud.inventoryItems.map((item) => {
                    const meta = getItemMetadata(item.kind);
                    const isSelected = selectedItem?.id === item.id;
                    const iconUrl = getProceduralItemIcon(
                      item.kind,
                      item.condition
                    );
                    const condBadgeColor =
                      item.condition === 'wet'
                        ? 'text-sky-300 border-sky-500/40 bg-sky-950/60'
                        : item.condition === 'damaged'
                          ? 'text-rose-300 border-rose-500/40 bg-rose-950/60'
                          : 'text-slate-400 border-slate-700 bg-slate-900/70';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setInspectedItemId(item.id);
                        }}
                        className={`relative flex h-20 flex-col items-center justify-between rounded-lg border p-2 text-left transition-all cursor-pointer ${
                          item.slotCost === 2 ? 'col-span-2' : 'col-span-1'
                        } ${
                          isSelected
                            ? 'border-amber-400 bg-slate-800/95 ring-2 ring-amber-400/25'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between text-[10px]">
                          <span
                            className={`rounded border px-1 py-0.2 ${condBadgeColor}`}
                          >
                            {getConditionLabel(item.condition)}
                          </span>
                          <span className="font-vn-mono font-semibold text-amber-300">
                            {item.slotCost === 2
                              ? '2 ô'
                              : item.quantity > 1 || item.kind === 'matches'
                                ? `x${item.quantity}`
                                : ''}
                          </span>
                        </div>

                        {iconUrl && (
                          <img
                            src={iconUrl}
                            alt={STRINGS[meta.nameKey]}
                            className="h-9 w-9 object-contain"
                          />
                        )}

                        <div className="w-full truncate text-center text-[11px] font-medium text-slate-200">
                          {STRINGS[meta.nameKey]}
                        </div>
                      </button>
                    );
                  })}

                  {/* Render remaining empty slots up to 12 */}
                  {Array.from({ length: emptySlotCount }).map((_, idx) => (
                    <div
                      key={`empty_${idx}`}
                      className="col-span-1 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-800/70 bg-slate-950/40 text-[10px] text-slate-600"
                    >
                      Trống
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel: Selected Item Details & Actions (Use, Inspect, Drop) */}
              <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/75 p-4 md:col-span-5">
                {selectedItem ? (
                  <>
                    <div>
                      <div className="flex items-center gap-3">
                        <img
                          src={getProceduralItemIcon(
                            selectedItem.kind,
                            selectedItem.condition
                          )}
                          alt={STRINGS[getItemMetadata(selectedItem.kind).nameKey]}
                          className="h-12 w-12 rounded border border-slate-800 bg-slate-900 p-1"
                        />
                        <div>
                          <h3 className="text-sm font-bold text-amber-300">
                            {
                              STRINGS[
                                getItemMetadata(selectedItem.kind).nameKey
                              ]
                            }
                          </h3>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                            <span>
                              {STRINGS.INV_CONDITION_LABEL}:{' '}
                              <strong
                                className={
                                  selectedItem.condition === 'wet'
                                    ? 'text-sky-300'
                                    : selectedItem.condition === 'damaged'
                                      ? 'text-rose-300'
                                      : 'text-emerald-300'
                                }
                              >
                                {getConditionLabel(selectedItem.condition)}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>
                              {STRINGS.INV_SLOT_COST_LABEL}:{' '}
                              <strong className="font-vn-mono text-slate-200">
                                {selectedItem.slotCost}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>
                              {STRINGS.INV_STACK_LABEL}:{' '}
                              <strong className="font-vn-mono text-slate-200">
                                {selectedItem.quantity}/{selectedItem.maxStack}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Detailed description (highlighted when inspected) */}
                      <p
                        className={`mt-3 rounded border p-2.5 text-xs leading-relaxed transition-colors ${
                          inspectedItemId === selectedItem.id
                            ? 'border-amber-500/40 bg-amber-950/20 text-slate-200'
                            : 'border-slate-800/80 bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        {STRINGS[getItemMetadata(selectedItem.kind).descKey]}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          controllerRef.current?.useInventoryItem(
                            selectedItem.id
                          )
                        }
                        className="cursor-pointer rounded-md bg-amber-500 px-2.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
                      >
                        {STRINGS.INV_ACTION_USE}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectedItemId(selectedItem.id)}
                        className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        {STRINGS.INV_ACTION_INSPECT}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          controllerRef.current?.dropInventoryItem(
                            selectedItem.id
                          )
                        }
                        className="cursor-pointer rounded-md border border-rose-800/70 bg-rose-950/50 px-2.5 py-2 text-xs font-medium text-rose-200 hover:bg-rose-900/60 transition-colors"
                      >
                        {STRINGS.INV_ACTION_DROP}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs leading-relaxed text-slate-400">
                    {hud.inventoryItems.length === 0
                      ? STRINGS.INV_EMPTY_HINT
                      : STRINGS.INV_SELECT_ITEM_HINT}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Esc Pause, Restart, Main Menu & Comfort / Audio Settings Menu */}
      {isPaused && !hud.hasWon && !hud.isCollapsed && (
        <div className="font-vn-sans pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4">
          <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 className="text-xl font-bold tracking-tight text-amber-400">
              {STRINGS.MENU_TITLE}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {STRINGS.MENU_SUBTITLE}
            </p>

            <div className="mt-6 space-y-4">
              {/* Mouse Sensitivity */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="sensitivity-slider" className="text-slate-200">
                    {STRINGS.SETTING_SENSITIVITY}
                  </label>
                  <span className="font-vn-mono text-xs text-amber-400 tabular-nums">
                    {settings.mouseSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  id="sensitivity-slider"
                  type="range"
                  min={CONFIG.MIN_MOUSE_SENSITIVITY}
                  max={CONFIG.MAX_MOUSE_SENSITIVITY}
                  step={CONFIG.MOUSE_SENSITIVITY_STEP}
                  value={settings.mouseSensitivity}
                  onChange={(e) =>
                    updateComfortSettings({
                      ...settings,
                      mouseSensitivity: parseFloat(e.target.value),
                    })
                  }
                  className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* FOV (60 - 90) */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="fov-slider" className="text-slate-200">
                    {STRINGS.SETTING_FOV}
                  </label>
                  <span className="font-vn-mono text-xs text-amber-400 tabular-nums">
                    {settings.fov}
                    {STRINGS.SETTING_FOV_UNIT}
                  </span>
                </div>
                <input
                  id="fov-slider"
                  type="range"
                  min={CONFIG.MIN_FOV}
                  max={CONFIG.MAX_FOV}
                  step={1}
                  value={settings.fov}
                  onChange={(e) =>
                    updateComfortSettings({
                      ...settings,
                      fov: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Master Volume */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="volume-slider" className="text-slate-200">
                    {STRINGS.SETTING_MASTER_VOLUME}
                  </label>
                  <span className="font-vn-mono text-xs text-amber-400 tabular-nums">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  id="volume-slider"
                  type="range"
                  min={CONFIG.MIN_MASTER_VOLUME}
                  max={CONFIG.MAX_MASTER_VOLUME}
                  step={CONFIG.MASTER_VOLUME_STEP}
                  value={settings.masterVolume}
                  onChange={(e) =>
                    updateComfortSettings({
                      ...settings,
                      masterVolume: parseFloat(e.target.value),
                    })
                  }
                  className="mt-1.5 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Mute Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-200">
                  {STRINGS.SETTING_MUTE}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateComfortSettings({
                      ...settings,
                      muted: !settings.muted,
                    })
                  }
                  className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    !settings.muted
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {settings.muted
                    ? STRINGS.SETTING_MUTED_LABEL
                    : STRINGS.SETTING_UNMUTED_LABEL}
                </button>
              </div>

              {/* Head-bob & Sway On/Off */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-200">
                  {STRINGS.SETTING_HEAD_BOB}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateComfortSettings({
                      ...settings,
                      headBob: !settings.headBob,
                    })
                  }
                  className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    settings.headBob
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {settings.headBob ? STRINGS.SETTING_ON : STRINGS.SETTING_OFF}
                </button>
              </div>
            </div>

            <div className="mt-7 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 cursor-pointer rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
              >
                {STRINGS.RESUME_BUTTON}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                {STRINGS.RESTART_BUTTON}
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                {STRINGS.RESET_DEFAULTS_BUTTON}
              </button>
            </div>

            <button
              type="button"
              onClick={onExitToMainMenu}
              className="mt-2.5 w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 whitespace-nowrap"
            >
              {STRINGS.MAIN_MENU_BUTTON}
            </button>
          </section>
        </div>
      )}

      {/* Collapse Screen when Health reaches 0 from starvation/dehydration */}
      {hud.isCollapsed && !hud.hasWon && (
        <div className="font-vn-sans pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6">
          <section className="w-full max-w-md rounded-xl border border-rose-500/40 bg-slate-900 p-8 text-center text-slate-100 shadow-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-rose-400">
              {STRINGS.COLLAPSE_TITLE}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {STRINGS.COLLAPSE_SUBTITLE}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {STRINGS.COLLAPSE_DESCRIPTION}
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleRestart}
                className="flex-1 cursor-pointer rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
              >
                {STRINGS.WIN_RESTART_BUTTON}
              </button>
              <button
                type="button"
                onClick={onExitToMainMenu}
                className="flex-1 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                {STRINGS.WIN_MAIN_MENU_BUTTON}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Win Screen when carrying the Artifact to the Exit */}
      {hud.hasWon && (
        <div className="font-vn-sans pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-6">
          <section className="w-full max-w-md rounded-xl border border-amber-500/40 bg-slate-900 p-8 text-center text-slate-100 shadow-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-amber-400">
              {STRINGS.WIN_TITLE}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {STRINGS.WIN_SUBTITLE}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {STRINGS.WIN_DESCRIPTION}
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleRestart}
                className="flex-1 cursor-pointer rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
              >
                {STRINGS.WIN_RESTART_BUTTON}
              </button>
              <button
                type="button"
                onClick={onExitToMainMenu}
                className="flex-1 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                {STRINGS.WIN_MAIN_MENU_BUTTON}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [saveResult, setSaveResult] = useState<LoadSaveResult>(() =>
    loadGameStateFromStorage()
  );
  const [activeSaveState, setActiveSaveState] = useState<GameState | null>(
    null
  );

  const hasValidSave = saveResult.status === 'ok' && saveResult.state !== null;

  const saveWarningMessage =
    saveResult.status === 'corrupt'
      ? STRINGS.SAVE_CORRUPT_WARNING
      : saveResult.status === 'wrong_version'
        ? STRINGS.SAVE_VERSION_WARNING
        : null;

  const handleContinueGame = () => {
    const fresh = loadGameStateFromStorage();
    setSaveResult(fresh);
    if (fresh.status === 'ok' && fresh.state) {
      setActiveSaveState(fresh.state);
      setStarted(true);
    }
  };

  const handleNewGame = () => {
    clearGameStateFromStorage();
    setActiveSaveState(null);
    setSaveResult({ status: 'empty', state: null });
    setStarted(true);
  };

  const handleExitToMainMenu = () => {
    setStarted(false);
    setSaveResult(loadGameStateFromStorage());
  };

  if (started) {
    return (
      <CaveViewport
        initialSavedState={activeSaveState}
        onExitToMainMenu={handleExitToMainMenu}
      />
    );
  }

  return (
    <main className="font-vn-sans min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none">
      <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-amber-400">
          {STRINGS.GAME_TITLE}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{STRINGS.GAME_SUBTITLE}</p>

        {saveWarningMessage && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-amber-500/45 bg-amber-950/40 px-4 py-2.5 text-left text-xs leading-relaxed text-amber-200"
          >
            {saveWarningMessage}
          </div>
        )}

        {showControls && (
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-amber-400">
              {STRINGS.CONTROLS_HEADING}
            </p>
            <p>{STRINGS.CONTROL_LOOK}</p>
            <p>{STRINGS.CONTROL_MOVE}</p>
            <p>{STRINGS.CONTROL_RUN}</p>
            <p>{STRINGS.CONTROL_INTERACT}</p>
            <p>{STRINGS.CONTROL_MATCH}</p>
            <p>{STRINGS.CONTROL_INVENTORY}</p>
            <p>{STRINGS.CONTROL_PAUSE}</p>
            <p>{STRINGS.CONTROL_DEBUG}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={!hasValidSave}
            onClick={handleContinueGame}
            className={`w-full rounded-lg px-6 py-3 text-base font-semibold transition-colors duration-150 whitespace-nowrap ${
              hasValidSave
                ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400'
                : 'cursor-not-allowed border border-slate-800 bg-slate-900/60 text-slate-600'
            }`}
          >
            {STRINGS.CONTINUE_BUTTON}
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className={`w-full cursor-pointer rounded-lg px-6 py-3 text-base font-semibold transition-colors duration-150 whitespace-nowrap ${
              hasValidSave
                ? 'border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400'
            }`}
          >
            {STRINGS.NEW_GAME_BUTTON}
          </button>
          <button
            type="button"
            onClick={() => setShowControls((prev) => !prev)}
            className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-6 py-2.5 text-sm font-medium text-slate-200 transition-colors duration-150 hover:bg-slate-700 whitespace-nowrap"
          >
            {showControls ? STRINGS.BACK_BUTTON : STRINGS.CONTROLS_BUTTON}
          </button>
        </div>
      </section>
    </main>
  );
}
