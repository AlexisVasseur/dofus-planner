<script setup lang="ts">
import { ref, computed } from 'vue';
import CardHeader from './CardHeader.vue';
import CardDeleteConfirm from './CardDeleteConfirm.vue';
import CardStatsPanel from './CardStatsPanel.vue';
import SlotIcon from './SlotIcon.vue';
import DofusCell from './DofusCell.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { SLOT_ORDER, DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { Card, ItemRef } from '@/types/build';
import { CLASSES_BY_ID } from '@/data/classes';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getClassAssets } from '@/composables/useClassAssets';
import { buildDofusbookUrl, encodeCardCode } from '@/utils/dofusbook';
import { useToast } from '@/composables/useToast';

// Hex equivalents of Tailwind tokens used in color-mix tinting + active fallback.
// Keep in sync with tailwind.config.ts: bg-surface=#0a0a0a, border-default=#262626, accent=#5DCFE0.
const SURFACE_BASE = '#0a0a0a';
const BORDER_BASE = '#262626';
const FALLBACK_ACCENT = '#5DCFE0';

const props = withDefaults(defineProps<{ card: Card; previous: Card; headerOnly?: boolean }>(), {
  headerOnly: false,
});

const build = useBuildStore();
const ui = useUiStore();
const toast = useToast();

const isActive = computed(() => ui.activeCardId === props.card.id);
const hovered = ref(false); // visual glow on hover, does NOT change activeCardId
const confirmingDelete = ref(false); // in-place delete confirm replaces the body

function onHeaderRemove(): void {
  confirmingDelete.value = !confirmingDelete.value;
}

function onOpenDofusbook(): void {
  window.open(buildDofusbookUrl(props.card), '_blank', 'noopener,noreferrer');
}

async function onCopyCode(): Promise<void> {
  const code = encodeCardCode(props.card);
  try {
    await navigator.clipboard.writeText(code);
    toast.show('Code copié dans le presse-papier');
  } catch {
    window.prompt('Copiez ce code :', code);
  }
}

function onConfirmDelete(): void {
  confirmingDelete.value = false;
  if (ui.activeCardId === props.card.id) ui.setActiveCard(null);
  if (ui.itemPickerTarget?.cardId === props.card.id) ui.closeItemPicker();
  if (ui.classPickerCardId === props.card.id) ui.closeClassPicker();
  build.removeCard(props.card.id);
}

const themeStyle = computed(() => {
  const assets = getClassAssets(props.card.classId);
  const base: Record<string, string> = { width: 'var(--card-width, 440px)' };
  if (assets) {
    base['--class-dominant'] = assets.colors.dominant;
    base['--class-soft'] = assets.colors.soft;
    base['--class-accent'] = assets.colors.accent;
    base.backgroundColor = `color-mix(in srgb, ${SURFACE_BASE} 92%, ${assets.colors.dominant} 8%)`;
    base.borderColor = `color-mix(in srgb, ${BORDER_BASE} 70%, ${assets.colors.dominant} 30%)`;
  }
  if (isActive.value || hovered.value) {
    const accent = assets?.colors.accent ?? FALLBACK_ACCENT;
    base.boxShadow = `0 0 0 1px ${accent}aa, 0 0 12px ${accent}22, 0 4px 32px rgba(0,0,0,0.4)`;
  } else {
    base.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
  }
  return base;
});

interface SlotEntry {
  slot: SlotType;
  oldRef: ItemRef | null;
  newRef: ItemRef | null;
  changed: boolean;
}
interface DofusEntry {
  index: number;
  oldRef: ItemRef | null;
  newRef: ItemRef | null;
  changed: boolean;
}

function refsEqual(a: ItemRef | null, b: ItemRef | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.itemId === b.itemId;
}

const slotEntries = computed<SlotEntry[]>(() =>
  SLOT_ORDER.map((slot) => {
    const oldRef = props.previous.slots[slot] ?? null;
    const newRef = props.card.slots[slot] ?? null;
    return { slot, oldRef, newRef, changed: !refsEqual(oldRef, newRef) };
  }),
);

const dofusEntries = computed<DofusEntry[]>(() => {
  const out: DofusEntry[] = [];
  for (let i = 0; i < DOFUS_COUNT; i++) {
    const oldRef = props.previous.dofus[i] ?? null;
    const newRef = props.card.dofus[i] ?? null;
    out.push({ index: i, oldRef, newRef, changed: !refsEqual(oldRef, newRef) });
  }
  return out;
});

