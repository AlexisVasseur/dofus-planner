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
      class="sheet fixed top-0 right-0 bottom-0 w-[540px] bg-bg-surface border-l border-border-default shadow-[-24px_0_48px_rgba(0,0,0,0.5)] flex flex-col z-50"
    >
      <header class="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
        <h2 class="font-display text-[11px] tracking-[0.2em] uppercase text-accent font-semibold">{{ sheetTitle }}</h2>
        <button @click="close" class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5">esc</button>
      </header>
      <div class="px-5 py-3 border-b border-border-subtle">
        <input
          v-model="search"
          placeholder="Rechercher…"
          class="w-full bg-bg-page border border-border-default rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-accent"
          autofocus
        />
      </div>
      <div class="flex flex-wrap gap-1.5 px-5 pb-2.5 border-b border-border-subtle">
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'all' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'all'"
        >Tous</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'eligible' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'eligible'"
        >≤ Lv {{ card?.level ?? '?' }}</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'over' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'over'"
        >Au-dessus</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="sortMode === 'level' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="sortMode = 'level'"
        >Trier · niveau</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="sortMode === 'name' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="sortMode = 'name'"
        >Trier · nom</button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 py-1.5">
        <p v-if="loading" class="text-text-dim text-xs px-3 py-4">Chargement…</p>
        <p v-else-if="error" class="text-danger-soft text-xs px-3 py-4">Erreur : {{ error }}</p>
        <p v-else-if="filtered.length === 0" class="text-text-dim text-xs px-3 py-4">Aucun item.</p>
        <button
          v-for="it in filtered"
          :key="it.id"
          type="button"
          class="item flex items-center gap-3 px-3 py-2.5 rounded-md w-full hover:bg-bg-elev"
          :class="{
            'bg-accent/[0.06] shadow-[inset_0_0_0_1px_rgba(91,211,168,0.4)]':
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
