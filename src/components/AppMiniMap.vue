<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ scrollRef: HTMLElement | null }>();

const build = useBuildStore();
const ui = useUiStore();

const scrollElRef = toRef(props, 'scrollRef');

const lastLevel = computed(() => {
  const cards = build.cards;
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].level !== null) return cards[i].level!;
  }
  return 1;
});

const activeIndex = computed(() => build.cards.findIndex((c) => c.id === ui.activeCardId));

// Card geometry — must match AppTimeline / EquipmentCard / Connector widths
const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 52;
const PADDING_LEFT = 64; // matches pl-16 in AppTimeline

function gotoCard(index: number, cardId: string) {
  const el = scrollElRef.value;
  if (!el) return;
  const cardCenter = PADDING_LEFT + index * (CARD_WIDTH + CONNECTOR_WIDTH) + CARD_WIDTH / 2;
  const target = cardCenter - el.clientWidth / 2;
  el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  ui.setActiveCard(cardId);
}
</script>

<template>
  <footer
    class="minimap border-t border-border-subtle backdrop-blur-md flex items-center gap-3 px-5 py-2.5 relative z-[4]"
    style="background: rgba(5,5,5,0.9);"
  >
    <div class="font-display text-[11px] text-text-faint tracking-[0.25em] uppercase shrink-0">Timeline</div>
    <div
      class="flex-1 h-9 bg-bg-surface border border-border-subtle rounded-md relative overflow-hidden"
    >
      <div class="absolute inset-1 flex gap-[3px]">
        <button
          v-for="(card, idx) in build.cards"
          :key="card.id"
          type="button"
          class="flex-1 h-full rounded-sm flex items-center justify-center font-mono text-[10px] tracking-tight transition-colors cursor-pointer"
          :class="idx === activeIndex
            ? 'bg-accent text-[#061a13] shadow-[0_0_8px_rgba(91,211,168,0.5)] font-semibold'
            : 'bg-border-default text-text-muted hover:bg-bg-elev hover:text-text-default'"
          :aria-label="card.level === null ? `Aller à l'étape ${idx + 1}` : `Aller à l'étape niveau ${card.level}`"
          @click="gotoCard(idx, card.id)"
        >
          {{ card.level === null ? '—' : `Lv ${card.level}` }}
        </button>
      </div>
    </div>
    <div class="font-mono text-[10px] text-text-dim shrink-0">
      <span class="text-accent">Lv {{ lastLevel }}</span>
      · {{ build.cards.length }} cards · {{ lastLevel }} lvls
    </div>
  </footer>
</template>
