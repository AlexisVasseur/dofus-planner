# Purchase planner — V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V2 "Purchase planner" — a 3rd top-level mode (`Build | Switch | Achats`) that derives a per-room, per-NPC shopping list from the existing build timeline and lets the user copy each item name to the clipboard.

**Architecture:** Pure-function bucketing in a new `useShoppingList` composable computed from `useBuildStore` + `useItemCatalog`'s cache. New components `ItemRow`, `NpcCard`, `AppPurchasePlanner` rendered conditionally in `App.vue` when `viewMode === 'purchase'`. Domain types and event configuration (`RoomId`, `NpcId`, `ROOM_NPCS`, `slotToNpc`, `levelToRoom`) centralized in `src/types/rooms.ts`. NPC icons resolved via a small `src/data/npc-icons.ts` map that reuses existing slot SVGs for equipment NPCs and adds two bespoke entries for trophée + dofus.

**Tech Stack:** Vue 3.5, Vite 6, TypeScript 5, Pinia 2, Tailwind 3, VueUse 11, Vitest 2, @vue/test-utils 2.4. No new deps. Authoritative spec: `docs/superpowers/specs/2026-05-04-purchase-planner-design.md`. As-built reference for V1: `docs/v1-as-built.md`.

---

## File map

```
src/
├── types/
│   └── rooms.ts                      NEW    Room/Npc domain types + helpers
├── data/
│   ├── dofusdb.ts                    MODIFY add `typeId` to Item, populate in mapItem
│   └── npc-icons.ts                  NEW    NPC_ICON_SVG + getNpcIconSvg
├── stores/
│   └── ui.ts                         MODIFY widen ViewMode to add 'purchase'
├── composables/
│   └── useShoppingList.ts            NEW    bucketing computed + ShoppingList type
├── components/
│   ├── AppTopBar.vue                 MODIFY add Achats button to mode toggle
│   ├── ItemRow.vue                   NEW    item line + copy-to-clipboard
│   ├── NpcCard.vue                   NEW    NPC header + ItemRow list
│   └── AppPurchasePlanner.vue        NEW    screen: header strip + room tabs + grid
└── App.vue                           MODIFY conditional render planner vs timeline+minimap

tests/
├── data/
│   └── dofusdb.spec.ts               MODIFY existing test: expected Item shape now includes typeId
├── composables/
│   └── useShoppingList.spec.ts       NEW    7 tests on bucketing
└── components/
    └── ItemRow.spec.ts               NEW    copy interaction test
```

---

## Task 1 — Domain types + Item.typeId

The shopping-list logic and NPC icons both depend on the `RoomId` / `NpcId` types. The bucketing logic also needs `item.typeId` (currently dropped by `mapItem`). Land both in one task.

**Files:**
- Create: `src/types/rooms.ts`
- Modify: `src/data/dofusdb.ts`
- Modify: `tests/data/dofusdb.spec.ts`

- [ ] **Step 1: Create `src/types/rooms.ts`**

```ts
import type { SlotType } from './slots';

export type RoomId = '1-50' | '51-100' | '101-150' | '151-199' | '200';

export const ROOM_ORDER: readonly RoomId[] = [
  '1-50', '51-100', '101-150', '151-199', '200',
] as const;

export type NpcId =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau'
  | 'ceinture' | 'bottes' | 'arme' | 'bouclier' | 'familier'
  | 'trophee' | 'dofus';

export const NPC_ORDER: readonly NpcId[] = [
  'coiffe', 'cape', 'amulette', 'anneau',
  'ceinture', 'bottes', 'arme', 'bouclier', 'familier',
  'trophee', 'dofus',
] as const;

export const NPC_LABEL: Record<NpcId, string> = {
  coiffe: 'Coiffe',
  cape: 'Cape',
  amulette: 'Amulette',
  anneau: 'Anneau',
  ceinture: 'Ceinture',
  bottes: 'Bottes',
  arme: 'Arme',
  bouclier: 'Bouclier',
  familier: 'Familier',
  trophee: 'Trophée',
  dofus: 'Dofus / Prysm.',
};

// Which NPCs are available in each room (event configuration).
export const ROOM_NPCS: Record<RoomId, readonly NpcId[]> = {
  '1-50':    ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier'],
  '51-100':  ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '101-150': ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '151-199': ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'trophee'],
  '200':     ['coiffe', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier', 'dofus'],
};

// DofusDB typeIds for dofus/trophée disambiguation in the dofus[] array.
export const TYPE_ID_DOFUS = 23;
export const TYPE_ID_TROPHEE = 151;

/** Map a SlotType to its NPC. anneau1/anneau2 collapse to 'anneau'; others map 1:1. */
export function slotToNpc(slot: SlotType): NpcId {
  if (slot === 'anneau1' || slot === 'anneau2') return 'anneau';
  return slot as NpcId;
}

/** Map a card level to its candidate room (before exception bumps). */
export function levelToRoom(level: number): RoomId {
  if (level >= 200) return '200';
  if (level >= 151) return '151-199';
  if (level >= 101) return '101-150';
  if (level >= 51) return '51-100';
  return '1-50';
}
```

