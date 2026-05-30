import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppMiniMap from '@/components/AppMiniMap.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { populateCache } from '@/composables/useItemCatalog';
import { SLOT_ORDER } from '@/types/slots';
import type { Card } from '@/types/build';

function makeCard(partial: Partial<Card> = {}): Card {
  const slots = Object.fromEntries(SLOT_ORDER.map((s) => [s, null])) as Card['slots'];
  return {
    id: 'c1', classId: 'iop', level: 1, title: null,
    slots, dofus: [null, null, null, null, null, null],
    ...partial,
  };
}

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });

describe('AppMiniMap — shopping room counts', () => {
  it('shows per-room counts and a TOTAL block in shopping mode', async () => {
    populateCache([{ id: 1, name: 'Coiffe', levelRequired: 1, iconUrl: '', stats: [], typeId: 16 }]);
    useUiStore().setViewMode('purchase');
    const build = useBuildStore();
    build.replaceCards([makeCard({ slots: { ...makeCard().slots, coiffe: { itemId: 1 } } })]);

    const w = mount(AppMiniMap, { props: { scrollRef: null }, attachTo: document.body });
    await w.vm.$nextTick();

    expect(w.find('[data-testid="room-count-1-49"]').text()).toBe('1 items');
    const total = w.find('[data-testid="minimap-total"]');
    expect(total.exists()).toBe(true);
    expect(total.text()).toContain('TOTAL');
    expect(total.text()).toContain('1');
  });

  it('does not render the TOTAL block in builder mode', async () => {
    useUiStore().setViewMode('build');
    useBuildStore().replaceCards([makeCard({ level: 42 })]);
    const w = mount(AppMiniMap, { props: { scrollRef: null }, attachTo: document.body });
    await w.vm.$nextTick();
    expect(w.find('[data-testid="minimap-total"]').exists()).toBe(false);
    expect(w.text()).toContain('Lv 42');
  });
});
