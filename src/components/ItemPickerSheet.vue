<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useItemSearch, isOverLeveled, type SearchTarget } from '@/composables/useItemCatalog';
import { SLOT_LABEL } from '@/types/slots';

const ui = useUiStore();
const build = useBuildStore();

const target = computed(() => ui.itemPickerTarget);

// Resolve the search target for DofusDB:
// - slot picker: query the slot's typeIds (typeId filtering server-side)
// - dofus picker: use the special 'dofus' target to query Dofus + Trophée typeIds
const slotForQuery = computed<SearchTarget>(() => {
  if (!target.value) return null;
  if (target.value.kind === 'slot') return target.value.slot;
  return 'dofus';
});
const search = ref('');

const filterMode = ref<'all' | 'eligible' | 'over'>('all');
const sortMode = ref<'level' | 'name'>('level');

const card = computed(() => target.value
  ? build.cards.find((c) => c.id === target.value!.cardId) ?? null
  : null,
);

const slotForFilter = ref<SearchTarget>(null);
watch(slotForQuery, (v) => { slotForFilter.value = v; }, { immediate: true });

watch(target, (newTarget, oldTarget) => {
  if (newTarget === null) return; // closing — leave search alone
  // Reset on first open or whenever the target points to a different slot/dofus
  if (
    !oldTarget
    || oldTarget.kind !== newTarget.kind
    || oldTarget.cardId !== newTarget.cardId
    || (newTarget.kind === 'slot' && oldTarget.kind === 'slot' && oldTarget.slot !== newTarget.slot)
    || (newTarget.kind === 'dofus' && oldTarget.kind === 'dofus' && oldTarget.index !== newTarget.index)
  ) {
    search.value = '';
  }
});

const { results, loading, error } = useItemSearch(slotForFilter, search);

const filtered = computed(() => {
  let arr = results.value.slice();
  const cardLvl = card.value?.level ?? null;
  if (filterMode.value === 'eligible' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired <= cardLvl);
  } else if (filterMode.value === 'over' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired > cardLvl);
  }
  arr.sort((a, b) => sortMode.value === 'level'
    ? a.levelRequired - b.levelRequired
    : a.name.localeCompare(b.name));
  return arr;
});

const sheetTitle = computed(() => {
  if (!target.value) return '';
  if (target.value.kind === 'slot') return `Choisir une ${SLOT_LABEL[target.value.slot].toLowerCase()}`;
  return `Choisir un dofus / trophée`;
});

function pick(itemId: number) {
  if (!target.value) return;
  if (target.value.kind === 'slot') {
    build.setSlot(target.value.cardId, target.value.slot, { itemId });
  } else {
    build.setDofus(target.value.cardId, target.value.index, { itemId });
  }
  ui.closeItemPicker();
}

function close() { ui.closeItemPicker(); }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.itemPickerTarget) close();
});
</script>

<template>
  <Transition name="sheet">
    <aside
      v-if="target"
      class="sheet fixed top-0 right-0 bottom-0 w-[540px] border-l border-[#5DCFE0]/30 backdrop-blur-md shadow-[-24px_0_48px_rgba(0,0,0,0.55)] flex flex-col z-50"
      style="background: rgba(8,8,8,0.85);"
    >
      <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <h2 class="font-sans font-bold text-[12px] text-[#8AE0EE] tracking-[0.06em] uppercase">{{ sheetTitle }}</h2>
        <button
          @click="close"
          class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5 hover:border-[#8AE0EE]/40 hover:text-[#8AE0EE] transition-colors"
        >esc</button>
      </header>
      <div class="px-5 py-3 border-b border-border-subtle">
        <input
          v-model="search"
          placeholder="Rechercher…"
          class="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
          autofocus
        />
      </div>
      <div class="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border-subtle">
        <button
          v-for="opt in [
            { mode: 'all',      label: 'Tous' },
            { mode: 'eligible', label: '≤ Lv ' + (card?.level ?? '?') },
            { mode: 'over',     label: 'Au-dessus' },
          ]"
          :key="opt.mode"
          class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
          :class="filterMode === opt.mode
            ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
            : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
          @click="filterMode = opt.mode as 'all' | 'eligible' | 'over'"
        >{{ opt.label }}</button>
        <span class="w-px self-stretch bg-border-subtle mx-1" aria-hidden="true" />
        <button
          v-for="opt in [
            { mode: 'level', label: 'Trier · niveau' },
            { mode: 'name',  label: 'Trier · nom' },
          ]"
          :key="opt.mode"
          class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border transition-colors"
          :class="sortMode === opt.mode
            ? 'bg-[#5DCFE0]/[0.12] text-[#8AE0EE] border-[#5DCFE0]/40'
            : 'bg-white/[0.02] border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30'"
          @click="sortMode = opt.mode as 'level' | 'name'"
        >{{ opt.label }}</button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 py-1.5">
        <p v-if="loading" class="text-text-dim text-xs px-3 py-4">Chargement…</p>
        <p v-else-if="error" class="text-danger-soft text-xs px-3 py-4">Erreur : {{ error }}</p>
        <p v-else-if="filtered.length === 0" class="text-text-dim text-xs px-3 py-4">Aucun item.</p>
        <button
          v-for="it in filtered"
          :key="it.id"
          type="button"
          class="item flex items-center gap-3 px-3 py-2.5 rounded-md w-full transition-colors hover:bg-[#8AE0EE]/[0.06]"
          :class="{
            'bg-[#5DCFE0]/[0.10] shadow-[inset_0_0_0_1px_rgba(93,207,224,0.5)]':
              target?.kind === 'slot'
                ? card?.slots[target.slot]?.itemId === it.id
                : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
          }"
          @click="pick(it.id)"
        >
          <div
            class="it-ic w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'bg-[#2a1414] border border-danger text-danger-soft shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
              : 'bg-bg-slot-filled border border-border-slot-filled text-text-muted'"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" class="w-6 h-6" />
            <span v-else>○</span>
          </div>
          <div class="it-info flex-1 min-w-0 text-left">
            <div class="text-text-default text-xs font-medium truncate">{{ it.name }}</div>
            <div class="text-text-faint text-[10px] font-mono truncate" v-if="it.stats.length">{{ it.stats.join(' · ') }}</div>
          </div>
          <span
            class="text-[10px] font-mono rounded px-2 py-0.5 border"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'text-danger-soft border-danger/40 bg-danger/10'
              : 'text-text-dim border-border-default bg-bg-page'"
          >lv {{ it.levelRequired }}</span>
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { transform: translateX(40px); opacity: 0; }
</style>
