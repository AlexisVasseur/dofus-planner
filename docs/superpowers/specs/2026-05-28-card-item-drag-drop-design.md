# Card item drag & drop — design

## Goal

Let the user reorder dofus inside one card by drag-and-drop, and copy one or more
equipped items from one card to another via Ctrl-click multi-selection + drag.

## User-facing behaviour (locked decisions)

1. **Reorder scope.** Only the six dofus slots can be reordered. Equipment slots
   (including the two ring slots) cannot be drag-reordered. Rings stay in their
   `anneau1` / `anneau2` slot identity.
2. **Drop on an occupied dofus slot** swaps the two items. No "insert + shift",
   no overwrite.
3. **Multi-selection composition.** Equipment slots and dofus slots can be mixed
   in the same selection. The selection is bound to one source card.
4. **Cross-card drop target mapping.** Items go to homologous slots on the
   target card (coiffe → coiffe, `anneau1` → `anneau1`, dofus #2 → dofus #2).
   Occupied target slots are overwritten.
5. **Single-item drag (no Ctrl) is a copy.** It works the same way as a
   multi-item drag — the drag carries just that one slot. Ctrl is purely a
   selection-enrichment gesture.
6. **Selection cannot span multiple source cards.** Ctrl-clicking a slot of a
   different card replaces the current selection with `{ cardId: new, targets:
   [that slot] }`.
7. **Keyboard a11y is out of scope for V1.** A future enhancement may add
   `Space` to grab, arrows to move, `Enter` to drop.
8. **No Playwright E2E in V1.** Smoke tests via Vitest + Vue Test Utils only.

## Architecture

### Tech approach

Native HTML5 Drag and Drop API (`draggable`, `dragstart`, `dragover`, `drop`,
`dragend`) for the data flow. A custom Vue overlay component, teleported to
`body`, replaces the native drag image and shows a multi-item preview that
follows the cursor.

No new dependency. Selection and drag state live in the existing Pinia UI
store. Mutations go through the existing Pinia build store.

### Data model

New types (place in `src/types/build.ts` or a new `src/types/selection.ts`):

```ts
type SelectionTarget =
  | { kind: 'slot'; slot: SlotType }
  | { kind: 'dofus'; index: number };

interface ItemSelection {
  cardId: string;
  targets: SelectionTarget[];
}
```

These mirror the existing `ItemPickerTarget` shape so the discriminated union
stays consistent across the codebase.

### Store changes

**`useUiStore`** (`src/stores/ui.ts`):

- New state: `itemSelection: Ref<ItemSelection | null>`
- New state: `dragState: Ref<{ cardId: string; targets: SelectionTarget[]; cursor: { x: number; y: number }; fromSelection: boolean } | null>`. The `fromSelection` flag records whether the drag originated from the current `itemSelection` (set at `beginDrag` time) — used by the drop handler to decide whether to clear the selection.
- New action `toggleItemSelection(cardId, target)`:
  - If `itemSelection === null` → set to `{ cardId, targets: [target] }`
  - If `itemSelection.cardId !== cardId` → replace with `{ cardId, targets: [target] }`
  - Else, if `target` already in `targets` → remove it
    - If `targets` becomes empty → set `itemSelection = null`
  - Else → append `target` to `targets`
- New action `clearItemSelection()` → sets `itemSelection = null`
- New action `beginDrag(cardId, targets, fromSelection)` → sets `dragState`
- New action `updateDragCursor(x, y)` → updates `dragState.cursor` if non-null
- New action `endDrag()` → sets `dragState = null`

**`useBuildStore`** (`src/stores/build.ts`):

- New action `swapDofus(cardId, fromIndex, toIndex)`:
  - Validates both indices in `[0, DOFUS_COUNT)`
  - `[card.dofus[fromIndex], card.dofus[toIndex]] = [card.dofus[toIndex], card.dofus[fromIndex]]`
  - No-op if `fromIndex === toIndex`
- New action `copyItemsBetweenCards(sourceCardId, targetCardId, targets)`:
  - No-op if `sourceCardId === targetCardId`
  - Throws if either card not found (consistent with `findIndex` style)
  - For each `target`:
    - Read source value (`source.slots[t.slot]` or `source.dofus[t.index]`)
    - If source value is `null` → skip this target (do not blank the cible)
    - Else assign a shallow copy (`{ ...sourceRef }`) to the homologous target
      slot (`target.slots[t.slot]` or `target.dofus[t.index]`)

### Components touched

| File | Change |
|---|---|
| `src/components/SlotIcon.vue` | Add `:draggable="filled && !readonly"`. New props `selected: boolean` and `dragTarget: boolean` driven by the parent (same pattern as the existing `active` prop). Emit `dragstart`, `select-toggle` (for Ctrl+click). Plain click still opens the picker — Ctrl+click is intercepted before the click handler emits `pick`. Render `is-selected` / `is-drop-target` classes from those props. |
| `src/components/DofusCell.vue` | Same `draggable` + new `selected` / `dragTarget` props as `SlotIcon`. Plus: `@dragover.prevent` and `@drop` events emitted upward, gated by `uiStore.dragState`-derived parent logic (parent decides if accepting the drop). |
| `src/components/EquipmentCard.vue` | Add `@dragover.prevent` and `@drop` on the `<article>` root. Drop is gated by `uiStore.dragState !== null && uiStore.dragState.cardId !== card.id`. Add `is-drop-target` class while a foreign drag hovers. Centralise the slot-pick / dofus-pick handlers' new behaviour (Ctrl-click branches into selection toggle, plain click opens picker). |
| `src/components/DragOverlay.vue` *(new)* | `<Teleport to="body">`, `position: fixed`, follows `uiStore.dragState.cursor`. Renders up to three stacked item icons (rotated -8°, 0°, +8°), with a `×N` badge bottom-right when N > 3. `pointer-events: none`. Visible iff `dragState !== null`. |
| `src/App.vue` | Mount `<DragOverlay />` once. Register a `keydown` listener (window scope) for `Escape` that calls `clearItemSelection()` and `endDrag()`. |

### Event flow

**Selection** (filled slot only):

- `click` (no modifier) → opens picker, unchanged.
- `Ctrl+click` (or `Meta+click` on Mac) → `uiStore.toggleItemSelection(cardId, target)`. The picker does NOT open.
- `Esc` (window-level) → `uiStore.clearItemSelection()`.

**Drag start** (`@dragstart` on a filled slot):

1. Determine the targets being dragged and the `fromSelection` flag:
   - If this slot is part of `uiStore.itemSelection.targets` and selection's
     `cardId === card.id` → drag the whole selection, `fromSelection = true`.
   - Else → drag a single-target array `[{ kind, slot|index }]`,
     `fromSelection = false`. The current selection is NOT modified.
2. Call `uiStore.beginDrag(card.id, targets, fromSelection)`.
3. `event.dataTransfer.effectAllowed = 'copy'`.
4. `event.dataTransfer.setDragImage(emptyImg, 0, 0)` where `emptyImg` is a
   cached 1×1 transparent PNG — suppresses the native ghost so our overlay
   takes over.
5. Close any open picker (`uiStore.closeItemPicker()`) to avoid a floating
   popover during the drag.

Foreign drags (files, text, etc.) never trigger `beginDrag`, so `dragState`
stays `null` and the dropover guards reject them implicitly. No MIME marker
needed.

**During drag**:

- `@drag` on the source element fires repeatedly; we call
  `uiStore.updateDragCursor(event.clientX, event.clientY)` so the overlay
  follows.
- `@dragover` on potential targets (slot or card root) does
  `event.preventDefault()` to mark the drop as accepted, and adds the
  appropriate CSS state class via `:class` bindings driven by `dragState`.

**Drop**:

- On a DofusCell of the same card AND drag has exactly one `kind: 'dofus'`
  target → `build.swapDofus(card.id, dragTarget.index, dropTarget.index)`.
  Works the same whether the dofus drop target is filled (swap) or empty
  (effectively a move — `swapDofus` swaps nulls just like values).
- On the `<article>` of a different card → `build.copyItemsBetweenCards(
  dragState.cardId, this.card.id, dragState.targets)`.
- Anywhere else → no-op.

**Selection clearing on drop**: clear `itemSelection` ONLY when
`dragState.fromSelection === true` (the drag was sourced from the current
selection). One-off drags from a non-selected slot preserve the existing
selection so the user can keep operating on it.

**Drag end** (always fires, including OS-cancel):

- `uiStore.endDrag()` — clears `dragState` unconditionally. Selection is NOT
  cleared by `dragend` alone (only by a successful drop, an explicit Esc, or a
  Ctrl-click that empties it). This lets the user retry after an aborted drag.

### Visual feedback

- **Selected slot** — class `is-selected` on `.slot-icon` / `.dofus-cell` with a
  turquoise ring (distinct from `is-active`'s box-shadow) and a small `✓`
  pastille in the top-left corner (mirror position of the existing red
  over-level dot in the top-right).
- **Drop target — foreign card** — class `is-drop-target` on the `<article>`
  driving an accentued ring + glow (stronger than `is-active`).
- **Drop target — dofus swap** — `is-drop-target` on the single DofusCell.
- **Cursor** — `cursor: grab` on filled, draggable slots. While
  `uiStore.dragState !== null`, global `cursor: grabbing` via a body class.
- **DragOverlay** — three stacked icons fan (-8°, 0°, +8°), each using the
  item's `iconUrl` when available, otherwise the slot SVG; opacity 0.9 + soft
  drop-shadow. `×N` badge bottom-right if `targets.length > 3`.

## Edge cases

- **Empty slot** — `draggable=false`, Ctrl+click is a no-op, drag never starts.
- **Drag from non-selected slot while a selection exists elsewhere** — drag
  carries just this slot; the current selection is preserved.
- **Drop on the source card itself (non-slot zone)** — no-op.
- **Drop on a same-card equipment slot** — no-op (no intra-card equipment
  reorder per decision #1).
- **Drop on a same-card dofus slot while drag has > 1 target or includes
  non-dofus** — no-op.
- **Picker open at dragstart** — close it.
- **Over-leveled copy result** — accepted silently; the target slot will show
  the existing `is-over-lvl` red dot. Same behaviour as `setSlot` today.
- **`readonly` cards (Reader / diff)** — `draggable=false`, drop listeners
  inert. Same gate as the existing pick / clear logic.
- **OS-cancelled drag (right-click, Alt-Tab)** — `dragend` fires → `endDrag()`
  clears `dragState`. Selection survives.
- **localStorage** — `itemSelection` and `dragState` are session-only, never
  persisted.

## Testing

### Unit — `useBuildStore`

- `swapDofus`: two filled, filled/empty, same-index no-op, out-of-range throws.
- `copyItemsBetweenCards`:
  - Mixed selection (2 slots + 1 dofus) → 3 homologous targets contain the
    correct `itemId` on the target card.
  - Target slot in source is `null` → cible slot left untouched (skip).
  - `sourceCardId === targetCardId` → no-op (no mutation).
  - Unknown source or target id → throws.

### Unit — `useUiStore`

- `toggleItemSelection`:
  - Null start → creates `{ cardId, [target] }`.
  - Toggle existing target → removes it.
  - Removing the last target → selection back to `null`.
  - Different `cardId` → selection replaced entirely.

### Component smoke — Vue Test Utils

- `EquipmentCard` happy path:
  - Mount two cards, dispatch `dragstart` on a filled `SlotIcon` of card A,
    assert `dragState` set + drag image set with a 1×1 image.
  - Dispatch `drop` on card B's `<article>` → `copyItemsBetweenCards` called
    with the right args.
- `DofusCell` swap happy path:
  - Dispatch `dragstart` on DofusCell #2, then `drop` on DofusCell #5 of the
    same card → `swapDofus(card.id, 2, 5)`.
- Negative:
  - `dragstart` from an empty slot (force-dispatch despite `draggable=false`)
    should be a no-op in handlers.
  - Drop on the same card's equipment slot → `copyItemsBetweenCards` NOT
    called.
- `DragOverlay`:
  - Mount with `dragState` containing 1 / 3 / 5 targets → asserts 1 / 3 / 3
    icons rendered, badge present only on the 5-target case.

## Out of scope (V1)

- Keyboard accessibility (grab/move/drop).
- Touch-only flows (the project is desktop-first; touch-drag emulation may
  follow later).
- Cross-card move (cut-paste). Cross-card is always copy in V1.
- Reorder of any equipment slot, including ring swap.
- Multi-card source selection.
- Playwright E2E.

## File layout summary

- New: `src/components/DragOverlay.vue`
- New: `src/composables/useEmptyDragImage.ts` (caches the 1×1 transparent
  `HTMLImageElement` used as native drag image).
- New: optional `src/types/selection.ts` (or inline in `src/types/build.ts`).
- Modified: `src/stores/ui.ts`, `src/stores/build.ts`,
  `src/components/SlotIcon.vue`, `src/components/DofusCell.vue`,
  `src/components/EquipmentCard.vue`, `src/App.vue`.
- New tests: `tests/stores/build-drag.test.ts`,
  `tests/stores/ui-selection.test.ts`,
  `tests/components/EquipmentCard-drag.test.ts`,
  `tests/components/DragOverlay.test.ts`.
