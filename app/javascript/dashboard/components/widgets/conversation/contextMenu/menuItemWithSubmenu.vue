<script setup>
import { computed, useTemplateRef } from 'vue';
import { useWindowSize, useElementBounding } from '@vueuse/core';

defineProps({
  option: {
    type: Object,
    default: () => {},
  },
  subMenuAvailable: {
    type: Boolean,
    default: true,
  },
});

const menuRef = useTemplateRef('menuRef');
const { width: windowWidth, height: windowHeight } = useWindowSize();
const { bottom, right, left } = useElementBounding(menuRef);

const SUBMENU_HEIGHT = 240;
const SUBMENU_WIDTH = 240;

const fitsOnRight = computed(
  () => windowWidth.value - right.value >= SUBMENU_WIDTH
);
const fitsOnLeft = computed(() => left.value >= SUBMENU_WIDTH);
const fitsHorizontally = computed(() => fitsOnRight.value || fitsOnLeft.value);

const verticalPosition = computed(() => {
  const spaceBelow = windowHeight.value - bottom.value;
  if (!fitsHorizontally.value) {
    return 'top-full';
  }
  return spaceBelow < SUBMENU_HEIGHT ? 'bottom-0' : 'top-0';
});

const horizontalPosition = computed(() => {
  if (!fitsHorizontally.value) {
    return 'left-0 right-0';
  }
  return fitsOnRight.value ? 'left-full' : 'right-full';
});

const submenuPosition = computed(() => [
  verticalPosition.value,
  horizontalPosition.value,
]);
</script>

<template>
  <div
    ref="menuRef"
    class="text-n-slate-12 menu-with-submenu min-width-calc w-full p-1 flex items-center h-7 rounded-md relative hover:bg-n-brand hover:text-white cursor-pointer"
    :class="!subMenuAvailable ? 'opacity-50 cursor-not-allowed' : ''"
  >
    <div class="flex items-center h-4">
      <fluent-icon :icon="option.icon" size="14" class="menu-icon" />
      <p class="my-0 mx-2 text-xs">{{ option.label }}</p>
    </div>
    <fluent-icon icon="chevron-right" size="12" />
    <div
      v-if="subMenuAvailable"
      class="submenu bg-n-solid-1 p-1 shadow-lg rounded-md absolute hidden max-h-[15rem] overflow-y-auto overflow-x-hidden cursor-pointer outline-1 outline outline-n-weak z-10"
      :class="submenuPosition"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.menu-with-submenu {
  min-width: calc(6.25rem * 2);

  &:hover {
    .submenu {
      @apply block;
    }
  }
}
</style>
