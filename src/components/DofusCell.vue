<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';
import ItemStatsTooltip from './ItemStatsTooltip.vue';

const props = defineProps<{
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
  readonly?: boolean;
}>();

const emit = defineEmits<{ pick: []; clear: [] }>();

const filled = computed(() => props.item !== null);
const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));

const cellRef = ref<HTMLElement | null>(null);
const showTip = ref(false);
let openTimer: ReturnType<typeof setTimeout> | null = null;
function onEnter(): void {
  if (!filled.value) return;
  if (openTimer !== null) clearTimeout(openTimer);
  openTimer = setTimeout(() => { showTip.value = true; openTimer = null; }, 300);
}
function onLeave(): void {
  if (openTimer !== null) { clearTimeout(openTimer); openTimer = null; }
  showTip.value = false;
}
onBeforeUnmount(() => {
  if (openTimer !== null) clearTimeout(openTimer);
});
</script>

<template>
  <div
    ref="cellRef"
    class="dofus-cell aspect-square rounded-md transition-colors flex items-center justify-center group relative outline-none focus-visible:ring-1 focus-visible:ring-accent"
    :class="[
      filled
        ? 'bg-white/[0.06] border border-white/15'
        : 'bg-white/[0.02] border border-dashed border-white/10',
      readonly ? 'cursor-default' : 'cursor-pointer',
      readonly ? 'is-readonly' : '',
    ]"
    :data-over-lvl="overLvl"
    :data-active="active"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? -1 : 0"
    :aria-label="filled && item ? item.name : 'Slot dofus vide'"
    @click="!readonly && emit('pick')"
    @dblclick.stop="!readonly && emit('clear')"
    @keydown.enter.prevent="!readonly && emit('pick')"
    @keydown.space.prevent="!readonly && emit('pick')"
    @keydown.delete.prevent="!readonly && emit('clear')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="item!.name" class="w-3/4 h-3/4 pointer-events-none" />
    <span v-else-if="!filled" class="text-text-ghost text-sm pointer-events-none">◇</span>
    <span
      v-if="overLvl"
      class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_6px_rgba(220,38,38,0.6)] pointer-events-none"
    ></span>
    <button
      v-if="filled && !readonly"
      type="button"
      class="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-bg-elev border border-border-default text-text-muted text-sm leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft transition-opacity z-10"
      aria-label="Vider"
      title="Vider"
      @click.stop="emit('clear')"
    >×</button>
    <ItemStatsTooltip :open="showTip" :trigger-el="cellRef" :item="item" />
  </div>
</template>

<style scoped>
.dofus-cell:not(.is-readonly):hover:not([data-active='true']) {
  border-style: solid;
  border-color: color-mix(in srgb, var(--class-accent, #5DCFE0) 35%, transparent);
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 4%, transparent);
}
.dofus-cell[data-over-lvl='true'] {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
}
.dofus-cell[data-active='true'] {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  box-shadow: 0 0 0 1px var(--class-accent, theme('colors.accent.DEFAULT')), 0 0 12px color-mix(in srgb, var(--class-accent, #5DCFE0) 40%, transparent);
}
</style>
