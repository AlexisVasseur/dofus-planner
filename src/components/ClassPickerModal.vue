<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useEventListener, useWindowSize, onClickOutside } from '@vueuse/core';
import { CLASSES } from '@/data/classes';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { getClassAssets } from '@/composables/useClassAssets';

const ui = useUiStore();
const build = useBuildStore();

// Popover dimensions + viewport margins. POP_W/H are only used in the modal fallback;
// anchored mode mirrors the card's actual rendered size.
const POP_W = 360;
const POP_H = 460;
const GAP = 12;
const MARGIN_X = 12;
const MARGIN_Y = 12;
const CHROME_TOP = 60;
const CHROME_BOTTOM = 60;
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
  side: 'right' | 'left';
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
  if (ui.classPickerCardId === null) return;

  // Mobile / narrow viewports → centered modal
  if (viewportW.value < MOBILE_BREAKPOINT) {
    const w = Math.min(viewportW.value - 32, POP_W);
    const h = Math.min(viewportH.value - 120, POP_H);
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

  const cardEl = document.querySelector(`[data-card-id="${ui.classPickerCardId}"]`) as HTMLElement | null;
  if (!cardEl) return;
  const r = cardEl.getBoundingClientRect();

  // Mirror the card's rendered size for visual symmetry.
  const popW = r.width;
  const popH = r.height;

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
    side = 'right';
    left = Math.max(MARGIN_X, viewportW.value - popW - MARGIN_X);
  }

  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = viewportH.value - CHROME_BOTTOM - popH - MARGIN_Y;
  const top = Math.max(minTop, Math.min(maxTop, r.top));

  position.value = { mode: 'anchored', top, left, width: popW, height: popH, side };
}

// Recompute on open / card switch + reset list scroll. nextTick lets the anchor card mount.
watch(() => ui.classPickerCardId, async (id) => {
  if (id === null) return;
  await nextTick();
  recomputePosition();
  if (listRef.value) listRef.value.scrollTop = 0;
}, { immediate: true });

useEventListener(window, 'resize', recomputePosition);
useEventListener(window, 'scroll', recomputePosition, { passive: true, capture: true });

const open = computed(() => ui.classPickerCardId !== null);
const card = computed(() => ui.classPickerCardId
  ? build.cards.find((c) => c.id === ui.classPickerCardId) ?? null
  : null,
);

function pick(classId: typeof CLASSES[number]['id']) {
  if (!ui.classPickerCardId) return;
  build.setClass(ui.classPickerCardId, classId);
  ui.closeClassPicker();
}

function close() { ui.closeClassPicker(); }

function cellStyle(classId: string, selected: boolean) {
  const a = getClassAssets(classId);
  if (!a) return {} as Record<string, string>;
  if (selected) {
    return {
      borderColor: a.colors.accent,
      backgroundColor: `color-mix(in srgb, ${a.colors.dominant} 12%, transparent)`,
      boxShadow: `0 0 16px color-mix(in srgb, ${a.colors.accent} 30%, transparent)`,
    };
  }
  return {
    '--class-accent': a.colors.accent,
    '--class-dominant': a.colors.dominant,
  } as Record<string, string>;
}

// Outside-click closes — ignore the trigger buttons in card headers so opening another
// card's class picker switches the target instead of closing+reopening.
onClickOutside(popoverRef, (e) => {
  const t = e.target as HTMLElement | null;
  if (t && t.closest('.class-picker-trigger')) return;
  close();
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && ui.classPickerCardId !== null) close();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="open && position.mode === 'modal'"
        class="fixed inset-0 z-[59] backdrop-blur-sm"
        style="background: rgba(0,0,0,0.5);"
        @click="close"
      />
    </Transition>
    <Transition name="popover">
      <aside
        v-if="open"
        ref="popoverRef"
        class="popover-card fixed flex flex-col rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(93,207,224,0.10)] overflow-hidden z-[60]"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: position.width + 'px',
          height: position.height + 'px',
          background: 'rgba(8,8,8,0.85)',
          '--enter-x': position.side === 'right' ? '-6px' : '6px',
        }"
      >
        <header class="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 class="font-sans font-bold text-[12px] text-[#8AE0EE] tracking-[0.06em] uppercase">Choisir une classe</h2>
          <button
            type="button"
            @click="close"
            aria-label="Fermer"
            class="w-7 h-7 inline-flex items-center justify-center rounded-full border border-white/10 text-text-faint hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
          >
            <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div ref="listRef" class="flex-1 overflow-y-auto p-3 thin-scroll">
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="c in CLASSES"
              :key="c.id"
              class="cell relative aspect-square overflow-hidden border rounded-md transition-all"
              :class="card?.classId === c.id
                ? 'is-selected'
                : 'border-border-subtle is-pickable hover:-translate-y-0.5'"
              :style="cellStyle(c.id, card?.classId === c.id)"
              @click="pick(c.id)"
            >
              <img
                v-if="getClassAssets(c.id)"
                :src="getClassAssets(c.id)!.thumbnail"
                :alt="c.name"
                class="absolute inset-0 w-full h-full object-cover pointer-events-none"
                loading="lazy"
                decoding="async"
              />
              <div class="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"></div>
              <span class="absolute inset-x-1 bottom-1 font-sans font-semibold text-[9px] tracking-tight uppercase text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none truncate w-[calc(100%-0.5rem)]">{{ c.name }}</span>
            </button>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
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

.cell.is-pickable:hover {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 6%, transparent);
}

/* Thin scrollbar in the app's turquoise tone (Firefox + WebKit) */
.thin-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(93, 207, 224, 0.30) transparent;
}
.thin-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.thin-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.thin-scroll::-webkit-scrollbar-thumb {
  background: rgba(93, 207, 224, 0.30);
  border-radius: 999px;
  transition: background 150ms ease;
}
.thin-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(138, 224, 238, 0.55);
}
</style>
