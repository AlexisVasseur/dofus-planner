import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { populateCache } from '@/composables/useItemCatalog';
import type { Item } from '@/data/dofusdb';

// typeIds: coiffe 16, cape 17, amulette 1, anneau 9, ceinture 10, bottes 11,
// arme 2, bouclier 82.
function seed(id: number, typeId: number, level = 1): void {
  const item: Item = { id, name: `Item ${id}`, levelRequired: level, iconUrl: '', stats: [], typeId };
  populateCache([item]);
}

describe('build store — equipItemSet', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('equips each non-ring piece into its homologous slot', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(1, 16); seed(2, 17); seed(3, 1); seed(4, 10); seed(5, 11); seed(6, 2); seed(7, 82);
    s.equipItemSet(c.id, [1, 2, 3, 4, 5, 6, 7]);
    expect(c.slots.coiffe).toEqual({ itemId: 1 });
    expect(c.slots.cape).toEqual({ itemId: 2 });
    expect(c.slots.amulette).toEqual({ itemId: 3 });
    expect(c.slots.ceinture).toEqual({ itemId: 4 });
    expect(c.slots.bottes).toEqual({ itemId: 5 });
    expect(c.slots.arme).toEqual({ itemId: 6 });
    expect(c.slots.bouclier).toEqual({ itemId: 7 });
  });

  it('overwrites an already-occupied slot', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(99, 16); seed(1, 16);
    s.setSlot(c.id, 'coiffe', { itemId: 99 });
    s.equipItemSet(c.id, [1]);
    expect(c.slots.coiffe).toEqual({ itemId: 1 });
  });

  it('leaves slots not covered by the set untouched', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(50, 17); seed(1, 16);
    s.setSlot(c.id, 'cape', { itemId: 50 });
    s.equipItemSet(c.id, [1]); // only a coiffe
    expect(c.slots.coiffe).toEqual({ itemId: 1 });
    expect(c.slots.cape).toEqual({ itemId: 50 });
  });

  it('single ring → anneau1 when anneau1 is empty', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(10, 9);
    s.equipItemSet(c.id, [10]);
    expect(c.slots.anneau1).toEqual({ itemId: 10 });
    expect(c.slots.anneau2).toBeNull();
  });

  it('single ring → anneau2 when anneau1 occupied and anneau2 empty', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(88, 9); seed(10, 9);
    s.setSlot(c.id, 'anneau1', { itemId: 88 });
    s.equipItemSet(c.id, [10]);
    expect(c.slots.anneau1).toEqual({ itemId: 88 });
    expect(c.slots.anneau2).toEqual({ itemId: 10 });
  });

  it('single ring → overwrites anneau1 when both occupied', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(88, 9); seed(77, 9); seed(10, 9);
    s.setSlot(c.id, 'anneau1', { itemId: 88 });
    s.setSlot(c.id, 'anneau2', { itemId: 77 });
    s.equipItemSet(c.id, [10]);
    expect(c.slots.anneau1).toEqual({ itemId: 10 });
    expect(c.slots.anneau2).toEqual({ itemId: 77 });
  });

  it('two rings → anneau1 + anneau2 in order', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(10, 9); seed(11, 9);
    s.equipItemSet(c.id, [10, 11]);
    expect(c.slots.anneau1).toEqual({ itemId: 10 });
    expect(c.slots.anneau2).toEqual({ itemId: 11 });
  });

  it('ignores a piece whose typeId maps to no equipment slot', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(23, 23); // 23 = Dofus typeId, no equipment slot
    expect(() => s.equipItemSet(c.id, [23])).not.toThrow();
    expect(c.slots.coiffe).toBeNull();
  });

  it('skips an item missing from the cache', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    s.equipItemSet(c.id, [9999]); // never seeded
    expect(c.slots.coiffe).toBeNull();
  });

  it('throws on an unknown cardId', () => {
    const s = useBuildStore();
    seed(1, 16);
    expect(() => s.equipItemSet('nope', [1])).toThrow(/Card not found/);
  });

  it('three rings → only the first two are placed, extras dropped', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    seed(10, 9); seed(11, 9); seed(12, 9);
    s.equipItemSet(c.id, [10, 11, 12]);
    expect(c.slots.anneau1).toEqual({ itemId: 10 });
    expect(c.slots.anneau2).toEqual({ itemId: 11 });
  });
});
