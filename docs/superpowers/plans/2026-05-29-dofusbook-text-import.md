# Dofusbook text import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a Dofusbook build page's raw text and create a new card with its class, level, title, and equipped items (resolved against the DofusDB API by name).

**Architecture:** A pure parser extracts class/level/title + item names from the pasted page text using stable FR anchors. A resolver searches DofusDB by name, maps each item's `typeId` to a slot (rings → anneau1/2, dofus+trophée → dofus[]), and warms the catalog cache. The existing `CardCodeImportModal` gains a "Dofusbook" mode that wires parse → resolve → `addCardAfter` + a summary toast.

**Tech Stack:** Vue 3 (Composition API), Pinia, TypeScript, Vitest + Vue Test Utils, jsdom.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/utils/typeIdSlots.ts` | new | Shared `TYPE_ID_TO_SLOT` reverse map + `RING_TYPE_ID`/`DOFUS_TYPE_ID`/`TROPHEE_TYPE_ID` constants. |
| `src/stores/build.ts` | modify | Import the shared map instead of its local copy (no behaviour change). |
| `src/data/dofusdb.ts` | modify | Export `normalizeSearch`; add `searchItemsByName`. |
| `src/utils/dofusbookParse.ts` | new | Pure parser: page text → `{ classId, level, title, itemNames }`. |
| `src/composables/useDofusbookImport.ts` | new | Async resolver: item names → `{ slots, dofus, unresolved, resolvedCount }`. |
| `src/components/CardCodeImportModal.vue` | modify | Mode selector (Code / Dofusbook) + Dofusbook submit flow. |
| `tests/fixtures/dofusbook-extract.txt` | exists | Real page text fixture (already committed). |
| `tests/utils/typeIdSlots.spec.ts` | new | Map correctness. |
| `tests/data/dofusdb-search.spec.ts` | new | `searchItemsByName`. |
| `tests/utils/dofusbookParse.spec.ts` | new | Parser (incl. fixture). |
| `tests/composables/useDofusbookImport.spec.ts` | new | Resolver. |
| `tests/components/CardCodeImportModal-dofusbook.spec.ts` | new | Modal smoke. |

---

## Task 1: Shared typeId→slot map

**Files:**
- Create: `src/utils/typeIdSlots.ts`
- Modify: `src/stores/build.ts`
- Test: `tests/utils/typeIdSlots.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/utils/typeIdSlots.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TYPE_ID_TO_SLOT, RING_TYPE_ID, DOFUS_TYPE_ID, TROPHEE_TYPE_ID } from '@/utils/typeIdSlots';

