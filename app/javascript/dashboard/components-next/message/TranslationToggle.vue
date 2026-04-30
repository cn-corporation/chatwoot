<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  showingOriginal: Boolean,
  isLoading: { type: Boolean, default: false },
});

defineEmits(['toggle']);
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center text-xs text-n-slate-11 hover:underline select-none rounded px-1.5 py-1 -mx-1 min-h-[28px] hover:bg-n-alpha-2 active:bg-n-alpha-3"
    :class="{ 'opacity-60 pointer-events-none': isLoading }"
    @click="$emit('toggle')"
  >
    {{
      isLoading
        ? $t('CONVERSATION.TRANSLATING')
        : showingOriginal
          ? $t('CONVERSATION.VIEW_TRANSLATED')
          : $t('CONVERSATION.VIEW_ORIGINAL')
    }}
  </button>
</template>
