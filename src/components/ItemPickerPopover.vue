<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useEventListener, useWindowSize, onClickOutside } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useItemSearch, isOverLeveled, getCachedItem, renderItemStatsMax, type SearchTarget } from '@/composables/useItemCatalog';
import { SLOT_PICK_PHRASE } from '@/types/slots';
import { useToast } from '@/composables/useToast';
import ItemStatsTooltip from './ItemStatsTooltip.vue';
import type { Item } from '@/data/dofusdb';

const ui = useUiStore();
const build = useBuildStore();
const toast = useToast();

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
const listRef = ref<HTMLElement | null>(null);
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

  // Popover matches the card's actual rendered size for visual symmetry.
  const popW = r.width;
  const popH = r.height;

  // Horizontal: right of card by default, flip to left if it would overflow
  const fitsRight = viewportW.value - (r.right + GAP) >= popW + MARGIN_X;
  const fitsLeft = r.left - GAP >= popW + MARGIN_X;

  let side: 'right' | 'left';
  let left: number;
  if (fitsRight) {
    side = 'right';
    left = r.right + GAP;
  } else if (fitsLeft) {
    side = 'left';
    left = r.left - GAP - popW;
  } else {
    // Degenerate small viewport: clamp to right edge with margin
    side = 'right';
    left = Math.max(MARGIN_X, viewportW.value - popW - MARGIN_X);
  }

  // Vertical: top-align with card, then clamp into viewport (avoid header + minimap)
  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = viewportH.value - CHROME_BOTTOM - popH - MARGIN_Y;
  const top = Math.max(minTop, Math.min(maxTop, r.top));

  position.value = { mode: 'anchored', top, left, width: popW, height: popH, side };
}

// Recompute when the target changes (open or switch); next tick ensures the anchor card
// is mounted (matters when the picker opens immediately after a card was added).
// Also resets the item list scroll to the top — switching slots or reopening the picker
// always shows the catalog from the start, never wherever the user last scrolled to.
watch(() => ui.itemPickerTarget, async (t) => {
  if (t === null) return;
  await nextTick();
  recomputePosition();
  if (listRef.value) listRef.value.scrollTop = 0;
}, { immediate: true });

// Recompute on viewport resize and on window scroll (Builder timeline scrolls).
useEventListener(window, 'resize', recomputePosition);
useEventListener(window, 'scroll', recomputePosition, { passive: true, capture: true });

const target = computed(() => ui.itemPickerTarget);

// Resolve the search target for DofusDB:
// - slot picker: query the slot's typeIds (typeId filtering server-side)
// - dofus picker: use the special 'dofus' target to query Dofus + Trophée typeIds
const slotForQuery = computed<SearchTarget>(() => {
  if (!target.value) return null;
  if (target.value.kind === 'slot') return target.value.slot;
  return 'dofus';
});
const search = ref('');

// Skeleton placeholder rows shown while items load. Widths varied so the
// shimmer doesn't read as 6 identical bars.
const SKELETON_NAME_WIDTHS = ['w-4/5', 'w-3/5', 'w-3/4', 'w-2/3', 'w-4/6', 'w-3/4', 'w-2/3', 'w-3/5'];

const filterMode = ref<'all' | 'eligible' | 'over'>('eligible');
const sortMode = ref<'level' | 'name'>('level');

// Bulk "tranche" mode: when ON, picking an item broadcasts it to every existing card
// whose level lies in [rangeFrom, rangeTo] (and can equip it).
const rangeMode = ref(false);
const rangeFrom = ref(1);
const rangeTo = ref(200);

const card = computed(() => target.value
  ? build.cards.find((c) => c.id === target.value!.cardId) ?? null
  : null,
);

const slotForFilter = ref<SearchTarget>(null);
watch(slotForQuery, (v) => { slotForFilter.value = v; }, { immediate: true });

// Default range derived from the active card + the next card in the timeline.
// Mental model: "this gear is worn from the current checkpoint until the next one".
const rangeDefaults = computed<[number, number]>(() => {
  const current = card.value;
  if (!current || current.level === null) return [1, 200];
  const next = build.cards
    .filter((c) => c.level !== null && c.level > current.level!)
    .sort((a, b) => a.level! - b.level!)[0];
  const to = next && next.level !== null ? next.level - 1 : 200;
  return [current.level, Math.max(current.level, to)];
});

