import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const resolveDofusbookItems = vi.fn();
vi.mock('@/composables/useDofusbookImport', () => ({
  resolveDofusbookItems: (...a: unknown[]) => resolveDofusbookItems(...a),
}));

import CardCodeImportModal from '@/components/CardCodeImportModal.vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';

function slotsWithCoiffe() {
  return {
    coiffe: { itemId: 1 }, cape: null, amulette: null, anneau1: null, anneau2: null,
    ceinture: null, bottes: null, arme: null, bouclier: null, familier: null,
  };
}
function emptySlots() {
  return {
    coiffe: null, cape: null, amulette: null, anneau1: null, anneau2: null,
    ceinture: null, bottes: null, arme: null, bouclier: null, familier: null,
  };
}
// A minimal page the parser recognizes: a "Dofusbook" tab line before the header,
// the level under "Niv. Stuff", and the item-region anchors. resolveDofusbookItems
// is mocked, so the item names here don't need to resolve to anything real.
const SAMPLE = [
  'Dofusbook',
  'Feca 133 - Draegnerys',
  '',
  'Niv. Stuff',
  'Niveau 133',
  '',
  'Some Item',
  'Boosts actifs (0)',
  'Another Item',
  'Résumé du stuff',
].join('\n');

beforeEach(() => {
  setActivePinia(createPinia());
  resolveDofusbookItems.mockReset();
});

describe('CardCodeImportModal — Dofusbook mode', () => {
  it('switching to Dofusbook mode shows the paste textarea', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    ui.openCodeImport(build.cards[0].id);
    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    expect(w.find('[data-testid="dofusbook-textarea"]').exists()).toBe(true);
  });

  it('imports: parses header, resolves, creates a card, toasts', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    resolveDofusbookItems.mockResolvedValue({
      slots: slotsWithCoiffe(),
      dofus: [null, null, null, null, null, null],
      unresolved: ['Forcené'],
      resolvedCount: 1,
    });
    const addSpy = vi.spyOn(build, 'addCardAfter');
    const afterId = build.cards[0].id;
    ui.openCodeImport(afterId);

    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    await w.find('[data-testid="dofusbook-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="import-submit"]').trigger('click');
    await flushPromises();

    expect(resolveDofusbookItems).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledTimes(1);
    const inserted = addSpy.mock.calls[0][1];
    expect(inserted.classId).toBe('feca');
    expect(inserted.level).toBe(133);
    expect(inserted.title).toBe('Draegnerys');
    expect(inserted.slots.coiffe).toEqual({ itemId: 1 });
    expect(ui.codeImportAfterCardId).toBeNull(); // modal closed
  });

  it('does not create a card when nothing resolves', async () => {
    const ui = useUiStore();
    const build = useBuildStore();
    resolveDofusbookItems.mockResolvedValue({
      slots: emptySlots(),
      dofus: [null, null, null, null, null, null],
      unresolved: ['X'],
      resolvedCount: 0,
    });
    const addSpy = vi.spyOn(build, 'addCardAfter');
    ui.openCodeImport(build.cards[0].id);

    const w = mount(CardCodeImportModal, { attachTo: document.body });
    await w.find('[data-testid="import-mode-dofusbook"]').trigger('click');
    await w.find('[data-testid="dofusbook-textarea"]').setValue(SAMPLE);
    await w.find('[data-testid="import-submit"]').trigger('click');
    await flushPromises();

    expect(addSpy).not.toHaveBeenCalled();
    expect(ui.codeImportAfterCardId).not.toBeNull(); // still open, error shown
  });
});
