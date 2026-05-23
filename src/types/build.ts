import type { ClassId } from './classes';
import type { SlotType } from './slots';

export interface ItemRef {
  itemId: number;
}

/** The six stats the player can manually invest characteristic points in.
 *  Puissance / PA / PM / PO are excluded — they come from level and gear only. */
export type InvestableStat = 'vitalite' | 'sagesse' | 'force' | 'agilite' | 'intelligence' | 'chance';

export const INVESTABLE_STATS: readonly InvestableStat[] = [
  'vitalite', 'sagesse', 'force', 'agilite', 'intelligence', 'chance',
] as const;

export interface StatInvestment {
  /** Number of stat points manually invested (the stat VALUE, not the points cost).
   *  Cost is derived via utils/statCost. */
  invested: number;
  /** "100 parchemins" applied — adds +100 stat with no point-budget cost. */
  scrolled: boolean;
}

/** Exotic +1 PA / +1 PM / +1 PO obtainable via forgemagie. Each flag adds 1 to the
 *  corresponding action stat on top of items + level base. Stored per-card so the
 *  player can toggle them individually or via the bulk "Exo PA partout" actions. */
export interface CardExo {
  pa: boolean;
  pm: boolean;
  po: boolean;
}

export interface Card {
  id: string;
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  slots: Record<SlotType, ItemRef | null>;
  dofus: [
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
    ItemRef | null,
  ];
  /** Per-stat manual investment + scroll flag. Optional for backwards-compat with
   *  cards persisted before this feature. Missing entries default to invested=0 and
   *  scrolled=true (mirrors the pre-feature baseline where every stat had +100). */
  investments?: Partial<Record<InvestableStat, StatInvestment>>;
  /** Exo PA / PM / PO flags. Optional — missing reads as all false. */
  exo?: CardExo;
}

export interface Build {
  version: 1;
  cards: Card[];
}
