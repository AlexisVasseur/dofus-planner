<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { getCachedItem, populateCache, ensureItems } from '@/composables/useItemCatalog';
import type { Card } from '@/types/build';
import type { Item } from '@/data/dofusdb';

const build = useBuildStore();
const ui = useUiStore();

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
    class="topbar flex items-center justify-between px-5 py-3 border-b border-border-subtle relative z-[5] backdrop-blur-md"
    style="background: rgba(5,5,5,0.8);"
  >
    <div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
      <span class="dot w-2 h-2 rounded-full bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.45)]"></span>
      Dofus level planner
    </div>
    <div class="actions flex items-center gap-2">
      <div class="mode-toggle flex bg-bg-page border border-border-default rounded-md p-0.5 mr-1">
        <button
          type="button"
          class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
          :class="ui.viewMode === 'build' ? 'bg-white text-[#0a0a0a]' : 'text-text-muted hover:text-text-default'"
          @click="ui.setViewMode('build')"
          aria-label="Mode Build (équipement complet)"
        >Build</button>
        <button
          type="button"
          class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
          :class="ui.viewMode === 'switch' ? 'bg-white text-[#0a0a0a]' : 'text-text-muted hover:text-text-default'"
          @click="ui.setViewMode('switch')"
          aria-label="Mode Switch (uniquement les changements)"
        >Switch</button>
        <button
          type="button"
          class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
          :class="ui.viewMode === 'purchase' ? 'bg-white text-[#0a0a0a]' : 'text-text-muted hover:text-text-default'"
          @click="ui.setViewMode('purchase')"
          aria-label="Mode Achats (planificateur d'achat)"
        >Achats</button>
      </div>
      <button
        type="button"
        class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-white/60 hover:text-white"
        @click="importBuild"
      >Importer</button>
      <button
        type="button"
        class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-white/60 hover:text-white"
        @click="exportBuild"
      >Exporter</button>
      <button
        type="button"
        class="bg-white text-[#0a0a0a] border border-white rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-95"
        @click="newBuild"
      >Nouveau build</button>
    </div>
  </header>
</template>
