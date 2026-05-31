<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import type { Card, InvestableStat } from '@/types/build';
import {
  useCharacterBase, useItemBonus,
  CHAR_PA, CHAR_PM, CHAR_PO,
  CHAR_VITALITE, CHAR_SAGESSE,
  CHAR_FORCE, CHAR_DOM_TERRE,
  CHAR_AGILITE, CHAR_DOM_AIR,
  CHAR_INTELLIGENCE, CHAR_DOM_FEU,
  CHAR_CHANCE, CHAR_DOM_EAU,
  CHAR_PUISSANCE, CHAR_DOMMAGE,
} from '@/composables/useCardStats';
import { useUiStore } from '@/stores/ui';
import { getInvestment } from '@/utils/statCost';
import StatSourcesTooltip from './StatSourcesTooltip.vue';

const props = defineProps<{ card: Card }>();
const ui = useUiStore();

const characterBase = useCharacterBase(() => props.card);
const itemBonus = useItemBonus(() => props.card);

const ICON_BASE = 'https://www.dofusdb.fr/icons/effects/';
const ICON = {
  pv:    ICON_BASE + 'pv.png',
  sag:   ICON_BASE + 'sagesse.png',
  pa:    ICON_BASE + 'pa.png',
  pm:    ICON_BASE + 'pm.png',
  po:    ICON_BASE + 'po.png',
  terre: ICON_BASE + 'terre.png',
  air:   ICON_BASE + 'air.png',
  feu:   ICON_BASE + 'feu.png',
  eau:   ICON_BASE + 'eau.png',
  puiss: ICON_BASE + 'puissance.png',
};

const cb = (c: number) => characterBase.value[c] ?? 0;
const ib = (c: number) => itemBonus.value[c] ?? 0;
// Parcho 100 bonus per stat — moves out of the Stats column and into the +Item /
// +Parcho column. 0 when no class or no scroll, 100 when scrolled.
const scrollFor = (stat: InvestableStat | null): number => {
  if (stat === null) return 0;
  return getInvestment(props.card, stat).scrolled ? 100 : 0;
};

// PA / PM / PO row — bigger hex-less icons at the top. Single column (not investable).
const actionRow = computed(() => [
  { icon: ICON.pa, label: 'PA', value: cb(CHAR_PA) + ib(CHAR_PA) },
  { icon: ICON.pm, label: 'PM', value: cb(CHAR_PM) + ib(CHAR_PM) },
  { icon: ICON.po, label: 'PO', value: cb(CHAR_PO) + ib(CHAR_PO) },
]);

// Stats table: 7 rows, each split into STATS (points invested by the player) /
// TOTAL (everything combined) / DMG (where applicable). The first 6 rows are
// click-to-edit — clicking the STATS cell opens the investment modal. Puissance
// is item-only so its row is read-only.
interface StatRow {
  icon: string;
  label: string;
  dmgLabel: string | null;
  /** Manual-investment stat key, or null when the row isn't editable. */
  investKey: InvestableStat | null;
  /** DofusDB characteristic id this row aggregates (Vita, Sag, Force, …). */
  char: number;
  /** Companion damage characteristic id (Dom. Force, Dom. Air, …) — null for Vita / Sag. */
  dmgChar: number | null;
  /** Stats column — invested + exo (no parcho, no items, no per-level base). */
  statsValue: number;
  /** TOTAL column — full final value: base + invest + exo + scroll + items. */
  totalValue: number;
  dmgValue: number | null;
}
function makeRow(
  icon: string, label: string, dmgLabel: string | null,
  investKey: InvestableStat | null, char: number, dmgChar: number | null,
): StatRow {
  const scroll = scrollFor(investKey);
  // Vitality is the only stat in this table with an innate per-level base
  // (50 + 5×level). Exclude it from the Stats column so that column reads as
  // "points the player invested" (consistent with Force / Agi / etc. where the
  // engine base is 0). The base still shows up in TOTAL via cb.
  const levelBase = char === CHAR_VITALITE && props.card.level !== null
    ? 50 + 5 * props.card.level
    : 0;
  const statsValue = cb(char) - scroll - levelBase;
  return {
    icon, label, dmgLabel, investKey, char, dmgChar,
    statsValue,
    totalValue: cb(char) + ib(char),
    dmgValue: dmgChar !== null ? ib(dmgChar) : null,
  };
}
const statRows = computed<StatRow[]>(() => [
  makeRow(ICON.pv,    'Vitalité',     null,            'vitalite',     CHAR_VITALITE,     null),
  makeRow(ICON.terre, 'Force',        'Dommage Force', 'force',        CHAR_FORCE,        CHAR_DOM_TERRE),
  makeRow(ICON.feu,   'Intelligence', 'Dommage Feu',   'intelligence', CHAR_INTELLIGENCE, CHAR_DOM_FEU),
  makeRow(ICON.eau,   'Chance',       'Dommage Eau',   'chance',       CHAR_CHANCE,       CHAR_DOM_EAU),
  makeRow(ICON.air,   'Agilité',      'Dommage Air',   'agilite',      CHAR_AGILITE,      CHAR_DOM_AIR),
  makeRow(ICON.sag,   'Sagesse',      null,            'sagesse',      CHAR_SAGESSE,      null),
  makeRow(ICON.puiss, 'Puissance',    'Dommages',      null,           CHAR_PUISSANCE,    CHAR_DOMMAGE),
]);

