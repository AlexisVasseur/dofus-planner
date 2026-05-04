import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ItemRow from '@/components/ItemRow.vue';
import type { Item } from '@/data/dofusdb';

const TEST_ITEM: Item = {
  id: 1,
  name: 'Coiffe Bouftou',
  levelRequired: 21,
  iconUrl: '',
  stats: [],
  typeId: 16,
};

describe('ItemRow', () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders item name and level badge', () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    expect(w.text()).toContain('Coiffe Bouftou');
    expect(w.text()).toContain('lv 21');
  });

  it('clicking the copy button writes the item name to the clipboard', async () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('button[aria-label="Copier le nom"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('Coiffe Bouftou');
  });

  it('clicking the item name writes the item name to the clipboard', async () => {
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('[data-testid="item-name"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('Coiffe Bouftou');
  });

  it('shows ✓ feedback after copy', async () => {
    vi.useFakeTimers();
    const w = mount(ItemRow, { props: { item: TEST_ITEM, fallbackSlot: 'coiffe' } });
    await w.find('button[aria-label="Copier le nom"]').trigger('click');
    await flushPromises();
    expect(w.find('button[aria-label="Copier le nom"]').text()).toBe('✓');
    vi.advanceTimersByTime(1300);
    await flushPromises();
    expect(w.find('button[aria-label="Copier le nom"]').text()).toBe('⧉');
    vi.useRealTimers();
  });
});
