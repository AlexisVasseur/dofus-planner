import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { useShoppingList } from '@/composables/useShoppingList';
import { populateCache } from '@/composables/useItemCatalog';
import { TYPE_ID_DOFUS, TYPE_ID_TROPHEE } from '@/types/rooms';
import type { Item } from '@/data/dofusdb';
import type { Card } from '@/types/build';
import { SLOT_ORDER } from '@/types/slots';

function blankSlots(): Card['slots'] {
  return Object.fromEntries(SLOT_ORDER.map((s) => [s, null])) as Card['slots'];
}

function blankDofus(): Card['dofus'] {
  return [null, null, null, null, null, null];
}

function makeCard(level: number | null, partial: { slots?: Partial<Card['slots']>; dofus?: Card['dofus'] } = {}): Card {
  return {
    id: `card-${Math.random().toString(36).slice(2, 10)}`,
    classId: 'iop',
    level,
    title: null,
    slots: { ...blankSlots(), ...(partial.slots ?? {}) } as Card['slots'],
    dofus: partial.dofus ?? blankDofus(),
  };
}

function seedItem(id: number, opts: { name?: string; level?: number; typeId?: number } = {}): Item {
  const item: Item = {
    id,
    name: opts.name ?? `Item ${id}`,
    levelRequired: opts.level ?? 1,
    iconUrl: '',
    stats: [],
    typeId: opts.typeId ?? 16, // 16 = coiffe by default
  };
  populateCache([item]);
  return item;
}

describe('useShoppingList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('empty timeline → empty rooms and zero totals', () => {
    const s = useBuildStore();
    s.replaceCards([makeCard(null)]); // one null-level card → ignored
    const list = useShoppingList().value;
    for (const room of ['1-50', '51-100', '101-150', '151-199', '200'] as const) {
      expect(list.rooms[room]).toEqual({});
      expect(list.totals.perRoom[room]).toBe(0);
    }
    expect(list.totals.items).toBe(0);
    expect(list.totals.activeRooms).toBe(0);
  });

  it('single Lv 1 card with three filled slots → bucketed in 1-50 under right NPCs', () => {
    seedItem(101, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    seedItem(102, { name: 'Cape Bouftou', level: 1, typeId: 17 });
    seedItem(103, { name: 'Anneau du Bouftou', level: 1, typeId: 9 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, {
        slots: { coiffe: { itemId: 101 }, cape: { itemId: 102 }, anneau1: { itemId: 103 } },
      }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].coiffe?.map((i) => i.id)).toEqual([101]);
    expect(list.rooms['1-50'].cape?.map((i) => i.id)).toEqual([102]);
    expect(list.rooms['1-50'].anneau?.map((i) => i.id)).toEqual([103]);
    expect(list.totals.perRoom['1-50']).toBe(3);
    expect(list.totals.items).toBe(3);
    expect(list.totals.activeRooms).toBe(1);
  });

  it('item kept across multiple cards → listed once in the first cards room', () => {
    seedItem(201, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(35, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(80, { slots: { coiffe: { itemId: 201 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].coiffe?.map((i) => i.id)).toEqual([201]);
    expect(list.rooms['51-100'].coiffe).toBeUndefined();
    expect(list.totals.items).toBe(1);
  });

  it('trophée first appearing on a Lv 30 card → bumped to 51-100 (no trophée NPC in 1-50)', () => {
    seedItem(301, { name: 'Trophée Vitalité', level: 30, typeId: TYPE_ID_TROPHEE });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(30, { dofus: [{ itemId: 301 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].trophee).toBeUndefined();
    expect(list.rooms['51-100'].trophee?.map((i) => i.id)).toEqual([301]);
    expect(list.totals.perRoom['51-100']).toBe(1);
  });

  it('dofus first appearing on a Lv 12 card → forced into room 200', () => {
    seedItem(401, { name: 'Pou Voli', level: 60, typeId: TYPE_ID_DOFUS });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(12, { dofus: [{ itemId: 401 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].dofus).toBeUndefined();
    expect(list.rooms['200'].dofus?.map((i) => i.id)).toEqual([401]);
  });

  it('same item used as anneau1 AND anneau2 of the same card → listed once under "anneau"', () => {
    seedItem(501, { name: 'Anneau Bouftou', level: 1, typeId: 9 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, {
        slots: { anneau1: { itemId: 501 }, anneau2: { itemId: 501 } },
      }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].anneau?.map((i) => i.id)).toEqual([501]);
    expect(list.totals.items).toBe(1);
  });

  it('items in a room are sorted by levelRequired ascending', () => {
    seedItem(601, { name: 'Coiffe A', level: 35, typeId: 16 });
    seedItem(602, { name: 'Coiffe B', level: 5, typeId: 16 });
    seedItem(603, { name: 'Coiffe C', level: 20, typeId: 16 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { coiffe: { itemId: 601 } } }),
      makeCard(12, { slots: { coiffe: { itemId: 602 } } }),
      makeCard(35, { slots: { coiffe: { itemId: 603 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50'].coiffe?.map((i) => i.id)).toEqual([602, 603, 601]);
  });
});
