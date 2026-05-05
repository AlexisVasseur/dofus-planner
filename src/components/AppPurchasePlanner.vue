<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { ROOM_ORDER, NPC_ORDER, ROOM_NPCS, type RoomId } from '@/types/rooms';
import { useUiStore } from '@/stores/ui';
import NpcCard from './NpcCard.vue';

const ui = useUiStore();
const list = useShoppingList();

const activeRoom = ref<RoomId>('1-50');

// On mount / when totals change, default the active tab to the first non-empty room.
// We only auto-shift away from an empty selection — we don't override a deliberate
// click on a non-empty room.
watchEffect(() => {
  const t = list.value.totals.perRoom;
  if (t[activeRoom.value] > 0) return;
  for (const r of ROOM_ORDER) {
    if (t[r] > 0) { activeRoom.value = r; return; }
  }
  // All empty — keep '1-50' as the visible (empty) selection.
  activeRoom.value = '1-50';
});

const hasAnything = computed(() => list.value.totals.items > 0);

const orderedNpcsForActiveRoom = computed(() => {
  const npcs = ROOM_NPCS[activeRoom.value];
  const cell = list.value.rooms[activeRoom.value];
  return NPC_ORDER.filter((n) => npcs.includes(n) && (cell[n]?.length ?? 0) > 0);
});

function pickRoom(room: RoomId): void {
  if (list.value.totals.perRoom[room] === 0) return;
  activeRoom.value = room;
}

function backToBuild(): void {
  ui.setViewMode('build');
}
</script>

<template>
  <section class="purchase-planner flex-1 overflow-y-auto relative z-[1]">
    <!-- Empty global state -->
    <div v-if="!hasAnything" class="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
      <p class="font-display text-[14px] text-text-muted tracking-[0.2em] uppercase max-w-md">
        Ajoute des items à ta timeline pour générer la liste de courses
      </p>
      <button
        type="button"
        class="bg-white text-[#0a0a0a] border border-white rounded-md px-4 py-2 font-sans text-[12px] font-semibold hover:brightness-95"
        @click="backToBuild"
      >← Retour à Build</button>
    </div>

    <template v-else>
      <!-- Header strip -->
      <header class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <h1 class="font-display text-[18px] text-text-default tracking-[0.2em] uppercase">
          Planificateur d'achat
        </h1>
        <span class="font-mono text-[11px] text-text-dim">
          {{ list.totals.items }} items · {{ list.totals.activeRooms }} salle{{ list.totals.activeRooms > 1 ? 's' : '' }} active{{ list.totals.activeRooms > 1 ? 's' : '' }}
        </span>
      </header>

      <!-- Room tabs -->
      <nav class="flex gap-1 px-6 pt-3 border-b border-border-subtle bg-bg-page sticky top-0 z-10">
        <button
          v-for="room in ROOM_ORDER"
          :key="room"
          type="button"
          :disabled="list.totals.perRoom[room] === 0"
          class="px-4 py-2.5 font-display text-[13px] tracking-[0.18em] uppercase rounded-t-md flex items-center gap-2 transition-colors"
          :class="[
            activeRoom === room
              ? 'bg-bg-surface text-text-default border-b-2 border-white/80 -mb-[1px]'
              : 'text-text-faint hover:text-text-default',
            list.totals.perRoom[room] === 0 && 'opacity-40 cursor-not-allowed hover:text-text-faint',
          ]"
          @click="pickRoom(room)"
        >
          <span>{{ room }}</span>
          <span class="text-[10px] font-mono">({{ list.totals.perRoom[room] }})</span>
        </button>
      </nav>

      <!-- Active room content -->
      <div class="grid gap-4 p-6" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
        <NpcCard
          v-for="npc in orderedNpcsForActiveRoom"
          :key="npc"
          :npc-id="npc"
          :items="list.rooms[activeRoom][npc]!"
        />
      </div>
    </template>
  </section>
</template>
