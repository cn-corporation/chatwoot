<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { provideMessageContext } from './provider';
import BaseBubble from './bubbles/Base.vue';
import FormattedContent from './bubbles/Text/FormattedContent.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import RetentionAttachment from './RetentionAttachment.vue';

const props = defineProps({
  message: { type: Object, required: true },
  canRetry: { type: Boolean, default: false },
  canManage: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  confirmingDelete: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits([
  'retry',
  'startEdit',
  'cancelEdit',
  'saveEdit',
  'startDelete',
  'cancelDelete',
  'confirmDelete',
]);
const { t } = useI18n();
const editedContent = ref('');
const deleted = computed(
  () => props.message.content_attributes?.deleted === true
);
const wasEdited = computed(() =>
  props.message.content_attributes?.retention_revisions?.some(
    revision => revision.action === 'edit'
  )
);
const canSaveEdit = computed(
  () =>
    !!(editedContent.value.trim() || props.message.attachments?.length) &&
    editedContent.value !== (props.message.content || '')
);
function startEdit() {
  editedContent.value = props.message.content || '';
  emit('startEdit', props.message.id);
}
const outgoing = computed(() =>
  [1, 'outgoing'].includes(props.message.message_type)
);
const activity = computed(() =>
  [2, 'activity'].includes(props.message.message_type)
);
const variant = computed(() => {
  if (activity.value) return 'activity';
  if (props.message.private) return 'private';
  if (props.message.status === 'failed') return 'error';
  return outgoing.value ? 'agent' : 'user';
});
provideMessageContext({
  variant,
  orientation: computed(() => (outgoing.value ? 'right' : 'left')),
  inReplyTo: ref(null),
  shouldGroupWithNext: ref(false),
});
const timestamp = computed(() => {
  const date = props.message.created_at;
  return new Date(
    typeof date === 'number' ? date * 1000 : date
  ).toLocaleString();
});
</script>

<template>
  <article
    class="flex flex-col gap-1"
    :class="outgoing ? 'items-end' : 'items-start'"
  >
    <span class="text-xs text-n-slate-11">
      {{ message.sender?.name || t('RETENTION.SYSTEM') }}
      <span v-if="message.private">{{ t('RETENTION.PRIVATE_LABEL') }}</span>
    </span>
    <BaseBubble
      hide-meta
      class="px-3 py-2 min-w-0 !max-w-full md:!max-w-lg break-words"
    >
      <p v-if="deleted" class="text-sm italic text-n-slate-11">
        {{ t('RETENTION.DELETED_MESSAGE') }}
      </p>
      <template v-else-if="editing">
        <RetentionAttachment
          v-for="attachment in message.attachments || []"
          :key="attachment.id"
          :attachment="attachment"
        />
        <label :for="`retention-edit-${message.id}`" class="sr-only">
          {{ t('RETENTION.EDIT_MESSAGE') }}
        </label>
        <textarea
          :id="`retention-edit-${message.id}`"
          v-model="editedContent"
          rows="3"
          class="!mb-2 min-w-64 resize-y !text-n-slate-12"
          :disabled="busy"
          @keydown.esc="emit('cancelEdit')"
          @keydown.ctrl.enter.prevent="
            emit('saveEdit', message.id, editedContent)
          "
          @keydown.meta.enter.prevent="
            emit('saveEdit', message.id, editedContent)
          "
        />
        <div class="flex justify-end gap-2">
          <Button
            :label="t('RETENTION.CANCEL')"
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="emit('cancelEdit')"
          />
          <Button
            :label="t('RETENTION.SAVE_EDIT')"
            size="sm"
            :disabled="busy || !canSaveEdit"
            @click="emit('saveEdit', message.id, editedContent)"
          />
        </div>
      </template>
      <template v-else>
        <FormattedContent v-if="message.content" :content="message.content" />
        <RetentionAttachment
          v-for="attachment in message.attachments || []"
          :key="attachment.id"
          :attachment="attachment"
        />
        <span v-if="wasEdited" class="block text-xs text-n-slate-10">
          {{ t('RETENTION.EDITED') }}
        </span>
      </template>
      <p v-if="message.status === 'failed' && !deleted" class="text-xs mt-1">
        {{ t('RETENTION.DELIVERY_FAILED') }}
      </p>
      <p
        v-else-if="
          outgoing &&
          message.retention_session_id &&
          !message.source_id &&
          !deleted
        "
        class="text-xs mt-1"
      >
        {{ t('RETENTION.SENDING') }}
      </p>
      <Button
        v-if="canRetry && message.status === 'failed' && !deleted"
        :label="t('RETENTION.RETRY')"
        variant="ghost"
        size="sm"
        @click="emit('retry', message.id)"
      />
    </BaseBubble>
    <div
      v-if="canManage && !editing && !deleted"
      class="flex items-center gap-1"
    >
      <template v-if="confirmingDelete">
        <span v-if="message.source_id" class="text-xs text-n-slate-11">
          {{ t('RETENTION.DELETE_CONFIRM') }}
        </span>
        <span v-else class="text-xs text-n-slate-11">
          {{ t('RETENTION.DELETE_UNSENT_CONFIRM') }}
        </span>
        <Button
          :label="t('RETENTION.CANCEL')"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="emit('cancelDelete')"
        />
        <Button
          :label="t('RETENTION.CONFIRM_DELETE')"
          variant="ghost"
          size="sm"
          class="text-n-ruby-11"
          :disabled="busy"
          @click="emit('confirmDelete', message.id)"
        />
      </template>
      <template v-else>
        <Button
          :label="t('RETENTION.EDIT')"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="startEdit"
        />
        <Button
          :label="t('RETENTION.DELETE')"
          variant="ghost"
          size="sm"
          class="text-n-ruby-11"
          :disabled="busy"
          @click="emit('startDelete', message.id)"
        />
      </template>
    </div>
    <time class="text-xs text-n-slate-10">{{ timestamp }}</time>
  </article>
</template>
