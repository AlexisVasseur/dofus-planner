# Item picker popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-side `ItemPickerSheet` (540px fixed) with a 360×320 floating popover anchored to the clicked card, with auto-flip when the card is near the viewport's right edge, and switch the default sort from level-ascending to level-descending.

**Architecture:** A renamed `ItemPickerPopover.vue` Teleported to `body`, positioned via inline `top`/`left` computed from `document.querySelector('[data-card-id="<id>"]').getBoundingClientRect()`. Recomputes on `target` change, window resize, and window scroll. Falls back to a centered modal below 720px viewport width. The Pinia UI store contract (`ui.itemPickerTarget`, `openItemPicker`, `closeItemPicker`) is untouched.

**Tech Stack:** Vue 3.5 SFC `<script setup lang="ts">`, Vite 6, TypeScript 5 strict, VueUse 11 (`onClickOutside`, `useEventListener`), Tailwind 3, Vitest 2 (existing 43 tests must stay green).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/components/ItemPickerPopover.vue` | Renamed from `ItemPickerSheet.vue`. Floating popover component with anchor-based positioning, click-outside dismiss, and modal fallback. | Renamed + rewritten |
| `src/components/EquipmentCard.vue` | Builder card. Already has `:data-class-id`. Gains `:data-card-id`. | 1-line attribute add |
| `src/components/EquipmentCardDiff.vue` | Reader diff card. Same treatment. | 1-line attribute add |
| `src/App.vue` | Root layout. Imports the picker. | Identifier rename only |
| `src/stores/ui.ts` | Picker state (`itemPickerTarget`). | **Unchanged** |
| `src/components/EquipmentSlot.vue`, `DofusCell.vue` | Trigger elements. They already carry `.slot-row` / `.dofus-cell` selectors. | **Unchanged** |

---

## Task 1: Add `data-card-id` attribute to both card components

**Files:**
- Modify: `src/components/EquipmentCard.vue`
- Modify: `src/components/EquipmentCardDiff.vue`

The popover uses `document.querySelector('[data-card-id="<id>"]')` to find its anchor. The cards already render `:data-class-id`; we add a parallel `:data-card-id`.

- [ ] **Step 1: Edit `src/components/EquipmentCard.vue`**

Find the `<article>` opening tag (around line 99). It currently looks like:

```html
<article
  class="equipment-card select-none text-left flex-shrink-0 h-full max-h-[660px] flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden transition-all"
  :style="themeStyle"
  :class="{ 'is-active': isActive }"
  :data-class-id="card.classId ?? ''"
  @mouseenter="ui.setActiveCard(card.id)"
>
```

Add `:data-card-id="card.id"` right after `:data-class-id`:

```html
<article
  class="equipment-card select-none text-left flex-shrink-0 h-full max-h-[660px] flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden transition-all"
  :style="themeStyle"
  :class="{ 'is-active': isActive }"
  :data-class-id="card.classId ?? ''"
  :data-card-id="card.id"
  @mouseenter="ui.setActiveCard(card.id)"
>
```

- [ ] **Step 2: Edit `src/components/EquipmentCardDiff.vue`**

Find the matching `<article>` tag (around line 123). Apply the same edit — add `:data-card-id="card.id"` right after `:data-class-id="card.classId ?? ''"`.

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test -- --run`
Expected: 43 passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/EquipmentCard.vue src/components/EquipmentCardDiff.vue
git commit -m "feat(card): add data-card-id attribute (anchor for upcoming popover)"
```

---

## Task 2: Rename file `ItemPickerSheet.vue` → `ItemPickerPopover.vue` + update App.vue import

**Files:**
- Rename: `src/components/ItemPickerSheet.vue` → `src/components/ItemPickerPopover.vue`
- Modify: `src/App.vue`

Pure rename + import update. No behavior change yet.

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/ItemPickerSheet.vue src/components/ItemPickerPopover.vue
```

- [ ] **Step 2: Edit `src/App.vue`**

Find the import (around line 8):

```ts
import ItemPickerSheet from './components/ItemPickerSheet.vue';
```

Replace with:

```ts
import ItemPickerPopover from './components/ItemPickerPopover.vue';
```

Find the tag in the template (around line 51):

```html
<ItemPickerSheet />
```

Replace with:

