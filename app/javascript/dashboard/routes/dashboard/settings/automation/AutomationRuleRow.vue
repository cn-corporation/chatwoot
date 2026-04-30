<script setup>
import { computed } from 'vue';
import { messageStamp } from 'shared/helpers/timeHelper';
import Button from 'dashboard/components-next/button/Button.vue';
import ToggleSwitch from 'dashboard/components-next/switch/Switch.vue';

const props = defineProps({
  automation: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle', 'edit', 'delete', 'clone']);

const readableDate = date => messageStamp(new Date(date), 'LLL d, yyyy');
const readableDateWithTime = date =>
  messageStamp(new Date(date), 'LLL d, yyyy hh:mm a');

const automationActive = computed({
  get: () => props.automation.active,
  set: active => {
    const { id, name } = props.automation;
    emit('toggle', {
      id,
      name,
      status: !active,
    });
  },
});
</script>

<template>
  <tr class="flex md:table-row gap-2 py-3 md:py-0 items-center">
    <td
      class="py-0 md:py-4 ltr:pr-4 rtl:pl-4 md:min-w-[200px] flex-1 min-w-0 md:flex-initial"
    >
      <div class="font-medium md:font-normal truncate">
        {{ automation.name }}
      </div>
      <div class="block md:hidden text-xs text-n-slate-10 mt-0.5 line-clamp-2">
        {{ automation.description }}
      </div>
      <div class="block md:hidden text-[10px] text-n-slate-9 mt-0.5">
        {{ readableDate(automation.created_on) }}
      </div>
    </td>
    <td class="hidden md:table-cell py-4 ltr:pr-4 rtl:pl-4">
      {{ automation.description }}
    </td>
    <td class="py-0 md:py-4 ltr:pr-4 rtl:pl-4 flex-shrink-0">
      <ToggleSwitch v-model="automationActive" />
    </td>
    <td
      class="hidden md:table-cell py-4 ltr:pr-4 rtl:pl-4 min-w-[12px]"
      :title="readableDateWithTime(automation.created_on)"
    >
      {{ readableDate(automation.created_on) }}
    </td>
    <td class="py-0 md:py-4 md:min-w-xs flex-shrink-0">
      <div class="flex gap-1 justify-end flex-shrink-0">
        <Button
          v-tooltip.top="$t('AUTOMATION.FORM.EDIT')"
          icon="i-lucide-pen"
          slate
          xs
          faded
          :is-loading="loading"
          @click="$emit('edit', automation)"
        />
        <Button
          v-tooltip.top="$t('AUTOMATION.CLONE.TOOLTIP')"
          icon="i-lucide-copy-plus"
          xs
          faded
          :is-loading="loading"
          @click="$emit('clone', automation)"
        />
        <Button
          v-tooltip.top="$t('AUTOMATION.FORM.DELETE')"
          :is-loading="loading"
          icon="i-lucide-trash-2"
          xs
          ruby
          faded
          @click="$emit('delete', automation)"
        />
      </div>
    </td>
  </tr>
</template>
