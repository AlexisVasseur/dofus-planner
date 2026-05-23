import type { Card, InvestableStat, StatInvestment } from '@/types/build';
import { INVESTABLE_STATS } from '@/types/build';

/** 5 stat points per level-up. At level 1 the player has 0 points; at level 200 they
 *  have 5 * 199 = 995 (per the user's spec). */
export function totalPointsBudget(level: number | null): number {
  if (level === null || level < 1) return 0;
  return 5 * (level - 1);
}

/** Point cost to bring vitalité from 0 to `stat`. 1 point per stat. */
function vitaliteCost(stat: number): number {
  return Math.max(0, Math.round(stat));
}

/** Point cost to bring sagesse from 0 to `stat`. 3 points per stat. */
function sagesseCost(stat: number): number {
  return Math.max(0, Math.round(stat)) * 3;
}

/** Tier-priced elementals: stats 1-100 cost 1pt each, 101-200 cost 2pt, 201-300 cost 3pt, ... */
function elementalCost(stat: number): number {
  const s = Math.max(0, Math.round(stat));
  if (s === 0) return 0;
  const fullTiers = Math.floor(s / 100);
  const remainder = s - fullTiers * 100;
  // Sum of full tiers: 100 * (1 + 2 + ... + fullTiers) = 100 * fullTiers * (fullTiers + 1) / 2
  let cost = 100 * fullTiers * (fullTiers + 1) / 2;
  // Partial tier — pricing one above the last fully-completed tier.
  cost += remainder * (fullTiers + 1);
  return cost;
}

export function statCost(stat: InvestableStat, value: number): number {
  if (stat === 'vitalite') return vitaliteCost(value);
  if (stat === 'sagesse') return sagesseCost(value);
  return elementalCost(value);
}

/** Inverse of statCost: returns the max stat value you can buy with `points`. Used by the
 *  "tout mettre" action to figure out how high you can push a single stat with whatever
 *  remains in the budget. */
export function maxStatForPoints(stat: InvestableStat, points: number): number {
  if (points <= 0) return 0;
  if (stat === 'vitalite') return Math.floor(points);
  if (stat === 'sagesse') return Math.floor(points / 3);
  // Elemental: greedily consume full tiers, then the partial tier.
  let remaining = points;
  let value = 0;
  let tier = 1;
  while (remaining > 0) {
    const costForThisTier = 100 * tier;
    if (remaining >= costForThisTier) {
      value += 100;
      remaining -= costForThisTier;
      tier++;
    } else {
      value += Math.floor(remaining / tier);
      break;
    }
  }
  return value;
}

/** Default investment used everywhere a card lacks an entry for a given stat. The
 *  scrolled default is TRUE so cards persisted before this feature display the same
 *  numbers they did when each stat silently inherited a +100 baseline. */
export const DEFAULT_INVESTMENT: StatInvestment = { invested: 0, scrolled: true };

export function getInvestment(card: Card, stat: InvestableStat): StatInvestment {
  return card.investments?.[stat] ?? DEFAULT_INVESTMENT;
}

export function getExo(card: Card): { pa: boolean; pm: boolean; po: boolean } {
  return card.exo ?? { pa: false, pm: false, po: false };
}

/** Total points the card currently spends on manual investment (sum across all stats). */
export function totalPointsUsed(card: Card): number {
  let used = 0;
  for (const stat of INVESTABLE_STATS) {
    used += statCost(stat, getInvestment(card, stat).invested);
  }
  return used;
}

export function remainingPoints(card: Card): number {
  return totalPointsBudget(card.level) - totalPointsUsed(card);
}
