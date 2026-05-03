import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useBuildStore, makeFreshFirstCard } from '@/stores/build';
import { usePersistence, BUILD_STORAGE_KEY } from '@/composables/usePersistence';

describe('usePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('loads existing build from localStorage on init', () => {
    const card = makeFreshFirstCard();
    card.level = 42;
    card.classId = 'iop';
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ version: 1, cards: [card] }));
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(42);
    expect(s.cards[0].classId).toBe('iop');
  });

  it('persists a debounced snapshot 250ms after a mutation', async () => {
    const s = useBuildStore();
    usePersistence();
    s.setLevel(s.cards[0].id, 7);
    await nextTick();
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(250);
    const stored = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY)!);
    expect(stored.version).toBe(1);
    expect(stored.cards[0].level).toBe(7);
  });

  it('coalesces rapid mutations into a single write', async () => {
    const s = useBuildStore();
    usePersistence();
    s.setLevel(s.cards[0].id, 1);
    s.setLevel(s.cards[0].id, 2);
    s.setLevel(s.cards[0].id, 3);
    vi.advanceTimersByTime(125);
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(125);
    const stored = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY)!);
    expect(stored.cards[0].level).toBe(3);
  });

  it('ignores corrupt JSON in localStorage and keeps default state', () => {
    localStorage.setItem(BUILD_STORAGE_KEY, '{ not json');
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(1);
    expect(s.cards[0].classId).toBeNull();
  });

  it('ignores stored payload with wrong version', () => {
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ version: 999, cards: [] }));
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(1);
  });
});