// Flipping the toggle ON refills the inputs with the contextual defaults.
watch(rangeMode, (on) => {
  if (on) {
    const [from, to] = rangeDefaults.value;
    rangeFrom.value = from;
    rangeTo.value = to;
  }
});

// Switching the picker to a different slot or card resets the bulk-mode state.
watch(target, (newT, oldT) => {
  if (!newT) return;
  const changed = !oldT
    || oldT.cardId !== newT.cardId
    || oldT.kind !== newT.kind
    || (newT.kind === 'slot' && oldT.kind === 'slot' && oldT.slot !== newT.slot)
    || (newT.kind === 'dofus' && oldT.kind === 'dofus' && oldT.index !== newT.index);
  if (changed) {
    rangeMode.value = false;
  }
});

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(200, Math.max(1, Math.round(n)));
}
function onRangeFromInput(e: Event): void {
  rangeFrom.value = clampLevel(Number((e.target as HTMLInputElement).value));
}
function onRangeToInput(e: Event): void {
  rangeTo.value = clampLevel(Number((e.target as HTMLInputElement).value));
}

watch(target, (newTarget, oldTarget) => {
  if (newTarget === null) return; // closing — leave search alone
  // Reset on first open or whenever the target points to a different slot/dofus
  if (
    !oldTarget
    || oldTarget.kind !== newTarget.kind
    || oldTarget.cardId !== newTarget.cardId
    || (newTarget.kind === 'slot' && oldTarget.kind === 'slot' && oldTarget.slot !== newTarget.slot)
    || (newTarget.kind === 'dofus' && oldTarget.kind === 'dofus' && oldTarget.index !== newTarget.index)
  ) {
    search.value = '';
  }
});

const { results, loading, error } = useItemSearch(slotForFilter, search);

// Force the skeleton on for at least 500ms after any user action that changes
// what the list shows (target switch, filter change, sort change). Avoids the
// previous flicker where stale items were briefly visible before the real
// loading state kicked in, and gives the filter/sort interactions instant
// visual feedback even though the actual filter/sort is client-side.
const forceSkeleton = ref(false);
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;
function showSkeletonFor(ms = 500): void {
  forceSkeleton.value = true;
  if (skeletonTimer !== null) clearTimeout(skeletonTimer);
  skeletonTimer = setTimeout(() => {
    forceSkeleton.value = false;
    skeletonTimer = null;
  }, ms);
}
watch(() => ui.itemPickerTarget, (t) => {
  if (t === null) return;
  showSkeletonFor(500);
});
watch([filterMode, sortMode], () => { showSkeletonFor(500); });
// Search keystrokes also trigger the skeleton so stale results disappear
// immediately while the debounced fetch is still in flight.
watch(search, () => { showSkeletonFor(500); });

const showSkeleton = computed(() => loading.value || forceSkeleton.value);

const filtered = computed(() => {
  let arr = results.value.slice();
  const cardLvl = card.value?.level ?? null;
  if (filterMode.value === 'eligible' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired <= cardLvl);
  } else if (filterMode.value === 'over' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired > cardLvl);
  }
  arr.sort((a, b) => sortMode.value === 'level'
    ? b.levelRequired - a.levelRequired   // descending: highest level first
    : a.name.localeCompare(b.name));
  return arr;
});

const sheetTitle = computed(() => {
  if (!target.value) return '';
  if (target.value.kind === 'slot') return `Choisir ${SLOT_PICK_PHRASE[target.value.slot]}`;
  return `Choisir un dofus / trophée`;
});

function pick(itemId: number) {
  if (!target.value) return;
  if (!rangeMode.value) {
    if (target.value.kind === 'slot') {
      build.setSlot(target.value.cardId, target.value.slot, { itemId });
    } else {
      build.setDofus(target.value.cardId, target.value.index, { itemId });
    }
    ui.closeItemPicker();
    return;
  }
  // Bulk-apply path: write to every in-range card and surface a toast.
  // Picker stays open so the user can pick more items for the same range.
  const range: [number, number] = [rangeFrom.value, rangeTo.value];
  const count = target.value.kind === 'slot'
    ? build.setSlotRange(target.value.slot, range, { itemId })
    : build.setDofusRange(target.value.index, range, { itemId });
  const [lo, hi] = range[0] <= range[1] ? range : [range[1], range[0]];
  const name = getCachedItem(itemId)?.name ?? 'Item';
  const plural = count > 1 ? 's' : '';
  toast.show(`${name} : ${count} card${plural} mise${plural} à jour (${lo}–${hi})`);
}

