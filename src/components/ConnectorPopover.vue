<script setup lang="ts">
import { ref, computed } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';

const props = defineProps<{
  anchorX: number;
  anchorY: number;
  ignoreEl: HTMLElement | null;
}>();

const emit = defineEmits<{
  empty: [];
  copy: [];
  close: [];
}>();

const popoverRef = ref<HTMLElement | null>(null);

const VERTICAL_GAP = 10;
const VIEWPORT_MARGIN = 12;
const WIDTH = 280;

const style = computed(() => {
  const ideal = props.anchorX - WIDTH / 2;
  const maxLeft = window.innerWidth - WIDTH - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, ideal));
  return {
    left: `${left}px`,
    top: `${props.anchorY + VERTICAL_GAP}px`,
    width: `${WIDTH}px`,
  };
});

onClickOutside(popoverRef, () => emit('close'), {
  ignore: props.ignoreEl ? [props.ignoreEl] : [],
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close');
});
</script>

<template>
  <Teleport to="body">
    <!-- Same visual grammar as the trailing ConnectorEnd ghost card: turquoise outline,
         two side-by-side action buttons with stacked icon + label. Just wrapped in a
         floating dashed-outline panel so it reads as "an inline mini-version" of the
         end-of-timeline picker. -->
    <div
      ref="popoverRef"
      class="connector-popover fixed flex gap-2 p-2 rounded-xl border-2 border-dashed border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] z-[60]"
      :style="{
        ...style,
        background: 'rgba(8,8,8,0.85)',
      }"
    >
      <button
        type="button"
        class="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-lg border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.10] hover:bg-[#5DCFE0]/[0.18] hover:border-[#5DCFE0]/60 transition-colors"
        @click="emit('copy')"
      >
        <svg class="w-7 h-7 text-[#8AE0EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        <span class="font-sans font-bold text-[12px] uppercase tracking-[0.06em] text-[#8AE0EE]">Copier</span>
      </button>
      <button
        type="button"
        class="flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-lg border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.10] hover:bg-[#5DCFE0]/[0.18] hover:border-[#5DCFE0]/60 transition-colors"
        @click="emit('empty')"
      >
        <svg class="w-7 h-7 text-[#8AE0EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span class="font-sans font-bold text-[12px] uppercase tracking-[0.06em] text-[#8AE0EE]">Nouveau</span>
      </button>
    </div>
  </Teleport>
</template>
