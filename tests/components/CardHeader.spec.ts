import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CardHeader from '@/components/CardHeader.vue';

const baseProps = {
  classId: 'iop' as const,
  level: 100,
  title: null,
  confirmingDelete: false,
  readonly: false,
};

describe('CardHeader — kebab menu', () => {
  it('opens the menu when the kebab is clicked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
    await w.find('[data-testid="card-kebab"]').trigger('click');
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(true);
  });

  it('closes the menu when the kebab is clicked again', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-kebab"]').trigger('click');
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });

  it('emits copy-code and closes the menu when Copier le code is picked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-copy"]').trigger('click');
    expect(w.emitted('copy-code')).toHaveLength(1);
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });

  it('emits open-dofusbook and closes the menu when Ouvrir Dofusbook is picked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-dofusbook"]').trigger('click');
    expect(w.emitted('open-dofusbook')).toHaveLength(1);
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });

  it('emits remove when Supprimer is picked, and hides Supprimer in readonly mode', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-remove"]').trigger('click');
    expect(w.emitted('remove')).toHaveLength(1);

    const ro = mount(CardHeader, { props: { ...baseProps, readonly: true } });
    await ro.find('[data-testid="card-kebab"]').trigger('click');
    expect(ro.find('[data-testid="card-menu-remove"]').exists()).toBe(false);
  });
});
