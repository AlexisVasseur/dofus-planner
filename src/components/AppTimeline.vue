<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBuildStore } from '@/stores/build';
import EquipmentCard from './EquipmentCard.vue';
import Connector from './Connector.vue';

const build = useBuildStore();
const scrollRef = ref<HTMLElement | null>(null);

defineExpose({ scrollRef });

onMounted(() => {
  const el = scrollRef.value;
  if (!el) return;
  // Redirect vertical wheel to horizontal scroll on the timeline area
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
    <div class="row flex items-center gap-0 px-6 min-h-full">
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
