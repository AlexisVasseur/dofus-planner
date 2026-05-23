<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { ensureItems } from '@/composables/useItemCatalog';
import { decodeCardCode } from '@/utils/dofusbook';
import { useToast } from '@/composables/useToast';
import type { Card } from '@/types/build';

const ui = useUiStore();
const build = useBuildStore();
const toast = useToast();

const open = computed(() => ui.codeImportAfterCardId !== null);
const code = ref('');
const error = ref<string | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Auto-focus the textarea + reset state every time the modal opens. Closing leaves the
// last code in place so an accidental Escape doesn't lose what was pasted.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  code.value = '';
  error.value = null;
  await nextTick();
  textareaRef.value?.focus();
});

function collectItemIds(card: Card): number[] {
  const ids = new Set<number>();
  for (const ref of Object.values(card.slots)) {
    if (ref) ids.add(ref.itemId);
  }
  for (const ref of card.dofus) {
    if (ref) ids.add(ref.itemId);
  }
  return Array.from(ids);
}

function close(): void {
  ui.closeCodeImport();
}

function submit(): void {
  const afterId = ui.codeImportAfterCardId;
  if (afterId === null) return;
  const trimmed = code.value.trim();
  if (trimmed.length === 0) {
    error.value = 'Collez un code avant d\'importer.';
    return;
  }
  let card: Card;
  try {
    card = decodeCardCode(trimmed);
  } catch (err) {
    error.value = `Code invalide : ${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  build.addCardAfter(afterId, card);
  ui.setActiveCard(card.id);
  void ensureItems(collectItemIds(card));
  toast.show('Stuff importé depuis le code');
  close();
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (!open.value) return;
  if (e.key === 'Escape') close();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-[59] backdrop-blur-sm"
        style="background: rgba(0,0,0,0.5);"
        @click="close"
      />
    </Transition>
    <Transition name="modal">
      <aside
        v-if="open"
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-32px))] rounded-xl border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(93,207,224,0.10)] overflow-hidden z-[60] flex flex-col"
        style="background: rgba(8,8,8,0.85);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-code-import-title"
        @click.stop
      >
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2
            id="card-code-import-title"
            class="font-sans font-bold text-[10px] text-[#8AE0EE] tracking-[0.06em] uppercase"
          >Importer un stuff depuis un code</h2>
          <button
            type="button"
            @click="close"
            aria-label="Fermer"
            class="w-8 h-8 inline-flex items-center justify-center rounded-full border border-white/10 text-text-faint hover:border-[#5DCFE0]/40 hover:text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.10] transition-colors"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div class="px-5 py-4 flex flex-col gap-3">
          <textarea
            ref="textareaRef"
            v-model="code"
            rows="6"
            spellcheck="false"
            autocomplete="off"
            placeholder="Coller le code ici…"
            class="w-full resize-none bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 font-mono text-[11px] text-text-default outline-none focus:border-[#5DCFE0]/60 focus:bg-[#5DCFE0]/[0.04] transition-colors break-all"
            @keydown.ctrl.enter.prevent="submit"
            @keydown.meta.enter.prevent="submit"
          />
          <p v-if="error" class="font-sans text-xs text-danger-soft">{{ error }}</p>
        </div>
        <footer class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle">
          <button
            type="button"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-white/10 text-text-dim hover:text-[#8AE0EE] hover:border-[#8AE0EE]/30 transition-colors"
            @click="close"
          >Annuler</button>
          <button
            type="button"
            class="font-sans font-bold text-[10px] uppercase tracking-[0.06em] px-3 py-1.5 rounded-md border border-[#5DCFE0]/60 bg-[#5DCFE0]/[0.12] text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.20] hover:border-[#5DCFE0] transition-colors"
            @click="submit"
          >Importer</button>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 6px));
}
.backdrop-enter-active, .backdrop-leave-active {
  transition: opacity 150ms ease;
}
.backdrop-enter-from, .backdrop-leave-to {
  opacity: 0;
}
</style>
