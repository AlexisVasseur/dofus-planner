<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useEventListener, useWindowSize, onClickOutside } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useItemSearch, isOverLeveled, type SearchTarget } from '@/composables/useItemCatalog';
import { SLOT_LABEL } from '@/types/slots';

const ui = useUiStore();
const build = useBuildStore();

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

  // Vertical: top-align with card, then clamp into viewport (avoid header + minimap)
  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = viewportH.value - CHROME_BOTTOM - POP_H - MARGIN_Y;
  const top = Math.max(minTop, Math.min(maxTop, r.top));

  position.value = { mode: 'anchored', top, left, width: POP_W, height: POP_H, side };
}

// Recompute when the target changes (open or switch); next tick ensures the anchor card
// is mounted (matters when the picker opens immediately after a card was added).
watch(() => ui.itemPickerTarget, async (t) => {
  if (t === null) return;
  await nextTick();
  recomputePosition();
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

const filterMode = ref<'all' | 'eligible' | 'over'>('all');
const sortMode = ref<'level' | 'name'>('level');

const card = computed(() => target.value
  ? build.cards.find((c) => c.id === target.value!.cardId) ?? null
  : null,
);

const slotForFilter = ref<SearchTarget>(null);
watch(slotForQuery, (v) => { slotForFilter.value = v; }, { immediate: true });

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

const filtered = computed(() => {
  let arr = results.value.slice();
  const cardLvl = card.value?.level ?? null;
  if (filterMode.value === 'eligible' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired <= cardLvl);
  } else if (filterMode.value === 'over' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired > cardLvl);
  }
  arr.sort((a, b) => sortMode.value === 'level'
    ? a.levelRequired - b.levelRequired
    : a.name.localeCompare(b.name));
  return arr;
});

const sheetTitle = computed(() => {
  if (!target.value) return '';
  if (target.value.kind === 'slot') return `Choisir une ${SLOT_LABEL[target.value.slot].toLowerCase()}`;
  return `Choisir un dofus / trophée`;
});

function pick(itemId: number) {
  if (!target.value) return;
  if (target.value.kind === 'slot') {
    build.setSlot(target.value.cardId, target.value.slot, { itemId });
  } else {
    build.setDofus(target.value.cardId, target.value.index, { itemId });
  }
  ui.closeItemPicker();
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
</script>

<template>
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
            { mode: 'level', label: 'Trier · niveau' },
            { mode: 'name',  label: 'Trier · nom' },
          ]"
          :key="opt.mode"
          class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
          :class="sortMode === opt.mode
            ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
            : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
          @click="sortMode = opt.mode as 'level' | 'name'"
        >{{ opt.label }}</button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 py-1.5">
        <p v-if="loading" class="text-text-dim text-xs px-3 py-4">Chargement…</p>
        <p v-else-if="error" class="text-danger-soft text-xs px-3 py-4">Erreur : {{ error }}</p>
        <p v-else-if="filtered.length === 0" class="text-text-dim text-xs px-3 py-4">Aucun item.</p>
        <button
          v-for="it in filtered"
          :key="it.id"
          type="button"
          class="item flex items-center gap-3 px-3 py-2.5 rounded-md w-full transition-colors hover:bg-[#8AE0EE]/[0.06]"
          :class="{
            'bg-[#5DCFE0]/[0.10] shadow-[inset_0_0_0_1px_rgba(93,207,224,0.5)]':
              target?.kind === 'slot'
                ? card?.slots[target.slot]?.itemId === it.id
                : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
          }"
          @click="pick(it.id)"
        >
          <div
            class="it-ic w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'bg-[#2a1414] border border-danger text-danger-soft shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
              : 'bg-bg-slot-filled border border-border-slot-filled text-text-muted'"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" class="w-6 h-6" />
            <span v-else>○</span>
          </div>
          <div class="it-info flex-1 min-w-0 text-left">
            <div class="text-text-default text-xs font-medium truncate">{{ it.name }}</div>
            <div class="text-text-faint text-[10px] font-mono truncate" v-if="it.stats.length">{{ it.stats.join(' · ') }}</div>
          </div>
          <span
            class="text-[10px] font-mono rounded px-2 py-0.5 border"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'text-danger-soft border-danger/40 bg-danger/10'
              : 'text-text-dim border-border-default bg-bg-page'"
          >lv {{ it.levelRequired }}</span>
        </button>
      </div>
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
</style>
