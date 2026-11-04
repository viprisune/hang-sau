import { CONFIG } from '../config';
import { CHAMBER_PROPS, isWallTile, TileType } from '../data/caveMap';
import { getTileWaterStatus, LEVEL_GAP } from '../data/levelData';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

export interface PlayerMovementState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
  yaw: number;
  pitch: number;
  bobPhase: number;
  bobOffsetX: number;
  bobOffsetY: number;
  isMoving: boolean;
  isRunning: boolean;
}

interface WallBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  distSq: number;
}

function pushBoxCandidate(
  candidates: WallBox2D[],
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): void {
  const nearestX = Math.max(minX, Math.min(x, maxX));
  const nearestZ = Math.max(minZ, Math.min(z, maxZ));
  const dx = x - nearestX;
  const dz = z - nearestZ;
  candidates.push({
    minX,
    maxX,
    minZ,
    maxZ,
    distSq: dx * dx + dz * dz,
  });
}

/**
 * Resolves a circle of radius `radius` at `(x, z)` against nearby solid wall tiles,
 * deep-flooded tiles (`getTileWaterStatus === 'deep'`), the dangerous gap pit
 * (impassable unless `ropeTied` is true, which opens a narrow crossing lane),
 * and solid chamber stalagmites/boulders.
 */
function resolveCircleCollision(
  map: readonly (readonly TileType[])[],
  inX: number,
  inZ: number,
  radius: number,
  tileSize: number,
  ropeTied: boolean,
  waterLevel: number,
  startCol: number,
  startRow: number
): { x: number; z: number } {
  let x = inX;
  let z = inZ;
  const rSq = radius * radius;
  const startIsDeep =
    getTileWaterStatus(startCol, startRow, waterLevel) === 'deep';

  // Two relaxation passes handle tight 90-degree corners and 1-tile narrow corridors cleanly
  for (let pass = 0; pass < 2; pass++) {
    const centerCol = Math.floor(x / tileSize);
    const centerRow = Math.floor(z / tileSize);

    const candidates: WallBox2D[] = [];
    for (let row = centerRow - 1; row <= centerRow + 1; row++) {
      for (let col = centerCol - 1; col <= centerCol + 1; col++) {
        const isWall = isWallTile(map, col, row);
        const isDeepWater =
          !isWall &&
          getTileWaterStatus(col, row, waterLevel) === 'deep' &&
          // If the tide rose to 'deep' while the player was already standing on (startCol, startRow),
          // allow them to step off their own tile onto an adjacent shallow/dry tile without pinning them inside.
          !(startIsDeep && col === startCol && row === startRow);

        if (!isWall && !isDeepWater) continue;
        pushBoxCandidate(
          candidates,
          x,
          z,
          col * tileSize,
          (col + 1) * tileSize,
          row * tileSize,
          (row + 1) * tileSize
        );
      }
    }

    // Gap collision: impassable across full pit width when untied;
    // when tied, opens a narrow route along [bridgeCenterX - bridgeHalfWidth, bridgeCenterX + bridgeHalfWidth]
    if (!ropeTied) {
      pushBoxCandidate(
        candidates,
        x,
        z,
        LEVEL_GAP.minX,
        LEVEL_GAP.maxX,
        LEVEL_GAP.minZ,
        LEVEL_GAP.maxZ
      );
    } else {
      const leftEdge = LEVEL_GAP.bridgeCenterX - LEVEL_GAP.bridgeHalfWidth;
      const rightEdge = LEVEL_GAP.bridgeCenterX + LEVEL_GAP.bridgeHalfWidth;
      if (leftEdge > LEVEL_GAP.minX) {
        pushBoxCandidate(
          candidates,
          x,
          z,
          LEVEL_GAP.minX,
          leftEdge,
          LEVEL_GAP.minZ,
          LEVEL_GAP.maxZ
        );
      }
      if (rightEdge < LEVEL_GAP.maxX) {
        pushBoxCandidate(
          candidates,
          x,
          z,
          rightEdge,
          LEVEL_GAP.maxX,
          LEVEL_GAP.minZ,
          LEVEL_GAP.maxZ
        );
      }
    }

    // Sort closest wall first so flat wall edges resolve before diagonal corners
    candidates.sort((a, b) => a.distSq - b.distSq);

    for (const box of candidates) {
      const nearestX = Math.max(box.minX, Math.min(x, box.maxX));
      const nearestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const ox = x - nearestX;
      const oz = z - nearestZ;
      const distSq = ox * ox + oz * oz;

      if (distSq < rSq) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          x += (ox / dist) * overlap;
          z += (oz / dist) * overlap;
        } else {
          // Fallback if center is exactly inside the box: push to nearest edge
          const leftPen = x - box.minX;
          const rightPen = box.maxX - x;
          const topPen = z - box.minZ;
          const bottomPen = box.maxZ - z;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) x = box.minX - radius;
          else if (minPen === rightPen) x = box.maxX + radius;
          else if (minPen === topPen) z = box.minZ - radius;
          else z = box.maxZ + radius;
        }
      }
    }

    // Resolve against solid chamber stalagmites and boulders
    for (const prop of CHAMBER_PROPS) {
      if (!prop.solid) continue;
      const minDist = radius + prop.radius;
      const dx = x - prop.x;
      const dz = z - prop.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        x += (dx / dist) * overlap;
        z += (dz / dist) * overlap;
      }
    }
  }

  // Hard world boundary clamp so the player can never leave the map
  const minWorldX = tileSize + radius;
  const maxWorldX = (CONFIG.MAP_COLS - 1) * tileSize - radius;
  const minWorldZ = tileSize + radius;
  const maxWorldZ = (CONFIG.MAP_ROWS - 1) * tileSize - radius;

  x = Math.max(minWorldX, Math.min(x, maxWorldX));
  z = Math.max(minWorldZ, Math.min(z, maxWorldZ));

  return { x, z };
}

