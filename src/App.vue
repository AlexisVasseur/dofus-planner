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

// Generate a sparse star-field of tiny dots once at component setup. Sizes 1.5–5px,
// random position, one of 4 drift animations, randomized duration + negative delay so
// the field looks organic from the first frame.
const PARTICLE_COUNT = 90;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, () => {
  const animIdx = Math.floor(Math.random() * 4) + 1;
  return {
    size: 1.5 + Math.random() * 3.5,
    left: Math.random() * 100,
    top: Math.random() * 100,
    anim: `drift-${animIdx}`,
    duration: 25 + Math.random() * 30,
    delay: -Math.random() * 55,
    alpha: 0.25 + Math.random() * 0.25,
  };
});

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
      <span
        v-for="(p, i) in PARTICLES"
        :key="i"
        class="particle"
        :class="p.anim"
        :style="{
          width: p.size + 'px',
          height: p.size + 'px',
          left: p.left + '%',
          top: p.top + '%',
          background: `rgba(150, 220, 230, ${p.alpha})`,
          animationDuration: p.duration + 's',
          animationDelay: p.delay + 's',
        }"
      />
    </div>
    <AppTopBar class="relative z-20" />
    <!-- Page stage: a fixed flex-1 slot that always reserves the central space.
         Pages mount inside as absolute layers so their transform/opacity transitions
         don't move the surrounding header/minimap and never expose a body scrollbar. -->
    <div class="page-stage relative z-10 flex-1 min-h-0 overflow-hidden">
      <Transition name="view" mode="out-in">
        <div v-if="ui.viewMode === 'purchase'" key="purchase" class="absolute inset-0 flex flex-col">
          <AppPurchasePlanner class="flex-1 min-h-0" />
        </div>
        <div v-else-if="ui.viewMode === 'switch'" key="switch" class="absolute inset-0 flex flex-col">
          <AppSwitchView class="flex-1 min-h-0" />
        </div>
        <div v-else key="build" class="absolute inset-0 flex flex-col">
          <AppTimeline ref="timelineRef" class="flex-1 min-h-0" />
        </div>
      </Transition>
    </div>
    <AppMiniMap
      :scroll-ref="ui.viewMode === 'build' ? scrollEl : null"
      class="relative z-20"
    />
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
  will-change: transform;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}

.drift-1 { animation-name: drift-a; }
.drift-2 { animation-name: drift-b; }
.drift-3 { animation-name: drift-c; }
.drift-4 { animation-name: drift-d; }

@keyframes drift-a {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(40px, -25px); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-35px, 30px); }
}
@keyframes drift-c {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(30px, 35px); }
}
@keyframes drift-d {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-45px, -20px); }
}

@media (prefers-reduced-motion: reduce) {
  .particle { animation: none; }
}

/* Cross-screen view transitions (Build / Reader / Shopping). */
.view-enter-active, .view-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.view-enter-from { opacity: 0; transform: translateY(12px); }
.view-leave-to   { opacity: 0; transform: translateY(-8px); }

/* Minimap dock slide (only present in Builder + Reader). */
.dock-enter-active, .dock-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.dock-enter-from, .dock-leave-to {
  opacity: 0;
  transform: translateY(120%);
}
</style>
