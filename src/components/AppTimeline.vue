<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBuildStore } from '@/stores/build';
import EquipmentCard from './EquipmentCard.vue';
import Connector from './Connector.vue';
import ConnectorEnd from './ConnectorEnd.vue';

const build = useBuildStore();
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
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6 no-scrollbar"
  >
    <div class="row flex items-center gap-0 pl-16 pr-16 h-full">
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
      <div class="w-[50vw] flex-shrink-0" aria-hidden="true"></div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
