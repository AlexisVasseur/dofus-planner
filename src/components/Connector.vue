<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import ConnectorPopover from './ConnectorPopover.vue';
import { useBuildStore } from '@/stores/build';

const props = defineProps<{ afterCardId: string }>();

const build = useBuildStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

onClickOutside(root, () => { open.value = false; });

function toggle() { open.value = !open.value; }
function pickEmpty() { build.addEmptyCardAfter(props.afterCardId); open.value = false; }
function pickCopy() { build.addCopyCardAfter(props.afterCardId); open.value = false; }
</script>

<template>
  <div class="conn w-[400px] flex-shrink-0 relative flex items-center justify-center py-4" ref="root">
    <button
      type="button"
      class="pill-plus relative z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all"
      :class="open
        ? 'bg-accent text-[#061a13] shadow-[0_0_0_3px_#050505,0_0_24px_rgba(91,211,168,0.5),0_4px_12px_rgba(0,0,0,0.55)] scale-[1.08]'
        : 'bg-bg-surface border border-accent/70 text-accent shadow-[0_0_0_3px_#050505,0_0_10px_rgba(91,211,168,0.18)] hover:bg-accent hover:text-[#061a13] hover:border-accent hover:shadow-[0_0_0_3px_#050505,0_0_24px_rgba(91,211,168,0.55)] hover:scale-[1.08]'"
      :aria-label="open ? 'Fermer le menu' : 'Ajouter une étape'"
      @click="toggle"
    >
      <span class="font-sans text-[18px] font-bold leading-none -mt-0.5">+</span>
    </button>
    <ConnectorPopover v-if="open" @empty="pickEmpty" @copy="pickCopy" />
  </div>
</template>
