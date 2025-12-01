<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import WootSnackbar from './Snackbar.vue';
import { emitter } from 'shared/helpers/mitt';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  duration: {
    type: Number,
    default: 2500,
  },
});

const { t } = useI18n();

const snackMessages = ref([]);
const snackbarContainer = ref(null);
const timeoutIds = ref([]);

const showPopover = () => {
  try {
    const el = snackbarContainer.value;
    if (el?.matches(':popover-open')) {
      el.hidePopover();
    }
    el?.showPopover();
  } catch (e) {
    // ignore
  }
};

const onNewToastMessage = ({ message: originalMessage, action }) => {
  const message = action?.usei18n ? t(originalMessage) : originalMessage;
  const duration = action?.duration || props.duration;

  snackMessages.value.push({
    key: Date.now(),
    message,
    action,
  });

  nextTick(showPopover);

  const timeoutId = setTimeout(() => {
    snackMessages.value.shift();
    const index = timeoutIds.value.indexOf(timeoutId);
    if (index > -1) {
      timeoutIds.value.splice(index, 1);
    }
  }, duration);

  timeoutIds.value.push(timeoutId);
};

onMounted(() => {
  emitter.on('newToastMessage', onNewToastMessage);
});

onUnmounted(() => {
  emitter.off('newToastMessage', onNewToastMessage);
  timeoutIds.value.forEach(timeoutId => clearTimeout(timeoutId));
  timeoutIds.value = [];
});
</script>

<template>
  <div
    ref="snackbarContainer"
    popover="manual"
    class="fixed top-4 left-1/2 -translate-x-1/2 max-w-[25rem] w-[calc(100%-2rem)] text-center bg-transparent border-0 p-0 m-0 outline-none overflow-visible"
  >
    <transition-group name="toast-fade" tag="div">
      <WootSnackbar
        v-for="snackMessage in snackMessages"
        :key="snackMessage.key"
        :message="snackMessage.message"
        :action="snackMessage.action"
      />
    </transition-group>
  </div>
</template>