```html
<ItemPickerPopover />
```

- [ ] **Step 3: Run typecheck + tests + build**

```bash
npm run typecheck
npm test -- --run
npm run build
```

Expected: typecheck exit 0, 43 tests pass, build success.

- [ ] **Step 4: Commit**

```bash
git add -A src/App.vue src/components/ItemPickerPopover.vue
git commit -m "refactor(picker): rename ItemPickerSheet -> ItemPickerPopover"
```

---

## Task 3: Replace the sheet aside with a positioned popover (Teleport + computePosition)

**Files:**
- Modify: `src/components/ItemPickerPopover.vue`

Replace the right-side full-height `<aside>` with a fixed-position 360×320 popover that anchors to the active card. Adds the position computation, the resize/scroll reactive listeners, and Teleports to `body`.

- [ ] **Step 1: Add imports + constants + position state to `<script setup>`**

Find the existing `<script setup lang="ts">` block at the top of the file. Update the import block (around lines 1–7) so it reads:

```ts
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useEventListener, useWindowSize, onClickOutside } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useItemSearch, isOverLeveled, type SearchTarget } from '@/composables/useItemCatalog';
import { SLOT_LABEL } from '@/types/slots';
```

Right after the existing `const ui = useUiStore();` / `const build = useBuildStore();` lines, add the position computation block. Place it before the `target` computed (so the rest can reference it):

```ts
// Popover dimensions + viewport margins.
const POP_W = 360;
const POP_H = 320;
const GAP = 12;
const MARGIN_X = 12;
const MARGIN_Y = 12;
const CHROME_TOP = 60;     // ~ floating header height + mt-3
const CHROME_BOTTOM = 60;  // ~ floating minimap height + mb-3
const MOBILE_BREAKPOINT = 720;

const popoverRef = ref<HTMLElement | null>(null);
const { width: viewportW, height: viewportH } = useWindowSize();

interface Position {
  mode: 'anchored' | 'modal';
  top: number;
  left: number;
  width: number;
  height: number;
  side: 'right' | 'left'; // anchor side relative to the card
}

const position = ref<Position>({
  mode: 'anchored',
  top: 0,
  left: 0,
  width: POP_W,
  height: POP_H,
  side: 'right',
});

function recomputePosition(): void {
  const t = ui.itemPickerTarget;
  if (t === null) return;

  // Mobile / narrow viewports → centered modal
  if (viewportW.value < MOBILE_BREAKPOINT) {
    const w = Math.min(viewportW.value - 32, POP_W);
    const h = Math.min(viewportH.value - 120, 480);
    position.value = {
      mode: 'modal',
      width: w,
      height: h,
      top: (viewportH.value - h) / 2,
      left: (viewportW.value - w) / 2,
      side: 'right',
    };
    return;
  }

  const cardEl = document.querySelector(`[data-card-id="${t.cardId}"]`) as HTMLElement | null;
  if (!cardEl) return;
  const r = cardEl.getBoundingClientRect();

  // Horizontal: right of card by default, flip to left if it would overflow
  const fitsRight = viewportW.value - (r.right + GAP) >= POP_W + MARGIN_X;
  const fitsLeft = r.left - GAP >= POP_W + MARGIN_X;

  let side: 'right' | 'left';
  let left: number;
  if (fitsRight) {
    side = 'right';
    left = r.right + GAP;
  } else if (fitsLeft) {
    side = 'left';
    left = r.left - GAP - POP_W;
  } else {
    // Degenerate small viewport: clamp to right edge with margin
    side = 'right';
    left = Math.max(MARGIN_X, viewportW.value - POP_W - MARGIN_X);
  }

  // Vertical: top-align with card, then clamp into [CHROME_TOP+MARGIN_Y, viewportH - CHROME_BOTTOM - POP_H - MARGIN_Y]
  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = viewportH.value - CHROME_BOTTOM - POP_H - MARGIN_Y;
  const top = Math.max(minTop, Math.min(maxTop, r.top));

  position.value = { mode: 'anchored', top, left, width: POP_W, height: POP_H, side };
}

// Recompute when the target changes (open or switch), and on next tick to ensure
// the anchor card is mounted (matters when the picker opens from a freshly added card).
watch(() => ui.itemPickerTarget, async (t) => {
  if (t === null) return;
  await nextTick();
  recomputePosition();
}, { immediate: true });

// Recompute on viewport resize and on window scroll (Builder timeline scrolls under the popover).
useEventListener(window, 'resize', recomputePosition);
useEventListener(window, 'scroll', recomputePosition, { passive: true, capture: true });
```

