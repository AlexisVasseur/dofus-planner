<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { ROOM_ORDER, NPC_ORDER, ROOM_NPCS, NPC_LABEL, type RoomId } from '@/types/rooms';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const list = useShoppingList();

const activeRoom = ref<RoomId>('1-50');

// Auto-shift active tab to first non-empty room when current selection becomes empty.
watchEffect(() => {
  const t = list.value.totals.perRoom;
  if (t[activeRoom.value] > 0) return;
  for (const r of ROOM_ORDER) {
    if (t[r] > 0) { activeRoom.value = r; return; }
  }
  activeRoom.value = '1-50';
});

const hasAnything = computed(() => list.value.totals.items > 0);

const orderedNpcsForActiveRoom = computed(() => {
  const npcs = ROOM_NPCS[activeRoom.value];
  const cell = list.value.rooms[activeRoom.value];
  return NPC_ORDER.filter((n) => npcs.includes(n) && (cell[n]?.length ?? 0) > 0);
});

// Sliding pill behind the active tab. Same pattern as the topbar mode-toggle.
const ROOM_COUNT = ROOM_ORDER.length;
const activeRoomIdx = computed(() => ROOM_ORDER.indexOf(activeRoom.value));
const tabPillStyle = computed(() => ({
  left: `calc(0.25rem + (100% - 0.5rem) / ${ROOM_COUNT} * ${activeRoomIdx.value})`,
  width: `calc((100% - 0.5rem) / ${ROOM_COUNT})`,
}));

function pickRoom(room: RoomId): void {
  if (list.value.totals.perRoom[room] === 0) return;
  activeRoom.value = room;
}

function backToBuild(): void {
  ui.setViewMode('build');
}

// Click-to-copy: clipboard write + brief visual feedback (✓ + accent color).
const copiedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
async function copyItem(name: string, key: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(name);
    } else {
      const ta = document.createElement('textarea');
      ta.value = name;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copiedKey.value = key;
    if (copyTimer !== null) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copiedKey.value = null; copyTimer = null; }, 1200);
  } catch {
    /* silent — user can re-click */
  }
}
</script>

<template>
  <section class="purchase-planner flex-1 overflow-y-auto relative z-[1] no-scrollbar">
    <!-- Empty global state -->
    <div v-if="!hasAnything" class="h-full flex flex-col items-center justify-center gap-4 text-center px-6">
      <p class="font-sans font-semibold text-[13px] text-text-muted tracking-[0.06em] uppercase max-w-md">
        Ajoute des items à ta timeline pour générer la liste de courses
      </p>
      <button
        type="button"
        class="bg-[#5DCFE0] text-[#0A2530] border border-[#5DCFE0] rounded-md px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.06em] hover:bg-[#8AE0EE] transition-colors"
        @click="backToBuild"
      >← Retour à Builder</button>
    </div>

    <template v-else>
      <!-- Pill tabs (room selection) — same animation pattern as the topbar mode-toggle -->
      <nav
        class="mx-4 mt-3 sticky top-3 z-10 relative grid items-center bg-white/[0.04] border border-white/10 rounded-md p-1 h-9"
        :style="`grid-template-columns: repeat(${ROOM_COUNT}, 1fr);`"
      >
        <div
          class="tab-pill absolute top-1 bottom-1 z-0 rounded bg-[#5DCFE0] transition-[left,width] duration-300 ease-out"
          :style="tabPillStyle"
        />
        <button
          v-for="room in ROOM_ORDER"
          :key="room"
          type="button"
          :disabled="list.totals.perRoom[room] === 0"
          class="h-7 relative z-10 inline-flex items-center justify-center gap-1.5 font-sans font-bold text-[11px] tracking-[0.06em] uppercase rounded transition-colors duration-300"
          :class="[
            activeRoom === room
              ? 'text-[#0A2530]'
              : 'text-text-muted hover:text-[#8AE0EE]',
            list.totals.perRoom[room] === 0 && '!text-text-faint opacity-40 cursor-not-allowed',
          ]"
          @click="pickRoom(room)"
        >
          <span>{{ room }}</span>
          <span class="text-[10px] font-mono opacity-70">{{ list.totals.perRoom[room] }}</span>
        </button>
      </nav>

      <!-- Flat table: NPC label | wrapped item names. Click-to-copy on each name.
           Wrapper mirrors the header / minimap floating-panel treatment. -->
      <div
        class="mx-4 mt-3 mb-3 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-5 py-3"
        style="background: rgba(8,8,8,0.55);"
      >
        <div
          v-for="(npc, idx) in orderedNpcsForActiveRoom"
          :key="npc"
          class="grid gap-x-6 py-3"
          :class="idx > 0 && 'border-t border-border-subtle'"
          style="grid-template-columns: 120px 1fr;"
        >
          <div class="font-sans font-bold text-[11px] text-text-muted tracking-[0.08em] uppercase pt-0.5">
            {{ NPC_LABEL[npc] }}
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <button
              v-for="item in list.rooms[activeRoom][npc]!"
              :key="item.id"
              type="button"
              data-testid="item-name"
              class="text-left text-[13px] font-sans text-text-default hover:text-[#8AE0EE] transition-colors cursor-pointer"
              :class="copiedKey === `${npc}-${item.id}` && '!text-[#5DCFE0]'"
              :title="copiedKey === `${npc}-${item.id}` ? 'Copié !' : 'Cliquer pour copier'"
              @click="copyItem(item.name, `${npc}-${item.id}`)"
            >{{ copiedKey === `${npc}-${item.id}` ? '✓ ' : '' }}{{ item.name }}</button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
