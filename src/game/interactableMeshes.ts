import * as THREE from 'three';
import { CONFIG } from '../config';
import {
  getTileFloorElevation,
  LEVEL_GAP,
  LEVEL_INTERACTABLES,
  LevelInteractableDef,
} from '../data/levelData';
import { LevelProgressState } from '../logic/levelState';

export interface InteractableSceneBundle {
  rootGroup: THREE.Group;
  hitMeshes: THREE.Object3D[];
  syncWithLevelState: (level: LevelProgressState, elapsedSec: number) => void;
  dispose: () => void;
}

/**
 * Builds low-poly flat-shaded meshes for all level interactables:
 * - Pickups: matches, rope, food, water_bottle (placed on waist-low stone plinths for readability)
 * - Gap & Rope Anchor: carved anchor post with iron ring + visible taut rope line & narrow walkway when tied
 * - Hidden Artifact: ancient geometric relic on a stone altar in the side chamber beyond the gap
 * - Cave Exit: climbing rope & pale shaft marker at the cave entrance
 * - High-Ground Safe Room Cairn: dry stone refuge marker at (col 20.5, row 10.0)
 */
export function buildInteractableScene(): InteractableSceneBundle {
  const rootGroup = new THREE.Group();
  const hitMeshes: THREE.Object3D[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
    geometriesToDispose.push(geo);
    return geo;
  };

  const trackMat = <T extends THREE.Material>(mat: T): T => {
    materialsToDispose.push(mat);
    return mat;
  };

  // Shared low-poly materials
  const matPlinth = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.PROP_ROCK_BASE,
      flatShading: true,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  const matMatchBody = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_MATCHBOX_BODY,
      flatShading: true,
      roughness: 0.78,
      metalness: 0.05,
      emissive: CONFIG.COLORS.ITEM_MATCHBOX_BODY,
      emissiveIntensity: 0.08,
    })
  );
  const matMatchTop = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_MATCHBOX_TOP,
      flatShading: true,
      roughness: 0.72,
      metalness: 0.05,
      emissive: CONFIG.COLORS.ITEM_MATCHBOX_TOP,
      emissiveIntensity: 0.08,
    })
  );
  const matCandleWax = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_CANDLE_WAX,
      flatShading: true,
      roughness: 0.68,
      metalness: 0.04,
      emissive: CONFIG.COLORS.ITEM_CANDLE_WAX,
      emissiveIntensity: 0.09,
    })
  );
  const matCandleHolder = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_CANDLE_HOLDER,
      flatShading: true,
      roughness: 0.72,
      metalness: 0.35,
    })
  );
  const matRopeCoil = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ROPE_COIL,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.04,
      emissive: CONFIG.COLORS.ITEM_ROPE_COIL,
      emissiveIntensity: 0.07,
    })
  );
  const matRopeWrap = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ROPE_WRAP,
      flatShading: true,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const matFoodBody = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_FOOD_BODY,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.08,
      emissive: CONFIG.COLORS.ITEM_FOOD_BODY,
      emissiveIntensity: 0.07,
    })
  );
  const matFoodBand = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_FOOD_BAND,
      flatShading: true,
      roughness: 0.75,
      metalness: 0.1,
    })
  );
  const matWaterBody = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_WATER_BODY,
      flatShading: true,
      roughness: 0.55,
      metalness: 0.2,
      emissive: CONFIG.COLORS.ITEM_WATER_BODY,
      emissiveIntensity: 0.08,
    })
  );
  const matWaterCap = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_WATER_CAP,
      flatShading: true,
      roughness: 0.7,
      metalness: 0.25,
    })
  );
  const matAnchorStone = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ANCHOR_STONE,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  const matAnchorIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ANCHOR_IRON,
      flatShading: true,
      roughness: 0.65,
      metalness: 0.45,
      emissive: CONFIG.COLORS.ITEM_ANCHOR_IRON,
      emissiveIntensity: 0.06,
    })
  );
  const matArtifactPedestal = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ARTIFACT_PEDESTAL,
      flatShading: true,
      roughness: 0.88,
      metalness: 0.1,
    })
  );
  const matArtifactGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ARTIFACT_GOLD,
      flatShading: true,
      roughness: 0.42,
      metalness: 0.55,
      emissive: CONFIG.COLORS.ITEM_ARTIFACT_GOLD,
      emissiveIntensity: 0.16,
    })
  );
  const matArtifactCore = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_ARTIFACT_CORE,
      flatShading: true,
      roughness: 0.35,
      metalness: 0.25,
      emissive: CONFIG.COLORS.ITEM_ARTIFACT_CORE,
      emissiveIntensity: 0.22,
    })
  );
  const matExitRope = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_EXIT_ROPE,
      flatShading: true,
      roughness: 0.84,
      metalness: 0.05,
      emissive: CONFIG.COLORS.ITEM_EXIT_ROPE,
      emissiveIntensity: 0.08,
    })
  );
  const matExitShaft = trackMat(
    new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ITEM_EXIT_SHAFT,
      flatShading: true,
      transparent: true,
      opacity: 0.16,
      roughness: 1.0,
      metalness: 0.0,
      emissive: CONFIG.COLORS.ITEM_EXIT_SHAFT,
      emissiveIntensity: 0.35,
      depthWrite: false,
    })
  );
  const matHitInvisible = trackMat(
    new THREE.MeshBasicMaterial({
      visible: false,
    })
  );

  // Shared reusable geometries
  const geoPlinth = trackGeo(new THREE.CylinderGeometry(0.32, 0.42, 0.58, 6, 1));
  const geoPickupHit = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.85, 8));
  const geoMatchBox = trackGeo(new THREE.BoxGeometry(0.24, 0.09, 0.16));
  const geoMatchTop = trackGeo(new THREE.BoxGeometry(0.2, 0.02, 0.12));
  const geoCandleDish = trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.03, 7));
  const geoCandleWax = trackGeo(new THREE.CylinderGeometry(0.055, 0.062, 0.22, 7));
  const geoCandleWick = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5));
  const geoRopeTorus = trackGeo(new THREE.TorusGeometry(0.18, 0.048, 6, 10));
  const geoRopeBand = trackGeo(new THREE.BoxGeometry(0.08, 0.14, 0.12));
  const geoFoodBox = trackGeo(new THREE.BoxGeometry(0.26, 0.14, 0.18));
  const geoFoodStrap = trackGeo(new THREE.BoxGeometry(0.06, 0.15, 0.19));
  const geoWaterBody = trackGeo(new THREE.CylinderGeometry(0.11, 0.12, 0.28, 7));
  const geoWaterNeck = trackGeo(new THREE.CylinderGeometry(0.045, 0.06, 0.07, 6));
  const geoWaterCap = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6));
  const geoArtifactCore = trackGeo(new THREE.OctahedronGeometry(0.15, 0));
  const geoArtifactRing = trackGeo(new THREE.TorusGeometry(0.22, 0.032, 6, 8));
  const geoArtifactStand = trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 0.1, 6));

  const itemVisualMap = new Map<string, THREE.Object3D>();
  const hitMeshMap = new Map<string, THREE.Object3D>();
  const droppedEntryMap = new Map<
    string,
    { visual: THREE.Group; hit: THREE.Mesh }
  >();
  let artifactRelicMesh: THREE.Object3D | null = null;

  function buildPickupItemVisual(kind: LevelInteractableDef['kind']): THREE.Group {
    const itemGroup = new THREE.Group();
    if (kind === 'matches') {
      const body = new THREE.Mesh(geoMatchBox, matMatchBody);
      body.position.y = 0.045;
      const label = new THREE.Mesh(geoMatchTop, matMatchTop);
      label.position.y = 0.092;
      itemGroup.add(body, label);
    } else if (kind === 'candle') {
      const dish = new THREE.Mesh(geoCandleDish, matCandleHolder);
      dish.position.y = 0.015;
      const wax = new THREE.Mesh(geoCandleWax, matCandleWax);
      wax.position.y = 0.13;
      const wick = new THREE.Mesh(geoCandleWick, matWaterCap);
      wick.position.y = 0.255;
      itemGroup.add(dish, wax, wick);
    } else if (kind === 'rope') {
      const coil1 = new THREE.Mesh(geoRopeTorus, matRopeCoil);
      coil1.rotation.x = Math.PI / 2;
      coil1.position.y = 0.045;
      const coil2 = new THREE.Mesh(geoRopeTorus, matRopeCoil);
      coil2.rotation.x = Math.PI / 2;
      coil2.scale.set(0.88, 0.88, 1);
      coil2.position.y = 0.11;
      const wrap = new THREE.Mesh(geoRopeBand, matRopeWrap);
      wrap.position.set(0.17, 0.08, 0);
      itemGroup.add(coil1, coil2, wrap);
    } else if (kind === 'food') {
      const pack = new THREE.Mesh(geoFoodBox, matFoodBody);
      pack.position.y = 0.07;
      const strap = new THREE.Mesh(geoFoodStrap, matFoodBand);
      strap.position.y = 0.07;
      itemGroup.add(pack, strap);
    } else if (kind === 'water_bottle') {
      const bottle = new THREE.Mesh(geoWaterBody, matWaterBody);
      bottle.position.y = 0.14;
      const neck = new THREE.Mesh(geoWaterNeck, matWaterBody);
      neck.position.y = 0.3;
      const cap = new THREE.Mesh(geoWaterCap, matWaterCap);
      cap.position.y = 0.35;
      itemGroup.add(bottle, neck, cap);
    } else if (kind === 'artifact') {
      const core = new THREE.Mesh(geoArtifactCore, matArtifactCore);
      core.position.y = 0.24;
      const outerRing = new THREE.Mesh(geoArtifactRing, matArtifactGold);
      outerRing.position.y = 0.24;
      outerRing.rotation.y = Math.PI / 4;
      const baseStand = new THREE.Mesh(geoArtifactStand, matArtifactGold);
      baseStand.position.y = 0.05;
      itemGroup.add(core, outerRing, baseStand);
    }
    return itemGroup;
  }

  function registerHitVolume(
    def: LevelInteractableDef,
    geometry: THREE.BufferGeometry,
    centerY: number,
    priority = 1
  ): THREE.Mesh {
    const hitMesh = new THREE.Mesh(geometry, matHitInvisible);
    hitMesh.position.set(def.x, centerY, def.z);
    hitMesh.userData.interactableId = def.id;
    hitMesh.userData.priority = priority;
    rootGroup.add(hitMesh);
    hitMeshes.push(hitMesh);
    hitMeshMap.set(def.id, hitMesh);
    return hitMesh;
  }

  const ts = CONFIG.TILE_SIZE;

  for (const def of LEVEL_INTERACTABLES) {
    const tileCol = Math.floor(def.x / ts);
    const tileRow = Math.floor(def.z / ts);
    const floorY = getTileFloorElevation(tileCol, tileRow);

    if (
      def.kind === 'matches' ||
      def.kind === 'candle' ||
      def.kind === 'rope' ||
      def.kind === 'food' ||
      def.kind === 'water_bottle'
    ) {
      // Static stone plinth so the item sits ~0.58m off the tile's floor
      const plinth = new THREE.Mesh(geoPlinth, matPlinth);
      plinth.position.set(def.x, floorY + 0.29, def.z);
      plinth.rotation.y = def.yaw * 0.7;
      rootGroup.add(plinth);

      const itemGroup = buildPickupItemVisual(def.kind);
      itemGroup.position.set(def.x, floorY + 0.58, def.z);
      itemGroup.rotation.y = def.yaw;

      rootGroup.add(itemGroup);
      itemVisualMap.set(def.id, itemGroup);
      registerHitVolume(def, geoPickupHit, floorY + 0.65, 2);
    } else if (def.kind === 'rope_anchor') {
      const anchorGroup = new THREE.Group();
      anchorGroup.position.set(def.x, floorY, def.z);

      const postGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 0.78, 6));
      const post = new THREE.Mesh(postGeo, matAnchorStone);
      post.position.y = 0.39;

      const capGeo = trackGeo(new THREE.BoxGeometry(0.3, 0.1, 0.3));
      const cap = new THREE.Mesh(capGeo, matAnchorIron);
      cap.position.y = 0.76;

      const ringGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.028, 6, 8));
      const ring = new THREE.Mesh(ringGeo, matAnchorIron);
      ring.position.set(0, 0.62, 0.15);

      anchorGroup.add(post, cap, ring);
      rootGroup.add(anchorGroup);

      // Build matching far-side anchor post on the South lip of the gap
      const southCol = Math.floor(LEVEL_GAP.southAnchor.x / ts);
      const southRow = Math.floor(LEVEL_GAP.southAnchor.z / ts);
      const southFloorY = getTileFloorElevation(southCol, southRow);
      const southPost = anchorGroup.clone();
      southPost.position.set(
        LEVEL_GAP.southAnchor.x,
        southFloorY,
        LEVEL_GAP.southAnchor.z
      );
      southPost.rotation.y = Math.PI;
      rootGroup.add(southPost);

      const anchorHitGeo = trackGeo(
        new THREE.CylinderGeometry(0.45, 0.45, 1.15, 8)
      );
      registerHitVolume(def, anchorHitGeo, floorY + 0.55, 3);
    } else if (def.kind === 'gap') {
      // Invisible inspect plane covering the mouth of the pit near the North rim
      const gapWidth = LEVEL_GAP.maxX - LEVEL_GAP.minX;
      const gapLength = LEVEL_GAP.maxZ - LEVEL_GAP.minZ;
      const gapHitGeo = trackGeo(
        new THREE.BoxGeometry(gapWidth, 0.5, gapLength)
      );
      const gapCenterX = (LEVEL_GAP.minX + LEVEL_GAP.maxX) * 0.5;
      const gapCenterZ = (LEVEL_GAP.minZ + LEVEL_GAP.maxZ) * 0.5;
      const hitMesh = new THREE.Mesh(gapHitGeo, matHitInvisible);
      hitMesh.position.set(gapCenterX, 0.0, gapCenterZ);
      hitMesh.userData.interactableId = def.id;
      hitMesh.userData.priority = 1;
      rootGroup.add(hitMesh);
      hitMeshes.push(hitMesh);
      hitMeshMap.set(def.id, hitMesh);
    } else if (def.kind === 'artifact') {
      // Stone altar pedestal in the side chamber beyond the gap
      const altarGroup = new THREE.Group();
      altarGroup.position.set(def.x, floorY, def.z);

      const baseGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.22, 0.84));
      const base = new THREE.Mesh(baseGeo, matArtifactPedestal);
      base.position.y = 0.11;

      const pillarGeo = trackGeo(
        new THREE.CylinderGeometry(0.28, 0.34, 0.68, 6)
      );
      const pillar = new THREE.Mesh(pillarGeo, matArtifactPedestal);
      pillar.position.y = 0.52;

      const topGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.1, 0.68));
      const top = new THREE.Mesh(topGeo, matArtifactPedestal);
      top.position.y = 0.88;

      altarGroup.add(base, pillar, top);
      rootGroup.add(altarGroup);

      // Ancient bronze-and-jade geometric artifact
      const relicGroup = new THREE.Group();
      relicGroup.position.set(def.x, floorY + 1.16, def.z);

      const coreGeo = trackGeo(new THREE.OctahedronGeometry(0.15, 0));
      const core = new THREE.Mesh(coreGeo, matArtifactCore);

      const outerRingGeo = trackGeo(
        new THREE.TorusGeometry(0.22, 0.032, 6, 8)
      );
      const outerRing = new THREE.Mesh(outerRingGeo, matArtifactGold);
      outerRing.rotation.y = Math.PI / 4;

      const baseStandGeo = trackGeo(
        new THREE.CylinderGeometry(0.08, 0.14, 0.1, 6)
      );
      const baseStand = new THREE.Mesh(baseStandGeo, matArtifactGold);
      baseStand.position.y = -0.19;

      relicGroup.add(core, outerRing, baseStand);
      rootGroup.add(relicGroup);

      artifactRelicMesh = relicGroup;
      itemVisualMap.set(def.id, relicGroup);

      const artifactHitGeo = trackGeo(
        new THREE.CylinderGeometry(0.48, 0.48, 1.0, 8)
      );
      registerHitVolume(def, artifactHitGeo, floorY + 1.05, 3);
    } else if (def.kind === 'exit') {
      const exitGroup = new THREE.Group();
      exitGroup.position.set(def.x, floorY, def.z);

      // Stone cairn base under the exit shaft
      const cairnGeo = trackGeo(
        new THREE.CylinderGeometry(0.48, 0.65, 0.32, 7)
      );
      const cairn = new THREE.Mesh(cairnGeo, matPlinth);
      cairn.position.y = 0.16;

      // Thick climbing rope descending from the ceiling opening
      const climbRopeGeo = trackGeo(
        new THREE.CylinderGeometry(0.045, 0.045, CONFIG.CEILING_HEIGHT, 6)
      );
      const climbRope = new THREE.Mesh(climbRopeGeo, matExitRope);
      climbRope.position.y = CONFIG.CEILING_HEIGHT * 0.5;

      // Knots along the climbing rope
      const knotGeo = trackGeo(new THREE.TorusGeometry(0.065, 0.025, 5, 7));
      for (let k = 0; k < 4; k++) {
        const knot = new THREE.Mesh(knotGeo, matRopeWrap);
        knot.rotation.x = Math.PI / 2;
        knot.position.y = 0.65 + k * 0.52;
        exitGroup.add(knot);
      }

      // Faint cold shaft of surface air/light above the cairn
      const shaftGeo = trackGeo(
        new THREE.CylinderGeometry(0.38, 0.72, CONFIG.CEILING_HEIGHT, 8, 1, true)
      );
      const shaft = new THREE.Mesh(shaftGeo, matExitShaft);
      shaft.position.y = CONFIG.CEILING_HEIGHT * 0.5;

      exitGroup.add(cairn, climbRope, shaft);
      rootGroup.add(exitGroup);

      const exitHitGeo = trackGeo(
        new THREE.CylinderGeometry(0.62, 0.62, 2.0, 8)
      );
      registerHitVolume(def, exitHitGeo, floorY + 1.0, 2);
    }
  }

  // Build dry stone refuge cairn in the High-Ground Safe Room (col 20.5, row 10.0)
  const safeRoomGroup = new THREE.Group();
  const safeRoomX = 20.5 * ts;
  const safeRoomZ = 10.0 * ts;
  const safeRoomY = CONFIG.SAFE_ROOM_ELEVATION;
  safeRoomGroup.position.set(safeRoomX, safeRoomY, safeRoomZ);

  const slabGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.18, 0.72));
  const slab = new THREE.Mesh(slabGeo, matArtifactPedestal);
  slab.position.set(0, 0.09, 0);

  const cairnBaseGeo = trackGeo(new THREE.DodecahedronGeometry(0.24, 0));
  const cairnBase = new THREE.Mesh(cairnBaseGeo, matPlinth);
  cairnBase.scale.set(1.1, 0.65, 1.0);
  cairnBase.position.set(-0.32, 0.28, -0.06);

  const cairnMidGeo = trackGeo(new THREE.DodecahedronGeometry(0.17, 0));
  const cairnMid = new THREE.Mesh(cairnMidGeo, matAnchorStone);
  cairnMid.scale.set(1.0, 0.7, 1.0);
  cairnMid.position.set(-0.32, 0.46, -0.06);

  const cairnTopGeo = trackGeo(new THREE.OctahedronGeometry(0.11, 0));
  const cairnTop = new THREE.Mesh(cairnTopGeo, matArtifactGold);
  cairnTop.position.set(-0.32, 0.62, -0.06);

  safeRoomGroup.add(slab, cairnBase, cairnMid, cairnTop);
  rootGroup.add(safeRoomGroup);

  // Build the visible Rope Line & Narrow Route across the gap (hidden until ropeTied === true)
  const ropeBridgeGroup = new THREE.Group();
  ropeBridgeGroup.visible = false;

  const spanStartZ = LEVEL_GAP.northAnchor.z;
  const spanEndZ = LEVEL_GAP.southAnchor.z;
  const spanLength = spanEndZ - spanStartZ;
  const spanMidZ = (spanStartZ + spanEndZ) * 0.5;
  const centerX = LEVEL_GAP.bridgeCenterX;

  // 1. Main taut anchor line from North Anchor ring to South Anchor ring
  const anchorLineGeo = trackGeo(
    new THREE.CylinderGeometry(0.028, 0.028, spanLength, 6)
  );
  anchorLineGeo.rotateX(Math.PI / 2);
  const mainAnchorLine = new THREE.Mesh(anchorLineGeo, matRopeCoil);
  mainAnchorLine.position.set(LEVEL_GAP.northAnchor.x, 0.58, spanMidZ);
  ropeBridgeGroup.add(mainAnchorLine);

  // 2. Left & right parallel support ropes along the narrow crossing route
  const railOffset = 0.42;
  const supportRopeGeo = trackGeo(
    new THREE.CylinderGeometry(0.024, 0.024, spanLength, 6)
  );
  supportRopeGeo.rotateX(Math.PI / 2);

  const leftSupportRope = new THREE.Mesh(supportRopeGeo, matRopeCoil);
  leftSupportRope.position.set(centerX - railOffset, 0.02, spanMidZ);

  const rightSupportRope = new THREE.Mesh(supportRopeGeo, matRopeCoil);
  rightSupportRope.position.set(centerX + railOffset, 0.02, spanMidZ);

  const rightHandRope = new THREE.Mesh(anchorLineGeo, matRopeCoil);
  rightHandRope.position.set(centerX + 0.52, 0.58, spanMidZ);

  ropeBridgeGroup.add(leftSupportRope, rightSupportRope, rightHandRope);

  // 3. Narrow rope-lashed wooden/stone slats along the crossing route
  const slatCount = 9;
  const slatGeo = trackGeo(new THREE.BoxGeometry(0.96, 0.05, 0.16));
  for (let i = 0; i < slatCount; i++) {
    const t = (i + 0.5) / slatCount;
    const sz = LEVEL_GAP.minZ + t * (LEVEL_GAP.maxZ - LEVEL_GAP.minZ);
    const slat = new THREE.Mesh(slatGeo, matRopeWrap);
    slat.position.set(centerX, 0.01, sz);
    ropeBridgeGroup.add(slat);
  }

  // Knot collar on North Anchor
  const anchorKnotGeo = trackGeo(new THREE.TorusGeometry(0.15, 0.04, 6, 8));
  const northKnot = new THREE.Mesh(anchorKnotGeo, matRopeCoil);
  northKnot.rotation.x = Math.PI / 2;
  northKnot.position.set(
    LEVEL_GAP.northAnchor.x,
    0.58,
    LEVEL_GAP.northAnchor.z
  );
  ropeBridgeGroup.add(northKnot);

  rootGroup.add(ropeBridgeGroup);

  function syncWithLevelState(
    level: LevelProgressState,
    elapsedSec: number
  ): void {
    // Show/hide collected pickup meshes & their hit volumes
    for (const [id, visual] of itemVisualMap.entries()) {
      const collected = level.collectedIds.includes(id);
      visual.visible = !collected;
      const hit = hitMeshMap.get(id);
      if (hit) {
        hit.visible = !collected;
      }
    }

    // Sync dynamically dropped world items
    const activeDropIds = new Set(level.droppedItems.map((d) => d.id));
    for (const [dropId, entry] of droppedEntryMap.entries()) {
      if (!activeDropIds.has(dropId)) {
        rootGroup.remove(entry.visual);
        rootGroup.remove(entry.hit);
        const hIdx = hitMeshes.indexOf(entry.hit);
        if (hIdx !== -1) {
          hitMeshes.splice(hIdx, 1);
        }
        droppedEntryMap.delete(dropId);
      }
    }

    for (const drop of level.droppedItems) {
      if (!droppedEntryMap.has(drop.id)) {
        const dropCol = Math.floor(drop.x / ts);
        const dropRow = Math.floor(drop.z / ts);
        const dropFloorY = getTileFloorElevation(dropCol, dropRow);

        const visualGroup = buildPickupItemVisual(drop.kind);
        visualGroup.position.set(drop.x, dropFloorY + 0.04, drop.z);
        visualGroup.rotation.y = drop.yaw;
        rootGroup.add(visualGroup);

        const hitMesh = new THREE.Mesh(geoPickupHit, matHitInvisible);
        hitMesh.position.set(drop.x, dropFloorY + 0.35, drop.z);
        hitMesh.userData.interactableId = drop.id;
        hitMesh.userData.priority = 3;
        rootGroup.add(hitMesh);
        hitMeshes.push(hitMesh);

        droppedEntryMap.set(drop.id, { visual: visualGroup, hit: hitMesh });
      }
    }

    // Subtle rotation on the uncollected artifact relic
    if (artifactRelicMesh && artifactRelicMesh.visible) {
      artifactRelicMesh.rotation.y = elapsedSec * 0.7;
    }

    // Show the tied rope line across the gap once tied
    ropeBridgeGroup.visible = level.ropeTied;

    // Disable gap/anchor hit volumes once the rope is already tied
    const gapHit = hitMeshMap.get(LEVEL_GAP.id);
    if (gapHit) {
      gapHit.visible = !level.ropeTied;
    }
    const anchorHit = hitMeshMap.get('gap_rope_anchor');
    if (anchorHit) {
      anchorHit.visible = !level.ropeTied;
    }
  }

  function dispose(): void {
    for (const geo of geometriesToDispose) {
      geo.dispose();
    }
    for (const mat of materialsToDispose) {
      mat.dispose();
    }
  }

  return {
    rootGroup,
    hitMeshes,
    syncWithLevelState,
    dispose,
  };
}