/**
 * Pure 3D horizontal (x/z plane) movement and collision step.
 * Free of any Three.js imports.
 */
export function stepPlayerMovement(
  state: PlayerMovementState,
  input: MovementInput,
  deltaSeconds: number,
  map: readonly (readonly TileType[])[],
  headBobEnabled = true,
  ropeTied = false,
  canRun = true,
  waterLevel = 0
): PlayerMovementState {
  const clampedDelta = Math.min(Math.max(deltaSeconds, 0), CONFIG.MAX_DELTA_SEC);

  const moveForward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const moveRight = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  const startCol = Math.floor(state.x / CONFIG.TILE_SIZE);
  const startRow = Math.floor(state.z / CONFIG.TILE_SIZE);
  const waterStatus = getTileWaterStatus(startCol, startRow, waterLevel);
  const speedMultiplier =
    waterStatus === 'shallow' || waterStatus === 'deep'
      ? CONFIG.SHALLOW_SPEED_MULTIPLIER
      : 1.0;

  const isMoving = moveForward !== 0 || moveRight !== 0;
  const isRunning = isMoving && input.run && canRun;
  const baseSpeed = !isMoving
    ? 0
    : isRunning
      ? CONFIG.RUN_SPEED
      : CONFIG.WALK_SPEED;
  const targetSpeed = baseSpeed * speedMultiplier;

  let x = state.x;
  let z = state.z;
  let vx = 0;
  let vz = 0;

  if (isMoving && clampedDelta > 0) {
    // Normalize local movement input so diagonal speed equals cardinal speed
    const len = Math.hypot(moveForward, moveRight);
    const localFwd = moveForward / len;
    const localRight = moveRight / len;

    // Camera forward is (-sin(yaw), -cos(yaw)), right is (cos(yaw), -sin(yaw))
    const sinYaw = Math.sin(state.yaw);
    const cosYaw = Math.cos(state.yaw);

    const dirX = -sinYaw * localFwd + cosYaw * localRight;
    const dirZ = -cosYaw * localFwd - sinYaw * localRight;

    vx = dirX * targetSpeed;
    vz = dirZ * targetSpeed;

    const totalDx = vx * clampedDelta;
    const totalDz = vz * clampedDelta;
    const totalDist = Math.hypot(totalDx, totalDz);

    // Sub-step movement so no step exceeds MAX_STEP_DISTANCE (0.08m << 0.45m radius)
    const steps = Math.max(1, Math.ceil(totalDist / CONFIG.MAX_STEP_DISTANCE));
    const stepDx = totalDx / steps;
    const stepDz = totalDz / steps;

    for (let i = 0; i < steps; i++) {
      const resolved = resolveCircleCollision(
        map,
        x + stepDx,
        z + stepDz,
        CONFIG.PLAYER_RADIUS,
        CONFIG.TILE_SIZE,
        ropeTied,
        waterLevel,
        startCol,
        startRow
      );
      x = resolved.x;
      z = resolved.z;
    }
  }

  const actualMovedDist = Math.hypot(x - state.x, z - state.z);
  const actualSpeed = clampedDelta > 0 ? actualMovedDist / clampedDelta : 0;
  const effectivelyMoving = actualSpeed > 0.15;

  // Update head-bob phase and offsets
  let bobPhase = state.bobPhase;
  let targetBobX = 0;
  let targetBobY = 0;

  if (headBobEnabled && effectivelyMoving) {
    const freq = isRunning ? CONFIG.HEAD_BOB_RUN_FREQ : CONFIG.HEAD_BOB_WALK_FREQ;
    const ampY = isRunning ? CONFIG.HEAD_BOB_RUN_AMP_Y : CONFIG.HEAD_BOB_WALK_AMP_Y;
    bobPhase = (bobPhase + clampedDelta * freq) % (Math.PI * 4);
    targetBobY = Math.sin(bobPhase * 2) * ampY;
    targetBobX = Math.cos(bobPhase) * CONFIG.HEAD_BOB_AMP_X;
  } else {
    bobPhase = 0;
  }

  const blend = Math.min(1, clampedDelta * CONFIG.HEAD_BOB_SMOOTHING);
  const bobOffsetX = state.bobOffsetX + (targetBobX - state.bobOffsetX) * blend;
  const bobOffsetY = state.bobOffsetY + (targetBobY - state.bobOffsetY) * blend;

  return {
    x,
    z,
    vx,
    vz,
    speed: actualSpeed,
    yaw: state.yaw,
    pitch: state.pitch,
    bobPhase,
    bobOffsetX,
    bobOffsetY,
    isMoving: effectivelyMoving,
    isRunning: effectivelyMoving && isRunning,
  };
}

/**
 * Pure helper to apply mouse look deltas (in pixels) to yaw and pitch angles.
 */
export function applyMouseLook(
  yaw: number,
  pitch: number,
  deltaX: number,
  deltaY: number,
  sensitivity: number
): { yaw: number; pitch: number } {
  const scale = CONFIG.BASE_LOOK_RAD_PER_PX * sensitivity;
  const nextYaw = yaw - deltaX * scale;
  const rawPitch = pitch - deltaY * scale;
  const nextPitch = Math.max(
    -CONFIG.MAX_PITCH_RAD,
    Math.min(CONFIG.MAX_PITCH_RAD, rawPitch)
  );
  return { yaw: nextYaw, pitch: nextPitch };
}
