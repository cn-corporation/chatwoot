import { computed } from 'vue';
import { useWindowSize } from '@vueuse/core';
import wootConstants from 'dashboard/constants/globals';

export function useIsMobile() {
  const { width } = useWindowSize();
  const isMobile = computed(
    () => width.value < wootConstants.SMALL_SCREEN_BREAKPOINT
  );
  return { isMobile, width };
}
