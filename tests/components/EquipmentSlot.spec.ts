import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EquipmentSlot from '@/components/EquipmentSlot.vue';

describe('EquipmentSlot', () => {
  it('renders empty state with the slot label uppercase', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'amulette',
        item: null,
        cardLevel: 50,
      },
    });
    expect(w.text()).toContain('AMULETTE');
    expect(w.classes().join(' ')).toContain('is-empty');
  });

  it('renders filled state with item name', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Bouftou', levelRequired: 25, iconUrl: '', stats: [], typeId: 0 },
        cardLevel: 50,
      },
    });
    expect(w.text()).toContain('Coiffe Bouftou');
    expect(w.classes().join(' ')).toContain('is-filled');
  });

  it('flags over-leveled when item.levelRequired > cardLevel', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Royal', levelRequired: 200, iconUrl: '', stats: [], typeId: 0 },
        cardLevel: 50,
      },
    });
    expect(w.classes().join(' ')).toContain('is-over-lvl');
    expect(w.text()).toContain('lv 200');
  });

  it('does not flag over-leveled when card level is null', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Royal', levelRequired: 200, iconUrl: '', stats: [], typeId: 0 },
        cardLevel: null,
      },
    });
    expect(w.classes().join(' ')).not.toContain('is-over-lvl');
  });
});
