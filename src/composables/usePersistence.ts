import { useBuildStore } from '@/stores/build';
import type { Build, Card } from '@/types/build';

export const BUILD_STORAGE_KEY = 'dofus-planner.build.v1';
const DEBOUNCE_MS = 250;

function isCard(c: unknown): c is Card {
  if (typeof c !== 'object' || c === null) return false;
  const obj = c as Record<string, unknown>;
  return typeof obj.id === 'string'
    && (obj.classId === null || typeof obj.classId === 'string')
    && (obj.level === null || typeof obj.level === 'number')
    && (obj.title === null || typeof obj.title === 'string')
    && typeof obj.slots === 'object' && obj.slots !== null
    && Array.isArray(obj.dofus);
}

function parseBuild(raw: string): Build | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as { version?: unknown; cards?: unknown };
    if (obj.version !== 1 || !Array.isArray(obj.cards)) return null;
    if (!obj.cards.every(isCard)) return null;
    return { version: 1, cards: obj.cards as Card[] };
  } catch {
    return null;
  }
}

export function usePersistence(): void {
  const store = useBuildStore();

  // 1. Load
  const raw = localStorage.getItem(BUILD_STORAGE_KEY);
  if (raw) {
    const parsed = parseBuild(raw);
    if (parsed && parsed.cards.length > 0) {
      store.replaceCards(parsed.cards);
    }
  }

  // 2. Save (debounced)
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  store.$subscribe(
    () => {
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const payload: Build = { version: 1, cards: store.cards };
        localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(payload));
        saveTimer = null;
      }, DEBOUNCE_MS);
    },
    { flush: 'sync' },
  );
}
