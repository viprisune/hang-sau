import { useEffect, useRef, useState } from 'react';
import { ComfortSettings, CONFIG } from './config';
import {
  CaveRendererController,
  createCaveRenderer,
  DebugMetrics,
} from './game/caveRenderer';
import { STRINGS } from './strings';

const DEFAULT_SETTINGS: ComfortSettings = {
  mouseSensitivity: CONFIG.DEFAULT_MOUSE_SENSITIVITY,
  fov: CONFIG.DEFAULT_FOV,
  headBob: CONFIG.DEFAULT_HEAD_BOB,
};

function CaveViewport() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CaveRendererController | null>(null);

  const [settings, setSettings] = useState<ComfortSettings>(DEFAULT_SETTINGS);
  const [isPaused, setIsPaused] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [pointerLockFallback, setPointerLockFallback] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    fps: 60,
    x: 0,
    y: CONFIG.EYE_HEIGHT,
    z: 0,
    col: 4,
    row: 5,
    speed: 0,
    isMoving: false,
    isRunning: false,
    drawCalls: 1,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Guard against duplicate canvases under React StrictMode
    if (controllerRef.current) {
      controllerRef.current.dispose();
      controllerRef.current = null;
    }

    const controller = createCaveRenderer(container, DEFAULT_SETTINGS, {
      onDebugUpdate: (metrics) => {
        setDebugMetrics(metrics);
      },
      onToggleDebug: () => {
        setDebugVisible((prev) => !prev);
      },
      onPauseChange: (paused) => {
        setIsPaused(paused);
      },
      onPointerLockFallback: () => {
        setPointerLockFallback(true);
      },
      onPointerLockStateChange: (locked) => {
        setPointerLocked(locked);
      },
    });

    controllerRef.current = controller;

    // Attempt initial pointer lock after starting from button click
    controller.requestPointerLock();

    return () => {
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
    };
  }, []);

  const updateComfortSettings = (next: ComfortSettings) => {
    setSettings(next);
    controllerRef.current?.updateSettings(next);
  };

  const handleResume = () => {
    setIsPaused(false);
    controllerRef.current?.setPaused(false, true);
  };

  const handleOpenSettings = () => {
    setIsPaused(true);
    controllerRef.current?.setPaused(true, false);
  };

  const handleResetDefaults = () => {
    updateComfortSettings(DEFAULT_SETTINGS);
  };

  const moveStateLabel = !debugMetrics.isMoving
    ? STRINGS.DEBUG_STATE_IDLE
    : debugMetrics.isRunning
      ? STRINGS.DEBUG_STATE_RUN
      : STRINGS.DEBUG_STATE_WALK;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated empty mount container for Three.js WebGL canvas */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* F3 Debug Overlay */}
      {debugVisible && (
        <aside
          aria-live="polite"
          className="pointer-events-none absolute top-4 left-4 z-20 rounded-md border border-slate-700/80 bg-slate-950/90 px-3.5 py-2.5 font-mono text-xs text-slate-200 tabular-nums shadow-lg"
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
        </aside>
      )}

      {/* Pointer Lock Fallback Hint (when inside restricted preview iframe) */}
      {pointerLockFallback && !isPaused && (
        <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-950/95 px-4 py-2 text-xs text-slate-300 shadow-lg max-w-xl">
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

      {/* Discreet bottom bar when playing */}
      {!isPaused && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 rounded-md border border-slate-800/90 bg-slate-950/85 px-4 py-1.5 text-xs text-slate-400">
          {!pointerLocked && !pointerLockFallback && (
            <>
              <span className="text-slate-300">{STRINGS.CLICK_TO_LOCK_HINT}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{STRINGS.CONTROL_MOVE}</span>
          <span aria-hidden="true">·</span>
          <span>{STRINGS.CONTROL_RUN}</span>
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

      {/* Esc Pause & Comfort Settings Menu */}
      {isPaused && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4">
          <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 className="text-xl font-bold tracking-tight text-amber-400">
              {STRINGS.MENU_TITLE}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {STRINGS.MENU_SUBTITLE}
            </p>

            <div className="mt-6 space-y-5">
              {/* Mouse Sensitivity */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="sensitivity-slider" className="text-slate-200">
                    {STRINGS.SETTING_SENSITIVITY}
                  </label>
                  <span className="font-mono text-xs text-amber-400 tabular-nums">
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
                  className="mt-2 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* FOV (60 - 90) */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="fov-slider" className="text-slate-200">
                    {STRINGS.SETTING_FOV}
                  </label>
                  <span className="font-mono text-xs text-amber-400 tabular-nums">
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
                  className="mt-2 w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Head-bob On/Off */}
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

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 cursor-pointer rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
              >
                {STRINGS.RESUME_BUTTON}
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 whitespace-nowrap"
              >
                {STRINGS.RESET_DEFAULTS_BUTTON}
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

  if (started) {
    return <CaveViewport />;
  }

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none">
      <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-amber-400">
          {STRINGS.GAME_TITLE}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{STRINGS.GAME_SUBTITLE}</p>

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">
            {STRINGS.CONTROLS_HEADING}
          </p>
          <p>{STRINGS.CONTROL_LOOK}</p>
          <p>{STRINGS.CONTROL_MOVE}</p>
          <p>{STRINGS.CONTROL_RUN}</p>
          <p>{STRINGS.CONTROL_PAUSE}</p>
          <p>{STRINGS.CONTROL_DEBUG}</p>
        </div>

        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-8 w-full cursor-pointer rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-slate-950 transition-colors duration-150 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap"
        >
          {STRINGS.START_BUTTON}
        </button>
      </section>
    </main>
  );
}
