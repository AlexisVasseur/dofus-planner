<script setup lang="ts">
import { useEventListener } from '@vueuse/core';

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('cancel');
});
</script>

<template>
  <div
    class="flex-1 min-h-0 flex flex-col items-stretch justify-center"
    role="dialog"
    aria-label="Confirmer la suppression"
  >
    <div class="flex-1 flex items-center justify-center px-4">
      <p class="font-display text-[15px] font-light tracking-[0.18em] uppercase text-center text-text-default leading-relaxed">
        Supprimer<br />cette étape&nbsp;?
      </p>
    </div>
    <div class="flex border-t border-white/10 flex-shrink-0">
      <button
        type="button"
        class="flex-1 px-4 py-4 font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-text-dim hover:text-[#8AE0EE] transition-colors"
        @click="emit('cancel')"
      >Annuler</button>
      <div class="w-px bg-white/10" aria-hidden="true"></div>
      <button
        type="button"
        class="flex-1 px-4 py-4 font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-danger-soft hover:bg-danger/15 transition-colors"
        @click="emit('confirm')"
      >Supprimer</button>
    </div>
  </div>
</template>
