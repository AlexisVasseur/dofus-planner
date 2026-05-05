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
    <div class="bg-fx absolute inset-0 pointer-events-none -z-0"
      :style="{
        background: `radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.025) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(255, 255, 255, 0.015) 0%, transparent 50%)`
      }"
    ></div>
    <div class="bg-grain absolute inset-0 pointer-events-none -z-0"
      :style="{
        backgroundImage: `radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }"
    ></div>
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
