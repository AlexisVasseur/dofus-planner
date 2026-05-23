<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useEventListener, onClickOutside } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import type { Card, InvestableStat } from '@/types/build';
import {
  getInvestment, statCost, maxStatForPoints,
  totalPointsBudget, totalPointsUsed,
} from '@/utils/statCost';

const ui = useUiStore();
const build = useBuildStore();

const STAT_LABEL: Record<InvestableStat, string> = {
  vitalite: 'Vitalité',
  sagesse: 'Sagesse',
  force: 'Force',
  agilite: 'Agilité',
  intelligence: 'Intelligence',
  chance: 'Chance',
};

const target = computed(() => ui.statModalTarget);
const open = computed(() => target.value !== null);

const card = computed<Card | null>(() => {
  const t = target.value;
  if (!t) return null;
  return build.cards.find((c) => c.id === t.cardId) ?? null;
});

const stat = computed<InvestableStat | null>(() => target.value?.stat ?? null);
const investment = computed(() => {
  if (!card.value || !stat.value) return { invested: 0, scrolled: false };
  return getInvestment(card.value, stat.value);
});

// ---- Anchoring -----------------------------------------------------------
const popoverRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const triggerEl = ref<HTMLElement | null>(null);

const POP_W = 240;
const POP_H_EST = 200;
const GAP = 8;
const MARGIN = 12;

interface Position { top: number; left: number; side: 'right' | 'left' | 'below'; }
const position = ref<Position>({ top: 0, left: 0, side: 'right' });

function recompute(): void {
  const el = triggerEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Try right first, then left, then fall back to below.
  let side: 'right' | 'left' | 'below';
  let left: number;
  if (viewportW - r.right - GAP - MARGIN >= POP_W) {
    side = 'right';
    left = r.right + GAP;
  } else if (r.left - GAP - MARGIN >= POP_W) {
    side = 'left';
    left = r.left - GAP - POP_W;
  } else {
    side = 'below';
    left = Math.max(MARGIN, Math.min(viewportW - POP_W - MARGIN, r.left));
  }

  let top: number;
  if (side === 'below') {
    top = r.bottom + GAP;
  } else {
    // Vertically center on the trigger, clamped to the viewport.
    top = r.top + r.height / 2 - POP_H_EST / 2;
  }
  top = Math.max(MARGIN, Math.min(viewportH - POP_H_EST - MARGIN, top));
  position.value = { top, left, side };
}

// On every (re)open: locate the trigger via data-attribute and refocus the input.
watch(target, async (t) => {
  if (!t) { triggerEl.value = null; return; }
  await nextTick();
  triggerEl.value = document.querySelector<HTMLElement>(`[data-stat-trigger="${t.cardId}-${t.stat}"]`);
  recompute();
  inputRef.value?.focus();
  inputRef.value?.select();
});

useEventListener(window, 'resize', () => { if (open.value) recompute(); });
useEventListener(window, 'scroll', () => { if (open.value) recompute(); }, { passive: true, capture: true });

// ---- Draft input ---------------------------------------------------------
const draft = ref('0');
watch([open, () => investment.value.invested], ([isOpen, value]) => {
  if (!isOpen) return;
  draft.value = String(value);
});

// ---- Budget helpers ------------------------------------------------------
const budget = computed(() => totalPointsBudget(card.value?.level ?? null));
const usedOnOtherStats = computed(() => {
  if (!card.value || !stat.value) return 0;
  return totalPointsUsed(card.value) - statCost(stat.value, investment.value.invested);
});
const pointsAvailableForThisStat = computed(() => Math.max(0, budget.value - usedOnOtherStats.value));
const currentCost = computed(() => stat.value ? statCost(stat.value, investment.value.invested) : 0);
const remainingBudget = computed(() => budget.value - usedOnOtherStats.value - currentCost.value);
const maxInvestable = computed(() => stat.value ? maxStatForPoints(stat.value, pointsAvailableForThisStat.value) : 0);

function commitInvested(raw: number): void {
  const t = target.value;
  if (!t || !stat.value) return;
  const clamped = Math.max(0, Math.min(Math.round(raw), maxInvestable.value));
  build.setStatInvested(t.cardId, stat.value, clamped);
}

function onInput(): void {
  const n = Number(draft.value);
  if (!Number.isFinite(n)) return;
  commitInvested(n);
}
function onBlur(): void { draft.value = String(investment.value.invested); }

