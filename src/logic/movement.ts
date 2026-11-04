import { CONFIG } from '../config';
import { isWallTile, TileType } from '../data/caveMap';

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

export interface PlayerMovementState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  facingAngle: number;
  isMoving: boolean;
  isRunning: boolean;
}

const EPSILON = 0.001;

/**
 * Resolves horizontal axis collision against solid tiles in `map`.
 */
function resolveAxisX(
  map: readonly (readonly TileType[])[],
  nextX: number,
  currentY: number,
  dx: number,
  halfSize: number,
  tileSize: number
): number {
  if (dx === 0) return nextX;

  const topRow = Math.floor((currentY - halfSize + EPSILON) / tileSize);
  const bottomRow = Math.floor((currentY + halfSize - EPSILON) / tileSize);

  if (dx > 0) {
    const rightEdge = nextX + halfSize;
    const rightCol = Math.floor(rightEdge / tileSize);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWallTile(map, rightCol, row)) {
        return rightCol * tileSize - halfSize;
      }
    }
  } else {
    const leftEdge = nextX - halfSize;
    const leftCol = Math.floor(leftEdge / tileSize);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWallTile(map, leftCol, row)) {
        return (leftCol + 1) * tileSize + halfSize;
      }
    }
  }

  return nextX;
}

/**
 * Resolves vertical axis collision against solid tiles in `map`.
 */
function resolveAxisY(
  map: readonly (readonly TileType[])[],
  currentX: number,
  nextY: number,
  dy: number,
  halfSize: number,
  tileSize: number
): number {
  if (dy === 0) return nextY;

  const leftCol = Math.floor((currentX - halfSize + EPSILON) / tileSize);
  const rightCol = Math.floor((currentX + halfSize - EPSILON) / tileSize);

  if (dy > 0) {
    const bottomEdge = nextY + halfSize;
    const bottomRow = Math.floor(bottomEdge / tileSize);
    for (let col = leftCol; col <= rightCol; col++) {
      if (isWallTile(map, col, bottomRow)) {
        return bottomRow * tileSize - halfSize;
      }
    }
  } else {
    const topEdge = nextY - halfSize;
    const topRow = Math.floor(topEdge / tileSize);
    for (let col = leftCol; col <= rightCol; col++) {
      if (isWallTile(map, col, topRow)) {
        return (topRow + 1) * tileSize + halfSize;
      }
    }
  }

  return nextY;
}

/**
 * Pure movement and collision update step.
 * - Normalizes diagonal input vector so diagonal speed equals cardinal speed.
 * - Sub-steps movement by `CONFIG.MAX_STEP_DISTANCE` so the player can never tunnel
 *   through walls even during frame drops or high speeds.
 * - Resolves X and Y axes independently on each sub-step to ensure smooth diagonal
 *   sliding along walls.
 */
export function stepPlayerMovement(
  state: PlayerMovementState,
  input: MovementInput,
  deltaSeconds: number,
  map: readonly (readonly TileType[])[]
): PlayerMovementState {
  const clampedDelta = Math.min(Math.max(deltaSeconds, 0), CONFIG.MAX_DELTA_SEC);

  const rawDirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const rawDirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  const isMoving = rawDirX !== 0 || rawDirY !== 0;
  const isRunning = isMoving && input.run;
  const targetSpeed = !isMoving
    ? 0
    : isRunning
      ? CONFIG.RUN_SPEED
      : CONFIG.WALK_SPEED;

  if (!isMoving || clampedDelta === 0) {
    return {
      ...state,
      vx: 0,
      vy: 0,
      speed: 0,
      isMoving: false,
      isRunning: false,
    };
  }

  const length = Math.hypot(rawDirX, rawDirY);
  const normX = rawDirX / length;
  const normY = rawDirY / length;

  const vx = normX * targetSpeed;
  const vy = normY * targetSpeed;

  const totalDx = vx * clampedDelta;
  const totalDy = vy * clampedDelta;
  const totalDistance = Math.hypot(totalDx, totalDy);

  // Sub-step movement so no step ever exceeds MAX_STEP_DISTANCE (4px)
  const steps = Math.max(1, Math.ceil(totalDistance / CONFIG.MAX_STEP_DISTANCE));
  const stepDx = totalDx / steps;
  const stepDy = totalDy / steps;

  let x = state.x;
  let y = state.y;

  for (let i = 0; i < steps; i++) {
    x = resolveAxisX(
      map,
      x + stepDx,
      y,
      stepDx,
      CONFIG.PLAYER_HALF_SIZE,
      CONFIG.TILE_SIZE
    );
    y = resolveAxisY(
      map,
      x,
      y + stepDy,
      stepDy,
      CONFIG.PLAYER_HALF_SIZE,
      CONFIG.TILE_SIZE
    );
  }

  const actualDx = x - state.x;
  const actualDy = y - state.y;
  const actualSpeed = clampedDelta > 0 ? Math.hypot(actualDx, actualDy) / clampedDelta : 0;

  return {
    x,
    y,
    vx,
    vy,
    speed: actualSpeed,
    facingAngle: Math.atan2(normY, normX),
    isMoving: true,
    isRunning,
  };
}
