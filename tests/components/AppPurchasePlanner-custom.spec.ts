import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppPurchasePlanner from '@/components/AppPurchasePlanner.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useCustomShoppingStore } from '@/stores/customShopping';
import { populateCache } from '@/composables/useItemCatalog';

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

describe('AppPurchasePlanner — custom', () => {
  it('renders the custom-import modal when ui.customImportOpen is set (trigger lives in the minimap)', async () => {
    const ui = useUiStore();
    ui.setViewMode('purchase');
    ui.openCustomImport();
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.find('[data-testid="custom-textarea"]').exists()).toBe(true);
  });

  it('renders the Inconnu panel with the unknown names', async () => {
    useUiStore().setViewMode('purchase');
    useCustomShoppingStore().setEntries([{ name: 'Truc Inconnu', itemId: null }]);
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.text()).toContain('Inconnu');
    expect(w.text()).toContain('Truc Inconnu');
  });

  it('badges a custom-injected item', async () => {
    populateCache([{ id: 900, name: 'Dragolyre', levelRequired: 32, iconUrl: '', stats: [], typeId: 1 }]);
    useUiStore().setViewMode('purchase');
    useBuildStore().replaceCards([{
      id: 'c1', classId: 'iop', level: 1, title: null,
      slots: Object.fromEntries(['coiffe','cape','amulette','anneau1','anneau2','ceinture','bottes','arme','bouclier','familier'].map((s) => [s, null])) as never,
      dofus: [null, null, null, null, null, null],
    }]);
    useCustomShoppingStore().setEntries([{ name: 'Dragolyre', itemId: 900 }]);
    const w = mount(AppPurchasePlanner, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.find('[data-testid="custom-badge"]').exists()).toBe(true);
  });
});
