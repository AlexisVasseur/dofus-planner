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

const props = defineProps<{ card: Card; previous: Card }>();

const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);

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
    class="equipment-card select-none w-[320px] flex-shrink-0 bg-bg-surface border border-border-default rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
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
      @remove="build.removeCard(card.id)"
    />
    <div class="p-4">
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

      <h3 class="font-display text-[14px] text-accent/85 tracking-[0.3em] uppercase mb-3">Équipement</h3>

      <!-- Slot rows: same height as Build mode. Changed = red old → green new side-by-side. -->
      <div
        v-for="entry in slotEntries"
        :key="entry.slot"
        class="slot-row group flex items-center gap-2 py-1.5 rounded-md text-[14px] leading-8 cursor-pointer transition-opacity"
        :class="entry.changed
          ? 'bg-accent/[0.03] -mx-1 px-1'
          : 'opacity-35 hover:opacity-60'"
        @click="pickSlot(entry.slot)"
        @dblclick.stop="clearSlot(entry.slot)"
      >
        <template v-if="entry.changed">
          <!-- OLD (red) -->
          <div
            class="icon w-8 h-8 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-[#2a1414] border border-danger/60"
          >
            <img
              v-if="entry.oldRef && itemDisplay(entry.oldRef)?.iconUrl"
              :src="itemDisplay(entry.oldRef)?.iconUrl"
              :alt="itemDisplay(entry.oldRef)?.name ?? ''"
              class="w-4 h-4"
            />
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 text-danger-soft" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span class="flex-1 min-w-0 truncate text-danger-soft text-[13px] line-through decoration-danger/60 decoration-from-font">
            {{ itemDisplay(entry.oldRef)?.name ?? 'vide' }}
          </span>
          <span class="text-accent font-mono text-[15px] flex-shrink-0">→</span>
          <!-- NEW (green) -->
          <div
            class="icon w-8 h-8 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-accent-deeper border border-accent"
          >
            <img
              v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
              :src="itemDisplay(entry.newRef)?.iconUrl"
              :alt="itemDisplay(entry.newRef)?.name ?? ''"
              class="w-4 h-4"
            />
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5 text-accent" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span class="flex-1 min-w-0 truncate text-accent text-[13px] font-medium">
            {{ itemDisplay(entry.newRef)?.name ?? 'vide' }}
          </span>
        </template>
        <template v-else>
          <!-- Unchanged: standard single-item layout, dimmed -->
          <div
            class="icon w-8 h-8 rounded-[5px] flex items-center justify-center flex-shrink-0"
            :class="entry.newRef
              ? 'bg-bg-slot-filled border border-border-slot-filled'
              : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
          >
            <img
              v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
              :src="itemDisplay(entry.newRef)?.iconUrl"
              :alt="itemDisplay(entry.newRef)?.name ?? ''"
              class="w-5 h-5"
            />
            <svg v-else viewBox="0 0 24 24" class="w-5 h-5" :class="entry.newRef ? 'text-text-muted' : 'text-text-ghost'" v-html="getSlotIconSvg(entry.slot)" />
          </div>
          <span
            class="flex-1 truncate"
            :class="entry.newRef ? 'text-text-muted' : 'text-text-faint uppercase tracking-[0.1em] font-semibold text-[13px]'"
          >
            {{ itemDisplay(entry.newRef)?.name ?? SLOT_LABEL[entry.slot] }}
          </span>
        </template>
      </div>

      <h3 class="font-display text-[14px] text-accent/85 tracking-[0.3em] uppercase mb-3 mt-4">Dofus &amp; Trophées</h3>
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="entry in dofusEntries"
          :key="entry.index"
          type="button"
          class="aspect-square rounded-md flex items-center justify-center transition-opacity relative"
          :class="entry.changed
            ? 'bg-bg-slot-filled border border-accent shadow-[0_0_0_1px_rgba(91,211,168,0.3)]'
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
