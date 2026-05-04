<script setup lang="ts">
import { computed, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import EquipmentCard from './EquipmentCard.vue';
import EquipmentCardDiff from './EquipmentCardDiff.vue';

const build = useBuildStore();
const ui = useUiStore();

const activeIndex = computed(() => {
  const idx = build.cards.findIndex((c) => c.id === ui.activeCardId);
  return idx >= 0 ? idx : 0;
});

const activeCard = computed(() => build.cards[activeIndex.value] ?? null);
const previousCard = computed(() =>
  activeIndex.value > 0 ? build.cards[activeIndex.value - 1] : null,
);

const canGoBack = computed(() => activeIndex.value > 0);
const canGoNext = computed(() => activeIndex.value < build.cards.length - 1);

function goPrev(): void {
  if (!canGoBack.value) return;
  const card = build.cards[activeIndex.value - 1];
  if (card) ui.setActiveCard(card.id);
}

function goNext(): void {
  if (!canGoNext.value) return;
  const card = build.cards[activeIndex.value + 1];
  if (card) ui.setActiveCard(card.id);
}

// Ensure there's an active card on first render of Switch view.
watch(
  () => build.cards.length,
  () => {
    if (!ui.activeCardId && build.cards.length > 0) {
      ui.setActiveCard(build.cards[0].id);
    }
  },
  { immediate: true },
);

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  // Skip when typing in an input/textarea or when picker/modal is open.
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
  if (ui.itemPickerTarget !== null || ui.classPickerCardId !== null) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
});

const positionLabel = computed(() => {
  const total = build.cards.length;
  const lvl = activeCard.value?.level;
  const lvlPart = lvl !== null && lvl !== undefined ? ` · Lv ${lvl}` : '';
  return `Étape ${activeIndex.value + 1} / ${total}${lvlPart}`;
});
</script>

<template>
  <div class="switch-view flex-1 flex items-center justify-center relative overflow-hidden px-24">
    <!-- Position indicator -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 font-display text-[14px] tracking-[0.25em] uppercase text-text-faint pointer-events-none">
      {{ positionLabel }}
    </div>

    <!-- Left arrow -->
    <button
      type="button"
      :disabled="!canGoBack"
      class="nav-btn absolute left-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-bg-surface border border-border-default text-text-muted text-[28px] leading-none flex items-center justify-center transition-colors hover:bg-accent hover:text-[#061a13] hover:border-accent disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-bg-surface disabled:hover:text-text-muted disabled:hover:border-border-default"
      aria-label="Étape précédente"
      title="Étape précédente (←)"
      @click="goPrev"
    >‹</button>

    <!-- Centered card: full for first (baseline), diff for others -->
    <div v-if="activeCard" class="card-stage">
      <EquipmentCard v-if="activeIndex === 0" :card="activeCard" />
      <EquipmentCardDiff
        v-else-if="previousCard"
        :card="activeCard"
        :previous="previousCard"
      />
    </div>

    <!-- Right arrow -->
    <button
      type="button"
      :disabled="!canGoNext"
      class="nav-btn absolute right-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-bg-surface border border-border-default text-text-muted text-[28px] leading-none flex items-center justify-center transition-colors hover:bg-accent hover:text-[#061a13] hover:border-accent disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-bg-surface disabled:hover:text-text-muted disabled:hover:border-border-default"
      aria-label="Étape suivante"
      title="Étape suivante (→)"
      @click="goNext"
    >›</button>
  </div>
</template>

<style scoped>
.nav-btn { padding-bottom: 4px; }
</style>
