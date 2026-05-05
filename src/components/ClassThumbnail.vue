<script setup lang="ts">
import { computed } from 'vue';
import { getClassAssets } from '@/composables/useClassAssets';
import ClassLogo from '@/components/ClassLogo.vue';
import type { ClassId } from '@/types/classes';

const props = withDefaults(defineProps<{
  classId: string | null;
  size?: number;
}>(), {
  size: 48,
});

const assets = computed(() => getClassAssets(props.classId));
const fallbackId = computed(() => (props.classId as ClassId | null));
</script>

<template>
  <img
    v-if="assets"
    :src="assets.thumbnail"
    alt=""
    class="block rounded-lg object-cover border"
    :style="{ width: size + 'px', height: size + 'px', borderColor: 'var(--class-soft, transparent)' }"
    loading="lazy"
    decoding="async"
  />
  <ClassLogo v-else :class-id="fallbackId" />
</template>
