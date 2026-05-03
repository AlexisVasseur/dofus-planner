<script setup lang="ts">
import { computed } from 'vue';
import type { SlotType } from '@/types/slots';
import { SLOT_LABEL } from '@/types/slots';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';

const props = defineProps<{
  slot: SlotType;
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
}>();

const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
const filled = computed(() => props.item !== null);
const label = computed(() => filled.value ? props.item!.name : SLOT_LABEL[props.slot].toUpperCase());
const slotSvg = computed(() => getSlotIconSvg(props.slot));
</script>

<template>
  <div
    class="slot-row group flex items-center gap-2.5 py-1 rounded-md text-[11px] leading-6 cursor-pointer"
    :class="{
      'is-filled': filled,
      'is-empty': !filled,
      'is-over-lvl': overLvl,
      'is-active': active,
    }"
    @click="emit('pick')"
  >
    <div
      class="icon w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors"
      :class="filled ? 'bg-bg-slot-filled border border-border-slot-filled' : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    >
      <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="label" class="w-4 h-4" />
      <svg
        v-else
        viewBox="0 0 24 24"
        class="w-4 h-4"
        :class="filled ? 'text-text-muted' : 'text-text-ghost'"
        v-html="slotSvg"
      />
    </div>
    <span
      class="label flex-1 transition-colors"
      :class="filled
        ? 'text-text-default'
        : 'text-text-faint tracking-[0.1em] font-semibold text-[10.5px]'"
    >{{ label }}</span>
    <span
      v-if="overLvl"
      class="text-[9.5px] font-mono text-danger-soft border border-danger/40 bg-danger/10 rounded px-1.5 py-0.5"
    >lv {{ item!.levelRequired }}</span>
    <button
      v-else-if="filled"
      class="clear-btn opacity-0 group-hover:opacity-100 w-[22px] h-[22px] rounded-full bg-bg-elev border border-border-default text-text-muted text-xs flex items-center justify-center hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft"
      @click.stop="emit('clear')"
      aria-label="Vider le slot"
    >×</button>
  </div>
</template>

<style scoped>
.slot-row.is-empty:hover .icon {
  border-style: solid;
  border-color: theme('colors.accent.DEFAULT');
  color: theme('colors.accent.DEFAULT');
  background-color: rgba(91, 211, 168, 0.06);
}
.slot-row.is-empty:hover .label {
  color: theme('colors.text.muted');
}
.slot-row.is-filled:hover .icon {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px rgba(91, 211, 168, 0.4);
}
.slot-row.is-over-lvl .icon {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  color: theme('colors.danger.soft');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25), 0 0 8px rgba(220, 38, 38, 0.15);
}
.slot-row.is-active {
  background-color: rgba(91, 211, 168, 0.05);
  box-shadow: inset 0 0 0 1px rgba(91, 211, 168, 0.5);
}
.slot-row.is-active .icon {
  border-color: theme('colors.accent.DEFAULT');
  background-color: theme('colors.bg-slot-filled');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 16px rgba(91, 211, 168, 0.4);
}
</style>
