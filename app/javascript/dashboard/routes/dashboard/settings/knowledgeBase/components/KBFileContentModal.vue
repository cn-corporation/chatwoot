<script setup>
import { computed } from 'vue';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  fileContent: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close']);

const fileName = computed(() => props.fileContent?.name || '');
const content = computed(() => props.fileContent?.content || '');
</script>

<template>
  <woot-modal :show="show" :on-close="() => emit('close')">
    <div class="flex flex-col h-auto w-full max-w-2xl">
      <header class="flex items-center justify-between p-4 border-b border-n-weak">
        <h2 class="text-lg font-semibold text-n-slate-12 truncate">
          {{ fileName }}
        </h2>
        <Button
          icon="i-lucide-x"
          xs
          slate
          faded
          @click="emit('close')"
        />
      </header>
      <div class="p-4 overflow-auto max-h-[60vh]">
        <woot-loading-state
          v-if="isLoading"
          :message="$t('KNOWLEDGE_BASE.CONTENT_MODAL.LOADING')"
        />
        <pre
          v-else
          class="whitespace-pre-wrap break-words text-sm text-n-slate-11 font-mono"
        >{{ content }}</pre>
      </div>
    </div>
  </woot-modal>
</template>
