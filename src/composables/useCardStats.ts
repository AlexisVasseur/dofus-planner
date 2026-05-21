import { computed, type ComputedRef } from 'vue';
import type { Card } from '@/types/build';
import { SLOT_ORDER } from '@/types/slots';
import { getCachedItem } from './useItemCatalog';
import { effectMaxRoll } from '@/utils/stats';

// DofusDB characteristic ids — verified live against /characteristics?lang=fr.
export const CHAR_PA = 1;
export const CHAR_PM = 23;
export const CHAR_PO = 19;
export const CHAR_VITALITE = 11;
export const CHAR_SAGESSE = 12;
export const CHAR_FORCE = 10;
export const CHAR_AGILITE = 14;     // Air element
export const CHAR_INTELLIGENCE = 15; // Feu element
export const CHAR_CHANCE = 13;       // Eau element
export const CHAR_PUISSANCE = 25;
export const CHAR_DOMMAGE = 16;          // general "+X Dommages"
export const CHAR_DOM_TERRE = 88;        // Dommage Force
export const CHAR_DOM_FEU = 89;          // Dommage Intel
export const CHAR_DOM_EAU = 90;          // Dommage Eau (Chance)
export const CHAR_DOM_AIR = 91;          // Dommage Air

/** Base character stats by level. Dofus rules:
 *   PA       = 6, becomes 7 from level 100.
 *   PM       = 3 (flat).
 *   Vitalité = 55 at level 1, +5 per level (so `50 + 5 * level`).
 * No level → no base (we don't know the level yet). */
function baseStats(level: number | null): Record<number, number> {
  if (level === null) return {};
  return {
    [CHAR_PA]: level >= 100 ? 7 : 6,
    [CHAR_PM]: 3,
    [CHAR_VITALITE]: 50 + 5 * level,
  };
}

/** Aggregate the max-roll value (`effect.to`) of every item effect on the card, grouped by
 * characteristic, ADDED to the level-based character base. Each item contributes its own
 * bonus per characteristic; multiple items boosting the same stat sum together. Items not
 * yet in the cache contribute nothing (the panel re-renders once their effects arrive). */
export function aggregateCardStats(card: Card): Record<number, number> {
  const totals: Record<number, number> = { ...baseStats(card.level) };
  const accumulate = (itemId: number): void => {
    const item = getCachedItem(itemId);
    if (!item || !item.effects) return;
    for (const eff of item.effects) {
      if (eff.characteristic === undefined) continue;
      totals[eff.characteristic] = (totals[eff.characteristic] ?? 0) + effectMaxRoll(eff);
    }
  };
  for (const slot of SLOT_ORDER) {
    const ref = card.slots[slot];
    if (ref) accumulate(ref.itemId);
  }
  for (const ref of card.dofus) {
    if (ref) accumulate(ref.itemId);
  }
  return totals;
}

export function useCardStats(card: () => Card): ComputedRef<Record<number, number>> {
  return computed(() => aggregateCardStats(card()));
}
