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

// Phaser sizes and centres the canvas from getBoundingClientRect(), which is the on-screen box – rotated
// when the app fakes landscape (see fakeLandscape.ts). Use the elements' own layout sizes instead.
type ScaleInternals = {
  parent?: HTMLElement;
  parentSize: Phaser.Structs.Size;
  canvas: HTMLCanvasElement;
  autoCenter: number;
};
const scaleProto = Phaser.Scale.ScaleManager.prototype as unknown as {
  getParentBounds: () => boolean;
  updateCenter: () => void;
};
scaleProto.getParentBounds = function (this: ScaleInternals) {
  if (!this.parent) return false;
  const w = this.parent.clientWidth;
  const h = this.parent.clientHeight;
  if (this.parentSize.width === w && this.parentSize.height === h) return false;
  this.parentSize.setSize(w, h);
  return true;
};
scaleProto.updateCenter = function (this: ScaleInternals) {
  if (this.autoCenter !== Phaser.Scale.CENTER_BOTH) return; // the only mode this game uses
  const { style, offsetWidth, offsetHeight } = this.canvas;
  style.marginLeft = `${Math.floor((this.parentSize.width - offsetWidth) / 2)}px`;
  style.marginTop = `${Math.floor((this.parentSize.height - offsetHeight) / 2)}px`;
};

/** Fixed 270px height; width follows the app's aspect so wide phones get no side bars. */
function computeWidth(parent: HTMLElement) {
  // the parent's layout size, not the window's: with fake landscape the two are swapped
  const w = parent.clientWidth || window.innerWidth;
  const h = parent.clientHeight || window.innerHeight;
  const ar = w / Math.max(1, h);
  return Math.round(Phaser.Math.Clamp(GAME_H * ar, 400, 640) / 2) * 2;
}

export function createGame(parent: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: computeWidth(parent),
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#07060a',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, GameScene],
  });
  const fit = () => game.scale.setGameSize(computeWidth(parent), GAME_H);
  // iOS Safari fires resize during a rotation, before innerWidth/innerHeight have their new values, so
  // the width would be computed from the old aspect – fit again once the rotation has settled
  let settle = 0;
  const onResize = () => {
    fit();
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      fit();
      game.scale.refresh();
    }, 350);
  };
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
    clearTimeout(settle);
    document.removeEventListener('visibilitychange', onVisible);
  });
  // ?debug exposes hooks for automated testing in the browser console
  if (new URLSearchParams(location.search).has('debug'))
    Object.assign(window, {
      __souls: { game, touchInput, pressTouch, stores: { inventory: useInventoryStore, player: usePlayerStore, game: useGameStore }, sfx },
    });
  return game;
}
