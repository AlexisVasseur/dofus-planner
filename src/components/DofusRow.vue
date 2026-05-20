<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';
import ItemStatsTooltip from './ItemStatsTooltip.vue';

const props = defineProps<{
  index: number;            // 0..5
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
}>();

const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
const filled = computed(() => props.item !== null);
const label = computed(() => filled.value ? props.item!.name : `Dofus ${props.index + 1}`);

const rowRef = ref<HTMLElement | null>(null);
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
    ref="rowRef"
    class="slot-row group flex items-center gap-3 px-2 py-1.5 rounded-md text-[14px] leading-8"
    :class="{
      'is-filled': filled,
      'is-empty': !filled,
      'is-over-lvl': overLvl,
      'is-active': active,
      'cursor-pointer': !readonly,
      'is-readonly': readonly,
    }"
    @click="!readonly && emit('pick')"
    @dblclick.stop="!readonly && emit('clear')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div
      class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors"
      :class="filled ? 'bg-white/[0.06] border border-white/15' : 'bg-white/[0.02] border border-dashed border-white/10'"
    >
      <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="label" class="w-[26px] h-[26px]" />
      <!-- Generic diamond glyph for empty dofus slot (the slot accepts both Dofus and Trophées). -->
      <svg
        v-else
        viewBox="0 0 24 24"
        class="w-[20px] h-[20px]"
        :class="filled ? 'text-text-muted' : 'text-text-ghost'"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      >
        <path d="M12 3 L21 12 L12 21 L3 12 Z" />
      </svg>
    </div>
    <span
      class="label flex-1 transition-colors truncate"
      :class="filled
        ? 'text-text-default'
        : 'text-text-faint uppercase tracking-[0.1em] font-semibold text-[13px]'"
    >{{ label }}</span>
    <span
      v-if="overLvl"
      class="text-[12px] font-mono text-danger-soft border border-danger/40 bg-danger/10 rounded px-2 py-0.5"
    >lv {{ item!.levelRequired }}</span>
    <button
      v-else-if="filled && !readonly"
      class="clear-btn opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-bg-elev border border-border-default text-text-muted text-sm flex items-center justify-center hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft"
      @click.stop="emit('clear')"
      aria-label="Vider le slot"
    >×</button>
    <ItemStatsTooltip :open="showTip" :trigger-el="rowRef" :item="item" />
  </div>
</template>

<style scoped>
.slot-row.is-empty:not(.is-readonly):hover .icon {
  border-style: solid;
  border-color: color-mix(in srgb, var(--class-accent, #5DCFE0) 35%, transparent);
  color: color-mix(in srgb, var(--class-accent, #5DCFE0) 70%, transparent);
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 4%, transparent);
}
.slot-row.is-empty:not(.is-readonly):hover .label {
  color: theme('colors.text.muted');
}
.slot-row.is-filled:not(.is-readonly):hover .icon {
  border-color: color-mix(in srgb, var(--class-accent, #5DCFE0) 35%, transparent);
}
.slot-row.is-over-lvl .icon {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  color: theme('colors.danger.soft');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25), 0 0 8px rgba(220, 38, 38, 0.15);
}
.slot-row.is-active {
  background-color: color-mix(in srgb, var(--class-dominant, #5DCFE0) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--class-accent, #5DCFE0) 50%, transparent);
}
.slot-row.is-active .icon {
  border-color: var(--class-accent, theme('colors.accent.DEFAULT'));
  background-color: theme('colors.bg-slot-filled');
  box-shadow: 0 0 0 1px var(--class-accent, theme('colors.accent.DEFAULT')), 0 0 16px color-mix(in srgb, var(--class-accent, #5DCFE0) 40%, transparent);
}
</style>