function onStatClick(row: StatRow): void {
  if (row.investKey === null) return;
  ui.openStatModal({ cardId: props.card.id, stat: row.investKey });
}

// Hover-tooltip state: which cell is currently hovered. The tooltip auto-anchors to the
// cursor (same UX as ItemStatsTooltip). 300ms delay before showing, like the item rows.
interface HoverTarget {
  char: number;
  invest: InvestableStat | null;
  label: string;
}
const hoverTarget = ref<HoverTarget | null>(null);
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
function onCellEnter(target: HoverTarget): void {
  if (hoverTimer !== null) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { hoverTarget.value = target; hoverTimer = null; }, 300);
}
function onCellLeave(): void {
  if (hoverTimer !== null) { clearTimeout(hoverTimer); hoverTimer = null; }
  hoverTarget.value = null;
}
onBeforeUnmount(() => { if (hoverTimer !== null) clearTimeout(hoverTimer); });
</script>

<template>
  <aside
    class="card-stats-h h-full grid min-h-0 overflow-hidden"
    style="container-type: size; grid-template-rows: repeat(6, minmax(0, 1fr)); grid-template-columns: minmax(0, 1fr); gap: 0.6875rem;"
  >
    <!-- Row 1: PA / PM / PO. Full-width box (same width as the stats table below)
         vertically centered in the grid row so the box edges land on the SLOT
         top/bottom of row 1 — same vertical centering as coiffe / amulette. -->
    <div class="action-row flex justify-center items-center gap-6 bg-white/[0.06] border border-white/15 rounded-md px-3 self-center">
      <div
        v-for="(c, i) in actionRow"
        :key="`a-${i}`"
        class="action-stack flex flex-row items-center gap-1.5"
      >
        <img :src="c.icon" :alt="c.label" class="action-icon select-none" draggable="false" />
        <span class="action-value font-mono font-bold tabular-nums leading-none text-text-default">{{ c.value }}</span>
      </div>
    </div>

    <!-- Rows 2-6: stats table spans the remaining 5 item rows. The vertical margin
         equals the slot-centering offset (outer_row - cell) / 2 — same offset used to
         center an item slot in its grid row — so the box edges land on the SLOT
         top of row 2 and the SLOT bottom of row 6 (not the row edges). Inside, the
         header + 7 stat rows distribute evenly via justify-between. -->
    <div
      class="stats-table min-h-0 flex flex-col justify-between bg-white/[0.06] border border-white/15 rounded-md px-3 py-2"
      style="grid-row: 2 / 7;
             margin-top: max(0px, calc((100cqb - 55px) / 12 - (100cqi - 33px) / 8));
             margin-bottom: max(0px, calc((100cqb - 55px) / 12 - (100cqi - 33px) / 8));"
    >
      <div class="grid grid-cols-[auto_60px_60px_60px] mx-auto w-fit items-end gap-2">
        <span class="stat-icon" aria-hidden="true"></span>
        <span class="stat-header font-sans font-bold uppercase tracking-[0.15em] text-white text-center">Stats</span>
        <span class="stat-header font-sans font-bold uppercase tracking-[0.15em] text-white text-center">TOTAL</span>
        <span class="stat-header font-sans font-bold uppercase tracking-[0.15em] text-white text-center">DMG</span>
      </div>
      <div
        v-for="(r, i) in statRows"
        :key="`s-${i}`"
        class="stat-row grid grid-cols-[auto_60px_60px_60px] mx-auto w-fit items-center gap-2"
      >
        <img :src="r.icon" :alt="r.label" class="stat-icon select-none" draggable="false" />
        <button
          type="button"
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default border border-white/15 rounded-md justify-self-center inline-block transition-colors"
          :class="r.investKey === null
            ? 'cursor-default opacity-60'
            : 'hover:bg-[#8AE0EE]/[0.10] hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] cursor-pointer'"
          :disabled="r.investKey === null"
          :data-stat-trigger="r.investKey !== null ? `${props.card.id}-${r.investKey}` : undefined"
          @click.stop="onStatClick(r)"
        >{{ r.statsValue }}</button>
        <span
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default border border-white/15 rounded-md justify-self-center inline-block cursor-help hover:border-[#8AE0EE]/40 hover:bg-[#5DCFE0]/[0.06] transition-colors"
          @mouseenter="onCellEnter({ char: r.char, invest: r.investKey, label: r.label })"
          @mouseleave="onCellLeave"
        >{{ r.totalValue }}</span>
        <span
          v-if="r.dmgValue !== null && r.dmgChar !== null"
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default border border-white/15 rounded-md justify-self-center inline-block cursor-help hover:border-[#8AE0EE]/40 hover:bg-[#5DCFE0]/[0.06] transition-colors"
          @mouseenter="onCellEnter({ char: r.dmgChar, invest: null, label: r.dmgLabel ?? r.label })"
          @mouseleave="onCellLeave"
        >{{ r.dmgValue }}</span>
        <span v-else aria-hidden="true"></span>
      </div>
    </div>

    <StatSourcesTooltip
      :open="hoverTarget !== null"
      :card="card"
      :char="hoverTarget?.char ?? null"
      :invest="hoverTarget?.invest ?? null"
      :label="hoverTarget?.label ?? ''"
    />
  </aside>
</template>

<style scoped>
/* PA / PM / PO row — height = 1 item-cell when the card is tall enough so the box
   aligns with row 1 of the equipment grid (coiffe / amulette). Cells are square so
   1 cell = (100cqi - 33px) / 4 (panel inline-size = 4 cells + 3×11px). When the
   card shrinks vertically, outer-grid rows ((100cqb - 55px) / 6) become smaller
   than a cell — we cap the height at the row size so the box never overflows its
   grid track (otherwise the bottom border would slip under the stats table below).
   `container-type: size` lets the inner icon / value scale with the box via
   cqmin instead of staying glued to the panel inline-size. */
.action-row {
  height: min(calc((100cqi - 33px) / 4), calc((100cqb - 55px) / 6));
  container-type: size;
}
.action-icon {
  width: clamp(16px, 60cqmin, 32px);
  height: clamp(16px, 60cqmin, 32px);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}
.action-value {
  font-size: clamp(12px, 32cqmin, 18px);
}

/* Stats table — icon as row label (smaller than action icons, no hex backdrop). */
.stat-icon {
  width: clamp(18px, 5cqb, 32px);
  height: clamp(18px, 5cqb, 32px);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.stat-value {
  font-size: clamp(12px, 3cqb, 17px);
  width: clamp(40px, 11cqb, 60px);
  padding-top: clamp(2px, 0.5cqb, 4px);
  padding-bottom: clamp(2px, 0.5cqb, 4px);
}
.stat-header {
  font-size: clamp(8px, 2.2cqb, 12px);
}

/* Row gap minimum — justify-between handles the extra distribution so the table
   stretches end-to-end and uses every pixel of the available height. */
.stats-table {
  gap: 4px;
}
</style>
