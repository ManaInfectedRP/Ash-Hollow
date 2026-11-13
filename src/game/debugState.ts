/**
 * Debug toggles shared by the game and the React debug menu (only reachable with `?debug` in the URL).
 * Module-level so they survive scene restarts / area changes.
 */
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export const debugState = {
  /** no damage, no hazard deaths (you're put back on safe ground), endless stamina */
  god: false,
  /** draw hurtboxes (green/yellow) and active hitboxes (red); F2 toggles too */
  hitboxes: DEBUG,
};
