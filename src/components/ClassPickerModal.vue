<script setup lang="ts">
import { computed } from 'vue';
import { CLASSES } from '@/data/classes';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { getClassAssets } from '@/composables/useClassAssets';

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
    // For non-selected: store class colors as CSS vars so :hover can use them.
    '--class-accent': a.colors.accent,
    '--class-dominant': a.colors.dominant,
  } as Record<string, string>;
}

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
      <div class="modal bg-bg-surface border border-border-default rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06)] max-w-[720px] w-full mx-4 overflow-hidden">
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 class="font-sans font-semibold text-base text-text-default tracking-[0.05em] uppercase">Choisir une classe</h2>
          <button @click="close" class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5">esc</button>
        </header>
        <div class="grid grid-cols-6 gap-3 p-5">
          <button
            v-for="c in CLASSES"
            :key="c.id"
            class="cell relative aspect-square overflow-hidden border rounded-[10px] transition-all"
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
            <span class="absolute inset-x-1 bottom-1.5 font-sans font-semibold text-[11px] tracking-[0.05em] uppercase text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">{{ c.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.cell.is-pickable:hover {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 6%, transparent);
}
</style>
