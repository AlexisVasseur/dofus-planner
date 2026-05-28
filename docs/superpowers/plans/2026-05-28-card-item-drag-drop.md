# Card item drag-and-drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop to reorder dofus inside a card (swap) and to copy one or more equipped items from one card to another via Ctrl-click multi-selection.

**Architecture:** Native HTML5 Drag and Drop API drives the data flow; Pinia stores hold selection + drag state; a custom Vue overlay (teleported to `body`) replaces the native drag image and shows the multi-item preview following the cursor. No new dependency.

**Tech Stack:** Vue 3 (Composition API), Pinia, TypeScript, Vitest + Vue Test Utils, jsdom.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/selection.ts` | new | `SelectionTarget` discriminated union + `ItemSelection` interface (shared by ui store, components, build store actions). |
| `src/stores/ui.ts` | modify | New state `itemSelection`, `dragState` + actions `toggleItemSelection`, `clearItemSelection`, `beginDrag`, `updateDragCursor`, `endDrag`. |
| `src/stores/build.ts` | modify | New actions `swapDofus`, `copyItemsBetweenCards`. |
| `src/composables/useEmptyDragImage.ts` | new | Cached 1×1 transparent `HTMLImageElement` for `dataTransfer.setDragImage`. |
| `src/components/DragOverlay.vue` | new | Teleport-to-body floating preview; tracks `dragState.cursor`; renders up to 3 stacked icons + `×N` badge. |
| `src/components/SlotIcon.vue` | modify | `draggable`, `selected`/`dragTarget` props, emits `dragstart` + `select-toggle` on Ctrl-click. |
| `src/components/DofusCell.vue` | modify | Same as SlotIcon, plus `dragover`/`drop` events emitted upward so the parent can decide. |
| `src/components/EquipmentCard.vue` | modify | Drop accept on root `<article>`; routes Ctrl-click into selection toggle; wires SlotIcon/DofusCell drag events; computes `selected`/`dragTarget` props per child. |
| `src/App.vue` | modify | Mount `<DragOverlay />` once; window `keydown.Escape` listener clears selection + drag. |
| `tests/stores/build-drag.spec.ts` | new | Unit tests for `swapDofus`, `copyItemsBetweenCards`. |
| `tests/stores/ui-selection.spec.ts` | new | Unit tests for `toggleItemSelection` + drag-state actions. |
| `tests/components/DragOverlay.spec.ts` | new | Smoke: renders correct icon count + badge per `dragState`. |
| `tests/components/EquipmentCard-drag.spec.ts` | new | Smoke: dragstart from SlotIcon sets dragState, drop on a foreign card triggers `copyItemsBetweenCards`, dofus drop triggers `swapDofus`, no-ops in negative paths. |

---

## Task 1: Selection types

**Files:**
- Create: `src/types/selection.ts`

- [ ] **Step 1: Create the new types file**

Write `src/types/selection.ts`:

```ts
import type { SlotType } from './slots';

/** Per-card identifier of one selectable / draggable cell. Discriminated union
 *  mirrors `ItemPickerTarget` shape so consumers can branch the same way. */
export type SelectionTarget =
  | { kind: 'slot'; slot: SlotType }
  | { kind: 'dofus'; index: number };

export interface ItemSelection {
  cardId: string;
  targets: SelectionTarget[];
}

/** Structural equality helper — same kind + same slot/index. */
export function targetsEqual(a: SelectionTarget, b: SelectionTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.slot === b.slot;
  if (a.kind === 'dofus' && b.kind === 'dofus') return a.index === b.index;
  return false;
}
```

- [ ] **Step 2: Type-check the project**

Run: `npx vue-tsc --noEmit`
Expected: PASS (no new errors introduced).

- [ ] **Step 3: Commit**

```bash
git add src/types/selection.ts
git commit -m "feat(types): add SelectionTarget + ItemSelection for D&D"
```

---

## Task 2: UI store — selection state + actions

**Files:**
- Modify: `src/stores/ui.ts` (add new state + actions inside `defineStore`)
- Test: `tests/stores/ui-selection.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/stores/ui-selection.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from '@/stores/ui';

describe('ui store — item selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('toggleItemSelection on null sets {cardId, [target]}', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    expect(ui.itemSelection).toEqual({
      cardId: 'c1',
      targets: [{ kind: 'slot', slot: 'coiffe' }],
    });
  });

  it('toggleItemSelection appends a different target on the same card', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    ui.toggleItemSelection('c1', { kind: 'dofus', index: 2 });
    expect(ui.itemSelection?.targets).toEqual([
      { kind: 'slot', slot: 'coiffe' },
      { kind: 'dofus', index: 2 },
    ]);
  });

  it('toggleItemSelection on an existing target removes it', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    ui.toggleItemSelection('c1', { kind: 'dofus', index: 2 });
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    expect(ui.itemSelection?.targets).toEqual([{ kind: 'dofus', index: 2 }]);
  });

  it('removing the last target nulls itemSelection', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    expect(ui.itemSelection).toBeNull();
  });

  it('toggleItemSelection on a different cardId replaces the whole selection', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    ui.toggleItemSelection('c1', { kind: 'dofus', index: 0 });
    ui.toggleItemSelection('c2', { kind: 'slot', slot: 'bottes' });
    expect(ui.itemSelection).toEqual({
      cardId: 'c2',
      targets: [{ kind: 'slot', slot: 'bottes' }],
    });
  });

  it('clearItemSelection sets it back to null', () => {
    const ui = useUiStore();
    ui.toggleItemSelection('c1', { kind: 'slot', slot: 'coiffe' });
    ui.clearItemSelection();
    expect(ui.itemSelection).toBeNull();
  });
});

