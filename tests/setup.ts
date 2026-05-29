import { beforeEach } from 'vitest';
import { config } from '@vue/test-utils';

// Render teleported content inline so component tests can query it via the wrapper.
// Spread existing stubs so any other project-level stubs added here are preserved.
config.global.stubs = { ...config.global.stubs, teleport: true };

beforeEach(() => {
  localStorage.clear();
});
