import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { FLOODABLE_TILES, getWaterSurfaceY } from '../data/levelData';

export interface WaterMeshBundle {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  update: (waterLevel: number, elapsedSec: number) => void;
  dispose: () => void;
}

/**
 * Builds the translucent low-poly water surface plane (`#1d3b44`) covering all
 * floodable basin and corridor tiles.
 * - Rises and falls smoothly with `waterLevel` (`getWaterSurfaceY(waterLevel)`).
 * - Displaces vertices with slow ripples (`WATER_RIPPLE_AMP`, `WATER_RIPPLE_SPEED`)
 *   and recomputes flat-shaded normals so light from the player's flame reflects
 *   faintly across the moving water facets.
 */
export function buildWaterSurfaceMesh(): WaterMeshBundle {
  const ts = CONFIG.TILE_SIZE;
  const parts: THREE.BufferGeometry[] = [];
  const addedKeys = new Set<string>();

  const addWaterTile = (col: number, row: number) => {
    const key = `${col},${row}`;
    if (addedKeys.has(key)) return;
    addedKeys.add(key);

    // Slight overlap (+0.08m) so water edges tuck cleanly into step risers and walls
    const plane = new THREE.PlaneGeometry(ts + 0.08, ts + 0.08, 2, 2);
    plane.rotateX(-Math.PI / 2);
    plane.translate((col + 0.5) * ts, 0, (row + 0.5) * ts);

    const nonIndexed = plane.index ? plane.toNonIndexed() : plane;
    if (nonIndexed !== plane) {
      plane.dispose();
    }
    nonIndexed.deleteAttribute('uv');
    parts.push(nonIndexed);
  };

  for (const tile of FLOODABLE_TILES) {
    addWaterTile(tile.col, tile.row);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }

  if (!merged) {
    throw new Error('Failed to build water surface geometry');
  }

  const posAttr = merged.getAttribute('position') as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const baseX = new Float32Array(vertexCount);
  const baseZ = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i++) {
    baseX[i] = posAttr.getX(i);
    baseZ[i] = posAttr.getZ(i);
  }

  merged.computeVertexNormals();
  merged.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.WATER_COLOR,
    emissive: CONFIG.WATER_EMISSIVE_COLOR,
    emissiveIntensity: 0.32,
    roughness: 0.22,
    metalness: 0.24,
    flatShading: true,
    transparent: true,
    opacity: CONFIG.WATER_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(merged, material);
  mesh.position.y = getWaterSurfaceY(0.05);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  let normalFrameCounter = 0;

  function update(waterLevel: number, elapsedSec: number): void {
    mesh.position.y = getWaterSurfaceY(waterLevel);

    const t = elapsedSec * CONFIG.WATER_RIPPLE_SPEED;
    const amp = CONFIG.WATER_RIPPLE_AMP * (0.65 + 0.35 * waterLevel);

    for (let i = 0; i < vertexCount; i++) {
      const vx = baseX[i];
      const vz = baseZ[i];
      const wave1 = Math.sin(vx * 1.35 + t) * Math.cos(vz * 1.15 - t * 0.78);
      const wave2 = Math.sin((vx + vz) * 0.85 - t * 1.12) * 0.5;
      posAttr.setY(i, (wave1 + wave2) * amp);
    }

    posAttr.needsUpdate = true;
    normalFrameCounter = (normalFrameCounter + 1) % 3;
    if (normalFrameCounter === 0) {
      merged.computeVertexNormals();
    }
  }

  function dispose(): void {
    merged.dispose();
    material.dispose();
  }

  return {
    mesh,
    geometry: merged,
    material,
    update,
    dispose,
  };
}
