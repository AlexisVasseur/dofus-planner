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
});
