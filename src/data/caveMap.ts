import { CONFIG } from '../config';

/**
 * Tile type constants for the cave map.
 * 0 = Walkable cave floor
 * 1 = Solid rock wall
 * 2 = Cave entrance floor (walkable)
 */
export enum TileType {
  FLOOR = 0,
  WALL = 1,
  ENTRANCE = 2,
}

export interface TileCoord {
  col: number;
  row: number;
}

export interface ChamberProp {
  /** World X coordinate in metres */
  x: number;
  /** World Z coordinate in metres */
  z: number;
  /** Base radius in metres */
  radius: number;
  /** Height in metres */
  height: number;
  /** Prop kind: stalagmite (floor cone), boulder (low rock), stalactite (ceiling cone) */
  kind: 'stalagmite' | 'boulder' | 'stalactite';
  /** Whether player collides with this prop on the floor */
  solid: boolean;
}

/**
 * Player initial spawn tile inside the Cave Entrance.
 */
export const PLAYER_SPAWN_TILE: TileCoord = {
  col: 4,
  row: 5,
};

/**
 * Initial player yaw (facing East along +X into the winding passage).
 */
export const PLAYER_INITIAL_YAW = -Math.PI / 2;

/**
 * 60 columns x 40 rows cave map (1 tile = 2m -> 120m x 80m world).
 *
 * Map features:
 * - Entrance (Cửa hang): Top-west (cols 2..6, rows 3..7) marked with TileType.ENTRANCE (2)
 * - Winding passages (Lối đi quanh co):
 *   - North-west winding passage from Entrance (cols 6..15, rows 5..14) into West Chamber
 *   - Southern winding passage loop (cols 20..46, rows 24..32) connecting both chambers
 * - Chamber 1 (Khoang hang Tây): Cols 14..26, rows 10..22 with natural stone pillars
 * - Narrow corridor (Hành lang hẹp): 1-tile-wide (2m wide, 2.0m low ceiling) squeeze at row 16, cols 27..37
 * - Chamber 2 (Khoang hang Đông): Cols 38..54, rows 8..25 with central stalagmite formations
 */
