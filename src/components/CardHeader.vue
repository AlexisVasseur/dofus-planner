<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';
import ClassThumbnail from '@/components/ClassThumbnail.vue';
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

// Menu action handlers are wired to the menu body added in Task 3.
// Referenced here to keep noUnusedLocals happy during the intermediate state.
void (onMenuCopyCode as unknown);
void (onMenuOpenDofusbook as unknown);
void (onMenuRemove as unknown);
</script>

<template>
  <header class="header relative pl-[4px] pr-4 py-[2px] border-b border-border-subtle bg-gradient-to-b from-bg-elev to-bg-surface">
    <div class="flex items-stretch gap-4 w-full">
      <button
        type="button"
        class="class-picker-trigger flex-shrink-0"
        :class="{ 'cursor-default': readonly }"
        @click="onClassClick"
        aria-label="Choisir une classe"
      >
        <!-- Image hugs the card top-left + extends to the header's bottom — no padding
             around the image. Card's outer rounded-xl + overflow-hidden clips the
             top-left corner naturally. -->
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          alt=""
          class="block w-[64px] h-[64px] object-cover"
          loading="lazy"
        />
        <ClassThumbnail v-else :class-id="classId" :size="64" />
      </button>
      <div
        class="right flex-1 min-w-0 py-2"
        :style="{ color: 'var(--class-accent, rgba(255,255,255,0.9))' }"
      >
        <input
          v-if="editingTitle"
          ref="titleInputRef"
          v-model="titleDraft"
          maxlength="30"
          class="block bg-transparent font-display text-[12px] font-light tracking-[0.16em] uppercase outline-none w-full border-b border-dashed border-white/60"
          style="color: inherit;"
          @blur="commitTitle"
          @keydown.enter.prevent="commitTitle"
          @keydown.esc.prevent="cancelTitle"
        />
        <button
          v-else-if="showCta"
          type="button"
          class="class-picker-trigger block font-display text-[12px] font-light tracking-[0.16em] uppercase text-left"
          :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
          style="color: inherit;"
          @click="onClassClick"
        >Choisir une classe</button>
        <button
          v-else-if="title !== null || !readonly"
          type="button"
          class="block font-display text-[12px] font-light tracking-[0.16em] uppercase text-left w-full truncate"
          :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
          style="color: inherit;"
          @click="startEditTitle"
        >{{ title ?? 'Ajouter un titre' }}</button>
        <div class="flex items-baseline gap-1.5 mt-0.5">
          <span
            class="font-display text-[13px] font-bold uppercase tracking-[0.16em] leading-none"
            style="color: inherit;"
          >Niv</span>
          <input
            v-if="editingLevel"
            ref="levelInputRef"
            v-model="levelDraft"
            type="text"
            inputmode="numeric"
            maxlength="3"
            class="font-display text-[26px] font-bold leading-none bg-transparent w-14 outline-none border-b border-dashed border-white/60"
            style="color: inherit;"
            @blur="commitLevel"
            @keydown.enter.prevent="commitLevel"
            @keydown.esc.prevent="cancelLevel"
          />
          <button
            v-else
            type="button"
            @click="startEditLevel"
            class="font-display text-[26px] font-bold leading-none"
            :class="readonly
              ? 'cursor-default'
              : 'border-b border-dashed border-border-default hover:border-white/60 cursor-text'"
            style="color: inherit;"
          >{{ level ?? '—' }}</button>
        </div>
      </div>
    </div>
    <!-- Kebab trigger — single button overlaying the hero. -->
    <button
      ref="kebabRef"
      data-testid="card-kebab"
      type="button"
      class="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/45 border border-white/15 text-white/75 backdrop-blur-sm inline-flex items-center justify-center hover:text-[#8AE0EE] hover:border-[#8AE0EE]/40 transition-colors"
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
  </header>
</template>