- [ ] **Step 2: Modify `src/data/dofusdb.ts` — Item gains `typeId`**

Find the `Item` interface and replace it:

```ts
export interface Item {
  id: number;
  name: string;
  levelRequired: number;
  iconUrl: string;
  stats: string[];
  typeId: number;
}
```

Find `mapItem` and update the returned object to include `typeId`:

```ts
function mapItem(raw: RawItem): Item {
  const stats = (raw.effects ?? [])
    .map((e) => e.description?.fr ?? '')
    .filter((s) => s.length > 0);
  return {
    id: raw.id,
    name: raw.name?.fr ?? raw.name?.en ?? `Item ${raw.id}`,
    levelRequired: raw.level ?? 0,
    iconUrl: raw.img ?? raw.imgUrl ?? '',
    stats,
    typeId: raw.typeId ?? 0,
  };
}
```

- [ ] **Step 3: Modify `tests/data/dofusdb.spec.ts` — expected Item shape**

Find the first test (`fetchItemsBySlot maps the response to a normalized Item shape`). Update the `expect(items[0]).toEqual({ ... })` assertion to include `typeId: 16` (the mock's typeId):

```ts
expect(items[0]).toEqual({
  id: 1234,
  name: 'Coiffe Bouftou',
  levelRequired: 25,
  iconUrl: 'https://api.dofusdb.fr/img/items/1234.png',
  stats: ['+10 Vitalité', '+5 Force'],
  typeId: 16,
});
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npm run typecheck
npx vitest run tests/data/dofusdb.spec.ts
npm run test:run
```

Expected: typecheck exit 0; the dofusdb spec passes 6/6; full suite still 30/30 (the new field flows through but no other test asserts on `Item` shape directly).

- [ ] **Step 5: Commit**

```bash
git add src/types/rooms.ts src/data/dofusdb.ts tests/data/dofusdb.spec.ts
git commit -m "feat(types): rooms/npcs domain + Item.typeId for shopping bucketing"
```

---

## Task 2 — NPC icons

A small lookup module that returns an SVG fragment per `NpcId`. Reuses existing slot glyphs, adds two new ones for `trophee` + `dofus`.

**Files:**
- Create: `src/data/npc-icons.ts`

- [ ] **Step 1: Create `src/data/npc-icons.ts`**

```ts
import type { NpcId } from '@/types/rooms';
import { SLOT_ICON_SVG } from './slot-icons';

// Each SVG renders inside a 24×24 viewBox, currentColor-driven (same convention as slot-icons.ts).
export const NPC_ICON_SVG: Record<NpcId, string> = {
  coiffe: SLOT_ICON_SVG.coiffe,
  cape: SLOT_ICON_SVG.cape,
  amulette: SLOT_ICON_SVG.amulette,
  anneau: SLOT_ICON_SVG.anneau1, // either anneau1 or anneau2 — they share the same circle glyph
  ceinture: SLOT_ICON_SVG.ceinture,
  bottes: SLOT_ICON_SVG.bottes,
  arme: SLOT_ICON_SVG.arme,
  bouclier: SLOT_ICON_SVG.bouclier,
  familier: SLOT_ICON_SVG.familier,
  // Bespoke entries for the two NPCs that don't correspond to a slot type.
  trophee: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M8 5 L16 5 L16 11 Q16 14 12 14 Q8 14 8 11 Z M5 5 L8 5 M16 5 L19 5 M5 5 Q5 9 8 10 M19 5 Q19 9 16 10 M12 14 L12 17 M9 19 L15 19 L13 17 L11 17 Z"/>`,
  dofus: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 4 L20 12 L12 20 L4 12 Z"/>`,
};