const classChanged = computed(() => props.card.classId !== props.previous.classId);

// Cruciform slot positions. Left has 6 entries (one is a visual gap), right has 5.
const LEFT_SLOTS: ReadonlyArray<SlotType | null> = ['coiffe', 'cape', null, 'arme', 'bouclier', 'familier'];
const RIGHT_SLOTS: ReadonlyArray<SlotType> = ['amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes'];

function entryFor(slot: SlotType) {
  return slotEntries.value.find((e) => e.slot === slot);
}
const leftColumn = computed(() => LEFT_SLOTS.map((slot, i) => ({
  row: i + 1,
  entry: slot ? entryFor(slot) ?? null : null,
})));
const rightColumn = computed(() => RIGHT_SLOTS.map((slot, i) => ({
  row: i + 1,
  entry: entryFor(slot)!,
})));

function itemForRef(ref: ItemRef | null): ReturnType<typeof getCachedItem> | null {
  return ref ? getCachedItem(ref.itemId) : null;
}

function className(classId: string | null): string {
  if (classId === null) return 'Aucune';
  return CLASSES_BY_ID[classId]?.name ?? classId;
}

// Reader is read-only by design — no card-set-active on click, no picker, no clear.
// We keep the click handler as a no-op so the article element doesn't error.
function onCardClick(): void { /* readonly */ }

// Hover tooltips are now provided by SlotIcon and DofusCell directly — no shared tooltip
// state needed here.
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
      :readonly="true"
      @open-class-picker="() => {}"
      @update:level="() => {}"
      @update:title="() => {}"
      @remove="onHeaderRemove"
      @open-dofusbook="onOpenDofusbook"
      @copy-code="onCopyCode"
    />
    <Transition v-if="!headerOnly" name="card-body" mode="out-in">
      <CardDeleteConfirm
        v-if="confirmingDelete"
        key="confirm"
        @cancel="confirmingDelete = false"
        @confirm="onConfirmDelete"
      />
      <div v-else key="equipment" class="flex-1 flex flex-col min-h-0">
        <!-- Class hint when changed — above both columns so it doesn't desync the grid. -->
        <div
          v-if="classChanged"
          class="mx-4 mt-3 flex items-center gap-2 text-[13px] rounded p-1.5"
        >
          <span class="font-display text-[13px] text-accent tracking-[0.25em] uppercase">Classe</span>
          <span class="text-danger-soft line-through decoration-danger/60">{{ className(previous.classId) }}</span>
          <span class="text-accent font-mono">→</span>
          <span class="text-accent">{{ className(card.classId) }}</span>
        </div>
        <!-- Single body grid: 6 cols × 7 rows. Cell wrappers use container queries so all
             slots end up the same size, sized to the smaller of cell w/h. -->
        <div class="flex-1 grid grid-cols-6 grid-rows-[repeat(7,minmax(0,1fr))] gap-[0.6875rem] px-4 py-4 min-h-0">
          <template v-for="row in leftColumn" :key="`l-${row.row}`">
            <div
              v-if="row.entry"
              class="cell-wrap"
              :style="{ gridColumnStart: 1, gridRowStart: row.row }"
            >
              <SlotIcon
                class="slot-cell"
                :slot="row.entry.slot"
                :item="itemForRef(row.entry.newRef)"
                :card-level="card.level"
                :changed="row.entry.changed"
                :readonly="true"
              />
            </div>
          </template>
          <div
            v-for="row in rightColumn"
            :key="`r-${row.row}`"
            class="cell-wrap"
            :style="{ gridColumnStart: 6, gridRowStart: row.row }"
          >
            <SlotIcon
              class="slot-cell"
              :slot="row.entry.slot"
              :item="itemForRef(row.entry.newRef)"
              :card-level="card.level"
              :changed="row.entry.changed"
              :readonly="true"
            />
          </div>
          <div class="min-w-0 min-h-0 overflow-hidden" style="grid-column: 2 / 6; grid-row: 1 / 7;">
            <CardStatsPanel :card="card" />
          </div>
          <div
            v-for="entry in dofusEntries"
            :key="`d-${entry.index}`"
            class="cell-wrap"
            :style="{ gridColumnStart: entry.index + 1, gridRowStart: 7 }"
          >
            <DofusCell
              class="slot-cell"
              :item="itemForRef(entry.newRef)"
              :card-level="card.level"
              :changed="entry.changed"
              :readonly="true"
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
/* Each grid cell is a size container so the slot inside sizes to the SMALLER of cell w/h,
   square — every slot ends up the same size. */
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
