<script setup>
import { computed } from 'vue';
import ContactPanel from 'dashboard/routes/dashboard/conversation/ContactPanel.vue';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { useWindowSize } from '@vueuse/core';
import { vOnClickOutside } from '@vueuse/components';
import wootConstants from 'dashboard/constants/globals';

defineProps({
  currentChat: {
    required: true,
    type: Object,
  },
});

const { uiSettings, updateUISettings } = useUISettings();
const { width: windowWidth } = useWindowSize();

const activeTab = computed(() => {
  const { is_contact_sidebar_open: isContactSidebarOpen } = uiSettings.value;

  if (isContactSidebarOpen) {
    return 0;
  }
  return null;
});

const isSmallScreen = computed(
  () => windowWidth.value < wootConstants.SMALL_SCREEN_BREAKPOINT
);

const closeContactPanel = () => {
  updateUISettings({
    is_contact_sidebar_open: false,
    is_copilot_panel_open: false,
  });
};

const closeOnClickOutside = () => {
  if (isSmallScreen.value && uiSettings.value?.is_contact_sidebar_open) {
    closeContactPanel();
  }
};
</script>

<template>
  <div
    v-on-click-outside="closeOnClickOutside"
    class="bg-n-background h-full overflow-visible flex flex-col fixed top-0 z-40 w-full max-w-sm transition-transform duration-300 ease-in-out ltr:right-0 rtl:left-0 md:static md:w-full md:max-w-none ltr:border-l rtl:border-r border-n-weak shadow-lg md:shadow-none"
    :class="[
      {
        'md:flex': activeTab === 0,
        'md:hidden': activeTab !== 0,
      },
    ]"
  >
    <div
      v-if="isSmallScreen"
      class="flex items-center gap-2 h-12 px-2 border-b border-n-weak flex-shrink-0"
    >
      <button
        type="button"
        class="flex items-center justify-center h-10 w-10 rounded-lg text-n-slate-12 hover:bg-n-alpha-2"
        :aria-label="$t('CONVERSATION.CLOSE_CONTACT_PANEL')"
        @click="closeContactPanel"
      >
        <span class="i-lucide-arrow-left size-5" />
      </button>
      <span class="text-sm font-medium text-n-slate-12 truncate">
        {{ $t('CONVERSATION.CONTACT_PANEL_HEADER') }}
      </span>
    </div>
    <div
      class="flex flex-1 overflow-x-visible overflow-y-auto relative z-[100]"
    >
      <ContactPanel
        v-show="activeTab === 0"
        :conversation-id="currentChat.id"
        :inbox-id="currentChat.inbox_id"
      />
    </div>
  </div>
</template>
