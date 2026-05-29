# Équiper une panoplie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Équiper une panoplie" kebab action that opens the item picker in a set-search mode (DofusDB `/item-sets`), and on click equips all the set's pieces onto the card.

**Architecture:** A new `fetchItemSets` data function (the `/item-sets` response embeds member items). A new `useItemSetSearch` composable mirroring `useItemSearch`. A new `equipItemSet` build-store action that maps each piece's `typeId` to a slot and overwrites it (rings handled specially). `ItemPickerPopover` branches on a new `{ kind: 'set' }` target. Kebab wiring in `CardHeader` + `EquipmentCard`.

**Tech Stack:** Vue 3 (Composition API), Pinia, TypeScript, Vitest + Vue Test Utils, jsdom, @vueuse/core (`useDebounceFn`).

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/data/dofusdb.ts` | modify | `ItemSetSummary` type + `fetchItemSets(opts)` hitting `/item-sets`. |
| `src/stores/build.ts` | modify | `equipItemSet(cardId, itemIds)` + reverse typeId→slot map. |
| `src/stores/ui.ts` | modify | Extend `ItemPickerTarget` with `{ kind: 'set'; cardId }`. |
| `src/composables/useItemSetSearch.ts` | new | Debounced paginated set search; same return shape as `useItemSearch`, gated by an `enabled` ref. |
| `src/components/ItemPickerPopover.vue` | modify | Branch into set mode: title, search source, row rendering, pick handler; hide range + filter/sort bars. |
| `src/components/CardHeader.vue` | modify | New menu button + `equip-set` emit. |
| `src/components/EquipmentCard.vue` | modify | Handle `@equip-set` → open picker with `kind: 'set'`. |
| `tests/data/dofusdb-sets.spec.ts` | new | `fetchItemSets` mapping (mock `fetch`). |
| `tests/stores/build-set.spec.ts` | new | `equipItemSet` unit tests. |
| `tests/composables/useItemSetSearch.spec.ts` | new | Debounce + pagination (mock `fetchItemSets`). |
| `tests/components/ItemPickerPopover-set.spec.ts` | new | Set-mode smoke: title, rows, click→equip+close. |

---

## Task 1: Data layer — `fetchItemSets`

**Files:**
- Modify: `src/data/dofusdb.ts`
- Test: `tests/data/dofusdb-sets.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/data/dofusdb-sets.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchItemSets } from '@/data/dofusdb';

const RAW_RESPONSE = {
  total: 1,
  data: [
    {
      id: 1,
      name: { fr: 'Panoplie du Bouftou', en: 'Gobball Set' },
      level: 20,
      items: [
        { id: 2411, typeId: 16, level: 20 },
        { id: 2412, typeId: 17, level: 18 },
        { id: 2413, typeId: 9, level: 15 },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchItemSets', () => {
  it('maps the raw /item-sets response to ItemSetSummary[]', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => RAW_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const sets = await fetchItemSets({ search: 'bouftou', limit: 20 });

    expect(sets).toEqual([
      { id: 1, name: 'Panoplie du Bouftou', level: 20, itemIds: [2411, 2412, 2413] },
    ]);
    // typeId / level on members are not part of the summary — only ids.
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/item-sets?');
    expect(url).toContain('slug.fr%5B%24search%5D=bouftou');
    expect(url).toContain('%24limit=20');
  });

  it('falls back to name.en then empty string, and tolerates missing items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 2, name: { en: 'Only EN' } }] }),
    }));
    const sets = await fetchItemSets({ search: '', limit: 20 });
    expect(sets).toEqual([{ id: 2, name: 'Only EN', level: 0, itemIds: [] }]);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchItemSets({ search: 'x', limit: 20 })).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/dofusdb-sets.spec.ts`
Expected: FAIL — `fetchItemSets` is not exported.

- [ ] **Step 3: Implement the type + function**

In `src/data/dofusdb.ts`, add the type after the `Item` interface (after line 48):

```ts
/** A panoplie summary from the /item-sets endpoint. The endpoint embeds the
 *  member items, so `itemIds` comes from that list — no second fetch needed. */
export interface ItemSetSummary {
  id: number;
  name: string;
  level: number;
  itemIds: number[];
}

