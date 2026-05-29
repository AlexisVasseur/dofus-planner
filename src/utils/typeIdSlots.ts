import { SLOT_ORDER, type SlotType } from '@/types/slots';
import { SLOT_TO_TYPE_IDS } from '@/data/dofusdb';

/** Ring slots share this typeId (anneau1 + anneau2) — handled separately from the map. */
export const RING_TYPE_ID = 9;
/** Dofus / Trophée live in the positional dofus[] bucket, not a named slot. */
export const DOFUS_TYPE_ID = 23;
export const TROPHEE_TYPE_ID = 151;

/** typeId → equipment slot, EXCLUDING the two ring slots (typeId 9 maps to both,
 *  handled separately by callers). Every other equipment typeId maps to exactly
 *  one slot; the multi-typeId `arme` / `familier` slots fold all their typeIds in. */
export const TYPE_ID_TO_SLOT: Record<number, SlotType> = (() => {
  const map: Record<number, SlotType> = {};
  for (const slot of SLOT_ORDER) {
    if (slot === 'anneau1' || slot === 'anneau2') continue;
    for (const tid of SLOT_TO_TYPE_IDS[slot]) map[tid] = slot;
  }
  return map;
})();