function close() { ui.closeItemPicker(); }

// Outside-click closes — but ignore the trigger elements (slot rows / dofus cells)
// so clicking another slot in the same or another card switches the target instead
// of closing+reopening the popover.
onClickOutside(popoverRef, (e) => {
  const t = e.target as HTMLElement | null;
  if (t && t.closest('.slot-row, .dofus-cell')) return;
  close();
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && ui.itemPickerTarget) close();
});

// Per-row hover tooltip in the search list: shared ItemStatsTooltip that anchors to
// whichever row the cursor is currently over. Same 300ms delay as the builder slots.
const rowRefs = ref<Record<number, HTMLElement | null>>({});
function setRowRef(id: number, el: HTMLElement | null): void {
  if (el === null) delete rowRefs.value[id];
  else rowRefs.value[id] = el;
}
const hoveredItem = ref<Item | null>(null);
const hoveredEl = computed<HTMLElement | null>(() => {
  const it = hoveredItem.value;
  return it ? rowRefs.value[it.id] ?? null : null;
});
let rowHoverTimer: ReturnType<typeof setTimeout> | null = null;
function onRowEnter(it: Item): void {
  if (rowHoverTimer !== null) clearTimeout(rowHoverTimer);
  rowHoverTimer = setTimeout(() => { hoveredItem.value = it; rowHoverTimer = null; }, 300);
}
function onRowLeave(): void {
  if (rowHoverTimer !== null) { clearTimeout(rowHoverTimer); rowHoverTimer = null; }
  hoveredItem.value = null;
}
// Closing the picker or switching target dismisses any open tooltip.
watch(target, () => { onRowLeave(); });
</script>

