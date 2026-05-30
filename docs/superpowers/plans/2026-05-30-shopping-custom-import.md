# Shopping custom import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a list of item names (plain or `nom;type;niveau` CSV) into the Shopping view; batch-validate them against DofusDB and inject the found items into the right room/NPC tables, listing not-found names in a dedicated "Inconnu" panel. One persistent custom list, with "Analyser" (report counts) and "Importer" (apply) actions.

**Architecture:** A persistent Pinia store holds the resolved custom list (`{name, itemId|null}[]`). A pure parser extracts names (CSV-aware). A resolver batches one DofusDB request and keeps only routable matches. `routeItemByType` maps an item's typeId+level to a room/NPC. `useShoppingList` injects the custom found items (deduped against card items) and exposes `unknown` names + `customItemIds` for the badge. A modal in the planner drives Analyser/Importer/Vider.

**Tech Stack:** Vue 3 (Composition API), Pinia, TypeScript, Vitest + Vue Test Utils, jsdom.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/stores/customShopping.ts` | new | Persistent custom list store (`entries`, `setEntries`, `clear`). |
| `src/types/rooms.ts` | modify | `routeItemByType(item)` → `{room, npc} | null`. |
| `src/composables/useCustomShopping.ts` | new | `parseCustomLines(text)` + `resolveCustomNames(names)`. |
| `src/composables/useShoppingList.ts` | modify | Inject custom items; add `unknown` + `customItemIds`. |
| `src/components/CustomImportModal.vue` | new | Paste UI + Analyser/Importer/Vider. |
| `src/components/AppPurchasePlanner.vue` | modify | Import-custom button, Inconnu panel, custom badge, empty-state tweak. |
| tests (5 new/extended) | | store, routing, parse+resolve, shopping integration, modal smoke. |

---

## Task 1: Persistent custom-list store

**Files:**
- Create: `src/stores/customShopping.ts`
- Test: `tests/stores/customShopping.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/stores/customShopping.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useCustomShoppingStore } from '@/stores/customShopping';

const KEY = 'dofus-planner.shopping.custom.v1';

describe('customShopping store', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

  it('defaults to an empty list', () => {
    expect(useCustomShoppingStore().entries).toEqual([]);
  });

  it('setEntries replaces the list; clear empties it', () => {
    const s = useCustomShoppingStore();
    s.setEntries([{ name: 'A', itemId: 1 }, { name: 'B', itemId: null }]);
    expect(s.entries).toHaveLength(2);
    s.setEntries([{ name: 'C', itemId: 3 }]);
    expect(s.entries).toEqual([{ name: 'C', itemId: 3 }]);
    s.clear();
    expect(s.entries).toEqual([]);
  });

  it('persists across a reload (rehydrates from localStorage)', async () => {
    const s = useCustomShoppingStore();
    s.setEntries([{ name: 'A', itemId: 1 }]);
    await nextTick();
    setActivePinia(createPinia());
    expect(useCustomShoppingStore().entries).toEqual([{ name: 'A', itemId: 1 }]);
  });

  it('falls back to empty on corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    setActivePinia(createPinia());
    expect(useCustomShoppingStore().entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/stores/customShopping.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/stores/customShopping.ts`:

```ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface CustomEntry {
  name: string;
  /** Resolved DofusDB item id, or null when the name wasn't found / isn't routable. */
  itemId: number | null;
}

const STORAGE_KEY = 'dofus-planner.shopping.custom.v1';

function loadEntries(): CustomEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is CustomEntry =>
      typeof e === 'object' && e !== null
      && typeof (e as CustomEntry).name === 'string'
      && ((e as CustomEntry).itemId === null || typeof (e as CustomEntry).itemId === 'number'));
  } catch {
    return [];
  }
}

/** The single, persistent custom shopping list — resolved once at import time and
 *  saved so it survives reloads. */
export const useCustomShoppingStore = defineStore('customShopping', () => {
  const entries = ref<CustomEntry[]>(loadEntries());
  watch(entries, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // best-effort: ignore unavailable / quota-exceeded localStorage
    }
  }, { deep: true });

  function setEntries(next: CustomEntry[]): void { entries.value = next; }
  function clear(): void { entries.value = []; }

  return { entries, setEntries, clear };
});
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/stores/customShopping.spec.ts` → 4 pass. `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/stores/customShopping.ts tests/stores/customShopping.spec.ts
git commit -m "feat(shopping): persistent custom-list store"
```

---

## Task 2: `routeItemByType`

**Files:**
- Modify: `src/types/rooms.ts`
- Test: `tests/types/rooms-route.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/types/rooms-route.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { routeItemByType, TYPE_ID_DOFUS, TYPE_ID_TROPHEE } from '@/types/rooms';

