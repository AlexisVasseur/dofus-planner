# Bulk-apply item across level range — Design Spec

**Date:** 2026-05-20
**Status:** Approved — ready for implementation planning

## Problem

When the user plans a long timeline (e.g. cards at level 1, 30, 50, 60, 70, 80, 100, 120…), some equipment pieces stay relevant across multiple consecutive checkpoints. Re-picking the same Coiffe on every card between level 55 and level 80 is tedious. The user wants to apply one item to a contiguous level range in a single action.

## Goal

In the item picker, expose an opt-in **"Tranche"** mode that broadcasts the picked item to every existing card whose level falls in a user-defined `[from, to]` range, on the same slot the picker was opened on.

## Scope

### In scope
- Toggle + range inputs inside `ItemPickerPopover.vue`.
- New `setSlotRange` / `setDofusRange` actions in the build store.
- Minimal toast system to confirm the bulk action (count + range).
- Tests covering the store actions and the picker branching logic.

### Out of scope
- Creating cards that don't exist in the range (no implicit checkpoint creation).
- Undo / history.
- Multi-slot bulk apply (e.g. "apply the full set across the range" — only the slot the picker is open on).
- Persisted preference for the toggle (resets when the picker closes).

## User flow

1. User clicks an empty or filled slot on card *C* (active card). The picker opens (existing flow).
2. Above the search bar, the user sees a compact toggle labeled **"Tranche"** with the muted hint *"Cette card uniquement"*. Toggle is OFF by default.
3. User flips the toggle ON. Two number inputs appear: *"de [X] à [Y]"*, pre-filled with `[C.level, nextCard.level - 1]` (or `[C.level, 200]` if *C* is the last card). User can edit both bounds.
4. User clicks an item in the list:
   - If toggle OFF → existing behavior (single-slot write on *C*).
   - If toggle ON → the store action writes the item to every card in range that can equip it; the picker stays open (so the user can pick more items for the same range), but emits a toast confirming the action.
5. Toggle and range values persist while the picker is open. Closing the picker (click-outside, ESC, picking from a different slot) resets them.

## Behavioral rules

### Range semantics
- A card is "in range" iff `card.level !== null && card.level >= from && card.level <= to`.
- Bounds are clamped to `[1, 200]` on input.
- If the user enters `from > to`, the values are swapped silently before apply (no error UI).
- If no card satisfies the range, the action runs and updates zero cards. The toast says *"Coiffe Bouftou : 0 card mise à jour (X–Y)"*. We don't disable the click — the empty count is informative.

### Slot mapping
- Bulk applies to the **same slot key** as the picker target.
- `slot: 'coiffe'` → writes `coiffe` on every in-range card.
- `slot: 'anneau1'` → writes `anneau1` (not `anneau2`) — positional, no spillover.
- `dofus[2]` → writes `dofus[2]` on every in-range card (positional).

### Item-level filtering
- Cards in range whose `card.level < item.levelRequired` are **skipped silently** (preventing invalid build states).
- The toast count reflects only cards actually updated.

### Overwrite policy
- **Silent overwrite.** Every eligible card in range has its target slot replaced, even if it already contained a different item. (Decision from clarifying Q3.)

### Validation
- `from` and `to` are clamped on input change (`min=1 max=200`).
- No "disabled state" on the item list — every click is actionable; the result is just the apply-and-toast.

## Architecture

### Store actions (`src/stores/build.ts`)

```ts
// Returns the number of cards actually updated (after level-requirement filtering).
function setSlotRange(
  slot: SlotType,
  range: [number, number],
  ref: ItemRef,
): number;

function setDofusRange(
  index: number,
  range: [number, number],
  ref: ItemRef,
): number;
```

Implementation outline:
1. Resolve `item = getCachedItem(ref.itemId)` from `useItemCatalog`. If missing, treat `levelRequired` as 0 (item is in the picker → almost certainly cached, but defensive).
2. Normalize range: `[from, to] = [min, max]`.
3. Iterate `this.cards`, filter by range and level-requirement, mutate slot, count.
4. Return count.

This keeps the multi-card mutation in the store layer (testable in isolation, no DOM involvement).

### Picker UI (`src/components/ItemPickerPopover.vue`)

New local state:
```ts
const rangeMode = ref(false);
const rangeFrom = ref(0);
const rangeTo = ref(0);
```

Computed defaults from `target` + `build.cards`:
```ts
const rangeDefaults = computed<[number, number]>(() => {
  const current = build.cards.find((c) => c.id === target.value?.cardId);
  if (!current || current.level === null) return [1, 200];
  const next = build.cards
    .filter((c) => c.level !== null && c.level > current.level!)
    .sort((a, b) => a.level! - b.level!)[0];
  const to = next ? next.level! - 1 : 200;
  return [current.level, Math.max(current.level, to)];
});
```

Watcher on `rangeMode`:
```ts
watch(rangeMode, (on) => {
  if (on) {
    [rangeFrom.value, rangeTo.value] = rangeDefaults.value;
  }
});
```