interface RawItemSet {
  id: number;
  name?: { fr?: string; en?: string };
  level?: number;
  items?: { id: number }[];
}
```

Add the fetch function after `fetchItem` (after line 190):

```ts
export interface FetchItemSetsOpts {
  search: string;
  limit: number;
  skip?: number;
}

export async function fetchItemSets(opts: FetchItemSetsOpts): Promise<ItemSetSummary[]> {
  const params = new URLSearchParams();
  params.append('$limit', String(opts.limit));
  if (opts.skip && opts.skip > 0) params.append('$skip', String(opts.skip));
  params.append('$sort', '-level');
  const normalizedSearch = normalizeSearch(opts.search);
  if (normalizedSearch.length > 0) {
    params.append('slug.fr[$search]', normalizedSearch);
  }
  const url = `${BASE_URL}/item-sets?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItemSet[] };
  return (json.data ?? []).map((raw) => ({
    id: raw.id,
    name: raw.name?.fr ?? raw.name?.en ?? '',
    level: raw.level ?? 0,
    itemIds: (raw.items ?? []).map((i) => i.id),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/dofusdb-sets.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/dofusdb.ts tests/data/dofusdb-sets.spec.ts
git commit -m "feat(data): fetchItemSets — search panoplies via DofusDB /item-sets"
```

---

## Task 2: Build store — `equipItemSet`

**Files:**
- Modify: `src/stores/build.ts`
- Test: `tests/stores/build-set.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/stores/build-set.spec.ts`:

```ts
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
    // nothing equipped
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/build-set.spec.ts`
Expected: FAIL — `s.equipItemSet is not a function`.

- [ ] **Step 3: Implement `equipItemSet`**

In `src/stores/build.ts`, add this import alongside the existing ones (the file already imports `SLOT_ORDER, type SlotType, DOFUS_COUNT` from `@/types/slots` and `getCachedItem` from `@/composables/useItemCatalog`):

```ts
import { SLOT_TO_TYPE_IDS } from '@/data/dofusdb';
```

Add this module-level constant after the imports (before `useBuildStore`):

```ts
// typeId → slot, EXCLUDING the two ring slots (typeId 9 maps to both, handled
// separately in equipItemSet). Every other typeId maps to exactly one slot.
const RING_TYPE_ID = 9;
const TYPE_ID_TO_SLOT: Record<number, SlotType> = (() => {
  const map: Record<number, SlotType> = {};
  for (const slot of SLOT_ORDER) {
    if (slot === 'anneau1' || slot === 'anneau2') continue;
    for (const tid of SLOT_TO_TYPE_IDS[slot]) map[tid] = slot;
  }
  return map;
})();
```

Add the action inside `defineStore('build', () => { ... })` after `setSlot` (after line 62):

```ts
  /** Equip a full panoplie. Each piece overwrites its homologous slot; slots not
   *  covered by the set are left intact. Rings (typeId 9): one ring goes to the
   *  first empty ring slot (else overwrites anneau1); two rings fill both slots.
   *  Pieces whose typeId maps to no slot, or items absent from the cache, are
   *  skipped (the caller warms the cache beforehand). */
  function equipItemSet(cardId: string, itemIds: number[]): void {
    const idx = findIndex(cardId);
    const card = cards.value[idx];
    const rings: number[] = [];
    for (const id of itemIds) {
      const item = getCachedItem(id);
      if (!item) continue;
      if (item.typeId === RING_TYPE_ID) {
        rings.push(id);
        continue;
      }
      const slot = TYPE_ID_TO_SLOT[item.typeId];
      if (!slot) continue;
      card.slots[slot] = { itemId: id };
    }
    if (rings.length === 1) {
      if (card.slots.anneau1 === null) card.slots.anneau1 = { itemId: rings[0] };
      else if (card.slots.anneau2 === null) card.slots.anneau2 = { itemId: rings[0] };
      else card.slots.anneau1 = { itemId: rings[0] };
    } else if (rings.length >= 2) {
      card.slots.anneau1 = { itemId: rings[0] };
      card.slots.anneau2 = { itemId: rings[1] };
    }
  }
```

Add `equipItemSet` to the `return { ... }` block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/build-set.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/build.ts tests/stores/build-set.spec.ts
git commit -m "feat(build-store): equipItemSet — bulk-equip a panoplie onto a card"
```

---

## Task 3: UI store — `set` picker target

**Files:**
- Modify: `src/stores/ui.ts`

- [ ] **Step 1: Extend the discriminated union**

In `src/stores/ui.ts`, change the `ItemPickerTarget` type (lines 6-8) to:

```ts
export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number }
  | { kind: 'set'; cardId: string };
