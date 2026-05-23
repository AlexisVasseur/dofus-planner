<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useEventListener, onClickOutside } from '@vueuse/core';
import type { ExoKey } from '@/stores/build';

const props = defineProps<{
  open: boolean;
  triggerEl: HTMLElement | null;
  allParchotted: boolean;
  allExo: Record<ExoKey, boolean>;
}>();

const emit = defineEmits<{
  close: [];
  'toggle-parcho': [value: boolean];
  'toggle-exo': [key: ExoKey, value: boolean];
}>();

const popoverRef = ref<HTMLElement | null>(null);

const WIDTH = 260;
const HEIGHT_ESTIMATE = 200;
const GAP = 8;
const MARGIN = 12;

interface Position { top: number; left: number; }
const position = ref<Position>({ top: 0, left: 0 });

function recompute(): void {
  const el = props.triggerEl;
  if (!el) return;
  const r = el.getBoundingClientRect();
  // Open ABOVE the trigger by default (minimap sits at the bottom of the page).
  let top = r.top - GAP - HEIGHT_ESTIMATE;
  if (top < MARGIN) top = r.bottom + GAP; // fall back below if no room above
  const left = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, r.left));
  position.value = { top, left };
}

watch(() => props.open, async (v) => {
  if (!v) return;
  await nextTick();
  recompute();
});

useEventListener(window, 'resize', () => { if (props.open) recompute(); });
useEventListener(window, 'scroll', () => { if (props.open) recompute(); }, { passive: true, capture: true });

onClickOutside(popoverRef, (e) => {
  if (!props.open) return;
  const t = e.target as HTMLElement | null;
  if (props.triggerEl && t && (t === props.triggerEl || props.triggerEl.contains(t))) return;
  emit('close');
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') emit('close');
});

const rows: { key: 'parcho' | ExoKey; label: string; subtitle: string }[] = [
  { key: 'parcho', label: 'Parcho 100 partout',  subtitle: 'Active le scroll +100 sur chaque stat' },
  { key: 'pa',     label: 'Exo PA partout',      subtitle: '+1 PA sur chaque card' },
  { key: 'pm',     label: 'Exo PM partout',      subtitle: '+1 PM sur chaque card' },
  { key: 'po',     label: 'Exo PO partout',      subtitle: '+1 PO sur chaque card' },
];

function isOn(key: 'parcho' | ExoKey): boolean {
  if (key === 'parcho') return props.allParchotted;
  return props.allExo[key];
}

function onToggle(key: 'parcho' | ExoKey): void {
  const next = !isOn(key);
  if (key === 'parcho') emit('toggle-parcho', next);
  else emit('toggle-exo', key, next);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <aside
        v-if="open"
        ref="popoverRef"
        class="fixed z-[55] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: WIDTH + 'px',
          background: 'rgba(8,8,8,0.92)',
        }"
        role="dialog"
        @click.stop
      >
        <header class="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] text-[#8AE0EE]">Actions globales</span>
          <button
            type="button"
            class="w-5 h-5 inline-flex items-center justify-center rounded-full text-text-faint hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
            aria-label="Fermer"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div class="flex flex-col py-1">
          <button
            v-for="row in rows"
            :key="row.key"
            type="button"
            role="switch"
            :aria-checked="isOn(row.key)"
            class="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#5DCFE0]/[0.06] transition-colors text-left"
            @click="onToggle(row.key)"
          >
            <span class="flex flex-col min-w-0">
              <span class="font-sans font-bold text-[10px] uppercase tracking-[0.06em]"
                :class="isOn(row.key) ? 'text-[#8AE0EE]' : 'text-text-dim'"
              >{{ row.label }}</span>
              <span class="font-sans text-[10px] text-text-faint truncate">{{ row.subtitle }}</span>
            </span>
            <span
              class="relative inline-flex items-center h-4 w-7 rounded-full border transition-colors shrink-0"
              :class="isOn(row.key) ? 'bg-[#5DCFE0] border-[#5DCFE0]' : 'bg-white/[0.04] border-white/15'"
            >
              <span
                class="absolute top-[1px] w-[12px] h-[12px] rounded-full transition-all"
                :class="isOn(row.key) ? 'left-[14px] bg-[#0A2530]' : 'left-[1px] bg-white/60'"
              />
            </span>
          </button>
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
  transform: translateY(4px);
}
</style>
