<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';

const build = useBuildStore();
const ui = useUiStore();

function newBuild() {
  if (window.confirm('Réinitialiser le build ? Cette action est irréversible.')) {
    build.resetBuild();
    ui.setActiveCard(null);
    ui.closeItemPicker();
    ui.closeClassPicker();
  }
}
</script>

<template>
  <header
    class="topbar flex items-center justify-between px-5 py-3 border-b border-border-subtle relative z-[5] backdrop-blur-md"
    style="background: rgba(5,5,5,0.8);"
  >
    <div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
      <span class="dot w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(91,211,168,0.6)]"></span>
      Dofus level planner
    </div>
    <div class="actions flex gap-2">
      <button
        type="button"
        class="bg-accent text-[#061a13] border border-accent rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-110"
        @click="newBuild"
      >Nouveau build</button>
    </div>
  </header>
</template>
