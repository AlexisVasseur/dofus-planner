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

const props = defineProps<{ card: Card }>();
const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);

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
    class="equipment-card select-none text-left flex-shrink-0 bg-bg-surface border border-border-default rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
    :style="{ width: 'var(--card-width, 320px)' }"
    :class="{ 'ring-1 ring-accent shadow-[0_0_0_1px_rgba(91,211,168,0.4),0_0_32px_rgba(91,211,168,0.15)]': isActive }"
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
    <div class="p-4">
      <EquipmentSlot
        v-for="entry in slotItems"
        :key="entry.slot"
        :slot="entry.slot"
        :item="entry.item"
        :card-level="card.level"
        :active="activeOnSlot(entry.slot)"
        @pick="ui.openItemPicker({ kind: 'slot', cardId: card.id, slot: entry.slot })"
        @clear="onClearSlot(entry.slot)"
      />
      <h3 class="font-display text-[14px] text-accent/85 tracking-[0.3em] uppercase mb-3 mt-4">Dofus &amp; Trophées</h3>
      <div class="grid grid-cols-6 gap-1.5">
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
