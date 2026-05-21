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

const v = (c: number) => stats.value[c] ?? 0;

// Top section is split into two centered hex rows:
//   row 1 = PA / PM / PO  (action-economy stats first)
//   row 2 = Vitalité / Sagesse
const topRow1 = computed(() => [
  { icon: ICON.pa, label: 'PA', value: v(CHAR_PA) },
  { icon: ICON.pm, label: 'PM', value: v(CHAR_PM) },
  { icon: ICON.po, label: 'PO', value: v(CHAR_PO) },
]);
const topRow2 = computed(() => [
  { icon: ICON.pv,  label: 'Vitalité', value: v(CHAR_VITALITE) },
  { icon: ICON.sag, label: 'Sagesse',  value: v(CHAR_SAGESSE) },
]);

// 5 elemental rows: [stat value] [hex icon] [damage value]. Force / Air / Intel / Eau /
// Puissance — the user wants Puissance treated as a 5th element with its general Dommages
// as the damage column.
const elemRows = computed(() => [
  { icon: ICON.terre, label: 'Force',        dmgLabel: 'Dommage Force', primary: v(CHAR_FORCE),        dmg: v(CHAR_DOM_TERRE) },
  { icon: ICON.air,   label: 'Agilité',      dmgLabel: 'Dommage Air',   primary: v(CHAR_AGILITE),      dmg: v(CHAR_DOM_AIR) },
  { icon: ICON.feu,   label: 'Intelligence', dmgLabel: 'Dommage Feu',   primary: v(CHAR_INTELLIGENCE), dmg: v(CHAR_DOM_FEU) },
  { icon: ICON.eau,   label: 'Chance',       dmgLabel: 'Dommage Eau',   primary: v(CHAR_CHANCE),       dmg: v(CHAR_DOM_EAU) },
  { icon: ICON.puiss, label: 'Puissance',    dmgLabel: 'Dommages',      primary: v(CHAR_PUISSANCE),    dmg: v(CHAR_DOMMAGE) },
]);
</script>

<template>
  <aside class="card-stats-h h-full flex flex-col items-stretch justify-around gap-0 px-3 py-2 min-h-0 overflow-hidden" style="container-type: size;">
    <!-- Row 1: PA / PM / PO -->
    <div class="flex justify-center gap-3 flex-shrink-0">
      <div
        v-for="(c, i) in topRow1"
        :key="`r1-${i}`"
        class="hex-stack flex flex-col items-center gap-0.5"
        :title="c.label"
      >
        <div class="hex hex-fluid relative flex items-center justify-center">
          <div class="hex-shape absolute inset-0"></div>
          <img :src="c.icon" :alt="c.label" class="hex-icon relative select-none" draggable="false" />
        </div>
        <span class="hex-value font-mono font-bold tabular-nums leading-none text-text-default relative z-10">{{ c.value }}</span>
      </div>
    </div>
    <!-- Row 2: Vitalité / Sagesse -->
    <div class="flex justify-center gap-3 flex-shrink-0">
      <div
        v-for="(c, i) in topRow2"
        :key="`r2-${i}`"
        class="hex-stack flex flex-col items-center gap-0.5"
        :title="c.label"
      >
        <div class="hex hex-fluid relative flex items-center justify-center">
          <div class="hex-shape absolute inset-0"></div>
          <img :src="c.icon" :alt="c.label" class="hex-icon relative select-none" draggable="false" />
        </div>
        <span class="hex-value font-mono font-bold tabular-nums leading-none text-text-default relative z-10">{{ c.value }}</span>
      </div>
    </div>

    <!-- Elemental table -->
    <div class="elem-table flex flex-col gap-0.5 flex-shrink-0">
      <!-- Column headers — narrow center spacer matches the hex width so labels sit
           directly over the value columns. -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2">
        <span class="elem-header font-sans font-bold uppercase tracking-[0.15em] text-text-faint text-center justify-self-end pr-3">Stat</span>
        <span class="hex-fluid w-11"></span>
        <span class="elem-header font-sans font-bold uppercase tracking-[0.15em] text-text-faint text-center justify-self-start pl-3">DMG</span>
      </div>
      <div
        v-for="(r, i) in elemRows"
        :key="`elem-${i}`"
        class="elem-row grid grid-cols-[1fr_auto_1fr] items-center gap-2"
        :title="`${r.label} / ${r.dmgLabel}`"
      >
        <!-- Stat primary: glass box, sized fluidly with the container height. -->
        <span class="elem-value font-mono font-bold tabular-nums text-center text-text-default bg-white/[0.06] border border-white/15 rounded-md justify-self-end inline-block">{{ r.primary }}</span>
        <div class="hex hex-fluid relative flex items-center justify-center">
          <div class="hex-shape absolute inset-0"></div>
          <img :src="r.icon" :alt="r.label" class="hex-icon relative select-none" draggable="false" />
        </div>
        <span class="elem-value font-mono font-bold tabular-nums text-center text-text-default bg-white/[0.06] border border-white/15 rounded-md justify-self-start inline-block">{{ r.dmg }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Hexagon shape via clip-path. Two layers: outer (border tone) + inner (fill).
   The wrapper sets the size; .hex-shape paints the dark fill with a faint accent border
   produced by the contrast between layers. */
.hex {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.hex-shape {
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: rgba(255, 255, 255, 0.05);
  border: none;
}
.hex-shape::before {
  content: '';
  position: absolute;
  inset: 1px;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: rgba(10, 10, 10, 0.85);
}

/* Fluid sizing: hex scales with the available container height (cqb = container query
   block size). Icons are proportional (50% of hex) so they stay perfectly framed inside.
   Value boxes and font sizes scale too so the layout breathes when there's vertical space.
   Max sizes bumped so a tall card actually has BIG hexagons (instead of capping early). */
.hex-fluid {
  width: clamp(40px, 11.5cqb, 64px);
  height: clamp(40px, 11.5cqb, 64px);
}
.hex-icon {
  width: 50%;
  height: 50%;
}
.hex-value {
  font-size: clamp(13px, 3.5cqb, 19px);
  margin-top: clamp(-16px, -2.8cqb, -8px);
}
.elem-value {
  font-size: clamp(13px, 3.5cqb, 19px);
  width: clamp(48px, 13.5cqb, 70px);
  padding-top: clamp(2px, 0.5cqb, 5px);
  padding-bottom: clamp(2px, 0.5cqb, 5px);
}
.elem-header {
  font-size: clamp(9px, 2.5cqb, 13px);
}
</style>
