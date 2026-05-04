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

interface SlotDiff {
  slot: SlotType;
  oldRef: ItemRef | null;
  newRef: ItemRef | null;
}
interface DofusDiff {
  index: number;
  oldRef: ItemRef | null;
  newRef: ItemRef | null;
}

function refsEqual(a: ItemRef | null, b: ItemRef | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.itemId === b.itemId;
}

const slotDiffs = computed<SlotDiff[]>(() => {
  const out: SlotDiff[] = [];
  for (const slot of SLOT_ORDER) {
    const oldRef = props.previous.slots[slot] ?? null;
    const newRef = props.card.slots[slot] ?? null;
    if (!refsEqual(oldRef, newRef)) {
      out.push({ slot, oldRef, newRef });
    }
  }
  return out;
});

const dofusDiffs = computed<DofusDiff[]>(() => {
  const out: DofusDiff[] = [];
  for (let i = 0; i < DOFUS_COUNT; i++) {
    const oldRef = props.previous.dofus[i] ?? null;
    const newRef = props.card.dofus[i] ?? null;
    if (!refsEqual(oldRef, newRef)) {
      out.push({ index: i, oldRef, newRef });
    }
  }
  return out;
});

const classChanged = computed(() => props.card.classId !== props.previous.classId);

const hasNoChanges = computed(() =>
  !classChanged.value && slotDiffs.value.length === 0 && dofusDiffs.value.length === 0,
);

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
</script>

<template>
  <article
    class="equipment-card w-[320px] flex-shrink-0 bg-bg-surface border border-border-default rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
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
    <div class="p-3.5 space-y-3.5">
      <!-- Class change -->
      <div v-if="classChanged" class="space-y-1.5">
        <h3 class="font-display text-[11px] text-accent/85 tracking-[0.3em] uppercase">Classe</h3>
        <div class="diff-row flex items-center gap-2 text-[11px]">
          <span class="text-text-faint flex-1 truncate">{{ className(previous.classId) }}</span>
          <span class="text-accent font-mono">→</span>
          <span class="text-text-default flex-1 truncate">{{ className(card.classId) }}</span>
        </div>
      </div>

      <!-- Equipment changes -->
      <div v-if="slotDiffs.length > 0" class="space-y-1.5">
        <h3 class="font-display text-[11px] text-accent/85 tracking-[0.3em] uppercase">Changements</h3>
        <div v-for="d in slotDiffs" :key="d.slot" class="diff-row">
          <div class="font-display text-[9px] text-text-faint tracking-[0.2em] uppercase mb-1">
            {{ SLOT_LABEL[d.slot] }}
          </div>
          <div class="flex items-center gap-2 text-[11px]">
            <div class="flex items-center gap-1.5 flex-1 min-w-0 opacity-70">
              <div
                class="w-5 h-5 rounded-[3px] flex items-center justify-center flex-shrink-0"
                :class="d.oldRef
                  ? 'bg-bg-slot-filled border border-border-slot-filled'
                  : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
              >
                <img
                  v-if="d.oldRef && itemDisplay(d.oldRef)?.iconUrl"
                  :src="itemDisplay(d.oldRef)?.iconUrl"
                  :alt="itemDisplay(d.oldRef)?.name ?? ''"
                  class="w-3.5 h-3.5"
                />
                <svg v-else viewBox="0 0 24 24" class="w-3.5 h-3.5 text-text-ghost" v-html="getSlotIconSvg(d.slot)" />
              </div>
              <span class="text-text-faint truncate">{{ itemDisplay(d.oldRef)?.name ?? 'vide' }}</span>
            </div>
            <span class="text-accent font-mono">→</span>
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <div
                class="w-5 h-5 rounded-[3px] flex items-center justify-center flex-shrink-0"
                :class="d.newRef
                  ? 'bg-bg-slot-filled border border-border-slot-filled'
                  : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
              >
                <img
                  v-if="d.newRef && itemDisplay(d.newRef)?.iconUrl"
                  :src="itemDisplay(d.newRef)?.iconUrl"
                  :alt="itemDisplay(d.newRef)?.name ?? ''"
                  class="w-3.5 h-3.5"
                />
                <svg v-else viewBox="0 0 24 24" class="w-3.5 h-3.5 text-text-ghost" v-html="getSlotIconSvg(d.slot)" />
              </div>
              <span class="text-text-default truncate">{{ itemDisplay(d.newRef)?.name ?? 'vide' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Dofus changes -->
      <div v-if="dofusDiffs.length > 0" class="space-y-1.5">
        <h3 class="font-display text-[11px] text-accent/85 tracking-[0.3em] uppercase">Dofus &amp; Trophées</h3>
        <div v-for="d in dofusDiffs" :key="d.index" class="diff-row">
          <div class="font-display text-[9px] text-text-faint tracking-[0.2em] uppercase mb-1">
            Dofus {{ d.index + 1 }}
          </div>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-text-faint flex-1 truncate">{{ itemDisplay(d.oldRef)?.name ?? 'vide' }}</span>
            <span class="text-accent font-mono">→</span>
            <span class="text-text-default flex-1 truncate">{{ itemDisplay(d.newRef)?.name ?? 'vide' }}</span>
          </div>
        </div>
      </div>

      <!-- No changes -->
      <div v-if="hasNoChanges" class="text-center py-6 text-text-faint text-[11px] italic">
        Aucun changement par rapport à la card précédente
      </div>
    </div>
  </article>
</template>
