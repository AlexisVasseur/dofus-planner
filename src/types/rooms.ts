import type { SlotType } from './slots';
import { TYPE_ID_TO_SLOT, RING_TYPE_ID } from '@/utils/typeIdSlots';

export type RoomId = '1-49' | '50-99' | '100-149' | '150-199' | '200' | 'hub';

export const ROOM_ORDER: readonly RoomId[] = [
  '1-49', '50-99', '100-149', '150-199', '200', 'hub',
] as const;

export type NpcId =
  | 'arme' | 'cape' | 'bottes' | 'anneau'
  | 'coiffe' | 'amulette' | 'ceinture'
  | 'bouclier' | 'familier' | 'monture'
  | 'trophee' | 'dofus';

// In-room merchant order matching the live event layout: Armes, Capes, Bottes, Anneaux,
// Chapeaux, Amulettes, Ceintures, Bouclier, then the Hub-only Familier/Monture, then the
// special-room Trophées / Dofus columns.
export const NPC_ORDER: readonly NpcId[] = [
  'arme', 'cape', 'bottes', 'anneau',
  'coiffe', 'amulette', 'ceinture',
  'bouclier',
  'familier', 'monture',
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
  monture: 'Monture',
  trophee: 'Trophée',
  dofus: 'Dofus / Prysm.',
};

// Which NPCs are available in each room (event configuration). Array order = column order
// shown in AppPurchasePlanner — must match NPC_ORDER. The Hub is the level-agnostic room
// for familiers + montures (they're sold there regardless of the player's level).
export const ROOM_NPCS: Record<RoomId, readonly NpcId[]> = {
  '1-49':    ['arme', 'cape', 'bottes', 'anneau', 'coiffe', 'amulette', 'ceinture', 'bouclier'],
  '50-99':   ['arme', 'cape', 'bottes', 'anneau', 'coiffe', 'amulette', 'ceinture', 'bouclier', 'trophee'],
  '100-149': ['arme', 'cape', 'bottes', 'anneau', 'coiffe', 'amulette', 'ceinture', 'bouclier', 'trophee'],
  '150-199': ['arme', 'cape', 'bottes', 'anneau', 'coiffe', 'amulette', 'ceinture', 'bouclier', 'trophee'],
  '200':     ['arme', 'cape', 'bottes', 'anneau', 'coiffe', 'amulette', 'ceinture', 'bouclier', 'dofus'],
  'hub':     ['familier', 'monture'],
};

// DofusDB typeIds — for dofus/trophée disambiguation in the dofus[] array
// and for splitting the familier slot into Familier vs Monture in the Hub.
export const TYPE_ID_DOFUS = 23;
export const TYPE_ID_TROPHEE = 151;
export const FAMILIER_TYPE_IDS: readonly number[] = [18, 121]; // Familier + Montilier
export const MONTURE_TYPE_IDS: readonly number[] = [97, 196, 207]; // Dragodinde, Muldo, Volkorne

/** Hub-only label for the room (level rooms display the range, Hub displays "Hub"). */
export const ROOM_LABEL: Record<RoomId, string> = {
  '1-49':    'Salle 1-49',
  '50-99':   'Salle 50-99',
  '100-149': 'Salle 100-149',
  '150-199': 'Salle 150-199',
  '200':     'Salle 200',
  'hub':     'Hub',
};

/** Map a SlotType to its NPC. anneau1/anneau2 collapse to 'anneau'; others map 1:1. */
export function slotToNpc(slot: SlotType): NpcId {
  if (slot === 'anneau1' || slot === 'anneau2') return 'anneau';
  return slot as NpcId;
}

/** Map a level (item levelRequired or card level) to its candidate room. */
export function levelToRoom(level: number): RoomId {
  if (level >= 200) return '200';
  if (level >= 150) return '150-199';
  if (level >= 100) return '100-149';
  if (level >= 50) return '50-99';
  return '1-49';
}

/** Route a resolved item to its shopping room + NPC by typeId + levelRequired.
 *  Mirrors useShoppingList's bucketing but keyed on typeId (the custom importer
 *  knows only the item, not a slot). Returns null when the typeId fits no shopping
 *  NPC (e.g. a consumable) — the caller treats that as "unknown". */
export function routeItemByType(item: { typeId: number; levelRequired: number }): { room: RoomId; npc: NpcId } | null {
  const { typeId, levelRequired } = item;
  if (typeId === TYPE_ID_DOFUS) return { room: '200', npc: 'dofus' };
  if (typeId === TYPE_ID_TROPHEE) {
    const room = levelToRoom(levelRequired);
    return { room: room === '1-49' ? '50-99' : room, npc: 'trophee' };
  }
  if (FAMILIER_TYPE_IDS.includes(typeId)) return { room: 'hub', npc: 'familier' };
  if (MONTURE_TYPE_IDS.includes(typeId)) return { room: 'hub', npc: 'monture' };
  if (typeId === RING_TYPE_ID) return { room: levelToRoom(levelRequired), npc: 'anneau' };
  const slot = TYPE_ID_TO_SLOT[typeId];
  if (slot) return { room: levelToRoom(levelRequired), npc: slotToNpc(slot) };
  return null;
}
