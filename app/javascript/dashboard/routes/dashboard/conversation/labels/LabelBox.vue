<script>
import { ref, computed } from 'vue';
import { mapGetters } from 'vuex';
import { useStore } from 'dashboard/composables/store';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useConversationLabels } from 'dashboard/composables/useConversationLabels';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import Spinner from 'shared/components/Spinner.vue';
import LabelDropdown from 'shared/components/ui/label/LabelDropdown.vue';
import AddLabel from 'shared/components/ui/dropdown/AddLabel.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';

export default {
  components: {
    Spinner,
    LabelDropdown,
    AddLabel,
    NextButton,
  },
  setup() {
    const store = useStore();
    const { isAdmin } = useAdmin();

    const {
      savedLabels,
      activeLabels,
      accountLabels,
      addLabelToConversation,
      removeLabelFromConversation,
      onUpdateLabels,
    } = useConversationLabels();

    const showSearchDropdownLabel = ref(false);

    const currentChat = computed(() => store.getters.getSelectedChat);
    const conversationId = computed(() => currentChat.value?.id);

    const linkedLabels = computed(() => {
      return store.getters['linkedSourceChannels/getLinkedConversationLabels'](
        conversationId.value
      );
    });

    const newLinkedLabels = computed(() => {
      return linkedLabels.value.filter(
        label => !savedLabels.value.includes(label)
      );
    });

    const showLinkedLabels = computed(() => newLinkedLabels.value.length > 0);

    const applyLinkedLabels = () => {
      const merged = [
        ...new Set([...savedLabels.value, ...linkedLabels.value]),
      ];
      onUpdateLabels(merged);
    };

    const toggleLabels = () => {
      showSearchDropdownLabel.value = !showSearchDropdownLabel.value;
    };

    const closeDropdownLabel = () => {
      showSearchDropdownLabel.value = false;
    };

    const keyboardEvents = {
      KeyL: {
        action: e => {
          e.preventDefault();
          toggleLabels();
        },
      },
      Escape: {
        action: () => {
          if (showSearchDropdownLabel.value) {
            toggleLabels();
          }
        },
        allowOnFocusedInput: true,
      },
    };
    useKeyboardEvents(keyboardEvents);
    return {
      isAdmin,
      savedLabels,
      activeLabels,
      accountLabels,
      addLabelToConversation,
      removeLabelFromConversation,
      showSearchDropdownLabel,
      closeDropdownLabel,
      toggleLabels,
      showLinkedLabels,
      newLinkedLabels,
      applyLinkedLabels,
    };
  },
  data() {
    return {
      selectedLabels: [],
    };
  },

  computed: {
    ...mapGetters({
      conversationUiFlags: 'conversationLabels/getUIFlags',
    }),
  },
};
</script>

<template>
  <div class="sidebar-labels-wrap">
    <div
      v-if="showLinkedLabels"
      class="flex items-center gap-2 p-2 mb-2 bg-n-alpha-1 dark:bg-n-alpha-2 rounded-lg"
    >
      <div class="flex flex-wrap items-center gap-1 flex-1 min-w-0">
        <span class="text-xs text-n-slate-10 shrink-0">
          {{ $t('CONVERSATION.PREVIOUS_LABELS') }}
        </span>
        <span
          v-for="label in newLinkedLabels"
          :key="label"
          class="text-xs text-n-slate-11 bg-n-alpha-2 dark:bg-n-alpha-3 px-1.5 py-0.5 rounded"
        >
          {{ label }}
        </span>
      </div>
      <NextButton
        v-tooltip="$t('CONVERSATION.APPLY_LINKED_LABELS')"
        icon="i-lucide-save"
        slate
        faded
        xs
        @click="applyLinkedLabels"
      />
    </div>
    <div
      v-if="!conversationUiFlags.isFetching"
      class="contact-conversation--list"
    >
      <div
        v-on-clickaway="closeDropdownLabel"
        class="label-wrap flex flex-wrap"
        @keyup.esc="closeDropdownLabel"
      >
        <AddLabel @add="toggleLabels" />
        <woot-label
          v-for="label in activeLabels"
          :key="label.id"
          :title="label.title"
          :description="label.description"
          show-close
          :color="label.color"
          variant="smooth"
          class="max-w-[calc(100%-0.5rem)]"
          @remove="removeLabelFromConversation"
        />

        <div
          :class="{
            'block visible': showSearchDropdownLabel,
            'hidden invisible': !showSearchDropdownLabel,
          }"
          class="border rounded-lg bg-n-alpha-3 top-6 backdrop-blur-[100px] absolute w-full shadow-lg border-n-strong dark:border-n-strong p-2 box-border z-[9999]"
        >
          <LabelDropdown
            v-if="showSearchDropdownLabel"
            :account-labels="accountLabels"
            :selected-labels="savedLabels"
            :allow-creation="isAdmin"
            @add="addLabelToConversation"
            @remove="removeLabelFromConversation"
          />
        </div>
      </div>
    </div>
    <Spinner v-else />
  </div>
</template>

<style lang="scss" scoped>
.sidebar-labels-wrap {
  margin-bottom: 0;
}
.contact-conversation--list {
  width: 100%;

  .label-wrap {
    line-height: 1.5rem;
    position: relative;
  }
}
</style>