Item click handler branches:
```ts
function onPickItem(item: Item): void {
  const ref: ItemRef = { itemId: item.id };
  if (!target.value) return;
  if (!rangeMode.value) {
    // existing behavior
    if (target.value.kind === 'slot') build.setSlot(target.value.cardId, target.value.slot, ref);
    else build.setDofus(target.value.cardId, target.value.index, ref);
    ui.closeItemPicker();
    return;
  }
  // bulk
  const range: [number, number] = [rangeFrom.value, rangeTo.value];
  const count = target.value.kind === 'slot'
    ? build.setSlotRange(target.value.slot, range, ref)
    : build.setDofusRange(target.value.index, range, ref);
  const [lo, hi] = range[0] <= range[1] ? range : [range[1], range[0]];
  toast.show(`${item.name} : ${count} card${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour (${lo}–${hi})`);
  // Keep picker open so user can pick more items for the same range.
}
```

When the picker re-opens for a different `target` (different card or different slot), `rangeMode` is reset to `false` via existing `target` watcher pattern.

### Toast system (new — minimal)

**`src/composables/useToast.ts`:**
- Singleton store-like state (a `ref<ToastMessage[]>`).
- `show(message: string, durationMs = 3000)` pushes a message with `id`, removes after timer.
- Exposes `messages` (readonly) and `show`.

**`src/components/AppToast.vue`:**
- Reads `messages` from `useToast`.
- Renders a stack of toasts in the bottom-center, `<Teleport to="body">`, fixed positioning.
- Tailwind: same translucent panel grammar as the chrome (`rgba(8,8,8,0.85)`, `backdrop-blur-md`, turquoise border `border-[#5DCFE0]/40`, rounded-md).
- Each toast slides up + fades on enter, fades on leave (`<TransitionGroup>`).

Mounted once in `App.vue` next to other chrome.

## Edge cases

| Case | Behavior |
|---|---|
| Toggle ON, range = `[80, 80]`, current card lvl 80 | Applies to card 80 only — same as single-card mode. Toast: "… 1 card mise à jour (80–80)". |
| Toggle ON, `from > to` | Inputs are auto-swapped at apply time (no UI error). Toast shows the normalized range. |
| Item at lvl 80, range covers cards at lvl 30 and lvl 90 | Card 30 is skipped (levelRequired filter); card 90 is updated. Toast: "1 card…". |
| No card in range | Action runs, count = 0. Toast: "0 card mise à jour". |
| Picker opens on dofus[2], range applied | All in-range cards get the item at dofus[2]. dofus[0..1] and dofus[3..5] are untouched. |
| Picker opens on `anneau1` | Only `anneau1` is updated across range; `anneau2` untouched. |
| User opens picker on a different card mid-flow | `target` change resets `rangeMode`, `rangeFrom`, `rangeTo`. |
| Card with `level === null` in range | Skipped (cannot satisfy `card.level >= from`). |

## Testing

### Store (`tests/stores/build.spec.ts`)
- `setSlotRange` applies to all in-range cards on the right slot.
- Cards out of range are untouched.
- Cards with `level === null` are skipped.
- Cards with `level < item.levelRequired` are skipped.
- Returns the correct count.
- `setDofusRange` applies to the same positional index across cards.
- Inverted range `[80, 50]` produces the same result as `[50, 80]`.

### Picker (`tests/components/ItemPickerPopover.spec.ts`)
- Toggle OFF → click item → `setSlot` is called once with the target card.
- Toggle ON → click item → `setSlotRange` is called with the current range; picker stays open.
- Toggling ON pre-fills range with `[currentLevel, nextLevel - 1]`.
- Last card in timeline → ON pre-fills with `[currentLevel, 200]`.
- Closing the picker resets toggle.

### Toast
- `useToast.show(msg)` adds a message and auto-removes after 3000ms (use fake timers).
- Multiple messages queue properly.

## File checklist

**Modify:**
- `src/stores/build.ts` — add `setSlotRange`, `setDofusRange`.
- `src/components/ItemPickerPopover.vue` — toggle, inputs, branched handler.
- `src/App.vue` — mount `<AppToast />`.

**Create:**
- `src/composables/useToast.ts`
- `src/components/AppToast.vue`
- `tests/stores/build.spec.ts` (if missing) or extend the existing one.
- `tests/components/ItemPickerPopover.spec.ts` (if missing) or extend.
- `tests/composables/useToast.spec.ts`

## Visual contract

Toggle area at the top of the picker (above search):
```
┌─────────────────────────────────────────┐
│  [○ Tranche]   Cette card uniquement   │   ← OFF
├─────────────────────────────────────────┤
│  [● Tranche]   de [ 55 ] à [ 80 ]      │   ← ON
└─────────────────────────────────────────┘
```

Toggle: same sliding-pill grammar as the topbar view-mode toggle.
Inputs: small `bg-white/[0.06] border border-white/15 rounded-md` number inputs, `w-14`, `text-center`, font-mono, with `min=1 max=200`.
Color of the muted hint: `text-text-faint`.
Active state of the toggle: turquoise pill `bg-[#5DCFE0] text-[#0A2530]`.

Toast (bottom-center):
- `fixed bottom-6 left-1/2 -translate-x-1/2`
- `rgba(8,8,8,0.85) backdrop-blur-md`
- `border border-[#5DCFE0]/40 rounded-md`
- `px-4 py-2 text-[13px] text-text-default font-sans`
- Enter: `translateY(8px) opacity-0 → translateY(0) opacity-100` over 180ms.
- Leave: `opacity-100 → opacity-0` over 160ms.

## Open implementation choices (low-risk)

- Toast stack max depth: 3 (older ones drop). Not critical for the use case but prevents pile-up.
- Counts in French: `card` vs `cards`, `mise` vs `mises` — kept simple, no i18n layer.
