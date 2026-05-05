<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ scrollRef: HTMLElement | null }>();

const build = useBuildStore();
const ui = useUiStore();

const scrollElRef = toRef(props, 'scrollRef');

const activeIndex = computed(() => build.cards.findIndex((c) => c.id === ui.activeCardId));

// Sliding pill geometry. Cells are flex-1 inside a 3px-gap row. With N cells:
//   cell_width = (100% - (N-1)*3) / N
//   pill_left(i) = i * (cell_width + 3) = i * (100% + 3px) / N
const CELL_GAP_PX = 3;
const pillStyle = computed(() => {
  const n = build.cards.length;
  const i = activeIndex.value;
  if (n === 0 || i < 0) return { display: 'none' };
  return {
    left: `calc(${i} * (100% + ${CELL_GAP_PX}px) / ${n})`,
    width: `calc((100% - ${(n - 1) * CELL_GAP_PX}px) / ${n})`,
  };
});

// Card geometry — must match AppTimeline / EquipmentCard / Connector widths
const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 52;
const PADDING_LEFT = 64; // matches pl-16 in AppTimeline

function gotoCard(index: number, cardId: string) {
  // Always update the active card so Switch view (no scroll) reacts.
  ui.setActiveCard(cardId);
  const el = scrollElRef.value;
  if (!el) return; // no timeline to scroll (Switch mode passes null)
  const cardCenter = PADDING_LEFT + index * (CARD_WIDTH + CONNECTOR_WIDTH) + CARD_WIDTH / 2;
  const target = cardCenter - el.clientWidth / 2;
  el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}
</script>

<template>
  <footer
    class="minimap mx-4 mb-3 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] flex items-center gap-3 px-5 py-2.5 relative z-[4]"
    style="background: rgba(8,8,8,0.55);"
  >
    <div class="font-sans font-bold text-[11px] text-text-faint tracking-[0.06em] uppercase shrink-0">Timeline</div>
    <div class="flex-1 h-9 rounded-md relative overflow-hidden">
      <div class="absolute inset-1 flex gap-[3px]">
        <div
          class="active-pill absolute top-0 bottom-0 z-0 rounded-sm bg-[#5DCFE0] transition-[left,width] duration-300 ease-out"
          :style="pillStyle"
        />
        <button
          v-for="(card, idx) in build.cards"
          :key="card.id"
          type="button"
          class="flex-1 h-full relative z-10 rounded-sm flex items-center justify-center font-mono font-bold text-[10px] tracking-tight transition-colors duration-300 cursor-pointer"
          :class="idx === activeIndex
            ? 'bg-transparent text-[#0A2530]'
            : 'bg-border-default text-text-muted hover:bg-bg-elev hover:text-text-default'"
          :aria-label="card.level === null ? `Aller à l'étape ${idx + 1}` : `Aller à l'étape niveau ${card.level}`"
          @click="gotoCard(idx, card.id)"
        >
          {{ card.level === null ? '—' : `Lv ${card.level}` }}
        </button>
      </div>
    </div>
  </footer>
</template>