- [ ] **Step 2: Replace the `<aside>` opening tag in the template**

Find the template's `<aside>` (around line 90). It currently looks like:

```html
<Transition name="sheet">
  <aside
    v-if="target"
    class="sheet fixed top-0 right-0 bottom-0 w-[540px] border-l border-[#5DCFE0]/30 backdrop-blur-md shadow-[-24px_0_48px_rgba(0,0,0,0.55)] flex flex-col z-50"
    style="background: rgba(8,8,8,0.85);"
  >
```

Replace the entire opening (Transition wrapper + aside) with:

```html
<Teleport to="body">
  <Transition name="popover">
    <aside
      v-if="target"
      ref="popoverRef"
      class="popover-card fixed flex flex-col rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(93,207,224,0.10)] overflow-hidden z-[55]"
      :style="{
        top: position.top + 'px',
        left: position.left + 'px',
        width: position.width + 'px',
        height: position.height + 'px',
        background: 'rgba(8,8,8,0.85)',
        '--enter-x': position.side === 'right' ? '-6px' : '6px',
      }"
    >
```

- [ ] **Step 3: Replace the closing tags**

Find the existing closing of the aside + Transition near the bottom of the template:

```html
    </aside>
  </Transition>
</template>
```

Replace with:

```html
    </aside>
  </Transition>
</Teleport>
</template>
```

- [ ] **Step 4: Replace the scoped style transitions**

Find the existing `<style scoped>` block at the bottom and replace its content (the `.sheet-*` rules) with:

```css
<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }

.popover-enter-active, .popover-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.popover-enter-from, .popover-leave-to {
  opacity: 0;
  transform: translateX(var(--enter-x, -6px));
}
</style>
```

- [ ] **Step 5: Run typecheck + build**

```bash
npm run typecheck
npm run build
```

Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add src/components/ItemPickerPopover.vue
git commit -m "feat(picker): teleport + 360x320 anchored positioning with right/left flip"
```

---

## Task 4: Replace Esc-only handler with onClickOutside (with slot/dofus ignore)

**Files:**
- Modify: `src/components/ItemPickerPopover.vue`

The current sheet only listens for `Escape`. Add click-outside dismissal that ignores clicks landing on `.slot-row` or `.dofus-cell` (so clicking another slot updates the picker target instead of closing).

- [ ] **Step 1: Replace the Esc-only listener**

Find the bottom of the `<script setup>` block, the existing:

```ts
function close() { ui.closeItemPicker(); }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.itemPickerTarget) close();
});
```

Replace with:

```ts
function close() { ui.closeItemPicker(); }

// Outside-click closes — but ignore the trigger elements (slot rows / dofus cells)
// so clicking another slot in the same or another card switches the target instead
// of closing+reopening.
onClickOutside(popoverRef, (e) => {
  const t = e.target as HTMLElement | null;
  if (t && t.closest('.slot-row, .dofus-cell')) return;
  close();
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && ui.itemPickerTarget) close();
});
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemPickerPopover.vue
git commit -m "feat(picker): close on outside click (ignore slot/dofus triggers)"
```

---

## Task 5: Default sort to descending + relabel sort pills

**Files:**
- Modify: `src/components/ItemPickerPopover.vue`

The user wants newest-equipment-first behavior. Change the level sort from ascending to descending and update the visible label so the direction is explicit.

- [ ] **Step 1: Update the sort comparator**

Find the `filtered` computed (currently around lines 50–62). Inside it, find the line:

```ts
arr.sort((a, b) => sortMode.value === 'level'
  ? a.levelRequired - b.levelRequired
  : a.name.localeCompare(b.name));
```

Replace with:

```ts
arr.sort((a, b) => sortMode.value === 'level'
  ? b.levelRequired - a.levelRequired   // descending: highest level first
  : a.name.localeCompare(b.name));
