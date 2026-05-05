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
    class="slot-row group flex items-center gap-3 py-1.5 rounded-md text-[14px] leading-8 cursor-pointer"
    :class="{
      'is-filled': filled,
      'is-empty': !filled,
      'is-over-lvl': overLvl,
      'is-active': active,
    }"
    @click="emit('pick')"
    @dblclick.stop="emit('clear')"
  >
    <div
      class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors"
      :class="filled ? 'bg-bg-slot-filled border border-border-slot-filled' : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    >
      <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="label" class="w-[26px] h-[26px]" />
      <svg
        v-else
        viewBox="0 0 24 24"
        class="w-[26px] h-[26px]"
        :class="filled ? 'text-text-muted' : 'text-text-ghost'"
        v-html="slotSvg"
      />
    </div>
    <span
      class="label flex-1 transition-colors truncate"
      :class="filled
        ? 'text-text-default'
        : 'text-text-faint tracking-[0.1em] font-semibold text-[13px]'"
    >{{ label }}</span>
    <span
      v-if="overLvl"
      class="text-[12px] font-mono text-danger-soft border border-danger/40 bg-danger/10 rounded px-2 py-0.5"
    >lv {{ item!.levelRequired }}</span>
    <button
      v-else-if="filled"
      class="clear-btn opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-bg-elev border border-border-default text-text-muted text-sm flex items-center justify-center hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft"
      @click.stop="emit('clear')"
      aria-label="Vider le slot"
    >×</button>
  </div>
</template>

<style scoped>
.slot-row.is-empty:hover .icon {
  border-style: solid;
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: color-mix(in srgb, var(--class-dominant, #5BD3A8) 6%, transparent);
}
.slot-row.is-empty:hover .label {
  color: theme('colors.text.muted');
}
.slot-row.is-filled:hover .icon {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--class-accent, #5BD3A8) 60%, transparent);
}
.slot-row.is-over-lvl .icon {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  color: theme('colors.danger.soft');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25), 0 0 8px rgba(220, 38, 38, 0.15);
}
.slot-row.is-active {
  background-color: color-mix(in srgb, var(--class-dominant, #5BD3A8) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--class-accent, #5BD3A8) 50%, transparent);
}
.slot-row.is-active .icon {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: theme('colors.bg-slot-filled');
  box-shadow: 0 0 0 1px var(--class-accent, theme('colors.accent.DEFAULT')), 0 0 16px color-mix(in srgb, var(--class-accent, #5BD3A8) 40%, transparent);
}
</style>
