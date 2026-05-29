import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { INVESTABLE_STATS } from '@/types/build';
import { getInvestment, getExo } from '@/utils/statCost';

describe('build store — new cards inherit active global options', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('addEmptyCardAfter: inherits exo when all existing cards have it', () => {
    const s = useBuildStore();
    s.applyExoAll('pa', true);
    s.addEmptyCardAfter(s.cards[0].id);
    expect(getExo(s.cards[1]).pa).toBe(true);
  });

  it('addEmptyCardAfter: no exo when global is off', () => {
    const s = useBuildStore();
    s.addEmptyCardAfter(s.cards[0].id);
    expect(getExo(s.cards[1])).toEqual({ pa: false, pm: false, po: false });
  });

  it('addEmptyCardAfter: scrolled when Parcho globally on', () => {
    const s = useBuildStore();
    s.applyScrollAll(true);
    s.addEmptyCardAfter(s.cards[0].id);
    const nc = s.cards[1];
    expect(INVESTABLE_STATS.every((st) => getInvestment(nc, st).scrolled)).toBe(true);
  });

  it('addEmptyCardAfter: unscrolled when Parcho globally off', () => {
    const s = useBuildStore();
    s.applyScrollAll(false);
    s.addEmptyCardAfter(s.cards[0].id);
    const nc = s.cards[1];
    expect(INVESTABLE_STATS.every((st) => getInvestment(nc, st).scrolled)).toBe(false);
  });

  it('addEmptyCardAfter: mixed exo (not all) → new card does not inherit that key', () => {
    const s = useBuildStore();
    s.applyExoAll('pa', true);
    s.addEmptyCardAfter(s.cards[0].id);       // c1 inherits pa=true
    s.setCardExo(s.cards[1].id, 'pa', false); // now not all have pa
    s.addEmptyCardAfter(s.cards[1].id);       // c2 should NOT inherit pa
    expect(getExo(s.cards[2]).pa).toBe(false);
  });

  it('addCopyCardAfter: copy inherits global exo', () => {
    const s = useBuildStore();
    s.applyExoAll('pm', true);
    s.addCopyCardAfter(s.cards[0].id);
    expect(getExo(s.cards[1]).pm).toBe(true);
  });

  it('does not wipe an existing card\'s invested amounts when a later card is added', () => {
    const s = useBuildStore();
    s.applyScrollAll(true);
    s.addEmptyCardAfter(s.cards[0].id);
    s.setStatInvested(s.cards[1].id, 'force', 50);
    s.addEmptyCardAfter(s.cards[1].id);
    expect(getInvestment(s.cards[1], 'force').invested).toBe(50);
    expect(getInvestment(s.cards[2], 'force').invested).toBe(0);
  });
});
