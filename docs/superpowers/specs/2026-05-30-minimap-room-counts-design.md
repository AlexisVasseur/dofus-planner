# Minimap room counts + TOTAL — design

## Goal

In the bottom navigator (`AppMiniMap`), **Shopping mode only**, show the number of
items per room on each room cell, and add a "TOTAL" section to the right of the
cell bar showing the grand total. Counts are quantity-aware (sum of the ×N
badges), consistent with the existing shopping totals.

## Locked decisions

1. **Shopping mode only.** Builder/Reader cells are per-card (Lv X) — "Salle"
   doesn't apply there, so they are unchanged.
2. **Quantities.** Per-room count = `useShoppingList().totals.unitsPerRoom[room]`;
   TOTAL = `totals.units` (same numbers as the planner's `· N` room badges and the
   global "items à acheter" pill).
3. Per-room count hidden when 0; the room cell still shows its label.

## Architecture

`src/components/AppMiniMap.vue` already renders one cell per room in shopping mode
(`cells` computed maps `ROOM_ORDER`; `cell.payload` is the `RoomId`). It does NOT
currently use the shopping list.

- Add `import { useShoppingList } from '@/composables/useShoppingList';` and
  `const shopping = useShoppingList();`.
- Two small helpers used by the template (shopping mode only):
  - `roomCount(roomId: RoomId): number` → `shopping.value.totals.unitsPerRoom[roomId] ?? 0`.
  - `totalCount` computed → `shopping.value.totals.units`.

`useShoppingList` is a computed that already depends on `build.cards` + the custom
store, so the counts stay live as the build / custom list change.

### UI

- **Per-room cell (shopping only):** inside each room `<button>`, render the label
  and, on a second line, the count when `> 0`. The cell is `h-9` (≈36px), so use
  tight leading: label `text-[10px]` + count `text-[9px] font-mono`, both
  `leading-none`, stacked with `flex flex-col items-center justify-center gap-0.5`.
  Active-cell color rules stay as-is (the count inherits the cell's text color).
  Builder/Reader cells keep the current single-line label rendering.
- **TOTAL section (shopping only):** a block appended to the RIGHT of the `flex-1`
  cells container (a sibling, `shrink-0`), shown via `v-if="ui.viewMode === 'purchase'"`:
  a stacked "TOTAL" caption (`text-[8px] uppercase tracking-[0.08em] text-text-muted`)
  over the `totalCount` number (`font-mono font-extrabold text-[13px] text-[#8AE0EE]`),
  in an accent block: `shrink-0 px-3 py-1 rounded-md border border-[#5DCFE0]/40
  bg-[#5DCFE0]/[0.08] flex flex-col items-center justify-center leading-none gap-0.5`.

No layout change to Builder/Reader (the TOTAL block is shopping-gated; the
Options-globales button stays Builder-gated).

## Edge cases

- Empty shopping (no items) → every `roomCount` is 0 (cells show label only) and
  TOTAL shows `0`.
- The `hub` room counts familiers/montures like any other room via `unitsPerRoom`.

## Testing (Vitest + Vue Test Utils)

`tests/components/AppMiniMap-counts.spec.ts` (new):
- **Shopping mode, seeded build**: mount with `ui.setViewMode('purchase')` and a
  build holding an item that buckets into a known room (e.g. a Lv-1 coiffe → room
  `1-49`); assert the corresponding room cell shows its count and a TOTAL block
  (`data-testid="minimap-total"`) shows the grand total. (Use `populateCache` +
  `build.replaceCards`, mirroring the existing shopping tests.)
- **Builder mode**: mount with `ui.setViewMode('build')`; assert no
  `data-testid="minimap-total"` is rendered and cells show `Lv X` labels only.

No Playwright E2E.

## Out of scope

- Counts in Builder/Reader modes.
- Distinct-item counts (we use quantities).
- Changing the existing planner room badges / global pill.

## File layout summary

- Modify: `src/components/AppMiniMap.vue` (shopping list dep, per-cell count, TOTAL block).
- New test: `tests/components/AppMiniMap-counts.spec.ts`.
