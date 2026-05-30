<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useShoppingList } from '@/composables/useShoppingList';
import { ROOM_ORDER, NPC_ORDER, ROOM_NPCS, NPC_LABEL, ROOM_LABEL, levelToRoom, type RoomId, type NpcId } from '@/types/rooms';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import CustomImportModal from './CustomImportModal.vue';

const ui = useUiStore();
const build = useBuildStore();
const list = useShoppingList();
const customModalOpen = ref(false);

const hasAnything = computed(() => list.value.totals.items > 0 || list.value.unknown.length > 0);

// Show every room (even empty) so users always see the full structure.
const visibleRooms = computed(() => [...ROOM_ORDER]);

// All NPCs configured for the room (regardless of whether there are items in them yet).
function npcsForRoom(room: RoomId): NpcId[] {
  const npcs = ROOM_NPCS[room];
  return NPC_ORDER.filter((n) => npcs.includes(n));
}

function itemsForCell(room: RoomId, npc: NpcId) {
  return list.value.rooms[room][npc] ?? [];
}

// Refs to each room <section>, keyed by RoomId, used to scroll-jump when the
// active card changes (driven by the timeline minimap).
const roomSectionRefs = ref<Partial<Record<RoomId, HTMLElement | null>>>({});
function setRoomSection(room: RoomId, el: HTMLElement | null): void {
  roomSectionRefs.value[room] = el;
}

// The active room derives from the active card's level — no local nav state.
const activeCard = computed(() => build.cards.find((c) => c.id === ui.activeCardId) ?? null);
const activeRoom = computed<RoomId | null>(() => {
  const lvl = activeCard.value?.level;
  return lvl !== null && lvl !== undefined ? levelToRoom(lvl) : null;
});

