<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import EquipmentCard from './EquipmentCard.vue';
import EquipmentCardDiff from './EquipmentCardDiff.vue';
import Connector from './Connector.vue';

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
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6"
  >
    <div class="row flex items-center gap-0 pl-16 min-h-full">
      <template v-for="(card, idx) in build.cards" :key="card.id">
        <EquipmentCard
          v-if="ui.viewMode === 'build' || idx === 0"
          :card="card"
        />
        <EquipmentCardDiff
          v-else
          :card="card"
          :previous="build.cards[idx - 1]"
        />
        <Connector :after-card-id="card.id" v-if="idx >= 0" />
      </template>
      <div class="w-[50vw] flex-shrink-0" aria-hidden="true"></div>
    </div>
  </div>
</template>

<style scoped>
.timeline-area::-webkit-scrollbar { height: 6px; }
.timeline-area::-webkit-scrollbar-track { background: theme('colors.bg-surface'); }
.timeline-area::-webkit-scrollbar-thumb { background: theme('colors.border-default'); border-radius: 999px; }
</style>
