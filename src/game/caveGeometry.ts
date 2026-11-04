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
import {
  getTileFloorElevation,
  isGapTile,
  isSafeRoomTile,
  LEVEL_GAP,
} from '../data/levelData';
import { TileFaceDescriptor } from '../logic/lightAndMemory';

/**
 * Deterministic hash in [-1, 1] from quantized spatial coordinates so shared edges
 * between adjacent tiles receive identical displacement and seamless vertex colors.
 */
function spatialHash(x: number, y: number, z: number): number {
  const qx = Math.round(x * 100) * 0.01;
  const qy = Math.round(y * 100) * 0.01;
  const qz = Math.round(z * 100) * 0.01;
  const h = Math.sin(qx * 127.1 + qy * 311.7 + qz * 74.7) * 43758.5453123;
  const frac = h - Math.floor(h);
  return frac * 2 - 1;
}

/**
 * Applies vertex color variation and initializes the `aRemembered` attribute (0.0)
 * on a geometry part.
 */
function applyVertexAttributes(
  geometry: THREE.BufferGeometry,
  baseHex: number,
  variation: number,
  tipHex?: number,
  maxHeight = 2.0
): void {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const remembered = new Float32Array(count);
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
    remembered[i] = 0.0;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aRemembered', new THREE.BufferAttribute(remembered, 1));
}

/**
 * Normalizes a geometry part to non-indexed format with identical attributes
 * (`position`, `normal`, `color`, `aRemembered`) so `mergeGeometries` succeeds.
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
  applyVertexAttributes(geometry, baseHex, variation, tipHex, maxHeight);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Perturbs middle-height vertices of a wall face using quantized world coordinates
 * so adjacent wall faces share watertight corner edges.
 */
function perturbWallPlane(plane: THREE.BufferGeometry): void {
  const pos = plane.attributes.position;
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
}

export interface CaveMeshBundle {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  faces: readonly TileFaceDescriptor[];
  markFacesRemembered: (faceIds: readonly number[]) => void;
  resetRememberedFaces: () => void;
}

/**
 * Builds the merged low-poly 3D cave mesh along with per-tile-face descriptors
 * for line-of-sight surface memory and partial buffer range updates.
 */
