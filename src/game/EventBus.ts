import Phaser from 'phaser';

/**
 * Commands from React -> Phaser (React reads game state from the Zustand stores).
 *  ui:pause / ui:resume   – pause menu
 *  ui:rest-leave          – leave the bonfire menu
 */
export const EventBus = new Phaser.Events.EventEmitter();
