<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  showingOriginal: Boolean,
  isLoading: { type: Boolean, default: false },
});

defineEmits(['toggle']);
</script>

<template>
  <span>
    <span
      class="text-xs text-n-slate-11 cursor-pointer hover:underline select-none"
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
    </span>
  </span>
</template>
