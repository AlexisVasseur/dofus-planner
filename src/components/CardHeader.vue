<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useEventListener, onClickOutside } from '@vueuse/core';
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

// Floating delete-confirm popover anchored to the × button.
const confirming = ref(false);
const deleteBtnRef = ref<HTMLElement | null>(null);
const confirmRef = ref<HTMLElement | null>(null);

// Same positioning recipe as the class picker: anchored to the card, mirrors its
// width, right by default with auto-flip to left, vertical clamp into viewport.
// Height is auto (just enough for the question + 2 buttons).
const POP_W_FALLBACK = 360;
const GAP = 12;
const MARGIN_X = 12;
const MARGIN_Y = 12;
const CHROME_TOP = 60;
const CHROME_BOTTOM = 60;
const MOBILE_BREAKPOINT = 720;
const POP_H_ESTIMATE = 90; // used only for vertical clamp; actual height stays auto

interface ConfirmPosition {
  mode: 'anchored' | 'modal';
  top: number;
  left: number;
  width: number;
  side: 'right' | 'left';
}

const confirmPosition = ref<ConfirmPosition>({
  mode: 'anchored',
  top: 0,
  left: 0,
  width: POP_W_FALLBACK,
  side: 'right',
});

function recomputeConfirmPosition(): void {
  const btn = deleteBtnRef.value;
  if (!btn) return;

  // Mobile / narrow viewports → centered modal
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    const w = Math.min(window.innerWidth - 32, POP_W_FALLBACK);
    confirmPosition.value = {
      mode: 'modal',
      width: w,
      top: (window.innerHeight - POP_H_ESTIMATE) / 2,
      left: (window.innerWidth - w) / 2,
      side: 'right',
    };
    return;
  }

  // Anchored to the host card (× button lives inside a card with data-card-id)
  const cardEl = btn.closest('[data-card-id]') as HTMLElement | null;
  if (!cardEl) return;
  const r = cardEl.getBoundingClientRect();
  const popW = r.width;

  const fitsRight = window.innerWidth - (r.right + GAP) >= popW + MARGIN_X;
  const fitsLeft = r.left - GAP >= popW + MARGIN_X;

  let side: 'right' | 'left';
  let left: number;
  if (fitsRight) {
    side = 'right';
    left = r.right + GAP;
  } else if (fitsLeft) {
    side = 'left';
    left = r.left - GAP - popW;
  } else {
    side = 'right';
    left = Math.max(MARGIN_X, window.innerWidth - popW - MARGIN_X);
  }

  const minTop = CHROME_TOP + MARGIN_Y;
  const maxTop = window.innerHeight - CHROME_BOTTOM - POP_H_ESTIMATE - MARGIN_Y;
  const top = Math.max(minTop, Math.min(maxTop, r.top));

  confirmPosition.value = { mode: 'anchored', top, left, width: popW, side };
}

watch(confirming, async (v) => {
  if (!v) return;
  await nextTick();
  recomputeConfirmPosition();
});

useEventListener(window, 'resize', () => { if (confirming.value) recomputeConfirmPosition(); });
useEventListener(window, 'scroll', () => { if (confirming.value) recomputeConfirmPosition(); }, { passive: true, capture: true });

// Click outside the confirm popover dismisses — but ignore clicks landing on
// the × trigger itself so its own toggle handler runs.
onClickOutside(confirmRef, (e) => {
  const t = e.target as HTMLElement | null;
  if (t && t.closest('.card-delete-btn')) return;
  confirming.value = false;
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && confirming.value) confirming.value = false;
});

function onRemove() {
  confirming.value = !confirming.value;
}

function cancelDelete() {
  confirming.value = false;
}

function confirmDelete() {
  confirming.value = false;
  emit('remove');
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
      ref="deleteBtnRef"
      type="button"
      class="card-delete-btn absolute top-2 right-2 w-7 h-7 rounded-full text-text-faint hover:text-danger-soft hover:bg-danger/10 border border-transparent hover:border-danger/40 flex items-center justify-center text-[18px] leading-none transition-colors"
      :class="confirming && 'text-danger-soft border-danger/40 bg-danger/10'"
      @click="onRemove"
      aria-label="Supprimer cette étape"
      title="Supprimer cette étape"
    >×</button>
  </header>
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="confirming && confirmPosition.mode === 'modal'"
        class="fixed inset-0 z-[54] backdrop-blur-sm"
        style="background: rgba(0,0,0,0.5);"
        @click="cancelDelete"
      />
    </Transition>
    <Transition name="confirm-pop">
      <div
        v-if="confirming"
        ref="confirmRef"
        class="fixed z-[55] flex flex-col rounded-xl border border-danger/40 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden"
        :style="{
          top: confirmPosition.top + 'px',
          left: confirmPosition.left + 'px',
          width: confirmPosition.width + 'px',
          background: 'rgba(8,8,8,0.85)',
          '--enter-x': confirmPosition.side === 'right' ? '-6px' : '6px',
        }"
        role="dialog"
        aria-label="Confirmer la suppression"
      >
        <div class="px-4 py-3 text-[13px] font-sans font-medium text-text-default border-b border-white/10">
          Supprimer cette étape&nbsp;?
        </div>
        <div class="flex">
          <button
            type="button"
            class="flex-1 px-4 py-3 font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-text-dim hover:text-[#8AE0EE] transition-colors"
            @click="cancelDelete"
          >Annuler</button>
          <div class="w-px bg-white/10" aria-hidden="true"></div>
          <button
            type="button"
            class="flex-1 px-4 py-3 font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-danger-soft hover:bg-danger/15 transition-colors"
            @click="confirmDelete"
          >Supprimer</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-pop-enter-active, .confirm-pop-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.confirm-pop-enter-from, .confirm-pop-leave-to {
  opacity: 0;
  transform: translateX(var(--enter-x, -6px));
}

.backdrop-enter-active, .backdrop-leave-active {
  transition: opacity 150ms ease;
}
.backdrop-enter-from, .backdrop-leave-to {
  opacity: 0;
}
</style>