describe('ui store — drag state', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('beginDrag stores cardId + targets + fromSelection + zeroed cursor', () => {
    const ui = useUiStore();
    ui.beginDrag('c1', [{ kind: 'slot', slot: 'coiffe' }], true);
    expect(ui.dragState).toEqual({
      cardId: 'c1',
      targets: [{ kind: 'slot', slot: 'coiffe' }],
      cursor: { x: 0, y: 0 },
      fromSelection: true,
    });
  });

  it('updateDragCursor only mutates cursor when a drag is in progress', () => {
    const ui = useUiStore();
    ui.updateDragCursor(100, 200);
    expect(ui.dragState).toBeNull();
    ui.beginDrag('c1', [{ kind: 'dofus', index: 0 }], false);
    ui.updateDragCursor(123, 456);
    expect(ui.dragState?.cursor).toEqual({ x: 123, y: 456 });
  });

  it('endDrag clears dragState', () => {
    const ui = useUiStore();
    ui.beginDrag('c1', [{ kind: 'dofus', index: 0 }], false);
    ui.endDrag();
    expect(ui.dragState).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/ui-selection.spec.ts`
Expected: FAIL — `ui.toggleItemSelection is not a function`, etc.

- [ ] **Step 3: Add the state + actions to the store**

Edit `src/stores/ui.ts`:

Add these imports near the top of the file (after the existing imports):

```ts
import type { ItemSelection, SelectionTarget } from '@/types/selection';
import { targetsEqual } from '@/types/selection';
```

Inside `defineStore('ui', () => { ... })`, add the new state refs (after the existing `statModalTarget` ref):

```ts
  const itemSelection = ref<ItemSelection | null>(null);
  const dragState = ref<{
    cardId: string;
    targets: SelectionTarget[];
    cursor: { x: number; y: number };
    fromSelection: boolean;
  } | null>(null);
```

Add the new actions (before the `return` statement):

```ts
  function toggleItemSelection(cardId: string, target: SelectionTarget): void {
    const current = itemSelection.value;
    if (current === null || current.cardId !== cardId) {
      itemSelection.value = { cardId, targets: [target] };
      return;
    }
    const idx = current.targets.findIndex((t) => targetsEqual(t, target));
    if (idx === -1) {
      itemSelection.value = { cardId, targets: [...current.targets, target] };
      return;
    }
    const nextTargets = current.targets.filter((_, i) => i !== idx);
    itemSelection.value = nextTargets.length === 0 ? null : { cardId, targets: nextTargets };
  }

  function clearItemSelection(): void {
    itemSelection.value = null;
  }

  function beginDrag(cardId: string, targets: SelectionTarget[], fromSelection: boolean): void {
    dragState.value = { cardId, targets, cursor: { x: 0, y: 0 }, fromSelection };
  }

  function updateDragCursor(x: number, y: number): void {
    if (dragState.value === null) return;
    dragState.value = { ...dragState.value, cursor: { x, y } };
  }

  function endDrag(): void {
    dragState.value = null;
  }
```

Add the new state + actions to the `return { ... }` block (alongside the existing exports):

```ts
    itemSelection,
    dragState,
    toggleItemSelection,
    clearItemSelection,
    beginDrag,
    updateDragCursor,
    endDrag,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/ui-selection.spec.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/ui.ts tests/stores/ui-selection.spec.ts
git commit -m "feat(ui-store): selection + drag state for card item D&D"
```

---

## Task 3: Build store — `swapDofus` action

**Files:**
- Modify: `src/stores/build.ts` (add action + export)
- Test: `tests/stores/build-drag.spec.ts` (new — also extended in Task 4)

- [ ] **Step 1: Write the failing tests**

Create `tests/stores/build-drag.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';

describe('build store — swapDofus', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('swaps two filled dofus slots', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    s.setDofus(c.id, 1, { itemId: 100 });
    s.setDofus(c.id, 4, { itemId: 200 });
    s.swapDofus(c.id, 1, 4);
    expect(c.dofus[1]).toEqual({ itemId: 200 });
    expect(c.dofus[4]).toEqual({ itemId: 100 });
  });

  it('moves a filled into an empty slot (and empties the source)', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    s.setDofus(c.id, 2, { itemId: 300 });
    s.swapDofus(c.id, 2, 5);
    expect(c.dofus[2]).toBeNull();
    expect(c.dofus[5]).toEqual({ itemId: 300 });
  });

  it('is a no-op when fromIndex === toIndex', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    s.setDofus(c.id, 3, { itemId: 400 });
    s.swapDofus(c.id, 3, 3);
    expect(c.dofus[3]).toEqual({ itemId: 400 });
  });

  it('throws on an out-of-range fromIndex', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    expect(() => s.swapDofus(c.id, -1, 0)).toThrow(/out of range/);
    expect(() => s.swapDofus(c.id, 6, 0)).toThrow(/out of range/);
  });

  it('throws on an out-of-range toIndex', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    expect(() => s.swapDofus(c.id, 0, -1)).toThrow(/out of range/);
    expect(() => s.swapDofus(c.id, 0, 6)).toThrow(/out of range/);
  });

  it('throws when cardId is unknown', () => {
    const s = useBuildStore();
    expect(() => s.swapDofus('nope', 0, 1)).toThrow(/Card not found/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/build-drag.spec.ts`
Expected: FAIL — `s.swapDofus is not a function`.

- [ ] **Step 3: Implement `swapDofus`**

In `src/stores/build.ts`, add this function inside `defineStore('build', () => { ... })` after the existing `setDofus`:

```ts
  function swapDofus(cardId: string, fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${fromIndex}`);
    }
    if (toIndex < 0 || toIndex >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${toIndex}`);
    }
    if (fromIndex === toIndex) return;
    const idx = findIndex(cardId);
    const dofus = cards.value[idx].dofus;
    const tmp = dofus[fromIndex];
    dofus[fromIndex] = dofus[toIndex];
    dofus[toIndex] = tmp;
  }
```

Add `swapDofus` to the `return { ... }` block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/build-drag.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/build.ts tests/stores/build-drag.spec.ts
git commit -m "feat(build-store): swapDofus for intra-card dofus reorder"
```

---

## Task 4: Build store — `copyItemsBetweenCards` action

**Files:**
- Modify: `src/stores/build.ts`
- Test: `tests/stores/build-drag.spec.ts` (extend)

- [ ] **Step 1: Append failing tests to the existing file**

Add this `describe` block to the end of `tests/stores/build-drag.spec.ts`:

```ts
describe('build store — copyItemsBetweenCards', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('copies a mixed selection (slot + dofus) to homologous targets', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id);
    const b = s.cards[1];

    s.setSlot(a.id, 'coiffe', { itemId: 11 });
    s.setSlot(a.id, 'anneau1', { itemId: 22 });
    s.setDofus(a.id, 3, { itemId: 33 });

    s.copyItemsBetweenCards(a.id, b.id, [
      { kind: 'slot', slot: 'coiffe' },
      { kind: 'slot', slot: 'anneau1' },
      { kind: 'dofus', index: 3 },
    ]);

    expect(b.slots.coiffe).toEqual({ itemId: 11 });
    expect(b.slots.anneau1).toEqual({ itemId: 22 });
    expect(b.dofus[3]).toEqual({ itemId: 33 });
  });

  it('overwrites occupied target slots', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id);
    const b = s.cards[1];

    s.setSlot(a.id, 'coiffe', { itemId: 11 });
    s.setSlot(b.id, 'coiffe', { itemId: 99 });

    s.copyItemsBetweenCards(a.id, b.id, [{ kind: 'slot', slot: 'coiffe' }]);
    expect(b.slots.coiffe).toEqual({ itemId: 11 });
  });

  it('skips targets whose source slot is null (does not blank the target)', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id);
    const b = s.cards[1];

    s.setSlot(b.id, 'coiffe', { itemId: 99 });
    // a.slots.coiffe is null.
    s.copyItemsBetweenCards(a.id, b.id, [{ kind: 'slot', slot: 'coiffe' }]);
    expect(b.slots.coiffe).toEqual({ itemId: 99 });
  });

  it('is a no-op when sourceCardId === targetCardId', () => {
    const s = useBuildStore();
    const c = s.cards[0];
    s.setSlot(c.id, 'coiffe', { itemId: 11 });
    s.copyItemsBetweenCards(c.id, c.id, [{ kind: 'slot', slot: 'coiffe' }]);
    expect(c.slots.coiffe).toEqual({ itemId: 11 });
  });

  it('throws when source card not found', () => {
    const s = useBuildStore();
    expect(() => s.copyItemsBetweenCards('nope', s.cards[0].id, [])).toThrow(/Card not found/);
  });

  it('throws when target card not found', () => {
    const s = useBuildStore();
    expect(() => s.copyItemsBetweenCards(s.cards[0].id, 'nope', [])).toThrow(/Card not found/);
  });

  it('writes a shallow clone (target ref is not the same object as source)', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id);
    const b = s.cards[1];
    s.setSlot(a.id, 'coiffe', { itemId: 11 });
    s.copyItemsBetweenCards(a.id, b.id, [{ kind: 'slot', slot: 'coiffe' }]);
    expect(b.slots.coiffe).not.toBe(a.slots.coiffe);
    expect(b.slots.coiffe).toEqual(a.slots.coiffe);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/build-drag.spec.ts`
Expected: 6 new tests FAIL — `s.copyItemsBetweenCards is not a function`.

- [ ] **Step 3: Implement `copyItemsBetweenCards`**

In `src/stores/build.ts`, add this import at the top (after the existing imports):

```ts
import type { SelectionTarget } from '@/types/selection';
```

Add this function inside `defineStore('build', () => { ... })` after `swapDofus`:

```ts
  function copyItemsBetweenCards(
    sourceCardId: string,
    targetCardId: string,
    targets: readonly SelectionTarget[],
  ): void {
    if (sourceCardId === targetCardId) return;
    const sourceIdx = findIndex(sourceCardId);
    const targetIdx = findIndex(targetCardId);
    const source = cards.value[sourceIdx];
    const target = cards.value[targetIdx];
    for (const t of targets) {
      if (t.kind === 'slot') {
        const ref = source.slots[t.slot];
        if (ref === null) continue;
        target.slots[t.slot] = { ...ref };
      } else {
        if (t.index < 0 || t.index >= DOFUS_COUNT) continue;
        const ref = source.dofus[t.index];
        if (ref === null) continue;
        target.dofus[t.index] = { ...ref };
      }
    }
  }
```

Add `copyItemsBetweenCards` to the `return { ... }` block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/build-drag.spec.ts`
Expected: PASS (13 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/stores/build.ts tests/stores/build-drag.spec.ts
git commit -m "feat(build-store): copyItemsBetweenCards for cross-card item copy"
```

---

## Task 5: `useEmptyDragImage` composable

**Files:**
- Create: `src/composables/useEmptyDragImage.ts`

- [ ] **Step 1: Write the composable**

Create `src/composables/useEmptyDragImage.ts`:

```ts
// A cached 1×1 transparent PNG that we hand to `dataTransfer.setDragImage` at
// `dragstart` time, so the native browser ghost is invisible and our custom
// Vue overlay (DragOverlay.vue) takes its place.

const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let cached: HTMLImageElement | null = null;

export function getEmptyDragImage(): HTMLImageElement {
  if (cached !== null) return cached;
  const img = new Image(1, 1);
  img.src = TRANSPARENT_PNG_DATA_URL;
  cached = img;
  return img;
}
```

- [ ] **Step 2: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useEmptyDragImage.ts
git commit -m "feat(composables): useEmptyDragImage for hidden native drag ghost"
```

---

## Task 6: `DragOverlay` component

**Files:**
- Create: `src/components/DragOverlay.vue`
- Test: `tests/components/DragOverlay.spec.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/components/DragOverlay.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import DragOverlay from '@/components/DragOverlay.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';

describe('DragOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('is hidden when dragState is null', () => {
    const w = mount(DragOverlay, { attachTo: document.body });
    expect(w.find('[data-testid="drag-overlay"]').exists()).toBe(false);
  });

  it('renders one icon stack when the drag has a single target', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 1 });
    ui.beginDrag(c.id, [{ kind: 'slot', slot: 'coiffe' }], true);

    const w = mount(DragOverlay, { attachTo: document.body });
    expect(w.find('[data-testid="drag-overlay"]').exists()).toBe(true);
    expect(w.findAll('[data-testid="drag-overlay-icon"]')).toHaveLength(1);
    expect(w.find('[data-testid="drag-overlay-badge"]').exists()).toBe(false);
  });

  it('renders 3 icons when the drag has 3 targets', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 1 });
    build.setSlot(c.id, 'cape', { itemId: 2 });
    build.setSlot(c.id, 'bottes', { itemId: 3 });
    ui.beginDrag(
      c.id,
      [
        { kind: 'slot', slot: 'coiffe' },
        { kind: 'slot', slot: 'cape' },
        { kind: 'slot', slot: 'bottes' },
      ],
      true,
    );

    const w = mount(DragOverlay, { attachTo: document.body });
    expect(w.findAll('[data-testid="drag-overlay-icon"]')).toHaveLength(3);
    expect(w.find('[data-testid="drag-overlay-badge"]').exists()).toBe(false);
  });

  it('caps at 3 icons and shows a ×N badge when there are 5 targets', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    const c = build.cards[0];
    for (const slot of ['coiffe', 'cape', 'bottes', 'arme', 'bouclier'] as const) {
      build.setSlot(c.id, slot, { itemId: 1 });
    }
    ui.beginDrag(
      c.id,
      [
        { kind: 'slot', slot: 'coiffe' },
        { kind: 'slot', slot: 'cape' },
        { kind: 'slot', slot: 'bottes' },
        { kind: 'slot', slot: 'arme' },
        { kind: 'slot', slot: 'bouclier' },
      ],
      true,
    );

    const w = mount(DragOverlay, { attachTo: document.body });
    expect(w.findAll('[data-testid="drag-overlay-icon"]')).toHaveLength(3);
    const badge = w.find('[data-testid="drag-overlay-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain('5');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/DragOverlay.spec.ts`
Expected: FAIL — `Cannot find module '@/components/DragOverlay.vue'`.

- [ ] **Step 3: Implement `DragOverlay.vue`**

Create `src/components/DragOverlay.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';
import type { SelectionTarget } from '@/types/selection';

const ui = useUiStore();
const build = useBuildStore();

const MAX_ICONS = 3;
const FAN_ANGLES = [-8, 0, 8] as const;
const CURSOR_OFFSET = { x: 10, y: 10 };

interface PreviewIcon {
  iconUrl: string | null;
  slotSvg: string | null;
}

function previewFor(cardId: string, t: SelectionTarget): PreviewIcon {
  const card = build.cards.find((c) => c.id === cardId);
  if (!card) return { iconUrl: null, slotSvg: null };
  const ref = t.kind === 'slot' ? card.slots[t.slot] : card.dofus[t.index];
  if (!ref) return { iconUrl: null, slotSvg: t.kind === 'slot' ? getSlotIconSvg(t.slot) : null };
  const item = getCachedItem(ref.itemId);
  return {
    iconUrl: item?.iconUrl || null,
    slotSvg: t.kind === 'slot' ? getSlotIconSvg(t.slot) : null,
  };
}

const previews = computed<PreviewIcon[]>(() => {
  const state = ui.dragState;
  if (!state) return [];
  return state.targets.slice(0, MAX_ICONS).map((t) => previewFor(state.cardId, t));
});

const overflow = computed(() => {
  const state = ui.dragState;
  if (!state) return 0;
  return state.targets.length;
});

const overlayStyle = computed(() => {
  const state = ui.dragState;
  if (!state) return { display: 'none' };
  return {
    left: `${state.cursor.x + CURSOR_OFFSET.x}px`,
    top: `${state.cursor.y + CURSOR_OFFSET.y}px`,
  };
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.dragState !== null"
      data-testid="drag-overlay"
      class="drag-overlay pointer-events-none fixed z-[9999] select-none"
      :style="overlayStyle"
    >
      <div class="relative">
        <div
          v-for="(p, i) in previews"
          :key="i"
          data-testid="drag-overlay-icon"
          class="drag-overlay-icon absolute w-10 h-10 rounded-md bg-bg-elev border border-white/30 shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden"
          :style="{ transform: `translate(${i * 3}px, ${i * 3}px) rotate(${FAN_ANGLES[i]}deg)` }"
        >
          <img v-if="p.iconUrl" :src="p.iconUrl" alt="" class="w-3/4 h-3/4" draggable="false" />
          <svg
            v-else-if="p.slotSvg"
            viewBox="0 0 24 24"
            class="w-1/2 h-1/2 text-text-muted"
            v-html="p.slotSvg"
          />
        </div>
        <span
          v-if="overflow > MAX_ICONS"
          data-testid="drag-overlay-badge"
          class="drag-overlay-badge absolute -bottom-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent text-bg-surface text-xs font-bold flex items-center justify-center shadow-md"
        >×{{ overflow }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drag-overlay {
  opacity: 0.92;
}
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/DragOverlay.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DragOverlay.vue tests/components/DragOverlay.spec.ts
git commit -m "feat(component): DragOverlay teleported preview that follows the cursor"
```

---

## Task 7: `SlotIcon` — draggable + selection + Ctrl-click

**Files:**
- Modify: `src/components/SlotIcon.vue`

- [ ] **Step 1: Add new props + emits and wire draggable**

Edit `src/components/SlotIcon.vue` — extend the `defineProps` block to add `selected` and `dragTarget`:

```ts
const props = defineProps<{
  slot: SlotType;
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
  readonly?: boolean;
  /** Reader-only flag: paints a turquoise ring around the slot to signal a diff. */
  changed?: boolean;
  /** Slot is part of the active multi-selection (Ctrl-click). */
  selected?: boolean;
  /** Slot is currently being hovered as a valid drop target. */
  dragTarget?: boolean;
}>();
```

Extend `defineEmits` to add the new events:

```ts
const emit = defineEmits<{
  pick: [];
  clear: [];
  /** Ctrl+click (or Meta+click) toggled selection. */
  'select-toggle': [];
  /** Native `dragstart` event passed through so the parent can populate the store. */
  dragstart: [event: DragEvent];
}>();
```

- [ ] **Step 2: Intercept Ctrl-click before the existing `pick` flow**

Replace the existing `@click="!readonly && emit('pick')"` on the root `<div>` with the new handler. Add this function to `<script setup>`:

```ts
function onClick(event: MouseEvent): void {
  if (props.readonly) return;
  if ((event.ctrlKey || event.metaKey) && props.item !== null) {
    emit('select-toggle');
    return;
  }
  emit('pick');
}
```

Update the root `<div>` opening tag:
- Replace `@click="!readonly && emit('pick')"` with `@click="onClick"`
- Add `:draggable="filled && !readonly"`
- Add `@dragstart="(e) => emit('dragstart', e)"`

Add the new classes to the `:class` array:

```ts
:class="[
  filled
    ? 'bg-white/[0.06] border border-white/15'
    : 'bg-white/[0.02] border border-dashed border-white/10',
  readonly ? 'cursor-default' : (filled ? 'cursor-grab' : 'cursor-pointer'),
  readonly ? 'is-readonly' : '',
  overLvl ? 'is-over-lvl' : '',
  active ? 'is-active' : '',
  changed ? 'is-changed' : '',
  selected ? 'is-selected' : '',
  dragTarget ? 'is-drop-target' : '',
]"
```

- [ ] **Step 3: Add the new visual states in `<style scoped>`**

Append to the `<style scoped>` block:

```css
.slot-icon.is-selected {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 6px rgba(93, 207, 224, 0.35);
}
.slot-icon.is-selected::before {
  content: '✓';
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 9999px;
  background: theme('colors.accent.DEFAULT');
  color: theme('colors.bg-surface');
  font-size: 0.625rem;
  line-height: 0.875rem;
  text-align: center;
  font-weight: 700;
  pointer-events: none;
}
.slot-icon.is-drop-target {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 2px theme('colors.accent.DEFAULT'), 0 0 16px rgba(93, 207, 224, 0.6);
}
```

- [ ] **Step 4: Run all existing tests to make sure nothing broke**

Run: `npx vitest run`
Expected: PASS (existing suites still green).

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SlotIcon.vue
git commit -m "feat(SlotIcon): draggable + selected/dragTarget props + Ctrl-click toggle"
```

---

## Task 8: `DofusCell` — draggable + selection + Ctrl-click + drop accept

**Files:**
- Modify: `src/components/DofusCell.vue`

- [ ] **Step 1: Add new props + emits**

Edit `src/components/DofusCell.vue` — extend `defineProps`:

```ts
const props = defineProps<{
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
  readonly?: boolean;
  /** Reader-only diff highlight (turquoise ring). */
  changed?: boolean;
  selected?: boolean;
  dragTarget?: boolean;
}>();
```

Extend `defineEmits`:

```ts
const emit = defineEmits<{
  pick: [];
  clear: [];
  'select-toggle': [];
  dragstart: [event: DragEvent];
  dragover: [event: DragEvent];
  drop: [event: DragEvent];
}>();
```

- [ ] **Step 2: Add the click interception + drag/drop listeners**

Add this to `<script setup>` (alongside the existing handlers):

```ts
function onClick(event: MouseEvent): void {
  if (props.readonly) return;
  if ((event.ctrlKey || event.metaKey) && props.item !== null) {
    emit('select-toggle');
    return;
  }
  emit('pick');
}
```

Update the root `<div>` opening tag:
- Replace `@click="!readonly && emit('pick')"` with `@click="onClick"`
- Add `:draggable="filled && !readonly"`
- Add `@dragstart="(e) => emit('dragstart', e)"`
- Add `@dragover="(e) => emit('dragover', e)"`
- Add `@drop="(e) => emit('drop', e)"`

Update the `:class` array — same additions as Task 7:

```ts
:class="[
  filled
    ? 'bg-white/[0.06] border border-white/15'
    : 'bg-white/[0.02] border border-dashed border-white/10',
  readonly ? 'cursor-default' : (filled ? 'cursor-grab' : 'cursor-pointer'),
  readonly ? 'is-readonly' : '',
  selected ? 'is-selected' : '',
  dragTarget ? 'is-drop-target' : '',
]"
```

- [ ] **Step 3: Add the new visual states in `<style scoped>`**

Append to `<style scoped>`:

```css
.dofus-cell.is-selected {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 6px rgba(93, 207, 224, 0.35);
}
.dofus-cell.is-selected::before {
  content: '✓';
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 9999px;
  background: theme('colors.accent.DEFAULT');
  color: theme('colors.bg-surface');
  font-size: 0.625rem;
  line-height: 0.875rem;
  text-align: center;
  font-weight: 700;
  pointer-events: none;
}
.dofus-cell.is-drop-target {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 2px theme('colors.accent.DEFAULT'), 0 0 16px rgba(93, 207, 224, 0.6);
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DofusCell.vue
git commit -m "feat(DofusCell): draggable + selected/dragTarget + drop events"
```

---

## Task 9: `EquipmentCard` — wire selection, drag, drop

**Files:**
- Modify: `src/components/EquipmentCard.vue`
- Test: `tests/components/EquipmentCard-drag.spec.ts` (new)

- [ ] **Step 1: Write the failing smoke tests**

Create `tests/components/EquipmentCard-drag.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import EquipmentCard from '@/components/EquipmentCard.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { populateCache } from '@/composables/useItemCatalog';

function seedItem(id: number, name = `Item ${id}`): void {
  populateCache([{ id, name, levelRequired: 1, iconUrl: '', stats: [], typeId: 16 }]);
}

function makeDragEvent(): DragEvent {
  // jsdom doesn't implement DataTransfer; provide a minimal stub.
  const event = new Event('dragstart', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      effectAllowed: 'none',
      setData() {},
      setDragImage() {},
    },
    writable: false,
  });
  return event;
}

