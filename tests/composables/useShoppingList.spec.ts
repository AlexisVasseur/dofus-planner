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
    for (const room of ['1-49', '50-99', '100-149', '150-199', '200'] as const) {
      expect(list.rooms[room]).toEqual({});
      expect(list.totals.perRoom[room]).toBe(0);
    }
    expect(list.totals.items).toBe(0);
    expect(list.totals.activeRooms).toBe(0);
  });

  it('single Lv 1 card with three filled slots → bucketed in 1-49 under right NPCs', () => {
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
    expect(list.rooms['1-49'].coiffe?.map((i) => i.id)).toEqual([101]);
    expect(list.rooms['1-49'].cape?.map((i) => i.id)).toEqual([102]);
    expect(list.rooms['1-49'].anneau?.map((i) => i.id)).toEqual([103]);
    expect(list.totals.perRoom['1-49']).toBe(3);
    expect(list.totals.items).toBe(3);
    expect(list.totals.activeRooms).toBe(1);
  });

  it('item kept across multiple cards → listed once in the room matching its own level', () => {
    seedItem(201, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(35, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(80, { slots: { coiffe: { itemId: 201 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].coiffe?.map((i) => i.id)).toEqual([201]);
    expect(list.rooms['50-99'].coiffe).toBeUndefined();
    expect(list.totals.items).toBe(1);
  });

  it('trophée with levelRequired 30 → bumped to 50-99 (no trophée NPC in 1-49)', () => {
    seedItem(301, { name: 'Trophée Vitalité', level: 30, typeId: TYPE_ID_TROPHEE });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(30, { dofus: [{ itemId: 301 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].trophee).toBeUndefined();
    expect(list.rooms['50-99'].trophee?.map((i) => i.id)).toEqual([301]);
    expect(list.totals.perRoom['50-99']).toBe(1);
  });

  it('dofus first appearing on a Lv 12 card → forced into room 200', () => {
    seedItem(401, { name: 'Pou Voli', level: 60, typeId: TYPE_ID_DOFUS });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(12, { dofus: [{ itemId: 401 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].dofus).toBeUndefined();
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
    expect(list.rooms['1-49'].anneau?.map((i) => i.id)).toEqual([501]);
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
    expect(list.rooms['1-49'].coiffe?.map((i) => i.id)).toEqual([602, 603, 601]);
  });

  // Hub routing: familier slot items live in the Hub regardless of card level,
  // and are split into 'familier' vs 'monture' columns based on the item typeId.
  describe('Hub routing', () => {
    it('Familier (typeId 18) → Hub > familier (not the level-based room)', () => {
      seedItem(1001, { name: 'Bouftou Royal', level: 30, typeId: 18 });
      const s = useBuildStore();
      s.replaceCards([
        makeCard(50, { slots: { familier: { itemId: 1001 } } }),
      ]);
      const list = useShoppingList().value;
      expect(list.rooms['hub'].familier?.map((i) => i.id)).toEqual([1001]);
      expect(list.rooms['1-49'].familier).toBeUndefined();
      expect(list.rooms['50-99'].familier).toBeUndefined();
    });

    it('Montilier (typeId 121) → Hub > familier', () => {
      seedItem(1002, { name: 'Bilby', level: 60, typeId: 121 });
      const s = useBuildStore();
      s.replaceCards([makeCard(80, { slots: { familier: { itemId: 1002 } } })]);
      const list = useShoppingList().value;
      expect(list.rooms['hub'].familier?.map((i) => i.id)).toEqual([1002]);
    });

    it('Dragodinde (typeId 97) → Hub > monture', () => {
      seedItem(1003, { name: 'Dragodinde Orchidée', level: 100, typeId: 97 });
      const s = useBuildStore();
      s.replaceCards([makeCard(120, { slots: { familier: { itemId: 1003 } } })]);
      const list = useShoppingList().value;
      expect(list.rooms['hub'].monture?.map((i) => i.id)).toEqual([1003]);
      expect(list.rooms['hub'].familier).toBeUndefined();
    });

    it('Muldo (196) and Volkorne (207) also route to Hub > monture', () => {
      seedItem(1004, { name: 'Muldo', level: 100, typeId: 196 });
      seedItem(1005, { name: 'Volkorne', level: 200, typeId: 207 });
      const s = useBuildStore();
      s.replaceCards([
        makeCard(150, { slots: { familier: { itemId: 1004 } } }),
        makeCard(200, { slots: { familier: { itemId: 1005 } } }),
      ]);
      const list = useShoppingList().value;
      expect(list.rooms['hub'].monture?.map((i) => i.id).sort()).toEqual([1004, 1005]);
    });
  });

  // Quantity counting: max occurrences in any single card across slots + dofus.
  it('item used twice on the same card (e.g. Silimelle anneau1 + anneau2) → count = 2', () => {
    seedItem(901, { name: 'Silimelle', level: 1, typeId: 9 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, {
        slots: { anneau1: { itemId: 901 }, anneau2: { itemId: 901 } },
      }),
    ]);
    const list = useShoppingList().value;
    expect(list.counts[901]).toBe(2);
  });

  it('same item once on card A and once on card B → count = 1 (re-used across checkpoints)', () => {
    seedItem(902, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { coiffe: { itemId: 902 } } }),
      makeCard(20, { slots: { coiffe: { itemId: 902 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.counts[902]).toBe(1);
  });

  it('max-across-cards: 2 on card A and 1 on card B → count = 2', () => {
    seedItem(903, { name: 'Silimelle', level: 1, typeId: 9 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { anneau1: { itemId: 903 }, anneau2: { itemId: 903 } } }),
      makeCard(20, { slots: { anneau1: { itemId: 903 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.counts[903]).toBe(2);
  });

  it('dofus repeated twice on the same card → count = 2', () => {
    seedItem(904, { name: 'Pou Voli', level: 1, typeId: TYPE_ID_DOFUS });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { dofus: [{ itemId: 904 }, { itemId: 904 }, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.counts[904]).toBe(2);
  });

  // Bug regression: items are bucketed by their OWN levelRequired, never by the card level.
  it('item levelRequired drives the room, not the card level', () => {
    seedItem(701, { name: 'Coiffe haute', level: 60, typeId: 16 }); // → 50-99
    seedItem(702, { name: 'Cape moyenne', level: 120, typeId: 17 }); // → 100-149
    seedItem(703, { name: 'Amu top', level: 180, typeId: 1 }); // → 150-199
    const s = useBuildStore();
    s.replaceCards([
      // Card at level 1 but holding mid/high level items — items must go to their own rooms.
      makeCard(1, {
        slots: {
          coiffe: { itemId: 701 },
          cape: { itemId: 702 },
          amulette: { itemId: 703 },
        },
      }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].coiffe).toBeUndefined();
    expect(list.rooms['50-99'].coiffe?.map((i) => i.id)).toEqual([701]);
    expect(list.rooms['100-149'].cape?.map((i) => i.id)).toEqual([702]);
    expect(list.rooms['150-199'].amulette?.map((i) => i.id)).toEqual([703]);
  });

  // Bug regression: boundaries are 50/100/150/200 (so level 50 lives in 50-99, not 1-49).
  it('room boundaries: 49→1-49, 50→50-99, 99→50-99, 100→100-149, 149→100-149, 150→150-199, 199→150-199, 200→200', () => {
    seedItem(801, { level: 49, typeId: 16 });
    seedItem(802, { level: 50, typeId: 17 });
    seedItem(803, { level: 99, typeId: 1 }); // amulette
    seedItem(804, { level: 100, typeId: 9 }); // anneau
    seedItem(805, { level: 149, typeId: 11 }); // ceinture
    seedItem(806, { level: 150, typeId: 19 }); // bottes
    seedItem(807, { level: 199, typeId: 2 }); // arme
    seedItem(808, { level: 200, typeId: 82 }); // bouclier
    const s = useBuildStore();
    s.replaceCards([
      makeCard(200, {
        slots: {
          coiffe: { itemId: 801 },
          cape: { itemId: 802 },
          amulette: { itemId: 803 },
          anneau1: { itemId: 804 },
          ceinture: { itemId: 805 },
          bottes: { itemId: 806 },
          arme: { itemId: 807 },
          bouclier: { itemId: 808 },
        },
      }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].coiffe?.map((i) => i.id)).toEqual([801]);
    expect(list.rooms['50-99'].cape?.map((i) => i.id)).toEqual([802]);
    expect(list.rooms['50-99'].amulette?.map((i) => i.id)).toEqual([803]);
    expect(list.rooms['100-149'].anneau?.map((i) => i.id)).toEqual([804]);
    expect(list.rooms['100-149'].ceinture?.map((i) => i.id)).toEqual([805]);
    expect(list.rooms['150-199'].bottes?.map((i) => i.id)).toEqual([806]);
    expect(list.rooms['150-199'].arme?.map((i) => i.id)).toEqual([807]);
    expect(list.rooms['200'].bouclier?.map((i) => i.id)).toEqual([808]);
  });
});
