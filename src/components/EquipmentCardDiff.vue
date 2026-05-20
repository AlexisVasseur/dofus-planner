<script setup lang="ts">
import { ref, computed } from 'vue';
import CardHeader from './CardHeader.vue';
import CardDeleteConfirm from './CardDeleteConfirm.vue';
import CardStatsPanel from './CardStatsPanel.vue';
import ItemStatsTooltip from './ItemStatsTooltip.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { SLOT_ORDER, SLOT_LABEL, DOFUS_COUNT, type SlotType } from '@/types/slots';
import type { Card, ItemRef } from '@/types/build';
import { CLASSES_BY_ID } from '@/data/classes';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';
import { getClassAssets } from '@/composables/useClassAssets';
import type { Item } from '@/data/dofusdb';

// Hex equivalents of Tailwind tokens used in color-mix tinting + active fallback.
// Keep in sync with tailwind.config.ts: bg-surface=#0a0a0a, border-default=#262626, accent=#5DCFE0.
const SURFACE_BASE = '#0a0a0a';
const BORDER_BASE = '#262626';
const FALLBACK_ACCENT = '#5DCFE0';

const props = defineProps<{ card: Card; previous: Card }>();

const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);
const hovered = ref(false); // visual glow on hover, does NOT change activeCardId
const confirmingDelete = ref(false); // in-place delete confirm replaces the body