describe('EquipmentCard — D&D wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('dragstart on a filled SlotIcon sets dragState in the ui store', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(1);
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 1 });

    const w = mount(EquipmentCard, { props: { card: c } });
    const slot = w.find('[data-slot="coiffe"]');
    expect(slot.exists()).toBe(true);
    (slot.element as HTMLElement).dispatchEvent(makeDragEvent());

    expect(ui.dragState).not.toBeNull();
    expect(ui.dragState?.cardId).toBe(c.id);
    expect(ui.dragState?.targets).toEqual([{ kind: 'slot', slot: 'coiffe' }]);
    expect(ui.dragState?.fromSelection).toBe(false);
  });

  it('Ctrl+click on a filled SlotIcon toggles selection instead of opening the picker', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(1);
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 1 });

    const w = mount(EquipmentCard, { props: { card: c } });
    const slot = w.find('[data-slot="coiffe"]');
    slot.trigger('click', { ctrlKey: true });

    expect(ui.itemSelection).toEqual({
      cardId: c.id,
      targets: [{ kind: 'slot', slot: 'coiffe' }],
    });
    expect(ui.itemPickerTarget).toBeNull();
  });

  it('drop on the article of a foreign card calls copyItemsBetweenCards', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(42);
    const a = build.cards[0];
    build.addEmptyCardAfter(a.id);
    const b = build.cards[1];
    build.setSlot(a.id, 'coiffe', { itemId: 42 });

    // Simulate an in-progress drag sourced from card A.
    ui.beginDrag(a.id, [{ kind: 'slot', slot: 'coiffe' }], false);

    const w = mount(EquipmentCard, { props: { card: b } });
    const article = w.find('article');
    article.trigger('dragover');
    article.trigger('drop');

    expect(b.slots.coiffe).toEqual({ itemId: 42 });
  });

  it('drop on a same-card dofus slot with a single-dofus drag calls swapDofus', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(7);
    const c = build.cards[0];
    build.setDofus(c.id, 2, { itemId: 7 });
    ui.beginDrag(c.id, [{ kind: 'dofus', index: 2 }], false);

    const w = mount(EquipmentCard, { props: { card: c } });
    const target = w.find('[data-dofus-index="5"]');
    target.trigger('dragover');
    target.trigger('drop');

    expect(c.dofus[2]).toBeNull();
    expect(c.dofus[5]).toEqual({ itemId: 7 });
  });

  it('drop on the source card article is a no-op', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(7);
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 7 });
    ui.beginDrag(c.id, [{ kind: 'slot', slot: 'coiffe' }], false);

    const w = mount(EquipmentCard, { props: { card: c } });
    const article = w.find('article');
    article.trigger('drop');

    expect(c.slots.coiffe).toEqual({ itemId: 7 });
  });

  it('drop on a same-card dofus with a non-dofus drag is a no-op', () => {
    const build = useBuildStore();
    const ui = useUiStore();
    seedItem(7);
    const c = build.cards[0];
    build.setSlot(c.id, 'coiffe', { itemId: 7 });
    ui.beginDrag(c.id, [{ kind: 'slot', slot: 'coiffe' }], false);

    const w = mount(EquipmentCard, { props: { card: c } });
    const target = w.find('[data-dofus-index="3"]');
    target.trigger('dragover');
    target.trigger('drop');

    expect(c.dofus[3]).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/EquipmentCard-drag.spec.ts`
Expected: FAIL — handlers + `data-*` attributes don't exist yet.

- [ ] **Step 3: Wire imports and add new handlers in `EquipmentCard.vue`**

In `src/components/EquipmentCard.vue` `<script setup>`:

Add these imports:

```ts
import { getEmptyDragImage } from '@/composables/useEmptyDragImage';
import { targetsEqual, type SelectionTarget } from '@/types/selection';
```

Add these `computed` and helpers (alongside the existing ones):

```ts
const isDropTarget = computed(() =>
  ui.dragState !== null && ui.dragState.cardId !== props.card.id,
);

function isSelectedSlot(slot: import('@/types/slots').SlotType): boolean {
  const sel = ui.itemSelection;
  if (sel === null || sel.cardId !== props.card.id) return false;
  return sel.targets.some((t) => t.kind === 'slot' && t.slot === slot);
}

function isSelectedDofus(index: number): boolean {
  const sel = ui.itemSelection;
  if (sel === null || sel.cardId !== props.card.id) return false;
  return sel.targets.some((t) => t.kind === 'dofus' && t.index === index);
}

function isDofusDropTarget(): boolean {
  // The DofusCell highlights itself only when a single-dofus same-card drag is in progress.
  const d = ui.dragState;
  if (d === null || d.cardId !== props.card.id) return false;
  return d.targets.length === 1 && d.targets[0].kind === 'dofus';
}

function onSlotSelectToggle(slot: import('@/types/slots').SlotType): void {
  if (props.readonly) return;
  ui.toggleItemSelection(props.card.id, { kind: 'slot', slot });
}

function onDofusSelectToggle(index: number): void {
  if (props.readonly) return;
  ui.toggleItemSelection(props.card.id, { kind: 'dofus', index });
}

function buildDragTargets(self: SelectionTarget): { targets: SelectionTarget[]; fromSelection: boolean } {
  const sel = ui.itemSelection;
  if (sel !== null && sel.cardId === props.card.id && sel.targets.some((t) => targetsEqual(t, self))) {
    return { targets: [...sel.targets], fromSelection: true };
  }
  return { targets: [self], fromSelection: false };
}

function onDragStart(event: DragEvent, self: SelectionTarget): void {
  if (props.readonly) return;
  const { targets, fromSelection } = buildDragTargets(self);
  ui.beginDrag(props.card.id, targets, fromSelection);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0);
  }
  if (ui.itemPickerTarget !== null) ui.closeItemPicker();
}

