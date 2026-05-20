<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const beforePrevCard = computed(() =>
  activeIndex.value >= 2 ? build.cards[activeIndex.value - 2] : null,
);

const canGoBack = computed(() => activeIndex.value > 0);
const canGoNext = computed(() => activeIndex.value < build.cards.length - 1);

// Track direction for transition animation
const direction = ref<'forward' | 'backward'>('forward');

function goPrev(): void {
  if (!canGoBack.value) return;
  const card = build.cards[activeIndex.value - 1];
  if (card) ui.setActiveCard(card.id); // direction inferred by the sync watch
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

// Infer direction from the index delta so the slide animation respects the direction of
// travel for ALL navigation paths (arrows, keyboard, minimap). flush: 'sync' so the new
// `direction` value is in place BEFORE the template re-renders with the new active key,
// otherwise the Transition could pick up the stale direction.
watch(activeIndex, (idx, old) => {
  if (idx > old) direction.value = 'forward';
  else if (idx < old) direction.value = 'backward';
}, { flush: 'sync' });

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
  if (ui.itemPickerTarget !== null || ui.classPickerCardId !== null) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
});

// Wheel = navigate. Each "tick" of the wheel triggers one prev/next; we lock briefly
// after each move to match the slide animation (~260ms) so spinning the wheel doesn't
// race ahead of the visual transition.
let wheelLockUntil = 0;
const WHEEL_LOCK_MS = 280;
const WHEEL_THRESHOLD = 6;
function onWheel(e: WheelEvent): void {
  if (ui.itemPickerTarget !== null || ui.classPickerCardId !== null) return;
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(delta) < WHEEL_THRESHOLD) return;
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLockUntil) return;
  if (delta > 0) goNext();
  else goPrev();
  wheelLockUntil = now + WHEEL_LOCK_MS;
}

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
  <div
    class="switch-view flex-1 min-h-0 flex flex-col items-center justify-center relative overflow-hidden py-6"
    @wheel="onWheel"
  >
    <div class="carousel relative flex flex-1 items-center justify-center gap-32 w-full min-h-0" style="--card-width: 576px;">
      <!-- PREV peek — always rendered to keep the active card centered. When there's no
           previous card, the button is disabled (readonly) and the peek card preview is
           omitted (no ghost card below the label). -->
      <button
        type="button"
        class="peek peek-prev group relative flex flex-col items-end justify-center origin-right h-full flex-shrink-0"
        :class="canGoBack ? 'cursor-pointer' : 'cursor-default opacity-40'"
        :disabled="!canGoBack"
        :aria-label="canGoBack ? `Étape précédente — ${prevLevelLabel}` : 'Aucune étape précédente'"
        @click="canGoBack && goPrev()"
      >
        <div class="peek-stack flex flex-col gap-9 pointer-events-none" style="width: 576px;">
          <div
            class="peek-label inline-flex items-center justify-center gap-3 rounded-md px-6 py-3 font-sans text-[26px] font-extrabold tracking-[0.06em] uppercase leading-none"
            :class="canGoBack
              ? 'bg-[#5DCFE0] text-[#0A2530] border border-[#5DCFE0]'
              : 'bg-white/[0.04] text-text-faint border border-white/10'"
          >
            <span>‹</span>
            <span>Précédent · {{ prevLevelLabel }}</span>
          </div>
          <div v-if="canGoBack && previousCard" class="opacity-40 group-hover:opacity-70 transition-opacity">
            <EquipmentCard v-if="activeIndex - 1 === 0" :card="previousCard" :readonly="true" />
            <EquipmentCardDiff
              v-else-if="beforePrevCard"
              :card="previousCard"
              :previous="beforePrevCard"
            />
          </div>
          <!-- Empty-state placeholder: same dimensions as a real card so the label above
               stays in the same vertical position whether a card is available or not. -->
          <div
            v-else
            class="placeholder w-full h-[660px] rounded-xl border-2 border-dashed border-white/10"
          ></div>
        </div>
      </button>

      <!-- ACTIVE card. Old + new overlap in the stage via absolute positioning so they
           animate concurrently. Entering covers leaving via z-index. The central card is
           ~30% wider than the peeks so the stats panel + slot names fit comfortably.
           Pointer events stay enabled so hover tooltips inside the card fire. -->
      <div class="active-stage relative h-full flex-shrink-0" style="--card-width: 750px;">
        <Transition :name="direction === 'forward' ? 'slide-fwd' : 'slide-bwd'">
          <div
            v-if="activeCard"
            :key="activeCard.id"
            class="active-card absolute inset-0 flex items-center justify-center"
          >
            <EquipmentCard v-if="activeIndex === 0" :card="activeCard" :readonly="true" />
            <EquipmentCardDiff
              v-else-if="previousCard"
              :card="activeCard"
              :previous="previousCard"
            />
          </div>
        </Transition>
      </div>

      <!-- NEXT peek — always rendered to keep the active card centered. Same readonly
           treatment as PREV when there's no next card. -->
      <button
        type="button"
        class="peek peek-next group relative flex flex-col items-start justify-center origin-left h-full flex-shrink-0"
        :class="canGoNext ? 'cursor-pointer' : 'cursor-default opacity-40'"
        :disabled="!canGoNext"
        :aria-label="canGoNext ? `Étape suivante — ${nextLevelLabel}` : 'Aucune étape suivante'"
        @click="canGoNext && goNext()"
      >
        <div class="peek-stack flex flex-col gap-9 pointer-events-none" style="width: 576px;">
          <div
            class="peek-label inline-flex items-center justify-center gap-3 rounded-md px-6 py-3 font-sans text-[26px] font-extrabold tracking-[0.06em] uppercase leading-none"
            :class="canGoNext
              ? 'bg-[#5DCFE0] text-[#0A2530] border border-[#5DCFE0]'
              : 'bg-white/[0.04] text-text-faint border border-white/10'"
          >
            <span>Suivant · {{ nextLevelLabel }}</span>
            <span>›</span>
          </div>
          <div v-if="canGoNext && nextCard && activeCard" class="opacity-40 group-hover:opacity-70 transition-opacity">
            <EquipmentCardDiff
              :card="nextCard"
              :previous="activeCard"
            />
          </div>
          <div
            v-else
            class="placeholder w-full h-[660px] rounded-xl border-2 border-dashed border-white/10"
          ></div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.peek {
  transform: scale(0.55);
  transition: opacity 150ms ease-out;
}

/* Hide the per-card delete (×) button in Switch view — purely visual mode. */
:deep(.card-delete-btn) {
  display: none;
}

/* Active card stage — needs explicit width because the grid stack collapses to children.
   Matches the inline --card-width override so the active card is ~30% wider than peeks. */
.active-stage {
  width: 750px;
}

/* Slide animations:
   - Entering card stays at full opacity (no fade-in) and slides over the leaving card.
   - Leaving card fades fast (no transform) so it disappears before entering completes.
   - z-index keeps entering visually on top. */
.slide-fwd-enter-active,
.slide-bwd-enter-active {
  z-index: 2;
  transition: transform 260ms cubic-bezier(0.2, 0.7, 0.3, 1);
  will-change: transform;
}
.slide-fwd-leave-active,
.slide-bwd-leave-active {
  z-index: 1;
  transition: opacity 100ms ease-in;
}
.slide-fwd-enter-from {
  transform: translateX(80px);
}
.slide-bwd-enter-from {
  transform: translateX(-80px);
}
.slide-fwd-leave-to,
.slide-bwd-leave-to {
  opacity: 0;
}
</style>
