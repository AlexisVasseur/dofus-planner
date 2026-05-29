import { beforeEach } from 'vitest';
import { config } from '@vue/test-utils';

// Render <Teleport> content inline (within the mounted wrapper) so component tests
// can read teleported markup via wrapper.text()/find() instead of having to reach
// into document.body. Components that teleport to body (e.g. ItemPickerPopover) rely
// on this for their DOM assertions.
//
// We MERGE into the existing global stubs rather than reassigning the object, so the
// default <Transition>/<TransitionGroup> stubs (which make v-if toggles render
// synchronously) stay in place — overwriting them breaks components like CardHeader
// whose menu open/close is wrapped in a <Transition>.
config.global.stubs = { ...config.global.stubs, teleport: true };

beforeEach(() => {
  localStorage.clear();
});
