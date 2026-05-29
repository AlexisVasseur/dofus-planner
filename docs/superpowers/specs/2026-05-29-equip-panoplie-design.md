# Équiper une panoplie — design

## Goal

Add an "Équiper une panoplie" action to a card's `...` (kebab) menu. It opens the
existing item-picker popover, but in a *set-search* mode (querying DofusDB item
sets instead of individual items). Clicking a panoplie fetches its member items
and equips them all onto the card at once.

## User-facing behaviour (locked decisions)

1. **Entry point.** New "Équiper une panoplie" button in the card kebab menu
   (`CardHeader.vue`), next to "Copier le code" / "Ouvrir Dofusbook" / "Supprimer".
   Hidden in `readonly` cards.
2. **Picker reuse.** Reuses `ItemPickerPopover` with a new target
   `{ kind: 'set'; cardId }`. Same search field, debounce, loading/error states,
   pagination. Title becomes "Choisir une panoplie".
3. **Set results.** Each result row shows the set name + `Niv. X` + `N pièces`
   (text only — DofusDB exposes no set icon).
4. **Equip-all on click.** Equipping overwrites the matching slots. Slots not
   covered by the set are left intact (NOT cleared).
5. **Over-level pieces** are equipped anyway; the existing over-level red dot
   shows on the slot. No filtering, no confirmation.
6. **Rings (typeId 9):**
   - Set has 0 rings → nothing.
   - Set has 1 ring → placed in the first EMPTY ring slot (anneau1 then anneau2);
     if both are occupied → overwrite anneau1.
   - Set has 2 rings → anneau1 = first, anneau2 = second (overwrite both).
7. **Pieces with a typeId that maps to no equipment slot** (none expected for a
   real panoplie) are silently skipped.
8. **Range mode (bulk-apply across cards) is disabled for sets in V1.** Equipping
   targets the single card only.

## Architecture

### Data layer — `src/data/dofusdb.ts`

The DofusDB `GET /item-sets` endpoint returns sets whose response **embeds the
member items** (each with `id`, `typeId`, `level`). One call both lists matching
panoplies and reveals their pieces. Verified live:
`GET /item-sets?slug.fr[$search]=bouftou` → `{ total, data: [{ id, name:{fr,…},
level, items:[{id,typeId,level,…}], effects, … }] }`.

New type + fetch:

```ts
export interface ItemSetSummary {
  id: number;
  name: string;        // extracted from raw.name.fr (fallback raw.name.en, then '')
  level: number;
  itemIds: number[];   // raw.items.map(i => i.id)
}

// GET /item-sets?slug.fr[$search]=<q>&$sort=-level&$limit=<n>&$skip=<m>
export function fetchItemSets(opts: {
  search: string;
  limit: number;
  skip?: number;
}): Promise<ItemSetSummary[]>;
```

Mapping notes: `name` reads `raw.name?.fr ?? raw.name?.en ?? ''`; `level` reads
`raw.level ?? 0`; `itemIds` reads `(raw.items ?? []).map(i => i.id)`. The query
mirrors `fetchItemsBySlot`'s URLSearchParams style (`$limit`, `$skip`, `$sort`,
`slug.fr[$search]`).

### Build store — `src/stores/build.ts`

New synchronous action:

```ts
function equipItemSet(cardId: string, itemIds: number[]): void;
```

Algorithm:

1. `const idx = findIndex(cardId)` (throws on unknown card, like the rest).
2. Build a reverse `typeId → SlotType` map from `SLOT_TO_TYPE_IDS`, EXCLUDING the
   ring slots (typeId 9 maps to two slots and is handled separately). Every other
   typeId maps to exactly one slot (verified — no other shared typeId).
3. Partition the cached items:
   - Ring items (typeId 9) → collect into `rings: number[]`.
   - Other items → resolve their slot via the reverse map; unknown typeIds are
     skipped.
4. Apply non-ring pieces: `card.slots[slot] = { itemId }` (overwrite).
5. Apply rings:
   - `rings.length === 1`: place in `anneau1` if empty, else `anneau2` if empty,
     else overwrite `anneau1`.
   - `rings.length >= 2`: `anneau1 = { itemId: rings[0] }`,
     `anneau2 = { itemId: rings[1] }` (extra rings beyond 2 ignored).
6. Items not found in the cache (`getCachedItem` returns null) are skipped
   defensively — the orchestration layer guarantees the cache is warm beforehand.

Pure store logic, no async, easily unit-tested.

### UI store — `src/stores/ui.ts`

Extend the discriminated union:

```ts
export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number }
  | { kind: 'set'; cardId: string };
```

`openItemPicker(target)` is unchanged (already takes an `ItemPickerTarget`).

### Picker — `src/components/ItemPickerPopover.vue`

Branch on `target.kind === 'set'`:

- **Title**: "Choisir une panoplie".
- **Search source**: use `useItemSetSearch(search)` instead of `useItemSearch`.
  Both expose the same shape (`results, loading, loadingMore, error, hasMore,
  loadMore`) so the surrounding template (search input, debounce, infinite
  scroll, loading/error blocks) is reused unchanged.
