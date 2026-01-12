<script setup>
import { useAlert } from 'dashboard/composables';
import MacrosTableRow from './MacrosTableRow.vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStoreGetters, useStore } from 'dashboard/composables/store';
import { useAdmin } from 'dashboard/composables/useAdmin';
import Button from 'dashboard/components-next/button/Button.vue';
import ChatwootExtraAPI from 'dashboard/api/chatwootExtra';

const getters = useStoreGetters();
const store = useStore();
const { t } = useI18n();
const { isAdmin } = useAdmin();

onMounted(() => {
  const params = isAdmin.value
    ? { include_all_personal: true, settings_context: true }
    : { settings_context: true };
  store.dispatch('macros/get', params);
});

const showDeleteConfirmationPopup = ref(false);
const selectedMacro = ref({});
const searchQuery = ref('');

const records = computed(() => getters['macros/getMacros'].value);
const uiFlags = computed(() => getters['macros/getUIFlags'].value);

const filteredAndSortedMacros = computed(() => {
  let macros = [...records.value];

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    macros = macros.filter(macro => macro.name?.toLowerCase().includes(query));
  }

  return macros.sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
});

const deleteMessage = computed(() => ` ${selectedMacro.value.name}?`);

const deleteMacro = async id => {
  try {
    // Get UUID from cache instead of making API call
    const uuid = getters['macros/getMacroExtraUUID'].value(id);

    // Delete from chatwoot-extra using cached UUID
    if (uuid) {
      try {
        await ChatwootExtraAPI.deleteMacro(uuid);
      } catch (extraError) {
        // Ignore error - macro might not have been synced
      }
    }

    // Delete from main Chatwoot
    await store.dispatch('macros/delete', id);

    useAlert(t('MACROS.DELETE.API.SUCCESS_MESSAGE'));
  } catch (error) {
    useAlert(t('MACROS.DELETE.API.ERROR_MESSAGE'));
  }
};

const openDeletePopup = response => {
  showDeleteConfirmationPopup.value = true;
  selectedMacro.value = response;
};

const closeDeletePopup = () => {
  showDeleteConfirmationPopup.value = false;
};

const confirmDeletion = () => {
  closeDeletePopup();
  deleteMacro(selectedMacro.value.id);
};

const tableHeaders = computed(() => {
  return [
    t('MACROS.LIST.TABLE_HEADER.NAME'),
    t('MACROS.LIST.TABLE_HEADER.CREATED BY'),
    t('MACROS.LIST.TABLE_HEADER.LAST_UPDATED_BY'),
    t('MACROS.LIST.TABLE_HEADER.VISIBILITY'),
  ];
});
</script>

<template>
  <SettingsLayout
    :no-records-message="$t('MACROS.LIST.404')"
    :no-records-found="!records.length"
    :is-loading="uiFlags.isFetching"
    :loading-message="$t('MACROS.LOADING')"
    feature-name="macros"
  >
    <template #header>
      <BaseSettingsHeader
        :title="$t('MACROS.HEADER')"
        :description="$t('MACROS.DESCRIPTION')"
        :link-text="$t('MACROS.LEARN_MORE')"
        feature-name="macros"
      >
        <template #actions>
          <router-link :to="{ name: 'macros_new' }">
            <Button
              icon="i-lucide-circle-plus"
              :label="$t('MACROS.HEADER_BTN_TXT')"
            />
          </router-link>
        </template>
      </BaseSettingsHeader>
    </template>
    <template #body>
      <div class="mb-4">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('MACROS.SEARCH_PLACEHOLDER')"
          class="w-full max-w-md px-4 py-2 border border-n-border rounded-md text-n-slate-12 bg-n-white focus:outline-none focus:ring-2 focus:ring-n-woot-500 focus:border-transparent"
        />
      </div>
      <table class="min-w-full divide-y divide-n-weak">
        <thead>
          <th
            v-for="thHeader in tableHeaders"
            :key="thHeader"
            class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11"
          >
            {{ thHeader }}
          </th>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <MacrosTableRow
            v-for="(macro, index) in filteredAndSortedMacros"
            :key="index"
            :macro="macro"
            @delete="openDeletePopup(macro)"
          />
        </tbody>
      </table>
      <woot-delete-modal
        v-model:show="showDeleteConfirmationPopup"
        :on-close="closeDeletePopup"
        :on-confirm="confirmDeletion"
        :title="$t('LABEL_MGMT.DELETE.CONFIRM.TITLE')"
        :message="$t('MACROS.DELETE.CONFIRM.MESSAGE')"
        :message-value="deleteMessage"
        :confirm-text="$t('MACROS.DELETE.CONFIRM.YES')"
        :reject-text="$t('MACROS.DELETE.CONFIRM.NO')"
      />
    </template>
  </SettingsLayout>
</template>