```

- [ ] **Step 2: Update the sort pill labels**

Find the pill v-for around lines 117–130 (the second `v-for` covering `level` / `name`). Inside the array literal, replace:

```ts
{ mode: 'level', label: 'Trier · niveau' },
{ mode: 'name',  label: 'Trier · nom' },
```

With:

```ts
{ mode: 'level', label: 'Niveau ↓' },
{ mode: 'name',  label: 'A-Z' },
```

- [ ] **Step 3: Run tests + build**

```bash
npm test -- --run
npm run build
```

Expected: 43 tests pass, build green.

- [ ] **Step 4: Commit**

```bash
git add src/components/ItemPickerPopover.vue
git commit -m "feat(picker): default sort by level descending; relabel sort pills"
```

---

## Task 6: Modal fallback below 720px viewport

**Files:**
- Modify: `src/components/ItemPickerPopover.vue`

When the viewport is too narrow for the anchored popover, the position computation already returns `mode: 'modal'` with centered coordinates. We add a backdrop element so the modal mode looks like a proper modal and the user has a tap target to close.

- [ ] **Step 1: Add the backdrop in the template**

Inside the `<Teleport to="body">` block, ABOVE the existing `<Transition name="popover">`, insert:

```html
<Transition name="backdrop">
  <div
    v-if="target && position.mode === 'modal'"
    class="fixed inset-0 z-[54] backdrop-blur-sm"
    style="background: rgba(0,0,0,0.5);"
    @click="close"
  />
</Transition>
```

The full Teleport block now looks like:

```html
<Teleport to="body">
  <Transition name="backdrop">
    <div
      v-if="target && position.mode === 'modal'"
      class="fixed inset-0 z-[54] backdrop-blur-sm"
      style="background: rgba(0,0,0,0.5);"
      @click="close"
    />
  </Transition>
  <Transition name="popover">
    <aside
      v-if="target"
      ref="popoverRef"
      class="popover-card ..."
      ...
    >
      ...
    </aside>
  </Transition>
</Teleport>
```

- [ ] **Step 2: Add the backdrop transition CSS**

In the scoped `<style>` block at the bottom, append:

```css
.backdrop-enter-active, .backdrop-leave-active {
  transition: opacity 150ms ease;
}
.backdrop-enter-from, .backdrop-leave-to {
  opacity: 0;
}
```

- [ ] **Step 3: Run typecheck + build**

```bash
npm run typecheck
npm run build
```

Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add src/components/ItemPickerPopover.vue
git commit -m "feat(picker): modal fallback below 720px viewport"
```

---

## Task 7: Final verification

**Files:** none modified, verification only.

- [ ] **Step 1: Run the full verification battery**

```bash
npm run typecheck
npm test -- --run
npm run build
```

Expected:
- `vue-tsc` exit 0
- 43 tests passed across 8 files
- vite build succeeds with `dist/` artifacts

- [ ] **Step 2: Manual smoke checks**

Start the dev server (`npm run dev`) and verify in a browser:

1. **Open near left edge:** scroll the Builder timeline so the first card is fully visible. Click the Coiffe slot. Popover opens to the **right** of the card.
2. **Open near right edge:** scroll so a card is at the right edge of the viewport. Click a slot. Popover **flips to the left**.
3. **Switch slot, same card:** while the popover is open, click another slot of the same card. Popover stays put; title and content update.
4. **Switch card:** click a slot on a different card. Popover repositions to the new card.
5. **Outside click:** click an empty area of the page-stage background. Popover closes.
6. **Esc:** open the popover, press Esc. Popover closes.
7. **Round X button:** click the X in the popover header. Popover closes.
8. **Sort default:** with no manual sort change, items appear with **highest level first** (Niveau ↓ active).
9. **Resize to mobile:** resize the window below 720px wide and click a slot. The popover renders as a centered modal with a dim backdrop. Click the backdrop → closes.
10. **Vertical clamp:** click a slot near the top or bottom of the timeline. Popover stays within the viewport, never overlapping the floating header or minimap.

If all 10 pass, the feature is shipped.

- [ ] **Step 3: No commit on this task**

This task only verifies. No file changes, no commit.

---

## Summary

7 tasks, ~10 commits total (1 per task except the verify-only Task 7).

The plan touches one component substantially (`ItemPickerPopover.vue`), two cards minimally (data-card-id), and one App.vue identifier rename. The Pinia UI store is untouched. The 43 existing tests stay green throughout.