describe('typeIdSlots', () => {
  it('maps equipment typeIds to their slot', () => {
    expect(TYPE_ID_TO_SLOT[16]).toBe('coiffe');
    expect(TYPE_ID_TO_SLOT[17]).toBe('cape');
    expect(TYPE_ID_TO_SLOT[1]).toBe('amulette');
    expect(TYPE_ID_TO_SLOT[10]).toBe('ceinture');
    expect(TYPE_ID_TO_SLOT[11]).toBe('bottes');
    expect(TYPE_ID_TO_SLOT[2]).toBe('arme');
    expect(TYPE_ID_TO_SLOT[82]).toBe('bouclier');
    expect(TYPE_ID_TO_SLOT[18]).toBe('familier');
  });

  it('excludes the ring typeId (handled separately)', () => {
    expect(TYPE_ID_TO_SLOT[RING_TYPE_ID]).toBeUndefined();
  });

  it('exposes ring / dofus / trophée typeId constants', () => {
    expect(RING_TYPE_ID).toBe(9);
    expect(DOFUS_TYPE_ID).toBe(23);
    expect(TROPHEE_TYPE_ID).toBe(151);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/utils/typeIdSlots.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shared module**

Create `src/utils/typeIdSlots.ts`:

```ts
import { SLOT_ORDER, type SlotType } from '@/types/slots';
import { SLOT_TO_TYPE_IDS } from '@/data/dofusdb';

/** Ring slots share this typeId (anneau1 + anneau2) — handled separately from the map. */
export const RING_TYPE_ID = 9;
/** Dofus / Trophée live in the positional dofus[] bucket, not a named slot. */
export const DOFUS_TYPE_ID = 23;
export const TROPHEE_TYPE_ID = 151;

/** typeId → equipment slot, EXCLUDING the two ring slots (typeId 9 maps to both,
 *  handled separately by callers). Every other equipment typeId maps to exactly
 *  one slot; the multi-typeId `arme` / `familier` slots fold all their typeIds in. */
export const TYPE_ID_TO_SLOT: Record<number, SlotType> = (() => {
  const map: Record<number, SlotType> = {};
  for (const slot of SLOT_ORDER) {
    if (slot === 'anneau1' || slot === 'anneau2') continue;
    for (const tid of SLOT_TO_TYPE_IDS[slot]) map[tid] = slot;
  }
  return map;
})();
```

- [ ] **Step 4: Refactor build.ts to use it**

In `src/stores/build.ts`, REMOVE the local declarations (lines ~14-24):

```ts
// typeId → slot, EXCLUDING the two ring slots ...
const RING_TYPE_ID = 9;
const TYPE_ID_TO_SLOT: Record<number, SlotType> = (() => { ... })();
```

Replace the now-unused `SLOT_TO_TYPE_IDS` import with the shared map. Change the import line `import { SLOT_TO_TYPE_IDS } from '@/data/dofusdb';` to:

```ts
import { RING_TYPE_ID, TYPE_ID_TO_SLOT } from '@/utils/typeIdSlots';
```

`equipItemSet` keeps using `RING_TYPE_ID` and `TYPE_ID_TO_SLOT` exactly as before — now imported.

- [ ] **Step 5: Run → pass + no regression**

Run: `npx vitest run tests/utils/typeIdSlots.spec.ts tests/stores/build-set.spec.ts`
Expected: PASS (the existing 11 equipItemSet tests still pass — they guard the refactor).

Run: `npx vue-tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/typeIdSlots.ts src/stores/build.ts tests/utils/typeIdSlots.spec.ts
git commit -m "refactor: extract shared typeId→slot map to utils/typeIdSlots"
```

---

## Task 2: DofusDB name search

**Files:**
- Modify: `src/data/dofusdb.ts`
- Test: `tests/data/dofusdb-search.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/data/dofusdb-search.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchItemsByName } from '@/data/dofusdb';

afterEach(() => vi.unstubAllGlobals());

describe('searchItemsByName', () => {
  it('queries /items by normalized name and maps results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 694, name: { fr: 'Dofus Pourpre' }, typeId: 23, level: 110 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await searchItemsByName('Dofus Pourpre');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 694, name: 'Dofus Pourpre', typeId: 23, levelRequired: 110 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/items?');
    expect(url).toContain('slug.fr%5B%24search%5D=dofus%20pourpre');
    expect(url).toContain('%24limit=5');
  });

  it('omits the search param when the name is blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await searchItemsByName('   ');
    expect(fetchMock.mock.calls[0][0] as string).not.toContain('slug.fr');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchItemsByName('x')).rejects.toThrow(/503/);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/data/dofusdb-search.spec.ts`
Expected: FAIL — `searchItemsByName` not exported.

- [ ] **Step 3: Implement**

In `src/data/dofusdb.ts`:

Export the existing `normalizeSearch` (change `function normalizeSearch` to `export function normalizeSearch`).

Add after `fetchItem` (the function returns `mapItem`-ed items; `BASE_URL`, `RawItem`, `mapItem`, `normalizeSearch` already exist in the file):

```ts
/** Search items across ALL types by name (no typeId filter) — used by the Dofusbook
 *  text importer, which knows only item names. Sorted by descending level. */
export async function searchItemsByName(name: string, limit = 5): Promise<Item[]> {
  const params = new URLSearchParams();
  params.append('$limit', String(limit));
  params.append('$sort', '-level');
  const q = normalizeSearch(name);
  if (q.length > 0) params.append('slug.fr[$search]', q);
  const res = await fetch(`${BASE_URL}/items?${params.toString()}`);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItem[] };
  return (json.data ?? []).map(mapItem);
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/data/dofusdb-search.spec.ts`
Expected: PASS (3 tests). Then `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/dofusdb.ts tests/data/dofusdb-search.spec.ts
git commit -m "feat(data): searchItemsByName + export normalizeSearch"
```

---

## Task 3: Pure parser

**Files:**
- Create: `src/utils/dofusbookParse.ts`
- Test: `tests/utils/dofusbookParse.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/utils/dofusbookParse.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDofusbookText } from '@/utils/dofusbookParse';

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/dofusbook-extract.txt', import.meta.url)),
  'utf8',
);

describe('parseDofusbookText', () => {
  it('parses class, level, title from the header', () => {
    const r = parseDofusbookText(fixture);
    expect(r.classId).toBe('feca');
    expect(r.level).toBe(133);
    expect(r.title).toBe('Draegnerys');
  });

  it('extracts the 16 equipped item names in order', () => {
    const r = parseDofusbookText(fixture);
    expect(r.itemNames).toHaveLength(16);
    expect(r.itemNames[0]).toBe('Torque Ancestral');
    expect(r.itemNames).toContain('Bouclier des Brigandins');
    expect(r.itemNames).toContain('Bulbisou');
    expect(r.itemNames).toContain('Dofus Pourpre');
    expect(r.itemNames[r.itemNames.length - 1]).toBe('Ravageur Terre');
  });

  it('parses a simple header', () => {
    const r = parseDofusbookText('Iop 200 - Mon Iop\n\nForgemagie\nRésumé du stuff');
    expect(r.classId).toBe('iop');
    expect(r.level).toBe(200);
    expect(r.title).toBe('Mon Iop');
  });

  it('returns nulls + empty names for unrecognized text', () => {
    const r = parseDofusbookText('just some random text\nwith no anchors');
    expect(r.classId).toBeNull();
    expect(r.level).toBeNull();
    expect(r.title).toBeNull();
    expect(r.itemNames).toEqual([]);
  });

  it('drops exact-duplicate item names', () => {
    const text = 'Coiffe X\nForgemagie\nBoosts actifs (0)\nCoiffe X\nCape Y\nRésumé du stuff';
    const r = parseDofusbookText(text);
    // block1 (before Forgemagie): "Coiffe X"; block2: "Coiffe X" (dup, dropped), "Cape Y"
    expect(r.itemNames).toEqual(['Coiffe X', 'Cape Y']);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/utils/dofusbookParse.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/utils/dofusbookParse.ts`:

```ts
import type { ClassId } from '@/types/classes';
import { normalizeSearch } from '@/data/dofusdb';

// The 19 class ids, used to validate the header's class word (normalized).
const CLASS_IDS: ReadonlySet<string> = new Set<ClassId>([
  'iop', 'cra', 'sram', 'eniripsa', 'sadida', 'enutrof', 'sacrieur', 'ecaflip',
  'feca', 'xelor', 'pandawa', 'osamodas', 'roublard', 'zobal', 'steamer',
  'eliotrope', 'huppermage', 'ouginak', 'forgelance',
]);

export interface ParsedDofusbook {
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  itemNames: string[];
}

function clampLevel(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.min(200, Math.max(1, Math.round(n)));
}

function parseHeader(lines: string[]): Omit<ParsedDofusbook, 'itemNames'> {
  const re = /^(\p{L}+)\s+(\d{1,3})\s+-\s+(.+)$/u;
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const norm = normalizeSearch(m[1]);
    if (!CLASS_IDS.has(norm)) continue;
    const title = m[3].trim();
    return {
      classId: norm as ClassId,
      level: clampLevel(Number(m[2])),
      title: title.length > 0 ? title : null,
    };
  }
  return { classId: null, level: null, title: null };
}

function parseItemNames(lines: string[]): string[] {
  const idxForge = lines.findIndex((l) => l === 'Forgemagie');
  const idxBoosts = lines.findIndex((l) => l.startsWith('Boosts actifs'));
  const idxResume = lines.findIndex((l) => l === 'Résumé du stuff');
  const names: string[] = [];

  // Block 1: the run of non-empty lines ending just before "Forgemagie".
  if (idxForge !== -1) {
    let i = idxForge - 1;
    while (i >= 0 && lines[i] === '') i--; // skip the blank gap
    const block1: string[] = [];
    while (i >= 0 && lines[i] !== '') { block1.push(lines[i]); i--; }
    block1.reverse();
    names.push(...block1);
  }

  // Block 2: non-empty lines between "Boosts actifs" and "Résumé du stuff".
  if (idxBoosts !== -1 && idxResume !== -1 && idxResume > idxBoosts) {
    for (let i = idxBoosts + 1; i < idxResume; i++) {
      if (lines[i] !== '') names.push(lines[i]);
    }
  }

  // Drop exact-duplicate names, preserve first-seen order.
  const seen = new Set<string>();
  return names.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
}

export function parseDofusbookText(text: string): ParsedDofusbook {
  const lines = text.split('\n').map((l) => l.trim());
  return { ...parseHeader(lines), itemNames: parseItemNames(lines) };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/utils/dofusbookParse.spec.ts`
Expected: PASS (5 tests). Then `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dofusbookParse.ts tests/utils/dofusbookParse.spec.ts
git commit -m "feat(import): parse Dofusbook page text → class/level/title + item names"
```

---

## Task 4: Resolver

**Files:**
- Create: `src/composables/useDofusbookImport.ts`
- Test: `tests/composables/useDofusbookImport.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useDofusbookImport.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Item } from '@/data/dofusdb';

const searchItemsByName = vi.fn();
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/data/dofusdb', async (orig) => {
  const actual = await orig<typeof import('@/data/dofusdb')>();
  return { ...actual, searchItemsByName: (...a: unknown[]) => searchItemsByName(...a) };
});
vi.mock('@/composables/useItemCatalog', async (orig) => {
  const actual = await orig<typeof import('@/composables/useItemCatalog')>();
  return { ...actual, ensureItems: (...a: unknown[]) => ensureItems(...a) };
});

import { resolveDofusbookItems } from '@/composables/useDofusbookImport';

function item(id: number, name: string, typeId: number, level = 100): Item {
  return { id, name, levelRequired: level, iconUrl: '', stats: [], typeId };
}

beforeEach(() => {
  searchItemsByName.mockReset();
  ensureItems.mockClear();
});

describe('resolveDofusbookItems', () => {
  it('prefers an exact-name match over decoys', async () => {
    searchItemsByName.mockResolvedValue([
      item(20130, 'Réplique du Dofus Pourpre', 15),
      item(694, 'Dofus Pourpre', 23),
    ]);
    const r = await resolveDofusbookItems(['Dofus Pourpre']);
    expect(r.dofus[0]).toEqual({ itemId: 694 });
    expect(r.unresolved).toEqual([]);
  });

  it('places equipment in its homologous slot', async () => {
    searchItemsByName.mockImplementation((name: string) => {
      if (name === 'Coiffe') return Promise.resolve([item(1, 'Coiffe', 16)]);
      if (name === 'Cape') return Promise.resolve([item(2, 'Cape', 17)]);
      return Promise.resolve([]);
    });
    const r = await resolveDofusbookItems(['Coiffe', 'Cape']);
    expect(r.slots.coiffe).toEqual({ itemId: 1 });
    expect(r.slots.cape).toEqual({ itemId: 2 });
    expect(r.resolvedCount).toBe(2);
  });

  it('routes two rings to anneau1 then anneau2; a third is unresolved', async () => {
    searchItemsByName.mockImplementation((name: string) =>
      Promise.resolve([item(name === 'A' ? 10 : name === 'B' ? 11 : 12, name, 9)]));
    const r = await resolveDofusbookItems(['A', 'B', 'C']);
    expect(r.slots.anneau1).toEqual({ itemId: 10 });
    expect(r.slots.anneau2).toEqual({ itemId: 11 });
    expect(r.unresolved).toEqual(['C']);
  });

  it('fills dofus[] with dofus + trophée and overflows to unresolved', async () => {
    searchItemsByName.mockImplementation((name: string) => {
      const idx = Number(name);
      const typeId = idx % 2 === 0 ? 23 : 151; // mix dofus + trophée
      return Promise.resolve([item(100 + idx, name, typeId)]);
    });
    const names = ['0', '1', '2', '3', '4', '5', '6']; // 7 → last overflows
    const r = await resolveDofusbookItems(names);
    expect(r.dofus.filter(Boolean)).toHaveLength(6);
    expect(r.unresolved).toEqual(['6']);
  });

  it('marks a name with no result as unresolved', async () => {
    searchItemsByName.mockResolvedValue([]);
    const r = await resolveDofusbookItems(['Nope']);
    expect(r.unresolved).toEqual(['Nope']);
    expect(r.resolvedCount).toBe(0);
  });

  it('marks an item whose typeId maps to no slot as unresolved', async () => {
    searchItemsByName.mockResolvedValue([item(5, 'Cosmétique', 99)]);
    const r = await resolveDofusbookItems(['Cosmétique']);
    expect(r.unresolved).toEqual(['Cosmétique']);
  });

  it('warms the catalog cache with the resolved ids', async () => {
    searchItemsByName.mockResolvedValue([item(1, 'Coiffe', 16)]);
    await resolveDofusbookItems(['Coiffe']);
    expect(ensureItems).toHaveBeenCalledWith([1]);
  });

  it('treats a search failure for one name as unresolved without aborting', async () => {
    searchItemsByName.mockImplementation((name: string) =>
      name === 'Boom' ? Promise.reject(new Error('net')) : Promise.resolve([item(1, 'Coiffe', 16)]));
    const r = await resolveDofusbookItems(['Boom', 'Coiffe']);
    expect(r.unresolved).toEqual(['Boom']);
    expect(r.slots.coiffe).toEqual({ itemId: 1 });
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/composables/useDofusbookImport.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/composables/useDofusbookImport.ts`:

```ts
import { searchItemsByName, normalizeSearch, type Item } from '@/data/dofusdb';
import { ensureItems } from '@/composables/useItemCatalog';
import { SLOT_ORDER, DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { ItemRef } from '@/types/build';
import { TYPE_ID_TO_SLOT, RING_TYPE_ID, DOFUS_TYPE_ID, TROPHEE_TYPE_ID } from '@/utils/typeIdSlots';

export interface ResolvedBuild {
  slots: Record<SlotType, ItemRef | null>;
  dofus: (ItemRef | null)[];
  unresolved: string[];
  resolvedCount: number;
}

function isUsable(typeId: number): boolean {
  return typeId === RING_TYPE_ID
    || typeId === DOFUS_TYPE_ID
    || typeId === TROPHEE_TYPE_ID
    || TYPE_ID_TO_SLOT[typeId] !== undefined;
}

/** Pick the best result for a searched name: exact normalized-name match first,
 *  else the first result whose typeId is equippable; else null. */
function pickMatch(name: string, results: Item[]): Item | null {
  if (results.length === 0) return null;
  const norm = normalizeSearch(name);
  const exact = results.find((it) => normalizeSearch(it.name) === norm);
  if (exact) return exact;
  return results.find((it) => isUsable(it.typeId)) ?? null;
}

export async function resolveDofusbookItems(itemNames: string[]): Promise<ResolvedBuild> {
  const slots = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) slots[s] = null;
  const dofus: (ItemRef | null)[] = Array.from({ length: DOFUS_COUNT }, () => null);
  const unresolved: string[] = [];

  // Resolve all names in parallel (order preserved); a per-name failure → null.
  const matches = await Promise.all(
    itemNames.map(async (name) => {
      try {
        return pickMatch(name, await searchItemsByName(name));
      } catch {
        return null;
      }
    }),
  );

  // Assign in itemNames order so ring / dofus placement is deterministic.
  const resolvedIds: number[] = [];
  itemNames.forEach((name, i) => {
    const item = matches[i];
    if (!item) { unresolved.push(name); return; }
    if (item.typeId === RING_TYPE_ID) {
      if (slots.anneau1 === null) slots.anneau1 = { itemId: item.id };
      else if (slots.anneau2 === null) slots.anneau2 = { itemId: item.id };
      else { unresolved.push(name); return; }
    } else if (item.typeId === DOFUS_TYPE_ID || item.typeId === TROPHEE_TYPE_ID) {
      const free = dofus.findIndex((d) => d === null);
      if (free === -1) { unresolved.push(name); return; }
      dofus[free] = { itemId: item.id };
    } else {
      const slot = TYPE_ID_TO_SLOT[item.typeId];
      if (!slot) { unresolved.push(name); return; }
      if (slots[slot] !== null) { unresolved.push(name); return; } // keep first
      slots[slot] = { itemId: item.id };
    }
    resolvedIds.push(item.id);
  });

  if (resolvedIds.length > 0) await ensureItems(resolvedIds);
  return { slots, dofus, unresolved, resolvedCount: resolvedIds.length };
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run tests/composables/useDofusbookImport.spec.ts`
Expected: PASS (8 tests). Then `npx vue-tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDofusbookImport.ts tests/composables/useDofusbookImport.spec.ts
git commit -m "feat(import): resolve Dofusbook item names → slots via DofusDB"
```

---

## Task 5: Modal Dofusbook mode

**Files:**
- Modify: `src/components/CardCodeImportModal.vue`
- Test: `tests/components/CardCodeImportModal-dofusbook.spec.ts` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `tests/components/CardCodeImportModal-dofusbook.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const resolveDofusbookItems = vi.fn();
vi.mock('@/composables/useDofusbookImport', () => ({
  resolveDofusbookItems: (...a: unknown[]) => resolveDofusbookItems(...a),
}));

import CardCodeImportModal from '@/components/CardCodeImportModal.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';

function emptySlots() {
  return {
    coiffe: { itemId: 1 }, cape: null, amulette: null, anneau1: null, anneau2: null,
    ceinture: null, bottes: null, arme: null, bouclier: null, familier: null,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  resolveDofusbookItems.mockReset();
});

const SAMPLE = 'Feca 133 - Draegnerys\n\nForgemagie\nBoosts actifs (0)\nRésumé du stuff';

describe('CardCodeImportModal — Dofusbook mode', () => {
  it('switching to Dofusbook mode shows the paste textarea', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    ui.openCodeImport(build.cards[0].id);
    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    expect(w.find('[data-testid="dofusbook-textarea"]').exists()).toBe(true);
  });

  it('imports: parses header, resolves, creates a card, toasts', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    resolveDofusbookItems.mockResolvedValue({
      slots: emptySlots(),
      dofus: [null, null, null, null, null, null],
      unresolved: ['Forcené'],
      resolvedCount: 1,
    });
    const addSpy = vi.spyOn(build, 'addCardAfter');
    const afterId = build.cards[0].id;
    ui.openCodeImport(afterId);

    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    await w.find('[data-testid="dofusbook-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="import-submit"]').trigger('click');
    await flushPromises();

    expect(resolveDofusbookItems).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledTimes(1);
    const inserted = addSpy.mock.calls[0][1];
    expect(inserted.classId).toBe('feca');
    expect(inserted.level).toBe(133);
    expect(inserted.title).toBe('Draegnerys');
    expect(inserted.slots.coiffe).toEqual({ itemId: 1 });
    expect(ui.codeImportAfterCardId).toBeNull(); // modal closed
  });

  it('does not create a card when nothing resolves', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    resolveDofusbookItems.mockResolvedValue({
      slots: emptySlots(), dofus: [null, null, null, null, null, null],
      unresolved: ['X'], resolvedCount: 0,
    });
    // make slots all null for this case
    resolveDofusbookItems.mockResolvedValue({
      slots: { coiffe: null, cape: null, amulette: null, anneau1: null, anneau2: null,
        ceinture: null, bottes: null, arme: null, bouclier: null, familier: null },
      dofus: [null, null, null, null, null, null], unresolved: ['X'], resolvedCount: 0,
    });
    const addSpy = vi.spyOn(build, 'addCardAfter');
    ui.openCodeImport(build.cards[0].id);

    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    await w.find('[data-testid="dofusbook-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="import-submit"]').trigger('click');
    await flushPromises();

    expect(addSpy).not.toHaveBeenCalled();
    expect(ui.codeImportAfterCardId).not.toBeNull(); // still open, error shown
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/components/CardCodeImportModal-dofusbook.spec.ts`
Expected: FAIL — no mode buttons / testids.

- [ ] **Step 3: Implement the script changes**

In `src/components/CardCodeImportModal.vue` `<script setup>`, add imports:

```ts
import { randomId } from '@/utils/id';
import { parseDofusbookText } from '@/utils/dofusbookParse';
import { resolveDofusbookItems } from '@/composables/useDofusbookImport';
```

Add state (after `const error = ...`):

```ts
const mode = ref<'code' | 'dofusbook'>('code');
const importing = ref(false);
```

Reset `mode` on open — extend the existing `watch(open, ...)` body to also set `mode.value = 'code'` and `importing.value = false`.

Add the Dofusbook submit handler and route `submit` by mode. Replace the existing `submit` function with:

```ts
function submit(): void {
  if (importing.value) return;
  if (mode.value === 'dofusbook') { void submitDofusbook(); return; }
  submitCode();
}

function submitCode(): void {
  const afterId = ui.codeImportAfterCardId;
  if (afterId === null) return;
  const trimmed = code.value.trim();
  if (trimmed.length === 0) {
    error.value = 'Collez un code avant d\'importer.';
    return;
  }
  let card: Card;
  try {
    card = decodeCardCode(trimmed);
  } catch (err) {
    error.value = `Code invalide : ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  build.addCardAfter(afterId, card);
  ui.setActiveCard(card.id);
  void ensureItems(collectItemIds(card));
  toast.show('Stuff importé depuis le code');
  close();
}

async function submitDofusbook(): Promise<void> {
  const afterId = ui.codeImportAfterCardId;
  if (afterId === null) return;
  const parsed = parseDofusbookText(code.value);
  if (parsed.classId === null && parsed.itemNames.length === 0) {
    error.value = 'Texte Dofusbook non reconnu. Colle toute la page (Ctrl+A).';
    return;
  }
  importing.value = true;
  error.value = null;
  try {
    const resolved = await resolveDofusbookItems(parsed.itemNames);
    if (resolved.resolvedCount === 0) {
      error.value = 'Aucun item reconnu dans le texte collé.';
      return;
    }
    const card: Card = {
      id: randomId(),
      classId: parsed.classId,
      level: parsed.level,
      title: parsed.title,
      slots: resolved.slots,
      dofus: resolved.dofus as Card['dofus'],
    };
    build.addCardAfter(afterId, card);
    ui.setActiveCard(card.id);
    const total = parsed.itemNames.length;
    toast.show(
      resolved.unresolved.length > 0
        ? `${resolved.resolvedCount}/${total} items équipés — introuvables : ${resolved.unresolved.join(', ')}`
        : `${resolved.resolvedCount}/${total} items équipés`,
    );
    close();
  } finally {
    importing.value = false;
  }
}
```

(Keep the existing `collectItemIds`, `close`, and the `decodeCardCode` + `ensureItems` imports.)

- [ ] **Step 4: Implement the template changes**

In the modal body, add a mode selector above the textarea and make the textarea's placeholder/title mode-aware. Replace the `<div class="px-5 py-4 flex flex-col gap-3">` block with:

```vue
        <div class="px-5 py-4 flex flex-col gap-3">
          <div class="flex gap-1.5">
            <button
              type="button"
              data-testid="import-mode-code"
              class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
              :class="mode === 'code'
                ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
                : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
              @click="mode = 'code'"
            >Code</button>
            <button
              type="button"
              data-testid="import-mode-dofusbook"
              class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
              :class="mode === 'dofusbook'
                ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
                : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
              @click="mode = 'dofusbook'"
            >Dofusbook</button>
          </div>
          <textarea
            v-if="mode === 'code'"
            ref="textareaRef"
            v-model="code"
            rows="6"
            spellcheck="false"
            autocomplete="off"
            placeholder="Coller le code ici…"
            class="w-full resize-none bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 font-mono text-[11px] text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors break-all"
            @keydown.ctrl.enter.prevent="submit"
            @keydown.meta.enter.prevent="submit"
          />
          <textarea
            v-else
            data-testid="dofusbook-textarea"
            v-model="code"
            rows="6"
            spellcheck="false"
            autocomplete="off"
            placeholder="Colle tout le texte de ta page Dofusbook (Ctrl+A puis Ctrl+C)…"
            class="w-full resize-none bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 font-sans text-[11px] text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
            @keydown.ctrl.enter.prevent="submit"
            @keydown.meta.enter.prevent="submit"
          />
          <p v-if="error" class="font-sans text-xs text-danger-soft">{{ error }}</p>
        </div>
```

Add `data-testid="import-submit"` and a loading label to the Import button in the footer:

```vue
          <button
            type="button"
            data-testid="import-submit"
            :disabled="importing"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.12] text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.20] hover:border-[#5DCFE0] transition-colors disabled:opacity-50"
            @click="submit"
          >{{ importing ? 'Import…' : 'Importer' }}</button>
```

Also note: the title `<h2>` can stay "Importer un stuff depuis un code" — or optionally make it mode-aware. Leave it as-is (YAGNI); the mode tabs make the choice clear.

- [ ] **Step 5: Run → pass + full suite + type-check**

Run: `npx vitest run tests/components/CardCodeImportModal-dofusbook.spec.ts`
Expected: PASS (3 tests).

Run: `npx vitest run`
Expected: full suite green (no regressions).

Run: `npx vue-tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`. Click a "+" connector between cards (or the end connector) to open the import modal → switch to the "Dofusbook" tab → paste the content of `inspiration/dofusbook-extract` → Importer. Verify: a new Feca Lv 133 "Draegnerys" card appears with items equipped (Torque Ancestral in amulette, two rings, dofus/trophées in the dofus row, etc.), and a toast reports the resolved/unresolved count.

- [ ] **Step 7: Commit**

```bash
git add src/components/CardCodeImportModal.vue tests/components/CardCodeImportModal-dofusbook.spec.ts
git commit -m "feat(import): Dofusbook paste mode in the import modal"
```

---

## Self-review checklist

1. **Spec coverage:**
   - Parser (anchors, header, dedup) → Task 3.
   - Name resolution + typeId→slot + rings/dofus + ensureItems → Task 4 (+ shared map Task 1).
   - `searchItemsByName` → Task 2.
   - Modal Dofusbook mode, direct create + summary toast, zero-resolved error → Task 5.
   - Class+level+title applied → Task 3 parser + Task 5 card build.
   - New card after active/last → Task 5 uses `ui.codeImportAfterCardId` (the modal's existing afterId, set by the connector that opened it).
   - Unresolved skipped + listed → Task 4 collects, Task 5 toasts.
2. **Placeholder scan:** none — every step has full code + exact commands.
3. **Type/name consistency:** `ParsedDofusbook { classId, level, title, itemNames }`, `ResolvedBuild { slots, dofus, unresolved, resolvedCount }`, `searchItemsByName(name, limit)`, `resolveDofusbookItems(itemNames)`, `parseDofusbookText(text)`, `TYPE_ID_TO_SLOT`/`RING_TYPE_ID`/`DOFUS_TYPE_ID`/`TROPHEE_TYPE_ID` — used identically across tasks. `addCardAfter(afterId, card)` matches the existing store signature.
4. **Note on afterId:** the import modal is opened via `ui.openCodeImport(afterCardId)` from the connectors, so `ui.codeImportAfterCardId` already holds the correct insertion point for the Dofusbook flow too — no new entry point needed.
