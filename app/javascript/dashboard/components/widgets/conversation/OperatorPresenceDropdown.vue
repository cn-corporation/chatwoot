<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useOperatorPresence } from 'dashboard/composables/useOperatorPresence';
import Avatar from 'next/avatar/Avatar.vue';

const props = defineProps({
  conversationId: {
    type: [Number, String],
    required: true,
  },
});

const { t } = useI18n();
const store = useStore();

const isOpen = ref(false);
const dropdownRef = ref(null);

const currentUser = computed(() => store.getters.getCurrentUser);
const allAgents = computed(() => store.getters['agents/getVerifiedAgents']);

const operatorId = computed(() => currentUser.value?.id);
const conversationIdRef = computed(() => props.conversationId);

const { operators, isConnected, error, isTransitioning } = useOperatorPresence(
  conversationIdRef,
  operatorId
);

const operatorsWithDetails = computed(() => {
  return operators.value
    .map(op => {
      // Use loose equality to handle string/number mismatch
      const agent = allAgents.value.find(
        a => String(a.id) === String(op.operatorId)
      );
      return agent
        ? {
            ...agent,
            joinedAt: op.joinedAt,
          }
        : null;
    })
    .filter(Boolean);
});

const currentUserInList = computed(() =>
  operatorsWithDetails.value.some(
    op => String(op.id) === String(currentUser.value?.id)
  )
);

const otherOperators = computed(() =>
  operatorsWithDetails.value.filter(
    op => String(op.id) !== String(currentUser.value?.id)
  )
);

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

watch(
  () => props.conversationId,
  () => {
    isOpen.value = false;
  }
);
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <button
      class="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors border"
      :disabled="isTransitioning"
      :class="[
        isTransitioning
          ? 'opacity-60 cursor-wait'
          : isConnected
            ? 'bg-n-background border-n-weak hover:bg-n-slate-2 text-n-slate-12'
            : 'bg-n-background border-n-weak text-n-slate-10',
      ]"
      @click="toggleDropdown"
    >
      <fluent-icon v-if="!isTransitioning" icon="people" size="14" />
      <fluent-icon v-else icon="spinner" class="animate-spin" size="14" />
      <span v-if="!isTransitioning">{{ operatorsWithDetails.length }}</span>
      <span v-else>...</span>
    </button>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 z-[50] mt-2 w-64 origin-top-right rounded-md bg-n-background border border-n-weak shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="py-1 max-h-80 overflow-y-auto">
          <div
            class="px-3 py-2 text-xs font-medium text-n-slate-11 border-b border-n-weak"
          >
            {{ t('OPERATOR_PRESENCE.TITLE') }}
          </div>

          <div v-if="error" class="px-3 py-2 text-xs text-n-red-10">
            {{ error }}
          </div>

          <div v-else-if="operatorsWithDetails.length === 0" class="px-3 py-4">
            <div
              class="flex flex-col items-center justify-center text-center text-n-slate-10"
            >
              <fluent-icon icon="people" size="24" class="mb-2" />
              <p class="text-xs">
                {{ t('OPERATOR_PRESENCE.NO_OPERATORS') }}
              </p>
            </div>
          </div>

          <div v-else class="divide-y divide-n-weak">
            <div v-if="currentUserInList" class="px-2 py-1">
              <div
                v-for="operator in operatorsWithDetails.filter(
                  op => String(op.id) === String(currentUser.id)
                )"
                :key="operator.id"
                class="flex items-center gap-2 px-2 py-2 rounded-md bg-n-slate-2"
              >
                <Avatar
                  :name="operator.name"
                  :src="operator.thumbnail"
                  :size="24"
                  :status="operator.availability_status"
                  hide-offline-status
                  rounded-full
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-n-slate-12 truncate">
                    {{ operator.name }}
                    <span class="text-n-slate-10"
                      >({{ t('OPERATOR_PRESENCE.YOU') }})</span
                    >
                  </p>
                </div>
                <div
                  class="w-2 h-2 rounded-full bg-n-green-9 flex-shrink-0"
                  :title="t('OPERATOR_PRESENCE.VIEWING')"
                />
              </div>
            </div>

            <div v-if="otherOperators.length > 0" class="px-2 py-1">
              <div
                v-for="operator in otherOperators"
                :key="operator.id"
                class="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-n-slate-2 transition-colors"
              >
                <Avatar
                  :name="operator.name"
                  :src="operator.thumbnail"
                  :size="24"
                  :status="operator.availability_status"
                  hide-offline-status
                  rounded-full
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-n-slate-12 truncate">
                    {{ operator.name }}
                  </p>
                </div>
                <div
                  class="w-2 h-2 rounded-full bg-n-green-9 flex-shrink-0"
                  :title="t('OPERATOR_PRESENCE.VIEWING')"
                />
              </div>
            </div>
          </div>

          <div
            v-if="!isConnected"
            class="px-3 py-2 text-xs text-n-amber-10 border-t border-n-weak bg-n-amber-1"
          >
            {{ t('OPERATOR_PRESENCE.CONNECTING') }}
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
