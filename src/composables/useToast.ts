import { ref, readonly, type Ref } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
}

const MAX_STACK = 3;
const DEFAULT_DURATION_MS = 3000;

let nextId = 1;
const messages = ref<ToastMessage[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function dismiss(id: number): void {
  const i = messages.value.findIndex((m) => m.id === id);
  if (i !== -1) messages.value.splice(i, 1);
  const t = timers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function show(text: string, durationMs: number = DEFAULT_DURATION_MS): number {
  const id = nextId++;
  messages.value.push({ id, text });
  while (messages.value.length > MAX_STACK) {
    const dropped = messages.value.shift();
    if (dropped) {
      const t = timers.get(dropped.id);
      if (t !== undefined) {
        clearTimeout(t);
        timers.delete(dropped.id);
      }
    }
  }
  const timer = setTimeout(() => dismiss(id), durationMs);
  timers.set(id, timer);
  return id;
}

export function useToast(): {
  messages: Readonly<Ref<readonly ToastMessage[]>>;
  show: (text: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
} {
  return { messages: readonly(messages), show, dismiss };
}