describe('routeItemByType', () => {
  it('dofus → room 200 / dofus', () => {
    expect(routeItemByType({ typeId: TYPE_ID_DOFUS, levelRequired: 60 })).toEqual({ room: '200', npc: 'dofus' });
  });
  it('trophée at lvl 30 → bumped 50-99 / trophee', () => {
    expect(routeItemByType({ typeId: TYPE_ID_TROPHEE, levelRequired: 30 })).toEqual({ room: '50-99', npc: 'trophee' });
  });
  it('trophée at lvl 120 → 100-149 / trophee', () => {
    expect(routeItemByType({ typeId: TYPE_ID_TROPHEE, levelRequired: 120 })).toEqual({ room: '100-149', npc: 'trophee' });
  });
  it('familier (18) → hub / familier', () => {
    expect(routeItemByType({ typeId: 18, levelRequired: 60 })).toEqual({ room: 'hub', npc: 'familier' });
  });
  it('monture (97) → hub / monture', () => {
    expect(routeItemByType({ typeId: 97, levelRequired: 100 })).toEqual({ room: 'hub', npc: 'monture' });
  });
  it('ring (9) → room by level / anneau', () => {
    expect(routeItemByType({ typeId: 9, levelRequired: 26 })).toEqual({ room: '1-49', npc: 'anneau' });
  });
  it('coiffe (16) at lvl 60 → 50-99 / coiffe', () => {
    expect(routeItemByType({ typeId: 16, levelRequired: 60 })).toEqual({ room: '50-99', npc: 'coiffe' });
  });
  it('unknown typeId → null', () => {
    expect(routeItemByType({ typeId: 99, levelRequired: 50 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/types/rooms-route.spec.ts`
Expected: FAIL — `routeItemByType` not exported.

- [ ] **Step 3: Implement**

In `src/types/rooms.ts`, add the import at the top (next to the existing imports):

```ts
import { TYPE_ID_TO_SLOT, RING_TYPE_ID } from '@/utils/typeIdSlots';
```

Add at the end of the file (after `levelToRoom`):

```ts
/** Route a resolved item to its shopping room + NPC by typeId + levelRequired.
 *  Mirrors useShoppingList's bucketing but keyed on typeId (the custom importer
 *  knows only the item, not a slot). Returns null when the typeId fits no shopping
 *  NPC (e.g. a consumable) — the caller treats that as "unknown". */
export function routeItemByType(item: { typeId: number; levelRequired: number }): { room: RoomId; npc: NpcId } | null {
  const { typeId, levelRequired } = item;
  if (typeId === TYPE_ID_DOFUS) return { room: '200', npc: 'dofus' };
  if (typeId === TYPE_ID_TROPHEE) {
    const room = levelToRoom(levelRequired);
    return { room: room === '1-49' ? '50-99' : room, npc: 'trophee' };
  }
  if (FAMILIER_TYPE_IDS.includes(typeId)) return { room: 'hub', npc: 'familier' };
  if (MONTURE_TYPE_IDS.includes(typeId)) return { room: 'hub', npc: 'monture' };
  if (typeId === RING_TYPE_ID) return { room: levelToRoom(levelRequired), npc: 'anneau' };
  const slot = TYPE_ID_TO_SLOT[typeId];
  if (slot) return { room: levelToRoom(levelRequired), npc: slotToNpc(slot) };
  return null;
}
```

Note: `TYPE_ID_TO_SLOT` excludes the ring typeId (9 maps to two slots), so rings are handled explicitly above. `FAMILIER_TYPE_IDS`, `MONTURE_TYPE_IDS`, `TYPE_ID_DOFUS`, `TYPE_ID_TROPHEE`, `levelToRoom`, `slotToNpc`, `RoomId`, `NpcId` already exist in `rooms.ts`.

Verify no circular import: `rooms.ts` → `typeIdSlots.ts` → `dofusdb.ts` → `types/slots.ts`. None of those import `rooms.ts`, so it's acyclic. If `vue-tsc`/test run reports a cycle, report BLOCKED.

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/types/rooms-route.spec.ts` → 8 pass. `npx vue-tsc --noEmit` → 0 errors. `npx vitest run tests/composables/useShoppingList.spec.ts` → still green (no regression in rooms.ts).

- [ ] **Step 5: Commit**

```bash
git add src/types/rooms.ts tests/types/rooms-route.spec.ts
git commit -m "feat(shopping): routeItemByType — typeId+level → room/NPC"
```

---

## Task 3: Parse + resolve custom names

**Files:**
- Create: `src/composables/useCustomShopping.ts`
- Test: `tests/composables/useCustomShopping.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/composables/useCustomShopping.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Item } from '@/data/dofusdb';

const fetchItemsByNames = vi.fn();
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/dofusdb', async (orig) => {
  const actual = await orig<typeof import('@/data/dofusdb')>();
  return { ...actual, fetchItemsByNames: (...a: unknown[]) => fetchItemsByNames(...a) };
});
vi.mock('@/composables/useItemCatalog', async (orig) => {
  const actual = await orig<typeof import('@/composables/useItemCatalog')>();
  return { ...actual, ensureItems: (...a: unknown[]) => ensureItems(...a) };
});

import { parseCustomLines, resolveCustomNames } from '@/composables/useCustomShopping';

function item(id: number, name: string, typeId: number, level = 30): Item {
  return { id, name, levelRequired: level, iconUrl: '', stats: [], typeId };
}

beforeEach(() => { fetchItemsByNames.mockReset(); ensureItems.mockClear(); });

describe('parseCustomLines', () => {
  it('parses a plain one-name-per-line list', () => {
    expect(parseCustomLines("Anneau d'Allister\nMasque de Klime")).toEqual([
      "Anneau d'Allister", 'Masque de Klime',
    ]);
  });

  it('parses CSV "nom;type;niveau" keeping only the name, dropping the header', () => {
    const csv = 'nom;type;niveau\nAlliance de Silimelle;Anneau;26\nDragolyre;Amulette;32';
    expect(parseCustomLines(csv)).toEqual(['Alliance de Silimelle', 'Dragolyre']);
  });

  it('drops empty lines and de-dups by normalized name', () => {
    expect(parseCustomLines('Dragolyre\n\n  dragolyre  \nMasque de Klime')).toEqual([
      'Dragolyre', 'Masque de Klime',
    ]);
  });
});

describe('resolveCustomNames', () => {
  it('maps found names to itemId, missing to null, in one batched fetch', async () => {
    fetchItemsByNames.mockResolvedValue([item(1, 'Dragolyre', 1)]); // amulette typeId 1
    const r = await resolveCustomNames(['Dragolyre', 'Inexistant']);
    expect(r).toEqual([{ name: 'Dragolyre', itemId: 1 }, { name: 'Inexistant', itemId: null }]);
    expect(fetchItemsByNames).toHaveBeenCalledTimes(1);
    expect(ensureItems).toHaveBeenCalledWith([1]);
  });

  it('keeps only routable matches (a found but unroutable typeId → null)', async () => {
    fetchItemsByNames.mockResolvedValue([item(5, 'Potion', 99)]); // typeId 99 routes nowhere
    const r = await resolveCustomNames(['Potion']);
    expect(r).toEqual([{ name: 'Potion', itemId: null }]);
    expect(ensureItems).not.toHaveBeenCalled();
  });

  it('prefers a routable item when a name maps to several', async () => {
    // same name under an unroutable typeId (99) and a routable one (1 = amulette)
    fetchItemsByNames.mockResolvedValue([item(8, 'Dragolyre', 99), item(9, 'Dragolyre', 1)]);
    const r = await resolveCustomNames(['Dragolyre']);
    expect(r).toEqual([{ name: 'Dragolyre', itemId: 9 }]);
  });

  it('returns [] for no names without fetching', async () => {
    const r = await resolveCustomNames([]);
    expect(r).toEqual([]);
    expect(fetchItemsByNames).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/composables/useCustomShopping.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/composables/useCustomShopping.ts`:

```ts
import { fetchItemsByNames, normalizeSearch } from '@/data/dofusdb';
import { ensureItems } from '@/composables/useItemCatalog';
import { routeItemByType } from '@/types/rooms';
import type { CustomEntry } from '@/stores/customShopping';

/** Extract item names from pasted text. Accepts a plain "one name per line" list
 *  AND a CSV "nom;type;niveau" — only the NAME (first ';' field) is kept, since
 *  resolution is name-based. Drops empties, the `nom` header line, and duplicates
 *  (by normalized name, first-seen order preserved). */
export function parseCustomLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const name = line.split(';')[0].trim();
    if (name.length === 0) continue;
    if (name.toLowerCase() === 'nom') continue; // CSV header (or a bare "nom")
    const key = normalizeSearch(name);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Resolve parsed names against DofusDB in ONE batched request. An entry's itemId
 *  is set only when a match exists AND it routes to a shopping NPC (so "valid" means
 *  "will be placed"); otherwise null. Found ids are warmed in the catalog cache. */
export async function resolveCustomNames(names: string[]): Promise<CustomEntry[]> {
  if (names.length === 0) return [];
  const pool = await fetchItemsByNames(names);
  const byName = new Map<string, typeof pool>();
  for (const it of pool) {
    const key = normalizeSearch(it.name);
    const bucket = byName.get(key);
    if (bucket) bucket.push(it);
    else byName.set(key, [it]);
  }
  const entries: CustomEntry[] = names.map((name) => {
    const candidates = byName.get(normalizeSearch(name)) ?? [];
    const routable = candidates.find((it) => routeItemByType(it) !== null) ?? null;
    return { name, itemId: routable ? routable.id : null };
  });
  const foundIds = entries.map((e) => e.itemId).filter((id): id is number => id !== null);
  if (foundIds.length > 0) await ensureItems(foundIds);
  return entries;
}
```

(`import type { CustomEntry }` is erased at build — no runtime dependency on the store.)

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/composables/useCustomShopping.spec.ts` → 7 pass. `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCustomShopping.ts tests/composables/useCustomShopping.spec.ts
git commit -m "feat(shopping): parseCustomLines (list/CSV) + resolveCustomNames batch"
```

---

## Task 4: Inject custom items into `useShoppingList`

**Files:**
- Modify: `src/composables/useShoppingList.ts`
- Test: `tests/composables/useShoppingList.spec.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/composables/useShoppingList.spec.ts` (it already imports `useBuildStore`, `useShoppingList`, `populateCache`, `seedItem`, `makeCard`). Add this import at the top of the file:

```ts
import { useCustomShoppingStore } from '@/stores/customShopping';
```

Then add this `describe` block at the end (inside the file, after the existing top-level `describe`):

```ts
describe('useShoppingList — custom import', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

  it('injects a found custom item into the right room/NPC and flags it custom', () => {
    seedItem(900, { name: 'Dragolyre', level: 32, typeId: 1 }); // amulette
    const build = useBuildStore();
    build.replaceCards([makeCard(1)]);
    useCustomShoppingStore().setEntries([{ name: 'Dragolyre', itemId: 900 }]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].amulette?.map((i) => i.id)).toEqual([900]);
    expect(list.customItemIds.has(900)).toBe(true);
  });

  it('puts an unfound entry (itemId null) into unknown', () => {
    const build = useBuildStore();
    build.replaceCards([makeCard(1)]);
    useCustomShoppingStore().setEntries([{ name: 'Truc Inconnu', itemId: null }]);
    const list = useShoppingList().value;
    expect(list.unknown).toEqual(['Truc Inconnu']);
  });

  it('does not duplicate a custom item already provided by a card (no custom badge)', () => {
    seedItem(901, { name: 'Coiffe Bouftou', level: 1, typeId: 16 });
    const build = useBuildStore();
    build.replaceCards([makeCard(1, { slots: { coiffe: { itemId: 901 } } })]);
    useCustomShoppingStore().setEntries([{ name: 'Coiffe Bouftou', itemId: 901 }]);
    const list = useShoppingList().value;
    expect(list.rooms['1-49'].coiffe?.map((i) => i.id)).toEqual([901]); // once
    expect(list.customItemIds.has(901)).toBe(false); // it's a card item, not a custom badge
  });

  it('routes a custom item whose cached typeId maps nowhere into unknown', () => {
    seedItem(902, { name: 'Potion', level: 1, typeId: 99 });
    const build = useBuildStore();
    build.replaceCards([makeCard(1)]);
    useCustomShoppingStore().setEntries([{ name: 'Potion', itemId: 902 }]);
    const list = useShoppingList().value;
    expect(list.unknown).toEqual(['Potion']);
    expect(list.customItemIds.has(902)).toBe(false);
  });

  it('counts custom items in the totals', () => {
    seedItem(903, { name: 'Dragolyre', level: 32, typeId: 1 });
    const build = useBuildStore();
    build.replaceCards([makeCard(1)]);
    useCustomShoppingStore().setEntries([{ name: 'Dragolyre', itemId: 903 }]);
    const list = useShoppingList().value;
    expect(list.totals.units).toBe(1);
    expect(list.totals.unitsPerRoom['1-49']).toBe(1);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/composables/useShoppingList.spec.ts`
Expected: the new tests FAIL (`customItemIds`/`unknown` undefined; items not injected).

- [ ] **Step 3: Implement**

In `src/composables/useShoppingList.ts`:

Add imports:

```ts
import { useCustomShoppingStore } from '@/stores/customShopping';
import { routeItemByType } from '@/types/rooms';
```

Extend the `ShoppingList` interface (add two fields):

```ts
export interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  counts: Record<number, number>;
  /** Names that couldn't be placed — not found in DofusDB, or a cached item whose
   *  typeId routes to no shopping NPC. Shown in the "Inconnu" panel. */
  unknown: string[];
  /** Item ids that came from the custom import (and aren't card-derived) — drives
   *  the "custom" badge. */
  customItemIds: Set<number>;
  totals: {
    items: number;
    activeRooms: number;
    perRoom: Record<RoomId, number>;
    units: number;
    unitsPerRoom: Record<RoomId, number>;
  };
}
```

In `emptyShoppingList()`, add the two fields to the returned object:

```ts
  return {
    rooms,
    counts: {},
    unknown: [],
    customItemIds: new Set<number>(),
    totals: { items: 0, activeRooms: 0, perRoom, units: 0, unitsPerRoom },
  };
```

In `useShoppingList()`, add the store next to `const build = useBuildStore();`:

```ts
  const custom = useCustomShoppingStore();
```

Inside the `computed`, AFTER the card loop (the `for (const card of build.cards)` that buckets items) and BEFORE the "Sort each NPC list" step, insert the custom-injection block:

```ts
    // Inject the persistent custom list. Found+routable ids that aren't already a
    // card item get bucketed and flagged custom; everything else is "unknown".
    for (const entry of custom.entries) {
      if (entry.itemId === null) { result.unknown.push(entry.name); continue; }
      if (seen.has(entry.itemId)) continue; // already from a card → no dup, no badge
      const item = getCachedItem(entry.itemId);
      if (!item) { void ensureItem(entry.itemId).catch(() => {}); continue; }
      const route = routeItemByType(item);
      if (!route) { result.unknown.push(entry.name); continue; }
      bucket(result, route.room, route.npc, item);
      result.customItemIds.add(item.id);
      seen.add(item.id);
    }
```

The existing totals loop already sums `counts[item.id] ?? 1`, so injected custom items (no `counts` entry) count as 1 — no change needed there.

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/composables/useShoppingList.spec.ts` → all pass (existing + 5 new). `npx vue-tsc --noEmit` → 0 errors. `npx vitest run` → full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useShoppingList.ts tests/composables/useShoppingList.spec.ts
git commit -m "feat(shopping): inject custom items + unknown list + customItemIds"
```

---

## Task 5: Custom import modal

**Files:**
- Create: `src/components/CustomImportModal.vue`
- Test: `tests/components/CustomImportModal.spec.ts` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `tests/components/CustomImportModal.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const resolveCustomNames = vi.fn();
vi.mock('@/composables/useCustomShopping', async (orig) => {
  const actual = await orig<typeof import('@/composables/useCustomShopping')>();
  return { ...actual, resolveCustomNames: (...a: unknown[]) => resolveCustomNames(...a) };
});

import CustomImportModal from '@/components/CustomImportModal.vue';
import { useCustomShoppingStore } from '@/stores/customShopping';

beforeEach(() => { setActivePinia(createPinia()); resolveCustomNames.mockReset(); });

const SAMPLE = "Dragolyre\nInexistant";

describe('CustomImportModal', () => {
  it('Analyser resolves and shows valid/invalid counts WITHOUT importing', async () => {
    const store = useCustomShoppingStore();
    const spy = vi.spyOn(store, 'setEntries');
    resolveCustomNames.mockResolvedValue([
      { name: 'Dragolyre', itemId: 1 },
      { name: 'Inexistant', itemId: null },
    ]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="custom-analyser"]').trigger('click');
    await flushPromises();
    expect(resolveCustomNames).toHaveBeenCalled();
    expect(w.text()).toContain('1 valide');
    expect(w.text()).toContain('1 invalide');
    expect(w.text()).toContain('Inexistant'); // invalid name listed
    expect(spy).not.toHaveBeenCalled(); // not imported
  });

  it('Importer resolves, stores the entries, and closes', async () => {
    const store = useCustomShoppingStore();
    const spy = vi.spyOn(store, 'setEntries');
    resolveCustomNames.mockResolvedValue([{ name: 'Dragolyre', itemId: 1 }]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-textarea"]').setValue('Dragolyre');
    await w.find('[data-testid="custom-importer"]').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledWith([{ name: 'Dragolyre', itemId: 1 }]);
    expect(w.emitted('close')).toBeTruthy();
  });

  it('Vider clears the stored list and closes', async () => {
    const store = useCustomShoppingStore();
    store.setEntries([{ name: 'X', itemId: 1 }]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-vider"]').trigger('click');
    expect(store.entries).toEqual([]);
    expect(w.emitted('close')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/components/CustomImportModal.spec.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement**

Create `src/components/CustomImportModal.vue`:

```vue
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useCustomShoppingStore, type CustomEntry } from '@/stores/customShopping';
import { parseCustomLines, resolveCustomNames } from '@/composables/useCustomShopping';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = useCustomShoppingStore();
const toast = useToast();

const text = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
// Cached analysis keyed by the exact textarea content, so Importer right after
// Analyser (unchanged text) reuses it instead of re-fetching.
const analysis = ref<{ text: string; entries: CustomEntry[] } | null>(null);

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  text.value = store.entries.map((e) => e.name).join('\n');
  error.value = null;
  analysis.value = null;
});

const validCount = computed(() => analysis.value?.entries.filter((e) => e.itemId !== null).length ?? 0);
const invalidNames = computed(() => analysis.value?.entries.filter((e) => e.itemId === null).map((e) => e.name) ?? []);

async function resolve(): Promise<CustomEntry[] | null> {
  busy.value = true;
  error.value = null;
  try {
    const entries = await resolveCustomNames(parseCustomLines(text.value));
    analysis.value = { text: text.value, entries };
    return entries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return null;
  } finally {
    busy.value = false;
  }
}

async function onAnalyser(): Promise<void> { await resolve(); }

async function onImporter(): Promise<void> {
  const entries = analysis.value?.text === text.value ? analysis.value.entries : await resolve();
  if (!entries) return;
  store.setEntries(entries);
  const valid = entries.filter((e) => e.itemId !== null).length;
  const invalid = entries.length - valid;
  toast.show(invalid > 0 ? `${valid}/${entries.length} items reconnus — ${invalid} inconnus` : `${valid} items reconnus`);
  emit('close');
}

function onVider(): void { store.clear(); emit('close'); }
function close(): void { emit('close'); }

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') close();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div v-if="open" class="fixed inset-0 z-[59] backdrop-blur-sm" style="background: rgba(0,0,0,0.5);" @click="close" />
    </Transition>
    <Transition name="modal">
      <aside
        v-if="open"
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-32px))] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[60] flex flex-col"
        style="background: rgba(8,8,8,0.85);"
        role="dialog"
        aria-modal="true"
        @click.stop
      >
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 class="font-sans font-bold text-[10px] text-[#8AE0EE] tracking-[0.06em] uppercase">Import custom</h2>
          <button
            type="button" @click="close" aria-label="Fermer"
            class="w-8 h-8 inline-flex items-center justify-center rounded-full border border-white/10 text-text-faint hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="px-5 py-4 flex flex-col gap-3">
          <textarea
            data-testid="custom-textarea"
            v-model="text"
            rows="8"
            spellcheck="false"
            placeholder="Un item par ligne, ou collez un CSV nom;type;niveau…"
            class="w-full resize-none bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 font-sans text-[12px] text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
          />
          <p v-if="error" class="font-sans text-xs text-danger-soft">Erreur&nbsp;: {{ error }}</p>
          <div v-else-if="analysis" class="font-sans text-xs text-text-muted flex flex-col gap-1">
            <span>
              <span class="font-bold text-[#8AE0EE]">{{ validCount }}</span> valide{{ validCount > 1 ? 's' : '' }}
              · <span class="font-bold text-danger-soft">{{ invalidNames.length }}</span> invalide{{ invalidNames.length > 1 ? 's' : '' }}
            </span>
            <span v-if="invalidNames.length" class="text-text-faint">Inconnus&nbsp;: {{ invalidNames.join(', ') }}</span>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle">
          <button
            v-if="store.entries.length"
            type="button" data-testid="custom-vider" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-white/10 text-text-dim hover:text-danger-soft hover:border-danger/40 transition-colors disabled:opacity-50 mr-auto"
            @click="onVider"
          >Vider</button>
          <button
            type="button" data-testid="custom-analyser" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30 transition-colors disabled:opacity-50"
            @click="onAnalyser"
          >{{ busy ? '…' : 'Analyser' }}</button>
          <button
            type="button" data-testid="custom-importer" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.12] text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.20] hover:border-[#5DCFE0] transition-colors disabled:opacity-50"
            @click="onImporter"
          >Importer</button>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, calc(-50% + 6px)); }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 150ms ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/components/CustomImportModal.spec.ts` → 3 pass. `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/CustomImportModal.vue tests/components/CustomImportModal.spec.ts
git commit -m "feat(shopping): CustomImportModal — paste + Analyser/Importer/Vider"
```

---

## Task 6: Wire the planner — button, badge, Inconnu panel

**Files:**
- Modify: `src/components/AppPurchasePlanner.vue`
- Test: `tests/components/AppPurchasePlanner-custom.spec.ts` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `tests/components/AppPurchasePlanner-custom.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppPurchasePlanner from '@/components/AppPurchasePlanner.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useCustomShoppingStore } from '@/stores/customShopping';
import { populateCache } from '@/composables/useItemCatalog';

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

describe('AppPurchasePlanner — custom', () => {
  it('shows the Import custom button and opens the modal', async () => {
    useUiStore().setViewMode('purchase');
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    const btn = w.find('[data-testid="open-custom-import"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    expect(w.find('[data-testid="custom-textarea"]').exists()).toBe(true);
  });

  it('renders the Inconnu panel with the unknown names', async () => {
    useUiStore().setViewMode('purchase');
    useCustomShoppingStore().setEntries([{ name: 'Truc Inconnu', itemId: null }]);
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.text()).toContain('Inconnu');
    expect(w.text()).toContain('Truc Inconnu');
  });

  it('badges a custom-injected item', async () => {
    populateCache([{ id: 900, name: 'Dragolyre', levelRequired: 32, iconUrl: '', stats: [], typeId: 1 }]);
    useUiStore().setViewMode('purchase');
    useBuildStore().replaceCards([{
      id: 'c1', classId: 'iop', level: 1, title: null,
      slots: Object.fromEntries(['coiffe','cape','amulette','anneau1','anneau2','ceinture','bottes','arme','bouclier','familier'].map((s) => [s, null])) as never,
      dofus: [null, null, null, null, null, null],
    }]);
    useCustomShoppingStore().setEntries([{ name: 'Dragolyre', itemId: 900 }]);
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.find('[data-testid="custom-badge"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/components/AppPurchasePlanner-custom.spec.ts`
Expected: FAIL — no button / Inconnu panel / badge yet.

- [ ] **Step 3: Script changes in AppPurchasePlanner.vue**

Add imports + state in `<script setup>`:

```ts
import CustomImportModal from './CustomImportModal.vue';
```

Add a ref near the other refs (e.g. after `const list = useShoppingList();`):

```ts
const customModalOpen = ref(false);
```

Update the empty-state computed so a custom-only list still shows the planner:

```ts
const hasAnything = computed(() => list.value.totals.items > 0 || list.value.unknown.length > 0);
```

- [ ] **Step 4: Template — button, modal, Inconnu panel, badge**

(a) Add the **Import custom** button next to the global-total pill. Replace the existing total-pill wrapper:

```vue
        <!-- Global total + custom import -->
        <div class="mx-4 flex items-center justify-center gap-3">
          <span class="inline-flex items-center gap-2 rounded-full border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.08] px-4 py-1.5">
            <span class="font-mono font-extrabold text-[15px] text-[#8AE0EE] tabular-nums">{{ list.totals.units }}</span>
            <span class="font-sans font-bold text-[11px] text-text-muted tracking-[0.08em] uppercase">
              {{ list.totals.units > 1 ? 'items à acheter' : 'item à acheter' }}
            </span>
          </span>
          <button
            type="button"
            data-testid="open-custom-import"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-full border border-[#5DCFE0]/40 text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
            @click="customModalOpen = true"
          >Import custom</button>
        </div>
```

(b) Add a `custom` marker to each item row. Inside the item `<button data-testid="item-name" ...>`, after the `<span class="truncate ...">{{ item.name }}</span>` line, add:

```vue
                    <span
                      v-if="list.customItemIds.has(item.id)"
                      data-testid="custom-badge"
                      class="flex-shrink-0 mr-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-[0.06em] bg-[#5DCFE0]/[0.18] text-[#8AE0EE] border border-[#5DCFE0]/40"
                    >custom</span>
```

(c) Add the **Inconnu** panel right after the rooms `v-for` div closes (after the `</div>` that ends the `v-for="room in visibleRooms"` block, still inside the `flex flex-col gap-6` wrapper):

```vue
        <div
          v-if="list.unknown.length > 0"
          class="mx-4 rounded-xl border border-danger/40 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-5 py-4"
          style="background: rgba(8,8,8,0.2);"
        >
          <header class="mb-3">
            <h2 class="font-sans font-bold text-[12px] text-danger-soft tracking-[0.1em] uppercase">Inconnu</h2>
          </header>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="(name, i) in list.unknown"
              :key="`unknown-${i}`"
              class="text-[13px] font-sans text-text-default bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5"
            >{{ name }}</li>
          </ul>
        </div>
```

(d) Mount the modal once, just before the closing `</section>` of the planner root (outside the `v-if/v-else`, so it works even in the empty state):

```vue
    <CustomImportModal :open="customModalOpen" @close="customModalOpen = false" />
```

- [ ] **Step 5: Run → pass + full suite + type-check**

Run: `npx vitest run tests/components/AppPurchasePlanner-custom.spec.ts` → 3 pass.
Run: `npx vitest run` → full suite green.
Run: `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`. Go to Shopping → click **Import custom** → paste:
```
nom;type;niveau
Alliance de Silimelle;Anneau;26
Dragolyre;Amulette;32
Truc Bidon Inexistant
```
Click **Analyser** → shows "2 valides · 1 invalide" + "Truc Bidon Inexistant". Click **Importer** → the two items appear in their room/NPC columns with a "custom" badge, "Truc Bidon Inexistant" appears in the Inconnu panel, and a toast reports the counts. Reload the page → the custom list persists. Click **Import custom → Vider** → custom items + Inconnu panel disappear.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppPurchasePlanner.vue tests/components/AppPurchasePlanner-custom.spec.ts
git commit -m "feat(shopping): Import custom button, custom badge, Inconnu panel"
```

---

## Self-review checklist

1. **Spec coverage:**
   - Persistent one-list store → Task 1.
   - CSV/plain name parsing → Task 3 `parseCustomLines`.
   - Batch resolution (one request) → Task 3 `resolveCustomNames` (uses `fetchItemsByNames`).
   - typeId→room/NPC routing → Task 2 `routeItemByType`.
   - Inject into tables + dedup vs card items + `unknown` + `customItemIds` → Task 4.
   - "Inconnu" panel (flat, bottom) → Task 6 (c).
   - Custom badge → Task 6 (b).
   - Analyser (counts, no import) / Importer (apply) / Vider → Task 5.
   - Counts: custom = 1, totals include them → Task 4 (existing totals loop).
   - Empty-state shows planner for custom-only/unknown-only → Task 6 step 3.
2. **Placeholder scan:** none — every step has full code + exact commands. The two `<!-- ... -->` in Task 6 refer to existing template lines being inserted near, not omitted new code.
3. **Type/name consistency:** `CustomEntry { name, itemId|null }`, `useCustomShoppingStore` (`entries`/`setEntries`/`clear`), `parseCustomLines`, `resolveCustomNames`, `routeItemByType`, `ShoppingList.unknown` + `customItemIds` — all used identically across tasks. `fetchItemsByNames`, `ensureItems`, `getCachedItem`, `ensureItem`, `bucket`, `levelToRoom`, `slotToNpc`, `TYPE_ID_TO_SLOT`, `RING_TYPE_ID` match existing signatures.
