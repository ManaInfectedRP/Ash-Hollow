/**
 * NPCs and their dialogue. Pure data, used by React (Dialogue/Shop UI) and Phaser (spawning).
 *
 * A dialogue is a small graph of nodes. A choice can jump to another node, open the shop,
 * give items, set a world flag, or end the conversation. `start(flags)` picks the entry node,
 * so NPCs remember you through world flags (saved with the game).
 */

export type DialogueAction =
  | { type: 'goto'; node: string }
  | { type: 'shop' }
  | { type: 'end' };

export interface DialogueChoice {
  label: string;
  action: DialogueAction;
}

export interface DialogueNode {
  lines: string[];
  /** world flag set when this node is shown */
  sets?: string;
  /** items given once when this node is shown (guarded by `sets`) */
  gives?: { item: string; qty: number }[];
  choices?: DialogueChoice[];
}

export interface ShopEntry {
  item: string;
  price: number;
}

export interface NpcDef {
  id: string;
  name: string;
  /** spritesheet key (tools/sprites) */
  sheet: string;
  start: (flags: Record<string, boolean>) => string;
  nodes: Record<string, DialogueNode>;
  shop?: ShopEntry[];
}

const end = (label = 'Farewell'): DialogueChoice => ({ label, action: { type: 'end' } });
const goto = (label: string, node: string): DialogueChoice => ({ label, action: { type: 'goto', node } });
const wares: DialogueChoice = { label: 'Show me your wares', action: { type: 'shop' } };

export const NPCS: Record<string, NpcDef> = {
  hessa: {
    id: 'hessa',
    name: 'Hessa, the Ash-Merchant',
    sheet: 'npc-merchant',
    start: (f) => (f.hessa_met ? 'again' : 'first'),
    nodes: {
      first: {
        sets: 'hessa_met',
        lines: [
          'Oh? Footsteps that still sound like footsteps. How rare.',
          "I am Hessa. I trade in what the hollow leaves behind – bread, herbs, a little stone that remembers being steel.",
          'Souls for goods. The dead have no use for either, but you might.',
        ],
        choices: [wares, goto('What is this place?', 'lore'), end()],
      },
      again: {
        lines: ['Back again, and still warm. Good. What will it be?'],
        choices: [wares, goto('Any advice?', 'advice'), end()],
      },
      lore: {
        lines: [
          'This was a fortress once. The Warden kept its gate long after there was nothing left to guard.',
          'Beyond his arena the old crypts sink into the earth. Some say a path from there leads back to the ruined gate.',
        ],
        choices: [wares, end()],
      },
      advice: {
        lines: [
          "Heavy armour turns blades, but you'll roll like a sack of stones. Watch your load.",
          'And reinforce that weapon at a bonfire. Titanite does more good in steel than in my pocket.',
        ],
        choices: [wares, end()],
      },
    },
    shop: [
      { item: 'bread', price: 60 },
      { item: 'ember_herb', price: 150 },
      { item: 'titanite', price: 500 },
      { item: 'shortsword', price: 400 },
      { item: 'longsword', price: 900 },
      { item: 'twin_daggers', price: 1200 },
      { item: 'buckler', price: 450 },
      { item: 'hunter_leathers', price: 1500 },
      { item: 'tower_shield', price: 2200 },
    ],
  },

  corvin: {
    id: 'corvin',
    name: 'Ser Corvin of the Blue Watch',
    sheet: 'npc-corvin',
    start: (f) => (f.corvin_met ? (f.shortcut ? 'shortcut' : 'again') : 'first'),
    nodes: {
      first: {
        sets: 'corvin_met',
        gives: [{ item: 'ember_herb', qty: 2 }],
        lines: [
          'Hm. You felled the Warden? Then the gate above is quiet at last.',
          'I came down here hunting the thing that hollowed my brothers. I found only more of them.',
          'Take these herbs. My hands shake too much to make use of them.',
          'The ghouls are quick – wait for their lunge, then strike. The archers will not follow you up close.',
        ],
        choices: [goto('Is there a way out?', 'exit'), end('Rest well')],
      },
      again: {
        lines: ['Still alive? The crypt has not swallowed you yet.'],
        choices: [goto('Is there a way out?', 'exit'), end('Rest well')],
      },
      exit: {
        lines: [
          'East, past the low crypt. There is a door that opens onto the old gate – barred from this side.',
          'Open it and you will never have to cross that bridge again.',
        ],
        choices: [end('Thank you')],
      },
      shortcut: {
        lines: ['You opened the old gate. Good. A little light gets down here now.'],
        choices: [end('Rest well')],
      },
    },
  },
};
