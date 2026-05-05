<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { getCachedItem, populateCache, ensureItems } from '@/composables/useItemCatalog';
import type { Card } from '@/types/build';
import type { Item } from '@/data/dofusdb';
import logoUrl from '@/assets/dofus-planner.png';

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
    class="topbar flex items-center justify-between px-5 py-2.5 mx-4 mt-3 rounded-xl border border-border-subtle backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] relative z-[5]"
    style="background: rgba(8,8,8,0.85);"
  >
    <div class="brand flex items-center">
      <img
        :src="logoUrl"
        alt="Dofus Planner"
        class="h-10 w-auto select-none"
        draggable="false"
      />
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
        class="bg-gradient-to-b from-white/[0.10] to-white/[0.02] text-text-default border border-white/15 rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.35)] hover:from-white/[0.16] hover:to-white/[0.06] hover:border-white/30 active:translate-y-[1px] transition-all"
        @click="importBuild"
      >Importer</button>
      <button
        type="button"
        class="bg-gradient-to-b from-white/[0.10] to-white/[0.02] text-text-default border border-white/15 rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.35)] hover:from-white/[0.16] hover:to-white/[0.06] hover:border-white/30 active:translate-y-[1px] transition-all"
        @click="exportBuild"
      >Exporter</button>
      <button
        type="button"
        class="bg-gradient-to-b from-white to-neutral-200 text-[#0a0a0a] border border-white rounded-md px-3.5 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.05em] cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(0,0,0,0.45)] hover:from-white hover:to-white hover:brightness-[1.02] active:translate-y-[1px] transition-all"
        @click="newBuild"
      >Nouveau build</button>
    </div>
  </header>
</template>
