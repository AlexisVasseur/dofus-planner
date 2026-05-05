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

const VERTICAL_GAP = 8;
const VIEWPORT_MARGIN = 12;
const ESTIMATED_WIDTH = 220;

const style = computed(() => {
  const ideal = props.anchorX - ESTIMATED_WIDTH / 2;
  const maxLeft = window.innerWidth - ESTIMATED_WIDTH - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(maxLeft, ideal));
  return {
    left: `${left}px`,
    top: `${props.anchorY + VERTICAL_GAP}px`,
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
    <div
      ref="popoverRef"
      class="popover fixed bg-bg-surface border border-border-default rounded-lg p-1 flex flex-col min-w-[200px] shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(93,207,224,0.08)] z-[60]"
      :style="style"
    >
      <button
        type="button"
        class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-[#8AE0EE]"
        @click="emit('empty')"
      >
        <span>Card vide</span>
        <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Slots vides</span>
      </button>
      <div class="h-px bg-border-subtle my-0.5"></div>
      <button
        type="button"
        class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-[#8AE0EE]"
        @click="emit('copy')"
      >
        <span>Copier la précédente</span>
        <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Reprend l'état</span>
      </button>
    </div>
  </Teleport>
</template>
