<script setup lang="ts">
import { ref } from 'vue';
import type { Item } from '@/data/dofusdb';
import type { SlotType } from '@/types/slots';
import { getSlotIconSvg } from '@/data/slot-icons';

const props = defineProps<{
  item: Item;
  fallbackSlot?: SlotType;
}>();

const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

async function copyName(): Promise<void> {
  const text = props.item.name;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure contexts or very old browsers.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copied.value = true;
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { copied.value = false; resetTimer = null; }, 1200);
  } catch {
    // Silently swallow — the user can re-click. No toast.
  }
}
</script>

<template>
  <div class="item-row flex items-center gap-2.5 py-1.5 px-1 text-[12px]">
    <div class="icon w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 bg-bg-slot-filled border border-border-slot-filled">
      <img v-if="item.iconUrl" :src="item.iconUrl" :alt="item.name" class="w-4 h-4" />
      <svg
        v-else-if="fallbackSlot"
        viewBox="0 0 24 24"
        class="w-4 h-4 text-text-muted"
        v-html="getSlotIconSvg(fallbackSlot)"
      />
    </div>
    <span
      data-testid="item-name"
      class="flex-1 min-w-0 truncate text-text-default cursor-pointer hover:text-white"
      :title="item.name"
      @click="copyName"
    >{{ item.name }}</span>
    <span class="text-[10px] font-mono text-text-dim border border-border-default bg-bg-page rounded px-1.5 py-0.5">lv {{ item.levelRequired }}</span>
    <button
      type="button"
      class="w-6 h-6 rounded border bg-bg-page text-text-muted text-[12px] flex items-center justify-center transition-colors"
      :class="copied
        ? 'bg-white text-[#0a0a0a] border-white'
        : 'border-border-default hover:border-white/60 hover:text-white'"
      aria-label="Copier le nom"
      @click="copyName"
    >{{ copied ? '✓' : '⧉' }}</button>
  </div>
</template>
