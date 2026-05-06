<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import ClassThumbnail from '@/components/ClassThumbnail.vue';
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
  'remove': [];
}>();

const editingLevel = ref(false);
const editingTitle = ref(false);
const levelDraft = ref('');
const titleDraft = ref('');

const levelInputRef = ref<HTMLInputElement | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);

const showCta = computed(() => props.classId === null);

async function startEditLevel() {
  if (editingLevel.value) return;
  levelDraft.value = props.level === null ? '' : String(props.level);
  editingLevel.value = true;
  await nextTick();
  levelInputRef.value?.focus();
  levelInputRef.value?.select();
}

let commitLevelGuard = false;
function commitLevel() {
  if (commitLevelGuard || !editingLevel.value) return;
  commitLevelGuard = true;
  editingLevel.value = false;
  const trimmed = levelDraft.value.trim();
  if (trimmed === '') {
    emit('update:level', null);
  } else {
    const n = parseInt(trimmed, 10);
    if (!Number.isNaN(n)) {
      emit('update:level', Math.max(1, Math.min(200, n)));
    }
  }
  // Release the guard after the current event loop tick so the next edit works.
  setTimeout(() => { commitLevelGuard = false; }, 0);
}

function cancelLevel() {
  editingLevel.value = false;
}

async function startEditTitle() {
  if (editingTitle.value) return;
  titleDraft.value = props.title ?? '';
  editingTitle.value = true;
  await nextTick();
  titleInputRef.value?.focus();
  titleInputRef.value?.select();
}

let commitTitleGuard = false;
function commitTitle() {
  if (commitTitleGuard || !editingTitle.value) return;
  commitTitleGuard = true;
  editingTitle.value = false;
  const t = titleDraft.value.trim();
  emit('update:title', t.length > 0 ? t.slice(0, 30) : null);
  setTimeout(() => { commitTitleGuard = false; }, 0);
}

function cancelTitle() {
  editingTitle.value = false;
}

function onRemove() {
  if (window.confirm('Supprimer cette étape ?')) {
    emit('remove');
  }
}
</script>

<template>
  <header class="header relative p-4 border-b border-border-subtle bg-gradient-to-b from-bg-elev to-bg-surface">
    <div class="flex items-center gap-4 w-full">
      <button
        type="button"
        class="class-picker-trigger"
        @click="emit('open-class-picker')"
        aria-label="Choisir une classe"
      >
        <ClassThumbnail :class-id="classId" :size="56" />
      </button>
      <div
        class="right flex-1 min-w-0"
        :style="{ color: 'var(--class-accent, rgba(255,255,255,0.9))' }"
      >
        <input
          v-if="editingTitle"
          ref="titleInputRef"
          v-model="titleDraft"
          maxlength="30"
          class="block bg-transparent font-display text-[14px] font-light tracking-[0.18em] uppercase outline-none w-full border-b border-dashed border-white/60"
          style="color: inherit;"
          @blur="commitTitle"
          @keydown.enter.prevent="commitTitle"
          @keydown.esc.prevent="cancelTitle"
        />
        <button
          v-else-if="showCta"
          type="button"
          class="class-picker-trigger block font-display text-[14px] font-light tracking-[0.18em] uppercase text-left hover:opacity-80"
          style="color: inherit;"
          @click="emit('open-class-picker')"
        >Choisir une classe</button>
        <button
          v-else
          type="button"
          class="block font-display text-[14px] font-light tracking-[0.18em] uppercase text-left w-full truncate hover:opacity-80"
          style="color: inherit;"
          @click="startEditTitle"
        >{{ title ?? 'Ajouter un titre' }}</button>
        <div class="flex items-baseline gap-2 mt-1">
          <span
            class="font-display text-[18px] font-bold uppercase tracking-[0.18em] leading-none"
            style="color: inherit;"
          >Niv</span>
          <input
            v-if="editingLevel"
            ref="levelInputRef"
            v-model="levelDraft"
            type="text"
            inputmode="numeric"
            maxlength="3"
            class="font-display text-[36px] font-bold leading-none bg-transparent w-20 outline-none border-b border-dashed border-white/60"
            style="color: inherit;"
            @blur="commitLevel"
            @keydown.enter.prevent="commitLevel"
            @keydown.esc.prevent="cancelLevel"
          />
          <button
            v-else
            type="button"
            @click="startEditLevel"
            class="font-display text-[36px] font-bold leading-none border-b border-dashed border-border-default hover:border-white/60 cursor-text"
            style="color: inherit;"
          >{{ level ?? '—' }}</button>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="card-delete-btn absolute top-2 right-2 w-7 h-7 rounded-full text-text-faint hover:text-danger-soft hover:bg-danger/10 border border-transparent hover:border-danger/40 flex items-center justify-center text-[18px] leading-none transition-colors"
      @click="onRemove"
      aria-label="Supprimer cette étape"
      title="Supprimer cette étape"
    >×</button>
  </header>
</template>