```

No other change — `openItemPicker(target: ItemPickerTarget)` already accepts any variant.

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS. (If `vue-tsc` flags exhaustiveness in `ItemPickerPopover.vue` switch-like logic, that's handled in Task 5 — for now the union extension alone must compile. If it errors only inside ItemPickerPopover, proceed; Task 5 fixes it. Re-run after Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/stores/ui.ts
git commit -m "feat(ui-store): add { kind: 'set' } item-picker target"
```

---

## Task 4: `useItemSetSearch` composable

**Files:**
- Create: `src/composables/useItemSetSearch.ts`
- Test: `tests/composables/useItemSetSearch.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useItemSetSearch.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';

const fetchItemSets = vi.fn();
vi.mock('@/data/dofusdb', () => ({ fetchItemSets: (...a: unknown[]) => fetchItemSets(...a) }));

import { useItemSetSearch } from '@/composables/useItemSetSearch';

beforeEach(() => {
  vi.useFakeTimers();
  fetchItemSets.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

function makeSets(ids: number[]) {
  return ids.map((id) => ({ id, name: `Set ${id}`, level: id, itemIds: [id * 10] }));
}

describe('useItemSetSearch', () => {
  it('does not fetch while disabled', async () => {
    const search = ref('bouftou');
    const enabled = ref(false);
    useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchItemSets).not.toHaveBeenCalled();
  });

  it('fetches the first page when enabled and populates results', async () => {
    fetchItemSets.mockResolvedValue(makeSets([1, 2]));
    const search = ref('bouftou');
    const enabled = ref(true);
    const { results, loading, hasMore } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(fetchItemSets).toHaveBeenCalledTimes(1);
    expect(results.value.map((s) => s.id)).toEqual([1, 2]);
    expect(loading.value).toBe(false);
    // page of 2 < PAGE_SIZE → no more
    expect(hasMore.value).toBe(false);
  });

  it('loadMore appends the next page and dedupes by id', async () => {
    const page1 = makeSets(Array.from({ length: 50 }, (_, i) => i + 1)); // full page
    fetchItemSets.mockResolvedValueOnce(page1);
    const search = ref('a');
    const enabled = ref(true);
    const { results, hasMore, loadMore } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(hasMore.value).toBe(true);

    fetchItemSets.mockResolvedValueOnce(makeSets([50, 51, 52])); // 50 overlaps
    await loadMore();
    await nextTick();
    const ids = results.value.map((s) => s.id);
    expect(ids).toContain(51);
    expect(ids).toContain(52);
    // 50 appeared in page 1 already → not duplicated
    expect(ids.filter((x) => x === 50)).toHaveLength(1);
  });

  it('surfaces an error and clears results on fetch failure', async () => {
    fetchItemSets.mockRejectedValue(new Error('boom'));
    const search = ref('x');
    const enabled = ref(true);
    const { results, error } = useItemSetSearch(search, enabled);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(error.value).toBe('boom');
    expect(results.value).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/composables/useItemSetSearch.spec.ts`
Expected: FAIL — `Cannot find module '@/composables/useItemSetSearch'`.

- [ ] **Step 3: Implement the composable**

Create `src/composables/useItemSetSearch.ts`:

