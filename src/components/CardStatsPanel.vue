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

// Stats table: 7 rows, each split into STATS (base + invest + exo, no parcho) /
// + Item / + Parcho (scroll bonus + gear) / DMG (where applicable). The first 6
// rows are click-to-edit — clicking the STATS cell opens the investment modal.
// Puissance is item-only so its row is read-only.
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
  /** Stats column — base + invested + exo (no parcho, no items). */
  statsValue: number;
  /** + Item / + Parcho column — scroll bonus + items contribution. */
  bonusValue: number;
  dmgValue: number | null;
}
function makeRow(
  icon: string, label: string, dmgLabel: string | null,
  investKey: InvestableStat | null, char: number, dmgChar: number | null,
): StatRow {
  const scroll = scrollFor(investKey);
  // characterBase already includes the scroll bonus — subtract it so the Stats
  // column is "what the character has innately" (level + invested + exo only).
  const statsValue = cb(char) - scroll;
  const bonusValue = scroll + ib(char);
  return {
    icon, label, dmgLabel, investKey, char, dmgChar,
    statsValue,
    bonusValue,
    dmgValue: dmgChar !== null ? ib(dmgChar) : null,
  };
}
const statRows = computed<StatRow[]>(() => [
  makeRow(ICON.pv,    'Vitalité',     null,            'vitalite',     CHAR_VITALITE,     null),
  makeRow(ICON.sag,   'Sagesse',      null,            'sagesse',      CHAR_SAGESSE,      null),
  makeRow(ICON.terre, 'Force',        'Dommage Force', 'force',        CHAR_FORCE,        CHAR_DOM_TERRE),
  makeRow(ICON.air,   'Agilité',      'Dommage Air',   'agilite',      CHAR_AGILITE,      CHAR_DOM_AIR),
  makeRow(ICON.feu,   'Intelligence', 'Dommage Feu',   'intelligence', CHAR_INTELLIGENCE, CHAR_DOM_FEU),
  makeRow(ICON.eau,   'Chance',       'Dommage Eau',   'chance',       CHAR_CHANCE,       CHAR_DOM_EAU),
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
  <aside class="card-stats-h h-full flex flex-col items-stretch px-3 py-2 min-h-0 overflow-hidden gap-2" style="container-type: size;">
    <!-- PA / PM / PO row — pinned at the top, big icon + value below. -->
    <div class="flex justify-center items-end gap-6 flex-shrink-0">
      <div
        v-for="(c, i) in actionRow"
        :key="`a-${i}`"
        class="action-stack flex flex-col items-center gap-1"
      >
        <img :src="c.icon" :alt="c.label" class="action-icon select-none" draggable="false" />
        <span class="action-value font-mono font-bold tabular-nums leading-none text-text-default">{{ c.value }}</span>
      </div>
    </div>

    <!-- Stats table: icon row label + STATS / +ITEM / DMG columns. Fills the remaining
         vertical space; row gap scales with container height up to 16px. -->
    <div class="stats-table flex-1 min-h-0 flex flex-col justify-between">
      <div class="grid grid-cols-[auto_60px_60px_60px] mx-auto w-fit items-end gap-2">
        <span class="stat-icon" aria-hidden="true"></span>
        <span class="stat-header font-sans font-bold uppercase tracking-[0.15em] text-white text-center">Stats</span>
        <span class="stat-header font-sans font-bold uppercase tracking-[0.15em] text-white text-center flex flex-col leading-tight">
          <span>+ Item</span>
          <span>+ Parcho</span>
        </span>
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
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default bg-white/[0.06] border border-white/15 rounded-md justify-self-center inline-block transition-colors"
          :class="r.investKey === null
            ? 'cursor-default opacity-60'
            : 'hover:bg-[#8AE0EE]/[0.10] hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] cursor-pointer'"
          :disabled="r.investKey === null"
          :data-stat-trigger="r.investKey !== null ? `${props.card.id}-${r.investKey}` : undefined"
          @click.stop="onStatClick(r)"
        >{{ r.statsValue }}</button>
        <span
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default bg-white/[0.06] border border-white/15 rounded-md justify-self-center inline-block cursor-help hover:border-[#8AE0EE]/40 hover:bg-[#5DCFE0]/[0.06] transition-colors"
          @mouseenter="onCellEnter({ char: r.char, invest: r.investKey, label: r.label })"
          @mouseleave="onCellLeave"
        >{{ r.bonusValue }}</span>
        <span
          v-if="r.dmgValue !== null && r.dmgChar !== null"
          class="stat-value font-mono font-bold tabular-nums text-center text-text-default bg-white/[0.06] border border-white/15 rounded-md justify-self-center inline-block cursor-help hover:border-[#8AE0EE]/40 hover:bg-[#5DCFE0]/[0.06] transition-colors"
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
/* PA / PM / PO icons — biggest on the panel, no hex backdrop, value sits underneath. */
.action-icon {
  width: clamp(28px, 8cqb, 56px);
  height: clamp(28px, 8cqb, 56px);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}
.action-value {
  font-size: clamp(15px, 4cqb, 22px);
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
