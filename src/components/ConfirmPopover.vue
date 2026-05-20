<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useEventListener, onClickOutside } from '@vueuse/core';

const props = withDefaults(defineProps<{
  open: boolean;
  triggerEl: HTMLElement | null;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent';
  width?: number;
  ignoreSelector?: string;
}>(), {
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  tone: 'accent',
  width: 300,
  ignoreSelector: '',
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const popoverRef = ref<HTMLElement | null>(null);

const GAP = 8;
const MARGIN_X = 12;
const MARGIN_Y = 12;
const MOBILE_BREAKPOINT = 720;
const H_ESTIMATE = 120;

interface Position {
  mode: 'anchored' | 'modal';
  top: number;
  left: number;
  width: number;
}

const position = ref<Position>({ mode: 'anchored', top: 0, left: 0, width: props.width });

function recompute(): void {
  const btn = props.triggerEl;
  if (!btn) return;

  if (window.innerWidth < MOBILE_BREAKPOINT) {
    const w = Math.min(window.innerWidth - 32, props.width);
    position.value = {
      mode: 'modal',
      width: w,
      top: (window.innerHeight - H_ESTIMATE) / 2,
      left: (window.innerWidth - w) / 2,
    };
    return;
  }

  const r = btn.getBoundingClientRect();
  // Below trigger, right-aligned to the button's right edge (popover never spills off-screen).
  const top = Math.min(window.innerHeight - H_ESTIMATE - MARGIN_Y, r.bottom + GAP);
  const left = Math.max(MARGIN_X, Math.min(window.innerWidth - props.width - MARGIN_X, r.right - props.width));
  position.value = { mode: 'anchored', top, left, width: props.width };
}

watch(() => props.open, async (v) => {
  if (!v) return;
  await nextTick();
  recompute();
});

useEventListener(window, 'resize', () => { if (props.open) recompute(); });
useEventListener(window, 'scroll', () => { if (props.open) recompute(); }, { passive: true, capture: true });

onClickOutside(popoverRef, (e) => {
  if (!props.open) return;
  const t = e.target as HTMLElement | null;
  // Clicking the trigger itself should not be treated as outside (its own handler toggles).
  if (props.triggerEl && t && (t === props.triggerEl || props.triggerEl.contains(t))) return;
  if (props.ignoreSelector && t && t.closest(props.ignoreSelector)) return;
  emit('update:open', false);
  emit('cancel');
});

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') {
    emit('update:open', false);
    emit('cancel');
  }
});

function onConfirm(): void {
  emit('update:open', false);
  emit('confirm');
}
function onCancel(): void {
  emit('update:open', false);
  emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop">
      <div
        v-if="open && position.mode === 'modal'"
        class="fixed inset-0 z-[54] backdrop-blur-sm"
        style="background: rgba(0,0,0,0.5);"
        @click="onCancel"
      />
    </Transition>
    <Transition name="confirm-pop">
      <div
        v-if="open"
        ref="popoverRef"
        class="fixed z-[55] flex flex-col rounded-xl backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] overflow-hidden border"
        :class="tone === 'danger' ? 'border-danger/40' : 'border-[#5DCFE0]/40'"
        :style="{
          top: position.top + 'px',
          left: position.left + 'px',
          width: position.width + 'px',
          background: 'rgba(8,8,8,0.85)',
        }"
        role="dialog"
        aria-modal="true"
      >
        <div class="px-4 py-3 text-[13px] font-sans font-medium text-text-default border-b border-white/10">
          {{ message }}
        </div>
        <div class="flex">
          <button
            type="button"
            class="flex-1 px-4 py-3 font-sans font-bold text-[11px] uppercase tracking-[0.06em] text-text-dim hover:text-[#8AE0EE] transition-colors"
            @click="onCancel"
          >{{ cancelLabel }}</button>
          <div class="w-px bg-white/10" aria-hidden="true"></div>
          <button
            type="button"
            class="flex-1 px-4 py-3 font-sans font-bold text-[11px] uppercase tracking-[0.06em] transition-colors"
            :class="tone === 'danger'
              ? 'text-danger-soft hover:bg-danger/15'
              : 'text-[#8AE0EE] hover:bg-[#5DCFE0]/[0.12]'"
            @click="onConfirm"
          >{{ confirmLabel }}</button>
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
  transform: translateY(-6px);
}
.backdrop-enter-active, .backdrop-leave-active {
  transition: opacity 150ms ease;
}
.backdrop-enter-from, .backdrop-leave-to {
  opacity: 0;
}
</style>
