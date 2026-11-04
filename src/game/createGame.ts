import Phaser from 'phaser';
import { CONFIG } from '../config';
import { CaveScene } from '../scenes/CaveScene';

/**
 * Creates and mounts a Phaser.Game instance inside the given HTML container element.
 */
export function createCaveGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: CONFIG.VIEWPORT_WIDTH,
    height: CONFIG.VIEWPORT_HEIGHT,
    backgroundColor: CONFIG.COLORS.BACKGROUND,
    pixelArt: true,
    antialias: false,
    scene: [CaveScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      keyboard: true,
    },
  });
}
