<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';
import type { ClassId } from '@/types/classes';
import { getClassAssets } from '@/composables/useClassAssets';

const props = defineProps<{
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  confirmingDelete?: boolean;
  /** Reader-mode flag: blocks edits (no level/title input, no class picker, no delete). */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  'open-class-picker': [];
  'update:level': [value: number | null];
  'update:title': [value: string | null];
  'remove': [];
  'open-dofusbook': [];
  'copy-code': [];
}>();

const editingLevel = ref(false);
const editingTitle = ref(false);
const levelDraft = ref('');
const titleDraft = ref('');

const levelInputRef = ref<HTMLInputElement | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);

const showCta = computed(() => props.classId === null);
const thumbnailUrl = computed(() => getClassAssets(props.classId)?.thumbnail ?? null);

const heroStyle = computed(() => {
  const url = thumbnailUrl.value;
  if (!url) return {} as Record<string, string>;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 20%',
    backgroundBlendMode: 'multiply',
    backgroundColor: 'var(--class-dominant, rgba(255,255,255,0.05))',
  } satisfies Record<string, string>;
});

async function startEditLevel() {
  if (props.readonly || editingLevel.value) return;
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
  setTimeout(() => { commitLevelGuard = false; }, 0);
}

function cancelLevel() {
  editingLevel.value = false;
}

async function startEditTitle() {
  if (props.readonly || editingTitle.value) return;
  titleDraft.value = props.title ?? '';
  editingTitle.value = true;
  await nextTick();
  titleInputRef.value?.focus();
  titleInputRef.value?.select();
}

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const kebabRef = ref<HTMLElement | null>(null);

function toggleMenu(): void { menuOpen.value = !menuOpen.value; }
function closeMenu(): void { menuOpen.value = false; }

function onMenuCopyCode(): void { closeMenu(); emit('copy-code'); }
function onMenuOpenDofusbook(): void { closeMenu(); emit('open-dofusbook'); }
function onMenuRemove(): void { closeMenu(); emit('remove'); }

onClickOutside(menuRef, (e) => {
  if (!menuOpen.value) return;
  const t = e.target as HTMLElement | null;
  if (t && kebabRef.value && (t === kebabRef.value || kebabRef.value.contains(t))) return;
  closeMenu();
});
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (menuOpen.value && e.key === 'Escape') closeMenu();
});

function onClassClick(): void {
  if (props.readonly) return;
  emit('open-class-picker');
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

</script>

<template>
  <header class="header relative h-[76px] border-b border-border-subtle overflow-hidden">
    <!-- Hero background: class portrait blended with class accent tint, gradient on top. -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 opacity-60 pointer-events-none"
      :style="heroStyle"
      aria-hidden="true"
    />
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 pointer-events-none"
      style="background: linear-gradient(to right, rgba(8,18,26,0.55) 0%, rgba(8,18,26,0.95) 65%);"
      aria-hidden="true"
    />
    <!-- Click-through layer: clicking the hero (outside the text and kebab) opens the
         class picker. z-0 so the text + kebab catch their own clicks first. -->
    <button
      v-if="!readonly"
      type="button"
      class="absolute inset-0 z-0 class-picker-trigger"
      :class="{ 'cursor-pointer': !readonly }"
      aria-label="Choisir une classe"
      @click="onClassClick"
    />
    <!-- Text overlay (left aligned). -->
    <div
      class="absolute left-3 top-2 right-12 z-10"
      :style="{ color: 'var(--class-accent, rgba(255,255,255,0.9))' }"
    >
      <input
        v-if="editingTitle"
        ref="titleInputRef"
        v-model="titleDraft"
        maxlength="30"
        class="block bg-transparent font-display text-[10px] font-light tracking-[0.16em] uppercase outline-none w-full border-b border-dashed border-white/60"
        style="color: inherit;"
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
        @keydown.esc.prevent="cancelTitle"
      />
      <button
        v-else-if="showCta"
        type="button"
        class="block font-display text-[10px] font-light tracking-[0.16em] uppercase text-left"
        :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
        style="color: inherit;"
        @click.stop="onClassClick"
      >Choisir une classe</button>
      <button
        v-else-if="title !== null || !readonly"
        type="button"
        class="block font-display text-[10px] font-light tracking-[0.16em] uppercase text-left w-full truncate"
        :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
        style="color: inherit;"
        @click.stop="startEditTitle"
      >{{ title ?? 'Ajouter un titre' }}</button>
      <div class="flex items-baseline gap-1.5 mt-1">
        <span
          class="font-display text-[11px] font-bold uppercase tracking-[0.16em] leading-none text-white/70"
        >Niv</span>
        <input
          v-if="editingLevel"
          ref="levelInputRef"
          v-model="levelDraft"
          type="text"
          inputmode="numeric"
          maxlength="3"
          class="font-display text-[26px] font-bold leading-none bg-transparent w-14 outline-none border-b border-dashed border-white/60 text-white"
          @blur="commitLevel"
          @keydown.enter.prevent="commitLevel"
          @keydown.esc.prevent="cancelLevel"
        />
        <button
          v-else
          type="button"
          @click.stop="startEditLevel"
          class="font-display text-[26px] font-bold leading-none text-white"
          :class="readonly
            ? 'cursor-default'
            : 'border-b border-dashed border-white/30 hover:border-white/70 cursor-text'"
        >{{ level ?? '—' }}</button>
      </div>
    </div>
    <!-- Kebab trigger — single button overlaying the hero. -->
    <button
      ref="kebabRef"
      data-testid="card-kebab"
      type="button"
      class="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/45 border border-white/15 text-white/75 backdrop-blur-sm inline-flex items-center justify-center hover:text-[#8AE0EE] hover:border-[#8AE0EE]/40 transition-colors"
      aria-label="Actions"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click.stop="toggleMenu"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5"  r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="19" r="1.6" />
      </svg>
    </button>
    <Transition name="menu">
      <div
        v-if="menuOpen"
        ref="menuRef"
        data-testid="card-menu"
        role="menu"
        aria-orientation="vertical"
        class="absolute top-12 right-3 z-20 w-44 rounded-md border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_8px_18px_rgba(0,0,0,0.5)] overflow-hidden"
        style="background: rgba(8,12,16,0.95);"
      >
        <button
          data-testid="card-menu-copy"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-text-default hover:bg-[#5DCFE0]/[0.08] hover:text-[#8AE0EE] transition-colors"
          @click.stop="onMenuCopyCode"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copier le code
        </button>
        <button
          data-testid="card-menu-dofusbook"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-text-default hover:bg-[#5DCFE0]/[0.08] hover:text-[#8AE0EE] transition-colors"
          @click.stop="onMenuOpenDofusbook"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Ouvrir Dofusbook
        </button>
        <button
          v-if="!readonly"
          data-testid="card-menu-remove"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-danger-soft hover:bg-danger/10 transition-colors"
          @click.stop="onMenuRemove"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Supprimer
        </button>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.menu-enter-active, .menu-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