- **Result row**: set name + `Niv. {level}` + `{itemIds.length} pièces`.
- **Click**: calls `onPickSet(setSummary)` (below) instead of `build.setSlot`.
- **Range mode**: hidden/disabled when `kind === 'set'`.

### Orchestration — `src/composables/useItemSetSearch.ts` (new)

Mirrors `useItemSearch`:

```ts
export function useItemSetSearch(search: Ref<string>): {
  results: Ref<ItemSetSummary[]>;
  loading: Ref<boolean>;
  loadingMore: Ref<boolean>;
  error: Ref<string | null>;
  hasMore: Ref<boolean>;
  loadMore: () => void;
};
```

Debounces `search`, paginates via `$skip`, calls `fetchItemSets`. `hasMore` is
true when the last page returned a full `limit` batch.

**`onPickSet(setSummary)` flow** (in `ItemPickerPopover.vue`):

1. Set an `equipping` flag (reuses the popover's loading visual).
2. `await ensureItems(setSummary.itemIds)` — fetches each piece via `/items/{id}`
   through the existing pipeline (proper `effects` + `set` fields, effect
   templates), so stats / tooltips / panoplie bonus all work afterwards.
3. On success: `build.equipItemSet(target.cardId, setSummary.itemIds)` then
   `ui.closeItemPicker()`.
4. On failure (network): surface the existing error state, do NOT equip.

### Kebab wiring — `CardHeader.vue` + `EquipmentCard.vue`

- `CardHeader.vue`: add the menu button; add `'equip-set': []` to `defineEmits`;
  add `onMenuEquipSet()` handler (`closeMenu(); emit('equip-set')`).
- `EquipmentCard.vue`: handle `@equip-set` →
  `if (!readonly) ui.openItemPicker({ kind: 'set', cardId: card.id })`.

## Edge cases

- **Empty/whitespace search** — same behaviour as `useItemSearch` (no query
  fired / cleared results).
- **Set with a Dofus or trophy piece** (typeId 23 / 151) — no equipment slot →
  skipped (sets don't normally contain these).
- **Set with > 2 rings** — only the first two are placed.
- **Over-level pieces** — equipped; red over-level dot shows.
- **`ensureItems` partial failure** — `ensureItems` already tolerates individual
  misses; `equipItemSet` then skips any still-missing item. If the whole call
  rejects, nothing is equipped and the error is shown.
- **`readonly` card** — menu button hidden + handler guarded.
- **Unknown cardId** — `equipItemSet` throws (consistent with `findIndex`).

## Testing

### Unit — `equipItemSet` (`tests/stores/build-set.spec.ts`)

- Full set (coiffe, cape, amulette, ceinture, bottes, arme, 1 ring) → each
  homologous slot holds the right itemId.
- Occupied slot → overwritten by the set piece.
- Slots outside the set → unchanged.
- 1 ring, anneau1 empty / anneau2 occupied → goes to anneau1.
- 1 ring, anneau1 occupied / anneau2 empty → goes to anneau2.
- 1 ring, both occupied → overwrites anneau1.
- 2 rings → anneau1 + anneau2 in order.
- Piece whose typeId maps to no slot → ignored (no throw).
- Item missing from cache → skipped silently.
- Unknown cardId → throws.

### Unit — `fetchItemSets` mapping (`tests/data/dofusdb-sets.spec.ts`)

- Given a mocked raw response, asserts `name` (fr), `level`, `itemIds` mapping.
  (Mock `fetch`/the HTTP layer the same way existing dofusdb tests do, if any;
  otherwise test the pure mapping by injecting a raw object.)

### Composable — `useItemSetSearch` (`tests/composables/useItemSetSearch.spec.ts`)

- Debounce: rapid input fires one fetch.
- Pagination: `loadMore` appends a second page; `hasMore` flips false on a short
  last page. (Mock `fetchItemSets`.)

### Component smoke — `ItemPickerPopover` (`tests/components/ItemPickerPopover-set.spec.ts`)

- `kind: 'set'` → title shows "panoplie"; rows rendered from a mocked
  `useItemSetSearch`.
- Click a set row → `ensureItems` called with the set's itemIds, then
  `build.equipItemSet` with the same ids; picker closed.

No Playwright E2E (consistent with the project: Vitest + Vue Test Utils only).

## Out of scope (V1)

- Bulk-apply a set across a level range (range mode for sets).
- Set icon / member preview thumbnails in the result row.
- Filtering sets by the card's class or level.
- Partial-set suggestions ("you're 1 piece away").

## File layout summary

- Modify: `src/data/dofusdb.ts` (`ItemSetSummary`, `fetchItemSets`).
- Modify: `src/stores/build.ts` (`equipItemSet`).
- Modify: `src/stores/ui.ts` (`ItemPickerTarget` += `set`).
- Modify: `src/components/ItemPickerPopover.vue` (set-mode branch).
- Modify: `src/components/CardHeader.vue` (menu button + emit).
- Modify: `src/components/EquipmentCard.vue` (handle `equip-set`).
- New: `src/composables/useItemSetSearch.ts`.
- New tests: `tests/stores/build-set.spec.ts`,
  `tests/data/dofusdb-sets.spec.ts`,
  `tests/composables/useItemSetSearch.spec.ts`,
  `tests/components/ItemPickerPopover-set.spec.ts`.
