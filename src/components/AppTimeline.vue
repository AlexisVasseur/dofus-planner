<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import EquipmentCard from './EquipmentCard.vue';
import Connector from './Connector.vue';
import ConnectorEnd from './ConnectorEnd.vue';

const build = useBuildStore();
const ui = useUiStore();
const scrollRef = ref<HTMLElement | null>(null);

defineExpose({ scrollRef });

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

// SOLE source of scroll-to-centre logic — driven by ui.centerCardTick which bumps on
// every setActiveCard call (even when the id is unchanged). This avoids the dual-handler
// race we used to have (card-local scrollTo + watcher on activeCardId producing slightly
// different targets due to offsetLeft vs bounding-rect rounding).
watch(() => ui.centerCardTick, async () => {
  const id = ui.activeCardId;
  if (id === null) return;
  await nextTick();
  const el = scrollRef.value;
  const cardEl = document.querySelector(`[data-card-id="${id}"]`) as HTMLElement | null;
  if (!el || !cardEl) return;
  const cardRect = cardEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const cardLeftInScroller = cardRect.left - elRect.left + el.scrollLeft;
  const target = cardLeftInScroller + cardRect.width / 2 - el.clientWidth / 2;
  el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}, { immediate: true });
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6 no-scrollbar"
  >
    <div class="row flex items-center gap-0 h-full">
      <!-- Leading spacer: lets the FIRST card reach horizontal centre. Real div (not padding) so
           browsers count it in scrollWidth — padding-inline-end is unreliable here. -->
      <div class="w-[50vw] flex-shrink-0 h-full" aria-hidden="true"></div>
      <template v-for="(card, idx) in build.cards" :key="card.id">
        <EquipmentCard :card="card" />
        <!-- "+" pill between cards only — the last position uses the ghost-card ConnectorEnd below -->
        <Connector
          v-if="idx < build.cards.length - 1"
          :after-card-id="card.id"
        />
      </template>
      <!-- Trailing dashed-outline ghost card with 'Copier le précédent' / 'Nouveau' -->
      <div v-if="build.cards.length > 0" class="w-[52px] flex-shrink-0" aria-hidden="true"></div>
      <ConnectorEnd
        v-if="build.cards.length > 0"
        :after-card-id="build.cards[build.cards.length - 1].id"
      />
      <!-- Trailing spacer: must be a real div (browsers ignore pr-[50vw] in scrollWidth on
           horizontally-scrolling flex rows, capping scrollTo before the last card can centre). -->
      <div class="w-[50vw] flex-shrink-0 h-full" aria-hidden="true"></div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
