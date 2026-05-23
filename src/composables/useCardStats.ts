import { computed, type ComputedRef } from 'vue';
import type { Card, InvestableStat } from '@/types/build';
import { SLOT_ORDER } from '@/types/slots';
import { getCachedItem } from './useItemCatalog';
import { effectMaxRoll } from '@/utils/stats';
import { getInvestment, getExo } from '@/utils/statCost';

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

/** Engine-derived base values (the parts that come automatically with the character,
 *  not from manual investment or items):
 *   - PA: 6, becomes 7 from level 100.
 *   - PM: 3 (flat).
 *   - Vitalité: 50 + 5 * level (the per-level innate vitalité).
 *  Sagesse / elemental stats no longer get an implicit +100 here — that bonus is now
 *  expressed via the per-stat `scrolled` flag on `card.investments` so the player can
 *  opt in / out. No level → no base. */
function baseStats(level: number | null): Record<number, number> {
  if (level === null) return {};
  return {
    [CHAR_PA]: level >= 100 ? 7 : 6,
    [CHAR_PM]: 3,
    [CHAR_VITALITE]: 50 + 5 * level,
  };
}

/** DofusDB characteristic id corresponding to each investable stat. */
const INVESTABLE_TO_CHAR: Record<InvestableStat, number> = {
  vitalite: CHAR_VITALITE,
  sagesse: CHAR_SAGESSE,
  force: CHAR_FORCE,
  agilite: CHAR_AGILITE,
  intelligence: CHAR_INTELLIGENCE,
  chance: CHAR_CHANCE,
};

/** Sum the manual `invested` value + a +100 bonus per stat that has `scrolled: true`. */
function investmentStats(card: Card): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [stat, charId] of Object.entries(INVESTABLE_TO_CHAR) as [InvestableStat, number][]) {
    const inv = getInvestment(card, stat);
    const v = inv.invested + (inv.scrolled ? 100 : 0);
    if (v !== 0) out[charId] = v;
  }
  return out;
}

/** Item-only contribution: sum of max-roll effect values across every equipped slot and
 *  dofus, grouped by DofusDB characteristic id. Also applies the panoplie (item set)
 *  bonus matching the number of equipped pieces — each tier in `set.effects[N-1]`
 *  already represents the COMPLETE bonus for N pieces, so we only apply the matching
 *  tier (no accumulation from lower tiers). No level base, no investment, no scroll. */
export function aggregateItemBonus(card: Card): Record<number, number> {
  const totals: Record<number, number> = {};
  const accumulate = (effects: { characteristic?: number; from: number; to: number; effectId: number }[]): void => {
    for (const eff of effects) {
      if (eff.characteristic === undefined) continue;
      totals[eff.characteristic] = (totals[eff.characteristic] ?? 0) + effectMaxRoll(eff);
    }
  };
  // Items: own effects + count per set for the panoplie pass.
  const setCounts = new Map<number, { count: number; set: import('@/data/dofusdb').ItemSet | undefined }>();
  const collect = (itemId: number): void => {
    const item = getCachedItem(itemId);
    if (!item) return;
    if (item.effects) accumulate(item.effects);
    if (item.setId !== undefined) {
      const entry = setCounts.get(item.setId) ?? { count: 0, set: undefined };
      entry.count++;
      if (item.set) entry.set = item.set;
      setCounts.set(item.setId, entry);
    }
  };
  for (const slot of SLOT_ORDER) {
    const ref = card.slots[slot];
    if (ref) collect(ref.itemId);
  }
  for (const ref of card.dofus) {
    if (ref) collect(ref.itemId);
  }
  // Apply each set's matching tier (need >= 2 pieces for a bonus to exist).
  for (const { count, set } of setCounts.values()) {
    if (!set || count < 2) continue;
    const tier = set.effects[count - 1];
    if (tier && tier.length > 0) accumulate(tier);
  }
  return totals;
}

/** Stats WITHOUT items: level base + manual investment + scroll bonus + Exo PA/PM/PO.
 *  This is what the "Stats" column in CardStatsPanel displays. */
export function aggregateCharacterBase(card: Card): Record<number, number> {
  const base = baseStats(card.level);
  const inv = investmentStats(card);
  const out: Record<number, number> = { ...base };
  for (const [k, v] of Object.entries(inv)) {
    const id = Number(k);
    out[id] = (out[id] ?? 0) + v;
  }
  const exo = getExo(card);
  if (exo.pa) out[CHAR_PA] = (out[CHAR_PA] ?? 0) + 1;
  if (exo.pm) out[CHAR_PM] = (out[CHAR_PM] ?? 0) + 1;
  if (exo.po) out[CHAR_PO] = (out[CHAR_PO] ?? 0) + 1;
  return out;
}

/** Full total: level base + investment/scroll + items. Kept for any consumer that needs
 *  a single aggregated map (dofusbook export, future stats use, etc.). */
export function aggregateCardStats(card: Card): Record<number, number> {
  const totals = aggregateCharacterBase(card);
  const items = aggregateItemBonus(card);
  for (const [k, v] of Object.entries(items)) {
    const id = Number(k);
    totals[id] = (totals[id] ?? 0) + v;
  }
  return totals;
}

export function useCardStats(card: () => Card): ComputedRef<Record<number, number>> {
  return computed(() => aggregateCardStats(card()));
}

export function useCharacterBase(card: () => Card): ComputedRef<Record<number, number>> {
  return computed(() => aggregateCharacterBase(card()));
}

export function useItemBonus(card: () => Card): ComputedRef<Record<number, number>> {
  return computed(() => aggregateItemBonus(card()));
}