<template>
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
      <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <h2 class="font-sans font-bold text-[12px] text-[#8AE0EE] tracking-[0.06em] uppercase">{{ sheetTitle }}</h2>
        <button
          type="button"
          @click="close"
          aria-label="Fermer"
          class="w-8 h-8 inline-flex items-center justify-center rounded-full border border-white/10 text-text-faint hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <!-- Tranche (bulk-apply) toggle. OFF = single-card pick (current card only).
           ON exposes two clamp-to-[1,200] number inputs pre-filled with the current
           card's level → next card's level - 1 (or 200 if last). -->
      <div class="px-5 py-3 border-b border-border-subtle flex items-center gap-3">
        <button
          type="button"
          role="switch"
          :aria-checked="rangeMode"
          @click="rangeMode = !rangeMode"
          class="relative inline-flex items-center h-5 w-9 rounded-full border transition-colors shrink-0"
          :class="rangeMode
            ? 'bg-[#5DCFE0] border-[#5DCFE0]'
            : 'bg-white/[0.04] border-white/15 hover:border-[#8AE0EE]/40'"
        >
          <span
            class="absolute top-[1px] w-[15px] h-[15px] rounded-full transition-all"
            :class="rangeMode
              ? 'left-[18px] bg-[#0A2530]'
              : 'left-[1px] bg-white/60'"
          />
        </button>
        <span class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] text-text-faint shrink-0">Tranche</span>
        <template v-if="rangeMode">
          <span class="font-sans text-[11px] text-text-dim">de</span>
          <input
            type="number"
            min="1"
            max="200"
            :value="rangeFrom"
            @input="onRangeFromInput"
            class="w-14 text-center bg-white/[0.06] border border-white/15 rounded-md px-1 py-0.5 text-[12px] font-mono text-text-default outline-none focus:border-[#5DCFE0]/60"
          />
          <span class="font-sans text-[11px] text-text-dim">à</span>
          <input
            type="number"
            min="1"
            max="200"
            :value="rangeTo"
            @input="onRangeToInput"
            class="w-14 text-center bg-white/[0.06] border border-white/15 rounded-md px-1 py-0.5 text-[12px] font-mono text-text-default outline-none focus:border-[#5DCFE0]/60"
          />
        </template>
        <span v-else class="font-sans text-[11px] text-text-dim">Cette card uniquement</span>
      </div>
      <div class="px-5 py-3 border-b border-border-subtle">
        <input
          v-model="search"
          placeholder="Rechercher…"
          class="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
          autofocus
        />
      </div>
      <div class="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border-subtle">
        <button
          v-for="opt in [
            { mode: 'all',      label: 'Tous' },
            { mode: 'eligible', label: '≤ Lv ' + (card?.level ?? '?') },
            { mode: 'over',     label: 'Au-dessus' },
          ]"
          :key="opt.mode"
          class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
          :class="filterMode === opt.mode
            ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
            : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
          @click="filterMode = opt.mode as 'all' | 'eligible' | 'over'"
        >{{ opt.label }}</button>
        <span class="w-px self-stretch bg-border-subtle mx-1" aria-hidden="true" />
        <button
          v-for="opt in [
            { mode: 'level', label: 'Niveau ↓' },
            { mode: 'name',  label: 'A-Z' },
          ]"
          :key="opt.mode"
          class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
          :class="sortMode === opt.mode
            ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
            : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
          @click="sortMode = opt.mode as 'level' | 'name'"
        >{{ opt.label }}</button>
      </div>
      <div ref="listRef" class="flex-1 overflow-y-auto px-2 py-1.5 thin-scroll">
        <!-- Loading skeleton: 8 placeholder rows mimicking the real item-row layout
             so when results land they replace the skeletons without flicker.
             Forced on for 500ms after target/filter/sort changes for instant feedback. -->
        <template v-if="showSkeleton">
          <div
            v-for="(w, i) in SKELETON_NAME_WIDTHS"
            :key="`sk-${i}`"
            class="flex items-center gap-3 px-3 py-2.5 rounded-md w-full animate-pulse"
            aria-hidden="true"
          >
            <div class="w-9 h-9 rounded-md bg-white/[0.06] border border-white/10 shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="h-3 bg-white/[0.06] rounded" :class="w"></div>
              <div class="h-2 bg-white/[0.04] rounded w-1/3 mt-1.5"></div>
            </div>
            <div class="w-9 h-4 bg-white/[0.04] rounded border border-white/10"></div>
          </div>
        </template>
        <p v-else-if="error" class="text-danger-soft text-xs px-3 py-4">Erreur&nbsp;: {{ error }}</p>
        <p v-else-if="filtered.length === 0" class="text-text-dim text-xs px-3 py-4">Aucun item.</p>
        <button
          v-else
          v-for="it in filtered"
          :key="it.id"
          :ref="(el) => setRowRef(it.id, el as HTMLElement | null)"
          type="button"
          class="item flex items-center gap-3 px-3 py-2.5 rounded-md w-full transition-colors hover:bg-[#8AE0EE]/[0.06]"
          :class="{
            'bg-[#5DCFE0]/[0.10] shadow-[inset_0_0_0_1px_rgba(93,207,224,0.5)]':
              target?.kind === 'slot'
                ? card?.slots[target.slot]?.itemId === it.id
                : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
          }"
          @click="pick(it.id)"
          @mouseenter="onRowEnter(it)"
          @mouseleave="onRowLeave"
        >
          <div
            class="it-ic w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'bg-[#2a1414] border border-danger text-danger-soft shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
              : 'bg-white/[0.06] border border-white/15 text-text-muted'"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" class="w-6 h-6" />
            <span v-else>○</span>
          </div>
          <div class="it-info flex-1 min-w-0 text-left">
            <div class="text-text-default text-xs font-medium truncate">{{ it.name }}</div>
            <div class="text-text-faint text-[10px] font-mono truncate" v-if="renderItemStatsMax(it).length">{{ renderItemStatsMax(it).join(' · ') }}</div>
          </div>
          <span
            class="text-[10px] font-mono rounded px-2 py-0.5 border"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'text-danger-soft border-danger/40 bg-danger/10'
              : 'text-text-dim border-border-default bg-bg-page'"
          >lv {{ it.levelRequired }}</span>
        </button>
      </div>
      <!-- Shared hover tooltip for the rows in the search list -->
      <ItemStatsTooltip :open="hoveredItem !== null" :trigger-el="hoveredEl" :item="hoveredItem" />
      </aside>
    </Transition>
  </Teleport>
</template>

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
.backdrop-enter-active, .backdrop-leave-active {
  transition: opacity 150ms ease;
}
.backdrop-enter-from, .backdrop-leave-to {
  opacity: 0;
}
</style>
