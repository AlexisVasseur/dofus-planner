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
  <div class="conn w-[180px] relative flex items-center justify-center py-4" ref="root">
    <button
      type="button"
      class="pill-plus relative z-20 rounded-full font-display tracking-[0.2em] uppercase flex items-center gap-2.5 px-5 py-2.5 transition-all"
      :class="open
        ? 'bg-accent text-[#061a13] shadow-[0_0_0_4px_#050505,0_0_28px_rgba(91,211,168,0.5),0_4px_14px_rgba(0,0,0,0.55)] scale-[1.04]'
        : 'bg-bg-surface border border-accent/70 text-accent shadow-[0_0_0_4px_#050505,0_0_12px_rgba(91,211,168,0.15)] hover:bg-accent hover:text-[#061a13] hover:border-accent hover:shadow-[0_0_0_4px_#050505,0_0_28px_rgba(91,211,168,0.5)]'"
      @click="toggle"
    >
      <span class="font-sans text-[18px] font-bold leading-none">+</span>
      <span v-if="open" class="text-sm">Ajouter</span>
    </button>
    <ConnectorPopover v-if="open" @empty="pickEmpty" @copy="pickCopy" />
  </div>
</template>