function onDrag(event: DragEvent): void {
  if (event.clientX === 0 && event.clientY === 0) return;
  ui.updateDragCursor(event.clientX, event.clientY);
}

function onDragEnd(): void {
  ui.endDrag();
}

function onArticleDragOver(event: DragEvent): void {
  if (!isDropTarget.value) return;
  event.preventDefault();
}

function onArticleDrop(event: DragEvent): void {
  if (!isDropTarget.value) return;
  event.preventDefault();
  const d = ui.dragState;
  if (d === null) return;
  build.copyItemsBetweenCards(d.cardId, props.card.id, d.targets);
  if (d.fromSelection) ui.clearItemSelection();
}

function onDofusDragOver(event: DragEvent): void {
  if (!isDofusDropTarget()) return;
  event.preventDefault();
}

function onDofusDrop(event: DragEvent, index: number): void {
  const d = ui.dragState;
  if (d === null || d.cardId !== props.card.id) return;
  if (d.targets.length !== 1 || d.targets[0].kind !== 'dofus') return;
  event.preventDefault();
  build.swapDofus(props.card.id, d.targets[0].index, index);
  if (d.fromSelection) ui.clearItemSelection();
}
```

- [ ] **Step 4: Wire the template — root `<article>` and SlotIcon/DofusCell instances**

In `EquipmentCard.vue` template, update the root `<article>`:

```vue
<article
  class="equipment-card select-none text-left flex-shrink-0 flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden"
  :class="[headerOnly ? 'h-auto' : 'h-full max-h-[660px]', { 'is-active': isActive, 'is-drop-target': isDropTarget }]"
  :style="themeStyle"
  :data-class-id="card.classId ?? ''"
  :data-card-id="card.id"
  @mouseenter="hovered = true"
  @mouseleave="hovered = false"
  @click="onCardClick"
  @dragover="onArticleDragOver"
  @drop="onArticleDrop"
  @drag="onDrag"
  @dragend="onDragEnd"
