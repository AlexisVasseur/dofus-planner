<script setup lang="ts">
import { computed } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { getCachedItem, populateCache, ensureItems } from '@/composables/useItemCatalog';
import type { Card } from '@/types/build';
import type { Item } from '@/data/dofusdb';
import logoUrl from '@/assets/dofus-planner.png';

const build = useBuildStore();
const ui = useUiStore();

// Each viewMode is associated with a "page": Builder, Reader, Shopping.
// Index drives the animated highlight pill behind the active toggle button.
const TOGGLE_PAGES = [
  { mode: 'build' as const,    label: 'Builder',  aria: 'Mode Builder (équipement complet)' },
  { mode: 'switch' as const,   label: 'Reader',   aria: 'Mode Reader (uniquement les changements)' },
  { mode: 'purchase' as const, label: 'Shopping', aria: 'Mode Shopping (planificateur d\'achat)' },
];
const activeToggleIdx = computed(() => TOGGLE_PAGES.findIndex((p) => p.mode === ui.viewMode));
const togglePillStyle = computed(() => ({
  left: `calc(0.25rem + (100% - 0.5rem) / 3 * ${activeToggleIdx.value})`,
  width: 'calc((100% - 0.5rem) / 3)',
}));

function collectItemIds(cards: Card[]): number[] {
  const ids = new Set<number>();
  for (const card of cards) {
    for (const ref of Object.values(card.slots)) {
      if (ref) ids.add(ref.itemId);
    }
    for (const ref of card.dofus) {
      if (ref) ids.add(ref.itemId);
    }
  }
  return Array.from(ids);
}

function newBuild() {
  if (window.confirm('Réinitialiser le build ? Cette action est irréversible.')) {
    build.resetBuild();
    ui.setActiveCard(null);
    ui.closeItemPicker();
    ui.closeClassPicker();
  }
}

function exportBuild() {
  try {
    // Flatten any Pinia/Vue reactive proxies so the JSON output is plain data.
    const flatCards = JSON.parse(JSON.stringify(build.cards)) as Card[];
    // Snapshot the items used in the build so the export is self-contained.
    const items: Item[] = [];
    for (const id of collectItemIds(flatCards)) {
      const item = getCachedItem(id);
      if (item) items.push(item);
    }
    const payload = { version: 1, cards: flatCards, items };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofus-build-${new Date().toISOString().slice(0, 10)}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Defer cleanup so the browser can start the download.
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);
  } catch (err) {
    window.alert(`Export échoué : ${err instanceof Error ? err.message : String(err)}`);
  }
}

function importBuild() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.opacity = '0';
  document.body.appendChild(input);

  function cleanup() {
    if (input.parentNode) input.parentNode.removeChild(input);
  }

  input.addEventListener('change', async (e) => {
    try {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: unknown; cards?: unknown; items?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        window.alert('Fichier invalide : version ou cards manquant.');
        return;
      }
      const cards = parsed.cards as Card[];
      if (!window.confirm(`Importer ce build ? ${cards.length} card(s). Le build actuel sera remplacé.`)) return;

      // Populate the item cache from the export's items snapshot, then fetch any missing
      // ids from DofusDB so all icons/names render even on a fresh device.
      if (Array.isArray(parsed.items)) {
        populateCache(parsed.items as Item[]);
      }
      const missingIds = collectItemIds(cards);
      // Fire-and-forget: cache fills in async; UI updates as items arrive.
      void ensureItems(missingIds);

      build.replaceCards(cards);
      ui.setActiveCard(cards[0]?.id ?? null);
      ui.closeItemPicker();
      ui.closeClassPicker();
    } catch (err) {
      window.alert(`Import échoué : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      cleanup();
    }
  });
  // Some browsers don't fire change if the user cancels — ensure cleanup eventually.
  // Fallback: remove the input after a long timeout if change didn't fire.
  setTimeout(cleanup, 60_000);

  input.click();
}
</script>

<template>
  <header
    class="topbar grid items-center px-5 py-2.5 mx-4 mt-3 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] relative"
    style="background: rgba(8,8,8,0.55); grid-template-columns: 1fr auto 1fr;"
  >
    <div class="brand relative w-44 h-10 justify-self-start">
      <img
        :src="logoUrl"
        alt="Dofus Planner"
        class="absolute left-0 top-1/2 -translate-y-1/2 h-20 w-auto select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
        draggable="false"
      />
    </div>
    <nav class="mode-toggle relative grid grid-cols-3 items-center justify-self-center bg-white/[0.04] border border-white/10 rounded-md p-1 h-9 w-[300px]">
      <div
        class="toggle-pill absolute top-1 bottom-1 rounded bg-[#5DCFE0] transition-[left,width] duration-300 ease-out"
        :style="togglePillStyle"
      />
      <button
        v-for="page in TOGGLE_PAGES"
        :key="page.mode"
        type="button"
        class="h-7 relative z-10 inline-flex items-center justify-center font-sans font-bold text-[11px] tracking-[0.06em] uppercase rounded transition-colors duration-300"
        :class="ui.viewMode === page.mode
          ? 'text-[#0A2530]'
          : 'text-text-muted hover:text-[#8AE0EE]'"
        @click="ui.setViewMode(page.mode)"
        :aria-label="page.aria"
      >{{ page.label }}</button>
    </nav>
    <div class="actions flex items-center gap-2 justify-self-end">
      <button
        type="button"
        class="w-9 h-9 inline-flex items-center justify-center bg-white/[0.06] text-text-default border border-white/15 rounded-md cursor-pointer hover:bg-[#8AE0EE]/[0.12] hover:border-[#8AE0EE]/40 hover:text-[#8AE0EE] active:translate-y-[1px] transition-colors"
        @click="importBuild"
        aria-label="Importer un build"
        title="Importer un build"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v12" />
          <polyline points="6 10 12 16 18 10" />
          <path d="M4 20h16" />
        </svg>
      </button>
      <button
        type="button"
        class="w-9 h-9 inline-flex items-center justify-center bg-white/[0.06] text-text-default border border-white/15 rounded-md cursor-pointer hover:bg-[#8AE0EE]/[0.12] hover:border-[#8AE0EE]/40 hover:text-[#8AE0EE] active:translate-y-[1px] transition-colors"
        @click="exportBuild"
        aria-label="Exporter le build"
        title="Exporter le build"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20V8" />
          <polyline points="6 14 12 8 18 14" />
          <path d="M4 4h16" />
        </svg>
      </button>
      <button
        type="button"
        class="h-9 inline-flex items-center gap-1.5 bg-[#5DCFE0] text-[#0A2530] border border-[#5DCFE0] rounded-md px-3.5 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:bg-[#8AE0EE] hover:border-[#8AE0EE] active:translate-y-[1px] transition-colors"
        @click="newBuild"
        aria-label="Nouveau build"
      >
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nouveau build
      </button>
    </div>
  </header>
</template>
