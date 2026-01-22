<script setup>
import { useAlert } from 'dashboard/composables';
import AddPersonalCanned from './AddPersonalCanned.vue';
import EditPersonalCanned from './EditPersonalCanned.vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import { computed, onMounted, ref, defineOptions } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';

import Button from 'dashboard/components-next/button/Button.vue';

defineOptions({
  name: 'PersonalCannedResponseSettings',
});

const store = useStore();
const { t } = useI18n();

const showAddPopup = ref(false);
const loading = ref({});
const showEditPopup = ref(false);
const showDeleteConfirmationPopup = ref(false);
const activeResponse = ref({});
const cannedResponseAPI = ref({ message: '' });

const sortOrder = ref('asc');

const records = computed(() => {
  const responses = store.getters[
    'personalCannedResponse/getSortedPersonalCannedResponses'
  ](sortOrder.value);
  return responses;
});

const uiFlags = computed(
  () => store.getters['personalCannedResponse/getPersonalCannedUIFlags']
);

const deleteConfirmText = computed(
  () =>
    `${t('PERSONAL_CANNED_MGMT.DELETE.CONFIRM.YES')} ${activeResponse.value.command}`
);

const deleteRejectText = computed(
  () =>
    `${t('PERSONAL_CANNED_MGMT.DELETE.CONFIRM.NO')} ${activeResponse.value.command}`
);

const deleteMessage = computed(() => {
  return ` ${activeResponse.value.command} ? `;
});

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};

const fetchPersonalCannedResponses = async () => {
  try {
    await store.dispatch('personalCannedResponse/getPersonalCannedResponses', {
      force: true,
    });
  } catch (error) {
    // Ignore Error
  }
};

onMounted(() => {
  fetchPersonalCannedResponses();
});

const showAlertMessage = message => {
  loading.value[activeResponse.value.id] = false;
  activeResponse.value = {};
  cannedResponseAPI.value.message = message;
  useAlert(message);
};

const openAddPopup = () => {
  showAddPopup.value = true;
};
const hideAddPopup = () => {
  showAddPopup.value = false;
};

const openEditPopup = response => {
  showEditPopup.value = true;
  activeResponse.value = response;
};
const hideEditPopup = () => {
  showEditPopup.value = false;
};

const openDeletePopup = response => {
  showDeleteConfirmationPopup.value = true;
  activeResponse.value = response;
};

const closeDeletePopup = () => {
  showDeleteConfirmationPopup.value = false;
};

const deletePersonalCannedResponse = async id => {
  try {
    await store.dispatch(
      'personalCannedResponse/deletePersonalCannedResponse',
      id
    );
    showAlertMessage(t('PERSONAL_CANNED_MGMT.DELETE.API.SUCCESS_MESSAGE'));
  } catch (error) {
    const errorMessage =
      error?.message || t('PERSONAL_CANNED_MGMT.DELETE.API.ERROR_MESSAGE');
    showAlertMessage(errorMessage);
  }
};

const confirmDeletion = () => {
  loading.value[activeResponse.value.id] = true;
  closeDeletePopup();
  deletePersonalCannedResponse(activeResponse.value.id);
};

const tableHeaders = computed(() => {
  return [
    t('PERSONAL_CANNED_MGMT.LIST.TABLE_HEADER.SHORT_CODE'),
    t('PERSONAL_CANNED_MGMT.LIST.TABLE_HEADER.CONTENT'),
    t('PERSONAL_CANNED_MGMT.LIST.TABLE_HEADER.ACTIONS'),
  ];
});
</script>

<template>
  <div class="flex-1 overflow-auto">
    <BaseSettingsHeader
      :title="$t('PERSONAL_CANNED_MGMT.HEADER')"
      :description="$t('PERSONAL_CANNED_MGMT.DESCRIPTION')"
    >
      <template #actions>
        <Button
          icon="i-lucide-circle-plus"
          :label="$t('PERSONAL_CANNED_MGMT.HEADER_BTN_TXT')"
          @click="openAddPopup"
        />
      </template>
    </BaseSettingsHeader>

    <div class="mt-6 flex-1">
      <woot-loading-state
        v-if="uiFlags.fetchingList"
        :message="$t('PERSONAL_CANNED_MGMT.LOADING')"
      />
      <p
        v-else-if="!records.length"
        class="flex flex-col items-center justify-center h-full text-base text-n-slate-11 py-8"
      >
        {{ $t('PERSONAL_CANNED_MGMT.LIST.404') }}
      </p>
      <table v-else class="min-w-full overflow-x-auto divide-y divide-n-weak">
        <thead>
          <th
            v-for="thHeader in tableHeaders"
            :key="thHeader"
            class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11 last:text-right"
          >
            <span v-if="thHeader !== tableHeaders[0]">
              {{ thHeader }}
            </span>
            <button
              v-else
              class="flex items-center p-0 cursor-pointer"
              @click="toggleSort"
            >
              <span class="mb-0">
                {{ thHeader }}
              </span>
              <fluent-icon
                class="ml-2 size-4"
                :icon="sortOrder === 'desc' ? 'chevron-up' : 'chevron-down'"
              />
            </button>
          </th>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <tr v-for="cannedItem in records" :key="cannedItem.id">
            <td
              class="py-4 ltr:pr-4 rtl:pl-4 truncate max-w-xs font-medium"
              :title="cannedItem.command"
            >
              {{ cannedItem.command }}
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4 md:break-all whitespace-normal">
              {{ cannedItem.text }}
            </td>
            <td class="py-4 flex justify-end gap-1">
              <Button
                v-tooltip.top="$t('PERSONAL_CANNED_MGMT.EDIT.BUTTON_TEXT')"
                icon="i-lucide-pen"
                slate
                xs
                faded
                @click="openEditPopup(cannedItem)"
              />
              <Button
                v-tooltip.top="$t('PERSONAL_CANNED_MGMT.DELETE.BUTTON_TEXT')"
                icon="i-lucide-trash-2"
                xs
                ruby
                faded
                :is-loading="loading[cannedItem.id]"
                @click="openDeletePopup(cannedItem)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <woot-modal v-model:show="showAddPopup" :on-close="hideAddPopup">
      <AddPersonalCanned :on-close="hideAddPopup" />
    </woot-modal>

    <woot-modal v-model:show="showEditPopup" :on-close="hideEditPopup">
      <EditPersonalCanned
        v-if="showEditPopup"
        :id="activeResponse.id"
        :ed-command="activeResponse.command"
        :ed-text="activeResponse.text"
        :on-close="hideEditPopup"
      />
    </woot-modal>

    <woot-delete-modal
      v-model:show="showDeleteConfirmationPopup"
      :on-close="closeDeletePopup"
      :on-confirm="confirmDeletion"
      :title="$t('PERSONAL_CANNED_MGMT.DELETE.CONFIRM.TITLE')"
      :message="$t('PERSONAL_CANNED_MGMT.DELETE.CONFIRM.MESSAGE')"
      :message-value="deleteMessage"
      :confirm-text="deleteConfirmText"
      :reject-text="deleteRejectText"
    />
  </div>
</template>