```ts
import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchItemSets, type ItemSetSummary } from '@/data/dofusdb';

const PAGE_SIZE = 50;

/** Search DofusDB item-sets (panoplies). Same return shape as useItemSearch so the
 *  picker can swap between them. `enabled` gates the network calls — the picker only
 *  flips it on in set mode, so slot/dofus mode never fires a set query. */
export function useItemSetSearch(search: Ref<string>, enabled: Ref<boolean>) {
  const results = ref<ItemSetSummary[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasMore = ref(false);

  async function fetchPage(skip: number): Promise<ItemSetSummary[]> {
    return fetchItemSets({ search: search.value, limit: PAGE_SIZE, skip });
  }

  const run = useDebounceFn(async () => {
    if (!enabled.value) return;
    loading.value = true;
    error.value = null;
    try {
      const sets = await fetchPage(0);
      results.value = sets;
      hasMore.value = sets.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      results.value = [];
      hasMore.value = false;
    } finally {
      loading.value = false;
    }
  }, 200);

  async function loadMore(): Promise<void> {
    if (!enabled.value || loading.value || loadingMore.value || !hasMore.value) return;
    loadingMore.value = true;
    try {
      const sets = await fetchPage(results.value.length);
      const seen = new Set(results.value.map((s) => s.id));
      const fresh = sets.filter((s) => !seen.has(s.id));
      results.value = [...results.value, ...fresh];
      hasMore.value = sets.length === PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      hasMore.value = false;
    } finally {
      loadingMore.value = false;
    }
  }

  watch([search, enabled], run, { immediate: true });

  return { results, loading, loadingMore, error, hasMore, loadMore };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/composables/useItemSetSearch.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/composables/useItemSetSearch.ts tests/composables/useItemSetSearch.spec.ts
git commit -m "feat(composable): useItemSetSearch — debounced paginated set search"
```

---

## Task 5: Picker set-mode branch

**Files:**
- Modify: `src/components/ItemPickerPopover.vue`
- Test: `tests/components/ItemPickerPopover-set.spec.ts` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `tests/components/ItemPickerPopover-set.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

// Mock the set-search composable so no network happens.
const setResults = ref([
  { id: 1, name: 'Panoplie du Bouftou', level: 20, itemIds: [101, 102] },
]);
vi.mock('@/composables/useItemSetSearch', () => ({
  useItemSetSearch: () => ({
    results: setResults,
    loading: ref(false),
    loadingMore: ref(false),
    error: ref<string | null>(null),
    hasMore: ref(false),
    loadMore: vi.fn(),
  }),
}));

// Spy on ensureItems; keep the rest of the catalog real.
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/composables/useItemCatalog', async (orig) => {
  const actual = await orig<typeof import('@/composables/useItemCatalog')>();
  return { ...actual, ensureItems: (...a: number[][]) => ensureItems(...a) };
});

import ItemPickerPopover from '@/components/ItemPickerPopover.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';

beforeEach(() => {
  setActivePinia(createPinia());
  ensureItems.mockClear();
});

describe('ItemPickerPopover — set mode', () => {
  it('shows the panoplie title and renders set rows', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    ui.openItemPicker({ kind: 'set', cardId: build.cards[0].id });
    const w = mount(ItemPickerPopover, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.text()).toContain('panoplie');
    expect(w.text()).toContain('Panoplie du Bouftou');
    expect(w.text()).toContain('2 pièces');
  });

  it('clicking a set ensures its items then equips them and closes', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    const equipSpy = vi.spyOn(build, 'equipItemSet');
    const cardId = build.cards[0].id;
    ui.openItemPicker({ kind: 'set', cardId });

    const w = mount(ItemPickerPopover, { attachTo: document.body });
    await w.vm.$nextTick();
    await w.find('[data-testid="set-row"]').trigger('click');
    await Promise.resolve(); // let the awaited ensureItems resolve
    await w.vm.$nextTick();

    expect(ensureItems).toHaveBeenCalledWith([101, 102]);
    expect(equipSpy).toHaveBeenCalledWith(cardId, [101, 102]);
    expect(ui.itemPickerTarget).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ItemPickerPopover-set.spec.ts`
Expected: FAIL — no "panoplie" title / no `[data-testid="set-row"]`.

- [ ] **Step 3: Wire set mode in the script**

In `src/components/ItemPickerPopover.vue` `<script setup>`:

Update the import line for the catalog to add `ensureItems`:

```ts
import { useItemSearch, isOverLeveled, getCachedItem, renderItemStatsMax, ensureItems, type SearchTarget } from '@/composables/useItemCatalog';
```

Add the set-search import:

```ts
import { useItemSetSearch } from '@/composables/useItemSetSearch';
import type { ItemSetSummary } from '@/data/dofusdb';
```

Add an `isSetMode` computed after `target` (after line 120):

```ts
const isSetMode = computed(() => target.value?.kind === 'set');
```

Update `slotForQuery` (lines 125-129) so set mode yields `null` (keeps `useItemSearch` idle):

```ts
const slotForQuery = computed<SearchTarget>(() => {
  if (!target.value) return null;
  if (target.value.kind === 'slot') return target.value.slot;
  if (target.value.kind === 'dofus') return 'dofus';
  return null; // set mode → item search idle, set search drives results
});
```

