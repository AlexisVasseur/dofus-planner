<script setup lang="ts">
import { ref, computed } from 'vue';
import { useElementBounding } from '@vueuse/core';
import ConnectorPopover from './ConnectorPopover.vue';
import { useBuildStore } from '@/stores/build';

const props = defineProps<{ afterCardId: string }>();

const build = useBuildStore();
const open = ref(false);
const pillRef = ref<HTMLButtonElement | null>(null);

const { x: pillX, y: pillY, width: pillW, bottom: pillBottom } = useElementBounding(pillRef);

const anchorX = computed(() => pillX.value + pillW.value / 2);
const anchorY = computed(() => pillBottom.value);

function toggle() { open.value = !open.value; }
function pickEmpty() { build.addEmptyCardAfter(props.afterCardId); open.value = false; }
function pickCopy() { build.addCopyCardAfter(props.afterCardId); open.value = false; }
function close() { open.value = false; }

// Silence unused-warning on pillY (kept for future flip-above-anchor logic)
void pillY;
</script>

<template>
  <div class="conn w-[52px] flex-shrink-0 relative flex items-center justify-center py-4">
    <button
      ref="pillRef"
      type="button"
      class="pill-plus relative z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all"
      :class="open
        ? 'bg-white text-[#0a0a0a] shadow-[0_0_0_3px_#050505,0_0_24px_rgba(255,255,255,0.35),0_4px_12px_rgba(0,0,0,0.55)] scale-[1.08]'
        : 'bg-bg-surface border border-white/40 text-white/80 shadow-[0_0_0_3px_#050505,0_0_10px_rgba(255,255,255,0.10)] hover:bg-white hover:text-[#0a0a0a] hover:border-white hover:shadow-[0_0_0_3px_#050505,0_0_24px_rgba(255,255,255,0.40)] hover:scale-[1.08]'"
      :aria-label="open ? 'Fermer le menu' : 'Ajouter une étape'"
      @click="toggle"
    >
      <span class="font-sans text-[18px] font-bold leading-none -mt-0.5">+</span>
    </button>
    <ConnectorPopover
      v-if="open"
      :anchor-x="anchorX"
      :anchor-y="anchorY"
      :ignore-el="pillRef"
      @empty="pickEmpty"
      @copy="pickCopy"
      @close="close"
    />
  </div>
</template>
