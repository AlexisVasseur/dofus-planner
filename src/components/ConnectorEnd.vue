<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ afterCardId: string }>();

const build = useBuildStore();
const ui = useUiStore();

function addCopy(): void {
  build.addCopyCardAfter(props.afterCardId);
}
function addEmpty(): void {
  build.addEmptyCardAfter(props.afterCardId);
}
function addFromCode(): void {
  ui.openCodeImport(props.afterCardId);
}
</script>

<template>
  <!-- Trailing "ghost card": same dimensions as a real card, dashed outline,
       two stacked buttons that mirror the connector popover actions.
       Replaces the last "+" pill connector at the right end of the timeline. -->
  <article
    class="connector-end select-none flex-shrink-0 h-full max-h-[660px] flex flex-col gap-3 p-5 rounded-xl border-2 border-dashed border-white/15 hover:border-[#5DCFE0]/40 transition-colors"
    :style="{ width: 'var(--card-width, 440px)' }"
  >
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-2.5 rounded-lg border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.10] hover:bg-[#5DCFE0]/[0.18] hover:border-[#5DCFE0]/60 transition-colors"
      @click="addCopy"
    >
      <svg class="w-7 h-7 text-[#8AE0EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      <span class="font-sans font-bold text-[12px] uppercase tracking-[0.06em] text-[#8AE0EE]">Copier le stuff précédent</span>
    </button>
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-2.5 rounded-lg border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.10] hover:bg-[#5DCFE0]/[0.18] hover:border-[#5DCFE0]/60 transition-colors"
      @click="addEmpty"
    >
      <svg class="w-7 h-7 text-[#8AE0EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span class="font-sans font-bold text-[12px] uppercase tracking-[0.06em] text-[#8AE0EE]">Nouveau stuff</span>
    </button>
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-2.5 rounded-lg border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.10] hover:bg-[#5DCFE0]/[0.18] hover:border-[#5DCFE0]/60 transition-colors"
      @click="addFromCode"
    >
      <svg class="w-7 h-7 text-[#8AE0EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
      <span class="font-sans font-bold text-[12px] uppercase tracking-[0.06em] text-[#8AE0EE]">Coller un code</span>
    </button>
  </article>
</template>
