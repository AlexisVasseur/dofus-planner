import { ref, type Ref } from 'vue';

// Module-scoped so the same listener serves every consumer (many tooltips can be mounted
// simultaneously — a single window-level mousemove is far cheaper than one per instance).
const mouseX = ref(0);
const mouseY = ref(0);
let attached = false;

function attach(): void {
  if (attached || typeof window === 'undefined') return;
  window.addEventListener('mousemove', (e) => {
    mouseX.value = e.clientX;
    mouseY.value = e.clientY;
  }, { passive: true });
  attached = true;
}

export function useMousePosition(): { x: Ref<number>; y: Ref<number> } {
  attach();
  return { x: mouseX, y: mouseY };
}
