<script setup lang="ts">
import { computed } from 'vue';
import type { Card, InvestableStat } from '@/types/build';
import { SLOT_ORDER } from '@/types/slots';
import { getCachedItem } from '@/composables/useItemCatalog';
import { getInvestment } from '@/utils/statCost';
import { effectMaxRoll } from '@/utils/stats';
import {
  CHAR_PA, CHAR_PM, CHAR_VITALITE,
} from '@/composables/useCardStats';
import { useMousePosition } from '@/composables/useMousePosition';

const props = defineProps<{
  open: boolean;
  card: Card;
  /** DofusDB characteristic id this tooltip details (e.g. CHAR_AGILITE, CHAR_DOM_AIR). */
  char: number | null;
  /** Manual-investment key — adds the base / parcho / invested lines for the 6 carac stats.
   *  null when the row is item-only (Puissance, Dommages, all per-element damages). */
  invest: InvestableStat | null;
  /** Display name shown in the tooltip header (e.g. "Agilité", "Dommage Air"). */
  label: string;
}>();

const { x: mouseX, y: mouseY } = useMousePosition();

const WIDTH = 260;
const HEIGHT_ESTIMATE = 240;
const OFFSET = 14;
const MARGIN = 12;

const position = computed(() => {
  let left = mouseX.value + OFFSET;
  let top = mouseY.value + OFFSET;
  if (left + WIDTH + MARGIN > window.innerWidth) left = mouseX.value - OFFSET - WIDTH;
  if (top + HEIGHT_ESTIMATE + MARGIN > window.innerHeight) top = mouseY.value - OFFSET - HEIGHT_ESTIMATE;
  left = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, left));
  top = Math.max(MARGIN, Math.min(window.innerHeight - HEIGHT_ESTIMATE - MARGIN, top));
  return { left, top };
});

interface Source { label: string; value: number; }

const sources = computed<Source[]>(() => {
  const out: Source[] = [];
  const card = props.card;
  const char = props.char;
  if (char === null) return out;

  // Engine base — vita per-level, PA/PM flat.
  if (char === CHAR_VITALITE && card.level !== null) {
    out.push({ label: `Base niv. ${card.level}`, value: 50 + 5 * card.level });
  } else if (char === CHAR_PA && card.level !== null) {
    out.push({ label: 'Base', value: card.level >= 100 ? 7 : 6 });
  } else if (char === CHAR_PM) {
    out.push({ label: 'Base', value: 3 });
  }

  // Manual investment + scroll (only for the 6 investable stats).
  if (props.invest) {
    const inv = getInvestment(card, props.invest);
    if (inv.scrolled) out.push({ label: 'Parcho 100', value: 100 });
    if (inv.invested !== 0) out.push({ label: 'Points investis', value: inv.invested });
  }

  // Per-item contributions (positive OR negative) on this characteristic. We also
  // tally panoplie counts here so the set bonus pass below knows which tier to apply.
  const setCounts = new Map<number, { count: number; set: import('@/data/dofusdb').ItemSet | undefined }>();
  const collectItem = (itemId: number): void => {
    const item = getCachedItem(itemId);
    if (!item) return;
    let total = 0;
    for (const eff of item.effects ?? []) {
      if (eff.characteristic === char) total += effectMaxRoll(eff);
    }
    if (total !== 0) out.push({ label: item.name, value: total });
    if (item.setId !== undefined) {
      const entry = setCounts.get(item.setId) ?? { count: 0, set: undefined };
      entry.count++;
      if (item.set) entry.set = item.set;
      setCounts.set(item.setId, entry);
    }
  };

  for (const slot of SLOT_ORDER) {
    const ref = card.slots[slot];
    if (ref) collectItem(ref.itemId);
  }
  for (const ref of card.dofus) {
    if (ref) collectItem(ref.itemId);
  }

  // Panoplie bonus on this characteristic, one line per qualifying set.
  for (const { count, set } of setCounts.values()) {
    if (!set || count < 2) continue;
    const tier = set.effects[count - 1];
    if (!tier) continue;
    let total = 0;
    for (const eff of tier) {
      if (eff.characteristic === char) total += effectMaxRoll(eff);
    }
    if (total !== 0) out.push({ label: `${set.name} (${count} pièces)`, value: total });
  }

  return out;
});

const total = computed(() => sources.value.reduce((acc, s) => acc + s.value, 0));

function formatValue(v: number): string {
  if (v > 0) return `+${v}`;
  // Built-in unary minus already renders as "-", but use the typographic minus for
  // alignment with the leading "+" on positive lines (same character width).
  return v < 0 ? `−${Math.abs(v)}` : '0';
}
</script>

<template>
  <Teleport to="body">
    <Transition name="tip">
      <div
        v-if="open && sources.length > 0"
        class="fixed z-[60] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-none"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: WIDTH + 'px',
          background: 'rgba(8,8,8,0.92)',
        }"
        role="tooltip"
      >
        <header class="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-white/10">
          <span class="font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-[#8AE0EE]">{{ label }}</span>
          <span class="font-mono text-[13px] font-bold text-white">{{ total }}</span>
        </header>
        <ul class="px-3 py-2 flex flex-col gap-1">
          <li
            v-for="(s, i) in sources"
            :key="i"
            class="flex items-baseline justify-between gap-2 font-sans text-xs"
          >
            <span class="truncate text-white">{{ s.label }}</span>
            <span
              class="font-mono shrink-0"
              :class="s.value > 0 ? 'text-white' : s.value < 0 ? 'text-danger-soft' : 'text-white/70'"
            >{{ formatValue(s.value) }}</span>
          </li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tip-enter-active, .tip-leave-active {
  transition: opacity 120ms ease;
}
.tip-enter-from, .tip-leave-to {
  opacity: 0;
}
</style>