export const CAVE_MAP: readonly (readonly TileType[])[] = [
  //0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 00
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 01
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 02
  [1,1,1,2,2,2,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 03: Entrance top
  [1,1,2,2,2,2,2,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 04: Entrance
  [1,1,2,2,2,2,2,0,0,0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 05: Spawn (col 4, row 5)
  [1,1,2,2,2,2,0,0,0,0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 06: Entrance -> Winding
  [1,1,1,2,2,1,1,1,0,0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 07: Winding passage
  [1,1,1,1,1,1,1,1,1,0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 08: Chamber 2 top
  [1,1,1,1,1,1,1,1,1,1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // row 09
  [1,1,1,1,1,1,1,1,1,1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], // row 10: Chamber 1 top
  [1,1,1,1,1,1,1,1,1,1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], // row 11
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 12
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 13
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 14
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 15
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 16: 1-tile Narrow Corridor (cols 27..37)
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 17
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 18
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // row 19
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // row 20
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // row 21
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1], // row 22: Chamber 1 bottom
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], // row 23
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 24: Chamber 2 bottom
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 25
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 26: Southern winding passage
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 27
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 28
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 29
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 30
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 31
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 32
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 33
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 34
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 35
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 36
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 37
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 38
  [1,1,1,1,1,1,1,1,1,1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // row 39
];

/**
 * Helper to check if a given tile coordinate is a solid wall.
 * Out-of-bounds coordinates are always treated as solid walls.
 */
export function isWallTile(
  map: readonly (readonly TileType[])[],
  col: number,
  row: number
): boolean {
  if (row < 0 || row >= CONFIG.MAP_ROWS || col < 0 || col >= CONFIG.MAP_COLS) {
    return true;
  }
  return map[row][col] === TileType.WALL;
}

/**
 * Identifies the 1-tile-wide narrow corridor connecting the West and East chambers
 * where the ceiling drops to 2.0 metres.
 */
export function isNarrowCorridorTile(col: number, row: number): boolean {
  return row === 16 && col >= 27 && col <= 37;
}

/**
 * Returns the ceiling height (in metres) at a given tile coordinate.
 */
export function getCeilingHeightAt(col: number, row: number): number {
  return isNarrowCorridorTile(col, row)
    ? CONFIG.CORRIDOR_CEILING_HEIGHT
    : CONFIG.CEILING_HEIGHT;
}

/**
 * Converts a tile coordinate to the center world position (x, z) in metres.
 */
export function tileToWorldCenter(tile: TileCoord): { x: number; z: number } {
  return {
    x: (tile.col + 0.5) * CONFIG.TILE_SIZE,
    z: (tile.row + 0.5) * CONFIG.TILE_SIZE,
  };
}

const ts = CONFIG.TILE_SIZE;

/**
 * Procedural stalagmites, boulders, and ceiling stalactites placed in the two chambers
 * and entrance vestibule.
 */
export const CHAMBER_PROPS: readonly ChamberProp[] = [
  // Entrance vestibule rocks
  { x: 3.3 * ts, z: 4.3 * ts, radius: 0.35, height: 0.55, kind: 'boulder', solid: true },
  { x: 5.7 * ts, z: 4.4 * ts, radius: 0.42, height: 1.35, kind: 'stalagmite', solid: true },

  // Chamber 1 (West Cavern: cols 14..26, rows 10..22)
  { x: 16.5 * ts, z: 11.4 * ts, radius: 0.48, height: 1.75, kind: 'stalagmite', solid: true },
  { x: 21.4 * ts, z: 11.2 * ts, radius: 0.44, height: 1.5, kind: 'stalagmite', solid: true },
  { x: 24.6 * ts, z: 12.2 * ts, radius: 0.38, height: 0.65, kind: 'boulder', solid: true },
  { x: 15.6 * ts, z: 15.8 * ts, radius: 0.46, height: 1.85, kind: 'stalagmite', solid: true },
  { x: 20.5 * ts, z: 15.4 * ts, radius: 0.52, height: 2.05, kind: 'stalagmite', solid: true },
  { x: 25.3 * ts, z: 18.2 * ts, radius: 0.4, height: 1.4, kind: 'stalagmite', solid: true },
  { x: 19.6 * ts, z: 20.5 * ts, radius: 0.42, height: 0.7, kind: 'boulder', solid: true },
  { x: 17.5 * ts, z: 14.5 * ts, radius: 0.36, height: 1.1, kind: 'stalactite', solid: false },
  { x: 22.5 * ts, z: 16.2 * ts, radius: 0.4, height: 1.25, kind: 'stalactite', solid: false },

  // Chamber 2 (East Cavern: cols 38..54, rows 8..24)
  { x: 40.4 * ts, z: 10.3 * ts, radius: 0.5, height: 1.9, kind: 'stalagmite', solid: true },
  { x: 46.5 * ts, z: 10.5 * ts, radius: 0.55, height: 2.15, kind: 'stalagmite', solid: true },
  { x: 52.3 * ts, z: 11.6 * ts, radius: 0.42, height: 0.75, kind: 'boulder', solid: true },
  { x: 40.2 * ts, z: 14.2 * ts, radius: 0.45, height: 1.65, kind: 'stalagmite', solid: true },
  { x: 49.6 * ts, z: 14.4 * ts, radius: 0.52, height: 1.95, kind: 'stalagmite', solid: true },
  { x: 52.8 * ts, z: 16.5 * ts, radius: 0.46, height: 1.6, kind: 'stalagmite', solid: true },
  { x: 43.8 * ts, z: 18.8 * ts, radius: 0.48, height: 1.8, kind: 'stalagmite', solid: true },
  { x: 48.2 * ts, z: 19.2 * ts, radius: 0.38, height: 0.65, kind: 'boulder', solid: true },
  { x: 45.2 * ts, z: 22.6 * ts, radius: 0.5, height: 1.75, kind: 'stalagmite', solid: true },
  { x: 44.5 * ts, z: 13.5 * ts, radius: 0.42, height: 1.3, kind: 'stalactite', solid: false },
  { x: 50.5 * ts, z: 17.5 * ts, radius: 0.38, height: 1.15, kind: 'stalactite', solid: false },
];
