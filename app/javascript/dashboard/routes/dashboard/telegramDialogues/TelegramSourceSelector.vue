<script setup>
import { ref, computed } from 'vue';
import { onClickOutside } from '@vueuse/core';

const props = defineProps({
  sources: { type: Array, default: () => [] },
  activeSourceId: { type: String, default: null },
});

const emit = defineEmits(['select']);

const isOpen = ref(false);
const rootRef = ref(null);

onClickOutside(rootRef, () => {
  isOpen.value = false;
});

const activeSource = computed(() =>
  props.sources.find(source => source.id === props.activeSourceId)
);

const activeLabel = computed(() => activeSource.value?.name || '');

const toggle = () => {
  isOpen.value = !isOpen.value;
};

const select = sourceId => {
  emit('select', sourceId);
  isOpen.value = false;
};
</script>

<template>
  <div class="p-3 border-b border-n-weak">
    <div ref="rootRef" class="relative w-full">
      <button
        type="button"
        class="flex items-center w-full gap-2 rounded-lg border border-n-weak bg-n-solid-3 pl-3 pr-2 py-1.5 text-sm text-n-slate-12 outline-none cursor-pointer hover:bg-n-alpha-2"
        @click="toggle"
      >
        <span class="flex-1 min-w-0 truncate text-left">{{ activeLabel }}</span>
        <span
          class="i-lucide-chevron-down size-4 text-n-slate-11 flex-shrink-0 transition-transform"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>
      <ul
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-n-weak bg-n-solid-2 shadow-lg py-1 list-none m-0"
      >
        <li
          v-for="source in sources"
          :key="source.id"
          class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-n-alpha-2"
          :class="
            source.id === activeSourceId
              ? 'text-n-slate-12 font-medium'
              : 'text-n-slate-11'
          "
          @click="select(source.id)"
        >
          <span class="flex-1 min-w-0 truncate">{{ source.name }}</span>
          <span
            v-if="source.id === activeSourceId"
            class="i-lucide-check size-4 text-n-blue-text flex-shrink-0"
          />
        </li>
      </ul>
    </div>
  </div>
</template>
