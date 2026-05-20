<script setup lang="ts">
import { ref, computed } from 'vue';
import CardHeader from './CardHeader.vue';
import CardDeleteConfirm from './CardDeleteConfirm.vue';
import EquipmentSlot from './EquipmentSlot.vue';
import DofusRow from './DofusRow.vue';
import CardStatsPanel from './CardStatsPanel.vue';
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

const props = withDefaults(defineProps<{ card: Card; readonly?: boolean }>(), {
  readonly: false,
});
const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);
const hovered = ref(false); // visual glow on hover, does NOT change activeCardId
const confirmingDelete = ref(false); // in-place delete confirm replaces the body

const themeStyle = computed(() => {
  const a = getClassAssets(props.card.classId);
  const base: Record<string, string> = { width: 'var(--card-width, 700px)' };
  if (a) {
    base['--class-dominant'] = a.colors.dominant;
    base['--class-soft'] = a.colors.soft;
    base['--class-accent'] = a.colors.accent;
    base.backgroundColor = `color-mix(in srgb, ${SURFACE_BASE} 92%, ${a.colors.dominant} 8%)`;
    base.borderColor = `color-mix(in srgb, ${BORDER_BASE} 70%, ${a.colors.dominant} 30%)`;
  }
  if (isActive.value || hovered.value) {
    const accent = a?.colors.accent ?? FALLBACK_ACCENT;
    base.boxShadow = `0 0 0 1px ${accent}aa, 0 0 12px ${accent}22, 0 4px 32px rgba(0,0,0,0.4)`;
  } else {
    base.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
  }
  return base;
});

function onCardClick(): void {
  if (props.readonly) return;
  // Scroll-to-centre is handled by AppTimeline watching ui.centerCardTick (bumped here).
  ui.setActiveCard(props.card.id);
}

function onHeaderRemove(): void {
  if (props.readonly) return;
  // Toggle the in-place confirm panel. Subsequent × clicks dismiss.
  confirmingDelete.value = !confirmingDelete.value;
}

function onConfirmDelete(): void {
  confirmingDelete.value = false;
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
  if (props.readonly) return;
  build.setSlot(props.card.id, slot, null);
  // Close picker if it was opened on this slot by the same click that triggered the dblclick
  if (ui.itemPickerTarget?.kind === 'slot'
      && ui.itemPickerTarget.cardId === props.card.id
      && ui.itemPickerTarget.slot === slot) {
    ui.closeItemPicker();
  }
}

function onClearDofus(index: number): void {
  if (props.readonly) return;
  build.setDofus(props.card.id, index, null);
  if (ui.itemPickerTarget?.kind === 'dofus'
      && ui.itemPickerTarget.cardId === props.card.id
      && ui.itemPickerTarget.index === index) {
    ui.closeItemPicker();
  }
}

function onSlotPick(slot: import('@/types/slots').SlotType): void {
  if (props.readonly) return;
  ui.openItemPicker({ kind: 'slot', cardId: props.card.id, slot });
}
function onDofusPick(index: number): void {
  if (props.readonly) return;
  ui.openItemPicker({ kind: 'dofus', cardId: props.card.id, index });
}
</script>

<template>
  <article
    class="equipment-card select-none text-left flex-shrink-0 h-full max-h-[660px] flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden"
    :style="themeStyle"
    :class="{ 'is-active': isActive }"
    :data-class-id="card.classId ?? ''"
    :data-card-id="card.id"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="onCardClick"
  >
    <CardHeader
      :class-id="card.classId"
      :level="card.level"
      :title="card.title"
      :confirming-delete="confirmingDelete"
      :readonly="readonly"
      @open-class-picker="readonly || ui.openClassPicker(card.id)"
      @update:level="(v) => build.setLevel(card.id, v)"
      @update:title="(v) => build.setTitle(card.id, v)"
      @remove="onHeaderRemove"
    />
    <!-- Body crossfades between equipment view and in-place delete confirm. -->
    <Transition name="card-body" mode="out-in">
      <CardDeleteConfirm
        v-if="confirmingDelete"
        key="confirm"
        @cancel="confirmingDelete = false"
        @confirm="onConfirmDelete"
      />
      <div v-else key="equipment" class="flex-1 flex flex-col min-h-0">
        <!-- Top: two columns — equipment slots (left) and dofus rows (right). Both use
             a 10-row CSS grid so a dofus row (6 items) gets the SAME row height as an
             equipment row (10 items) — the dofus column just leaves its last 4 grid
             slots empty. A 1px divider separates the two columns. -->
        <div class="flex-1 flex min-h-0 p-4 gap-3">
          <div class="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] min-h-0 min-w-0">
            <EquipmentSlot
              v-for="entry in slotItems"
              :key="entry.slot"
              class="min-h-0 max-h-14 overflow-hidden"
              :slot="entry.slot"
              :item="entry.item"
              :card-level="card.level"
              :active="activeOnSlot(entry.slot)"
              :readonly="readonly"
              @pick="onSlotPick(entry.slot)"
              @clear="onClearSlot(entry.slot)"
            />
          </div>
          <div class="w-px bg-white/10 self-stretch flex-shrink-0" aria-hidden="true"></div>
          <div class="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] min-h-0 min-w-0">
            <DofusRow
              v-for="entry in dofusItems"
              :key="entry.index"
              class="min-h-0 max-h-14 overflow-hidden"
              :index="entry.index"
              :item="entry.item"
              :card-level="card.level"
              :active="activeOnDofus(entry.index)"
              :readonly="readonly"
              @pick="onDofusPick(entry.index)"
              @clear="onClearDofus(entry.index)"
            />
          </div>
        </div>
        <!-- Bottom: aggregated stats panel, full width, horizontal layout -->
        <CardStatsPanel :card="card" />
      </div>
    </Transition>
  </article>
</template>

<style scoped>
.card-body-enter-active, .card-body-leave-active {
  transition: opacity 160ms ease;
}
.card-body-enter-from, .card-body-leave-to {
  opacity: 0;
}
</style>
