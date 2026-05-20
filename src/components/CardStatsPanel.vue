<script setup lang="ts">
import { computed } from 'vue';
import type { Card } from '@/types/build';
import { useCardStats,
  CHAR_PA, CHAR_PM, CHAR_PO,
  CHAR_VITALITE, CHAR_SAGESSE,
  CHAR_FORCE, CHAR_DOM_TERRE,
  CHAR_AGILITE, CHAR_DOM_AIR,
  CHAR_INTELLIGENCE, CHAR_DOM_FEU,
  CHAR_CHANCE, CHAR_DOM_EAU,
  CHAR_PUISSANCE, CHAR_DOMMAGE,
} from '@/composables/useCardStats';

const props = defineProps<{ card: Card }>();

const stats = useCardStats(() => props.card);

const ICON_BASE = 'https://www.dofusdb.fr/icons/effects/';
const ICON = {
  pa:    ICON_BASE + 'pa.png',
  pm:    ICON_BASE + 'pm.png',
  po:    ICON_BASE + 'po.png',
  pv:    ICON_BASE + 'pv.png',
  sag:   ICON_BASE + 'sagesse.png',
  terre: ICON_BASE + 'terre.png',
  air:   ICON_BASE + 'air.png',
  feu:   ICON_BASE + 'feu.png',
  eau:   ICON_BASE + 'eau.png',
  puiss: ICON_BASE + 'puissance.png',
};

const v = (c: number) => stats.value[c] ?? 0;

// Top line   = simple utility stats (PA / PM / PO / Vita / Sagesse)
// Bottom line = element groups (icon + primary + damage) — Puissance/Dommage follows the
//               same shape (Puiss icon + Puissance value + Dommage value, no separate
//               Dommage icon, matching the elemental rows).
const utility = computed(() => [
  { icon: ICON.pa,  label: 'PA',       value: v(CHAR_PA) },
  { icon: ICON.pm,  label: 'PM',       value: v(CHAR_PM) },
  { icon: ICON.po,  label: 'PO',       value: v(CHAR_PO) },
  { icon: ICON.pv,  label: 'Vitalité', value: v(CHAR_VITALITE) },
  { icon: ICON.sag, label: 'Sagesse',  value: v(CHAR_SAGESSE) },
]);

const elemental = computed(() => [
  { icon: ICON.terre, label: 'Force',        dmgLabel: 'Dommage Force', primary: v(CHAR_FORCE),        dmg: v(CHAR_DOM_TERRE) },
  { icon: ICON.air,   label: 'Agilité',      dmgLabel: 'Dommage Air',   primary: v(CHAR_AGILITE),      dmg: v(CHAR_DOM_AIR) },
  { icon: ICON.feu,   label: 'Intelligence', dmgLabel: 'Dommage Feu',   primary: v(CHAR_INTELLIGENCE), dmg: v(CHAR_DOM_FEU) },
  { icon: ICON.eau,   label: 'Chance',       dmgLabel: 'Dommage Eau',   primary: v(CHAR_CHANCE),       dmg: v(CHAR_DOM_EAU) },
  { icon: ICON.puiss, label: 'Puissance',    dmgLabel: 'Dommages',      primary: v(CHAR_PUISSANCE),    dmg: v(CHAR_DOMMAGE) },
]);
</script>

<template>
  <aside class="card-stats-h flex-shrink-0 border-t border-white/10 px-3 py-3 flex flex-col gap-2">
    <!-- Top row: 5 utility stats, each in their own column so icons align with the
         elemental row below. -->
    <div class="grid grid-cols-5 gap-2">
      <div
        v-for="(c, i) in utility"
        :key="`u-${i}`"
        class="cell flex items-center gap-1.5 min-w-0"
        :title="c.label"
      >
        <img :src="c.icon" :alt="c.label" class="w-6 h-6 flex-shrink-0 select-none" :class="c.value === 0 ? 'opacity-35' : ''" draggable="false" />
        <span
          class="value font-mono font-bold text-[14px] tabular-nums px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/15 min-w-[2.75rem] text-center"
          :class="c.value === 0 ? 'text-text-ghost' : 'text-text-default'"
        >{{ c.value }}</span>
      </div>
    </div>
    <!-- Bottom row: 5 element groups, same grid-cols-5 so icons align with the row above. -->
    <div class="grid grid-cols-5 gap-2">
      <div
        v-for="(r, i) in elemental"
        :key="`e-${i}`"
        class="cell flex items-center gap-1 min-w-0"
        :title="`${r.label} / ${r.dmgLabel}`"
      >
        <img :src="r.icon" :alt="r.label" class="w-6 h-6 flex-shrink-0 select-none" :class="r.primary === 0 && r.dmg === 0 ? 'opacity-35' : ''" draggable="false" />
        <span
          class="value font-mono font-bold text-[14px] tabular-nums px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/15 min-w-[2.75rem] text-center"
          :class="r.primary === 0 ? 'text-text-ghost' : 'text-text-default'"
        >{{ r.primary }}</span>
        <span
          class="value font-mono font-bold text-[14px] tabular-nums px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/15 min-w-[2.75rem] text-center"
          :class="r.dmg === 0 ? 'text-text-ghost' : 'text-text-default'"
        >{{ r.dmg }}</span>
      </div>
    </div>
  </aside>
</template>
