<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import Modal from 'dashboard/components/Modal.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  conversationId: {
    type: Number,
    required: true,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'success']);

const { t } = useI18n();
const store = useStore();

const isOpen = ref(props.show);
const selectedTopics = ref([]);
const isSubmitting = ref(false);

const LEGACY_LABEL_TO_VALUE = {
  '💰 Пополнение / Вывод': 'deposits',
  '💰 Пополнение': 'deposits',
  '💸 Вывод': 'withdrawals',
  '📝 Регистрация и вход': 'registration_login',
  '🎁 Бонусы и рейкбек': 'bonuses_rakeback',
  '🚨 Жалоба / Нарушение': 'complaint',
  '❓ Другое': 'other',
};

const closeTopics = computed(() => [
  {
    value: 'deposits',
    label: t('CLOSE_TOPICS.TOPIC_DEPOSITS'),
  },
  {
    value: 'withdrawals',
    label: t('CLOSE_TOPICS.TOPIC_WITHDRAWALS'),
  },
  {
    value: 'registration_login',
    label: t('CLOSE_TOPICS.TOPIC_REGISTRATION_LOGIN'),
  },
  {
    value: 'bonuses_rakeback',
    label: t('CLOSE_TOPICS.TOPIC_BONUSES_RAKEBACK'),
  },
  {
    value: 'complaint',
    label: t('CLOSE_TOPICS.TOPIC_COMPLAINT'),
  },
  {
    value: 'other',
    label: t('CLOSE_TOPICS.TOPIC_OTHER'),
  },
]);

watch(
  () => props.show,
  newVal => {
    isOpen.value = newVal;
    if (newVal) {
      const conversation = store.getters.getConversationById(
        props.conversationId
      );
      const rawBotTopic = conversation?.custom_attributes?.bot_topic;
      const botTopic = LEGACY_LABEL_TO_VALUE[rawBotTopic] || rawBotTopic;
      const matched = closeTopics.value.find(ct => ct.value === botTopic);
      if (matched) {
        selectedTopics.value = [matched.value];
      } else {
        selectedTopics.value = [];
      }
    }
  },
  { immediate: true }
);

const toggleTopic = topicValue => {
  const index = selectedTopics.value.indexOf(topicValue);
  if (index > -1) {
    selectedTopics.value.splice(index, 1);
  } else {
    selectedTopics.value.push(topicValue);
  }
};

const isTopicSelected = topicValue => {
  return selectedTopics.value.includes(topicValue);
};

const closeModal = () => {
  isOpen.value = false;
  emit('close');
};

const submitTopics = async () => {
  isSubmitting.value = true;

  try {
    await store.dispatch('toggleStatus', {
      conversationId: props.conversationId,
      status: 'resolved',
      closeTopics:
        selectedTopics.value.length > 0 ? selectedTopics.value : null,
    });

    await store.dispatch('updateCustomAttributes', {
      conversationId: props.conversationId,
      customAttributes: {},
    });

    emit('success', { topics: selectedTopics.value });
    closeModal();
  } catch (error) {
    useAlert(t('CLOSE_TOPICS.ERROR_MESSAGE'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Modal v-model:show="isOpen" :on-close="closeModal" @close="closeModal">
    <div class="flex flex-col">
      <div class="p-4 border-b border-n-slate-5">
        <h1 class="text-n-slate-12 text-lg font-semibold">
          {{ $t('CLOSE_TOPICS.TITLE') }}
        </h1>
      </div>

      <div class="p-4">
        <h2 class="text-n-slate-12 text-base font-medium mb-3">
          {{ $t('CLOSE_TOPICS.TOPICS_TITLE') }}
        </h2>
        <div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
          <label
            v-for="topic in closeTopics"
            :key="topic.value"
            class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-n-slate-3 transition-colors"
            :class="{ 'bg-n-slate-3': isTopicSelected(topic.value) }"
          >
            <input
              type="checkbox"
              class="text-blue-600"
              :checked="isTopicSelected(topic.value)"
              @change="toggleTopic(topic.value)"
            />
            <span class="text-sm">{{ topic.label }}</span>
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-2 p-4 border-t border-n-slate-5">
        <Button
          faded
          slate
          :label="$t('CLOSE_TOPICS.CANCEL')"
          @click="closeModal"
        />
        <Button
          :label="$t('CLOSE_TOPICS.SAVE')"
          :is-loading="isSubmitting"
          :disabled="selectedTopics.length === 0"
          @click="submitTopics"
        />
      </div>
    </div>
  </Modal>
</template>
