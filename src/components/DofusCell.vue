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
  <button
    type="button"
    class="dofus-cell aspect-square rounded-md transition-colors flex items-center justify-center group relative"
    :class="filled
      ? 'bg-bg-slot-filled border border-border-slot-filled'
      : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    :data-over-lvl="overLvl"
    :data-active="active"
    @click="emit('pick')"
  >
    <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="item!.name" class="w-3/4 h-3/4" />
    <span v-else-if="!filled" class="text-text-ghost text-xs">◇</span>
    <span
      v-if="overLvl"
      class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_6px_rgba(220,38,38,0.6)]"
    ></span>
    <span
      v-if="filled"
      class="absolute top-0 right-0 w-4 h-4 rounded-full bg-danger/70 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
      role="button"
      @click.stop="emit('clear')"
    >×</span>
  </button>
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