watch(activeRoom, async (room) => {
  if (room === null) return;
  await nextTick();
  const el = roomSectionRefs.value[room];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, { immediate: true });

// Explicit "scroll to Hub" trigger from the minimap. The Hub has no card-level mapping,
// so the activeRoom-driven scroll above never targets it; this watcher handles the case.
watch(() => ui.purchaseScrollTick, async () => {
  const room = ui.purchaseScrollRoom as RoomId | null;
  if (!room) return;
  await nextTick();
  const el = roomSectionRefs.value[room];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

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
      <button
        type="button"
        data-testid="open-custom-import"
        class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-full border border-[#5DCFE0]/40 text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
        @click="customModalOpen = true"
      >Import custom</button>
    </div>

    <template v-else>
      <!-- All rooms stacked vertically (even empty ones, with a centered placeholder).
           Each room is its own floating panel; the bottom timeline minimap drives
           which room is in view by setting ui.activeCardId. -->
      <div class="flex flex-col gap-6 pt-6 pb-12">
        <!-- Global total: quantity-aware (sums the ×N badges), pinned above the rooms. -->
        <div class="mx-4 flex items-center justify-center gap-3">
          <span class="inline-flex items-center gap-2 rounded-full border border-[#5DCFE0]/40 bg-[#5DCFE0]/[0.08] px-4 py-1.5">
            <span class="font-mono font-extrabold text-[15px] text-[#8AE0EE] tabular-nums">{{ list.totals.units }}</span>
            <span class="font-sans font-bold text-[11px] text-text-muted tracking-[0.08em] uppercase">
              {{ list.totals.units > 1 ? 'items à acheter' : 'item à acheter' }}
            </span>
          </span>
          <button
            type="button"
            data-testid="open-custom-import"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-full border border-[#5DCFE0]/40 text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
            @click="customModalOpen = true"
          >Import custom</button>
        </div>
        <div
          v-for="room in visibleRooms"
          :key="room"
          :ref="(el) => setRoomSection(room, el as HTMLElement | null)"
          class="mx-4 rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-5 py-4 scroll-mt-16"
          style="background: rgba(8,8,8,0.2);"
        >
          <header class="mb-3 flex items-baseline gap-2">
            <h2 class="font-sans font-bold text-[12px] text-[#8AE0EE] tracking-[0.1em] uppercase">
              {{ ROOM_LABEL[room] }}
            </h2>
            <span
              v-if="list.totals.unitsPerRoom[room] > 0"
              class="font-mono font-bold text-[12px] text-text-muted tabular-nums"
            >· {{ list.totals.unitsPerRoom[room] }}</span>
          </header>

          <p
            v-if="list.totals.perRoom[room] === 0"
            class="text-center font-sans font-semibold text-[12px] text-text-faint tracking-[0.06em] uppercase py-8"
          >Aucun item</p>

          <div
            v-else
            class="grid gap-x-6 gap-y-5"
            style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
          >
            <section v-for="npc in npcsForRoom(room)" :key="`${room}-${npc}`" class="min-w-0 flex flex-col min-h-[8rem]">
              <h3 class="font-sans font-bold text-[11px] text-text-muted tracking-[0.08em] uppercase mb-2 pb-1.5 border-b border-border-subtle">
                {{ NPC_LABEL[npc] }}
              </h3>
              <p
                v-if="itemsForCell(room, npc).length === 0"
                class="flex-1 flex items-center justify-center text-[12px] font-sans text-text-faint italic"
              >Aucun item</p>
              <ul v-else class="flex flex-col gap-1.5">
                <li v-for="item in itemsForCell(room, npc)" :key="item.id" class="relative min-w-0">
                  <button
                    type="button"
                    data-testid="item-name"
                    class="flex items-center gap-2 w-full text-left text-[13px] font-sans text-text-default bg-white/[0.04] border border-white/[0.08] rounded-md pl-2 py-1.5 hover:bg-[#8AE0EE]/[0.08] hover:border-[#8AE0EE]/30 hover:text-[#8AE0EE] transition-colors cursor-pointer overflow-hidden"
                    :class="copiedKey === `${room}-${npc}-${item.id}` && '!bg-[#5DCFE0]/[0.12] !border-[#5DCFE0]/40 !text-[#5DCFE0]'"
                    :title="`Cliquer pour copier — ${item.name}`"
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
                    <span class="truncate min-w-0 flex-1 pr-2">{{ item.name }}</span>
                    <span
                      v-if="list.customItemIds.has(item.id)"
                      data-testid="custom-badge"
                      class="flex-shrink-0 mr-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-[0.06em] bg-[#5DCFE0]/[0.18] text-[#8AE0EE] border border-[#5DCFE0]/40"
                    >custom</span>
                    <!-- Quantity badge: only shown when the item is needed more than once
                         in a single card (e.g. Silimelle as anneau1 + anneau2). -->
                    <span
                      v-if="(list.counts[item.id] ?? 1) > 1"
                      class="flex-shrink-0 self-stretch -my-1.5 -mr-px px-3 min-w-[40px] inline-flex items-center justify-center font-mono font-extrabold text-[15px] text-text-default border-l border-black/40"
                      style="background: rgba(0,0,0,0.45);"
                    >×{{ list.counts[item.id] }}</span>
                  </button>
                  <Transition name="copied">
                    <span
                      v-if="copiedKey === `${room}-${npc}-${item.id}`"
                      class="copied-tooltip absolute left-7 top-full mt-1 z-20 px-2 py-0.5 rounded bg-[#5DCFE0] text-[#0A2530] text-[10px] font-bold uppercase tracking-[0.05em] whitespace-nowrap shadow-md pointer-events-none"
                    >Item copié</span>
                  </Transition>
                </li>
              </ul>
            </section>
          </div>
        </div>
        <div
          v-if="list.unknown.length > 0"
          class="mx-4 rounded-xl border border-danger/40 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-5 py-4"
          style="background: rgba(8,8,8,0.2);"
        >
          <header class="mb-3">
            <h2 class="font-sans font-bold text-[12px] text-danger-soft tracking-[0.1em] uppercase">Inconnu</h2>
          </header>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="(name, i) in list.unknown"
              :key="`unknown-${i}`"
              class="text-[13px] font-sans text-text-default bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5"
            >{{ name }}</li>
          </ul>
        </div>
      </div>
    </template>
    <CustomImportModal :open="customModalOpen" @close="customModalOpen = false" />
  </section>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }

.copied-enter-active, .copied-leave-active {
  transition: opacity 120ms ease-out, transform 120ms ease-out;
}
.copied-enter-from, .copied-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
