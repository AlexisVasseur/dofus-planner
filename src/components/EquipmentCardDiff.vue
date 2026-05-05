<script setup lang="ts">
import { computed } from 'vue';
import CardHeader from './CardHeader.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { SLOT_ORDER, SLOT_LABEL, DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { Card, ItemRef } from '@/types/build';
import { CLASSES_BY_ID } from '@/data/classes';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';
import { getClassAssets } from '@/composables/useClassAssets';

// Hex equivalents of Tailwind tokens used in color-mix tinting + active fallback.
// Keep in sync with tailwind.config.ts: bg-surface=#0a0a0a, border-default=#262626, accent=#5DCFE0.
const SURFACE_BASE = '#0a0a0a';
const BORDER_BASE = '#262626';
const FALLBACK_ACCENT = '#5DCFE0';

const props = defineProps<{ card: Card; previous: Card }>();

const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);

const themeStyle = computed(() => {
  const assets = getClassAssets(props.card.classId);
  const base: Record<string, string> = { width: 'var(--card-width, 320px)' };
  if (assets) {
    base['--class-dominant'] = assets.colors.dominant;
    base['--class-soft'] = assets.colors.soft;
    base['--class-accent'] = assets.colors.accent;
    base.backgroundColor = `color-mix(in srgb, ${SURFACE_BASE} 92%, ${assets.colors.dominant} 8%)`;
    base.borderColor = `color-mix(in srgb, ${BORDER_BASE} 70%, ${assets.colors.dominant} 30%)`;
  }
  if (isActive.value) {
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

function itemDisplay(ref: ItemRef | null): { name: string; iconUrl: string } | null {
  if (ref === null) return null;
  const item = getCachedItem(ref.itemId);
  if (item) return { name: item.name, iconUrl: item.iconUrl };
  return { name: `Item ${ref.itemId}`, iconUrl: '' };
}

function className(classId: string | null): string {
  if (classId === null) return 'Aucune';
  return CLASSES_BY_ID[classId]?.name ?? classId;
}

function pickSlot(slot: SlotType): void {
  ui.openItemPicker({ kind: 'slot', cardId: props.card.id, slot });
}
function pickDofus(index: number): void {
  ui.openItemPicker({ kind: 'dofus', cardId: props.card.id, index });
}

function clearSlot(slot: SlotType): void {
  build.setSlot(props.card.id, slot, null);
  if (ui.itemPickerTarget?.kind === 'slot'
      && ui.itemPickerTarget.cardId === props.card.id
      && ui.itemPickerTarget.slot === slot) {
    ui.closeItemPicker();
  }
}
function clearDofus(index: number): void {
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
    class="equipment-card select-none text-left flex-shrink-0 h-full max-h-[320px] flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden transition-all"
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
      @remove="build.removeCard(card.id)"
    />
    <div class="p-4 flex-1 flex flex-col min-h-0">
      <!-- Class hint when changed -->
      <div
        v-if="classChanged"
        class="mb-3 flex items-center gap-2 text-[13px] cursor-pointer hover:bg-bg-elev rounded p-1.5 -m-1.5"
        @click="ui.openClassPicker(card.id)"
      >
        <span class="font-display text-[13px] text-accent tracking-[0.25em] uppercase">Classe</span>
        <span class="text-danger-soft line-through decoration-danger/60">{{ className(previous.classId) }}</span>
        <span class="text-accent font-mono">→</span>
        <span class="text-accent">{{ className(card.classId) }}</span>
      </div>

      <!-- Slot rows: same height as Build mode. Changed = red old → green new side-by-side. -->
      <div
        v-for="entry in slotEntries"
        :key="entry.slot"
        class="slot-row group flex items-center gap-2 py-1.5 rounded-md text-[14px] leading-8 cursor-pointer transition-opacity flex-1 min-h-0 max-h-14 overflow-hidden"
        :class="entry.changed
          ? 'bg-accent/[0.03] -mx-1 px-1'
          : 'opacity-35 hover:opacity-60'"
        @click="pickSlot(entry.slot)"
        @dblclick.stop="clearSlot(entry.slot)"
      >
        <template v-if="entry.changed">
          <!-- OLD (red) -->
          <div
            class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-[#2a1414] border border-danger/60"
          >
            <img
              v-if="entry.oldRef && itemDisplay(entry.oldRef)?.iconUrl"
              :src="itemDisplay(entry.oldRef)?.iconUrl"
              :alt="itemDisplay(entry.oldRef)?.name ?? ''"
              class="w-[26px] h-[26px]"
            />
            <svg v-else viewBox="0 0 24 24" class="w-[26px] h-[26px] text-danger-soft" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span class="flex-1 min-w-0 truncate text-danger-soft text-[13px] line-through decoration-danger/60 decoration-from-font">
            {{ itemDisplay(entry.oldRef)?.name ?? 'vide' }}
          </span>
          <span class="text-accent font-mono text-[15px] flex-shrink-0">→</span>
          <!-- NEW (green) -->
          <div
            class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-accent-deeper border border-accent"
          >
            <img
              v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
              :src="itemDisplay(entry.newRef)?.iconUrl"
              :alt="itemDisplay(entry.newRef)?.name ?? ''"
              class="w-[26px] h-[26px]"
            />
            <svg v-else viewBox="0 0 24 24" class="w-[26px] h-[26px] text-accent" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span class="flex-1 min-w-0 truncate text-accent text-[13px] font-medium">
            {{ itemDisplay(entry.newRef)?.name ?? 'vide' }}
          </span>
        </template>
        <template v-else>
          <!-- Unchanged: standard single-item layout, dimmed -->
          <div
            class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0"
            :class="entry.newRef
              ? 'bg-bg-slot-filled border border-border-slot-filled'
              : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
          >
            <img
              v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
              :src="itemDisplay(entry.newRef)?.iconUrl"
              :alt="itemDisplay(entry.newRef)?.name ?? ''"
              class="w-[26px] h-[26px]"
            />
            <svg v-else viewBox="0 0 24 24" class="w-[26px] h-[26px]" :class="entry.newRef ? 'text-text-muted' : 'text-text-ghost'" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span
            class="flex-1 truncate"
            :class="entry.newRef ? 'text-text-muted' : 'text-text-faint uppercase tracking-[0.1em] font-semibold text-[13px]'"
          >
            {{ itemDisplay(entry.newRef)?.name ?? SLOT_LABEL[entry.slot] }}
          </span>
        </template>
      </div>

      <div class="grid grid-cols-6 gap-1.5 mt-auto pt-4 flex-shrink-0">
        <button
          v-for="entry in dofusEntries"
          :key="entry.index"
          type="button"
          class="aspect-square rounded-md flex items-center justify-center transition-opacity relative"
          :class="entry.changed
            ? 'bg-bg-slot-filled border border-accent shadow-[0_0_0_1px_rgba(93,207,224,0.3)]'
            : entry.newRef
              ? 'bg-bg-slot-filled border border-border-slot-filled opacity-35 hover:opacity-60'
              : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty opacity-35 hover:opacity-60'"
          :title="entry.changed ? `Avant : ${itemDisplay(entry.oldRef)?.name ?? 'vide'}` : ''"
          @click="pickDofus(entry.index)"
          @dblclick.stop="clearDofus(entry.index)"
        >
          <img
            v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
            :src="itemDisplay(entry.newRef)?.iconUrl"
            :alt="itemDisplay(entry.newRef)?.name ?? ''"
            class="w-3/4 h-3/4"
          />
          <span v-else-if="!entry.newRef" class="text-text-ghost text-[10px]">◇</span>
        </button>
      </div>
    </div>
  </article>
</template>
