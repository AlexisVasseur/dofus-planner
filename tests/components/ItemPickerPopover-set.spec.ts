import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

// Mock the set-search composable so no network happens.
const setResults = ref([
  { id: 1, name: 'Panoplie du Bouftou', level: 20, itemIds: [101, 102] },
]);
vi.mock('@/composables/useItemSetSearch', () => ({
  useItemSetSearch: () => ({
    results: setResults,
    loading: ref(false),
    loadingMore: ref(false),
    error: ref<string | null>(null),
    hasMore: ref(false),
    loadMore: vi.fn(),
  }),
}));

// Spy on ensureItems; keep the rest of the catalog real.
const ensureItems = vi.fn().mockResolvedValue(undefined);
vi.mock('@/composables/useItemCatalog', async (orig) => {
  const actual = await orig<typeof import('@/composables/useItemCatalog')>();
  return { ...actual, ensureItems: (...a: number[][]) => ensureItems(...a) };
});

import ItemPickerPopover from '@/components/ItemPickerPopover.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';

beforeEach(() => {
  setActivePinia(createPinia());
  ensureItems.mockClear();
});

describe('ItemPickerPopover — set mode', () => {
  it('shows the panoplie title and renders set rows', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    ui.openItemPicker({ kind: 'set', cardId: build.cards[0].id });
    const w = mount(ItemPickerPopover, { attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.text()).toContain('panoplie');
    expect(w.text()).toContain('Panoplie du Bouftou');
    expect(w.text()).toContain('2 pièces');
  });

  it('clicking a set ensures its items then equips them and closes', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    const equipSpy = vi.spyOn(build, 'equipItemSet');
    const cardId = build.cards[0].id;
    ui.openItemPicker({ kind: 'set', cardId });

    const w = mount(ItemPickerPopover, { attachTo: document.body });
    await w.vm.$nextTick();
    await w.find('[data-testid="set-row"]').trigger('click');
    await Promise.resolve(); // let the awaited ensureItems resolve
    await w.vm.$nextTick();

    expect(ensureItems).toHaveBeenCalledWith([101, 102]);
    expect(equipSpy).toHaveBeenCalledWith(cardId, [101, 102]);
    expect(ui.itemPickerTarget).toBeNull();
  });
});
