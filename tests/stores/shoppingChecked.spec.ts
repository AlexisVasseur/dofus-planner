import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useShoppingCheckedStore, itemCheckKey, nameCheckKey } from '@/stores/shoppingChecked';

const KEY = 'dofus-planner.shopping.checked.v1';

describe('shoppingChecked store', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

  it('nothing checked by default', () => {
    const s = useShoppingCheckedStore();
    expect(s.isChecked(itemCheckKey(1))).toBe(false);
  });

  it('toggle adds then removes a key', () => {
    const s = useShoppingCheckedStore();
    s.toggle(itemCheckKey(900));
    expect(s.isChecked(itemCheckKey(900))).toBe(true);
    s.toggle(itemCheckKey(900));
    expect(s.isChecked(itemCheckKey(900))).toBe(false);
  });

  it('itemCheckKey and nameCheckKey are distinct namespaces', () => {
    const s = useShoppingCheckedStore();
    s.toggle(nameCheckKey('Truc'));
    expect(s.isChecked(nameCheckKey('Truc'))).toBe(true);
    expect(s.isChecked(itemCheckKey(0))).toBe(false);
    expect(itemCheckKey(5)).not.toBe(nameCheckKey('5'));
  });

  it('persists across a reload', async () => {
    const s = useShoppingCheckedStore();
    s.toggle(itemCheckKey(7));
    s.toggle(nameCheckKey('Inconnu X'));
    await nextTick();
    setActivePinia(createPinia());
    const again = useShoppingCheckedStore();
    expect(again.isChecked(itemCheckKey(7))).toBe(true);
    expect(again.isChecked(nameCheckKey('Inconnu X'))).toBe(true);
  });

  it('falls back to empty on corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    setActivePinia(createPinia());
    expect(useShoppingCheckedStore().isChecked(itemCheckKey(1))).toBe(false);
  });
});
