<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppTopBar from './components/AppTopBar.vue';
import AppTimeline from './components/AppTimeline.vue';
import AppMiniMap from './components/AppMiniMap.vue';
import AppPurchasePlanner from './components/AppPurchasePlanner.vue';
import AppSwitchView from './components/AppSwitchView.vue';
import ItemPickerSheet from './components/ItemPickerSheet.vue';
import ClassPickerModal from './components/ClassPickerModal.vue';
import { useBuildStore } from './stores/build';
import { useUiStore } from './stores/ui';

const build = useBuildStore();
const ui = useUiStore();

const timelineRef = ref<InstanceType<typeof AppTimeline> | null>(null);
const scrollEl = computed<HTMLElement | null>(() => timelineRef.value?.scrollRef ?? null);

onMounted(() => {
  if (!ui.activeCardId && build.cards.length > 0) {
    ui.setActiveCard(build.cards[0].id);
  }
});
</script>

<template>
  <div class="app h-full flex flex-col relative bg-bg-page">
    <div class="bg-tint absolute inset-0 pointer-events-none -z-0"></div>
    <div class="bg-particles absolute inset-0 pointer-events-none overflow-hidden -z-0">
      <span class="particle p1" />
      <span class="particle p2" />
      <span class="particle p3" />
      <span class="particle p4" />
      <span class="particle p5" />
      <span class="particle p6" />
      <span class="particle p7" />
    </div>
    <AppTopBar class="relative z-10" />
    <template v-if="ui.viewMode === 'purchase'">
      <AppPurchasePlanner class="relative z-10" />
    </template>
    <template v-else-if="ui.viewMode === 'switch'">
      <AppSwitchView class="relative z-10" />
      <AppMiniMap :scroll-ref="null" class="relative z-10" />
    </template>
    <template v-else>
      <AppTimeline ref="timelineRef" class="relative z-10" />
      <AppMiniMap :scroll-ref="scrollEl" class="relative z-10" />
    </template>
    <ItemPickerSheet />
    <ClassPickerModal />
  </div>
</template>

<style scoped>
.bg-tint {
  background: rgba(13, 50, 65, 0.55);
}

.particle {
  position: absolute;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(120, 200, 215, 0.10) 0%, rgba(120, 200, 215, 0) 65%);
  filter: blur(8px);
  will-change: transform;
}

.p1 { width: 280px; height: 280px; left:  8%; top: 18%; animation: drift-a 95s ease-in-out infinite; }
.p2 { width: 200px; height: 200px; left: 72%; top: 12%; animation: drift-b 110s ease-in-out infinite; }
.p3 { width: 340px; height: 340px; left: 50%; top: 60%; animation: drift-c 130s ease-in-out infinite; }
.p4 { width: 160px; height: 160px; left: 20%; top: 70%; animation: drift-d 100s ease-in-out infinite; }
.p5 { width: 220px; height: 220px; left: 85%; top: 55%; animation: drift-a 120s ease-in-out infinite reverse; }
.p6 { width: 140px; height: 140px; left: 35%; top: 30%; animation: drift-b  85s ease-in-out infinite reverse; }
.p7 { width: 260px; height: 260px; left: 60%; top: 85%; animation: drift-d 115s ease-in-out infinite; }

@keyframes drift-a {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(80px, -50px); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-70px, 60px); }
}
@keyframes drift-c {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(60px, 70px); }
}
@keyframes drift-d {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-90px, -40px); }
}

@media (prefers-reduced-motion: reduce) {
  .particle { animation: none; }
}
</style>
