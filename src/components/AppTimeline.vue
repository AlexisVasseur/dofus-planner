<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWindowSize } from '@vueuse/core';
import { useBuildStore } from '@/stores/build';
import EquipmentCard from './EquipmentCard.vue';
import Connector from './Connector.vue';

const build = useBuildStore();
const scrollRef = ref<HTMLElement | null>(null);

defineExpose({ scrollRef });

const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 52;
const MIN_LEFT_PADDING = 64;
const TRAILING_OFFSET = CONNECTOR_WIDTH + CARD_WIDTH / 2; // 212

const { width: viewportWidth } = useWindowSize();

// Last-card center position if pl were 0. We want lastCardCenter >= viewportWidth/2 so
// natural max-scroll can land on a centered last card. Bump pl up when there are too
// few cards to satisfy this.
const paddingLeft = computed(() => {
  const cardCount = build.cards.length;
  const baseline = Math.max(0, cardCount - 1) * (CARD_WIDTH + CONNECTOR_WIDTH) + CARD_WIDTH / 2;
  const minPl = viewportWidth.value / 2 - baseline;
  return Math.max(MIN_LEFT_PADDING, minPl);
});

// pr: extra space past the trailing connector so max-scroll lands exactly on the
// centered last card (= viewport_half - card_half - trailing_connector_width).
const paddingRight = computed(() => {
  return Math.max(0, viewportWidth.value / 2 - TRAILING_OFFSET);
});

onMounted(() => {
  const el = scrollRef.value;
  if (!el) return;
  el.addEventListener('wheel', (e: WheelEvent) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
});
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6"
  >
    <div
      class="row flex items-center gap-0 min-h-full"
      :style="{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px` }"
    >
      <template v-for="(card, idx) in build.cards" :key="card.id">
        <EquipmentCard :card="card" />
        <Connector :after-card-id="card.id" v-if="idx >= 0" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.timeline-area::-webkit-scrollbar { height: 6px; }
.timeline-area::-webkit-scrollbar-track { background: theme('colors.bg-surface'); }
.timeline-area::-webkit-scrollbar-thumb { background: theme('colors.border-default'); border-radius: 999px; }
</style>