>
```

Update each SlotIcon usage in the template — add the new props/handlers and a `data-slot` attribute for tests:

```vue
<SlotIcon
  class="slot-cell"
  :slot="entry.slot"
  :item="entry.item"
  :card-level="card.level"
  :active="activeOnSlot(entry.slot)"
  :readonly="readonly"
  :selected="isSelectedSlot(entry.slot)"
  :drag-target="false"
  :data-slot="entry.slot"
  @pick="onSlotPick(entry.slot)"
  @clear="onClearSlot(entry.slot)"
  @select-toggle="onSlotSelectToggle(entry.slot)"
  @dragstart="(e) => onDragStart(e, { kind: 'slot', slot: entry.slot })"
/>
```

(Apply to BOTH SlotIcon templates — left column and right column.)

Update the DofusCell usage:

```vue
<DofusCell
  class="slot-cell"
  :item="entry.item"
  :card-level="card.level"
  :active="activeOnDofus(entry.index)"
  :readonly="readonly"
  :selected="isSelectedDofus(entry.index)"
  :drag-target="isDofusDropTarget()"
  :data-dofus-index="entry.index"
  @pick="onDofusPick(entry.index)"
  @clear="onClearDofus(entry.index)"
  @select-toggle="onDofusSelectToggle(entry.index)"
  @dragstart="(e) => onDragStart(e, { kind: 'dofus', index: entry.index })"
  @dragover="(e) => onDofusDragOver(e)"
  @drop="(e) => onDofusDrop(e, entry.index)"
