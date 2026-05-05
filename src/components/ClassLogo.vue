<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId } from '@/types/classes';
import { CLASSES_BY_ID } from '@/data/classes';

const props = withDefaults(defineProps<{
  classId: ClassId | null;
  size?: number;
  pulse?: boolean;
}>(), {
  size: 48,
  pulse: false,
});

const def = computed(() => (props.classId ? CLASSES_BY_ID[props.classId] : null));
// V1: DofusDB doesn't expose stable class image URLs we can hot-link reliably; we render
// the class abbreviation inside the hex frame. When real URLs are wired up, return the URL here.
const imageUrl = computed<string | null>(() => null);
</script>

<template>
  <div
    class="class-logo relative grid place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <div class="absolute inset-0 frame-fill" :class="{ pulse }"></div>
    <div class="absolute inset-0 frame-stroke" :class="{ pulse }"></div>
    <img v-if="imageUrl" :src="imageUrl" :alt="def?.name ?? 'classe'" class="relative z-10 w-3/4 h-3/4" />
    <span v-else class="relative z-10 font-display text-accent" :style="{ fontSize: `${size * 0.35}px` }">
      {{ def?.abbrev ?? '?' }}
    </span>
  </div>
</template>

<style scoped>
.frame-fill {
  background: linear-gradient(135deg, #143E48 0%, #0A1F25 100%);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.frame-stroke {
  background: #5DCFE0;
  clip-path: polygon(
    50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%,
    0% 26%, 1.5% 26%, 1.5% 74%, 50% 98.5%, 98.5% 74%, 98.5% 26%, 0% 26%
  );
  filter: drop-shadow(0 0 6px rgba(93, 207, 224, 0.5));
  opacity: 0.9;
}
.frame-stroke.pulse {
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; filter: drop-shadow(0 0 4px rgba(93, 207, 224, 0.3)); }
  50%      { opacity: 0.95; filter: drop-shadow(0 0 12px rgba(93, 207, 224, 0.65)); }
}
</style>
