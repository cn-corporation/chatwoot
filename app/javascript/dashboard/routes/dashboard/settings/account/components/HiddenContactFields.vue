<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import { useAlert } from 'dashboard/composables';
import SectionLayout from './SectionLayout.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';

const FIELD_OPTIONS = [
  {
    key: 'telegram_id',
    labelKey: 'GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.FIELDS.TELEGRAM_ID',
  },
  {
    key: 'telegram_username',
    labelKey:
      'GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.FIELDS.TELEGRAM_USERNAME',
  },
  {
    key: 'clubgg_username',
    labelKey:
      'GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.FIELDS.CLUBGG_USERNAME',
  },
  {
    key: 'overlay',
    labelKey: 'GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.FIELDS.OVERLAY',
  },
];

const { t } = useI18n();
const { currentAccount, updateAccount } = useAccount();

const hiddenFields = ref([]);

watch(
  currentAccount,
  () => {
    const { hidden_contact_fields } = currentAccount.value?.settings || {};
    hiddenFields.value = hidden_contact_fields || [];
  },
  { deep: true, immediate: true }
);

const toggleField = key => {
  if (hiddenFields.value.includes(key)) {
    hiddenFields.value = hiddenFields.value.filter(f => f !== key);
  } else {
    hiddenFields.value = [...hiddenFields.value, key];
  }
};

const save = async () => {
  try {
    await updateAccount({
      hidden_contact_fields: hiddenFields.value,
    });
    useAlert(t('GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.API.SUCCESS'));
  } catch (error) {
    useAlert(t('GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.API.ERROR'));
  }
};
</script>

<template>
  <SectionLayout
    :title="t('GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.TITLE')"
    :description="t('GENERAL_SETTINGS.FORM.HIDDEN_CONTACT_FIELDS.NOTE')"
    with-border
  >
    <div class="flex flex-col gap-3">
      <label
        v-for="field in FIELD_OPTIONS"
        :key="field.key"
        class="flex items-center gap-2 cursor-pointer text-sm text-n-slate-12"
      >
        <input
          type="checkbox"
          :checked="hiddenFields.includes(field.key)"
          class="size-4"
          @change="toggleField(field.key)"
        />
        {{ t(field.labelKey) }}
      </label>
      <div>
        <NextButton blue @click="save">
          {{ t('GENERAL_SETTINGS.SUBMIT') }}
        </NextButton>
      </div>
    </div>
  </SectionLayout>
</template>
