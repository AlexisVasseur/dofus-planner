# Item picker popover — Design

**Status:** Draft
**Date:** 2026-05-05
**Replaces:** the current `ItemPickerSheet.vue` (right-side 540px sheet)

## Goal

Convert the item-selection UI from a fixed right-side sheet into a smaller floating popover anchored to the clicked card. Two reasons: (1) on wide screens (24"+), the side sheet is far from the action, breaking the visual link between the slot you clicked and the list you're picking from. (2) Default sort should be **descending by level** instead of ascending — when planning equipment, the highest-level items relevant to your character cap are the ones you're after first.

## Behavior summary

| Trigger | Action |
|---|---|
| Click a slot or dofus cell on a card | Popover opens, anchored to that card, scoped to the slot's typeIds |
| Click another slot on the **same** card | Popover stays open; content (title, search results, target) updates in place |
| Click a slot on a **different** card | Popover re-anchors to the new card |
| Click outside the popover (and outside any slot/dofus) | Popover closes |
| Esc | Popover closes |
| X button (round, top-right) | Popover closes |
| Click an item in the list | Slot is filled; popover closes |

## Architecture

### Component

`src/components/ItemPickerSheet.vue` is renamed to `src/components/ItemPickerPopover.vue`. The Pinia UI store contract (`itemPickerTarget`, `openItemPicker`, `closeItemPicker`) is untouched — call sites in `EquipmentSlot.vue`, `DofusCell.vue`, `EquipmentCard.vue`, `EquipmentCardDiff.vue` need no edits beyond ensuring the trigger element has a stable identifier (e.g. a class) so click-outside can ignore it.

### Mounting

`<Teleport to="body">` so the popover escapes the `overflow-hidden` of the page-stage and the floating panels. `position: fixed` + computed inline `top`/`left` derived from the anchor card's bounding rect.

### Anchor source

We need access to the rendered card element for the active target. Two options:

1. Track refs on each `<EquipmentCard>` / `<EquipmentCardDiff>` and look up by `cardId`.
2. On open, query the DOM via `document.querySelector('[data-card-id="<id>"]')`.

We pick **(2)**. The cards already render `data-class-id` on `<article>` (set in `EquipmentCard.vue` via `:data-class-id`). We add `data-card-id="<id>"` to the same `<article>`. The popover, on `target` change and on window resize/scroll, runs `document.querySelector(\`[data-card-id="${target.cardId}"]\`)` and calls `getBoundingClientRect()` on the result. No reactive DOM ref needed — the queryselector lookup is one fast call per recompute.

Rationale: the cards live in different containers depending on viewMode (timeline scroller vs Reader carousel), and the picker only opens in **Builder mode** (Reader is read-only — its cards have `pointer-events-none`, so slot clicks never fire). A DOM query keeps the popover decoupled from the card components.

## Positioning

### Inputs
- Card rect: `{ top, right, bottom, left, width, height }` from `getBoundingClientRect()`.
- Viewport rect: `{ width, height }`.
- Popover dimensions: **360 × 320** (constants).
- Margins: `MARGIN_X = 12`, `MARGIN_Y = 12`, `CHROME_TOP = 60` (header height + mt-3), `CHROME_BOTTOM = 60` (minimap height + mb-3).

### Algorithm

```ts
function computePosition(cardRect, viewport): { top: number; left: number; side: 'right' | 'left' } {
  const POP_W = 360, POP_H = 320, GAP = 12;

  // Horizontal: right of card by default, flip to left if it would overflow
  const rightSpace = viewport.width - (cardRect.right + GAP);
  const leftSpace = cardRect.left - GAP;
  const fitsRight = rightSpace >= POP_W + MARGIN_X;
  const fitsLeft = leftSpace >= POP_W + MARGIN_X;

  let side: 'right' | 'left';
  let left: number;

  if (fitsRight) {
    side = 'right';
    left = cardRect.right + GAP;
  } else if (fitsLeft) {
    side = 'left';
    left = cardRect.left - GAP - POP_W;
  } else {
    // Falls back to right + clamp into viewport (degenerate small viewport)
    side = 'right';
    left = Math.max(MARGIN_X, viewport.width - POP_W - MARGIN_X);
  }

  // Vertical: top-align with card, then clamp into [CHROME_TOP+MARGIN_Y, viewport.height - CHROME_BOTTOM - POP_H - MARGIN_Y]
  let top = cardRect.top;
  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = viewport.height - CHROME_BOTTOM - POP_H - MARGIN_Y;
  top = Math.max(minTop, Math.min(maxTop, top));

  return { top, left, side };
}
```

### Reactivity
Recompute on:
- `target` change (when picker opens or switches between cards).
- `window` resize (`useEventListener('resize', recompute)`).
- Timeline horizontal scroll (Builder timeline scrolls under the user — rare during picker open, but cheap to handle: listen to scroll on `window` with passive flag).

`side` is exposed to the template so the entry animation can come from the correct direction.

### Responsive fallback (mobile / narrow viewports)

If `viewport.width < 720`, the popover skips the anchor-flip logic and renders as a centered modal:

```ts
if (viewport.width < 720) {
  return {
    mode: 'modal',
    width: Math.min(viewport.width - 32, 360),
    height: Math.min(viewport.height - 120, 480),
  };
}
```

A semi-transparent backdrop (`rgba(0,0,0,0.5) + backdrop-blur-sm`) covers the page; clicking it closes.

## Visual design

### Container

```html
<aside
  ref="popoverRef"
  class="fixed z-[55] w-[360px] h-[320px] flex flex-col rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(93,207,224,0.10)] overflow-hidden"
  :style="{ top: position.top + 'px', left: position.left + 'px', background: 'rgba(8,8,8,0.85)' }"
>
```

z-index 55: above the floating chrome (z-20) but below modals (z-60 for ClassPickerModal).

### Sections (top → bottom)

1. **Header** (~36px): h2 title in `text-[#8AE0EE] font-sans font-bold text-[12px] uppercase tracking-[0.06em]` + round X close button (same style as `ClassPickerModal` and `ItemPickerSheet`).
2. **Search input** (~40px): `bg-white/[0.04] border border-white/10 rounded-md`, focus border `#5DCFE0/60` + faint turquoise tint on bg.
3. **Pill row** (~32px): `Tous` / `≤ Lv X` / `Au-dessus` + 1px vertical separator + `Niveau ↓` / `A-Z`. All buttons font-sans font-bold text-[10px] uppercase tracking-[0.06em]. Active pill: `bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40`. Inactive: `bg-white/[0.02] border-white/10 text-text-dim` + hover turquoise.
4. **Item list** (flex-1, scrollable, no scrollbar via `.no-scrollbar`): each row `<button class="flex items-center gap-3 px-3 py-2 rounded-md w-full">` with 36×36 icon + name + lv badge. Selected (= currently equipped) row gets `bg-[#5DCFE0]/[0.10] + inset 1px ring`. Hover row: `bg-[#8AE0EE]/[0.06]`.

### Animation

CSS scoped on the popover root:

```css
.popover-enter-active, .popover-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.popover-enter-from {
  opacity: 0;
  transform: translateX(var(--enter-x, -6px));
}
.popover-leave-to {
  opacity: 0;
  transform: translateX(var(--enter-x, -6px));
}
```

`--enter-x` is set inline based on `side`: `-6px` if popover is to the right of the card (slides in from the card edge), `+6px` if to the left.

## Interactions

### Click-outside

VueUse `onClickOutside(popoverRef, close, { ignore: [/* selectors */] })`. The `ignore` accepts a list of refs OR a function that returns elements; we use a CSS-selector based check:

```ts
onClickOutside(popoverRef, (e) => {
  const t = e.target as HTMLElement;
  // Don't close if user clicked another slot/dofus — that triggers a target switch
  if (t.closest('.slot-row, .dofus-cell')) return;
  close();
});
```

### Target switch (same card or different card)

Watch `ui.itemPickerTarget`. On change to a non-null value:
1. Recompute position (the anchor card may have moved if Builder scrolled).
2. Reset search input.
3. Reset filter & sort to defaults (filter `all`, sort `level` descending).

Already implemented in the current sheet for search reset; the rest is one watcher.

### Sort default

Change in the existing `filtered` computed:

```ts
arr.sort((a, b) => sortMode.value === 'level'
  ? b.levelRequired - a.levelRequired   // descending
  : a.name.localeCompare(b.name));
```

Pill label updates from `Trier · niveau` to `Niveau ↓` to make direction explicit. Add a small `↑↓` toggle later if user wants to invert per-session — out of scope for this spec.

## Files touched

| File | Change |
|---|---|
| `src/components/ItemPickerSheet.vue` | renamed → `ItemPickerPopover.vue`, restructured (Teleport, anchor query, position computed, animation) |
| `src/App.vue` | reference rename `ItemPickerSheet` → `ItemPickerPopover` |
| `src/components/EquipmentCard.vue` | add `:data-card-id="card.id"` on `<article>` |
| `src/components/EquipmentCardDiff.vue` | add `:data-card-id="card.id"` on `<article>` |
| `src/composables/useItemCatalog.ts` | unchanged |
| `src/stores/ui.ts` | unchanged |

## Tests

Existing tests remain green:
- `tests/components/ItemRow.spec.ts` (4 tests on the legacy `ItemRow` component — kept unchanged).
- `tests/components/EquipmentSlot.spec.ts` (4 tests).
- `tests/composables/useShoppingList.spec.ts`, `usePersistence.spec.ts`, `useDragScroll.spec.ts`, `useClassAssets.spec.ts`.
- `tests/stores/build.spec.ts`.
- `tests/data/dofusdb.spec.ts`.

No new tests are required for the popover (positioning math is small and visually verifiable). If a regression around the sort direction matters, one optional unit test can be added in a follow-up.

## Verification

After implementation:

```bash
npm run typecheck   # exit 0
npm test -- --run   # 43 tests pass
npm run build       # green
```

Manual smoke checks:

1. Builder, click a slot of the first card (left edge) → popover opens to the right.
2. Builder, scroll to the last card (right edge) → click slot → popover flips to the left.
3. Click another slot of the same card → popover stays put, content updates.
4. Click a slot of another card → popover reposition to the new card.
5. Click outside (e.g. the page-stage background) → popover closes.
6. Esc → popover closes.
7. Sort default is descending by level (highest first).
8. Resize the window from desktop → mobile threshold (~720px wide) → popover converts to centered modal with backdrop.

## Out of scope

- Persistent sort/filter preference across sessions.
- Manual ↑↓ toggle next to the sort pill.
- Inline preview of an item's stats on hover (DofusDB returns empty stats today; tracked in `as-built.md`).
- Dragging the popover to reposition manually.
