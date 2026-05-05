<script setup lang="ts">
import { computed } from 'vue';
import type { NpcId } from '@/types/rooms';
import { NPC_LABEL } from '@/types/rooms';
import type { Item } from '@/data/dofusdb';
import { getNpcIconSvg } from '@/data/npc-icons';
import ItemRow from './ItemRow.vue';
import type { SlotType } from '@/types/slots';

const props = defineProps<{
  npcId: NpcId;
  items: Item[];
}>();

const label = computed(() => NPC_LABEL[props.npcId]);
const iconSvg = computed(() => getNpcIconSvg(props.npcId));

// fallbackSlot is the SlotType that ItemRow uses to draw a placeholder glyph when the
// item has no iconUrl. For NPCs that map directly to a slot, pass it. trophée + dofus
// fall back to undefined → ItemRow simply shows nothing inside the icon box.
const fallbackSlot = computed<SlotType | undefined>(() => {
  switch (props.npcId) {
    case 'coiffe': return 'coiffe';
    case 'cape': return 'cape';
    case 'amulette': return 'amulette';
    case 'anneau': return 'anneau1';
    case 'ceinture': return 'ceinture';
    case 'bottes': return 'bottes';
    case 'arme': return 'arme';
    case 'bouclier': return 'bouclier';
    case 'familier': return 'familier';
    default: return undefined;
  }
});
</script>

<template>
  <article class="npc-card bg-bg-surface border border-border-default rounded-lg p-3.5 flex flex-col gap-2">
    <header class="flex items-center gap-2.5 pb-2 border-b border-border-subtle">
      <div class="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center bg-bg-slot-filled border border-border-slot-filled text-text-muted">
        <svg viewBox="0 0 24 24" class="w-4 h-4" v-html="iconSvg" />
      </div>
      <h3 class="font-display text-[12px] text-white/75 tracking-[0.2em] uppercase flex-1 min-w-0 truncate">{{ label }}</h3>
      <span class="text-[10px] font-mono text-text-faint bg-bg-page border border-border-default rounded-full px-1.5 py-[1px]">×{{ items.length }}</span>
    </header>
    <div class="flex flex-col">
      <ItemRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        :fallback-slot="fallbackSlot"
      />
    </div>
  </article>
</template>
