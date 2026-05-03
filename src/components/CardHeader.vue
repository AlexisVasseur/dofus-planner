<script setup lang="ts">
import { ref, computed } from 'vue';
import ClassLogo from './ClassLogo.vue';
import type { ClassId } from '@/types/classes';

const props = defineProps<{
  classId: ClassId | null;
  level: number | null;
  title: string | null;
}>();

const emit = defineEmits<{
  'open-class-picker': [];
  'update:level': [value: number | null];
  'update:title': [value: string | null];
}>();

const editingLevel = ref(false);
const editingTitle = ref(false);
const levelDraft = ref('');
const titleDraft = ref('');

const showCta = computed(() => props.classId === null);

function startEditLevel() {
  editingLevel.value = true;
  levelDraft.value = props.level === null ? '' : String(props.level);
}
function commitLevel() {
  editingLevel.value = false;
  const trimmed = levelDraft.value.trim();
  if (trimmed === '') { emit('update:level', null); return; }
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return;
  emit('update:level', Math.max(1, Math.min(200, n)));
}

function startEditTitle() {
  editingTitle.value = true;
  titleDraft.value = props.title ?? '';
}
function commitTitle() {
  editingTitle.value = false;
  const t = titleDraft.value.trim();
  emit('update:title', t.length > 0 ? t.slice(0, 30) : null);
}
</script>

<template>
  <header class="header flex items-center gap-3 p-3.5 border-b border-border-subtle bg-gradient-to-b from-bg-elev to-bg-surface">
    <button type="button" @click="emit('open-class-picker')" aria-label="Choisir une classe">
      <ClassLogo :class-id="classId" :pulse="classId === null" />
    </button>
    <div class="right flex-1 min-w-0">
      <div class="flex items-baseline">
        <span class="font-sans text-[9px] font-semibold text-text-faint uppercase tracking-[0.25em] mr-1.5">Lv</span>
        <input
          v-if="editingLevel"
          v-model="levelDraft"
          type="number"
          min="1" max="200"
          class="font-display text-[28px] leading-none bg-transparent text-text-default w-16 outline-none focus:underline focus:underline-offset-4 decoration-dashed decoration-accent"
          @blur="commitLevel"
          @keydown.enter="commitLevel"
          @keydown.esc="editingLevel = false"
          ref="levelInput"
          autofocus
        />
        <button
          v-else
          @click="startEditLevel"
          class="font-display text-[28px] leading-none text-text-default border-b border-dashed border-border-default hover:border-accent"
        >{{ level ?? '—' }}</button>
      </div>
      <input
        v-if="editingTitle"
        v-model="titleDraft"
        maxlength="30"
        class="block mt-1 bg-transparent font-display text-[12px] tracking-[0.18em] uppercase text-text-muted outline-none w-full"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
        @keydown.esc="editingTitle = false"
      />
      <button
        v-else-if="showCta"
        class="block mt-1 font-display text-[12px] tracking-[0.18em] uppercase text-accent"
        @click="emit('open-class-picker')"
      >Choisir une classe</button>
      <button
        v-else
        class="block mt-1 font-display text-[12px] tracking-[0.18em] uppercase text-text-muted hover:text-text-default text-left w-full truncate"
        @click="startEditTitle"
      >{{ title ?? 'Ajouter un titre' }}</button>
    </div>
  </header>
</template>
