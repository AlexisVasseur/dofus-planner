<script setup lang="ts">
import { computed } from 'vue';
import { CLASSES } from '@/data/classes';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import ClassLogo from './ClassLogo.vue';

const ui = useUiStore();
const build = useBuildStore();

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

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.classPickerCardId !== null) close();
});
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center"
      style="background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"
      @click.self="close"
    >
      <div class="modal bg-bg-surface border border-border-default rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_0_1px_rgba(91,211,168,0.1)] max-w-[720px] w-full mx-4 overflow-hidden">
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 class="font-display text-base text-text-default tracking-[0.2em] uppercase">Choisir une classe</h2>
          <button @click="close" class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5">esc</button>
        </header>
        <div class="grid grid-cols-6 gap-3 p-5">
          <button
            v-for="c in CLASSES"
            :key="c.id"
            class="cell aspect-square bg-bg-elev border rounded-[10px] flex flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 transition-all"
            :class="card?.classId === c.id
              ? 'border-accent bg-accent/[0.08] shadow-[0_0_16px_rgba(91,211,168,0.25)]'
              : 'border-border-subtle hover:border-accent hover:-translate-y-0.5 hover:bg-accent/[0.04]'"
            @click="pick(c.id)"
          >
            <ClassLogo :class-id="c.id" :size="36" />
            <span class="font-display text-[11px] tracking-[0.18em] uppercase">{{ c.name }}</span>
          </button>
        </div>
        <footer class="border-t border-border-subtle px-5 py-2.5 text-center text-[10px] text-text-faint">
          Sélection appliquée à <span class="text-accent">cette card</span> uniquement · les vrais logos sont chargés depuis DofusDB
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
