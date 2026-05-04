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
const nextCard = computed(() =>
  activeIndex.value < build.cards.length - 1 ? build.cards[activeIndex.value + 1] : null,
);
// For the previous-card peek, the card BEFORE it (so the peek can render its own diff).
const beforePrevCard = computed(() =>
  activeIndex.value >= 2 ? build.cards[activeIndex.value - 2] : null,
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

const prevLevelLabel = computed(() => {
  const lvl = previousCard.value?.level;
  return lvl !== null && lvl !== undefined ? `Lv ${lvl}` : '—';
});
const nextLevelLabel = computed(() => {
  const lvl = nextCard.value?.level;
  return lvl !== null && lvl !== undefined ? `Lv ${lvl}` : '—';
});
</script>

<template>
  <div class="switch-view flex-1 flex flex-col items-center justify-center relative overflow-hidden">
    <!-- Position indicator -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 font-display text-[14px] tracking-[0.25em] uppercase text-text-faint pointer-events-none">
      {{ positionLabel }}
    </div>

    <!-- Carousel -->
    <div class="carousel relative flex items-center justify-center gap-8 w-full" style="--card-width: 720px;">
      <!-- PREV peek (card scaled down + dim, hover lifts) -->
      <button
        v-if="canGoBack && previousCard"
        type="button"
        class="peek peek-prev relative flex flex-col items-end gap-3 cursor-pointer transition-all opacity-50 hover:opacity-90 origin-right"
        style=""
        :aria-label="`Étape précédente — ${prevLevelLabel}`"
        @click="goPrev"
      >
        <div class="peek-label flex items-center gap-2 font-display text-[13px] tracking-[0.2em] uppercase text-accent">
          <span class="text-[18px]">‹</span>
          <span>Précédent · {{ prevLevelLabel }}</span>
        </div>
        <div class="pointer-events-none">
          <EquipmentCard v-if="activeIndex - 1 === 0" :card="previousCard" />
          <EquipmentCardDiff
            v-else-if="beforePrevCard"
            :card="previousCard"
            :previous="beforePrevCard"
          />
        </div>
      </button>

      <!-- ACTIVE card -->
      <div v-if="activeCard" class="active-card flex-shrink-0 z-10">
        <EquipmentCard v-if="activeIndex === 0" :card="activeCard" />
        <EquipmentCardDiff
          v-else-if="previousCard"
          :card="activeCard"
          :previous="previousCard"
        />
      </div>

      <!-- NEXT peek -->
      <button
        v-if="canGoNext && nextCard"
        type="button"
        class="peek peek-next relative flex flex-col items-start gap-3 cursor-pointer transition-all opacity-50 hover:opacity-90 origin-left"
        style=""
        :aria-label="`Étape suivante — ${nextLevelLabel}`"
        @click="goNext"
      >
        <div class="peek-label flex items-center gap-2 font-display text-[13px] tracking-[0.2em] uppercase text-accent">
          <span>Suivant · {{ nextLevelLabel }}</span>
          <span class="text-[18px]">›</span>
        </div>
        <div class="pointer-events-none">
          <EquipmentCardDiff
            v-if="activeCard"
            :card="nextCard"
            :previous="activeCard"
          />
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.peek {
  transform: scale(0.55) !important;
}
.peek:hover {
  transform: scale(0.58) !important;
}
.peek-prev {
  margin-right: -260px; /* pull peek closer to the active card */
}
.peek-next {
  margin-left: -260px;
}
</style>
