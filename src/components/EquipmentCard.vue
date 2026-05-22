<script setup lang="ts">
import { ref, computed } from 'vue';
import CardHeader from './CardHeader.vue';
import CardDeleteConfirm from './CardDeleteConfirm.vue';
import SlotIcon from './SlotIcon.vue';
import DofusCell from './DofusCell.vue';
import CardStatsPanel from './CardStatsPanel.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { Card } from '@/types/build';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getClassAssets } from '@/composables/useClassAssets';
import { buildDofusbookUrl } from '@/utils/dofusbook';

// Hex equivalents of Tailwind tokens used in color-mix tinting + active fallback.
// Keep in sync with tailwind.config.ts: bg-surface=#0a0a0a, border-default=#262626, accent.DEFAULT=#5DCFE0.
const SURFACE_BASE = '#0a0a0a';
const BORDER_BASE = '#262626';
const FALLBACK_ACCENT = '#5DCFE0';

const props = withDefaults(defineProps<{ card: Card; readonly?: boolean; headerOnly?: boolean }>(), {
  readonly: false,
  headerOnly: false,
});
const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);
const hovered = ref(false); // visual glow on hover, does NOT change activeCardId
const confirmingDelete = ref(false); // in-place delete confirm replaces the body

const themeStyle = computed(() => {
  const a = getClassAssets(props.card.classId);
  const base: Record<string, string> = { width: 'var(--card-width, 440px)' };
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

function onOpenDofusbook(): void {
  window.open(buildDofusbookUrl(props.card), '_blank', 'noopener,noreferrer');
}

function onConfirmDelete(): void {
  confirmingDelete.value = false;
  // Clear active/picker if they pointed at this card
  if (ui.activeCardId === props.card.id) ui.setActiveCard(null);
  if (ui.itemPickerTarget?.cardId === props.card.id) ui.closeItemPicker();
  if (ui.classPickerCardId === props.card.id) ui.closeClassPicker();
  build.removeCard(props.card.id);
}

// Cruciform layout — left + right slot columns positioned around the central stats panel.
// `null` entries mean "no slot here" (visual gap to align rows between the two columns).
const LEFT_SLOTS: ReadonlyArray<SlotType | null> = ['coiffe', 'cape', null, 'arme', 'bouclier', 'familier'];
const RIGHT_SLOTS: ReadonlyArray<SlotType> = ['amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes'];

function getItem(slot: SlotType): ReturnType<typeof getCachedItem> | null {
  const ref = props.card.slots[slot];
  return ref ? getCachedItem(ref.itemId) : null;
}

const leftColumn = computed(() => LEFT_SLOTS.map((slot, i) => ({
  slot,
  row: i + 1,
  item: slot ? getItem(slot) : null,
})));
const rightColumn = computed(() => RIGHT_SLOTS.map((slot, i) => ({
  slot,
  row: i + 1,
  item: getItem(slot),
})));

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
    class="equipment-card select-none text-left flex-shrink-0 flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden"
    :class="[headerOnly ? 'h-auto' : 'h-full max-h-[660px]', { 'is-active': isActive }]"
    :style="themeStyle"
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
      @open-dofusbook="onOpenDofusbook"
    />
    <!-- Body crossfades between equipment view and in-place delete confirm.
         When headerOnly is set (Reader thumbnails), the whole body is skipped. -->
    <Transition v-if="!headerOnly" name="card-body" mode="out-in">
      <CardDeleteConfirm
        v-if="confirmingDelete"
        key="confirm"
        @cancel="confirmingDelete = false"
        @confirm="onConfirmDelete"
      />
      <div v-else key="equipment" class="flex-1 flex flex-col min-h-0">
        <!-- Single body grid: 6 cols × 7 rows. Each cell is square (1fr/1fr can't enforce
             that, so we use container queries — see .slot-cell rule below). All slots
             share the SAME size which scales with the smaller of cell width or height. -->
        <div class="flex-1 grid grid-cols-6 grid-rows-[repeat(7,minmax(0,1fr))] gap-[0.6875rem] px-4 py-4 min-h-0">
          <template v-for="entry in leftColumn" :key="`l-${entry.row}`">
            <div
              v-if="entry.slot"
              class="cell-wrap"
              :style="{ gridColumnStart: 1, gridRowStart: entry.row }"
            >
              <SlotIcon
                class="slot-cell"
                :slot="entry.slot"
                :item="entry.item"
                :card-level="card.level"
                :active="activeOnSlot(entry.slot)"
                :readonly="readonly"
                @pick="onSlotPick(entry.slot)"
                @clear="onClearSlot(entry.slot)"
              />
            </div>
          </template>
          <div
            v-for="entry in rightColumn"
            :key="`r-${entry.row}`"
            class="cell-wrap"
            :style="{ gridColumnStart: 6, gridRowStart: entry.row }"
          >
            <SlotIcon
              class="slot-cell"
              :slot="entry.slot"
              :item="entry.item"
              :card-level="card.level"
              :active="activeOnSlot(entry.slot)"
              :readonly="readonly"
              @pick="onSlotPick(entry.slot)"
              @clear="onClearSlot(entry.slot)"
            />
          </div>
          <div class="min-w-0 min-h-0 overflow-hidden" style="grid-column: 2 / 6; grid-row: 1 / 7;">
            <CardStatsPanel :card="card" />
          </div>
          <div
            v-for="entry in dofusItems"
            :key="`d-${entry.index}`"
            class="cell-wrap"
            :style="{ gridColumnStart: entry.index + 1, gridRowStart: 7 }"
          >
            <DofusCell
              class="slot-cell"
              :item="entry.item"
              :card-level="card.level"
              :active="activeOnDofus(entry.index)"
              :readonly="readonly"
              @pick="onDofusPick(entry.index)"
              @clear="onClearDofus(entry.index)"
            />
          </div>
        </div>
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
/* Each grid cell is a size container so the slot inside can size itself to the SMALLER
   of the cell width or height (kept square via aspect-ratio: 1). This is what makes the
   equipment slots and dofus cells stay the SAME size, even when the card height is
   constrained — every slot computes from the same `cqmin`. */
.cell-wrap {
  container-type: size;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
}
.slot-cell {
  width: 100cqmin;
  height: 100cqmin;
}
</style>