function increment(): void { commitInvested(investment.value.invested + 1); }
function decrement(): void { commitInvested(investment.value.invested - 1); }
function setMax(): void { commitInvested(maxInvestable.value); }
function setZero(): void { commitInvested(0); }
function toggleScroll(): void {
  const t = target.value;
  if (!t || !stat.value) return;
  build.setStatScrolled(t.cardId, stat.value, !investment.value.scrolled);
}

function close(): void { ui.closeStatModal(); }

// Outside-click closes — but ignore the original stat cell so re-clicking it doesn't
// instantly reopen via the panel's @click handler.
onClickOutside(popoverRef, (e) => {
  if (!open.value) return;
  const t = e.target as HTMLElement | null;
  if (t && t.closest('[data-stat-trigger]')) return;
  close();
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (open.value && e.key === 'Escape') close();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <aside
        v-if="open && stat"
        ref="popoverRef"
        class="fixed z-[55] rounded-lg border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.55),0_0_0_1px_rgba(93,207,224,0.10)] overflow-hidden flex flex-col"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: POP_W + 'px',
          background: 'rgba(8,8,8,0.92)',
        }"
        role="dialog"
        @click.stop
      >
        <header class="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
          <span class="font-sans font-bold text-[10px] text-[#8AE0EE] tracking-[0.06em] uppercase">{{ STAT_LABEL[stat] }}</span>
          <button
            type="button"
            class="w-5 h-5 inline-flex items-center justify-center rounded-full text-text-faint hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
            aria-label="Fermer"
            @click="close"
          >
            <svg viewBox="0 0 24 24" class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div class="px-3 py-3 flex flex-col gap-2.5">
          <!-- Single-row controls: 0 / − / input / + / MAX -->
          <div class="flex items-stretch gap-1">
            <button
              type="button"
              class="px-2 inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] font-sans font-bold text-[9px] uppercase tracking-[0.06em] text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30 transition-colors disabled:opacity-30"
              :disabled="investment.invested <= 0"
              aria-label="Tout prendre"
              @click="setZero"
            >Min</button>
            <button
              type="button"
              class="w-7 inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-text-default hover:bg-[#8AE0EE]/[0.10] hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] transition-colors disabled:opacity-30"
              :disabled="investment.invested <= 0"
              aria-label="Retirer"
              @click="decrement"
            >−</button>
            <input
              ref="inputRef"
              v-model="draft"
              type="text"
              inputmode="numeric"
              class="flex-1 min-w-0 text-center bg-white/[0.06] border border-white/15 rounded-md px-1 py-1 font-mono text-sm text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
              @input="onInput"
              @blur="onBlur"
              @keydown.enter.prevent="onBlur"
            />
            <button
              type="button"
              class="w-7 inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-text-default hover:bg-[#8AE0EE]/[0.10] hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] transition-colors disabled:opacity-30"
              :disabled="investment.invested >= maxInvestable"
              aria-label="Ajouter"
              @click="increment"
            >+</button>
            <button
              type="button"
              class="px-2 inline-flex items-center justify-center rounded-md border border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.12] font-sans font-bold text-[9px] uppercase tracking-[0.06em] text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.20] transition-colors disabled:opacity-40"
              :disabled="investment.invested >= maxInvestable"
              aria-label="Tout mettre"
              @click="setMax"
            >Max</button>
          </div>

          <!-- Scroll toggle (one-line, compact) -->
          <button
            type="button"
            role="switch"
            :aria-checked="investment.scrolled"
            class="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border transition-colors"
            :class="investment.scrolled
              ? 'border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.08]'
              : 'border-white/15 bg-white/[0.02] hover:border-[#8AE0EE]/40'"
            @click="toggleScroll"
          >
            <span class="font-sans font-bold text-[9px] uppercase tracking-[0.06em]"
              :class="investment.scrolled ? 'text-[#8AE0EE]' : 'text-text-dim'"
            >Parcho 100</span>
            <span
              class="relative inline-flex items-center h-3.5 w-7 rounded-full border transition-colors shrink-0"
              :class="investment.scrolled ? 'bg-[#5DCFE0] border-[#5DCFE0]' : 'bg-white/[0.04] border-white/15'"
            >
              <span
                class="absolute top-[1px] w-[10px] h-[10px] rounded-full transition-all"
                :class="investment.scrolled ? 'left-[14px] bg-[#0A2530]' : 'left-[1px] bg-white/60'"
              />
            </span>
          </button>

          <p class="font-sans text-[10px] text-text-dim leading-tight">
            Points restants :
            <span
              class="font-mono"
              :class="remainingBudget < 0 ? 'text-danger-soft' : 'text-white'"
            >{{ remainingBudget }}</span>
          </p>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pop-enter-active, .pop-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
.pop-enter-from, .pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
