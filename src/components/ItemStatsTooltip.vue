<script setup lang="ts">
import { computed } from 'vue';
import type { Item } from '@/data/dofusdb';
import { renderItemStatsMax } from '@/composables/useItemCatalog';
import { useMousePosition } from '@/composables/useMousePosition';

const props = defineProps<{
  open: boolean;
  item: Item | null;
  // Optional, kept for backwards-compat with call sites that still pass it. The tooltip
  // now follows the cursor regardless.
  triggerEl?: HTMLElement | null;
}>();

const { x: mouseX, y: mouseY } = useMousePosition();

const WIDTH = 260;
const HEIGHT_ESTIMATE = 220;
const OFFSET = 16;       // distance from the cursor
const MARGIN = 12;       // viewport edge padding

const position = computed(() => {
  let left = mouseX.value + OFFSET;
  let top = mouseY.value + OFFSET;
  // Flip to the LEFT of the cursor if we'd overflow the right edge.
  if (left + WIDTH + MARGIN > window.innerWidth) {
    left = mouseX.value - OFFSET - WIDTH;
  }
  // Flip ABOVE the cursor if we'd overflow the bottom edge.
  if (top + HEIGHT_ESTIMATE + MARGIN > window.innerHeight) {
    top = mouseY.value - OFFSET - HEIGHT_ESTIMATE;
  }
  // Final clamps (degenerate cases where the cursor is in a corner).
  left = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, left));
  top = Math.max(MARGIN, Math.min(window.innerHeight - HEIGHT_ESTIMATE - MARGIN, top));
  return { left, top };
});

const lines = computed<string[]>(() => renderItemStatsMax(props.item));

// triggerEl is intentionally unused — kept only to satisfy existing call sites.
void props.triggerEl;
</script>

<template>
  <Teleport to="body">
    <Transition name="tip">
      <div
        v-if="open && item"
        class="fixed z-[60] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-none"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: WIDTH + 'px',
          background: 'rgba(8,8,8,0.85)',
        }"
        role="tooltip"
      >
        <header class="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <div class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-white/[0.06] border border-white/15">
            <img v-if="item.iconUrl" :src="item.iconUrl" :alt="item.name" class="w-6 h-6" />
            <span v-else class="text-text-faint">○</span>
          </div>
          <span class="flex-1 min-w-0 truncate font-sans font-bold text-xs text-[#8AE0EE] tracking-[0.02em]">{{ item.name }}</span>
          <span class="font-mono text-[10px] text-white rounded px-2 py-0.5 border border-border-default bg-bg-page shrink-0">lv {{ item.levelRequired }}</span>
        </header>
        <ul
          v-if="lines.length > 0"
          class="flex flex-col gap-1 px-3 py-2.5 font-sans text-xs text-text-default leading-tight"
        >
          <li
            v-for="(l, i) in lines"
            :key="i"
            class="truncate"
          >{{ l }}</li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tip-enter-active, .tip-leave-active {
  transition: opacity 120ms ease;
}
.tip-enter-from, .tip-leave-to {
  opacity: 0;
}
</style>
