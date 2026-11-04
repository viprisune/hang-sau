import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import {
  CAVE_MAP,
  CHAMBER_PROPS,
  getCeilingHeightAt,
  isWallTile,
  TileType,
} from '../data/caveMap';

/**
 * Deterministic hash in [-1, 1] from spatial coordinates so vertex jitter and
 * vertex colors are repeatable and seamless across shared world coordinates.
 */
function spatialHash(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  const frac = h - Math.floor(h);
  return frac * 2 - 1;
}

/**
 * Applies vertex color variation to a geometry around `baseHex` with optional vertical gradient.
 */
function applyVertexColorVariation(
  geometry: THREE.BufferGeometry,
  baseHex: number,
  variation: number,
  tipHex?: number,
  maxHeight = 2.0
): void {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(baseHex);
  const tipColor = tipHex !== undefined ? new THREE.Color(tipHex) : null;
  const working = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    working.copy(baseColor);
    if (tipColor && maxHeight > 0) {
      const t = Math.max(0, Math.min(1, Math.abs(vy) / maxHeight));
      working.lerp(tipColor, t * 0.65);
    }

    const delta = spatialHash(vx, vy, vz) * variation;
    const r = Math.max(0, Math.min(1, working.r + delta));
    const g = Math.max(0, Math.min(1, working.g + delta));
    const b = Math.max(0, Math.min(1, working.b + delta * 1.15));

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Normalizes a geometry part to non-indexed format with identical attributes
 * (`position`, `normal`, `color`) so `mergeGeometries` succeeds across mixed
 * primitives (e.g., indexed Box/Plane/Cone and non-indexed Dodecahedron).
 */
function finalizePart(
  rawGeometry: THREE.BufferGeometry,
  baseHex: number,
  variation: number,
  tipHex?: number,
  maxHeight = 2.0
): THREE.BufferGeometry {
  const geometry = rawGeometry.index
    ? rawGeometry.toNonIndexed()
    : rawGeometry;
  if (geometry !== rawGeometry) {
    rawGeometry.dispose();
  }

  geometry.deleteAttribute('uv');
  applyVertexColorVariation(geometry, baseHex, variation, tipHex, maxHeight);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Checks whether a wall tile at (col, row) borders at least one walkable tile
 * in its 3x3 neighborhood so we skip generating hidden interior rock blocks.
 */
function isVisibleWallTile(
  map: readonly (readonly TileType[])[],
  col: number,
  row: number
): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (!isWallTile(map, col + dc, row + dr)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Builds the merged low-poly 3D cave mesh (floors, variable-height ceilings,
 * chiseled wall boxes, ceiling lintels, and procedural chamber rocks/stalagmites).
 */
export function buildCaveMesh(): {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
} {
  const ts = CONFIG.TILE_SIZE;
  const parts: THREE.BufferGeometry[] = [];

  for (let row = 0; row < CONFIG.MAP_ROWS; row++) {
    for (let col = 0; col < CONFIG.MAP_COLS; col++) {
      const tile = CAVE_MAP[row][col];
      const worldX = (col + 0.5) * ts;
      const worldZ = (row + 0.5) * ts;

      if (tile === TileType.WALL) {
        if (!isVisibleWallTile(CAVE_MAP, col, row)) continue;

        // Low-poly subdivided rock wall box (2m x 2.85m x 2m)
        const wallHeight = CONFIG.CEILING_HEIGHT + 0.06;
        const box = new THREE.BoxGeometry(ts, wallHeight, ts, 2, 3, 2);
        box.translate(worldX, wallHeight * 0.5 - 0.03, worldZ);

        // Perturb middle-band vertices slightly for a chiseled low-poly rock surface
        const pos = box.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          const vz = pos.getZ(i);
          if (vy > 0.25 && vy < CONFIG.CEILING_HEIGHT - 0.25) {
            const jx = spatialHash(vx, vy, vz) * 0.045;
            const jz = spatialHash(vz, vx, vy) * 0.045;
            pos.setXYZ(i, vx + jx, vy, vz + jz);
          }
        }

        parts.push(
          finalizePart(
            box,
            CONFIG.COLORS.WALL_BASE,
            CONFIG.COLORS.WALL_VARIATION
          )
        );
      } else {
        // 1. Walkable floor tile (2x2 subdivided plane facing +Y)
        const floor = new THREE.PlaneGeometry(ts, ts, 2, 2);
        floor.rotateX(-Math.PI / 2);
        floor.translate(worldX, 0, worldZ);

        const fPos = floor.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
          const vx = fPos.getX(i);
          const vz = fPos.getZ(i);
          const ripple = spatialHash(vx, 0, vz) * 0.03;
          fPos.setY(i, ripple);
        }

        const floorHex =
          tile === TileType.ENTRANCE
            ? CONFIG.COLORS.FLOOR_ENTRANCE
            : CONFIG.COLORS.FLOOR_BASE;
        parts.push(
          finalizePart(floor, floorHex, CONFIG.COLORS.FLOOR_VARIATION)
        );

        // 2. Ceiling tile (2.8m in chambers/passages, 2.0m in narrow corridor)
        const ceilHeight = getCeilingHeightAt(col, row);
        const ceiling = new THREE.PlaneGeometry(ts, ts, 2, 2);
        ceiling.rotateX(Math.PI / 2);
        ceiling.translate(worldX, ceilHeight, worldZ);

        const cPos = ceiling.attributes.position;
        for (let i = 0; i < cPos.count; i++) {
          const vx = cPos.getX(i);
          const vz = cPos.getZ(i);
          const undulate = spatialHash(vx, ceilHeight, vz) * 0.06;
          cPos.setY(i, ceilHeight + undulate);
        }

        parts.push(
          finalizePart(
            ceiling,
            CONFIG.COLORS.CEILING_BASE,
            CONFIG.COLORS.CEILING_VARIATION
          )
        );

        // 3. If this tile is a narrow corridor tile (2.0m ceiling) adjacent to a 2.8m tile,
        // add a rock lintel drop box so the ceiling transition is solid rock.
        if (ceilHeight < CONFIG.CEILING_HEIGHT) {
          const dropHeight = CONFIG.CEILING_HEIGHT - ceilHeight + 0.12;
          const lintel = new THREE.BoxGeometry(ts, dropHeight, ts, 1, 1, 1);
          lintel.translate(
            worldX,
            ceilHeight + dropHeight * 0.5 - 0.04,
            worldZ
          );
          parts.push(
            finalizePart(
              lintel,
              CONFIG.COLORS.WALL_BASE,
              CONFIG.COLORS.WALL_VARIATION
            )
          );
        }
      }
    }
  }

  // 4. Add composite low-poly procedural rocks, stalagmites, and stalactites in the chambers
  for (let idx = 0; idx < CHAMBER_PROPS.length; idx++) {
    const prop = CHAMBER_PROPS[idx];
    const seed = idx * 17.3 + prop.x * 3.1 + prop.z * 5.7;

    if (prop.kind === 'stalagmite') {
      // Composite 3-part stalagmite: main tapered spire + secondary side spire + basal rock collar
      const mainSpire = new THREE.ConeGeometry(
        prop.radius,
        prop.height,
        6,
        3
      );
      mainSpire.translate(prop.x, prop.height * 0.5, prop.z);
      perturbPropGeometry(mainSpire, 0.04);
      parts.push(
        finalizePart(
          mainSpire,
          CONFIG.COLORS.PROP_ROCK_BASE,
          0.06,
          CONFIG.COLORS.PROP_ROCK_TIP,
          prop.height
        )
      );

      const sideRadius = prop.radius * 0.58;
      const sideHeight = prop.height * 0.52;
      const offsetAngle = seed % 6.28;
      const sx = prop.x + Math.cos(offsetAngle) * (prop.radius * 0.45);
      const sz = prop.z + Math.sin(offsetAngle) * (prop.radius * 0.45);
      const sideSpire = new THREE.ConeGeometry(sideRadius, sideHeight, 5, 2);
      sideSpire.translate(sx, sideHeight * 0.5, sz);
      perturbPropGeometry(sideSpire, 0.03);
      parts.push(
        finalizePart(
          sideSpire,
          CONFIG.COLORS.PROP_ROCK_BASE,
          0.06,
          CONFIG.COLORS.PROP_ROCK_TIP,
          sideHeight
        )
      );

      const baseCollar = new THREE.DodecahedronGeometry(prop.radius * 0.72, 0);
      baseCollar.scale(1.15, 0.45, 1.15);
      baseCollar.translate(prop.x, prop.radius * 0.22, prop.z);
      parts.push(
        finalizePart(baseCollar, CONFIG.COLORS.PROP_ROCK_BASE, 0.05)
      );
    } else if (prop.kind === 'boulder') {
      // Composite 2-part jagged cave boulder cluster on floor
      const mainRock = new THREE.DodecahedronGeometry(prop.radius, 0);
      mainRock.scale(1.1, prop.height / prop.radius, 0.95);
      mainRock.rotateY(seed);
      mainRock.translate(prop.x, prop.height * 0.42, prop.z);
      parts.push(
        finalizePart(
          mainRock,
          CONFIG.COLORS.PROP_ROCK_BASE,
          0.06,
          CONFIG.COLORS.PROP_ROCK_TIP,
          prop.height
        )
      );

      const subRock = new THREE.DodecahedronGeometry(prop.radius * 0.6, 0);
      subRock.scale(1.0, 0.65, 1.1);
      subRock.translate(
        prop.x + prop.radius * 0.45,
        prop.height * 0.25,
        prop.z - prop.radius * 0.3
      );
      parts.push(finalizePart(subRock, CONFIG.COLORS.PROP_ROCK_BASE, 0.06));
    } else if (prop.kind === 'stalactite') {
      // Hanging ceiling stalactite cone
      const cone = new THREE.ConeGeometry(prop.radius, prop.height, 6, 2);
      cone.rotateX(Math.PI);
      cone.translate(
        prop.x,
        CONFIG.CEILING_HEIGHT - prop.height * 0.5 + 0.05,
        prop.z
      );
      perturbPropGeometry(cone, 0.035);
      parts.push(
        finalizePart(
          cone,
          CONFIG.COLORS.CEILING_BASE,
          0.06,
          CONFIG.COLORS.PROP_ROCK_TIP,
          CONFIG.CEILING_HEIGHT
        )
      );
    }
  }

  // Merge all non-indexed geometries into a single static BufferGeometry for minimal draw calls
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }

  if (!merged) {
    throw new Error('Failed to merge cave geometries');
  }

  merged.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;

  return { mesh, geometry: merged, material };
}

function perturbPropGeometry(
  geometry: THREE.BufferGeometry,
  amount: number
): void {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (vy > 0.08) {
      pos.setXYZ(
        i,
        vx + spatialHash(vx, vy, vz) * amount,
        vy,
        vz + spatialHash(vz, vx, vy) * amount
      );
    }
  }
}
