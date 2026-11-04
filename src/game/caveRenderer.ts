import * as THREE from 'three';
import { ComfortSettings, CONFIG } from '../config';
import {
  CAVE_MAP,
  PLAYER_INITIAL_YAW,
  PLAYER_SPAWN_TILE,
  tileToWorldCenter,
} from '../data/caveMap';
import {
  applyMouseLook,
  MovementInput,
  PlayerMovementState,
  stepPlayerMovement,
} from '../logic/movement';
import { buildCaveMesh } from './caveGeometry';

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
}

export interface CaveRendererCallbacks {
  onDebugUpdate: (metrics: DebugMetrics) => void;
  onToggleDebug: () => void;
  onPauseChange: (paused: boolean) => void;
  onPointerLockFallback: () => void;
  onPointerLockStateChange: (locked: boolean) => void;
}

export interface CaveRendererController {
  updateSettings: (settings: ComfortSettings) => void;
  setPaused: (paused: boolean, requestLock?: boolean) => void;
  requestPointerLock: () => void;
  dispose: () => void;
}

/**
 * Detects software WebGL rasterizers (SwiftShader, llvmpipe, softpipe) from the
 * WebGL renderer string so pixel ratio and frame pacing stay responsive everywhere.
 */
function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function createCaveRenderer(
  container: HTMLElement,
  initialSettings: ComfortSettings,
  callbacks: CaveRendererCallbacks
): CaveRendererController {
  const isSoftwareGl = detectSoftwareGl();

  // 1. Scene & Cold Dark Fog
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.BACKGROUND);
  scene.fog = new THREE.FogExp2(CONFIG.FOG_COLOR, CONFIG.FOG_DENSITY);

  // 2. First-person PerspectiveCamera at 1.6m eye height
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  const camera = new THREE.PerspectiveCamera(
    initialSettings.fov,
    width / Math.max(1, height),
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR
  );
  camera.rotation.order = 'YXZ';

  // 3. WebGLRenderer (no real-time shadow maps, capped pixel ratio)
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  );
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = false;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // 4. Cold Dim Ambient + Hemisphere Lighting (no flame / point light yet)
  const ambientLight = new THREE.AmbientLight(
    CONFIG.AMBIENT_LIGHT_COLOR,
    CONFIG.AMBIENT_LIGHT_INTENSITY
  );
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(
    CONFIG.HEMI_SKY_COLOR,
    CONFIG.HEMI_GROUND_COLOR,
    CONFIG.HEMI_LIGHT_INTENSITY
  );
  hemiLight.position.set(0, CONFIG.CEILING_HEIGHT, 0);
  scene.add(hemiLight);

  // 5. Build merged low-poly cave mesh
  const cave = buildCaveMesh();
  scene.add(cave.mesh);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // 6. Initialize player state at entrance spawn
  const spawn = tileToWorldCenter(PLAYER_SPAWN_TILE);
  let playerState: PlayerMovementState = {
    x: spawn.x,
    z: spawn.z,
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

  let settings: ComfortSettings = { ...initialSettings };
  let isPaused = false;
  let pointerLockSupported = true;
  let isDraggingLook = false;
  let lastDragX = 0;
  let lastDragY = 0;

  const pressedKeys = new Set<string>();

  const syncCameraTransform = () => {
    const cosYaw = Math.cos(playerState.yaw);
    const sinYaw = Math.sin(playerState.yaw);
    const eyeX = playerState.x + cosYaw * playerState.bobOffsetX;
    const eyeZ = playerState.z - sinYaw * playerState.bobOffsetX;
    const eyeY = CONFIG.EYE_HEIGHT + playerState.bobOffsetY;

    camera.position.set(eyeX, eyeY, eyeZ);
    camera.rotation.y = playerState.yaw;
    camera.rotation.x = playerState.pitch;
  };
  syncCameraTransform();

  // 7. Pointer Lock & Drag-to-Look Fallback
  const tryRequestPointerLock = () => {
    if (isPaused) return;
    const canvas = renderer.domElement;
    if (!canvas.requestPointerLock) {
      pointerLockSupported = false;
      callbacks.onPointerLockFallback();
      return;
    }
    try {
      const maybePromise = canvas.requestPointerLock() as unknown as
        | Promise<void>
        | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          pointerLockSupported = false;
          callbacks.onPointerLockFallback();
        });
      }
    } catch {
      pointerLockSupported = false;
      callbacks.onPointerLockFallback();
    }
  };

  const onPointerLockChange = () => {
    const locked = document.pointerLockElement === renderer.domElement;
    callbacks.onPointerLockStateChange(locked);
    if (!locked && !isPaused) {
      // Esc released pointer lock -> open Esc pause/settings menu
      isPaused = true;
      pressedKeys.clear();
      callbacks.onPauseChange(true);
    }
  };

  const onPointerLockError = () => {
    pointerLockSupported = false;
    callbacks.onPointerLockStateChange(false);
    callbacks.onPointerLockFallback();
  };

  const onCanvasMouseDown = (e: MouseEvent) => {
    if (isPaused || e.button !== 0) return;
    if (document.pointerLockElement !== renderer.domElement) {
      if (pointerLockSupported) {
        tryRequestPointerLock();
      }
      // Enable drag-to-look simultaneously in case pointer lock is blocked by iframe sandbox
      isDraggingLook = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  };

  const onWindowMouseMove = (e: MouseEvent) => {
    if (isPaused) return;
    if (document.pointerLockElement === renderer.domElement) {
      const next = applyMouseLook(
        playerState.yaw,
        playerState.pitch,
        e.movementX,
        e.movementY,
        settings.mouseSensitivity
      );
      playerState.yaw = next.yaw;
      playerState.pitch = next.pitch;
    } else if (isDraggingLook) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      const next = applyMouseLook(
        playerState.yaw,
        playerState.pitch,
        dx,
        dy,
        settings.mouseSensitivity
      );
      playerState.yaw = next.yaw;
      playerState.pitch = next.pitch;
    }
  };

  const onWindowMouseUp = () => {
    isDraggingLook = false;
  };

  // 8. Keyboard Controls (WASD, Arrows, Shift, F3, Esc)
  const onWindowKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F3' || e.key === 'F3') {
      e.preventDefault();
      callbacks.onToggleDebug();
      return;
    }

    if (e.code === 'Escape' || e.key === 'Escape') {
      // If pointer is NOT locked (e.g., in iframe fallback mode), Esc toggles the menu directly
      if (document.pointerLockElement !== renderer.domElement) {
        e.preventDefault();
        isPaused = !isPaused;
        pressedKeys.clear();
        isDraggingLook = false;
        callbacks.onPauseChange(isPaused);
      }
      return;
    }

    if (isPaused) return;

    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Space'
    ) {
      e.preventDefault();
    }

    pressedKeys.add(e.code);
  };

  const onWindowKeyUp = (e: KeyboardEvent) => {
    pressedKeys.delete(e.code);
  };

  const onWindowBlur = () => {
    pressedKeys.clear();
    isDraggingLook = false;
  };

  const onWindowResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
  renderer.domElement.addEventListener('mousedown', onCanvasMouseDown);
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener('keydown', onWindowKeyDown);
  window.addEventListener('keyup', onWindowKeyUp);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('resize', onWindowResize);

  // 9. Game Loop & FPS Tracking
  let frameId = 0;
  let disposed = false;
  let lastTime = performance.now();
  let fpsSmooth = 60;
  let debugBroadcastTimer = 0;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (disposed) return;

    const now = performance.now();
    const rawDeltaSec = Math.max(0.0001, (now - lastTime) / 1000);
    lastTime = now;

    const instantFps = 1 / rawDeltaSec;
    fpsSmooth = fpsSmooth * 0.9 + instantFps * 0.1;

    if (!isPaused) {
      const input: MovementInput = {
        forward: pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp'),
        backward: pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown'),
        left: pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight'),
        run: pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight'),
      };

      playerState = stepPlayerMovement(
        playerState,
        input,
        rawDeltaSec,
        CAVE_MAP,
        settings.headBob
      );
      syncCameraTransform();
    }

    renderer.render(scene, camera);

    debugBroadcastTimer += rawDeltaSec;
    if (debugBroadcastTimer >= 0.1) {
      debugBroadcastTimer = 0;
      callbacks.onDebugUpdate({
        fps: Math.round(Math.min(240, fpsSmooth)),
        x: playerState.x,
        y: camera.position.y,
        z: playerState.z,
        col: Math.floor(playerState.x / CONFIG.TILE_SIZE),
        row: Math.floor(playerState.z / CONFIG.TILE_SIZE),
        speed: playerState.speed,
        isMoving: playerState.isMoving,
        isRunning: playerState.isRunning,
        drawCalls: renderer.info.render.calls,
      });
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  frameId = requestAnimationFrame(tick);

  return {
    updateSettings(nextSettings: ComfortSettings) {
      settings = { ...nextSettings };
      if (camera.fov !== settings.fov) {
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
      }
    },
    setPaused(nextPaused: boolean, requestLock = false) {
      isPaused = nextPaused;
      pressedKeys.clear();
      isDraggingLook = false;
      if (nextPaused) {
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock?.();
        }
      } else if (requestLock && pointerLockSupported) {
        tryRequestPointerLock();
      }
    },
    requestPointerLock() {
      tryRequestPointerLock();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }

      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      renderer.domElement.removeEventListener('mousedown', onCanvasMouseDown);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('keydown', onWindowKeyDown);
      window.removeEventListener('keyup', onWindowKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onWindowResize);

      scene.remove(cave.mesh);
      cave.geometry.dispose();
      cave.material.dispose();

      renderer.dispose();
      container.innerHTML = '';
    },
  };
}
