<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { ROOM_ORDER, levelToRoom, type RoomId } from '@/types/rooms';

const props = defineProps<{ scrollRef: HTMLElement | null }>();

const build = useBuildStore();
const ui = useUiStore();

const scrollElRef = toRef(props, 'scrollRef');

interface Cell {
  key: string;
  label: string;
  // payload: cardId in builder/reader; roomId in shopping
  payload: string;
  ariaLabel: string;
}

// Builder/Reader = one cell per card (Lv X). Shopping = one cell per room (1-50, 51-100…)
// so the navigator stays the same flat pill bar across all three pages.
const cells = computed<Cell[]>(() => {
  if (ui.viewMode === 'purchase') {
    return ROOM_ORDER.map((r) => ({
      key: r,
      label: r,
      payload: r,
      ariaLabel: r === 'hub' ? 'Aller au Hub' : `Aller à la salle ${r}`,
    }));
  }
  return build.cards.map((c, idx) => ({
    key: c.id,
    label: c.level === null ? '—' : `Lv ${c.level}`,
    payload: c.id,
    ariaLabel: c.level === null ? `Aller à l'étape ${idx + 1}` : `Aller à l'étape niveau ${c.level}`,
  }));
});

// Active cell index. In shopping the active room is derived from the active card's level.
const activeCellIdx = computed(() => {
  if (ui.viewMode === 'purchase') {
    const card = build.cards.find((c) => c.id === ui.activeCardId);
    if (!card || card.level === null) return -1;
    return ROOM_ORDER.indexOf(levelToRoom(card.level));
  }
  return build.cards.findIndex((c) => c.id === ui.activeCardId);
});

// Sliding pill geometry. Cells are flex-1 inside a 3px-gap row. With N cells:
//   cell_width = (100% - (N-1)*3) / N
//   pill_left(i) = i * (cell_width + 3) = i * (100% + 3px) / N
const CELL_GAP_PX = 3;
const pillStyle = computed(() => {
  const n = cells.value.length;
  const i = activeCellIdx.value;
  if (n === 0 || i < 0) return { display: 'none' };
  return {
    left: `calc(${i} * (100% + ${CELL_GAP_PX}px) / ${n})`,
    width: `calc((100% - ${(n - 1) * CELL_GAP_PX}px) / ${n})`,
  };
});

// Card geometry — must match AppTimeline / EquipmentCard / Connector widths.
const CARD_WIDTH = 320;
const CONNECTOR_WIDTH = 52;
const PADDING_LEFT = 64; // matches pl-16 in AppTimeline

function gotoCell(cell: Cell, idx: number): void {
  if (ui.viewMode === 'purchase') {
    const room = cell.payload as RoomId;
    // Hub has no card-level mapping — request an explicit scroll instead of setActiveCard.
    if (room === 'hub') {
      ui.requestPurchaseScroll('hub');
      return;
    }
    // Other rooms: find the first card whose level falls in that room and make it active.
    // AppPurchasePlanner watches the derived active room and scrolls.
    const target = build.cards.find((c) => c.level !== null && levelToRoom(c.level) === room);
    if (target) ui.setActiveCard(target.id);
    return;
  }
  ui.setActiveCard(cell.payload);
  const el = scrollElRef.value;
  if (!el) return; // Reader passes null
  const cardCenter = PADDING_LEFT + idx * (CARD_WIDTH + CONNECTOR_WIDTH) + CARD_WIDTH / 2;
  const target = cardCenter - el.clientWidth / 2;
  el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}
</script>

<template>
  <footer
    class="minimap mx-4 mb-3 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] flex items-center gap-3 px-5 py-2.5 relative"
    style="background: rgba(8,8,8,0.55);"
  >
    <div class="font-sans font-bold text-[11px] text-text-faint tracking-[0.06em] uppercase shrink-0">Timeline</div>
    <div class="flex-1 h-9 rounded-md relative overflow-hidden">
      <Transition name="cells" mode="out-in">
        <div :key="ui.viewMode" class="absolute inset-1 flex gap-[3px]">
          <div
            class="active-pill absolute top-0 bottom-0 z-0 rounded-sm bg-[#5DCFE0] transition-[left,width] duration-300 ease-out"
            :style="pillStyle"
          />
          <button
            v-for="(cell, idx) in cells"
            :key="cell.key"
            type="button"
            class="flex-1 h-full relative z-10 rounded-sm inline-flex items-center justify-center font-bold transition-colors duration-300 cursor-pointer"
            :class="[
              ui.viewMode === 'purchase'
                ? 'font-sans text-[10px] tracking-[0.06em] uppercase'
                : 'font-mono text-[10px] tracking-tight',
              idx === activeCellIdx
                ? 'text-[#0A2530]'
                : 'text-text-muted hover:text-[#8AE0EE]',
            ]"
            :aria-label="cell.ariaLabel"
            @click="gotoCell(cell, idx)"
          >
            {{ cell.label }}
          </button>
        </div>
      </Transition>
    </div>
  </footer>
</template>

<style scoped>
.cells-enter-active, .cells-leave-active {
  transition: opacity 180ms ease;
}
.cells-enter-from, .cells-leave-to {
  opacity: 0;
}
</style>
