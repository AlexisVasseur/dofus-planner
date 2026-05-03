import { onMounted, onUnmounted, type Ref } from 'vue';

export interface DragMath {
  startScrollLeft: number;
  deltaX: number;
  ratio: number;
}

export function computeScrollFromDrag({ startScrollLeft, deltaX, ratio }: DragMath): number {
  return Math.max(0, startScrollLeft + deltaX * ratio);
}

export interface UseDragScrollOpts {
  trackRef: Ref<HTMLElement | null>;
  scrollRef: Ref<HTMLElement | null>;
}

export function useDragScroll({ trackRef, scrollRef }: UseDragScrollOpts): void {
  let startX = 0;
  let startScrollLeft = 0;
  let dragging = false;

  function getRatio(): number {
    const track = trackRef.value;
    const scroll = scrollRef.value;
    if (!track || !scroll || track.clientWidth === 0) return 1;
    return scroll.scrollWidth / track.clientWidth;
  }

  function onPointerDown(e: PointerEvent): void {
    const track = trackRef.value;
    const scroll = scrollRef.value;
    if (!track || !scroll) return;
    dragging = true;
    startX = e.clientX;
    startScrollLeft = scroll.scrollLeft;

    // Click-to-jump (no drag) when pointer up without movement is handled via "deltaX === 0" branch:
    // we initially center scroll on the click position relative to the track.
    const trackRect = track.getBoundingClientRect();
    const clickRatio = (e.clientX - trackRect.left) / trackRect.width;
    const targetScroll = clickRatio * scroll.scrollWidth - scroll.clientWidth / 2;
    scroll.scrollLeft = Math.max(0, targetScroll);
    startScrollLeft = scroll.scrollLeft;

    track.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const scroll = scrollRef.value;
    if (!scroll) return;
    const deltaX = e.clientX - startX;
    scroll.scrollLeft = computeScrollFromDrag({
      startScrollLeft,
      deltaX,
      ratio: getRatio(),
    });
  }

  function onPointerUp(e: PointerEvent): void {
    dragging = false;
    const track = trackRef.value;
    if (track && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  }

  function attach(): void {
    const track = trackRef.value;
    if (!track) return;
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
  }

  function detach(): void {
    const track = trackRef.value;
    if (!track) return;
    track.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('pointerup', onPointerUp);
    track.removeEventListener('pointercancel', onPointerUp);
  }

  onMounted(attach);
  onUnmounted(detach);
}