export function getNpcIconSvg(npc: NpcId): string {
  return NPC_ICON_SVG[npc];
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/data/npc-icons.ts
git commit -m "feat(data): NPC icon map (reuse slot glyphs + bespoke trophée/dofus)"
```

---

## Task 3 — Widen ViewMode + Achats toggle button

Make `viewMode` accept `'purchase'`, then add the third button to the segmented control in `AppTopBar`.

**Files:**
- Modify: `src/stores/ui.ts`
- Modify: `src/components/AppTopBar.vue`

- [ ] **Step 1: Modify `src/stores/ui.ts` — widen ViewMode**

Find the type and update:

```ts
export type ViewMode = 'build' | 'switch' | 'purchase';
```

The store body and `setViewMode` accept the wider type without further changes.

- [ ] **Step 2: Modify `src/components/AppTopBar.vue` — add Achats button**

Find the `<div class="mode-toggle ...">` block. Add a third button immediately after the `Switch` button. The full block becomes:

```vue
<div class="mode-toggle flex bg-bg-page border border-border-default rounded-md p-0.5 mr-1">
  <button
    type="button"
    class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
    :class="ui.viewMode === 'build' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
    @click="ui.setViewMode('build')"
    aria-label="Mode Build (équipement complet)"
  >Build</button>
  <button
    type="button"
    class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
    :class="ui.viewMode === 'switch' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
    @click="ui.setViewMode('switch')"
    aria-label="Mode Switch (uniquement les changements)"
  >Switch</button>
  <button
    type="button"
    class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
    :class="ui.viewMode === 'purchase' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
    @click="ui.setViewMode('purchase')"
    aria-label="Mode Achats (planificateur d'achat)"
  >Achats</button>
</div>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. (No template error because `ui.setViewMode('purchase')` is now a valid `ViewMode` argument.)

- [ ] **Step 4: Verify the toggle renders**

The Achats button doesn't *do* anything yet (App.vue doesn't switch on `'purchase'` until Task 8). For now, clicking it just sets the active mint state on the button. That's fine.

```bash
npm run dev > ./vite-dev.log 2>&1 &
PID=$!
sleep 4
cat ./vite-dev.log
kill $PID 2>/dev/null
wait $PID 2>/dev/null
rm -f ./vite-dev.log
```

Expected: dev server starts cleanly; no Vue compile errors on the topbar template.

- [ ] **Step 5: Commit**

```bash
git add src/stores/ui.ts src/components/AppTopBar.vue
git commit -m "feat(ui): widen viewMode to add 'purchase' + Achats toggle button"
```

---

## Task 4 — useShoppingList composable (TDD)

The bucketing engine. 7 tests covering the spec's bucketing rules.

