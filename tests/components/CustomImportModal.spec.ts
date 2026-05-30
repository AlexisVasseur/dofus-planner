import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const resolveCustomNames = vi.fn();
vi.mock('@/composables/useCustomShopping', async (orig) => {
  const actual = await orig<typeof import('@/composables/useCustomShopping')>();
  return { ...actual, resolveCustomNames: (...a: unknown[]) => resolveCustomNames(...a) };
});

import CustomImportModal from '@/components/CustomImportModal.vue';
import { useCustomShoppingStore } from '@/stores/customShopping';

beforeEach(() => { setActivePinia(createPinia()); resolveCustomNames.mockReset(); });

const SAMPLE = "Dragolyre\nInexistant";

describe('CustomImportModal', () => {
  it('Analyser resolves and shows valid/invalid counts WITHOUT importing', async () => {
    const store = useCustomShoppingStore();
    const spy = vi.spyOn(store, 'setEntries');
    resolveCustomNames.mockResolvedValue([
      { name: 'Dragolyre', itemId: 1 },
      { name: 'Inexistant', itemId: null },
    ]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="custom-analyser"]').trigger('click');
    await flushPromises();
    expect(resolveCustomNames).toHaveBeenCalled();
    expect(w.text()).toContain('1 valide');
    expect(w.text()).toContain('1 invalide');
    expect(w.text()).toContain('Inexistant'); // invalid name listed
    expect(spy).not.toHaveBeenCalled(); // not imported
  });

  it('Importer resolves, stores the entries, and closes', async () => {
    const store = useCustomShoppingStore();
    const spy = vi.spyOn(store, 'setEntries');
    resolveCustomNames.mockResolvedValue([{ name: 'Dragolyre', itemId: 1 }]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-textarea"]').setValue('Dragolyre');
    await w.find('[data-testid="custom-importer"]').trigger('click');
    await flushPromises();
    expect(spy).toHaveBeenCalledWith([{ name: 'Dragolyre', itemId: 1 }]);
    expect(w.emitted('close')).toBeTruthy();
  });

  it('Vider clears the stored list and closes', async () => {
    const store = useCustomShoppingStore();
    store.setEntries([{ name: 'X', itemId: 1 }]);
    const w = mount(CustomImportModal, { props: { open: true }, attachTo: document.body });
    await w.find('[data-testid="custom-vider"]').trigger('click');
    expect(store.entries).toEqual([]);
    expect(w.emitted('close')).toBeTruthy();
  });
});
