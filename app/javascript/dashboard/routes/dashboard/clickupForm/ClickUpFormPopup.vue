<script setup>
import { watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  show: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const onKeydown = e => {
  if (e.key === 'Escape' && props.show) emit('close');
};

watch(
  () => props.show,
  isOpen => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-2 sm:p-6"
      @click.self="emit('close')"
    >
      <div
        class="relative flex flex-col w-full h-full max-w-full sm:max-w-4xl lg:max-w-[1120px] max-h-[95vh] sm:max-h-[90vh] bg-n-background rounded-xl shadow-2xl overflow-hidden border border-n-weak"
      >
        <button
          type="button"
          class="absolute top-3 right-3 z-[70] flex items-center justify-center size-8 rounded-md bg-n-solid-2 hover:bg-n-alpha-2 text-n-slate-12 border border-n-weak"
          :aria-label="t('GENERAL.CLOSE')"
          @click="emit('close')"
        >
          <span class="i-lucide-x size-4" />
        </button>
        <iframe
          :title="t('SIDEBAR.CLICKUP_FORM')"
          src="https://forms.clickup.com/43322895/f/19a3gf-70672/AV5KBTNJEFO6F4BS08"
          class="w-full h-full border-0"
        />
      </div>
    </div>
  </Teleport>
</template>
