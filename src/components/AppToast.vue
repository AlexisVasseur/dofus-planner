<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { messages } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="m in messages"
          :key="m.id"
          class="toast px-4 py-2 rounded-md border border-[#5DCFE0]/40 text-[13px] text-text-default font-sans pointer-events-auto"
          style="background: rgba(8,8,8,0.85); backdrop-filter: blur(8px);"
        >
          {{ m.text }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.toast-leave-active {
  transition: opacity 160ms ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
}
</style>
