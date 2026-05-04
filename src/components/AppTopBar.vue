<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import type { Card } from '@/types/build';

const build = useBuildStore();
const ui = useUiStore();

function newBuild() {
  if (window.confirm('Réinitialiser le build ? Cette action est irréversible.')) {
    build.resetBuild();
    ui.setActiveCard(null);
    ui.closeItemPicker();
    ui.closeClassPicker();
  }
}

function exportBuild() {
  const payload = { version: 1, cards: build.cards };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dofus-build-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBuild() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: unknown; cards?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        window.alert('Fichier invalide : version ou cards manquant.');
        return;
      }
      if (!window.confirm(`Importer ce build ? ${parsed.cards.length} card(s). Le build actuel sera remplacé.`)) return;
      build.replaceCards(parsed.cards as Card[]);
      ui.setActiveCard((parsed.cards as Card[])[0]?.id ?? null);
      ui.closeItemPicker();
      ui.closeClassPicker();
    } catch (err) {
      window.alert(`Import échoué : ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  input.click();
}
</script>

<template>
  <header
    class="topbar flex items-center justify-between px-5 py-3 border-b border-border-subtle relative z-[5] backdrop-blur-md"
    style="background: rgba(5,5,5,0.8);"
  >
    <div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
      <span class="dot w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(91,211,168,0.6)]"></span>
      Dofus level planner
    </div>
    <div class="actions flex items-center gap-2">
      <div class="mode-toggle flex bg-bg-page border border-border-default rounded-md p-0.5 mr-1">
        <button
          type="button"
          class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
          :class="ui.viewMode === 'build' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
          @click="ui.setViewMode('build')"
          aria-label="Mode Build (équipement complet)"
        >Build</button>
        <button
          type="button"
          class="px-2.5 py-1 font-display text-[11px] tracking-[0.18em] uppercase rounded transition-colors"
          :class="ui.viewMode === 'switch' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
          @click="ui.setViewMode('switch')"
          aria-label="Mode Switch (uniquement les changements)"
        >Switch</button>
      </div>
      <button
        type="button"
        class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-accent hover:text-accent"
        @click="importBuild"
      >Importer</button>
      <button
        type="button"
        class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-accent hover:text-accent"
        @click="exportBuild"
      >Exporter</button>
      <button
        type="button"
        class="bg-accent text-[#061a13] border border-accent rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-110"
        @click="newBuild"
      >Nouveau build</button>
    </div>
  </header>
</template>
