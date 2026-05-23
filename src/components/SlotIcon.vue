<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import type { SlotType } from '@/types/slots';
import { SLOT_LABEL } from '@/types/slots';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';
import ItemStatsTooltip from './ItemStatsTooltip.vue';

const props = defineProps<{
  slot: SlotType;
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
  readonly?: boolean;
  /** Reader-only flag: paints a turquoise ring around the slot to signal a diff. */
  changed?: boolean;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
}>();

const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
const filled = computed(() => props.item !== null);
const tooltipLabel = computed(() => filled.value ? props.item!.name : SLOT_LABEL[props.slot]);
const slotSvg = computed(() => getSlotIconSvg(props.slot));

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
    class="slot-icon aspect-square rounded-md transition-colors flex items-center justify-center group relative outline-none"
    :class="[
      filled
        ? 'bg-white/[0.06] border border-white/15'
        : 'bg-white/[0.02] border border-dashed border-white/10',
      readonly ? 'cursor-default' : 'cursor-pointer',
      readonly ? 'is-readonly' : '',
      overLvl ? 'is-over-lvl' : '',
      active ? 'is-active' : '',
      changed ? 'is-changed' : '',
    ]"
    @click="!readonly && emit('pick')"
    @dblclick.stop="!readonly && emit('clear')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <img
      v-if="filled && item!.iconUrl"
      :src="item!.iconUrl"
      :alt="tooltipLabel"
      class="w-3/4 h-3/4 pointer-events-none"
    />
    <svg
      v-else
      viewBox="0 0 24 24"
      class="w-1/2 h-1/2 pointer-events-none"
      :class="filled ? 'text-text-muted' : 'text-text-ghost'"
      v-html="slotSvg"
    />
    <!-- Over-level corner dot -->
    <span
      v-if="overLvl"
      class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_6px_rgba(220,38,38,0.6)] pointer-events-none"
    ></span>
    <!-- Clear × on hover (Builder only) -->
    <button
      v-if="filled && !readonly"
      type="button"
      class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-bg-elev border border-border-default text-text-muted text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft transition-opacity z-10"
      aria-label="Vider"
      title="Vider"
      @click.stop="emit('clear')"
    >×</button>
    <ItemStatsTooltip :open="showTip" :trigger-el="cellRef" :item="item" />
  </div>
</template>

<style scoped>
.slot-icon:not(.is-readonly):hover:not(.is-active) {
  border-style: solid;
  border-color: color-mix(in srgb, var(--class-accent, #5DCFE0) 35%, transparent);
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 4%, transparent);
}
.slot-icon.is-over-lvl {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
}
.slot-icon.is-active {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: theme('colors.bg-slot-filled');
  box-shadow: 0 0 0 1px var(--class-accent, theme('colors.accent.DEFAULT')), 0 0 12px color-mix(in srgb, var(--class-accent, #5DCFE0) 40%, transparent);
}
.slot-icon.is-changed {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 8px rgba(93, 207, 224, 0.4);
}
</style>
