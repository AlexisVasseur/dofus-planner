import type { SlotType } from './slots';

export type RoomId = '1-50' | '51-100' | '101-150' | '151-199' | '200';

export const ROOM_ORDER: readonly RoomId[] = [
  '1-50', '51-100', '101-150', '151-199', '200',
] as const;

export type NpcId =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau'
  | 'ceinture' | 'bottes' | 'arme' | 'bouclier' | 'familier'
  | 'trophee' | 'dofus';

export const NPC_ORDER: readonly NpcId[] = [
  'coiffe', 'cape', 'amulette', 'anneau',
  'ceinture', 'bottes', 'arme', 'bouclier', 'familier',
  'trophee', 'dofus',
] as const;

export const NPC_LABEL: Record<NpcId, string> = {
  coiffe: 'Coiffe',
  cape: 'Cape',
  amulette: 'Amulette',
  anneau: 'Anneau',
  ceinture: 'Ceinture',
  bottes: 'Bottes',
  arme: 'Arme',
  bouclier: 'Bouclier',
  familier: 'Familier',
  trophee: 'Trophée',
  dofus: 'Dofus / Prysm.',
};

// Which NPCs are available in each room (event configuration).
export const ROOM_NPCS: Record<RoomId, readonly NpcId[]> = {
  '1-50':    ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier'],
  '51-100':  ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '101-150': ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '151-199': ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '200':     ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'dofus'],
};

// DofusDB typeIds for dofus/trophée disambiguation in the dofus[] array.
export const TYPE_ID_DOFUS = 23;
export const TYPE_ID_TROPHEE = 151;

/** Map a SlotType to its NPC. anneau1/anneau2 collapse to 'anneau'; others map 1:1. */
export function slotToNpc(slot: SlotType): NpcId {
  if (slot === 'anneau1' || slot === 'anneau2') return 'anneau';
  return slot as NpcId;
}

/** Map a card level to its candidate room (before exception bumps). */
export function levelToRoom(level: number): RoomId {
  if (level >= 200) return '200';
  if (level >= 151) return '151-199';
  if (level >= 101) return '101-150';
  if (level >= 51) return '51-100';
  return '1-50';
}