Add the set search wiring after the `useItemSearch` call (after line 220):

```ts
const setSearch = useItemSetSearch(search, isSetMode);
const equipping = ref(false);
const equipError = ref<string | null>(null);

async function pickSet(set: ItemSetSummary): Promise<void> {
  if (!target.value || target.value.kind !== 'set') return;
  equipping.value = true;
  equipError.value = null;
  try {
    await ensureItems(set.itemIds);
    build.equipItemSet(target.value.cardId, set.itemIds);
    ui.closeItemPicker();
  } catch (e) {
    equipError.value = e instanceof Error ? e.message : String(e);
  } finally {
    equipping.value = false;
  }
}
```

Update `sheetTitle` (lines 270-274) to add the set branch:

```ts
const sheetTitle = computed(() => {
  if (!target.value) return '';
  if (target.value.kind === 'set') return 'Choisir une panoplie';
  if (target.value.kind === 'slot') return `Choisir ${SLOT_PICK_PHRASE[target.value.slot]}`;
  return `Choisir un dofus / trophée`;
});
```

- [ ] **Step 4: Wire set mode in the template**

In `ItemPickerPopover.vue` template:

Hide the Tranche (range) row and the filter/sort row in set mode. Add `v-if="!isSetMode"` to the range `<div>` (the one opening at line 379 `class="px-5 py-3 border-b border-border-subtle flex items-center gap-3"`) and to the filter/sort `<div>` (line 428 `class="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border-subtle"`).

Replace the list body. Find the list container `<div ref="listRef" ...>` (line 455). Inside it, wrap the EXISTING item-list content (skeleton + error + "Aucun item" + the `v-for="it in filtered"` button + the loadingMore sentinel) in a `<template v-if="!isSetMode"> ... </template>`, and add a set branch after it:

```vue
      <div ref="listRef" class="flex-1 overflow-y-auto px-2 py-1.5 thin-scroll" @scroll.passive="onListScroll">
        <template v-if="!isSetMode">
          <!-- ...existing skeleton / error / empty / item rows / loadingMore... -->
        </template>
        <template v-else>
          <p v-if="setSearch.loading.value" class="font-sans text-xs text-text-dim px-3 py-4">Chargement…</p>
          <p v-else-if="equipError" class="font-sans text-xs text-danger-soft px-3 py-4">Erreur&nbsp;: {{ equipError }}</p>
          <p v-else-if="setSearch.error.value" class="font-sans text-xs text-danger-soft px-3 py-4">Erreur&nbsp;: {{ setSearch.error.value }}</p>
          <p v-else-if="setSearch.results.value.length === 0" class="font-sans text-xs text-text-dim px-3 py-4">Aucune panoplie.</p>
          <button
            v-else
            v-for="set in setSearch.results.value"
            :key="set.id"
            data-testid="set-row"
            type="button"
            class="item flex items-center justify-between gap-3 px-3 py-2.5 rounded-md w-full transition-colors hover:bg-[#8AE0EE]/[0.06] disabled:opacity-50"
            :disabled="equipping"
            @click="pickSet(set)"
          >
            <span class="font-sans text-xs font-medium text-text-default truncate text-left flex-1 min-w-0">{{ set.name }}</span>
            <span class="font-mono text-[10px] text-white/70 shrink-0">{{ set.itemIds.length }} pièces</span>
            <span class="font-mono text-[10px] text-white rounded px-2 py-0.5 border border-border-default bg-bg-page shrink-0">Niv. {{ set.level }}</span>
          </button>
        </template>
      </div>
```

Note: in `<script setup>`, composable refs accessed in the template normally auto-unwrap, but here `setSearch` is an object holding refs, so the template must use `setSearch.loading.value` etc. (as written above).

- [ ] **Step 5: Run the smoke test to verify it passes**

Run: `npx vitest run tests/components/ItemPickerPopover-set.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite + type-check (nothing else broke)**

Run: `npx vitest run`
Expected: PASS (all suites).

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ItemPickerPopover.vue tests/components/ItemPickerPopover-set.spec.ts
git commit -m "feat(picker): set-search mode — list panoplies, equip all on click"
```

---

## Task 6: Kebab wiring (CardHeader + EquipmentCard)

**Files:**
- Modify: `src/components/CardHeader.vue`
- Modify: `src/components/EquipmentCard.vue`