/>
```

- [ ] **Step 5: Make sure SlotIcon and DofusCell forward `data-*` attributes**

Vue passes through unknown attributes to the root element by default when there's a single root in the child. Verify that `SlotIcon.vue` and `DofusCell.vue` each have a single root `<div>` (they do per the existing code). No change needed unless `inheritAttrs: false` is set — confirm it isn't.

- [ ] **Step 6: Add the `is-drop-target` style to the card**

Append to `<style scoped>` in `EquipmentCard.vue`:

```css
.equipment-card.is-drop-target {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 2px theme('colors.accent.DEFAULT'), 0 0 24px rgba(93, 207, 224, 0.5);
}
</style>
```

(Wait — append BEFORE the closing `</style>`; don't add an extra closing tag. Make sure exactly one `</style>` remains.)

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: PASS (existing tests + the 6 new EquipmentCard-drag tests).

- [ ] **Step 8: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/EquipmentCard.vue tests/components/EquipmentCard-drag.spec.ts
git commit -m "feat(EquipmentCard): wire D&D — selection, dragstart, swap, cross-card copy"
```

---

## Task 10: `App.vue` — mount overlay + global Escape

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Mount `<DragOverlay />` once**

Edit `src/App.vue`:

Add the import in `<script setup>`:

```ts
import DragOverlay from '@/components/DragOverlay.vue';
```

