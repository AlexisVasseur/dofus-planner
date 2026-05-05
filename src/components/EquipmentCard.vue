<script setup lang="ts">
import { computed } from 'vue';
import CardHeader from './CardHeader.vue';
import EquipmentSlot from './EquipmentSlot.vue';
import DofusCell from './DofusCell.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';
import type { Card } from '@/types/build';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getClassAssets } from '@/composables/useClassAssets';

// Hex equivalents of Tailwind tokens used in color-mix tinting + active fallback.
// Keep in sync with tailwind.config.ts: bg-surface=#0a0a0a, border-default=#262626, accent.DEFAULT=#5DCFE0.
const SURFACE_BASE = '#0a0a0a';
const BORDER_BASE = '#262626';
const FALLBACK_ACCENT = '#5DCFE0';

const props = defineProps<{ card: Card }>();
const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);

const themeStyle = computed(() => {
  const a = getClassAssets(props.card.classId);
  const base: Record<string, string> = { width: 'var(--card-width, 320px)' };
  if (a) {
    base['--class-dominant'] = a.colors.dominant;
    base['--class-soft'] = a.colors.soft;
    base['--class-accent'] = a.colors.accent;
    base.backgroundColor = `color-mix(in srgb, ${SURFACE_BASE} 92%, ${a.colors.dominant} 8%)`;
    base.borderColor = `color-mix(in srgb, ${BORDER_BASE} 70%, ${a.colors.dominant} 30%)`;
  }
  if (isActive.value) {
    const accent = a?.colors.accent ?? FALLBACK_ACCENT;
    base.boxShadow = `0 0 0 1px ${accent}aa, 0 0 12px ${accent}22, 0 4px 32px rgba(0,0,0,0.4)`;
  } else {
    base.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
  }
  return base;
});

function onRemoveCard() {
  // Clear active/picker if they pointed at this card
  if (ui.activeCardId === props.card.id) ui.setActiveCard(null);
  if (ui.itemPickerTarget?.cardId === props.card.id) ui.closeItemPicker();
  if (ui.classPickerCardId === props.card.id) ui.closeClassPicker();
  build.removeCard(props.card.id);
}

const slotItems = computed(() => SLOT_ORDER.map((slot) => {
  const ref = props.card.slots[slot];
  return { slot, item: ref ? getCachedItem(ref.itemId) : null };
}));

const dofusItems = computed(() => {
  const out = [];
  for (let i = 0; i < DOFUS_COUNT; i++) {
    const ref = props.card.dofus[i];
    out.push({ index: i, item: ref ? getCachedItem(ref.itemId) : null });
  }
  return out;
});

function activeOnSlot(slot: string): boolean {
  return ui.itemPickerTarget?.kind === 'slot'
    && ui.itemPickerTarget.cardId === props.card.id
    && ui.itemPickerTarget.slot === slot;
}
function activeOnDofus(index: number): boolean {
  return ui.itemPickerTarget?.kind === 'dofus'
    && ui.itemPickerTarget.cardId === props.card.id
    && ui.itemPickerTarget.index === index;
}

function onClearSlot(slot: import('@/types/slots').SlotType): void {
  build.setSlot(props.card.id, slot, null);
  // Close picker if it was opened on this slot by the same click that triggered the dblclick
  if (ui.itemPickerTarget?.kind === 'slot'
      && ui.itemPickerTarget.cardId === props.card.id
      && ui.itemPickerTarget.slot === slot) {
    ui.closeItemPicker();
  }
}

function onClearDofus(index: number): void {
  build.setDofus(props.card.id, index, null);
  if (ui.itemPickerTarget?.kind === 'dofus'
      && ui.itemPickerTarget.cardId === props.card.id
      && ui.itemPickerTarget.index === index) {
    ui.closeItemPicker();
  }
}
</script>

<template>
  <article
    class="equipment-card select-none text-left flex-shrink-0 h-full flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden transition-all"
    :style="themeStyle"
    :class="{ 'is-active': isActive }"
    :data-class-id="card.classId ?? ''"
    @mouseenter="ui.setActiveCard(card.id)"
  >
    <CardHeader
      :class-id="card.classId"
      :level="card.level"
      :title="card.title"
      @open-class-picker="ui.openClassPicker(card.id)"
      @update:level="(v) => build.setLevel(card.id, v)"
      @update:title="(v) => build.setTitle(card.id, v)"
      @remove="onRemoveCard"
    />
    <div class="p-4 flex-1 flex flex-col min-h-0">
      <EquipmentSlot
        v-for="entry in slotItems"
        :key="entry.slot"
        class="flex-1 min-h-0 max-h-14 overflow-hidden"
        :slot="entry.slot"
        :item="entry.item"
        :card-level="card.level"
        :active="activeOnSlot(entry.slot)"
        @pick="ui.openItemPicker({ kind: 'slot', cardId: card.id, slot: entry.slot })"
        @clear="onClearSlot(entry.slot)"
      />
      <div class="grid grid-cols-6 gap-1.5 mt-auto pt-4 flex-shrink-0">
        <DofusCell
          v-for="entry in dofusItems"
          :key="entry.index"
          :item="entry.item"
          :card-level="card.level"
          :active="activeOnDofus(entry.index)"
          @pick="ui.openItemPicker({ kind: 'dofus', cardId: card.id, index: entry.index })"
          @clear="onClearDofus(entry.index)"
        />
      </div>
    </div>
  </article>
</template>
