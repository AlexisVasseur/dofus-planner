<script setup lang="ts">
import { ref, computed, watchEffect, nextTick } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { ROOM_ORDER, NPC_ORDER, ROOM_NPCS, NPC_LABEL, type RoomId, type NpcId } from '@/types/rooms';
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

const visibleRooms = computed(() =>
  ROOM_ORDER.filter((r) => list.value.totals.perRoom[r] > 0),
);

function npcsForRoom(room: RoomId): NpcId[] {
  const npcs = ROOM_NPCS[room];
  const cell = list.value.rooms[room];
  return NPC_ORDER.filter((n) => npcs.includes(n) && (cell[n]?.length ?? 0) > 0);
}

// Sliding pill behind the active tab. Same pattern as the topbar mode-toggle.
const ROOM_COUNT = ROOM_ORDER.length;
const activeRoomIdx = computed(() => ROOM_ORDER.indexOf(activeRoom.value));
const tabPillStyle = computed(() => ({
  left: `calc(0.25rem + (100% - 0.5rem) / ${ROOM_COUNT} * ${activeRoomIdx.value})`,
  width: `calc((100% - 0.5rem) / ${ROOM_COUNT})`,
}));

// Refs to each room <section>, keyed by RoomId, used for scroll-into-view on tab click.
const roomSectionRefs = ref<Partial<Record<RoomId, HTMLElement | null>>>({});
function setRoomSection(room: RoomId, el: HTMLElement | null): void {
  roomSectionRefs.value[room] = el;
}

async function pickRoom(room: RoomId): Promise<void> {
  if (list.value.totals.perRoom[room] === 0) return;
  activeRoom.value = room;
  await nextTick();
  const el = roomSectionRefs.value[room];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      <!-- All rooms stacked vertically. Each room is its own floating panel with the
           previous NPC-as-columns layout. Pill tabs above scroll-jump to a room. -->
      <div class="flex flex-col gap-3">
        <div
          v-for="room in visibleRooms"
          :key="room"
          :ref="(el) => setRoomSection(room, el as HTMLElement | null)"
          class="mx-4 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-5 py-4 grid gap-x-6 gap-y-5 scroll-mt-16"
          style="background: rgba(8,8,8,0.55); grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
        >
          <header class="col-span-full flex items-baseline gap-3 -mb-2">
            <h2 class="font-sans font-bold text-[12px] text-[#8AE0EE] tracking-[0.1em] uppercase">
              Salle {{ room }}
            </h2>
            <span class="font-mono text-[10px] text-text-faint">
              {{ list.totals.perRoom[room] }} item{{ list.totals.perRoom[room] > 1 ? 's' : '' }}
            </span>
          </header>
          <section v-for="npc in npcsForRoom(room)" :key="`${room}-${npc}`" class="min-w-0">
            <h3 class="font-sans font-bold text-[11px] text-text-muted tracking-[0.08em] uppercase mb-2 pb-1.5 border-b border-border-subtle">
              {{ NPC_LABEL[npc] }}
            </h3>
            <ul class="flex flex-col gap-1">
              <li v-for="item in list.rooms[room][npc]!" :key="item.id" class="min-w-0">
                <button
                  type="button"
                  data-testid="item-name"
                  class="flex items-center gap-2 w-full text-left text-[13px] font-sans text-text-default hover:text-[#8AE0EE] transition-colors cursor-pointer"
                  :class="copiedKey === `${room}-${npc}-${item.id}` && '!text-[#5DCFE0]'"
                  :title="copiedKey === `${room}-${npc}-${item.id}` ? `Copié ! (${item.name})` : `Cliquer pour copier — ${item.name}`"
                  @click="copyItem(item.name, `${room}-${npc}-${item.id}`)"
                >
                  <img
                    v-if="item.iconUrl"
                    :src="item.iconUrl"
                    alt=""
                    class="w-5 h-5 flex-shrink-0 rounded-sm"
                    loading="lazy"
                  />
                  <span v-else class="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span class="truncate min-w-0 flex-1">{{ copiedKey === `${room}-${npc}-${item.id}` ? '✓ ' : '' }}{{ item.name }}</span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