**Files:**
- Test: `tests/composables/useShoppingList.spec.ts`
- Create: `src/composables/useShoppingList.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/composables/useShoppingList.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { useShoppingList } from '@/composables/useShoppingList';
import { populateCache } from '@/composables/useItemCatalog';
import { TYPE_ID_DOFUS, TYPE_ID_TROPHEE } from '@/types/rooms';
import type { Item } from '@/data/dofusdb';
import type { Card } from '@/types/build';
import { SLOT_ORDER, type SlotType } from '@/types/slots';

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
    // Re-import isn't needed: populateCache writes to the live module-level cache ref.
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
    expect(list.rooms['1-50']?.coiffe?.map((i) => i.id)).toEqual([101]);
    expect(list.rooms['1-50']?.cape?.map((i) => i.id)).toEqual([102]);
    expect(list.rooms['1-50']?.anneau?.map((i) => i.id)).toEqual([103]);
    expect(list.totals.perRoom['1-50']).toBe(3);
    expect(list.totals.items).toBe(3);
    expect(list.totals.activeRooms).toBe(1);
  });

  it('item kept across multiple cards → listed once in the first card`s room', () => {
    seedItem(201, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(1, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(35, { slots: { coiffe: { itemId: 201 } } }),
      makeCard(80, { slots: { coiffe: { itemId: 201 } } }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50']?.coiffe?.map((i) => i.id)).toEqual([201]);
    expect(list.rooms['51-100']?.coiffe).toBeUndefined();
    expect(list.totals.items).toBe(1);
  });

  it('trophée first appearing on a Lv 30 card → bumped to 51-100 (no trophée NPC in 1-50)', () => {
    seedItem(301, { name: 'Trophée Vitalité', level: 30, typeId: TYPE_ID_TROPHEE });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(30, { dofus: [{ itemId: 301 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50']?.trophee).toBeUndefined();
    expect(list.rooms['51-100']?.trophee?.map((i) => i.id)).toEqual([301]);
    expect(list.totals.perRoom['51-100']).toBe(1);
  });

  it('dofus first appearing on a Lv 12 card → forced into room 200', () => {
    seedItem(401, { name: 'Pou Voli', level: 60, typeId: TYPE_ID_DOFUS });
    const s = useBuildStore();
    s.replaceCards([
      makeCard(12, { dofus: [{ itemId: 401 }, null, null, null, null, null] }),
    ]);
    const list = useShoppingList().value;
    expect(list.rooms['1-50']?.dofus).toBeUndefined();
    expect(list.rooms['200']?.dofus?.map((i) => i.id)).toEqual([401]);
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
    expect(list.rooms['1-50']?.anneau?.map((i) => i.id)).toEqual([501]);
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
    expect(list.rooms['1-50']?.coiffe?.map((i) => i.id)).toEqual([602, 603, 601]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/composables/useShoppingList.spec.ts
```

Expected: FAIL — `Cannot find module '@/composables/useShoppingList'`.

- [ ] **Step 3: Implement `src/composables/useShoppingList.ts`**

```ts
import { computed, type ComputedRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { ensureItem, getCachedItem } from '@/composables/useItemCatalog';
import {
  ROOM_ORDER, type RoomId,
  type NpcId,
  TYPE_ID_DOFUS, TYPE_ID_TROPHEE,
  slotToNpc, levelToRoom,
} from '@/types/rooms';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';
import type { Item } from '@/data/dofusdb';

export interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  totals: {
    items: number;
    activeRooms: number;
    perRoom: Record<RoomId, number>;
  };
}

function emptyShoppingList(): ShoppingList {
  const rooms = {} as ShoppingList['rooms'];
  const perRoom = {} as ShoppingList['totals']['perRoom'];
  for (const r of ROOM_ORDER) {
    rooms[r] = {};
    perRoom[r] = 0;
  }
  return { rooms, totals: { items: 0, activeRooms: 0, perRoom } };
}

export function useShoppingList(): ComputedRef<ShoppingList> {
  const build = useBuildStore();
  return computed(() => {
    const result = emptyShoppingList();
    const seen = new Set<number>(); // itemIds already bucketed (first-occurrence wins)

    for (const card of build.cards) {
      if (card.level === null) continue;
      const cardRoom = levelToRoom(card.level);

      // Equipment slots (10 slot types).
      for (const slot of SLOT_ORDER) {
        const ref = card.slots[slot];
        if (!ref) continue;
        if (seen.has(ref.itemId)) continue;
        const item = getCachedItem(ref.itemId);
        if (!item) {
          // Trigger background fetch; item will appear on a later computed pass.
          void ensureItem(ref.itemId).catch(() => {});
          continue;
        }
        const npc = slotToNpc(slot);
        bucket(result, cardRoom, npc, item);
        seen.add(ref.itemId);
      }

      // Dofus[] cells (6, mixed dofus/trophée).
      for (let i = 0; i < DOFUS_COUNT; i++) {
        const ref = card.dofus[i];
        if (!ref) continue;
        if (seen.has(ref.itemId)) continue;
        const item = getCachedItem(ref.itemId);
        if (!item) {
          void ensureItem(ref.itemId).catch(() => {});
          continue;
        }
        let npc: NpcId;
        let room: RoomId = cardRoom;
        if (item.typeId === TYPE_ID_DOFUS) {
          npc = 'dofus';
          room = '200'; // forced
        } else if (item.typeId === TYPE_ID_TROPHEE) {
          npc = 'trophee';
          if (room === '1-50') room = '51-100'; // bumped (no trophée NPC in 1-50)
        } else {
          // Unknown typeId in the dofus[] array — skip silently.
          continue;
        }
        bucket(result, room, npc, item);
        seen.add(ref.itemId);
      }
    }

    // Sort each NPC list by levelRequired ascending.
    for (const room of ROOM_ORDER) {
      const npcs = result.rooms[room];
      for (const key of Object.keys(npcs) as NpcId[]) {
        npcs[key]!.sort((a, b) => a.levelRequired - b.levelRequired);
      }
    }

    // Compute totals.
    let totalItems = 0;
    let activeRooms = 0;
    for (const room of ROOM_ORDER) {
      let n = 0;
      for (const npc of Object.keys(result.rooms[room]) as NpcId[]) {
        n += result.rooms[room][npc]!.length;
      }
      result.totals.perRoom[room] = n;
      totalItems += n;
      if (n > 0) activeRooms += 1;
    }
    result.totals.items = totalItems;
    result.totals.activeRooms = activeRooms;
    return result;
  });
}

function bucket(list: ShoppingList, room: RoomId, npc: NpcId, item: Item): void {
  const npcs = list.rooms[room];
  if (!npcs[npc]) npcs[npc] = [];
  npcs[npc]!.push(item);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/composables/useShoppingList.spec.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

```bash
npm run typecheck
npm run test:run
```

Expected: typecheck 0 errors; full suite 37/37 (30 existing + 7 new).

- [ ] **Step 6: Commit**

```bash
git add src/composables/useShoppingList.ts tests/composables/useShoppingList.spec.ts
git commit -m "feat(catalog): useShoppingList bucketing composable with TDD"
```

---

## Task 5 — ItemRow component (TDD on copy interaction)

**Files:**
- Test: `tests/components/ItemRow.spec.ts`
- Create: `src/components/ItemRow.vue`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ItemRow.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ItemRow from '@/components/ItemRow.vue';
import type { Item } from '@/data/dofusdb';

const TEST_ITEM: Item = {
  id: 1,
  name: 'Coiffe Bouftou',
  levelRequired: 21,
  iconUrl: '',
  stats: [],
  typeId: 16,
};

describe('ItemRow', () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders item name and level badge', () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    expect(w.text()).toContain('Coiffe Bouftou');
    expect(w.text()).toContain('lv 21');
  });

  it('clicking the copy button writes the item name to the clipboard', async () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('button[aria-label="Copier le nom"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('Coiffe Bouftou');
  });

  it('clicking the item name writes the item name to the clipboard', async () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('[data-testid="item-name"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('Coiffe Bouftou');
  });

  it('shows ✓ feedback after copy', async () => {
    vi.useFakeTimers();
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('button[aria-label="Copier le nom"]').trigger('click');
    await flushPromises();
    expect(w.find('button[aria-label="Copier le nom"]').text()).toBe('✓');
    vi.advanceTimersByTime(1300);
    await flushPromises();
    expect(w.find('button[aria-label="Copier le nom"]').text()).toBe('⧉');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/ItemRow.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/ItemRow.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { Item } from '@/data/dofusdb';
import type { SlotType } from '@/types/slots';
import { getSlotIconSvg } from '@/data/slot-icons';

const props = defineProps<{
  item: Item;
  fallbackSlot?: SlotType;
}>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

async function copyName(): Promise<void> {
  const text = props.item.name;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure contexts or very old browsers.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copied.value = true;
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { copied.value = false; resetTimer = null; }, 1200);
  } catch {
    // Silently swallow — the user can re-click. No toast.
  }
}
</script>

<template>
  <div class="item-row flex items-center gap-2.5 py-1.5 px-1 text-[12px]">
    <div class="icon w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 bg-bg-slot-filled border border-border-slot-filled">
      <img v-if="item.iconUrl" :src="item.iconUrl" :alt="item.name" class="w-4 h-4" />
      <svg
        v-else-if="fallbackSlot"
        viewBox="0 0 24 24"
        class="w-4 h-4 text-text-muted"
        v-html="getSlotIconSvg(fallbackSlot)"
      />
    </div>
    <span
      data-testid="item-name"
      class="flex-1 min-w-0 truncate text-text-default cursor-pointer hover:text-accent"
      :title="item.name"
      @click="copyName"
    >{{ item.name }}</span>
    <span class="text-[10px] font-mono text-text-dim border border-border-default bg-bg-page rounded px-1.5 py-0.5">lv {{ item.levelRequired }}</span>
    <button
      type="button"
      class="w-6 h-6 rounded border bg-bg-page text-text-muted text-[12px] flex items-center justify-center transition-colors"
      :class="copied
        ? 'bg-accent text-[#061a13] border-accent'
        : 'border-border-default hover:border-accent hover:text-accent'"
      aria-label="Copier le nom"
      @click="copyName"
    >{{ copied ? '✓' : '⧉' }}</button>
  </div>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/ItemRow.spec.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

```bash
npm run typecheck
npm run test:run
```

Expected: 41/41 (37 from previous + 4 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/ItemRow.vue tests/components/ItemRow.spec.ts
git commit -m "feat(ui): ItemRow with copy-to-clipboard + ✓ feedback (TDD)"
```

---

## Task 6 — NpcCard component

**Files:**
- Create: `src/components/NpcCard.vue`

- [ ] **Step 1: Create `src/components/NpcCard.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { NpcId } from '@/types/rooms';
import { NPC_LABEL } from '@/types/rooms';
import type { Item } from '@/data/dofusdb';
import { getNpcIconSvg } from '@/data/npc-icons';
import ItemRow from './ItemRow.vue';
import type { SlotType } from '@/types/slots';

const props = defineProps<{
  npcId: NpcId;
  items: Item[];
}>();

const label = computed(() => NPC_LABEL[props.npcId]);
const iconSvg = computed(() => getNpcIconSvg(props.npcId));

// fallbackSlot is the SlotType that ItemRow uses to draw a placeholder glyph when the
// item has no iconUrl. For NPCs that map directly to a slot, pass it. trophée + dofus
// fall back to undefined → ItemRow simply shows nothing inside the icon box.
const fallbackSlot = computed<SlotType | undefined>(() => {
  switch (props.npcId) {
    case 'coiffe': return 'coiffe';
    case 'cape': return 'cape';
    case 'amulette': return 'amulette';
    case 'anneau': return 'anneau1';
    case 'ceinture': return 'ceinture';
    case 'bottes': return 'bottes';
    case 'arme': return 'arme';
    case 'bouclier': return 'bouclier';
    case 'familier': return 'familier';
    default: return undefined;
  }
});
</script>

<template>
  <article class="npc-card bg-bg-surface border border-border-default rounded-lg p-3.5 flex flex-col gap-2">
    <header class="flex items-center gap-2.5 pb-2 border-b border-border-subtle">
      <div class="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center bg-bg-slot-filled border border-border-slot-filled text-text-muted">
        <svg viewBox="0 0 24 24" class="w-4 h-4" v-html="iconSvg" />
      </div>
      <h3 class="font-display text-[12px] text-accent/85 tracking-[0.2em] uppercase flex-1 min-w-0 truncate">{{ label }}</h3>
      <span class="text-[10px] font-mono text-text-faint bg-bg-page border border-border-default rounded-full px-1.5 py-[1px]">×{{ items.length }}</span>
    </header>
    <div class="flex flex-col">
      <ItemRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        :fallback-slot="fallbackSlot"
      />
    </div>
  </article>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/NpcCard.vue
git commit -m "feat(ui): NpcCard wrapping ItemRow list with header + count badge"
```

---

## Task 7 — AppPurchasePlanner screen

**Files:**
- Create: `src/components/AppPurchasePlanner.vue`

- [ ] **Step 1: Create `src/components/AppPurchasePlanner.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { ROOM_ORDER, NPC_ORDER, ROOM_NPCS, type RoomId } from '@/types/rooms';
import { useUiStore } from '@/stores/ui';
import NpcCard from './NpcCard.vue';

const ui = useUiStore();
const list = useShoppingList();

const activeRoom = ref<RoomId>('1-50');

// On mount / when totals change, default the active tab to the first non-empty room.
// We only auto-shift away from an empty selection — we don't override a deliberate
// click on a non-empty room.
watchEffect(() => {
  const t = list.value.totals.perRoom;
  if (t[activeRoom.value] > 0) return;
  for (const r of ROOM_ORDER) {
    if (t[r] > 0) { activeRoom.value = r; return; }
  }
  // All empty — keep '1-50' as the visible (empty) selection.
  activeRoom.value = '1-50';
});

const hasAnything = computed(() => list.value.totals.items > 0);

const orderedNpcsForActiveRoom = computed(() => {
  const npcs = ROOM_NPCS[activeRoom.value];
  const cell = list.value.rooms[activeRoom.value];
  return NPC_ORDER.filter((n) => npcs.includes(n) && (cell[n]?.length ?? 0) > 0);
});

function pickRoom(room: RoomId): void {
  if (list.value.totals.perRoom[room] === 0) return;
  activeRoom.value = room;
}

function backToBuild(): void {
  ui.setViewMode('build');
}
</script>

<template>
  <section class="purchase-planner flex-1 overflow-y-auto relative z-[1] bg-bg-page">
    <!-- Empty global state -->
    <div v-if="!hasAnything" class="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
      <p class="font-display text-[14px] text-text-muted tracking-[0.2em] uppercase max-w-md">
        Ajoute des items à ta timeline pour générer la liste de courses
      </p>
      <button
        type="button"
        class="bg-accent text-[#061a13] border border-accent rounded-md px-4 py-2 font-sans text-[12px] font-semibold hover:brightness-110"
        @click="backToBuild"
      >← Retour à Build</button>
    </div>

    <template v-else>
      <!-- Header strip -->
      <header class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <h1 class="font-display text-[18px] text-text-default tracking-[0.2em] uppercase">
          Planificateur d'achat
        </h1>
        <span class="font-mono text-[11px] text-text-dim">
          {{ list.totals.items }} items · {{ list.totals.activeRooms }} salle{{ list.totals.activeRooms > 1 ? 's' : '' }} active{{ list.totals.activeRooms > 1 ? 's' : '' }}
        </span>
      </header>

      <!-- Room tabs -->
      <nav class="flex gap-1 px-6 pt-3 border-b border-border-subtle bg-bg-page sticky top-0 z-10">
        <button
          v-for="room in ROOM_ORDER"
          :key="room"
          type="button"
          :disabled="list.totals.perRoom[room] === 0"
          class="px-4 py-2.5 font-display text-[13px] tracking-[0.18em] uppercase rounded-t-md flex items-center gap-2 transition-colors"
          :class="[
            activeRoom === room
              ? 'bg-bg-surface text-text-default border-b-2 border-accent -mb-[1px]'
              : 'text-text-faint hover:text-text-default',
            list.totals.perRoom[room] === 0 && 'opacity-40 cursor-not-allowed hover:text-text-faint',
          ]"
          @click="pickRoom(room)"
        >
          <span>{{ room }}</span>
          <span class="text-[10px] font-mono">({{ list.totals.perRoom[room] }})</span>
        </button>
      </nav>

      <!-- Active room content -->
      <div class="grid gap-4 p-6" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
        <NpcCard
          v-for="npc in orderedNpcsForActiveRoom"
          :key="npc"
          :npc-id="npc"
          :items="list.rooms[activeRoom][npc]!"
        />
      </div>
    </template>
  </section>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppPurchasePlanner.vue
git commit -m "feat(ui): AppPurchasePlanner screen — header + room tabs + NPC grid"
```

---

## Task 8 — Wire App.vue conditional + final verification

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Modify `src/App.vue`**

Find the `<template>` section. Wrap the timeline + minimap in a `<template v-if="ui.viewMode !== 'purchase'">` and add `<AppPurchasePlanner v-else>`. Import the new component at the top.

Before:

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppTopBar from './components/AppTopBar.vue';
import AppTimeline from './components/AppTimeline.vue';
import AppMiniMap from './components/AppMiniMap.vue';
import ItemPickerSheet from './components/ItemPickerSheet.vue';
import ClassPickerModal from './components/ClassPickerModal.vue';
import { useBuildStore } from './stores/build';
import { useUiStore } from './stores/ui';
// ...
</script>
```

Add the import:

```vue
import AppPurchasePlanner from './components/AppPurchasePlanner.vue';
```

In the template, replace:

```vue
<AppTopBar class="relative z-10" />
<AppTimeline ref="timelineRef" class="relative z-10" />
<AppMiniMap :scroll-ref="scrollEl" class="relative z-10" />
<ItemPickerSheet />
<ClassPickerModal />
```

With:

```vue
<AppTopBar class="relative z-10" />
<template v-if="ui.viewMode === 'purchase'">
  <AppPurchasePlanner class="relative z-10" />
</template>
<template v-else>
  <AppTimeline ref="timelineRef" class="relative z-10" />
  <AppMiniMap :scroll-ref="scrollEl" class="relative z-10" />
</template>
<ItemPickerSheet />
<ClassPickerModal />
```

The `timelineRef` and `scrollEl` refs only exist inside the `v-else` branch — that's fine, they get re-created when the user toggles back to Build/Switch. The `onMounted` hook in `App.vue` setting the active card if none is set must be guarded so it only fires when the timeline branch is mounted. Find the existing `onMounted`:

```ts
onMounted(() => {
  if (!ui.activeCardId && build.cards.length > 0) {
    ui.setActiveCard(build.cards[0].id);
  }
});
```

Leave it as-is — it runs once on the App.vue lifecycle, not the timeline's, and is purely setting initial state.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: 41/41 passing (30 V1 + 7 useShoppingList + 4 ItemRow).

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: success, no warnings.

- [ ] **Step 5: Headless dev-server smoke check**

```bash
npm run dev > ./vite-dev.log 2>&1 &
PID=$!
sleep 5
cat ./vite-dev.log
echo "---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5173/ || true
kill $PID 2>/dev/null
wait $PID 2>/dev/null
rm -f ./vite-dev.log
```

Expected: log shows `Local: http://localhost:5173/`, no errors, HTTP 200 on `/`. Manual verification by the user (clicking Achats, picking rooms, copying items) is the final gate.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): wire Achats mode (AppPurchasePlanner) in conditional render"
```

---

## Self-review

- **Spec coverage**:
  - Event model + room NPCs availability: Task 1 (`ROOM_NPCS`).
  - Bucketing rules (first-occurrence, slotToNpc, levelToRoom, trophée bump, dofus force): Task 4.
  - Top bar 3-mode toggle: Task 3.
  - Header strip + room tabs + grid + empty states: Task 7.
  - NpcCard layout (icon + label + count + items): Task 6.
  - ItemRow (icon + name + level + copy ⧉): Task 5.
  - Copy interaction with `navigator.clipboard.writeText` + ✓ feedback: Task 5 (covered by tests).
  - Conditional render planner ↔ timeline: Task 8.
  - Cold-cache UX (skip uncached items + trigger ensureItem): Task 4 (logic in `useShoppingList`).
  - 7 bucketing tests: Task 4.
  - ItemRow copy test: Task 5.

- **Placeholder scan**: every code block is complete; no TBD/TODO; expected test counts and commands concrete.

- **Type consistency**: `RoomId` / `NpcId` defined in Task 1 and used unchanged in Tasks 4, 6, 7. `Item.typeId` added in Task 1 and consumed in Task 4 (`TYPE_ID_DOFUS` / `TYPE_ID_TROPHEE`). `ShoppingList.rooms[room]` is `Partial<Record<NpcId, Item[]>>` — Task 7 uses `cell[n]?.length ?? 0` and the non-null assertion `list.rooms[activeRoom][npc]!` consistently. `ViewMode` widened in Task 3 and consumed unchanged in Tasks 7, 8.

- **Known soft spot**: in Task 8 the `timelineRef` ref still exists in `<script setup>` but the `<template>` only mounts it conditionally. When `viewMode === 'purchase'`, `timelineRef.value` is `null`, which is harmless since the only consumer (`scrollEl` computed) returns `null` and only gets passed to `AppMiniMap` (also unmounted). No reactive errors expected; if Vue logs warnings, simply move the timeline-related state inside a child component or guard with a watch — but this is a follow-up, not a blocker.