function onHeaderRemove(): void {
  confirmingDelete.value = !confirmingDelete.value;
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
  const base: Record<string, string> = { width: 'var(--card-width, 700px)' };
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

// Reader is read-only by design — no card-set-active on click, no picker, no clear.
// We keep the click handler as a no-op so the article element doesn't error.
function onCardClick(): void { /* readonly */ }

// Hover tooltip: one shared ItemStatsTooltip anchored to whichever sub-element the cursor
// is over. Each item area (old half, new half, dofus button) attaches its own mouseenter
// with the right ItemRef. 300ms delay matches the Build mode behaviour.
const hoveredItem = ref<Item | null>(null);
const hoveredEl = ref<HTMLElement | null>(null);
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
function onItemEnter(ref: ItemRef | null, e: MouseEvent): void {
  if (!ref) return;
  const item = getCachedItem(ref.itemId);
  if (!item) return;
  if (hoverTimer !== null) clearTimeout(hoverTimer);
  const el = e.currentTarget as HTMLElement;
  hoverTimer = setTimeout(() => {
    hoveredItem.value = item;
    hoveredEl.value = el;
    hoverTimer = null;
  }, 300);
}
function onItemLeave(): void {
  if (hoverTimer !== null) { clearTimeout(hoverTimer); hoverTimer = null; }
  hoveredItem.value = null;
  hoveredEl.value = null;
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
      :readonly="true"
      @open-class-picker="() => {}"
      @update:level="() => {}"
      @update:title="() => {}"
      @remove="onHeaderRemove"
    />
    <Transition name="card-body" mode="out-in">
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
        <div class="flex-1 flex min-h-0 p-4 gap-3">
        <div class="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] min-h-0 min-w-0">
      <!-- Slot rows: same height as Build mode. Changed = red old → green new side-by-side. -->
      <div
        v-for="entry in slotEntries"
        :key="entry.slot"
        class="slot-row group flex items-center gap-2 py-1.5 rounded-md text-[14px] leading-8 transition-opacity min-h-0 max-h-14 overflow-hidden"
        :class="entry.changed
          ? 'bg-accent/[0.03] -mx-1 px-1'
          : 'opacity-35 hover:opacity-60'"
      >
        <template v-if="entry.changed">
          <!-- OLD half (icon + name) — wrapped so hovering either fires the same handler -->
          <span
            class="old-half flex items-center gap-2 flex-1 min-w-0"
            @mouseenter="onItemEnter(entry.oldRef, $event)"
            @mouseleave="onItemLeave"
          >
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
          </span>
          <span class="text-accent font-mono text-[15px] flex-shrink-0">→</span>
          <!-- NEW half (icon + name) -->
          <span
            class="new-half flex items-center gap-2 flex-1 min-w-0"
            @mouseenter="onItemEnter(entry.newRef, $event)"
            @mouseleave="onItemLeave"
          >
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
          </span>
        </template>
        <template v-else>
          <!-- Unchanged: standard single-item layout, dimmed -->
          <span
            class="item-half flex items-center gap-2 flex-1 min-w-0"
            @mouseenter="onItemEnter(entry.newRef, $event)"
            @mouseleave="onItemLeave"
          >
            <div
              class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0"
              :class="entry.newRef
                ? 'bg-white/[0.06] border border-white/15'
                : 'bg-white/[0.02] border border-dashed border-white/10'"
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
          </span>
        </template>
      </div>

        </div>
        <!-- Right column: dofus rows in the same slot-row diff style as equipment. Also a
             10-row grid so each row aligns with the equipment row on its left. -->
        <div class="flex-1 grid grid-rows-[repeat(10,minmax(0,1fr))] min-h-0 min-w-0">
          <div
            v-for="entry in dofusEntries"
            :key="entry.index"
            class="slot-row group flex items-center gap-2 py-1.5 rounded-md text-[14px] leading-8 transition-opacity min-h-0 max-h-14 overflow-hidden"
            :class="entry.changed ? 'bg-accent/[0.03] -mx-1 px-1' : 'opacity-35 hover:opacity-60'"
          >
            <template v-if="entry.changed">
              <!-- OLD half -->
              <span
                class="flex items-center gap-2 flex-1 min-w-0"
                @mouseenter="onItemEnter(entry.oldRef, $event)"
                @mouseleave="onItemLeave"
              >
                <div class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-[#2a1414] border border-danger/60">
                  <img
                    v-if="entry.oldRef && itemDisplay(entry.oldRef)?.iconUrl"
                    :src="itemDisplay(entry.oldRef)?.iconUrl"
                    :alt="itemDisplay(entry.oldRef)?.name ?? ''"
                    class="w-[26px] h-[26px]"
                  />
                  <svg v-else viewBox="0 0 24 24" class="w-[20px] h-[20px] text-danger-soft" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 L21 12 L12 21 L3 12 Z" /></svg>
                </div>
                <span class="flex-1 min-w-0 truncate text-danger-soft text-[13px] line-through decoration-danger/60 decoration-from-font">
                  {{ itemDisplay(entry.oldRef)?.name ?? 'vide' }}
                </span>
              </span>
              <span class="text-accent font-mono text-[15px] flex-shrink-0">→</span>
              <!-- NEW half -->
              <span
                class="flex items-center gap-2 flex-1 min-w-0"
                @mouseenter="onItemEnter(entry.newRef, $event)"
                @mouseleave="onItemLeave"
              >
                <div class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0 bg-accent-deeper border border-accent">
                  <img
                    v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
                    :src="itemDisplay(entry.newRef)?.iconUrl"
                    :alt="itemDisplay(entry.newRef)?.name ?? ''"
                    class="w-[26px] h-[26px]"
                  />
                  <svg v-else viewBox="0 0 24 24" class="w-[20px] h-[20px] text-accent" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 L21 12 L12 21 L3 12 Z" /></svg>
                </div>
                <span class="flex-1 min-w-0 truncate text-accent text-[13px] font-medium">
                  {{ itemDisplay(entry.newRef)?.name ?? 'vide' }}
                </span>
              </span>
            </template>
            <template v-else>
              <span
                class="flex items-center gap-2 flex-1 min-w-0"
                @mouseenter="onItemEnter(entry.newRef, $event)"
                @mouseleave="onItemLeave"
              >
                <div
                  class="icon w-9 h-9 rounded-[5px] flex items-center justify-center flex-shrink-0"
                  :class="entry.newRef
                    ? 'bg-white/[0.06] border border-white/15'
                    : 'bg-white/[0.02] border border-dashed border-white/10'"
                >
                  <img
                    v-if="entry.newRef && itemDisplay(entry.newRef)?.iconUrl"
                    :src="itemDisplay(entry.newRef)?.iconUrl"
                    :alt="itemDisplay(entry.newRef)?.name ?? ''"
                    class="w-[26px] h-[26px]"
                  />
                  <svg v-else viewBox="0 0 24 24" class="w-[20px] h-[20px]" :class="entry.newRef ? 'text-text-muted' : 'text-text-ghost'" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 L21 12 L12 21 L3 12 Z" /></svg>
                </div>
                <span
                  class="flex-1 truncate"
                  :class="entry.newRef ? 'text-text-muted' : 'text-text-faint uppercase tracking-[0.1em] font-semibold text-[13px]'"
                >
                  {{ itemDisplay(entry.newRef)?.name ?? `Dofus ${entry.index + 1}` }}
                </span>
              </span>
            </template>
          </div>
        </div>
        </div>
        <CardStatsPanel :card="card" />
        <ItemStatsTooltip :open="hoveredItem !== null" :trigger-el="hoveredEl" :item="hoveredItem" />
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