In the template, just before the closing root element (the existing top-level wrapper), add:

```vue
<DragOverlay />
```

- [ ] **Step 2: Wire the window `keydown.Escape` listener**

Add to `<script setup>`:

```ts
import { onMounted, onBeforeUnmount } from 'vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

function onWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (ui.dragState !== null) ui.endDrag();
  if (ui.itemSelection !== null) ui.clearItemSelection();
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeyDown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeyDown);
});
```

(If `useUiStore` is already imported / `ui` already declared elsewhere in App.vue, reuse the existing import/declaration rather than re-declaring.)

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke in the dev server**

Run: `npm run dev`

Then in the browser, verify:

1. Click on a filled slot → picker opens (unchanged baseline).
2. Ctrl+click on a filled slot → turquoise ring + `✓` badge appear; picker does NOT open.
3. Ctrl+click again → ring disappears.
4. Ctrl+click multiple slots (one helmet, one ring, one dofus) → all three highlight; status persists.
5. Drag from a selected slot onto another card's body → all three items copy to homologous slots on the target; selection clears.
6. Drag from a NON-selected filled slot onto another card → that one item copies; selection stays intact.
7. Drag a dofus from index 2 to index 5 of the SAME card → they swap (or move if 5 was empty).
8. Drag a dofus to an EQUIPMENT slot of the same card → no-op.
9. Drag a dofus to another card → copies to dofus #2 of the target.
10. Press `Escape` while a selection is active → ring/badge disappear on all slots.
11. Press `Escape` during a drag (mid-flight) → DragOverlay disappears, selection persists if it existed.
12. Drag onto the source card (non-slot area) → no-op.
13. Cursor on a filled draggable slot shows `grab`; during drag the global cursor turns `grabbing` (optional — only if you choose to add the body class; otherwise the cursor stays default during native drag).
14. The DragOverlay follows the cursor and shows up to 3 stacked icons + a `×N` badge for selections of 4+.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat(App): mount DragOverlay + window Escape clears selection/drag"
```

---

## Self-review checklist (run before declaring done)

1. **Spec coverage check** — every locked decision from the spec maps to at least one task:
   - Decision 1 (dofus-only reorder) → Task 9 step 3 `onDofusDrop` guard + Task 3 (no equipment swap action defined).
   - Decision 2 (swap on occupied) → Task 3 `swapDofus`.
   - Decision 3 (mixed selection) → Task 2 `toggleItemSelection`.
   - Decision 4 (homologous mapping, overwrite) → Task 4 `copyItemsBetweenCards`.
   - Decision 5 (single drag = copy) → Task 9 `buildDragTargets` falls back to `[self]` when not selected.
   - Decision 6 (single source card) → Task 2 `toggleItemSelection` replaces selection on different `cardId`.
   - Decision 7 (no a11y V1) → not implemented; listed in spec Out of scope.
   - Decision 8 (no Playwright) → only Vitest specs in tasks.
2. **Spec edge cases**:
   - Empty slot drag prevented → `:draggable="filled && !readonly"` in Tasks 7/8.
   - Drop on source card no-op → Task 9 `isDropTarget` excludes own card.
   - Same-card equipment slot drop no-op → no listener wired in Task 9 (slot's drop event isn't bound, only article's, and article excludes self).
   - Picker close on dragstart → Task 9 `onDragStart` calls `ui.closeItemPicker()`.
   - Over-leveled accepted silently → `copyItemsBetweenCards` doesn't filter.
   - Readonly inert → `:draggable="filled && !readonly"` + handlers early-return on `props.readonly`.
   - OS-cancel preserves selection → `dragend` only calls `endDrag()`, not `clearItemSelection`.
   - localStorage exclusion → no persistence layer added (Pinia state is in-memory).
3. **Visual feedback** — selected ring + ✓ pastille (Tasks 7/8 CSS), card drop-target ring (Task 9 step 6), DragOverlay (Task 6). Cursor `grab` on filled slots set in Tasks 7/8.
4. **Tests cover** — store unit tests (Tasks 2/3/4), DragOverlay smoke (Task 6), EquipmentCard wiring smoke (Task 9).
5. **Type naming consistency** — `SelectionTarget`, `ItemSelection`, `targetsEqual` used identically across `src/types/selection.ts` (Task 1), ui store (Task 2), build store (Task 4), components (Tasks 7/8/9). `swapDofus(cardId, fromIndex, toIndex)` and `copyItemsBetweenCards(sourceCardId, targetCardId, targets)` signatures used identically in store implementation and component callers.
6. **No placeholders** — re-read each task: every code block is concrete, every command has expected output.
