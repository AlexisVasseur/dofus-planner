<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useCustomShoppingStore, type CustomEntry } from '@/stores/customShopping';
import { parseCustomLines, resolveCustomNames } from '@/composables/useCustomShopping';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = useCustomShoppingStore();
const toast = useToast();

const text = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
// Cached analysis keyed by the exact textarea content, so Importer right after
// Analyser (unchanged text) reuses it instead of re-fetching.
const analysis = ref<{ text: string; entries: CustomEntry[] } | null>(null);

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  text.value = store.entries.map((e) => e.name).join('\n');
  error.value = null;
  analysis.value = null;
});

const validCount = computed(() => analysis.value?.entries.filter((e) => e.itemId !== null).length ?? 0);
const invalidNames = computed(() => analysis.value?.entries.filter((e) => e.itemId === null).map((e) => e.name) ?? []);

async function resolve(): Promise<CustomEntry[] | null> {
  busy.value = true;
  error.value = null;
  try {
    const entries = await resolveCustomNames(parseCustomLines(text.value));
    analysis.value = { text: text.value, entries };
    return entries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return null;
  } finally {
    busy.value = false;
  }
}

async function onAnalyser(): Promise<void> { await resolve(); }

async function onImporter(): Promise<void> {
  const entries = analysis.value?.text === text.value ? analysis.value.entries : await resolve();
  if (!entries) return;
  store.setEntries(entries);
  const valid = entries.filter((e) => e.itemId !== null).length;
  const invalid = entries.length - valid;
  toast.show(invalid > 0 ? `${valid}/${entries.length} items reconnus — ${invalid} inconnus` : `${valid} items reconnus`);
  emit('close');
}

function onVider(): void { store.clear(); emit('close'); }
function close(): void { emit('close'); }

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') close();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div v-if="open" class="fixed inset-0 z-[59] backdrop-blur-sm" style="background: rgba(0,0,0,0.5);" @click="close" />
    </Transition>
    <Transition name="modal">
      <aside
        v-if="open"
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-32px))] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden z-[60] flex flex-col"
        style="background: rgba(8,8,8,0.85);"
        role="dialog"
        aria-modal="true"
        @click.stop
      >
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 class="font-sans font-bold text-[10px] text-[#8AE0EE] tracking-[0.06em] uppercase">Import custom</h2>
          <button
            type="button" @click="close" aria-label="Fermer"
            class="w-8 h-8 inline-flex items-center justify-center rounded-full border border-white/10 text-text-faint hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="px-5 py-4 flex flex-col gap-3">
          <textarea
            data-testid="custom-textarea"
            v-model="text"
            rows="8"
            spellcheck="false"
            placeholder="Un item par ligne, ou collez un CSV nom;type;niveau…"
            class="w-full resize-none bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 font-sans text-[12px] text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors"
          />
          <p v-if="error" class="font-sans text-xs text-danger-soft">Erreur&nbsp;: {{ error }}</p>
          <div v-else-if="analysis" class="font-sans text-xs text-text-muted flex flex-col gap-1">
            <span>
              <span class="font-bold text-[#8AE0EE]">{{ validCount }}</span> valide{{ validCount > 1 ? 's' : '' }}
              · <span class="font-bold text-danger-soft">{{ invalidNames.length }}</span> invalide{{ invalidNames.length > 1 ? 's' : '' }}
            </span>
            <span v-if="invalidNames.length" class="text-text-faint">Inconnus&nbsp;: {{ invalidNames.join(', ') }}</span>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle">
          <button
            v-if="store.entries.length"
            type="button" data-testid="custom-vider" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-white/10 text-text-dim hover:text-danger-soft hover:border-danger/40 transition-colors disabled:opacity-50 mr-auto"
            @click="onVider"
          >Vider</button>
          <button
            type="button" data-testid="custom-analyser" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30 transition-colors disabled:opacity-50"
            @click="onAnalyser"
          >{{ busy ? '…' : 'Analyser' }}</button>
          <button
            type="button" data-testid="custom-importer" :disabled="busy"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.12] text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.20] hover:border-[#5DCFE0] transition-colors disabled:opacity-50"
            @click="onImporter"
          >Importer</button>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, calc(-50% + 6px)); }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 150ms ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
</style>
