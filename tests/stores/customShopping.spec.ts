import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useCustomShoppingStore } from '@/stores/customShopping';

const KEY = 'dofus-planner.shopping.custom.v1';

describe('customShopping store', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

  it('defaults to an empty list', () => {
    expect(useCustomShoppingStore().entries).toEqual([]);
  });

  it('setEntries replaces the list; clear empties it', () => {
    const s = useCustomShoppingStore();
    s.setEntries([{ name: 'A', itemId: 1 }, { name: 'B', itemId: null }]);
    expect(s.entries).toHaveLength(2);
    s.setEntries([{ name: 'C', itemId: 3 }]);
    expect(s.entries).toEqual([{ name: 'C', itemId: 3 }]);
    s.clear();
    expect(s.entries).toEqual([]);
  });

  it('persists across a reload (rehydrates from localStorage)', async () => {
    const s = useCustomShoppingStore();
    s.setEntries([{ name: 'A', itemId: 1 }]);
    await nextTick();
    setActivePinia(createPinia());
    expect(useCustomShoppingStore().entries).toEqual([{ name: 'A', itemId: 1 }]);
  });

  it('falls back to empty on corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    setActivePinia(createPinia());
    expect(useCustomShoppingStore().entries).toEqual([]);
  });
});
