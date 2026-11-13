import Phaser from 'phaser';
import { GAME_H } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';
import { pressTouch, touchInput } from './input/touchInput';
import { useInventoryStore } from '../stores/inventoryStore';
import { usePlayerStore } from '../stores/playerStore';
import { useGameStore } from '../stores/gameStore';
import { sfx } from './systems/Sfx';

/** Fixed 270px height; width follows the screen aspect so wide phones get no side bars. */
function computeWidth() {
  const ar = window.innerWidth / Math.max(1, window.innerHeight);
  return Math.round(Phaser.Math.Clamp(GAME_H * ar, 400, 640) / 2) * 2;
}

export function createGame(parent: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: computeWidth(),
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#07060a',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, GameScene],
  });
  const onResize = () => game.scale.setGameSize(computeWidth(), GAME_H);
  // a page that boots hidden (app started with the screen off, background tab) can end up with a
  // 0×0 canvas – re-fit whenever it becomes visible
  const onVisible = () => {
    if (!document.hidden) {
      onResize();
      game.scale.refresh();
    }
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisible);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisible);
  });
  // ?debug exposes hooks for automated testing in the browser console
  if (new URLSearchParams(location.search).has('debug'))
    Object.assign(window, {
      __souls: { game, touchInput, pressTouch, stores: { inventory: useInventoryStore, player: usePlayerStore, game: useGameStore }, sfx },
    });
  return game;
}