- [ ] **Step 1: Add the emit + handler in CardHeader**

In `src/components/CardHeader.vue`, add `'equip-set': [];` to the `defineEmits` block (lines 17-24):

```ts
const emit = defineEmits<{
  'open-class-picker': [];
  'update:level': [value: number | null];
  'update:title': [value: string | null];
  'remove': [];
  'open-dofusbook': [];
  'copy-code': [];
  'equip-set': [];
}>();
```

Add the handler alongside the existing menu handlers (near lines 83-85, where `onMenuCopyCode` etc. live):

```ts
function onMenuEquipSet(): void { closeMenu(); emit('equip-set'); }
```

- [ ] **Step 2: Add the menu button (hidden in readonly)**

In `CardHeader.vue` template, add this button inside the menu `<div role="menu">`, right after the "Ouvrir Dofusbook" button (after line 255, before the `v-if="!readonly"` Supprimer button):

```vue
        <button
          v-if="!readonly"
          data-testid="card-menu-equip-set"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-text-default hover:bg-[#5DCFE0]/[0.08] hover:text-[#8AE0EE] transition-colors"
          @click.stop="onMenuEquipSet"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          Équiper une panoplie
        </button>
```

- [ ] **Step 3: Handle the event in EquipmentCard**

In `src/components/EquipmentCard.vue`, find the `<CardHeader ... />` usage (around lines 173-185) and add the handler binding alongside `@copy-code="onCopyCode"`:

```vue
      @equip-set="onEquipSet"
```

Add the handler function in `<script setup>` (near the other `on*` handlers, e.g. after `onCopyCode`):

```ts
function onEquipSet(): void {
  if (props.readonly) return;
  ui.openItemPicker({ kind: 'set', cardId: props.card.id });
}
```

- [ ] **Step 4: Run the full suite + type-check**

Run: `npx vitest run`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke in the dev server**

Run: `npm run dev`

Verify in the browser:
1. Open a card's `...` menu → "Équiper une panoplie" entry is present (and absent on a readonly/Reader card).
2. Click it → the picker opens with title "Choisir une panoplie"; the Tranche toggle and the ≤Lv/Tous + sort bars are hidden.
3. Type "bouftou" → set rows appear (name + N pièces + Niv. X).
4. Click a set → all its pieces equip onto the card (matching slots overwritten); picker closes; stats panel + panoplie bonus update.
5. A set with one ring fills an empty ring slot; with two rings fills both.
6. A piece above the card level shows the red over-level dot but is still equipped.

- [ ] **Step 6: Commit**

```bash
git add src/components/CardHeader.vue src/components/EquipmentCard.vue
git commit -m "feat(card): 'Équiper une panoplie' kebab action opens the set picker"
```

---

## Self-review checklist

1. **Spec coverage:**
   - Entry point / kebab button (decision 1) → Task 6.
   - Picker reuse + `set` target (decision 2) → Task 3 (union) + Task 5 (branch).
   - Set result rows name/level/pièces (decision 3) → Task 5 template.
   - Equip-all overwrites matching slots, others intact (decision 4) → Task 2 + tests.
   - Over-level equipped anyway (decision 5) → Task 2 doesn't filter; Task 6 manual step 6 verifies the red dot.
   - Ring rules (decision 6) → Task 2 tests cover all four ring cases.
   - Unknown-typeId pieces skipped (decision 7) → Task 2 test "ignores a piece whose typeId maps to no slot".
   - Range mode disabled for sets (decision 8) → Task 5 step 4 `v-if="!isSetMode"`.
   - Data: `/item-sets` embeds members → Task 1.
   - Orchestration: `ensureItems` then `equipItemSet` → Task 5 `pickSet`.
2. **Placeholder scan:** No TBD/TODO; every code step has full code; the one "...existing..." marker in Task 5 step 4 explicitly refers to wrapping already-present template lines, not omitted new code.
3. **Type/name consistency:** `ItemSetSummary` (id, name, level, itemIds) used identically in Tasks 1, 4, 5. `fetchItemSets(opts)`, `useItemSetSearch(search, enabled)`, `equipItemSet(cardId, itemIds)`, `{ kind: 'set'; cardId }` consistent across tasks. `ensureItems(ids: number[])` matches the existing signature in `useItemCatalog.ts`.
