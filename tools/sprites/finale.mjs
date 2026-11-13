// The finale: the Ashen King (the Warden's rig in ash-grey iron with a crown), his greatsword and regalia.
import { grid } from './lib/grid.mjs';
import { makeSword, PAULDRONS } from './parts.mjs';

/** an iron crown over a closed helm: tall gold spikes, a burning slit */
const CROWN_HELM = grid(
  [
    '.G....G....G....G.',
    '.G...GgG..GgG...G.',
    '.gG.GggG..GggG.Gg.',
    '..gGggggggggggGg..',
    '..gggggggggggggg..',
    '...DLLHHHLLMMMD...',
    '..DLHHHLLLMMMMMD..',
    '..DLHLLLLLMMMMMD..',
    '..DLLLvvvvvvvvvv..',
    '..DLLLvFeFFeFFvv..',
    '..DLLLMMMMMMMMMD..',
    '..DMLLMfMfMfMMMD..',
    '..DMMMMMMMMMMMMD..',
    '...DMMMMMMMMMMD...',
    '....DDDDDDDDDD....',
  ],
  [9, 14],
);

const ASH_PLATE = {
  D: '#24222a', M: '#3a3740', L: '#5a5662', H: '#868290',
  k: '#1a1416', c: '#3a1e1c', C: '#5a2a24',
  g: '#a07a28', G: '#e8c050',
  e: '#ffb040', f: '#c03a10', F: '#ff8a2a',
  x: '#4a4448', b: '#8a8288', B: '#c8bcb4', W: '#ffe8c8',
  v: '#0a0606',
};

/** the King: the Warden's sheet, re-armoured and crowned, with a casting pose for his stolen powers */
export function KING_SHEET(WARDEN_SHEET) {
  return {
    ...WARDEN_SHEET,
    key: 'king',
    def: {
      ...WARDEN_SHEET.def,
      head: CROWN_HELM,
      headDy: 2,
      legs: { back: '#1a181e', front: '#2e2a32', lit: '#4a4650' },
      pal: { ...WARDEN_SHEET.def.pal, ...ASH_PLATE },
    },
    poses: {
      ...WARDEN_SHEET.poses,
      // the greatsword raised high in both hands: calling fire, frost and poison
      cast: { lean: -3, a: -95, r: 8, by: 1, fx: 4, bx: -5, cape: 3, ba: -100 },
    },
  };
}

export const FINALE_WEAPONS = {
  ashenGreatsword: makeSword({ len: 18, width: 3, grip: 4, guard: 3, runes: true, seed: 5 }),
};

export const FINALE_PLAYER_WEAPONS = {
  ashen_greatsword: { grid: FINALE_WEAPONS.ashenGreatsword, pal: { x: '#4a4448', b: '#8a8288', B: '#c8bcb4', W: '#ffe8c8', g: '#a07a28', G: '#e8c050', f: '#c03a10', F: '#ff8a2a', e: '#ffb040' } },
};

export const FINALE_ARMORS = (HEADS) => ({
  /** ash-grey plate with gold edging and the smouldering crack of the king's own */
  ashen_regalia: {
    head: HEADS.greatHelm,
    torso: 'warden',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    taper: 1,
    legs: { back: '#1a181e', front: '#2e2a32', lit: '#4a4650' },
    pal: { ...ASH_PLATE },
  },
});
