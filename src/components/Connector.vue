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
  <div class="conn w-[120px] self-stretch relative flex items-center justify-center" ref="root">
    <div class="absolute w-full h-px" style="background: linear-gradient(90deg, transparent 0%, #1f1f1f 20%, #1f1f1f 80%, transparent 100%);"></div>
    <button
      type="button"
      class="pill-plus relative z-20 rounded-full font-display tracking-[0.2em] uppercase flex items-center gap-2 px-3 py-1.5 transition-all"
      :class="open
        ? 'bg-accent text-[#061a13] shadow-[0_0_0_4px_#050505,0_0_24px_rgba(91,211,168,0.45),0_4px_12px_rgba(0,0,0,0.5)] scale-[1.04]'
        : 'bg-transparent border border-accent text-accent shadow-[0_0_0_4px_#050505] hover:bg-accent hover:text-[#061a13] hover:shadow-[0_0_0_4px_#050505,0_0_24px_rgba(91,211,168,0.45)]'"
      @click="toggle"
    >
      <span class="font-sans text-[16px] font-bold leading-none">+</span>
      <span v-if="open" class="text-sm">Ajouter</span>
    </button>
    <ConnectorPopover v-if="open" @empty="pickEmpty" @copy="pickCopy" />
  </div>
</template>
