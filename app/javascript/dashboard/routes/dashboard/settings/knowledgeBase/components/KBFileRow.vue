<script setup>
import { computed } from 'vue';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  isDeleting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['view', 'delete']);

const formattedSize = computed(() => {
  const bytes = props.file.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

const statusColor = computed(() => {
  const map = {
    indexed: 'bg-n-teal-9 text-white',
    uploaded: 'bg-n-amber-9 text-white',
    failed: 'bg-n-ruby-9 text-white',
  };
  return map[props.file.status] || 'bg-n-slate-9 text-white';
});
</script>

<template>
  <tr>
    <td class="py-4 ltr:pr-4 rtl:pl-4 truncate max-w-xs font-medium" :title="file.name">
      {{ file.name }}
    </td>
    <td class="py-4 ltr:pr-4 rtl:pl-4">
      {{ formattedSize }}
    </td>
    <td class="py-4 ltr:pr-4 rtl:pl-4">
      {{ file.mimeType }}
    </td>
    <td class="py-4 ltr:pr-4 rtl:pl-4">
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="statusColor">
        {{ file.status }}
      </span>
    </td>
    <td class="py-4 flex justify-end gap-1">
      <Button
        v-tooltip.top="$t('KNOWLEDGE_BASE.ACTIONS.VIEW')"
        icon="i-lucide-eye"
        slate
        xs
        faded
        @click="emit('view', file)"
      />
      <Button
        v-tooltip.top="$t('KNOWLEDGE_BASE.ACTIONS.DELETE')"
        icon="i-lucide-trash-2"
        xs
        ruby
        faded
        :is-loading="isDeleting"
        @click="emit('delete', file)"
      />
    </td>
  </tr>
</template>