export function buildCaveMesh(): CaveMeshBundle {
  const ts = CONFIG.TILE_SIZE;
  const parts: THREE.BufferGeometry[] = [];
  const faces: TileFaceDescriptor[] = [];
  let runningVertexOffset = 0;

  function registerFacePart(
    part: THREE.BufferGeometry,
    col: number,
    row: number,
    sampleX: number,
    sampleZ: number,
    normalX: number,
    normalZ: number
  ): void {
    const vertexCount = part.attributes.position.count;
    faces.push({
      faceId: faces.length,
      col,
      row,
      sampleX,
      sampleZ,
      normalX,
      normalZ,
      vertexStart: runningVertexOffset,
      vertexCount,
    });
    runningVertexOffset += vertexCount;
    parts.push(part);
  }

  // Extend wall height below y = -0.60m so sunken floodable basins never expose a gap beneath walls
  const wallBottomY = -0.65;
  const wallTopY = CONFIG.CEILING_HEIGHT + 0.05;
  const wallHeight = wallTopY - wallBottomY;
  const wallCenterY = (wallBottomY + wallTopY) * 0.5;

  for (let row = 0; row < CONFIG.MAP_ROWS; row++) {
    for (let col = 0; col < CONFIG.MAP_COLS; col++) {
      const tile = CAVE_MAP[row][col];
      const worldX = (col + 0.5) * ts;
      const worldZ = (row + 0.5) * ts;

      if (tile === TileType.WALL) {
        // Build individual exposed cardinal wall faces so each side of a wall tile
        // has its own independent TileFaceDescriptor and outward normal.

        // North face (-Z): exposed if (col, row - 1) is walkable
        if (!isWallTile(CAVE_MAP, col, row - 1)) {
          const northPlane = new THREE.PlaneGeometry(ts, wallHeight, 2, 3);
          northPlane.rotateY(Math.PI);
          northPlane.translate(worldX, wallCenterY, row * ts);
          perturbWallPlane(northPlane);
          const finalized = finalizePart(
            northPlane,
            CONFIG.COLORS.WALL_BASE,
            CONFIG.COLORS.WALL_VARIATION
          );
          registerFacePart(
            finalized,
            col,
            row - 1,
            worldX,
            row * ts - 0.14,
            0,
            -1
          );
        }

        // South face (+Z): exposed if (col, row + 1) is walkable
        if (!isWallTile(CAVE_MAP, col, row + 1)) {
          const southPlane = new THREE.PlaneGeometry(ts, wallHeight, 2, 3);
          southPlane.translate(worldX, wallCenterY, (row + 1) * ts);
          perturbWallPlane(southPlane);
          const finalized = finalizePart(
            southPlane,
            CONFIG.COLORS.WALL_BASE,
            CONFIG.COLORS.WALL_VARIATION
          );
          registerFacePart(
            finalized,
            col,
            row + 1,
            worldX,
            (row + 1) * ts + 0.14,
            0,
            1
          );
        }

        // West face (-X): exposed if (col - 1, row) is walkable
        if (!isWallTile(CAVE_MAP, col - 1, row)) {
          const westPlane = new THREE.PlaneGeometry(ts, wallHeight, 2, 3);
          westPlane.rotateY(-Math.PI / 2);
          westPlane.translate(col * ts, wallCenterY, worldZ);
          perturbWallPlane(westPlane);
          const finalized = finalizePart(
            westPlane,
            CONFIG.COLORS.WALL_BASE,
            CONFIG.COLORS.WALL_VARIATION
          );
          registerFacePart(
            finalized,
            col - 1,
            row,
            col * ts - 0.14,
            worldZ,
            -1,
            0
          );
        }

        // East face (+X): exposed if (col + 1, row) is walkable
        if (!isWallTile(CAVE_MAP, col + 1, row)) {
          const eastPlane = new THREE.PlaneGeometry(ts, wallHeight, 2, 3);
          eastPlane.rotateY(Math.PI / 2);
          eastPlane.translate((col + 1) * ts, wallCenterY, worldZ);
          perturbWallPlane(eastPlane);
          const finalized = finalizePart(
            eastPlane,
            CONFIG.COLORS.WALL_BASE,
            CONFIG.COLORS.WALL_VARIATION
          );
          registerFacePart(
            finalized,
            col + 1,
            row,
            (col + 1) * ts + 0.14,
            worldZ,
            1,
            0
          );
        }
      } else {
        // 1. Walkable floor tile OR sunken dangerous gap pit
        if (isGapTile(col, row)) {
          const pitDepth = LEVEL_GAP.depth;
          const pitCenterY = -pitDepth * 0.5;

          // Deep pit floor at y = -pitDepth
          const pitBottom = new THREE.PlaneGeometry(ts, ts, 2, 2);
          pitBottom.rotateX(-Math.PI / 2);
          pitBottom.translate(worldX, -pitDepth, worldZ);
          registerFacePart(
            finalizePart(pitBottom, CONFIG.COLORS.PIT_BOTTOM_BASE, 0.04),
            col,
            row,
            worldX,
            worldZ,
            0,
            0
          );

          // North drop wall of the pit (at z = row * ts, facing +Z into the chasm)
          const pitNorthWall = new THREE.PlaneGeometry(ts, pitDepth, 2, 3);
          pitNorthWall.translate(worldX, pitCenterY, row * ts);
          perturbPropGeometry(pitNorthWall, 0.05);
          registerFacePart(
            finalizePart(
              pitNorthWall,
              CONFIG.COLORS.PIT_WALL_BASE,
              CONFIG.COLORS.WALL_VARIATION,
              CONFIG.COLORS.FLOOR_BASE,
              pitDepth
            ),
            col,
            row,
            worldX,
            row * ts - 0.2,
            0,
            0
          );

          // South drop wall of the pit (at z = (row + 1) * ts, facing -Z into the chasm)
          const pitSouthWall = new THREE.PlaneGeometry(ts, pitDepth, 2, 3);
          pitSouthWall.rotateY(Math.PI);
          pitSouthWall.translate(worldX, pitCenterY, (row + 1) * ts);
          perturbPropGeometry(pitSouthWall, 0.05);
          registerFacePart(
            finalizePart(
              pitSouthWall,
              CONFIG.COLORS.PIT_WALL_BASE,
              CONFIG.COLORS.WALL_VARIATION,
              CONFIG.COLORS.FLOOR_BASE,
              pitDepth
            ),
            col,
            row,
            worldX,
            (row + 1) * ts + 0.2,
            0,
            0
          );

          // West drop wall at the left end of the chasm
          if (!isGapTile(col - 1, row)) {
            const pitWestWall = new THREE.PlaneGeometry(ts, pitDepth, 2, 3);
            pitWestWall.rotateY(Math.PI / 2);
            pitWestWall.translate(col * ts, pitCenterY, worldZ);
            registerFacePart(
              finalizePart(
                pitWestWall,
                CONFIG.COLORS.PIT_WALL_BASE,
                CONFIG.COLORS.WALL_VARIATION
              ),
              col,
              row,
              worldX,
              worldZ,
              0,
              0
            );
          }

          // East drop wall at the right end of the chasm
          if (!isGapTile(col + 1, row)) {
            const pitEastWall = new THREE.PlaneGeometry(ts, pitDepth, 2, 3);
            pitEastWall.rotateY(-Math.PI / 2);
            pitEastWall.translate((col + 1) * ts, pitCenterY, worldZ);
            registerFacePart(
              finalizePart(
                pitEastWall,
                CONFIG.COLORS.PIT_WALL_BASE,
                CONFIG.COLORS.WALL_VARIATION
              ),
              col,
              row,
              worldX,
              worldZ,
              0,
              0
            );
          }

          // Jagged rock rim lip along North & South chasm edges so the drop edge is unmistakable
          const northRim = new THREE.BoxGeometry(ts, 0.14, 0.22, 2, 1, 1);
          northRim.translate(worldX, -0.02, row * ts + 0.06);
          perturbPropGeometry(northRim, 0.03);
          registerFacePart(
            finalizePart(
              northRim,
              CONFIG.COLORS.PROP_ROCK_BASE,
              CONFIG.COLORS.WALL_VARIATION
            ),
            col,
            row - 1,
            worldX,
            row * ts - 0.15,
            0,
            0
          );

          const southRim = new THREE.BoxGeometry(ts, 0.14, 0.22, 2, 1, 1);
          southRim.translate(worldX, -0.02, (row + 1) * ts - 0.06);
          perturbPropGeometry(southRim, 0.03);
          registerFacePart(
            finalizePart(
              southRim,
              CONFIG.COLORS.PROP_ROCK_BASE,
              CONFIG.COLORS.WALL_VARIATION
            ),
            col,
            row + 1,
            worldX,
            (row + 1) * ts + 0.15,
            0,
            0
          );
        } else {
          // Walkable floor tile at its physical elevation (sunken floodable basin, 0m dry floor, or +0.22m Safe Room)
          const floorElev = getTileFloorElevation(col, row);
          const floor = new THREE.PlaneGeometry(ts, ts, 2, 2);
          floor.rotateX(-Math.PI / 2);
          floor.translate(worldX, floorElev, worldZ);

          const fPos = floor.attributes.position;
          for (let i = 0; i < fPos.count; i++) {
            const vx = fPos.getX(i);
            const vz = fPos.getZ(i);
            const ripple = spatialHash(vx, 0, vz) * 0.025;
            fPos.setY(i, floorElev + ripple);
          }

          const floorHex =
            tile === TileType.ENTRANCE
              ? CONFIG.COLORS.FLOOR_ENTRANCE
              : isSafeRoomTile(col, row)
                ? CONFIG.COLORS.PROP_ROCK_BASE
                : CONFIG.COLORS.FLOOR_BASE;
          registerFacePart(
            finalizePart(floor, floorHex, CONFIG.COLORS.FLOOR_VARIATION),
            col,
            row,
            worldX,
            worldZ,
            0,
            0
          );

          // Add vertical stone step-riser skirts wherever this tile is higher than a cardinal neighbor
          const neighborDirs = [
            {
              dc: 0,
              dr: -1,
              edgeX: worldX,
              edgeZ: row * ts,
              rotY: Math.PI,
            },
            {
              dc: 0,
              dr: 1,
              edgeX: worldX,
              edgeZ: (row + 1) * ts,
              rotY: 0,
            },
            {
              dc: -1,
              dr: 0,
              edgeX: col * ts,
              edgeZ: worldZ,
              rotY: -Math.PI / 2,
            },
            {
              dc: 1,
              dr: 0,
              edgeX: (col + 1) * ts,
              edgeZ: worldZ,
              rotY: Math.PI / 2,
            },
          ];

          for (const nd of neighborDirs) {
            const nc = col + nd.dc;
            const nr = row + nd.dr;
            if (isWallTile(CAVE_MAP, nc, nr) || isGapTile(nc, nr)) continue;
            const neighborElev = getTileFloorElevation(nc, nr);
            if (floorElev - neighborElev > 0.015) {
              const stepHeight = floorElev - neighborElev + 0.06;
              const stepCenterY = (floorElev + neighborElev) * 0.5;
              const riser = new THREE.PlaneGeometry(ts, stepHeight, 2, 1);
              if (nd.rotY !== 0) {
                riser.rotateY(nd.rotY);
              }
              riser.translate(nd.edgeX, stepCenterY, nd.edgeZ);
              registerFacePart(
                finalizePart(
                  riser,
                  CONFIG.COLORS.WALL_BASE,
                  CONFIG.COLORS.WALL_VARIATION
                ),
                col,
                row,
                nd.edgeX,
                nd.edgeZ,
                0,
                0
              );
            }
          }
        }

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

        registerFacePart(
          finalizePart(
            ceiling,
            CONFIG.COLORS.CEILING_BASE,
            CONFIG.COLORS.CEILING_VARIATION
          ),
          col,
          row,
          worldX,
          worldZ,
          0,
          0
        );

        // 3. Narrow corridor ceiling drop lintel
        if (ceilHeight < CONFIG.CEILING_HEIGHT) {
          const dropHeight = CONFIG.CEILING_HEIGHT - ceilHeight + 0.12;
          const lintel = new THREE.BoxGeometry(ts, dropHeight, ts, 1, 1, 1);
          lintel.translate(
            worldX,
            ceilHeight + dropHeight * 0.5 - 0.04,
            worldZ
          );
          registerFacePart(
            finalizePart(
              lintel,
              CONFIG.COLORS.WALL_BASE,
              CONFIG.COLORS.WALL_VARIATION
            ),
            col,
            row,
            worldX,
            worldZ,
            0,
            0
          );
        }
      }
    }
  }

  // 4. Composite low-poly procedural rocks, stalagmites, and stalactites in the chambers
  for (let idx = 0; idx < CHAMBER_PROPS.length; idx++) {
    const prop = CHAMBER_PROPS[idx];
    const seed = idx * 17.3 + prop.x * 3.1 + prop.z * 5.7;
    const propCol = Math.floor(prop.x / ts);
    const propRow = Math.floor(prop.z / ts);
    const propFloorY = getTileFloorElevation(propCol, propRow);

    if (prop.kind === 'stalagmite') {
      const mainSpire = new THREE.ConeGeometry(
        prop.radius,
        prop.height,
        6,
        3
      );
      mainSpire.translate(prop.x, propFloorY + prop.height * 0.5, prop.z);
      perturbPropGeometry(mainSpire, 0.04);

      const sideRadius = prop.radius * 0.58;
      const sideHeight = prop.height * 0.52;
      const offsetAngle = seed % 6.28;
      const sx = prop.x + Math.cos(offsetAngle) * (prop.radius * 0.45);
      const sz = prop.z + Math.sin(offsetAngle) * (prop.radius * 0.45);
      const sideSpire = new THREE.ConeGeometry(sideRadius, sideHeight, 5, 2);
      sideSpire.translate(sx, propFloorY + sideHeight * 0.5, sz);
      perturbPropGeometry(sideSpire, 0.03);

      const baseCollar = new THREE.DodecahedronGeometry(prop.radius * 0.72, 0);
      baseCollar.scale(1.15, 0.45, 1.15);
      baseCollar.translate(prop.x, propFloorY + prop.radius * 0.22, prop.z);

      const propGroup = mergeGeometries(
        [
          finalizePart(
            mainSpire,
            CONFIG.COLORS.PROP_ROCK_BASE,
            0.06,
            CONFIG.COLORS.PROP_ROCK_TIP,
            prop.height
          ),
          finalizePart(
            sideSpire,
            CONFIG.COLORS.PROP_ROCK_BASE,
            0.06,
            CONFIG.COLORS.PROP_ROCK_TIP,
            sideHeight
          ),
          finalizePart(baseCollar, CONFIG.COLORS.PROP_ROCK_BASE, 0.05),
        ],
        false
      );
      if (propGroup) {
        registerFacePart(
          propGroup,
          propCol,
          propRow,
          prop.x,
          prop.z,
          0,
          0
        );
      }
    } else if (prop.kind === 'boulder') {
      const mainRock = new THREE.DodecahedronGeometry(prop.radius, 0);
      mainRock.scale(1.1, prop.height / prop.radius, 0.95);
      mainRock.rotateY(seed);
      mainRock.translate(prop.x, propFloorY + prop.height * 0.42, prop.z);

      const subRock = new THREE.DodecahedronGeometry(prop.radius * 0.6, 0);
      subRock.scale(1.0, 0.65, 1.1);
      subRock.translate(
        prop.x + prop.radius * 0.45,
        propFloorY + prop.height * 0.25,
        prop.z - prop.radius * 0.3
      );

      const boulderGroup = mergeGeometries(
        [
          finalizePart(
            mainRock,
            CONFIG.COLORS.PROP_ROCK_BASE,
            0.06,
            CONFIG.COLORS.PROP_ROCK_TIP,
            prop.height
          ),
          finalizePart(subRock, CONFIG.COLORS.PROP_ROCK_BASE, 0.06),
        ],
        false
      );
      if (boulderGroup) {
        registerFacePart(
          boulderGroup,
          propCol,
          propRow,
          prop.x,
          prop.z,
          0,
          0
        );
      }
    } else if (prop.kind === 'stalactite') {
      const cone = new THREE.ConeGeometry(prop.radius, prop.height, 6, 2);
      cone.rotateX(Math.PI);
      cone.translate(
        prop.x,
        CONFIG.CEILING_HEIGHT - prop.height * 0.5 + 0.05,
        prop.z
      );
      perturbPropGeometry(cone, 0.035);
      registerFacePart(
        finalizePart(
          cone,
          CONFIG.COLORS.CEILING_BASE,
          0.06,
          CONFIG.COLORS.PROP_ROCK_TIP,
          CONFIG.CEILING_HEIGHT
        ),
        propCol,
        propRow,
        prop.x,
        prop.z,
        0,
        0
      );
    }
  }

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

  // Extend MeshStandardMaterial so remembered tile faces remain faintly visible
  // even beyond the dark fog cutoff distance.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      attribute float aRemembered;
      varying float vRemembered;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      vRemembered = aRemembered;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying float vRemembered;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#include <fog_fragment>
      vec3 rememberedFloor = vColor.rgb * vec3(0.75, 0.92, 1.20) * ${CONFIG.REMEMBERED_POST_FOG_FLOOR.toFixed(3)};
      gl_FragColor.rgb = max(gl_FragColor.rgb, rememberedFloor * vRemembered);`
    );
  };

  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;

  const colorAttr = merged.getAttribute('color') as THREE.BufferAttribute;
  const rememberedAttr = merged.getAttribute(
    'aRemembered'
  ) as THREE.BufferAttribute;
  const colorArray = colorAttr.array as Float32Array;
  const initialColorArray = new Float32Array(colorArray);
  const rememberedArray = rememberedAttr.array as Float32Array;
  const tintColor = new THREE.Color(CONFIG.COLORS.REMEMBERED_TINT);
  const boost = CONFIG.REMEMBERED_COLOR_BOOST;

  /**
   * Updates ONLY the vertex slices corresponding to newly remembered tile faces,
   * registering exact sub-buffer update ranges on the GPU attributes.
   */
  function markFacesRemembered(faceIds: readonly number[]): void {
    if (faceIds.length === 0) return;

    for (let i = 0; i < faceIds.length; i++) {
      const face = faces[faceIds[i]];
      if (!face) continue;

      const start = face.vertexStart;
      const count = face.vertexCount;
      const end = start + count;

      for (let v = start; v < end; v++) {
        rememberedArray[v] = 1.0;
        const cIdx = v * 3;
        colorArray[cIdx] =
          colorArray[cIdx] * (1 - boost) + tintColor.r * boost;
        colorArray[cIdx + 1] =
          colorArray[cIdx + 1] * (1 - boost) + tintColor.g * boost;
        colorArray[cIdx + 2] =
          colorArray[cIdx + 2] * (1 - boost) + tintColor.b * boost;
      }

      rememberedAttr.addUpdateRange(start, count);
      colorAttr.addUpdateRange(start * 3, count * 3);
    }

    rememberedAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  function resetRememberedFaces(): void {
    rememberedArray.fill(0);
    colorArray.set(initialColorArray);
    rememberedAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  return {
    mesh,
    geometry: merged,
    material,
    faces,
    markFacesRemembered,
    resetRememberedFaces,
  };
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
