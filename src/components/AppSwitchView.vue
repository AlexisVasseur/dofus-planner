<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import EquipmentCard from './EquipmentCard.vue';
import EquipmentCardDiff from './EquipmentCardDiff.vue';
import ClassThumbnail from './ClassThumbnail.vue';
import { getClassAssets } from '@/composables/useClassAssets';

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

// Class-tinted accent + thumbnail URL for each peek tile.
function peekStyle(classId: string | null): Record<string, string> {
  const a = getClassAssets(classId as never);
  if (!a) return {};
  return {
    '--peek-accent': a.colors.accent,
    borderColor: `color-mix(in srgb, #262626 50%, ${a.colors.dominant} 50%)`,
  };
}
function peekThumbnail(classId: string | null): string | null {
  return getClassAssets(classId as never)?.thumbnail ?? null;
}
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
    <div class="carousel relative flex flex-1 items-center justify-center gap-32 w-full min-h-0" style="--card-width: 440px;">
      <!-- PREV peek — square tile with class thumbnail + level + left arrow. -->
      <button
        type="button"
        class="peek peek-prev group relative flex items-center justify-center flex-shrink-0"
        :class="canGoBack ? 'cursor-pointer' : 'cursor-default opacity-0 pointer-events-none'"
        :disabled="!canGoBack"
        :aria-hidden="!canGoBack"
        :aria-label="canGoBack ? `Étape précédente — ${prevLevelLabel}` : 'Aucune étape précédente'"
        @click="canGoBack && goPrev()"
      >
        <div
          v-if="previousCard"
          class="peek-tile relative aspect-square w-[180px] bg-bg-surface border-2 rounded-xl overflow-hidden transition-all"
          :style="peekStyle(previousCard.classId)"
        >
          <!-- Full-bleed class image. -->
          <img
            v-if="peekThumbnail(previousCard.classId)"
            :src="peekThumbnail(previousCard.classId)!"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            draggable="false"
          />
          <div v-else class="absolute inset-0 bg-bg-elev flex items-center justify-center">
            <ClassThumbnail :class-id="previousCard.classId" :size="80" />
          </div>
          <!-- Gradient from transparent (top) to opaque black (bottom) so the text below
               reads cleanly over the image. -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent pointer-events-none"></div>
          <!-- Text overlay at the bottom. -->
          <div class="absolute bottom-0 left-0 right-0 px-3 py-3 flex flex-col items-center gap-0.5">
            <div
              class="font-display text-[18px] font-bold uppercase tracking-[0.18em] leading-none"
              :style="{ color: 'var(--peek-accent, rgba(255,255,255,0.9))' }"
            >Niv {{ previousCard.level ?? '—' }}</div>
            <div
              v-if="previousCard.title"
              class="text-[10px] text-text-muted uppercase tracking-[0.1em] truncate w-full text-center"
            >{{ previousCard.title }}</div>
          </div>
        </div>
        <!-- Arrow lives fully OUTSIDE the tile: positioned to the left of the tile with
             a small gap. `right-full` anchors the arrow's right edge at the tile's left
             edge, then mr-3 pushes it 12px further out. -->
        <svg
          v-if="previousCard"
          class="peek-arrow peek-arrow-left absolute right-full top-1/2 mr-3 w-14 h-14 text-[#5DCFE0] drop-shadow-[0_0_10px_rgba(93,207,224,0.5)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <!-- ACTIVE card. Old + new overlap in the stage via absolute positioning so they
           animate concurrently. Entering covers leaving via z-index. The central card is
           ~30% wider than the peeks so the stats panel + slot names fit comfortably.
           Pointer events stay enabled so hover tooltips inside the card fire. -->
      <div class="active-stage relative h-full flex-shrink-0" style="--card-width: 440px;">
        <Transition :name="direction === 'forward' ? 'slide-fwd' : 'slide-bwd'">
          <div
            v-if="activeCard"
            :key="activeCard.id"
            class="active-card absolute inset-0 flex items-center justify-center"
          >
            <!-- Active card keeps the full body — only peeks are header-only. -->
            <EquipmentCard v-if="activeIndex === 0" :card="activeCard" :readonly="true" />
            <EquipmentCardDiff
              v-else-if="previousCard"
              :card="activeCard"
              :previous="previousCard"
            />
          </div>
        </Transition>
      </div>

      <!-- NEXT peek — square tile with class thumbnail + level + right arrow. -->
      <button
        type="button"
        class="peek peek-next group relative flex items-center justify-center flex-shrink-0"
        :class="canGoNext ? 'cursor-pointer' : 'cursor-default opacity-0 pointer-events-none'"
        :disabled="!canGoNext"
        :aria-hidden="!canGoNext"
        :aria-label="canGoNext ? `Étape suivante — ${nextLevelLabel}` : 'Aucune étape suivante'"
        @click="canGoNext && goNext()"
      >
        <div
          v-if="nextCard"
          class="peek-tile relative aspect-square w-[180px] bg-bg-surface border-2 rounded-xl overflow-hidden transition-all"
          :style="peekStyle(nextCard.classId)"
        >
          <img
            v-if="peekThumbnail(nextCard.classId)"
            :src="peekThumbnail(nextCard.classId)!"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            draggable="false"
          />
          <div v-else class="absolute inset-0 bg-bg-elev flex items-center justify-center">
            <ClassThumbnail :class-id="nextCard.classId" :size="80" />
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 right-0 px-3 py-3 flex flex-col items-center gap-0.5">
            <div
              class="font-display text-[18px] font-bold uppercase tracking-[0.18em] leading-none"
              :style="{ color: 'var(--peek-accent, rgba(255,255,255,0.9))' }"
            >Niv {{ nextCard.level ?? '—' }}</div>
            <div
              v-if="nextCard.title"
              class="text-[10px] text-text-muted uppercase tracking-[0.1em] truncate w-full text-center"
            >{{ nextCard.title }}</div>
          </div>
        </div>
        <svg
          v-if="nextCard"
          class="peek-arrow peek-arrow-right absolute left-full top-1/2 ml-3 w-14 h-14 text-[#5DCFE0] drop-shadow-[0_0_10px_rgba(93,207,224,0.5)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Peek tile — square preview that emphasises class + level. Hover elevates it slightly
 * and adds a turquoise glow so the user knows it's clickable. The arrow on the outer
 * edge points the navigation direction. */
.peek-tile {
  opacity: 0.85;
}
.peek:hover .peek-tile {
  opacity: 1;
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px #5DCFE0, 0 8px 28px rgba(93, 207, 224, 0.25);
}
/* Arrow base position (vertical centering via transform — keeps the wobble math simple). */
.peek-arrow {
  transform: translateY(-50%);
  transition: transform 180ms ease;
}
.peek:hover .peek-arrow-left {
  animation: peek-wobble-left 0.9s ease-in-out infinite;
}
.peek:hover .peek-arrow-right {
  animation: peek-wobble-right 0.9s ease-in-out infinite;
}
@keyframes peek-wobble-left {
  0%, 100% { transform: translate(0, -50%); }
  50%      { transform: translate(-6px, -50%); }
}
@keyframes peek-wobble-right {
  0%, 100% { transform: translate(0, -50%); }
  50%      { transform: translate(6px, -50%); }
}

/* Hide the per-card delete (×) button in Switch view — purely visual mode. */
:deep(.card-delete-btn) {
  display: none;
}

/* Active card stage — same width as Builder cards (440) so Reader matches Builder
   exactly. Peeks are scaled visually via transform: scale(0.55) on .peek. */
.active-stage {
  width: 440px;
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
