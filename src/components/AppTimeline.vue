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

// Whenever the active card changes (click, minimap, keyboard nav), smoothly scroll
// the timeline so it lands at the horizontal centre of the viewport. Combined with
// 50vw left/right row padding this lets the FIRST and LAST cards also reach centre.
watch(() => ui.activeCardId, async (id) => {
  if (id === null) return;
  await nextTick();
  const el = scrollRef.value;
  const cardEl = document.querySelector(`[data-card-id="${id}"]`) as HTMLElement | null;
  if (!el || !cardEl) return;
  const target = cardEl.offsetLeft + cardEl.offsetWidth / 2 - el.clientWidth / 2;
  el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}, { immediate: true });
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6 no-scrollbar"
  >
    <div class="row flex items-center gap-0 pl-[50vw] pr-[50vw] h-full">
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
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
