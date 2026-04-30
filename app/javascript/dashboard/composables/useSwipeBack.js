import { onMounted, onBeforeUnmount } from 'vue';

const SWIPE_TRIGGER_PX = 80;
const SWIPE_MAX_VERTICAL_PX = 60;
const SWIPE_EDGE_START_PX = 50;

export function useSwipeBack(targetRef, onSwipeBack, options = {}) {
  const { enabled = () => true, edgeStart = SWIPE_EDGE_START_PX } = options;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const handleTouchStart = event => {
    if (!enabled()) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (touch.clientX > edgeStart) return;
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  };

  const handleTouchEnd = event => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);
    if (deltaX > SWIPE_TRIGGER_PX && deltaY < SWIPE_MAX_VERTICAL_PX) {
      onSwipeBack();
    }
  };

  const attach = () => {
    const el = targetRef.value;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
  };

  const detach = () => {
    const el = targetRef.value;
    if (!el) return;
    el.removeEventListener('touchstart', handleTouchStart);
    el.removeEventListener('touchend', handleTouchEnd);
  };

  onMounted(attach);
  onBeforeUnmount(detach);

  return { attach, detach };
}
