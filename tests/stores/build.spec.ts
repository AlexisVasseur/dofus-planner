import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';

describe('build store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with one Lv 1 card, classId null, all slots empty', () => {
    const s = useBuildStore();
    expect(s.cards).toHaveLength(1);
    const c = s.cards[0];
    expect(c.id).toBeTypeOf('string');
    expect(c.classId).toBeNull();
    expect(c.level).toBe(1);
    expect(c.title).toBeNull();
    for (const slot of SLOT_ORDER) {
      expect(c.slots[slot]).toBeNull();
    }
    expect(c.dofus).toHaveLength(DOFUS_COUNT);
    expect(c.dofus.every((d) => d === null)).toBe(true);
  });

  it('addEmptyCardAfter inherits classId from previous, slots empty, level null', () => {
    const s = useBuildStore();
    s.setClass(s.cards[0].id, 'iop');
    s.addEmptyCardAfter(s.cards[0].id);
    expect(s.cards).toHaveLength(2);
    const next = s.cards[1];
    expect(next.classId).toBe('iop');
    expect(next.level).toBeNull();
    expect(next.title).toBeNull();
    expect(SLOT_ORDER.every((slot) => next.slots[slot] === null)).toBe(true);
  });

  it('addCopyCardAfter clones class, slots, dofus, title and bumps level by 1', () => {
    const s = useBuildStore();
    const first = s.cards[0];
    s.setClass(first.id, 'cra');
    s.setLevel(first.id, 12);
    s.setTitle(first.id, 'Premiers donjons');
    s.setSlot(first.id, 'coiffe', { itemId: 42 });
    s.setDofus(first.id, 0, { itemId: 99 });

    s.addCopyCardAfter(first.id);
    const copy = s.cards[1];
    expect(copy.classId).toBe('cra');
    expect(copy.level).toBe(13);
    expect(copy.title).toBe('Premiers donjons');
    expect(copy.slots.coiffe).toEqual({ itemId: 42 });
    expect(copy.dofus[0]).toEqual({ itemId: 99 });
    expect(copy.id).not.toBe(first.id);
  });

  it('addCopyCardAfter when previous level is null yields null level on copy', () => {
    const s = useBuildStore();
    s.setLevel(s.cards[0].id, null);
    s.addCopyCardAfter(s.cards[0].id);
    expect(s.cards[1].level).toBeNull();
  });

  it('insertion respects the cardId anchor (insert in middle)', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id); // -> A, B
    const b = s.cards[1];
    s.addEmptyCardAfter(a.id); // insert C between A and B -> A, C, B
    expect(s.cards.map((c) => c.id)).toEqual([a.id, s.cards[1].id, b.id]);
  });

  it('removeCard splices but keeps at least one card by re-initializing', () => {
    const s = useBuildStore();
    s.addEmptyCardAfter(s.cards[0].id);
    expect(s.cards).toHaveLength(2);
    const last = s.cards[1].id;
    s.removeCard(last);
    expect(s.cards).toHaveLength(1);

    const onlyId = s.cards[0].id;
    s.removeCard(onlyId);
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].id).not.toBe(onlyId);
    expect(s.cards[0].level).toBe(1);
    expect(s.cards[0].classId).toBeNull();
  });

  it('setSlot and clearSlot work', () => {
    const s = useBuildStore();
    const id = s.cards[0].id;
    s.setSlot(id, 'amulette', { itemId: 7 });
    expect(s.cards[0].slots.amulette).toEqual({ itemId: 7 });
    s.setSlot(id, 'amulette', null);
    expect(s.cards[0].slots.amulette).toBeNull();
  });

  it('setDofus respects index bounds', () => {
    const s = useBuildStore();
    const id = s.cards[0].id;
    s.setDofus(id, 3, { itemId: 5 });
    expect(s.cards[0].dofus[3]).toEqual({ itemId: 5 });
    expect(() => s.setDofus(id, -1, { itemId: 5 })).toThrow();
    expect(() => s.setDofus(id, DOFUS_COUNT, { itemId: 5 })).toThrow();
  });

  it('resetBuild restores a single Lv 1 unset card', () => {
    const s = useBuildStore();
    s.setClass(s.cards[0].id, 'iop');
    s.addCopyCardAfter(s.cards[0].id);
    s.resetBuild();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].classId).toBeNull();
    expect(s.cards[0].level).toBe(1);
  });

  it('replaceCards replaces the whole array (used by persistence load)', () => {
    const s = useBuildStore();
    s.replaceCards([
      {
        id: 'fixed-1',
        classId: 'iop',
        level: 50,
        title: null,
        slots: Object.fromEntries(SLOT_ORDER.map((s) => [s, null])) as never,
        dofus: [null, null, null, null, null, null],
      },
    ]);
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].id).toBe('fixed-1');
    expect(s.cards[0].level).toBe(50);
  });
});
