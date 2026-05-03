<script setup lang="ts">
defineEmits<{
  empty: [];
  copy: [];
}>();
</script>

<template>
  <div class="popover absolute top-[calc(50%+28px)] left-1/2 -translate-x-1/2 bg-bg-surface border border-border-default rounded-lg p-1 flex flex-col min-w-[180px] shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(91,211,168,0.15)] z-30">
    <button
      class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-accent"
      @click="$emit('empty')"
    >
      <span>Card vide</span>
      <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Slots vides</span>
    </button>
    <div class="h-px bg-border-subtle my-0.5"></div>
    <button
      class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-accent"
      @click="$emit('copy')"
    >
      <span>Copier la précédente</span>
      <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Reprend l'état</span>
    </button>
  </div>
</template>
