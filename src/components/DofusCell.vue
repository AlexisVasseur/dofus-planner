<script setup lang="ts">
import { computed } from 'vue';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';

const props = defineProps<{
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
}>();

const emit = defineEmits<{ pick: []; clear: [] }>();

const filled = computed(() => props.item !== null);
const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
</script>

<template>
  <div
    class="dofus-cell aspect-square rounded-md transition-colors flex items-center justify-center group relative cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent"
    :class="filled
      ? 'bg-bg-slot-filled border border-border-slot-filled'
      : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    :data-over-lvl="overLvl"
    :data-active="active"
    role="button"
    tabindex="0"
    :aria-label="filled && item ? item.name : 'Slot dofus vide'"
    @click="emit('pick')"
    @dblclick.stop="emit('clear')"
    @keydown.enter.prevent="emit('pick')"
    @keydown.space.prevent="emit('pick')"
    @keydown.delete.prevent="emit('clear')"
  >
    <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="item!.name" class="w-3/4 h-3/4 pointer-events-none" />
    <span v-else-if="!filled" class="text-text-ghost text-xs pointer-events-none">◇</span>
    <span
      v-if="overLvl"
      class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_6px_rgba(220,38,38,0.6)] pointer-events-none"
    ></span>
    <button
      v-if="filled"
      type="button"
      class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-bg-elev border border-border-default text-text-muted text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft transition-opacity z-10"
      aria-label="Vider"
      title="Vider"
      @click.stop="emit('clear')"
    >×</button>
  </div>
</template>

<style scoped>
.dofus-cell:hover:not([data-active='true']) {
  border-style: solid;
  border-color: theme('colors.accent.DEFAULT');
  background-color: rgba(91, 211, 168, 0.06);
}
.dofus-cell[data-over-lvl='true'] {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
}
.dofus-cell[data-active='true'] {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 12px rgba(91, 211, 168, 0.4);
}
</style>
